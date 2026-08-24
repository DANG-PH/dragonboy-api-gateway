# Redlock — Distributed Locking với Redis

## Mục tiêu

Sử dụng Redis lock thông qua thư viện **Redlock** để tránh race condition khi scale nhiều instance, đảm bảo cron job chỉ chạy **đúng 1 lần** tại một thời điểm.

## Áp dụng

Dùng cho cron job hoặc các tác vụ chỉ được thực hiện duy nhất một lần khi scale nhiều instance.
Ví dụ trong service api-gateway ở player_manager controller

---

## So sánh các giải pháp

### 1. Redis Lock thuần (`SET NX PX`)

Lệnh acquire lock:

```
SET key value NX PX ttl
```

Đây là atomic ở Redis level — **không cần Lua khi acquire**.

**Tại sao KHÔNG chỉ dùng Redis lock thuần:**

- Chỉ hoạt động trên **1 Redis instance**
- Nếu Redis bị restart / failover → có thể **mất lock**
- Không có cơ chế quorum → không đảm bảo consistency trong hệ distributed

**Phù hợp cho:**
- Hệ thống nhỏ
- Không yêu cầu high availability cao

---

### 2. Lua Script

Dùng khi **release lock** để đảm bảo:
- Chỉ instance đang giữ lock (dựa vào token/value) mới được quyền unlock
- Tránh race condition giữa `GET` + `DEL`

**Tại sao KHÔNG dùng "Redis + Lua" như một giải pháp hoàn chỉnh:**

- Lua chỉ giải quyết **atomicity** (`GET` + `DEL`), KHÔNG giải quyết distributed locking
- Vẫn phụ thuộc **1 Redis node** duy nhất
- Không xử lý được: network partition, multi-node consistency

> Lua là **phần bổ trợ** cho lock, KHÔNG phải giải pháp lock đầy đủ.

---

### 3. Redlock ✅ (Giải pháp được chọn)

Là **client-side algorithm**, dùng khi có nhiều Redis node.

**Cơ chế:** phải acquire thành công trên đa số node — quorum = `(N/2) + 1`

**Tại sao CHỌN Redlock:**

- Đảm bảo chỉ **1 instance** acquire lock trong môi trường distributed
- Chịu được việc **1 số Redis node bị lỗi / timeout**
- Giảm rủi ro mất lock khi Redis đơn lẻ gặp sự cố
- Phù hợp khi scale nhiều server + cần consistency cao hơn

---

## Hệ thống hiện tại

> Đang dùng **1 Redis instance** → chưa tận dụng full sức mạnh của Redlock.

Thực tế đang là:
```
SET NX PX   (acquire)
+
Lua script  (release an toàn)
```

Tuy nhiên vẫn dùng Redlock để:
- Code **thống nhất**
- Dễ **scale lên multi Redis** trong tương lai

---

## Flow thực tế (Single Redis)

```
Instance 1:
  ├─ generate token (random value)
  ├─ SET lock:cron <token> NX PX <ttl>  →  success
  ├─ thực thi job (gửi email...)
  └─ release:
       Lua script: if GET key == token → DEL key
       (nếu crash → Redis tự expire theo TTL)

Instance 2:
  ├─ generate token
  ├─ SET NX PX  →  fail (key đã tồn tại)
  └─ throw ResourceLockedError  →  skip job
```

---

## Flow minh họa (Multi Redis — 3 node)

> Để hiểu Redlock chuẩn hoạt động như thế nào.

```
Instance 1:
  ├─ generate token
  ├─ thử SET NX PX trên 3 node:
  │    node1: success
  │    node2: success
  │    node3: timeout
  ├─ success = 2/3 → đạt quorum → acquire thành công
  ├─ thực thi job
  └─ release trên các node đã lock

Instance 2:
  ├─ generate token
  ├─ thử SET NX PX trên 3 node:
  │    node1: fail
  │    node2: fail
  │    node3: success
  └─ success = 1/3 < quorum → acquire fail → skip
```

---

## ES2023 Resource Management

Cú pháp `await using` (ES2023) giúp tự động release lock:

```typescript
await using lock = await redlock.acquire([...], ttl);
// thực thi job ở đây
```

Tương đương với:

```typescript
const lock = await redlock.acquire([...], ttl);
try {
  // thực thi job ở đây
} finally {
  await lock.release();
}
```

> Đảm bảo **luôn release lock** kể cả khi có error.

---

## Giải thích khái niệm & thuật ngữ

### Quorum

Quorum = **đa số đồng ý** trước khi thực hiện hành động.

Công thức: `quorum = (N/2) + 1` — với N là số Redis node.

Ví dụ 3 node → quorum = 2. Muốn acquire lock thành công, phải được **ít nhất 2 node đồng ý**.

**Tại sao cần quorum?** Tưởng tượng không có quorum:

```
Instance A  →  lock node1 ✅
Instance B  →  lock node2 ✅  (node1 đang chậm, B không biết A đã lock)

→ Cả A và B đều nghĩ mình đang giữ lock
→ Cả hai cùng chạy job một lúc  ❌
```

Với quorum:

```
Instance A  →  node1 ✅  node2 ✅  node3 ❌  →  2/3 → thành công
Instance B  →  node1 ❌  node2 ❌  node3 ✅  →  1/3 → thất bại, skip
```

