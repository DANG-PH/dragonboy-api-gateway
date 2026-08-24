# Race Condition — Hướng Dẫn Toàn Diện

## Mục Lục

1. [Race Condition là gì?](#1-race-condition-là-gì)
2. [Tại sao Race Condition nguy hiểm?](#2-tại-sao-race-condition-nguy-hiểm)
3. [Các loại Race Condition phổ biến](#3-các-loại-race-condition-phổ-biến)
   - [3.1 Read-Modify-Write](#31-read-modify-write)
   - [3.2 Check-Then-Act (TOCTOU)](#32-check-then-act-toctou)
   - [3.3 Lost Update](#33-lost-update)
   - [3.4 Dirty Read / Phantom Read](#34-dirty-read--phantom-read)
   - [3.5 Double Spending](#35-double-spending)
   - [3.6 Race trong Event Consumer](#36-race-trong-event-consumer)
   - [3.7 Race trong Cache (Thundering Herd / Cache Stampede)](#37-race-trong-cache-thundering-herd--cache-stampede)
   - [3.8 Race trong Distributed Scheduled Job](#38-race-trong-distributed-scheduled-job)
4. [Khi nào cần xử lý Race Condition?](#4-khi-nào-cần-xử-lý-race-condition)
5. [Các kỹ thuật xử lý Race Condition](#5-các-kỹ-thuật-xử-lý-race-condition)
   - [5.1 Pessimistic Locking (SELECT FOR UPDATE)](#51-pessimistic-locking-select-for-update)
   - [5.2 Optimistic Locking (Version / ETag)](#52-optimistic-locking-version--etag)
   - [5.3 Atomic Database Operations](#53-atomic-database-operations)
   - [5.4 Database Serializable Transactions](#54-database-serializable-transactions)
   - [5.5 Redis Atomic Commands (INCR, SETNX, GETSET)](#55-redis-atomic-commands-incr-setnx-getset)
   - [5.6 Redis + Lua Script](#56-redis--lua-script)
   - [5.7 Redlock — Distributed Mutex](#57-redlock--distributed-mutex)
   - [5.8 Queue / Serialized Processing](#58-queue--serialized-processing)
   - [5.9 Actor Model / Message Passing](#59-actor-model--message-passing)
   - [5.10 Compare-and-Swap (CAS)](#510-compare-and-swap-cas)
   - [5.11 Database Advisory Lock](#511-database-advisory-lock)
   - [5.12 Partition / Sharding by Key](#512-partition--sharding-by-key)
6. [So sánh tổng hợp các kỹ thuật](#6-so-sánh-tổng-hợp-các-kỹ-thuật)
7. [Quyết định chọn kỹ thuật theo use case](#7-quyết-định-chọn-kỹ-thuật-theo-use-case)
8. [Race Condition trong thực tế — Case Studies](#8-race-condition-trong-thực-tế--case-studies)
9. [Checklist phòng tránh Race Condition](#9-checklist-phòng-tránh-race-condition)
10. [Các Anti-pattern cần tránh](#10-các-anti-pattern-cần-tránh)

---

## 1. Race Condition là gì?

**Race Condition** xảy ra khi **hai hay nhiều luồng xử lý** (thread, process, service, request) cùng truy cập và thay đổi **shared resource** (dữ liệu chung) theo thứ tự không xác định — và kết quả cuối cùng phụ thuộc vào **ai chạy nhanh hơn**.

### Minh hoạ kinh điển — Counter tăng đồng thời

```
Giá trị ban đầu: counter = 100

Thread A                    Thread B
──────────────────          ──────────────────
READ  counter → 100         READ  counter → 100
                            ADD   100 + 1 = 101
                            WRITE counter = 101
ADD   100 + 1 = 101
WRITE counter = 101         ← GHI ĐÈ kết quả của B!

Kết quả thực tế:  counter = 101  ❌
Kết quả mong đợi: counter = 102  ✅
```

Một lần tăng bị **mất** vì Thread A đọc giá trị cũ trước khi Thread B ghi xong. Đây gọi là **Lost Update**.

### Race Condition trong hệ thống phân tán

```
User A mua vé                   User B mua vé
──────────────────              ──────────────────
SELECT seats WHERE id=1
→ available = 1                 SELECT seats WHERE id=1
                                → available = 1
UPDATE seats SET                UPDATE seats SET
  available = 0 WHERE id=1        available = 0 WHERE id=1

Gửi vé cho User A ✅            Gửi vé cho User B ✅  ← OVERSOLDˇ!
```

Cả hai user cùng đọc thấy `available = 1`, cùng quyết định mua, cùng ghi `available = 0` → 1 vé được bán cho 2 người.

---

## 2. Tại sao Race Condition nguy hiểm?

### 2.1 Hậu quả nghiêm trọng về tài chính

- **Double spending:** Tài khoản có 100k, 2 request rút tiền đồng thời, cả 2 đều thành công → âm tài khoản.
- **Overselling:** Flash sale 100 sản phẩm nhưng 150 đơn hàng được tạo thành công.
- **Duplicate payout:** Cùng một affiliate commission được trả 2 lần.

### 2.2 Khó debug

- Race condition **không tái hiện được** một cách ổn định (non-deterministic).
- Chỉ xảy ra trong điều kiện cụ thể: high concurrency, specific timing, specific load.
- Unit test thông thường **không phát hiện được** race condition.
- Log và stack trace thường **không đủ** để xác định nguyên nhân.

### 2.3 Hệ thống scale càng nhiều, race condition càng tệ hơn

- 1 server, 1 process: ít xảy ra.
- Multiple threads: bắt đầu xuất hiện.
- Multiple processes / multiple servers: thường xuyên.
- Microservices + event-driven: phức tạp nhất.

### 2.4 Silent failure — không có error, chỉ có sai dữ liệu

Race condition thường **không throw exception**. Hệ thống vẫn chạy bình thường, nhưng dữ liệu bị corrupt dần dần.

---

## 3. Các loại Race Condition phổ biến

### 3.1 Read-Modify-Write

**Mô tả:** Đọc giá trị, thay đổi trong memory, ghi lại. Nếu ai đó cũng đang làm điều tương tự → ghi đè lên nhau.

```python
# UNSAFE
def increment_view_count(article_id):
    count = db.get(f"views:{article_id}")   # READ
    count += 1                               # MODIFY
    db.set(f"views:{article_id}", count)    # WRITE
    # Nếu 1000 request đồng thời → kết quả << 1000
```

**Xuất hiện ở:** Counter, inventory quantity, balance, rating score.

---

### 3.2 Check-Then-Act (TOCTOU)

**TOCTOU = Time Of Check to Time Of Use**

**Mô tả:** Kiểm tra điều kiện, sau đó thực hiện hành động. Giữa check và act, điều kiện có thể đã thay đổi.

```python
# UNSAFE
def book_last_seat(flight_id, userId):
    seats = db.query("SELECT available FROM flights WHERE id = ?", flight_id)
    if seats.available > 0:                         # CHECK
        # <-- 10ms window: ai đó cũng vừa pass check này -->
        db.execute("UPDATE flights SET available = available - 1 WHERE id = ?", flight_id)  # ACT
        create_booking(flight_id, userId)
```

**Xuất hiện ở:** Inventory check before purchase, balance check before transfer, slot availability.

---

### 3.3 Lost Update

**Mô tả:** Hai transactions đọc cùng giá trị, cùng modify, cùng write — một write bị ghi đè và mất.

```
T1: READ balance = 500
T2: READ balance = 500
T1: WRITE balance = 500 - 200 = 300   (rút 200k)
T2: WRITE balance = 500 - 100 = 400   (rút 100k) → GHI ĐÈ T1!

Kết quả: balance = 400  ❌  (mất 200k của T1)
Đúng ra: balance = 200  ✅
```

**Xuất hiện ở:** Bất kỳ concurrent update nào trên cùng record.

---

### 3.4 Dirty Read / Phantom Read

**Dirty Read:** Đọc dữ liệu đang được ghi bởi transaction chưa commit.

```
T1: UPDATE orders SET status = 'processing'  (chưa commit)
T2: SELECT * FROM orders WHERE status = 'processing'  → thấy order của T1
T1: ROLLBACK
T2: Xử lý dựa trên dữ liệu không bao giờ tồn tại → lỗi
```

**Phantom Read:** Query cùng điều kiện 2 lần nhưng trả về khác nhau vì có insert/delete xảy ra giữa hai lần đọc.

---

### 3.5 Double Spending

**Mô tả:** Điển hình trong payment. Cùng một số dư được dùng để thanh toán 2 lần đồng thời.

```
Balance: 500k

Request A: Mua hàng 400k          Request B: Chuyển khoản 300k
──────────────────────             ──────────────────────
CHECK balance = 500k ≥ 400k ✅    CHECK balance = 500k ≥ 300k ✅
DEDUCT 400k                        DEDUCT 300k
→ balance = 100k                   → balance = 200k  ← GHI ĐÈ!

Kết quả: balance = 200k  (chỉ deduct 300k, mất 400k!)
```

---

### 3.6 Race trong Event Consumer

**Mô tả:** Nhiều consumer instance cùng nhận một message, cùng xử lý trước khi kịp đánh dấu "đã xử lý".

```
Consumer 1                          Consumer 2
──────────────────                  ──────────────────
Nhận event: order_paid (id=99)      Nhận event: order_paid (id=99)
Check: đã xử lý? → NO              Check: đã xử lý? → NO  (race!)
Gửi confirmation email              Gửi confirmation email  ← DUPLICATE!
Mark as processed                   Mark as processed
```

---

### 3.7 Race trong Cache (Thundering Herd / Cache Stampede)

**Mô tả:** Cache expire đồng thời → hàng trăm request cùng lúc miss cache, cùng query database.

```
T=0: Cache key "product:123" expire
T=1ms: Request A: cache miss → query DB
T=1ms: Request B: cache miss → query DB    ← 100 requests đồng thời
T=1ms: Request C: cache miss → query DB      → DB bị flood
...
T=500ms: Tất cả write lại cache với cùng giá trị (lãng phí)
```

**Hậu quả:** Database overload, timeout, cascading failure.

---

### 3.8 Race trong Distributed Scheduled Job

**Mô tả:** Nhiều worker instance cùng pick up và chạy cùng một job.

```
Worker A (Server 1)                 Worker B (Server 2)
──────────────────                  ──────────────────
Cron triggers at 00:00              Cron triggers at 00:00
SELECT jobs WHERE status='pending'  SELECT jobs WHERE status='pending'
→ job_id = 42                       → job_id = 42  (cùng job!)
Process job 42                      Process job 42  ← DUPLICATE!
```

---

## 4. Khi nào cần xử lý Race Condition?

| Tình huống | Cần xử lý? | Lý do |
|---|---|---|
| Cập nhật inventory / số lượng tồn kho | ✅ Bắt buộc | Overselling nếu không xử lý |
| Rút tiền / chuyển khoản | ✅ Bắt buộc | Double spending, âm số dư |
| Đặt vé / booking | ✅ Bắt buộc | Oversold |
| Counter tăng (view count, like count) | ⚠️ Tuỳ yêu cầu | Sai số nhỏ thường chấp nhận được |
| Scheduled job / batch processing | ✅ Cần xử lý | Duplicate processing |
| Event consumer (Kafka, SQS) | ✅ Cần xử lý | Duplicate side effects |
| Cache update | ⚠️ Tuỳ | Stale data thường OK, stampede thì cần |
| User registration | ✅ Cần | Duplicate account với cùng email |
| Profile/settings update | ⚠️ Tuỳ | Lost update có thể chấp nhận nếu không critical |
| Read-only queries | ❌ Không cần | Không thay đổi state |
| Append-only log | ❌ Thường không cần | Duplicate log entry thường OK |

---

## 5. Các kỹ thuật xử lý Race Condition

---

### 5.1 Pessimistic Locking (SELECT FOR UPDATE)

**Cơ chế hoạt động:**

Lock row ngay khi đọc. Các transaction khác muốn đọc/ghi row đó phải đợi lock được release. "Pessimistic" vì giả định rằng conflict **sẽ xảy ra** nên lock trước.

```sql
-- PostgreSQL / MySQL
BEGIN;

-- Lock row ngay khi SELECT
SELECT balance, version
FROM accounts
WHERE id = 123
FOR UPDATE;          -- ← Row bị lock tới khi transaction kết thúc

-- Giờ có thể safely modify
UPDATE accounts
SET balance = balance - 500
WHERE id = 123;

COMMIT;              -- ← Lock được release
```

**Ví dụ trong Python (SQLAlchemy):**

```python
from sqlalchemy import select, update
from sqlalchemy.orm import Session

def transfer_money(db: Session, from_id: int, to_id: int, amount: float):
    with db.begin():
        # Lock cả 2 rows, sort by id để tránh deadlock
        accounts = db.execute(
            select(Account)
            .where(Account.id.in_([from_id, to_id]))
            .order_by(Account.id)           # ← CRITICAL: consistent order
            .with_for_update()              # ← SELECT FOR UPDATE
        ).scalars().all()

        sender = next(a for a in accounts if a.id == from_id)
        receiver = next(a for a in accounts if a.id == to_id)

        if sender.balance < amount:
            raise InsufficientFundsError()

        sender.balance -= amount
        receiver.balance += amount
        # Transaction commit → locks released
```

**Deadlock prevention — luôn lock theo thứ tự nhất quán:**

```python
# WRONG: T1 lock A rồi B, T2 lock B rồi A → deadlock
# CORRECT: Luôn lock theo id tăng dần
ids = sorted([from_id, to_id])
accounts = db.query(Account).filter(Account.id.in_(ids)).order_by(Account.id).with_for_update()
```

**NOWAIT và SKIP LOCKED:**

```sql
-- Thất bại ngay nếu không lấy được lock (thay vì đợi)
SELECT * FROM jobs WHERE status = 'pending' FOR UPDATE SKIP LOCKED LIMIT 1;
-- Dùng cho job queue: mỗi worker lấy 1 job khác nhau, không block lẫn nhau
```

**Ưu điểm:**

- ✅ Đơn giản, dễ hiểu
- ✅ Đảm bảo tuyệt đối — không có conflict nào lọt qua
- ✅ Database tự quản lý lock, không cần code phức tạp
- ✅ Phù hợp với high-contention scenarios

**Nhược điểm:**

- ❌ **Throughput thấp** — các transaction phải đợi nhau
- ❌ **Deadlock** nếu lock không đúng thứ tự
- ❌ Lock held suốt transaction — dài hay ngắn đều block
- ❌ Không áp dụng được cross-database, cross-service

**Khi nào dùng:**

- Financial transactions (balance transfer)
- Inventory reservation khi không thể oversell
- Bất kỳ operation critical nào trên ít row

**Khi nào KHÔNG dùng:**

- High read traffic (lock gây bottleneck)
- Long-running transactions
- Cross-service operations (không có shared DB)

---

### 5.2 Optimistic Locking (Version / ETag)

**Cơ chế hoạt động:**

Không lock khi đọc. Khi ghi, check xem record có bị thay đổi kể từ lần đọc không. Nếu có → abort và retry. "Optimistic" vì giả định conflict **hiếm khi xảy ra**.

```sql
-- Schema: thêm cột version
CREATE TABLE accounts (
    id BIGINT PRIMARY KEY,
    balance DECIMAL(15,2),
    version INT DEFAULT 0  -- ← version counter
);

-- Read: lấy version hiện tại
SELECT id, balance, version FROM accounts WHERE id = 123;
-- → id=123, balance=1000, version=7

-- Write: chỉ update nếu version vẫn là 7
UPDATE accounts
SET
    balance = balance - 500,
    version = version + 1        -- ← increment version
WHERE id = 123
  AND version = 7;               -- ← optimistic lock check

-- Kiểm tra rows affected:
-- 1 row → thành công
-- 0 rows → conflict! Ai đó đã update trước → retry
```

**Ví dụ với retry logic:**

```python
import time
from typing import Optional

MAX_RETRIES = 3
RETRY_DELAY = 0.1  # seconds

def update_inventory(product_id: int, delta: int) -> bool:
    for attempt in range(MAX_RETRIES):
        product = db.query(
            "SELECT id, stock, version FROM products WHERE id = %s",
            product_id
        ).fetchone()

        new_stock = product.stock + delta
        if new_stock < 0:
            raise InsufficientStockError()

        rows_affected = db.execute(
            """UPDATE products
               SET stock = %s, version = version + 1
               WHERE id = %s AND version = %s""",
            (new_stock, product_id, product.version)
        )

        if rows_affected == 1:
            return True  # ← Thành công

        # Conflict → wait và retry
        time.sleep(RETRY_DELAY * (2 ** attempt))  # exponential backoff

    raise OptimisticLockError(f"Could not update product {product_id} after {MAX_RETRIES} retries")
```

**HTTP ETag pattern (REST API):**

```
# Client lần đầu
GET /api/products/123
← 200 OK
← ETag: "version-7"
← { "id": 123, "stock": 50 }

# Client update với ETag
PUT /api/products/123
→ If-Match: "version-7"
→ { "stock": 45 }

← 200 OK (version match → update success)
← ETag: "version-8"

# Nếu ai đó update trước
← 412 Precondition Failed (version mismatch)
```

**JPA / Hibernate:**

```java
@Entity
public class Product {
    @Id
    private Long id;
    private Integer stock;

    @Version                          // ← Hibernate tự quản lý
    private Integer version;
}

// Service
@Transactional
public void reserveStock(Long productId, int quantity) {
    Product product = productRepo.findById(productId)
        .orElseThrow(NotFoundException::new);

    if (product.getStock() < quantity) {
        throw new InsufficientStockException();
    }
    product.setStock(product.getStock() - quantity);
    // Hibernate tự check version khi save → ném OptimisticLockException nếu conflict
}

// Retry với Spring Retry
@Retryable(value = OptimisticLockException.class, maxAttempts = 3)
public void reserveStockWithRetry(Long productId, int quantity) {
    reserveStock(productId, quantity);
}
```

**Ưu điểm:**

- ✅ **Throughput cao** — không block concurrent reads
- ✅ Không có deadlock
- ✅ Phù hợp cho low-contention scenarios
- ✅ REST-friendly với ETag

**Nhược điểm:**

- ❌ **Retry overhead** khi contention cao
- ❌ Starvation: một transaction liên tục bị conflict, không bao giờ thành công
- ❌ Cần implement retry logic
- ❌ Không phù hợp high-contention (retry storm)

**Khi nào dùng:**

- Concurrent document/profile editing (conflict hiếm)
- REST API với ETag
- Inventory update khi contention thấp

**Khi nào KHÔNG dùng:**

- Flash sale (cực kỳ high contention → retry storm)
- Financial transfers (cần đảm bảo tuyệt đối, không thể retry vô hạn)

---

### 5.3 Atomic Database Operations

**Cơ chế hoạt động:**

Dùng SQL atomic operations (thực hiện trong một statement) thay vì Read-Modify-Write ở application layer. Database đảm bảo atomicity ở row level.

```sql
-- WRONG: Read-Modify-Write ở application layer (race condition!)
-- App: count = SELECT view_count FROM articles WHERE id = 1  → 100
-- App: UPDATE articles SET view_count = 101 WHERE id = 1

-- CORRECT: Atomic UPDATE
UPDATE articles
SET view_count = view_count + 1     -- ← Atomic ở DB level
WHERE id = 1;

-- CORRECT: Atomic decrement với constraint
UPDATE inventory
SET quantity = quantity - 1
WHERE product_id = 42
  AND quantity > 0;                  -- ← Tự động fail nếu hết hàng
-- Rows affected = 0 → hết hàng, không oversell
```

**Ví dụ: Atomic reservation với check:**

```sql
-- Atomic: decrement chỉ khi đủ số lượng
UPDATE seats
SET available = available - :requested
WHERE flight_id = :flight_id
  AND available >= :requested;      -- ← Check + update trong 1 statement

-- Rows = 1 → reservation thành công
-- Rows = 0 → không đủ chỗ
```

**Ví dụ: Conditional atomic với CASE:**

```sql
UPDATE accounts
SET balance = CASE
    WHEN balance >= :amount THEN balance - :amount
    ELSE balance                    -- ← Không thay đổi nếu không đủ
END,
status = CASE
    WHEN balance >= :amount THEN 'debited'
    ELSE 'insufficient_funds'
END
WHERE id = :account_id;
```

**Ưu điểm:**

- ✅ Đơn giản nhất — không cần lock, không cần retry logic
- ✅ Atomic — database đảm bảo
- ✅ Hiệu năng cao — chỉ 1 round trip
- ✅ Không có deadlock

**Nhược điểm:**

- ❌ Chỉ áp dụng cho single table, single row operations
- ❌ Không dùng được cho complex business logic spanning nhiều bảng
- ❌ Khó implement complex validation

**Khi nào dùng:**

- Counter increment/decrement
- Simple inventory update
- Balance deduction với constraint
- Bất kỳ update đơn giản nào có thể express bằng SQL

**Khi nào KHÔNG dùng:**

- Multi-table transactions
- Complex business logic cần đọc data trước
- Cross-service operations

---

### 5.4 Database Serializable Transactions

**Cơ chế hoạt động:**

Set isolation level cao nhất: `SERIALIZABLE`. Database đảm bảo transactions chạy như thể chúng chạy **tuần tự** (serial), dù thực tế có thể parallel. Nếu phát hiện conflict → abort một transaction.

```python
# PostgreSQL: Serializable isolation
with db.connect() as conn:
    conn.execute("SET TRANSACTION ISOLATION LEVEL SERIALIZABLE")

    with conn.begin():
        # Đọc
        result = conn.execute(
            "SELECT quantity FROM inventory WHERE product_id = %s",
            product_id
        ).fetchone()

        if result.quantity < requested:
            raise InsufficientStockError()

        # Ghi
        conn.execute(
            "UPDATE inventory SET quantity = quantity - %s WHERE product_id = %s",
            (requested, product_id)
        )

        conn.execute(
            "INSERT INTO orders (product_id, quantity, userId) VALUES (%s, %s, %s)",
            (product_id, requested, userId)
        )
    # Commit — DB detect serialization conflict và abort nếu cần
```

**Isolation levels so sánh:**

```
READ UNCOMMITTED  → Dirty read có thể xảy ra
READ COMMITTED    → Dirty read được tránh, non-repeatable read có thể xảy ra  (PostgreSQL default)
REPEATABLE READ   → Non-repeatable read được tránh, phantom read có thể xảy ra (MySQL InnoDB default)
SERIALIZABLE      → Tất cả anomaly được tránh, throughput thấp nhất
```

**Ưu điểm:**

- ✅ Bảo vệ chống tất cả anomaly (dirty read, lost update, phantom)
- ✅ Không cần explicit lock trong code
- ✅ Database tự phát hiện và abort conflicting transactions

**Nhược điểm:**

- ❌ **Throughput thấp nhất** — abort rate cao khi contention nhiều
- ❌ Phải retry khi bị abort (serialization failure)
- ❌ Không phải tất cả DB support tốt (MySQL serializable kém hơn PostgreSQL SSI)

**Khi nào dùng:**

- Complex multi-table operations cần consistency tuyệt đối
- Khi không muốn explicit lock nhưng cần safety
- PostgreSQL SSI (Serializable Snapshot Isolation) — efficient hơn traditional serializable

---

### 5.5 Redis Atomic Commands (INCR, SETNX, GETSET)

**Cơ chế hoạt động:**

Redis là single-threaded — mọi command đều atomic by design. Dùng các atomic command để tránh race condition mà không cần lock.

```python
import redis
r = redis.Redis(host='localhost', port=6379)

# ✅ ATOMIC: INCR — thread-safe counter
r.incr("article:123:views")           # Tăng 1, atomic
r.incrby("article:123:views", 5)      # Tăng 5, atomic
r.decr("inventory:product:42")        # Giảm 1, atomic

# ✅ ATOMIC: SETNX (Set if Not eXists) — distributed mutex
acquired = r.setnx("lock:resource:99", "locked")
# True  → lock acquired
# False → someone else holds the lock

# ✅ ATOMIC: SET với NX + EX (modern way)
acquired = r.set(
    "lock:resource:99",
    "owner:server1:uuid123",
    nx=True,    # Only set if Not eXists
    ex=30       # Expire sau 30 giây (auto-release nếu crash)
)

# ✅ ATOMIC: GETSET — lấy giá trị cũ và set giá trị mới
old_value = r.getset("key", "new_value")

# ✅ ATOMIC: HSETNX — set field trong hash nếu chưa tồn tại
r.hsetnx("user:123:session", "token", "abc123")
```

**Rate limiting với atomic INCR:**

```python
def is_rate_limited(userId: str, limit: int = 100, window: int = 60) -> bool:
    key = f"rate_limit:{userId}:{int(time.time() // window)}"
    pipe = r.pipeline()
    pipe.incr(key)
    pipe.expire(key, window)
    results = pipe.execute()
    current_count = results[0]
    return current_count > limit
```

**Inventory với atomic DECR:**

```python
def reserve_item(product_id: int, quantity: int) -> bool:
    key = f"inventory:{product_id}"

    # DECR rồi check — đơn giản nhưng có thể negative
    new_val = r.decrby(key, quantity)
    if new_val >= 0:
        return True
    else:
        # Rollback: hoàn lại số lượng vừa trừ
        r.incrby(key, quantity)
        return False
    # Nhược điểm: có race condition nhỏ giữa check và rollback
    # → Dùng Lua script để atomic hoàn toàn (xem 5.6)
```

**Ưu điểm:**

- ✅ **Cực kỳ nhanh** — in-memory, atomic
- ✅ Không cần lock logic
- ✅ Redis single-threaded đảm bảo atomicity
- ✅ Phù hợp cho counter, rate limiting, simple flag

**Nhược điểm:**

- ❌ Redis là in-memory — data có thể mất nếu crash (cần persistence)
- ❌ Chỉ cho simple operations — complex logic cần Lua script
- ❌ DECR có thể xuống âm nếu không handle đúng

**Khi nào dùng:**

- Rate limiting
- View/like counter
- Simple flag (session, online status)
- Distributed lock với SETNX (xem thêm Redlock 5.7)

---

### 5.6 Redis + Lua Script

**Cơ chế hoạt động:**

Lua script trong Redis được execute **atomically** — toàn bộ script chạy mà không có command nào khác chen vào. Đây là cách duy nhất để có multi-step atomic operation trong Redis.

**Tại sao cần Lua?**

```python
# WRONG: 2 commands riêng biệt → không atomic!
current = r.get("inventory:42")        # Step 1
if int(current) >= requested:
    r.decrby("inventory:42", requested) # Step 2 — ai đó có thể chen vào đây!

# CORRECT: Lua script → 2 steps trong 1 atomic operation
```

**Lua script: Atomic inventory reservation:**

```lua
-- reserve_inventory.lua
local key = KEYS[1]              -- "inventory:product:42"
local requested = tonumber(ARGV[1])

local current = tonumber(redis.call('GET', key) or 0)

if current >= requested then
    redis.call('DECRBY', key, requested)
    return 1    -- Success
else
    return 0    -- Insufficient stock
end
```

```python
# Load và chạy Lua script
RESERVE_SCRIPT = """
local key = KEYS[1]
local requested = tonumber(ARGV[1])
local current = tonumber(redis.call('GET', key) or 0)
if current >= requested then
    redis.call('DECRBY', key, requested)
    return 1
else
    return 0
end
"""

# Register script (cache SHA để tái sử dụng)
reserve_script = r.register_script(RESERVE_SCRIPT)

def reserve_inventory(product_id: int, quantity: int) -> bool:
    result = reserve_script(
        keys=[f"inventory:{product_id}"],
        args=[quantity]
    )
    return result == 1
```

**Lua script: Atomic token bucket rate limiting:**

```lua
-- token_bucket.lua
local key = KEYS[1]           -- "rate_bucket:user:123"
local capacity = tonumber(ARGV[1])    -- 100 tokens max
local refill_rate = tonumber(ARGV[2]) -- tokens per second
local requested = tonumber(ARGV[3])   -- tokens needed
local now = tonumber(ARGV[4])         -- current timestamp

local bucket = redis.call('HMGET', key, 'tokens', 'last_refill')
local tokens = tonumber(bucket[1]) or capacity
local last_refill = tonumber(bucket[2]) or now

-- Refill tokens based on elapsed time
local elapsed = now - last_refill
local new_tokens = math.min(capacity, tokens + elapsed * refill_rate)

if new_tokens >= requested then
    -- Allow request
    redis.call('HMSET', key, 'tokens', new_tokens - requested, 'last_refill', now)
    redis.call('EXPIRE', key, 3600)
    return 1
else
    -- Reject request
    redis.call('HMSET', key, 'tokens', new_tokens, 'last_refill', now)
    redis.call('EXPIRE', key, 3600)
    return 0
end
```

**Lua script: Atomic compare-and-swap:**

```lua
-- cas.lua: Chỉ set nếu giá trị hiện tại khớp với expected
local key = KEYS[1]
local expected = ARGV[1]
local new_value = ARGV[2]
local ttl = tonumber(ARGV[3])

local current = redis.call('GET', key)
if current == expected then
    redis.call('SET', key, new_value, 'EX', ttl)
    return 1  -- Success
else
    return 0  -- CAS failed
end
```

**Ưu điểm:**

- ✅ **Truly atomic** — không có command nào chen vào giữa
- ✅ Có thể implement complex logic (condition, loop)
- ✅ Hiệu năng cao — chạy server-side, ít round trips
- ✅ Không có deadlock

**Nhược điểm:**

- ❌ **Blocking** — Lua script block toàn bộ Redis trong khi chạy (vì Redis single-threaded)
- ❌ Script quá lâu → Redis bị block → ảnh hưởng tất cả clients
- ❌ Khó debug, khó test
- ❌ Không hoạt động tốt với Redis Cluster nếu multi-key span nhiều slot

**Khi nào dùng:**

- Inventory reservation với check
- Rate limiting phức tạp (token bucket, sliding window)
- Distributed lock với safe release (xem Redlock)
- Bất kỳ Redis multi-step operation cần atomicity

**Khi nào KHÔNG dùng:**

- Script chạy lâu (> vài ms) → block Redis
- Multi-key operations trong Redis Cluster (keys phải cùng hash slot)
- Khi logic quá phức tạp → dùng Redlock + DB thay thế

---

### 5.7 Redlock — Distributed Mutex

**Cơ chế hoạt động:**

Redlock là thuật toán distributed locking của Redis author (Salvatore Sanfilippo). Dùng **nhiều Redis instances độc lập** để đảm bảo lock safety ngay cả khi một số nodes fail.

**Thuật toán Redlock (N = 5 Redis nodes):**

```
1. Ghi lại start_time
2. Thử acquire lock trên TẤT CẢ N nodes với cùng key và random value
3. Lock thành công nếu:
   - Acquire được trên ít nhất N/2 + 1 nodes (majority = 3/5)
   - Thời gian elapsed < lock TTL
4. Validity time = TTL - elapsed - clock_drift
5. Nếu không thành công → release lock trên tất cả nodes đã acquire
```

**Implementation với Python (redlock-py):**

```python
from redlock import Redlock, RedLockError
import uuid

# Khởi tạo với nhiều Redis nodes
dlm = Redlock([
    {"host": "redis-node-1", "port": 6379},
    {"host": "redis-node-2", "port": 6379},
    {"host": "redis-node-3", "port": 6379},
])

def process_order(order_id: str):
    lock_key = f"order_processing:{order_id}"
    lock_ttl = 30000  # 30 giây

    try:
        # Acquire distributed lock
        lock = dlm.lock(lock_key, lock_ttl)
    except RedLockError:
        raise Exception(f"Could not acquire lock for order {order_id}")

    try:
        # Double-check: đã xử lý chưa? (idempotency)
        order = Order.get(order_id)
        if order.status != 'pending':
            return order

        # Safe zone: chỉ một process ở đây tại một thời điểm
        result = do_process_order(order)
        return result

    finally:
        # ALWAYS release lock
        dlm.unlock(lock)
```

**Safe lock release với Lua (tránh release nhầm lock của người khác):**

```lua
-- release_lock.lua: Chỉ delete nếu value khớp (chúng ta là owner)
if redis.call("GET", KEYS[1]) == ARGV[1] then
    return redis.call("DEL", KEYS[1])
else
    return 0
end
```

```python
RELEASE_SCRIPT = """
if redis.call("GET", KEYS[1]) == ARGV[1] then
    return redis.call("DEL", KEYS[1])
else
    return 0
end
"""
release_script = r.register_script(RELEASE_SCRIPT)

class DistributedLock:
    def __init__(self, redis_client, key: str, ttl: int = 30):
        self.redis = redis_client
        self.key = f"lock:{key}"
        self.ttl = ttl
        self.owner_id = str(uuid.uuid4())  # Unique per lock acquisition

    def acquire(self) -> bool:
        return bool(self.redis.set(
            self.key,
            self.owner_id,    # ← Store unique owner ID
            nx=True,
            ex=self.ttl
        ))

    def release(self):
        # Atomic: chỉ delete nếu chúng ta là owner
        release_script(keys=[self.key], args=[self.owner_id])

    def extend(self, additional_seconds: int):
        # Gia hạn lock nếu operation kéo dài
        pipe = self.redis.pipeline()
        pipe.get(self.key)
        current_owner = pipe.execute()[0]
        if current_owner == self.owner_id.encode():
            self.redis.expire(self.key, self.ttl + additional_seconds)

    def __enter__(self):
        if not self.acquire():
            raise RuntimeError(f"Could not acquire lock: {self.key}")
        return self

    def __exit__(self, *args):
        self.release()

# Usage
with DistributedLock(redis_client, f"order:{order_id}", ttl=30) as lock:
    process_order(order_id)
```

**Redlock với context manager và retry:**

```python
import time
import random

class RetryableDistributedLock:
    def __init__(self, redis_client, key: str, ttl: int = 30,
                 retry_times: int = 3, retry_delay: float = 0.2):
        self.lock = DistributedLock(redis_client, key, ttl)
        self.retry_times = retry_times
        self.retry_delay = retry_delay

    def __enter__(self):
        for attempt in range(self.retry_times):
            if self.lock.acquire():
                return self.lock
            jitter = random.uniform(0, self.retry_delay)
            time.sleep(self.retry_delay * (2 ** attempt) + jitter)

        raise RuntimeError(f"Failed to acquire lock after {self.retry_times} attempts")

    def __exit__(self, *args):
        self.lock.release()
```

**Ưu điểm:**

- ✅ Works across distributed systems (không cần shared DB)
- ✅ Flexible — áp dụng cho bất kỳ resource nào
- ✅ Auto-release với TTL (không bị stuck nếu process crash)
- ✅ Có thể implement retry và backoff

**Nhược điểm:**

- ❌ **Phức tạp** — nhiều failure modes (clock skew, network partition)
- ❌ Redlock có tranh cãi về correctness (Martin Kleppmann vs antirez)
- ❌ Không đảm bảo safety tuyệt đối nếu GC pause > lock TTL
- ❌ Cần nhiều Redis nodes cho safety thực sự
- ❌ Lock không phải substitute cho proper idempotency

**Khi nào dùng:**

- Distributed scheduled jobs / cron
- Critical section không thể concurrent trong multi-instance deployment
- Khi không có shared DB để dùng SELECT FOR UPDATE

**Khi nào KHÔNG dùng:**

- Thay thế hoàn toàn cho idempotency design
- High-throughput operations (bottleneck)
- Khi có thể dùng DB-level locking

> ⚠️ **Lưu ý:** Redlock **không đảm bảo** safety trong mọi failure scenario. Luôn kết hợp với **idempotency check** (xem [idempotency.md]) để có defense in depth.

---

### 5.8 Queue / Serialized Processing

**Cơ chế hoạt động:**

Thay vì xử lý concurrent, đưa tất cả operations vào queue và xử lý **tuần tự**. Race condition không thể xảy ra khi chỉ có 1 worker xử lý 1 resource tại một thời điểm.

**Pattern 1: Global queue (đơn giản):**

```python
from queue import Queue
import threading

order_queue = Queue()

def order_processor():
    while True:
        order = order_queue.get()
        try:
            process_order(order)
        finally:
            order_queue.task_done()

# 1 worker thread duy nhất → không có race condition
worker = threading.Thread(target=order_processor, daemon=True)
worker.start()

# Producers: enqueue thay vì xử lý trực tiếp
def submit_order(order):
    order_queue.put(order)
```

**Pattern 2: Per-resource queue (sharded queue):**

```python
import hashlib
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor

class ShardedQueue:
    def __init__(self, num_shards: int = 16):
        self.queues = [Queue() for _ in range(num_shards)]
        self.executor = ThreadPoolExecutor(max_workers=num_shards)
        for q in self.queues:
            self.executor.submit(self._worker, q)

    def _get_shard(self, resource_key: str) -> int:
        # Same resource key → same queue → serialized processing
        return int(hashlib.md5(resource_key.encode()).hexdigest(), 16) % len(self.queues)

    def submit(self, resource_key: str, task):
        shard = self._get_shard(resource_key)
        self.queues[shard].put(task)

    def _worker(self, queue: Queue):
        while True:
            task = queue.get()
            try:
                task()
            finally:
                queue.task_done()

queue = ShardedQueue(num_shards=16)

# Order cho cùng product_id → cùng shard → serialized
queue.submit(f"product:{product_id}", lambda: reserve_inventory(product_id, qty))
```

**Pattern 3: Database-backed queue với SKIP LOCKED:**

```sql
-- Job queue table
CREATE TABLE job_queue (
    id BIGSERIAL PRIMARY KEY,
    resource_key VARCHAR(255) NOT NULL,
    payload JSONB NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Worker: atomic claim job
BEGIN;
SELECT id, payload
FROM job_queue
WHERE status = 'pending'
  AND resource_key = $1
ORDER BY created_at
LIMIT 1
FOR UPDATE SKIP LOCKED;   -- ← Skip rows locked by other workers

UPDATE job_queue SET status = 'processing' WHERE id = $2;
COMMIT;
```

**Pattern 4: Redis List as queue:**

```python
# Producer
r.rpush("order_queue", json.dumps(order_data))

# Consumer (blocking pop)
def consume_orders():
    while True:
        _, data = r.blpop("order_queue", timeout=5)  # Block up to 5s
        if data:
            order = json.loads(data)
            process_order(order)
```

**Ưu điểm:**

- ✅ **Eliminates race condition completely** cho serialized resource
- ✅ Throughput có thể cao với sharding
- ✅ Natural backpressure
- ✅ Dễ audit và replay

**Nhược điểm:**

- ❌ **Latency tăng** — phải đợi trong queue
- ❌ Không phù hợp cho real-time, synchronous operations
- ❌ Queue trở thành single point of failure (cần HA)
- ❌ Ordering guarantee phức tạp trong distributed queue

**Khi nào dùng:**

- Async processing (không cần response ngay)
- Order processing, payment, email sending
- Batch operations
- Khi có thể accept eventual consistency

**Khi nào KHÔNG dùng:**

- Synchronous API cần response ngay lập tức
- Operations cần sub-second latency
- Khi queue infrastructure chưa có sẵn

---

### 5.9 Actor Model / Message Passing

**Cơ chế hoạt động:**

Mỗi entity (account, order, inventory) là một **Actor** — có mailbox riêng và xử lý message **tuần tự**. Không có shared state giữa actors. Race condition không thể xảy ra vì mỗi actor single-threaded.

```python
# Ví dụ với Python + asyncio (Actor-inspired pattern)
import asyncio
from collections import defaultdict

class AccountActor:
    def __init__(self, account_id: str, initial_balance: float):
        self.account_id = account_id
        self.balance = initial_balance
        self.mailbox = asyncio.Queue()

    async def run(self):
        """Single coroutine xử lý messages tuần tự"""
        while True:
            message = await self.mailbox.get()
            await self._handle(message)
            self.mailbox.task_done()

    async def _handle(self, message: dict):
        if message['type'] == 'debit':
            amount = message['amount']
            future = message['reply_to']
            if self.balance >= amount:
                self.balance -= amount
                future.set_result({'success': True, 'balance': self.balance})
            else:
                future.set_result({'success': False, 'reason': 'insufficient_funds'})

        elif message['type'] == 'credit':
            self.balance += message['amount']
            message['reply_to'].set_result({'success': True})

    async def debit(self, amount: float) -> dict:
        loop = asyncio.get_event_loop()
        future = loop.create_future()
        await self.mailbox.put({
            'type': 'debit',
            'amount': amount,
            'reply_to': future
        })
        return await future

class ActorSystem:
    def __init__(self):
        self.actors = {}

    def get_account(self, account_id: str) -> AccountActor:
        if account_id not in self.actors:
            self.actors[account_id] = AccountActor(account_id, 1000.0)
            asyncio.create_task(self.actors[account_id].run())
        return self.actors[account_id]

# Usage — không có race condition dù concurrent
system = ActorSystem()

async def transfer(from_id: str, to_id: str, amount: float):
    sender = system.get_account(from_id)
    receiver = system.get_account(to_id)

    # Debit sender (serialized within sender actor)
    result = await sender.debit(amount)
    if result['success']:
        await receiver.credit(amount)
```

**Erlang/Elixir (native Actor model):**

```elixir
defmodule AccountServer do
  use GenServer

  # Client API
  def debit(pid, amount), do: GenServer.call(pid, {:debit, amount})

  # Server (single process, serialized message handling)
  def handle_call({:debit, amount}, _from, balance) do
    if balance >= amount do
      {:reply, {:ok, balance - amount}, balance - amount}
    else
      {:reply, {:error, :insufficient_funds}, balance}
    end
  end
end
```

**Ưu điểm:**

- ✅ Race condition **không thể xảy ra** — no shared mutable state
- ✅ Scalable — nhiều actors chạy song song
- ✅ Fault isolation tốt
- ✅ Natural model cho domain objects (Account, Order, Cart)

**Nhược điểm:**

- ❌ Paradigm shift lớn — khó adopt vào codebase hiện tại
- ❌ Cross-actor coordination phức tạp (distributed transactions giữa actors)
- ❌ Actor system cần infrastructure (Akka, Erlang OTP)

**Khi nào dùng:**

- New system design với high concurrency requirement
- Real-time systems (game server, trading, chat)
- Khi dùng Erlang/Elixir/Akka

---

### 5.10 Compare-and-Swap (CAS)

**Cơ chế hoạt động:**

Atomic operation ở hardware/OS level: **kiểm tra giá trị hiện tại và chỉ update nếu khớp** — tất cả trong một instruction không thể bị ngắt.

```python
import threading

class AtomicInteger:
    def __init__(self, value=0):
        self._value = value
        self._lock = threading.Lock()

    def compare_and_swap(self, expected: int, new_value: int) -> bool:
        """Atomic CAS operation"""
        with self._lock:
            if self._value == expected:
                self._value = new_value
                return True
            return False

    def get(self) -> int:
        return self._value

# Usage
counter = AtomicInteger(100)

def safe_decrement(amount: int) -> bool:
    while True:
        current = counter.get()
        if current < amount:
            return False  # Insufficient
        if counter.compare_and_swap(current, current - amount):
            return True   # Success
        # CAS failed → retry (someone else changed it)
```

**Database CAS:**

```sql
-- CAS trong SQL: UPDATE với WHERE trên giá trị cũ
UPDATE inventory
SET
    quantity = :new_quantity,
    updated_at = NOW()
WHERE
    product_id = :product_id
    AND quantity = :expected_quantity;  -- ← CAS check

-- 0 rows affected → CAS failed (giá trị đã thay đổi) → retry
```

**Ưu điểm:**

- ✅ Lock-free — không block
- ✅ Cực kỳ nhanh khi contention thấp
- ✅ Tự nhiên cho counter, flag operations

**Nhược điểm:**

- ❌ **ABA problem:** value A → B → A, CAS không phát hiện được change
- ❌ Spin loop tiêu tốn CPU khi contention cao
- ❌ Chỉ cho single variable/field

**Khi nào dùng:**

- Lock-free data structures
- Counter operations
- Kết hợp với optimistic locking

---

### 5.11 Database Advisory Lock

**Cơ chế hoạt động:**

PostgreSQL cung cấp advisory lock — lock không gắn với row/table mà với một số integer tùy ý. Application tự quản lý ý nghĩa của lock ID.

```python
import hashlib

def get_lock_id(resource: str) -> int:
    """Convert resource string to int lock ID"""
    return int(hashlib.md5(resource.encode()).hexdigest()[:8], 16)

def process_with_advisory_lock(resource: str, operation):
    lock_id = get_lock_id(resource)

    with db.connection() as conn:
        with conn.cursor() as cur:
            # Session-level advisory lock
            cur.execute("SELECT pg_advisory_lock(%s)", (lock_id,))
            try:
                return operation()
            finally:
                cur.execute("SELECT pg_advisory_unlock(%s)", (lock_id,))
```

**Transaction-level advisory lock (tự động release khi transaction end):**

```sql
-- Acquire (block nếu không có)
SELECT pg_advisory_xact_lock(12345);

-- Try acquire (non-blocking, return false nếu không có)
SELECT pg_try_advisory_xact_lock(12345);

-- Tự động release khi transaction commit/rollback
```

**Use case: Job deduplication trong Postgres:**

```python
def run_job_once(job_name: str):
    lock_id = get_lock_id(job_name)

    with db.transaction() as conn:
        # Non-blocking try
        acquired = conn.execute(
            "SELECT pg_try_advisory_xact_lock(%s)",
            (lock_id,)
        ).scalar()

        if not acquired:
            logger.info(f"Job {job_name} already running, skipping")
            return

        # Chỉ 1 instance chạy được đến đây
        execute_job(job_name)
```

**Ưu điểm:**

- ✅ Không cần Redis — dùng Postgres đang có
- ✅ Không gắn với row cụ thể — flexible
- ✅ Auto-release với transaction lock
- ✅ Session lock cho long-running jobs

**Nhược điểm:**

- ❌ PostgreSQL-specific (không phải tất cả DB hỗ trợ)
- ❌ ABA problem: số nguyên lock ID có thể collision
- ❌ Session lock không tự release nếu app crash (phải dùng transaction lock)

**Khi nào dùng:**

- Distributed cron/scheduled job với Postgres
- Per-entity lock khi không muốn thêm Redis
- Long-running background processes

---

### 5.12 Partition / Sharding by Key

**Cơ chế hoạt động:**

Phân chia data/workload theo key sao cho **cùng resource key luôn được xử lý bởi cùng một node/worker**. Race condition không thể xảy ra giữa 2 workers nếu họ không bao giờ xử lý cùng resource.

```python
# Kafka partition: messages cùng key → cùng partition → ordered processing
producer.send(
    topic='order-events',
    key=order_id.encode(),  # ← Cùng order_id → cùng partition
    value=event_data
)

# Consumer: mỗi partition có 1 consumer → serialized cho từng order_id
```

**Sharded worker pool:**

```python
import hashlib

NUM_WORKERS = 16
workers = [asyncio.Queue() for _ in range(NUM_WORKERS)]

def get_worker(resource_key: str) -> asyncio.Queue:
    shard = int(hashlib.md5(resource_key.encode()).hexdigest(), 16) % NUM_WORKERS
    return workers[shard]

# Routing: cùng product_id → cùng worker → không race condition
async def route_update(product_id: str, update_data: dict):
    worker_queue = get_worker(product_id)
    await worker_queue.put((product_id, update_data))
```

**Ưu điểm:**

- ✅ Horizontal scalable
- ✅ Tự nhiên — thiết kế tránh race condition từ architecture
- ✅ Không cần lock
- ✅ Phù hợp với event streaming

**Nhược điểm:**

- ❌ Rebalancing phức tạp khi thêm/bớt workers
- ❌ Hot partition nếu distribution không đều
- ❌ Cross-partition operations phức tạp

**Khi nào dùng:**

- Kafka consumer design
- Stateful stream processing
- Sharded cache/database

---

## 6. So sánh tổng hợp các kỹ thuật

| Kỹ thuật | Phức tạp | Throughput | Cross-service? | Deadlock risk? | Best For |
|---|---|---|---|---|---|
| Pessimistic Lock | 🟢 Thấp | 🔴 Thấp | ❌ | ⚠️ Có thể | Financial, high-contention |
| Optimistic Lock | 🟡 Trung bình | 🟢 Cao | ❌ | ✅ Không | Low-contention update |
| Atomic DB Op | 🟢 Thấp | 🟢 Cao | ❌ | ✅ Không | Counter, simple update |
| Serializable TX | 🟡 Trung bình | 🔴 Thấp | ❌ | ✅ Không | Complex multi-table |
| Redis Atomic | 🟢 Thấp | 🟢 Cao | ✅ | ✅ Không | Counter, rate limit, flag |
| Redis + Lua | 🟡 Trung bình | 🟢 Cao | ✅ | ✅ Không | Complex Redis logic |
| Redlock | 🔴 Cao | 🟡 Trung bình | ✅ | ✅ Không | Distributed cron, cross-service |
| Queue | 🟡 Trung bình | 🟡 Trung bình | ✅ | ✅ Không | Async processing |
| Actor Model | 🔴 Cao | 🟢 Cao | ✅ | ✅ Không | New system design |
| CAS | 🟡 Trung bình | 🟢 Cao | ❌ | ✅ Không | Lock-free counter |
| Advisory Lock | 🟡 Trung bình | 🟢 Cao | ❌ | ⚠️ Có thể | Distributed job (Postgres) |
| Sharding | 🔴 Cao | 🟢 Cao | ✅ | ✅ Không | Event streaming, stateful |

---

## 7. Quyết định chọn kỹ thuật theo use case

```
Bạn đang gặp race condition ở đâu?
│
├─ Counter / số lượng đơn giản (view count, like, inventory++)
│   ├─ Redis available?
│   │   └─ → Redis INCR / DECRBY (atomic, nhanh)
│   └─ Chỉ có DB?
│       └─ → Atomic SQL UPDATE (SET col = col + 1)
│
├─ Financial transaction / Balance transfer
│   └─ → Pessimistic Lock (SELECT FOR UPDATE) + ordered lock để tránh deadlock
│
├─ Inventory reservation (e-commerce, booking, ticket)
│   ├─ Contention thấp (không phải flash sale)
│   │   └─ → Optimistic Lock + retry
│   ├─ Contention cao (flash sale)
│   │   └─ → Redis Lua script hoặc Pessimistic Lock + queue
│   └─ Cần audit trail
│       └─ → Queue + DB Pessimistic Lock
│
├─ API rate limiting
│   └─ → Redis atomic INCR hoặc Redis Lua (token bucket / sliding window)
│
├─ Distributed scheduled job / Cron
│   ├─ Có Postgres?
│   │   └─ → Advisory Lock (pg_try_advisory_xact_lock)
│   └─ Cần cross-database?
│       └─ → Redlock (nhiều Redis nodes) hoặc Redlock + idempotency check
│
├─ Event consumer (Kafka, SQS) duplicate prevention
│   └─ → Kết hợp với Idempotency (xem idempotency.md) + Event ID dedup
│
├─ Cache stampede / Thundering herd
│   └─ → Redis SETNX + Lua hoặc Probabilistic early expiry
│
├─ Complex multi-table operation
│   ├─ Cùng database?
│   │   └─ → Serializable transaction hoặc Pessimistic Lock
│   └─ Cross-service?
│       └─ → Saga pattern + Queue + Idempotency
│
└─ High-throughput real-time system (game, trading, chat)
    └─ → Actor Model hoặc Sharding by key
```

---

## 8. Race Condition trong thực tế — Case Studies

### Case 1: Flash Sale Inventory Oversell

**Vấn đề:** 1000 users đồng thời mua sản phẩm cuối trong flash sale.

```python
# ❌ WRONG: Application-level check
def buy_product(product_id, userId):
    product = Product.get(product_id)
    if product.stock > 0:           # 1000 users cùng pass đây
        product.stock -= 1           # Lost update
        create_order(product_id, userId)
```

**Giải pháp: Redis Lua + async DB write:**

```python
# ✅ CORRECT
RESERVE_LUA = """
local stock_key = KEYS[1]
local qty = tonumber(ARGV[1])
local current = tonumber(redis.call('GET', stock_key) or 0)
if current >= qty then
    redis.call('DECRBY', stock_key, qty)
    return current - qty
else
    return -1
end
"""
reserve_script = redis_client.register_script(RESERVE_LUA)

def buy_product(product_id: int, userId: int) -> dict:
    # Step 1: Atomic reserve in Redis (fast path)
    remaining = reserve_script(
        keys=[f"stock:{product_id}"],
        args=[1]
    )

    if remaining < 0:
        return {"success": False, "reason": "out_of_stock"}

    # Step 2: Async write to DB (slow path, guaranteed stock reserved)
    order_queue.enqueue(create_order_job, product_id, userId)
    return {"success": True}
```

---

### Case 2: Double Debit trong Payment

**Vấn đề:** Network timeout → client retry → 2 payments được tạo.

**Giải pháp: Idempotency Key + Pessimistic Lock:**

```python
def process_payment(idempotency_key: str, account_id: int, amount: float):
    # Layer 1: Idempotency check
    if cached := get_idempotency_cache(idempotency_key):
        return cached

    with db.transaction():
        # Layer 2: Pessimistic lock trên account
        account = Account.query.filter_by(id=account_id).with_for_update().first()

        if account.balance < amount:
            raise InsufficientFundsError()

        account.balance -= amount
        payment = Payment.create(
            account_id=account_id,
            amount=amount,
            idempotency_key=idempotency_key
        )

    result = payment.to_dict()
    set_idempotency_cache(idempotency_key, result, ttl=86400)
    return result
```

---

### Case 3: Cache Stampede khi key expire

**Vấn đề:** Cache expire → 500 requests đồng thời hit DB.

**Giải pháp: Redis SETNX làm "rebuild lock":**

```python
def get_product(product_id: int) -> dict:
    cache_key = f"product:{product_id}"
    lock_key = f"rebuild_lock:{product_id}"

    # Try cache first
    cached = redis.get(cache_key)
    if cached:
        return json.loads(cached)

    # Cache miss: try to acquire rebuild lock
    acquired = redis.set(lock_key, "1", nx=True, ex=10)  # 10s lock

    if acquired:
        # We won the race: rebuild cache
        try:
            product = db.query("SELECT * FROM products WHERE id = %s", product_id).fetchone()
            data = product_to_dict(product)
            redis.setex(cache_key, 300, json.dumps(data))  # Cache 5 phút
            return data
        finally:
            redis.delete(lock_key)
    else:
        # Others are rebuilding: wait and retry
        time.sleep(0.1)
        cached = redis.get(cache_key)
        if cached:
            return json.loads(cached)
        return get_product_from_db(product_id)  # Fallback
```

---

### Case 4: Distributed Cron Job chạy 2 lần

**Vấn đề:** 3 app instances cùng chạy cron gửi invoice lúc 00:00.

**Giải pháp: PostgreSQL Advisory Lock:**

```python
import hashlib
from datetime import date

def send_monthly_invoices():
    today = date.today()
    job_key = f"monthly_invoices:{today.year}:{today.month}"
    lock_id = int(hashlib.md5(job_key.encode()).hexdigest()[:8], 16)

    with db.connection() as conn:
        acquired = conn.execute(
            "SELECT pg_try_advisory_lock(%s)", (lock_id,)
        ).scalar()

        if not acquired:
            logger.info("Invoice job already running on another instance, skipping")
            return

        try:
            logger.info(f"Starting invoice job for {today.year}-{today.month}")
            customers = get_customers_for_billing()
            for customer in customers:
                generate_and_send_invoice(customer)
        finally:
            conn.execute("SELECT pg_advisory_unlock(%s)", (lock_id,))
```

---

## 9. Checklist phòng tránh Race Condition

### Design Phase

- [ ] Xác định tất cả shared resources có thể bị concurrent access
- [ ] Xác định các invariant cần được bảo vệ (balance >= 0, stock >= 0)
- [ ] Chọn kỹ thuật phù hợp với contention level và performance requirement
- [ ] Thiết kế lock ordering để tránh deadlock khi cần multi-resource lock

### Implementation Phase

- [ ] Không dùng Read-Modify-Write ở application layer nếu có thể atomic ở DB
- [ ] Luôn lock multiple resources theo thứ tự nhất quán (sort by ID)
- [ ] Implement retry với exponential backoff cho optimistic locking
- [ ] Test concurrent scenarios — không chỉ sequential
- [ ] Đảm bảo lock luôn được release (try/finally)

### Code Review Checklist

- [ ] Có bất kỳ `SELECT` nào được theo sau bởi `UPDATE` trên cùng data không?
- [ ] Có bất kỳ `if exists: then create` pattern không?
- [ ] Tất cả critical path có idempotency không?
- [ ] Lock có TTL không (tránh stale lock)?
- [ ] Có xử lý OptimisticLockException / serialization failure không?

### Testing

- [ ] Load test với concurrent users trên cùng resource
- [ ] Test với artificial delay giữa READ và WRITE để force race condition
- [ ] Chaos test: kill process giữa chừng, verify state consistency

---

## 10. Các Anti-pattern cần tránh

### ❌ Anti-pattern 1: Read-Modify-Write ở Application Layer

```python
# WRONG
balance = account.get_balance()     # Read
new_balance = balance - amount      # Modify
account.set_balance(new_balance)    # Write — race condition!

# CORRECT: Atomic SQL
db.execute("UPDATE accounts SET balance = balance - %s WHERE id = %s AND balance >= %s",
           (amount, account_id, amount))
```

---

### ❌ Anti-pattern 2: Lock không được release khi có exception

```python
# WRONG
lock.acquire()
process_data()           # Exception here → lock never released!
lock.release()

# CORRECT: Luôn dùng try/finally hoặc context manager
with distributed_lock:
    process_data()       # Lock tự release kể cả khi exception
```

---

### ❌ Anti-pattern 3: Lock nhiều resources không theo thứ tự nhất quán

```python
# WRONG: Deadlock!
# Thread A: lock(account_1) → lock(account_2)
# Thread B: lock(account_2) → lock(account_1)

# CORRECT: Luôn lock theo thứ tự tăng dần của ID
def transfer(from_id, to_id, amount):
    first_id, second_id = sorted([from_id, to_id])
    with lock(first_id):
        with lock(second_id):
            # Safe from deadlock
            do_transfer(from_id, to_id, amount)
```

---

### ❌ Anti-pattern 4: Optimistic Lock retry vô hạn

```python
# WRONG: Có thể spin mãi
while True:
    if try_update():
        break

# CORRECT: Giới hạn retry + exponential backoff
for attempt in range(MAX_RETRIES):
    if try_update():
        return
    time.sleep(0.1 * (2 ** attempt) + random.uniform(0, 0.1))
raise MaxRetriesExceeded()
```

---

### ❌ Anti-pattern 5: Dùng lock nhưng vẫn có race condition

```python
# WRONG: Lock acquire và xử lý không atomic
acquired = redis.setnx("lock:key", "1")   # Acquire
if acquired:
    # Time gap! Process có thể crash ở đây → lock stuck forever
    redis.expire("lock:key", 30)           # Set expiry (separate command!)
    do_work()

# CORRECT: Atomic SET với NX + EX
acquired = redis.set("lock:key", owner_id, nx=True, ex=30)  # Atomic!
```

---

### ❌ Anti-pattern 6: Nhầm lẫn Idempotency và Race Condition Prevention

```
Race condition prevention: Đảm bảo kết quả đúng khi concurrent access
Idempotency:               Đảm bảo kết quả đúng khi duplicate requests

Cần CẢ HAI cho hệ thống robust:
- Distributed lock tránh concurrent processing
- Idempotency key tránh duplicate side effects nếu lock không đủ
```

---

*Race condition là vấn đề xuất hiện từ sự phức tạp của thời gian và concurrency — không có silver bullet. Hiểu rõ bản chất của từng loại race condition và chọn đúng kỹ thuật phù hợp với context là chìa khoá để xây dựng hệ thống đáng tin cậy.*