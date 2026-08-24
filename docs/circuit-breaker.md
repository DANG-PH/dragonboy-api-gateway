# Circuit Breaker — Hướng Dẫn Toàn Diện

> Viết cho developer backend làm việc với microservices, đặc biệt NestJS + gRPC stack.

---

## Mục Lục

1. [Định nghĩa](#1-định-nghĩa)
2. [Tại sao cần Circuit Breaker](#2-tại-sao-cần-circuit-breaker)
3. [Ba trạng thái hoạt động](#3-ba-trạng-thái-hoạt-động)
4. [Khi nào nên dùng](#4-khi-nào-nên-dùng)
5. [Tác hại và rủi ro nếu dùng sai](#5-tác-hại-và-rủi-ro-nếu-dùng-sai)
6. [Implement trong NestJS + gRPC](#6-implement-trong-nestjs--grpc)
7. [CB vs Bulkhead vs Timeout](#7-cb-vs-bulkhead-vs-timeout)
8. [PM2 Cluster: vấn đề in-memory và giải pháp Redis Pub/Sub](#8-pm2-cluster-vấn-đề-in-memory-và-giải-pháp-redis-pubsub)
9. [Graceful Degradation](#9-graceful-degradation)
10. [Testing Circuit Breaker](#10-testing-circuit-breaker)
11. [Case thực tế: MMORPG Backend](#11-case-thực-tế-mmorpg-backend)
12. [Những gì được upgrade khi thêm CB](#12-những-gì-được-upgrade-khi-thêm-cb)
13. [Tips và best practices](#13-tips-và-best-practices)
14. [Các config quan trọng cần tuning](#14-các-config-quan-trọng-cần-tuning)

---

## 1. Định nghĩa

**Circuit Breaker** (CB) là một design pattern dùng để ngăn cascade failure trong hệ thống phân tán. Tên gọi lấy từ cầu dao điện — khi phát hiện quá tải, cầu dao tự ngắt để bảo vệ toàn bộ mạch.

Trong software, CB là một lớp proxy nằm giữa caller và callee. Nó theo dõi các lần gọi, đếm failure, và khi failure vượt ngưỡng thì **chủ động chặn** các request tiếp theo thay vì để chúng chờ timeout.

```
Không có CB:
  Caller ──────────────────────────────▶ [Service DOWN] → timeout 30s → fail

Có CB (sau khi OPEN):
  Caller ──▶ [CB] ──✂── reject ngay lập tức (< 1ms) → fail fast
```

CB không phải retry, không phải timeout — nó là **circuit protection** ở cấp độ pattern of failure theo thời gian.

---

## 2. Tại sao cần Circuit Breaker

### Vấn đề: Cascade Failure

Trong kiến trúc microservices, các service phụ thuộc nhau. Khi một service chết:

```
inventory-service chết
  → shop-service gọi inventory, chờ timeout 30s, thread bị block
  → 1000 request đồng thời = 1000 thread bị treo
  → shop-service hết thread pool
  → shop-service chết
  → gateway không gọi được shop-service
  → toàn bộ hệ thống down
```

Đây là **cascade failure** — một điểm lỗi lan rộng ra toàn bộ hệ thống.

### Vấn đề: Retry Storm

gRPC và HTTP client thường có built-in retry. Khi một service đang recover:

```
auth-service đang restart (cần 5s)
  → 500 client đồng thời retry mỗi 1s
  → auth-service nhận 500 * 5 = 2500 request trong lúc khởi động
  → auth-service không bao giờ recover được
```

CB giải quyết cả hai vấn đề bằng cách ngắt mạch sớm và cho service thời gian hồi phục.

---

## 3. Bốn trạng thái hoạt động

```
                    failure count >= threshold
         ┌─────────────────────────────────────────┐
         │                                         ▼
      CLOSED                                     OPEN
    (bình thường)                           (đang ngắt mạch)
         ▲                                         │
         │                                         │ sau halfOpenAfter timeout
         │                                         ▼
         │                                     HALF-OPEN
         │                                  (thử 1 request)
         │                                         │
         └──────── success ────────────────────────┘
                                    │
                    failure ────────┘ (quay lại OPEN)

         breaker.isolate() ──────────────────▶ ISOLATED
                                                  │
                                           handle.dispose()
                                                  │
                                                  ▼
                                               CLOSED
```

| State | Hành vi | Khi nào | Tự recover |
|---|---|---|---|
| **CLOSED** | Request đi qua bình thường, CB đếm failure | Mặc định | — |
| **OPEN** | Reject tất cả request ngay lập tức | Khi failure >= threshold | ✅ Sau `halfOpenAfter` ms |
| **HALF-OPEN** | Cho 1 request thử qua để kiểm tra recovery | Sau `halfOpenAfter` ms | ✅ Tự CLOSED nếu success |
| **ISOLATED** | Reject tất cả request ngay lập tức | Bị force từ bên ngoài qua `isolate()` | ❌ Phải gọi `handle.dispose()` |

### OPEN vs ISOLATED — khác nhau ở điểm nào

```
OPEN:
  CB tự trip sau N lần fail thực tế
  → tự chuyển sang HALF-OPEN sau halfOpenAfter ms
  → tự xác nhận recovery qua 1 request thật

ISOLATED:
  Bị force bởi code bên ngoài (ví dụ: Redis Pub/Sub sync)
  → không tự recover, phải gọi handle.dispose() thủ công
  → dùng khi instance không có failure count thực tế
    nhưng cần ngắt mạch vì instance khác đã biết service down
```

### Timeline ví dụ thực tế

```
t=0s    auth-service crash
t=1s    request 1 → fail (count: 1)
t=2s    request 2 → fail (count: 2)
t=3s    request 3 → fail (count: 3)
t=4s    request 4 → fail (count: 4)
t=5s    request 5 → fail (count: 5) → CB OPEN ⚡
t=5s~   mọi request bị reject ngay lập tức
t=15s   CB vào HALF-OPEN, thử 1 request
t=15s   → auth-service đã recover → CB CLOSED ✅
        → hoặc vẫn fail → CB OPEN thêm 10s nữa
```

---

## 4. Khi nào nên dùng

### Nên dùng CB khi:

- **Gọi external service** qua mạng (HTTP, gRPC, TCP) — bất kỳ I/O nào có thể fail
- **Service có SLA thấp** hoặc hay bị lỗi
- **Hệ thống có nhiều service phụ thuộc nhau** (microservices)
- **Saga / workflow** gọi nhiều service theo chuỗi
- **Real-time system** không thể chịu đựng latency spike từ timeout

### Không cần CB khi:

- Gọi internal function trong cùng process
- Query database local (dùng connection pool + retry thay thế)
- Operation idempotent và nhanh (< 5ms, không qua mạng)
- Batch job không có SLA real-time

---

## 5. Tác hại và rủi ro nếu dùng sai

CB không phải silver bullet. Dùng sai gây ra nhiều vấn đề hơn là giải quyết.

### 5.1 Threshold quá thấp → False positive

```typescript
// ❌ Nguy hiểm
breaker: new ConsecutiveBreaker(2) // 2 lần fail là OPEN
```

Chỉ cần 2 request fail do timeout mạng tạm thời → CB OPEN → toàn bộ traffic bị chặn dù service vẫn sống.

**Fix:** Threshold nên từ 5-10 consecutive failure, hoặc dùng percentage-based (>50% fail trong 60s).

### 5.2 halfOpenAfter quá ngắn → Không đủ thời gian recover

```typescript
// ❌ Nguy hiểm
halfOpenAfter: 1_000 // 1 giây
```

Service cần 30s để khởi động lại. CB thử mỗi 1s → nhận fail liên tục → không bao giờ CLOSED.

**Fix:** `halfOpenAfter` nên bằng hoặc lớn hơn thời gian khởi động trung bình của service.

### 5.3 Chỉ dùng 1 CB chung cho tất cả service

```typescript
// ❌ Sai
const globalBreaker = new CircuitBreaker(...)

// Dùng chung cho auth, inventory, shop...
globalBreaker.execute(() => authClient.validate(...))
globalBreaker.execute(() => inventoryClient.deduct(...))
```

`inventory-service` chết → globalBreaker OPEN → auth calls cũng bị chặn dù auth vẫn sống.

**Fix:** Mỗi downstream service có CB riêng (per-service breaker).

### 5.4 CB bọc quá cao (bọc cả saga)

```typescript
// ❌ Sai
breaker.execute(() => this.runEntireBuyAccountSaga())
```

1 trong 5 service fail → CB đếm → sau N lần toàn bộ saga bị chặn dù 4 service kia vẫn sống.

**Fix:** CB bọc ở từng client call riêng lẻ bên trong saga.

### 5.5 Không phân biệt lỗi 4xx vs 5xx

```typescript
// ❌ Sai — đếm cả lỗi business logic
const breaker = new CircuitBreaker(handleAll, ...)

// 1000 user nhập sai password → 1000 lần 401 → CB OPEN
// → không ai login được dù auth-service vẫn sống
```

**Fix:** Chỉ trip khi lỗi 5xx (server error), bỏ qua 4xx (client error).

```typescript
// ✅ Đúng
handleWhen(err => err instanceof HttpException && err.getStatus() >= 500)
```

---

## 6. Implement trong NestJS + gRPC

### 6.1 Cài đặt

```bash
npm install cockatiel
```

`cockatiel` là thư viện TypeScript thuần, nhẹ, type-safe, không dependency nặng.

### 6.2 CB Registry — Per-service, tự động

```typescript
// src/common/resilience/circuit-breaker.registry.ts
import {
  CircuitBreaker,
  ConsecutiveBreaker,
  handleWhen,
} from 'cockatiel';
import { HttpException } from '@nestjs/common';
import { winstonLogger } from 'src/logger/logger.config';

const breakerRegistry = new Map<string, CircuitBreaker>();

export function getBreakerFor(serviceName: string): CircuitBreaker {
  if (!breakerRegistry.has(serviceName)) {
    const breaker = new CircuitBreaker(
      // Chỉ trip khi lỗi server (>= 500), không trip với lỗi business (4xx)
      handleWhen(err => err instanceof HttpException && err.getStatus() >= 500),
      {
        halfOpenAfter: 10_000,             // Thử lại sau 10s
        breaker: new ConsecutiveBreaker(5), // 5 lần fail liên tiếp mới OPEN
      },
    );

    breaker.onStateChange(state => {
      const level = state === 'open' ? 'error' : 'info';
      winstonLogger[level]({
        message: `⚡ Circuit Breaker [${serviceName}] → ${state.toUpperCase()}`,
        service: serviceName,
      });

      // Hook vào Discord/Telegram alert
      if (state === 'open') {
        // alertService.sendDiscord(`🔴 CB OPEN: ${serviceName}`);
      }
    });

    breakerRegistry.set(serviceName, breaker);
  }

  return breakerRegistry.get(serviceName)!;
}

// Expose để health check endpoint đọc
export function getAllBreakerStates(): Record<string, string> {
  const result: Record<string, string> = {};
  breakerRegistry.forEach((breaker, name) => {
    result[name] = breaker.state;
  });
  return result;
}
```

### 6.3 Tích hợp vào grpcCall wrapper

```typescript
// src/common/grpc/grpc-call.util.ts
import { HttpException } from '@nestjs/common';
import { catchError, throwError } from 'rxjs';
import { status as grpcStatus } from '@grpc/grpc-js';
import { firstValueFrom, lastValueFrom, Observable } from 'rxjs';
import { winstonLogger } from 'src/logger/logger.config';
import { getBreakerFor } from '../resilience/circuit-breaker.registry';

export function grpcToHttp(code: number | null): number {
  switch (code) {
    case grpcStatus.OK:                  return 200;
    case grpcStatus.INVALID_ARGUMENT:    return 400;
    case grpcStatus.NOT_FOUND:           return 404;
    case grpcStatus.ALREADY_EXISTS:      return 409;
    case grpcStatus.PERMISSION_DENIED:   return 403;
    case grpcStatus.RESOURCE_EXHAUSTED:  return 429;
    case grpcStatus.FAILED_PRECONDITION: return 400;
    case grpcStatus.UNAUTHENTICATED:     return 401;
    case grpcStatus.CANCELLED:           return 400;
    default:                             return 500;
  }
}

export function parseGrpcError(err: any) {
  if (err?.code !== undefined && err?.details) {
    return { code: err.code, message: err.details };
  }
  return { code: null, message: 'Unknown gRPC error' };
}

export async function grpcCall<T>(
  serviceName = 'UnknownService',
  obs: Observable<T>,
  useLastValue = false,
  metadata?: any,
): Promise<T> {
  const breaker = getBreakerFor(serviceName);

  const wrapped = obs.pipe(
    catchError(err => {
      const parsed = parseGrpcError(err);
      const httpStatus = grpcToHttp(parsed.code);
      const message = `🆘 Error → HTTP ${httpStatus}: ${parsed.message}`;

      if (httpStatus >= 500) {
        winstonLogger.error({
          message,
          service: serviceName,
          admin: process.env.ADMIN_TEST,
        });
      }

      return throwError(
        () => new HttpException(parsed.message ?? 'Internal error', httpStatus),
      );
    }),
  );

  // CB bọc ngoài cùng — transparent với caller
  return breaker.execute(() =>
    useLastValue ? lastValueFrom(wrapped) : firstValueFrom(wrapped),
  );
}
```

### 6.4 Health endpoint cho CB states

```typescript
// src/health/health.controller.ts
import { Controller, Get } from '@nestjs/common';
import { getAllBreakerStates } from 'src/common/resilience/circuit-breaker.registry';

@Controller('health')
export class HealthController {
  @Get('circuit-breakers')
  getCircuitBreakerStates() {
    return {
      timestamp: new Date().toISOString(),
      breakers: getAllBreakerStates(),
    };
  }
}

// Response example:
// {
//   "timestamp": "2024-01-15T10:30:00.000Z",
//   "breakers": {
//     "AuthService": "closed",
//     "InventoryService": "open",
//     "ShopService": "closed"
//   }
// }
```

---

## 7. CB vs Bulkhead vs Timeout

Ba pattern này hay bị nhầm lẫn vì đều liên quan đến fault tolerance. Chúng giải quyết **các vấn đề khác nhau** và thường dùng kết hợp.

| Pattern | Giải quyết vấn đề gì | Cơ chế |
|---|---|---|
| **Timeout** | Một request chờ quá lâu | Hủy request sau N giây |
| **Bulkhead** | Một service ngốn hết tài nguyên | Giới hạn concurrent request tới mỗi service |
| **Circuit Breaker** | Service liên tục fail → cascade failure | Ngắt mạch sau N lần fail liên tiếp |

### Timeout

```typescript
// Giải quyết: request đơn lẻ bị treo
// Không giải quyết: 1000 request cùng treo (mỗi cái chờ đủ 30s rồi mới fail)
const result = await Promise.race([
  grpcCall('AuthService', obs),
  new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
]);
```

Timeout cần thiết nhưng không đủ — nếu 1000 request cùng timeout sau 5s, server vẫn bị block 5s × 1000 = 5000 giây tổng cộng.

### Bulkhead

```typescript
// Giải quyết: một service chậm không được chiếm hết thread pool
// Ví dụ: giới hạn tối đa 20 concurrent call tới inventory-service
import { BulkheadPolicy, bulkhead } from 'cockatiel';

const inventoryBulkhead = bulkhead(20); // max 20 concurrent
const result = await inventoryBulkhead.execute(() =>
  grpcCall('InventoryService', obs)
);
// Request thứ 21 bị reject ngay thay vì queue chờ
```

### Ba layer kết hợp — production-grade

```
Request
  │
  ▼
[Bulkhead] — giới hạn concurrent, bảo vệ thread pool
  │
  ▼
[Circuit Breaker] — ngắt mạch nếu service liên tục fail
  │
  ▼
[Timeout] — timeout từng request đơn lẻ
  │
  ▼
  gRPC call
```

```typescript
// Kết hợp cả ba trong grpcCall
const bulkheadPolicy = bulkhead(20, 5); // max 20 concurrent, queue 5
const retryPolicy = retry(handleWhen(...), { maxAttempts: 2 });

return bulkheadPolicy.execute(() =>
  breaker.execute(() =>
    retryPolicy.execute(() =>
      firstValueFrom(obs.pipe(...))
    )
  )
);
```

---

## 8. PM2 Cluster + Multi-VPS: vấn đề in-memory và giải pháp Redis Pub/Sub

### Vấn đề

Mỗi PM2 instance là một process độc lập với RAM riêng. CB state là biến in-memory — không shared giữa các process:

```
VPS 1 PM2-0  →  CB[AuthService]: OPEN     ✂ chặn request  (instance tự trip)
VPS 1 PM2-1  →  CB[AuthService]: CLOSED   → vẫn gọi auth-service đang chết
VPS 2 PM2-0  →  CB[AuthService]: CLOSED   → vẫn gọi auth-service đang chết
VPS 2 PM2-1  →  CB[AuthService]: CLOSED   → vẫn gọi auth-service đang chết
```

75% traffic vẫn hit service đang down. CB chỉ hiệu quả ở 1 trong 4 instance.

### Tại sao không lưu state thẳng vào Redis

`breaker.execute()` được gọi **mỗi request**. Nếu state nằm ở Redis:

```
❌ Sai — check Redis mỗi request:
  Request → await redis.get('cb:AuthService')  (1-5ms network) → check → gọi gRPC

  Vấn đề 1: thêm 1-5ms vào mỗi request — không chấp nhận được với hệ thống real-time
  Vấn đề 2: Redis down → CB không check được → CB trở thành SPOF
  Vấn đề 3: phải tự viết lại toàn bộ logic cockatiel (reference counting,
            ConsecutiveBreaker, halfOpenAfter timer...) — reinvent the wheel
```

### Giải pháp đúng: in-memory check + Redis Pub/Sub đồng bộ

```
✅ Đúng — tách hot path và cold path:

  Hot path (mỗi request, hàng nghìn/giây):
    Request → breaker.execute() → check this.state (RAM, 0ms) → gọi gRPC

  Cold path (khi state thay đổi, vài lần/giờ):
    CB trip → publish lên Redis → các instance nhận → update state local
```

Dùng nguyên cockatiel không sửa gì. Redis chỉ để broadcast — không ảnh hưởng latency.

### Flow đồng bộ giữa 4 instance

```
t=0ms   VPS1-PM2-0: auth-service fail lần 5 → CB OPEN
          → onStateChange fired → publishCbState('AuthService', Open)
          → Redis publish lên channel 'mmorpg:circuit-breaker:state'

t=3ms   VPS1-PM2-1 nhận message → breaker.isolate() → CB: ISOLATED
t=3ms   VPS2-PM2-0 nhận message → breaker.isolate() → CB: ISOLATED
t=3ms   VPS2-PM2-1 nhận message → breaker.isolate() → CB: ISOLATED

t=3ms   Tất cả 4 instance đều chặn request ✅

t=10s   VPS1-PM2-0: CB HALF-OPEN → thử 1 request → auth-service đã recover
          → CB CLOSED → publishCbState('AuthService', Closed)

t=10s+3ms  VPS1-PM2-1 nhận Closed → handle.dispose() → CB: ISOLATED → CLOSED
t=10s+3ms  VPS2-PM2-0 nhận Closed → handle.dispose() → CB: ISOLATED → CLOSED
t=10s+3ms  VPS2-PM2-1 nhận Closed → handle.dispose() → CB: ISOLATED → CLOSED
```

### Tại sao instance nhận event bị ISOLATED thay vì OPEN

Instance B không có failure count thực tế — nó chỉ nghe A nói "service đang chết". Nếu để B tự recover độc lập như OPEN (sau halfOpenAfter tự thử):

```
t=10s  A vào HALF-OPEN, thử 1 request → fail → OPEN lại → publish Open
       B cũng tự HALF-OPEN → thử gọi service → fail → trip → publish Open
       C cũng tự HALF-OPEN → thử gọi service → fail → trip → publish Open
       → A nhận Open từ B, C → xử lý thừa
       → B nhận Open từ A, C → cross-publish chéo nhau
       → state machine lộn xộn, noise không kiểm soát được
```

ISOLATED không tự recover → B, C, D im lặng hoàn toàn. Chỉ A có ground truth, chỉ A tự recover, chỉ A publish Closed → B, C, D mới release.

### Trade-off: worst case khi Redis down

```
A: OPEN → CLOSED → publish Closed → Redis down → event MẤT
B, C, D vẫn ISOLATED mãi mãi dù service đã sống
→ 3/4 instance chặn traffic vô thời hạn
```

Fix: safety timeout với jitter — mỗi instance tự dispose() sau 60-90s nếu không nhận được Closed event.

### Vấn đề thundering herd nếu không có jitter

Nếu tất cả instance cùng timeout 60s:

```
t=60s  B timeout → dispose → CLOSED → gọi service → fail → trip → publish Open
       C timeout → dispose → CLOSED → gọi service → fail → trip → publish Open
       D timeout → dispose → CLOSED → gọi service → fail → trip → publish Open
       → 3 instance cùng gọi service, cùng fail, cùng publish Open
       → cross-publish noise, reference counter tăng không kiểm soát
```

Fix: jitter tính từ INSTANCE_ID (UUID) → mỗi instance timeout ở thời điểm khác nhau trong khoảng 60-90s. Instance nào timeout trước thử một mình, nếu service vẫn chết thì publish Open → các instance khác reset timeout thêm 60s.

### Implementation — cb-redis-sync.ts

```typescript
import Redis from 'ioredis';
import { CircuitState, CircuitBreakerPolicy } from 'cockatiel';
import { randomUUID } from 'crypto';

const CB_CHANNEL = 'mmorpg:circuit-breaker:state';

// UUID random — không cần config .env, unique mỗi lần process khởi động
const INSTANCE_ID = randomUUID();

const ISOLATED_TIMEOUT_MS = 60_000;

// Jitter từ INSTANCE_ID: 0-30s thêm vào base timeout
// → mỗi instance timeout ở thời điểm khác nhau → tránh thundering herd
const jitter = (parseInt(INSTANCE_ID.slice(0, 2), 16) / 255) * 30_000;
const ISOLATED_TIMEOUT_WITH_JITTER = ISOLATED_TIMEOUT_MS + jitter;

// 2 connection riêng — Redis không cho phép 1 connection vừa PUB vừa SUB
const pub = new Redis(process.env.REDIS_URL ?? '');
const sub = pub.duplicate();

// Lưu isolate handle + timeoutId để dispose() đúng cách
// isolate() dùng reference counting — phải dispose đúng handle mới release được
const isolateHandles = new Map<string, {
  handle: { dispose: () => void };
  timeoutId: ReturnType<typeof setTimeout>;
}>();

export function initCbRedisSync(
  getBreakerFor: (name: string) => CircuitBreakerPolicy,
): void {
  sub.subscribe(CB_CHANNEL, (err) => {
    if (err) { console.error(`[CB Sync] Failed to subscribe: ${err.message}`); return; }
    console.log(`[CB Sync] Subscribed — instance: ${INSTANCE_ID}`);
  });

  sub.on('message', (_channel, raw) => {
    let msg: { service: string; state: CircuitState; fromInstance: string };
    try { msg = JSON.parse(raw); } catch { return; }

    if (msg.fromInstance === INSTANCE_ID) return; // bỏ qua event của chính mình

    const breaker = getBreakerFor(msg.service);

    if (msg.state === CircuitState.Open) {
      // Dọn handle cũ trước (tránh reference counter leak)
      const existing = isolateHandles.get(msg.service);
      if (existing) {
        clearTimeout(existing.timeoutId);
        existing.handle.dispose();
      }

      const handle = breaker.isolate();

      // Safety net: tự release nếu Closed event bị mất (Redis down...)
      const timeoutId = setTimeout(() => {
        const current = isolateHandles.get(msg.service);
        if (current) {
          current.handle.dispose();
          isolateHandles.delete(msg.service);
          console.warn(`[CB Sync] [${msg.service}] Safety timeout — releasing isolation`);
        }
      }, ISOLATED_TIMEOUT_WITH_JITTER);

      isolateHandles.set(msg.service, { handle, timeoutId });

    } else if (msg.state === CircuitState.Closed) {
      const existing = isolateHandles.get(msg.service);
      if (existing) {
        clearTimeout(existing.timeoutId); // hủy safety timeout
        existing.handle.dispose();        // ISOLATED → CLOSED
        isolateHandles.delete(msg.service);
      }
    }
  });

  process.on('SIGTERM', () => { pub.quit(); sub.quit(); });
  process.on('SIGINT',  () => { pub.quit(); sub.quit(); });
}

export function publishCbState(service: string, state: CircuitState): void {
  pub.publish(CB_CHANNEL, JSON.stringify({
    service, state, fromInstance: INSTANCE_ID, timestamp: Date.now(),
  })).catch(err => console.warn(`[CB Sync] Failed to publish: ${err.message}`));
}
```

### Implementation — circuit-breaker.registry.ts

```typescript
import { circuitBreaker, CircuitBreakerPolicy, CircuitState, ConsecutiveBreaker, handleWhen } from 'cockatiel';
import { HttpException } from '@nestjs/common';
import { publishCbState } from './cb-redis-sync';

const breakerRegistry = new Map<string, CircuitBreakerPolicy>();

const STATE_LABEL: Record<CircuitState, string> = {
  [CircuitState.Closed]:   'CLOSED',
  [CircuitState.Open]:     'OPEN',
  [CircuitState.HalfOpen]: 'HALF-OPEN',
  [CircuitState.Isolated]: 'ISOLATED',
};

export function getBreakerFor(serviceName: string): CircuitBreakerPolicy {
  if (!breakerRegistry.has(serviceName)) {
    const breaker = circuitBreaker(
      handleWhen((err: unknown) => err instanceof HttpException && err.getStatus() >= 500),
      { halfOpenAfter: 10_000, breaker: new ConsecutiveBreaker(5) },
    );

    breaker.onStateChange(state => {
      const logFn = state === CircuitState.Open ? console.error : console.log;
      logFn(`[CB] [${serviceName}] → ${STATE_LABEL[state]}`);

      // Chỉ broadcast Open và Closed — 2 event cần sync toàn cluster
      // Không broadcast HalfOpen (nội bộ) và Isolated (do Redis sync set, tránh vòng lặp)
      if (state === CircuitState.Open || state === CircuitState.Closed) {
        publishCbState(serviceName, state);
      }
    });

    breakerRegistry.set(serviceName, breaker);
  }
  return breakerRegistry.get(serviceName)!;
}

export function getAllBreakerStates(): Record<string, string> {
  const result: Record<string, string> = {};
  breakerRegistry.forEach((breaker, name) => { result[name] = STATE_LABEL[breaker.state]; });
  return result;
}

export { breakerRegistry };
```

### Implementation — grpcCall với CB

```typescript
import { getBreakerFor } from 'src/common/resilience/circuit-breaker.registry';

export async function grpcCall<T>(
  serviceName = 'UnknownService',
  obs: Observable<T>,
  useLastValue = false,
  metadata?,
): Promise<T> {
  const wrapped = obs.pipe(
    catchError(err => {
      const parsed = parseGrpcError(err);
      const httpStatus = grpcToHttp(parsed?.code ?? null);
      if (httpStatus >= 500) {
        winstonLogger.error({ message: `🆘 HTTP ${httpStatus}: ${parsed?.message}`, service: serviceName });
      }
      // Throw HttpException để CB nhận và đếm failure (chỉ khi >= 500)
      return throwError(() => new HttpException(parsed?.message, httpStatus));
    }),
  );

  // breaker.execute() check state trước (0ms, in-memory):
  //   CLOSED   → chạy fn bình thường
  //   OPEN     → throw BrokenCircuitError ngay, không gọi gRPC
  //   ISOLATED → throw IsolatedCircuitError ngay, không gọi gRPC
  const breaker = getBreakerFor(serviceName);
  return breaker.execute(() =>
    useLastValue ? lastValueFrom(wrapped) : firstValueFrom(wrapped)
  );
}
```

### Khởi động trong main.ts

```typescript
import { initCbRedisSync } from 'src/common/resilience/cb-redis-sync';
import { getBreakerFor } from 'src/common/resilience/circuit-breaker.registry';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // ... setup
  await app.listen(3000);

  // Gọi SAU listen() — đảm bảo tất cả module đã init xong
  initCbRedisSync(getBreakerFor);
}
```

---

## 9. Graceful Degradation

Khi CB OPEN, thay vì trả lỗi cứng, có thể trả **fallback response** tùy loại operation.

### Phân loại operation

| Loại | Ví dụ | Fallback phù hợp |
|---|---|---|
| **Read** | Lấy danh sách shop items | Cache cũ, empty list |
| **Write** | Mua item, transfer tiền | Không fallback, báo lỗi rõ |
| **Saga** | buyAccountSaga | Không fallback, compensate |
| **Non-critical** | Log activity, analytics | Silent drop |

### Detect CB OPEN error

```typescript
import { BrokenCircuitError } from 'cockatiel';

// BrokenCircuitError được throw khi CB đang OPEN
// Phân biệt với lỗi thực từ service
try {
  return await grpcCall('ShopService', this.shopClient.getItems(dto));
} catch (err) {
  if (err instanceof BrokenCircuitError) {
    // CB đang OPEN — service có thể đang recover
    // Đây không phải lỗi của request, không nên log như lỗi thường
    return this.getFallback(dto);
  }
  throw err; // lỗi thực từ service → throw lên
}
```

### Read operation — trả cache

```typescript
async getShopItems(dto: GetShopDto) {
  try {
    const items = await grpcCall('ShopService', this.shopClient.getItems(dto));
    // Cập nhật cache mỗi khi gọi thành công
    await this.redis.set(`shop:items:${dto.shopId}`, JSON.stringify(items), 'EX', 300);
    return items;
  } catch (err) {
    if (err instanceof BrokenCircuitError) {
      // CB OPEN → trả cache
      const cached = await this.redis.get(`shop:items:${dto.shopId}`);
      if (cached) return JSON.parse(cached);
      return { items: [], message: 'Shop temporarily unavailable, showing cached data' };
    }
    throw err;
  }
}
```

### Write operation — báo lỗi rõ, không silent fail

```typescript
async buyItem(dto: BuyItemDto) {
  try {
    return await grpcCall('InventoryService', this.inventoryClient.buy(dto));
  } catch (err) {
    if (err instanceof BrokenCircuitError) {
      // KHÔNG fallback — tiền thật, không thể giả vờ thành công
      throw new ServiceUnavailableException(
        'Payment service is temporarily unavailable. Please try again in a moment.'
      );
    }
    throw err;
  }
}
```

### Non-critical operation — silent drop

```typescript
async logPlayerActivity(dto: ActivityDto) {
  try {
    await grpcCall('LogService', this.logClient.record(dto));
  } catch (err) {
    if (err instanceof BrokenCircuitError) {
      // Log service down không ảnh hưởng gameplay
      // Drop silently, không throw
      winstonLogger.warn({ message: 'Activity log dropped — LogService CB OPEN' });
      return;
    }
    throw err;
  }
}
```

---

## 10. Testing Circuit Breaker

Testing CB là phần hay bị bỏ qua nhất. Có 3 level cần test.

### Level 1: Unit test — verify CB trip đúng ngưỡng

```typescript
// circuit-breaker.registry.spec.ts
import { getBreakerFor } from './circuit-breaker.registry';
import { BrokenCircuitError } from 'cockatiel';
import { HttpException, HttpStatus } from '@nestjs/common';

describe('CircuitBreaker Registry', () => {
  it('should trip after 5 consecutive 500 errors', async () => {
    const breaker = getBreakerFor('TestService_' + Date.now()); // unique key để tránh state leak

    const failingCall = () =>
      breaker.execute(() => {
        throw new HttpException('Internal error', HttpStatus.INTERNAL_SERVER_ERROR);
      });

    // 5 lần fail liên tiếp
    for (let i = 0; i < 5; i++) {
      await expect(failingCall()).rejects.toThrow();
    }

    // Lần thứ 6 phải bị CB chặn ngay
    await expect(failingCall()).rejects.toThrow(BrokenCircuitError);
  });

  it('should NOT trip on 4xx errors', async () => {
    const breaker = getBreakerFor('TestService_4xx_' + Date.now());

    const clientErrorCall = () =>
      breaker.execute(() => {
        throw new HttpException('Not found', HttpStatus.NOT_FOUND);
      });

    // 10 lần 404 — CB không được trip
    for (let i = 0; i < 10; i++) {
      await expect(clientErrorCall()).rejects.toThrow(HttpException);
    }

    // CB vẫn CLOSED — lần tiếp theo vẫn throw HttpException, không phải BrokenCircuitError
    await expect(clientErrorCall()).rejects.toThrow(HttpException);
    await expect(clientErrorCall()).rejects.not.toThrow(BrokenCircuitError);
  });
});
```

### Level 2: Integration test — verify fallback behavior

```typescript
// shop.service.spec.ts
import { BrokenCircuitError } from 'cockatiel';

describe('ShopService - CB fallback', () => {
  it('should return cached data when CB is open', async () => {
    // Arrange: mock gRPC call throw BrokenCircuitError
    jest.spyOn(grpcCallUtil, 'grpcCall').mockRejectedValue(new BrokenCircuitError());
    jest.spyOn(redis, 'get').mockResolvedValue(JSON.stringify([{ id: 1, name: 'Sword' }]));

    // Act
    const result = await shopService.getShopItems({ shopId: '1' });

    // Assert: trả về cache thay vì throw
    expect(result.items).toHaveLength(1);
    expect(result.items[0].name).toBe('Sword');
  });

  it('should throw ServiceUnavailableException for write ops when CB is open', async () => {
    jest.spyOn(grpcCallUtil, 'grpcCall').mockRejectedValue(new BrokenCircuitError());

    await expect(shopService.buyItem({ itemId: '1', userId: 'u1' }))
      .rejects.toThrow(ServiceUnavailableException);
  });
});
```

### Level 3: E2E / chaos test — simulate service down

```typescript
// Dùng trong staging environment, không dùng production
describe('CB E2E — chaos test', () => {
  it('should protect gateway when auth-service is down', async () => {
    // 1. Force CB của AuthService vào OPEN
    const breaker = getBreakerFor('AuthService');
    breaker.isolate(); // force OPEN

    // 2. Gửi request cần auth
    const response = await request(app.getHttpServer())
      .get('/profile')
      .set('Authorization', 'Bearer valid-token');

    // 3. Expect 503, không phải timeout
    expect(response.status).toBe(503);
    expect(response.body.message).toContain('temporarily unavailable');

    // 4. Release CB
    // CB tự recover sau halfOpenAfter
  });
});
```

### Lưu ý quan trọng khi test

```typescript
// ❌ Sai — dùng chung serviceName giữa các test → state leak
getBreakerFor('AuthService') // test A set OPEN
getBreakerFor('AuthService') // test B nhận CB đã OPEN từ test A

// ✅ Đúng — unique key cho mỗi test
getBreakerFor('AuthService_' + Date.now())
getBreakerFor('AuthService_' + Math.random())

// Hoặc reset registry trong beforeEach
beforeEach(() => breakerRegistry.clear());
```

---

## 11. Case thực tế: MMORPG Backend

### Kiến trúc hiện tại

```
Client
  │
  ▼
API Gateway (NestJS)
  ├── AuthModule       → auth-service (gRPC)
  ├── ShopModule       → shop-service (gRPC)
  ├── InventoryModule  → inventory-service (gRPC)
  ├── UserModule       → user-service (gRPC)
  └── ... 7 services khác
```

### Sau khi thêm CB

```
Client
  │
  ▼
API Gateway (NestJS)
  │
  └── grpcCall('AuthService', ...)       → [CB: AuthService]      → auth-service
  └── grpcCall('InventoryService', ...)  → [CB: InventoryService] → inventory-service
  └── grpcCall('ShopService', ...)       → [CB: ShopService]      → shop-service
  └── ...
```

Mỗi service có CB riêng, tự động tạo qua `getBreakerFor(serviceName)`.

### buyAccountSaga — CB đặt đúng chỗ

```typescript
// ✅ CB bọc từng step, không bọc cả saga
export class BuyAccountSaga {
  async execute(payload: BuyAccountDto) {
    // Step 1: Kiểm tra số dư
    const balance = await grpcCall(
      'InventoryService',                           // ← CB key
      this.inventoryClient.checkBalance(payload),
    );

    // Step 2: Trừ tiền
    await grpcCall(
      'InventoryService',
      this.inventoryClient.deductBalance(payload),
    );

    // Step 3: Đổi mật khẩu account
    await grpcCall(
      'AuthService',                                // ← CB riêng cho auth
      this.authClient.changePassword(payload),
    );

    // Step 4: Ghi log transaction
    await grpcCall(
      'LogService',
      this.logClient.recordTransaction(payload),
    );
  }
}
```

Nếu `AuthService` đang OPEN:
- Step 1, 2 (InventoryService) vẫn chạy bình thường
- Step 3 bị reject ngay lập tức, saga compensate đúng chỗ
- InventoryService không bị ảnh hưởng

### Scenario: auth-service bị down lúc 2AM

```
02:00:00  auth-service crash (OOM)
02:00:05  5 request fail liên tiếp → CB[AuthService] OPEN
02:00:05  Winston log: ERROR "⚡ Circuit Breaker [AuthService] → OPEN"
02:00:05  Discord webhook: 🔴 CB OPEN: AuthService
02:00:05  Mọi request cần auth bị reject ngay < 1ms, server vẫn sống
02:00:15  CB vào HALF-OPEN, thử 1 request
02:00:15  auth-service vẫn đang restart → fail → CB OPEN thêm 10s
02:00:25  CB HALF-OPEN lần 2
02:00:25  auth-service đã up → success → CB CLOSED ✅
02:00:25  Winston log: INFO "⚡ Circuit Breaker [AuthService] → CLOSED"
02:00:25  Discord webhook: 🟢 CB CLOSED: AuthService
```

Tổng thời gian downtime thực tế: 25s. Không có cascade failure.

---

## 12. Những gì được upgrade khi thêm CB

### 8.1 Reliability

- Hệ thống không bị cascade failure khi 1 service chết
- Server vẫn handle được các request không liên quan đến service đang lỗi

### 8.2 Observability

- `onStateChange` hook → có log và alert real-time khi có sự cố
- Health endpoint `/health/circuit-breakers` → biết ngay service nào đang OPEN
- Với hệ thống đang có Telegram + Discord alert: CB state changes tích hợp thẳng vào alert pipeline hiện có

### 8.3 Recovery tự động

- HALF-OPEN tự động test recovery → không cần deploy lại hay restart manual để "unlock"
- Service recover xong → CB tự CLOSED, traffic tự phục hồi

### 8.4 Portfolio value

Với MMORPG backend chạy 24/7 thực tế:
- Có thể nói "implemented circuit breaker pattern với per-service isolation"
- Có metrics cụ thể: số lần CB trip, MTTR (mean time to recovery)
- Là điểm khác biệt rõ ràng với junior developer thông thường

---

## 13. Tips và best practices

### 9.1 Đừng log khi CB đang OPEN — chỉ log khi state thay đổi

```typescript
// ❌ Sai — spam log
breaker.execute(...).catch(err => {
  logger.error('CB rejected') // log mỗi request bị reject → hàng ngàn log
})

// ✅ Đúng — chỉ log khi state thay đổi
breaker.onStateChange(state => {
  logger.warn(`CB [${serviceName}] → ${state}`)
})
```

### 9.2 Phân biệt lỗi có thể retry và không thể retry

```
Có thể retry (CB nên đếm):
  - Connection refused
  - 503 Service Unavailable
  - 504 Gateway Timeout
  - gRPC UNAVAILABLE, DEADLINE_EXCEEDED

Không nên retry (CB không đếm):
  - 400 Bad Request
  - 401 Unauthorized
  - 404 Not Found
  - gRPC INVALID_ARGUMENT, NOT_FOUND
```

### 9.3 CB + Retry — thứ tự đúng

```
Retry phải nằm BÊN TRONG CB, không phải bên ngoài:

✅ Đúng:
  CB.execute(() => retry(() => grpcCall(...)))

❌ Sai:
  retry(() => CB.execute(() => grpcCall(...)))
```

Nếu retry nằm ngoài CB: mỗi lần retry là 1 lần execute mới, CB sẽ đếm mỗi retry là 1 failure riêng lẻ — threshold đạt nhanh hơn dự kiến.

### 9.4 Đặt tên serviceName nhất quán

```typescript
// Dùng constant, không hardcode string
export const SERVICE_NAMES = {
  AUTH: 'AuthService',
  INVENTORY: 'InventoryService',
  SHOP: 'ShopService',
} as const;

// Dùng trong code
grpcCall(SERVICE_NAMES.AUTH, ...)
grpcCall(SERVICE_NAMES.INVENTORY, ...)
```

Tránh lỗi typo tạo ra 2 CB cho cùng 1 service (`'AuthService'` vs `'authService'`).

### 9.5 Fallback response khi CB OPEN

Đôi khi thay vì throw error, có thể trả về fallback:

```typescript
try {
  return await grpcCall('ShopService', this.shopClient.getItems(...));
} catch (err) {
  if (err instanceof BrokenCircuitError) {
    // CB đang OPEN → trả cache hoặc default
    return this.cacheService.getLastKnownItems();
  }
  throw err;
}
```

Phù hợp cho read operation (get items, get shop catalog). Không phù hợp cho write operation (buy, transfer).

### 9.6 Tune threshold dựa trên traffic thực tế

Không có con số "đúng" cho tất cả hệ thống. Nguyên tắc:

```
- threshold quá thấp (2-3): false positive khi mạng chập chờn
- threshold quá cao (50+): service đã chết 50 request rồi mới trip
- halfOpenAfter quá ngắn: service chưa kịp restart đã test
- halfOpenAfter quá dài: downtime kéo dài không cần thiết

Điểm bắt đầu tốt:
  consecutiveBreaker: 5
  halfOpenAfter: 10_000 (10s) — adjust theo restart time của service
```

---

## 14. Các config quan trọng cần tuning

| Config | Default recommend | Giải thích |
|---|---|---|
| `ConsecutiveBreaker(n)` | 5 | N lần fail liên tiếp mới OPEN |
| `halfOpenAfter` | 10_000ms | Thời gian chờ trước khi thử lại |
| `handleWhen` | `err.getStatus() >= 500` | Chỉ trip với server error |

### Nên monitor các metric sau

- **CB state changes per hour** — tần suất trip nói lên sức khỏe service
- **Duration in OPEN state** — thời gian downtime thực tế
- **Requests rejected by CB** — số request bị chặn khi CB OPEN
- **Recovery time** (từ OPEN → CLOSED) — MTTR của từng service

---

*Circuit Breaker không giải quyết lỗi — nó giới hạn damage khi lỗi xảy ra. Hệ thống tốt vẫn cần monitoring, alerting, và runbook để xử lý root cause.*