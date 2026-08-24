# Consistency — Hướng dẫn toàn diện
> Từ lý thuyết đến production patterns cho Backend Developer

---

## Mục lục

1. [Consistency là gì?](#1-consistency-là-gì)
2. [Tại sao Consistency quan trọng?](#2-tại-sao-consistency-quan-trọng)
3. [Các loại Consistency Model](#3-các-loại-consistency-model)
   - [3.1 Strong Consistency (Linearizability)](#31-strong-consistency-linearizability)
   - [3.2 Sequential Consistency](#32-sequential-consistency)
   - [3.3 Causal Consistency](#33-causal-consistency)
   - [3.4 Eventual Consistency](#34-eventual-consistency)
   - [3.5 Read-Your-Writes Consistency](#35-read-your-writes-consistency)
   - [3.6 Monotonic Read Consistency](#36-monotonic-read-consistency)
   - [3.7 Monotonic Write Consistency](#37-monotonic-write-consistency)
   - [3.8 Session Consistency](#38-session-consistency)
   - [3.9 Bounded Staleness](#39-bounded-staleness)
4. [Database Isolation Levels](#4-database-isolation-levels)
   - [4.1 READ UNCOMMITTED](#41-read-uncommitted)
   - [4.2 READ COMMITTED](#42-read-committed)
   - [4.3 REPEATABLE READ](#43-repeatable-read)
   - [4.4 SERIALIZABLE](#44-serializable)
   - [4.5 Bảng so sánh và khi nào dùng](#45-bảng-so-sánh-và-khi-nào-dùng)
5. [CAP Theorem và PACELC](#5-cap-theorem-và-pacelc)
6. [Consistency trong các tầng hệ thống](#6-consistency-trong-các-tầng-hệ-thống)
   - [6.1 Consistency trong Database Replication](#61-consistency-trong-database-replication)
   - [6.2 Consistency trong Cache](#62-consistency-trong-cache)
   - [6.3 Consistency trong Microservices](#63-consistency-trong-microservices)
   - [6.4 Consistency trong Event-Driven System](#64-consistency-trong-event-driven-system)
   - [6.5 Consistency trong Saga Pattern](#65-consistency-trong-saga-pattern)
7. [Các kỹ thuật đảm bảo Consistency](#7-các-kỹ-thuật-đảm-bảo-consistency)
   - [7.1 Two-Phase Commit (2PC)](#71-two-phase-commit-2pc)
   - [7.2 Saga Pattern](#72-saga-pattern)
   - [7.3 Outbox Pattern](#73-outbox-pattern)
   - [7.4 Versioning / Optimistic Locking](#74-versioning--optimistic-locking)
   - [7.5 Pessimistic Locking](#75-pessimistic-locking)
   - [7.6 Kafka Partition Ordering](#76-kafka-partition-ordering)
   - [7.7 Vector Clock](#77-vector-clock)
   - [7.8 CRDT (Conflict-free Replicated Data Type)](#78-crdt-conflict-free-replicated-data-type)
   - [7.9 Read Repair](#79-read-repair)
   - [7.10 Quorum Read / Write](#710-quorum-read--write)
8. [So sánh tổng hợp các kỹ thuật](#8-so-sánh-tổng-hợp-các-kỹ-thuật)
9. [Case Studies thực tế](#9-case-studies-thực-tế)
   - [9.1 Out-of-order Events trong Payment](#91-out-of-order-events-trong-payment)
   - [9.2 Double charge do retry](#92-double-charge-do-retry)
   - [9.3 Stale cache gây hiển thị sai](#93-stale-cache-gây-hiển-thị-sai)
   - [9.4 Replica lag gây mất dữ liệu](#94-replica-lag-gây-mất-dữ-liệu)
   - [9.5 Distributed Saga partial failure](#95-distributed-saga-partial-failure)
10. [Quyết định chọn mức Consistency](#10-quyết-định-chọn-mức-consistency)
11. [Checklist cho Production System](#11-checklist-cho-production-system)
12. [Anti-patterns cần tránh](#12-anti-patterns-cần-tránh)
13. [Mental Models đáng nhớ](#13-mental-models-đáng-nhớ)

---

## 1. Consistency là gì?

**Consistency** trong distributed systems là đảm bảo rằng **tất cả các node, service, hay client đều nhìn thấy cùng một trạng thái dữ liệu đúng** theo một tập rule được định nghĩa trước.

Quan trọng: Consistency **không phải binary** (có/không). Nó là một **spectrum** từ weak đến strong, mỗi mức có trade-off khác nhau về performance, availability và complexity.

```
Weak ◄──────────────────────────────────────────────────► Strong
  │                                                          │
Eventual    Causal    Monotonic    Session    Sequential   Linear
```

### Consistency ≠ Correctness

Nhiều dev nhầm consistency với "data đúng". Thực ra:

- **Correctness**: dữ liệu đúng với business logic (không bao giờ âm, tổng khớp…)
- **Consistency**: các node nhìn thấy dữ liệu **nhất quán với nhau** theo một model nhất định

Một hệ thống có thể eventually consistent nhưng vẫn correct — chỉ là có khoảng thời gian các node thấy khác nhau.

### Khi nào Consistency trở thành vấn đề?

Consistency **không phải vấn đề** với single-node, single-process. Nó xuất hiện khi:

| Tình huống | Lý do |
|---|---|
| Database replication (primary → replica) | Replica lag, sync delay |
| Microservices với DB riêng | Không có shared transaction |
| Async event processing (Kafka, SQS) | Event đến không đúng thứ tự, duplicate |
| Caching layer (Redis, Memcached) | Cache chưa invalidate kịp |
| Multi-region deployment | Network latency giữa regions |
| Concurrent writes từ nhiều client | Race condition |
| Retry sau failure | Có thể apply operation 2 lần |

---

## 2. Tại sao Consistency quan trọng?

### Hậu quả khi thiếu Consistency

**Trong Payment / Fintech:**
- User thấy balance sai → rút tiền không hợp lệ
- Double charge do retry
- Reconciliation lệch cuối ngày

**Trong E-commerce:**
- Oversell inventory (bán hơn số hàng có)
- Order được confirm nhưng stock đã hết
- Giá hiển thị khác giá charge

**Trong Game Economy:**
- Exploit: user thấy số tiền cao hơn thực để mua item
- Duplicate item do event processed 2 lần
- Leaderboard sai

**Trong Healthcare / Critical Systems:**
- Dữ liệu bệnh nhân không nhất quán giữa các node
- Quyết định sai dựa trên stale data

### Chi phí của Consistency

Consistency mạnh hơn đồng nghĩa với:

```
Stronger Consistency
        ↑
        │  → Higher latency (phải wait for ack từ nhiều node)
        │  → Lower throughput (sequential, không parallel)
        │  → Lower availability (nếu node down → không serve)
        │  → Higher infrastructure cost
        │  → More complex implementation
        ↓
Weaker Consistency
        │  → Lower latency
        │  → Higher throughput
        │  → Higher availability
        │  → Simpler implementation
        │  → User có thể thấy stale data
```

**Rule of thumb:** Chọn **đủ strong cho business requirement**, không mạnh hơn cần thiết.

---

## 3. Các loại Consistency Model

### 3.1 Strong Consistency (Linearizability)

**Định nghĩa:** Sau khi write thành công, **mọi read tiếp theo** (từ bất kỳ node nào, bất kỳ thời điểm nào) đều thấy giá trị mới nhất. Toàn bộ hệ thống hành xử như **một single node duy nhất**.

```
Client A: Write X=5  ──────────────────────────────►
Client B:                 Read X → 5 ✅ (guaranteed)
Client C:                      Read X → 5 ✅ (guaranteed)
```

**Đặc điểm kỹ thuật:**
- Mỗi operation có một điểm thời gian duy nhất trong global order
- Không thể phân biệt distributed system với single node từ client perspective
- Yêu cầu coordination giữa tất cả replicas trước khi acknowledge

**Ví dụ thực tế:**
- Google Spanner (TrueTime API)
- etcd (Raft consensus)
- ZooKeeper (ZAB protocol)
- PostgreSQL với synchronous replication

**Ưu điểm:**
- Đơn giản nhất để reason về — không cần nghĩ đến stale data
- Không bao giờ thấy anomaly
- Dễ test, dễ debug

**Nhược điểm:**
- Latency cao nhất (phải wait for quorum)
- Throughput thấp
- Availability giảm khi có network partition
- Khó scale ngang

**Dùng khi:** Distributed locks, leader election, configuration management, financial ledger.

---

### 3.2 Sequential Consistency

**Định nghĩa:** Kết quả của execution giống như tất cả operations được thực thi theo **một thứ tự tuần tự toàn cục** nào đó, và operations của mỗi process xuất hiện **đúng thứ tự** trong sequence đó.

```
Process 1: Write A=1, Write B=2
Process 2: Read B=2, Read A=1   ← VALID
Process 2: Read B=0, Read A=1   ← INVALID (thấy A=1 nghĩa là đã sau Write A=1, phải thấy B=2)
```

**Khác với Linearizability:** Sequential consistency không yêu cầu real-time ordering giữa các process. Chỉ yêu cầu mỗi process thấy operations theo đúng thứ tự của nó.

**Ví dụ thực tế:** Multi-processor shared memory, Java Memory Model (với `volatile`).

**Dùng khi:** Shared memory programming models, multi-threaded systems cần ordering guarantee nhưng không cần real-time.

---

### 3.3 Causal Consistency

**Định nghĩa:** Các operations có **quan hệ nhân quả** (causally related) phải được thấy theo đúng thứ tự nhân quả. Operations không liên quan (concurrent) có thể thấy theo thứ tự khác nhau ở các node khác nhau.

```
A posts "Hello"  →  A edits to "Hello World"
                         ↑ causally related

B phải thấy "Hello" TRƯỚC "Hello World"
C (không liên quan) cũng phải thấy đúng thứ tự
```

**Cách track causality — Vector Clock:**

```
Node 1: {N1: 1, N2: 0}  — Write X=5
Node 2: {N1: 1, N2: 1}  — Read X=5, Write Y=10  (causally after N1's write)
Node 3: nhận Y=10 với timestamp {N1:1, N2:1}
         → biết phải đã thấy X=5 trước khi apply Y=10
```

**Ví dụ thực tế:** MongoDB causal sessions, collaborative editing, chat applications.

**Ưu điểm:**
- Balance giữa strong và eventual
- UX tốt hơn eventual — không thấy "effect before cause"
- Available hơn strong consistency

**Nhược điểm:**
- Cần track causal dependencies (vector clock overhead)
- Phức tạp hơn eventual consistency
- Concurrent writes vẫn có thể gây conflict

**Dùng khi:** Chat applications, comment threads, collaborative apps, social feed với reply chains.

---

### 3.4 Eventual Consistency

**Định nghĩa:** Nếu không có write mới nào, **tất cả replicas sẽ đạt trạng thái nhất quán sau một khoảng thời gian**. Không có guarantee về thời gian bao lâu.

```
Write X=5 tại Node 1
  │
  ├── t=0ms:   Node 1 → X=5 ✅
  ├── t=0ms:   Node 2 → X=3 (stale) ⚠️
  ├── t=50ms:  Node 2 → X=5 ✅ (sync done)
  └── t=100ms: Node 3 → X=5 ✅ (sync done)
```

**Conflict Resolution strategies:**

```
Last-Write-Wins (LWW):  timestamp lớn hơn thắng — đơn giản, có thể mất data
First-Write-Wins:       write đầu tiên thắng
Merge:                  merge cả hai (CRDT, application-level merge)
Custom:                 business logic quyết định
```

**Ví dụ thực tế:** DNS, DynamoDB (default), Cassandra, social media feeds.

**Ưu điểm:** Availability cao nhất, latency thấp, scale tốt  
**Nhược điểm:** User có thể thấy stale data, conflict resolution phức tạp  
**Dùng khi:** Analytics, search index, notification, social feed, product catalog.

---

### 3.5 Read-Your-Writes Consistency

**Định nghĩa:** Sau khi **bạn** write, **bạn** luôn thấy kết quả của write đó khi read. Người khác có thể vẫn thấy giá trị cũ.

```
User A: Write profile_pic = "new.jpg"
User A: Read profile_pic → "new.jpg" ✅ (guaranteed for A)
User B: Read profile_pic → "old.jpg" ⚠️ (may be stale, but ok)
```

**Implementation patterns:**

```javascript
// Option 1: Luôn read from primary (đơn giản, primary bị tải)

// Option 2: Sticky session — route user về replica đã nhận write

// Option 3: Version token
// Sau write → trả về timestamp/version
// Client gửi token theo mọi request tiếp theo
// Server chỉ serve từ replica đã đạt version này

// Option 4: Read from primary chỉ ngay sau write
if (request.hasRecentWrite) readFromPrimary() else readFromReplica()
```

**Dùng khi:** Profile update, settings change, post mới tạo — bất kỳ write nào mà user ngay lập tức muốn thấy kết quả của mình.

---

### 3.6 Monotonic Read Consistency

**Định nghĩa:** Nếu bạn đã thấy một giá trị X tại thời điểm t, **các lần đọc tiếp theo sẽ không trả về giá trị cũ hơn X**.

```
Read X → version 5  ✅
Read X → version 3  ❌ (VIOLATION — không được "lùi")
Read X → version 7  ✅
```

**Vấn đề thực tế:** Xảy ra khi request hit các replica khác nhau với lag khác nhau.

```
Request 1 → Replica A (lag 0ms)   → version 5
Request 2 → Replica B (lag 500ms) → version 3  ← user confuse
```

**Fix:** Sticky session đến cùng một replica, hoặc track version đã thấy.

**Dùng khi:** Feed, timeline, chat history — bất kỳ UI nào mà data "giật lùi" sẽ gây confuse.

---

### 3.7 Monotonic Write Consistency

**Định nghĩa:** Writes của cùng một client được **thực thi đúng thứ tự**. Write 2 không bao giờ được apply trước Write 1.

```
Client: Write X=1, Write X=2, Write X=3
Đảm bảo: cuối cùng X=3, không bao giờ bị lộn thứ tự
```

**Implementation:** Sequence number per client, write log ordering.

**Tại sao cần:** Trong async systems, writes có thể đến replica theo thứ tự khác nhau do network.

---

### 3.8 Session Consistency

**Định nghĩa:** Trong một session, đảm bảo **Read-Your-Writes + Monotonic Read + Monotonic Write**. Khi session mới bắt đầu, không có guarantee.

```
Session 1:
  Write X=5     ✅
  Read X → 5    ✅ (read-your-writes)
  Read X → 5    ✅ (monotonic read)

Session 2 (new login):
  Read X → 3    ⚠️ (ok, session mới, không có guarantee)
```

**Ví dụ thực tế:** DynamoDB sessions, MongoDB causal consistency sessions.

**Dùng khi:** Web applications với user sessions — đây là mức consistency thực tế nhất cho hầu hết web apps.

---

### 3.9 Bounded Staleness

**Định nghĩa:** Dữ liệu có thể stale, nhưng **không quá N giây** hoặc **không quá K versions** phía sau.

```
Bounded by time:    Read luôn thấy data không quá 5 giây cũ
Bounded by version: Read luôn thấy data không quá 10 versions phía sau
```

**Ví dụ thực tế:** Azure Cosmos DB (Bounded Staleness level), CDN với TTL.

**Ưu điểm:** Có SLA cụ thể về staleness — tốt hơn eventual thuần túy cho planning.

**Dùng khi:** Leaderboard (ok stale 10s), product price display (ok stale 30s), read-heavy workloads cần performance.

---

## 4. Database Isolation Levels

Isolation levels là cách DB đảm bảo consistency khi có **concurrent transactions**. Đây là loại consistency quan trọng nhất developer gặp hàng ngày.

### Các anomaly cần ngăn chặn

| Anomaly | Mô tả | Ví dụ |
|---|---|---|
| **Dirty Read** | Đọc data của transaction chưa commit | T1 write X=5, chưa commit; T2 read X=5; T1 rollback → T2 dùng data sai |
| **Non-Repeatable Read** | Đọc cùng row 2 lần, kết quả khác nhau | T1 read X=5; T2 update X=10 commit; T1 read lại → X=10 |
| **Phantom Read** | Query cùng điều kiện 2 lần, số rows khác nhau | T1 SELECT WHERE age>18 → 10 rows; T2 INSERT; T1 SELECT lại → 11 rows |
| **Lost Update** | 2 transaction cùng update, 1 cái mất | T1 và T2 đều read X=5, cùng +1, cùng write → X=6 thay vì 7 |
| **Write Skew** | Mỗi tx đọc dữ liệu hợp lệ nhưng kết hợp lại sai | 2 bác sĩ cùng check "có ít nhất 1 on-call" → cả 2 đều off |

---

### 4.1 READ UNCOMMITTED

**Ngăn:** Không có gì  
**Cho phép:** Dirty read, Non-repeatable read, Phantom read

```sql
SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;

-- T1 (chưa commit)         -- T2
BEGIN;
UPDATE balance = 1000;
                            SELECT balance; -- → 1000 (dirty read!)
ROLLBACK;
                            -- T2 đã dùng data sai!
```

**Thực tế:** Hầu như không bao giờ dùng trong production. Chỉ dùng khi cần approximate count và không quan tâm accuracy.

---

### 4.2 READ COMMITTED

**Ngăn:** Dirty read  
**Cho phép:** Non-repeatable read, Phantom read  
**Default của:** PostgreSQL, Oracle, SQL Server

```sql
-- T1                       -- T2
BEGIN;
UPDATE balance = 1000;
                            SELECT balance; -- → 500 (chưa commit, thấy giá trị cũ ✅)
COMMIT;
                            SELECT balance; -- → 1000 (đã commit, thấy mới)
```

**Dùng khi:** Hầu hết OLTP workloads thông thường, queries đơn giản không cần consistency xuyên suốt cùng transaction.

---

### 4.3 REPEATABLE READ

**Ngăn:** Dirty read, Non-repeatable read  
**Cho phép:** Phantom read (trừ MySQL InnoDB dùng gap lock)  
**Default của:** MySQL InnoDB

```sql
-- T1                          -- T2
BEGIN;
SELECT balance → 500;
                               UPDATE balance = 1000; COMMIT;
SELECT balance → 500; ✅       -- vẫn thấy 500, dù T2 đã commit
COMMIT;
```

**MySQL InnoDB đặc biệt:** Dùng gap lock để ngăn cả phantom read, nên REPEATABLE READ của MySQL gần với SERIALIZABLE.

**Dùng khi:** Reports cần consistent view trong một transaction, financial read calculations.

---

### 4.4 SERIALIZABLE

**Ngăn:** Tất cả anomalies (Dirty read, Non-repeatable read, Phantom read, Write skew)  
**Cách hoạt động:** Transactions thực thi như thể tuần tự hoàn toàn

```sql
SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;

-- T1: check và insert          -- T2: cùng làm
BEGIN;
SELECT COUNT(*) WHERE type='A'; BEGIN;
-- → 0                          SELECT COUNT(*) WHERE type='A';
                                -- → 0
INSERT INTO ... type='A';
                                INSERT INTO ... type='A';
COMMIT; ✅
                                COMMIT; ❌ → SERIALIZATION FAILURE → retry
```

**Ưu điểm:** Không bao giờ có anomaly  
**Nhược điểm:** Throughput thấp, nhiều retry, deadlock nhiều hơn  
**Dùng khi:** Financial transactions quan trọng, seat booking, limited resource allocation.

---

### 4.5 Bảng so sánh và khi nào dùng

| Isolation Level | Dirty Read | Non-Repeatable | Phantom | Write Skew | Performance | Dùng khi |
|---|---|---|---|---|---|---|
| READ UNCOMMITTED | ✅ có | ✅ có | ✅ có | ✅ có | ⭐⭐⭐⭐⭐ | Approximate analytics |
| READ COMMITTED | ❌ không | ✅ có | ✅ có | ✅ có | ⭐⭐⭐⭐ | Default OLTP |
| REPEATABLE READ | ❌ không | ❌ không | ⚠️ | ✅ có | ⭐⭐⭐ | Reports, financial read |
| SERIALIZABLE | ❌ không | ❌ không | ❌ không | ❌ không | ⭐⭐ | Critical transactions |

**Lời khuyên thực tế:**
- **Default:** READ COMMITTED cho 90% trường hợp
- **Financial calculations trong 1 transaction:** REPEATABLE READ
- **Critical booking / allocation:** SERIALIZABLE + retry logic
- **Không dùng READ UNCOMMITTED** trong production (gần như tuyệt đối)

---

## 5. CAP Theorem và PACELC

### CAP Theorem

Trong distributed system khi có **Network Partition** (luôn xảy ra), bạn chỉ có thể chọn **một trong hai**:

```
         Consistency (C)
              /\
             /  \
            /    \
           /      \
          /________\
   Availability (A)  Partition Tolerance (P)
```

| Chọn | Ví dụ | Behavior khi partition |
|---|---|---|
| **CP** | HBase, ZooKeeper, etcd, MongoDB (strong) | Từ chối serve → đảm bảo không stale |
| **AP** | Cassandra, DynamoDB, CouchDB | Tiếp tục serve → có thể trả stale data |
| **CA** | Không thực tế trong distributed | Network partition sẽ xảy ra |

> **Thực tế:** Network partition *sẽ* xảy ra. Câu hỏi thật sự là: **khi partition xảy ra, bạn chọn consistency hay availability?**

### PACELC — mở rộng của CAP

CAP chỉ nói về behavior khi partition. PACELC nói về **cả khi bình thường**:

```
If Partition → chọn Availability (A) hay Consistency (C)?
Else (normal) → chọn Latency (L) hay Consistency (C)?
```

| System | Partition | Normal | Ghi chú |
|---|---|---|---|
| DynamoDB | AP | EL | High availability, low latency, eventual |
| Cassandra | AP | EL | Tunable consistency |
| MongoDB | CP | EC | Strong consistency, higher latency |
| PostgreSQL | CP | EC | ACID, strong |
| Spanner | CP | EC | TrueTime, globally consistent |

**Tại sao PACELC quan trọng hơn CAP:** Partition xảy ra không thường xuyên. Normal operation xảy ra 99.99% thời gian — trade-off latency/consistency mới là quyết định ảnh hưởng đến user experience hàng ngày.

---

## 6. Consistency trong các tầng hệ thống

### 6.1 Consistency trong Database Replication

```
Primary ──write──► [WAL / Binlog]
                        │
              ┌─────────┼─────────┐
              ▼         ▼         ▼
          Replica1   Replica2  Replica3
```

**Synchronous Replication:**
- Primary chờ ít nhất 1 replica acknowledge trước khi trả lời client
- Strong consistency, latency cao hơn
- Nếu replica down → primary có thể bị block (tuỳ config)

```sql
-- PostgreSQL: bắt buộc replica sync trước khi commit
synchronous_standby_names = 'replica1'
synchronous_commit = on
```

**Asynchronous Replication:**
- Primary acknowledge ngay sau khi write vào local
- Replica sync sau (lag thường vài ms đến vài giây)
- Eventual consistency, latency thấp
- Nếu primary crash trước khi replica sync → data loss

**Semi-synchronous (MySQL):**
- Chờ ít nhất 1 replica nhận event, không cần apply
- Balance giữa performance và durability

**Lời khuyên:**
- Production: ít nhất semi-sync hoặc sync cho primary
- Read replicas: async ok nếu application chấp nhận lag
- Luôn monitor replica lag (`pg_stat_replication`, `SHOW SLAVE STATUS`)

---

### 6.2 Consistency trong Cache

Cache là nguồn gốc của rất nhiều consistency bug trong thực tế.

**Cache-aside (Lazy Loading):**
```
Read:  check cache → miss → read DB → update cache → return
Write: update DB → invalidate cache

Vấn đề: race condition giữa invalidate và next read
```

**Write-through:**
```
Write: update DB + update cache (đồng thời)
Ưu: cache luôn fresh
Nhược: write latency cao hơn, cache chứa data không bao giờ được read
```

**Write-behind (Write-back):**
```
Write: update cache → return (async write to DB)
Ưu: write latency cực thấp
Nhược: data loss nếu cache crash
```

**Cache Invalidation Strategies:**

```javascript
// Strategy 1: TTL — đơn giản nhất, stale tối đa TTL giây
await redis.set('user:123', userData, { EX: 300 });

// Strategy 2: Invalidate on write — consistency cao hơn
async function updateUser(userId, data) {
  await db.update(data);
  await redis.del(`user:${userId}`);
}
// Vẫn có race: delete → request đến → cache lại data cũ → stale

// Strategy 3: Version-based key — tránh race condition
async function updateUser(userId, data) {
  const { version } = await db.update(data); // trả về version mới
  await redis.set(`user:${userId}:v${version}`, data);
  await redis.set(`user:${userId}:latest`, version);
}
```

**Cache Stampede (Thundering Herd):**
```
Cache expire → 1000 requests cùng lúc → hit DB → DB quá tải

Fix 1: Mutex lock — chỉ 1 request fetch DB, còn lại chờ
Fix 2: Probabilistic early expiration — tự renew trước khi expire
Fix 3: Background refresh — async renew, luôn có data trong cache
```

---

### 6.3 Consistency trong Microservices

Mỗi service có DB riêng → **không có shared ACID transaction**.

```
Order Service    Payment Service    Inventory Service
     DB               DB                  DB
      │                │                   │
  Không thể dùng ACID transaction xuyên suốt cả 3
```

**Orchestration Saga:**
```
Order Service (orchestrator):
  → gọi Payment Service  → success
  → gọi Inventory Service → fail
  → gọi Payment Service (compensate: refund) → rollback
```

**Choreography Saga:**
```
Order Service:     emit "OrderCreated"
Payment Service:   consume → emit "PaymentDone"
Inventory Service: consume → emit "InventoryReserved"
Order Service:     consume → emit "OrderConfirmed"

Nếu fail → emit failure event → compensate ngược lại
```

---

### 6.4 Consistency trong Event-Driven System

**Delivery semantics:**

| Semantic | Nghĩa | Vấn đề |
|---|---|---|
| **At-most-once** | Gửi một lần, không retry | Có thể mất event |
| **At-least-once** | Retry đến khi ack | Có thể duplicate |
| **Exactly-once** | Đúng một lần | Cực khó, thường là "effectively exactly-once" |

**Effectively exactly-once = At-least-once + Idempotency:**

```javascript
async function handleEvent(event) {
  // Check đã xử lý chưa
  const processed = await db.findOne({ eventId: event.id });
  if (processed) return; // skip duplicate

  // Xử lý và mark processed trong cùng transaction
  await db.transaction(async (tx) => {
    await tx.apply(event.payload);
    await tx.insert('processed_events', { eventId: event.id });
  });
}
```

---

### 6.5 Consistency trong Saga Pattern

Saga thay thế distributed transaction bằng chuỗi local transactions + compensating transactions.

**Consistency guarantee của Saga:**
- Không có ACID isolation giữa các steps
- Có thể có trạng thái trung gian visible (tiền đã trừ nhưng order chưa tạo)
- Eventual consistency — cuối cùng đúng hoặc compensate về trạng thái đúng

**Compensating Transactions phải idempotent:**
```
Forward:    CreateOrder → ChargePayment → ReserveInventory → ShipOrder

Nếu ReserveInventory fail:
Compensate: ReleaseInventory → RefundPayment → CancelOrder

Compensate phải idempotent — có thể retry nhiều lần mà không gây lỗi
```

**Semantic lock** — tránh dirty read trong saga:
```
Khi saga bắt đầu:  đánh dấu record là "PENDING"
User khác thấy PENDING → wait hoặc reject
Khi saga done:     cập nhật "COMPLETED" hoặc "FAILED"
```

---

## 7. Các kỹ thuật đảm bảo Consistency

### 7.1 Two-Phase Commit (2PC)

**Cách hoạt động:**
```
Phase 1 - PREPARE:
  Coordinator → "Bạn có thể commit không?"
  Participant A → "YES, tôi đã lock resources"
  Participant B → "YES, tôi đã lock resources"

Phase 2 - COMMIT / ROLLBACK:
  Tất cả YES → COMMIT
  Bất kỳ NO  → ROLLBACK
```

**Trade-off:**
- ✅ Strong consistency
- ❌ Blocking protocol — coordinator crash ở Phase 2 → participants lock mãi
- ❌ Single point of failure (coordinator)
- ❌ High latency (2 round trips)
- ❌ Không scale tốt

**Dùng khi:** Internal services trong cùng datacenter, XA transactions. Hiếm dùng trong microservices.

---

### 7.2 Saga Pattern

Chuỗi local transactions + compensating transactions thay thế 2PC.

**So sánh 2PC vs Saga:**

| | 2PC | Saga |
|---|---|---|
| Consistency | Strong (ACID) | Eventual |
| Availability | Thấp (blocking) | Cao |
| Isolation | Full | Không có |
| Rollback | Automatic | Manual compensating |
| Scale | Kém | Tốt |

---

### 7.3 Outbox Pattern

**Vấn đề:** Làm sao đảm bảo write DB và publish event là **atomic**?

```javascript
// SAI: crash giữa 2 operations → inconsistency
await db.save(order);
await eventBus.publish('OrderCreated', order); // crash ở đây → event mất
```

**Outbox Pattern:**

```sql
-- Cùng một DB transaction (atomic)
BEGIN;
INSERT INTO orders (id, data) VALUES (...);
INSERT INTO outbox_events (id, type, payload, status)
  VALUES (uuid, 'OrderCreated', {...}, 'PENDING');
COMMIT;
```

```javascript
// Background poller (chạy mỗi 100ms)
const events = await db.query(
  "SELECT * FROM outbox_events WHERE status = 'PENDING' LIMIT 100"
);
for (const event of events) {
  await eventBus.publish(event.type, event.payload);
  await db.update('outbox_events', { status: 'PUBLISHED' }, { id: event.id });
}
```

**Ưu điểm:** Đảm bảo at-least-once delivery, không bao giờ mất event nếu DB không mất  
**Nhược điểm:** Thêm latency (polling interval), outbox table cần cleanup định kỳ  
**Consumer vẫn cần idempotency** — outbox có thể publish duplicate nếu publish thành công nhưng update status fail.

---

### 7.4 Versioning / Optimistic Locking

**Nguyên lý:** Từ chối apply nếu state không đúng như expected. Không lock trước, chỉ validate khi write.

```sql
ALTER TABLE wallet ADD COLUMN version BIGINT DEFAULT 0;

-- Read: balance=100, version=5
-- Write: chỉ apply nếu version vẫn là 5
UPDATE wallet
SET balance = balance - 50, version = version + 1
WHERE userId = 1 AND version = 5;
-- rowCount = 0 → version đã thay đổi → conflict → retry
```

**Với HTTP API (ETag):**
```http
GET /resource/123
← ETag: "v5"

PUT /resource/123
→ If-Match: "v5"
← 200 OK            (version khớp)
← 412 Precondition Failed  (version đã thay đổi)
```

**Retry với exponential backoff + jitter:**

```javascript
async function updateWithRetry(userId, amount, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const { balance, version } = await db.query(
      'SELECT balance, version FROM wallet WHERE userId = $1', [userId]
    );

    const result = await db.query(
      `UPDATE wallet SET balance = $1, version = $2
       WHERE userId = $3 AND version = $4`,
      [balance + amount, version + 1, userId, version]
    );

    if (result.rowCount > 0) return; // success

    // Conflict → retry với backoff
    const delay = Math.min(100 * Math.pow(2, attempt) + Math.random() * 100, 2000);
    await sleep(delay);
  }
  throw new Error('Max retries exceeded — likely high contention');
}
```

**Ưu điểm:** Không lock, high throughput, đơn giản  
**Nhược điểm:** Retry overhead khi conflict cao, không phù hợp high-contention scenarios

---

### 7.5 Pessimistic Locking

**Nguyên lý:** Lock trước, xử lý sau. Đảm bảo không ai khác modify trong khi đang làm việc.

```sql
BEGIN;

-- Lock row cho đến khi transaction kết thúc
SELECT * FROM wallet WHERE userId = 1 FOR UPDATE;

UPDATE wallet SET balance = balance - 50 WHERE userId = 1;

COMMIT; -- Lock released
```

**Variants:**

```sql
FOR UPDATE          -- chặn cả read (FOR SHARE) và write từ transaction khác
FOR SHARE           -- chỉ chặn write, cho phép đọc concurrent
FOR UPDATE NOWAIT   -- fail ngay nếu không lấy được lock
FOR UPDATE SKIP LOCKED  -- bỏ qua rows đang bị lock (dùng cho queue pattern)
```

**Queue Pattern với SKIP LOCKED:**

```sql
-- Worker nhận job, skip job đang được worker khác xử lý
SELECT * FROM jobs
WHERE status = 'PENDING'
ORDER BY created_at
LIMIT 1
FOR UPDATE SKIP LOCKED;
```

**Ưu điểm:** Đảm bảo không conflict, đơn giản với high-contention  
**Nhược điểm:** Deadlock có thể xảy ra, throughput thấp, phải set lock timeout

---

### 7.6 Kafka Partition Ordering

**Nguyên lý:** Kafka đảm bảo ordering **trong một partition**. Gán tất cả events của cùng entity vào cùng partition bằng partition key.

```javascript
// Producer
await producer.send({
  topic: 'wallet-events',
  messages: [{ key: userId.toString(), value: JSON.stringify(event) }]
});
// hash(userId) % numPartitions → chọn partition
// Tất cả events của user-123 → luôn vào partition X → đúng thứ tự
```

**Hot Partition Problem:**
```
1 user tạo hàng chục nghìn events/giây
→ Tất cả vào 1 partition → 1 consumer thread xử lý → bottleneck

Fix: Sub-partition key (userId + eventType, userId + timestamp_bucket)
```

**Consumer Group scaling:**
```
Topic: wallet-events (8 partitions)
Consumer Group: wallet-processor (4 consumers)

Consumer 1: Partition 0, 1
Consumer 2: Partition 2, 3
Consumer 3: Partition 4, 5
Consumer 4: Partition 6, 7
```

**Ưu điểm:** Order "miễn phí" từ infrastructure, scale tốt, throughput cao  
**Nhược điểm:** Cần Kafka infra, hot partition, debug khó

---

### 7.7 Vector Clock

**Nguyên lý:** Track **causality** giữa events. Mỗi node giữ một vector của counters.

```
3 nodes: N1, N2, N3
Format: {N1: x, N2: y, N3: z}

N1 event:    {N1:1, N2:0, N3:0}
N1 → N2:     N2 merge → {N1:1, N2:1, N3:0}
N2 event:    {N1:1, N2:2, N3:0}

Rule: A causally before B nếu A.clock[i] ≤ B.clock[i] cho mọi i
```

**Conflict detection:**
```
A: {N1:1, N2:0} — N1 wrote X=5
B: {N1:0, N2:1} — N2 wrote X=7

Concurrent (không ai before ai) → CONFLICT → cần resolution
```

**Ví dụ thực tế:** Amazon Dynamo, Riak, CRDTs.

---

### 7.8 CRDT (Conflict-free Replicated Data Type)

**Nguyên lý:** Data structure được thiết kế để **tự động merge** mà không cần coordination.

**Điều kiện của merge operation:**
```
Commutative:  merge(A, B) = merge(B, A)
Associative:  merge(merge(A,B),C) = merge(A,merge(B,C))
Idempotent:   merge(A, A) = A
```

**Các loại CRDT phổ biến:**

```javascript
// G-Counter (Grow-only) — chỉ tăng
state = { N1: 5, N2: 3, N3: 7 }
value = sum(state) = 15
merge(A, B) = { Ni: max(A.Ni, B.Ni) } // per node

// PN-Counter — tăng và giảm
// P (increment) và N (decrement), value = sum(P) - sum(N)

// G-Set (Grow-only Set)
merge(A, B) = A ∪ B

// LWW-Register (Last-Write-Wins)
// Mỗi value có timestamp, merge lấy timestamp lớn hơn
```

**Ví dụ thực tế:** Collaborative document editing, shopping cart multi-device sync, distributed counters.

**Ưu điểm:** Không cần coordination, luôn available, tự resolve conflict  
**Nhược điểm:** Không phải bài toán nào cũng model được bằng CRDT

---

### 7.9 Read Repair

**Nguyên lý:** Khi đọc từ nhiều replicas và phát hiện inconsistency, tự động repair replica lạc hậu.

```
Read X từ 3 replicas:
  Replica 1 → X=5 (version 3)
  Replica 2 → X=3 (version 1) ← stale
  Replica 3 → X=5 (version 3)

Kết quả: trả về X=5 (quorum majority)
Background: gửi X=5 đến Replica 2 → sync
```

**Ví dụ thực tế:** Cassandra, Riak.

**Ưu điểm:** Eventual consistency tự heal, không cần manual repair  
**Nhược điểm:** Chỉ repair khi có read — cold data không bao giờ được repair

---

### 7.10 Quorum Read / Write

**Nguyên lý:** Yêu cầu majority của replicas phải agree để đảm bảo consistency.

```
N = tổng số replicas
W = số replicas phải acknowledge write
R = số replicas phải respond cho read

Strong consistency guarantee: R + W > N

Ví dụ N=3:
  W=2, R=2: 2+2=4 > 3 ✅ strong consistency
  W=1, R=1: 1+1=2 < 3 ❌ eventual consistency
  W=3, R=1: 3+1=4 > 3 ✅ strong (write chậm, read nhanh)
  W=1, R=3: 1+3=4 > 3 ✅ strong (write nhanh, read chậm)
```

**Tuning trade-off:**
```
Ưu tiên write performance: W=1, R=N
Ưu tiên read performance:  W=N, R=1
Balance:                   W=N/2+1, R=N/2+1
```

**Ví dụ thực tế:** Cassandra (configurable per query), DynamoDB (strongly consistent reads option), Riak.

---

## 8. So sánh tổng hợp các kỹ thuật

| Kỹ thuật | Consistency | Availability | Latency | Complexity | Scale | Dùng khi |
|---|---|---|---|---|---|---|
| **2PC** | Strong | Thấp | Cao | Trung bình | Kém | Internal, same DC |
| **Saga** | Eventual | Cao | Thấp | Cao | Tốt | Microservices distributed tx |
| **Outbox** | At-least-once | Cao | Thấp | Thấp | Tốt | Đảm bảo publish event |
| **Versioning** | Strong (per entity) | Cao | Thấp | Thấp | Tốt | Payment, game economy |
| **Pessimistic Lock** | Strong | Thấp | Cao | Thấp | Kém | High-contention, short tx |
| **Kafka Partition** | Strong (ordering) | Cao | Thấp | Trung bình | Tốt | High-throughput events |
| **Vector Clock** | Causal | Cao | Thấp | Cao | Tốt | Conflict detection, collab |
| **CRDT** | Eventual (conflict-free) | Cao | Thấp | Cao | Tốt | Collaborative, counters |
| **Read Repair** | Eventual → Strong | Cao | Trung bình | Thấp | Tốt | Cassandra-style systems |
| **Quorum** | Configurable | Configurable | Configurable | Thấp | Tốt | Tunable consistency |

---

## 9. Case Studies thực tế

### 9.1 Out-of-order Events trong Payment

**Tình huống:**
```
balance = 100
Event A (seq=1): -50  → expected: 50
Event B (seq=2): +30  → expected: 80

Event B đến TRƯỚC Event A:
  t=1: 100 + 30 = 130  ← user thấy 130 ❌
  t=2: 130 - 50 = 80   ← eventual correct ✅

Nguy hiểm: user thấy 130, có thể rút tiền, trigger business rule sai
```

**Giải pháp 1 — Versioning (recommended cho hầu hết cases):**

```sql
-- Event B đến (expectedVersion=1, DB version=0)
UPDATE wallet SET balance=130, version=2
WHERE userId=1 AND version=1;
-- 0 rows → reject → retry sau

-- Event A đến (expectedVersion=0)
UPDATE wallet SET balance=50, version=1
WHERE userId=1 AND version=0;
-- 1 row ✅

-- Event B retry (expectedVersion=1, DB version=1)
UPDATE wallet SET balance=80, version=2
WHERE userId=1 AND version=1;
-- 1 row ✅ — balance: 80, user không bao giờ thấy 130
```

**Giải pháp 2 — Kafka Partition (cho high-throughput):**
```javascript
// Tất cả events của user-123 → cùng partition → đúng thứ tự tự nhiên
producer.send({ key: 'user-123', value: eventA }); // đến trước
producer.send({ key: 'user-123', value: eventB }); // đến sau
```

**Giải pháp 3 — Re-sequencing Buffer (khi không được retry):**
```javascript
if (event.seq > state.expectedSeq) {
  buffer[event.seq] = event; // giữ lại, chờ
  return;
}
await apply(event); // xử lý đúng thứ tự
// Drain buffer nếu có events tiếp theo
while (buffer[state.expectedSeq]) {
  await apply(buffer[state.expectedSeq]);
}
```

---

### 9.2 Double charge do retry

**Tình huống:**
```
Client → POST /payment → Service trừ tiền ✅ → Response
Network timeout ❌ → Client không biết → Client retry
Service nhận lần 2 → trừ tiền lần 2 ❌
```

**Giải pháp — Idempotency Key:**

```http
POST /payment
Idempotency-Key: "client-generated-uuid-abc123"
{ "amount": 100 }
```

```javascript
async function processPayment(request) {
  const key = request.headers['idempotency-key'];

  const existing = await db.findOne('payment_requests', { idempotency_key: key });
  if (existing) return existing.response; // trả về cached response

  const result = await chargePayment(request.body);

  await db.insert('payment_requests', {
    idempotency_key: key,
    response: result,
    expires_at: Date.now() + 24 * 3600 * 1000
  });

  return result;
}
```

---

### 9.3 Stale cache gây hiển thị sai

**Tình huống:**
```
Admin ban user → DB updated ✅
User vẫn access → check cache → cache nói "active" → vào được ❌

Hoặc:
User update avatar → DB updated ✅
User refresh → cache miss → load từ cache cũ → avatar cũ ❌
```

**Giải pháp — Invalidate on write + Race condition fix:**

```javascript
async function updateUser(userId, data) {
  const { version } = await db.update('users', data, { where: { id: userId } });

  // Race condition naive: delete → request ngay → cache lại data cũ
  // Fix: version-based key
  await redis.set(`user:${userId}:v${version}`, JSON.stringify(data), { EX: 300 });
  await redis.set(`user:${userId}:latest`, version.toString());
}

async function getUser(userId) {
  const latestVersion = await redis.get(`user:${userId}:latest`);
  if (latestVersion) {
    const cached = await redis.get(`user:${userId}:v${latestVersion}`);
    if (cached) return JSON.parse(cached);
  }
  const user = await db.findById(userId);
  return user;
}
```

---

### 9.4 Replica lag gây mất dữ liệu

**Tình huống:**
```
Primary: Write order #123 ✅
            ↓ (async, chưa sync kịp)
Replica: Order #123 không tồn tại

Load balancer redirect user → Replica
User query order #123 → "Not Found" ❌
User hoảng: "Đơn hàng của tôi đâu?"
```

**Giải pháp — Read-Your-Writes:**

```javascript
async function createOrder(data) {
  const order = await primaryDB.insert(data);

  // Option 1: Đọc từ primary ngay sau write (đơn giản nhất)
  return await primaryDB.findById(order.id);
}

// Option 2: Token-based — cho phép replica read nhưng đủ fresh
async function createOrder(data) {
  const order = await primaryDB.insert(data);
  return {
    order,
    consistencyToken: Date.now() // client gửi theo request tiếp theo
  };
}

async function getOrder(id, consistencyToken) {
  const lag = await getReplicaLag();
  if (consistencyToken && lag > Date.now() - consistencyToken) {
    return await primaryDB.findById(id); // fallback to primary
  }
  return await replicaDB.findById(id);
}
```

---

### 9.5 Distributed Saga partial failure

**Tình huống:**
```
Saga: CreateOrder → ChargePayment → ReserveInventory → SendEmail

Step 1: CreateOrder ✅
Step 2: ChargePayment ✅ (tiền đã bị trừ)
Step 3: ReserveInventory ❌ (hết hàng)

→ Phải compensate: RefundPayment + CancelOrder
→ Nhưng RefundPayment fail do network?
→ Retry? Idempotent không?
```

**Giải pháp — Outbox + Idempotent Compensation:**

```javascript
// Khi saga step fail → ghi compensation vào outbox (atomic với saga state)
await db.transaction(async (tx) => {
  await tx.update('saga_log', { sagaId, step: 'FAILED' });

  // Compensation events → outbox → sẽ retry đến khi thành công
  await tx.insert('outbox_events', {
    type: 'RefundPayment',
    payload: { sagaId, paymentId, amount },
    status: 'PENDING'
  });
  await tx.insert('outbox_events', {
    type: 'CancelOrder',
    payload: { sagaId, orderId },
    status: 'PENDING'
  });
});

// Compensation phải idempotent!
async function refundPayment({ sagaId, paymentId, amount }) {
  const existing = await db.findOne('refunds', { saga_id: sagaId });
  if (existing) return; // idempotent check

  await db.transaction(async (tx) => {
    await tx.update('payments', { status: 'REFUNDED' }, { id: paymentId });
    await tx.insert('refunds', { sagaId, paymentId, amount });
  });
}
```

---

## 10. Quyết định chọn mức Consistency

### Decision Tree

```
User thấy sai data tạm thời có OK không?
│
├── CÓ (analytics, feed, search index, logging)
│    └── Eventual Consistency + Idempotency
│
└── KHÔNG (payment, balance, booking, inventory)
     │
     ├── Single service / single DB?
     │    ├── CÓ → DB Transaction (ACID)
     │    │         Chọn isolation level phù hợp
     │    │
     │    └── KHÔNG (microservices)
     │         │
     │         ├── Cần rollback khi fail?
     │         │    ├── CÓ → Saga + Outbox
     │         │    └── KHÔNG → Versioning + Retry
     │         │
     │         └── Event ordering quan trọng?
     │              ├── CÓ, scale lớn → Kafka Partition
     │              ├── CÓ, scale vừa → Versioning
     │              └── KHÔNG → Idempotency only
     │
     └── Collaborative / multi-device sync?
          └── CRDT hoặc Operational Transform
```

### Quick Reference theo Use Case

| Use Case | Consistency Level | Kỹ thuật khuyến nghị |
|---|---|---|
| **Bank transfer** | Strong | Serializable tx + Saga + Outbox |
| **Payment charge** | Strong | Idempotency key + Versioning |
| **Inventory deduction** | Strong | Pessimistic lock hoặc Versioning |
| **Seat / hotel booking** | Strong | Pessimistic lock + Serializable |
| **Game economy** | Strong (per user) | Versioning + Kafka partition |
| **E-commerce order** | Strong + Eventual | Saga + Outbox |
| **User profile update** | Read-Your-Writes | Write-through cache + primary read |
| **Social media feed** | Eventual | Eventual + Idempotency |
| **Search index** | Eventual | Eventual, lag ok |
| **Analytics / reporting** | Eventual | At-most-once ok |
| **Notification** | At-least-once | Idempotency at consumer |
| **Leaderboard** | Bounded Staleness | Cache với TTL |
| **Collaborative doc** | Causal / CRDT | CRDT, OT |
| **Distributed lock** | Strong (Linearizable) | etcd, ZooKeeper |
| **Config / Feature flag** | Strong | etcd, Consul |

### Cost Matrix

| | Latency | Throughput | Availability | Complexity | Infrastructure |
|---|---|---|---|---|---|
| Strong (Linearizable) | ❌ Cao | ❌ Thấp | ❌ Thấp | ✅ Đơn giản | ❌ Cao |
| Sequential | ❌ Cao | ❌ Thấp | ❌ Thấp | ✅ Đơn giản | ❌ Cao |
| Causal | ✅ Thấp | ✅ Cao | ✅ Cao | ❌ Phức tạp | ⭐ Trung bình |
| Session | ✅ Thấp | ✅ Cao | ✅ Cao | ⭐ Trung bình | ⭐ Trung bình |
| Eventual | ✅ Thấp nhất | ✅ Cao nhất | ✅ Cao nhất | ✅ Đơn giản | ✅ Thấp |

---

## 11. Checklist cho Production System

### Trước khi design

```
[ ] Xác định: user thấy stale data trong X giây có OK không?
[ ] Xác định: event ordering có quan trọng không?
[ ] Xác định: failure mode nào cần rollback?
[ ] Xác định: có nhiều service với DB riêng không?
[ ] Xác định SLA: consistency window cho phép là bao nhiêu?
```

### Database

```
[ ] Chọn đúng isolation level (default READ COMMITTED cho OLTP)
[ ] Pessimistic lock: đã set lock_timeout để tránh chờ vô hạn?
[ ] Optimistic lock: version column được index chưa?
[ ] Replica lag: có monitor pg_stat_replication / SHOW SLAVE STATUS?
[ ] Application có xử lý đúng khi đọc từ replica bị stale không?
```

### Event-Driven

```
[ ] Mỗi event có unique event_id (UUID) chưa?
[ ] Consumer có idempotency check trước khi xử lý không?
[ ] Outbox pattern được dùng thay vì dual-write không?
[ ] Partition key đúng entity chưa (userId, orderId)?
[ ] Consumer lag được monitor chưa?
[ ] Dead Letter Queue được setup chưa?
[ ] DLQ có alert khi có message vào không?
```

### Cache

```
[ ] Cache invalidation strategy được định nghĩa rõ chưa?
[ ] TTL hợp lý (không quá dài → stale, không quá ngắn → stampede)?
[ ] Cache stampede được xử lý (mutex, probabilistic refresh)?
[ ] Race condition giữa invalidate và next read được xử lý chưa?
```

### Saga / Distributed Transaction

```
[ ] Mỗi step có compensating transaction không?
[ ] Compensating transaction idempotent chưa?
[ ] Saga state được persist (không in-memory) chưa?
[ ] Timeout cho mỗi step được set chưa?
[ ] Partial failure scenario đã test chưa?
```

### Observability

```
[ ] Log có: event_id, version, retry_count, saga_id?
[ ] Metric: error rate, retry rate, DLQ depth, replica lag
[ ] Alert: khi DLQ có message, khi replica lag > threshold
[ ] Dashboard: consistency window, event processing delay
```

---

## 12. Anti-patterns cần tránh

### ❌ Anti-pattern 1: Dual-write không atomic

```javascript
// SAI: crash giữa 2 operations → inconsistency
await db.save(order);
await eventBus.publish('OrderCreated', order); // crash → event mất

// ĐÚNG: Outbox — atomic trong cùng DB transaction
await db.transaction(async (tx) => {
  await tx.insert('orders', order);
  await tx.insert('outbox_events', { type: 'OrderCreated', payload: order });
});
```

### ❌ Anti-pattern 2: Redis là source of truth

```javascript
// SAI
await redis.set(`event_processed:${eventId}`, true);
// Redis restart → mất state → event processed lại → bug không detect được

// ĐÚNG
await db.insert('processed_events', { event_id: eventId, processed_at: new Date() });
// Redis chỉ là cache, có thể rebuild từ DB
```

### ❌ Anti-pattern 3: Retry không có backoff + jitter

```javascript
// SAI: retry storm
while (!success) {
  await processEvent(event); // 1000 consumer cùng retry → DB sập
}

// ĐÚNG: Exponential backoff + jitter
for (let attempt = 0; attempt < maxRetries; attempt++) {
  try {
    await processEvent(event);
    break;
  } catch (e) {
    if (attempt === maxRetries - 1) throw e;
    const base = Math.min(1000 * Math.pow(2, attempt), 30000);
    const jitter = Math.random() * base * 0.3;
    await sleep(base + jitter);
  }
}
```

### ❌ Anti-pattern 4: Read từ replica ngay sau write quan trọng

```javascript
// SAI: replica có thể chưa sync
await primaryDB.insert(order);
const savedOrder = await replicaDB.findById(order.id); // Not Found!

// ĐÚNG: Đọc từ primary ngay sau write quan trọng
await primaryDB.insert(order);
const savedOrder = await primaryDB.findById(order.id); // luôn thấy
```

### ❌ Anti-pattern 5: Compensating transaction không idempotent

```javascript
// SAI: retry 2 lần → refund 2 lần
async function refundPayment(paymentId, amount) {
  await chargeService.refund(paymentId, amount); // không check đã refund chưa
}

// ĐÚNG
async function refundPayment(sagaId, paymentId, amount) {
  const existing = await db.findOne('refunds', { saga_id: sagaId });
  if (existing) return; // idempotent

  await db.transaction(async (tx) => {
    await tx.update('payments', { status: 'REFUNDED' }, { id: paymentId });
    await tx.insert('refunds', { sagaId, paymentId, amount });
  });
}
```

### ❌ Anti-pattern 6: Eventual consistency cho financial operations

```javascript
// SAI: balance check từ replica có thể stale → overdraft
const balance = await replicaDB.getBalance(userId);
if (balance >= amount) {
  await deductBalance(userId, amount); // có thể overdraft!
}

// ĐÚNG: Strong consistency cho financial
await db.transaction(async (tx) => {
  const { balance } = await tx.query(
    'SELECT balance FROM wallet WHERE userId = $1 FOR UPDATE', [userId]
  );
  if (balance < amount) throw new InsufficientFundsError();
  await tx.query(
    'UPDATE wallet SET balance = balance - $1 WHERE userId = $2', [amount, userId]
  );
});
```

### ❌ Anti-pattern 7: Assume network timeout = failure

```javascript
// SAI: timeout → assume fail → retry → không biết đã charge chưa
try {
  await paymentService.charge(amount);
} catch (TimeoutError) {
  await paymentService.charge(amount); // có thể double charge!
}

// ĐÚNG: Idempotency key → retry an toàn
const idempotencyKey = generateUUID(); // tạo trước khi gọi
try {
  await paymentService.charge(amount, { idempotencyKey });
} catch (TimeoutError) {
  // Dùng cùng key → server dedup → không double charge
  await retryQueue.push({ action: 'charge', amount, idempotencyKey });
}
```

### ❌ Anti-pattern 8: Không có DLQ

```javascript
// SAI: retry mãi không có giới hạn → consumer stuck
while (true) {
  try {
    await processEvent(event);
    break;
  } catch (e) {
    await sleep(1000); // retry mãi mãi → queue backlog
  }
}

// ĐÚNG: Max retry + DLQ
const MAX_RETRIES = 5;
if (event.retryCount >= MAX_RETRIES) {
  await deadLetterQueue.send(event); // alert, manual investigation
  return;
}
// retry với backoff
```

---

## 13. Mental Models đáng nhớ

### Model 1: Consistency là spectrum, không phải switch

```
Đừng hỏi: "hệ thống của tôi có consistent không?"
Hãy hỏi:  "cần consistent đến mức nào, ở layer nào, với component nào?"

Payment balance:      Strong consistency bắt buộc
Payment notification: Eventual là ok
Profile avatar:       Read-Your-Writes là đủ
Analytics:            Eventual, approximate là ok
```

### Model 2: "Đừng đợi đúng thứ tự — hãy từ chối sai thứ tự"

```
❌ Sai: "Event đến sai thứ tự → tôi đợi event đúng"
         → Phức tạp, buffer memory, có thể kẹt mãi

✅ Đúng: "Event đến sai thứ tự → tôi từ chối apply, để retry"
          → Đơn giản, robust, self-healing
          → Đây chính là versioning pattern
```

### Model 3: Defense in Depth

```
Không bao giờ dựa vào một cơ chế duy nhất:

Layer 1: Kafka partition   → "probably ordered" (best effort infra)
Layer 2: Versioning        → "enforced ordering, reject if wrong"
Layer 3: Idempotency       → "no duplicate processing"
Layer 4: DLQ               → "no event loss"
Layer 5: Monitoring/Alert  → "know when something breaks"
```

### Model 4: Consistency có giá — trade it wisely

```
Mỗi mức consistency mạnh hơn đều tốn:
  → Latency cao hơn
  → Throughput thấp hơn
  → Availability thấp hơn (khi có failure)
  → Infrastructure phức tạp hơn

Chọn đủ mạnh cho business requirement, không hơn.
"Good enough" consistency thường là đúng đáp án.
```

### Model 5: Test câu hỏi nhanh với Product/Stakeholder

> "Nếu user thấy data sai trong **X giây**, hậu quả business là gì?"

- Mất tiền / fraud có thể xảy ra → **Strong consistency bắt buộc**
- User confuse nhưng tự correct → **Bounded staleness** (X giây)
- Không ai chú ý → **Eventual consistency**

### Model 6: Eventual Consistency ≠ Bug

```
Eventual consistency là design choice phù hợp cho nhiều use cases.
DNS tồn tại 30+ năm với eventual consistency.
S3 serve hàng tỉ file mỗi ngày với eventual consistency.

Bug là khi dùng eventual consistency SAI CHỖ:
  ❌ Balance check trước khi deduct
  ❌ Inventory check trước khi sell
  ✅ Social feed, notifications, analytics, search index
```

### Model 7: Every Distributed System Lies

```
Trong distributed system, luôn assume:
  - Network có thể drop packets
  - Clock không đồng bộ (clock skew)
  - Process có thể crash bất cứ lúc nào
  - Message có thể đến duplicate hoặc out-of-order
  - Timeout không có nghĩa là fail (có thể đang xử lý)

Design cho failure, không phải cho happy path.
```

### Model 8: Source of Truth luôn phải là một

```
Chỉ có một nơi là source of truth — thường là DB chính.
Redis, cache, search index... đều là derived data.

Nếu conflict:
  DB > Redis (DB thắng)
  DB > Search Index (DB thắng)
  DB > Message Queue state (DB thắng)

Khi có bug: rebuild từ source of truth, không phải từ derived.
```

---

*Consistency không phải thứ bạn "bật lên" sau khi code xong. Nó phải được thiết kế từ đầu, ở mọi layer. Mỗi quyết định về consistency là trade-off giữa correctness, performance và complexity. Hiểu rõ trade-off đó — đó là dấu hiệu của một backend developer mature.*