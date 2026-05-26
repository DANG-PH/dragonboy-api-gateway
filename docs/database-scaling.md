# Mở rộng Database ở Quy mô lớn: Master-Replica, Sharding & Multi-Master Replication

> **Tài liệu tham khảo System Design** — tổng hợp đầy đủ về ba mô hình mở rộng (scale) database phổ biến nhất, kèm nền tảng lý thuyết, cơ chế hoạt động bên trong, và **danh mục lỗi đầy đủ** của từng mô hình với hiện tượng / nguyên nhân / cách chẩn đoán / cách fix / cách phòng tránh.
>
> Đối tượng: backend dev, SRE, DBA, và bất kỳ ai muốn hiểu sâu cách dữ liệu được tổ chức và đồng bộ ở quy mô lớn. Tài liệu không gắn với một hệ quản trị cụ thể nào, nhưng có ví dụ minh họa từ MySQL, PostgreSQL, SQL Server, MongoDB, Cassandra... khi cần.

---

## Mục lục

**Phần I — Nền tảng**
1. [Đặt vấn đề: tại sao một database lại không đủ?](#1-đặt-vấn-đề)
2. [Các trục đánh đổi: CAP, PACELC và các mô hình nhất quán](#2-các-trục-đánh-đổi)
3. [Replication hoạt động bên trong như thế nào?](#3-replication-bên-trong)
4. [Bức tranh tổng quát: 3 mô hình, 3 bài toán khác nhau](#4-bức-tranh-tổng-quát)

**Phần II — Ba mô hình**
5. [Master-Replica (Primary-Replica)](#5-master-replica)
6. [Sharding (Phân mảnh)](#6-sharding)
7. [Multi-Master Replication](#7-multi-master-replication)

**Phần III — Danh mục lỗi đầy đủ**
8. [Lỗi của Master-Replica](#8-lỗi-master-replica)
9. [Lỗi của Sharding](#9-lỗi-sharding)
10. [Lỗi của Multi-Master Replication](#10-lỗi-multi-master)
11. [Lỗi chung của mọi hệ phân tán](#11-lỗi-chung)

**Phần IV — Vận dụng**
12. [Bảng so sánh & cây quyết định chọn mô hình](#12-bảng-so-sánh)
13. [Kết hợp các mô hình trong thực tế](#13-kết-hợp)
14. [Checklist vận hành & giám sát](#14-checklist)
15. [Thuật ngữ](#15-thuật-ngữ)

---
---

# PHẦN I — NỀN TẢNG

## 1. Đặt vấn đề

Khi mới bắt đầu, gần như mọi hệ thống đều chạy trên **một database server duy nhất**. Ứng dụng đọc và ghi vào đó, mọi thứ đơn giản: một nguồn sự thật duy nhất, không có độ trễ đồng bộ, không có xung đột, transaction đảm bảo đầy đủ tính ACID. Đây luôn là lựa chọn đúng cho tới khi hệ thống chạm một trong các giới hạn dưới đây.

### 1.1. Bốn giới hạn buộc ta phải mở rộng

**Giới hạn về đọc (read throughput).** Khi số lượng truy vấn đọc tăng lên hàng nghìn, hàng chục nghìn mỗi giây, một server không còn đủ CPU và IO để phục vụ. Đây là giới hạn phổ biến nhất, vì đa số ứng dụng đọc nhiều hơn ghi rất nhiều lần.

**Giới hạn về ghi (write throughput).** Mọi lệnh ghi cuối cùng phải đi qua một điểm. Khi lượng ghi vượt khả năng của một máy, ta không thể chỉ thêm bản sao để đọc — phải chia tải ghi ra nhiều máy.

**Giới hạn về dung lượng (storage).** Một bảng hàng tỉ dòng, một database hàng chục terabyte sẽ vượt khả năng lưu trữ và đánh index hiệu quả của một máy. Backup, restore, và bảo trì cũng trở nên bất khả thi trong thời gian chấp nhận được.

**Giới hạn về vị trí địa lý và khả năng chịu lỗi.** Một server đặt ở một nơi nghĩa là người dùng ở xa chịu độ trễ cao, và nếu server đó chết thì toàn hệ thống chết. Nhiều nghiệp vụ còn cần ghi dữ liệu tại chỗ ở nhiều địa điểm và hoạt động được kể cả khi mất kết nối tới trung tâm.

### 1.2. Hai hướng mở rộng cơ bản

- **Scale vertically (theo chiều dọc):** nâng cấu hình một máy — thêm CPU, RAM, đĩa nhanh hơn. Đơn giản, không đổi kiến trúc, không sinh ra lỗi phân tán. Nhưng có trần (một máy chỉ to đến mức nào đó) và đắt theo cấp số nhân. Đừng coi thường hướng này: rất nhiều hệ thống lớn vẫn chạy trên một master mạnh được nâng cấp dần, vì nó tránh được toàn bộ lớp lỗi phân tán phức tạp.
- **Scale horizontally (theo chiều ngang):** thêm nhiều máy và phân phối dữ liệu/tải giữa chúng. Đây là nơi ba mô hình trong tài liệu này xuất hiện. Đổi lại khả năng mở rộng gần như không giới hạn, ta phải trả giá bằng độ phức tạp: đồng bộ, nhất quán, xung đột, và một loạt lỗi mới.

### 1.3. Điều quan trọng nhất cần nhớ

Ba mô hình — Master-Replica, Sharding, Multi-Master — **không thay thế nhau** mà giải quyết các bài toán khác nhau. Master-Replica giải bài toán đọc; Sharding giải bài toán dung lượng và ghi; Multi-Master giải bài toán ghi đa điểm và chịu lỗi địa lý. Thực tế, các hệ thống lớn thường **kết hợp cả ba** (xem [mục 13](#13-kết-hợp)). Hiểu rõ mỗi mô hình giải bài toán gì là điều kiện tiên quyết để chọn đúng — và để không tự rước vào những lớp lỗi không cần thiết.

---

## 2. Các trục đánh đổi

Trước khi đi vào từng mô hình, cần nắm vài định lý nền tảng. Chúng giải thích **vì sao** các lỗi ở Phần III tồn tại — phần lớn lỗi phân tán không phải do code dở, mà là hệ quả tất yếu của những đánh đổi vật lý không thể tránh.

### 2.1. Định lý CAP

Định lý CAP (Eric Brewer) phát biểu rằng một hệ lưu trữ dữ liệu phân tán chỉ có thể đảm bảo **tối đa hai trong ba** thuộc tính cùng lúc:

- **Consistency (C) — Nhất quán:** mọi lượt đọc đều nhận được lần ghi mới nhất hoặc một lỗi. Mọi node nhìn thấy cùng một dữ liệu tại cùng một thời điểm. Cần nhấn mạnh: chữ C trong CAP cụ thể nghĩa là **linearizability** — mô hình nhất quán mạnh nhất, chứ không phải chữ C trong ACID.
- **Availability (A) — Sẵn sàng:** mọi yêu cầu đều nhận được phản hồi không lỗi, nhưng không đảm bảo phản hồi đó chứa dữ liệu mới nhất. Mọi node còn sống đều phải trả lời.
- **Partition tolerance (P) — Chịu phân mảnh mạng:** hệ thống tiếp tục hoạt động dù mạng giữa các node bị chia cắt (thông điệp bị mất hoặc trễ).

Mấu chốt thực tế: **phân mảnh mạng (P) là điều không thể tránh** trong bất kỳ hệ phân tán thật nào — cáp đứt, switch hỏng, độ trễ vọt lên đều xảy ra. Vì P là bắt buộc, lựa chọn thực sự khi mạng bị chia cắt chỉ còn là **C hay A**:

- Chọn **CP** (hi sinh A): khi mạng chia cắt, từ chối phục vụ ở phía thiểu số để không trả về dữ liệu sai. Phù hợp khi đọc sai dữ liệu là thảm họa (giao dịch tài chính, tồn kho không được bán quá).
- Chọn **AP** (hi sinh C): khi mạng chia cắt, vẫn phục vụ ở mọi phía, chấp nhận dữ liệu có thể tạm thời không nhất quán. Phù hợp khi đọc dữ liệu cũ chỉ gây phiền chứ không nguy hiểm (feed mạng xã hội, đếm lượt thích).

### 2.2. PACELC — bức tranh đầy đủ hơn

CAP chỉ mô tả hành vi **khi đang có phân mảnh** — mà phân mảnh thì hiếm; phần lớn thời gian (>99.9%) mạng vẫn lành lặn. PACELC (Daniel Abadi) mở rộng CAP để bao quát cả lúc bình thường:

> **Nếu có Phân mảnh (P)** → chọn **A**vailability hay **C**onsistency.
> **Ngược lại (E)** → chọn **L**atency (độ trễ thấp) hay **C**onsistency.

Ý sâu xa: ngay cả khi mạng lành, muốn nhất quán mạnh thì các node phải phối hợp (round-trip xác nhận với nhau), và phối hợp thì thêm độ trễ. Nói cách khác, **nhất quán luôn phải trả giá bằng độ trễ**, kể cả không có sự cố mạng. Đây là lý do nhiều hệ chọn nhất quán yếu để đổi lấy phản hồi nhanh.

Vài ví dụ phân loại theo PACELC (theo các tài liệu system design):
- **DynamoDB, Cassandra (mặc định):** PA/EL — khi phân mảnh ưu tiên sẵn sàng; lúc bình thường ưu tiên độ trễ thấp.
- **MongoDB (mặc định majority), HBase:** PC/EC — ưu tiên nhất quán cả khi phân mảnh lẫn lúc bình thường.
- **Google Spanner, CockroachDB:** PC/EC — luôn nhất quán, chấp nhận độ trễ cao hơn (Spanner dùng đồng hồ nguyên tử TrueTime để thu hẹp cửa sổ bất khả dụng xuống mức mili-giây).
- **Cassandra với consistency level QUORUM:** chuyển thành PC/EC — cho thấy nhiều hệ có **nhất quán điều chỉnh được (tunable)** theo từng thao tác.

### 2.3. Phổ các mô hình nhất quán

"Nhất quán" không phải nhị phân (có/không) mà là một **phổ** từ mạnh tới yếu. Mỗi bước hạ thấp đổi một đảm bảo lấy thêm tính sẵn sàng / tốc độ:

| Mô hình | Đảm bảo | Đánh đổi |
|---|---|---|
| **Linearizability** (mạnh nhất) | Mọi thao tác như xảy ra tức thời tại một thời điểm, thấy được bởi mọi client theo đúng thứ tự thực | Phải từ chối request khi phân mảnh; độ trễ cao nhất |
| **Sequential consistency** | Các thao tác xuất hiện theo đúng thứ tự chương trình của từng tiến trình, nhưng không đảm bảo thời gian thực | Yếu hơn linearizable một chút |
| **Causal consistency** | Các thao tác có quan hệ nhân-quả xuất hiện cùng thứ tự ở mọi node | Không sắp thứ tự các thao tác không liên quan |
| **Read-your-writes** | Bạn luôn đọc được thứ chính mình vừa ghi | Không chống được đọc dữ liệu cũ do người khác ghi |
| **Monotonic reads** | Đã thấy một giá trị thì không "lùi" về giá trị cũ hơn | Đảm bảo phiên (session) chứ không toàn cục |
| **Eventual consistency** (yếu nhất) | Nếu ngừng ghi, cuối cùng mọi bản sao sẽ hội tụ về cùng giá trị | Cho phép sai lệch tạm thời; xung đột là việc của ứng dụng |

**Bài học áp dụng:** mức nhất quán nên chọn **theo từng thao tác**, không phải áp một mức cho cả hệ thống. Một hệ có thể dùng giao dịch linearizable cho thanh toán, causal cho nhắn tin, và eventual cho analytics — mỗi thứ chỉnh đúng theo nhu cầu thật. Eventual consistency phù hợp ở nơi xung đột vô hại hoặc dễ giải quyết (DNS, đếm like, giỏ hàng — vì thêm vào giỏ là cộng dồn, xử lý xung đột lúc thanh toán); không phù hợp ở nơi không được phép bán quá số lượng.

---

## 3. Replication bên trong

Cả ba mô hình đều ít nhiều dựa vào **replication** — sao chép thay đổi từ node này sang node khác. Hiểu cơ chế bên trong giúp chẩn đoán lỗi nhanh hơn rất nhiều, vì phần lớn lỗi đồng bộ bắt nguồn từ chính cách thay đổi được ghi lại và truyền đi.

### 3.1. Ba cách ghi lại thay đổi để truyền đi

**(a) Statement-based (theo câu lệnh).** Ghi lại chính câu lệnh SQL đã chạy (ví dụ `INSERT INTO users VALUES (1,'Peter')`) rồi gửi sang node kia chạy lại. Gọn nhẹ về dung lượng, nhưng **nguy hiểm với lệnh không tất định** (non-deterministic): `NOW()`, `RAND()`, `UUID()`, hay `UPDATE ... LIMIT` không kèm ORDER BY có thể cho kết quả khác nhau ở mỗi node, dẫn tới dữ liệu phân kỳ. Cũng gặp vấn đề với trigger và stored routine.

**(b) Row-based / Logical (theo dòng).** Ghi lại **kết quả thay đổi ở mức dòng** — ví dụ "dòng id=1 đổi từ trạng thái A sang trạng thái B", thường gồm cả ảnh "before" và "after". An toàn vì không phụ thuộc tính tất định, tách rời khỏi nội bộ storage engine (cho phép replicate giữa các phiên bản hoặc thậm chí khác hệ), và cho phép replicate chọn lọc. Nhược điểm: một lệnh sửa hàng triệu dòng sẽ sinh ra lượng log lớn hơn nhiều so với chỉ ghi một câu lệnh. MySQL gọi đây là binlog dạng ROW; PostgreSQL có logical replication; MongoDB dùng oplog.

**(c) Mixed (hỗn hợp).** Tự động chọn statement-based cho các lệnh đơn giản, tất định và row-based cho các lệnh rủi ro. Đây thường là lựa chọn cân bằng tốt. (Lưu ý: MySQL 8.0 đã đánh dấu `binlog_format` là deprecated và đang hướng tới chỉ còn ROW.)

Ngoài ra còn **WAL shipping / physical replication** (PostgreSQL): gửi nguyên chuỗi byte ghi vào Write-Ahead Log. Rất chính xác và hiệu quả, nhưng gắn chặt với storage engine — leader và follower phải gần như cùng phiên bản.

### 3.2. Đồng bộ, bất đồng bộ, bán đồng bộ

- **Asynchronous (bất đồng bộ):** node nguồn ghi xong là báo "OK" cho client ngay, rồi mới gửi thay đổi đi sau. Nhanh nhất, nhưng nếu node nguồn chết trước khi kịp gửi thì **mất dữ liệu**, và bản sao luôn trễ một nhịp (nguồn gốc của replication lag).
- **Synchronous (đồng bộ):** node nguồn chờ ít nhất một bản sao xác nhận đã nhận xong (ACK) mới báo "OK". An toàn, không mất dữ liệu, nhưng chậm và nếu bản sao đó treo thì ghi cũng treo theo.
- **Semi-synchronous (bán đồng bộ):** thỏa hiệp — chờ một bản sao xác nhận đã *nhận* (chưa cần *áp dụng*), các bản còn lại đồng bộ tiếp sau. Cân bằng giữa độ bền dữ liệu và tốc độ.

### 3.3. Theo dõi vị trí đồng bộ

Để bản sao biết mình đã đồng bộ đến đâu, các hệ dùng một con trỏ vị trí. Cách cũ là toạ độ file log (ví dụ binlog file + offset). Cách hiện đại hơn của MySQL là **GTID (Global Transaction Identifier)** — mỗi transaction được gán một định danh toàn cục dạng `server_uuid:số`; chỉ cần bản sao đã chạy hết tập GTID của nguồn là nó nhất quán, không phải theo dõi toạ độ file thủ công. GTID giúp failover và chuyển nguồn dễ hơn nhiều. (Kiến trúc MySQL là pull-based: bản sao chủ động kéo sự kiện từ nguồn về relay log rồi mới áp dụng.)

Việc hiểu các khái niệm này rất hữu ích khi gỡ lỗi: khi nghe "lag tăng", "GTID gap", "binlog format sai gây drift", bạn biết ngay đang nói về cơ chế nào.

---

## 4. Bức tranh tổng quát

Hình dung nhanh sự khác nhau bằng một phép ví von quen thuộc:

| Mô hình | Ví dụ ví von | Giải quyết gì | Ai được ghi? | Dữ liệu ở mỗi node |
|---|---|---|---|---|
| **Master-Replica** | 1 người viết sách, nhiều máy photocopy phát cho người đọc | Quá nhiều **đọc** | Chỉ master | Bản sao **đầy đủ** |
| **Sharding** | Bộ từ điển chia thành nhiều tập A-G, H-N, O-Z | Quá nhiều **dữ liệu/ghi** | Mỗi shard ghi phần của nó | Mỗi nơi **một mảnh** |
| **Multi-Master** | Nhiều chi nhánh cùng ghi sổ, định kỳ gộp sổ với nhau | Cần ghi ở **nhiều nơi**, chịu lỗi mạng | **Mọi node** | Bản sao (có thể lọc) |

Ba từ khóa cốt lõi để khỏi nhầm lẫn về sau:
- **Master-Replica = nhân bản một chiều.** Một nơi ghi, nhiều nơi sao chép để đọc.
- **Sharding = chia tách.** Không nhân bản; mỗi nơi giữ một phần khác nhau.
- **Multi-Master = nhân bản hai chiều.** Nhiều nơi cùng ghi rồi trộn lại.

Một lưu ý phân biệt quan trọng mà nhiều người nhầm: **Sharding không phải replication.** Sharding chia dữ liệu (mỗi shard một mảnh, gộp lại mới đủ); replication nhân bản dữ liệu (mỗi node một bản giống nhau). Hai khái niệm này trực giao và thường được dùng cùng nhau — ví dụ shard dữ liệu ra nhiều mảnh, rồi mỗi mảnh lại có replica riêng.

---
---

# PHẦN II — BA MÔ HÌNH

## 5. Master-Replica

### 5.1. Ý tưởng

Có **một node Master** (còn gọi là Primary/Leader) chịu trách nhiệm nhận **mọi lệnh ghi** (INSERT/UPDATE/DELETE). Sau khi ghi xong, Master sao chép các thay đổi đó xuống một hoặc nhiều **Replica** (còn gọi là Slave/Secondary/Follower). Các Replica phục vụ **đọc**, và thường là chỉ đọc.

```
                 ┌─────────────┐
   WRITE ───────▶│   MASTER    │
                 │  (ghi+đọc)  │
                 └──────┬──────┘
                        │ replicate (một chiều)
            ┌───────────┼───────────┐
            ▼           ▼           ▼
       ┌────────┐  ┌────────┐  ┌────────┐
       │Replica1│  │Replica2│  │Replica3│   ◀─── READ
       │ (đọc)  │  │ (đọc)  │  │ (đọc)  │
       └────────┘  └────────┘  └────────┘
```

### 5.2. Giải quyết bài toán gì

Phù hợp nhất với hệ thống **đọc nhiều hơn ghi rất nhiều** (read-heavy) — đúng với đa số web/app: feed mạng xã hội, trang sản phẩm thương mại điện tử, blog, trang tin. Thêm bao nhiêu Replica thì gánh được bấy nhiêu lượt đọc, gần như tuyến tính. Ngoài scale đọc, mô hình còn cho hai lợi ích lớn:

- **Khả năng chịu lỗi (high availability):** nếu Master chết, có thể "thăng cấp" (promote) một Replica lên làm Master mới.
- **Sao lưu không ảnh hưởng production:** chạy backup nặng trên một Replica thay vì trên Master.

### 5.3. Các kiểu triển khai

- **Single-leader, nhiều follower:** mô hình cơ bản như hình trên.
- **Chuỗi (cascading/relay):** Master → Replica trung gian → các Replica con. Giảm tải replicate cho Master khi có rất nhiều Replica, nhưng tăng độ trễ ở các tầng cuối.
- **Đa vùng (cross-region):** Replica đặt ở nhiều vùng địa lý để người dùng đọc từ vùng gần nhất, giảm latency.

### 5.4. Định tuyến đọc/ghi (read/write splitting)

Ứng dụng phải gửi lệnh ghi tới Master và lệnh đọc tới Replica. Việc này thường do một tầng trung gian lo: proxy (ProxySQL, HAProxy, PgBouncer + tầng routing), connection pool có nhận biết vai trò, hoặc logic ở tầng ứng dụng/ORM. Đây cũng là nơi nảy sinh nhiều lỗi tinh tế (xem [mục 8](#8-lỗi-master-replica)) — ví dụ đọc ngay sau khi ghi mà rơi vào Replica chưa cập nhật.

### 5.5. Ví dụ thực tế

Một kiến trúc điển hình: ứng dụng web đặt sau một proxy; mọi `SELECT` đi tới một trong các read-replica (cân bằng tải vòng tròn), mọi `INSERT/UPDATE/DELETE` đi tới master. Khi traffic đọc tăng, chỉ cần thêm replica. Đa số dịch vụ database quản lý trên cloud (Amazon RDS Read Replicas, Google Cloud SQL, Azure Database) cung cấp sẵn mô hình này chỉ với vài cú nhấp.

---

## 6. Sharding

### 6.1. Ý tưởng

Thay vì nhân bản toàn bộ dữ liệu, sharding **chia nhỏ dữ liệu thành nhiều phần rời nhau**, mỗi phần đặt trên một server riêng gọi là **shard**. Mỗi shard chỉ giữ **một mảnh** của tập dữ liệu; gộp tất cả shard lại mới ra toàn bộ. Không node nào có bản đầy đủ.

```
   App muốn lấy user_id = 7?
            │
            ▼
   ┌─────────────────┐
   │  Shard Router   │  (tính: hash(7) % 3 → shard nào?)
   └────────┬────────┘
     ┌──────┼──────┐
     ▼      ▼      ▼
 ┌──────┐┌──────┐┌──────┐
 │Shard0││Shard1││Shard2│
 │user  ││user  ││user  │
 │0,3,6 ││1,4,7 ││2,5,8 │   ◀── mỗi shard giữ một phần KHÁC NHAU
 └──────┘└──────┘└──────┘
```

### 6.2. Giải quyết bài toán gì

Khi **dữ liệu quá lớn** (hàng tỉ dòng, hàng TB) hoặc **lượng ghi quá cao** đến mức một máy không gánh nổi. Vì mỗi shard chỉ giữ một phần, cả dung lượng lẫn tải ghi được chia ra nhiều máy. Đây là cách duy nhất trong ba mô hình thực sự **scale được tải ghi và dung lượng** theo chiều ngang.

### 6.3. Cách chọn shard key — yếu tố quyết định thành bại

**Shard key** (khóa phân mảnh) là cột dùng để quyết định một dòng dữ liệu nằm ở shard nào. Đây là quyết định thiết kế quan trọng nhất của sharding: chọn sai shard key là nguyên nhân gốc của hầu hết vấn đề (hotspot, cross-shard query, resharding đau đớn). Một shard key tốt cần: phân bố dữ liệu đều, bám theo pattern truy vấn (để đa số truy vấn chỉ chạm một shard), và có đủ độ phân tán (cardinality cao).

### 6.4. Các chiến lược phân mảnh

**Range-based (theo khoảng giá trị).** Chia theo khoảng: user_id 1–1000 ở shard 1, 1001–2000 ở shard 2. Ưu điểm: truy vấn theo khoảng (`BETWEEN`) hiệu quả vì chỉ chạm một shard. Nhược điểm: dễ lệch tải — nếu dữ liệu dồn vào một khoảng (ví dụ nhiều tên bắt đầu bằng "A"), shard đó phình to và quá tải.

**Hash-based (theo hàm băm).** Đưa shard key qua hàm hash rồi chia shard (`hash(key) % N`). Ưu điểm: phân bố rất đều, tránh hotspot. Nhược điểm: truy vấn theo khoảng phải quét tất cả shard; và resharding khó vì đổi N làm gần như mọi key phải tính lại.

**Directory / Lookup-based (theo bảng tra cứu).** Giữ một bảng ánh xạ key → shard. Linh hoạt nhất (đổi shard không cần đổi key, dễ rebalance), nhưng bảng tra cứu trở thành điểm chết (single point of failure) và thêm một bước tra cứu (latency).

**Geo-based (theo vị trí địa lý).** Users Bắc Mỹ → shard US, châu Âu → shard EU. Giảm latency cho người dùng theo vùng và hỗ trợ tuân thủ quy định lưu trú dữ liệu (data residency), nhưng dễ lệch (vùng này có thể đông gấp nhiều lần vùng khác).

### 6.5. Consistent Hashing — giải bài toán resharding

Với hash đơn giản `hash(key) % N`, khi thêm/bớt shard (N đổi) thì gần như **toàn bộ** key phải dời chỗ — cực kỳ tốn kém. **Consistent Hashing** (băm nhất quán) giải quyết bằng cách sắp các shard và key lên một "vòng tròn băm"; khi thêm/bớt một node, chỉ một phần nhỏ key lân cận phải dời, phần còn lại đứng yên. Đây là kỹ thuật nền tảng của Cassandra, DynamoDB và nhiều hệ phân tán.

### 6.6. Ví dụ thực tế: Instagram

Khi Instagram mở rộng tới hàng triệu ảnh, họ cần sinh ID duy nhất cho ảnh trải trên hàng nghìn shard PostgreSQL mà không dùng auto-increment (vì auto-increment đụng độ giữa nhiều server). Giải pháp của họ là **nhúng luôn shard ID vào trong khóa chính** — một ID 64-bit chứa sẵn thông tin shard. Nhờ đó, chỉ cần đọc ID là biết ngay dữ liệu nằm ở shard nào, không cần bảng tra cứu toàn cục. Đây là minh họa kinh điển cho việc thiết kế khóa và shard key đi đôi với nhau.

### 6.7. Công cụ hỗ trợ

Ngày nay không nhất thiết tự xây tầng sharding. Vitess và Citus là các lớp sharding mã nguồn mở đặt trước MySQL/PostgreSQL, lo phần định tuyến truy vấn, thao tác xuyên shard, và resharding online. Các dịch vụ cloud như AWS Aurora, Google Cloud Spanner cung cấp SQL phân tán với sharding tích hợp sẵn. Với NoSQL, MongoDB (range/hash/zone sharding) và Cassandra (consistent hashing) có sharding là tính năng cốt lõi.

---

## 7. Multi-Master Replication

> Đây là mô hình phức tạp nhất trong ba mô hình, và cũng là nơi phát sinh nhiều loại lỗi đặc thù nhất. SQL Server gọi triển khai của nó là **Merge Replication**; các hệ khác có MySQL Group Replication, Galera Cluster, BDR cho PostgreSQL, hoặc các hệ NoSQL như Cassandra/Riak/CouchDB. Danh mục lỗi đầy đủ nằm ở [mục 10](#10-lỗi-multi-master).

### 7.1. Ý tưởng

Khác hẳn master-replica (chỉ một node ghi), trong multi-master **mọi node đều có thể nhận ghi**. Mỗi node giữ một bản sao của dữ liệu, ghi vào bản của mình, rồi định kỳ **trộn (merge) thay đổi của tất cả các node lại với nhau**. Dữ liệu chảy **hai chiều**.

```
   WRITE ──▶┌────────┐◀──────▶┌────────┐◀── WRITE
            │ Node A │  merge │ Node B │
            │(ghi+đọc)│◀─────▶│(ghi+đọc)│
            └────┬───┘        └───┬────┘
                 │   ▲        ▲   │
                 ▼   └────────┘   ▼
                  ┌────────────┐
       WRITE ────▶│   Node C   │◀──── READ
                  │ (ghi+đọc)  │
                  └────────────┘
   → Mọi node đều ghi được. Thay đổi được trộn hai chiều giữa tất cả các node.
```

Tên gọi khác: **active-active replication**. Phân biệt với master-replica (active-passive): ở active-passive chỉ một node hoạt động cho ghi, các node kia thụ động; ở active-active mọi node đều chủ động.

### 7.2. Giải quyết bài toán gì

- **Ghi ở nhiều vị trí địa lý:** nhiều chi nhánh/văn phòng/cửa hàng ở xa, mỗi nơi cần ghi vào database tại chỗ cho nhanh rồi đồng bộ với nhau, không phải gửi mọi lệnh ghi về một trung tâm xa.
- **Hoạt động offline:** một điểm bán hàng (POS) vẫn bán được khi mất mạng; dữ liệu merge khi có mạng trở lại.
- **Chịu lỗi cao và ghi liên tục:** một node chết, các node khác vẫn nhận ghi bình thường — không có "thời gian chết để failover" như master-replica.

Đây là lý do mô hình này phổ biến trong **chuỗi bán lẻ, hệ thống POS offline, phần mềm doanh nghiệp đa chi nhánh, ứng dụng cộng tác**. Trong các tình huống thực tế, người ta dùng merge replication để đồng bộ hàng trăm địa điểm về một trung tâm.

### 7.3. Ba vai trò trong SQL Server Merge Replication

Triển khai cụ thể của Microsoft đặt tên ba vai trò, hữu ích để hiểu các lỗi khởi tạo ở mục 10:

- **Publisher:** server nắm dữ liệu gốc (thường là trung tâm), "công bố" một tập bảng cần đồng bộ thành một **publication**.
- **Distributor:** kho trung gian chứa **snapshot** và metadata đồng bộ (thường nằm chung Publisher).
- **Subscriber:** các server nhận dữ liệu (các chi nhánh), "đăng ký" (subscribe) vào publication.

Quy trình:
1. **Snapshot Agent** chụp toàn bộ dữ liệu hiện tại của các bảng, đóng gói thành file (`.bcp`, `.cab`...) để vào **thư mục snapshot** (thường chia sẻ qua mạng dạng UNC `\\server\share`).
2. **Merge Agent** đọc file từ thư mục snapshot và **copy/khởi tạo dữ liệu xuống từng Subscriber**. Đây là bước "deliver the snapshot to the Subscriber".
3. Sau khi khởi tạo xong, Merge Agent chạy theo lịch, gom thay đổi hai chiều và trộn lại. Nếu cùng một dòng bị sửa ở hai nơi → áp dụng **conflict resolver**.

### 7.4. Vấn đề cốt lõi của mọi multi-master: CONFLICT

Vì nhiều node cùng ghi, việc hai node sửa cùng một dòng theo hai hướng khác nhau là **không thể tránh khỏi**. Khi merge lại, hệ thống phải quyết định giữ giá trị nào. Conflict xảy ra khi hai hay nhiều database nhận các cập nhật mâu thuẫn lên cùng một bản ghi mà không thể quy về một giá trị duy nhất một cách tất định.

Ở single-master, conflict được tránh tự nhiên vì mọi ghi đi tuần tự qua một điểm — lệnh ghi sau ghi đè lệnh trước, thứ tự rõ ràng. Ở multi-master, ghi có thể đến bất kỳ node nào, nên thách thức là **xác định thứ tự các thao tác** để biết cái nào đến sau cùng.

**Các chiến lược xử lý conflict:**

- **Last Write Wins (LWW):** gán mỗi ghi một timestamp hoặc ID; cái có giá trị lớn nhất thắng. Đơn giản nhưng **dễ mất dữ liệu**, vì các ghi "đồng thời" không thực sự đồng thời theo đồng hồ tường, và bên thua bị âm thầm vứt bỏ. Cassandra, Riak dùng cách này.
- **Theo độ ưu tiên (precedence):** quy định trước site/node nào thắng (ví dụ trung tâm luôn thắng chi nhánh).
- **Globally unique ID tăng dần:** gán ID đơn điệu toàn cục cho mỗi thao tác để mô phỏng thứ tự ghi như single-master mà không làm nghẽn throughput. ID lớn nhất thắng (mô phỏng LWW nhưng có thứ tự rõ ràng).
- **Giữ tất cả phiên bản, giải quyết lúc đọc (merge on read):** lưu mọi phiên bản xung đột (siblings), trả về cho ứng dụng/người dùng tự gộp. Riak, CouchDB (revision tree) dùng cách này.
- **Custom merge logic:** code ứng dụng tự gộp theo luật nghiệp vụ — ví dụ cộng dồn số lượng tồn kho thay vì ghi đè, hoặc gộp giỏ hàng.
- **CRDT (Conflict-Free Replicated Data Types):** cấu trúc dữ liệu được thiết kế để **luôn merge được mà không cần giải quyết xung đột** (tập hợp, bộ đếm, register). Đây là hướng hiện đại và mạnh nhất cho dữ liệu phù hợp (ví dụ soạn thảo cộng tác).

**Nguyên tắc vàng:** chọn chiến lược resolver **theo nghiệp vụ**, không để mặc định. Với dữ liệu kiểu số dư/tồn kho, LWW rất nguy hiểm; nên dùng custom merge hoặc CRDT.

### 7.5. Topology multi-master

- **All-to-all (lưới đầy đủ):** mọi node nối với mọi node. Mạnh nhưng phức tạp, dễ sinh vòng lặp và xung đột.
- **Ring (vòng):** mỗi node nối hai hàng xóm. Đơn giản hơn nhưng một node chết có thể đứt vòng, và dễ gây replication loop nếu thiếu cơ chế nhận diện nguồn gốc thay đổi.
- **Hub-and-spoke (sao):** một hub trung tâm, các node con đồng bộ qua hub. Dễ quản lý nhất; hub là điểm tập trung (cũng là điểm yếu nếu hub chết). Đây là dạng hay dùng cho mô hình trung tâm — chi nhánh.

---
---

# PHẦN III — DANH MỤC LỖI ĐẦY ĐỦ

> Mỗi lỗi trình bày theo cấu trúc thống nhất: **Hiện tượng** (thấy gì) → **Nguyên nhân** (vì sao) → **Chẩn đoán** (cách xác định) → **Cách xử lý từng bước** (làm gì, theo thứ tự) → **Phòng tránh** (để không tái diễn).
>
> Phần "Cách xử lý từng bước" được viết cầm-tay-chỉ-việc: làm tuần tự từ bước 1, dừng lại ngay khi vấn đề được giải quyết. Lệnh ví dụ dùng cú pháp phổ biến (MySQL/PostgreSQL/SQL Server) — hãy thay tên bảng/biến cho khớp hệ của bạn và luôn thử trên môi trường test trước khi áp lên production.

## 8. Lỗi Master-Replica

### 8.1. Replication Lag — Replica đọc ra dữ liệu cũ

**Hiện tượng:** User vừa tạo bình luận/đơn hàng, refresh lại thì không thấy. Hoặc hai user thấy số liệu khác nhau tùy họ rơi vào replica nào.

**Nguyên nhân:** Replication bất đồng bộ — Master báo "OK" trước khi Replica kịp cập nhật. Lệnh ghi vào Master nhưng lệnh đọc ngay sau đó rơi vào Replica còn trễ. Lag tăng khi Replica quá tải, mạng chậm, hoặc Master sinh thay đổi nhanh hơn tốc độ Replica áp dụng.

**Chẩn đoán:** MySQL — `SHOW REPLICA STATUS\G` rồi xem `Seconds_Behind_Master`. PostgreSQL — chạy `SELECT now() - pg_last_xact_replay_timestamp();` trên replica để biết nó trễ bao lâu, hoặc xem view `pg_stat_replication` trên primary.

**Cách xử lý từng bước:**
1. **Xác nhận đây đúng là lag**, không phải replica đã chết: chạy lệnh chẩn đoán ở trên. Nếu `Seconds_Behind_Master` là số lớn và đang tăng → đúng là lag. Nếu là `NULL` → replica đã dừng (xem mục 8.6).
2. **Xử lý ngay cho trải nghiệm người dùng:** với thao tác mà user vừa ghi và cần thấy lại ngay, tạm thời cho **đọc từ Master** trong vài giây sau khi ghi (gọi là read-your-own-writes). Cách đơn giản: sau khi ghi, gắn cờ trong session "đọc từ master trong N giây".
3. **Tìm nguyên nhân lag tăng:** kiểm tra CPU/IO của replica (đang quá tải?), băng thông mạng giữa master–replica, và có query nặng nào đang chạy trên replica chặn việc áp dụng thay đổi không.
4. **Tăng tốc độ replica áp dụng thay đổi:** bật **multi-threaded replication** (MySQL: đặt `replica_parallel_workers` > 0) để replica áp song song thay vì đơn luồng.
5. **Nếu lag vẫn cao do thiếu tài nguyên:** nâng cấu hình replica, hoặc tách bớt tải đọc sang replica khác.
6. **Với dữ liệu nhạy cảm:** chuyển sang **semi-synchronous** để giảm khả năng đọc cũ (đánh đổi: ghi chậm hơn một chút).

**Phòng tránh:** Thiết kế ứng dụng chịu được dữ liệu hơi cũ ở luồng không quan trọng; chỉ ép đọc-từ-master ở nơi thật cần. Đặt cảnh báo khi lag vượt ngưỡng (ví dụ > 5 giây).

### 8.2. Failover thất bại & Split-brain khi Master chết

**Hiện tượng:** Master chết, hệ promote một Replica lên. Nhưng Master cũ sống lại và **cả hai cùng tưởng mình là Master**, cùng nhận ghi → dữ liệu phân kỳ nghiêm trọng.

**Nguyên nhân:** Thiếu cơ chế "trọng tài" quyết định ai mới thật sự là Master khi mạng bị chia cắt; hai phía không liên lạc được nhưng đều còn sống.

**Chẩn đoán:** Sau sự cố, kiểm tra trạng thái ghi của từng node — phát hiện hai node cùng cho ghi, hoặc dữ liệu hai bên có bản ghi mâu thuẫn trong cùng khoảng thời gian.

**Cách xử lý từng bước (khi split-brain ĐÃ xảy ra):**
1. **Ngừng ghi ngay vào cả hai node** để không làm phân kỳ thêm — đưa cả hai về read-only (MySQL: `SET GLOBAL super_read_only = ON;`). Đây là việc khẩn cấp đầu tiên.
2. **Chọn node làm nguồn sự thật:** thường là node có dữ liệu mới/đúng hơn theo nghiệp vụ, hoặc node đã phục vụ phần lớn traffic. Ghi lại quyết định này.
3. **Trích xuất phần dữ liệu phân kỳ** ở node kia: tìm các bản ghi được tạo/sửa trong khoảng thời gian split-brain mà không có ở node nguồn sự thật.
4. **Hợp nhất thủ công theo nghiệp vụ:** với từng bản ghi phân kỳ, quyết định giữ giá trị nào (hoặc gộp). Đây là bước đau đớn, làm cẩn thận, có thể cần người hiểu nghiệp vụ tham gia.
5. **Đưa node nguồn sự thật làm Master chính thức**, rebuild node kia thành Replica sạch từ node nguồn (xem 8.3 bước rebuild).
6. **Khôi phục ghi** sau khi đã thống nhất một Master duy nhất.

**Phòng tránh (quan trọng hơn xử lý):**
1. Dùng **quorum** (quá bán): node không thuộc nhóm quá bán thì tự ngừng nhận ghi.
2. Thêm **witness node** làm bên thứ ba phá hòa khi bầu master (đặc biệt cần khi chỉ có 2 node chính).
3. Bật **fencing / STONITH** — tự động cô lập (ngắt mạng/tắt) Master cũ trước khi promote, để nó không nhận ghi khi sống lại.
4. Dùng công cụ failover đã kiểm chứng (**Patroni** cho PostgreSQL; **Orchestrator** hoặc **MHA** cho MySQL) thay vì tự viết script promote.

### 8.3. Data drift — Replica lệch dữ liệu so với Master

**Hiện tượng:** Sau một thời gian, vài dòng trên Replica khác Master dù không ai cố ý ghi vào Replica.

**Nguyên nhân:** (a) ai đó lỡ ghi trực tiếp vào Replica; (b) statement-based replication với lệnh không tất định (`NOW()`, `RAND()`, trigger) cho kết quả khác nhau; (c) một transaction replicate lỗi bị bỏ qua.

**Chẩn đoán:** Dùng công cụ so sánh checksum từng bảng — MySQL: `pt-table-checksum` (Percona Toolkit) báo bảng/dòng nào lệch.

**Cách xử lý từng bước:**
1. **Đo mức độ lệch trước:** chạy `pt-table-checksum` để biết những bảng nào, bao nhiêu dòng lệch. Đừng vội sửa khi chưa biết phạm vi.
2. **Nếu lệch ít (vài dòng/vài bảng):** dùng `pt-table-sync` để đồng bộ lại đúng các dòng lệch đó từ Master sang Replica. Chạy thử với chế độ in ra (`--print`) trước, xem nó định làm gì, rồi mới `--execute`.
3. **Nếu lệch nhiều/không rõ phạm vi:** an toàn nhất là **rebuild Replica từ đầu**:
   a. Đặt Replica offline khỏi pool đọc.
   b. Tạo bản sao mới từ Master (snapshot/backup nhất quán, ví dụ `xtrabackup` cho MySQL hoặc `pg_basebackup` cho PostgreSQL).
   c. Nạp bản sao vào Replica, trỏ nó replicate tiếp từ đúng vị trí (GTID/LSN).
   d. Chờ nó bắt kịp, rồi đưa lại vào pool.
4. **Tìm và chặn nguyên nhân gốc** (xem phòng tránh) trước khi đưa replica trở lại, nếu không sẽ lệch lại.

**Phòng tránh:**
1. Đặt Replica **read-only** ở tầng cấu hình (`read_only=ON` và `super_read_only=ON` trong MySQL) để không ai ghi nhầm.
2. Dùng **row-based hoặc mixed** thay cho statement-based (`binlog_format=ROW`).
3. Giám sát checksum định kỳ (chạy `pt-table-checksum` theo lịch).

### 8.4. Master quá tải vì gánh toàn bộ ghi

**Hiện tượng:** Thêm Replica giúp đọc nhanh hơn, nhưng hệ vẫn nghẽn khi lượng ghi tăng; Master CPU/IO cao chót vót.

**Nguyên nhân:** Master-Replica chỉ scale **đọc**. Mọi ghi vẫn dồn về một Master — giới hạn cố hữu của mô hình, không phải lỗi cấu hình.

**Chẩn đoán:** Xác nhận nút thắt nằm ở ghi chứ không phải đọc: nếu CPU/IO Master cao trong khi các Replica rảnh, và phần lớn tải là INSERT/UPDATE/DELETE → đúng là giới hạn ghi.

**Cách xử lý từng bước:**
1. **Giảm ghi không cần thiết trước (rẻ nhất):** gom nhiều ghi nhỏ thành **batch** (một INSERT nhiều dòng thay vì nhiều INSERT một dòng); bỏ các ghi thừa (ví dụ cập nhật "last_seen" mỗi request → giảm tần suất).
2. **Đệm ghi bằng hàng đợi:** đẩy các ghi không cần tức thời qua message queue (Kafka/RabbitMQ) rồi ghi vào DB theo nhịp chịu được, làm phẳng các đỉnh tải.
3. **Dùng cache để bớt cả đọc lẫn ghi suy ra từ đọc** (ví dụ đếm view không ghi DB mỗi lần).
4. **Scale vertically Master:** nâng CPU/RAM/đĩa SSD nhanh hơn — đơn giản, hiệu quả, nên thử trước khi sharding.
5. **Nếu vẫn không đủ → chuyển sang Sharding** (mục 6) để chia tải ghi ra nhiều máy. Đây là bước lớn, đọc kỹ các lỗi sharding ở mục 9 trước khi làm.

**Phòng tránh:** Theo dõi xu hướng tải ghi để lên kế hoạch sớm; thiết kế để nhiều thao tác ghi có thể trì hoãn/gom batch ngay từ đầu.

### 8.5. Replica bị "ngốn" bởi truy vấn phân tích nặng

**Hiện tượng:** Một báo cáo/analytic query chạy trên Replica làm nó chậm hẳn, kéo lag tăng và ảnh hưởng các đọc khác.

**Nguyên nhân:** Trộn lẫn tải OLTP (nhanh, nhiều) với OLAP (nặng, quét lớn) trên cùng một Replica.

**Chẩn đoán:** Khi lag tăng, kiểm tra query đang chạy trên replica (`SHOW PROCESSLIST` / `pg_stat_activity`) — nếu có truy vấn quét bảng lớn chạy lâu → đúng nguyên nhân.

**Cách xử lý từng bước:**
1. **Trước mắt:** dừng/hoãn truy vấn phân tích nặng đang chạy để replica phục vụ traffic chính trở lại.
2. **Tách một Replica chuyên cho analytics:** thêm một replica riêng, định tuyến mọi báo cáo/truy vấn nặng về đó, không cho nó phục vụ traffic người dùng.
3. **Nếu báo cáo rất nặng và thường xuyên:** đẩy dữ liệu sang **kho phân tích riêng** (data warehouse như BigQuery/Redshift/ClickHouse) thay vì query trực tiếp trên replica vận hành. Dùng cơ chế đồng bộ/CDC để nạp dữ liệu sang kho.
4. **Đặt giới hạn thời gian truy vấn** (statement timeout) trên replica vận hành để một query lỗi không chiếm tài nguyên vô hạn.

**Phòng tránh:** Ngay từ đầu phân tách rõ replica nào phục vụ traffic, replica nào phục vụ analytics; không để báo cáo ad-hoc chạy trên replica vận hành.

### 8.6. "Replication broke" — luồng đồng bộ dừng vì một lệnh lỗi

**Hiện tượng:** Replica ngừng cập nhật hoàn toàn; lag tăng vô hạn (hoặc `Seconds_Behind_Master = NULL`); log báo lỗi tại một transaction cụ thể.

**Nguyên nhân:** Một sự kiện replicate không áp được ở Replica — dòng cần UPDATE/DELETE không tồn tại (do drift trước đó), vi phạm khóa, hoặc khác schema. Replica dừng để không hỏng thêm.

**Chẩn đoán:** MySQL — `SHOW REPLICA STATUS\G` xem `Last_Error` và `Last_SQL_Error` để biết lỗi cụ thể và transaction nào. PostgreSQL — xem log của standby.

**Cách xử lý từng bước:**
1. **Đọc kỹ thông báo lỗi cụ thể** — nó cho biết transaction nào, bảng nào, vi phạm gì. Đừng vội bỏ qua lỗi.
2. **Phân loại lỗi:**
   - Nếu do **khác schema** (cột thiếu/khác kiểu): sửa schema replica cho khớp master, rồi cho replication chạy tiếp.
   - Nếu do **dòng không tồn tại / đã tồn tại** (drift): đây là triệu chứng của data drift — nên xử lý theo mục 8.3 (so checksum, sync hoặc rebuild).
3. **Chỉ khi chắc chắn sự kiện lỗi vô hại** (ví dụ một DELETE dòng vốn đã không còn) mới cân nhắc **bỏ qua nó**: MySQL với GTID dùng cách inject một transaction rỗng cho đúng GTID lỗi rồi tiếp tục; KHÔNG bỏ qua máy móc nhiều lỗi liên tiếp vì sẽ tích lũy drift.
4. **Cho replication chạy tiếp** (`START REPLICA;`) và xác nhận lag bắt đầu giảm.
5. **Nếu nghi ngờ tính toàn vẹn** sau khi xử lý: rebuild replica cho chắc (mục 8.3 bước 3).

**Phòng tránh:** Tránh drift ngay từ đầu (mục 8.3); dùng GTID để theo dõi và xử lý gap chính xác; không bao giờ ghi trực tiếp vào Replica.

### 8.7. Mất dữ liệu khi failover bất đồng bộ

**Hiện tượng:** Sau khi promote Replica, một số transaction vừa commit trên Master cũ biến mất.

**Nguyên nhân:** Replication bất đồng bộ — Master đã báo "OK" cho client nhưng chết trước khi kịp gửi các transaction cuối xuống Replica; Replica được promote không có chúng.

**Chẩn đoán:** So sánh vị trí GTID/LSN cuối cùng của Master cũ (nếu còn truy cập được) với Replica được promote — khoảng chênh là phần dữ liệu mất.

**Cách xử lý từng bước:**
1. **Nếu Master cũ còn cứu được dữ liệu:** trích các transaction nó đã commit nhưng chưa gửi đi (đọc binlog/WAL cuối), rồi áp lại lên Master mới một cách có kiểm soát — chỉ làm nếu chắc chắn không tạo xung đột.
2. **Nếu không cứu được:** ghi nhận phần dữ liệu mất, thông báo các bên liên quan, và nếu nghiệp vụ cho phép thì tái tạo từ nguồn khác (log ứng dụng, sự kiện đã phát ra).
3. **Khắc phục gốc để lần sau không mất:** chuyển sang semi-synchronous (bước phòng tránh).

**Phòng tránh:**
1. Bật **semi-synchronous replication** để Master chỉ báo OK sau khi ít nhất một Replica đã nhận (MySQL: bật plugin `rpl_semi_sync`). Đánh đổi: ghi chậm hơn một chút.
2. Với yêu cầu **không được mất dữ liệu tuyệt đối:** dùng hệ đồng thuận (Raft/Paxos — xem mục 11.4) thay vì replication bất đồng bộ thuần.

---

## 9. Lỗi Sharding

### 9.1. Hotspot / Imbalanced shard — một shard bị quá tải

**Hiện tượng:** Một shard "nóng" — CPU/đĩa/IO cao chót vót, truy vấn chậm — trong khi các shard khác gần như rảnh. Lợi ích của sharding bị triệt tiêu vì shard nóng thành nút thắt mới.

**Nguyên nhân:** Shard key phân bố không đều (ví dụ chia theo chữ cái đầu của tên — nhiều tên bắt đầu bằng "A"), hoặc dùng **khóa tăng dần đơn điệu** (auto-increment, timestamp) khiến mọi dòng mới dồn vào shard cuối, hoặc **access pattern** (vài bản ghi "nổi tiếng" bị truy vấn liên tục).

**Chẩn đoán:** Giám sát theo từng shard: dung lượng, QPS, độ trễ, CPU/IO. Shard nào lệch hẳn là hotspot. Phân biệt **hotspot dữ liệu** (một shard chứa quá nhiều dòng) với **hotspot truy cập** (một shard ít dòng nhưng bị hỏi liên tục) vì cách xử lý khác nhau.

**Cách xử lý từng bước:**
1. **Xác định loại hotspot:** so sánh "shard này có nhiều dữ liệu hơn" hay "shard này bị truy vấn nhiều hơn dù dữ liệu tương đương". Đây là bước quyết định hướng xử lý.
2. **Nếu là hotspot truy cập do vài bản ghi nóng:** đặt **cache** (Redis) trước các bản ghi đó để chặn phần lớn truy vấn, không cần đụng tới sharding. Đây là cách rẻ nhất, làm trước.
3. **Nếu là hotspot dữ liệu (shard chứa quá nhiều):** **tách shard nóng** thành hai:
   a. Tạo shard mới.
   b. Di chuyển một nửa dải dữ liệu của shard nóng sang shard mới (làm nền, theo lô nhỏ).
   c. Cập nhật shard map/router để trỏ đúng.
   d. Chuyển traffic dần, theo dõi, rồi xóa dữ liệu đã chuyển khỏi shard cũ.
4. **Nếu hotspot do shard key sai về bản chất** (ví dụ dùng timestamp): cần **đổi shard key** sang phương án phân bố đều (hash, hoặc kết hợp nhiều thuộc tính) — việc này kéo theo resharding, xem mục 9.3.
5. **Theo dõi sau khi xử lý** để chắc tải đã đều và không sinh hotspot mới.

**Phòng tránh:** Chọn shard key cardinality cao, phân bố đều; tránh giá trị tăng dần đơn điệu; **mô phỏng phân bố trên dữ liệu thật** trước khi chốt shard key.

### 9.2. Cross-shard query & join — chậm và phức tạp

**Hiện tượng:** Truy vấn "tất cả đơn hàng 24h qua" hoặc join hai bảng khác shard chạy cực chậm.

**Nguyên nhân:** Dữ liệu vốn chung một bảng nay rải khắp nhiều shard. Thao tác cross-partition kém hiệu quả: router hỏi từng shard rồi gộp (scatter-gather), độ trễ bằng shard chậm nhất.

**Chẩn đoán:** Tìm các truy vấn chậm không có điều kiện lọc theo shard key (nên phải hỏi mọi shard). Log query của sharding layer thường chỉ rõ truy vấn nào bị scatter-gather.

**Cách xử lý từng bước:**
1. **Liệt kê các truy vấn cross-shard chậm** và tần suất của chúng — ưu tiên xử lý cái chạy nhiều nhất.
2. **Với mỗi truy vấn, hỏi: có thể thêm điều kiện theo shard key không?** Nếu truy vấn thực ra chỉ cần dữ liệu của một user mà đang quét mọi shard, thêm `WHERE user_id = ?` (shard key) để nó chỉ chạm một shard.
3. **Nếu thường xuyên join hai bảng khác shard:** **denormalize** — lưu sẵn các cột hay cần ngay trong bảng kia (ví dụ chép `user_name`, `user_email` vào bảng `orders`), để khỏi join. Chấp nhận lưu trùng để đổi lấy tốc độ.
4. **Nếu bắt buộc gộp nhiều shard** (ví dụ thống kê): chuyển sang **application-level join** — lấy dữ liệu từ các shard về tầng ứng dụng rồi gộp trong bộ nhớ, có phân trang và giới hạn.
5. **Với truy vấn phân tích trải toàn bộ shard:** đừng chạy trên hệ vận hành — đẩy sang **kho phân tích riêng** (data warehouse).

**Phòng tránh:** Thiết kế mô hình dữ liệu "shard-aware" từ đầu; chấp nhận sharding hi sinh sự tiện lợi của join tùy ý.

### 9.3. Resharding — chia lại shard cực kỳ tốn kém

**Hiện tượng:** Dữ liệu lớn lên, cần thêm shard, nhưng thêm shard kéo theo di chuyển dữ liệu khổng lồ, rủi ro downtime và sai sót.

**Nguyên nhân:** Với hash đơn giản `hash(key) % N`, đổi N làm gần như mọi key phải tính lại shard → di chuyển hàng loạt.

**Chẩn đoán:** Ước lượng khối lượng phải di chuyển khi thêm node — nếu là "gần như toàn bộ" thì bạn đang dùng hash đơn giản và cần đổi chiến lược trước.

**Cách xử lý từng bước (resharding an toàn, hạn chế downtime):**
1. **Không bao giờ resharding "một phát":** luôn làm nền, theo lô, có thể dừng/tiếp tục.
2. **Chuẩn bị shard đích:** dựng các shard mới, đảm bảo schema khớp.
3. **Bật chế độ ghi kép (dual-write) tạm thời:** trong giai đoạn chuyển, ghi vào cả vị trí cũ và mới cho các key đang di chuyển, để không mất cập nhật.
4. **Copy dữ liệu nền theo lô nhỏ** từ shard cũ sang shard mới, theo dõi tải để không làm nghẽn production.
5. **Đối chiếu (verify):** so checksum/đếm dòng giữa nguồn và đích cho từng lô đã chuyển.
6. **Chuyển định tuyến đọc dần** sang shard mới cho các key đã chuyển xong; theo dõi lỗi.
7. **Tắt ghi kép, dọn dữ liệu cũ** sau khi mọi thứ ổn định.
8. **Tốt nhất: dùng sharding layer** (Vitess, Citus) vốn có sẵn quy trình resharding online — đỡ phải tự dựng các bước trên.

**Phòng tránh:**
1. Dùng **Consistent Hashing** ngay từ đầu — thêm/bớt node chỉ dời một phần nhỏ key.
2. Dùng **logical shard**: tạo sẵn nhiều shard logic (ví dụ 1024) ánh xạ vào ít máy vật lý; mở rộng = chuyển một số shard logic sang máy mới, không phải tính lại key.

### 9.4. Distributed transaction — mất tính nguyên tử xuyên shard

**Hiện tượng:** Chuyển tiền A (shard 1) → B (shard 2): trừ A xong thì cộng B lỗi → tiền "bốc hơi" hoặc nhân đôi.

**Nguyên nhân:** Transaction thường chỉ nguyên tử **trong một database**. Trải hai shard là hai database, mất tính nguyên tử.

**Chẩn đoán:** Rà soát các luồng nghiệp vụ chạm ≥ 2 shard trong một thao tác logic — đó là các điểm rủi ro.

**Cách xử lý từng bước (thiết kế lại luồng, vì đây là vấn đề thiết kế hơn là "fix nóng"):**
1. **Ưu tiên số 1 — loại bỏ giao dịch xuyên shard nếu được:** xem có thể đổi shard key để A và B nằm cùng shard không (ví dụ shard theo `account_group_id` thay vì `account_id`), để dùng transaction thường.
2. **Nếu không thể, dùng mẫu Saga:** chia thao tác thành chuỗi bước, mỗi bước có **hành động bù trừ** khi lỗi. Ví dụ chuyển tiền: bước 1 "trừ A" (bù trừ: "cộng lại A"), bước 2 "cộng B". Nếu bước 2 lỗi → chạy bù trừ bước 1.
3. **Đảm bảo mỗi bước idempotent** (chạy lại không gây tác dụng phụ kép) bằng idempotency key, vì các bước có thể bị retry.
4. **Ghi log trạng thái saga** để biết đang ở bước nào, phục hồi được khi service chết giữa chừng (thường dùng outbox + message queue).
5. **Chỉ dùng 2PC nếu thật sự cần nguyên tử mạnh** và hệ hỗ trợ — lưu ý nó chậm và dễ kẹt nếu một bên treo.

**Phòng tránh:** Thiết kế shard key để giữ dữ liệu cùng giao dịch trong cùng shard; tránh nghiệp vụ xuyên shard ngay từ mô hình hóa dữ liệu.

### 9.5. Sinh khóa toàn cục (global unique ID) khó

**Hiện tượng:** Auto-increment đụng độ giữa các shard (hai shard cùng sinh ID 1001); hoặc service sinh ID tập trung thành nút thắt và điểm chết.

**Nguyên nhân:** Auto-increment vốn cục bộ từng máy, không phối hợp giữa các shard.

**Chẩn đoán:** Nếu khóa chính đang dùng auto-increment mà có nhiều shard cùng ghi → chắc chắn sẽ đụng độ.

**Cách xử lý từng bước:**
1. **Chọn chiến lược ID phù hợp nhu cầu:**
   - Cần đơn giản, không quan tâm thứ tự → **UUID/GUID**.
   - Cần ID xấp xỉ tăng theo thời gian (tốt cho index) và/hoặc nhúng được shard → **Snowflake-style**.
   - Đã có hạ tầng cấp phát → **ticket server / dải ID**.
2. **Nếu chọn UUID:** đổi kiểu cột khóa sang UUID, lưu ý index sẽ phân mảnh (cân nhắc UUIDv7 có thành phần thời gian để bớt phân mảnh).
3. **Nếu chọn Snowflake:** triển khai bộ sinh 64-bit ghép `timestamp | machine/shard id | sequence`; gán mỗi node một machine id riêng. Có thể **nhúng shard id vào ID** để sau này đọc ID là biết shard, khỏi tra cứu (như Instagram làm).
4. **Nếu đang chạy production với auto-increment:** tạm thời tránh đụng độ bằng cách đặt **offset khác nhau cho mỗi shard** (MySQL: `auto_increment_increment` và `auto_increment_offset`), rồi lên kế hoạch migrate sang chiến lược ID toàn cục.

**Phòng tránh:** Quyết định chiến lược ID toàn cục **trước khi** sharding, không để auto-increment cục bộ lọt vào thiết kế đa shard.

### 9.6. Backup, restore, schema migration nhân lên theo số shard

**Hiện tượng:** Mỗi thay đổi schema phải lặp trên hàng chục/trăm shard; backup/restore nặng nề; dễ có schema không đồng nhất giữa các shard.

**Nguyên nhân:** Vận hành một database đã khó; vận hành nhiều shard như nhiều database độc lập khó hơn nhiều.

**Chẩn đoán:** Kiểm tra phiên bản schema của từng shard — nếu không khớp nhau → đang có drift schema.

**Cách xử lý từng bước:**
1. **Tự động hóa migration trên toàn bộ shard:** dùng công cụ rollout chạy cùng một migration tuần tự/song song trên mọi shard, ghi nhận shard nào đã chạy, shard nào lỗi. KHÔNG sửa tay từng shard.
2. **Luôn viết migration tương thích ngược (backward-compatible):** ví dụ thêm cột cho phép NULL trước, deploy code đọc-được-cả-hai, rồi mới backfill và ràng buộc. Nhờ đó giai đoạn các shard chưa đồng nhất vẫn chạy được.
3. **Kiểm tra phiên bản schema mọi shard sau migration** để chắc tất cả đã đồng nhất; xử lý ngay shard nào lỗi.
4. **Với backup:** lập lịch backup tự động cho mọi shard, và **test restore định kỳ** (restore thật ra môi trường test) chứ không chỉ tin backup chạy xong là ổn.

**Phòng tránh:** Dùng sharding layer/orchestration lo việc migration & backup hàng loạt; chuẩn hóa quy trình migration tương thích ngược thành thói quen.

### 9.7. Lookup table / shard map trở thành điểm chết

**Hiện tượng:** Toàn hệ chậm hoặc không định tuyến được vì bảng tra cứu shard quá tải hoặc chết.

**Nguyên nhân:** Chiến lược directory-based đặt mọi định tuyến qua một bảng tra cứu tập trung — nó thành single point of failure.

**Chẩn đoán:** Khi hệ chậm/lỗi toàn cục, kiểm tra xem shard map có đang là điểm nghẽn (QPS cao, độ trễ tăng) không.

**Cách xử lý từng bước:**
1. **Cache shard map ở phía client/router:** vì ánh xạ key→shard đổi rất ít, cache nó trong bộ nhớ ứng dụng với thời gian sống hợp lý, chỉ tải lại khi có thay đổi. Giảm gần hết tải đọc lên shard map.
2. **Nhân bản shard map:** đặt nhiều bản (master-replica cho chính shard map) để không phụ thuộc một instance.
3. **Cân nhắc bỏ hẳn lookup table:** chuyển sang chiến lược không cần tra cứu — **nhúng shard id vào khóa** (như Instagram), đọc ID là biết shard ngay.
4. **Giám sát shard map như hạ tầng quan trọng:** cảnh báo riêng cho nó.

**Phòng tránh:** Nếu dùng directory-based, coi shard map là thành phần hạ tầng cấp một (nhân bản + cache + giám sát) ngay từ đầu; hoặc thiết kế khóa tự mang thông tin shard để khỏi cần nó.

---

## 10. Lỗi Multi-Master

> Mô hình sinh nhiều lỗi đặc thù nhất, vì cùng lúc đối mặt ghi đa điểm, đồng bộ hai chiều, và xung đột. Các lỗi dưới áp dụng chung cho mọi hệ multi-master, với ví dụ cụ thể từ SQL Server Merge Replication, MySQL Galera/Group Replication, và NoSQL.

### 10.1. Conflict gây mất hoặc sai dữ liệu

**Hiện tượng:** Hai site sửa cùng một bản ghi; sau merge, thay đổi của một bên biến mất hoặc giá trị cuối sai (ví dụ tồn kho tính nhầm).

**Nguyên nhân:** Resolver mặc định (thường LWW) âm thầm vứt bỏ thay đổi bên "thua". Với dữ liệu cộng dồn (số dư, tồn kho, bộ đếm), ghi đè theo LWW làm mất các cập nhật trung gian.

**Chẩn đoán:** Bật **logging conflict** và xem bảng/log xung đột (SQL Server merge replication có bảng conflict riêng — xem qua `sp_helpmergeconflictrows` / các view `MSmerge_conflict_*`). Đối chiếu giá trị kỳ vọng với thực tế.

**Cách xử lý từng bước:**
1. **Xem log conflict để biết phạm vi:** bao nhiêu bản ghi đã conflict, ở bảng nào, theo pattern gì. Đừng đổi resolver khi chưa hiểu cái gì đang đụng nhau.
2. **Sửa các giá trị đã sai:** dựa vào log conflict (thường lưu cả giá trị bên thắng và bên thua), tái dựng giá trị đúng theo nghiệp vụ rồi ghi lại.
3. **Đổi chiến lược resolver cho đúng nghiệp vụ:**
   - Dữ liệu "ghi đè được" (ví dụ hồ sơ, trạng thái cuối) → LWW chấp nhận được.
   - Dữ liệu **cộng dồn** (tồn kho, số dư, đếm) → KHÔNG dùng LWW; dùng **custom merge** (cộng các delta) hoặc **CRDT counter**.
   - Cần giữ mọi phiên bản để người dùng chọn → resolver kiểu "giữ siblings" (Riak/CouchDB).
4. **Triển khai resolver mới** và test kỹ trên staging với kịch bản hai site sửa cùng dòng.
5. **Theo dõi số conflict sau khi đổi** — nếu vẫn cao, vấn đề nằm ở thiết kế ghi (xem phòng tránh).

**Phòng tránh:**
1. **Phân vùng quyền ghi:** mỗi site chỉ ghi dữ liệu "của mình" → gần như hết đụng độ.
2. Dùng khóa chính không đụng nhau giữa các site (dải ID/GUID — xem 10.7).
3. Review bảng conflict định kỳ để bắt pattern xung đột sớm.

### 10.2. Split-brain — phân ly não

**Hiện tượng:** Mạng giữa các node bị chia cắt; mỗi nhóm tiếp tục nhận ghi độc lập. Khi nối lại, dữ liệu hai bên mâu thuẫn hàng loạt.

**Nguyên nhân:** Node mất kết nối với nhau nhưng vẫn hoạt động; nhiều node cùng tưởng mình thuộc nhóm "chính". Đặc biệt nguy hiểm với cụm **2 node**.

**Chẩn đoán:** Sau sự cố mạng, tìm các bản ghi mâu thuẫn được tạo ở nhiều node trong cùng khoảng thời gian phân mảnh.

**Cách xử lý từng bước (khi ĐÃ xảy ra):**
1. **Ngừng ghi vào các nhóm bị tách** để không phân kỳ thêm.
2. **Chọn một nhóm/node làm nguồn sự thật** (thường nhóm quá bán, hoặc nhóm phục vụ phần lớn traffic).
3. **Trích các thay đổi xung đột** ở nhóm còn lại trong khoảng thời gian split-brain.
4. **Hợp nhất thủ công theo nghiệp vụ** từng bản ghi xung đột — giữ giá trị nào, hay gộp lại.
5. **Đưa hệ về một cụm thống nhất:** rebuild các node thiểu số từ nguồn sự thật, rồi khôi phục ghi.

**Phòng tránh (quan trọng hơn xử lý):**
1. **Tối thiểu 3 node và số lẻ**, dùng **quorum**: chỉ nhóm quá bán được phép ghi; nhóm thiểu số tự ngừng ghi khi mất quorum. Đây là khuyến nghị tiêu chuẩn cho Galera và các hệ tương tự.
2. Dùng hệ có **cluster-awareness** sẵn (MySQL Group Replication, Galera) thay vì tự ghép replication hai chiều thủ công.
3. Thêm **witness/arbitrator node** ở vị trí mạng độc lập làm bên phá hòa (giải pháp rẻ cho tình huống chỉ có 2 site).

### 10.3. Hội tụ chậm hoặc không hội tụ

**Hiện tượng:** Ghi ở node A nhưng rất lâu sau node B mới thấy; hoặc cuối cùng các node vẫn không giống nhau.

**Nguyên nhân:** Multi-master thường là hệ **AP** — chỉ đảm bảo "eventually consistent". Một số hệ thậm chí không hội tụ đúng như tài liệu gợi ý (ví dụ KeyDB multi-master từng được kiểm chứng là không đủ đảm bảo hội tụ trong vài tình huống dù mặc định "last write wins").

**Chẩn đoán:** Ghi một giá trị ở một node, đo thời gian tới khi các node khác phản ánh; chủ động test ngắt-nối mạng (chaos test) để xem hành vi hội tụ thật.

**Cách xử lý từng bước:**
1. **Đo độ trễ hội tụ thực tế** giữa các node để biết "chậm" cỡ nào và ở đâu.
2. **Kiểm tra hàng đợi đồng bộ** giữa các node có bị ứ không (do mạng, do node nhận quá tải) — giải tỏa nguyên nhân ứ.
3. **Kiểm chứng mức nhất quán hệ thực sự cung cấp:** đọc tài liệu và **test bằng kịch bản ngắt-nối**; đừng tin "chắc là eventually consistent" mà không kiểm.
4. **Tăng ổn định/băng thông mạng** giữa các node; giảm khoảng cách giữa các chu kỳ đồng bộ nếu hệ cho cấu hình.
5. **Nếu dữ liệu cần nhất quán mạnh mà hệ không đảm bảo:** rút phần dữ liệu đó ra khỏi multi-master, đưa về single-master hoặc hệ đồng thuận (Spanner/CockroachDB).

**Phòng tránh:** Chọn đúng hệ cho yêu cầu nhất quán ngay từ đầu; không đặt dữ liệu nhạy cảm vào hệ chỉ eventually consistent.

### 10.4. Khởi tạo thất bại — không deliver được snapshot xuống node mới

**Hiện tượng:** Khi thêm node/Subscriber mới hoặc re-initialize, đồng bộ dừng với thông báo kiểu *"unable to deliver the snapshot to the Subscriber"* (SQL Server: mã `MSSQL_REPL-2147201001`). Node mới không nhận được dữ liệu khởi tạo nên không tham gia được cụm.

**Nguyên nhân:** Trước khi merge hai chiều, node mới phải được nạp một bản dữ liệu ban đầu (snapshot). Bước nạp này đụng tới file, mạng và quyền — nên dễ hỏng. Thông báo gốc thường là **lỗi chung**, chỉ nói "không nạp được" chứ không nói vì sao; nguyên nhân thật nằm ở dòng lỗi đi kèm trong log.

**Chẩn đoán (BƯỚC 0 — luôn làm đầu tiên, đừng đoán mò):** Bật log chi tiết để biết lỗi thật.
- Cách dòng lệnh: chạy lại Merge Agent với `-Output C:\temp\merge.log -OutputVerboseLevel 3`.
- Cách giao diện (SSMS): trong Agent Profile của Merge Agent (và Snapshot Agent), đặt `-HistoryVerboseLevel 3`.
- Chạy lại đồng bộ, mở file log, **kéo xuống gần cuối** — dòng lỗi thật ở đó. Dựa vào nó, nhảy tới đúng case bên dưới.

**Cách xử lý từng bước theo từng case** (xác định case nhờ dòng lỗi ở Bước 0):

*Case A — Đường dẫn snapshot là local thay vì mạng* (log: lỗi đường dẫn / không tìm thấy file / "unable to create or write"):
1. Mở Publication Properties → mục Snapshot → xem Snapshot folder.
2. Nếu là `C:\...` (đường dẫn local) → đổi sang **UNC**: `\\TÊN_SERVER\TênShare`.
3. Đảm bảo thư mục đó thực sự được Share trên mạng.
4. Chạy lại đồng bộ. (Đây là nguyên nhân hay gặp nhất — đổi sang UNC thường là hết lỗi.)

*Case B — Tài khoản agent thiếu quyền* (log: "Access is denied" / "you do not have permission" / "could not bulk copy"):
1. Xác định tài khoản đang chạy Merge Agent (và SQL Server Agent).
2. Cấp cho nó quyền **Read** thư mục snapshot ở **cả hai loại quyền**: Share permission và NTFS permission (thiếu một trong hai vẫn lỗi).
3. Cấp quyền ghi phù hợp trên database ở node nhận.
4. Nếu các máy khác domain: dùng **domain account** dùng chung, đảm bảo các máy truy cập được nhau.
5. Lưu ý: nếu là **pull subscription**, tài khoản ở phía node nhận (Subscriber) mới là cái quyết định.

*Case C — Snapshot hỏng hoặc chưa tạo* (log: "error ... reading the .bcp data file ... must regenerate the snapshot"):
1. Chạy lại **Snapshot Agent**, xác nhận nó báo thành công.
2. Đánh dấu node nhận **re-initialize** với snapshot mới.
3. Kiểm tra file snapshot thật sự nằm trong thư mục.

*Case D — Hết dung lượng / giới hạn phiên bản* (log: lỗi kích thước, hoặc dừng đúng một ngưỡng dung lượng):
1. Kiểm tra dung lượng đĩa trống ở **cả hai phía** (nơi chứa snapshot và node nhận).
2. Nếu node nhận dùng **SQL Server Express** (giới hạn dung lượng ~10GB, bản cũ 4GB): nâng lên Standard, **hoặc** dùng filter để chỉ đồng bộ phần dữ liệu cần (giảm kích thước).
3. Cách xác minh nhanh: tạm loại các bảng lớn khỏi publication — nếu hết lỗi thì đúng do dung lượng.

*Case E — Trigger / khóa ngoại ở node nhận* (log: "schema script ... could not be propagated" + "FOREIGN KEY constraint", hoặc lỗi trigger):
1. Kiểm tra các **trigger** trên database node nhận; tạm **vô hiệu hóa** chúng trong khi áp snapshot.
2. Rà soát ràng buộc khóa ngoại; để snapshot xử lý đúng thứ tự nạp bảng.
3. Bật lại trigger sau khi khởi tạo xong.

*Case F — Lỗi đồng bộ qua Web/IIS* (dùng Web synchronization, log nhắc "message file"):
1. Kiểm tra `replisapi.dll` đã cấu hình đúng trên IIS chưa.
2. Tài khoản của **Application Pool** có quyền vào thư mục snapshot không.
3. URL cấu hình có truy cập được và trỏ đúng thư mục replication không.

*Giải pháp dự phòng (khi mạng/quyền quá khó gỡ):* copy thủ công thư mục snapshot xuống node nhận rồi nạp tại chỗ bằng tham số Merge Agent **`-AltSnapshotFolder`** trỏ tới thư mục local đó — bỏ qua hẳn khâu truyền file qua mạng. Rất hữu ích khi snapshot lớn hoặc đường truyền yếu.

**Checklist nhanh cho lỗi này:**

| # | Kiểm tra | Bắt case nào |
|---|---|---|
| 0 | Bật `-OutputVerboseLevel 3`, đọc dòng cuối log | TẤT CẢ — luôn làm trước |
| 1 | Snapshot folder có phải UNC `\\...`? | A |
| 2 | Tài khoản agent có quyền Read (Share + NTFS)? | B |
| 3 | Snapshot đã tạo, file `.bcp` còn nguyên? | C |
| 4 | Còn dung lượng? Node nhận có phải SQL Express? | D |
| 5 | Có trigger / FK ở node nhận? | E |
| 6 | Có dùng Web sync qua IIS? Quyền app pool? | F |
| 7 | Bí quá → copy thủ công + `-AltSnapshotFolder` | dự phòng |

**Phòng tránh:** Bước khởi tạo node mới luôn **nặng và dễ lỗi nhất** vì phải truyền một bản dữ liệu đầy đủ. Với cụm lớn, chuẩn bị trước: đủ băng thông, đủ đĩa, quyền đã thông, đường dẫn dạng UNC, và test khởi tạo trên staging trước khi thêm node thật.

### 10.5. Replication ngừng vì thay đổi schema không tương thích

**Hiện tượng:** Đang chạy ổn, sau một lần ai đó đổi cấu trúc bảng (thêm/xóa cột, đổi kiểu) ở một node, đồng bộ báo lỗi và dừng.

**Nguyên nhân:** Multi-master cần schema đồng nhất hoặc thay đổi schema phải được lan truyền đúng cách. Một thay đổi DDL thủ công ở một node khiến các node khác không áp được dữ liệu.

**Chẩn đoán:** So sánh schema các node để tìm node lệch; xem log để biết DDL/cột nào gây lỗi.

**Cách xử lý từng bước:**
1. **Tạm dừng đồng bộ** để không lan lỗi (nếu hệ cho phép tạm dừng an toàn).
2. **Xác định node nào, thay đổi gì gây lệch** từ log.
3. **Đưa schema các node về thống nhất:** áp cùng thay đổi schema lên tất cả node (qua cơ chế lan truyền schema của replication, không sửa tay lẻ tẻ).
4. **Re-initialize node bị lệch** nếu dữ liệu đã không áp được trong lúc lệch.
5. **Khôi phục đồng bộ** và xác nhận chạy lại bình thường.

**Phòng tránh:** Luôn đổi schema **qua cơ chế của replication** (nhiều hệ tự lan truyền DDL nếu làm đúng quy trình); thiết lập migration có kiểm soát, áp đồng bộ toàn cụm; dùng migration tương thích ngược.

### 10.6. Replication loop — vòng lặp & khuếch đại dữ liệu

**Hiện tượng:** Một thay đổi bị lặp đi lặp lại giữa các node, hoặc dữ liệu nhân lên bất thường.

**Nguyên nhân:** Topology sai khiến thay đổi từ A → B rồi lại B → A vô tận, đặc biệt topology vòng (ring) hoặc khi tự ghép replication hai chiều thủ công mà thiếu cơ chế nhận diện nguồn gốc thay đổi.

**Chẩn đoán:** Quan sát một bản ghi bị cập nhật lặp lại không lý do, hoặc số bản ghi tăng bất thường; kiểm tra topology xem có vòng kín không.

**Cách xử lý từng bước:**
1. **Dừng đồng bộ để cắt vòng lặp ngay**, tránh khuếch đại thêm.
2. **Dọn dữ liệu đã bị nhân bản** (nếu có): xác định và xóa bản ghi trùng do loop sinh ra.
3. **Bật cơ chế đánh dấu nguồn gốc thay đổi** (server-id/origin) để node không replicate lại thứ chính nó vừa nhận.
4. **Sửa topology:** ưu tiên **hub-and-spoke** (sao) thay vì vòng phức tạp; nếu cần all-to-all thì phải có chống-loop.
5. **Khởi động lại đồng bộ** và theo dõi để chắc loop không tái diễn.

**Phòng tránh:** Dùng giải pháp multi-master có sẵn cơ chế chống loop thay vì tự ghép replication một chiều thành hai chiều; thiết kế topology rõ ràng.

### 10.7. Khóa chính đụng độ giữa các node (PK collision)

**Hiện tượng:** Hai node cùng sinh một khóa chính giống nhau cho hai bản ghi khác nhau; khi merge thì đụng độ hoặc ghi đè nhầm.

**Nguyên nhân:** Dùng auto-increment cục bộ ở nhiều node ghi.

**Chẩn đoán:** Nếu nhiều node cùng ghi mà khóa chính là auto-increment → chắc chắn sẽ đụng độ; kiểm tra log conflict các va chạm khóa.

**Cách xử lý từng bước:**
1. **Trước mắt, tách không gian khóa giữa các node:** đặt offset khác nhau (MySQL: `auto_increment_increment` = số node, `auto_increment_offset` riêng mỗi node) để chúng không sinh trùng nữa.
2. **Xử lý các bản ghi đã đụng độ:** gán lại khóa cho các bản ghi trùng (cẩn thận với khóa ngoại tham chiếu tới chúng).
3. **Lên kế hoạch chuyển sang khóa toàn cục bền vững:** **GUID/UUID** hoặc **Snowflake-style ID** có nhúng node id — để không bao giờ đụng độ nữa.

**Phòng tránh:** Quyết định chiến lược khóa toàn cục trước khi cho nhiều node cùng ghi.

### 10.8. Đồng bộ chậm dần / metadata phình to

**Hiện tượng:** Sau thời gian dài, đồng bộ ngày càng chậm; bảng metadata theo dõi thay đổi (tracking) phình to.

**Nguyên nhân:** Merge replication và các hệ tương tự lưu metadata để biết dòng nào đã thay đổi, đã đồng bộ tới đâu. Metadata tích lũy theo thời gian và số lượng thay đổi/đối tượng → chậm dần.

**Chẩn đoán:** Theo dõi kích thước các bảng metadata đồng bộ; nếu tăng đều và đồng bộ chậm dần theo → đúng nguyên nhân.

**Cách xử lý từng bước:**
1. **Kiểm tra cấu hình retention** của metadata đồng bộ (SQL Server: thời gian giữ lịch sử merge — `@retention` của publication).
2. **Đặt retention hợp lý** (đủ để các node ngoại tuyến lâu nhất vẫn đồng bộ được, nhưng không giữ vô hạn).
3. **Chạy cleanup/dọn dẹp** metadata cũ theo cơ chế của hệ (thường có job dọn tự động — đảm bảo nó đang chạy).
4. **Giảm lượng thay đổi bị theo dõi không cần thiết:** tránh các thao tác ghi-hàng-loạt thừa; cân nhắc loại các bảng không cần đồng bộ khỏi publication.

**Phòng tránh:** Cấu hình retention & job dọn dẹp ngay khi thiết lập; giám sát kích thước metadata như một chỉ số sức khỏe.

### 10.9. Đồng hồ lệch giữa các node làm sai conflict resolution

**Hiện tượng:** Dùng LWW theo timestamp nhưng "bên đáng thắng" lại thua, vì đồng hồ các node lệch nhau.

**Nguyên nhân:** LWW dựa vào timestamp tường (wall-clock). Nếu đồng hồ các node lệch (clock skew), thao tác thực sự đến sau có thể mang timestamp nhỏ hơn và bị xử thua.

**Chẩn đoán:** So sánh đồng hồ các node (ví dụ `ntpstat`, hoặc đối chiếu thời gian hệ thống); nếu lệch đáng kể và bạn đang dùng LWW theo timestamp → đây là nguyên nhân tiềm tàng các kết quả conflict khó hiểu.

**Cách xử lý từng bước:**
1. **Đồng bộ đồng hồ mọi node** bằng NTP (hoặc nguồn chính xác hơn); đảm bảo dịch vụ NTP chạy và lệch trong ngưỡng nhỏ.
2. **Nếu nghiệp vụ nhạy cảm với thứ tự:** chuyển khỏi LWW thuần timestamp sang cơ chế thứ tự không phụ thuộc đồng hồ tường — **logical clock / version vector / Hybrid Logical Clock (HLC)**.
3. **Rà soát các conflict đã giải quyết sai** trong giai đoạn đồng hồ lệch và sửa lại nếu cần.

**Phòng tránh:** Luôn chạy NTP trên mọi node; với hệ multi-master nghiêm túc, ưu tiên cơ chế sắp thứ tự logic thay vì tin vào đồng hồ tường.

---

## 11. Lỗi chung của mọi hệ phân tán

Một số lớp lỗi không thuộc riêng mô hình nào mà xuất hiện ở mọi hệ nhiều node. Hiểu chúng giúp tránh "đổ lỗi nhầm" cho mô hình.

### 11.1. Connection pool cạn kiệt khi nhân số node

**Hiện tượng:** Ứng dụng báo hết kết nối, timeout, dù mỗi database còn rảnh.

**Nguyên nhân:** Mỗi ứng dụng mở pool tới nhiều node (nhiều replica/shard) → tổng kết nối nhân lên nhanh, vượt giới hạn database hoặc tầng mạng.

**Chẩn đoán:** So số kết nối thực tế (`SHOW STATUS LIKE 'Threads_connected'` / `pg_stat_activity`) với giới hạn (`max_connections`); nếu chạm trần trong khi DB còn CPU/IO → đúng nguyên nhân.

**Cách xử lý từng bước:**
1. **Đặt một connection pooler trung gian** (PgBouncer cho PostgreSQL, ProxySQL cho MySQL) giữa ứng dụng và DB, để hàng nghìn kết nối ứng dụng dồn vào vài chục kết nối thật tới DB.
2. **Giới hạn pool size mỗi service** ở mức hợp lý (thường nhỏ hơn nhiều so với trực giác — vài chục là đủ cho phần lớn service).
3. **Giám sát số kết nối theo node** và đặt cảnh báo trước khi chạm trần.

**Phòng tránh:** Tính tổng kết nối = (số instance service) × (pool size) × (số node) ngay từ thiết kế; luôn đặt pooler khi có nhiều node.

### 11.2. Thundering herd & cache stampede

**Hiện tượng:** Một sự kiện (cache hết hạn, một node phục hồi) khiến hàng loạt request dồn cùng lúc vào database, gây quá tải dây chuyền.

**Nguyên nhân:** Nhiều client cùng hết cache một lúc và cùng lao vào tính lại/đọc DB đồng thời.

**Chẩn đoán:** Quan sát các đỉnh tải DB trùng với thời điểm cache hết hạn hàng loạt hoặc node vừa phục hồi.

**Cách xử lý từng bước:**
1. **Thêm jitter vào thời gian hết hạn cache** (ngẫu nhiên hóa ±X%) để cache không hết cùng lúc.
2. **Dùng cơ chế single-flight:** chỉ cho một request đi tính lại giá trị, các request khác chờ kết quả đó thay vì cùng lao vào DB.
3. **Backoff theo cấp số nhân** khi retry sau lỗi, để không dồn đập.
4. **Warm-up cache** trước khi đưa node/cache mới vào phục vụ.

**Phòng tránh:** Thiết kế cache với jitter + single-flight ngay từ đầu; có quy trình warm-up khi thêm node.

### 11.3. Retry storm & thiếu idempotency

**Hiện tượng:** Một thao tác bị thực hiện nhiều lần (trừ tiền hai lần) do client retry khi không chắc request trước đã thành công.

**Nguyên nhân:** Trong hệ phân tán, "không nhận được phản hồi" không có nghĩa "thao tác chưa xảy ra". Retry mù gây trùng lặp; retry đồng loạt còn gây bão.

**Chẩn đoán:** Tìm các bản ghi trùng/tác dụng kép trùng với thời điểm có timeout/retry; rà soát các endpoint thay đổi dữ liệu xem có idempotency key chưa.

**Cách xử lý từng bước:**
1. **Làm các thao tác ghi idempotent:** client sinh một **idempotency key** cho mỗi thao tác; server lưu key đã xử lý và bỏ qua nếu thấy lại → retry an toàn, không nhân đôi.
2. **Đặt giới hạn số lần retry và backoff** (kèm jitter) để tránh retry storm.
3. **Với luồng tài chính/quan trọng:** kết hợp outbox pattern để đảm bảo "đúng một lần" về mặt hiệu ứng.
4. **Dọn các tác dụng kép đã xảy ra** dựa trên log idempotency/giao dịch.

**Phòng tránh:** Coi idempotency là yêu cầu bắt buộc cho mọi API thay đổi dữ liệu; chuẩn hóa thư viện retry có backoff+jitter dùng chung.

### 11.4. Cần đồng thuận (consensus) mà thiếu

**Hiện tượng:** Các node không thống nhất được "ai là leader" hay "thứ tự thao tác", dẫn tới split-brain hoặc quyết định mâu thuẫn.

**Nguyên nhân:** Bài toán đồng thuận khi thông điệp có thể mất/trễ là khó; tự xử lý thủ công thường sai trong các ca biên.

**Chẩn đoán:** Nếu bạn đang tự viết logic bầu leader/sắp thứ tự bằng tay và thỉnh thoảng gặp hai leader hoặc thứ tự sai → đang thiếu một cơ chế đồng thuận đúng đắn.

**Cách xử lý từng bước:**
1. **Đừng tự phát minh đồng thuận.** Dùng thuật toán đã kiểm chứng — **Raft** (dễ hiểu hơn) hoặc **Paxos**.
2. **Dùng hệ/thư viện có sẵn:** etcd, Consul, ZooKeeper cho bầu leader & lưu cấu hình phối hợp; CockroachDB/Spanner nếu cần DB nhất quán mạnh xây sẵn trên đồng thuận.
3. **Đảm bảo số node lẻ** (3, 5) để quorum hoạt động đúng.

**Phòng tránh:** Khi thiết kế có nhu cầu bầu leader/sắp thứ tự nghiêm ngặt, chọn ngay một hệ đồng thuận có sẵn thay vì tự làm.

### 11.5. Giám sát & cảnh báo không theo kịp số node

**Hiện tượng:** Sự cố (lag tăng, một shard nóng, một node lệch) chỉ bị phát hiện khi đã thành thảm họa.

**Nguyên nhân:** Giám sát chỉ nhìn tổng thể, không soi từng node/shard/replica.

**Chẩn đoán:** Tự hỏi: nếu một shard trong 50 shard nóng lên, dashboard hiện tại có báo không? Nếu không → giám sát chưa đủ chi tiết.

**Cách xử lý từng bước:**
1. **Thêm metric theo từng node/shard/replica:** lag, kích thước metadata, phân bố tải (QPS/CPU/IO), số conflict, dung lượng đĩa.
2. **Đặt cảnh báo theo ngưỡng VÀ theo xu hướng** (ví dụ "lag > 5s" và "đĩa sẽ đầy trong 7 ngày theo đà hiện tại").
3. **Tạo dashboard so sánh các node cùng loại** để hotspot/độ lệch lộ ra bằng mắt.

**Phòng tránh:** Coi observability per-node là phần bắt buộc của mọi hệ phân tán, dựng cùng lúc với hệ chứ không phải sau sự cố.

### 11.6. Backup không nhất quán trên nhiều node

**Hiện tượng:** Khôi phục từ backup nhưng dữ liệu giữa các node/shard không khớp thời điểm, gây sai lệch.

**Nguyên nhân:** Backup từng node ở các thời điểm khác nhau, không có "điểm nhất quán toàn cục".

**Chẩn đoán:** Kiểm tra quy trình backup hiện tại: các node có được snapshot tại cùng một điểm logic (GTID/LSN) không, hay mỗi node một thời điểm tùy ý?

**Cách xử lý từng bước:**
1. **Phối hợp điểm backup:** dùng snapshot point-in-time đồng bộ giữa các node, hoặc neo backup theo một mốc logic chung (GTID/LSN) để các phần khớp nhau.
2. **Test restore thật định kỳ:** khôi phục ra môi trường test và kiểm tra dữ liệu giữa các node/shard có nhất quán không — đừng chỉ tin backup chạy xong là ổn.
3. **Tài liệu hóa quy trình restore** từng bước để khi cần khôi phục khẩn cấp không lúng túng.

**Phòng tránh:** Thiết kế backup nhất quán toàn cục ngay từ đầu cho hệ nhiều node; đưa "test restore" vào lịch định kỳ.
---
---

# PHẦN IV — VẬN DỤNG

## 12. Bảng so sánh

### 12.1. So sánh tổng thể

| Tiêu chí | Master-Replica | Sharding | Multi-Master |
|---|---|---|---|
| **Mục tiêu chính** | Scale đọc, chịu lỗi | Scale dữ liệu + ghi | Ghi đa điểm, offline, chịu lỗi địa lý |
| **Ai được ghi** | Chỉ Master | Mỗi shard ghi phần của nó | Mọi node |
| **Dữ liệu mỗi node** | Bản sao đầy đủ | Một mảnh rời | Bản sao (có thể lọc) |
| **Hướng dữ liệu** | Một chiều | Không sao chép | Hai chiều |
| **Scale đọc** | Rất tốt | Tốt | Tốt |
| **Scale ghi** | Không | Rất tốt | Trung bình |
| **Scale dung lượng** | Không | Rất tốt | Không |
| **Có conflict không** | Không | Không (dữ liệu rời) | **Có → cần resolver** |
| **Nhất quán** | Eventual (đọc) đến mạnh (ghi) | Mạnh trong shard, khó xuyên shard | Eventual (thường) |
| **Độ phức tạp vận hành** | Thấp–Trung bình | Cao | Rất cao |
| **Rủi ro đặc trưng** | Lag, split-brain khi failover | Hotspot, cross-shard, resharding | Conflict, split-brain, hội tụ |

### 12.2. Cây quyết định chọn mô hình

```
Tải đọc cao là vấn đề chính?
├─ CÓ, và ghi/dung lượng vẫn ổn
│     → MASTER-REPLICA (thêm read-replica). Đơn giản, ít rủi ro.
│
├─ Ghi hoặc dung lượng vượt khả năng một máy?
│     → Đã thử scale vertically (nâng cấu hình) chưa?
│         ├─ Chưa → thử nâng cấu hình trước (rẻ hơn về độ phức tạp)
│         └─ Rồi, vẫn không đủ → SHARDING
│               → Chọn shard key cẩn thận (phân bố đều + bám query)
│               → Lên kế hoạch resharding từ đầu (consistent hashing)
│
└─ Cần GHI tại nhiều địa điểm / hoạt động offline / đa chi nhánh?
      → Dữ liệu có cần nhất quán mạnh không?
          ├─ CÓ (tài chính, tồn kho) → cân nhắc KHÔNG dùng multi-master;
          │     dùng single-master + hàng đợi, hoặc hệ đồng thuận (Spanner/Cockroach)
          └─ KHÔNG (xung đột hiếm/dễ giải quyết) → MULTI-MASTER
                → Tối thiểu 3 node + quorum để tránh split-brain
                → Chọn conflict resolver theo nghiệp vụ (đừng để mặc định LWW)
```

### 12.3. Câu hỏi quyết định CP hay AP

Khi phải chọn giữa nhất quán và sẵn sàng, hỏi: **nếu user đọc phải dữ liệu cũ thì sao?**
- **Thảm họa** (mất tiền, rủi ro an toàn) → chọn **CP** (nhất quán mạnh).
- **Phiền nhưng phục hồi được** (feed cũ, đếm like lệch) → chọn **AP** (ưu tiên sẵn sàng).

---

## 13. Kết hợp các mô hình

Hệ thống lớn hiếm khi dùng đúng một mô hình. Vài cách kết hợp phổ biến:

**Sharding + Master-Replica (phổ biến nhất).** Chia dữ liệu thành nhiều shard để scale ghi/dung lượng; mỗi shard lại có master và vài replica để scale đọc và chịu lỗi. Đây là kiến trúc xương sống của rất nhiều dịch vụ quy mô lớn — vừa scale được mọi chiều, vừa có HA cho từng mảnh.

**Multi-Master ở tầng vùng + Master-Replica trong vùng.** Mỗi vùng địa lý có một cụm ghi được (để ghi tại chỗ nhanh), các vùng đồng bộ multi-master với nhau; trong mỗi vùng dùng master-replica để scale đọc.

**Cache + Master-Replica.** Trước database đặt một tầng cache (Redis/Memcached) để chặn phần lớn lượt đọc, giảm tải cho cả master lẫn replica. Đây thường là bước tối ưu nên làm **trước** khi nghĩ tới sharding.

**Database vận hành + Data warehouse.** Tách hẳn tải phân tích (OLAP) ra một kho riêng (BigQuery, Redshift, Snowflake, ClickHouse), để hệ vận hành (OLTP) không bị truy vấn nặng làm chậm.

**Lời khuyên thực tế về thứ tự áp dụng:** đừng nhảy thẳng vào sharding hay multi-master. Trình tự hợp lý thường là: tối ưu query và index → thêm cache → thêm read-replica → scale vertically master → và chỉ khi đó mới sharding/multi-master. Mỗi bước sau đắt hơn nhiều về độ phức tạp và lớp lỗi đi kèm.

---

## 14. Checklist vận hành & giám sát

### 14.1. Giám sát cần có (theo từng node/shard/replica)

- **Replication lag** (giây hoặc số byte/LSN tụt lại) — cảnh báo theo ngưỡng và xu hướng.
- **Trạng thái luồng replication** — đang chạy hay đã dừng vì lỗi.
- **Phân bố tải giữa shard/node** — phát hiện hotspot sớm (QPS, CPU, IO, dung lượng từng shard).
- **Số lượng conflict** (với multi-master) — xu hướng tăng là dấu hiệu thiết kế ghi có vấn đề.
- **Kích thước metadata đồng bộ** (với merge replication) — phình to làm chậm dần.
- **Dung lượng đĩa** mỗi node, đặc biệt thư mục snapshot/log.
- **Số kết nối** so với giới hạn pool.
- **Clock skew** giữa các node (nếu dùng LWW theo timestamp).

### 14.2. Trước khi đưa vào production

- [ ] Đã test **failover** thật (kéo điện master) chứ không chỉ giả định?
- [ ] Có cơ chế chống **split-brain** (quorum/witness/fencing)?
- [ ] Replica đặt **read-only** để tránh ghi nhầm gây drift?
- [ ] Dùng **row-based/mixed** thay vì statement-based để tránh drift do lệnh không tất định?
- [ ] Với multi-master: resolver đã chọn **theo nghiệp vụ** chưa, hay vẫn để mặc định LWW?
- [ ] Với sharding: shard key đã mô phỏng trên dữ liệu thật để kiểm tra phân bố?
- [ ] Đã có kế hoạch **resharding/thêm node** với di chuyển dữ liệu tối thiểu?
- [ ] Quy trình **backup + restore** đã được test khôi phục thật, nhất quán giữa các node?
- [ ] Khóa chính an toàn giữa các node (dải ID/GUID/Snowflake), không đụng độ?

### 14.3. Khi gặp sự cố — quy trình chung

1. **Bật log chi tiết / xem log trước, đừng đoán.** Thông báo lỗi cấp cao thường chung chung; nguyên nhân thật nằm ở dòng lỗi cụ thể bên dưới.
2. **Khoanh vùng:** lỗi ở khâu nào — kết nối, khởi tạo/snapshot, áp dụng thay đổi, hay conflict?
3. **Xác định nhóm nguyên nhân** (quyền, đường dẫn, dung lượng, schema, mạng...) rồi xử lý đúng nhóm.
4. **Kiểm chứng trên staging** trước khi áp lên production nếu thay đổi có rủi ro.
5. **Ghi lại** nguyên nhân gốc và cách xử lý để lần sau nhanh hơn.

---

## 15. Thuật ngữ

| Thuật ngữ | Giải thích ngắn |
|---|---|
| **Replication** | Sao chép dữ liệu giữa các database |
| **Master / Primary / Leader** | Node nhận lệnh ghi |
| **Replica / Slave / Secondary / Follower** | Node nhận bản sao, thường chỉ đọc |
| **Replication lag** | Độ trễ giữa lúc ghi vào Master và lúc Replica có dữ liệu |
| **Synchronous / Asynchronous** | Chờ / không chờ bản sao xác nhận trước khi báo OK |
| **Semi-synchronous** | Chờ một bản sao *nhận* được (chưa cần áp dụng) |
| **WAL / binlog / oplog** | Nhật ký thay đổi dùng để replicate (Postgres / MySQL / MongoDB) |
| **Statement-based / Row-based** | Replicate theo câu lệnh / theo kết quả dòng |
| **GTID** | Định danh transaction toàn cục, giúp theo dõi đồng bộ |
| **Shard** | Một mảnh dữ liệu trên một server riêng |
| **Shard key** | Cột dùng để quyết định dòng dữ liệu nằm ở shard nào |
| **Hotspot** | Một shard/node bị quá tải so với phần còn lại |
| **Resharding** | Chia lại / phân bố lại dữ liệu giữa các shard |
| **Consistent Hashing** | Băm giúp thêm/bớt node mà ít phải di chuyển dữ liệu |
| **Scatter-gather** | Hỏi nhiều shard rồi gộp kết quả (truy vấn xuyên shard) |
| **Multi-master / Active-active** | Nhiều node cùng ghi rồi merge |
| **Active-passive** | Một node hoạt động, các node kia dự phòng |
| **Conflict** | Hai node sửa cùng một dòng theo hướng khác nhau |
| **Conflict resolver** | Logic quyết định giữ giá trị nào khi conflict |
| **LWW (Last Write Wins)** | Resolver: bản ghi mới nhất (theo timestamp/ID) thắng |
| **CRDT** | Cấu trúc dữ liệu tự merge được mà không cần giải quyết xung đột |
| **Split-brain** | Mạng chia cắt, nhiều nhóm node cùng tưởng mình là chính |
| **Quorum** | Cơ chế quá bán để quyết định nhóm nào được hoạt động |
| **Witness / Arbitrator node** | Node thứ ba làm trọng tài phá hòa |
| **Fencing / STONITH** | Cô lập node lỗi để nó không gây hại khi sống lại |
| **Consensus (Raft / Paxos)** | Thuật toán để các node thống nhất leader và thứ tự thao tác |
| **CAP theorem** | Chỉ đạt tối đa 2/3: Consistency, Availability, Partition-tolerance |
| **PACELC** | Mở rộng CAP: lúc bình thường còn phải chọn Latency vs Consistency |
| **Linearizability** | Mô hình nhất quán mạnh nhất (chữ C trong CAP) |
| **Eventual consistency** | Các node cuối cùng sẽ giống nhau, nhưng không tức thì |
| **Clock skew** | Đồng hồ các node lệch nhau, gây sai LWW |
| **HLC (Hybrid Logical Clock)** | Đồng hồ kết hợp thời gian vật lý và logic để sắp thứ tự |
| **Idempotency** | Thực hiện một thao tác nhiều lần cho kết quả như một lần |
| **Snapshot (SQL Server)** | Ảnh chụp dữ liệu ban đầu để khởi tạo Subscriber |
| **Publisher / Distributor / Subscriber** | Ba vai trò trong SQL Server replication |
| **Merge Agent / Snapshot Agent** | Tiến trình trộn dữ liệu / chụp snapshot trong merge replication |
| **UNC path** | Đường dẫn mạng dạng `\\server\share` |
| **OLTP / OLAP** | Tải giao dịch (nhanh, nhiều) / tải phân tích (nặng, quét lớn) |

---

*Tài liệu này nhằm mục đích học tập và tham khảo, tổng hợp từ tài liệu của Microsoft Learn, MySQL/PostgreSQL, các bài viết system design và kinh nghiệm vận hành thực tế. Khi áp dụng vào hệ thống thật, luôn kiểm chứng trên môi trường test trước, và tham khảo tài liệu chính thức của hệ quản trị bạn đang dùng vì chi tiết cấu hình có thể khác nhau giữa các phiên bản.*