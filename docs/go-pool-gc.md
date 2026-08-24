# Go GC Overhead & Goroutine Pool Pattern

## 1. GC Overhead là gì — tại sao `go func()` mỗi lần lại có vấn đề?

### Goroutine không free

Mỗi lần viết `go func() { ... }()`, Go runtime phải:

```
1. Cấp phát stack mới cho goroutine (~2KB–8KB ban đầu)
2. Đăng ký goroutine với scheduler
3. Khi goroutine xong → GC phải collect stack đó
4. GC chạy → stop-the-world (dù rất ngắn, nhưng cộng dồn lại)
```

Với game server **10–20 move packet/giây × N players**:

```
100 players × 20 packet/giây = 2000 goroutine tạo/xóa mỗi giây
```

Mỗi goroutine sống ~200ms (timeout Redis) → tại bất kỳ thời điểm nào có thể có
`2000 × 0.2 = 400 goroutine` đang tồn tại chỉ để publish NATS.

GC phải track, scan, collect tất cả → **GC pressure tăng** → latency spike không đều.

---

### Minh họa vấn đề — code CŨ

```go
// ❌ Pattern cũ — per-packet goroutine
func (h *Hub) BroadcastToMapExcludeUser(mapID string, data []byte, excludeUserID int32) {
    h.OnBroadcast(mapID, data, excludeUserID) // local: OK

    if h.bus != nil {
        // Mỗi lần gọi → 1 goroutine mới được tạo
        // 2000 lần/giây → 2000 goroutine mới/giây → GC áp lực cao
        go func() {
            ctx, cancel := context.WithTimeout(context.Background(), 1*time.Second)
            defer cancel()
            if err := h.bus.PublishBroadcast(ctx, mapID, data, excludeUserID); err != nil {
                h.log.Warn("publish broadcast failed", "err", err)
            }
        }()
    }
}
```

**Vấn đề khác của pattern này:**
- Không giới hạn số goroutine → NATS chậm → goroutine tích lũy không giới hạn (goroutine leak)
- Không có back-pressure: client spam → server tạo goroutine vô tận

---

## 2. Goroutine Pool + Buffered Channel — giải pháp hiện tại

### Tư tưởng

Thay vì tạo goroutine mới mỗi lần → tạo **N goroutine cố định** chạy mãi mãi,
nhận job qua channel. Channel đóng vai trò **queue**.

```
Producer (BroadcastToMapExcludeUser)
    │
    ▼
┌─────────────────────────┐
│  publishCh  (buffer 4096) │  ← buffered channel = queue
└─────────────────────────┘
    │        │        │
    ▼        ▼        ▼
 worker1  worker2  ... worker16   ← goroutine pool cố định
    │        │        │
    ▼        ▼        ▼
         NATS bus
```

---

## 3. Syntax chi tiết từng phần

### 3.1. Định nghĩa Job struct

```go
// Job là unit of work được đưa vào queue.
// Dùng struct thay vì closure vì:
//   - Closure capture variable → allocate heap object → GC pressure
//   - Struct: data rõ ràng, không capture ẩn, dễ debug
type publishJob struct {
    kind          publishKind  // loại job: broadcast hay kick
    mapID         string
    data          []byte
    excludeUserID int32
    userID        int32        // chỉ dùng cho publishKick
}

// Dùng uint8 thay vì string để tiết kiệm memory — job được tạo hàng nghìn lần/giây
type publishKind uint8

const (
    publishBroadcast publishKind = iota  // = 0
    publishKick                          // = 1
    // iota tự tăng theo thứ tự khai báo trong const block
)
```

### 3.2. Khai báo channel trong struct

```go
const (
    publishWorkers   = 16    // số goroutine worker cố định
    publishChBufSize = 4096  // buffer của channel — xem giải thích bên dưới
)

type Hub struct {
    // ...các field khác...

    publishCh chan publishJob
    //         ^^^^^^^^^^^^^ type của channel
    //    ^^^^  keyword khai báo channel
}
```

**Tại sao buffer 4096?**

```
Buffer = 0    → producer block ngay nếu worker bận → gameplay lag
Buffer = 4096 → producer có thể gửi 4096 job trước khi bị chặn
              → tick loop 20Hz × 16 workers → headroom ~12 giây cao tải
              → nếu NATS chết hoàn toàn, log warning trước khi drop
```

### 3.3. Khởi tạo channel và spawn worker

```go
func NewHub(log *slog.Logger, bus BusInterface, manager *state.Manager) *Hub {
    h := &Hub{
        // make(chan T, bufferSize) — tạo buffered channel
        // make(chan T)             — unbuffered channel (block ngay)
        publishCh: make(chan publishJob, publishChBufSize),
        // ...
    }

    if bus != nil {
        bus.SetHandler(h)

        // Spawn đúng publishWorkers goroutine — không hơn, không kém
        // Các goroutine này sống suốt vòng đời của Hub
        for i := 0; i < publishWorkers; i++ {
            go h.publishWorker()
            // Không cần truyền i vào — worker không phân biệt nhau,
            // tất cả đều đọc từ cùng 1 channel
        }
    }

    return h
}
```

### 3.4. Worker function — trái tim của pool

