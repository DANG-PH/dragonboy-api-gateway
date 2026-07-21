# Database Architecture — Tổng quan & Lý do chọn lựa

> **Mục đích tài liệu:** Giải thích từng database được dùng trong hệ thống, tại sao chọn nó cho use case đó, trade-off so với các lựa chọn thay thế, và các lưu ý vận hành quan trọng.

---

## Mục lục

- [Tổng quan](#tổng-quan)
- [1. MySQL — Database nghiệp vụ chính](#1-mysql--database-nghiệp-vụ-chính)
  - [MySQL là gì?](#mysql-là-gì)
  - [Ưu điểm](#ưu-điểm)
  - [Nhược điểm](#nhược-điểm)
  - [Tại sao chọn MySQL cho nghiệp vụ chính?](#tại-sao-chọn-mysql-cho-nghiệp-vụ-chính)
  - [Lưu ý vận hành](#lưu-ý-vận-hành)
- [2. PostgreSQL — Admin Service & Buy Account Saga](#2-postgresql--admin-service--buy-account-saga)
  - [PostgreSQL là gì?](#postgresql-là-gì)
  - [Ưu điểm](#ưu-điểm-1)
  - [Nhược điểm](#nhược-điểm-1)
  - [Tại sao chọn PostgreSQL cho Admin Service?](#tại-sao-chọn-postgresql-cho-admin-service)
  - [Tại sao không dùng PostgreSQL cho tất cả service?](#tại-sao-không-dùng-postgresql-cho-tất-cả-service)
  - [Lưu ý vận hành](#lưu-ý-vận-hành-1)
- [3. Redis — Cache, Lock, Idempotency, Session](#3-redis--cache-lock-idempotency-session)
  - [Redis là gì?](#redis-là-gì)
  - [Ưu điểm](#ưu-điểm-2)
  - [Nhược điểm](#nhược-điểm-2)
  - [Các use case trong hệ thống](#các-use-case-trong-hệ-thống)
  - [Tại sao không dùng Memcached thay Redis?](#tại-sao-không-dùng-memcached-thay-redis)
  - [Lưu ý vận hành](#lưu-ý-vận-hành-2)
- [4. MongoDB — Centralized Log Storage](#4-mongodb--centralized-log-storage)
  - [MongoDB là gì?](#mongodb-là-gì)
  - [Ưu điểm](#ưu-điểm-3)
  - [Nhược điểm](#nhược-điểm-3)
  - [Tại sao chọn MongoDB cho logging?](#tại-sao-chọn-mongodb-cho-logging)
  - [Tại sao không dùng Elasticsearch cho log?](#tại-sao-không-dùng-elasticsearch-cho-log)
  - [Tại sao không dùng Redis cho log?](#tại-sao-không-dùng-redis-cho-log)
  - [Lưu ý vận hành](#lưu-ý-vận-hành-3)
- [5. Tổng hợp — Chọn database theo tính chất dữ liệu](#5-tổng-hợp--chọn-database-theo-tính-chất-dữ-liệu)
- [6. Giải thích thuật ngữ](#6-giải-thích-thuật-ngữ)
  - *Nền tảng:* ACID · Transaction · Schema · RDBMS · NoSQL · InnoDB
  - *Index & Query:* Index · GIN Index · JSONB · Array Type · Full-Text Search · Window Function · EXPLAIN/EXPLAIN ANALYZE · Slow Query Log
  - *Lock & Concurrency:* Race Condition · Pessimistic Lock · Optimistic Lock · Distributed Lock · Advisory Lock · Row-Level Lock · Table-Level Lock · MVCC
  - *Transaction nâng cao:* Transaction Isolation Level · SSI · Savepoint · Phantom Read · Write Skew
  - *Pattern:* Idempotency · Outbox Pattern · Saga · Compensation · Exponential Backoff · Pub/Sub
  - *Vận hành:* Cache · TTL · In-Memory · Replication · Sharding · Connection Pooler · VACUUM · Bloat · Dead Tuple · CREATE INDEX CONCURRENTLY · RDB Snapshot/AOF · Write Concern · Capped Collection · Write-Heavy/Read-Heavy
  - *Extension Postgres:* Extension · PostGIS · pg_trgm · TimescaleDB · LISTEN/NOTIFY
  - *Công nghệ:* Aggregation Pipeline · Winston · gRPC · Microservice

---

## Tổng quan

| Database | Loại | Dùng cho | Service |
|----------|------|----------|---------|
| MySQL | SQL (Relational) | Dữ liệu nghiệp vụ chính | Tất cả service trừ Admin |
| PostgreSQL | SQL (Relational + JSONB) | Nghiệp vụ Admin, Buy Account saga, JSONB | Admin Service |
| Redis | NoSQL (Key-Value, In-Memory) | Cache, distributed lock, idempotency, session | Tất cả service |
| MongoDB | NoSQL (Document) | Log tập trung (Winston logging) | Log Service |

---

## 1. MySQL — Database nghiệp vụ chính

### MySQL là gì?

MySQL là hệ quản trị cơ sở dữ liệu quan hệ (RDBMS) mã nguồn mở, ra đời năm 1995, hiện là một trong những database phổ biến nhất thế giới. Dữ liệu được tổ chức theo bảng với schema cố định, hỗ trợ ACID transaction đầy đủ, và truy vấn bằng SQL chuẩn.

### Ưu điểm

- **Mature & battle-tested:** Hàng tỷ production deployment, ecosystem tools phong phú (Sequelize, TypeORM, Prisma, mysqldump...).
- **ACID transaction:** Đảm bảo tính toàn vẹn dữ liệu cho các thao tác quan trọng như thanh toán, đặt hàng.
- **Hiệu năng đọc cao:** Với index đúng, query SELECT trên hàng chục triệu row vẫn nhanh dưới 10ms.
- **Replication dễ dàng:** Master-Replica setup native, hỗ trợ read scaling tốt.
- **Hosting rẻ và phổ biến:** Hầu hết mọi cloud provider đều có managed MySQL (RDS, Cloud SQL, PlanetScale...).

### Nhược điểm

- **Schema cứng:** Thêm cột trên bảng lớn cần `ALTER TABLE` — tốn thời gian, có thể lock table tùy engine.
- **Không có native JSONB:** Có kiểu `JSON` nhưng không index được bên trong JSON object hiệu quả như PostgreSQL.
- **Horizontal write scaling khó:** Sharding phức tạp, thường cần solution bên ngoài (Vitess, ProxySQL).
- **Full-text search yếu:** Có hỗ trợ nhưng thua Elasticsearch/OpenSearch xa.

### Tại sao chọn MySQL cho nghiệp vụ chính?

Các service như Pay, Auth, Partner đều làm việc với dữ liệu **có cấu trúc rõ ràng, ít thay đổi schema**, và yêu cầu **transaction ACID** (trừ tiền, cộng tiền, cập nhật trạng thái tài khoản). MySQL đáp ứng đủ tất cả yêu cầu này mà không cần phức tạp thêm.

Lý do không chọn PostgreSQL cho các service này: PostgreSQL tốt hơn cho use case phức tạp hơn (xem phần 2), nhưng với Pay/Auth/Partner, MySQL đủ dùng, team quen hơn, và overhead vận hành thấp hơn khi không cần tính năng nâng cao của Postgres.

### Lưu ý vận hành

- Luôn dùng **InnoDB** engine (không dùng MyISAM — không hỗ trợ transaction và foreign key).
- Index trên các cột thường dùng trong `WHERE`, `JOIN`, `ORDER BY` — đặc biệt `status`, `userId`, `created_at`.
- Cẩn thận với `ALTER TABLE` trên bảng lớn — dùng `pt-online-schema-change` hoặc `gh-ost` trong production.
- Enable slow query log (`long_query_time = 1`) để phát hiện query chậm sớm.

---

## 2. PostgreSQL — Admin Service & Buy Account Saga

### PostgreSQL là gì?

PostgreSQL (thường gọi là Postgres) là RDBMS mã nguồn mở mạnh nhất hiện tại, nổi tiếng với sự tuân thủ chuẩn SQL nghiêm ngặt, hệ thống kiểu dữ liệu phong phú, và các tính năng nâng cao như JSONB, full-text search native, array type, window function, và hệ thống extension mạnh (PostGIS, pg_trgm, TimescaleDB...).

### Ưu điểm

- **JSONB — index được bên trong JSON:** Khác với MySQL JSON, JSONB trong Postgres cho phép tạo GIN index trên các trường bên trong JSON object, query `payload->>'key'` nhanh như query cột thường.
- **Transaction mạnh nhất trong SQL:** Hỗ trợ Savepoint, Serializable Isolation Level (SSI) — tránh phantom read, write skew mà không cần lock thủ công.
- **Advanced locking:** Hỗ trợ advisory lock, row-level lock, table-level lock với granularity cao hơn MySQL.
- **Extensible:** Có thể thêm kiểu dữ liệu, function, operator mới. Extension `uuid-ossp`, `pgcrypto` dùng thường xuyên.
- **Concurrent index build:** `CREATE INDEX CONCURRENTLY` không lock table — safe trong production.
- **LISTEN/NOTIFY:** Pub/sub native trong Postgres — có thể dùng thay event emitter trong một số use case.

### Nhược điểm

- **Nặng hơn MySQL ở write-heavy workload đơn giản:** MVCC của Postgres sinh ra dead row, cần `VACUUM` định kỳ.
- **Cấu hình phức tạp hơn:** `shared_buffers`, `work_mem`, `autovacuum` cần tune đúng theo workload.
- **Connection overhead cao hơn:** Postgres tạo một process riêng mỗi connection — cần PgBouncer (connection pooler) nếu có nhiều connection đồng thời.
- **Ecosystem tool hơi ít hơn MySQL** trong cộng đồng Node.js/NestJS (tuy nhiên đã cải thiện nhiều với TypeORM, Prisma).

### Tại sao chọn PostgreSQL cho Admin Service?

Có hai lý do kỹ thuật cụ thể:

**Lý do 1 — JSONB cho payload saga/outbox:**

Outbox event lưu `payload` là JSON tự do (mỗi saga type có payload khác nhau). Với PostgreSQL, có thể:

```sql
-- Query thẳng vào bên trong JSON payload, có index
SELECT * FROM outbox_events
WHERE payload->>'accountId' = '123'
  AND status = 'PENDING';

-- Tạo GIN index trên toàn bộ payload
CREATE INDEX idx_outbox_payload ON outbox_events USING GIN (payload);
```

Với MySQL, `payload` dạng JSON không index được bên trong — phải dùng generated column hoặc pull ra cột riêng, tốn công maintain.

**Lý do 2 — Transaction isolation mạnh hơn cho Buy Account:**

Flow Buy Account cần đảm bảo không có race condition ở nhiều tầng. PostgreSQL hỗ trợ `SERIALIZABLE` isolation level với SSI (Serializable Snapshot Isolation) — phát hiện và abort các transaction có xung đột mà không cần lock thủ công, an toàn hơn MySQL `REPEATABLE READ` trong các tình huống phức tạp.

Ngoài ra, với Admin Service thường có các query phân tích phức tạp (report, aggregate theo nhiều chiều), PostgreSQL xử lý tốt hơn nhờ query planner thông minh hơn và hỗ trợ window function đầy đủ.

### Tại sao không dùng PostgreSQL cho tất cả service?

Không có lý do kỹ thuật bắt buộc phải dùng hai database khác nhau. Lý do thực tế:

- Pay/Auth/Partner đã có MySQL trước, migration tốn công mà không mang lại lợi ích rõ ràng.
- Dùng đúng tool cho đúng job: Admin/Outbox cần JSONB và transaction mạnh → Postgres. Các service còn lại không cần → MySQL đủ dùng.
- Tránh over-engineering: migrate toàn bộ sang Postgres chỉ để thống nhất có thể là premature optimization.

### Lưu ý vận hành

- Setup **PgBouncer** nếu số connection đồng thời lớn (NestJS + microservices dễ tạo nhiều connection).
- Theo dõi **dead tuple ratio** và đảm bảo `autovacuum` chạy đúng — bảng `outbox_events` có write/update/delete liên tục, dễ bloat.
- Dùng `EXPLAIN ANALYZE` (không chỉ `EXPLAIN`) để xem query plan thực tế khi debug slow query.
- GIN index trên JSONB tốn nhiều dung lượng và chậm khi write — cân nhắc chỉ index những field thực sự query.

---

## 3. Redis — Cache, Lock, Idempotency, Session

### Redis là gì?

Redis (Remote Dictionary Server) là in-memory data store hỗ trợ nhiều kiểu dữ liệu (String, Hash, List, Set, Sorted Set, Stream...). Dữ liệu được lưu hoàn toàn trong RAM → latency cực thấp (dưới 1ms với network tốt). Hỗ trợ persistence tùy chọn (RDB snapshot, AOF append-only log) và có thể chạy cluster để scale.

### Ưu điểm

- **Cực nhanh:** Sub-millisecond latency, throughput hàng triệu operations/giây trên một node.
- **Atomic operations:** Tất cả command đều atomic. `SET key value EX 300 NX` là atomic — không thể race condition.
- **TTL native:** Mọi key đều có thể đặt thời gian hết hạn tự động — phù hợp cho cache, lock, session.
- **Đa năng:** Một Redis instance phục vụ được nhiều use case khác nhau cùng lúc.
- **Pub/Sub & Stream:** Hỗ trợ message queue đơn giản khi chưa cần Kafka/RabbitMQ.
- **Lua scripting:** Có thể viết script chạy atomic trên server — dùng cho distributed lock phức tạp hơn.

### Nhược điểm

- **Dữ liệu mất khi thiếu persistence đúng cách:** Nếu không cấu hình AOF/RDB, restart mất hết data.
- **RAM đắt:** Không phù hợp lưu dữ liệu lớn hay dữ liệu không cần tốc độ cao.
- **Không có query phức tạp:** Chỉ truy cập theo key, không có JOIN hay filter phức tạp.
- **Single-threaded (phần lớn):** Một command chậm (ví dụ `KEYS *` trên DB lớn) block toàn bộ server.

### Các use case trong hệ thống

**3.1. Distributed Lock (saga processing)**

```
SET saga:lock:{eventId} 1 EX 300 NX
```

Đảm bảo chỉ một worker xử lý một outbox event tại một thời điểm. `NX` (only if Not eXists) và `EX` (expire) trong cùng một atomic command — không thể có hai worker cùng acquire lock.

**3.2. Idempotency Key (saga done tracking)**

```
SET saga:done:{eventId} 1 EX 86400
GET saga:done:{eventId}  → nếu có → skip
```

Cache kết quả xử lý thành công trong 24h. Ngay cả khi cron job trigger lại, saga sẽ bị skip ngay lập tức trước khi chạm đến DB.

**3.3. Per-step Idempotency (downstream services)**

```
SET idempotency:{outboxEventId}:{stepName} {result} EX 86400
```

Downstream service (Auth, Pay) lưu kết quả của từng bước theo key. Gọi lại nghìn lần với cùng key → chỉ thực hiện một lần thật, các lần sau trả về kết quả đã lưu.

**3.4. Cache (giảm tải DB)**

Các dữ liệu đọc nhiều, thay đổi ít có thể cache trong Redis với TTL phù hợp:

```
GET cache:account:{id}
→ miss → query DB → SET cache:account:{id} {data} EX 300
→ hit  → return ngay, không chạm DB
```

Cần có chiến lược **cache invalidation** rõ ràng: khi account thay đổi trạng thái, phải `DEL cache:account:{id}` hoặc dùng TTL ngắn chấp nhận stale data trong thời gian ngắn.

**3.5. Rate Limiting (nếu cần)**

Redis Sorted Set hoặc sliding window counter dùng để rate limit API:

```
INCR ratelimit:{userId}:{window}
EXPIRE ratelimit:{userId}:{window} 60
```

### Tại sao không dùng Memcached thay Redis?

Memcached chỉ là pure cache (string key-value, không TTL per-field, không persistence, không pub/sub). Redis làm được tất cả những gì Memcached làm, cộng thêm nhiều tính năng khác. Với hệ thống dùng Redis cho cả lock và idempotency, việc dùng thêm Memcached là thừa.

### Lưu ý vận hành

- **Không dùng `KEYS *` trong production** — dùng `SCAN` thay thế (non-blocking).
- Đặt `maxmemory` và policy phù hợp (`allkeys-lru` cho cache thuần, `noeviction` cho lock/idempotency).
- Monitor **keyspace hit rate** — nếu thấp là cache không hiệu quả.
- Với lock: luôn dùng `SET key value EX ttl NX` — không dùng `SETNX` + `EXPIRE` riêng (không atomic).
- Cân nhắc **Redis Sentinel** hoặc **Redis Cluster** khi cần HA — single node Redis là single point of failure.

---

## 4. MongoDB — Centralized Log Storage

### MongoDB là gì?

MongoDB là document database lưu dữ liệu dạng BSON (Binary JSON). Mỗi document là một JSON object tự do, không cần schema cố định. Collection (tương đương table) có thể chứa các document với cấu trúc khác nhau. MongoDB nổi tiếng với khả năng scale horizontal (sharding native), query linh hoạt trên nested document, và aggregation pipeline mạnh.

### Ưu điểm

- **Schema-free:** Log từ các service khác nhau có cấu trúc khác nhau — không cần migration khi thêm field mới vào log.
- **Write throughput cao:** Tối ưu cho insert liên tục, phù hợp với logging workload (write-heavy, read-occasional).
- **Aggregation pipeline mạnh:** Query, filter, group, sort log theo nhiều chiều mà không cần ETL bước trung gian.
- **TTL index native:** Tự động xóa log cũ sau N ngày mà không cần cron job:
  ```javascript
  db.logs.createIndex({ "timestamp": 1 }, { expireAfterSeconds: 2592000 }) // 30 ngày
  ```
- **Horizontal scale dễ:** Sharding theo `timestamp` hoặc `service` để phân tán dữ liệu log lớn.
- **Phù hợp với Winston:** Winston MongoDB transport (`winston-mongodb`) ghi log trực tiếp vào collection, không cần middleware.

### Nhược điểm

- **Không ACID transaction đầy đủ theo truyền thống:** Multi-document transaction chỉ có từ v4.0, và có overhead đáng kể.
- **Không có JOIN:** Phải denormalize data hoặc dùng `$lookup` (chậm hơn SQL JOIN).
- **Tốn RAM:** WiredTiger engine cache nhiều data trong RAM để đạt hiệu năng cao.
- **Không phù hợp cho nghiệp vụ có quan hệ phức tạp:** Foreign key, constraint không được enforce ở DB level.

### Tại sao chọn MongoDB cho logging?

**Log là dữ liệu document thuần túy** — mỗi log entry là một JSON với các trường tự do tùy theo context. Ví dụ:

```json
// Log từ Auth Service
{
  "timestamp": "2025-04-12T10:30:00Z",
  "level": "error",
  "service": "auth-service",
  "message": "Login failed",
  "userId": "u123",
  "ip": "1.2.3.4",
  "attempts": 5
}

// Log từ Pay Service — cấu trúc khác hoàn toàn
{
  "timestamp": "2025-04-12T10:30:01Z",
  "level": "info",
  "service": "pay-service",
  "message": "Payment processed",
  "transactionId": "tx456",
  "amount": 500000,
  "currency": "VND",
  "metadata": { "accountId": "acc789", "sagaId": "saga001" }
}
```

Nếu dùng MySQL/Postgres cho log: phải có schema cố định, hoặc lưu toàn bộ log vào một cột `TEXT`/`JSONB` và mất khả năng index hiệu quả. Nếu mỗi service có bảng log riêng: phải tạo bảng và migrate khi thêm field — không thực tế.

MongoDB cho phép insert bất kỳ JSON nào mà không cần khai báo trước, đồng thời vẫn query được vào bên trong document.

**Winston MongoDB transport** tích hợp trực tiếp:

```typescript
import { createLogger, transports } from 'winston';
import { MongoDB } from 'winston-mongodb';

const logger = createLogger({
  transports: [
    new MongoDB({
      db: process.env.MONGO_URI,
      collection: 'logs',
      level: 'info',
      metaKey: 'meta',
      expireAfterSeconds: 2592000, // tự xóa sau 30 ngày
    }),
  ],
});
```

### Tại sao không dùng Elasticsearch cho log?

Elasticsearch mạnh hơn MongoDB cho full-text search và visualization (với Kibana). Tuy nhiên:

- Elasticsearch nặng hơn đáng kể về resource (RAM, CPU).
- Setup và vận hành phức tạp hơn (cluster, shard, replica, index lifecycle management).
- Với quy mô hiện tại, query log theo `service`, `level`, `timestamp` range là đủ — MongoDB xử lý tốt với index đúng.
- Nếu sau này cần full-text search log hoặc dashboard phức tạp, có thể thêm Elasticsearch hoặc dùng MongoDB Atlas Search (built-in).

### Tại sao không dùng Redis cho log?

Redis quá đắt về RAM cho logging — log có thể tốn hàng GB theo thời gian. Redis phù hợp cho dữ liệu hot, nhỏ, cần tốc độ cao. Log là dữ liệu cold, lớn, chỉ đọc khi debug.

### Lưu ý vận hành

- Luôn tạo **index trên `timestamp` và `service`** — hai trường query phổ biến nhất khi debug.
- Dùng **TTL index** thay vì cron job để tự động expire log cũ — đơn giản và đáng tin cậy hơn.
- Monitor **collection size** — log dễ bùng to nếu level `debug` bị bật trong production.
- Cấu hình **Write Concern** phù hợp: với log, `w: 1` (acknowledge từ primary) là đủ, không cần `w: majority` — tốc độ quan trọng hơn durability tuyệt đối.
- Cân nhắc **capped collection** nếu muốn giới hạn dung lượng cứng thay vì theo thời gian.

---

## 5. Tổng hợp — Chọn database theo tính chất dữ liệu

```
Dữ liệu có cấu trúc, quan hệ rõ ràng, cần ACID?
  ├─→ Cần JSONB / transaction cực mạnh / query phức tạp  →  PostgreSQL
  └─→ Không cần những tính năng trên                     →  MySQL

Dữ liệu cần tốc độ sub-millisecond, sống tạm thời?
  └─→ Redis (cache, lock, idempotency, rate limit)

Dữ liệu document, schema tự do, write-heavy, volume lớn?
  └─→ MongoDB (log, event store, flexible metadata)
```

### Nguyên tắc chung

- **Không có database nào là tốt nhất cho mọi use case.** Mỗi database trong hệ thống này giải quyết một bài toán cụ thể mà database khác giải quyết kém hơn hoặc đắt hơn.
- **Ưu tiên đơn giản:** Chỉ thêm database mới khi có lý do kỹ thuật rõ ràng — không thêm vì "nghe hay" hoặc "phổ biến".
- **Vận hành là chi phí thật:** Mỗi database thêm vào là thêm monitoring, backup, upgrade, on-call. Cân nhắc kỹ trước khi thêm.
- **Dữ liệu quan trọng cần backup độc lập:** MySQL và PostgreSQL cần backup định kỳ (mysqldump, pg_dump hoặc managed backup). Redis và MongoDB cũng cần nếu dữ liệu trong đó là nguồn sự thật duy nhất.

---

*Tài liệu này mô tả trạng thái thiết kế tại thời điểm viết. Cập nhật khi thêm hoặc thay đổi database trong hệ thống.*

---

## 6. Giải thích thuật ngữ

Phần này giải thích các khái niệm kỹ thuật xuất hiện trong tài liệu theo ngôn ngữ đời thường, không cần nền tảng chuyên sâu để hiểu.

---

### ACID

Bốn tính chất mà một database transaction "tốt" phải có. Viết tắt của:

- **Atomicity (Tính nguyên tử):** Transaction hoặc thành công toàn bộ, hoặc thất bại toàn bộ — không có chuyện làm được một nửa rồi dừng. Giống như chuyển tiền ngân hàng: hoặc tiền rời tài khoản A và vào tài khoản B, hoặc không có gì xảy ra cả.
- **Consistency (Tính nhất quán):** Sau khi transaction hoàn thành, dữ liệu phải ở trạng thái hợp lệ theo đúng quy tắc nghiệp vụ (ví dụ: số dư không được âm).
- **Isolation (Tính cô lập):** Hai transaction chạy đồng thời không được ảnh hưởng lẫn nhau — như thể chúng đang chạy tuần tự một mình.
- **Durability (Tính bền vững):** Sau khi transaction commit thành công, dữ liệu không bao giờ bị mất dù server có crash ngay sau đó.

---

### Transaction

Một nhóm các thao tác trên database được thực hiện như một khối thống nhất. Nếu một thao tác trong nhóm thất bại, toàn bộ nhóm bị hủy (rollback) và dữ liệu trở về trạng thái ban đầu.

Ví dụ thực tế: Mua tài khoản cần (1) trừ tiền người mua, (2) cộng tiền người bán, (3) đổi trạng thái tài khoản. Ba thao tác này phải nằm trong một transaction — nếu bước 2 thất bại, bước 1 phải được hoàn tác.

---

### Schema

Bản thiết kế cấu trúc của dữ liệu — định nghĩa có những bảng nào, mỗi bảng có những cột nào, kiểu dữ liệu của từng cột là gì.

- **Schema cứng (SQL):** Phải khai báo trước, mọi dòng dữ liệu phải tuân theo đúng cấu trúc đó. Muốn thêm cột mới phải chạy lệnh `ALTER TABLE`.
- **Schema-free (MongoDB):** Mỗi document có thể có cấu trúc khác nhau, thêm field mới không cần khai báo trước.

---

### Index

Một cấu trúc dữ liệu phụ được database tự động duy trì để tăng tốc độ tìm kiếm. Tương tự như mục lục ở cuối sách — thay vì lật từng trang, bạn tra mục lục để biết thẳng trang cần đọc.

Không có index: database phải đọc toàn bộ bảng để tìm dòng phù hợp (full table scan) — chậm khi bảng lớn.

Có index: database nhảy thẳng đến đúng vị trí — nhanh hơn nhiều lần.

Đánh đổi: index tốn thêm dung lượng đĩa và làm chậm thao tác ghi (vì phải cập nhật cả index).

---

### GIN Index

Viết tắt của *Generalized Inverted Index* — loại index đặc biệt của PostgreSQL dùng để index bên **trong** các kiểu dữ liệu phức tạp như JSONB, array, hay full-text.

Ví dụ thông thường: index giúp tìm nhanh theo cột `status`. GIN index giúp tìm nhanh theo một trường bên trong JSON, ví dụ `payload->>'accountId'` — mà không cần kéo toàn bộ JSON ra so sánh.

---

### JSONB

Kiểu dữ liệu của PostgreSQL để lưu JSON ở dạng **nhị phân đã được parse sẵn** (Binary JSON). Khác với kiểu `JSON` thông thường (lưu nguyên chuỗi text), JSONB cho phép tạo index bên trong và query nhanh hơn nhiều.

Ví von: `JSON` như lưu một tờ giấy viết tay — muốn tìm thông tin phải đọc lại từ đầu mỗi lần. `JSONB` như lưu vào một hộp có ngăn kéo được đánh nhãn — mở đúng ngăn lấy thông tin ngay.

---

### Race Condition

Tình huống xảy ra khi hai hoặc nhiều tiến trình cùng đọc và ghi một dữ liệu đồng thời, dẫn đến kết quả sai vì thứ tự thực thi không được kiểm soát.

Ví dụ: Tài khoản có 100k. Hai người cùng mua lúc 10:00:00.000 — cả hai đều đọc thấy số dư 100k, cả hai đều nghĩ đủ tiền, cả hai đều trừ tiền → số dư thành -100k. Race condition đã xảy ra.

---

### Pessimistic Lock (Khóa bi quan)

Chiến lược xử lý race condition bằng cách **khóa dòng dữ liệu ngay khi đọc**, không cho ai khác đọc/sửa cho đến khi transaction kết thúc.

Gọi là "bi quan" vì nó giả định rằng "chắc chắn sẽ có người khác đến tranh giành" → khóa trước cho an toàn.

Câu lệnh SQL: `SELECT ... FOR UPDATE`.

Đánh đổi: an toàn tuyệt đối nhưng giảm throughput vì các request khác phải chờ.

---

### Optimistic Lock (Khóa lạc quan)

Chiến lược xử lý race condition bằng cách **không khóa khi đọc**, nhưng khi ghi thì kiểm tra xem dữ liệu có bị ai sửa từ lúc mình đọc không.

Thường dùng field `version` — mỗi lần update tăng version lên 1. Khi ghi: `UPDATE ... WHERE version = {version_tôi_đọc}` — nếu version đã thay đổi, update thất bại và phải retry.

Gọi là "lạc quan" vì nó giả định "thường thì không có ai tranh giành đâu" → đọc tự do, chỉ kiểm tra lúc ghi.

---

### Distributed Lock (Khóa phân tán)

Cơ chế khóa hoạt động across nhiều server/process — không phải chỉ trong một process hay một database. Dùng khi có nhiều instance của cùng một service chạy song song (horizontal scaling) và cần đảm bảo chỉ một instance xử lý một tác vụ tại một thời điểm.

Redis thường được dùng làm distributed lock vì tính năng `SET key value NX EX` là atomic và TTL tự động giải phóng lock nếu process bị crash.

---

### Idempotency (Tính lũy đẳng)

Tính chất của một thao tác: **gọi một lần hay gọi nhiều lần đều cho kết quả giống nhau**, không có side effect phụ.

Ví dụ idempotent: Bật đèn đang bật → đèn vẫn bật. Đặt giá trị `x = 5` → dù gọi 1000 lần, x vẫn là 5.

Ví dụ không idempotent: Chuyển tiền 100k → gọi 3 lần sẽ chuyển tổng 300k.

Trong hệ thống này, idempotency key được dùng để đảm bảo saga retry không gây chuyển tiền nhiều lần.

---

### Outbox Pattern

Pattern thiết kế để đảm bảo "gửi event" và "lưu dữ liệu" luôn xảy ra cùng nhau, không bao giờ mất event dù server crash.

Thay vì gửi event ra ngoài trực tiếp sau khi lưu DB (có thể crash giữa chừng), event được ghi vào một bảng `outbox` trong **cùng một transaction** với dữ liệu chính. Một process riêng (cron job) đọc bảng outbox và gửi event sau — nếu crash thì cron chạy lại, event không bao giờ mất.

---

### Saga

Pattern xử lý transaction phân tán (across nhiều service) khi không thể dùng một database transaction thông thường. Một saga là chuỗi các bước nhỏ, mỗi bước là một transaction cục bộ trong một service. Nếu một bước thất bại, các bước đã thực hiện trước đó phải được **hoàn tác (compensate)** theo thứ tự ngược lại.

---

### Compensation (Bù trừ / Hoàn tác)

Hành động "đảo ngược" một bước đã thực hiện trong saga khi có lỗi xảy ra. Không phải rollback (vì transaction đã commit), mà là một thao tác ngược chiều: nếu đã trừ tiền thì compensation là cộng lại tiền, nếu đã đổi email thì compensation là đổi lại email cũ.

---

### Exponential Backoff

Chiến lược retry: mỗi lần thất bại, thời gian chờ trước khi retry tăng theo cấp số nhân thay vì retry liên tục.

Ví dụ: retry 1 sau 30 giây, retry 2 sau 2 phút, retry 3 sau 10 phút.

Lý do: Nếu service bị lỗi do quá tải, retry liên tục sẽ làm tình hình tệ hơn. Backoff cho service thời gian phục hồi, đồng thời giảm áp lực lên hệ thống.

---

### Cache

Lớp lưu trữ tạm thời, nhanh hơn nguồn dữ liệu gốc, dùng để giảm số lần truy cập vào database hoặc tính toán lại kết quả đã biết.

Ví dụ: Thông tin một account thay đổi hiếm khi nhưng được đọc hàng nghìn lần/giây. Lưu vào Redis 5 phút, trong 5 phút đó tất cả request đọc từ Redis thay vì đập vào MySQL.

Đánh đổi: dữ liệu có thể bị "stale" (cũ) trong khoảng TTL.

---

### TTL (Time To Live)

Thời gian sống của một dữ liệu — sau khoảng thời gian này, dữ liệu tự động bị xóa. Dùng phổ biến trong Redis (key hết hạn) và MongoDB (document hết hạn).

Ví dụ: Session đăng nhập TTL 7 ngày, cache TTL 5 phút, idempotency key TTL 24 giờ.

---

### In-Memory

Dữ liệu được lưu trong RAM (bộ nhớ) thay vì đĩa cứng. Truy cập RAM nhanh hơn đĩa cứng khoảng 100.000 lần. Đánh đổi: RAM đắt hơn và dữ liệu mất khi tắt nguồn (nếu không có persistence).

Redis là in-memory database — đây là lý do Redis nhanh hơn MySQL/Postgres nhiều bậc, nhưng không dùng để lưu dữ liệu quan trọng dài hạn mà không có cấu hình persistence.

---

### RDBMS (Relational Database Management System)

Hệ quản trị cơ sở dữ liệu quan hệ — loại database tổ chức dữ liệu thành bảng (table) với hàng (row) và cột (column), và cho phép thiết lập quan hệ giữa các bảng thông qua foreign key. MySQL và PostgreSQL đều là RDBMS.

---

### NoSQL

Thuật ngữ chỉ các database **không** dùng mô hình quan hệ bảng-cột truyền thống. Không có nghĩa là "không dùng SQL" — một số NoSQL vẫn có query language riêng. Bao gồm nhiều loại: Key-Value (Redis), Document (MongoDB), Column-family (Cassandra), Graph (Neo4j).

Thường đánh đổi tính nhất quán mạnh (strong consistency) để lấy hiệu năng cao và khả năng scale ngang dễ hơn.

---

### Write-Heavy / Read-Heavy

Mô tả đặc tính workload của một use case:

- **Write-heavy:** Phần lớn thao tác là ghi dữ liệu mới (INSERT/UPDATE). Ví dụ: logging — mỗi request sinh ra nhiều dòng log.
- **Read-heavy:** Phần lớn thao tác là đọc dữ liệu (SELECT). Ví dụ: trang sản phẩm — hàng nghìn người xem cùng lúc nhưng dữ liệu ít thay đổi.

Biết workload là write-heavy hay read-heavy giúp chọn database phù hợp và thiết kế index/cache đúng chỗ.

---

### Replication

Cơ chế sao chép dữ liệu từ một server database (primary/master) sang một hoặc nhiều server khác (replica/slave) theo thời gian thực.

Mục đích: (1) **High Availability** — nếu primary chết, replica lên thay. (2) **Read Scaling** — đọc từ replica để giảm tải cho primary.

---

### Sharding

Kỹ thuật chia nhỏ dữ liệu ra nhiều server database khác nhau (mỗi phần gọi là một shard) để scale write và lưu trữ theo chiều ngang.

Ví dụ: user có ID chẵn lưu ở server A, ID lẻ lưu ở server B. Mỗi server chỉ chịu tải một nửa.

Đánh đổi: query cross-shard (JOIN giữa hai shard) rất phức tạp và chậm — phải thiết kế cẩn thận.

---

### Aggregation Pipeline

Cơ chế xử lý dữ liệu của MongoDB theo chuỗi các bước (stage) nối tiếp nhau — mỗi stage nhận output của stage trước, xử lý, rồi truyền tiếp. Tương tự với GROUP BY + JOIN + HAVING trong SQL nhưng linh hoạt hơn cho dữ liệu document.

Ví dụ: lấy log → lọc theo service → nhóm theo level → đếm số lượng mỗi nhóm → sắp xếp theo count giảm dần.

---

### Connection Pooler

Phần mềm trung gian đứng giữa application và database, quản lý một "hồ" (pool) các kết nối sẵn có để tái sử dụng.

Vấn đề: Mỗi lần application kết nối đến database tốn thời gian và tài nguyên. Nếu có 1000 request đồng thời, tạo 1000 connection sẽ làm database quá tải (đặc biệt PostgreSQL — mỗi connection là một process riêng).

Giải pháp: PgBouncer (cho Postgres) giữ sẵn 20 connection thật, chia sẻ cho 1000 request luân phiên.

---

### VACUUM (PostgreSQL)

Tiến trình dọn dẹp của PostgreSQL. Do cơ chế MVCC (xem bên dưới), khi update/delete một dòng, dòng cũ không bị xóa ngay mà được đánh dấu "dead". VACUUM đến và dọn dẹp các dead row này, trả lại không gian đĩa.

Nếu VACUUM không chạy đủ thường xuyên, bảng sẽ bị "bloat" (phồng to) dù dữ liệu thực tế ít.

---

### MVCC (Multi-Version Concurrency Control)

Cơ chế PostgreSQL (và một số DB khác) dùng để cho phép nhiều transaction đọc/ghi đồng thời mà không block lẫn nhau: thay vì lock dòng khi đọc, database giữ nhiều phiên bản của cùng một dòng, mỗi transaction thấy phiên bản phù hợp với thời điểm nó bắt đầu.

Kết quả: đọc không block ghi, ghi không block đọc — throughput cao hơn. Đánh đổi: sinh ra dead row, cần VACUUM dọn dẹp.

---

### Winston

Thư viện logging phổ biến trong Node.js/NestJS. Cho phép cấu hình nhiều "transport" (nơi ghi log) đồng thời: console, file, database, HTTP endpoint... Trong hệ thống này dùng `winston-mongodb` transport để ghi log thẳng vào MongoDB.

---

### gRPC

Giao thức giao tiếp giữa các service (Remote Procedure Call) do Google phát triển, dùng Protocol Buffers để serialize dữ liệu thay vì JSON. Nhanh hơn REST/JSON do binary format, có type safety nhờ schema định nghĩa trước, và hỗ trợ streaming hai chiều.

Trong hệ thống này, các service giao tiếp với nhau qua gRPC (AuthService, PayService...).

---

### Microservice

Kiến trúc phần mềm chia ứng dụng thành nhiều service nhỏ, độc lập, mỗi service chịu trách nhiệm một nghiệp vụ cụ thể và có thể deploy/scale riêng lẻ. Ngược với monolith (một khối duy nhất).

Ưu điểm: scale từng phần độc lập, team làm việc song song, lỗi một service không kéo sập toàn bộ hệ thống. Nhược điểm: phức tạp hơn về vận hành, debugging, và quản lý transaction across service.

---

### Advisory Lock (PostgreSQL)

Loại lock "tự nguyện" trong PostgreSQL — khác với row/table lock tự động, advisory lock do **ứng dụng tự quyết định** khi nào khóa và khi nào mở. Database không tự động áp dụng nó vào bất kỳ thao tác nào, nó chỉ là cờ hiệu để các tiến trình khác "tôn trọng" nhau.

Ví dụ thực tế: Trước khi chạy một cron job nặng, ứng dụng acquire advisory lock `pg_advisory_lock(12345)`. Instance thứ hai cũng chạy cron, thấy lock đã có → bỏ qua, không chạy trùng.

```sql
SELECT pg_advisory_lock(12345);   -- acquire, block nếu đã có người giữ
SELECT pg_try_advisory_lock(12345); -- acquire, trả về false ngay nếu đã có (không block)
SELECT pg_advisory_unlock(12345);  -- release
```

Dùng khi: cần mutual exclusion nhẹ giữa các process/instance mà không muốn tạo bảng lock riêng hay dùng Redis.

---

### Row-Level Lock (Khóa cấp hàng)

Lock chỉ áp dụng lên **một dòng cụ thể** trong bảng, không ảnh hưởng đến các dòng khác. Đây là loại lock phổ biến nhất trong transaction thông thường.

```sql
SELECT * FROM accounts WHERE id = 1 FOR UPDATE; -- lock dòng id=1
-- Các dòng id=2, id=3... vẫn đọc/ghi bình thường
```

Ví dụ: 1000 người mua 1000 tài khoản khác nhau đồng thời — mỗi người chỉ lock đúng dòng tài khoản mình mua, không ai block ai.

Đối lập với table-level lock: nếu dùng table lock, cả 1000 người phải xếp hàng chờ nhau dù họ mua tài khoản hoàn toàn khác nhau.

---

### Table-Level Lock (Khóa cấp bảng)

Lock áp dụng lên **toàn bộ bảng** — trong khi lock đang được giữ, không ai khác có thể đọc hoặc ghi bảng đó (tùy mức độ lock).

Thường xảy ra khi: chạy `ALTER TABLE`, `TRUNCATE`, hoặc một số DDL statement. Đây là lý do `ALTER TABLE` trên bảng lớn trong production rất nguy hiểm — nó lock toàn bộ bảng trong suốt quá trình chạy, mọi query vào bảng đó đều bị block.

Giải pháp: dùng `CREATE INDEX CONCURRENTLY` (Postgres) hoặc `pt-online-schema-change` (MySQL) để thực hiện thay đổi mà không cần table lock.

---

### CREATE INDEX CONCURRENTLY (PostgreSQL)

Lệnh tạo index của PostgreSQL mà **không lock table** trong quá trình build. Thay vào đó, Postgres build index song song với các query đang chạy, mất nhiều thời gian hơn nhưng không làm gián đoạn production traffic.

```sql
-- Nguy hiểm trên bảng lớn — lock table suốt quá trình:
CREATE INDEX idx_status ON outbox_events (status);

-- An toàn cho production — không lock table:
CREATE INDEX CONCURRENTLY idx_status ON outbox_events (status);
```

Đánh đổi: chậm hơn khoảng 2-3 lần và không thể chạy trong transaction. Nhưng với bảng production đang có traffic, đây là lựa chọn bắt buộc.

---

### Transaction Isolation Level (Mức độ cô lập transaction)

Quy định mức độ một transaction có thể "thấy" dữ liệu đang được sửa bởi transaction khác đang chạy đồng thời. Có 4 mức từ thấp đến cao:

| Mức | Cho phép đọc dữ liệu chưa commit? | Phantom read? | Dùng khi |
|-----|-----------------------------------|---------------|----------|
| **READ UNCOMMITTED** | Có (dirty read) | Có | Hầu như không dùng |
| **READ COMMITTED** | Không | Có | Default của PostgreSQL |
| **REPEATABLE READ** | Không | Có (MySQL), Không (Postgres) | Default của MySQL |
| **SERIALIZABLE** | Không | Không | Cần đảm bảo tuyệt đối |

- **Dirty read:** Đọc được dữ liệu của transaction khác chưa commit — nguy hiểm vì transaction đó có thể rollback.
- **Phantom read:** Query hai lần trong cùng transaction nhưng kết quả khác nhau vì có dòng mới được insert bởi transaction khác ở giữa.

Mức càng cao càng an toàn nhưng throughput càng giảm vì cần nhiều lock hơn.

---

### SSI — Serializable Snapshot Isolation

Cơ chế của PostgreSQL để thực hiện `SERIALIZABLE` isolation level **mà không cần lock thủ công**. Thay vì khóa trước, SSI theo dõi các "dependency" giữa các transaction đang chạy và abort transaction nào có thể gây ra kết quả không nhất quán.

Nôm na: thay vì "tôi lock hết để không ai đụng vào", SSI nói "cứ chạy đi, nhưng nếu phát hiện hai người đang làm việc có thể xung đột nhau thì một người sẽ bị cancel và phải retry."

Kết quả: throughput cao hơn so với lock-based serializable, nhưng ứng dụng phải sẵn sàng xử lý `serialization failure` và retry.

---

### Savepoint

Một điểm đánh dấu bên trong transaction, cho phép rollback về đúng điểm đó thay vì rollback toàn bộ transaction.

```sql
BEGIN;
  UPDATE accounts SET balance = balance - 100 WHERE id = 1; -- bước 1
  SAVEPOINT before_step2;
  UPDATE accounts SET balance = balance + 100 WHERE id = 2; -- bước 2
  -- Nếu bước 2 lỗi:
  ROLLBACK TO SAVEPOINT before_step2; -- hoàn tác chỉ bước 2, bước 1 vẫn còn
COMMIT;
```

Dùng khi cần xử lý lỗi từng phần trong một transaction dài mà không muốn bỏ hết công việc đã làm.

---

### Phantom Read

Hiện tượng xảy ra khi trong cùng một transaction, bạn chạy cùng một câu query hai lần nhưng lần hai trả về **nhiều dòng hơn** lần một — vì một transaction khác đã INSERT thêm dòng mới ở giữa.

```
Transaction A: SELECT COUNT(*) FROM orders WHERE status = 'PENDING' → 5
Transaction B: INSERT INTO orders (status) VALUES ('PENDING') → commit
Transaction A: SELECT COUNT(*) FROM orders WHERE status = 'PENDING' → 6  ← phantom!
```

Không phải lúc nào cũng là vấn đề, nhưng với các nghiệp vụ tính toán chính xác (kiểm tra tồn kho, giới hạn số lượng...) thì phantom read có thể gây sai lệch.

---

### Write Skew

Dạng race condition tinh vi hơn phantom read: hai transaction đọc cùng dữ liệu, mỗi transaction ra quyết định dựa trên dữ liệu đó, rồi cả hai cùng ghi — kết quả vi phạm một ràng buộc mà nếu chỉ có một transaction chạy thì không xảy ra.

Ví dụ: Quy định "phòng họp phải có ít nhất một người trực". Transaction A và B cùng đọc thấy còn 2 người, cả hai đều nghĩ "vẫn còn người khác trực" và cùng checkout → còn 0 người, vi phạm quy định.

Write skew không thể ngăn bằng row-level lock thông thường vì hai transaction ghi vào các dòng khác nhau. Cần `SERIALIZABLE` isolation hoặc thiết kế lại logic.

---

### Full-Text Search

Khả năng tìm kiếm văn bản theo **nội dung ngữ nghĩa**, không phải chỉ match chính xác chuỗi ký tự. Bao gồm: tách từ (tokenization), bỏ từ dừng (stop words như "và", "là", "the"), stemming (đưa về gốc từ), và ranking theo độ liên quan.

```sql
-- MySQL LIKE: chỉ tìm đúng chuỗi, không có ranking
SELECT * FROM products WHERE name LIKE '%điện thoại%';

-- PostgreSQL full-text search: hiểu ngữ nghĩa, có ranking
SELECT *, ts_rank(search_vector, query) AS rank
FROM products, to_tsquery('điện & thoại') query
WHERE search_vector @@ query
ORDER BY rank DESC;
```

Postgres có full-text search native đủ dùng cho trường hợp đơn giản. Nếu cần tìm kiếm phức tạp hơn (fuzzy search, multi-language, highlight...) thì dùng Elasticsearch.

---

### Array Type (PostgreSQL)

PostgreSQL cho phép một cột lưu **mảng giá trị** thay vì chỉ một giá trị đơn lẻ — và vẫn query, index được trên mảng đó.

```sql
-- Cột tags lưu mảng string
CREATE TABLE articles (
  id INT,
  tags TEXT[]
);

INSERT INTO articles VALUES (1, ARRAY['nodejs', 'database', 'redis']);

-- Tìm bài có tag 'redis'
SELECT * FROM articles WHERE 'redis' = ANY(tags);

-- Tạo GIN index để tìm nhanh
CREATE INDEX idx_tags ON articles USING GIN (tags);
```

Dùng khi: một entity có nhiều giá trị cùng loại (tags, danh sách role, danh sách permission) mà không muốn tạo bảng phụ chỉ để lưu mảng.

---

### Window Function

Hàm SQL cho phép tính toán trên một **tập hợp các dòng liên quan** đến dòng hiện tại, mà **không gộp** (collapse) chúng thành một dòng như GROUP BY.

```sql
-- Xếp hạng doanh thu từng tháng TRONG TỪNG NĂM riêng biệt
SELECT
  year,
  month,
  revenue,
  RANK() OVER (PARTITION BY year ORDER BY revenue DESC) AS rank_in_year
FROM monthly_revenue;
```

Dùng trong báo cáo, phân tích: tính running total, xếp hạng, so sánh với giá trị trước/sau (LAG/LEAD), tính phần trăm trong nhóm...

MySQL hỗ trợ window function từ v8.0, nhưng PostgreSQL hỗ trợ đầy đủ và mạnh hơn.

---

### Extension (PostgreSQL)

Cơ chế mở rộng của PostgreSQL cho phép cài thêm tính năng mới trực tiếp vào database engine — kiểu dữ liệu mới, hàm mới, index mới — mà không cần sửa source code Postgres.

Các extension phổ biến:

| Extension | Dùng để |
|-----------|---------|
| `uuid-ossp` | Sinh UUID theo chuẩn RFC 4122 |
| `pgcrypto` | Mã hóa, hash (bcrypt, AES...) ngay trong DB |
| `pg_trgm` | Tìm kiếm gần đúng (fuzzy search) theo trigram |
| `PostGIS` | Lưu và query dữ liệu địa lý (toạ độ, khoảng cách, polygon) |
| `TimescaleDB` | Tối ưu cho time-series data (IoT, metrics, log có timestamp) |
| `pg_stat_statements` | Theo dõi hiệu năng từng câu query — cần thiết cho tuning |

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
SELECT uuid_generate_v4(); -- → '550e8400-e29b-41d4-a716-446655440000'
```

---

### PostGIS

Extension của PostgreSQL để xử lý **dữ liệu địa lý** (geospatial). Thêm các kiểu dữ liệu như `GEOMETRY`, `GEOGRAPHY` và hàng trăm hàm tính toán không gian: khoảng cách giữa hai điểm, điểm có nằm trong vùng không, tìm các điểm gần nhất...

Dùng khi: hệ thống có tính năng bản đồ, giao hàng theo khu vực, tìm cửa hàng gần nhất, phân tích vùng phủ sóng...

---

### pg_trgm

Extension PostgreSQL cho phép **tìm kiếm gần đúng (fuzzy search)** bằng thuật toán trigram — chia chuỗi thành các nhóm 3 ký tự liên tiếp và so sánh độ tương đồng.

```sql
CREATE EXTENSION pg_trgm;
CREATE INDEX idx_name_trgm ON users USING GIN (name gin_trgm_ops);

-- Tìm tên gần giống "Nguyen Van A" dù gõ sai chính tả
SELECT * FROM users WHERE name % 'Nguyen Van A';
SELECT * FROM users WHERE name ILIKE '%nguyen%'; -- cũng dùng trgm index
```

Dùng khi: cần tìm kiếm tên người dùng, sản phẩm kể cả khi gõ sai chính tả hoặc thiếu dấu.

---

### TimescaleDB

Extension PostgreSQL biến Postgres thành **time-series database** — tối ưu cho dữ liệu có timestamp liên tục (metrics hệ thống, IoT sensor, giá cổ phiếu, log có time...).

Tự động chia dữ liệu thành các "chunk" theo thời gian (ví dụ mỗi chunk là 1 ngày), giúp query theo khoảng thời gian cực nhanh và xóa dữ liệu cũ (data retention) không tốn kém.

Dùng khi: cần lưu metrics hệ thống, alert history, hoặc bất kỳ dữ liệu nào mà câu query chính là "lấy dữ liệu trong khoảng thời gian X đến Y".

---

### LISTEN / NOTIFY (PostgreSQL)

Cơ chế pub/sub **native trong PostgreSQL** — một session có thể LISTEN trên một channel, session khác NOTIFY vào channel đó, và bên lắng nghe nhận được thông báo ngay lập tức.

```sql
-- Bên lắng nghe (ví dụ: một worker process)
LISTEN order_created;

-- Bên phát (ví dụ: sau khi INSERT order)
NOTIFY order_created, '{"orderId": 123}';
```

Không phải message queue thật sự (không có persistence, không retry nếu listener offline), nhưng đủ dùng cho việc trigger nhẹ như: báo cho application biết có dữ liệu mới trong outbox, invalidate cache khi có update...

---

### RDB Snapshot / AOF (Redis Persistence)

Hai cơ chế để Redis lưu dữ liệu xuống đĩa, tránh mất dữ liệu khi restart:

- **RDB (Redis Database Snapshot):** Chụp toàn bộ dataset vào file `.rdb` theo định kỳ (ví dụ: mỗi 5 phút nếu có hơn 100 key thay đổi). Nhanh khi restore, nhưng có thể mất vài phút dữ liệu nếu crash giữa hai lần snapshot.

- **AOF (Append-Only File):** Ghi lại mỗi lệnh write vào file log theo thứ tự. Mất ít dữ liệu hơn (tối đa 1 giây nếu cấu hình `appendfsync everysec`), nhưng file lớn hơn và restore chậm hơn.

Cấu hình phổ biến: dùng cả hai — RDB để backup nhanh, AOF để đảm bảo durability.

---

### Pub/Sub (Publish / Subscribe)

Mô hình giao tiếp bất đồng bộ: **publisher** gửi message vào một channel mà không biết ai nhận, **subscriber** đăng ký nhận message từ channel mà không biết ai gửi. Hai bên hoàn toàn tách rời nhau.

Khác với gọi trực tiếp (A gọi B): A gửi message vào channel "order.created", bất kỳ service nào quan tâm đều subscribe và tự xử lý — A không cần biết có bao nhiêu subscriber.

Redis, PostgreSQL (LISTEN/NOTIFY), RabbitMQ, Kafka đều hỗ trợ pub/sub theo cách khác nhau.

---

### Capped Collection (MongoDB)

Loại collection MongoDB có **kích thước giới hạn cứng** — khi đầy, document mới tự động ghi đè document cũ nhất (hoạt động như circular buffer). Không cần cron job dọn dẹp, không thể xóa document thủ công.

```javascript
db.createCollection("logs", {
  capped: true,
  size: 1073741824, // giới hạn 1GB
  max: 1000000      // hoặc giới hạn 1 triệu document
});
```

Dùng khi: muốn giữ N log gần nhất mà không lo hết đĩa. Đánh đổi: không thể update làm document lớn hơn, không có TTL per-document.

---

### Write Concern (MongoDB)

Cấu hình quy định MongoDB phải **xác nhận đến đâu** trước khi báo write thành công cho client.

| Giá trị | Ý nghĩa | Tốc độ | Độ an toàn |
|---------|---------|--------|-----------|
| `w: 0` | Không chờ xác nhận (fire and forget) | Nhanh nhất | Thấp nhất |
| `w: 1` | Chờ primary ghi xong | Nhanh | Trung bình |
| `w: majority` | Chờ đa số replica ghi xong | Chậm hơn | Cao nhất |

Với log: `w: 1` là đủ — mất một vài log không gây hậu quả nghiêm trọng, đổi lại tốc độ ghi cao hơn.

---

### InnoDB (MySQL)

Storage engine mặc định và được khuyến nghị của MySQL. Hỗ trợ đầy đủ ACID transaction, row-level locking, và foreign key constraint.

Đối lập với **MyISAM** — engine cũ của MySQL, không có transaction, không có foreign key, lock ở table-level. MyISAM nhanh hơn cho read-only workload thuần túy nhưng không phù hợp cho bất kỳ ứng dụng nghiệp vụ nào.

Luôn dùng InnoDB. MyISAM chỉ còn tồn tại vì lý do lịch sử.

---

### EXPLAIN / EXPLAIN ANALYZE (SQL)

Lệnh cho database cho biết **nó sẽ thực thi câu query như thế nào** — dùng index nào, scan bao nhiêu dòng, join theo thứ tự nào...

```sql
-- EXPLAIN: kế hoạch ước tính (không chạy query thật)
EXPLAIN SELECT * FROM orders WHERE userId = 123;

-- EXPLAIN ANALYZE: chạy query thật và so sánh ước tính vs thực tế
EXPLAIN ANALYZE SELECT * FROM orders WHERE userId = 123;
```

Dùng để debug query chậm: xem database có dùng index không, hay đang scan toàn bộ bảng (Seq Scan). Nếu thấy "Seq Scan" trên bảng lớn → cần thêm index.

---

### Slow Query Log

Tính năng của MySQL/PostgreSQL tự động ghi lại các câu query có thời gian thực thi **vượt ngưỡng cấu hình** vào file log.

```sql
-- MySQL: bật slow query log, ghi query chạy hơn 1 giây
SET GLOBAL slow_query_log = 'ON';
SET GLOBAL long_query_time = 1;
```

Là công cụ đầu tiên cần bật trong production để phát hiện performance issue sớm. Kết hợp với `EXPLAIN ANALYZE` để hiểu nguyên nhân và fix.

---

### Bloat (Table/Index Bloat)

Hiện tượng bảng hoặc index trong database **chiếm nhiều dung lượng hơn lượng dữ liệu thực tế** cần thiết, do các dead row (PostgreSQL MVCC) hoặc fragmentation chưa được dọn dẹp.

Ví dụ: Bảng `outbox_events` có 10,000 row đang active nhưng chiếm 500MB do hàng triệu row cũ đã delete nhưng chưa được VACUUM dọn dẹp.

Hậu quả: query chậm hơn (phải scan qua nhiều block trống), tốn đĩa, index kém hiệu quả.

---

### Dead Tuple (PostgreSQL)

Dòng dữ liệu đã bị UPDATE hoặc DELETE nhưng **chưa được xóa vật lý** khỏi đĩa. Do cơ chế MVCC, PostgreSQL giữ lại phiên bản cũ để các transaction đang chạy vẫn có thể đọc được dữ liệu nhất quán tại thời điểm chúng bắt đầu.

Sau khi tất cả transaction cần đến phiên bản cũ đã kết thúc, dead tuple mới có thể bị VACUUM thu hồi.

Theo dõi dead tuple bằng:
```sql
SELECT relname, n_dead_tup, n_live_tup
FROM pg_stat_user_tables
ORDER BY n_dead_tup DESC;
```

---

*Tài liệu này mô tả trạng thái thiết kế tại thời điểm viết. Cập nhật khi thêm hoặc thay đổi database trong hệ thống.*