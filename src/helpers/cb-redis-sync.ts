import Redis from 'ioredis';
import { CircuitState, CircuitBreakerPolicy } from 'cockatiel';
import { randomUUID } from 'crypto';

/**
 * Channel Redis để broadcast CB state change giữa tất cả instance trong cluster.
 *
 * Topology thực tế:
 *   VPS 1 → PM2 instance 0 ─┐
 *   VPS 1 → PM2 instance 1 ─┤
 *   VPS 2 → PM2 instance 0 ─┼─▶ Redis (shared) ◀─▶ tất cả đều subscribe channel này
 *   VPS 2 → PM2 instance 1 ─┘
 *
 * Khi 1 instance phát hiện service down và CB trip:
 *   Instance A (VPS1-PM2-0): CB tự OPEN → publish lên channel này
 *   Instance B, C, D nhận event → tự force ISOLATED ngay lập tức
 *   Kết quả: toàn bộ 4 instance ngắt mạch trong < 10ms
 */
const CB_CHANNEL = 'mmorpg:circuit-breaker:state';

/**
 * UUID random, generate 1 lần khi process khởi động.
 *
 * Dùng để filter: khi nhận message từ Redis, bỏ qua nếu fromInstance === INSTANCE_ID
 * (tránh instance xử lý lại event do chính nó publish).
 *
 * Tại sao UUID thay vì VPS_ID + PM2_ID:
 *   Không cần config thêm .env cho từng VPS hay từng PM2 node.
 *   randomUUID() đảm bảo unique trên toàn cluster mà không cần coordination.
 *   Mỗi lần PM2 restart process là 1 UUID mới — không bao giờ trùng.
 */
const INSTANCE_ID = randomUUID();

interface CbStateMessage {
  service: string;
  state: CircuitState;
  fromInstance: string;
  timestamp: number;
}

/**
 * Base timeout trước khi tự release ISOLATED (safety net cho worst case Redis down).
 * 60s >> halfOpenAfter (10s) — đủ thời gian để instance gốc (A) tự recover
 * qua HALF-OPEN và publish Closed event về cho các instance khác.
 */
const ISOLATED_TIMEOUT_MS = 60_000;

/**
 * Jitter ngẫu nhiên thêm vào timeout của từng instance — giải quyết vấn đề
 * "thundering herd" khi tất cả instance cùng timeout một lúc.
 *
 * --- Vấn đề nếu không có jitter ---
 *
 * Giả sử service sập đúng 60s (hoặc Redis down đúng lúc A recover):
 *
 *   t=0s    A trip → OPEN → publish Open
 *           B, C, D nhận → isolate() + setTimeout(60s) mỗi cái
 *
 *   t=60s   B timeout → dispose() → CLOSED → gọi service → fail → trip → publish Open
 *           C timeout → dispose() → CLOSED → gọi service → fail → trip → publish Open
 *           D timeout → dispose() → CLOSED → gọi service → fail → trip → publish Open
 *
 *           Kết quả: 3 instance cùng gọi service cùng lúc, cùng fail, cùng publish Open
 *           → A nhận 3 Open event → isolate() 3 lần → counter = 3
 *           → B nhận Open từ C, D → isolate() 2 lần
 *           → cross-publish loạn, reference counter tăng không kiểm soát được
 *
 * --- Fix: stagger timeout bằng jitter ---
 *
 * Mỗi instance có timeout khác nhau trong khoảng [60s, 90s].
 * Instance nào timeout trước sẽ thử gọi service một mình:
 *
 *   t=60s+jitter_B  B timeout (nhỏ nhất) → dispose → thử gọi service
 *     → service vẫn chết → B tự trip → OPEN → publish Open
 *     → C, D nhận Open event → reset timeout thêm 60s nữa → C, D im lặng tiếp
 *
 *     → service đã recover → B: CLOSED → publish Closed
 *     → C, D nhận Closed → clearTimeout → dispose bình thường → không ai timeout nữa
 *
 * Chỉ có đúng 1 instance thử gọi service tại một thời điểm — không có noise.
 *
 * --- Tại sao dùng INSTANCE_ID để tính jitter thay vì Math.random() ---
 *
 * Math.random() mỗi lần restart process ra giá trị khác nhau — không vấn đề gì.
 * Nhưng dùng INSTANCE_ID (UUID) để tính jitter thì deterministic trong 1 session:
 * cùng 1 process luôn có cùng jitter value, không thay đổi giữa các lần nhận event.
 * → Dễ debug hơn khi nhìn log: biết instance này luôn timeout ở ~t+72s chẳng hạn.
 *
 * Lấy 2 ký tự hex đầu của UUID (0x00 → 0xFF = 0 → 255) → normalize về [0, 30000]ms.
 * Kết quả: mỗi instance có jitter cố định trong khoảng 0-30s, tổng timeout 60-90s.
 */