```go
func (h *Hub) publishWorker() {
    // range trên channel:
    //   - Block (sleep, không tốn CPU) khi channel rỗng
    //   - Tự thoát khi channel bị close()
    //   - Không cần select { case job := <-ch: } nếu chỉ đọc 1 channel
    for job := range h.publishCh {

        // Timeout ngắn hơn code cũ (1s → 200ms) vì:
        //   - Nếu NATS chậm hơn 200ms → có vấn đề nghiêm trọng
        //   - Giữ worker lâu → các job sau bị xếp hàng
        ctx, cancel := context.WithTimeout(context.Background(), 200*time.Millisecond)
        start := time.Now()

        switch job.kind {
        case publishBroadcast:
            if err := h.bus.PublishBroadcast(ctx, job.mapID, job.data, job.excludeUserID); err != nil {
                h.log.Warn("publish broadcast failed",
                    "err", err,
                    "mapID", job.mapID,
                    "elapsed", time.Since(start),
                )
            }
        case publishKick:
            if err := h.bus.PublishKickUser(ctx, job.userID); err != nil {
                h.log.Warn("publish kick failed",
                    "err", err,
                    "userID", job.userID,
                    "elapsed", time.Since(start),
                )
            }
        }

        // Phát hiện NATS latency cao sớm — trước khi queue đầy
        if elapsed := time.Since(start); elapsed > 50*time.Millisecond {
            h.log.Warn("publish worker slow",
                "elapsed", elapsed,
                "kind", job.kind,
            )
        }

        // cancel() PHẢI gọi để release context resource
        // defer cancel() không dùng ở đây vì defer chỉ chạy khi function return,
        // không chạy cuối mỗi iteration của for loop
        cancel()
    }
    // Channel closed → for loop thoát → goroutine tự kết thúc → GC collect
}
```

**Tại sao không dùng `defer cancel()` trong loop?**

```go
// ❌ SAI — defer chạy khi FUNCTION return, không phải cuối mỗi iteration
for job := range h.publishCh {
    ctx, cancel := context.WithTimeout(...)
    defer cancel()  // cancel() chỉ gọi khi publishWorker() return
                    // → context leak trong suốt vòng đời worker
}

// ✅ ĐÚNG — cancel() gọi cuối mỗi iteration
for job := range h.publishCh {
    ctx, cancel := context.WithTimeout(...)
    // ... xử lý job ...
    cancel() // gọi explicit
}
```

### 3.5. Enqueue — producer side

```go
func (h *Hub) enqueue(job publishJob) {
    if h.bus == nil {
        return // single-instance mode, không cần publish
    }

    // select với default = non-blocking send
    select {
    case h.publishCh <- job:
        // Gửi thành công vào queue — worker sẽ xử lý sau

    default:
        // Channel đầy → drop job + log warning
        // Đây là back-pressure: thay vì block caller (gameplay lag)
        // hoặc tạo goroutine mới (goroutine leak),
        // ta chấp nhận drop NATS publish (gameplay không ảnh hưởng,
        // chỉ cross-instance broadcast bị miss)
        h.log.Warn("publish channel full, dropping",
            "kind", job.kind,
            "mapID", job.mapID,
            "queueLen", len(h.publishCh), // len() trên channel = số item đang đợi
        )
    }
}
```

**So sánh các cách send vào channel:**

```go
// 1. Blocking send — block cho đến khi có chỗ trống
h.publishCh <- job

// 2. Non-blocking với select/default — drop nếu đầy
select {
case h.publishCh <- job:
default:
    // drop
}

// 3. Timeout send — block tối đa N thời gian
select {
case h.publishCh <- job:
case <-time.After(10 * time.Millisecond):
    // timeout
}
```

Code dùng cách 2 — phù hợp cho hot path (tick loop gọi hàng nghìn lần/giây).

### 3.6. Shutdown — đóng pool đúng cách

```go
func (h *Hub) Close() {
    if h.publishCh != nil {
        // close(ch) làm 2 việc:
        //   1. Đánh dấu channel "closed" — không thể send thêm
        //   2. Unblock tất cả goroutine đang range ch → for loop thoát
        // Sau khi close, tất cả 16 worker goroutine tự thoát → GC collect
        close(h.publishCh)
    }
}

// Sau close(), nếu ai đó vẫn gọi enqueue():
// h.publishCh <- job  →  panic: send on closed channel
// Đó là lý do enqueue() nên check h.bus == nil trước,
// và Close() chỉ gọi khi hub đã không nhận request mới.
```

---

## 4. So sánh trước / sau

```
                    Code cũ              Code mới (pool)
─────────────────────────────────────────────────────────
Goroutine tạo/giây  2000                 0 (16 cố định)
GC pressure         Cao                  Thấp
Goroutine leak      Có (khi NATS chậm)   Không (bounded)
Back-pressure       Không                Có (channel full → drop)
Memory              ~2KB × 400 goroutine 16 goroutine cố định
Debug               Khó (goroutine ẩn)   Dễ (queue length visible)
```

---

## 5. Monitoring thêm vào sau

```go
// Thêm vào enqueue() để alert khi queue sắp đầy
func (h *Hub) enqueue(job publishJob) {
    if h.bus == nil {
        return
    }

    qLen := len(h.publishCh)
    cap  := cap(h.publishCh)

    // Alert sớm — 80% capacity
    if qLen > cap*8/10 {
        h.log.Warn("publish queue high watermark",
            "len", qLen,
            "cap", cap,
            "pct", qLen*100/cap,
        )
    }

    select {
    case h.publishCh <- job:
    default:
        h.log.Warn("publish channel full, dropping", ...)
    }
}
```

---

## 6. Tóm tắt pattern

```
Vấn đề:  N event/giây → N goroutine tạo/xóa → GC pressure + leak risk

Giải pháp: Worker Pool
  - M goroutine cố định (M << N)
  - Buffered channel làm queue
  - Producer: non-blocking send với select/default
  - Consumer: for range ch (block khi rỗng, exit khi close)
  - Shutdown: close(ch) → tất cả worker tự thoát

Trade-off chấp nhận:
  - Queue đầy → drop NATS publish (cross-instance broadcast miss 1 frame)
  - Không ảnh hưởng gameplay vì local broadcast đã chạy trước
```