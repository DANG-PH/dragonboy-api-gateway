# Hướng dẫn Backup & Restore Database tự động lên Google Drive

> Tài liệu này hướng dẫn từng bước cách thiết lập hệ thống backup tự động cho stack Docker gồm **MySQL, MongoDB, PostgreSQL, Redis**, đẩy backup lên **Google Drive**, và cách restore khi cần. Viết cho developer mới làm quen với Linux và backup.
>
> **Phiên bản này dùng cách "Infrastructure as Code"**: toàn bộ script được commit vào git repo cùng docker-compose. Setup VPS mới chỉ cần `git clone` + chạy `setup.sh`.

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
   - 4.8. [Tại sao đưa scripts vào git repo](#48-tại-sao-đưa-scripts-vào-git-repo)
5. [Cấu trúc repo](#5-cấu-trúc-repo)
6. [Tiền đề: 6 bước thủ công trước khi chạy `setup.sh`](#6-tiền-đề-6-bước-thủ-công-trước-khi-chạy-setupsh)
   - 6.1. [Cài Docker + Docker Compose](#61-cài-docker--docker-compose)
   - 6.2. [Clone repo về VPS](#62-clone-repo-về-vps)
   - 6.3. [Tạo file `.env` từ template](#63-tạo-file-env-từ-template)
   - 6.4. [Bật stack docker-compose](#64-bật-stack-docker-compose)
   - 6.5. [Cài rclone trên VPS](#65-cài-rclone-trên-vps)
   - 6.6. [Cấu hình rclone — kết nối Google Drive](#66-cấu-hình-rclone--kết-nối-google-drive)
7. [Chạy `setup.sh` để hoàn tất](#7-chạy-setupsh-để-hoàn-tất)
8. [Test thử backup và restore](#8-test-thử-backup-và-restore)
9. [Cách restore thực tế khi có sự cố](#9-cách-restore-thực-tế-khi-có-sự-cố)
10. [Workflow git khi sửa script](#10-workflow-git-khi-sửa-script)
11. [Bảo mật và lưu ý quan trọng](#11-bảo-mật-và-lưu-ý-quan-trọng)
12. [Troubleshooting](#12-troubleshooting)
13. [Glossary các lệnh Linux](#13-glossary-các-lệnh-linux)
14. [Hướng phát triển tiếp theo](#14-hướng-phát-triển-tiếp-theo)
15. [Phụ lục: Toàn bộ nội dung file](#15-phụ-lục-toàn-bộ-nội-dung-file)

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
8. **Infrastructure as Code** — script ở trong repo, setup VPS mới chỉ cần git clone

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
│      │  <repo>/backup/data/             │                  │
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

Trigger: cron, chạy hàng ngày lúc 4h sáng (cấu hình trong .env)
```

**Flow chi tiết**:

1. Cron trigger script `backup.sh` lúc 4h sáng
2. Script load config từ `.env` (password DB, tên container, retention)
3. Lần lượt gọi tool dump của 4 DB → tạo 4 file `.gz`/`.rdb.gz` trong thư mục local
4. `rclone copy` đẩy 4 file vừa tạo lên Google Drive
5. `find` xoá file local cũ hơn 7 ngày
6. `rclone delete --min-age 30d` xoá file Drive cũ hơn 30 ngày
7. Log toàn bộ ra file `backup.log`

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

### 4.8. Tại sao đưa scripts vào git repo

Trước đây ta hay làm: SSH vào VPS → `nano script.sh` → paste nội dung → setup cron thủ công. Cách này có nhược điểm:

- Setup VPS mới phải làm lại từ đầu, dễ sai sót
- Sửa script trên VPS, không lưu vết → quên mất đã sửa gì
- Mất VPS = mất luôn script (nếu không có backup khác)
- Khó share với team

Đưa scripts vào git repo (**Infrastructure as Code**):

✅ Setup VPS mới: `git clone` + `./setup.sh` là xong
✅ Mọi thay đổi được track qua git log
✅ Rollback dễ: `git revert <commit>`
✅ Share với team đơn giản
✅ Đồng bộ giữa nhiều VPS

**Cảnh báo bảo mật**: Không commit **secrets** (password, OAuth token). Dùng file `.env` (gitignore) để chứa secrets, mỗi VPS tự tạo riêng.

## 5. Cấu trúc repo

```
your-repo/                              # Ví dụ: MICROSERVICE_NGINX_SERVICE
├── docker-compose.yml                  # Stack chính (MySQL, Mongo, PG, Redis...)
├── configAdmin.sql                     # Init script MySQL (nếu có)
├── nginx.conf                          # Cấu hình nginx (nếu có)
├── .env                                # ❌ KHÔNG commit (chứa password)
├── .env.example                        # ✅ Commit, template cho .env
├── .gitignore                          # Chặn .env, backup data, etc.
└── backup/
    ├── README.md                       # Hướng dẫn ngắn cho repo
    ├── data/                           # ❌ KHÔNG commit (chứa data DB nén)
    ├── backup.log                      # ❌ KHÔNG commit (log của cron)
    └── scripts/
        ├── backup.sh                   # Script backup (cron tự gọi)
        ├── restore.sh                  # Script restore (chạy tay)
        └── setup.sh                    # Script setup lần đầu
```

**File quan trọng**:

- **`.env.example`**: template, chứa tên biến và placeholder value. Commit để team biết cần config gì.
- **`.env`**: file thật, chứa password. **Không commit**. Mỗi VPS tự tạo từ `.env.example`.
- **`.gitignore`**: chặn `.env`, `backup/data/`, `backup/*.log` khỏi git.
- **`setup.sh`**: chạy 1 lần khi setup VPS mới — verify môi trường, đăng ký cron.
- **`backup.sh`**: cron tự gọi hàng ngày.
- **`restore.sh`**: chạy tay khi cần restore.

## 6. Tiền đề: 6 bước thủ công trước khi chạy `setup.sh`

`setup.sh` chỉ **verify môi trường + đăng ký cron**, không tự cài Docker hay làm OAuth. 6 bước dưới đây **bắt buộc thủ công** vì:

- Cần `sudo` (cài Docker, rclone)
- Cần input từ user (password, token OAuth)
- Cần browser (OAuth Google)

Thời gian lần đầu khoảng **15-20 phút**.

### 6.1. Cài Docker + Docker Compose

**Tại sao thủ công**: Cài Docker cần `sudo`, mỗi distro Linux khác nhau. Không gộp vào `setup.sh` để dev kiểm soát từng bước.

```bash
# Ubuntu/Debian
curl -fsSL https://get.docker.com | sh
sudo systemctl enable --now docker

# Verify
docker --version
docker compose version
```

> Trên Ubuntu mới, `docker compose` (có khoảng trắng) là plugin chính thức, khác `docker-compose` (cũ, có dấu gạch).

### 6.2. Clone repo về VPS

```bash
cd /root
git clone <URL_REPO> MICROSERVICE_NGINX_SERVICE   # đổi tên theo repo của bạn
cd MICROSERVICE_NGINX_SERVICE
```

Verify cấu trúc:

```bash
ls -la
```

Phải thấy `docker-compose.yml`, `.env.example`, `.gitignore`, và folder `backup/`.

### 6.3. Tạo file `.env` từ template

**Tại sao thủ công**: Password là secret, không thể tự động hoá. Mỗi dev/VPS tự điền password riêng.

```bash
cp .env.example .env
nano .env
```

Điền các giá trị thật. **Lưu ý**: password có ký tự đặc biệt (`@`, `$`, `!`) phải bọc nháy đơn:

```bash
MYSQL_PASS='Phamhaidang112@'
MONGO_USER=admin
MONGO_PASS='haidang'
PG_USER=admin

RCLONE_REMOTE=gdrive:db-backups

LOCAL_RETENTION_DAYS=7
DRIVE_RETENTION_DAYS=30

CRON_HOUR=4
CRON_MINUTE=0

MYSQL_CONTAINER=mysql-nro
MONGO_CONTAINER=mongo
POSTGRES_CONTAINER=postgres
REDIS_CONTAINER=redis
```

Lưu (`Ctrl+O`, Enter, `Ctrl+X`). Set quyền chỉ root đọc được:

```bash
chmod 600 .env
ls -la .env
```

Phải thấy `-rw-------`.

**Vì sao `chmod 600`?** File chứa password. Mặc định Linux cho group/other đọc được file (`-rw-r--r--`). `600` = chỉ owner đọc/ghi → an toàn hơn.

### 6.4. Bật stack docker-compose

**Tại sao thủ công**: `setup.sh` chỉ **check** containers đã chạy chứ không tự bật. Lý do: nếu compose có lỗi cấu hình (sai port, thiếu volume), để dev xử lý từng bước rõ ràng hơn là gộp vào script và phải debug.

```bash
docker compose up -d
```

Đợi 15-20 giây cho DB init lần đầu (volume mới, cần tạo data files):

```bash
sleep 15
docker ps --format "table {{.Names}}\t{{.Status}}"
```

Verify 4 container target đang chạy:

```bash
docker ps --format "table {{.Names}}\t{{.Status}}" | grep -E "mysql-nro|mongo|postgres|redis"
```

Phải có 4 container `Up`.

### 6.5. Cài rclone trên VPS

```bash
curl https://rclone.org/install.sh | sudo bash
rclone version
```

Phải in ra `rclone v1.xx.x`. Ghi nhớ version để cài cùng version trên máy local.

> Thật ra `setup.sh` đã có logic tự cài rclone nếu chưa có. Bước này có thể bỏ qua, `setup.sh` sẽ tự xử lý. Nhưng làm trước cho rõ ràng.

### 6.6. Cấu hình rclone — kết nối Google Drive

**Tại sao thủ công**: OAuth Google **bắt buộc** thông qua browser. Không có API/CLI cách nào skip được. Đây là giới hạn của Google.

Đây là bước phức tạp nhất, cần thao tác **xen kẽ giữa VPS và máy local có browser**.

#### Chuẩn bị máy local Windows

Cài rclone trên máy local:

1. Tải `rclone-vX.XX.X-windows-amd64.zip` từ https://rclone.org/downloads/ (cùng version với VPS)
2. Giải nén
3. Mở Command Prompt, `cd` vào thư mục giải nén
4. Test: `rclone.exe version`

#### Chạy `rclone config` trên VPS

```bash
rclone config
```

Trả lời các prompt theo thứ tự:

| Prompt | Trả lời | Tại sao |
|---|---|---|
| `e/n/d/r/c/s/q>` | `n` | n = New remote |
| `name>` | `gdrive` | Phải trùng với `RCLONE_REMOTE=gdrive:...` trong `.env` |
| `Storage>` | `drive` | Gõ chữ, không gõ số (số có thể đổi giữa các version) |
| `client_id>` | Enter (bỏ trống) | Nâng cao mới cần |
| `client_secret>` | Enter (bỏ trống) | Tương tự |
| `scope>` | `1` | Full access. Cần full để rclone xoá được file cũ (retention policy) |
| `service_account_file>` | Enter (bỏ trống) | Dành cho automated systems (Google Cloud) |
| `Edit advanced config?` | `n` | Mặc định OK |
| `Use web browser to automatically authenticate?` | **`n`** | Vì VPS không có browser. Đây là điểm KEY |
| `config_token>` | (xem bước tiếp theo) | rclone in ra lệnh, copy sang máy local |

Khi đến prompt `config_token>`, rclone sẽ in ra:

```
Execute the following on the machine with the web browser (same rclone version recommended):

	rclone authorize "drive" "eyJzY29wZSI6ImRyaXZlIn0"

Then paste the result.
```

**DỪNG LẠI Ở ĐÂY. ĐỪNG TẮT TERMINAL VPS.**

#### Chuyển sang máy local Windows

Copy lệnh `rclone authorize "drive" "..."` mà VPS in ra. Trong Command Prompt máy local (đã `cd` vào thư mục rclone), chạy:

```cmd
rclone.exe authorize "drive" "eyJzY29wZSI6ImRyaXZlIn0"
```

(thay chuỗi `eyJ...` bằng chuỗi thật)

Sau khi chạy:

1. Browser tự mở → trang đăng nhập Google
2. Đăng nhập tài khoản Google muốn dùng để lưu backup
3. Trang hiện `rclone wants to access your Google Account`
   - Nếu có cảnh báo `Google hasn't verified this app` → bấm **Advanced** → **Go to rclone (unsafe)**
4. Tick **See, edit, create, and delete all of your Google Drive files** → **Continue**
5. Browser hiện `Success!` → đóng tab
6. Command Prompt sẽ in ra chuỗi JSON dài:
   ```
   Paste the following into your remote machine --->
   eyJ0b2tlbiI6IntcImFjY2Vzc190b2tlblwiO...
   <---End paste
   ```
7. Copy **toàn bộ chuỗi** giữa `--->` và `<---End paste`

#### Quay lại VPS

Paste chuỗi vào prompt `config_token>`, nhấn Enter. Tiếp tục:

| Prompt | Trả lời |
|---|---|
| `Configure this as a Shared Drive?` | `n` |
| `Keep this "gdrive" remote?` | `y` |
| `e/n/d/r/c/s/q>` | `q` |

Verify:

```bash
rclone lsd gdrive:
```

Phải in ra danh sách folder trên Drive của bạn.

> **Mẹo cho lần migrate VPS sau**: Thay vì OAuth lại từ đầu, có thể copy file `~/.config/rclone/rclone.conf` từ VPS cũ sang VPS mới. Token vẫn dùng được vì không phụ thuộc machine. Tiết kiệm 5-10 phút.

---

## 7. Chạy `setup.sh` để hoàn tất

Sau khi hoàn thành 6 bước thủ công:

```bash
./backup/scripts/setup.sh
```

Script sẽ:
1. ✓ Verify `.env` tồn tại
2. ✓ Verify 4 docker containers đang chạy (mysql-nro, mongo, postgres, redis)
3. ✓ Verify rclone đã cài (tự cài nếu chưa)
4. ✓ Verify remote `gdrive` đã config
5. ✓ Test kết nối Drive
6. ✓ Cấp quyền execute cho scripts
7. ✓ Đăng ký cron job với schedule trong `.env`

Output mong đợi:

```
========================================
  Setup hoàn tất!
========================================

Các bước tiếp theo:
1. Chạy thử backup tay 1 lần để verify:
   /root/.../backup/scripts/backup.sh
2. Xem cron đã đăng ký:
   crontab -l
3. Theo dõi log:
   tail -f /root/.../backup/backup.log
4. Khi cần restore:
   /root/.../backup/scripts/restore.sh <mysql|mongo|pg|redis> <file>
```

Nếu thiếu bước nào trong 6 bước trên, `setup.sh` sẽ dừng và in lỗi rõ ràng → bạn biết phải quay lại làm gì.

---

## 8. Test thử backup và restore

### 8.1. Chạy backup tay

```bash
./backup/scripts/backup.sh
```

Bạn sẽ thấy log từng bước:

```
[2026-05-20 12:00:00] === Bắt đầu backup ===
[2026-05-20 12:00:00] [MySQL] Đang dump...
[2026-05-20 12:00:00] [MySQL] Done. Size: 904K
[2026-05-20 12:00:00] [MongoDB] Đang dump...
...
[2026-05-20 12:00:00] === Hoàn tất ===
```

### 8.2. Verify file đã tạo

```bash
# Local
ls -lh backup/data/

# Google Drive
rclone ls gdrive:db-backups
```

Cả 2 phải có 4 file mới với cùng timestamp:
- `mysql_YYYY-MM-DD_HHMM.sql.gz`
- `mongo_YYYY-MM-DD_HHMM.archive.gz`
- `pg_YYYY-MM-DD_HHMM.sql.gz`
- `redis_YYYY-MM-DD_HHMM.rdb.gz`

### 8.3. Test restore (quan trọng!)

> **Quy tắc vàng**: Backup chưa được test restore = không có backup. Phải test ít nhất 1 lần.

Test trên Postgres (DB ít data, dễ verify):

```bash
# Tạo data test
docker exec -it postgres psql -U admin -d admin_db -c "
CREATE TABLE IF NOT EXISTS test_restore (id int, note text);
INSERT INTO test_restore VALUES (1, 'truoc khi backup');
"

# Backup
./backup/scripts/backup.sh

# Giả lập 'lỡ tay xoá'
docker exec -it postgres psql -U admin -d admin_db -c "DROP TABLE test_restore;"

# Tìm file backup mới nhất
ls -t backup/data/pg_*.sql.gz | head -1

# Restore (đổi tên file thật)
./backup/scripts/restore.sh pg pg_YYYY-MM-DD_HHMM.sql.gz

# Verify data quay lại
docker exec -it postgres psql -U admin -d admin_db -c "SELECT * FROM test_restore;"

# Dọn
docker exec -it postgres psql -U admin -d admin_db -c "DROP TABLE test_restore;"
```

Phải thấy `1 | truoc khi backup` xuất hiện lại → restore OK.

### 8.4. Verify cron đã đăng ký

```bash
crontab -l
```

Phải thấy dòng tương tự (path là path thật của repo):

```cron
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
# Backup DB (added by setup.sh)
0 4 * * * /root/MICROSERVICE_NGINX_SERVICE/backup/scripts/backup.sh >> /root/MICROSERVICE_NGINX_SERVICE/backup/backup.log 2>&1
```

### 8.5. Test cron hoạt động được trong môi trường tối thiểu

Cron chạy script với môi trường rất ít biến môi trường. Có thể script chạy được khi bạn SSH nhưng fail trong cron. Test:

```bash
env -i PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin HOME=/root ./backup/scripts/backup.sh
```

`env -i` xoá hết biến môi trường, chỉ giữ PATH + HOME. Nếu script chạy OK → cron chắc chắn chạy được.

---

## 9. Cách restore thực tế khi có sự cố

### Scenario 1: Lỡ tay xoá table, cần restore ngay

File backup vẫn còn local:

```bash
# Liệt kê backup
ls -lh backup/data/

# Restore
./backup/scripts/restore.sh mysql mysql_2026-05-20_0400.sql.gz
```

Gõ `yes` xác nhận.

### Scenario 2: File local đã bị xoá theo retention, còn trên Drive

```bash
# List backup trên Drive
rclone ls gdrive:db-backups

# Tải về local
rclone copy gdrive:db-backups/mysql_2026-05-15_0400.sql.gz backup/data/

# Restore
./backup/scripts/restore.sh mysql mysql_2026-05-15_0400.sql.gz
```

### Scenario 3: VPS cháy hoàn toàn, dựng VPS mới

```bash
# 1. Cài Docker, clone repo, tạo .env, bật stack (làm như Mục 6)
git clone <repo>
cd <repo>
cp .env.example .env
nano .env
docker compose up -d

# 2. Setup rclone — copy rclone.conf từ backup khác (nếu có)
mkdir -p ~/.config/rclone
nano ~/.config/rclone/rclone.conf
# Paste nội dung rclone.conf cũ vào, lưu

# Hoặc làm OAuth lại từ đầu (Mục 6.6)

# 3. Verify
rclone ls gdrive:db-backups

# 4. Tải backup mới nhất
rclone copy gdrive:db-backups/ backup/data/ --include "*$(date +%F)*"

# 5. Chạy setup.sh để đăng ký cron mới
./backup/scripts/setup.sh

# 6. Restore từng DB
./backup/scripts/restore.sh mysql mysql_xxx.sql.gz
./backup/scripts/restore.sh mongo mongo_xxx.archive.gz
./backup/scripts/restore.sh pg pg_xxx.sql.gz
./backup/scripts/restore.sh redis redis_xxx.rdb.gz
```

---

## 10. Workflow git khi sửa script

### Sửa từ máy local, deploy lên VPS

```bash
# Trên máy local
git pull                                # cập nhật code mới nhất
nano backup/scripts/backup.sh           # sửa gì đó
git add backup/scripts/backup.sh
git commit -m "fix: thêm --triggers cho mysqldump"
git push

# Trên VPS
cd /root/MICROSERVICE_NGINX_SERVICE
git pull
# Script tự cập nhật, cron lần sau sẽ dùng version mới
```

Không cần restart cron, không cần redeploy gì.

### Giữ quyền execute khi commit script

Vấn đề: mặc định git lưu file `.sh` với quyền `644` (không có execute). Khi clone về, ai cũng phải `chmod +x` lại.

Cách fix — đánh dấu execute trong git:

```bash
git update-index --chmod=+x backup/scripts/*.sh
git commit -m "chmod: make backup scripts executable"
git push
```

Verify:

```bash
git ls-files --stage backup/scripts/
```

Phải có `100755` ở đầu (không phải `100644`):

```
100755 abc... 0    backup/scripts/backup.sh
100755 def... 0    backup/scripts/restore.sh
100755 ghi... 0    backup/scripts/setup.sh
```

Từ lần này, ai clone về sẽ tự có quyền execute.

---

## 11. Bảo mật và lưu ý quan trọng

### 11.1. Không commit secrets vào git

**TUYỆT ĐỐI KHÔNG** commit:
- File `.env` (password DB)
- File `~/.config/rclone/rclone.conf` (OAuth token Drive)
- API keys, webhook URLs

`.gitignore` phải có:

```gitignore
.env
backup/data/
backup/*.log
rclone.conf
.rclone.conf
```

### 11.2. Token rclone là credential nhạy cảm

File `~/.config/rclone/rclone.conf` chứa **refresh token** Google Drive — bất kỳ ai có file này đều truy cập được Drive của bạn.

```bash
chmod 600 ~/.config/rclone/rclone.conf
```

### 11.3. Nếu lỡ leak token

Nếu token đã bị lộ (paste lên đâu đó, push lên git...):

1. Vào https://myaccount.google.com/permissions
2. Tìm `rclone` → bấm **Remove Access**
3. Trên VPS: `rclone config` → `e` (edit) → `gdrive` → đi qua các bước lại để lấy token mới

### 11.4. Quyền `.env`

Bắt buộc `chmod 600 .env` sau khi tạo. Mặc định Linux cho group/other đọc được file → user khác trên cùng VPS có thể đọc password.

### 11.5. Test restore định kỳ

Mỗi 1-3 tháng test restore 1 lần (trên DB phụ hoặc test environment) để chắc backup vẫn ngon. Backup có thể "hỏng âm thầm" — script chạy thành công nhưng file không restore được.

### 11.6. Monitor backup thất bại

Hiện tại nếu cron fail, bạn không biết. Thêm monitor — cách đơn giản nhất là **healthchecks.io** (free):

1. Đăng ký https://healthchecks.io
2. Tạo check, lấy URL ping
3. Thêm vào script `backup.sh`:

```bash
# Đầu script (sau set -euo pipefail)
trap 'curl -fsS -m 10 --retry 3 https://hc-ping.com/YOUR-UUID/fail' ERR

# Cuối script (sau Hoàn tất)
curl -fsS -m 10 --retry 3 https://hc-ping.com/YOUR-UUID
```

Nếu script không ping trong khoảng schedule, healthchecks gửi email báo.

---

## 12. Troubleshooting

### 12.1. Cron không chạy

**Triệu chứng**: Tới giờ schedule mà `backup.log` không update.

**Cách debug**:

```bash
# Check cron service
systemctl status cron

# Xem log cron của hệ thống
journalctl -u cron --since "10 min ago"

# Test job đơn giản
echo '* * * * * echo "alive at $(date)" >> /tmp/cron_test.log 2>&1' | crontab -
sleep 90
cat /tmp/cron_test.log
```

Nguyên nhân thường gặp:

- **Thiếu PATH** → kiểm tra `crontab -l` có dòng `PATH=...` không
- **Script không executable** → `chmod +x backup/scripts/*.sh`
- **Đường dẫn sai** → trong crontab phải dùng đường dẫn tuyệt đối

### 12.2. mysqldump báo `Access denied`

Password sai hoặc cần escape:

```bash
# Test connect MySQL từ host
docker exec -it mysql-nro mysql -uroot -p"<password>"
```

Nếu vẫn fail, check `.env` xem password có đúng không, có bọc nháy đơn nếu có ký tự đặc biệt không.

### 12.3. rclone báo `token expired` / `Unauthorized`

Token bị revoke hoặc account bị issue. Reconnect:

```bash
rclone config reconnect gdrive:
```

### 12.4. Disk full

Kiểm tra:

```bash
du -sh backup/data/
df -h
```

Retention không hoạt động đúng nếu `find` không xoá được file:

```bash
find backup/data/ -type f -mtime +7
```

Nếu có file >7 ngày in ra mà không bị xoá → check `backup.log` xem có lỗi không.

### 12.5. Restore Postgres báo `database "admin" does not exist`

`psql` mặc định cố connect database tên trùng user. Script đã fix bằng cách thêm `-d postgres`:

```bash
gunzip < "$FILE" | docker exec -i postgres sh -c "exec psql -U $PG_USER -d postgres"
```

### 12.6. Restore Postgres có nhiều `ERROR already exists`

Khi `docker compose down -v` rồi `up -d`, container postgres có thể init data từ đầu (nếu có init script). Sau đó restore `pg_dumpall` sẽ conflict.

Data vẫn restore được (qua `COPY` statements) nhưng schema có thể inconsistent. Cách fix triệt để: trước khi restore, drop database:

```bash
docker exec postgres psql -U admin -d postgres -c "
DROP DATABASE IF EXISTS admin_db;
"
# Rồi restore
./backup/scripts/restore.sh pg pg_xxx.sql.gz
```

### 12.7. mongorestore báo index error

```
Failed: ... createIndex error: (Unauthorized) Command createIndexes requires authentication
```

Data restore OK nhưng không tạo được index. Tạo thủ công:

```bash
docker exec -it mongo mongosh -u admin -p <password> --authenticationDatabase admin --eval '
db.getSiblingDB("backend").logs.createIndex({timestamp: -1}, {background: true, name: "timestamp_1"})
'
```

### 12.8. setup.sh báo container không chạy

```
✗ mysql-nro KHÔNG chạy
```

Lý do: `docker compose up -d` chưa chạy, hoặc container crash. Check:

```bash
docker ps -a
docker compose logs mysql-nro
docker compose up -d
```

---

## 13. Glossary các lệnh Linux

| Lệnh | Ý nghĩa | Ví dụ |
|---|---|---|
| `mkdir -p` | Tạo thư mục (cả parent nếu cần) | `mkdir -p ~/a/b/c` |
| `cd` | Chuyển thư mục | `cd ~/repo` |
| `ls -lh` | List file, long format, human-readable size | `ls -lh backup/data/` |
| `cat` | In nội dung file | `cat backup.log` |
| `head -N` | In N dòng đầu | `head -5 file.txt` |
| `tail -N` | In N dòng cuối | `tail -20 backup.log` |
| `tail -f / -F` | Theo dõi file real-time | `tail -F backup.log` |
| `rm` | Xoá file (không có thùng rác!) | `rm /tmp/test.txt` |
| `rm -rf` | Xoá thư mục đệ quy, không hỏi | `rm -rf /tmp/old/` |
| `cp` | Copy file | `cp a.txt b.txt` |
| `mv` | Move/rename | `mv old.txt new.txt` |
| `nano FILE` | Mở file trong editor nano | `nano script.sh` |
| `chmod +x` | Thêm quyền execute | `chmod +x script.sh` |
| `chmod 600` | Set quyền rw cho owner thôi | `chmod 600 .env` |
| `chmod 755` | rwx cho owner, r-x cho group/other | `chmod 755 script.sh` |
| `chown` | Đổi owner file | `chown user:group file` |
| `du -sh` | Disk usage of folder | `du -sh backup/data/` |
| `df -h` | Disk free trên các partition | `df -h` |
| `find PATH -type f -mtime +N -delete` | Tìm file > N ngày và xoá | `find . -type f -mtime +30 -delete` |
| `grep` | Tìm chuỗi trong file/output | `grep ERROR backup.log` |
| `>` | Redirect stdout, ghi đè | `echo "x" > file` |
| `>>` | Redirect stdout, append | `echo "x" >> file` |
| `2>&1` | Redirect stderr vào stdout | `cmd >> log 2>&1` |
| `\|` (pipe) | Output lệnh trái → input lệnh phải | `cat f \| grep abc` |
| `$VAR` | Reference biến shell | `echo $HOME` |
| `$(...)` | Command substitution | `DATE=$(date)` |
| `set -e` | Dừng script khi có lệnh fail | (đầu bash script) |
| `set -u` | Báo lỗi khi dùng biến chưa định nghĩa | (đầu bash script) |
| `set -o pipefail` | Pipe fail nếu lệnh nào trong pipe fail | (đầu bash script) |
| `source file` | Load file vào shell hiện tại | `source .env` |
| `crontab -e` | Edit cron jobs | |
| `crontab -l` | List cron jobs | |
| `systemctl status SVC` | Trạng thái service | `systemctl status cron` |
| `journalctl -u SVC` | Log service | `journalctl -u cron --since "1 hour ago"` |
| `env -i` | Chạy lệnh với env tối thiểu | `env -i PATH=... script.sh` |
| `docker ps` | List container đang chạy | |
| `docker exec CONT CMD` | Chạy lệnh trong container | `docker exec mysql-nro ls /` |
| `docker cp` | Copy file giữa container và host | `docker cp redis:/data/x .` |
| `docker compose up -d` | Bật stack | (chạy ở thư mục có docker-compose.yml) |
| `docker compose down -v` | Tắt stack + xoá volume | |
| `git clone URL` | Clone repo | |
| `git pull` | Lấy thay đổi mới nhất | |
| `git status` | Xem file đã thay đổi | |
| `git add file` | Stage file | |
| `git commit -m "msg"` | Commit | |
| `git push` | Push lên remote | |
| `git update-index --chmod=+x` | Đánh dấu file executable trong git | |
| `curl URL` | HTTP GET (download/ping) | `curl https://example.com` |
| `gzip / gunzip` | Nén / giải nén | `gzip file.sql` |
| `zcat / zgrep / zless` | Đọc file gzip không cần giải nén | `zgrep CREATE backup.sql.gz` |

---

## 14. Hướng phát triển tiếp theo

### 14.1. Viết `bootstrap.sh` — setup all-in-one

Hiện tại setup VPS mới cần làm 6 bước thủ công (Mục 6) rồi mới chạy `setup.sh`. Khi hệ thống ổn định và muốn dễ hơn cho dev mới, có thể viết `bootstrap.sh` là wrapper "all-in-one":

**Khái niệm**: `bootstrap.sh` chạy 1 lệnh duy nhất, tự động làm tối đa, hỏi user khi cần:

```bash
git clone <repo>
cd <repo>
./bootstrap.sh
```

Script này có thể tự động:
- Cài Docker (nếu chưa)
- Cài rclone (nếu chưa)
- Mở `nano .env` để dev điền password
- Chạy `docker compose up -d` + đợi DB ready
- Hỏi dev có muốn config rclone không (vẫn cần thủ công OAuth)
- Cấu hình UFW firewall (mở port 80/443/SSH, đóng các port khác)
- Cấu hình htpasswd cho nginx
- Setup SSL với certbot
- Gọi `setup.sh` cuối cùng để đăng ký cron

**Lợi**:
- Dev mới onboard nhanh hơn (1 lệnh thay vì nhiều)
- Giảm sai sót

**Hại**:
- Code phức tạp, khó maintain
- Khó debug khi có lỗi
- Magic — dev không hiểu hệ thống đang làm gì

**Khi nào nên làm**:
- ❌ Khi chỉ 1 dev (mình), stack đã setup OK → không cần
- ✅ Khi có nhiều dev mới onboard liên tục
- ✅ Khi cần dựng/xoá VPS thường xuyên (testing, demo)
- ✅ Khi stack có nhiều thứ cần config ngoài backup (UFW, nginx, SSL, htpasswd...)

**Khuyến nghị hiện tại**: Chưa cần. Khi nào hệ thống mở rộng (thêm dev, thêm môi trường staging/production) thì làm.

### 14.2. Mã hoá backup trước khi upload

Backup chứa password và data nhạy cảm. Mã hoá để Google không đọc được nội dung:

```bash
rclone config
# new remote: gdrive-crypt
# type: crypt
# remote: gdrive:db-backups-encrypted
# password: ĐẶT-MẬT-KHẨU-MẠNH-VÀ-LƯU-LẠI
```

Đổi trong `.env`: `RCLONE_REMOTE=gdrive-crypt:`.

⚠️ **Mất mật khẩu = mất backup vĩnh viễn**. Lưu mật khẩu vào password manager.

### 14.3. Backup chéo VPS

Thêm step rsync sang VPS khác để restore cực nhanh khi cần:

```bash
rsync -avz -e "ssh -i ~/.ssh/backup_key" \
  "$BACKUP_DIR/" "user@vps2:~/db-backups/"
```

### 14.4. Multiple cloud (Drive + R2)

Backup lên cả Google Drive **và** Cloudflare R2 → an toàn hơn:

```bash
rclone copy "$BACKUP_DIR" gdrive:db-backups/ --include "*_$DATE.*"
rclone copy "$BACKUP_DIR" r2:db-backups/ --include "*_$DATE.*"
```

### 14.5. Hourly backup cho DB quan trọng

Chia làm 2 cron — backup đầy đủ 4h sáng, MySQL mỗi 6 tiếng:

```cron
0 4 * * * /root/repo/backup/scripts/backup.sh
0 */6 * * * /root/repo/backup/scripts/backup-mysql-only.sh
```

### 14.6. Backup volume Docker (data thực)

Hiện tại chỉ logical dump. Có thể backup thêm volume Docker:

```bash
docker run --rm \
  -v mysql_data:/source:ro \
  -v $(pwd):/backup \
  alpine tar -czf /backup/mysql_volume_$DATE.tar.gz -C /source .
```

### 14.7. Backup config + code

Backup không chỉ DB:

```bash
tar -czf "$BACKUP_DIR/config_$DATE.tar.gz" \
  /root/repo/docker-compose.yml \
  /root/repo/nginx.conf \
  /root/repo/configAdmin.sql
```

### 14.8. Point-in-Time Recovery (PITR)

Backup chỉ recover được tới snapshot cuối. Để recover bất kỳ thời điểm nào, dùng:
- **MySQL binlog**
- **Postgres WAL archiving**

Phức tạp hơn nhiều, chỉ cần khi DB production lớn.

---

## 15. Phụ lục: Toàn bộ nội dung file

### 15.1. `.env.example`

```bash
# DATABASE CREDENTIALS
MYSQL_PASS=changeme_mysql_password
MONGO_USER=admin
MONGO_PASS=changeme_mongo_password
PG_USER=admin

# BACKUP CONFIG
RCLONE_REMOTE=gdrive:db-backups
LOCAL_RETENTION_DAYS=7
DRIVE_RETENTION_DAYS=30

# CRON SCHEDULE
CRON_HOUR=4
CRON_MINUTE=0

# CONTAINER NAMES (phải khớp docker-compose.yml)
MYSQL_CONTAINER=mysql-nro
MONGO_CONTAINER=mongo
POSTGRES_CONTAINER=postgres
REDIS_CONTAINER=redis
```

### 15.2. `.gitignore` (bổ sung vào file hiện có)

```gitignore
# Secrets
.env

# Backup
backup/data/
backup/*.log

# rclone config
rclone.conf
.rclone.conf
```

### 15.3. `backup/scripts/backup.sh`

```bash
#!/bin/bash
# Backup script: dump 4 DB → local → upload Google Drive
# Chạy hàng ngày qua cron

set -euo pipefail

# ============ ĐỊNH VỊ ============
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BACKUP_DIR="$REPO_ROOT/backup/data"

# ============ LOAD CONFIG ============
if [ ! -f "$REPO_ROOT/.env" ]; then
  echo "ERROR: Không tìm thấy file $REPO_ROOT/.env"
  exit 1
fi

set -a
source "$REPO_ROOT/.env"
set +a

DATE=$(date +%F_%H%M)
LOG_PREFIX="[$(date '+%F %T')]"

mkdir -p "$BACKUP_DIR"
echo "$LOG_PREFIX === Bắt đầu backup ==="

# ============ MYSQL ============
echo "$LOG_PREFIX [MySQL] Đang dump..."
docker exec "$MYSQL_CONTAINER" sh -c "exec mysqldump -uroot -p\"$MYSQL_PASS\" --all-databases --single-transaction --routines --triggers" \
  | gzip > "$BACKUP_DIR/mysql_$DATE.sql.gz"
echo "$LOG_PREFIX [MySQL] Done. Size: $(du -h "$BACKUP_DIR/mysql_$DATE.sql.gz" | cut -f1)"

# ============ MONGODB ============
echo "$LOG_PREFIX [MongoDB] Đang dump..."
docker exec "$MONGO_CONTAINER" sh -c "exec mongodump -u $MONGO_USER -p $MONGO_PASS --authenticationDatabase admin --archive --gzip" \
  > "$BACKUP_DIR/mongo_$DATE.archive.gz"
echo "$LOG_PREFIX [MongoDB] Done. Size: $(du -h "$BACKUP_DIR/mongo_$DATE.archive.gz" | cut -f1)"

# ============ POSTGRESQL ============
echo "$LOG_PREFIX [Postgres] Đang dump..."
docker exec "$POSTGRES_CONTAINER" sh -c "exec pg_dumpall -U $PG_USER" \
  | gzip > "$BACKUP_DIR/pg_$DATE.sql.gz"
echo "$LOG_PREFIX [Postgres] Done. Size: $(du -h "$BACKUP_DIR/pg_$DATE.sql.gz" | cut -f1)"

# ============ REDIS ============
echo "$LOG_PREFIX [Redis] Đang BGSAVE..."
LAST_SAVE_BEFORE=$(docker exec "$REDIS_CONTAINER" redis-cli LASTSAVE)
docker exec "$REDIS_CONTAINER" redis-cli BGSAVE > /dev/null
for i in {1..30}; do
  sleep 1
  LAST_SAVE_NOW=$(docker exec "$REDIS_CONTAINER" redis-cli LASTSAVE)
  if [ "$LAST_SAVE_NOW" != "$LAST_SAVE_BEFORE" ]; then
    break
  fi
done
docker cp "$REDIS_CONTAINER":/data/dump.rdb "$BACKUP_DIR/redis_$DATE.rdb"
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

### 15.4. `backup/scripts/restore.sh`

```bash
#!/bin/bash
# Restore script
# Usage: ./restore.sh <mysql|mongo|pg|redis> <backup_file>

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BACKUP_DIR="$REPO_ROOT/backup/data"

if [ ! -f "$REPO_ROOT/.env" ]; then
  echo "ERROR: Không tìm thấy file $REPO_ROOT/.env"
  exit 1
fi

set -a
source "$REPO_ROOT/.env"
set +a

DB="${1:-}"
FILE="${2:-}"

if [ -z "$DB" ] || [ -z "$FILE" ]; then
  echo "Usage: $0 <mysql|mongo|pg|redis> <backup_file>"
  echo ""
  echo "Backup có sẵn local trong $BACKUP_DIR:"
  ls -1 "$BACKUP_DIR" 2>/dev/null || echo "  (trống)"
  echo ""
  echo "Để tải từ Google Drive về local trước:"
  echo "  rclone copy $RCLONE_REMOTE/<tên_file> $BACKUP_DIR/"
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
    gunzip < "$FILE" | docker exec -i "$MYSQL_CONTAINER" sh -c "exec mysql -uroot -p\"$MYSQL_PASS\""
    ;;
  mongo)
    docker exec -i "$MONGO_CONTAINER" sh -c "exec mongorestore -u $MONGO_USER -p $MONGO_PASS --authenticationDatabase admin --archive --gzip --drop" < "$FILE"
    ;;
  pg)
    gunzip < "$FILE" | docker exec -i "$POSTGRES_CONTAINER" sh -c "exec psql -U $PG_USER -d postgres"
    ;;
  redis)
    TMP=$(mktemp)
    gunzip < "$FILE" > "$TMP"
    docker stop "$REDIS_CONTAINER"
    docker cp "$TMP" "$REDIS_CONTAINER":/data/dump.rdb
    docker start "$REDIS_CONTAINER"
    rm "$TMP"
    ;;
  *)
    echo "DB không hợp lệ: $DB (phải là mysql|mongo|pg|redis)"
    exit 1
    ;;
esac

echo "✓ Restore xong."
```

### 15.5. `backup/scripts/setup.sh`

```bash
#!/bin/bash
# Setup script: cài rclone, đăng ký cron job
# Chạy 1 lần khi setup VPS mới

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "========================================"
echo "  Setup backup system"
echo "========================================"
echo ""

if [ ! -f "$REPO_ROOT/.env" ]; then
  echo "ERROR: Chưa có file $REPO_ROOT/.env"
  echo ""
  echo "Hãy chạy:"
  echo "  cp $REPO_ROOT/.env.example $REPO_ROOT/.env"
  echo "  nano $REPO_ROOT/.env"
  echo ""
  echo "Rồi chạy lại setup.sh"
  exit 1
fi

set -a
source "$REPO_ROOT/.env"
set +a

echo "✓ Tìm thấy .env"

if ! command -v docker &> /dev/null; then
  echo "ERROR: Docker chưa được cài. Cài Docker trước."
  exit 1
fi

echo ""
echo "Kiểm tra containers..."
for container in "$MYSQL_CONTAINER" "$MONGO_CONTAINER" "$POSTGRES_CONTAINER" "$REDIS_CONTAINER"; do
  if docker ps --format '{{.Names}}' | grep -q "^${container}$"; then
    echo "  ✓ $container đang chạy"
  else
    echo "  ✗ $container KHÔNG chạy"
    echo "Hãy chạy 'docker compose up -d' trước."
    exit 1
  fi
done

echo ""
if command -v rclone &> /dev/null; then
  echo "✓ rclone đã cài: $(rclone version | head -1)"
else
  echo "Cài rclone..."
  curl https://rclone.org/install.sh | sudo bash
fi

echo ""
REMOTE_NAME="${RCLONE_REMOTE%%:*}"
if rclone listremotes | grep -q "^${REMOTE_NAME}:$"; then
  echo "✓ Remote rclone '$REMOTE_NAME' đã có"
else
  echo "✗ Chưa cấu hình remote '$REMOTE_NAME'"
  echo "Hãy chạy 'rclone config' để setup. Xem hướng dẫn trong BACKUP_RESTORE_GUIDE.md mục 6.6"
  exit 1
fi

echo ""
echo "Test kết nối Google Drive..."
if rclone lsd "$RCLONE_REMOTE" &>/dev/null; then
  echo "✓ Kết nối Drive OK"
else
  echo "Tạo folder $RCLONE_REMOTE..."
  rclone mkdir "$RCLONE_REMOTE"
fi

chmod +x "$SCRIPT_DIR/backup.sh" "$SCRIPT_DIR/restore.sh"
echo "✓ Đã cấp quyền execute cho scripts"

echo ""
CRON_LINE="${CRON_MINUTE:-0} ${CRON_HOUR:-4} * * * $SCRIPT_DIR/backup.sh >> $REPO_ROOT/backup/backup.log 2>&1"
CRON_PATH="PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

EXISTING_CRON=$(crontab -l 2>/dev/null || echo "")

if echo "$EXISTING_CRON" | grep -F "$SCRIPT_DIR/backup.sh" > /dev/null; then
  echo "✓ Cron job đã tồn tại, bỏ qua"
else
  if ! echo "$EXISTING_CRON" | grep -q "^PATH="; then
    NEW_CRON="$CRON_PATH
$EXISTING_CRON
# Backup DB (added by setup.sh)
$CRON_LINE"
  else
    NEW_CRON="$EXISTING_CRON
# Backup DB (added by setup.sh)
$CRON_LINE"
  fi
  echo "$NEW_CRON" | crontab -
  echo "✓ Đã đăng ký cron: chạy lúc ${CRON_HOUR:-4}:$(printf '%02d' ${CRON_MINUTE:-0}) hàng ngày"
fi

echo ""
echo "========================================"
echo "  Setup hoàn tất!"
echo "========================================"
echo ""
echo "Các bước tiếp theo:"
echo ""
echo "1. Chạy thử backup tay 1 lần để verify:"
echo "   $SCRIPT_DIR/backup.sh"
echo ""
echo "2. Xem cron đã đăng ký:"
echo "   crontab -l"
echo ""
echo "3. Theo dõi log:"
echo "   tail -f $REPO_ROOT/backup/backup.log"
echo ""
echo "4. Khi cần restore:"
echo "   $SCRIPT_DIR/restore.sh <mysql|mongo|pg|redis> <file>"
echo ""
```

---

## Tóm tắt

| Thành phần | Vị trí |
|---|---|
| Repo gốc | `/root/MICROSERVICE_NGINX_SERVICE/` |
| Script backup | `<repo>/backup/scripts/backup.sh` |
| Script restore | `<repo>/backup/scripts/restore.sh` |
| Script setup | `<repo>/backup/scripts/setup.sh` |
| Config | `<repo>/.env` (chmod 600, không commit) |
| Log | `<repo>/backup/backup.log` |
| Data local | `<repo>/backup/data/` — giữ 7 ngày |
| Data cloud | `gdrive:db-backups/` — giữ 30 ngày |
| Cron schedule | `0 4 * * *` (4h sáng hằng ngày, cấu hình trong `.env`) |
| rclone config | `~/.config/rclone/rclone.conf` |

### Setup VPS mới — quy trình tóm tắt

```bash
# 6 bước thủ công (~15-20 phút)
curl -fsSL https://get.docker.com | sh                       # 1. Docker
git clone <repo> && cd <repo>                                # 2. Clone
cp .env.example .env && nano .env && chmod 600 .env          # 3. .env
docker compose up -d && sleep 15                             # 4. Stack
curl https://rclone.org/install.sh | sudo bash               # 5. rclone
rclone config                                                # 6. OAuth Drive

# 1 bước tự động (~30 giây)
./backup/scripts/setup.sh
```

Sau đó hệ thống chạy tự động, không cần can thiệp.

**Chúc bạn không bao giờ phải dùng đến backup. Nhưng khi cần, nó luôn ở đó.** 🎯