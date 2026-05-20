# Hướng dẫn Backup & Restore Database tự động lên Google Drive

> Tài liệu này hướng dẫn từng bước cách thiết lập hệ thống backup tự động cho stack Docker gồm **MySQL, MongoDB, PostgreSQL, Redis**, đẩy backup lên **Google Drive**, và cách restore khi cần. Viết cho developer mới làm quen với Linux và backup.

---

## Mục lục

1. [Bài toán đặt ra](#1-bài-toán-đặt-ra)
2. [Mục tiêu](#2-mục-tiêu)
3. [Tổng quan kiến trúc giải pháp](#3-tổng-quan-kiến-trúc-giải-pháp)
4. [Kiến thức nền tảng](#4-kiến-thức-nền-tảng)
   - 4.1. [Backup là gì, restore là gì](#41-backup-là-gì-restore-là-gì)
   - 4.2. [Tại sao chọn dump (logical) thay vì copy file (physical)](#42-tại-sao-chọn-dump-logical-thay-vì-copy-file-physical)
   - 4.3. [Tại sao backup lên cloud, không chỉ giữ local](#43-tại-sao-backup-lên-cloud-không-chỉ-giữ-local)
   - 4.4. [Tại sao chọn rclone](#44-tại-sao-chọn-rclone)
   - 4.5. [Tại sao chọn Google Drive](#45-tại-sao-chọn-google-drive)
   - 4.6. [Tại sao phải cài rclone trên cả VPS và máy local Windows](#46-tại-sao-phải-cài-rclone-trên-cả-vps-và-máy-local-windows)
   - 4.7. [Cron là gì và tại sao dùng cron](#47-cron-là-gì-và-tại-sao-dùng-cron)
5. [Chuẩn bị](#5-chuẩn-bị)
6. [Implement từng bước](#6-implement-từng-bước)
   - 6.1. [Bước 1: Tạo cấu trúc thư mục](#61-bước-1-tạo-cấu-trúc-thư-mục)
   - 6.2. [Bước 2: Test thử dump từng database](#62-bước-2-test-thử-dump-từng-database)
   - 6.3. [Bước 3: Cài rclone trên VPS](#63-bước-3-cài-rclone-trên-vps)
   - 6.4. [Bước 4: Cài rclone trên máy local Windows](#64-bước-4-cài-rclone-trên-máy-local-windows)
   - 6.5. [Bước 5: Cấu hình rclone kết nối Google Drive](#65-bước-5-cấu-hình-rclone-kết-nối-google-drive)
   - 6.6. [Bước 6: Test rclone upload/download](#66-bước-6-test-rclone-uploaddownload)
   - 6.7. [Bước 7: Viết script backup tự động](#67-bước-7-viết-script-backup-tự-động)
   - 6.8. [Bước 8: Viết script restore](#68-bước-8-viết-script-restore)
   - 6.9. [Bước 9: Test restore (rất quan trọng)](#69-bước-9-test-restore-rất-quan-trọng)
   - 6.10. [Bước 10: Đăng ký cron chạy tự động](#610-bước-10-đăng-ký-cron-chạy-tự-động)
   - 6.11. [Bước 11: Verify cron hoạt động đúng](#611-bước-11-verify-cron-hoạt-động-đúng)
7. [Cách restore thực tế khi có sự cố](#7-cách-restore-thực-tế-khi-có-sự-cố)
8. [Bảo mật và lưu ý quan trọng](#8-bảo-mật-và-lưu-ý-quan-trọng)
9. [Troubleshooting (các lỗi thường gặp)](#9-troubleshooting)
10. [Glossary các lệnh Linux dùng trong tài liệu](#10-glossary-các-lệnh-linux-dùng-trong-tài-liệu)
11. [Hướng phát triển tiếp theo](#11-hướng-phát-triển-tiếp-theo)
12. [Phụ lục: Toàn bộ script](#12-phụ-lục-toàn-bộ-script)

---

## 1. Bài toán đặt ra

Bạn có một VPS chạy Docker Compose với stack gồm nhiều database:

- **MySQL** (container `mysql-nro`) — lưu data ứng dụng chính
- **MongoDB** (container `mongo`) — lưu logs, document data
- **PostgreSQL** (container `postgres`) — lưu data quan hệ phụ
- **Redis** (container `redis`) — cache hoặc state

**Vấn đề**:

- VPS có thể bị crash, ổ cứng hỏng, provider khóa account → mất data
- Lỡ tay chạy `DROP TABLE`, `db.collection.drop()`, hoặc `rm -rf` → mất data
- Bị tấn công ransomware → data bị mã hoá
- Sửa code có bug → data bị corrupt theo từng ngày, đến lúc phát hiện thì đã muộn

Nếu không có backup → mất data vĩnh viễn, không khôi phục được.

## 2. Mục tiêu

Xây dựng một hệ thống backup **tự động** đáp ứng các tiêu chí:

1. **Tự động hoàn toàn**, không cần can thiệp thủ công sau khi setup
2. **Chạy hàng ngày** vào giờ ít traffic (đêm khuya/sáng sớm)
3. **Lưu trữ off-site** (Google Drive) — không phụ thuộc VPS
4. **Có retention policy** — tự xoá file cũ để không tốn dung lượng
5. **Restore được nhanh chóng** chỉ bằng 1 lệnh
6. **Log đầy đủ** để debug khi có vấn đề
7. **Đã được test** — backup không test restore = không có backup

## 3. Tổng quan kiến trúc giải pháp

```
┌────────────────────────────────────────────────────────────┐
│                         VPS                                │
│                                                            │
│  ┌────────┐  ┌────────┐  ┌──────────┐  ┌──────┐            │
│  │ MySQL  │  │ Mongo  │  │ Postgres │  │Redis │            │
│  └───┬────┘  └───┬────┘  └────┬─────┘  └──┬───┘            │
│      │           │            │           │                │
│      │  mysqldump│  mongodump │ pg_dumpall│ BGSAVE         │
│      └─────┬─────┴─────┬──────┴─────┬─────┘                │
│            │           │            │                      │
│            ▼           ▼            ▼                      │
│      ┌──────────────────────────────────┐                  │
│      │  /root/db-backup/data/           │                  │
│      │  (giữ 7 ngày, tự dọn)            │                  │
│      └──────────────┬───────────────────┘                  │
│                     │                                      │
│                     │ rclone copy                          │
│                     ▼                                      │
└─────────────────────┼──────────────────────────────────────┘
                      │
                      ▼
              ┌──────────────┐
              │ Google Drive │
              │ db-backups/  │
              │ (giữ 30 ngày)│
              └──────────────┘

Trigger: cron, chạy hàng ngày lúc 4h sáng
```

**Flow chi tiết**:

1. Cron trigger script `backup.sh` lúc 4h sáng
2. Script lần lượt gọi tool dump của 4 DB → tạo 4 file `.gz`/`.rdb.gz` trong thư mục local
3. `rclone copy` đẩy 4 file vừa tạo lên Google Drive
4. `find` xoá file local cũ hơn 7 ngày
5. `rclone delete --min-age 30d` xoá file Drive cũ hơn 30 ngày
6. Log toàn bộ ra file `backup.log`

## 4. Kiến thức nền tảng

### 4.1. Backup là gì, restore là gì

- **Backup**: Tạo bản sao của data tại một thời điểm, lưu sang nơi khác. Mục đích: phòng khi data gốc mất/hỏng còn có cái để khôi phục.

- **Restore**: Đưa data từ bản backup vào lại hệ thống thật, đè lên hoặc thay thế data hiện tại.

Có 2 kiểu backup phổ biến:

| Kiểu | Mô tả | Ưu | Nhược |
|---|---|---|---|
| **Logical (dump)** | Xuất data thành câu SQL hoặc format có thể đọc được, ví dụ file `.sql` | Portable (mang qua DB phiên bản khác được), nhỏ gọn khi nén, dễ inspect | Chậm hơn khi DB lớn, restore lâu hơn |
| **Physical** | Copy file data binary trên ổ cứng | Nhanh, gần như instant snapshot | Phụ thuộc phiên bản DB, không nén được nhiều, file lớn |

Tài liệu này dùng **logical backup** (dump) cho cả 4 DB.

### 4.2. Tại sao chọn dump (logical) thay vì copy file (physical)

Lý do chính:

1. **Database đang chạy** không thể copy file binary trực tiếp — file đang được DB write, copy sẽ ra bản corrupt. Phải stop DB (downtime) hoặc dùng tool snapshot phức tạp.
2. **Logical dump xử lý đúng concurrency**: Lệnh như `mysqldump --single-transaction` tạo 1 snapshot consistent trong khi DB vẫn nhận request bình thường.
3. **Phục vụ học tập**: dump là chuẩn mực, mọi tutorial/tài liệu DB đều bắt đầu từ đây.
4. **Restore qua DB nhỏ rất nhanh** (chỉ vài giây).

### 4.3. Tại sao backup lên cloud, không chỉ giữ local

Quy tắc kinh điển trong industry: **3-2-1**:

- **3** bản copy của data
- **2** loại storage khác nhau
- **1** bản ở off-site (vị trí địa lý khác)

Nếu chỉ backup vào cùng VPS:
- VPS cháy/hỏng ổ cứng → mất cả data gốc và backup
- Bị hack → kẻ tấn công có thể xoá luôn backup

Lưu trên cloud (Google Drive, S3, Cloudflare R2...) là cách rẻ nhất để có off-site.

### 4.4. Tại sao chọn rclone

`rclone` là công cụ command-line đồng bộ file giữa máy local và cloud, **hỗ trợ ~70 dịch vụ**:

- Google Drive, Dropbox, OneDrive, MEGA, pCloud, Box
- AWS S3, Google Cloud Storage, Azure Blob, Cloudflare R2, Backblaze B2
- FTP, SFTP, WebDAV

So với các cách khác:

| Cách | Đánh giá |
|---|---|
| **Tự viết code gọi Google Drive API** | Phức tạp: tạo OAuth credential, handle refresh token, retry... mất nửa ngày. Đổi cloud phải viết lại. |
| **Mount Drive như ổ đĩa rồi `cp`** | Hay bị treo, không ổn định, tốc độ thất thường. |
| **`rclone copy`** ✅ | Một dòng. Cú pháp giống `cp`. Hôm nay dùng Drive, mai chuyển S3 — chỉ cần đổi tên remote. |

**Mental model của rclone**: Mỗi cloud account là một **remote** với tên do bạn đặt. Cú pháp:

```
remote_name:path/to/folder
```

Ví dụ:
- `gdrive:db-backups` → folder `db-backups` trên Google Drive (remote tên `gdrive`)
- `r2:my-bucket` → bucket trên Cloudflare R2 (nếu setup remote tên `r2`)

### 4.5. Tại sao chọn Google Drive

Trong context học tập/cá nhân với DB nhỏ (<500MB/ngày):

| Dịch vụ | Free tier | Đánh giá |
|---|---|---|
| **Google Drive** | 15GB free | ✅ Đủ chứa ~30-60 ngày backup, ai cũng đã có account Google |
| Cloudflare R2 | 10GB free | Tốt nhất khi data lớn, không tính phí egress, nhưng phải setup Cloudflare |
| AWS S3 | 5GB free (12 tháng) | Hết free tier phải trả, phí egress đắt |
| Backblaze B2 | 10GB free | OK nhưng ít phổ biến hơn |
| Dropbox | 2GB free | Quá nhỏ |
| MEGA | 20GB free | Tốc độ không ổn định |

Quyết định: **Google Drive vì đã có sẵn account + 15GB là đủ + dễ inspect qua web**.

### 4.6. Tại sao phải cài rclone trên cả VPS và máy local Windows

Đây là điểm thường gây bối rối cho người mới.

**Vấn đề**: Để rclone truy cập Google Drive, cần làm **OAuth** — đăng nhập Google, bấm "Allow" cho phép truy cập. Bước này **bắt buộc qua trình duyệt web**, Google không có cách nào khác.

**Tình huống**:
- VPS là server từ xa, command-line only, **không có browser**
- Không thể login Google trên VPS được

**Giải pháp**:
1. Cài rclone trên VPS → để chạy `rclone copy` trong script backup
2. Cài rclone trên máy local Windows (có browser) → để chỉ làm OAuth duy nhất 1 lần
3. Sau khi OAuth xong, copy token từ máy local sang VPS
4. VPS dùng token đó để truy cập Drive, không cần OAuth lại

Token có **refresh token** nên tự gia hạn vô hạn cho đến khi user revoke. Nghĩa là setup 1 lần, dùng mãi.

### 4.7. Cron là gì và tại sao dùng cron

`cron` là một **task scheduler** có sẵn trên mọi hệ Linux. Nó chạy như một service nền (`cron.service`), mỗi phút check file gọi là **crontab** xem có job nào cần chạy không.

**Crontab** là danh sách các job, mỗi dòng có format:

```
phút  giờ  ngày  tháng  thứ  lệnh-cần-chạy
```

Ví dụ:

| Cron expression | Ý nghĩa |
|---|---|
| `0 4 * * *` | 4:00 sáng mỗi ngày |
| `*/30 * * * *` | Mỗi 30 phút |
| `0 */6 * * *` | Mỗi 6 tiếng (0h, 6h, 12h, 18h) |
| `0 2 * * 0` | 2h sáng mỗi Chủ nhật |
| `* * * * *` | Mỗi phút (chỉ dùng để debug) |

Tại sao chọn cron mà không dùng cách khác:

- ✅ Có sẵn trên mọi Linux, không cần cài thêm
- ✅ Cực kỳ đơn giản, 1 dòng config là xong
- ✅ Robust — chạy đã 50 năm trên hàng triệu server
- ❌ Nếu server tắt đúng lúc cron schedule → bỏ qua, không chạy lại (với DB nhỏ, mất 1 ngày backup không nghiêm trọng)

Cách khác (systemd timer, k8s cronjob, n8n schedule...) phức tạp hơn nhiều, không cần thiết cho usecase này.

---

## 5. Chuẩn bị

Trước khi bắt đầu, đảm bảo:

- [ ] Có **quyền root hoặc sudo** trên VPS
- [ ] Stack docker-compose đang chạy: kiểm tra bằng `docker ps`
- [ ] Có **tài khoản Google** để lưu backup
- [ ] Máy local có **Windows/macOS/Linux có browser** để làm OAuth
- [ ] Có terminal/PuTTY/Windows Terminal để SSH vào VPS

Kiểm tra các container DB đang chạy:

```bash
docker ps --format "table {{.Names}}\t{{.Status}}" | grep -E "mysql-nro|mongo|postgres|redis"
```

Output phải có 4 container với trạng thái `Up`.

---

## 6. Implement từng bước

> **Lưu ý**: Tài liệu giả định bạn dùng user `root`. Nếu dùng user khác, thay `/root/` thành `/home/<username>/` trong tất cả các path.

### 6.1. Bước 1: Tạo cấu trúc thư mục

**Mục đích**: Tổ chức gọn gàng, tách biệt giữa script (logic) và data (file backup).

```bash
mkdir -p ~/db-backup/data
mkdir -p ~/db-backup/scripts
cd ~/db-backup
```

**Giải thích từng phần**:

- `mkdir` = "make directory" — tạo thư mục
- `-p` = "parents" — tạo cả các thư mục cha nếu chưa có, không báo lỗi nếu đã tồn tại
- `~` = ký hiệu cho "home directory" của user hiện tại (với root là `/root`, với user khác là `/home/username`)
- `cd` = "change directory" — chuyển vào thư mục đó

**Cấu trúc sau khi tạo**:

```
~/db-backup/
├── data/          # Chứa file backup (.sql.gz, .archive.gz, .rdb.gz)
└── scripts/       # Chứa script bash (backup.sh, restore.sh)
```

**Kiểm tra**:

```bash
ls -la ~/db-backup/
```

`ls` = "list" liệt kê file/thư mục, `-l` = long format (hiển thị quyền, owner, size, ngày), `-a` = hiện cả file ẩn (bắt đầu bằng `.`).

Phải thấy 2 thư mục `data` và `scripts`.

### 6.2. Bước 2: Test thử dump từng database

**Mục đích**: Tự động hoá một thứ chưa hoạt động = tự động tạo ra rác. Phải verify từng lệnh dump chạy được trước.

#### 6.2.1. Test dump MySQL

```bash
docker exec mysql-nro sh -c 'exec mysqldump -uroot -p"Phamhaidang112@" --all-databases --single-transaction --routines' > /tmp/test_mysql.sql
```

**Giải thích từng phần**:

| Phần | Ý nghĩa |
|---|---|
| `docker exec mysql-nro` | Chạy lệnh **bên trong** container tên `mysql-nro` |
| `sh -c '...'` | Bọc trong shell để password có ký tự đặc biệt (`@`) được parse đúng |
| `exec mysqldump` | Lệnh `exec` thay thế process shell bằng mysqldump → tiết kiệm 1 process, practice tốt |
| `-uroot` | User là `root` (không có khoảng trắng giữa `-u` và `root`) |
| `-p"Phamhaidang112@"` | Password (không có khoảng trắng giữa `-p` và password). Dấu `"..."` để bash hiểu cả `@` là một phần của password |
| `--all-databases` | Dump toàn bộ database trên server |
| `--single-transaction` | Tạo 1 transaction để dump nhất quán **mà không lock table** → server đang chạy vẫn dump được. Chỉ work với InnoDB engine |
| `--routines` | Kèm cả stored procedures và functions |
| `> /tmp/test_mysql.sql` | Redirect stdout (output) vào file |

**Verify**:

```bash
ls -lh /tmp/test_mysql.sql
head -5 /tmp/test_mysql.sql
```

- `ls -lh` → `-h` (human-readable) đổi byte thành KB/MB/GB
- `head -5` → in 5 dòng đầu file

Kết quả mong đợi:
- File có dung lượng (vài KB trở lên), không phải 0 byte
- Dòng đầu là `-- MySQL dump 10.13 ...` hoặc tương tự

> ⚠️ Có warning `mysqldump: [Warning] Using a password on the command line interface can be insecure.` — **bình thường, không phải lỗi**. Chỉ là MySQL nhắc nhở password có thể bị nhìn thấy trong `ps aux`.

#### 6.2.2. Test dump MongoDB

```bash
docker exec mongo sh -c 'exec mongodump -u admin -p haidang --authenticationDatabase admin --archive --gzip' > /tmp/test_mongo.archive.gz
```

**Giải thích các flag**:

- `-u admin -p haidang` → user/password để connect Mongo
- `--authenticationDatabase admin` → Mongo lưu user admin trong DB tên `admin`, phải nói rõ. Đây là chỗ rất hay quên
- `--archive` → output ra stdout dạng single archive (thay vì tạo nhiều file BSON riêng lẻ)
- `--gzip` → nén luôn trong khi dump → tiết kiệm dung lượng

**Verify**:

```bash
ls -lh /tmp/test_mongo.archive.gz
```

#### 6.2.3. Test dump PostgreSQL

```bash
docker exec postgres sh -c 'exec pg_dumpall -U admin' > /tmp/test_pg.sql
```

**Giải thích**:

- `pg_dumpall` (khác `pg_dump`): dump tất cả databases + roles + permissions trong cluster
- `-U admin` → user `admin`
- Không cần password vì PG dùng trust authentication khi connect qua localhost socket

**Verify**:

```bash
ls -lh /tmp/test_pg.sql
head -5 /tmp/test_pg.sql
```

Phải bắt đầu bằng `-- PostgreSQL database cluster dump`.

#### 6.2.4. Test dump Redis

```bash
docker exec redis redis-cli BGSAVE
sleep 3
docker cp redis:/data/dump.rdb /tmp/test_redis.rdb
```

**Giải thích**:

- `redis-cli BGSAVE` → ra lệnh Redis ghi snapshot xuống file `/data/dump.rdb` **trong background** (BG = background). Không block client, không downtime.
- `sleep 3` → đợi 3 giây cho BGSAVE ghi xong (DB nhỏ thì 3s đủ)
- `docker cp redis:/data/dump.rdb /tmp/test_redis.rdb` → copy file **từ container ra host**. Cú pháp: `docker cp container_name:path_in_container path_on_host`

> Redis khác 3 DB kia: không có lệnh `redis-dump`. Cách backup là ép Redis ghi snapshot rồi copy file đó.

**Verify**:

```bash
ls -lh /tmp/test_redis.rdb
```

Nếu cả 4 lệnh OK → dump đã hoạt động chính xác. Dọn rác:

```bash
rm /tmp/test_mysql.sql /tmp/test_mongo.archive.gz /tmp/test_pg.sql /tmp/test_redis.rdb
```

`rm` = "remove" — xoá file. Không có `Recycle Bin`, xoá là mất luôn → cẩn thận.

### 6.3. Bước 3: Cài rclone trên VPS

**Mục đích**: Để có công cụ upload lên Google Drive trong script backup.

```bash
curl https://rclone.org/install.sh | sudo bash
```

**Giải thích**:

- `curl` → download file từ URL
- `https://rclone.org/install.sh` → script cài đặt chính thức từ rclone team
- `|` → pipe — đưa output lệnh bên trái làm input lệnh bên phải
- `sudo bash` → chạy script với quyền root

**Verify**:

```bash
rclone version
```

Phải in ra `rclone v1.xx.x ...`. Ghi nhớ version, vì máy local cũng nên cài cùng version.

### 6.4. Bước 4: Cài rclone trên máy local Windows

**Mục đích**: Cần rclone trên máy có browser để làm OAuth Google Drive (lý do giải thích ở mục 4.6).

**Cách cài**:

1. Truy cập https://rclone.org/downloads/
2. Tải file `rclone-vX.XX.X-windows-amd64.zip` (cùng version với VPS)
3. Giải nén ra, ví dụ vào `C:\Users\user\Downloads\rclone-v1.74.1-windows-amd64\`
4. Mở **Command Prompt** hoặc **PowerShell**:
   - Bấm `Windows + R`, gõ `cmd`, Enter
5. `cd` vào thư mục giải nén:

```cmd
cd C:\Users\user\Downloads\rclone-v1.74.1-windows-amd64\rclone-v1.74.1-windows-amd64
```

> Trên Windows, đường dẫn dùng dấu `\`, khác Linux dùng `/`.

6. Test:

```cmd
rclone.exe version
```

> Trên Windows phải gõ `rclone.exe`. Trên Linux gõ `rclone`.

Phải in ra version giống VPS.

### 6.5. Bước 5: Cấu hình rclone kết nối Google Drive

Đây là bước phức tạp nhất. Phần này thao tác **xen kẽ giữa VPS và máy local**. Đọc hết hướng dẫn trước rồi bắt đầu để không bị luống cuống.

#### Trên VPS, chạy:

```bash
rclone config
```

Sẽ vào menu interactive. Trả lời từng prompt:

| Prompt | Trả lời | Tại sao |
|---|---|---|
| `e/n/d/r/c/s/q>` | `n` | n = New remote. Tạo remote mới |
| `name>` | `gdrive` | Tên tùy ý, ngắn gọn. Sau này dùng `gdrive:` để tham chiếu |
| `Storage>` | `drive` | Gõ chữ `drive` chứ không gõ số (số có thể đổi giữa các version) |
| `client_id>` | (Enter, bỏ trống) | Nâng cao mới cần. Mặc định rclone dùng client_id chung, đủ dùng |
| `client_secret>` | (Enter, bỏ trống) | Tương tự |
| `scope>` | `1` | 1 = Full access. Cần full để rclone xoá được file cũ. Scope 3 (drive.file) chỉ thấy file rclone tự tạo, an toàn hơn nhưng phức tạp khi quản lý |
| `service_account_file>` | (Enter, bỏ trống) | Dành cho automated systems (Google Cloud), không cần ở đây |
| `Edit advanced config?` | `n` | Cài mặc định là OK |
| `Use web browser to automatically authenticate?` | **`n`** | Vì VPS không có browser. Đây là điểm KEY |
| `config_token>` | (xem bước tiếp theo) | rclone sẽ in ra 1 lệnh, copy lệnh đó sang máy local |

Khi đến prompt `Enter verification code>` (hoặc `config_token>`), rclone sẽ in ra:

```
Execute the following on the machine with the web browser (same rclone version recommended):

	rclone authorize "drive" "eyJzY29wZSI6ImRyaXZlIn0"

Then paste the result.
```

**DỪNG LẠI Ở ĐÂY, ĐỪNG TẮT TERMINAL VPS.**

#### Chuyển sang máy local Windows

Mở Command Prompt đã `cd` vào thư mục rclone, chạy lệnh **chính xác** rclone in ra, nhưng đổi `rclone` thành `rclone.exe`:

```cmd
rclone.exe authorize "drive" "eyJzY29wZSI6ImRyaXZlIn0"
```

(thay chuỗi `eyJ...` bằng chuỗi VPS in ra)

Sau khi chạy:

1. Trình duyệt tự mở, hiển thị trang đăng nhập Google
2. Đăng nhập bằng tài khoản Google muốn dùng để lưu backup
3. Trang hiển thị: `rclone wants to access your Google Account`
   - Nếu có cảnh báo `Google hasn't verified this app` → bấm **Advanced** → **Go to rclone (unsafe)**. An toàn vì rclone là chính chủ, Google chỉ chưa verify
4. Tick chọn **See, edit, create, and delete all of your Google Drive files** → **Continue**
5. Browser hiện `Success!` → đóng tab
6. Quay lại Command Prompt, sẽ thấy in ra:

```
Paste the following into your remote machine --->
eyJ0b2tlbiI6IntcImFjY2Vzc190b2tlblwiOlwieWEyOS5hMEFRdlB5SU5Xa...
<---End paste
```

7. **Copy toàn bộ chuỗi** giữa `--->` và `<---End paste` (chỉ chuỗi, không lấy 2 dòng đánh dấu)

#### Quay lại VPS

Paste chuỗi vừa copy vào prompt `Enter verification code>` (hoặc `config_token>`), nhấn Enter.

Tiếp tục các prompt còn lại:

| Prompt | Trả lời | Tại sao |
|---|---|---|
| `Configure this as a Shared Drive (Team Drive)?` | `n` | Dùng My Drive cá nhân, không phải Shared Drive (cái này dành cho Google Workspace teams) |
| `Keep this "gdrive" remote?` | `y` | Lưu cấu hình |
| `e/n/d/r/c/s/q>` | `q` | Quit menu |

### 6.6. Bước 6: Test rclone upload/download

**Mục đích**: Verify config thành công, kết nối tới Drive hoạt động.

```bash
# Tạo folder trên Drive
rclone mkdir gdrive:db-backups

# List folder (sẽ rỗng vì mới tạo)
rclone ls gdrive:db-backups

# Upload 1 file test
echo "hello from VPS rclone" > /tmp/test.txt
rclone copy /tmp/test.txt gdrive:db-backups/

# List lại - phải thấy file
rclone ls gdrive:db-backups
```

**Giải thích**:

- `rclone mkdir REMOTE:PATH` → tạo folder trên remote
- `rclone ls REMOTE:PATH` → list file trong folder
- `echo "text" > file` → ghi `text` vào file (`>` ghi đè, `>>` append)
- `rclone copy SOURCE DEST` → copy SOURCE sang DEST. Cú pháp giống `cp` của Linux

Mở https://drive.google.com → kiểm tra thấy folder `db-backups` chứa `test.txt`.

Dọn rác:

```bash
rclone delete gdrive:db-backups/test.txt
rm /tmp/test.txt
```

`rclone delete REMOTE:PATH` → xoá file trên remote.

### 6.7. Bước 7: Viết script backup tự động

**Mục đích**: Tổng hợp tất cả các bước dump + upload vào 1 script tự động.

#### 6.7.1. Tạo file

```bash
nano ~/db-backup/scripts/backup.sh
```

**`nano`** là một text editor đơn giản trên Linux. Cách dùng:
- Gõ nội dung như editor thường
- `Ctrl + O` (sau đó Enter) → lưu file
- `Ctrl + X` → thoát
- `Ctrl + K` → xoá 1 dòng

Paste nội dung dưới (đổi password/user theo stack của bạn):

```bash
#!/bin/bash
# Backup script: dump 4 DB → local → upload Google Drive
# Chạy hàng ngày qua cron

set -euo pipefail

# ============ CẤU HÌNH ============
BACKUP_DIR="/root/db-backup/data"
DATE=$(date +%F_%H%M)
LOG_PREFIX="[$(date '+%F %T')]"

RCLONE_REMOTE="gdrive:db-backups"

MYSQL_PASS="Phamhaidang112@"
MONGO_USER="admin"
MONGO_PASS="haidang"
PG_USER="admin"

LOCAL_RETENTION_DAYS=7
DRIVE_RETENTION_DAYS=30

# ============ KHỞI ĐỘNG ============
mkdir -p "$BACKUP_DIR"
echo "$LOG_PREFIX === Bắt đầu backup ==="

# ============ MYSQL ============
echo "$LOG_PREFIX [MySQL] Đang dump..."
docker exec mysql-nro sh -c "exec mysqldump -uroot -p\"$MYSQL_PASS\" --all-databases --single-transaction --routines --triggers" \
  | gzip > "$BACKUP_DIR/mysql_$DATE.sql.gz"
echo "$LOG_PREFIX [MySQL] Done. Size: $(du -h "$BACKUP_DIR/mysql_$DATE.sql.gz" | cut -f1)"

# ============ MONGODB ============
echo "$LOG_PREFIX [MongoDB] Đang dump..."
docker exec mongo sh -c "exec mongodump -u $MONGO_USER -p $MONGO_PASS --authenticationDatabase admin --archive --gzip" \
  > "$BACKUP_DIR/mongo_$DATE.archive.gz"
echo "$LOG_PREFIX [MongoDB] Done. Size: $(du -h "$BACKUP_DIR/mongo_$DATE.archive.gz" | cut -f1)"

# ============ POSTGRESQL ============
echo "$LOG_PREFIX [Postgres] Đang dump..."
docker exec postgres sh -c "exec pg_dumpall -U $PG_USER" \
  | gzip > "$BACKUP_DIR/pg_$DATE.sql.gz"
echo "$LOG_PREFIX [Postgres] Done. Size: $(du -h "$BACKUP_DIR/pg_$DATE.sql.gz" | cut -f1)"

# ============ REDIS ============
echo "$LOG_PREFIX [Redis] Đang BGSAVE..."
LAST_SAVE_BEFORE=$(docker exec redis redis-cli LASTSAVE)
docker exec redis redis-cli BGSAVE > /dev/null
for i in {1..30}; do
  sleep 1
  LAST_SAVE_NOW=$(docker exec redis redis-cli LASTSAVE)
  if [ "$LAST_SAVE_NOW" != "$LAST_SAVE_BEFORE" ]; then
    break
  fi
done
docker cp redis:/data/dump.rdb "$BACKUP_DIR/redis_$DATE.rdb"
gzip "$BACKUP_DIR/redis_$DATE.rdb"
echo "$LOG_PREFIX [Redis] Done. Size: $(du -h "$BACKUP_DIR/redis_$DATE.rdb.gz" | cut -f1)"

# ============ UPLOAD GOOGLE DRIVE ============
echo "$LOG_PREFIX [Drive] Đang upload..."
rclone copy "$BACKUP_DIR" "$RCLONE_REMOTE" --include "*_$DATE.*"
echo "$LOG_PREFIX [Drive] Done."

# ============ DỌN FILE CŨ ============
echo "$LOG_PREFIX [Cleanup] Xoá file cũ..."
find "$BACKUP_DIR" -type f -mtime +$LOCAL_RETENTION_DAYS -delete
rclone delete "$RCLONE_REMOTE" --min-age ${DRIVE_RETENTION_DAYS}d

echo "$LOG_PREFIX === Hoàn tất ==="
```

#### 6.7.2. Giải thích từng phần

**Dòng `#!/bin/bash`** (gọi là **shebang**): Báo cho hệ điều hành script này chạy bằng bash. Bắt buộc ở dòng đầu mọi shell script.

**`set -euo pipefail`** — một trong những practice quan trọng nhất khi viết bash:

| Flag | Tác dụng | Tại sao cần |
|---|---|---|
| `-e` | Dừng script ngay khi có lệnh fail (exit code ≠ 0) | Mặc định bash bỏ qua lỗi, tiếp tục chạy. Với `-e`, nếu mysqldump fail thì script dừng luôn, không tạo file rác |
| `-u` | Báo lỗi khi dùng biến chưa định nghĩa | Tránh typo, ví dụ `$BACKUP_DR` thay vì `$BACKUP_DIR` sẽ bị catch ngay |
| `-o pipefail` | Pipe fail nếu **bất kỳ** lệnh nào trong pipe fail | Mặc định bash chỉ check exit code lệnh cuối. Ví dụ `mysqldump \| gzip` nếu mysqldump fail nhưng gzip ghi file rỗng "thành công" → bash coi như OK. Với `pipefail`, cả pipe fail → backup không bị "thành công giả" |

**Biến shell**:
- `BACKUP_DIR="/root/db-backup/data"` → định nghĩa biến. Không có khoảng trắng quanh `=`
- `$BACKUP_DIR` → reference biến (đặt trong `"..."` để xử lý đúng nếu có khoảng trắng)
- `$(date +%F_%H%M)` → command substitution. Chạy lệnh `date +%F_%H%M`, lấy output gán vào biến. `%F` = YYYY-MM-DD, `%H%M` = giờ-phút

**Pipe `|`**:
- `mysqldump ... | gzip > file.sql.gz` → output mysqldump pipe sang gzip nén, gzip output ghi vào file
- Lợi: không tạo file `.sql` tạm thời, dump bao nhiêu nén bấy nhiêu — tiết kiệm disk

**Redis BGSAVE loop**: `BGSAVE` chạy async. Hardcode `sleep 3` có thể không đủ nếu DB lớn. Loop check `LASTSAVE` (timestamp lần save cuối) để biết chính xác khi nào xong:

```bash
LAST_SAVE_BEFORE=$(docker exec redis redis-cli LASTSAVE)  # ghi nhận timestamp trước
docker exec redis redis-cli BGSAVE
for i in {1..30}; do
  sleep 1
  LAST_SAVE_NOW=$(docker exec redis redis-cli LASTSAVE)
  if [ "$LAST_SAVE_NOW" != "$LAST_SAVE_BEFORE" ]; then  # nếu timestamp đã thay đổi
    break  # → BGSAVE xong, thoát loop
  fi
done
```

**`find ... -mtime +7 -delete`**:
- `find PATH -type f` → tìm file (không phải folder) trong PATH
- `-mtime +7` → modification time > 7 ngày
- `-delete` → xoá luôn

**`rclone delete REMOTE --min-age 30d`**: Xoá file trên remote có age >= 30 ngày.

#### 6.7.3. Cấp quyền executable

```bash
chmod +x ~/db-backup/scripts/backup.sh
```

**`chmod`** = "change mode" — đổi quyền file. **`+x`** = thêm quyền execute (chạy được).

**Tại sao cần?**: Trên Linux, file phải có quyền `x` thì mới chạy được. Mặc định file mới tạo không có `x`. Nếu không `chmod +x`, gõ `./backup.sh` sẽ báo "Permission denied".

**Hệ thống quyền Linux**:

Mỗi file có 3 nhóm quyền — owner / group / other — mỗi nhóm có 3 quyền: read (r), write (w), execute (x).

Ví dụ: `-rwxr-xr-x`
- `-` → file thường (`d` nếu là directory)
- `rwx` → owner: đọc, ghi, chạy
- `r-x` → group: đọc, chạy, không ghi
- `r-x` → other: đọc, chạy, không ghi

`chmod +x file` → thêm x cho cả 3 nhóm. Còn `chmod 755 file` là cách số:
- 7 = 4 (r) + 2 (w) + 1 (x) = rwx
- 5 = 4 + 1 = r-x
- Vậy 755 = rwx-r-x-r-x

**Verify**:

```bash
ls -la ~/db-backup/scripts/backup.sh
```

Phải thấy `-rwxr-xr-x` (có chữ `x`).

#### 6.7.4. Chạy thử script

**Đừng đẩy vào cron ngay**. Chạy tay 1 lần để verify:

```bash
~/db-backup/scripts/backup.sh
```

Bạn sẽ thấy log từng bước. Nếu lỗi, script dừng và in lỗi → fix.

Verify file đã tạo:

```bash
ls -lh ~/db-backup/data/
rclone ls gdrive:db-backups
```

Cả 2 phải có 4 file với cùng timestamp:
- `mysql_YYYY-MM-DD_HHMM.sql.gz`
- `mongo_YYYY-MM-DD_HHMM.archive.gz`
- `pg_YYYY-MM-DD_HHMM.sql.gz`
- `redis_YYYY-MM-DD_HHMM.rdb.gz`

### 6.8. Bước 8: Viết script restore

**Mục đích**: Khi cần restore không phải nhớ lệnh dài, chỉ gõ 1 dòng.

```bash
nano ~/db-backup/scripts/restore.sh
```

Paste:

```bash
#!/bin/bash
# Restore script
# Usage: ./restore.sh <mysql|mongo|pg|redis> <backup_file>

set -euo pipefail

BACKUP_DIR="/root/db-backup/data"
MYSQL_PASS="Phamhaidang112@"
MONGO_USER="admin"
MONGO_PASS="haidang"
PG_USER="admin"

DB="${1:-}"
FILE="${2:-}"

if [ -z "$DB" ] || [ -z "$FILE" ]; then
  echo "Usage: $0 <mysql|mongo|pg|redis> <backup_file>"
  echo ""
  echo "Backup có sẵn local trong $BACKUP_DIR:"
  ls -1 "$BACKUP_DIR" 2>/dev/null || echo "  (trống)"
  echo ""
  echo "Để tải từ Google Drive về local trước:"
  echo "  rclone copy gdrive:db-backups/<tên_file> $BACKUP_DIR/"
  exit 1
fi

if [ ! -f "$FILE" ]; then
  if [ -f "$BACKUP_DIR/$FILE" ]; then
    FILE="$BACKUP_DIR/$FILE"
  else
    echo "Lỗi: không tìm thấy file $FILE"
    exit 1
  fi
fi

echo "Sắp restore $DB từ: $FILE"
echo "⚠️  CẢNH BÁO: Dữ liệu hiện tại sẽ bị ghi đè."
read -p "Tiếp tục? (gõ 'yes' để xác nhận): " confirm
if [ "$confirm" != "yes" ]; then
  echo "Đã huỷ."
  exit 0
fi

case "$DB" in
  mysql)
    gunzip < "$FILE" | docker exec -i mysql-nro sh -c "exec mysql -uroot -p\"$MYSQL_PASS\""
    ;;
  mongo)
    docker exec -i mongo sh -c "exec mongorestore -u $MONGO_USER -p $MONGO_PASS --authenticationDatabase admin --archive --gzip --drop" < "$FILE"
    ;;
  pg)
    gunzip < "$FILE" | docker exec -i postgres sh -c "exec psql -U $PG_USER -d postgres"
    ;;
  redis)
    TMP=$(mktemp)
    gunzip < "$FILE" > "$TMP"
    docker stop redis
    docker cp "$TMP" redis:/data/dump.rdb
    docker start redis
    rm "$TMP"
    ;;
  *)
    echo "DB không hợp lệ: $DB (phải là mysql|mongo|pg|redis)"
    exit 1
    ;;
esac

echo "✓ Restore xong."
```

Cấp quyền:

```bash
chmod +x ~/db-backup/scripts/restore.sh
```

#### Giải thích chi tiết

**Đọc tham số dòng lệnh**:
- `$1` = tham số thứ nhất (ví dụ `mysql`)
- `$2` = tham số thứ hai (ví dụ `mysql_2026-05-20.sql.gz`)
- `${1:-}` = nếu `$1` không tồn tại thì dùng chuỗi rỗng (tránh báo lỗi do `set -u`)

**`[ -z "$DB" ]`**: test xem `$DB` rỗng không. `-z` = zero length.

**`read -p "..." confirm`**: hỏi input user, lưu vào biến `confirm`. Đây là lý do script restore **không chạy được trong cron** — vì cron không có terminal để user gõ. Đúng ra restore phải chạy tay, có double check.

**`case ... esac`**: switch-case của bash. Pattern matching theo giá trị biến.

**`docker exec -i` (khác `-it`)**:
- `-i` = interactive, giữ stdin mở để pipe data vào
- `-t` = allocate TTY (terminal)
- Script không có terminal, chỉ có pipe → dùng `-i` thôi, **không** dùng `-it`

**Redis restore phải stop container**: Nếu không, Redis đang chạy sẽ overwrite `dump.rdb` khi shutdown → backup vô tác dụng.

**Postgres: thêm `-d postgres`**: `psql` cần connect vào 1 database có sẵn. Mặc định nó thử connect database tên = tên user, nhưng `admin` không phải database tồn tại. Database `postgres` luôn tồn tại trong mọi cluster, dùng làm điểm vào.

**MongoDB `--drop`**: Xoá collection cũ trước khi restore → tránh data mới và cũ lẫn lộn.

### 6.9. Bước 9: Test restore (rất quan trọng)

> **Quy tắc vàng**: Backup chưa được test restore = không có backup. Phải test ít nhất 1 lần để biết script restore thực sự hoạt động.

Test trên Postgres (DB ít data, dễ verify):

#### 9.1. Tạo data test

```bash
docker exec -it postgres psql -U admin -d admin_db -c "CREATE TABLE IF NOT EXISTS test_restore (id int, note text); INSERT INTO test_restore VALUES (1, 'truoc khi backup');"
docker exec -it postgres psql -U admin -d admin_db -c "SELECT * FROM test_restore;"
```

Phải thấy:

```
 id |       note
----+------------------
  1 | truoc khi backup
```

#### 9.2. Chạy backup

```bash
~/db-backup/scripts/backup.sh
```

#### 9.3. Giả lập "lỡ tay xoá data"

```bash
docker exec -it postgres psql -U admin -d admin_db -c "DROP TABLE test_restore;"
docker exec -it postgres psql -U admin -d admin_db -c "SELECT * FROM test_restore;"
```

Lệnh SELECT phải báo `relation "test_restore" does not exist` → đúng, data đã bị xoá.

#### 9.4. Restore

Tìm file backup vừa tạo:

```bash
ls -t ~/db-backup/data/pg_*.sql.gz | head -1
```

`ls -t` sort theo time, `head -1` lấy 1 dòng đầu → file mới nhất.

Restore:

```bash
~/db-backup/scripts/restore.sh pg pg_YYYY-MM-DD_HHMM.sql.gz
```

(thay tên file thật)

Gõ `yes` xác nhận.

#### 9.5. Verify

```bash
docker exec -it postgres psql -U admin -d admin_db -c "SELECT * FROM test_restore;"
```

Phải thấy `1 | truoc khi backup` xuất hiện lại.

Dọn rác:

```bash
docker exec -it postgres psql -U admin -d admin_db -c "DROP TABLE test_restore;"
```

### 6.10. Bước 10: Đăng ký cron chạy tự động

#### 10.1. Mở crontab

```bash
crontab -e
```

Lần đầu sẽ hỏi chọn editor → chọn `1` (nano).

`crontab -e` mở file crontab trong editor. Mỗi user có crontab riêng.

#### 10.2. Thêm vào cuối file

```cron
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

# Backup DB hằng ngày lúc 4h sáng
0 4 * * * /root/db-backup/scripts/backup.sh >> /root/db-backup/backup.log 2>&1
```

#### Giải thích từng phần

**Dòng `PATH=...`**: Cực kỳ quan trọng.

Cron chạy với môi trường **rất tối thiểu** — không có `$PATH` đầy đủ như khi bạn SSH vào. Nếu thiếu PATH:
- Script gọi `docker` → không tìm thấy → fail
- Gọi `rclone` → không tìm thấy → fail

Thêm dòng PATH ở đầu crontab → cron biết tìm binary ở đâu.

**Cron expression `0 4 * * *`**:

```
0   4   *   *   *
│   │   │   │   │
│   │   │   │   └── thứ trong tuần (0-7, 0 và 7 = CN)
│   │   │   └────── tháng (1-12)
│   │   └────────── ngày trong tháng (1-31)
│   └────────────── giờ (0-23)
└────────────────── phút (0-59)
```

`0 4 * * *` = phút 0 của giờ 4 mọi ngày = **4h00 sáng hằng ngày**.

Tại sao chọn 4h sáng? Ít traffic, ít người dùng → dump không ảnh hưởng performance. Tránh các giờ chẵn phổ biến (0h, 1h, 2h) vì nhiều job khác cũng chạy lúc đó (logrotate, certbot...).

**Phần đuôi `>> /root/db-backup/backup.log 2>&1`**:

- `>>` → append (không ghi đè) vào file log. Khác `>` ghi đè.
- `2>&1` → redirect stderr (file descriptor 2) vào stdout (file descriptor 1) → cả output bình thường và error đều ghi vào log.

Mặc định, **nếu không redirect log**, cron sẽ gửi email cho user mỗi khi job có output. Email tích lũy đầy `/var/mail/root`. Redirect vào file rõ ràng hơn.

Lưu file: `Ctrl+O`, Enter, `Ctrl+X`.

#### 10.3. Verify

```bash
crontab -l
```

`-l` = list. Phải in ra đúng nội dung vừa thêm.

```bash
systemctl status cron
```

Phải thấy `active (running)`. Trên 1 số distro service tên là `crond`, không phải `cron`.

### 6.11. Bước 11: Verify cron hoạt động đúng

Có 2 cách:

#### Cách 1: Test môi trường cron (nhanh, an toàn nhất)

Cron chạy script với môi trường tối thiểu, có thể script chạy được khi bạn SSH nhưng fail trong cron. Test bằng cách simulate môi trường cron:

```bash
env -i PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin HOME=/root /root/db-backup/scripts/backup.sh
```

`env -i` = xoá hết biến môi trường. Sau đó chỉ set lại `PATH` và `HOME`.

Nếu script chạy được với chỉ `PATH` + `HOME` → cron chắc chắn chạy được.

#### Cách 2: Test cron trigger thực tế

Tạm sửa crontab cho chạy sau 2-3 phút:

```bash
date  # xem giờ hiện tại, ví dụ 11:00
crontab -e
```

Thêm dòng (ví dụ chạy lúc 11:03):

```cron
3 11 * * * /root/db-backup/scripts/backup.sh >> /root/db-backup/backup.log 2>&1
```

Lưu, theo dõi:

```bash
tail -F /root/db-backup/backup.log
```

`-F` (chữ hoa) đợi file xuất hiện rồi mới đọc, hữu ích khi file chưa tồn tại. `-f` (chữ thường) báo lỗi nếu file không tồn tại.

Đợi đến giờ đã set. Log phải xuất hiện. Bấm `Ctrl+C` thoát.

Sau khi confirm OK, **nhớ xoá dòng test**, chỉ giữ `0 4 * * *`.

---

## 7. Cách restore thực tế khi có sự cố

### Scenario 1: Lỡ tay xoá table, cần restore ngay

File backup vẫn còn trong `~/db-backup/data/` (chưa quá 7 ngày):

```bash
# Liệt kê backup
ls -lh ~/db-backup/data/

# Restore
~/db-backup/scripts/restore.sh mysql mysql_2026-05-20_0400.sql.gz
```

Gõ `yes` xác nhận → đợi vài giây.

### Scenario 2: VPS bị reset, không còn file local

File local đã mất, nhưng còn trên Google Drive:

```bash
# List backup trên Drive
rclone ls gdrive:db-backups

# Tải về local
rclone copy gdrive:db-backups/mysql_2026-05-15_0400.sql.gz ~/db-backup/data/

# Restore
~/db-backup/scripts/restore.sh mysql mysql_2026-05-15_0400.sql.gz
```

### Scenario 3: VPS cháy hoàn toàn, dựng VPS mới

1. Setup lại stack docker-compose
2. Cài rclone, copy file `/root/.config/rclone/rclone.conf` từ backup khác sang (hoặc làm lại từ đầu)
3. Tải tất cả backup mới nhất:

```bash
rclone copy gdrive:db-backups/ /tmp/restore/ --include "*$(date +%F)*"
# hoặc tải tất cả
rclone copy gdrive:db-backups/ /tmp/restore/
```

4. Restore từng DB:

```bash
~/db-backup/scripts/restore.sh mysql /tmp/restore/mysql_xxx.sql.gz
~/db-backup/scripts/restore.sh mongo /tmp/restore/mongo_xxx.archive.gz
~/db-backup/scripts/restore.sh pg /tmp/restore/pg_xxx.sql.gz
~/db-backup/scripts/restore.sh redis /tmp/restore/redis_xxx.rdb.gz
```

---

## 8. Bảo mật và lưu ý quan trọng

### 8.1. Token rclone là credential nhạy cảm

File `~/.config/rclone/rclone.conf` chứa **refresh token** Google Drive — bất kỳ ai có file này đều truy cập được Drive của bạn (theo scope đã cấp). Bảo vệ:

```bash
chmod 600 ~/.config/rclone/rclone.conf
```

`600` = chỉ owner đọc/ghi, không ai khác.

### 8.2. Nếu lỡ leak token

Nếu token đã bị lộ (paste lên đâu đó, push lên git...):

1. Vào https://myaccount.google.com/permissions
2. Tìm `rclone` → bấm **Remove Access**
3. Trên VPS, chạy `rclone config` → `e` (edit) → `gdrive` → đi qua các bước lại để lấy token mới

### 8.3. Password trong script

Hiện tại password DB hardcode trong script. Để an toàn hơn, dùng file `.env`:

```bash
# /root/db-backup/.env
MYSQL_PASS='Phamhaidang112@'
MONGO_PASS='haidang'
```

Trong script:

```bash
source /root/db-backup/.env
```

Và `chmod 600` file `.env`.

### 8.4. Test restore định kỳ

Mỗi 1-3 tháng test restore 1 lần (trên DB phụ hoặc test environment) để chắc backup vẫn ngon. Backup có thể "hỏng âm thầm" — script chạy thành công nhưng file không restore được vì lỗi mới phát sinh.

### 8.5. Monitor backup thất bại

Hiện tại nếu cron fail, bạn không biết. Thêm monitor:

**Cách đơn giản — healthchecks.io (free)**:

1. Đăng ký https://healthchecks.io
2. Tạo check, lấy URL ping
3. Thêm vào script `backup.sh`:

```bash
# Ở đầu script
trap 'curl -fsS -m 10 --retry 3 https://hc-ping.com/YOUR-UUID/fail' ERR

# Ở cuối script (sau "Hoàn tất")
curl -fsS -m 10 --retry 3 https://hc-ping.com/YOUR-UUID
```

Nếu script không ping trong khoảng schedule, healthchecks gửi email báo.

### 8.6. Không backup quá nhiều thứ không cần

DB nhỏ không cần backup mỗi giờ. Daily là đủ. Lưu nhiều bản tốn dung lượng và tăng noise khi cần tìm bản nào để restore.

---

## 9. Troubleshooting

### 9.1. Cron không chạy

**Triệu chứng**: Tới giờ schedule mà file `backup.log` không update.

**Cách debug**:

```bash
# Check cron service
systemctl status cron

# Xem log cron của hệ thống
journalctl -u cron --since "10 min ago"
# hoặc
grep CRON /var/log/syslog | tail -20

# Test job đơn giản
echo '* * * * * echo "alive at $(date)" >> /tmp/cron_test.log 2>&1' | crontab -
sleep 90
cat /tmp/cron_test.log
```

Nguyên nhân thường gặp:

- **Thiếu PATH** → thêm dòng `PATH=...` đầu crontab
- **Script không executable** → `chmod +x script.sh`
- **Đường dẫn sai** → trong crontab phải dùng đường dẫn tuyệt đối (`/root/...`), không dùng `~`
- **Editor không lưu** → kiểm tra `crontab -l` xem có đúng không

### 9.2. mysqldump báo `Access denied`

Password sai hoặc cần escape:

```bash
# Test connect MySQL từ host
docker exec -it mysql-nro mysql -uroot -p"Phamhaidang112@"
```

Nếu connect được → password đúng. Nếu không → check `MYSQL_ROOT_PASSWORD` trong docker-compose.

### 9.3. rclone báo `token expired` / `Unauthorized`

Token bị revoke hoặc account bị issue. Chạy lại:

```bash
rclone config reconnect gdrive:
```

### 9.4. Disk full

Backup tích tụ chiếm dung lượng. Kiểm tra:

```bash
du -sh /root/db-backup/data/
df -h
```

Retention không hoạt động đúng nếu `find` không xoá được file. Test:

```bash
find /root/db-backup/data/ -type f -mtime +7
```

Nếu có file >7 ngày in ra mà không bị xoá → check log script xem có lỗi không.

### 9.5. mongorestore báo `connection refused`

Container mongo chưa ready. Đợi 5-10s sau khi `docker start mongo` rồi restore.

### 9.6. Restore Postgres báo `database "admin" does not exist`

`psql` mặc định cố connect database tên trùng user. Sửa script restore thêm `-d postgres`:

```bash
gunzip < "$FILE" | docker exec -i postgres sh -c "exec psql -U $PG_USER -d postgres"
```

### 9.7. Backup chạy quá lâu, ảnh hưởng performance

DB lớn lên, dump chiếm tài nguyên. Cách giảm tải:

- **MySQL**: thêm `--quick --skip-lock-tables`
- **Mongo**: thêm `--numParallelCollections=1`
- **Schedule giờ ít traffic hơn**, ví dụ 3h sáng thay vì 4h

---

## 10. Glossary các lệnh Linux dùng trong tài liệu

| Lệnh | Ý nghĩa | Ví dụ |
|---|---|---|
| `mkdir -p` | Tạo thư mục (cả parent nếu cần) | `mkdir -p ~/a/b/c` |
| `cd` | Chuyển thư mục | `cd ~/db-backup` |
| `ls -lh` | List file, long format, human-readable size | `ls -lh ~/db-backup/data/` |
| `cat` | In nội dung file | `cat backup.log` |
| `head -N` | In N dòng đầu | `head -5 file.txt` |
| `tail -N` | In N dòng cuối | `tail -20 backup.log` |
| `tail -f / -F` | Theo dõi file real-time | `tail -F backup.log` |
| `rm` | Xoá file (không có thùng rác!) | `rm /tmp/test.txt` |
| `cp` | Copy file | `cp a.txt b.txt` |
| `mv` | Move/rename | `mv old.txt new.txt` |
| `nano FILE` | Mở file trong editor nano | `nano script.sh` |
| `chmod +x` | Thêm quyền execute | `chmod +x script.sh` |
| `chmod 600` | Set quyền rw cho owner thôi | `chmod 600 secret.conf` |
| `chown` | Đổi owner file | `chown user:group file` |
| `du -sh` | Disk usage of folder | `du -sh /var/log` |
| `df -h` | Disk free trên các partition | `df -h` |
| `find PATH -type f -mtime +N -delete` | Tìm file > N ngày và xoá | `find . -type f -mtime +30 -delete` |
| `grep` | Tìm chuỗi trong file/output | `grep ERROR backup.log` |
| `sed` | Tìm-thay chuỗi | `sed 's/old/new/g' file` |
| `>` | Redirect stdout, ghi đè | `echo "x" > file` |
| `>>` | Redirect stdout, append | `echo "x" >> file` |
| `2>&1` | Redirect stderr vào stdout | `cmd >> log 2>&1` |
| `\|` (pipe) | Output lệnh trái → input lệnh phải | `cat f \| grep abc` |
| `$VAR` | Reference biến shell | `echo $HOME` |
| `$(...)` | Command substitution | `DATE=$(date)` |
| `crontab -e` | Edit cron jobs | |
| `crontab -l` | List cron jobs | |
| `systemctl status SERVICE` | Trạng thái service | `systemctl status cron` |
| `journalctl -u SERVICE` | Log service | `journalctl -u cron --since "1 hour ago"` |
| `docker ps` | List container đang chạy | |
| `docker exec CONT CMD` | Chạy lệnh trong container | `docker exec mysql-nro ls /` |
| `docker cp` | Copy file giữa container và host | `docker cp redis:/data/x .` |
| `docker stop/start/restart` | Điều khiển container | `docker stop redis` |
| `curl URL` | HTTP GET (download/ping) | `curl https://example.com` |
| `wget URL` | Download file | `wget https://x.com/file.tar` |
| `gzip / gunzip` | Nén / giải nén | `gzip file.sql` |
| `tar` | Đóng gói nhiều file | `tar -czf x.tar.gz folder/` |
| `ssh` | Connect server | `ssh user@host` |
| `scp` | Copy file qua SSH | `scp file user@host:/path/` |
| `rsync` | Sync file (mạnh hơn scp) | `rsync -av src/ dst/` |

---

## 11. Hướng phát triển tiếp theo

Sau khi setup cơ bản hoạt động, có thể nâng cấp dần:

### 11.1. Mã hoá backup trước khi upload

Backup chứa password và data nhạy cảm. Mã hoá để Google không đọc được nội dung:

Tạo crypt remote wrap lên `gdrive`:

```bash
rclone config
# new remote: gdrive-crypt
# type: crypt
# remote: gdrive:db-backups-encrypted
# password: ĐẶT-MẬT-KHẨU-MẠNH-VÀ-LƯU-LẠI
```

Đổi trong script: `RCLONE_REMOTE="gdrive-crypt:"`.

⚠️ **Mất mật khẩu = mất backup vĩnh viễn**. Lưu mật khẩu vào password manager.

### 11.2. Backup chéo VPS

Thêm step rsync sang VPS khác để restore cực nhanh khi cần:

```bash
rsync -avz -e "ssh -i ~/.ssh/backup_key" \
  "$BACKUP_DIR/" "user@vps2:~/db-backups/"
```

### 11.3. Multiple cloud (Drive + R2)

Backup lên cả Google Drive **và** Cloudflare R2 → an toàn hơn nữa:

```bash
rclone copy "$BACKUP_DIR" gdrive:db-backups/ --include "*_$DATE.*"
rclone copy "$BACKUP_DIR" r2:db-backups/ --include "*_$DATE.*"
```

### 11.4. Hourly backup cho DB quan trọng

Chia làm 2 cron:

```cron
# Backup đầy đủ 4h sáng
0 4 * * * /root/db-backup/scripts/backup.sh

# Chỉ MySQL mỗi 6 tiếng
0 */6 * * * /root/db-backup/scripts/backup-mysql-only.sh
```

### 11.5. Point-in-Time Recovery (PITR)

Backup chỉ recover được tới snapshot cuối. Để recover bất kỳ thời điểm nào, dùng:
- **MySQL binlog**
- **Postgres WAL archiving**

Phức tạp hơn nhiều, chỉ cần khi DB production lớn.

### 11.6. Backup volume Docker

Hiện tại chỉ logical dump. Có thể backup thêm volume Docker (data thật):

```bash
docker run --rm \
  -v mysql_data:/source:ro \
  -v $(pwd):/backup \
  alpine tar -czf /backup/mysql_volume_$DATE.tar.gz -C /source .
```

### 11.7. Backup config + code

Backup không chỉ DB:

```bash
tar -czf "$BACKUP_DIR/config_$DATE.tar.gz" \
  /root/docker-compose.yml \
  /root/nginx.conf \
  /root/configAdmin.sql
```

---

## 12. Phụ lục: Toàn bộ script

### 12.1. `backup.sh`

```bash
#!/bin/bash
set -euo pipefail

BACKUP_DIR="/root/db-backup/data"
DATE=$(date +%F_%H%M)
LOG_PREFIX="[$(date '+%F %T')]"

RCLONE_REMOTE="gdrive:db-backups"

MYSQL_PASS="Phamhaidang112@"
MONGO_USER="admin"
MONGO_PASS="haidang"
PG_USER="admin"

LOCAL_RETENTION_DAYS=7
DRIVE_RETENTION_DAYS=30

mkdir -p "$BACKUP_DIR"
echo "$LOG_PREFIX === Bắt đầu backup ==="

# MySQL
echo "$LOG_PREFIX [MySQL] Đang dump..."
docker exec mysql-nro sh -c "exec mysqldump -uroot -p\"$MYSQL_PASS\" --all-databases --single-transaction --routines --triggers" \
  | gzip > "$BACKUP_DIR/mysql_$DATE.sql.gz"
echo "$LOG_PREFIX [MySQL] Done. Size: $(du -h "$BACKUP_DIR/mysql_$DATE.sql.gz" | cut -f1)"

# MongoDB
echo "$LOG_PREFIX [MongoDB] Đang dump..."
docker exec mongo sh -c "exec mongodump -u $MONGO_USER -p $MONGO_PASS --authenticationDatabase admin --archive --gzip" \
  > "$BACKUP_DIR/mongo_$DATE.archive.gz"
echo "$LOG_PREFIX [MongoDB] Done. Size: $(du -h "$BACKUP_DIR/mongo_$DATE.archive.gz" | cut -f1)"

# PostgreSQL
echo "$LOG_PREFIX [Postgres] Đang dump..."
docker exec postgres sh -c "exec pg_dumpall -U $PG_USER" \
  | gzip > "$BACKUP_DIR/pg_$DATE.sql.gz"
echo "$LOG_PREFIX [Postgres] Done. Size: $(du -h "$BACKUP_DIR/pg_$DATE.sql.gz" | cut -f1)"

# Redis
echo "$LOG_PREFIX [Redis] Đang BGSAVE..."
LAST_SAVE_BEFORE=$(docker exec redis redis-cli LASTSAVE)
docker exec redis redis-cli BGSAVE > /dev/null
for i in {1..30}; do
  sleep 1
  LAST_SAVE_NOW=$(docker exec redis redis-cli LASTSAVE)
  if [ "$LAST_SAVE_NOW" != "$LAST_SAVE_BEFORE" ]; then
    break
  fi
done
docker cp redis:/data/dump.rdb "$BACKUP_DIR/redis_$DATE.rdb"
gzip "$BACKUP_DIR/redis_$DATE.rdb"
echo "$LOG_PREFIX [Redis] Done. Size: $(du -h "$BACKUP_DIR/redis_$DATE.rdb.gz" | cut -f1)"

# Upload Google Drive
echo "$LOG_PREFIX [Drive] Đang upload..."
rclone copy "$BACKUP_DIR" "$RCLONE_REMOTE" --include "*_$DATE.*"
echo "$LOG_PREFIX [Drive] Done."

# Cleanup
echo "$LOG_PREFIX [Cleanup] Xoá file cũ..."
find "$BACKUP_DIR" -type f -mtime +$LOCAL_RETENTION_DAYS -delete
rclone delete "$RCLONE_REMOTE" --min-age ${DRIVE_RETENTION_DAYS}d

echo "$LOG_PREFIX === Hoàn tất ==="
```

### 12.2. `restore.sh`

```bash
#!/bin/bash
# Usage: ./restore.sh <mysql|mongo|pg|redis> <backup_file>

set -euo pipefail

BACKUP_DIR="/root/db-backup/data"
MYSQL_PASS="Phamhaidang112@"
MONGO_USER="admin"
MONGO_PASS="haidang"
PG_USER="admin"

DB="${1:-}"
FILE="${2:-}"

if [ -z "$DB" ] || [ -z "$FILE" ]; then
  echo "Usage: $0 <mysql|mongo|pg|redis> <backup_file>"
  echo ""
  echo "Backup có sẵn local trong $BACKUP_DIR:"
  ls -1 "$BACKUP_DIR" 2>/dev/null || echo "  (trống)"
  echo ""
  echo "Để tải từ Google Drive về local trước:"
  echo "  rclone copy gdrive:db-backups/<tên_file> $BACKUP_DIR/"
  exit 1
fi

if [ ! -f "$FILE" ]; then
  if [ -f "$BACKUP_DIR/$FILE" ]; then
    FILE="$BACKUP_DIR/$FILE"
  else
    echo "Lỗi: không tìm thấy file $FILE"
    exit 1
  fi
fi

echo "Sắp restore $DB từ: $FILE"
echo "⚠️  CẢNH BÁO: Dữ liệu hiện tại sẽ bị ghi đè."
read -p "Tiếp tục? (gõ 'yes' để xác nhận): " confirm
if [ "$confirm" != "yes" ]; then
  echo "Đã huỷ."
  exit 0
fi

case "$DB" in
  mysql)
    gunzip < "$FILE" | docker exec -i mysql-nro sh -c "exec mysql -uroot -p\"$MYSQL_PASS\""
    ;;
  mongo)
    docker exec -i mongo sh -c "exec mongorestore -u $MONGO_USER -p $MONGO_PASS --authenticationDatabase admin --archive --gzip --drop" < "$FILE"
    ;;
  pg)
    gunzip < "$FILE" | docker exec -i postgres sh -c "exec psql -U $PG_USER -d postgres"
    ;;
  redis)
    TMP=$(mktemp)
    gunzip < "$FILE" > "$TMP"
    docker stop redis
    docker cp "$TMP" redis:/data/dump.rdb
    docker start redis
    rm "$TMP"
    ;;
  *)
    echo "DB không hợp lệ: $DB (phải là mysql|mongo|pg|redis)"
    exit 1
    ;;
esac

echo "✓ Restore xong."
```

### 12.3. Crontab entries

```cron
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

# Backup DB hằng ngày lúc 4h sáng
0 4 * * * /root/db-backup/scripts/backup.sh >> /root/db-backup/backup.log 2>&1
```

---

## Tóm tắt

| Thành phần | File / Lệnh |
|---|---|
| Cấu trúc thư mục | `/root/db-backup/{data,scripts}` |
| Script backup | `/root/db-backup/scripts/backup.sh` |
| Script restore | `/root/db-backup/scripts/restore.sh` |
| Log | `/root/db-backup/backup.log` |
| Cron schedule | `0 4 * * *` (4h sáng hằng ngày) |
| Lưu trữ local | `~/db-backup/data/` — giữ 7 ngày |
| Lưu trữ cloud | `gdrive:db-backups/` — giữ 30 ngày |
| rclone config | `~/.config/rclone/rclone.conf` |

Sau khi setup xong, hệ thống chạy tự động. Chỉ cần thỉnh thoảng:

- Kiểm tra `tail backup.log` để chắc backup chạy ngon
- Test restore 1-3 tháng 1 lần
- Theo dõi dung lượng Drive (`rclone size gdrive:db-backups`)

**Chúc bạn không bao giờ phải dùng đến backup. Nhưng khi cần, nó luôn ở đó.** 🎯