const jitter = (parseInt(INSTANCE_ID.slice(0, 2), 16) / 255) * 30_000;
const ISOLATED_TIMEOUT_WITH_JITTER = ISOLATED_TIMEOUT_MS + jitter;

/**
 * 2 connection riêng cho pub và sub — bắt buộc với Redis Pub/Sub protocol.
 *
 * Khi connection đã SUBSCRIBE, Redis lock nó vào chế độ chỉ nhận message.
 * Không thể PUBLISH hay thực hiện bất kỳ lệnh nào khác trên connection đó.
 * → pub: chỉ PUBLISH
 * → sub: chỉ SUBSCRIBE + nhận message
 *
 * Không tái sử dụng connection của Socket.IO Redis adapter vì adapter đó
 * dùng channel nội bộ riêng (socket.io#/#) và không expose API publish tùy ý.
 * Dù cùng REDIS_URL, channel hoàn toàn độc lập — không có conflict.
 */
const pub = new Redis(process.env.REDIS_URL ?? '');
const sub = pub.duplicate();

/**
 * Lưu isolate handle và timeout ID của từng service đang bị force ISOLATED.
 *
 * --- Tại sao dùng ISOLATED thay vì để instance tự gọi service và tự trip? ---
 *
 * Instance B không có failure count thực tế — nó chỉ nghe A nói "service đang chết".
 * Nếu để B tự recover độc lập (không isolate, chờ halfOpenAfter rồi tự thử):
 *
 *   t=0s   A trip → OPEN. B, C, D không biết gì → vẫn CLOSED → tiếp tục gọi service
 *          → B, C, D cũng nhận failure → cũng trip → cũng publish Open event
 *          → A nhận Open event từ B, C, D → xử lý thừa
 *          → noise: 4 instance cùng publish, cùng nhận, cùng xử lý chéo nhau
 *
 *   t=10s  A vào HALF-OPEN, thử 1 request → fail → OPEN lại → publish Open
 *          B tự recover → CLOSED → gọi service → fail → trip → publish Open
 *          → A nhận Open từ B → isolate lại chính mình???
 *          → state machine lộn xộn, khó predict behavior
 *
 * Với ISOLATED: B, C, D im lặng hoàn toàn, không gọi service, không publish gì.
 * Chỉ A là người duy nhất có ground truth (thực sự gọi service và nhận failure).
 * A tự recover → publish Closed → B, C, D mới release. Sạch và predictable.
 *
 * --- Trade-off: worst case khi Redis down ---
 *
 * Nếu Redis tạm thời down ngay lúc A recover:
 *   A: OPEN → CLOSED → publish Closed event → Redis down → event MẤT
 *   B, C, D vẫn ISOLATED mãi mãi dù auth-service đã sống
 *   → 3/4 instance chặn traffic vô thời hạn
 *
 * Fix: safety timeout — tự động dispose() sau ISOLATED_TIMEOUT_MS.
 * Sau timeout, B thoát ISOLATED, thử gọi service:
 *   - Nếu service đã recover → OK, CB CLOSED bình thường
 *   - Nếu service vẫn chết → B tự trip → OPEN → publish Open → sync lại toàn cluster
 *
 * --- Tại sao lưu cả timeoutId ---
 *
 * Khi nhận Closed event bình thường (trước khi timeout):
 *   Phải clearTimeout để tránh timeout fire sau khi đã dispose() rồi
 *   → dispose() lần 2 trên handle đã disposed → không crash nhưng không sạch
 *   → Quan trọng hơn: tránh log "[CB Sync] ISOLATED timeout" gây confusion
 *     khi thực ra recovery diễn ra bình thường qua Closed event
 */
const isolateHandles = new Map<string, {
  handle: { dispose: () => void };
  timeoutId: ReturnType<typeof setTimeout>;
}>();