B không thể "gom đủ phiếu" vì A đã chiếm đa số — chỉ 1 instance được chạy job.

---

### Consistency (Tính nhất quán)

> **Tại mọi thời điểm, toàn hệ thống đều đồng thuận về một sự thật duy nhất** — ai đang giữ lock.

Ví dụ **mất consistency** khi dùng Redis thuần (1 node):

```
t=0   Redis node bị restart
t=1   Lock bị mất (dù TTL chưa hết)
t=2   Instance A vẫn nghĩ mình đang giữ lock
t=3   Instance B acquire thành công (vì key đã biến mất)
t=4   Cả A và B cùng chạy job  ❌
```

A và B có **hai "sự thật" khác nhau** về ai đang giữ lock → mất consistency.

Với Redlock (multi node), dù 1 node chết, lock vẫn tồn tại trên các node còn lại → hệ thống vẫn đồng thuận → consistency được đảm bảo.

---

### Mối quan hệ giữa Quorum và Consistency

```
Quorum       →  cơ chế bỏ phiếu, phải thắng đa số node mới được lock
Consistency  →  kết quả: toàn hệ thống đồng thuận "chỉ 1 người giữ lock"
```

Không có quorum → các node đưa ra quyết định độc lập, mâu thuẫn nhau → mất consistency → 2 instance cùng chạy job.

---

### Atomicity (Tính nguyên tử)

> Một nhóm thao tác **hoặc thực hiện toàn bộ, hoặc không thực hiện gì cả** — không có trạng thái nửa vời.

Ví dụ: `GET key` rồi `DEL key` là 2 lệnh riêng. Nếu không atomic:

```
Instance A: GET key  →  thấy value khớp token của mình
            ← (Instance B chen vào, DEL key trước) →
Instance A: DEL key  →  xóa nhầm lock của B vừa tạo  ❌
```

Lua script giải quyết bằng cách gộp `GET + DEL` thành 1 atomic operation — Redis đảm bảo không có lệnh nào chen vào giữa.

---

### Race Condition

> Kết quả của chương trình phụ thuộc vào **thứ tự / thời điểm** các tiến trình chạy — không kiểm soát được.

Trong context cron job:

```
t=0   Instance A và B cùng kiểm tra: "có ai đang chạy không?"
t=1   Cả hai đều thấy: "không có"
t=2   Cả hai cùng bắt đầu chạy  ❌
```

Lock giải quyết race condition bằng cách biến việc "kiểm tra + chiếm lock" thành atomic.

---

### Distributed Locking

> Cơ chế đảm bảo **chỉ 1 process** trong toàn bộ hệ thống phân tán được thực thi tại một thời điểm.

Khác với lock trong single process (mutex, semaphore) — distributed lock phải hoạt động qua **network**, giữa nhiều máy chủ khác nhau, với các vấn đề như:
- Network delay / timeout
- Node bị crash giữa chừng
- Clock skew giữa các máy

---

### Fault Tolerance (Khả năng chịu lỗi)

> Hệ thống vẫn **hoạt động đúng** dù có một số thành phần bị lỗi.

Redlock với 3 node: chịu được **1 node chết** mà lock vẫn hợp lệ (còn 2 node = đủ quorum).
Redlock với 5 node: chịu được **2 node chết**.

Redis thuần (1 node): node chết → lock mất → không có fault tolerance.

---

### Network Partition

> Tình huống mạng bị chia cắt khiến các node **không liên lạc được với nhau**, dù vẫn đang chạy.

```
[Instance A] ←──✂──→ [Redis node2]   ← mạng đứt
[Instance A] ←──────→ [Redis node1]   ← vẫn thông
```

Node2 không "chết" nhưng A không thể acquire lock trên đó. Quorum giúp hệ thống vẫn ra quyết định đúng dù bị partition.

---

### TTL (Time To Live)

> Thời gian tồn tại tối đa của lock trong Redis. Hết TTL → Redis tự xóa key.

Vai trò quan trọng: **tự động giải phóng lock** khi instance crash giữa chừng mà không kịp release.

```
Instance A crash  →  không release được
TTL hết (vd: 30s) →  Redis tự DEL key  →  Instance B có thể acquire
```

TTL cần đặt đủ lớn để job chạy xong, nhưng không quá lớn để tránh block quá lâu khi có sự cố.

---

### Failover

> Quá trình **tự động chuyển sang** node dự phòng khi node chính gặp sự cố.

Vấn đề với Redis Sentinel / Cluster + lock thuần:

```
t=0   Instance A lock trên Redis master
t=1   Master crash → Sentinel promote slave lên làm master mới
t=2   Slave (chưa kịp sync) không có key lock
t=3   Instance B acquire thành công trên master mới
t=4   Cả A và B cùng giữ lock  ❌
```

Redlock tránh vấn đề này vì không phụ thuộc vào replication — mỗi node là **independent**.

---

## Tóm tắt

| Giải pháp | Atomic acquire | Atomic release | Distributed | Fault tolerant |
|---|---|---|---|---|
| Redis `SET NX PX` | ✅ | ❌ | ❌ | ❌ |
| Redis + Lua | ✅ | ✅ | ❌ | ❌ |
| **Redlock** | ✅ | ✅ | ✅ | ✅ |