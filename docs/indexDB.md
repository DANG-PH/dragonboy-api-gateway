# Database Indexing — Hướng Dẫn Toàn Diện

> Tài liệu này giải thích mọi thứ bạn cần biết về Database Index: từ khái niệm cơ bản, cách hoạt động bên trong, ảnh hưởng đến hiệu năng đọc/ghi, đến các chiến lược thực tiễn cho developer.

---

## Mục Lục

1. [Index là gì?](#1-index-là-gì)
2. [Tại sao cần Index?](#2-tại-sao-cần-index)
3. [Cơ chế hoạt động bên trong](#3-cơ-chế-hoạt-động-bên-trong)
   - 3.1 [B-Tree Index](#31-b-tree-index)
   - 3.2 [Hash Index](#32-hash-index)
   - 3.3 [Bitmap Index](#33-bitmap-index)
   - 3.4 [Full-Text Index](#34-full-text-index)
   - 3.5 [GIN / GiST Index (PostgreSQL)](#35-gin--gist-index-postgresql)
4. [Các loại Index theo mục đích](#4-các-loại-index-theo-mục-đích)
   - 4.1 [Single-Column Index](#41-single-column-index)
   - 4.2 [Composite Index (Multi-Column)](#42-composite-index-multi-column)
   - 4.3 [Unique Index](#43-unique-index)
   - 4.4 [Partial Index (Filtered Index)](#44-partial-index-filtered-index)
   - 4.5 [Covering Index (Index-Only Scan)](#45-covering-index-index-only-scan)
   - 4.6 [Clustered vs Non-Clustered Index](#46-clustered-vs-non-clustered-index)
   - 4.7 [Expression / Functional Index](#47-expression--functional-index)
5. [Ảnh hưởng đến hiệu năng ĐỌC](#5-ảnh-hưởng-đến-hiệu-năng-đọc)
6. [Ảnh hưởng đến hiệu năng GHI](#6-ảnh-hưởng-đến-hiệu-năng-ghi)
7. [Khi nào NÊN dùng Index](#7-khi-nào-nên-dùng-index)
8. [Khi nào KHÔNG NÊN dùng Index](#8-khi-nào-không-nên-dùng-index)
9. [Ví dụ thực tiễn](#9-ví-dụ-thực-tiễn)
   - 9.1 [E-commerce — tìm kiếm sản phẩm](#91-e-commerce--tìm-kiếm-sản-phẩm)
   - 9.2 [SaaS — multi-tenant queries](#92-saas--multi-tenant-queries)
   - 9.3 [Logging / Audit table](#93-logging--audit-table)
   - 9.4 [Social feed — ORDER BY + LIMIT](#94-social-feed--order-by--limit)
10. [EXPLAIN / EXPLAIN ANALYZE — đọc Query Plan](#10-explain--explain-analyze--đọc-query-plan)
11. [Index Bloat và Maintenance](#11-index-bloat-và-maintenance)
12. [Các Anti-pattern phổ biến](#12-các-anti-pattern-phổ-biến)
13. [Index trong các hệ cơ sở dữ liệu phổ biến](#13-index-trong-các-hệ-cơ-sở-dữ-liệu-phổ-biến)
14. [Checklist cho Developer](#14-checklist-cho-developer)
15. [Bảng thuật ngữ (Glossary)](#15-bảng-thuật-ngữ-glossary)
16. [Tóm tắt nhanh](#16-tóm-tắt-nhanh)

---

## 1. Index là gì?

**Index** (chỉ mục) là một cấu trúc dữ liệu phụ, được database engine xây dựng và duy trì song song với bảng chính, nhằm mục đích **tăng tốc độ tìm kiếm dữ liệu**.

Hãy tưởng tượng bảng dữ liệu như một cuốn sách dày 1.000 trang. Nếu không có mục lục (index), bạn phải lật từng trang để tìm thông tin. Với mục lục, bạn tra ngay trang cần đến.

```
Bảng users (1,000,000 rows)
┌────┬──────────────┬───────────────────────┬──────────┐
│ id │ name         │ email                 │ city     │
├────┼──────────────┼───────────────────────┼──────────┤
│  1 │ Nguyen Van A │ a@example.com         │ HCM      │
│  2 │ Tran Thi B   │ b@example.com         │ HN       │
│ .. │ ...          │ ...                   │ ...      │
└────┴──────────────┴───────────────────────┴──────────┘

-- Không có index:
SELECT * FROM users WHERE email = 'x@example.com';
-- Phai scan toan bo 1,000,000 rows

-- Co index tren email:
-- Nhay thang den row can tim trong vai microsecond
```

---

## 2. Tại sao cần Index?

Khi database thực thi một câu query, nó cần tìm đúng rows thỏa điều kiện. Có hai cách:

| Cách | Tên gọi | Độ phức tạp | Khi nào xảy ra |
|------|---------|-------------|----------------|
| Đọc toàn bộ bảng | Full Table Scan / Sequential Scan | O(n) | Không có index phù hợp |
| Dùng index để nhảy thẳng | Index Scan / Index Seek | O(log n) | Có index phù hợp |

Với bảng 10 triệu rows:
- Full scan: đọc 10,000,000 rows
- B-Tree index: chỉ cần ~24 bước (`log₂(10,000,000) ≈ 23.25`)

---

## 3. Cơ chế hoạt động bên trong

### 3.1 B-Tree Index

Đây là loại index **mặc định** và phổ biến nhất trong PostgreSQL, MySQL, SQL Server, Oracle.

**Cấu trúc:**
```
                    [Root Node]
                    [50 | 100]
                   /     |     \
          [10|30]      [70|90]      [120|150]
          /  |  \      /  |  \       /   |   \
        [5] [20] [40] [60] [80] [95] [110] [130] [200]
         |   |    |    |    |    |     |     |     |
       heap heap heap heap heap heap  heap  heap  heap
       page page page page page page  page  page  page
```

- Mỗi node là một **page** (thường 8KB hoặc 16KB).
- Các leaf node chứa **key** và **pointer** (CTID/RID) trỏ đến row thực trong heap.
- Cây luôn **cân bằng** — mọi leaf đều cùng depth.
- Hỗ trợ: `=`, `<`, `>`, `<=`, `>=`, `BETWEEN`, `LIKE 'abc%'`.
- Không hỗ trợ: `LIKE '%abc'` (leading wildcard).

**B-Tree Leaf node (PostgreSQL):**
```
Leaf Page:
┌──────────────────────────────────────────┐
│ key: 'alice@gmail.com' → (page=42, row=5)│
│ key: 'bob@yahoo.com'   → (page=17, row=2)│
│ key: 'carol@mail.com'  → (page=88, row=1)│
│ next_leaf_page → ...                     │  <- linked list
└──────────────────────────────────────────┘
```

Leaf nodes được nối thành **linked list** → hỗ trợ range scan hiệu quả.

---

### 3.2 Hash Index

```sql
-- PostgreSQL
CREATE INDEX idx_users_email_hash ON users USING HASH (email);
```

**Cơ chế:** Tính `hash(key)` → ánh xạ vào bucket → lưu pointer đến row.

```
hash('alice@gmail.com') = 0x3F2A → bucket 12 → [row pointers]
hash('bob@yahoo.com')   = 0x8B4C → bucket 47 → [row pointers]
```

| Ưu điểm | Nhược điểm |
|---------|-----------|
| Lookup `=` cực nhanh O(1) | Không hỗ trợ range query (`>`, `<`, `BETWEEN`) |
| Index nhỏ hơn B-Tree | Không hỗ trợ ORDER BY |
| | Có thể xảy ra collision |

**Dùng khi:** cột chỉ query bằng `=` và giá trị phân tán đều (UUID, token).

---

### 3.3 Bitmap Index

Phổ biến trong Oracle và data warehouse. Mỗi giá trị distinct tạo ra một **bitmap** (dãy bit).

```
Cột gender với values: M, F

Index:
M: 1 0 1 0 0 1 1 0 ...  (bit 1 = row có gender='M')
F: 0 1 0 1 1 0 0 1 ...

Query: WHERE gender = 'M' AND city = 'HCM'
→ AND hai bitmap lại bằng bitwise operation → rất nhanh
```

**Dùng khi:** cột có **cardinality thấp** (ít giá trị distinct), trong OLAP/reporting.
**Tránh dùng trong OLTP** vì update rất tốn kém (lock cả bitmap).

---

### 3.4 Full-Text Index

```sql
-- PostgreSQL
CREATE INDEX idx_articles_fts ON articles USING GIN (to_tsvector('english', content));

-- MySQL
CREATE FULLTEXT INDEX idx_articles_content ON articles (title, content);
```

- Tách văn bản thành **tokens** (từ).
- Xây dựng **inverted index**: `word → [doc_id, position]`.
- Hỗ trợ: stemming, stop words, ranking theo relevance.

```
"database indexing guide" →
  database: [doc1:pos1, doc5:pos3]
  indexing:  [doc1:pos2, doc3:pos1]
  guide:     [doc1:pos3, doc7:pos2]
```

---

### 3.5 GIN / GiST Index (PostgreSQL)

| Loại | Dùng cho | Ví dụ |
|------|----------|-------|
| GIN (Generalized Inverted Index) | Array, JSONB, Full-text | `tags @> ARRAY['python']` |
| GiST (Generalized Search Tree) | Geometry, range, nearest-neighbor | PostGIS, ip range |

```sql
-- Index cho JSONB
CREATE INDEX idx_orders_meta ON orders USING GIN (metadata);

-- Query tận dụng GIN index
SELECT * FROM orders WHERE metadata @> '{"status": "paid"}';

-- Index cho PostGIS
CREATE INDEX idx_locations_geo ON locations USING GIST (geom);
SELECT * FROM locations WHERE ST_DWithin(geom, ST_Point(106.7, 10.8), 1000);
```

---

## 4. Các loại Index theo mục đích

### 4.1 Single-Column Index

```sql
CREATE INDEX idx_users_email ON users (email);
CREATE INDEX idx_orders_created_at ON orders (created_at);
```

Đơn giản nhất. Hiệu quả khi query filter trên đúng 1 cột.

---

### 4.2 Composite Index (Multi-Column)

```sql
CREATE INDEX idx_orders_user_status ON orders (userId, status);
```

**Quy tắc quan trọng — Leftmost Prefix Rule:**

Index `(A, B, C)` có thể được dùng cho:
- `WHERE A = ?` — dùng được
- `WHERE A = ? AND B = ?` — dùng được
- `WHERE A = ? AND B = ? AND C = ?` — dùng được
- `WHERE A = ? AND B > ?` — A equality, B range, dùng được
- `WHERE B = ?` — bỏ qua A, không dùng được
- `WHERE B = ? AND C = ?` — bỏ qua A, không dùng được
- `WHERE A = ? AND C = ?` — bỏ qua B, C không được dùng

**Thứ tự cột trong composite index:**
1. Các cột dùng '=' (equality)
   → sắp theo SELECTIVITY giảm dần (lọc mạnh nhất đứng trước)

2. Cột dùng RANGE (>, <, BETWEEN)

3. Cột dùng ORDER BY (nếu cần tận dụng index để sort)

Càng lọc mạnh thì càng nên đứng sớm trong index

```sql
-- Query:
SELECT * FROM orders
WHERE userId = 123
  AND status = 'pending'
ORDER BY created_at DESC;

-- Index tốt nhất:
CREATE INDEX idx ON orders (userId, status, created_at DESC);
-- Dùng index cho filter VA sort, không cần sort thêm
```

---

### 4.3 Unique Index

```sql
CREATE UNIQUE INDEX idx_users_email_unique ON users (email);

-- Hoặc khi tạo constraint (PostgreSQL tự tạo unique index):
ALTER TABLE users ADD CONSTRAINT uq_email UNIQUE (email);
```

- Đảm bảo không trùng lặp dữ liệu ở tầng database (không chỉ application).
- Hiệu năng tương đương index thường + thêm check duplicate khi insert/update.

---

### 4.4 Partial Index (Filtered Index)

Index chỉ đánh trên **tập con** của rows thỏa điều kiện.

```sql
-- Chỉ index các đơn hàng chưa xử lý
CREATE INDEX idx_orders_pending ON orders (created_at)
WHERE status = 'pending';

-- Chỉ index user chưa bị xóa (soft delete pattern)
CREATE INDEX idx_users_active ON users (email)
WHERE deleted_at IS NULL;

-- Chỉ index các giá trị không null
CREATE INDEX idx_users_phone ON users (phone)
WHERE phone IS NOT NULL;
```

**Lợi ích:**
- Index nhỏ hơn rất nhiều → nhanh hơn, ít RAM hơn.
- Ví dụ: bảng 10M orders, chỉ 50K đang `pending` → index chỉ có 50K entries thay vì 10M.

---

### 4.5 Covering Index (Index-Only Scan)

Index **chứa tất cả các cột** mà query cần → không cần đọc heap table.

```sql
-- Query:
SELECT userId, status, total FROM orders WHERE userId = 123;

-- Index thường (non-covering):
CREATE INDEX idx ON orders (userId);
-- Index scan lấy row pointer → đọc heap để lấy status, total

-- Covering index:
CREATE INDEX idx ON orders (userId) INCLUDE (status, total);
-- PostgreSQL 11+: dùng INCLUDE cho non-key columns

-- Hoặc composite covering:
CREATE INDEX idx ON orders (userId, status, total);
-- Toàn bộ data nằm trong index → Index-Only Scan, không động vào heap
```

**Khi nào dùng:** Query chạy rất thường xuyên, cần tối ưu tối đa.
**Cẩn thận:** Index to hơn, tốn storage và RAM buffer pool.

---

### 4.6 Clustered vs Non-Clustered Index

| | Clustered Index | Non-Clustered Index |
|--|----------------|---------------------|
| Định nghĩa | Data rows được sắp xếp vật lý theo key | Index tách biệt, chứa pointer đến heap |
| Số lượng | Chỉ 1 per table | Nhiều |
| MySQL InnoDB | PRIMARY KEY luôn là clustered | Tất cả secondary index |
| PostgreSQL | Không có clustered tự nhiên (dùng `CLUSTER` command một lần) | Tất cả index đều non-clustered |
| SQL Server | 1 clustered index, có thể chọn cột | Nhiều non-clustered |

**MySQL InnoDB — quan trọng:**
```sql
-- Secondary index trong InnoDB chứa PRIMARY KEY, không phải row pointer
-- Query: SELECT * FROM orders WHERE status = 'paid'
-- → Index scan trên idx_status → lấy PRIMARY KEY → tra lại clustered index
-- Gọi là "Double Lookup" hay "Bookmark Lookup"

-- Nếu Primary Key lớn (UUID string) → secondary index cũng phình to
-- → Ưu tiên dùng AUTO_INCREMENT integer PK
```

---

### 4.7 Expression / Functional Index

Index trên **kết quả của hàm hoặc expression**.

```sql
-- PostgreSQL: index cho case-insensitive search
CREATE INDEX idx_users_email_lower ON users (LOWER(email));

-- Query phải dùng đúng expression để tận dụng index:
SELECT * FROM users WHERE LOWER(email) = 'alice@gmail.com'; -- dùng index
SELECT * FROM users WHERE email = 'alice@gmail.com';        -- không dùng index

-- Index trên computed value
CREATE INDEX idx_orders_year ON orders (EXTRACT(YEAR FROM created_at));

-- MySQL: Generated Column + Index
ALTER TABLE users ADD COLUMN email_lower VARCHAR(255) GENERATED ALWAYS AS (LOWER(email));
CREATE INDEX idx_email_lower ON users (email_lower);
```

---

## 5. Ảnh hưởng đến hiệu năng ĐỌC

### Index làm tăng tốc READ như thế nào

```
Không có index:
SELECT * FROM orders WHERE customer_id = 456;

Execution:
1. Read page 1   (100 rows) → không match → discard
2. Read page 2   (100 rows) → không match → discard
...
N. Read page N   (100 rows) → 3 rows match → return
→ Đọc toàn bộ N pages (full table scan)

Có index trên customer_id:
1. B-Tree traversal: root → branch → leaf (3-4 page reads)
2. Leaf node: [customer_id=456 → (page=42,row=5), (page=17,row=2), (page=88,row=1)]
3. Fetch 3 specific heap pages
→ Tổng: ~6-7 page reads thay vì hàng nghìn
```

### Các operation được hưởng lợi từ Index

| Operation | Loại Index hỗ trợ |
|-----------|------------------|
| `WHERE col = value` | B-Tree, Hash |
| `WHERE col > value` | B-Tree |
| `WHERE col BETWEEN a AND b` | B-Tree |
| `WHERE col LIKE 'prefix%'` | B-Tree |
| `ORDER BY col` | B-Tree (đúng direction) |
| `GROUP BY col` | B-Tree (tránh sort) |
| `JOIN ON t1.col = t2.col` | B-Tree, Hash |
| `WHERE col IS NULL` | B-Tree (PostgreSQL) |
| Full-text search | GIN, Full-Text |
| Array contains | GIN |
| Geospatial | GiST, SP-GiST |

### Khi nào Index KHÔNG được dùng (dù có)

```sql
-- 1. Function bao quanh cột (không có functional index)
WHERE YEAR(created_at) = 2024         -- MySQL, không dùng index
WHERE DATE(created_at) = '2024-01-01' -- không dùng index

-- Thay bằng range query:
WHERE created_at >= '2024-01-01' AND created_at < '2025-01-01'

-- 2. Implicit type conversion
WHERE userId = '123'  -- userId là INTEGER, '123' là string → MySQL bỏ qua index

-- 3. Leading wildcard
WHERE name LIKE '%nguyen%'  -- không dùng index

-- 4. NOT IN, NOT LIKE, !=
WHERE status != 'active'    -- thường dẫn đến full scan

-- 5. OR trên nhiều cột khác nhau (MySQL thường bỏ index)
WHERE email = 'a@b.com' OR phone = '0123456789'
-- Cần 2 separate index + UNION, hoặc dùng index merge

-- 6. Cardinality quá thấp (optimizer tự bỏ qua)
-- Cột gender chỉ có 2 giá trị, 50% rows match → full scan nhanh hơn
WHERE gender = 'M'  -- optimizer có thể bỏ qua index
```

---

## 6. Ảnh hưởng đến hiệu năng GHI

Đây là **đánh đổi quan trọng nhất** khi dùng index.

### Mỗi index = overhead thêm cho INSERT, UPDATE, DELETE

```
INSERT một row vào bảng có 5 indexes:
1. Write row vào heap (data page)
2. Update B-Tree index 1  (có thể cần page split)
3. Update B-Tree index 2
4. Update B-Tree index 3
5. Update B-Tree index 4
6. Update B-Tree index 5

→ Ghi 6 lần thay vì 1 lần
→ Nếu B-Tree cần split node → thêm overhead, có thể gây lock
```

### Benchmark thực tế (ước lượng)

| Số lượng Index | INSERT relative speed |
|---------------|-----------------------|
| 0 | 100% (fastest) |
| 1 (PK only) | ~85% |
| 3 | ~65% |
| 5 | ~50% |
| 10+ | ~30% hoặc thấp hơn |

*Số liệu phụ thuộc vào hardware, workload, DB engine.*

### Page Split — chi phí ẩn

```
B-Tree page đầy:
[10 | 20 | 30 | 40 | 50 | 60 | 70 | 80 | 90]  <- page đầy

Insert key = 45:
→ Split thành 2 pages:
[10 | 20 | 30 | 40 | 45]   [50 | 60 | 70 | 80 | 90]
→ Update parent node để trỏ đến page mới
→ Nếu parent cũng đầy → split tiếp (cascade)
→ Write nhiều pages, hold locks lâu hơn
```

### UPDATE: khi nào tốn kém nhất

```sql
-- UPDATE cột KHÔNG có index → chỉ write heap
UPDATE users SET bio = 'new bio' WHERE id = 1;   -- rẻ

-- UPDATE cột CÓ index → write heap + update index
UPDATE users SET email = 'new@email.com' WHERE id = 1;
-- Xóa entry cũ trong index + insert entry mới

-- UPDATE cột là key của composite index → tốn kém nhất
UPDATE orders SET status = 'shipped' WHERE id = 99;
-- Nếu có index (userId, status, created_at) → rebuild entry trong index
```

### DELETE và Index Bloat

```sql
DELETE FROM orders WHERE created_at < '2023-01-01';

-- B-Tree: đánh dấu entries là "dead" (không xóa ngay)
-- → Index bloat theo thời gian
-- → Cần VACUUM (PostgreSQL) hoặc OPTIMIZE TABLE (MySQL) định kỳ
```

### Bulk Insert Best Practice

```sql
-- Cách tệ: Insert từng row với đầy đủ index đang hoạt động
INSERT INTO logs VALUES (...);  -- lặp 1,000,000 lần

-- Cách tốt: Tắt index, bulk insert, rebuild index
-- MySQL:
ALTER TABLE logs DISABLE KEYS;
LOAD DATA INFILE 'logs.csv' INTO TABLE logs;
ALTER TABLE logs ENABLE KEYS;

-- PostgreSQL: DROP index trước, tạo lại sau
DROP INDEX idx_logs_created_at;
\COPY logs FROM 'logs.csv' CSV;
CREATE INDEX idx_logs_created_at ON logs (created_at);
-- Tạo index từ đầu bằng sort nhanh hơn nhiều lần insert từng row
```

---

## 7. Khi nào NÊN dùng Index

**Dùng index khi:**

**1. Cột xuất hiện trong WHERE clause thường xuyên**
```sql
SELECT * FROM users WHERE email = ?;  -- email nên được index
```

**2. Cột dùng trong JOIN condition**
```sql
SELECT * FROM orders o JOIN users u ON o.userId = u.id;
-- userId trong orders và id trong users đều nên có index
```

**3. Cột dùng trong ORDER BY hoặc GROUP BY** (khi result set lớn)
```sql
SELECT * FROM posts ORDER BY published_at DESC LIMIT 20;
-- published_at nên có index
```

**4. Cột có cardinality cao** (nhiều giá trị distinct)
- email, phone, UUID, order_number → nên index
- gender (2 values), boolean → không đáng index

**5. Foreign Key columns**
```sql
-- Luôn index FK để JOIN và cascade operation nhanh
CREATE INDEX idx_orders_userId ON orders (userId);
```

**6. Bảng lớn** (> 100K rows) và query chạy thường xuyên

**7. Queries có selectivity cao** (trả về ít rows / tổng số rows)
- `WHERE id = 1` → selectivity = 1/1,000,000 → rất tốt cho index
- `WHERE status IN ('active', 'pending')` → 80% rows → kém

---

## 8. Khi nào KHÔNG NÊN dùng Index

**Tránh index khi:**

**1. Bảng nhỏ** (< 1,000 - 10,000 rows)
- Full scan nhanh hơn, overhead duy trì index không đáng

**2. Cột có cardinality thấp** (ít giá trị distinct)
```sql
-- Chỉ có 3 giá trị: 'pending', 'processing', 'completed'
-- 30% rows mỗi value → full scan thường hiệu quả hơn
CREATE INDEX idx_status ON orders (status);  -- thường vô ích
```

**3. Cột thường xuyên bị UPDATE**
```sql
-- Cột last_seen_at update mỗi khi user online
-- Index liên tục bị rebuild → overhead lớn
```

**4. Bảng có write-heavy workload và đọc ít**
- Logging table, event streaming, IoT sensor data
- Tỷ lệ write >> read → index gây hại nhiều hơn lợi

**5. Không bao giờ query trên cột đó**
- Index thừa chiếm RAM (buffer pool), chậm write, không có ích

**6. Query trả về phần lớn rows của bảng**
- `WHERE created_at > '2020-01-01'` — nếu 90% data là sau 2020 → full scan tốt hơn

**7. Temporary tables / CTE** trong quá trình xử lý ngắn

---

## 9. Ví dụ thực tiễn

### 9.1 E-commerce — tìm kiếm sản phẩm

```sql
-- Schema
CREATE TABLE products (
    id          BIGSERIAL PRIMARY KEY,
    name        VARCHAR(255),
    category_id INT,
    brand_id    INT,
    price       DECIMAL(10,2),
    stock       INT,
    is_active   BOOLEAN DEFAULT TRUE,
    created_at  TIMESTAMP DEFAULT NOW()
);

-- Query phổ biến nhất:
SELECT id, name, price FROM products
WHERE category_id = 5
  AND is_active = TRUE
  AND price BETWEEN 100000 AND 500000
ORDER BY created_at DESC
LIMIT 20;

-- Index tối ưu:
CREATE INDEX idx_products_search ON products (category_id, is_active, price, created_at DESC)
INCLUDE (name);
-- INCLUDE (name) → covering index, không cần đọc heap

-- Nếu cần full-text search:
CREATE INDEX idx_products_fts ON products USING GIN (to_tsvector('english', name));

SELECT id, name, price FROM products
WHERE to_tsvector('english', name) @@ plainto_tsquery('english', 'wireless headphone')
  AND is_active = TRUE
ORDER BY ts_rank(to_tsvector('english', name), plainto_tsquery('english', 'wireless headphone')) DESC;
```

---

### 9.2 SaaS — multi-tenant queries

```sql
-- Schema
CREATE TABLE documents (
    id              BIGSERIAL PRIMARY KEY,
    organization_id INT NOT NULL,
    owner_id        INT NOT NULL,
    status          VARCHAR(20),
    created_at      TIMESTAMP DEFAULT NOW()
);

-- Mọi query đều có WHERE organization_id = ?
-- organization_id phải là cột ĐẦU TIÊN trong mọi composite index

CREATE INDEX idx_docs_org_status  ON documents (organization_id, status);
CREATE INDEX idx_docs_org_owner   ON documents (organization_id, owner_id);
CREATE INDEX idx_docs_org_created ON documents (organization_id, created_at DESC);

-- Partial index: chỉ index active documents
CREATE INDEX idx_docs_org_active ON documents (organization_id, created_at DESC)
WHERE status != 'deleted';
-- Index nhỏ hơn nhiều nếu phần lớn documents đã bị soft-delete
```

---

### 9.3 Logging / Audit table

```sql
-- Bảng log: write-heavy, đọc theo time range
CREATE TABLE audit_logs (
    id          BIGSERIAL PRIMARY KEY,
    userId     INT,
    action      VARCHAR(100),
    entity_type VARCHAR(50),
    entity_id   BIGINT,
    created_at  TIMESTAMP DEFAULT NOW()
);

-- Strategy: ít index nhất có thể
-- Chỉ index những gì THỰC SỰ được query:

-- Query 1: Xem log của một user cụ thể
CREATE INDEX idx_audit_user_time ON audit_logs (userId, created_at DESC);

-- Query 2: Xem log của một entity (kiểm tra ai sửa bản ghi nào)
CREATE INDEX idx_audit_entity ON audit_logs (entity_type, entity_id, created_at DESC);

-- KHÔNG index action, vì:
-- - Cardinality cao nhưng query theo action không phổ biến
-- - Write overhead không đáng

-- Partition by time để tránh bảng quá lớn (PostgreSQL):
CREATE TABLE audit_logs_2024_01 PARTITION OF audit_logs
FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
```

---

### 9.4 Social feed — ORDER BY + LIMIT

```sql
-- Schema
CREATE TABLE posts (
    id         BIGSERIAL PRIMARY KEY,
    userId    INT,
    content    TEXT,
    likes      INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE follows (
    follower_id INT,
    followed_id INT,
    PRIMARY KEY (follower_id, followed_id)
);

-- Feed query: lấy posts của những người mình follow
SELECT p.id, p.content, p.created_at
FROM posts p
WHERE p.userId IN (
    SELECT followed_id FROM follows WHERE follower_id = 123
)
ORDER BY p.created_at DESC
LIMIT 20;

-- Indexes cần thiết:
CREATE INDEX idx_follows_follower ON follows (follower_id);
CREATE INDEX idx_posts_user_time ON posts (userId, created_at DESC);

-- Vấn đề: IN với subquery có thể không dùng index tốt
-- Giải pháp với JOIN:
SELECT p.id, p.content, p.created_at
FROM posts p
JOIN follows f ON p.userId = f.followed_id
WHERE f.follower_id = 123
ORDER BY p.created_at DESC
LIMIT 20;

-- Hoặc: denormalize feed (fan-out on write) để tránh complex query
-- Mỗi khi user A post → insert vào feed table của mọi follower của A
CREATE TABLE user_feeds (
    userId    INT,
    post_id    BIGINT,
    created_at TIMESTAMP,
    PRIMARY KEY (userId, post_id)
);
CREATE INDEX idx_feeds_user_time ON user_feeds (userId, created_at DESC);
-- Feed query trở thành:
SELECT * FROM user_feeds WHERE userId = 123 ORDER BY created_at DESC LIMIT 20;
```

---

## 10. EXPLAIN / EXPLAIN ANALYZE — đọc Query Plan

Đây là công cụ **bắt buộc phải biết** khi làm việc với index.

### PostgreSQL

```sql
EXPLAIN ANALYZE
SELECT * FROM orders WHERE userId = 123 AND status = 'pending';

-- Output ví dụ (CÓ index):
Index Scan using idx_orders_user_status on orders
  (cost=0.43..8.45 rows=3 width=72)
  (actual time=0.052..0.061 rows=3 loops=1)
  Index Cond: ((userId = 123) AND (status = 'pending'))
Planning Time: 0.5 ms
Execution Time: 0.1 ms

-- Output ví dụ (KHÔNG có index):
Seq Scan on orders
  (cost=0.00..42850.00 rows=3 width=72)
  (actual time=120.3..845.2 rows=3 loops=1)
  Filter: ((userId = 123) AND (status = 'pending'))
  Rows Removed by Filter: 999997
Planning Time: 0.3 ms
Execution Time: 845.5 ms
```

### Giải thích các node trong Query Plan (PostgreSQL)

| Node | Ý nghĩa |
|------|---------|
| `Seq Scan` | Full table scan — đọc từng page từ đầu đến cuối |
| `Index Scan` | Dùng index để tìm row pointer, sau đó đọc heap |
| `Index Only Scan` | Dùng covering index, không cần đọc heap — tốt nhất |
| `Bitmap Index Scan` | Gom nhiều pointer vào bitmap, rồi đọc heap theo batch |
| `Bitmap Heap Scan` | Bước tiếp theo của Bitmap Index Scan, đọc heap theo thứ tự vật lý |
| `Nested Loop` | Join bằng cách lặp outer rows, mỗi outer row tra inner bằng index |
| `Hash Join` | Build hash table từ bảng nhỏ, probe từ bảng lớn |
| `Merge Join` | Join hai bảng đã được sort theo join key |
| `cost=X..Y` | X: chi phí khởi động (trước khi trả row đầu tiên), Y: tổng chi phí |
| `rows=N` | Số rows optimizer ước tính |
| `actual time=X..Y` | Thời gian thực đo được (ms) |
| `loops=N` | Node được thực thi N lần (trong nested loop) |
| `width=N` | Kích thước trung bình một row (bytes) |

### MySQL

```sql
EXPLAIN SELECT * FROM orders WHERE userId = 123;

-- Output:
+----+-------------+--------+-------+-------------+-------------+---------+-------+------+-------+
| id | select_type | table  | type  | possible_keys | key         | key_len | ref   | rows | Extra |
+----+-------------+--------+-------+-------------+-------------+---------+-------+------+-------+
|  1 | SIMPLE      | orders | ref   | idx_userId | idx_userId | 4       | const |  142 |       |
+----+-------------+--------+-------+-------------+-------------+---------+-------+------+-------+

-- "type" column quan trọng nhất (từ tốt đến xấu):
-- system → const → eq_ref → ref → range → index → ALL
-- ALL = full table scan
```

| `type` | Ý nghĩa |
|--------|---------|
| `system` | Bảng chỉ có 1 row |
| `const` | Primary/Unique key so sánh với constant value, tìm ngay 1 row |
| `eq_ref` | JOIN với unique index, mỗi outer row match đúng 1 inner row |
| `ref` | Non-unique index scan, nhiều rows có thể match |
| `range` | Index range scan (BETWEEN, >, <, IN) |
| `index` | Full index scan (quét toàn bộ index, vẫn tốt hơn ALL) |
| `ALL` | Full table scan — cần xem xét thêm index |

---

## 11. Index Bloat và Maintenance

### Index Bloat là gì?

Theo thời gian, DELETE và UPDATE tạo ra "dead tuples" trong index pages. Index phình to ra, chiếm RAM và giảm hiệu năng dù data thực sự không nhiều.

```sql
-- PostgreSQL: kiểm tra kích thước và mức độ sử dụng index
SELECT
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
    idx_scan AS scans_used,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY pg_relation_size(indexrelid) DESC;

-- Index không bao giờ được dùng:
SELECT indexrelname, idx_scan
FROM pg_stat_user_indexes
WHERE idx_scan = 0 AND schemaname = 'public';
-- Xem xét DROP những index này
```

### VACUUM và REINDEX (PostgreSQL)

```sql
-- Auto-vacuum chạy ngầm định kỳ
-- Manual vacuum khi cần:
VACUUM ANALYZE orders;          -- reclaim dead space + update statistics
VACUUM FULL orders;             -- rewrite toàn bộ table, reclaim disk (lock table!)

-- Rebuild index bị bloat:
REINDEX INDEX idx_orders_userId;                -- lock table
REINDEX INDEX CONCURRENTLY idx_orders_userId;   -- không lock (PostgreSQL 12+)
```

### Cập nhật Statistics

```sql
-- PostgreSQL: optimizer dùng statistics để chọn query plan
-- Nếu statistics lỗi thời, optimizer có thể chọn sai plan
ANALYZE orders;       -- cập nhật statistics cho bảng orders

-- MySQL:
ANALYZE TABLE orders;
```

### CREATE INDEX CONCURRENTLY (PostgreSQL)

```sql
-- Tạo index mà không lock table (production-safe)
CREATE INDEX CONCURRENTLY idx_orders_status ON orders (status);
-- Mất thời gian hơn nhưng không block reads/writes

-- Tương tự khi xóa:
DROP INDEX CONCURRENTLY idx_orders_old;
```

---

## 12. Các Anti-pattern phổ biến

### Anti-pattern 1: Index mọi cột

```sql
-- Đừng làm thế này:
CREATE INDEX ON users (id);          -- PK đã là index rồi
CREATE INDEX ON users (name);        -- name ít khi được query chính xác
CREATE INDEX ON users (gender);      -- cardinality thấp (2 values)
CREATE INDEX ON users (created_at);  -- nếu không query theo time range
CREATE INDEX ON users (updated_at);  -- update liên tục, overhead cao
```

### Anti-pattern 2: Bỏ qua thứ tự cột trong composite index

```sql
-- Query:
WHERE status = 'active' AND userId = 123

-- Index sai thứ tự:
CREATE INDEX idx ON orders (status, userId);
-- Nếu status có 3 values, mỗi value ~33% rows → kém hiệu quả

-- Index đúng thứ tự (high cardinality trước):
CREATE INDEX idx ON orders (userId, status);
-- userId filter rất selective → chỉ vài rows còn lại → filter status nhanh
```

### Anti-pattern 3: Duplicate indexes

```sql
-- Đã có:
CREATE INDEX idx_a ON orders (userId);
CREATE INDEX idx_b ON orders (userId, status);  -- idx_a là redundant

-- idx_a không bao giờ được dùng khi đã có idx_b
-- idx_b cover mọi query mà idx_a cover được, và nhiều hơn
-- → Drop idx_a
```

### Anti-pattern 4: Quên rằng index FK cũng giải quyết cascade check

```sql
CREATE TABLE orders (
    id      BIGSERIAL PRIMARY KEY,
    userId INT REFERENCES users(id)
);

-- Nhớ index orders.userId để JOIN nhanh:
CREATE INDEX idx_orders_userId ON orders (userId);

-- Lý do ít người biết: DELETE FROM users WHERE id = 123
-- → Database phải check xem có orders nào reference user 123 không
-- → Nếu không có index trên FK → full scan orders table
-- → Index trên FK đã giải quyết cả vấn đề này
```

### Anti-pattern 5: Không dùng CONCURRENTLY khi tạo index production

```sql
-- Sai — lock table, gây downtime:
CREATE INDEX idx_orders_status ON orders (status);  -- block mọi write

-- Đúng:
CREATE INDEX CONCURRENTLY idx_orders_status ON orders (status);
```

### Anti-pattern 6: Quên EXPLAIN trước khi deploy

Luôn chạy `EXPLAIN ANALYZE` với dữ liệu thực tế trước khi đưa query quan trọng lên production. Đặc biệt sau khi thêm/xóa index, hoặc khi data volume thay đổi lớn.

---

## 13. Index trong các hệ cơ sở dữ liệu phổ biến

### PostgreSQL

```sql
-- Các loại index hỗ trợ:
-- B-Tree (default), Hash, GIN, GiST, SP-GiST, BRIN

-- BRIN (Block Range Index) — cho time-series, append-only tables:
CREATE INDEX idx_logs_time ON logs USING BRIN (created_at);
-- Rất nhỏ, rất nhanh khi data được insert theo thứ tự tự nhiên

-- Partial index:
CREATE INDEX idx_active_users ON users (email) WHERE is_active = TRUE;

-- Covering index với INCLUDE:
CREATE INDEX idx ON orders (userId) INCLUDE (status, total);

-- Expression index:
CREATE INDEX idx_email_ci ON users (LOWER(email));

-- Concurrent (không lock):
CREATE INDEX CONCURRENTLY idx ON big_table (col);

-- List indexes:
\d table_name
SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'orders';
```

### MySQL / MariaDB

```sql
-- InnoDB chỉ hỗ trợ B-Tree và Full-Text
-- Tất cả secondary index trong InnoDB đều chứa PK → chọn PK nhỏ gọn

-- Index prefix (với TEXT/BLOB column):
CREATE INDEX idx_content ON articles (content(100));  -- chỉ index 100 ký tự đầu

-- Invisible index (MySQL 8.0+) — test xem drop index có ảnh hưởng không:
ALTER TABLE orders ALTER INDEX idx_status INVISIBLE;
-- Optimizer bỏ qua index này, nhưng vẫn được duy trì
-- Nếu performance không đổi → drop index an toàn
ALTER TABLE orders DROP INDEX idx_status;

-- Descending index (MySQL 8.0+):
CREATE INDEX idx ON orders (userId ASC, created_at DESC);

-- List indexes:
SHOW INDEX FROM orders;
EXPLAIN FORMAT=TREE SELECT ...;  -- MySQL 8.0+ tree format
```

### SQL Server

```sql
-- Clustered index (mặc định tạo khi tạo PK):
CREATE CLUSTERED INDEX idx_orders_pk ON orders (id);

-- Non-clustered với INCLUDE:
CREATE NONCLUSTERED INDEX idx_orders_user
ON orders (userId)
INCLUDE (status, total, created_at);

-- Filtered index:
CREATE INDEX idx_pending ON orders (created_at)
WHERE status = 'pending';

-- Columnstore index (cho analytics/OLAP):
CREATE COLUMNSTORE INDEX idx_col ON fact_sales (product_id, sale_date, amount);

-- Xem index usage:
SELECT * FROM sys.dm_db_index_usage_stats WHERE database_id = DB_ID();
```

### MongoDB

```javascript
// Single field:
db.users.createIndex({ email: 1 });  // 1 = ascending, -1 = descending

// Compound:
db.orders.createIndex({ userId: 1, status: 1, created_at: -1 });

// Unique:
db.users.createIndex({ email: 1 }, { unique: true });

// Partial:
db.orders.createIndex(
  { created_at: -1 },
  { partialFilterExpression: { status: "pending" } }
);

// Text search:
db.articles.createIndex({ title: "text", content: "text" });

// TTL index (auto-delete documents after N seconds):
db.sessions.createIndex({ created_at: 1 }, { expireAfterSeconds: 3600 });

// Wildcard index (cho flexible schema):
db.products.createIndex({ "attributes.$**": 1 });

// Explain:
db.orders.find({ userId: 123 }).explain("executionStats");
```

---

## 14. Checklist cho Developer

### Khi thiết kế schema mới

- [ ] Primary Key là integer/bigint auto-increment (tránh UUID string làm PK trong MySQL InnoDB)
- [ ] Foreign Key columns đều có index
- [ ] Cột nào sẽ xuất hiện trong WHERE, JOIN, ORDER BY → lên kế hoạch index
- [ ] Xác định tỷ lệ read/write của từng bảng → nếu write-heavy, ít index thôi

### Khi viết query mới

- [ ] Chạy `EXPLAIN ANALYZE` trước khi merge code
- [ ] Đảm bảo không có Seq Scan trên bảng lớn
- [ ] Tránh function bao quanh cột có index
- [ ] Tránh implicit type conversion
- [ ] Kiểm tra cardinality của cột filter

### Khi thêm/xóa index production

- [ ] Dùng `CREATE INDEX CONCURRENTLY` (PostgreSQL) hoặc `ALGORITHM=INPLACE` (MySQL)
- [ ] Chạy trong giờ thấp điểm
- [ ] Monitor CPU, disk I/O trong khi tạo index
- [ ] Verify query plan sau khi tạo index

### Định kỳ (weekly/monthly)

- [ ] Kiểm tra unused indexes:
  ```sql
  -- PostgreSQL:
  SELECT indexrelname, idx_scan FROM pg_stat_user_indexes WHERE idx_scan = 0;

  -- MySQL:
  SELECT * FROM sys.schema_unused_indexes;
  ```
- [ ] Kiểm tra missing indexes qua slow query log
- [ ] `VACUUM ANALYZE` (PostgreSQL) / `ANALYZE TABLE` (MySQL)
- [ ] Review index bloat size

---

## 15. Bảng thuật ngữ (Glossary)

Giải thích tất cả các thuật ngữ kỹ thuật xuất hiện trong tài liệu này, sắp xếp theo nhóm chủ đề.

---

### Cấu trúc dữ liệu

**B-Tree (Balanced Tree)**
Cây tìm kiếm cân bằng, mỗi node có thể có nhiều con. Tất cả leaf nodes đều ở cùng một độ sâu. Đây là cấu trúc dữ liệu nền tảng của hầu hết các database index. Độ phức tạp tìm kiếm là O(log n).

**Leaf Node**
Các node nằm ở tầng cuối cùng của B-Tree, không có node con. Trong database index, leaf node chứa key (giá trị được index) và pointer trỏ đến row thực trong heap. Các leaf node được nối với nhau thành linked list để hỗ trợ range scan.

**Root Node**
Node gốc của B-Tree, là điểm xuất phát của mọi thao tác tìm kiếm trong index.

**Branch Node (Internal Node)**
Các node nằm giữa root và leaf, dùng để định hướng tìm kiếm xuống đúng nhánh của cây.

**Linked List**
Cấu trúc dữ liệu mà mỗi phần tử trỏ đến phần tử tiếp theo. Trong B-Tree index, các leaf node được nối thành linked list theo thứ tự key, cho phép range scan mà không cần quay lại root.

**Hash Table**
Cấu trúc dữ liệu dùng hàm hash để ánh xạ key vào bucket, cho phép lookup O(1). Hash Index trong database dựa trên cấu trúc này.

**Bitmap**
Mảng bit (0/1) đại diện cho một tập hợp rows. Trong Bitmap Index, mỗi bit tương ứng với một row: bit 1 nghĩa là row đó thỏa điều kiện của giá trị đó.

**Inverted Index**
Cấu trúc index ánh xạ ngược: từ token/từ khoá đến danh sách các row hoặc document chứa token đó. Được dùng trong Full-Text Index và GIN Index.

**GIN (Generalized Inverted Index)**
Loại index trong PostgreSQL dùng inverted index để hỗ trợ tìm kiếm trong array, JSONB, và full-text. Tốt khi một document/row có thể chứa nhiều giá trị cần được index (như danh sách tags, nhiều từ khoá).

**GiST (Generalized Search Tree)**
Framework index extensible trong PostgreSQL, cho phép định nghĩa cách so sánh và tìm kiếm cho kiểu dữ liệu tùy chỉnh. PostGIS dùng GiST để index tọa độ địa lý, cho phép query như "tìm địa điểm trong bán kính 1km".

**BRIN (Block Range Index)**
Loại index cực kỳ nhỏ gọn trong PostgreSQL. Thay vì index từng row, BRIN lưu min/max value của từng block range. Hiệu quả với dữ liệu có tính tương quan cao với thứ tự vật lý lưu trữ, như timestamp trong bảng append-only.

**SP-GiST (Space-Partitioned GiST)**
Biến thể của GiST, hỗ trợ các cấu trúc phân vùng không gian như quadtree, k-d tree. Dùng cho dữ liệu geometry phức tạp hơn.

---

### Kiến trúc database

**Heap / Heap Table**
Vùng lưu trữ chính của bảng, nơi các row dữ liệu thực sự nằm. Trong PostgreSQL, heap là file lưu data page theo thứ tự insert. Index là cấu trúc phụ tách biệt, chứa pointer trỏ vào heap.

**Page / Data Page**
Đơn vị lưu trữ nhỏ nhất của database engine, thường có kích thước 8KB (PostgreSQL) hoặc 16KB (MySQL InnoDB). Mọi thao tác đọc/ghi disk đều thực hiện theo đơn vị page, không phải từng byte hay từng row.

**Buffer Pool / Shared Buffer**
Vùng RAM mà database engine dùng để cache các page từ disk. Khi cần đọc một page, database kiểm tra buffer pool trước; nếu đã có thì đọc từ RAM (nhanh), nếu chưa có thì đọc từ disk (chậm) rồi cache vào. Cả index page lẫn heap page đều được cache ở đây.

**Row Pointer / CTID (PostgreSQL) / RID (SQL Server)**
Địa chỉ vật lý của một row trong heap, gồm số page và số slot (vị trí) trong page đó. Index leaf node lưu pointer này để biết cần đọc page nào khi tìm thấy key trong index.

**Tuple**
Thuật ngữ PostgreSQL chỉ một row/bản ghi trong bảng. Bao gồm cả live tuple (dữ liệu hiện tại) và dead tuple (phiên bản cũ chờ dọn dẹp).

**Dead Tuple**
Row đã bị DELETE hoặc là phiên bản cũ của một UPDATE, nhưng chưa được dọn dẹp khỏi heap và index do cơ chế MVCC. Tích lũy quá nhiều dead tuples gây ra index bloat và làm chậm query.

**WAL (Write-Ahead Log)**
Cơ chế đảm bảo tính toàn vẹn dữ liệu (durability): mọi thay đổi phải được ghi vào WAL (log tuần tự trên disk) trước khi áp dụng vào heap/index. Khi tạo hoặc cập nhật index, WAL cũng được ghi, tạo thêm overhead.

**MVCC (Multi-Version Concurrency Control)**
Cơ chế quản lý đồng thời trong PostgreSQL (và nhiều DB khác): mỗi transaction thấy một "snapshot" nhất quán của dữ liệu tại thời điểm transaction bắt đầu, mà không block các transaction khác. MVCC tạo ra dead tuples khi UPDATE/DELETE vì phiên bản cũ cần giữ lại cho các transaction đang chạy.

**Transaction**
Một đơn vị công việc gồm một hoặc nhiều thao tác (INSERT, UPDATE, DELETE, SELECT) được thực thi theo nguyên tắc ACID: tất cả thành công hoặc tất cả rollback.

**InnoDB**
Storage engine mặc định của MySQL. Điểm đặc biệt quan trọng về index: Primary Key luôn là Clustered Index, và tất cả Secondary Index đều chứa giá trị Primary Key thay vì row pointer trực tiếp.

---

### Loại index và kỹ thuật

**Index Scan**
Phương pháp thực thi query: database dùng index để tìm row pointer, sau đó đọc heap để lấy đầy đủ dữ liệu. Phù hợp khi số rows trả về ít (selectivity cao).

**Index Only Scan**
Phương pháp thực thi tốt nhất: tất cả dữ liệu query cần đều có trong index (covering index), không cần đọc heap lần nào. Chỉ xảy ra khi dùng covering index và không có dead tuples (hoặc visibility map đã cập nhật).

**Sequential Scan / Full Table Scan**
Phương pháp thực thi kém nhất với bảng lớn: đọc tuần tự từng page từ đầu đến cuối bảng. Xảy ra khi không có index phù hợp, hoặc khi optimizer quyết định full scan hiệu quả hơn (ví dụ: cần đọc phần lớn rows).

**Bitmap Scan**
Phương pháp thực thi trung gian gồm 2 bước: (1) Bitmap Index Scan dùng index để tạo bitmap các row cần đọc, (2) Bitmap Heap Scan đọc heap theo thứ tự vật lý. Hiệu quả khi cần đọc nhiều rows vì giảm random I/O.

**Index Seek**
Thuật ngữ trong SQL Server (và đôi khi MySQL), tương đương Index Scan trong PostgreSQL: tra cứu index để tìm rows thỏa điều kiện cụ thể.

**Clustered Index**
Index mà data rows trong bảng được sắp xếp vật lý theo thứ tự của key index. MySQL InnoDB: Primary Key luôn là clustered index. Một bảng chỉ có thể có duy nhất một clustered index vì data chỉ có thể được sắp xếp vật lý theo một thứ tự.

**Non-Clustered Index / Secondary Index**
Index tách biệt với heap, chứa key và pointer trỏ về heap (PostgreSQL) hoặc về clustered index (MySQL InnoDB). Một bảng có thể có nhiều non-clustered index.

**Composite Index / Multi-Column Index**
Index đánh trên nhiều cột cùng lúc. Key trong index là tổ hợp giá trị của tất cả các cột, theo đúng thứ tự khai báo. Thứ tự cột trong composite index ảnh hưởng trực tiếp đến hiệu quả.

**Covering Index**
Index chứa đủ tất cả các cột mà một query cần (cả cột trong WHERE lẫn cột trong SELECT). Cho phép Index Only Scan mà không cần đọc heap. Trong PostgreSQL 11+, dùng `INCLUDE` để thêm cột vào index mà không thêm vào key.

**Partial Index / Filtered Index**
Index chỉ đánh trên tập con của rows thỏa một điều kiện WHERE cố định trong lúc tạo index. Giúp index nhỏ hơn và hiệu quả hơn khi query luôn filter theo điều kiện đó.

**Expression Index / Functional Index**
Index đánh trên kết quả của một hàm hoặc biểu thức (ví dụ `LOWER(email)`, `EXTRACT(YEAR FROM created_at)`). Query phải dùng đúng expression tương tự mới tận dụng được index này.

**Unique Index**
Index kèm ràng buộc: không có hai rows nào được phép có cùng giá trị trên cột (hoặc tổ hợp cột) được index. Tương đương với UNIQUE constraint (thực ra UNIQUE constraint được implement bằng unique index).

**Double Lookup / Bookmark Lookup**
Trong MySQL InnoDB, khi dùng secondary index, database phải tra cứu 2 lần: (1) tra secondary index để lấy Primary Key, (2) tra clustered index bằng Primary Key để lấy đủ dữ liệu. Đây là lý do cần chọn Primary Key nhỏ gọn.

**Index Merge**
Kỹ thuật của MySQL optimizer: kết hợp kết quả từ nhiều index khác nhau (bằng UNION hoặc INTERSECT) để phục vụ một query có điều kiện OR hoặc AND trên nhiều cột. Thường kém hiệu quả hơn một composite index được thiết kế tốt.

**Invisible Index (MySQL 8.0+)**
Tính năng cho phép "ẩn" một index khỏi query optimizer mà không thực sự drop index. Dùng để kiểm tra tác động trước khi quyết định xóa index thật sự.

---

### Hiệu năng và bảo trì

**Cardinality**
Số lượng giá trị distinct trong một cột. Cardinality cao (nhiều giá trị khác nhau, như email, UUID, order number) → index hiệu quả. Cardinality thấp (ít giá trị, như boolean, status với 2-3 giá trị) → index thường không đáng.

**Selectivity**
Tỷ lệ số rows được chọn bởi điều kiện WHERE so với tổng số rows trong bảng. Selectivity cao (rất ít rows thỏa điều kiện) → index hiệu quả. Selectivity thấp (phần lớn rows thỏa điều kiện) → full scan có thể tốt hơn.

**Leftmost Prefix Rule**
Quy tắc của composite index: index `(A, B, C)` chỉ được tận dụng khi query có điều kiện bắt đầu từ cột A (cột ngoài cùng bên trái). Không thể "nhảy cóc" bỏ qua cột đầu để dùng cột sau.

**Query Plan / Execution Plan**
Kế hoạch mà query optimizer chọn để thực thi một câu SQL: dùng index nào, thứ tự join các bảng ra sao, thuật toán join nào. Xem bằng lệnh `EXPLAIN` hoặc `EXPLAIN ANALYZE`.

**Query Optimizer**
Thành phần của database engine chịu trách nhiệm phân tích câu SQL và lựa chọn query plan tối ưu nhất dựa trên cấu trúc bảng, index có sẵn, và statistics về phân bố dữ liệu.

**Statistics**
Thông tin thống kê về phân bố dữ liệu trong bảng và index (số rows ước tính, phân bố giá trị, histogram, số giá trị distinct). Query optimizer dùng statistics để ước tính số rows sẽ được trả về từ mỗi bước, từ đó chọn plan. Statistics lỗi thời có thể khiến optimizer chọn sai plan.

**Index Bloat**
Hiện tượng index trở nên lớn hơn mức cần thiết do tích lũy dead tuples từ DELETE/UPDATE qua thời gian. Index bloat làm chậm scan vì phải đọc nhiều page hơn, và tốn RAM buffer pool hơn mức cần.

**Page Split**
Sự kiện xảy ra khi một page của B-Tree index đầy và cần insert thêm key: page bị chia thành 2 page mới, parent node được cập nhật để trỏ đến cả hai. Page split gây overhead write và có thể hold lock lâu hơn. Page split liên tiếp (cascade) xảy ra khi parent cũng đầy.

**Fill Factor**
Tỷ lệ phần trăm không gian trong mỗi page được lấp đầy khi tạo index ban đầu (mặc định 90% trong PostgreSQL). Fill factor thấp hơn → để lại không gian trống trong page, giảm page split khi insert/update sau này, nhưng index chiếm nhiều storage hơn.

**VACUUM (PostgreSQL)**
Tiến trình dọn dẹp dead tuples khỏi heap và index trong PostgreSQL, giải phóng không gian cho rows mới tái sử dụng. Auto-vacuum chạy tự động trong nền, nhưng có thể chạy manual bằng lệnh `VACUUM` khi cần thiết.

**REINDEX**
Lệnh rebuild hoàn toàn một index từ đầu, loại bỏ bloat và tái tổ chức cấu trúc. `REINDEX CONCURRENTLY` (PostgreSQL 12+) cho phép rebuild mà không lock table.

**ANALYZE**
Lệnh cập nhật statistics của bảng bằng cách lấy mẫu dữ liệu thực. Cần chạy sau khi data thay đổi lớn để optimizer có thể đưa ra quyết định đúng.

**CONCURRENTLY (PostgreSQL)**
Tùy chọn cho phép tạo hoặc xóa index mà không lock table, để các read/write vẫn tiếp tục bình thường trong khi index được xây dựng hoặc xóa. Quá trình mất nhiều thời gian hơn và yêu cầu 2 lần scan bảng nhưng an toàn cho môi trường production.

**Slow Query Log**
Tính năng của database ghi lại tất cả query thực thi lâu hơn ngưỡng thời gian cấu hình. Là công cụ chính để phát hiện query cần được tối ưu bằng index hoặc cần viết lại.

**WAL (Write-Ahead Log)**
Xem định nghĩa ở phần kiến trúc database ở trên.

---

### Workload và thiết kế hệ thống

**OLTP (Online Transaction Processing)**
Hệ thống xử lý giao dịch trực tuyến với nhiều transaction nhỏ, thao tác đọc/ghi đơn lẻ, yêu cầu latency thấp. Ví dụ: hệ thống thương mại điện tử, ngân hàng, đặt vé. Index cần được tối ưu cho query nhỏ, chính xác.

**OLAP (Online Analytical Processing)**
Hệ thống phân tích dữ liệu với query phức tạp trên lượng data lớn, thường là aggregate, group by, report. Ví dụ: data warehouse, BI dashboard. Index (đặc biệt Columnstore) và partitioning được tối ưu cho scan lớn.

**Write-Heavy Workload**
Hệ thống có tỷ lệ ghi (INSERT/UPDATE/DELETE) cao hơn nhiều so với đọc. Ví dụ: logging, event streaming, IoT sensor. Cần hạn chế số lượng index vì mỗi index tạo overhead cho mọi thao tác ghi.

**Read-Heavy Workload**
Hệ thống có tỷ lệ đọc cao hơn nhiều so với ghi. Ví dụ: trang tin tức, catalog sản phẩm. Có thể tạo nhiều index hơn vì overhead ghi ít ảnh hưởng.

**Fan-out on Write**
Chiến lược denormalize: khi dữ liệu được ghi (ví dụ user A đăng bài), đồng thời ghi kết quả vào nhiều nơi (feed của tất cả follower của A). Mỗi user đọc feed của mình mà không cần join phức tạp. Đánh đổi: write chậm hơn và phức tạp hơn, nhưng read rất nhanh.

**Soft Delete**
Kỹ thuật xóa dữ liệu "ảo": thay vì DELETE thực sự, thêm cột `deleted_at` hoặc `is_deleted` và đặt giá trị khi muốn xóa. Data vẫn tồn tại trong bảng. Partial Index rất hữu ích với pattern này (ví dụ: `WHERE deleted_at IS NULL`).

**Multi-tenancy / Multi-tenant**
Kiến trúc SaaS mà một hệ thống phục vụ nhiều khách hàng (tenant/organization) trên cùng database. Mọi query thường phải filter theo `organization_id`, nên cột này luôn cần đặt đầu tiên trong composite index.

**Denormalization**
Kỹ thuật lưu trữ dữ liệu dư thừa (duplicate) để giảm nhu cầu JOIN phức tạp khi đọc. Đánh đổi giữa tốc độ đọc và sự phức tạp khi ghi/cập nhật.

**Partitioning**
Kỹ thuật chia một bảng lớn thành nhiều bảng con (partition) theo điều kiện nhất định (ví dụ: theo tháng, theo region). Giúp query chỉ scan đúng partition cần thiết thay vì toàn bộ bảng.

---

### Full-text search

**Stemming**
Kỹ thuật trong full-text search: rút gọn từ về dạng gốc (root form). Ví dụ: "running", "runs", "ran" đều về "run"; "indexes", "indexed" đều về "index". Giúp tìm kiếm linh hoạt hơn, không cần khớp chính xác dạng từ.

**Stop Words**
Các từ phổ biến bị bỏ qua trong full-text index vì xuất hiện ở quá nhiều documents và không có giá trị phân biệt. Ví dụ tiếng Anh: "the", "a", "is", "and", "or". Loại bỏ stop words giúp index nhỏ hơn và nhanh hơn.

**Token**
Đơn vị cơ bản trong full-text indexing sau khi tách văn bản. Thường là từng từ, nhưng tùy tokenizer có thể là n-gram, ký tự đặc biệt, số, v.v.

**ts_rank / Relevance Score**
Điểm đánh giá mức độ liên quan của một document với query trong full-text search. Tính dựa trên tần suất xuất hiện, vị trí, và trọng số của các từ khoá. Dùng để sort kết quả theo độ phù hợp.

**tsvector (PostgreSQL)**
Kiểu dữ liệu đại diện cho một document đã được xử lý cho full-text search: danh sách token kèm vị trí và trọng số. Được tạo bằng hàm `to_tsvector()`.

**tsquery (PostgreSQL)**
Kiểu dữ liệu đại diện cho một search query đã được parse, hỗ trợ toán tử AND (`&`), OR (`|`), NOT (`!`), và phrase search. Được tạo bằng `to_tsquery()` hoặc `plainto_tsquery()`.

---

### TTL và MongoDB-specific

**TTL Index (Time To Live Index)**
Loại index đặc biệt trong MongoDB: tự động xóa documents sau một khoảng thời gian nhất định (khai báo bằng `expireAfterSeconds`). Hữu ích cho session data, log tạm thời, cache.

**Wildcard Index (MongoDB)**
Loại index trong MongoDB cho phép index tất cả các field trong một document, hoặc tất cả field trong một subdocument. Hữu ích cho collection có schema linh hoạt, không cố định.

**Compound Index (MongoDB)**
Tương đương Composite Index trong SQL: index trên nhiều field cùng lúc. Leftmost prefix rule cũng áp dụng tương tự.

---

## 16. Tóm tắt nhanh

```
DATABASE INDEX CHEAT SHEET
══════════════════════════════════════════════════════════════════

LOẠI INDEX          DÙNG CHO
──────────────────  ──────────────────────────────────────────────
B-Tree (default)    =, <, >, BETWEEN, LIKE 'x%', ORDER BY
Hash                Chi = (O(1), không hỗ trợ range)
GIN                 Array, JSONB, Full-text
GiST                Geometry, range types, nearest-neighbor
BRIN                Time-series, append-only, bảng rất lớn
Full-Text           Text search với stemming, ranking

══════════════════════════════════════════════════════════════════

NÊN INDEX                   KHÔNG NÊN INDEX
──────────────────────────  ──────────────────────────────────────
FK columns                  Bảng nhỏ < 10K rows
Cột dùng trong WHERE        Cột ít giá trị (bool, gender)
Cột dùng trong JOIN         Cột update liên tục
Cột dùng trong ORDER BY     Bảng write-heavy
Cardinality cao             Cột không bao giờ được query

══════════════════════════════════════════════════════════════════

COMPOSITE INDEX     Thứ tự: equality first, range last
                    Leftmost prefix rule
PARTIAL INDEX       Khi query luôn có WHERE cố định
COVERING INDEX      Khi muốn Index-Only Scan (không đọc heap)
EXPRESSION INDEX    Khi dùng function trong WHERE

══════════════════════════════════════════════════════════════════

ĐÁNH ĐỔI
──────────────────────────────────────────────────────────────────
READ nhanh hơn      Index giảm từ O(n) xuống O(log n)
WRITE chậm hơn      Mỗi index = overhead cho INSERT/UPDATE/DELETE
Tốn storage/RAM     Index chiếm disk space + RAM buffer pool

══════════════════════════════════════════════════════════════════

CÔNG CỤ THIẾT YẾU
──────────────────────────────────────────────────────────────────
EXPLAIN ANALYZE                  Xem query plan và thời gian thực
pg_stat_user_indexes             Tìm unused indexes (PostgreSQL)
sys.schema_unused_indexes        Tìm unused indexes (MySQL)
VACUUM ANALYZE                   Dọn dead tuples, cập nhật stats
REINDEX CONCURRENTLY             Rebuild index không lock (PG 12+)
CREATE INDEX CONCURRENTLY        Tạo index không lock (PostgreSQL)
```

---

*Mọi quyết định về index nên được đưa ra dựa trên dữ liệu thực tế từ `EXPLAIN ANALYZE` và slow query log — không phải cảm tính.*