export function initCbRedisSync(
  getBreakerFor: (name: string) => CircuitBreakerPolicy,
): void {
  sub.subscribe(CB_CHANNEL, (err) => {
    if (err) {
      console.error(`[CB Sync] Failed to subscribe: ${err.message}`);
      return;
    }
    console.log(`[CB Sync] Subscribed — instance: ${INSTANCE_ID}`);
  });

  sub.on('message', (_channel, raw) => {
    let msg: CbStateMessage;
    try {
      msg = JSON.parse(raw);
    } catch {
      console.warn('[CB Sync] Received invalid JSON, skipping');
      return;
    }

    // Bỏ qua event của chính mình.
    // onStateChange trong registry đã log và xử lý rồi — không cần làm lại.
    if (msg.fromInstance === INSTANCE_ID) return;

    console.log(`[CB Sync] [${msg.service}] → ${CircuitState[msg.state]} (from ${msg.fromInstance})`);

    const breaker = getBreakerFor(msg.service);

    if (msg.state === CircuitState.Open) {
        // ── Bước 1: dọn handle cũ nếu có ──────────────────────────
        const existing = isolateHandles.get(msg.service);
        // Lần đầu nhận Open → Map chưa có gì → existing = undefined → if bỏ qua
        // Lần 2+ nhận Open (service vẫn chết, A publish lại) → existing có handle + timeoutId cũ
        if (existing) {
            clearTimeout(existing.timeoutId);  // hủy cái hẹn giờ 60s cũ
            existing.handle.dispose();         // giảm reference counter về 0 → CB thoát ISOLATED
            // Tại sao phải dispose trước khi isolate() lại?
            // isolate() tăng counter lên 1 mỗi lần gọi.
            // Nếu không dispose: counter cứ tăng (1, 2, 3...)
            // Khi Closed event đến, chỉ dispose 1 lần → counter còn > 0 → CB không bao giờ thoát
        }

        // ── Bước 2: force CB vào ISOLATED ─────────────────────────
        const handle = breaker.isolate();
        // isolate() trả về { dispose() } — đây là "chìa khóa" để mở khóa sau này
        // Phải lưu lại, không có cách nào khác để release ISOLATED

        // ── Bước 3: đặt safety timeout ────────────────────────────
        const timeoutId = setTimeout(() => {
            // Callback này chạy sau ISOLATED_TIMEOUT_WITH_JITTER ms
            // nếu không bị clearTimeout() trước đó

            const current = isolateHandles.get(msg.service);
            // Kiểm tra lại vì có thể Closed event đã đến và xóa khỏi Map rồi
            // (race condition hiếm gặp nhưng cần guard)

            if (current) {
                current.handle.dispose(); // tự mở khóa
                isolateHandles.delete(msg.service); // dọn Map
            }
        }, ISOLATED_TIMEOUT_WITH_JITTER);

        // ── Bước 4: lưu cả hai vào Map ────────────────────────────
        isolateHandles.set(msg.service, { handle, timeoutId });
        // handle   → cần để dispose() khi nhận Closed event
        // timeoutId → cần để clearTimeout() khi nhận Closed event trước khi timeout fire
    } else if (msg.state === CircuitState.Closed) {
      // Instance gốc (A) đã recover → release isolation bình thường.
      const existing = isolateHandles.get(msg.service);
      if (existing) {
        clearTimeout(existing.timeoutId); // hủy safety timeout — không cần nữa
        existing.handle.dispose();        // CB: ISOLATED → CLOSED
        isolateHandles.delete(msg.service);
      }
    }
  });

  process.on('SIGTERM', () => { pub.quit(); sub.quit(); });
  process.on('SIGINT',  () => { pub.quit(); sub.quit(); });
}

/**
 * Fire-and-forget — không await, không block request flow.
 *
 * Nếu Redis tạm thời down thì event mất.
 * Đây là acceptable vì safety timeout sẽ tự release ISOLATED sau 60s.
 * Các instance sau đó tự xử lý recovery độc lập.
 */
export function publishCbState(service: string, state: CircuitState): void {
  const msg: CbStateMessage = {
    service,
    state,
    fromInstance: INSTANCE_ID,
    timestamp: Date.now(),
  };

  pub.publish(CB_CHANNEL, JSON.stringify(msg)).catch(err => {
    console.warn(`[CB Sync] Failed to publish state for ${service}: ${err.message}`);
  });
}