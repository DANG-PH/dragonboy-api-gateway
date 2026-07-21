# 📚 TÀI LIỆU ÔN PHỎNG VẤN BACKEND - PHẠM HẢI ĐĂNG

> Tài liệu này tổng hợp **tất cả các câu hỏi có thể bị hỏi** trong buổi phỏng vấn Backend Developer, từ các khái niệm cơ bản (API là gì, Node.js là gì) đến các chủ đề nâng cao (Distributed Systems, Microservices). Mỗi câu hỏi đều có **câu trả lời chi tiết** kèm ví dụ.
>
> **Cách dùng:** Đọc lần 1 từ đầu đến cuối để có bức tranh tổng thể. Đọc lần 2 chỉ những phần yếu. Đọc lần 3 trước phỏng vấn 1 ngày, lướt nhanh để refresh.

---

## 📖 MỤC LỤC

1. [Khái niệm cơ bản (API, HTTP, Client-Server)](#phần-1-khái-niệm-cơ-bản)
2. [Node.js Deep Dive](#phần-2-nodejs-deep-dive)
3. [NestJS Deep Dive](#phần-3-nestjs-deep-dive)
4. [Authentication & Security](#phần-4-authentication--security)
5. [Database (SQL, NoSQL, Index, Transaction)](#phần-5-database)
6. [Redis & Caching](#phần-6-redis--caching)
7. [Message Queue (RabbitMQ, Kafka, NATS)](#phần-7-message-queue)
8. [System Design & Distributed Systems](#phần-8-system-design)
9. [Concurrency & Race Condition](#phần-9-concurrency)
10. [DevOps (Docker, Nginx, CI/CD)](#phần-10-devops)
11. [Go Language](#phần-11-go-language)
12. [WebSocket & Real-time](#phần-12-websocket--real-time)
13. [OOP & Design Patterns](#phần-13-oop--design-patterns)
14. [Đào sâu CV (Sacred Dragon, Mobifos, Gamota)](#phần-14-đào-sâu-cv)
15. [Behavioral & Soft Skills](#phần-15-behavioral)
16. [Testing (Unit, Integration, E2E, Mock)](#phần-16-testing)
17. [TypeScript Deep Dive](#phần-17-typescript-deep-dive)
18. [Các chủ đề nâng cao (gRPC, Webhook, Cron, Pagination, Upload, Email, Logging, Health Check, Versioning, Migration, Multi-tenancy, Feature Flag, Tracing)](#phần-18-các-chủ-đề-nâng-cao)
19. [Data Structures & Algorithms (Big-O, Sorting, Binary Search, Tree, Graph, DP, LRU)](#phần-19-data-structures--algorithms)
20. [Linux & Operating Systems (Process, FD, Signal, /proc, OOM, systemd)](#phần-20-linux--operating-systems)
21. [Git Workflow (Branching, Rebase, Conflict, Hooks)](#phần-21-git-workflow)
22. [Networking Deep Dive (OSI, IP, NAT, TCP states, DNS records, CIDR)](#phần-22-networking-deep-dive)
23. [Cloud & AWS Basics (IaaS/PaaS/SaaS, EC2, S3, RDS, IAM, Lambda, VPC)](#phần-23-cloud--aws-basics)
24. [Performance & Profiling (Latency numbers, V8, p50/p95/p99)](#phần-24-performance--profiling)
25. [Xử lý thực tế (Money, Time Zone, i18n)](#phần-25-xử-lý-thực-tế-money-time-i18n)
26. [Anti-Patterns & Mistakes to Avoid](#phần-26-anti-patterns--mistakes-to-avoid)
27. [Cheatsheet & Quick Reference (HTTP, SQL, Linux, Docker, Git, Regex, Port)](#phần-27-cheatsheet--quick-reference)

---

# PHẦN 1: KHÁI NIỆM CƠ BẢN

## 1.1. API là gì?

**Câu hỏi:** Em hãy giải thích API là gì? Cho ví dụ.

**Trả lời:**

API (Application Programming Interface) là **một giao diện cho phép các phần mềm giao tiếp với nhau**. Nó giống như "menu" trong nhà hàng — bạn không cần biết bếp nấu thế nào, chỉ cần gọi món theo menu là có đồ ăn.

**Ví dụ thực tế:**
- Ứng dụng grab gọi API của Google Maps để lấy bản đồ → không cần Grab tự xây dựng bản đồ.
- App của bạn gọi API của PayOS để xử lý thanh toán → không cần tự xây dựng hệ thống ngân hàng.

**Các loại API phổ biến:**
1. **REST API** — dựa trên HTTP, phổ biến nhất hiện nay.
2. **GraphQL** — client tự quyết định lấy field nào.
3. **gRPC** — dùng Protobuf, hiệu năng cao, thường dùng giữa các microservices.
4. **WebSocket API** — hai chiều, real-time.
5. **SOAP** — cũ, dùng XML, ít gặp ở dự án mới.

**Anatomy của một REST API call:**
```
GET https://api.example.com/users/123
Headers: Authorization: Bearer <token>

Response:
{
  "id": 123,
  "name": "Đăng",
  "email": "dang@example.com"
}
```

---

## 1.2. REST là gì? Các nguyên tắc REST?

**Câu hỏi:** REST là gì? RESTful API cần tuân theo các nguyên tắc gì?

**Trả lời:**

REST (REpresentational State Transfer) là **một kiến trúc thiết kế API** do Roy Fielding đề xuất năm 2000. Một API gọi là **RESTful** khi tuân theo 6 nguyên tắc:

### 1. Client-Server
Tách biệt rõ giữa client (frontend) và server (backend). Hai bên có thể phát triển độc lập miễn là interface (API) không đổi.

### 2. Stateless
Server **không lưu state của client** giữa các request. Mỗi request phải chứa đủ thông tin để server xử lý (thường là JWT token trong header).

**Vì sao stateless quan trọng?**
- Dễ scale ngang (horizontal scaling) — request nào cũng có thể đi đến server nào.
- Đơn giản hóa server.

### 3. Cacheable
Response phải được đánh dấu rõ có cache được không (qua header `Cache-Control`, `ETag`).

### 4. Uniform Interface
- Resource được định danh bằng URI: `/users/123`
- Dùng HTTP method để mô tả hành động: GET (đọc), POST (tạo), PUT (cập nhật), DELETE (xóa).
- Response có format chuẩn (thường là JSON).

### 5. Layered System
Client không cần biết đang gọi trực tiếp server hay qua proxy/load balancer.

### 6. Code on Demand (optional)
Server có thể gửi code để client thực thi (như JavaScript). Nguyên tắc này hiếm khi áp dụng.

**Resource Naming Best Practices:**
- Dùng danh từ số nhiều: `/users` thay vì `/user` hay `/getUsers`
- Dùng dấu gạch ngang (kebab-case): `/order-items`
- Lồng tài nguyên: `/users/123/orders`
- Tránh động từ trong URL — dùng HTTP method để biểu thị hành động.

**Ví dụ chuẩn REST:**
| Method | URL | Mô tả |
|--------|-----|-------|
| GET | /users | Lấy danh sách user |
| GET | /users/123 | Lấy user id=123 |
| POST | /users | Tạo user mới |
| PUT | /users/123 | Cập nhật toàn bộ user 123 |
| PATCH | /users/123 | Cập nhật một phần user 123 |
| DELETE | /users/123 | Xóa user 123 |

---

## 1.3. HTTP là gì? Các method, status code?

**Câu hỏi:** HTTP là gì? Em biết những HTTP method nào? Status code 4xx và 5xx khác nhau ở chỗ nào?

**Trả lời:**

HTTP (HyperText Transfer Protocol) là **giao thức truyền tải dữ liệu trên Web**. Nó là giao thức request-response: client gửi request, server gửi response.

### HTTP Methods (Verbs):

| Method | Idempotent | Safe | Body | Mục đích |
|--------|-----------|------|------|----------|
| GET | ✅ | ✅ | ❌ | Đọc dữ liệu |
| POST | ❌ | ❌ | ✅ | Tạo mới |
| PUT | ✅ | ❌ | ✅ | Cập nhật toàn bộ (replace) |
| PATCH | ❌ | ❌ | ✅ | Cập nhật một phần |
| DELETE | ✅ | ❌ | ❌ | Xóa |
| HEAD | ✅ | ✅ | ❌ | Như GET nhưng không trả body |
| OPTIONS | ✅ | ✅ | ❌ | Kiểm tra method được phép (CORS preflight) |

**Giải thích:**
- **Idempotent:** Gọi 1 lần hay nhiều lần kết quả giống nhau (vd: DELETE /users/123 — xóa 5 lần kết quả vẫn là user 123 không tồn tại).
- **Safe:** Không thay đổi state của server.

⚠️ **Lưu ý:** POST **không idempotent** vì gọi 2 lần sẽ tạo 2 record.

### HTTP Status Code:

**1xx — Informational** (hiếm gặp)
- 100 Continue
- 101 Switching Protocols (WebSocket upgrade)

**2xx — Success**
- 200 OK — thành công
- 201 Created — tạo mới thành công
- 204 No Content — thành công nhưng không có body (vd: DELETE)

**3xx — Redirection**
- 301 Moved Permanently — chuyển vĩnh viễn
- 302 Found — chuyển tạm thời
- 304 Not Modified — dùng cho cache

**4xx — Client Error** (lỗi do client)
- 400 Bad Request — request sai format
- 401 Unauthorized — chưa xác thực (chưa login)
- 403 Forbidden — đã xác thực nhưng không có quyền
- 404 Not Found — tài nguyên không tồn tại
- 405 Method Not Allowed — method không được hỗ trợ
- 409 Conflict — xung đột state (vd: tạo user trùng email)
- 422 Unprocessable Entity — validation fail
- 429 Too Many Requests — bị rate limit

**5xx — Server Error** (lỗi do server)
- 500 Internal Server Error — lỗi chung
- 502 Bad Gateway — proxy nhận response lỗi từ upstream
- 503 Service Unavailable — server quá tải hoặc đang bảo trì
- 504 Gateway Timeout — proxy chờ upstream quá lâu

**Phân biệt 401 vs 403:**
- 401: "Tao chưa biết mày là ai" → cần login.
- 403: "Tao biết mày là ai rồi, nhưng mày không có quyền" → đã login, nhưng không đủ permission.

**Phân biệt 502 vs 503 vs 504:**
- 502: Nginx gọi NestJS, NestJS trả lỗi format không hiểu được.
- 503: Server tạm thời không phục vụ được (overload, maintenance).
- 504: Nginx gọi NestJS, NestJS không trả lời trong thời gian timeout.

---

## 1.4. HTTP/1.1 vs HTTP/2 vs HTTP/3?

**Câu hỏi:** Em biết các phiên bản HTTP khác nhau ra sao không?

**Trả lời:**

### HTTP/1.1 (1997):
- **Text-based**, dễ debug nhưng nặng.
- **Một connection xử lý một request một lúc** (head-of-line blocking).
- Có thể **keep-alive** (giữ connection để dùng cho nhiều request).
- Có **pipelining** nhưng ít browser hỗ trợ.

### HTTP/2 (2015):
- **Binary protocol** (gọn hơn).
- **Multiplexing**: nhiều request/response trên 1 connection cùng lúc → không còn head-of-line blocking ở tầng HTTP.
- **Header compression** (HPACK).
- **Server Push** (server đẩy resource cho client trước khi được hỏi).

### HTTP/3 (2022):
- Dùng **QUIC** (trên UDP) thay vì TCP.
- **Loại bỏ head-of-line blocking ở tầng TCP** (khi mất 1 packet, không block các stream khác).
- **0-RTT handshake** (resume connection nhanh).
- Tốt hơn cho mạng di động (handover khi đổi WiFi/4G).

**Khi nào dùng HTTP/2 hay HTTP/3?**
- Hầu hết server hiện đại (Nginx, Cloudflare) đã hỗ trợ HTTP/2. Bạn chỉ cần bật SSL/TLS là dùng được.
- HTTP/3 đang phổ biến dần.

---

## 1.5. TCP vs UDP khác nhau ra sao?

**Câu hỏi:** TCP và UDP khác nhau như thế nào? Khi nào dùng cái nào?

**Trả lời:**

| Đặc điểm | TCP | UDP |
|---------|-----|-----|
| Connection | Có (3-way handshake) | Không (connectionless) |
| Reliability | Đảm bảo đến nơi, đúng thứ tự | Không đảm bảo |
| Speed | Chậm hơn | Nhanh hơn |
| Header size | 20 bytes | 8 bytes |
| Flow control | Có | Không |
| Congestion control | Có | Không |
| Use case | HTTP, HTTPS, SSH, MySQL | DNS, VoIP, video streaming, game realtime |

**3-way handshake của TCP:**
```
Client                    Server
  |                          |
  |  ---- SYN ------------>  |
  |                          |
  |  <--- SYN-ACK --------   |
  |                          |
  |  ---- ACK ------------>  |
  |                          |
  | <--- Data exchange --->  |
```

**Khi nào dùng UDP?**
- Game realtime (game của em — game loop dùng UDP/WebSocket).
- Streaming video (mất vài frame không sao, miễn không lag).
- DNS query (đơn giản, nhanh).
- VoIP (Skype, Discord voice).

**Khi nào dùng TCP?**
- HTTP, HTTPS (cần đảm bảo data đúng).
- Database (MySQL, PostgreSQL).
- SSH, FTP.

---

## 1.6. DNS hoạt động thế nào?

**Câu hỏi:** Khi em gõ google.com vào browser, điều gì xảy ra?

**Trả lời:**

Đây là câu hỏi kinh điển. Trả lời từng bước:

### Bước 1: DNS Resolution
Browser cần biết IP của google.com:
1. Check **browser cache** trước.
2. Check **OS cache** (file `hosts`).
3. Hỏi **Local DNS Resolver** (thường là router hoặc của ISP như 8.8.8.8).
4. Resolver hỏi **Root DNS Server** → trả lời "hỏi `.com` TLD".
5. Resolver hỏi **TLD DNS Server (.com)** → trả lời "hỏi authoritative server của google.com".
6. Resolver hỏi **Authoritative DNS Server** → trả về IP `142.250.x.x`.
7. Cache IP và trả về browser.

### Bước 2: TCP 3-way handshake với IP đó (port 443 cho HTTPS).

### Bước 3: TLS handshake (đối với HTTPS).
- Client gửi Hello + danh sách cipher suites.
- Server gửi certificate (chứa public key).
- Client verify certificate (có hợp lệ không, có expire không).
- Trao đổi key để mã hóa session.

### Bước 4: HTTP request
```
GET / HTTP/1.1
Host: google.com
```

### Bước 5: Server xử lý
C� thể qua load balancer → reverse proxy → application server → database → trả response.

### Bước 6: Browser render
1. Parse HTML → DOM tree.
2. Parse CSS → CSSOM.
3. Combine thành Render tree.
4. Layout (tính kích thước, vị trí).
5. Paint (vẽ lên màn hình).

### Bước 7: Run JavaScript, gọi API, tương tác.

---

## 1.7. URL, URI, URN khác nhau?

**Câu hỏi:** URL, URI, URN có khác nhau không?

**Trả lời:**

- **URI** (Uniform Resource Identifier) — định danh tài nguyên (tổng quát nhất).
- **URL** (Uniform Resource Locator) — URI có chứa **địa chỉ** để truy cập.
- **URN** (Uniform Resource Name) — URI chỉ có **tên**, không có địa chỉ.

```
URI ⊃ URL
URI ⊃ URN
```

**Ví dụ:**
- `https://example.com/users/123` — URL (vừa định danh vừa truy cập được).
- `urn:isbn:0451450523` — URN (định danh một cuốn sách, không phải địa chỉ).
- Cả hai đều là URI.

Trong thực tế, hầu hết khi nói URI/URL là cùng nghĩa.

**Cấu trúc URL:**
```
https://user:pass@example.com:8080/path/to/page?key=value#section
\___/   \________/\_________/\__/\____________/\________/\______/
scheme   userinfo   host    port     path       query   fragment
```

---

## 1.8. JSON vs XML?

**Câu hỏi:** JSON là gì? Vì sao thay thế XML?

**Trả lời:**

**JSON** (JavaScript Object Notation) — format trao đổi data, dạng key-value.

```json
{
  "name": "Đăng",
  "age": 20,
  "skills": ["NestJS", "Go", "Redis"]
}
```

**XML:**
```xml
<user>
  <name>Đăng</name>
  <age>20</age>
  <skills>
    <skill>NestJS</skill>
    <skill>Go</skill>
  </skills>
</user>
```

**Vì sao JSON thắng XML?**
- Gọn hơn (ít ký tự thừa).
- Parse nhanh hơn.
- Native trong JavaScript (không cần thư viện).
- Dễ đọc với con người.
- API hiện đại đều dùng JSON.

XML còn được dùng trong: SOAP API cũ, file config Java cổ, RSS feed.

---

## 1.9. Synchronous vs Asynchronous, Blocking vs Non-blocking?

**Câu hỏi:** Em giải thích sync/async, blocking/non-blocking?

**Trả lời:**

Đây là 2 khái niệm khác nhau nhưng dễ nhầm.

### Synchronous vs Asynchronous:
- **Sync:** Người gọi **chờ kết quả** trước khi làm việc tiếp.
- **Async:** Người gọi **không chờ**, sẽ được thông báo khi xong (callback, Promise).

### Blocking vs Non-blocking:
- **Blocking:** Thread bị **chặn lại**, không làm gì khác.
- **Non-blocking:** Thread **không chặn**, có thể làm việc khác.

**4 tổ hợp:**
1. **Sync + Blocking:** Đặt cơm, đứng đợi shipper, không làm gì khác. (`fs.readFileSync` trong Node)
2. **Sync + Non-blocking:** Hỏi shipper "đến chưa", trả lời "chưa", em làm việc khác rồi hỏi tiếp. (polling)
3. **Async + Blocking:** Hiếm gặp.
4. **Async + Non-blocking:** Đặt cơm, shipper gọi khi đến, em làm việc khác. (Node.js default)

**Ví dụ trong Node.js:**
```javascript
// Sync + Blocking
const data = fs.readFileSync('file.txt');
console.log(data); // chờ đến khi đọc xong

// Async + Non-blocking (callback)
fs.readFile('file.txt', (err, data) => {
  console.log(data); // chạy khi đọc xong
});
console.log('Tao chạy trước'); // chạy ngay

// Async + Non-blocking (Promise/async-await)
const data = await fs.promises.readFile('file.txt');
```

---

## 1.10. Frontend vs Backend vs Fullstack?

**Câu hỏi:** Sự khác biệt giữa Frontend, Backend, Fullstack?

**Trả lời:**

- **Frontend:** Phần người dùng nhìn thấy. Công nghệ: HTML, CSS, JavaScript, React, Vue, Angular.
- **Backend:** Phần xử lý logic, dữ liệu, ở server. Công nghệ: Node.js, NestJS, Go, Java, Python.
- **Fullstack:** Làm cả hai.

**Trách nhiệm Backend:**
- Xử lý business logic (mua hàng, gửi tiền,...)
- Lưu/truy xuất database.
- Xác thực & phân quyền.
- Xử lý đồng thời, concurrency, distributed system.
- Tích hợp với third-party (payment, mail, SMS,...).
- Đảm bảo bảo mật, hiệu năng, scalability.

---

# PHẦN 2: NODE.JS DEEP DIVE

## 2.1. Node.js là gì?

**Câu hỏi:** Node.js là gì? Vì sao Node.js có thể chạy JavaScript ở server?

**Trả lời:**

**Node.js là một runtime environment** cho phép chạy JavaScript **ngoài trình duyệt**, được tạo bởi Ryan Dahl năm 2009.

**Thành phần chính của Node.js:**
1. **V8 Engine** (của Google, dùng trong Chrome) — biên dịch JS thành machine code.
2. **libuv** — thư viện C, cung cấp event loop và async I/O.
3. **C++ bindings** — cầu nối giữa JS và OS (file system, network).
4. **Standard library** — fs, http, crypto, stream,...

```
┌─────────────────────────────┐
│   Your JavaScript Code     │
├─────────────────────────────┤
│   Node.js APIs (fs, http)  │
├─────────────────────────────┤
│   V8     │   libuv         │
├─────────────────────────────┤
│   Operating System          │
└─────────────────────────────┘
```

**Đặc điểm nổi bật:**
- **Single-threaded** (event loop chính chỉ 1 thread).
- **Non-blocking I/O.**
- **Event-driven.**
- Cùng ngôn ngữ với frontend → dễ học, dùng chung code (TypeScript, validation).

**Khi nào nên dùng Node.js?**
- API server (REST, GraphQL).
- Real-time app (chat, game).
- Microservices.
- Tool CLI.

**Khi nào KHÔNG nên dùng Node.js?**
- CPU-intensive (xử lý ảnh, ML, mã hóa nặng) — vì single thread sẽ block. Dùng Go, Rust, Python (with native lib) tốt hơn.

---

## 2.2. Event Loop trong Node.js?

**Câu hỏi:** Em hãy giải thích Event Loop trong Node.js? Nó có những phase nào?

**Trả lời:**

Event Loop là **trái tim của Node.js**. Nó là vòng lặp xử lý các task bất đồng bộ, được implement bởi libuv.

### 6 phase của Event Loop:

```
   ┌───────────────────────────┐
┌─>│           timers          │  setTimeout, setInterval
│  └─────────────┬─────────────┘
│  ┌─────────────┴─────────────┐
│  │     pending callbacks     │  I/O callbacks bị defer
│  └─────────────┬─────────────┘
│  ┌─────────────┴─────────────┐
│  │       idle, prepare       │  internal
│  └─────────────┬─────────────┘
│  ┌─────────────┴─────────────┐
│  │           poll            │  I/O mới (đọc file, network)
│  └─────────────┬─────────────┘
│  ┌─────────────┴─────────────┐
│  │           check           │  setImmediate
│  └─────────────┬─────────────┘
│  ┌─────────────┴─────────────┐
└──┤      close callbacks      │  socket.on('close', ...)
   └───────────────────────────┘
```

**Chi tiết từng phase:**
1. **Timers:** Thực thi callback của `setTimeout`, `setInterval` đã đến hạn.
2. **Pending callbacks:** Một số I/O callback bị defer (như TCP error).
3. **Idle, prepare:** Nội bộ.
4. **Poll:** **Phase quan trọng nhất.** Đọc connection mới, xử lý I/O callback. Nếu queue rỗng, sẽ block để chờ I/O.
5. **Check:** Thực thi `setImmediate`.
6. **Close callbacks:** Xử lý `close` event.

### Microtask Queue (Process.nextTick & Promise):
Giữa **mỗi callback**, Node.js thực thi:
1. Tất cả `process.nextTick` callbacks.
2. Tất cả Promise resolved.

`process.nextTick` ưu tiên cao hơn Promise.

### Ví dụ:
```javascript
console.log('1');

setTimeout(() => console.log('2'), 0);
setImmediate(() => console.log('3'));

Promise.resolve().then(() => console.log('4'));
process.nextTick(() => console.log('5'));

console.log('6');
```

**Output:**
```
1
6
5    ← nextTick chạy trước Promise
4
2    ← timer 0ms
3    ← setImmediate (thứ tự 2 vs 3 không xác định nếu không trong I/O callback)
```

**Lưu ý:** Nếu `setTimeout(fn, 0)` và `setImmediate(fn)` cùng nằm trong I/O callback, thì `setImmediate` **luôn** chạy trước.

---

## 2.3. Vì sao Node.js single-thread vẫn xử lý được nhiều request?

**Câu hỏi:** Node.js chạy single-thread, vậy sao có thể xử lý hàng nghìn user cùng lúc?

**Trả lời:**

**Đáp án ngắn:** Node.js single-thread **chỉ ở phần JavaScript**. I/O được delegate cho libuv (có thread pool).

### Phân tích chi tiết:

**Cái gì single-thread?**
- Event loop chính (chạy JS code).

**Cái gì multi-thread?**
- **libuv thread pool** (mặc định 4 thread) — xử lý file I/O, DNS lookup, crypto, compression.
- **OS-level async** — network I/O (epoll trên Linux, kqueue trên macOS, IOCP trên Windows).

### Workflow:
1. Request đến → JS code chạy.
2. Gặp I/O (đọc DB, gọi API) → JS đẩy việc cho libuv → JS làm việc khác.
3. libuv hoàn thành → callback được đẩy vào event loop → JS chạy callback.

**Ưu điểm:**
- Không tốn memory cho thread (mỗi thread ~ 1MB stack).
- Không có context switch giữa các thread.
- Không cần lock, mutex.

**Nhược điểm:**
- Một callback **CPU nặng** sẽ block toàn bộ event loop → tất cả request khác phải chờ.

**Ví dụ block event loop:**
```javascript
app.get('/heavy', (req, res) => {
  let sum = 0;
  for (let i = 0; i < 1e10; i++) sum += i; // block 10s
  res.json({ sum });
});
// Trong 10 giây này, tất cả request khác không xử lý được!
```

**Cách xử lý CPU-bound trong Node.js:**
1. **Worker Threads** — chạy JS trong thread khác.
2. **Cluster** — fork nhiều process.
3. **Child process** — gọi binary khác (vd: ImageMagick).
4. **Offload sang service khác** (Go, Python).

---

## 2.4. Worker Threads vs Cluster vs Child Process?

**Câu hỏi:** Sự khác nhau giữa Worker Threads, Cluster, Child Process?

**Trả lời:**

### 1. Worker Threads:
- Tạo thread mới **trong cùng process**.
- Share memory (qua `SharedArrayBuffer`) hoặc message passing.
- Dùng cho **CPU-intensive task** (xử lý ảnh, mã hóa).

```javascript
const { Worker } = require('worker_threads');
const worker = new Worker('./heavy-task.js');
worker.on('message', (result) => console.log(result));
worker.postMessage({ data: 1000000 });
```

### 2. Cluster:
- Fork ra nhiều **process** (mỗi process là 1 Node.js instance).
- Mỗi process là 1 event loop riêng.
- Master process lắng nghe port, **load balance** request sang worker.
- Dùng để **tận dụng nhiều CPU core**.

```javascript
const cluster = require('cluster');
const os = require('os');

if (cluster.isMaster) {
  for (let i = 0; i < os.cpus().length; i++) {
    cluster.fork();
  }
} else {
  require('./app'); // chạy app trên port
}
```

### 3. Child Process:
- Tạo process mới (có thể là chương trình khác như `ls`, `python`).
- Giao tiếp qua stdin/stdout hoặc IPC.

```javascript
const { spawn } = require('child_process');
const ls = spawn('ls', ['-lh']);
ls.stdout.on('data', (data) => console.log(`${data}`));
```

### So sánh:

| Tính năng | Worker Thread | Cluster | Child Process |
|----------|--------------|---------|---------------|
| Memory | Share được | Riêng | Riêng |
| Tốn tài nguyên | Ít | Nhiều | Trung bình |
| Use case | CPU task | Scale ngang | Chạy chương trình khác |
| Communication | postMessage | IPC | stdin/stdout/IPC |

### Trong dự án thực tế:
- PM2 (process manager) sử dụng cluster mode để spawn nhiều instance.
- Bạn (Đăng) đã dùng PM2 trong project Sacred Dragon Warriors.

---

## 2.5. CommonJS vs ES Modules?

**Câu hỏi:** `require` và `import` khác nhau ra sao?

**Trả lời:**

### CommonJS (CJS):
- Cú pháp `require()` / `module.exports`.
- Là **mặc định** trong Node.js cũ.
- **Synchronous loading** (load file ngay khi gặp `require`).
- Có thể `require` ở bất kỳ đâu (kể cả trong function).

```javascript
const fs = require('fs');
module.exports = { foo: 'bar' };
```

### ES Modules (ESM):
- Cú pháp `import` / `export`.
- Chuẩn của JavaScript.
- **Asynchronous, static** (import phải ở top-level).
- File phải có extension `.mjs` hoặc `package.json` có `"type": "module"`.

```javascript
import fs from 'fs';
export const foo = 'bar';
```

### Khác biệt chính:

| Tính năng | CommonJS | ES Modules |
|----------|----------|-----------|
| Cú pháp | require/module.exports | import/export |
| Loading | Sync | Async |
| Có thể dynamic | Có | Có (qua `import()`) |
| Top-level await | Không | Có |
| Tree-shaking | Khó | Dễ |
| `__dirname`, `__filename` | Có sẵn | Không (phải tự tạo) |

### Trong NestJS:
- Mặc định dùng TypeScript với cú pháp ESM.
- Sau khi compile, ra CommonJS để chạy trong Node.

---

## 2.6. npm, yarn, pnpm?

**Câu hỏi:** Sự khác biệt giữa npm, yarn, pnpm?

**Trả lời:**

- **npm** — đi kèm Node.js, mặc định.
- **yarn** — Facebook tạo, lock file `yarn.lock`, parallel install nhanh hơn.
- **pnpm** — tiết kiệm disk (dùng hardlink/symlink chung), nhanh nhất.

**Lock file là gì?**
File `package-lock.json` / `yarn.lock` / `pnpm-lock.yaml` ghi lại **chính xác version** của mọi dependency (kể cả nested) để đảm bảo build giống nhau ở mọi máy.

**Semantic Versioning (semver):**
```
"react": "^18.2.0"
         │└── patch
         ├── minor
         └── major
```
- `^18.2.0` → cho phép update minor/patch (18.x.x).
- `~18.2.0` → cho phép update patch (18.2.x).
- `18.2.0` → fix cứng.

**dependencies vs devDependencies vs peerDependencies?**
- **dependencies:** Cần khi chạy production (express, nestjs).
- **devDependencies:** Chỉ cần khi dev (jest, typescript, eslint).
- **peerDependencies:** Plugin cần host có sẵn version này (vd: plugin React cần React 18+).

---

## 2.7. Stream, Buffer trong Node.js?

**Câu hỏi:** Stream là gì? Vì sao cần Stream?

**Trả lời:**

### Buffer:
**Buffer là vùng nhớ raw bytes** trong Node.js. Khi đọc file/network, data đến dưới dạng Buffer.

```javascript
const buf = Buffer.from('Hello');
console.log(buf); // <Buffer 48 65 6c 6c 6f>
console.log(buf.toString()); // 'Hello'
```

### Stream:
**Stream là cách xử lý data theo chunk** thay vì load toàn bộ vào memory.

**Ví dụ:** Đọc file 10GB.
- Không stream: `fs.readFile()` → 10GB vào RAM → crash.
- Stream: `fs.createReadStream()` → đọc từng chunk 64KB → xử lý → tiếp tục.

### 4 loại Stream:
1. **Readable** — đọc data (file, HTTP request).
2. **Writable** — ghi data (file, HTTP response).
3. **Duplex** — cả đọc và ghi (TCP socket).
4. **Transform** — duplex và biến đổi data (gzip, encryption).

### Ví dụ — copy file lớn:
```javascript
const fs = require('fs');
fs.createReadStream('big-input.mp4')
  .pipe(fs.createWriteStream('output.mp4'));
// Chỉ tốn ~64KB RAM bất kể file lớn cỡ nào
```

### Stream trong web:
```javascript
app.get('/video', (req, res) => {
  fs.createReadStream('video.mp4').pipe(res);
});
```

---

## 2.8. EventEmitter?

**Câu hỏi:** EventEmitter là gì? Cho ví dụ.

**Trả lời:**

**EventEmitter là class trong Node.js** cho phép tạo pattern **publish-subscribe** (pub-sub).

```javascript
const EventEmitter = require('events');
const emitter = new EventEmitter();

// Subscribe
emitter.on('user-created', (user) => {
  console.log('User mới:', user);
});

// Publish
emitter.emit('user-created', { id: 1, name: 'Đăng' });
```

**Use case:**
- Internal event trong app (gửi mail sau khi tạo user, log audit).
- HTTP request là một EventEmitter (`req.on('data', ...)`).
- Stream là EventEmitter (`stream.on('end', ...)`).

**Khác với message queue:**
- EventEmitter: **trong cùng process**.
- Message queue (RabbitMQ, Kafka): **giữa các process/service**.

---

## 2.9. Memory leak trong Node.js?

**Câu hỏi:** Em đã gặp memory leak trong Node.js chưa? Cách debug?

**Trả lời:**

**Memory leak** xảy ra khi memory được cấp phát nhưng không được giải phóng.

### Nguyên nhân thường gặp:

1. **Global variable không cần thiết:**
```javascript
global.cache = {};
function addUser(user) {
  global.cache[user.id] = user; // không bao giờ xóa
}
```

2. **Closure giữ reference:**
```javascript
function createHeavy() {
  const big = new Array(1e6).fill('x');
  return () => console.log(big.length); // big không bao giờ được GC
}
```

3. **EventEmitter — quên `removeListener`:**
```javascript
const emitter = new EventEmitter();
function setup() {
  emitter.on('data', handler); // mỗi lần setup() thêm 1 listener
}
```

4. **Timer không clear:**
```javascript
setInterval(() => { /* ... */ }, 1000);
// Quên clearInterval khi không cần nữa
```

5. **Cache không có TTL hoặc giới hạn size.**

### Cách debug:

1. **Monitor RAM:** PM2, Prometheus, `process.memoryUsage()`.
2. **Heap snapshot:** Dùng Chrome DevTools (gắn vào Node bằng `--inspect`).
3. **Heap diff:** So sánh 2 snapshot để xem object nào tăng bất thường.
4. **`--max-old-space-size`** — tăng heap limit (default 1.7GB cho Node 14+).

---

## 2.10. process.nextTick vs setImmediate vs setTimeout?

**Câu hỏi:** 3 cái này khác nhau ra sao?

**Trả lời:**

| Hàm | Khi nào chạy |
|-----|--------------|
| `process.nextTick(fn)` | Ngay sau callback hiện tại, **trước** mọi I/O và timer |
| `Promise.resolve().then(fn)` | Sau `nextTick`, **trước** I/O |
| `setImmediate(fn)` | Phase **check** trong event loop |
| `setTimeout(fn, 0)` | Phase **timers**, tối thiểu 1ms |

**Lưu ý:** Lạm dụng `process.nextTick` có thể "starve" event loop (không bao giờ đến I/O).

```javascript
function infinite() {
  process.nextTick(infinite); // I/O không bao giờ chạy được
}
```

---


---

# PHẦN 3: NESTJS DEEP DIVE

## 3.1. NestJS là gì? Vì sao chọn NestJS?

**Câu hỏi:** Em hãy giới thiệu NestJS. Vì sao chọn NestJS thay vì Express?

**Trả lời:**

**NestJS là framework Node.js** xây dựng trên Express (hoặc Fastify), do Kamil Mysliwiec tạo năm 2017. Nó **opinionated**, áp dụng tư tưởng của Angular (decorator, DI, module).

**Đặc điểm:**
- Viết bằng **TypeScript** (đầy đủ).
- **Modular** — chia code thành các module.
- **Dependency Injection** sẵn có.
- **Decorator-based** — dùng `@Controller()`, `@Get()`,...
- Hỗ trợ **Microservices, GraphQL, WebSocket, gRPC, CQRS** sẵn.
- Convention rõ ràng → team lớn dễ làm chung.

### So sánh NestJS vs Express:

| Tính năng | Express | NestJS |
|----------|---------|--------|
| Opinionated | Không | Có (structure rõ) |
| TypeScript | Phải tự setup | Built-in |
| DI | Không | Có |
| Modular | Tự design | Có module system |
| Boilerplate | Ít | Nhiều hơn |
| Phù hợp cho | App nhỏ, prototype | App lớn, enterprise |

**Vì sao chọn NestJS cho project lớn?**
- Code có structure → dễ maintain khi team đông.
- DI giúp test dễ (mock dependency).
- Built-in nhiều thứ (validation, swagger, microservices) → ít boilerplate.

---

## 3.2. Module, Controller, Service trong NestJS?

**Câu hỏi:** Giải thích Module, Controller, Provider, Service trong NestJS.

**Trả lời:**

### Module:
**Đơn vị tổ chức code trong NestJS.** Mỗi feature là 1 module.

```typescript
@Module({
  imports: [DatabaseModule],
  controllers: [UserController],
  providers: [UserService, UserRepository],
  exports: [UserService], // service nào muốn share cho module khác
})
export class UserModule {}
```

**Trường:**
- `imports`: module khác mà module này cần.
- `controllers`: các controller xử lý HTTP request.
- `providers`: các class có thể được DI (thường là service, repository).
- `exports`: provider nào muốn cho module khác dùng.

### Controller:
**Xử lý HTTP request, trả response.** Mỗi controller có route prefix.

```typescript
@Controller('users')
export class UserController {
  constructor(private userService: UserService) {}

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.userService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.userService.create(dto);
  }
}
```

### Service (Provider):
**Chứa business logic.** Được DI vào controller hoặc service khác.

```typescript
@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
  ) {}

  async create(dto: CreateUserDto) {
    const user = this.userRepo.create(dto);
    return this.userRepo.save(user);
  }
}
```

### Tại sao tách Controller / Service?
**Separation of Concerns:**
- Controller: chỉ xử lý HTTP (parse request, return response).
- Service: chỉ xử lý logic (validate, gọi DB, gọi API khác).

→ Service có thể tái sử dụng (gọi từ controller, từ service khác, từ background job, từ WebSocket gateway).

---

## 3.3. Request Lifecycle của NestJS?

**Câu hỏi:** **(Câu hỏi rất phổ biến)** Em hãy mô tả request lifecycle trong NestJS. Một request đi qua các phase nào?

**Trả lời:**

Đây là câu hỏi **kinh điển**. Phải nhớ rõ thứ tự!

### Thứ tự xử lý:

```
Incoming Request
       │
       ▼
1. Middleware
       │
       ▼
2. Guards
       │
       ▼
3. Interceptors (BEFORE controller)
       │
       ▼
4. Pipes (validation, transformation)
       │
       ▼
5. Controller method (route handler)
       │
       ▼
6. Service (business logic)
       │
       ▼
7. Interceptors (AFTER controller — transform response)
       │
       ▼
8. Exception Filter (nếu có lỗi ném ra ở bất kỳ đâu)
       │
       ▼
   Response
```

### Chi tiết từng phase:

#### 1. Middleware
- Chạy **đầu tiên**, giống Express middleware.
- Truy cập được `req`, `res`, `next`.
- Áp dụng được toàn cục hoặc theo path.
- Use case: logging, parsing body, CORS.

```typescript
@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    console.log(`${req.method} ${req.url}`);
    next();
  }
}
```

#### 2. Guards
- Quyết định request có **được xử lý hay không** (return `true`/`false`).
- Chạy **sau Middleware, trước Interceptor**.
- Use case: authentication, authorization.

```typescript
@Injectable()
export class JwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const token = request.headers.authorization?.split(' ')[1];
    try {
      const payload = jwt.verify(token, SECRET);
      request.user = payload;
      return true;
    } catch {
      return false; // → 401 Forbidden
    }
  }
}

// Dùng:
@UseGuards(JwtAuthGuard)
@Get('profile')
getProfile() { ... }
```

#### 3. Interceptors (BEFORE)
- Có thể chạy code **trước và sau** route handler.
- Use case: logging, caching, transform response, đo thời gian.

```typescript
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const now = Date.now();
    return next.handle().pipe(
      tap(() => console.log(`Took ${Date.now() - now}ms`))
    );
  }
}
```

#### 4. Pipes
- **Transform** (biến đổi data) và **validate** input.
- Chạy ngay trước route handler.
- Use case: parse string thành number, validate DTO.

```typescript
@Get(':id')
findOne(@Param('id', ParseIntPipe) id: number) {
  // id đã được parse từ string thành number
}

// Custom pipe:
@Injectable()
export class ValidationPipe implements PipeTransform {
  transform(value: any, metadata: ArgumentMetadata) {
    // validate value
    if (!value) throw new BadRequestException();
    return value;
  }
}
```

#### 5. Route Handler
- Code trong `@Get()`, `@Post()` method của controller.

#### 6. Service
- Gọi business logic.

#### 7. Interceptors (AFTER)
- Sau khi controller return, response đi qua interceptor để transform.

#### 8. Exception Filter
- Nếu có exception ở bất kỳ phase nào → đi qua filter.
- Use case: format error response chuẩn.

```typescript
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();
    response.status(status).json({
      statusCode: status,
      message: exception.message,
      timestamp: new Date().toISOString(),
    });
  }
}
```

### Mẹo nhớ thứ tự: **MGIPCIE**
> **M**iddleware → **G**uards → **I**nterceptor (before) → **P**ipes → **C**ontroller → **I**nterceptor (after) → **E**xception Filter.

---

## 3.4. Dependency Injection trong NestJS?

**Câu hỏi:** Dependency Injection là gì? NestJS thực hiện DI thế nào?

**Trả lời:**

### Dependency Injection là gì?
**DI là design pattern** trong đó **một class không tự tạo dependency** mà nhận từ ngoài.

**Không có DI:**
```typescript
class UserService {
  private repo = new UserRepository(); // tự tạo
}
```
**Vấn đề:**
- Không test được (không mock được repo).
- Tight coupling (UserService phụ thuộc class cụ thể UserRepository).

**Có DI:**
```typescript
class UserService {
  constructor(private repo: UserRepository) {} // nhận từ ngoài
}
```
**Lợi ích:**
- Test dễ (truyền mock vào).
- Loose coupling.

### NestJS thực hiện DI thế nào?

NestJS có một **IoC Container** (Inversion of Control). Khi app khởi động:
1. NestJS đọc tất cả `@Injectable()` class.
2. Quét constructor của mỗi class để biết cần dependency gì.
3. Tự động tạo instance và inject.

```typescript
@Injectable()
export class UserService {
  constructor(
    private userRepo: UserRepository, // NestJS tự inject
    private mailService: MailService,
  ) {}
}
```

### Cơ chế bên dưới: Reflect Metadata

Khi compile TypeScript với `emitDecoratorMetadata: true`, TS sẽ tự thêm metadata kiểu vào class. NestJS dùng `Reflect.getMetadata('design:paramtypes', ClassRef)` để biết constructor cần kiểu nào.

### Provider Token:
- **Class token** (mặc định): `{ provide: UserService, useClass: UserService }`.
- **String/Symbol token:** dùng khi muốn inject interface hoặc giá trị non-class.

```typescript
@Module({
  providers: [
    {
      provide: 'DATABASE_CONFIG',
      useValue: { host: 'localhost', port: 5432 },
    },
  ],
})
export class AppModule {}

// Inject:
constructor(@Inject('DATABASE_CONFIG') private config: any) {}
```

### useClass, useValue, useFactory, useExisting:

```typescript
providers: [
  // 1. Class
  { provide: UserService, useClass: UserService },

  // 2. Value (constant)
  { provide: 'CONFIG', useValue: { foo: 'bar' } },

  // 3. Factory (compute giá trị)
  {
    provide: 'CONNECTION',
    useFactory: (config: ConfigService) => createConnection(config),
    inject: [ConfigService],
  },

  // 4. Existing (alias)
  { provide: 'AliasService', useExisting: UserService },
]
```

### Injection Scope:
- **Singleton** (default): 1 instance cho toàn app.
- **Request**: 1 instance cho mỗi request.
- **Transient**: 1 instance mới mỗi lần inject.

```typescript
@Injectable({ scope: Scope.REQUEST })
export class UserService {}
```

⚠️ **Lưu ý:** Request-scope **chậm hơn** (tạo instance mỗi request) → chỉ dùng khi cần thiết (vd: muốn truy cập request object trong service).

---

## 3.5. OOP trong NestJS thể hiện ở đâu?

**Câu hỏi:** **(Câu hỏi rất hay)** OOP thể hiện ở những chỗ nào trong NestJS?

**Trả lời:**

NestJS xây dựng dựa trên OOP. Bốn nguyên lý của OOP:
1. **Encapsulation** (đóng gói)
2. **Inheritance** (kế thừa)
3. **Polymorphism** (đa hình)
4. **Abstraction** (trừu tượng)

### 1. Encapsulation (Đóng gói)
- Mỗi Service đóng gói data + logic. Bên ngoài chỉ tương tác qua public method.
- `private`, `public`, `protected` của TypeScript.

```typescript
@Injectable()
export class UserService {
  private cache: Map<string, User> = new Map(); // ẩn

  async findOne(id: string): Promise<User> { // public API
    if (this.cache.has(id)) return this.cache.get(id);
    // ...
  }
}
```

### 2. Inheritance (Kế thừa)
- Controller có thể kế thừa từ base controller.
- Service kế thừa từ generic service.
- Custom exception kế thừa `HttpException`.

```typescript
// Custom exception
export class UserNotFoundException extends NotFoundException {
  constructor(id: string) {
    super(`User ${id} not found`);
  }
}

// Base service
export abstract class BaseService<T> {
  abstract findOne(id: string): Promise<T>;

  async findOrFail(id: string): Promise<T> {
    const item = await this.findOne(id);
    if (!item) throw new NotFoundException();
    return item;
  }
}

export class UserService extends BaseService<User> {
  async findOne(id: string): Promise<User> {
    return this.userRepo.findOne({ where: { id } });
  }
}
```

### 3. Polymorphism (Đa hình)
- **Interface** cho phép nhiều implementation.
- Strategy pattern (vd: nhiều payment provider).

```typescript
interface PaymentProvider {
  pay(amount: number): Promise<boolean>;
}

class PayOSProvider implements PaymentProvider {
  async pay(amount: number) { /* PayOS logic */ }
}

class VNPayProvider implements PaymentProvider {
  async pay(amount: number) { /* VNPay logic */ }
}

// Service dùng interface:
@Injectable()
class CheckoutService {
  constructor(@Inject('PAYMENT_PROVIDER') private provider: PaymentProvider) {}
  async checkout(amount: number) {
    return this.provider.pay(amount);
  }
}
```

### 4. Abstraction (Trừu tượng)
- DI inject interface, không inject class cụ thể.
- Repository pattern: business logic không quan tâm DB cụ thể.

```typescript
abstract class UserRepository {
  abstract findOne(id: string): Promise<User>;
}

@Injectable()
class TypeOrmUserRepository extends UserRepository {
  async findOne(id: string) { /* TypeORM logic */ }
}

// UserService không biết đang dùng TypeORM, Prisma hay MongoDB
```

### Decorators = OOP Meta-programming
Decorator trong NestJS (`@Injectable`, `@Controller`, `@Get`) là cách thêm metadata vào class/method → enable nhiều tính năng OOP nâng cao.

### Module Pattern
Module trong NestJS là **encapsulation ở mức kiến trúc** — đóng gói các class liên quan.

---

## 3.6. Decorator trong NestJS?

**Câu hỏi:** Decorator là gì? Có những loại nào?

**Trả lời:**

**Decorator là function có dạng `@Name()`**, được áp dụng lên class/method/property/parameter để thêm metadata.

### 5 loại decorator:

#### 1. Class decorator
```typescript
@Controller('users')
export class UserController {}
```

#### 2. Method decorator
```typescript
class UserController {
  @Get(':id')
  findOne() {}
}
```

#### 3. Property decorator
```typescript
class User {
  @IsEmail()
  email: string;
}
```

#### 4. Parameter decorator
```typescript
findOne(@Param('id') id: string) {}
```

#### 5. Accessor decorator
(ít dùng, áp dụng cho getter/setter).

### Custom Decorator:

```typescript
// Custom param decorator để lấy user từ request
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);

// Dùng:
@Get('me')
@UseGuards(JwtAuthGuard)
getMe(@CurrentUser() user: User) {
  return user;
}
```

### Custom method decorator (composite):
```typescript
export function Auth(...roles: string[]) {
  return applyDecorators(
    SetMetadata('roles', roles),
    UseGuards(JwtAuthGuard, RolesGuard),
    ApiBearerAuth(),
  );
}

// Dùng:
@Auth('admin')
@Delete(':id')
deleteUser() {}
```

---

## 3.7. Pipes trong NestJS?

**Câu hỏi:** Pipe dùng để làm gì? Em đã dùng pipe nào?

**Trả lời:**

**Pipe có 2 mục đích:**
1. **Transformation** — biến đổi input.
2. **Validation** — validate input.

### Built-in Pipes:
- `ParseIntPipe`, `ParseFloatPipe`, `ParseBoolPipe`
- `ParseUUIDPipe`
- `ParseArrayPipe`
- `ParseEnumPipe`
- `DefaultValuePipe`
- `ValidationPipe` (kết hợp class-validator)

### Ví dụ:

```typescript
@Get(':id')
findOne(@Param('id', ParseIntPipe) id: number) {
  // id chắc chắn là number, nếu không sẽ throw 400
}

@Get()
findAll(@Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number) {
  // page mặc định 1, đảm bảo là number
}
```

### Validation Pipe + DTO:

```typescript
export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEmail()
  email: string;

  @IsInt()
  @Min(18)
  age: number;
}

@Post()
create(@Body() dto: CreateUserDto) {
  // dto đã được validate
}

// main.ts:
app.useGlobalPipes(new ValidationPipe({
  whitelist: true,           // bỏ field không có trong DTO
  forbidNonWhitelisted: true, // throw nếu có field thừa
  transform: true,            // tự transform sang DTO instance
}));
```

### Custom Pipe:

```typescript
@Injectable()
export class TrimPipe implements PipeTransform {
  transform(value: string) {
    if (typeof value === 'string') {
      return value.trim();
    }
    return value;
  }
}
```

---

## 3.8. Guards vs Interceptors vs Middleware?

**Câu hỏi:** Sự khác biệt giữa Guard, Interceptor, Middleware? Khi nào dùng cái nào?

**Trả lời:**

### Middleware
- **Vị trí:** Đầu tiên trong pipeline.
- **Truy cập:** `req`, `res`, `next` (như Express).
- **Mục đích:** Logging request, parsing body, CORS, helmet.
- **Hạn chế:** Không truy cập được `ExecutionContext`, không biết route handler nào sắp chạy.

### Guard
- **Vị trí:** Sau middleware.
- **Return:** `true` / `false` / `Observable<boolean>` / `Promise<boolean>`.
- **Mục đích:** **Authorization** — quyết định có cho request đi tiếp không.
- **Khác middleware:** Biết được handler & metadata (nhờ `ExecutionContext`).

### Interceptor
- **Vị trí:** Trước và sau controller.
- **Bao quanh route handler** (RxJS Observable).
- **Mục đích:** Logging timing, transform response, caching, exception mapping.

### Bảng so sánh:

| Tính năng | Middleware | Guard | Interceptor |
|----------|-----------|-------|------------|
| Vị trí | Đầu tiên | Sau middleware | Bao quanh handler |
| Truy cập ExecutionContext | Không | Có | Có |
| Return value | next() | bool | Observable |
| Modify response | Khó | Không | Có |
| Use case | Logging, parsing | Auth | Transform, cache |

### Ví dụ:
- **Middleware:** Parse JWT từ cookie, gắn vào req.
- **Guard:** Check user role.
- **Interceptor:** Log thời gian xử lý request.

---

## 3.9. Exception Filter trong NestJS?

**Câu hỏi:** Em xử lý exception trong NestJS như thế nào?

**Trả lời:**

NestJS có **built-in exception layer**. Khi exception được throw, nó tự bắt và trả response phù hợp.

### Built-in exceptions:
```typescript
throw new BadRequestException('Email invalid');           // 400
throw new UnauthorizedException();                         // 401
throw new ForbiddenException();                            // 403
throw new NotFoundException('User not found');             // 404
throw new ConflictException('Email exists');               // 409
throw new UnprocessableEntityException();                  // 422
throw new InternalServerErrorException();                  // 500
```

### Custom Exception:

```typescript
export class InsufficientBalanceException extends HttpException {
  constructor(currentBalance: number) {
    super({
      message: 'Insufficient balance',
      currentBalance,
      code: 'INSUFFICIENT_BALANCE',
    }, HttpStatus.BAD_REQUEST);
  }
}
```

### Exception Filter (custom):

```typescript
@Catch() // catch all
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message: exception instanceof Error ? exception.message : 'Unknown error',
    });
  }
}

// Apply global:
app.useGlobalFilters(new AllExceptionsFilter());
```

### `@Catch(SpecificException)`:
```typescript
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    // chỉ bắt HttpException
  }
}
```

---

## 3.10. Lifecycle Hooks trong NestJS?

**Câu hỏi:** NestJS có những lifecycle hook nào?

**Trả lời:**

### Lifecycle Events:
1. **onModuleInit** — chạy sau khi module được khởi tạo.
2. **onApplicationBootstrap** — chạy sau khi toàn bộ app khởi tạo xong.
3. **onModuleDestroy** — chạy khi nhận termination signal.
4. **beforeApplicationShutdown** — chạy trước khi app shutdown.
5. **onApplicationShutdown** — chạy khi shutdown.

```typescript
@Injectable()
export class UserService implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    console.log('UserService khởi tạo, kết nối DB...');
    await this.db.connect();
  }

  async onModuleDestroy() {
    console.log('UserService shutdown, đóng kết nối...');
    await this.db.disconnect();
  }
}
```

### Use case:
- **onModuleInit:** Kết nối DB, warm cache, register cron job.
- **onModuleDestroy:** Cleanup connection, flush buffer, save state.

### Graceful Shutdown:
```typescript
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();  // ⚠️ phải bật để hook chạy
  await app.listen(3000);
}
```

---

## 3.11. Module trong NestJS — Dynamic Module?

**Câu hỏi:** Dynamic Module là gì? Khi nào dùng?

**Trả lời:**

**Dynamic Module** cho phép **truyền config khi import**, tạo module configurable.

### Ví dụ static module:
```typescript
@Module({ imports: [DatabaseModule] })
export class UserModule {}
```

### Dynamic Module:
```typescript
@Module({})
export class DatabaseModule {
  static forRoot(options: DatabaseOptions): DynamicModule {
    return {
      module: DatabaseModule,
      providers: [
        { provide: 'DB_OPTIONS', useValue: options },
        DatabaseService,
      ],
      exports: [DatabaseService],
    };
  }
}

// Dùng:
@Module({
  imports: [
    DatabaseModule.forRoot({ host: 'localhost', port: 5432 }),
  ],
})
export class AppModule {}
```

**Convention:** `forRoot` (sync) và `forRootAsync` (async, dùng `useFactory`).

### Ví dụ thực tế: ConfigModule, JwtModule, TypeOrmModule.

```typescript
JwtModule.registerAsync({
  imports: [ConfigModule],
  useFactory: (config: ConfigService) => ({
    secret: config.get('JWT_SECRET'),
    signOptions: { expiresIn: '15m' },
  }),
  inject: [ConfigService],
})
```

---

## 3.12. Microservices trong NestJS?

**Câu hỏi:** NestJS hỗ trợ microservices thế nào?

**Trả lời:**

NestJS hỗ trợ nhiều **transport** cho microservices:

### Transports:
1. **TCP** — đơn giản, nhanh, không cần broker.
2. **Redis** — pub/sub qua Redis.
3. **MQTT** — IoT.
4. **NATS** — high performance pub/sub.
5. **RabbitMQ** — message queue truyền thống.
6. **Kafka** — event streaming.
7. **gRPC** — typed, binary, hiệu năng cao.

### Tạo microservice:

```typescript
// main.ts (microservice)
const app = await NestFactory.createMicroservice(AppModule, {
  transport: Transport.TCP,
  options: { host: '127.0.0.1', port: 3001 },
});
await app.listen();
```

### Gọi microservice từ HTTP service:

```typescript
@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'USER_SERVICE',
        transport: Transport.TCP,
        options: { host: 'localhost', port: 3001 },
      },
    ]),
  ],
})
```

```typescript
@Injectable()
class GatewayService {
  constructor(@Inject('USER_SERVICE') private client: ClientProxy) {}

  async findUser(id: string) {
    return firstValueFrom(this.client.send('findUser', { id }));
  }
}
```

### Message Pattern vs Event Pattern:
- `@MessagePattern('findUser')` — **request-response** (return value).
- `@EventPattern('user.created')` — **fire-and-forget** (không return).

---


# PHẦN 4: AUTHENTICATION & SECURITY

## 4.1. Authentication vs Authorization?

**Câu hỏi:** Phân biệt Authentication và Authorization.

**Trả lời:**

- **Authentication (AuthN):** "Mày là **ai**?" — xác thực danh tính (login, kiểm tra password).
- **Authorization (AuthZ):** "Mày có **quyền** gì?" — kiểm tra permission (admin xóa được user thường, ngược lại không).

**Ví dụ:**
- AuthN: Đăng nhập bằng email + password → server cấp JWT.
- AuthZ: User có role `user` cố vào API `/admin/users` → bị từ chối dù đã login.

**Status code:**
- AuthN fail → 401 Unauthorized.
- AuthZ fail → 403 Forbidden.

---

## 4.2. JWT là gì? Lifecycle của JWT?

**Câu hỏi:** **(Quan trọng)** JWT là gì? Vòng đời của JWT?

**Trả lời:**

**JWT (JSON Web Token)** là chuẩn (RFC 7519) để truyền claims dưới dạng JSON, được sign để xác thực.

### Cấu trúc JWT:
```
xxxxx.yyyyy.zzzzz
header.payload.signature
```

Mỗi phần là base64url encoded.

**Header:**
```json
{
  "alg": "HS256",
  "typ": "JWT"
}
```

**Payload:**
```json
{
  "sub": "user-123",
  "email": "dang@example.com",
  "role": "admin",
  "iat": 1700000000,
  "exp": 1700003600
}
```

**Signature:**
```
HMACSHA256(
  base64url(header) + '.' + base64url(payload),
  SECRET
)
```

### Standard claims:
- `sub` (subject) — user ID.
- `iat` (issued at) — thời điểm tạo.
- `exp` (expiration) — thời điểm hết hạn.
- `iss` (issuer) — ai phát hành.
- `aud` (audience) — cho ai.
- `nbf` (not before) — chỉ valid sau thời điểm này.
- `jti` (JWT ID) — unique ID (dùng để revoke).

### JWT Lifecycle:

```
┌─────────────────────────────────────────────────────────┐
│  1. LOGIN                                                │
│  Client → POST /auth/login (email, password)             │
│  Server: verify password → tạo JWT (access + refresh)    │
│  Server → Client: { accessToken, refreshToken }          │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│  2. AUTHORIZED REQUEST                                   │
│  Client → GET /profile                                   │
│  Headers: Authorization: Bearer <accessToken>            │
│  Server: verify signature & exp → cho phép               │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│  3. ACCESS TOKEN EXPIRED (vd: sau 15 phút)               │
│  Server → 401                                            │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│  4. REFRESH                                              │
│  Client → POST /auth/refresh (refreshToken)              │
│  Server: verify refresh → cấp accessToken mới            │
│  Server → Client: { accessToken }                        │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│  5. LOGOUT                                               │
│  Client xóa token khỏi storage                           │
│  (Optional) Server thêm jti vào blacklist                │
└─────────────────────────────────────────────────────────┘
```

### Access Token vs Refresh Token:

| Tính năng | Access Token | Refresh Token |
|----------|--------------|---------------|
| Thời hạn | Ngắn (15p) | Dài (7-30 ngày) |
| Dùng để | Gọi API | Lấy access token mới |
| Lưu ở đâu | Memory hoặc localStorage | httpOnly cookie (an toàn) |
| Stateless | Có | Thường stateful (lưu DB để revoke) |

### Vì sao chia 2 token?
- **Access token** ngắn hạn → giảm rủi ro nếu bị lộ.
- **Refresh token** dài hạn → user không phải login lại liên tục.
- Refresh token được verify với DB → có thể revoke (đăng xuất tất cả thiết bị).

---

## 4.3. Lưu JWT ở đâu? localStorage vs cookie?

**Câu hỏi:** Em nên lưu JWT ở đâu? Trade-off?

**Trả lời:**

### Option 1: localStorage
**Ưu:**
- Dễ truy cập từ JS.
- Persistent qua reload.

**Nhược:**
- **Vulnerable to XSS** — script độc đọc được localStorage.

### Option 2: sessionStorage
- Như localStorage nhưng xóa khi đóng tab.

### Option 3: Memory (variable trong JS)
**Ưu:**
- An toàn nhất với XSS (nhưng vẫn có rủi ro).
- Mất khi reload → cần refresh token.

### Option 4: Cookie (httpOnly + Secure + SameSite)
**Ưu:**
- **httpOnly** → JS không đọc được → an toàn với XSS.
- **Secure** → chỉ gửi qua HTTPS.
- **SameSite=Strict/Lax** → chống CSRF.

**Nhược:**
- Vulnerable to CSRF nếu không có SameSite (cũ).
- Đi kèm mỗi request đến domain → tốn băng thông.

### Khuyến nghị:
- **Access token:** memory (JS variable).
- **Refresh token:** httpOnly cookie với SameSite=Strict.

---

## 4.4. JWT có thể revoke trước khi expire không?

**Câu hỏi:** JWT stateless, vậy làm sao revoke trước khi expire?

**Trả lời:**

JWT **bản chất là stateless** → server không biết token đã bị logout hay chưa. Có vài cách handle:

### 1. Blacklist (Token Revocation List)
- Lưu `jti` của token bị revoke vào Redis (TTL = thời gian còn lại đến exp).
- Mỗi request check blacklist.
- **Nhược:** Mất tính stateless. Tốn Redis memory.

```typescript
// Logout:
await redis.set(`blacklist:${jti}`, '1', 'EX', remainingTime);

// Verify:
if (await redis.exists(`blacklist:${jti}`)) {
  throw new UnauthorizedException();
}
```

### 2. Short-lived access token + refresh token blacklist
- Access token sống ngắn (5-15 phút) → không cần blacklist.
- Refresh token stateful (lưu DB) → revoke bằng cách xóa khỏi DB.

### 3. Token versioning
- Mỗi user có `tokenVersion` trong DB.
- JWT payload chứa `version`.
- Verify: so sánh `payload.version` với `user.tokenVersion`.
- Khi đổi password / logout all device → tăng `tokenVersion` → tất cả token cũ invalid.

```typescript
// Payload: { sub: 'user-123', version: 5 }
// Verify:
const user = await db.findUser(payload.sub);
if (payload.version !== user.tokenVersion) {
  throw new UnauthorizedException();
}
```

### Trong project Sacred Dragon Warriors của em:
C� thể implement combo: short access token (15 phút) + refresh token lưu Redis + `tokenVersion`.

---

## 4.5. JWT signing algorithms: HS256 vs RS256?

**Câu hỏi:** HS256 và RS256 khác nhau ra sao? Khi nào dùng cái nào?

**Trả lời:**

### HS256 (HMAC SHA-256) — Symmetric
- **1 secret key** dùng cho cả sign và verify.
- Server giữ secret.
- **Đơn giản, nhanh.**

### RS256 (RSA SHA-256) — Asymmetric
- **Private key** để sign, **public key** để verify.
- Server giữ private key, công khai public key.
- **An toàn hơn** khi có nhiều service verify.

### Khi nào dùng cái nào?

**HS256:**
- Khi chỉ 1 service (monolith).
- Đơn giản, không cần share key.

**RS256:**
- Khi có nhiều microservice cần verify token (chỉ cần public key).
- Khi có third-party verify (vd: API gateway verify token do auth service phát hành).
- Khi muốn auth service tách biệt khỏi resource service.

### Ví dụ:
```typescript
// HS256
const token = jwt.sign(payload, 'secret', { algorithm: 'HS256' });
const decoded = jwt.verify(token, 'secret');

// RS256
const token = jwt.sign(payload, privateKey, { algorithm: 'RS256' });
const decoded = jwt.verify(token, publicKey);
```

---

## 4.6. OAuth2 flow?

**Câu hỏi:** Em giải thích OAuth2 Authorization Code Flow.

**Trả lời:**

**OAuth2** là protocol cho phép app **thay mặt user** truy cập tài nguyên ở service khác (vd: Login với Google).

### 4 vai trò:
1. **Resource Owner** — user.
2. **Client** — app của bạn.
3. **Authorization Server** — Google, Facebook.
4. **Resource Server** — API chứa data của user (Google Drive API).

### Authorization Code Flow (chuẩn nhất):

```
┌──────┐                                     ┌──────────┐
│ User │                                     │   App    │
└──┬───┘                                     └────┬─────┘
   │                                              │
   │  1. Click "Login với Google"                 │
   ├─────────────────────────────────────────────>│
   │                                              │
   │  2. Redirect đến Google                      │
   │<─────────────────────────────────────────────┤
   │                                              │
   │  3. User login với Google                    │
   │  ┌────────┐                                  │
   │  │ Google │                                  │
   │  └────┬───┘                                  │
   │       │  4. Google hỏi: "Cho phép App truy   │
   │       │     cập email của bạn?"              │
   │<──────┤                                      │
   │       │  5. User Allow                       │
   │──────>│                                      │
   │       │                                      │
   │       │  6. Redirect về App với CODE         │
   │       │     /callback?code=ABC123            │
   │       ├─────────────────────────────────────>│
   │       │                                      │
   │       │  7. App gửi CODE + client_secret     │
   │       │     đến Google                       │
   │       │<─────────────────────────────────────┤
   │       │                                      │
   │       │  8. Google trả ACCESS TOKEN          │
   │       ├─────────────────────────────────────>│
   │       │                                      │
   │       │  9. App dùng token gọi Google API    │
   │       │     để lấy email user                │
   │       │<─────────────────────────────────────┤
   │       │                                      │
```

### Vì sao 2 bước (code → token)?
- Code chỉ dùng 1 lần, hết hạn nhanh.
- Token được trao đổi qua **back-channel** (server-to-server), không lộ ra browser.
- Cần `client_secret` → chỉ server của app biết.

### PKCE (Proof Key for Code Exchange):
- Mở rộng cho mobile/SPA (không thể giữ secret an toàn).
- Client tạo `code_verifier` random, gửi `code_challenge = SHA256(code_verifier)` khi xin code.
- Khi đổi code lấy token, gửi kèm `code_verifier`.

### OpenID Connect (OIDC):
- Lớp trên OAuth2 cho authentication.
- Trả thêm **ID Token** (JWT chứa thông tin user).

---

## 4.7. Session-based vs Token-based Auth?

**Câu hỏi:** Session và Token khác nhau ra sao? Khi nào dùng?

**Trả lời:**

### Session-based:
1. User login → server tạo session, lưu trong DB/Redis → trả `sessionId` qua cookie.
2. Mỗi request gửi cookie → server query session.

**Ưu:**
- Dễ revoke (xóa session trong DB).
- Server kiểm soát hoàn toàn.

**Nhược:**
- **Stateful** — khó scale ngang (cần shared session store).
- Cookie không phù hợp với mobile/SPA tốt.

### Token-based (JWT):
1. User login → server tạo JWT (chứa thông tin user) → trả về.
2. Mỗi request gửi JWT → server verify signature.

**Ưu:**
- **Stateless** — server không cần lưu gì.
- Dễ scale ngang.
- Phù hợp microservices, mobile, SPA.

**Nhược:**
- Khó revoke trước khi expire.
- Payload to → tốn băng thông.

### So sánh:

| Tính năng | Session | JWT |
|----------|---------|-----|
| Server state | Có | Không |
| Scale ngang | Khó | Dễ |
| Revoke | Dễ | Khó |
| Mobile | Khó | Dễ |
| Cross-domain | Khó (cookie) | Dễ |

### Khi nào dùng?
- **Session:** Web monolith, cần revoke tức thì (banking).
- **JWT:** Microservices, mobile app, SPA.

---

## 4.8. RBAC vs ABAC?

**Câu hỏi:** RBAC là gì? Khác ABAC ra sao?

**Trả lời:**

### RBAC (Role-Based Access Control):
**Phân quyền theo role.** Mỗi user có 1+ role, mỗi role có 1+ permission.

```
User → Role → Permission
```

**Ví dụ:**
- `admin` → can create, read, update, delete users.
- `editor` → can read, update articles.
- `viewer` → can read articles only.

**Implementation:**
```typescript
@Roles('admin', 'manager')
@UseGuards(JwtAuthGuard, RolesGuard)
@Delete(':id')
deleteUser() {}
```

### ABAC (Attribute-Based Access Control):
**Phân quyền dựa trên thuộc tính** của user, resource, environment, action.

**Ví dụ rule:**
- User có thể edit article **nếu** user là author của article.
- User có thể truy cập API **nếu** request đến từ IP nội bộ và trong giờ làm việc.

**Implementation phức tạp hơn**, thường dùng engine như **Casbin**, **OPA**.

```typescript
const allow = await casbin.enforce(user, article, 'edit');
```

### So sánh:

| Tính năng | RBAC | ABAC |
|----------|------|------|
| Phức tạp | Đơn giản | Phức tạp |
| Linh hoạt | Cứng | Linh hoạt |
| Use case | App nhỏ-trung | App lớn, đa tenant |

---

## 4.9. Password hashing — bcrypt, argon2, scrypt?

**Câu hỏi:** Vì sao không lưu password dạng plain text? Vì sao dùng bcrypt thay vì SHA256?

**Trả lời:**

### Tuyệt đối KHÔNG bao giờ:
- Lưu plain text.
- Lưu Base64 (Base64 không phải encryption).
- Dùng MD5, SHA-1 (yếu, đã crack được).
- Dùng SHA-256 thuần (quá nhanh → dễ brute-force bằng GPU).

### Vì sao SHA256 không đủ?
SHA256 thiết kế để **nhanh** → GPU có thể tính 10 tỷ hash/giây → brute-force password yếu trong vài giây.

### Hash function tốt cho password (slow hash):

#### bcrypt
- Có **salt tự động** (random per password).
- Có **cost factor** (work factor) → có thể tăng theo thời gian khi hardware mạnh hơn.
- Salt + cost embedded trong output.

```typescript
const hash = await bcrypt.hash('password', 12); // cost = 12
// $2b$12$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy
const match = await bcrypt.compare('password', hash);
```

#### argon2 (mới hơn, recommended bởi OWASP):
- Winner of Password Hashing Competition 2015.
- Có 3 variant: argon2d, argon2i, **argon2id** (kết hợp, recommended).
- Tunable memory, time, parallelism.

#### scrypt:
- Memory-hard → khó dùng ASIC.

### Salt và Pepper:
- **Salt:** Random string thêm vào password trước khi hash → mỗi user có salt khác → cùng password ra hash khác → bảo vệ rainbow table attack.
- **Pepper:** Secret key thêm vào (giống salt), nhưng **lưu ở server riêng** (env var, KMS) → nếu DB bị leak, attacker không hash được.

---

## 4.10. HTTPS, TLS handshake?

**Câu hỏi:** HTTPS hoạt động thế nào? Mô tả TLS handshake.

**Trả lời:**

**HTTPS = HTTP over TLS (TLS = Transport Layer Security).**

### Mục đích:
1. **Confidentiality** — data được mã hóa, sniff không đọc được.
2. **Integrity** — data không bị sửa giữa đường.
3. **Authentication** — đảm bảo bạn đang nói chuyện với server đúng.

### TLS 1.2 Handshake (đơn giản hóa):

```
Client                                          Server
  │                                                │
  │  1. ClientHello                                │
  │  - TLS version                                 │
  │  - Cipher suites support                       │
  │  - Random number                               │
  ├───────────────────────────────────────────────>│
  │                                                │
  │                          2. ServerHello        │
  │                          - Chosen cipher       │
  │                          - Random number       │
  │                          - Certificate         │
  │                            (chứa public key)   │
  │<───────────────────────────────────────────────┤
  │                                                │
  │  3. Verify certificate                         │
  │     (check CA, expiration, hostname)           │
  │                                                │
  │  4. ClientKeyExchange                          │
  │     - Tạo Pre-master Secret                    │
  │     - Mã hóa bằng public key                   │
  ├───────────────────────────────────────────────>│
  │                                                │
  │  Cả 2 bên dùng                                 │
  │  (client_random + server_random + pre_master)  │
  │  → tạo session key (symmetric)                 │
  │                                                │
  │  5. ChangeCipherSpec + Finished (mã hóa)       │
  ├───────────────────────────────────────────────>│
  │                                                │
  │             6. ChangeCipherSpec + Finished     │
  │<───────────────────────────────────────────────┤
  │                                                │
  │  7. Trao đổi data với session key              │
  │<──────────────────────────────────────────────>│
```

### Vì sao dùng symmetric key sau khi handshake?
- Symmetric (AES) **nhanh hơn** asymmetric (RSA) 1000x.
- Asymmetric chỉ dùng để **trao đổi symmetric key**.

### TLS 1.3 (mới):
- **1-RTT handshake** (giảm từ 2-RTT của TLS 1.2).
- **0-RTT resume** (resume connection trước đó không cần handshake).
- Loại bỏ cipher suite yếu.
- Forward secrecy mặc định.

### Certificate Authority (CA):
- CA (Let's Encrypt, DigiCert) chứng nhận domain.
- Browser tin tưởng các root CA pre-installed.

---

## 4.11. CORS là gì?

**Câu hỏi:** **(Câu hỏi rất phổ biến)** CORS là gì? Vì sao lại bị lỗi CORS?

**Trả lời:**

**CORS (Cross-Origin Resource Sharing)** là cơ chế của browser cho phép server **opt-in** cho phép trang web ở domain khác gọi tới.

### Same-Origin Policy:
Mặc định, browser **chặn** JS gọi tới domain khác (khác về protocol, domain, hoặc port). Đây là feature bảo mật.

**Origin = scheme + host + port:**
- `https://example.com` ≠ `http://example.com` (khác scheme).
- `https://api.example.com` ≠ `https://example.com` (khác subdomain).
- `https://example.com:443` ≠ `https://example.com:8080` (khác port).

### Khi nào trigger CORS?
- Frontend ở `https://app.com` gọi API ở `https://api.com`.
- Browser sẽ gửi request kèm header `Origin: https://app.com`.
- Server **phải** response header `Access-Control-Allow-Origin` cho phép.

### Simple Request (không trigger preflight):
- Method là GET, POST, HEAD.
- Content-Type là `application/x-www-form-urlencoded`, `multipart/form-data`, `text/plain`.
- Không có custom header.

### Preflight Request:
Khi request **không simple**, browser gửi **OPTIONS** trước để hỏi:

```
OPTIONS /api/users
Origin: https://app.com
Access-Control-Request-Method: POST
Access-Control-Request-Headers: Authorization, Content-Type
```

Server trả:
```
Access-Control-Allow-Origin: https://app.com
Access-Control-Allow-Methods: GET, POST, PUT, DELETE
Access-Control-Allow-Headers: Authorization, Content-Type
Access-Control-Allow-Credentials: true
Access-Control-Max-Age: 86400
```

Nếu OK → browser mới gửi request thật.

### Setup CORS trong NestJS:
```typescript
app.enableCors({
  origin: ['https://app.com', 'https://admin.app.com'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true, // cho phép gửi cookie
});
```

### Lưu ý:
- CORS là **bảo vệ của browser, không phải của server**.
- `curl`, Postman không bị CORS chặn.
- `Access-Control-Allow-Origin: *` không dùng được với `credentials: true`.

---

## 4.12. CSRF là gì?

**Câu hỏi:** CSRF là gì? Cách phòng?

**Trả lời:**

**CSRF (Cross-Site Request Forgery)** là tấn công lừa user thực hiện hành động không mong muốn trên trang đã login.

### Ví dụ tấn công:
1. User đã login `bank.com`, cookie session lưu trong browser.
2. User vào trang độc `evil.com`.
3. Evil.com chứa form ẩn:
```html
<form action="https://bank.com/transfer" method="POST">
  <input name="to" value="hacker" />
  <input name="amount" value="1000000" />
</form>
<script>document.forms[0].submit()</script>
```
4. Form submit → browser **tự gửi cookie** → bank.com xử lý lệnh chuyển tiền.

### Phòng tránh:

#### 1. CSRF Token (Synchronizer Token):
- Server tạo token ngẫu nhiên cho mỗi session.
- Embed vào form: `<input name="_csrf" value="random-token" />`.
- Request gửi kèm token → server verify.
- `evil.com` không đoán được token.

#### 2. SameSite Cookie:
```
Set-Cookie: sessionId=xxx; SameSite=Strict
```
- **Strict:** cookie không gửi cross-site.
- **Lax:** cookie gửi với GET cross-site (default mới).
- **None:** cookie luôn gửi (cần `Secure`).

#### 3. Custom Header:
- JWT trong header `Authorization` → form HTML không thể set header tùy ý → tự miễn nhiễm CSRF.
- Đây là lý do API dùng JWT phổ biến.

#### 4. Double Submit Cookie:
- Cookie chứa token.
- Header cũng chứa token.
- Server check chúng khớp.

---

## 4.13. XSS là gì?

**Câu hỏi:** XSS là gì? Có những loại nào? Cách phòng?

**Trả lời:**

**XSS (Cross-Site Scripting)** là tấn công chèn script độc vào trang web để chạy trong browser nạn nhân.

### 3 loại:

#### 1. Reflected XSS:
- Script trong URL/form, server reflect lại.
```
https://site.com/search?q=<script>steal()</script>
```
Nếu server render `q` không escape → script chạy.

#### 2. Stored XSS:
- Script lưu trong DB, hiển thị cho mọi user.
- Vd: comment có `<script>...</script>` → mọi người đọc trang đều bị.

#### 3. DOM-based XSS:
- Lỗi ở JS phía client.
```javascript
document.getElementById('content').innerHTML = location.hash;
// URL: /#<img src=x onerror="steal()">
```

### Hậu quả:
- Đánh cắp cookie/token.
- Keylog.
- Redirect đến trang phishing.
- Thay đổi UI.

### Cách phòng:

#### 1. Escape output:
- HTML escape khi render data: `<` → `&lt;`, `>` → `&gt;`, `"` → `&quot;`.
- React, Vue, Angular tự escape mặc định.

#### 2. CSP (Content Security Policy):
Header `Content-Security-Policy` giới hạn source script.
```
Content-Security-Policy: default-src 'self'; script-src 'self' https://cdn.example.com
```

#### 3. httpOnly cookie:
- Cookie httpOnly → JS không đọc được → script không steal được session.

#### 4. Sanitize input:
- Dùng library `DOMPurify` để clean HTML do user nhập (vd: rich text).

#### 5. Validate input:
- Allow-list rules thay vì block-list.

### Trong NestJS:
```bash
npm install helmet xss-clean
```
```typescript
app.use(helmet());
app.use(xssClean()); // sanitize body, query, params
```

---

## 4.14. SQL Injection?

**Câu hỏi:** SQL Injection là gì? Cách phòng?

**Trả lời:**

**SQL Injection** là tấn công chèn SQL độc vào input để thao tác DB.

### Ví dụ:
```typescript
// ❌ KHÔNG BAO GIỜ làm thế này
const query = `SELECT * FROM users WHERE email = '${email}' AND password = '${password}'`;

// Attacker nhập email: admin@example.com'--
// Query trở thành:
// SELECT * FROM users WHERE email = 'admin@example.com'--' AND password = '...'
// → comment phần sau, bypass password
```

### Cách phòng:

#### 1. Prepared Statement (parameterized query):
```typescript
// ✅ Đúng
const user = await db.query(
  'SELECT * FROM users WHERE email = ? AND password = ?',
  [email, password]
);
```
DB xử lý `email`, `password` như **data**, không phải code.

#### 2. ORM:
```typescript
const user = await userRepo.findOne({ where: { email, password } });
```
ORM tự dùng prepared statement.

#### 3. Stored Procedure:
Tương đối an toàn nếu không dùng dynamic SQL trong procedure.

#### 4. Validation:
- Validate kiểu (vd: id phải là số).
- Whitelist (vd: column name chỉ trong danh sách cho phép).

#### 5. Least privilege:
- DB user chỉ có quyền cần thiết (vd: app user không có DROP, GRANT).

#### 6. Tránh dynamic SQL:
- Nếu phải dùng (vd: dynamic column trong ORDER BY), whitelist tên column.

---

## 4.15. Rate Limiting?

**Câu hỏi:** Rate limit là gì? Có những thuật toán nào?

**Trả lời:**

**Rate limiting** giới hạn số request mỗi user/IP có thể gửi trong khoảng thời gian → chống abuse, brute-force, DDoS.

### Thuật toán:

#### 1. Fixed Window:
- Đếm số request trong cửa sổ thời gian cố định (vd: 100 req/phút).
- **Đơn giản** nhưng có "burst" ở biên cửa sổ.

```
Window 12:00-12:01: max 100
Window 12:01-12:02: max 100
→ 100 req lúc 12:00:59 + 100 req lúc 12:01:00 = 200 req trong 1 giây!
```

#### 2. Sliding Window Log:
- Lưu timestamp mỗi request.
- Đếm số request trong cửa sổ trượt.
- **Chính xác** nhưng tốn memory.

#### 3. Sliding Window Counter:
- Hybrid: chia thành nhiều sub-window nhỏ, weighted average.

#### 4. Token Bucket:
- Bucket có capacity N token, refill R token/giây.
- Mỗi request lấy 1 token.
- Hết token → reject.
- Cho phép **burst** trong giới hạn.

```
Bucket capacity: 100
Refill rate: 10/giây

Lúc 12:00 — bucket full (100 token).
User gửi 100 req trong 1 giây → OK (dùng hết token).
Sau đó max 10 req/giây.
```

#### 5. Leaky Bucket:
- Queue (FIFO) với leak rate cố định.
- Request đi vào, **xử lý** với rate cố định.
- Smooth out traffic.

### Implementation với Redis:

#### Fixed Window:
```typescript
async function isAllowed(userId: string): Promise<boolean> {
  const key = `rate:${userId}:${Math.floor(Date.now() / 60000)}`;
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, 60);
  return count <= 100;
}
```

#### Token Bucket:
```lua
-- Lua script chạy atomically trong Redis
local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local refill_rate = tonumber(ARGV[2])
local now = tonumber(ARGV[3])

local data = redis.call('hmget', key, 'tokens', 'last_refill')
local tokens = tonumber(data[1]) or capacity
local last_refill = tonumber(data[2]) or now

-- Refill
local elapsed = now - last_refill
tokens = math.min(capacity, tokens + elapsed * refill_rate)

if tokens >= 1 then
  tokens = tokens - 1
  redis.call('hmset', key, 'tokens', tokens, 'last_refill', now)
  return 1
else
  return 0
end
```

### Trong NestJS:
```bash
npm install @nestjs/throttler
```
```typescript
@Module({
  imports: [
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 100,
    }]),
  ],
})
```

### Rate limit theo gì?
- IP — đơn giản, nhưng NAT/CGNAT làm nhiều user chung 1 IP.
- User ID — cần login.
- API key — cho B2B.
- Combination — phổ biến nhất.

---

## 4.16. 2FA / MFA?

**Câu hỏi:** 2FA là gì? Có những phương thức nào?

**Trả lời:**

**2FA (Two-Factor Authentication)** = xác thực bằng 2 yếu tố khác loại:
1. Something you **know** (password).
2. Something you **have** (phone, token device).
3. Something you **are** (vân tay, khuôn mặt).

### Phương thức:

#### 1. SMS OTP:
- Gửi mã 6 số qua SMS.
- **Yếu** — SIM swap attack, SS7 vulnerability.

#### 2. Email OTP:
- Tương tự SMS, qua email.

#### 3. TOTP (Time-based One-Time Password):
- App tạo mã 6 số đổi mỗi 30 giây (Google Authenticator, Authy).
- Dựa trên shared secret + thời gian (RFC 6238).
- **An toàn**, offline.

```typescript
import * as speakeasy from 'speakeasy';

// Setup:
const secret = speakeasy.generateSecret({ name: 'MyApp' });
// secret.base32 → lưu DB
// secret.otpauth_url → render QR code

// Verify:
const verified = speakeasy.totp.verify({
  secret: user.totpSecret,
  encoding: 'base32',
  token: userInputToken,
  window: 1, // chấp nhận sai lệch 30s
});
```

#### 4. Push notification:
- App gửi push → user confirm trên thiết bị.
- An toàn, UX tốt (Google Prompt).

#### 5. Hardware token (U2F, FIDO2):
- USB key (Yubikey).
- An toàn nhất, miễn nhiễm phishing.

#### 6. Biometric:
- Face ID, Touch ID — thực ra là local authentication trên device.

### Backup code:
Khi setup 2FA, sinh ra 10 backup code → user lưu offline để dùng khi mất thiết bị.

---


# PHẦN 5: DATABASE

## 5.1. SQL vs NoSQL?

**Câu hỏi:** Khi nào dùng SQL, khi nào dùng NoSQL?

**Trả lời:**

### SQL (Relational):
- MySQL, PostgreSQL, SQL Server, Oracle.
- Schema cứng (bảng + cột rõ).
- ACID đầy đủ.
- JOIN giữa bảng.

### NoSQL (Non-relational):
4 loại chính:
1. **Document:** MongoDB, CouchDB — lưu JSON-like document.
2. **Key-Value:** Redis, DynamoDB — đơn giản, nhanh.
3. **Column-family:** Cassandra, HBase — tối ưu cho ghi nhiều, query theo column.
4. **Graph:** Neo4j, ArangoDB — quan hệ phức tạp.

### So sánh:

| Tính năng | SQL | NoSQL |
|----------|-----|-------|
| Schema | Cứng | Linh hoạt |
| Quan hệ | Mạnh (JOIN) | Yếu |
| ACID | Đầy đủ | Một phần |
| Scale | Vertical (chính), horizontal (khó) | Horizontal (dễ) |
| Use case | Banking, ERP, e-commerce core | Logging, real-time, big data |

### Khi nào chọn SQL?
- Data có cấu trúc rõ, ít thay đổi schema.
- Cần transaction phức tạp (banking, payment).
- Quan hệ phức tạp giữa các entity.

### Khi nào chọn NoSQL?
- Schema thay đổi nhiều, không xác định.
- Volume cực lớn, cần scale ngang.
- Data đơn giản, không cần JOIN.
- Real-time, low-latency (Redis).

### Trong project Sacred Dragon Warriors:
- **MySQL/PostgreSQL** cho transactional (user, order, payment).
- **MongoDB** cho logging (event log, audit log).
- **Redis** cho caching, locking, real-time state.

---

## 5.2. ACID là gì?

**Câu hỏi:** **(Phải nhớ)** ACID là gì? Giải thích từng chữ.

**Trả lời:**

ACID là 4 thuộc tính của transaction.

### A — Atomicity (Tính nguyên tử)
**"Tất cả hoặc không gì cả."** Transaction phải hoàn thành toàn bộ, nếu một step fail → rollback hết.

Ví dụ: Chuyển 100k từ A sang B = trừ A 100k + cộng B 100k. Nếu trừ A xong rồi crash → phải rollback (trả lại A).

### C — Consistency (Tính nhất quán)
**Sau transaction, DB phải ở trạng thái hợp lệ.** Tuân thủ mọi constraint (foreign key, unique, check).

Ví dụ: Không thể tạo order với `userId` không tồn tại nếu có FK constraint.

### I — Isolation (Tính cô lập)
**Transaction chạy đồng thời nhưng kết quả như chạy tuần tự.** Tránh đọc data dirty từ transaction khác.

C� nhiều **isolation level** (xem câu sau).

### D — Durability (Tính bền vững)
**Khi commit xong, data được lưu vĩnh viễn**, kể cả mất điện.

Đảm bảo bằng: write-ahead log (WAL), fsync xuống disk.

---

## 5.3. 4 Isolation Levels?

**Câu hỏi:** Có những isolation level nào? Mỗi level prevent vấn đề gì?

**Trả lời:**

### 3 vấn đề concurrent transaction gây ra:

#### 1. Dirty Read:
T1 đọc data **chưa commit** từ T2. Nếu T2 rollback → T1 đọc data không tồn tại.

#### 2. Non-repeatable Read:
T1 đọc data 2 lần, lần 2 khác lần 1 (do T2 update giữa chừng).

#### 3. Phantom Read:
T1 query với điều kiện 2 lần, lần 2 có row mới (do T2 insert giữa chừng).

### 4 Isolation Level (SQL standard):

| Level | Dirty Read | Non-repeatable | Phantom |
|-------|-----------|---------------|---------|
| **Read Uncommitted** | ❌ | ❌ | ❌ |
| **Read Committed** | ✅ Prevent | ❌ | ❌ |
| **Repeatable Read** | ✅ | ✅ Prevent | ❌ |
| **Serializable** | ✅ | ✅ | ✅ Prevent |

(✅ = Prevent)

### Trade-off:
- Level càng cao → an toàn càng cao → performance càng thấp (lock nhiều hơn).

### Default:
- MySQL InnoDB: **Repeatable Read**.
- PostgreSQL: **Read Committed**.
- Oracle, SQL Server: **Read Committed**.

### Set isolation level:
```sql
SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;
BEGIN;
-- ...
COMMIT;
```

### MVCC (Multi-Version Concurrency Control):
- PostgreSQL & MySQL InnoDB dùng MVCC → đọc không block ghi.
- Mỗi transaction thấy "snapshot" của DB tại thời điểm bắt đầu.

---

## 5.4. Index — B-Tree?

**Câu hỏi:** **(Cực kỳ phổ biến)** Index hoạt động thế nào? B-Tree là gì?

**Trả lời:**

### Vì sao cần index?
- Không có index: query phải **full table scan** (đọc hết bảng) → O(N).
- Có index: lookup nhanh → O(log N).

**Tương tự danh bạ:** Tìm tên trong danh bạ sắp xếp A-Z (index) nhanh hơn lật từng trang (full scan).

### B-Tree Index (mặc định ở MySQL InnoDB, PostgreSQL):

**B-Tree là cấu trúc cây cân bằng**, mỗi node chứa nhiều key, sắp xếp tăng dần.

```
                [50]
              /      \
        [20, 35]    [70, 85]
        /  |  \      / |  \
      [...][...][...][...][...]
```

**Search:**
- Đi từ root.
- Tại mỗi node, so sánh key → đi xuống đúng nhánh.
- Độ sâu O(log N) → 1 triệu row chỉ cần 3-4 level.

**Tốt cho:**
- Equality: `WHERE id = 5`.
- Range: `WHERE age BETWEEN 18 AND 30`.
- Sorted: `ORDER BY name`.
- Prefix match: `WHERE name LIKE 'Đ%'`.

**Không tốt cho:**
- `WHERE name LIKE '%ng'` (suffix match) — không dùng index.
- `WHERE UPPER(name) = 'DANG'` — function trên column → invalidate index.

### B+ Tree (variant của B-Tree):
- Data chỉ ở **leaf node**.
- Leaf node nối với nhau (linked list) → range scan rất nhanh.
- Là cái MySQL InnoDB thực sự dùng.

---

## 5.5. Clustered vs Non-clustered Index?

**Câu hỏi:** Clustered và non-clustered index khác nhau ra sao?

**Trả lời:**

### Clustered Index:
- **Sắp xếp data vật lý** trên disk theo index này.
- **Mỗi bảng chỉ có 1** clustered index.
- Trong MySQL InnoDB: **PRIMARY KEY = clustered index**.
- Leaf node của B-Tree chứa **toàn bộ row**.

### Non-clustered Index (Secondary Index):
- **Không sắp xếp data vật lý**.
- Mỗi bảng có **nhiều** non-clustered index.
- Leaf node chứa **giá trị index + pointer/PK** đến row.

### Trong InnoDB:
- Secondary index lưu PK của row.
- Query với secondary index → lookup PK → tìm row qua clustered index → **2 lần lookup**.

**Tối ưu:** Covering index — query chỉ cần data trong index → không cần lookup thêm.

```sql
SELECT name, age FROM users WHERE name = 'Đăng';
-- Nếu có index (name, age) → không cần đọc row.
```

---

## 5.6. Composite Index?

**Câu hỏi:** **(Hỏi xoáy)** Có composite index `(a, b, c)`. Query nào dùng được index?

**Trả lời:**

### Composite Index = nhiều column trong 1 index.

```sql
CREATE INDEX idx_abc ON users(a, b, c);
```

### Leftmost Prefix Rule:
Index dùng được khi query có **các column đầu của index theo thứ tự**.

| Query | Dùng index? |
|-------|------------|
| `WHERE a = ?` | ✅ |
| `WHERE a = ? AND b = ?` | ✅ |
| `WHERE a = ? AND b = ? AND c = ?` | ✅ |
| `WHERE b = ?` | ❌ |
| `WHERE c = ?` | ❌ |
| `WHERE a = ? AND c = ?` | ✅ một phần (chỉ dùng a) |
| `WHERE b = ? AND c = ?` | ❌ |
| `WHERE a > ? AND b = ?` | ✅ (a), nhưng b không dùng được hiệu quả vì a dùng range |

### Quy tắc thiết kế:
- Column **equality trước, range sau**.
- Column **cardinality cao trước** (giá trị đa dạng).
- Order theo **frequency trong WHERE**.

### Ví dụ:
```sql
-- Query phổ biến:
SELECT * FROM orders WHERE user_id = ? AND status = ? ORDER BY created_at DESC;

-- Tạo index:
CREATE INDEX idx ON orders(user_id, status, created_at);
```

---

## 5.7. Khi nào index làm chậm thay vì làm nhanh?

**Câu hỏi:** Index có nhược điểm gì?

**Trả lời:**

### Index làm chậm khi:

#### 1. INSERT/UPDATE/DELETE:
- Mỗi lần ghi → phải update index → tốn IO.
- Bảng có 10 index → 1 INSERT phải ghi 11 chỗ.

#### 2. Tốn disk:
- Index chiếm dung lượng (đôi khi gấp 2-3 lần data).

#### 3. Index không phù hợp:
- Column có cardinality thấp (vd: gender M/F) → index ít giá trị (full scan có khi nhanh hơn).
- Bảng nhỏ (vài trăm row) → full scan nhanh hơn lookup index.

#### 4. Query optimizer chọn sai:
- Đôi khi DB chọn nhầm index → query chậm hơn.
- Dùng `FORCE INDEX` để override.

#### 5. Function trên column:
```sql
WHERE YEAR(created_at) = 2024  -- không dùng index
WHERE created_at >= '2024-01-01' AND created_at < '2025-01-01'  -- dùng index
```

#### 6. Implicit type conversion:
```sql
-- Cột phone là VARCHAR
WHERE phone = 0901234567  -- không dùng index (convert)
WHERE phone = '0901234567'  -- dùng index
```

### Khi nào tạo index?
- Cột thường dùng trong WHERE, JOIN, ORDER BY.
- Cardinality cao.
- Bảng lớn.

### Khi nào KHÔNG tạo:
- Bảng nhỏ.
- Cột ít dùng trong filter.
- Cột thay đổi liên tục (vd: counter).
- Đã có index khác cover.

---

## 5.8. EXPLAIN — Phân tích query?

**Câu hỏi:** Em đã dùng EXPLAIN bao giờ chưa? Đọc thế nào?

**Trả lời:**

`EXPLAIN` cho biết **DB thực thi query thế nào**.

```sql
EXPLAIN SELECT * FROM orders WHERE user_id = 5;
```

### Các field quan trọng (MySQL):

| Field | Ý nghĩa |
|-------|---------|
| `id` | Số thứ tự (subquery có id khác) |
| `select_type` | SIMPLE, PRIMARY, SUBQUERY,... |
| `table` | Tên bảng |
| `type` | **Quan trọng nhất** — kiểu truy cập |
| `possible_keys` | Index có thể dùng |
| `key` | Index thực sự dùng |
| `key_len` | Độ dài index dùng |
| `ref` | Column so sánh với index |
| `rows` | Ước tính số row phải đọc |
| `Extra` | Thông tin thêm |

### `type` từ tốt → tệ:
1. `system` / `const` — 1 row, instant.
2. `eq_ref` — JOIN với PK/unique index, 1 row.
3. `ref` — JOIN với non-unique index.
4. `range` — range scan (BETWEEN, >, <).
5. `index` — full index scan.
6. `ALL` — **full table scan** ❌ → cần index!

### Extra cần chú ý:
- `Using index` — covering index ✅.
- `Using where` — filter sau khi đọc.
- `Using filesort` — phải sort thêm ❌.
- `Using temporary` — tạo temp table ❌.

### Ví dụ:
```
+----+-------------+--------+------+---------------+------+---------+------+--------+-------+
| id | select_type | table  | type | possible_keys | key  | key_len | ref  | rows   | Extra |
+----+-------------+--------+------+---------------+------+---------+------+--------+-------+
|  1 | SIMPLE      | orders | ALL  | NULL          | NULL | NULL    | NULL | 100000 |       |
+----+-------------+--------+------+---------------+------+---------+------+--------+-------+
```
→ Full scan 100,000 row. Cần index `user_id`.

```sql
CREATE INDEX idx_user ON orders(user_id);

EXPLAIN SELECT * FROM orders WHERE user_id = 5;
+----+-------------+--------+------+---------------+----------+---------+-------+------+-------+
| id | select_type | table  | type | possible_keys | key      | key_len | ref   | rows | Extra |
+----+-------------+--------+------+---------------+----------+---------+-------+------+-------+
|  1 | SIMPLE      | orders | ref  | idx_user      | idx_user | 4       | const |   10 |       |
+----+-------------+--------+------+---------------+----------+---------+-------+------+-------+
```
→ Đọc 10 row qua index. 🎉

---

## 5.9. N+1 Query Problem?

**Câu hỏi:** N+1 problem là gì? Cách fix?

**Trả lời:**

### N+1 là gì?
**Lấy N user → mỗi user lại query orders → tổng cộng 1 + N query.**

```typescript
const users = await userRepo.find();  // 1 query
for (const user of users) {
  user.orders = await orderRepo.find({ where: { userId: user.id } }); // N query
}
```

Với 1000 user → **1001 query** → chậm khủng khiếp.

### Cách fix:

#### 1. JOIN (eager loading):
```typescript
const users = await userRepo.find({ relations: ['orders'] });
// → 1 query với JOIN
```

#### 2. IN query (batch loading):
```typescript
const users = await userRepo.find();
const userIds = users.map(u => u.id);
const orders = await orderRepo.find({ where: { userId: In(userIds) } });
// Map orders về user
```

#### 3. DataLoader pattern (GraphQL):
- Gom nhiều request trong 1 tick → 1 query batch.

### Trong TypeORM:
```typescript
// ❌ Bad
@OneToMany(() => Order, order => order.user)
orders: Order[];

const user = await userRepo.findOne(1);
console.log(user.orders); // không có (lazy)

// ✅ Eager
const user = await userRepo.findOne({
  where: { id: 1 },
  relations: ['orders'],
});
```

---

## 5.10. Transaction — BEGIN, COMMIT, ROLLBACK?

**Câu hỏi:** Khi nào dùng transaction?

**Trả lời:**

### Transaction = nhóm các SQL chạy "tất cả hoặc không gì".

```sql
BEGIN;
UPDATE accounts SET balance = balance - 100 WHERE id = 1;
UPDATE accounts SET balance = balance + 100 WHERE id = 2;
COMMIT;
-- hoặc ROLLBACK nếu có lỗi
```

### Trong NestJS với TypeORM:

```typescript
async transfer(fromId: number, toId: number, amount: number) {
  await this.dataSource.transaction(async (manager) => {
    await manager.decrement(Account, { id: fromId }, 'balance', amount);
    await manager.increment(Account, { id: toId }, 'balance', amount);

    if (anyError) throw new Error('Rollback!');
    // Nếu throw → rollback tự động
  });
}
```

### Khi nào dùng?
- Chuyển tiền giữa account.
- Tạo order + trừ kho + ghi log.
- Cập nhật nhiều bảng cùng lúc.

### Lưu ý:
- Transaction giữ **lock** → giữ lâu sẽ block transaction khác.
- Không nên gọi API ngoài (HTTP, email) trong transaction → có thể bị treo.

---

## 5.11. Optimistic vs Pessimistic Locking?

**Câu hỏi:** Optimistic và Pessimistic locking khác nhau ra sao?

**Trả lời:**

### Pessimistic Locking:
**"Khóa từ đầu, ai động vào phải chờ."**

```sql
BEGIN;
SELECT * FROM accounts WHERE id = 1 FOR UPDATE;
-- Row này bị lock, transaction khác phải chờ
UPDATE accounts SET balance = balance - 100 WHERE id = 1;
COMMIT;
```

**Khi nào dùng:** Conflict nhiều, hậu quả nghiêm trọng (mua vé, trừ kho).

### Optimistic Locking:
**"Cứ làm, đến lúc save mới check version."**

```typescript
// Bảng có column `version`
const account = await accountRepo.findOne(1);
// account = { id: 1, balance: 1000, version: 5 }

account.balance -= 100;

// UPDATE accounts SET balance=900, version=6 WHERE id=1 AND version=5
const result = await accountRepo.update(
  { id: 1, version: 5 },
  { balance: 900, version: 6 }
);

if (result.affected === 0) {
  // version đã đổi → ai đó update trước → retry
  throw new Error('Conflict, retry');
}
```

**Khi nào dùng:** Conflict ít, không muốn block.

### So sánh:

| Tính năng | Pessimistic | Optimistic |
|----------|------------|-----------|
| Lock | Có | Không |
| Performance | Chậm khi nhiều conflict | Tốt khi ít conflict |
| Deadlock | Có thể | Không |
| Retry | Không cần | Cần |

### Trong project của em:
- **Mua item bằng Lua script trong Redis** (atomic) → giống pessimistic.
- **Update user profile** → có thể dùng optimistic.

---

## 5.12. Normalization vs Denormalization?

**Câu hỏi:** Normalization là gì? Khi nào denormalize?

**Trả lời:**

### Normalization:
**Tổ chức data tránh trùng lặp**, theo các Normal Form (1NF, 2NF, 3NF, BCNF).

- **1NF:** Mỗi cell chỉ chứa 1 giá trị (atomic).
- **2NF:** 1NF + non-key column phụ thuộc toàn bộ PK.
- **3NF:** 2NF + non-key column không phụ thuộc lẫn nhau (transitive).
- **BCNF:** Stricter 3NF.

**Ví dụ chưa normalize:**
```
orders: id, customer_name, customer_phone, customer_address, product_name, ...
```
Khi customer đổi địa chỉ → phải update mọi order. Trùng lặp data.

**Sau normalize:**
```
customers: id, name, phone, address
orders: id, customer_id, product_id
products: id, name, price
```

**Ưu:**
- Không trùng lặp.
- Update dễ.
- Tiết kiệm dung lượng.

**Nhược:**
- JOIN nhiều → query chậm.

### Denormalization:
**Cố tình lưu trùng để tăng tốc query**.

**Ví dụ:**
- Bảng `posts` lưu thêm `author_name` (dù đã có `author_id`).
- Bảng `orders` lưu thêm `total_amount` (dù tính được từ items).

**Khi nào denormalize?**
- Query rất nhiều, write ít.
- Performance critical.
- Đã optimize ở mức normalize không đủ.

### Trong project:
- Bảng `orders` lưu `total_price`, `shipping_address` snapshot (vì user có thể đổi address sau, nhưng order phải giữ original).

---

## 5.13. SQL JOINs?

**Câu hỏi:** Em biết những loại JOIN nào?

**Trả lời:**

### 1. INNER JOIN:
Lấy row **có ở cả 2 bảng**.

```sql
SELECT u.name, o.total FROM users u
INNER JOIN orders o ON u.id = o.user_id;
```

### 2. LEFT (OUTER) JOIN:
Lấy **tất cả từ bảng trái**, match thì lấy phải, không match thì NULL.

```sql
SELECT u.name, o.total FROM users u
LEFT JOIN orders o ON u.id = o.user_id;
-- User không có order vẫn xuất hiện, o.total = NULL
```

### 3. RIGHT (OUTER) JOIN:
Ngược lại LEFT JOIN. Ít dùng (đảo bảng dùng LEFT JOIN cũng được).

### 4. FULL OUTER JOIN:
Lấy tất cả từ cả 2 bảng. (MySQL không có sẵn, dùng UNION.)

### 5. CROSS JOIN:
Cartesian product. Mọi cặp (a, b).

### 6. SELF JOIN:
JOIN bảng với chính nó (vd: tìm employee và manager cùng bảng).

```sql
SELECT e.name AS employee, m.name AS manager
FROM employees e
LEFT JOIN employees m ON e.manager_id = m.id;
```

### Minh họa Venn:

```
A INNER JOIN B:    ╱─A─╲╳╱─B─╲
                       ╳
A LEFT JOIN B:     ╱─A─╲╳╱─B─╲
                   █████╳
A RIGHT JOIN B:    ╱─A─╲╳╱─B─╲
                       ╳█████
A FULL OUTER:      ████╳█████
```

---

## 5.14. ORM — ưu nhược điểm?

**Câu hỏi:** ORM là gì? Ưu nhược?

**Trả lời:**

**ORM (Object-Relational Mapping)** — map table → class, row → object.

### Phổ biến:
- **Node.js:** TypeORM, Prisma, Sequelize, MikroORM.
- **Python:** SQLAlchemy, Django ORM.
- **Java:** Hibernate, JPA.

### Ưu:
- **Productivity:** Không phải viết SQL.
- **Type safety:** Với TypeScript, autocomplete tốt.
- **Migration:** Tự generate.
- **Đổi DB dễ** (về lý thuyết).

### Nhược:
- **Black-box:** Sinh SQL không tối ưu.
- **N+1 problem** dễ gặp.
- **Khó debug** query phức tạp.
- **Learning curve.**

### TypeORM vs Prisma:

| Tính năng | TypeORM | Prisma |
|----------|---------|--------|
| Type safety | Tốt | Rất tốt (generate type) |
| Query builder | Active record + Repository | Custom DSL |
| Migration | TypeScript-based | DSL-based |
| Performance | Tốt | Tốt |
| Maturity | Lâu hơn | Mới hơn |

### Best practice:
- Dùng ORM cho 80% case đơn giản.
- Viết raw SQL cho 20% query phức tạp/critical performance.

---

## 5.15. Database Sharding?

**Câu hỏi:** Sharding là gì? Có những strategy nào?

**Trả lời:**

**Sharding** = chia DB thành nhiều shard, mỗi shard chứa một phần data.

### Khi nào cần?
- DB lớn quá (TB).
- Read/write rất nhiều, vertical scale không đủ.

### Strategy:

#### 1. Range-based:
- Chia theo range (vd: user id 1-1M shard 1, 1M-2M shard 2).
- **Ưu:** Đơn giản, range query trên 1 shard.
- **Nhược:** Hot shard (shard mới luôn đông user mới).

#### 2. Hash-based:
- `shard = hash(user_id) % N`.
- **Ưu:** Phân bổ đều.
- **Nhược:** Khó range query, resharding khó.

#### 3. Geographic:
- Chia theo địa lý (user Mỹ shard 1, châu Âu shard 2).
- **Ưu:** Latency thấp (gần user).
- **Nhược:** Phức tạp với user du lịch.

#### 4. Consistent Hashing:
- Hash với ring → khi thêm/bớt shard, chỉ resharding một phần data.
- Dùng trong Cassandra, DynamoDB.

### Vấn đề khi sharding:
- **JOIN cross-shard** — rất khó.
- **Transaction cross-shard** — cần 2PC hoặc saga.
- **Resharding** — phải migrate data.
- **Unique constraint** — chỉ unique trong shard.

### Replication vs Sharding:
- **Replication:** copy data → tăng read, dự phòng.
- **Sharding:** chia data → tăng cả read và write, lưu được nhiều hơn.

---

## 5.16. Read Replica?

**Câu hỏi:** Read replica là gì? Vấn đề stale read?

**Trả lời:**

**Read replica:** copy của master DB, chỉ đọc.

```
Master (write) → replicate → Replica 1, 2, 3 (read)
```

### Lợi ích:
- Phân tải read.
- High availability (master fail → promote replica).
- Có thể chạy report nặng trên replica mà không ảnh hưởng master.

### Vấn đề: Stale Read
- Replication có **lag** (vài ms đến vài giây).
- User vừa write xong, đọc ngay → có thể chưa thấy.

**Vd:** User đổi avatar → reload trang → vẫn thấy avatar cũ vài giây.

### Cách xử lý:

#### 1. Read your own writes:
- Write xong, **đọc từ master** trong vài giây.
- Lưu timestamp last write, query master nếu < threshold.

#### 2. Sticky session:
- User vừa write → các request tiếp theo đi master.

#### 3. Synchronous replication:
- Master chờ replica confirm trước khi commit.
- Chậm hơn nhưng không có lag.
- (PostgreSQL hỗ trợ, MySQL có semi-sync.)

#### 4. Versioned read:
- Mỗi write có version → client lưu version → request đọc kèm version min.

---

## 5.17. PostgreSQL vs MySQL?

**Câu hỏi:** PostgreSQL và MySQL khác nhau ra sao? Em chọn cái nào?

**Trả lời:**

### MySQL:
- Phổ biến nhất.
- Đơn giản, dễ học.
- Tốt cho read-heavy.
- Engine InnoDB (default), MyISAM.

### PostgreSQL:
- "Most advanced open-source DB."
- Tuân thủ SQL standard kỹ hơn.
- Type system phong phú (JSON, JSONB, array, range, custom type).
- Window function, CTE mạnh.
- Tốt cho complex query, analytics.

### So sánh chi tiết:

| Tính năng | MySQL | PostgreSQL |
|----------|-------|-----------|
| Performance read | Tốt | Tốt |
| Performance write | Tốt | Rất tốt |
| JSON support | Có (JSON, không có JSONB) | Tốt hơn (JSONB indexed) |
| Full-text search | OK | Tốt hơn |
| Geospatial | Cần extension | PostGIS xịn |
| Transaction | OK | Tốt hơn (true serializable) |
| Replication | Async/Semi-sync/Group | Tốt hơn, sync mặc định có sẵn |
| Default isolation | Repeatable Read | Read Committed |

### Khi nào chọn?
- **MySQL:** App đơn giản, ecosystem rộng (WordPress, Magento).
- **PostgreSQL:** Cần feature nâng cao, query phức tạp, JSON nhiều, GIS.

### Trong project của em:
- PostgreSQL cho transactional (order, payment) — cần consistency cao.
- MySQL cho game data — đơn giản.

---

## 5.18. Connection Pool?

**Câu hỏi:** Connection pool là gì? Vì sao cần?

**Trả lời:**

**Vấn đề:** Mở connection đến DB tốn thời gian (TCP handshake + auth + setup).

### Connection Pool:
- Giữ sẵn N connection.
- Request đến → mượn 1 connection từ pool.
- Xong → trả về pool (không close).

```typescript
// TypeORM config
{
  type: 'postgres',
  poolSize: 20, // max 20 connection
  // ...
}
```

### Cần config:
- **min:** số connection luôn giữ.
- **max:** số connection tối đa.
- **idleTimeout:** đóng nếu không dùng quá lâu.
- **acquireTimeout:** timeout khi chờ connection.

### Vấn đề:
- Pool size quá lớn → DB quá tải, slow query block hết pool.
- Pool size quá nhỏ → request phải chờ.

**Quy tắc kinh nghiệm:** `pool_size ≈ core_count * 2 + disk_count`.

### Trong microservices:
- Mỗi service có pool riêng.
- N service × 20 connection = 20N → DB phải config tăng `max_connections`.

---

## 5.19. Deadlock?

**Câu hỏi:** Deadlock là gì? Có gặp chưa?

**Trả lời:**

**Deadlock:** 2 transaction giữ lock của nhau, không ai release.

```
T1: lock A → đợi B
T2: lock B → đợi A
→ chờ nhau mãi
```

### Ví dụ:
```sql
-- T1
BEGIN;
UPDATE accounts SET balance = balance - 100 WHERE id = 1; -- lock row 1
-- (T2 chạy ở đây)
UPDATE accounts SET balance = balance + 100 WHERE id = 2; -- chờ T2 release row 2
COMMIT;

-- T2 (chạy song song)
BEGIN;
UPDATE accounts SET balance = balance - 100 WHERE id = 2; -- lock row 2
UPDATE accounts SET balance = balance + 100 WHERE id = 1; -- chờ T1 release row 1
COMMIT;
```

### MySQL/PostgreSQL detect deadlock tự động, abort 1 transaction.

```
ERROR 1213 (40001): Deadlock found when trying to get lock; try restarting transaction
```

### Cách phòng:

#### 1. Luôn lock theo thứ tự nhất quán:
- Lock id nhỏ trước, id lớn sau.

#### 2. Giữ transaction ngắn:
- Lock càng ít càng tốt.

#### 3. Tránh lock nhiều bảng/row trong 1 transaction.

#### 4. Retry khi gặp deadlock:
```typescript
async function transferWithRetry(from, to, amount, maxRetry = 3) {
  for (let i = 0; i < maxRetry; i++) {
    try {
      return await transfer(from, to, amount);
    } catch (e) {
      if (e.code === 'ER_LOCK_DEADLOCK' && i < maxRetry - 1) {
        await sleep(Math.random() * 100);
        continue;
      }
      throw e;
    }
  }
}
```

---

## 5.20. MongoDB cơ bản?

**Câu hỏi:** Em biết gì về MongoDB?

**Trả lời:**

**MongoDB** là NoSQL document database.

### Khái niệm:
- **Database** chứa **collection** (như bảng).
- **Collection** chứa **document** (như row, nhưng là JSON BSON).
- **Document** không cần schema cố định.

```javascript
// Document trong collection users:
{
  _id: ObjectId("..."),
  name: "Đăng",
  age: 20,
  skills: ["NestJS", "Go"],
  address: {
    city: "Hà Nội",
    district: "Bắc Từ Liêm"
  }
}
```

### Query:
```javascript
db.users.find({ age: { $gte: 18 } });
db.users.findOne({ name: "Đăng" });
db.users.updateOne(
  { _id: ObjectId("...") },
  { $set: { age: 21 } }
);
db.users.deleteMany({ active: false });
```

### Aggregation Pipeline:
```javascript
db.orders.aggregate([
  { $match: { status: "completed" } },
  { $group: { _id: "$userId", total: { $sum: "$amount" } } },
  { $sort: { total: -1 } },
  { $limit: 10 }
]);
```

### Index:
```javascript
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ age: 1, name: -1 }); // composite
```

### Ưu:
- Schema linh hoạt → dễ thay đổi.
- Scale ngang dễ (sharding built-in).
- Query JSON-like dễ.

### Nhược:
- Không có JOIN truyền thống (có `$lookup` nhưng chậm).
- Transaction mới hỗ trợ multi-document từ 4.0.
- Tốn dung lượng (lưu key của mỗi document).

### Khi nào dùng?
- Logging (volume lớn, schema thay đổi).
- Real-time data.
- Content management (article có schema khác nhau).

---

# PHẦN 6: REDIS & CACHING

## 6.1. Redis là gì?

**Câu hỏi:** Redis là gì? Vì sao Redis nhanh đến vậy?

**Trả lời:**

**Redis (REmote DIctionary Server)** là **in-memory key-value store**, đa năng, được tạo bởi Salvatore Sanfilippo năm 2009.

C� thể dùng làm: **cache, session store, pub/sub, distributed lock, rate limiter, message queue đơn giản, real-time leaderboard, geo-spatial query**.

### Vì sao Redis nhanh?
1. **In-memory** — đọc/ghi RAM (~100ns), không đọc disk (~10ms).
2. **Single-threaded** — không có lock overhead, không context switch.
3. **Non-blocking I/O** (epoll/kqueue) cho network.
4. **Optimized data structure** — viết bằng C, chọn implementation tối ưu cho từng kiểu data.
5. **Protocol đơn giản** (RESP — text-based, dễ parse).

### Single-threaded mà vẫn nhanh:
- Một thread chính xử lý command → mọi command đều **atomic mặc định**.
- Có thread phụ cho persistence (background save), I/O threads (Redis 6+).

### Latency điển hình:
- Local: < 1ms.
- Same data center: 1-2ms.
- 100k+ ops/giây với 1 instance.

---

## 6.2. Các kiểu data trong Redis?

**Câu hỏi:** Em biết những kiểu data nào trong Redis?

**Trả lời:**

### 1. String:
Đơn giản nhất, lưu text/number/JSON/binary. Tối đa 512MB.
```bash
SET name "Đăng"
GET name
INCR counter
EXPIRE name 60
```

### 2. Hash:
Key → Map (field → value). Tốt cho object có nhiều field.
```bash
HSET user:1 name "Đăng" age 20
HGETALL user:1
HINCRBY user:1 age 1
```

### 3. List:
Linked list, push/pop hai đầu (deque).
```bash
LPUSH queue "task1"
RPUSH queue "task2"
LPOP queue
LRANGE queue 0 -1
```
Use case: queue, activity feed.

### 4. Set:
Tập hợp không thứ tự, unique.
```bash
SADD tags "nestjs" "redis"
SMEMBERS tags
SINTER tags1 tags2  # giao
```
Use case: tag, follower, unique tracking.

### 5. Sorted Set (ZSet):
Set có score, sắp xếp theo score.
```bash
ZADD leaderboard 100 "Alice" 200 "Bob"
ZREVRANGE leaderboard 0 9  # top 10
ZINCRBY leaderboard 10 "Alice"
```
Use case: leaderboard, ranking.

### 6. Bitmap:
Lưu bit trên string. Tiết kiệm memory.
```bash
SETBIT online:2024-01-01 1234 1
BITCOUNT online:2024-01-01
```
Use case: track user online, daily active user.

### 7. HyperLogLog:
Đếm unique element xấp xỉ (sai số ~0.81%), cực tiết kiệm memory (~12KB).
```bash
PFADD visitors "user1" "user2"
PFCOUNT visitors
```

### 8. Stream:
Append-only log, giống Kafka mini, có consumer group.
```bash
XADD events * action login user 123
XREAD COUNT 10 STREAMS events 0
```

### 9. Geospatial:
Tọa độ và radius search.
```bash
GEOADD locs 105.85 21.03 "HN"
GEORADIUS locs 105.85 21.03 100 km
```

---

## 6.3. Cache Strategy?

**Câu hỏi:** Em biết những chiến lược caching nào?

**Trả lời:**

### 1. Cache-Aside (Lazy Loading):
**Phổ biến nhất.** App tự quản lý cache.
```typescript
async getUser(id) {
  const cached = await redis.get(`user:${id}`);
  if (cached) return JSON.parse(cached);
  const user = await db.findUser(id);
  await redis.set(`user:${id}`, JSON.stringify(user), 'EX', 300);
  return user;
}
```
**Ưu:** Đơn giản, chỉ cache data thực dùng. **Nhược:** Miss → 3 I/O.

### 2. Read-Through:
App chỉ tương tác với cache; cache tự load từ DB. Logic load nằm trong cache layer.

### 3. Write-Through:
Mỗi write đi qua cache → cache update DB. Cache và DB luôn đồng bộ. Nhược: write chậm.

### 4. Write-Behind (Write-Back):
Write vào cache trước, async flush xuống DB. Nhanh nhưng nguy cơ mất data nếu cache chết.

### 5. Write-Around:
Write trực tiếp vào DB, không update cache. Cache load lúc đọc. Tốt cho write-heavy.

---

## 6.4. Cache Invalidation?

**Câu hỏi:** Cache invalidation vì sao khó? Strategy?

**Trả lời:**

> "There are only two hard things in CS: cache invalidation and naming things." — Phil Karlton

### Strategy:

**1. TTL:** Đơn giản nhất, cache tự expire. Nhược: stale data trong N giây.

**2. Explicit invalidation:** Khi update DB, xóa cache.
```typescript
await db.update(id, data);
await redis.del(`user:${id}`);
```
Phải nhớ xóa ở mọi chỗ update.

**3. Versioning:** Key chứa version. Đổi data → tăng version → cache cũ "miss" tự nhiên.

**4. Pub/Sub:** Service đổi data → publish event → service khác invalidate.

**5. Write-Through:** Cache và DB đồng bộ → không cần invalidate.

### Trade-off TTL ngắn vs dài:
- Ngắn → fresh, nhưng miss nhiều, tải DB.
- Dài → tải DB ít, nhưng stale.

---

## 6.5. Cache Stampede?

**Câu hỏi:** Cache stampede là gì? Cách phòng?

**Trả lời:**

### Vấn đề:
Hot key expire → 1000 request cùng miss → cùng query DB → DB sập.

### Cách phòng:

**1. Mutex (single flight):**
```typescript
async getUser(id) {
  const cached = await redis.get(`user:${id}`);
  if (cached) return JSON.parse(cached);
  const lockKey = `lock:user:${id}`;
  const lock = await redis.set(lockKey, '1', 'NX', 'EX', 5);
  if (!lock) {
    await sleep(100);
    return this.getUser(id);
  }
  try {
    const user = await db.findUser(id);
    await redis.set(`user:${id}`, JSON.stringify(user), 'EX', 300);
    return user;
  } finally {
    await redis.del(lockKey);
  }
}
```

**2. Probabilistic early refresh (XFetch):** Có xác suất refresh sớm trước expire → tránh tất cả miss cùng lúc.

**3. Background refresh:** Cron job refresh trước khi expire.

**4. Stale-while-revalidate:** Trả cache cũ + async load mới.

---

## 6.6. Persistence — RDB vs AOF?

**Câu hỏi:** Redis in-memory, restart có mất data không?

**Trả lời:**

### RDB (snapshot):
Lưu toàn bộ data ra file `.rdb` định kỳ. Cấu hình `save 900 1`.

**Ưu:** Compact, restore nhanh, tốt cho backup.
**Nhược:** Mất data từ snapshot cuối khi crash.

### AOF (append-only file):
Log mọi write command. Replay khi restart.

**fsync mode:**
- `always` — fsync mỗi command (an toàn nhất, chậm).
- `everysec` — mỗi giây (default).
- `no` — phụ thuộc OS.

**Ưu:** Mất tối đa 1 giây data.
**Nhược:** File lớn, restore chậm.

### Hybrid (Redis 4+):
File AOF bắt đầu bằng RDB snapshot + append command sau đó.

### Khuyến nghị:
- App quan trọng: AOF everysec + RDB backup hàng ngày.
- Cache thuần: tắt cả 2.

---

## 6.7. Distributed Lock với Redis?

**Câu hỏi:** Em dùng Redis làm distributed lock thế nào? Có vấn đề gì?

**Trả lời:**

### Simple lock (SETNX + TTL):
```typescript
async acquireLock(key, ttl = 5000) {
  const value = uuidv4();
  const ok = await redis.set(key, value, 'NX', 'PX', ttl);
  return ok === 'OK' ? value : null;
}

async releaseLock(key, value) {
  // Lua atomic: check-and-delete
  const script = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
    else
      return 0
    end
  `;
  await redis.eval(script, 1, key, value);
}
```

### Vì sao phải dùng UUID + Lua?
Nếu lock TTL 5s mà process A xử lý 6s → lock tự release → process B acquire. Process A xong gọi `DEL` → xóa nhầm lock của B. Lua atomic check value trước khi xóa.

### Vì sao phải có TTL?
Process crash giữ lock → deadlock vĩnh viễn. TTL đảm bảo lock tự release.

### Redlock (cho Redis cluster):
- Acquire lock trên N/2+1 master độc lập.
- Cùng key, value, TTL.
- Phải acquire xong trong thời gian << TTL.

### Tranh cãi Redlock (Kleppmann vs Antirez):

**Kleppmann phản biện:**
- Clock drift giữa node → TTL không đáng tin.
- GC pause hoặc network delay → process tưởng còn lock nhưng TTL đã hết → 2 process cùng "có lock".

**Đề xuất an toàn hơn — Fencing Token:**
- Mỗi lần lock, lấy 1 token monotonic tăng.
- Mỗi operation tới resource gửi kèm token.
- Resource từ chối token < token đã thấy.
- Cần resource hỗ trợ kiểm tra token (DB, storage layer).

### Trong thực tế:
- Lock đơn giản (chống double-submit, dedup job) → Redis SETNX đủ.
- Critical (banking, kho hàng): dùng DB native lock + fencing.
- Có thể dùng ZooKeeper, etcd thay Redis.

### Trong project của em (Sacred Dragon Warriors):
Mua item dùng **Lua script atomic** check balance → trừ tiền → thêm item, hết trong 1 Redis call → không cần distributed lock vì single Redis instance đã atomic.

---

## 6.8. Lua scripting trong Redis?

**Câu hỏi:** Em đã dùng Lua script trong Redis chưa? Vì sao dùng?

**Trả lời:**

### Vấn đề không có Lua:
Mua item:
1. `GET balance` → 1000
2. App check 1000 >= 500 ✅
3. `DECRBY balance 500`
4. `SADD items "sword"`

Giữa step 1 và 3, request khác có thể cũng đọc 1000 → 2 request đều DECRBY → balance âm.

### Với Lua:
```lua
-- KEYS[1] = balance key, KEYS[2] = items key
-- ARGV[1] = price, ARGV[2] = item name
local balance = tonumber(redis.call('GET', KEYS[1]))
if not balance or balance < tonumber(ARGV[1]) then
  return 0  -- không đủ tiền
end
redis.call('DECRBY', KEYS[1], ARGV[1])
redis.call('SADD', KEYS[2], ARGV[2])
return 1
```

```typescript
const ok = await redis.eval(
  script, 2,
  `user:${userId}:balance`, `user:${userId}:items`,
  price, itemName
);
```

### Tính chất của Lua trong Redis:
- **Atomic:** Toàn bộ script chạy trong 1 thread, không bị xen.
- **Server-side:** Giảm round-trip network.
- **Deterministic:** Replicate được sang slave/AOF.

### Lưu ý:
- Lua block toàn Redis trong khi chạy → không viết script chậm.
- Hạn chế I/O không xác định trong script.
- Dùng `EVALSHA` để cache script.

---

## 6.9. Redis Cluster vs Sentinel?

**Câu hỏi:** Redis Cluster và Sentinel khác nhau?

**Trả lời:**

### Sentinel (HA — High Availability):
- 1 master + N replica.
- Sentinel process monitor → master chết → tự promote replica thành master.
- **Không shard data** — vẫn 1 dataset trên 1 master.

### Cluster (HA + Sharding):
- Data chia thành **16384 hash slot**.
- Mỗi master phụ trách 1 dải slot.
- Mỗi master có replica.
- Client tính `CRC16(key) mod 16384` → biết slot nào → đi đúng master.

### Khi nào dùng?
- **Data nhỏ, cần HA** → Sentinel.
- **Data lớn (>50GB), cần scale ngang** → Cluster.

### Hạn chế của Cluster:
- Multi-key operation chỉ chạy được nếu các key cùng slot.
- Dùng **hash tag** `{user1}:balance` và `{user1}:items` để force cùng slot.

---

## 6.10. Pub/Sub trong Redis?

**Câu hỏi:** Redis Pub/Sub khác Stream và Message Queue khác?

**Trả lời:**

### Pub/Sub:
```bash
# Subscriber
SUBSCRIBE channel:user-events

# Publisher
PUBLISH channel:user-events "user-123-created"
```

**Đặc điểm:**
- **At-most-once** — subscriber offline thì mất message.
- **Không persist** — message không lưu lại.
- **Fan-out** — gửi cho mọi subscriber đang lắng nghe.

### Stream (Redis 5+):
- **Persist** message.
- **Consumer group** — phân chia message giữa nhiều consumer.
- **ACK** message đã xử lý.
- Có thể dùng như Kafka mini.

### So sánh:

| Tính năng | Pub/Sub | Stream | RabbitMQ/Kafka |
|----------|--------|--------|----------------|
| Persist | Không | Có | Có |
| Subscriber offline | Mất message | Có thể đọc lại | Có thể đọc lại |
| Consumer group | Không | Có | Có |
| Phù hợp | Notification | Event log nhỏ | Hệ thống lớn |

### Use case Pub/Sub:
- Invalidate cache cross-service.
- Notification real-time (tạm thời).
- Trigger refresh UI.

---

# PHẦN 7: MESSAGE QUEUE

## 7.1. Message Queue là gì? Vì sao cần?

**Câu hỏi:** Message Queue dùng để làm gì? Khi nào không dùng MQ mà gọi trực tiếp HTTP?

**Trả lời:**

**Message Queue** = trung gian giúp các service giao tiếp **bất đồng bộ** qua message.

```
Producer → [Queue] → Consumer
```

### Lợi ích:

**1. Decoupling:** Producer không cần biết consumer ở đâu, mấy consumer, có sống không.

**2. Asynchronous:** Producer gửi xong return ngay → không chờ.

**3. Buffering:** Lúc traffic burst, queue đệm message → consumer xử lý từ từ → bảo vệ DB/service downstream.

**4. Reliability:** Message persist → consumer crash, restart vẫn xử lý được.

**5. Load distribution:** Nhiều consumer chia nhau xử lý.

**6. Retry:** Xử lý lỗi → push lại queue, hoặc dead-letter queue.

### Khi nào KHÔNG dùng MQ?
- Cần response ngay (đăng nhập, lấy profile).
- Strong consistency (cần xác nhận transaction đã commit).
- Latency yêu cầu < 100ms end-to-end.

### Khi nào dùng?
- Gửi mail, SMS, notification (chậm vài giây không sao).
- Xử lý ảnh, video.
- ETL, analytics.
- Microservice giao tiếp asynchronously.
- Event sourcing.

---

## 7.2. RabbitMQ vs Kafka vs NATS?

**Câu hỏi:** RabbitMQ, Kafka, NATS khác nhau? Khi nào chọn cái nào?

**Trả lời:**

### RabbitMQ:
- **Traditional message broker**, dùng giao thức AMQP.
- Có **exchange** routing message: direct, fanout, topic, headers.
- Push model (broker push message tới consumer).
- ACK message → broker xóa.

### Kafka:
- **Distributed event streaming platform** (LinkedIn).
- Lưu message lâu dài như log (mặc định 7 ngày).
- **Pull model** (consumer pull, tự quản lý offset).
- Throughput cực cao (triệu msg/giây).
- Tốt cho event sourcing, log aggregation.

### NATS:
- **Lightweight messaging** (tốc độ).
- NATS Core: pub/sub, at-most-once.
- **NATS JetStream**: thêm persistence, at-least-once, replay.
- Cực nhanh, đơn giản, dùng được làm RPC.

### So sánh:

| Tiêu chí | RabbitMQ | Kafka | NATS |
|---------|---------|-------|------|
| Mô hình | Queue + Exchange | Log/Stream | Pub/Sub + Stream |
| Throughput | 10-50k msg/s | 100k-1M msg/s | 1M+ msg/s |
| Latency | ~ms | ~ms | < ms |
| Persist | Có (mặc định) | Có (log lâu) | Tùy (JetStream) |
| Routing phức tạp | Mạnh nhất | Topic + partition | Subject hierarchy |
| Replay | Khó | Dễ | JetStream có |
| Phù hợp | Task queue | Event sourcing, analytics | Microservices internal |

### Khi chọn?
- **RabbitMQ:** Job queue, retry phức tạp, routing đa dạng (gửi mail, xử lý ảnh).
- **Kafka:** Event sourcing, log aggregation, analytics pipeline.
- **NATS:** Microservices internal communication, real-time, latency thấp.

### Trong project của em:
- **RabbitMQ** ở Mobifos cho retry payment.
- **NATS + Protobuf** trong Sacred Dragon Warriors cho service-to-service.

---

## 7.3. At-most-once vs At-least-once vs Exactly-once?

**Câu hỏi:** **(Câu hỏi rất hay)** 3 mức delivery này khác nhau ra sao?

**Trả lời:**

### At-most-once:
- Gửi 1 lần, không retry.
- **Có thể mất message** nếu lỗi.
- Đơn giản, nhanh.
- Use case: log, metrics (mất vài cái không sao).

### At-least-once:
- Có retry → message có thể **bị duplicate**.
- Producer/Consumer phải xử lý idempotency.
- **Phổ biến nhất** trong thực tế.

### Exactly-once:
- Mỗi message xử lý đúng 1 lần.
- **Lý thuyết** thì khó (FLP impossibility, two generals problem).
- **Thực tế:** at-least-once + idempotency = "effectively exactly-once".

### Vì sao exactly-once khó?

Producer gửi msg → broker nhận → ACK lại producer. Nếu ACK mất (network):
- Producer không biết msg đã đến chưa → retry → duplicate.

Broker gửi msg → consumer xử lý → ACK lại broker. Nếu ACK mất:
- Broker tưởng consumer chưa xử lý → gửi lại → duplicate.

### Cách đạt "effectively exactly-once":

**1. Idempotent consumer:**
- Mỗi message có `messageId` unique.
- Consumer lưu `processedIds` (Redis/DB).
- Trước khi xử lý, check đã xử lý chưa.

```typescript
async handleMessage(msg) {
  const processed = await redis.set(`processed:${msg.id}`, '1', 'NX', 'EX', 86400);
  if (!processed) return;  // đã xử lý
  await doSomething(msg);
}
```

**2. Transactional outbox (cho producer):**
- Write DB và message **trong cùng transaction** (qua outbox table).
- Separate process đọc outbox push lên MQ.

**3. Kafka idempotent producer + transaction:**
- Kafka 0.11+ hỗ trợ `enable.idempotence=true` và transaction → effectively exactly-once trong Kafka.

---

## 7.4. Dead Letter Queue (DLQ)?

**Câu hỏi:** DLQ là gì? Khi nào message vào DLQ?

**Trả lời:**

**Dead Letter Queue** = queue chứa message **không xử lý được**.

### Khi nào vào DLQ?
- Consumer reject message N lần (retry hết).
- Message expire (TTL).
- Queue đầy (full → drop oldest hoặc DLQ).
- Format sai (poison message).

### Setup trong RabbitMQ:
```typescript
channel.assertQueue('orders', {
  arguments: {
    'x-dead-letter-exchange': 'dlx',
    'x-dead-letter-routing-key': 'orders.dead',
    'x-max-retries': 3,
  }
});
```

### Workflow:
1. Producer gửi msg vào `orders` queue.
2. Consumer xử lý fail → reject.
3. Retry 3 lần → vẫn fail → vào DLQ.
4. Người (hoặc system khác) xem DLQ → debug, fix, replay.

### Trong project của em (Mobifos):
- RabbitMQ retry với exponential backoff: 1s, 5s, 30s, 5m, 1h.
- Sau khi hết retry → vào DLQ.
- Có dashboard monitor DLQ → alert team xử lý.

---

## 7.5. Backpressure?

**Câu hỏi:** Backpressure là gì? Cách xử lý?

**Trả lời:**

**Backpressure** = khi producer gửi nhanh hơn consumer xử lý → queue đầy → vấn đề.

### Hậu quả:
- Queue/buffer hết memory → crash.
- Latency tăng (msg chờ trong queue lâu).
- Hệ thống không stable.

### Cách xử lý:

**1. Bounded queue + reject:** Queue có max size → đầy thì reject producer → producer biết để slow down hoặc retry sau.

**2. Throttling/Rate limiting** ở producer.

**3. Scale consumer ngang** (thêm consumer xử lý song song).

**4. Drop message không quan trọng** (sampling cho metrics).

**5. Circuit breaker** ở producer khi detect consumer chậm.

**6. Reactive Streams** (Node.js stream có built-in backpressure qua `pause()`/`resume()`).

---

## 7.6. BullMQ — Job Queue trong Node.js?

**Câu hỏi:** Em đã dùng BullMQ chưa? Khác RabbitMQ?

**Trả lời:**

**BullMQ** = job queue dựa trên Redis, dành cho Node.js (tiến hóa từ Bull).

### Setup:
```typescript
import { Queue, Worker } from 'bullmq';

const queue = new Queue('emails', { connection: { host: 'localhost' }});

await queue.add('send', { to: 'user@example.com', subject: 'Hi' });

const worker = new Worker('emails', async job => {
  if (job.name === 'send') {
    await sendEmail(job.data);
  }
}, { connection: { host: 'localhost' }});
```

### Tính năng nổi bật:
- **Delayed job** — chạy sau X giây.
- **Repeat job** — cron-like.
- **Priority queue**.
- **Rate limit** worker.
- **Retry** với backoff.
- **Concurrency** (worker chạy N job song song).

### So sánh với RabbitMQ:

| Tính năng | BullMQ | RabbitMQ |
|----------|--------|----------|
| Storage | Redis | Erlang/Mnesia |
| Ngôn ngữ | Node.js only | Đa ngôn ngữ |
| Phức tạp routing | Không | Có (exchange) |
| Job scheduling | Mạnh | Cần plugin |
| Persistence | Phụ thuộc Redis | Tốt hơn |
| Cluster | Cần Redis Cluster | Có |

### Khi nào dùng BullMQ?
- Job nội bộ Node.js (send mail, xử lý ảnh, batch).
- Cần scheduled job.
- Có sẵn Redis.

### Khi nào dùng RabbitMQ?
- Cross-language (Java, Go, Python).
- Routing phức tạp.
- Reliability cao.

---

## 7.7. Consumer Group trong Kafka?

**Câu hỏi:** Consumer group là gì?

**Trả lời:**

**Consumer group** = nhóm consumer cùng xử lý 1 topic, mỗi partition chỉ thuộc 1 consumer trong group.

```
Topic "orders" (3 partition: P0, P1, P2)

Group "billing":
  consumer-A → P0, P1
  consumer-B → P2

Group "analytics":
  consumer-C → P0, P1, P2 (1 mình)
```

### Đặc điểm:
- Trong cùng group → load chia ra.
- Khác group → mỗi group nhận **bản copy của message**.
- Số consumer > partition → consumer thừa sẽ idle.

### Offset management:
- Mỗi consumer group có offset riêng cho từng partition.
- Consumer commit offset sau khi xử lý.
- Restart → đọc tiếp từ offset commit.

### Rebalancing:
Khi thêm/bớt consumer → Kafka rebalance, gán lại partition.

---

# PHẦN 8: SYSTEM DESIGN & DISTRIBUTED SYSTEMS

## 8.1. Load Balancer là gì?

**Câu hỏi:** **(Cực kỳ phổ biến)** Load Balancer là gì? L4 vs L7?

**Trả lời:**

**Load Balancer** = thiết bị/phần mềm phân phối request đến nhiều server.

```
            ┌──────────────┐
Client → [LB]              │
            │              ▼
            ├─→ Server A (RAM 40%)
            ├─→ Server B (RAM 50%)
            └─→ Server C (RAM 30%)
```

### Lợi ích:
- **Scale ngang:** Thêm server → tăng capacity.
- **High availability:** Server chết → LB không gửi đến.
- **Fault tolerance.**
- **SSL offloading.**
- **Health check.**

### L4 (Transport) Load Balancer:
- Hoạt động ở **layer 4 (TCP/UDP)**.
- Quyết định forward dựa trên **IP, port**.
- **Nhanh, ít CPU.**
- Không hiểu HTTP → không route theo URL được.
- Ví dụ: HAProxy mode TCP, AWS NLB.

### L7 (Application) Load Balancer:
- Hoạt động ở **layer 7 (HTTP)**.
- Hiểu HTTP → route theo URL, header, cookie.
- **Linh hoạt** nhưng tốn CPU hơn.
- Ví dụ: Nginx, HAProxy mode HTTP, AWS ALB.

### Ví dụ L7 routing:
- `/api/*` → API servers.
- `/static/*` → CDN/static servers.
- `/admin/*` → admin servers.
- Cookie `version=beta` → beta servers (canary).

### Thuật toán load balancing:

**1. Round Robin:** Lần lượt server 1, 2, 3, 1, 2...

**2. Weighted Round Robin:** Server mạnh nhận trọng số cao.

**3. Least Connection:** Server đang ít connection nhất.

**4. Least Response Time:** Server response nhanh nhất.

**5. IP Hash:** `hash(client_ip) % N` → cùng client luôn vào 1 server (sticky).

**6. Random.**

### Sticky session:
- Cần khi server lưu state local (vd: session in-memory).
- Dùng cookie hoặc IP hash.
- Trở ngại: server chết → user mất session. Tốt hơn: external session store (Redis).

---

## 8.2. Reverse Proxy vs Forward Proxy?

**Câu hỏi:** Reverse proxy và forward proxy khác nhau ra sao?

**Trả lời:**

### Forward Proxy:
- Đứng **trước client**, đại diện cho client.
- Client → Proxy → Internet.
- Use case: VPN, công ty kiểm soát truy cập web của nhân viên, bypass censorship.

```
Employee → [Company Proxy] → Internet
```

### Reverse Proxy:
- Đứng **trước server**, đại diện cho server.
- Client → Reverse Proxy → backend servers.
- Use case: Nginx, load balancer.

```
Client → [Reverse Proxy] → App servers
```

### So sánh:

| Tính năng | Forward Proxy | Reverse Proxy |
|----------|--------------|---------------|
| Đại diện cho | Client | Server |
| Client biết về proxy | Có | Không |
| Server biết về proxy | Không | Có |
| Use case | Censorship bypass, VPN | Load balancing, caching, SSL |

### Reverse Proxy làm gì?
1. **Load balancing** — phân tải.
2. **SSL termination** — handle HTTPS, gửi HTTP đến backend.
3. **Caching** — cache response.
4. **Compression** — gzip.
5. **Rate limiting.**
6. **Security** — chặn IP xấu, filter malicious request.
7. **Hide internal architecture** — client chỉ biết 1 IP.

---

## 8.3. CDN là gì?

**Câu hỏi:** CDN là gì? Khi nào dùng?

**Trả lời:**

**CDN (Content Delivery Network)** = mạng lưới server đặt khắp thế giới, cache content gần user.

### Workflow:
1. User ở Việt Nam request `cdn.example.com/image.jpg`.
2. DNS routing user đến edge server gần nhất (Singapore).
3. Edge cache hit → trả ngay.
4. Cache miss → fetch từ origin (vd: AWS S3 ở US) → cache → trả user.

### Lợi ích:
- **Latency thấp** — content gần user.
- **Giảm tải origin** — edge server xử lý phần lớn request.
- **DDoS protection.**
- **Tiết kiệm băng thông** origin.

### Nội dung gì lên CDN?
- Static asset: ảnh, video, CSS, JS, font.
- Download file.
- Streaming video (HLS, DASH).
- API response cacheable (cẩn thận).

### Cache control headers:
```
Cache-Control: public, max-age=31536000, immutable
```

### Cache invalidation:
- TTL expire tự nhiên.
- Purge thủ công qua CDN API.
- Version trong URL: `image.jpg?v=2`.
- Tên file có hash: `app.abc123.js`.

### Phổ biến:
Cloudflare, AWS CloudFront, Akamai, Fastly, BunnyCDN.

---

## 8.4. CAP Theorem?

**Câu hỏi:** **(Phải biết)** CAP theorem là gì?

**Trả lời:**

**CAP Theorem (Brewer, 2000):** Distributed system chỉ có thể đạt **2 trong 3** thuộc tính:

- **C — Consistency:** Mọi node đọc thấy cùng data tại cùng thời điểm.
- **A — Availability:** Mọi request đều được response (không lỗi).
- **P — Partition Tolerance:** Hệ thống vẫn chạy khi network bị chia cắt.

### Reality:
- **P là bắt buộc** trong distributed system (network ALWAYS có thể fail).
- Vậy thực ra chọn giữa **CP** hoặc **AP**.

### CP (Consistency + Partition Tolerance):
- Khi partition, hệ thống **từ chối request** để đảm bảo data nhất quán.
- Ví dụ: ZooKeeper, etcd, HBase, MongoDB (config), Redis (CP với WAIT).
- Use case: payment, banking, leader election.

### AP (Availability + Partition Tolerance):
- Khi partition, vẫn response, **chấp nhận eventual consistency**.
- Ví dụ: Cassandra, DynamoDB, CouchDB.
- Use case: social feed, e-commerce catalog.

### Ví dụ thực tế:
- **Đặt vé máy bay** → CP (không cho 2 người cùng đặt 1 ghế).
- **Instagram feed** → AP (post có thể chậm xuất hiện vài giây).

### PACELC Theorem (extended):
"If Partition, choose between A and C. Else (E), choose between Latency and Consistency."

→ Khi không có partition, vẫn có trade-off **latency vs consistency** (strong consistency cần đồng bộ → latency cao).

---

## 8.5. Microservices vs Monolith?

**Câu hỏi:** Microservice và Monolith khác nhau? Em chọn cái nào cho project mới?

**Trả lời:**

### Monolith:
- 1 codebase, 1 process, 1 deployment.
- Module gọi nhau trực tiếp (function call).

### Microservices:
- Nhiều service nhỏ, mỗi service 1 domain.
- Giao tiếp qua network (HTTP, gRPC, MQ).

### So sánh:

| Tính năng | Monolith | Microservices |
|----------|----------|---------------|
| Codebase | 1 | N |
| Deploy | 1 lần | N lần |
| Communication | Function call | Network |
| Scale | Toàn bộ | Riêng từng service |
| Team | 1 team | Nhiều team |
| Tech stack | Đồng nhất | Đa dạng |
| Debug | Dễ | Khó (distributed tracing) |
| Transaction | ACID | Saga, eventual |
| DevOps | Đơn giản | Phức tạp (K8s, mesh) |

### Khi nào chọn Monolith?
- Team nhỏ (< 10).
- Domain chưa rõ.
- Cần ship nhanh, prototype.
- Logic chưa đủ phức tạp.

### Khi nào chọn Microservices?
- Team lớn, nhiều squad.
- Một số service cần scale độc lập (vd: search rất tải).
- Tech stack đa dạng.
- Có DevOps capability.

### Lời khuyên thực tế:
**"Monolith first"** — bắt đầu monolith well-structured. Khi rõ domain & boundary, mới tách microservice.

→ Nhiều startup tách microservice quá sớm → over-engineering → chậm.

### Khái niệm liên quan:
- **Modular Monolith:** Monolith nhưng chia module rõ ràng, có thể tách dễ.
- **Service Mesh** (Istio, Linkerd): Quản lý network giữa microservice.
- **API Gateway:** Single entry point cho client.

---

## 8.6. Saga Pattern?

**Câu hỏi:** **(Quan trọng — CV của em có)** Saga pattern là gì? Có những loại nào?

**Trả lời:**

**Saga** = pattern xử lý **transaction distributed** (cross-service).

### Vấn đề:
- Trong monolith, BEGIN/COMMIT lo hết.
- Trong microservice, không có distributed transaction (2PC chậm, blocking).

### Saga:
Chia transaction thành **chuỗi step**, mỗi step:
- Local transaction trong 1 service.
- Có **compensating action** để undo.

Nếu 1 step fail → chạy compensating ngược lại.

### Ví dụ — Đặt vé du lịch:
1. Book flight → nếu fail → STOP.
2. Book hotel → nếu fail → cancel flight.
3. Book car → nếu fail → cancel hotel + cancel flight.

### 2 cách implement:

#### 1. Choreography (phân tán):
- Mỗi service publish event sau khi xong.
- Service khác listen + react.

```
OrderService → publish "OrderCreated"
                            ↓
                PaymentService listen → charge → publish "PaymentCompleted"
                                                       ↓
                                            ShippingService listen → ship
```

**Ưu:** Decoupled, đơn giản.
**Nhược:** Hard to track flow, khó debug.

#### 2. Orchestration (tập trung):
- 1 service "orchestrator" điều phối.
- Gọi từng service, nhận response.

```
Orchestrator:
  → call PaymentService.charge()
  → call InventoryService.reserve()
  → call ShippingService.ship()
  Nếu fail step 3 → call InventoryService.release() + PaymentService.refund()
```

**Ưu:** Visible flow, dễ track.
**Nhược:** Orchestrator thành SPOF, coupling.

### Trade-off:
- **Choreography:** Bắt đầu khi ít service. Khi nhiều, khó theo dõi.
- **Orchestration:** Dễ track, phù hợp business flow phức tạp.

### Trong project Sacred Dragon Warriors:
Em dùng Saga (orchestration) cho flow mua VIP package:
1. Trừ tiền (PayOS).
2. Cấp item.
3. Send notification.

Nếu fail step 2 → refund step 1.

---

## 8.7. Outbox Pattern?

**Câu hỏi:** Outbox pattern là gì? Giải quyết vấn đề gì?

**Trả lời:**

### Vấn đề "dual write":
```typescript
async createOrder(data) {
  await db.save(order);            // 1
  await mq.publish('OrderCreated'); // 2
}
```

- (1) thành công, (2) fail (MQ chết, network) → DB có data nhưng event không gửi → inconsistency.
- (1) thành công, (2) gửi 2 lần → duplicate event.

### Outbox Pattern:

**1. Cùng transaction:** Lưu order + event vào 2 bảng trong **cùng 1 transaction**.

```sql
BEGIN;
INSERT INTO orders (...) VALUES (...);
INSERT INTO outbox (event_type, payload) VALUES ('OrderCreated', '{...}');
COMMIT;
```

**2. Outbox publisher:** Process riêng đọc bảng `outbox`, publish lên MQ, đánh dấu đã gửi.

```typescript
setInterval(async () => {
  const events = await db.query("SELECT * FROM outbox WHERE published_at IS NULL LIMIT 100");
  for (const e of events) {
    await mq.publish(e.event_type, e.payload);
    await db.query("UPDATE outbox SET published_at=NOW() WHERE id=?", [e.id]);
  }
}, 1000);
```

### Hoặc dùng CDC (Change Data Capture):
- Tool như Debezium đọc binlog/WAL → tự forward sang Kafka.
- Không cần code publisher.

### Đảm bảo:
- **At-least-once delivery** — event chắc chắn gửi (có thể lặp).
- Consumer phải idempotent.

### Trade-off:
- Phức tạp hơn pub trực tiếp.
- Latency cao hơn (delay vài giây).
- Bảng outbox phải clean định kỳ.

### Trong project của em:
Sacred Dragon Warriors dùng Outbox cho event sau payment success → cộng currency, gửi mail, log audit.

---

## 8.8. Idempotency là gì?

**Câu hỏi:** **(Quan trọng)** Idempotency là gì? Em làm thế nào?

**Trả lời:**

**Idempotent:** Gọi N lần cùng request → kết quả giống gọi 1 lần.

### Vì sao cần?
- Network fail giữa chừng → client không biết server xử lý chưa → retry → request đến 2 lần.
- MQ at-least-once → message có thể duplicate.

### HTTP methods:
- **GET, PUT, DELETE** — idempotent (theo spec).
- **POST** — KHÔNG idempotent (cần handle).

### Cách implement:

#### 1. Idempotency Key:
- Client gửi `Idempotency-Key: <uuid>` trong header.
- Server lưu key + response → nếu thấy key đã có → trả response cũ.

```typescript
async createOrder(idempotencyKey: string, data: OrderDto) {
  const cached = await redis.get(`idem:${idempotencyKey}`);
  if (cached) return JSON.parse(cached);

  const order = await db.transaction(async (tx) => {
    return tx.orders.create(data);
  });

  await redis.set(`idem:${idempotencyKey}`, JSON.stringify(order), 'EX', 86400);
  return order;
}
```

(Stripe, PayPal dùng pattern này.)

#### 2. Natural key:
- Dùng business key duy nhất (vd: order number).
- DB unique constraint → INSERT lần 2 fail → biết duplicate.

#### 3. Status state machine:
- Order có state (`pending → paid`).
- Process payment: if already paid → return immediate.

#### 4. Conditional update:
```sql
UPDATE balance SET amount = amount - 100, version = version + 1
WHERE user_id = 1 AND version = 5;
-- Nếu version đã đổi → affected = 0 → biết duplicate
```

### Trong project của em:
- Payment callback từ PayOS → dùng `idempotencyKey` (transaction ID của PayOS) → tránh cộng tiền 2 lần khi PayOS retry callback.

---

## 8.9. Eventual Consistency vs Strong Consistency?

**Câu hỏi:** Phân biệt 2 loại consistency.

**Trả lời:**

### Strong Consistency:
- Mọi reader đọc thấy data mới nhất ngay lập tức sau khi write.
- Trade-off: latency cao, có thể từ chối request khi partition.
- Ví dụ: SQL DB, ZooKeeper.

### Eventual Consistency:
- Có thể tạm thời thấy data cũ.
- Sau cùng (eventually) mọi reader thấy data nhất quán.
- Ưu: high availability, low latency.
- Ví dụ: DNS, Cassandra default, S3.

### Spectrum của consistency:

**1. Strong / Linearizability:** Read luôn thấy write mới nhất.
**2. Sequential consistency:** Mọi reader thấy cùng order, không nhất thiết real-time.
**3. Causal consistency:** Causally-related write thấy đúng order.
**4. Read your own writes:** User đọc thấy write của chính mình.
**5. Monotonic read:** Đọc không thấy data cũ hơn lần đọc trước.
**6. Eventual.**

### Trong thực tế:
- Banking, payment → strong.
- Social feed, view count → eventual OK.

---

## 8.10. Horizontal vs Vertical Scaling?

**Câu hỏi:** Hai cách scale này khác nhau ra sao?

**Trả lời:**

### Vertical Scaling (Scale up):
- Thêm CPU, RAM, disk cho 1 máy.
- **Đơn giản** — code không đổi.
- **Giới hạn** — máy có max cấu hình.
- **Đắt** — server cấu hình cao tiền theo cấp số nhân.
- **SPOF** — máy chết → app chết.

### Horizontal Scaling (Scale out):
- Thêm nhiều máy.
- **Không giới hạn** (về lý thuyết).
- **Rẻ hơn** với scale lớn.
- **High availability** — 1 máy chết, máy khác phục vụ.
- **Phức tạp** — load balancer, distributed state, network.

### Khi nào dùng?
- **Vertical:** App nhỏ, đơn giản, chưa hot.
- **Horizontal:** App lớn, cần HA, traffic không đoán trước.

### Stateless vs Stateful:
- **Stateless service** → horizontal dễ (thêm instance là xong).
- **Stateful service** → khó hơn (cần replicate state, hoặc sticky session).

→ Khuyến cáo: thiết kế stateless ngay từ đầu.

---

## 8.11. Thiết kế URL Shortener (bit.ly)?

**Câu hỏi:** Thiết kế hệ thống shorten URL (bit.ly). Em làm sao?

**Trả lời:**

### Functional requirements:
- Input long URL → output short URL.
- Click short URL → redirect long URL.
- Analytics (số click).
- Optional: custom alias.

### Non-functional:
- 100 triệu URL mới/tháng → ~40 req/s.
- Read:Write = 100:1 → 4000 req/s read.
- Latency < 100ms.
- 99.9% availability.

### Design:

#### 1. Encoding scheme:
- Base62 (0-9, a-z, A-Z) → 7 ký tự = 62^7 ≈ 3.5 nghìn tỷ URL.

#### 2. ID generation strategy:

**Option A: Counter + Base62:**
- DB auto-increment ID → encode base62.
- Đơn giản nhưng URL đoán được (1 → 2 → 3 → ...).

**Option B: Random hash:**
- Generate 7 ký tự random → check trùng → insert.
- Trùng phải retry.

**Option C: Hash long URL (MD5 → base62 → cắt 7 ký tự):**
- Deterministic (cùng URL ra cùng short).
- Có thể trùng (cần handle).

**Option D: Distributed ID generator** (Snowflake, ZooKeeper sequencer):
- Mỗi server có dải ID riêng → không cần lock global.

#### 3. Schema:
```sql
urls(
  short_code VARCHAR(7) PRIMARY KEY,
  long_url TEXT,
  user_id INT,
  created_at TIMESTAMP,
  expire_at TIMESTAMP NULL
)
```

#### 4. Read flow (click):
1. Receive `GET /abc1234`.
2. Check Redis cache: `cache.get('abc1234')`.
3. Hit → 301/302 redirect.
4. Miss → DB lookup → cache → redirect.

#### 5. Architecture:
```
Client → CDN → LoadBalancer → App Servers → Redis (cache) ↔ DB (sharded)
                                          ↓
                                     Kafka → Analytics
```

#### 6. Scale:
- Cache hot URL (80/20 rule).
- DB shard theo short_code hash.
- Analytics async qua Kafka.

#### 7. 301 vs 302:
- **301 Permanent** → browser cache → không track được click sau.
- **302 Temporary** → mọi click đều qua server → track được.

---

## 8.12. Thiết kế Rate Limiter?

**Câu hỏi:** Thiết kế hệ thống rate limit (100 req/min/user).

**Trả lời:**

### Approach 1: In-memory (single server):
- Map `userId → count`.
- Reset mỗi phút.
- ❌ Không scale: nhiều server thì counter không đồng bộ.

### Approach 2: Centralized với Redis:

#### Fixed Window:
```typescript
async checkLimit(userId): Promise<boolean> {
  const window = Math.floor(Date.now() / 60000);
  const key = `rl:${userId}:${window}`;
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, 60);
  return count <= 100;
}
```

#### Sliding Window Log:
- Sorted set: score = timestamp, member = request id.
- Mỗi request:
  1. Remove cũ: `ZREMRANGEBYSCORE key 0 (now - 60s)`.
  2. Count: `ZCARD key`.
  3. If < 100 → ZADD + ZEXPIRE.

#### Token Bucket (Lua):
```lua
local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local rate = tonumber(ARGV[2])
local now = tonumber(ARGV[3])

local data = redis.call('HMGET', key, 'tokens', 'ts')
local tokens = tonumber(data[1]) or capacity
local last_ts = tonumber(data[2]) or now

tokens = math.min(capacity, tokens + (now - last_ts) * rate)
if tokens >= 1 then
  tokens = tokens - 1
  redis.call('HMSET', key, 'tokens', tokens, 'ts', now)
  redis.call('EXPIRE', key, 60)
  return 1
end
return 0
```

### Response khi vượt limit:
```
HTTP 429 Too Many Requests
Retry-After: 30
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1700000000
```

### Multi-tier limit:
- 100 req/phút + 1000 req/giờ + 10000 req/ngày → cần 3 counter.

### Distributed:
- Redis là SPOF → có thể dùng Redis Cluster, hoặc local cache + Redis làm source of truth (eventual).

---

## 8.13. Thiết kế Chat Realtime (như Messenger)?

**Câu hỏi:** Thiết kế hệ thống chat real-time, 1-to-1 và group.

**Trả lời:**

### Functional:
- 1-1 chat, group chat.
- Online status.
- Read receipt.
- Message history.
- File attachment.

### Components:

#### 1. Connection layer:
- WebSocket server (NestJS Gateway, hoặc Socket.IO).
- Mỗi user mở 1 connection.
- Lưu mapping `userId → connectionId → serverInstance`.

#### 2. Chat service:
- Nhận message từ client → validate → persist → forward đến recipient.

#### 3. Storage:
- **Database:** message history (Cassandra, MySQL sharded).
- **Cache:** recent message, online status (Redis).
- **Object storage:** file attachment (S3).

#### 4. Message broker:
- Kafka/RabbitMQ → fan-out message.

### Workflow gửi 1-1 message:

```
1. User A: send "hello" tới User B.
2. WebSocket Server 1 nhận → persist DB.
3. Publish event "msg" to broker.
4. Subscriber (mọi server) check User B online trên mình không.
5. Nếu Server 2 có User B → push qua WebSocket.
6. Nếu offline → push notification (FCM/APNs).
7. ACK lại User A.
```

### Scale:
- Sharding theo userId (consistent hashing).
- Multi-region (geo-routing).
- Presence service (Redis pub/sub) để biết user nào online ở server nào.

### Trong project của em (Gamota):
- WebSocket cho real-time multiplayer.
- Redis + RabbitMQ batch để giảm DB write 95%.
- Lua script atomic cho purchase.

---

## 8.14. Service Discovery?

**Câu hỏi:** Service discovery là gì? Phương pháp?

**Trả lời:**

**Vấn đề:** Microservice A muốn gọi service B. B chạy trên nhiều instance, IP đổi liên tục → A làm sao biết gọi đâu?

### 2 patterns:

#### 1. Client-side discovery:
- Client truy vấn **service registry** (Consul, Eureka, etcd) → lấy danh sách instance → tự load balance.
- Ưu: linh hoạt.
- Nhược: client phức tạp.

#### 2. Server-side discovery:
- Client gọi load balancer cố định → LB query registry.
- Ưu: client đơn giản.
- Nhược: LB là bottleneck.

### Service Registry:
- Mỗi instance đăng ký lúc start (`register(host, port, health_check_url)`).
- Heartbeat định kỳ.
- Instance chết → registry remove.

### Phổ biến:
- **Consul** (HashiCorp) — service discovery + KV store.
- **Eureka** (Netflix).
- **etcd** (CoreOS) — distributed KV, dùng trong Kubernetes.
- **Kubernetes DNS** — built-in service discovery (Service object).

### Service Mesh (Istio, Linkerd):
- Sidecar proxy (Envoy) ở mỗi pod.
- Tự discovery, load balance, retry, circuit breaker.
- Application không cần biết.

---

## 8.15. Circuit Breaker?

**Câu hỏi:** Circuit breaker là gì? Vì sao cần?

**Trả lời:**

**Vấn đề:** Service A gọi B. B chết → A vẫn gọi → mỗi request chờ timeout → A hết resource → A chết → cascade failure.

### Circuit Breaker:
Giống cầu dao điện. Có 3 state:

#### 1. CLOSED (bình thường):
- Cho phép request đi qua.
- Đếm số fail.
- Nếu vượt threshold → chuyển OPEN.

#### 2. OPEN (cắt mạch):
- Không gọi service downstream nữa.
- Fail nhanh (fast fail) → trả lỗi ngay.
- Sau timeout (vd 30s) → chuyển HALF_OPEN.

#### 3. HALF_OPEN (thăm dò):
- Cho 1 request đi qua.
- Thành công → CLOSED. Fail → OPEN tiếp.

### Library:
- Node.js: `opossum`.
- Java: Hystrix (deprecated), Resilience4j.
- Service mesh: Istio.

```typescript
const breaker = new CircuitBreaker(callExternalAPI, {
  timeout: 3000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000,
});

breaker.fallback(() => 'Service unavailable');

const result = await breaker.fire(args);
```

### Combine với:
- **Retry** với exponential backoff.
- **Bulkhead** — limit concurrent request tới 1 service.
- **Timeout** — không chờ quá lâu.
- **Fallback** — trả default khi fail.

---

# PHẦN 9: CONCURRENCY & RACE CONDITION

## 9.1. Race Condition?

**Câu hỏi:** Race condition là gì? Em đã gặp chưa? Cách phòng?

**Trả lời:**

**Race condition** = nhiều luồng đọc/ghi vào shared resource → kết quả phụ thuộc thứ tự thực thi → có thể sai.

### Ví dụ kinh điển — counter:
```typescript
// Sai
let counter = 0;
async function increment() {
  const current = counter;  // read
  // (thread khác có thể chạy ở đây)
  counter = current + 1;    // write
}

await Promise.all([increment(), increment(), increment()]);
// Mong đợi: 3. Thực tế: có thể 1, 2, hoặc 3.
```

### Ví dụ thực tế — mua hàng:
```typescript
// Sai
async function purchase(userId, itemId) {
  const balance = await db.getBalance(userId);  // 1000
  // (user mua đồng thời ở tab khác)
  if (balance >= 500) {
    await db.deduct(userId, 500);
    await db.giveItem(userId, itemId);
  }
}

// User có 1000, mua 2 món 500 đồng thời → cả 2 đều check OK → trừ 2 lần → balance -1000 (?!)
```

### Cách phòng:

**1. Lock (mutex/distributed lock).**
**2. Atomic operation:**
```sql
UPDATE balance SET amount = amount - 500
WHERE user_id = 1 AND amount >= 500;
-- Affected = 1 → OK. Affected = 0 → không đủ tiền.
```
**3. Optimistic locking với version.**
**4. Transaction với isolation cao.**
**5. CAS (Compare-And-Swap).**
**6. Single-threaded model** (Node.js, Redis).

### Trong project:
- Sacred Dragon Warriors mua item: Lua script atomic check + deduct + give (1 Redis call).

---

## 9.2. Deadlock 4 điều kiện?

**Câu hỏi:** Deadlock là gì? Điều kiện cần?

**Trả lời:**

**Deadlock** = nhiều thread chờ resource của nhau, không ai release → treo vĩnh viễn.

### 4 điều kiện (Coffman, 1971) — phải đủ cả 4:

**1. Mutual Exclusion:** Resource không share được (chỉ 1 thread giữ).

**2. Hold and Wait:** Thread giữ resource A vừa chờ resource B.

**3. No Preemption:** Không cướp resource từ thread khác được.

**4. Circular Wait:** Tồn tại vòng tròn thread T1 → T2 → ... → Tn → T1.

### Cách phòng:
- **Phá điều kiện 2:** Lock all-or-nothing từ đầu.
- **Phá điều kiện 4:** Lock theo thứ tự nhất quán (id nhỏ → lớn).
- **Phá điều kiện 3:** Cho phép timeout, release.
- **Detect & recover:** DB tự detect deadlock, kill 1 transaction.

---

## 9.3. Mutex vs Semaphore?

**Câu hỏi:** Mutex và Semaphore khác nhau?

**Trả lời:**

### Mutex:
- **Mutual Exclusion lock.**
- Chỉ **1 thread** giữ lock cùng lúc.
- Người lock = người unlock (owner).
- Binary state: locked/unlocked.

### Semaphore:
- **Counter.**
- Cho phép **N thread** vào cùng lúc.
- Ai cũng có thể signal/wait (không có owner).

### Use case:
- **Mutex:** Bảo vệ critical section.
- **Semaphore:** Giới hạn concurrency (vd: tối đa 10 request đến DB cùng lúc), producer-consumer (semaphore đếm slot trống).

```typescript
// Pseudo
const sem = new Semaphore(10);
async function callDB() {
  await sem.acquire();
  try {
    return await db.query(...);
  } finally {
    sem.release();
  }
}
```

---

## 9.4. Two-Phase Commit (2PC)?

**Câu hỏi:** 2PC là gì? Vì sao ít dùng?

**Trả lời:**

**2PC = distributed transaction across multiple resource managers.**

### 2 phase:

#### Phase 1 — Prepare:
- Coordinator hỏi mọi participant: "Mày sẵn sàng commit không?"
- Mỗi participant chuẩn bị (lock resource, viết WAL) → trả "YES" hoặc "NO".

#### Phase 2 — Commit/Abort:
- Nếu mọi participant YES → coordinator gửi "COMMIT" → tất cả commit.
- Có ai NO → "ABORT" → tất cả rollback.

### Vấn đề:
- **Blocking:** Participant chờ coordinator → coordinator chết → block vĩnh viễn (giữ lock).
- **Performance:** 2 round trip + lock dài.
- **Single point of failure:** Coordinator chết → kẹt.
- **3PC** (3-phase commit) cải tiến nhưng phức tạp hơn.

### Vì sao microservices không thích 2PC?
- Service phải implement XA protocol → coupling.
- HTTP service khó tham gia 2PC.
- Chậm.

→ Thay bằng **Saga** (eventual consistency, không lock cross-service).

---

# PHẦN 10: DEVOPS

## 10.1. Docker là gì? Khác VM?

**Câu hỏi:** Docker là gì? Image vs Container? Khác VM?

**Trả lời:**

### Docker:
Platform đóng gói app với mọi dependency thành **container** chạy độc lập.

### Image vs Container:
- **Image:** Template read-only (như class).
- **Container:** Instance đang chạy của image (như object).

### Docker vs VM:

| Tính năng | Container | VM |
|----------|-----------|-----|
| OS | Share host kernel | Có guest OS riêng |
| Boot | Vài giây | Vài phút |
| Size | MB | GB |
| Isolation | Process-level | Hardware-level |
| Density | Cao (hàng trăm) | Thấp (vài chục) |

### Architecture:
```
┌──────────────────────────────┐
│ App A    App B    App C       │
├──────────────────────────────┤
│ Container Container Container │
├──────────────────────────────┤
│       Docker Engine           │
├──────────────────────────────┤
│       Host OS (Linux kernel)  │
├──────────────────────────────┤
│       Hardware                │
└──────────────────────────────┘
```

### Dockerfile cơ bản:
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["node", "dist/main.js"]
```

---

## 10.2. Docker layer, multi-stage build?

**Câu hỏi:** Docker layer là gì? Multi-stage build có lợi gì?

**Trả lời:**

### Docker layer:
Mỗi command trong Dockerfile tạo 1 layer (immutable). Layer được cache.

Sửa code → chỉ layer sau đó rebuild. Layer trước (cài dependency) vẫn cache.

→ Đặt step ít đổi trước (cài dependency), step hay đổi sau (copy code).

```dockerfile
# Tốt
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./   # ít đổi
RUN npm ci              # cached
COPY . .                # hay đổi
RUN npm run build

# Tệ
FROM node:20-alpine
WORKDIR /app
COPY . .                # đổi 1 file → invalidate cache
RUN npm ci
RUN npm run build
```

### Multi-stage build:
Dùng nhiều `FROM` → image cuối chỉ chứa kết quả build, không có source/dev dependency.

```dockerfile
# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Run (smaller)
FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package.json ./
EXPOSE 3000
USER node
CMD ["node", "dist/main.js"]
```

→ Image cuối nhỏ (vài chục MB thay vì GB), an toàn (không có source code).

---

## 10.3. Docker Compose?

**Câu hỏi:** Docker Compose dùng để làm gì?

**Trả lời:**

**Docker Compose** = công cụ orchestrate nhiều container với 1 file `docker-compose.yml`.

```yaml
version: '3.8'
services:
  api:
    build: .
    ports: ["3000:3000"]
    environment:
      DB_HOST: db
      REDIS_HOST: redis
    depends_on: [db, redis]

  db:
    image: postgres:15
    environment:
      POSTGRES_PASSWORD: secret
    volumes:
      - db_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine

volumes:
  db_data:
```

Chạy: `docker compose up -d`.

### Use case:
- Development environment local.
- Test integration.
- Demo, prototype.

### Không phù hợp:
- Production multi-host → dùng Kubernetes/Swarm.

---

## 10.4. Kubernetes cơ bản?

**Câu hỏi:** Em hiểu K8s không? Pod, Deployment, Service là gì?

**Trả lời:**

**Kubernetes (K8s):** Container orchestration platform.

### Concepts:

**Pod:** Đơn vị nhỏ nhất, chứa 1+ container share network/storage.

**Deployment:** Quản lý ReplicaSet → đảm bảo N pod đang chạy. Support rolling update.

**Service:** Stable endpoint cho pod (vì pod IP thay đổi). Types: ClusterIP (internal), NodePort, LoadBalancer.

**Ingress:** L7 routing, SSL termination.

**ConfigMap, Secret:** Inject config, password.

**Volume, PVC:** Persistent storage.

**Namespace:** Logical isolation.

### Workflow:
```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata: { name: api }
spec:
  replicas: 3
  selector: { matchLabels: { app: api } }
  template:
    metadata: { labels: { app: api } }
    spec:
      containers:
      - name: api
        image: myregistry/api:v1.2.3
        ports: [{ containerPort: 3000 }]
        env:
        - name: DB_URL
          valueFrom: { secretKeyRef: { name: db, key: url } }
```

---

## 10.5. Nginx reverse proxy?

**Câu hỏi:** Em config Nginx làm reverse proxy thế nào?

**Trả lời:**

```nginx
upstream nestjs_app {
    least_conn;
    server 127.0.0.1:3000;
    server 127.0.0.1:3001;
    server 127.0.0.1:3002;
    keepalive 32;
}

server {
    listen 80;
    server_name api.example.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.example.com;

    ssl_certificate /etc/letsencrypt/live/.../fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/.../privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header Strict-Transport-Security "max-age=31536000" always;

    # Gzip
    gzip on;
    gzip_types application/json text/css application/javascript;

    # Rate limit
    limit_req_zone $binary_remote_addr zone=api:10m rate=100r/s;

    location / {
        limit_req zone=api burst=20 nodelay;

        proxy_pass http://nestjs_app;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 5s;
        proxy_read_timeout 30s;
    }

    location /ws {
        proxy_pass http://nestjs_app;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 86400s;
    }
}
```

### Vai trò Nginx:
1. SSL termination (giảm tải app).
2. Load balance giữa nhiều instance Node.js.
3. Static file (Node.js không tốt phục vụ static).
4. Gzip, cache.
5. Rate limit ở edge.

---

## 10.6. CI/CD?

**Câu hỏi:** CI/CD là gì? Pipeline điển hình?

**Trả lời:**

- **CI (Continuous Integration):** Mỗi commit → tự build + test.
- **CD (Continuous Delivery):** Build artifact, deploy được nhưng manual approve.
- **CD (Continuous Deployment):** Tự deploy production sau khi pass test.

### Pipeline điển hình:
```
git push
  ↓
1. Lint (ESLint, Prettier)
  ↓
2. Type check (tsc --noEmit)
  ↓
3. Unit test (Jest, coverage > 70%)
  ↓
4. Build (npm run build)
  ↓
5. Docker build + push registry
  ↓
6. Deploy staging
  ↓
7. Integration test, smoke test
  ↓
8. Manual approval (cho production)
  ↓
9. Deploy production (blue-green / canary)
  ↓
10. Health check, monitoring
```

### Tools:
- **GitHub Actions, GitLab CI, Jenkins, CircleCI, Drone.**
- **Argo CD, Flux** (GitOps cho K8s).

### Example GitHub Actions:
```yaml
name: CI
on: [push]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    - uses: actions/setup-node@v3
      with: { node-version: 20 }
    - run: npm ci
    - run: npm run lint
    - run: npm test
    - run: npm run build
```

---

## 10.7. Blue-Green vs Canary vs Rolling Deployment?

**Câu hỏi:** Các chiến lược deploy?

**Trả lời:**

### Rolling Update:
- Update từng instance một (vd: 5 pod, mỗi lần update 1).
- Không downtime.
- Rollback chậm.

### Blue-Green:
- 2 môi trường giống hệt: Blue (production hiện tại), Green (version mới).
- Deploy lên Green → test → switch traffic 100% sang Green.
- Rollback nhanh (switch lại Blue).
- Tốn tài nguyên gấp 2.

### Canary:
- Deploy lên một phần nhỏ (5%) → monitor → tăng dần (10%, 25%, 50%, 100%).
- Phát hiện vấn đề sớm với ít user bị ảnh hưởng.
- Cần observability tốt.

### A/B Testing:
- Khác canary: chia traffic để test 2 phiên bản, đo metric kinh doanh (conversion rate).

### Trong project Sacred Dragon Warriors:
- 478 deployment, 95% success — em dùng rolling update với health check.

---

## 10.8. Monitoring — Prometheus, Grafana?

**Câu hỏi:** Em monitor app thế nào?

**Trả lời:**

### Pillars of Observability:
1. **Metrics** — số liệu định lượng (RPS, latency, error rate).
2. **Logs** — text log của event.
3. **Traces** — track request đi qua các service.

### Stack phổ biến:

**Metrics:**
- **Prometheus** — scrape metric từ app (qua endpoint `/metrics`).
- **Grafana** — visualize.
- **Alertmanager** — alert khi metric vượt threshold.

**Logs:**
- **ELK (Elasticsearch + Logstash + Kibana)** hoặc **Loki + Grafana**.
- **Fluent Bit** — log collector.

**Traces:**
- **Jaeger, Tempo, Zipkin** — distributed tracing (OpenTelemetry).

### Metric quan trọng (RED):
- **Rate** — request/giây.
- **Errors** — error rate.
- **Duration** — latency p50, p95, p99.

### Metric hệ thống (USE):
- **Utilization** — % CPU, RAM dùng.
- **Saturation** — queue length, wait time.
- **Errors** — disk error, OOM.

### Trong project:
- Sacred Dragon Warriors có observability stack với Prometheus + Grafana + Loki.
- 7-day soak test 1000 RPS, p99 < 500ms.

---

## 10.9. PM2 là gì?

**Câu hỏi:** PM2 dùng để làm gì?

**Trả lời:**

**PM2** = Production process manager cho Node.js.

### Tính năng:
- **Cluster mode** — fork nhiều worker tận dụng CPU.
- **Auto restart** khi crash.
- **Load balance** request giữa worker.
- **Zero-downtime reload.**
- **Log management.**
- **Monitor RAM, CPU.**
- **Startup script** (chạy khi server boot).

### Commands:
```bash
pm2 start dist/main.js --name api -i max  # cluster max CPU
pm2 list
pm2 logs api
pm2 reload api          # zero-downtime
pm2 restart api
pm2 stop api
pm2 monit
pm2 save
pm2 startup             # systemd integration
```

### ecosystem.config.js:
```javascript
module.exports = {
  apps: [{
    name: 'api',
    script: 'dist/main.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: { NODE_ENV: 'production', PORT: 3000 },
    max_memory_restart: '500M',
  }]
};
```

---

# PHẦN 11: GO LANGUAGE

## 11.1. Goroutine vs Thread?

**Câu hỏi:** **(CV em có Go)** Goroutine và thread khác nhau ra sao?

**Trả lời:**

### Thread (OS thread):
- Quản lý bởi OS.
- Stack lớn (1-8MB).
- Context switch tốn kém.
- Tạo 10k thread → OS struggle.

### Goroutine:
- Quản lý bởi Go runtime.
- Stack siêu nhỏ (2KB initial, grow tự động).
- Context switch trong user-space → cực rẻ.
- Tạo **hàng triệu goroutine** trên 1 process được.

### Cú pháp:
```go
go func() {
    fmt.Println("Concurrent!")
}()
```

### GMP Model:
- **G** — Goroutine.
- **M** — Machine (OS thread).
- **P** — Processor (logical, mặc định = số CPU core).

Go runtime đặt G lên P, P bind với M để chạy. Có thread pool, work stealing.

---

## 11.2. Channel — Buffered vs Unbuffered?

**Câu hỏi:** Channel là gì? Buffered và unbuffered khác nhau?

**Trả lời:**

**Channel** = pipe để goroutine giao tiếp.

```go
ch := make(chan int)        // unbuffered
ch := make(chan int, 10)    // buffered, capacity 10

ch <- 1     // gửi
v := <-ch   // nhận
close(ch)
```

### Unbuffered:
- Send block đến khi có receiver.
- Receive block đến khi có sender.
- **Synchronous** — đồng bộ hai bên.

### Buffered:
- Send không block nếu buffer chưa đầy.
- Receive không block nếu buffer còn data.
- **Asynchronous** trong giới hạn capacity.

### Select:
```go
select {
case v := <-ch1:
    fmt.Println("ch1:", v)
case ch2 <- 5:
    fmt.Println("sent to ch2")
case <-time.After(time.Second):
    fmt.Println("timeout")
default:
    fmt.Println("no comm")
}
```

### Best practice "Don't communicate by sharing memory; share memory by communicating":
- Dùng channel thay vì mutex khi có thể.

---

## 11.3. Context package?

**Câu hỏi:** Context dùng làm gì?

**Trả lời:**

`context.Context` truyền **cancellation signal, deadline, request-scoped value** qua các goroutine.

### Use case:
- HTTP request bị cancel → cancel mọi goroutine xử lý request đó.
- Timeout cho query DB.
- Truyền request ID, user ID.

### Ví dụ:
```go
func handler(w http.ResponseWriter, r *http.Request) {
    ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
    defer cancel()

    rows, err := db.QueryContext(ctx, "SELECT ...")
    if err != nil {
        if errors.Is(err, context.DeadlineExceeded) {
            http.Error(w, "Timeout", 504)
            return
        }
    }
    // ...
}
```

### Rules:
- Pass context như **first argument** của function.
- Không lưu context trong struct.
- `context.Background()` ở top-level, `context.TODO()` khi chưa quyết.

---

## 11.4. Defer, Panic, Recover?

**Câu hỏi:** Defer chạy khi nào?

**Trả lời:**

### Defer:
- Lùi statement đến khi function return.
- Chạy theo thứ tự **LIFO**.
- Dùng cho cleanup.

```go
func readFile(path string) error {
    f, err := os.Open(path)
    if err != nil { return err }
    defer f.Close()  // chạy khi return

    // process...
    return nil
}
```

### Panic:
- Throw exception → unwind stack → defer chạy.
- Nếu không recover → crash app.

### Recover:
- Bắt panic, chỉ trong defer.

```go
defer func() {
    if r := recover(); r != nil {
        fmt.Println("Recovered:", r)
    }
}()
panic("oops")
```

### Error vs Panic:
- **Error** — expected error → trả về.
- **Panic** — bug nghiêm trọng → crash (hoặc recover ở boundary).

---

## 11.5. Slice internals?

**Câu hỏi:** Slice trong Go hoạt động thế nào?

**Trả lời:**

Slice = `{ pointer, len, cap }`.

```go
s := []int{1, 2, 3}
// s = { ptr → [1,2,3], len=3, cap=3 }

s = append(s, 4)
// cap không đủ → tạo array mới (gấp đôi), copy, ptr trỏ tới array mới
// s = { ptr → [1,2,3,4], len=4, cap=6 }
```

### Sub-slice share underlying array:
```go
a := []int{1, 2, 3, 4, 5}
b := a[1:3]  // {2, 3}
b[0] = 99
// a = {1, 99, 3, 4, 5}  ← bị ảnh hưởng!
```

→ Cẩn thận khi sub-slice. Nếu muốn độc lập, copy.

---

## 11.6. sync.Mutex vs RWMutex?

**Câu hỏi:** RWMutex khác Mutex thế nào?

**Trả lời:**

### Mutex:
- 1 thread giữ lock tại 1 thời điểm.
- `Lock()` / `Unlock()`.

### RWMutex:
- **Nhiều reader cùng lúc**, hoặc **1 writer**.
- `RLock()` / `RUnlock()` (read).
- `Lock()` / `Unlock()` (write).

### Khi nào dùng RWMutex?
- Read >> Write.
- Read cần nhiều thread song song.

### Ví dụ:
```go
type SafeMap struct {
    mu sync.RWMutex
    m  map[string]int
}

func (s *SafeMap) Get(k string) int {
    s.mu.RLock()
    defer s.mu.RUnlock()
    return s.m[k]
}

func (s *SafeMap) Set(k string, v int) {
    s.mu.Lock()
    defer s.mu.Unlock()
    s.m[k] = v
}
```

---

## 11.7. GC trong Go?

**Câu hỏi:** Go có GC không? Cơ chế?

**Trả lời:**

C�. Go dùng **concurrent, tri-color mark-and-sweep**:

1. **Mark phase** — bắt đầu từ root (global, stack), mark mọi object reachable màu đen, đang process màu xám, chưa thăm màu trắng.
2. **Sweep phase** — object trắng = unreachable → free.

### Đặc điểm:
- **Concurrent** — chạy đồng thời với app, ít pause.
- **Low latency** — pause < 1ms thường.
- **Write barrier** — đảm bảo correctness khi app sửa pointer trong lúc GC.

### Tune:
- `GOGC=100` (default) — GC khi heap gấp đôi.
- `GOGC=200` — chạy ít hơn, dùng nhiều RAM.
- `GOGC=off` — tắt (chỉ test).

### Vs Node.js GC:
- Node.js (V8) cũng generational GC, có pause STW khoảng vài ms với heap nhỏ.

---

# PHẦN 12: WEBSOCKET & REAL-TIME

## 12.1. WebSocket vs HTTP?

**Câu hỏi:** WebSocket khác HTTP thế nào? Khi nào dùng?

**Trả lời:**

### HTTP:
- **Request-Response**, 1 chiều (client hỏi, server trả).
- Mỗi request mở/tái sử dụng connection.
- Header lớn.

### WebSocket:
- **Full-duplex** — hai chiều, cả 2 đẩy data bất kỳ lúc nào.
- **Persistent connection** (TCP).
- Header nhỏ (sau handshake).
- Dùng `wss://` (TLS).

### Handshake:
```
Client:
GET /chat HTTP/1.1
Host: example.com
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Key: ...
Sec-WebSocket-Version: 13

Server:
HTTP/1.1 101 Switching Protocols
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Accept: ...
```

Sau 101 → connection được upgrade → trao đổi frame thay vì HTTP message.

### Use case:
- Chat real-time.
- Notification.
- Game multiplayer.
- Live trading/sports.
- Collaborative editing (Google Docs).

### Trade-off:
- Tốn resource server (connection lâu).
- Load balancer cần config (sticky session).
- Khó scale ngang (cần pub/sub layer).

---

## 12.2. WebSocket vs SSE vs Long Polling?

**Câu hỏi:** Các kỹ thuật real-time?

**Trả lời:**

### Long Polling:
- Client gửi request → server giữ → có data thì trả → client lại request.
- Đơn giản, tương thích mọi browser cũ.
- Latency cao, tốn resource.

### Server-Sent Events (SSE):
- 1 chiều (server → client).
- HTTP/1.1, chunked.
- Auto reconnect.
- Browser API: `EventSource`.

```javascript
const es = new EventSource('/events');
es.onmessage = (e) => console.log(e.data);
```

### WebSocket:
- 2 chiều, full-duplex.
- Phức tạp hơn (handshake, frame).

### So sánh:

| Tính năng | Long Poll | SSE | WebSocket |
|----------|----------|-----|-----------|
| Direction | 2 chiều | 1 chiều (S→C) | 2 chiều |
| Protocol | HTTP | HTTP | WS |
| Browser cũ | Tốt | OK | OK |
| Auto reconnect | Tự code | Built-in | Tự code |
| Phù hợp | Đơn giản | Notification | Chat, game |

---

## 12.3. Scale WebSocket?

**Câu hỏi:** Có 100k user online, làm sao scale WebSocket?

**Trả lời:**

### Vấn đề:
- 1 server giới hạn (vd 10k connection).
- User trên server A muốn nhắn user trên server B → cross-server.

### Giải pháp:

**1. Nhiều WS server + Pub/Sub:**
- Mỗi server lưu mapping `userId → socketId` local.
- Khi gửi message tới user X:
  - Publish event qua Redis Pub/Sub.
  - Mọi server nhận, check user X có connect mình không → forward.

```typescript
// Server A: nhận message gửi user X
await redis.publish('msg', JSON.stringify({ to: userX, content }));

// Mọi server:
redis.subscribe('msg');
redis.on('message', (chan, payload) => {
  const { to, content } = JSON.parse(payload);
  const socket = localConnections.get(to);
  if (socket) socket.send(content);
});
```

**2. Sticky session:**
- Load balancer giữ user vào cùng server (qua IP/cookie).
- Tránh user reconnect vào server khác.

**3. Adapter (Socket.IO Redis adapter):**
- Socket.IO có sẵn `socket.io-redis` → broadcast cross-server tự động.

**4. Presence service:**
- Service riêng quản lý online status.
- Redis Hash: `online:userId → serverId`.

### Trong project Gamota:
- 1000+ CCU WebSocket.
- Redis batch write giảm DB 95%.

---

## 12.4. Socket.IO vs raw WebSocket?

**Câu hỏi:** Socket.IO khác raw WebSocket thế nào?

**Trả lời:**

### Raw WebSocket:
- Chuẩn W3C, `new WebSocket('wss://...')`.
- Chỉ là kênh truyền text/binary.
- Không có room, namespace, auto-reconnect, fallback.

### Socket.IO:
- Library wrap WebSocket.
- **Fallback** sang long-polling nếu WS không dùng được.
- **Rooms** — gom socket lại để broadcast.
- **Namespaces** — chia logical channel.
- **Auto reconnect.**
- **ACK** built-in.
- **Adapter** cho scale cross-server.

### Phù hợp:
- Cần feature phong phú → Socket.IO.
- Cần performance, control thấp → raw WS hoặc `ws` lib.

---

# PHẦN 13: OOP & DESIGN PATTERNS

## 13.1. 4 nguyên lý OOP?

**Câu hỏi:** OOP có 4 nguyên lý gì?

**Trả lời:**

### 1. Encapsulation (Đóng gói):
Ẩn chi tiết bên trong, chỉ expose API public.
- `private`, `protected`, `public` modifier.
- Getter/setter.

### 2. Inheritance (Kế thừa):
Class con kế thừa class cha.
```typescript
class Animal {
  eat() { /* ... */ }
}
class Dog extends Animal {
  bark() { /* ... */ }
}
```

### 3. Polymorphism (Đa hình):
C�ng method, nhiều behavior.
- **Overriding** — class con override method cha.
- **Overloading** — cùng tên method, khác params (TS hỗ trợ qua signature).

### 4. Abstraction (Trừu tượng):
Chỉ expose feature, ẩn implementation.
- Abstract class, interface.

---

## 13.2. SOLID?

**Câu hỏi:** **(Quan trọng)** SOLID là gì?

**Trả lời:**

### S — Single Responsibility:
1 class chỉ có **1 lý do thay đổi**.

```typescript
// ❌ Sai: lo nhiều việc
class User {
  save() {}      // DB
  sendEmail() {} // mail
  generateReport() {} // export
}

// ✅ Tách
class UserRepository { save() {} }
class EmailService { send() {} }
class ReportService { generate() {} }
```

### O — Open/Closed:
**Open for extension, closed for modification.** Thêm tính năng bằng cách extend, không sửa code cũ.

```typescript
// Strategy pattern
interface PaymentMethod { pay(): void; }
class PayOS implements PaymentMethod { pay() {} }
class VNPay implements PaymentMethod { pay() {} }
// Thêm Stripe: chỉ thêm class mới, không sửa code cũ.
```

### L — Liskov Substitution:
Class con thay class cha mà không phá behavior.

```typescript
// ❌ Sai:
class Bird { fly() {} }
class Penguin extends Bird {
  fly() { throw new Error('Cannot fly'); }
}
// Code dùng Bird mong fly() chạy → đưa Penguin vào → crash.

// ✅ Đúng:
interface CanFly { fly() ; }
class Sparrow implements CanFly { fly() {} }
class Penguin {} // không implement CanFly
```

### I — Interface Segregation:
Đừng ép client implement method không cần.

```typescript
// ❌ Sai:
interface Worker {
  work(): void;
  eat(): void;
}
class Robot implements Worker { work() {} eat() { /* ?? */ } }

// ✅ Tách:
interface Workable { work(): void; }
interface Eatable { eat(): void; }
class Human implements Workable, Eatable {}
class Robot implements Workable {}
```

### D — Dependency Inversion:
Depend on **abstraction**, không phải concrete.

```typescript
// ❌ Sai:
class OrderService {
  private payOs = new PayOS();
  pay() { this.payOs.charge(); }
}

// ✅ Đúng:
class OrderService {
  constructor(private payment: PaymentMethod) {} // interface
  pay() { this.payment.pay(); }
}
```

→ Đây chính là cốt lõi của **Dependency Injection**.

---

## 13.3. Singleton Pattern?

**Câu hỏi:** Singleton là gì? Có nên dùng?

**Trả lời:**

**Singleton** = đảm bảo 1 class chỉ có 1 instance.

```typescript
class Database {
  private static instance: Database;
  private constructor() {}
  static getInstance() {
    if (!Database.instance) Database.instance = new Database();
    return Database.instance;
  }
}
```

### Trong NestJS:
- Provider mặc định là singleton → không cần tự code.

### Cẩn thận:
- Singleton = global state → khó test.
- Có thể che giấu dependency.
- Đôi khi anti-pattern (DI tốt hơn).

---

## 13.4. Factory Pattern?

**Câu hỏi:** Factory pattern?

**Trả lời:**

**Factory** = ủy quyền việc tạo object cho 1 class/method.

```typescript
interface Notification {
  send(): void;
}

class EmailNotification implements Notification {
  send() { /* ... */ }
}
class SmsNotification implements Notification {
  send() { /* ... */ }
}
class PushNotification implements Notification {
  send() { /* ... */ }
}

class NotificationFactory {
  static create(type: string): Notification {
    switch (type) {
      case 'email': return new EmailNotification();
      case 'sms': return new SmsNotification();
      case 'push': return new PushNotification();
      default: throw new Error('Unknown');
    }
  }
}

const notif = NotificationFactory.create('email');
notif.send();
```

---

## 13.5. Strategy Pattern?

**Câu hỏi:** Strategy pattern?

**Trả lời:**

**Strategy** = nhiều thuật toán có thể swap runtime.

```typescript
interface SortStrategy {
  sort(arr: number[]): number[];
}

class QuickSort implements SortStrategy { sort(arr) { /* ... */ return arr; } }
class MergeSort implements SortStrategy { sort(arr) { /* ... */ return arr; } }

class Sorter {
  constructor(private strategy: SortStrategy) {}
  sort(arr: number[]) { return this.strategy.sort(arr); }
}

const sorter = new Sorter(new QuickSort());
sorter.sort([3, 1, 2]);
```

Rất phổ biến trong DI — khác concrete implement cùng interface.

---

## 13.6. Observer Pattern?

**Câu hỏi:** Observer pattern?

**Trả lời:**

**Observer** = subscribe/notify.

```typescript
class EventEmitter {
  private listeners: Record<string, Function[]> = {};
  on(event: string, fn: Function) {
    (this.listeners[event] ||= []).push(fn);
  }
  emit(event: string, ...args: any[]) {
    this.listeners[event]?.forEach(fn => fn(...args));
  }
}

emitter.on('userCreated', (user) => sendWelcomeEmail(user));
emitter.emit('userCreated', { name: 'Đăng' });
```

→ Node.js EventEmitter là implementation chuẩn.

---

## 13.7. Repository Pattern?

**Câu hỏi:** Repository pattern là gì?

**Trả lời:**

**Repository** = lớp trừu tượng giữa business logic và data access.

```typescript
// Interface
interface UserRepository {
  findOne(id: string): Promise<User>;
  save(user: User): Promise<User>;
}

// Implement với TypeORM
@Injectable()
class TypeOrmUserRepository implements UserRepository {
  constructor(@InjectRepository(UserEntity) private repo: Repository<UserEntity>) {}
  async findOne(id) { return this.repo.findOne({ where: { id } }); }
  async save(user) { return this.repo.save(user); }
}

// Service dùng abstraction
@Injectable()
class UserService {
  constructor(@Inject('UserRepository') private repo: UserRepository) {}
  async getUser(id) { return this.repo.findOne(id); }
}
```

### Lợi ích:
- Decouple business với DB.
- Swap DB dễ (TypeORM → Prisma → MongoDB).
- Test dễ (mock repo).

---

## 13.8. Adapter, Decorator, Facade?

**Câu hỏi:** Các pattern này là gì?

**Trả lời:**

### Adapter:
Chuyển interface A → interface B.
- Ví dụ: legacy lib có method `pay($amount)`, app expect `pay({amount})` → adapter wrap.

### Decorator:
Wrap object để thêm behavior mà không sửa class.
- Trong NestJS: `@UseInterceptors(LoggingInterceptor)` chính là decorator pattern.

### Facade:
Cung cấp 1 interface đơn giản cho subsystem phức tạp.
- Vd: `UserService.register(dto)` đóng gói: validate + hash password + save DB + send email + log.

---

# PHẦN 14: ĐÀO SÂU CV

## 14.1. Sacred Dragon Warriors — Architecture?

**Câu hỏi:** Em mô tả architecture project Sacred Dragon Warriors. Vì sao chọn microservices từ đầu? 14 service có quá nhiều cho 1 mình em không?

**Trả lời (gợi ý):**

**Trung thực** là quan trọng nhất. Trả lời mẫu:

> "Project là sản phẩm cá nhân học tập. Em chọn microservices vì muốn học pattern thật, không phải vì traffic. Em chia 14 service theo bounded context: auth, user, payment, inventory, item, mail, notification, chat, leaderboard, analytics, RAG-chatbot, gateway, scheduler, asset-server. Một số service đơn giản (vài endpoint), một số phức tạp hơn.
>
> Em hiểu nhược điểm của over-engineering: 1 mình maintain 14 service tốn thời gian rất nhiều cho ops (Docker, CI/CD, monitoring). Nếu làm lại, em sẽ bắt đầu modular monolith, tách microservice khi domain rõ. Ở project này em làm vậy để học pattern Saga, Outbox, distributed tracing — chứ business volume thực sự không cần microservice."

### Câu hỏi follow-up có thể bị hỏi:
- "Em tách service theo tiêu chí nào?" → Bounded context (DDD).
- "Service nào gọi service nào?" → Vẽ sơ đồ — chuẩn bị trước.
- "Auth service xác thực thế nào?" → JWT RS256, gateway verify, internal service tin tưởng header.

---

## 14.2. Saga & Outbox trong project?

**Câu hỏi:** Em apply Saga và Outbox vào flow nào? Cho ví dụ cụ thể.

**Trả lời mẫu:**

> "Flow mua VIP package: user click pay → gateway gọi PaymentService → PaymentService gọi PayOS → PayOS callback success → cần cộng currency + cấp item + send mail + log audit.
>
> Em dùng **Outbox**: PaymentService nhận callback, trong **1 transaction PostgreSQL**: update payment_status = paid + insert vào bảng `outbox_events` (event_type='PaymentCompleted', payload).
>
> 1 worker đọc outbox → publish lên NATS → các service downstream (Inventory, Mail, Audit) subscribe. Mỗi consumer **idempotent** check `event_id` trong Redis trước khi xử lý.
>
> Em dùng **Saga orchestration** cho flow rút tiền (ít gặp nhưng có): trừ currency → gọi PayOS withdraw → fail thì cộng lại currency. Orchestrator chạy trong PaymentService."

### Câu hỏi xoáy:
- "Nếu outbox table có 1 triệu row chưa published thì sao?" → Index trên `(published_at, id)`, partition theo ngày.
- "Idempotency key của event là gì?" → UUID v4 gen lúc insert outbox.

---

## 14.3. "0% partial-failure" — Defense?

**Câu hỏi:** Em ghi "0% partial-failure" — em đo bằng cách nào? Em có chắc 100% không?

**Trả lời mẫu (TRUNG THỰC):**

> "Đây là cách diễn đạt hơi quá. Thực tế: trong các test em chạy (vài nghìn lượt mua trong test), không có case nào trừ tiền mà không cấp item, hoặc cấp item mà không trừ tiền. Em đo qua: query DB sau test, đối chiếu số transaction `paid` với số item cấp ra. Outbox pattern giúp đảm bảo eventual consistency.
>
> Em chưa test production scale, chưa gặp adversarial scenario (DB crash giữa commit, network partition). Nếu CV có gây hiểu nhầm em xin đính chính: 'không quan sát thấy partial-failure trong test sample khoảng X giao dịch'."

→ Lời khuyên: Sửa CV sau buổi này — đừng dùng "0%" nếu không có evidence chắc.

---

## 14.4. Mobifos — RabbitMQ retry?

**Câu hỏi:** Mobifos em làm 3 microservice với NestJS. Mô tả flow retry với RabbitMQ.

**Trả lời mẫu:**

> "Game match-3 có flow thanh toán nội tệ → ngoại tệ. Khi gọi payment API fail (timeout, 5xx), em không drop request mà push vào retry queue.
>
> Setup: 5 retry queue với TTL khác nhau (1s, 5s, 30s, 5m, 1h), khi expire → message route về main queue qua dead-letter exchange. Header `x-death` của RabbitMQ track số lần retry. Sau 5 lần → vào DLQ thật.
>
> Em viết script monitor DLQ, gửi alert. Cũng có endpoint admin để replay DLQ.
>
> Code dùng `@golevelup/nestjs-rabbitmq` để integrate với NestJS. Consumer là `@RabbitSubscribe()`."

### Câu hỏi xoáy:
- "Vì sao TTL khác nhau, không dùng exponential backoff trong code?" → Để retry persisted, không phụ thuộc consumer alive. Backoff exponential thực ra setup TTL tăng dần.
- "Idempotency callback?" → Mỗi message có UUID; consumer check Redis `processed:{id}` trước khi xử lý.

---

## 14.5. Mobifos — ~70% latency reduction, sao đo?

**Câu hỏi:** Em ghi giảm latency ~70%. Đo thế nào? Trước-sau cụ thể?

**Trả lời mẫu:**

> "Trước optimize: API `GET /user/profile` p95 latency ~300ms (đo bằng middleware đo thời gian, log ra Prometheus).
>
> Bottleneck: query `users JOIN inventory JOIN achievements JOIN ranking`. 4 lần JOIN, EXPLAIN cho thấy thiếu index trên FK.
>
> Em làm 3 việc:
> 1. Thêm composite index `(user_id, created_at)` trên `inventory` và `achievements`.
> 2. Cache profile vào Redis với TTL 60s, invalidate khi user level up hoặc đổi avatar.
> 3. Tách query phức tạp: get profile basic trước, lazy load achievements khi user mở tab đó.
>
> Sau optimize: p95 ~90ms. Tỷ lệ giảm = (300-90)/300 ≈ 70%.
>
> Em hiểu metric này chỉ đúng với phép đo cụ thể đó, không phải mọi API."

---

## 14.6. Gamota — Lua script atomic purchase?

**Câu hỏi:** Em mô tả Lua script cho atomic purchase. Vì sao không dùng transaction DB?

**Trả lời mẫu:**

> "Game realtime có item shop, user click mua → cần ngay phản hồi. Trước đây dùng DB transaction:
> ```sql
> BEGIN;
> SELECT balance FROM users WHERE id=? FOR UPDATE;
> UPDATE users SET balance = balance - ? WHERE id=?;
> INSERT INTO inventory ...;
> COMMIT;
> ```
> Mỗi lượt mua tốn ~50ms (round-trip + lock). Burst 500 RPS → DB pool nghẹt.
>
> Em chuyển: state user trong Redis (balance, items). Mua qua Lua:
> ```lua
> local balance = tonumber(redis.call('HGET', KEYS[1], 'balance'))
> local price = tonumber(ARGV[1])
> if not balance or balance < price then return -1 end
> redis.call('HINCRBY', KEYS[1], 'balance', -price)
> redis.call('SADD', KEYS[2], ARGV[2])
> return 1
> ```
> Lua trong Redis chạy atomic single-thread → không cần lock. Hết ~1ms.
>
> Periodic batch (mỗi 5s) flush state Redis xuống DB → giảm DB write ~95%."

### Câu hỏi xoáy:
- "Nếu Redis crash giữa batch sao?" → Redis AOF mỗi giây + bảng pending_txn trong DB ghi mỗi lượt mua (append-only log), nếu mất state Redis thì replay từ log. *(Nói thật nếu chưa làm.)*
- "User check inventory: đọc Redis hay DB?" → Redis (source of truth), DB là persistence layer.

---

## 14.7. 1000 RPS soak test — Methodology?

**Câu hỏi:** Em ghi 1000 RPS soak test 7 ngày, p99 < 500ms. Làm thế nào?

**Trả lời mẫu:**

> "Em dùng k6 viết script chạy 1000 RPS đều, mix endpoint theo tỷ lệ thật (60% read profile, 20% match-making, 10% chat, 10% purchase). Chạy trên 1 server con (4 CPU, 8GB RAM) gọi vào staging environment (2 instance API, 1 DB, 1 Redis).
>
> Đo metric qua Prometheus + Grafana: RPS, latency p50/p95/p99, error rate, CPU/RAM mỗi service.
>
> Sau 7 ngày:
> - p99 latency: 450-490ms (đôi lúc spike 600ms khi GC).
> - Error rate: < 0.1%.
> - Memory không leak (RAM ổn định).
>
> Em hiểu là test này có limit: chỉ 1 staging env, traffic là synthetic không phải real user, không test failure injection (chaos engineering)."

→ **Khi interviewer hỏi sâu**, nói rõ giới hạn của test để thể hiện honesty.

---

## 14.8. RAG chatbot — How does it work?

**Câu hỏi:** RAG chatbot em làm thế nào? Vector DB nào?

**Trả lời mẫu:**

> "RAG (Retrieval-Augmented Generation): khi user hỏi 'làm sao mua item X' → bot không chỉ gọi LLM mà tìm document liên quan trước rồi nhồi vào context.
>
> Em làm:
> 1. **Indexing:** Crawl FAQ, wiki game → chia chunk ~500 token → tạo embedding bằng OpenAI `text-embedding-3-small` → lưu vào Qdrant.
> 2. **Query:** User hỏi → embedding query → tìm top-5 chunk gần nhất bằng cosine similarity.
> 3. **Generate:** Nhồi 5 chunk vào prompt + câu hỏi user → gọi GPT-4o-mini → trả lời.
>
> Tối ưu: cache embedding query phổ biến trong Redis. Latency e2e ~2-3s."

### Follow-up:
- "Vì sao Qdrant không Pinecone?" → Self-host, miễn phí, đủ dùng.
- "Embedding model có thể đổi không?" → Có, em test với sentence-transformers (tiếng Việt).

---

## 14.9. 478 deployments 95% success?

**Câu hỏi:** Số 478 lấy đâu ra? 5% fail là gì?

**Trả lời mẫu:**

> "Em đếm trên CI/CD pipeline (GitHub Actions). Mỗi push lên branch main + manual deploy stage/prod đều tính.
>
> 5% fail chủ yếu: test fail (10-15 lần), build Docker fail (vài lần do thiếu env), deploy rollback do health check fail post-deploy.
>
> Em hiểu metric này không phản ánh chất lượng production (project cá nhân, không có real user). Em đề cập để cho thấy em quen với CI/CD và iterate fast."

→ Sửa CV: bớt nhấn mạnh số liệu absolute.

---

## 14.10. Vì sao migrate sang Go + Protobuf + NATS?

**Câu hỏi:** Em ghi migrate một số service sang Go. Vì sao?

**Trả lời mẫu:**

> "Service `match-making` (ghép cặp game) cần latency thấp và xử lý concurrent cao. NestJS event loop với 1000 user concurrent có lúc bị block (do CPU work — tính ELO matching).
>
> Em rewrite trong Go, dùng goroutine cho mỗi matching request. Latency p99 giảm từ ~150ms (Node) xuống ~40ms (Go) — đo với cùng load.
>
> Đổi sang **Protobuf** thay JSON để giảm payload size (NATS message nhỏ hơn ~3 lần). Đổi từ Redis pub/sub sang NATS để có request-response built-in và performance tốt hơn.
>
> Em giữ lại NestJS cho service business CRUD (user, payment) — TypeScript + DI giúp code maintain tốt cho domain phức tạp."

### Câu hỏi xoáy:
- "Mọi service đều migrate Go?" → Không, chỉ service hot path.
- "Vì sao không bắt đầu Go từ đầu?" → Em quen TypeScript hơn, ship nhanh → optimize sau.

---

# PHẦN 15: BEHAVIORAL & SOFT SKILLS

## 15.1. Giới thiệu bản thân?

**Câu hỏi:** Em giới thiệu một chút về em.

**Trả lời mẫu (1-2 phút):**

> "Em là Phạm Hải Đăng, sinh viên năm 2 PTIT, học AI nhưng tự học backend ~1 năm rưỡi. Em tập trung Node.js/NestJS và Go.
>
> Có ~6 tháng làm part-time fullstack ở Mobifos JSC — làm 3 microservice NestJS cho game match-3 ~2000 CCU, tối ưu MySQL+Redis giảm latency. Sau đó intern ở Gamota 3 tháng làm backend real-time multiplayer với WebSocket, dùng Lua script Redis cho atomic purchase.
>
> Project cá nhân em đầu tư nhiều nhất là Sacred Dragon Warriors — một MMORPG mini học microservices, em chia 14 service với NestJS và Go, apply Saga + Outbox, observability stack đầy đủ.
>
> Em ham học, muốn join một team backend lớn để học best practice."

---

## 15.2. Điểm mạnh, điểm yếu?

**Câu hỏi:** Điểm mạnh và yếu của em?

**Trả lời mẫu:**

**Mạnh:**
- "Em **học nhanh** — tự học Go trong 2 tuần đủ rewrite được service. Em chủ động đọc doc, source code, blog.
- Em **chịu khó** — không ngại setup infra, làm cả Docker, CI/CD, monitoring khi cần.
- Em **trung thực** với chính mình về code — không tự lừa rằng code đã tốt khi chưa test kỹ."

**Yếu:**
- "Em **chưa nhiều kinh nghiệm production scale thật** — project em chạy ở staging hoặc traffic nhỏ, chưa va với real-world incident.
- Em **có xu hướng over-engineer** — như project cá nhân chia 14 service trong khi 5-6 đã đủ. Em đang học cách 'just enough'.
- **System design ở scale rất lớn** (triệu user) em chưa từng thiết kế thật, chỉ đọc lý thuyết."

---

## 15.3. Khó khăn lớn nhất em từng gặp?

**Câu hỏi:** Kể về một bug khó nhất em từng debug.

**Trả lời mẫu (STAR — Situation, Task, Action, Result):**

> "**Situation:** Service mua item ở Sacred Dragon Warriors thỉnh thoảng cộng item 2 lần (chỉ ~1 trong 1000 lượt mua), khó reproduce.
>
> **Task:** Phải tìm ra root cause vì gây mất cân bằng kinh tế game.
>
> **Action:** Em thêm log chi tiết mỗi step xử lý payment callback. Sau vài ngày bắt được log: PayOS callback **về 2 lần** với cùng transaction ID trong khoảng 50ms (PayOS retry vì timeout response của em). Code em xử lý không idempotent — đang `INSERT INTO inventory` không check duplicate.
>
> Em fix: thêm idempotency key bằng PayOS transaction ID, lưu vào Redis với SETNX trước khi xử lý. Cộng thêm response timeout cho PayOS callback xuống dưới 3s (PayOS retry sau 5s).
>
> **Result:** Bug biến mất. Em học được: webhook luôn idempotent. Sau đó em viết doc nội bộ về 'idempotency checklist' cho mọi callback handler trong dự án."

---

## 15.4. Vì sao chọn công ty chúng em?

**Câu hỏi:** Vì sao em apply chỗ này?

**Trả lời mẫu:**

> "Em research công ty qua [website / blog tech / repo open source / nhân viên trên LinkedIn]. Em thích:
> 1. [Cụ thể về tech stack — vd: 'team đang dùng Go + Kafka, em muốn học sâu hơn'].
> 2. [Cụ thể về domain — vd: 'fintech / e-commerce / gaming là lĩnh vực em quan tâm vì...'].
> 3. [Cụ thể về team — vd: 'em đọc blog của senior X về Y, em muốn học từ người như vậy'].
>
> Em mong tìm môi trường mentor tốt, có code review nghiêm khắc để em lên trình nhanh hơn so với tự học."

→ **Tránh** câu vô hồn như "công ty lớn, lương cao". Phải research trước.

---

## 15.5. 5 năm nữa em muốn gì?

**Câu hỏi:** Em hình dung mình 5 năm nữa thế nào?

**Trả lời mẫu:**

> "Em mong sau 5 năm em trở thành senior backend engineer, vững về:
> 1. Distributed systems thực chiến — không chỉ lý thuyết mà từng vận hành ở scale lớn.
> 2. Đủ kinh nghiệm để **mentor junior**, làm code review tốt.
> 3. Bắt đầu tham gia decision về architecture cho team/feature lớn.
>
> Em muốn vẫn là IC (individual contributor) sâu về tech, chưa thấy mình hợp với management ngay. Có thể sau đó cân nhắc tech lead.
>
> Em cũng muốn đóng góp 1 vài open source project có ảnh hưởng (NestJS module, Go library)."

---

## 15.6. Em có câu hỏi nào cho chúng em không?

**Câu hỏi:** Em có muốn hỏi gì không?

**Trả lời:**

**LUÔN có câu hỏi.** Không hỏi gì = không quan tâm.

C�u hỏi tốt:
1. "Anh/chị mô tả 1 ngày làm việc điển hình của junior backend ở team này được không?"
2. "Process onboarding junior thế nào? Có buddy/mentor không?"
3. "Code review ở team như thế nào? Trung bình bao lâu review 1 PR?"
4. "Team đang gặp thách thức kỹ thuật nào lớn nhất?"
5. "Mong đợi 6 tháng đầu junior cần đạt là gì?"
6. "Cơ hội học công nghệ mới như thế nào — có thời gian work on side project trong giờ không?"
7. "Tech debt trong codebase đánh giá thế nào — có budget cleanup không?"
8. "Process khi có incident production?"

**Tránh** hỏi:
- Lương (để đợi HR round, hoặc cuối nếu hỏi chính).
- Nghỉ phép, benefit chi tiết (vòng kỹ thuật chưa phù hợp).
- "Công ty có gì hay?" (mơ hồ).

---

## 15.7. Khi không biết câu trả lời thì sao?

**Câu hỏi:** Khi interviewer hỏi câu em không biết?

**Trả lời nguyên tắc:**

1. **THẬT THÀ:** "Em chưa làm với cái này / em không chắc."
2. **Suy luận to:** "Nhưng em đoán có thể là... vì..."
3. **Nói cách em sẽ tìm hiểu:** "Nếu gặp, em sẽ đọc doc X, hỏi senior Y, thử trên Z."

**TUYỆT ĐỐI KHÔNG:**
- Bịa.
- Quanh co.
- Im lặng quá lâu.

Interviewer **biết** bạn không biết hết. Họ test cách bạn xử lý không biết.

---

## 15.8. Em làm việc nhóm thế nào?

**Câu hỏi:** Kể về 1 lần em làm việc với team gặp xung đột?

**Trả lời mẫu:**

> "Ở Mobifos, em đề xuất chuyển 1 service sang Redis cache để giảm load DB, nhưng senior muốn giữ nguyên vì sợ rủi ro Redis chết. Cả 2 đều có lý.
>
> Em đề nghị: viết 1 doc ngắn so sánh trade-off, đo latency hiện tại, benchmark sau khi cache. Em chuẩn bị fallback (cache miss → DB), monitoring, alarm khi Redis fail.
>
> Em present trong stand-up, senior agree để thử trên 1 endpoint. Sau 1 tuần đo: latency giảm, Redis stable → mở rộng cho endpoint khác.
>
> Em học được: thay vì argue, đưa số liệu và plan giảm risk."

---

## 15.9. Em làm thế nào khi deadline gấp?

**Câu hỏi:** Khi deadline gấp em xử lý thế nào?

**Trả lời mẫu:**

> "Đầu tiên em đánh giá scope: cái gì bắt buộc, cái gì nice-to-have. Em communicate với PM/team: 'Trong 3 ngày, em có thể làm A, B chắc; C, D em chưa chắc'.
>
> Em ưu tiên:
> 1. Path quan trọng (happy path).
> 2. Edge case nguy hiểm (mất tiền, mất data).
> 3. Test minimum cho phần quan trọng.
> 4. UX polish sau cùng.
>
> Nếu thật sự không kịp, em raise sớm thay vì kéo đến sát giờ rồi báo. Em không hi sinh chất lượng nguy hiểm (vd: bỏ test mất tiền) chỉ vì gấp."

---

## 15.10. Em có câu gì muốn add không?

**Câu hỏi:** Em có gì muốn nói thêm trước khi kết thúc?

**Trả lời mẫu:**

> "Cảm ơn anh/chị đã dành thời gian. Em đã học thêm nhiều qua buổi này (ví dụ X mà em chưa từng nghĩ tới). Em rất quan tâm vị trí này vì [lý do cụ thể] và mong có cơ hội tiếp tục.
>
> Nếu được, anh/chị có thể chia sẻ next step / timeline thông báo kết quả không ạ?"

→ Polite, professional, chốt clear next step.

---

# PHẦN 16: TESTING

## 16.1. Test Pyramid?

**Câu hỏi:** Em hiểu test pyramid là gì? Em viết loại test nào nhiều nhất?

**Trả lời:**

**Test Pyramid (Mike Cohn):**

```
         ╱╲
        ╱E2E╲          ← Ít (chậm, đắt, dễ flaky)
       ╱─────╲
      ╱ INTEG ╲        ← Vừa
     ╱─────────╲
    ╱   UNIT    ╲      ← Nhiều (nhanh, rẻ, ổn định)
   ╱─────────────╲
```

### Unit Test:
- Test 1 đơn vị nhỏ (function, class) **cô lập**.
- Mock mọi dependency (DB, network).
- Chạy < 1ms mỗi test.
- Nên là **70%** test.

### Integration Test:
- Test nhiều component cùng nhau (vd: service + DB thật, service + Redis thật).
- Chạy chậm hơn (vài giây).
- Nên là **20%** test.

### End-to-End (E2E):
- Test cả flow như user thật (HTTP request → response).
- Chậm nhất, dễ flaky (test ổn không ổn).
- Nên là **10%** test.

### Anti-pattern: Ice Cream Cone
- Ngược lại pyramid — nhiều E2E ít unit.
- Chậm chạp, khó maintain.

---

## 16.2. Mock vs Stub vs Spy vs Fake?

**Câu hỏi:** Phân biệt các loại "test double".

**Trả lời:**

### Stub:
**Trả về data hard-coded** thay cho dependency thật.

```typescript
const userRepoStub = {
  findOne: async () => ({ id: 1, name: 'Đăng' }),
};
```

### Mock:
**Stub + verify expectation** (kiểm tra đã được gọi thế nào).

```typescript
const mockEmail = jest.fn();
service.sendWelcome(user, mockEmail);
expect(mockEmail).toHaveBeenCalledWith('user@example.com');
expect(mockEmail).toHaveBeenCalledTimes(1);
```

### Spy:
**Theo dõi function thật** mà không thay thế. Vẫn chạy logic gốc, nhưng ghi lại call.

```typescript
const spy = jest.spyOn(emailService, 'send');
service.register(dto);
expect(spy).toHaveBeenCalled();
spy.mockRestore();
```

### Fake:
**Implementation đơn giản** thay cho thật (vd: in-memory DB thay PostgreSQL).

```typescript
class FakeUserRepository {
  private data: User[] = [];
  async findOne(id) { return this.data.find(u => u.id === id); }
  async save(user) { this.data.push(user); return user; }
}
```

### Dummy:
Object truyền vào nhưng không dùng (chỉ thỏa signature).

---

## 16.3. Test với NestJS — Setup?

**Câu hỏi:** Em viết unit test cho NestJS service như thế nào?

**Trả lời:**

NestJS có `Test.createTestingModule()` giúp setup DI cho test.

```typescript
describe('UserService', () => {
  let service: UserService;
  let repo: jest.Mocked<Repository<User>>;
  let mailService: jest.Mocked<MailService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: MailService,
          useValue: { send: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(UserService);
    repo = module.get(getRepositoryToken(User));
    mailService = module.get(MailService);
  });

  it('should create user and send welcome email', async () => {
    const dto = { email: 'a@b.com', name: 'Đăng' };
    repo.save.mockResolvedValue({ id: 1, ...dto } as User);

    const result = await service.register(dto);

    expect(repo.save).toHaveBeenCalledWith(expect.objectContaining(dto));
    expect(mailService.send).toHaveBeenCalledWith('a@b.com', 'welcome');
    expect(result.id).toBe(1);
  });

  it('should throw if email exists', async () => {
    repo.findOne.mockResolvedValue({ id: 1 } as User);
    await expect(service.register({ email: 'a@b.com' } as any))
      .rejects.toThrow(ConflictException);
  });
});
```

### E2E test với NestJS:
```typescript
describe('UserController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  it('/users (POST)', () => {
    return request(app.getHttpServer())
      .post('/users')
      .send({ email: 'a@b.com', name: 'Đăng' })
      .expect(201)
      .expect(res => {
        expect(res.body.id).toBeDefined();
      });
  });

  afterAll(() => app.close());
});
```

---

## 16.4. AAA pattern — Arrange, Act, Assert?

**Câu hỏi:** AAA là gì?

**Trả lời:**

**AAA = Arrange, Act, Assert.** Cấu trúc 1 test rõ ràng.

```typescript
it('should deduct balance correctly', async () => {
  // Arrange — chuẩn bị data, mock
  const user = { id: 1, balance: 1000 };
  repo.findOne.mockResolvedValue(user);

  // Act — gọi function cần test (1 lần thôi)
  const result = await service.purchase(1, 300);

  // Assert — kiểm tra kết quả
  expect(result.balance).toBe(700);
  expect(repo.save).toHaveBeenCalledWith({ ...user, balance: 700 });
});
```

### Nguyên tắc test tốt:
1. **Test 1 thứ mỗi test** (1 assertion logic).
2. **Tên test rõ ràng** (`should + behavior + condition`).
3. **Độc lập** — không phụ thuộc thứ tự test.
4. **Deterministic** — chạy 100 lần đều cùng kết quả.
5. **Không test implementation detail** — test behavior.

---

## 16.5. Code coverage có quan trọng không?

**Câu hỏi:** Em đặt coverage threshold bao nhiêu?

**Trả lời:**

**Coverage** đo % code được test chạm tới.

### Types:
- **Line coverage** — % dòng được chạy.
- **Branch coverage** — % nhánh if/else được chạy.
- **Function coverage** — % function được gọi.
- **Statement coverage** — % statement.

### Coverage cao = code tốt?
**Không hoàn toàn.** Coverage 100% mà không có assert thì vô nghĩa:

```typescript
it('runs without crash', () => {
  service.doSomething(); // coverage 100% nhưng không test gì
});
```

### Threshold thực tế:
- **70-80%** là balance hợp lý.
- **Critical path** (payment, auth) → 90%+.
- Util/helper → có thể thấp.
- Setup, config → không count.

### Trong project của em:
```json
// jest.config.js
{
  "coverageThreshold": {
    "global": {
      "branches": 70,
      "functions": 75,
      "lines": 80,
      "statements": 80
    }
  }
}
```

---

## 16.6. Snapshot test?

**Câu hỏi:** Snapshot test khi nào dùng?

**Trả lời:**

**Snapshot test** lưu output vào file, lần sau so sánh.

```typescript
it('matches DTO transform', () => {
  const result = userToDto(user);
  expect(result).toMatchSnapshot();
});
```

Lần đầu chạy → tạo file `__snapshots__/...snap`.
Lần sau chạy → so output với file. Khác → fail.

### Use case:
- Test response API không đổi.
- Test UI component (React).
- Test config/serialization.

### Cẩn thận:
- Dễ "lười" → cứ update snapshot mà không nhìn diff.
- Không tốt cho data thay đổi thường xuyên (timestamp, random).

---

## 16.7. Test database — Tạo data thật hay mock?

**Câu hỏi:** Test với DB: mock toàn bộ hay dùng DB thật?

**Trả lời:**

### Option 1: Mock repository (Unit test):
- **Nhanh**, không cần DB.
- **Không test SQL** — repo có thể sai SQL mà unit test pass.

### Option 2: In-memory DB (SQLite):
- Nhanh hơn DB thật.
- Risk: SQLite ≠ PostgreSQL → SQL chạy local OK, prod fail (vd: window function khác).

### Option 3: Real DB trong Docker (Integration test):
- **Chính xác nhất.**
- Chậm hơn (cần `docker run` + migrate).
- Dùng test container (`testcontainers-node`).

```typescript
beforeAll(async () => {
  container = await new PostgreSqlContainer().start();
  process.env.DB_URL = container.getConnectionUri();
  await runMigrations();
});

afterAll(() => container.stop());

beforeEach(() => truncateAllTables());
```

### Combine:
- Service logic → mock repo (unit).
- Repository → real DB (integration).
- Critical flow → E2E với real DB.

---

# PHẦN 17: TYPESCRIPT DEEP DIVE

## 17.1. TypeScript vs JavaScript?

**Câu hỏi:** Vì sao dùng TypeScript?

**Trả lời:**

TypeScript = JavaScript + static type system.

### Ưu:
1. **Type safety** — bắt lỗi compile time, không phải runtime.
2. **Autocomplete tốt** — IDE hiểu code.
3. **Refactor an toàn** — đổi tên function, type check báo nơi nào cần sửa.
4. **Self-documenting** — type là spec.
5. **Catch bug sớm** — null, typo, sai kiểu.

### Nhược:
- Setup phức tạp (tsconfig, build).
- Cần compile sang JS để chạy.
- Type system có giới hạn (any, unknown trốn được).

### `tsconfig.json` quan trọng:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "strict": true,                       // ⭐ bật mọi check
    "noImplicitAny": true,
    "strictNullChecks": true,
    "experimentalDecorators": true,       // cho NestJS
    "emitDecoratorMetadata": true,        // cho DI
    "esModuleInterop": true,
    "skipLibCheck": true
  }
}
```

---

## 17.2. `any` vs `unknown` vs `never`?

**Câu hỏi:** 3 type này khác nhau ra sao?

**Trả lời:**

### `any`:
- Tắt type check.
- "Tao biết kiểu này, đừng check tao."
- **Tránh** — mất ý nghĩa TypeScript.

### `unknown`:
- "Tao chưa biết kiểu, nhưng buộc mày phải narrow trước khi dùng."
- An toàn hơn `any`.

```typescript
function parse(json: string): unknown {
  return JSON.parse(json);
}

const data = parse('{"name":"Đăng"}');
// data.name  // ❌ Error: unknown
if (typeof data === 'object' && data !== null && 'name' in data) {
  console.log(data.name); // ✅ OK
}
```

### `never`:
- Kiểu **không bao giờ có giá trị**.
- Function return `never` = function không bao giờ return (throw, infinite loop).

```typescript
function throwError(msg: string): never {
  throw new Error(msg);
}

// Exhaustiveness check:
type Shape = { type: 'circle'; r: number } | { type: 'square'; s: number };
function area(s: Shape) {
  switch (s.type) {
    case 'circle': return Math.PI * s.r ** 2;
    case 'square': return s.s ** 2;
    default:
      const _exhaustive: never = s; // ✅ TS báo nếu thêm shape mới mà quên handle
      return _exhaustive;
  }
}
```

---

## 17.3. Generic?

**Câu hỏi:** Generic dùng để làm gì?

**Trả lời:**

**Generic** = type parameter, viết code reuse cho nhiều type.

```typescript
function first<T>(arr: T[]): T | undefined {
  return arr[0];
}

const n = first([1, 2, 3]);     // T = number → n: number
const s = first(['a', 'b']);    // T = string → s: string
```

### Generic class:
```typescript
class Container<T> {
  constructor(private value: T) {}
  get(): T { return this.value; }
}
```

### Generic constraint:
```typescript
function getName<T extends { name: string }>(item: T): string {
  return item.name;
}

getName({ name: 'Đăng', age: 20 }); // OK
getName({ age: 20 });               // ❌ thiếu name
```

### Trong NestJS — Repository generic:
```typescript
class BaseRepository<T extends { id: string }> {
  async findById(id: string): Promise<T> { /* ... */ }
}
```

---

## 17.4. Utility Types?

**Câu hỏi:** Utility type nào hay dùng?

**Trả lời:**

### `Partial<T>` — mọi field optional:
```typescript
interface User { name: string; age: number; }
type UpdateUserDto = Partial<User>; // { name?: string; age?: number; }
```

### `Required<T>` — mọi field bắt buộc.

### `Readonly<T>` — mọi field readonly.

### `Pick<T, K>` — chọn field:
```typescript
type UserPreview = Pick<User, 'name'>; // { name: string }
```

### `Omit<T, K>` — bỏ field:
```typescript
type UserWithoutAge = Omit<User, 'age'>; // { name: string }
```

### `Record<K, V>` — map key-value:
```typescript
type Roles = Record<string, boolean>;
const roles: Roles = { admin: true, user: false };
```

### `Exclude<T, U>` — bỏ type:
```typescript
type T = Exclude<'a' | 'b' | 'c', 'b'>; // 'a' | 'c'
```

### `Extract<T, U>` — lấy type giao:
```typescript
type T = Extract<'a' | 'b', 'a' | 'c'>; // 'a'
```

### `ReturnType<T>` — kiểu return của function:
```typescript
function foo(): { id: number } { return { id: 1 }; }
type Foo = ReturnType<typeof foo>; // { id: number }
```

### `Awaited<T>` — unwrap Promise:
```typescript
type R = Awaited<Promise<string>>; // string
```

---

## 17.5. Type vs Interface?

**Câu hỏi:** `type` và `interface` khác nhau? Khi nào dùng?

**Trả lời:**

### Interface:
- Cho object shape.
- **Có thể extend nhiều interface.**
- **Declaration merging** (cùng tên = merge).

```typescript
interface User { name: string; }
interface User { age: number; } // merge
// Giờ User = { name: string; age: number; }

interface Admin extends User { role: string; }
```

### Type:
- Linh hoạt hơn — alias cho **mọi kiểu** (union, primitive, tuple, function).
- **Không merge** được.
- Dùng `&` để intersection.

```typescript
type ID = string | number;
type Coord = [number, number];
type Handler = (e: Event) => void;
type Admin = User & { role: string };
```

### Convention:
- **Interface** cho object public API (DTO, entity).
- **Type** cho union, utility, mapped.

---

## 17.6. Type Guard?

**Câu hỏi:** Type guard là gì?

**Trả lời:**

**Type guard** = function/expression giúp TS narrow type.

### Built-in:
```typescript
function f(x: string | number) {
  if (typeof x === 'string') {
    x.toUpperCase(); // ✅ TS biết x là string
  }
}

if (x instanceof Date) { /* x là Date */ }
if ('email' in user) { /* user có field email */ }
```

### Custom type guard (`is`):
```typescript
interface Cat { type: 'cat'; meow(): void; }
interface Dog { type: 'dog'; bark(): void; }

function isCat(a: Cat | Dog): a is Cat {
  return a.type === 'cat';
}

function play(animal: Cat | Dog) {
  if (isCat(animal)) {
    animal.meow(); // ✅
  } else {
    animal.bark();
  }
}
```

### Discriminated union (tagged union):
```typescript
type Shape =
  | { kind: 'circle'; radius: number }
  | { kind: 'square'; size: number };

function area(s: Shape) {
  switch (s.kind) {
    case 'circle': return Math.PI * s.radius ** 2;
    case 'square': return s.size ** 2;
  }
}
```

---

## 17.7. `enum` vs `as const`?

**Câu hỏi:** Enum có vấn đề gì?

**Trả lời:**

### Enum truyền thống:
```typescript
enum Role { Admin = 'admin', User = 'user' }
```

**Vấn đề:**
- Tăng size bundle (compile thành IIFE).
- Numeric enum lỏng (any number gán được).
- Không tree-shakable.

### `as const` thay thế:
```typescript
const Role = {
  Admin: 'admin',
  User: 'user',
} as const;

type Role = typeof Role[keyof typeof Role]; // 'admin' | 'user'
```

→ Gọn, type-safe, không runtime overhead.

### Khi nào enum OK?
- Project nhỏ.
- Cần reverse mapping (`Role[0] === 'Admin'`) — chỉ numeric enum có.
- Team quen.

---

# PHẦN 18: CÁC CHỦ ĐỀ NÂNG CAO

## 18.1. gRPC vs REST vs GraphQL?

**Câu hỏi:** Khi nào chọn gRPC, REST, GraphQL?

**Trả lời:**

### REST:
- HTTP/1.1, JSON.
- Đơn giản, phổ biến nhất.
- Verb-based (GET, POST, ...).
- **Phù hợp:** Public API, web app.

### GraphQL:
- 1 endpoint, query linh hoạt.
- Client tự chọn field.
- Avoid over-fetching, under-fetching.
- **Phù hợp:** App với UI phức tạp, mobile (giảm round-trip).

### gRPC:
- HTTP/2 + Protobuf binary.
- Strong typing (sinh code từ `.proto`).
- Hỗ trợ streaming (4 kiểu: unary, server-stream, client-stream, bi-di).
- Nhanh, payload nhỏ.
- **Phù hợp:** Internal microservice.

### So sánh:

| Tính năng | REST | GraphQL | gRPC |
|----------|------|---------|------|
| Protocol | HTTP/1.1 | HTTP/1.1 | HTTP/2 |
| Format | JSON | JSON | Protobuf |
| Streaming | Khó | Có (subscription) | Có (4 kiểu) |
| Browser | Tốt | Tốt | Cần gRPC-Web |
| Tooling | Phổ biến | Tốt | Tốt (codegen) |
| Performance | Trung bình | Trung bình | Nhanh |
| Public API | Phù hợp | Phù hợp | Hiếm |
| Internal | Phù hợp | Phù hợp | Tốt nhất |

### Ví dụ Protobuf:
```protobuf
syntax = "proto3";
package user;

service UserService {
  rpc GetUser (GetUserRequest) returns (User);
  rpc StreamUsers (Empty) returns (stream User);
}

message GetUserRequest {
  string id = 1;
}

message User {
  string id = 1;
  string name = 2;
  int32 age = 3;
}
```

→ Compile ra TypeScript/Go/Java client+server.

### Trong project của em:
- REST cho gateway public.
- gRPC giữa các microservice (latency thấp, type-safe).
- (Em đã migrate sang Protobuf + NATS cho 1 số service.)

---

## 18.2. Webhook design?

**Câu hỏi:** Em thiết kế webhook callback từ third-party (vd PayOS) thế nào để an toàn?

**Trả lời:**

### Vấn đề webhook:
1. **Xác thực:** Đảm bảo request đến từ third-party (không phải attacker giả mạo).
2. **Idempotency:** Third-party có thể retry.
3. **Order:** Webhook không guarantee thứ tự.
4. **Timeout:** Cần ack nhanh.

### Best practice:

#### 1. Signature verification:
- Third-party sign payload bằng secret key + HMAC.
- Server verify signature.

```typescript
const sig = req.headers['x-payos-signature'];
const expected = crypto
  .createHmac('sha256', PAYOS_SECRET)
  .update(JSON.stringify(req.body))
  .digest('hex');

if (sig !== expected) throw new UnauthorizedException();
```

#### 2. Idempotency:
```typescript
const result = await redis.set(`webhook:${eventId}`, '1', 'NX', 'EX', 86400);
if (result === null) return { received: true }; // đã xử lý
```

#### 3. Quick ACK:
- Nhận webhook → enqueue vào job queue → ack 200 ngay.
- Worker xử lý async.
- → Tránh third-party timeout retry.

```typescript
@Post('payos/webhook')
async handleWebhook(@Body() body: any) {
  await this.queue.add('payment-event', body);
  return { received: true }; // < 1s
}
```

#### 4. Retry & DLQ:
- Worker fail → retry exponential backoff.
- Hết retry → DLQ + alert.

#### 5. Replay protection:
- Mỗi event có timestamp.
- Reject event > N phút (chống replay attack).

```typescript
const eventTime = parseInt(req.headers['x-payos-timestamp']);
if (Date.now() / 1000 - eventTime > 300) throw new UnauthorizedException(); // 5 phút
```

---

## 18.3. Cron Job / Scheduled Task?

**Câu hỏi:** Em chạy task định kỳ thế nào?

**Trả lời:**

### Option 1: Node.js cron in-process (`@nestjs/schedule`):
```typescript
@Injectable()
export class TasksService {
  @Cron('0 0 * * *') // mỗi 00:00
  async dailyCleanup() {
    await this.cleanExpiredSessions();
  }

  @Interval(60000) // mỗi 60s
  handleInterval() { /* ... */ }

  @Timeout(5000) // sau 5s khi app start
  handleTimeout() { /* ... */ }
}
```

**Vấn đề:**
- Chạy nhiều instance → cron chạy N lần.

### Option 2: External scheduler (cron OS, Kubernetes CronJob):
- Trigger HTTP endpoint của app.
- Cron chạy 1 lần → không nhân lên.

### Option 3: Distributed lock:
- Cron in-process nhưng acquire Redis lock.
- Chỉ 1 instance chạy được.

```typescript
@Cron('0 0 * * *')
async dailyCleanup() {
  const lock = await redis.set('cron:cleanup', '1', 'NX', 'EX', 3600);
  if (!lock) return; // instance khác đang chạy
  await this.doCleanup();
}
```

### Option 4: Job scheduler queue (BullMQ repeatable job):
```typescript
await queue.add(
  'cleanup',
  { type: 'daily' },
  { repeat: { pattern: '0 0 * * *' } }
);
```
→ BullMQ tự ensure 1 instance chạy.

### Cron syntax:
```
┌── minute (0-59)
│ ┌── hour (0-23)
│ │ ┌── day of month (1-31)
│ │ │ ┌── month (1-12)
│ │ │ │ ┌── day of week (0-6, 0=Sunday)
│ │ │ │ │
* * * * *
```

Ví dụ:
- `0 0 * * *` — 00:00 mỗi ngày.
- `*/15 * * * *` — mỗi 15 phút.
- `0 9 * * 1-5` — 9:00 thứ 2 đến thứ 6.

---

## 18.4. Pagination — Offset vs Cursor?

**Câu hỏi:** Phân trang em làm thế nào?

**Trả lời:**

### Offset-based (page-based):
```sql
SELECT * FROM posts ORDER BY id LIMIT 20 OFFSET 100;
-- Page 6 với 20 item/page
```

**Ưu:**
- Đơn giản.
- Cho phép jump đến page X.
- Show "Page 5/100".

**Nhược:**
- **Chậm** ở offset lớn — DB phải skip 100,000 row.
- **Inconsistent** — nếu có insert/delete giữa chừng, page có thể lặp/thiếu item.

### Cursor-based:
```sql
SELECT * FROM posts WHERE id > ? ORDER BY id LIMIT 20;
-- Truyền id cuối của page trước
```

```json
{
  "data": [...],
  "nextCursor": "post_abc123"
}
```

**Ưu:**
- Nhanh ở data lớn (dùng index).
- Consistent — insert/delete không ảnh hưởng.

**Nhược:**
- Không jump page được.
- UX khác (infinite scroll, "Load more").

### Khi nào dùng?
- **Offset:** Admin dashboard, table có "page X".
- **Cursor:** Mobile feed, infinite scroll, real-time data.

### Best practice:
- Luôn `ORDER BY` (kết quả deterministic).
- Cursor nên là tuple `(created_at, id)` để handle tie-break.

---

## 18.5. File Upload — Direct vs Pre-signed URL?

**Câu hỏi:** Em upload file lớn (vd: video 1GB) thế nào?

**Trả lời:**

### Option 1: Upload qua API server:
```
Client → API server → S3
```

**Nhược:**
- API server làm proxy → tốn băng thông, RAM, CPU.
- Timeout dễ.
- Khó scale.

### Option 2: Pre-signed URL (recommended):
```
Client → API server (xin pre-signed URL)
                ↓ trả URL
Client → S3 (upload trực tiếp, có signature)
```

```typescript
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Post('upload-url')
async getUploadUrl(@Body() { fileName, contentType }: UploadDto) {
  const key = `uploads/${Date.now()}-${fileName}`;
  const command = new PutObjectCommand({
    Bucket: 'my-bucket',
    Key: key,
    ContentType: contentType,
  });
  const url = await getSignedUrl(s3Client, command, { expiresIn: 600 });
  return { uploadUrl: url, key };
}
```

Client upload thẳng vào S3 bằng URL đó (PUT). Server chỉ tham gia bước cấp URL.

### Option 3: Multipart upload (cho file rất lớn):
- Chia file thành chunk 5MB+.
- Upload song song.
- S3 ghép lại khi xong.
- Hỗ trợ resume khi đứt mạng.

### Bảo mật:
- Pre-signed URL có expire ngắn (10 phút).
- Limit content-type, content-length.
- Sau khi upload, validate file trên server (virus scan, content check).

---

## 18.6. Email Sending Architecture?

**Câu hỏi:** Em gửi email thế nào? Vì sao không gửi sync trong API?

**Trả lời:**

### Vì sao không gửi sync?
- SMTP **chậm** (200ms-2s).
- Có thể fail (provider rate limit, mail server down).
- Block user response.

### Pattern:
```
API → Push job vào queue → Worker → Email provider (SendGrid/SES/SMTP)
                                          ↓
                                  Lưu log + retry on fail
```

```typescript
// API:
@Post('register')
async register(@Body() dto: RegisterDto) {
  const user = await this.userService.create(dto);
  await this.emailQueue.add('send-welcome', { userId: user.id });
  return { id: user.id };
}

// Worker:
@Processor('email')
class EmailProcessor {
  @Process('send-welcome')
  async sendWelcome(job: Job<{ userId: string }>) {
    const user = await this.userRepo.findOne(job.data.userId);
    await this.mailer.send({
      to: user.email,
      subject: 'Welcome',
      template: 'welcome',
      context: { name: user.name },
    });
  }
}
```

### Provider:
- **Transactional:** SendGrid, AWS SES, Mailgun, Postmark.
- **Marketing:** Mailchimp.

### Best practice:
- Track open/click qua webhook từ provider.
- Bounce/complaint → dừng gửi user đó (chống spam reputation).
- DKIM, SPF, DMARC cho domain → inbox thay vì spam.
- Template hóa (React Email, MJML).
- Unsubscribe link bắt buộc (CAN-SPAM, GDPR).

---

## 18.7. Logging best practice?

**Câu hỏi:** Em log thế nào? Structured logging là gì?

**Trả lời:**

### Levels:
- `error` — bug, exception.
- `warn` — bất thường nhưng không fail.
- `info` — sự kiện quan trọng (user login, payment).
- `debug` — chi tiết debug (chỉ dev).
- `trace` — chi tiết nhất.

### Unstructured (xấu):
```
2024-01-01 10:00:00 User 123 logged in from 1.2.3.4
```
→ Khó parse, khó query.

### Structured (tốt) — JSON:
```json
{
  "ts": "2024-01-01T10:00:00Z",
  "level": "info",
  "msg": "user_logged_in",
  "userId": "123",
  "ip": "1.2.3.4",
  "requestId": "abc-123",
  "userAgent": "Mozilla/...",
  "duration_ms": 45
}
```
→ Query được trong Loki/Elasticsearch: `level=error AND userId=123`.

### Library:
- **Pino** (nhanh nhất cho Node.js).
- **Winston** (phổ biến).
- **Bunyan**.

```typescript
import { Logger } from '@nestjs/common';
const logger = new Logger('UserService');

logger.log('user_created', { userId: user.id });
logger.error('payment_failed', { error: err.message, orderId });
```

### Correlation ID / Request ID:
- Gen 1 ID mỗi request (UUID), gắn vào mọi log của request đó.
- Trace request qua nhiều service.

```typescript
@Injectable()
class RequestIdMiddleware {
  use(req, res, next) {
    req.id = req.headers['x-request-id'] || uuidv4();
    res.setHeader('x-request-id', req.id);
    next();
  }
}
```

### Đừng log:
- Password, token, credit card.
- PII trừ khi cần (email, phone).
- Stack trace ở production (chỉ log msg + ID, full trace ở internal monitoring).

---

## 18.8. Health Check & Graceful Shutdown?

**Câu hỏi:** Health check endpoint của em có gì? Graceful shutdown là sao?

**Trả lời:**

### Health check:

**Liveness:** App có còn sống không?
```typescript
@Get('healthz')
healthz() { return { status: 'ok' }; }
```

**Readiness:** App có sẵn sàng nhận traffic không?
```typescript
@Get('readyz')
async readyz() {
  await this.db.ping();
  await this.redis.ping();
  return { status: 'ready' };
}
```

Kubernetes dùng readiness để biết khi nào route traffic. Liveness để biết khi nào restart pod.

### NestJS `@nestjs/terminus`:
```typescript
@Get('healthz')
@HealthCheck()
check() {
  return this.health.check([
    () => this.db.pingCheck('database'),
    () => this.redis.checkHealth('redis'),
    () => this.disk.checkStorage('storage', { thresholdPercent: 0.9, path: '/' }),
  ]);
}
```

### Graceful Shutdown:
Khi nhận `SIGTERM` (K8s, PM2):
1. **Stop accept new request** (close server.listening).
2. **Wait current request done** (vài giây).
3. **Close DB connection, Redis, MQ.**
4. **Exit.**

```typescript
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();

  await app.listen(3000);
}
```

NestJS lifecycle hook tự gọi `onModuleDestroy` → cleanup.

### Vì sao cần?
- K8s pod terminate → traffic vẫn route đến vài giây → request đang xử lý dở mất giữa chừng.
- Graceful → 0 downtime, 0 request mất.

---

## 18.9. API Versioning?

**Câu hỏi:** Em version API thế nào?

**Trả lời:**

### 1. URL path:
```
GET /v1/users
GET /v2/users
```
**Phổ biến nhất.** Dễ hiểu, dễ route.

### 2. Header:
```
GET /users
Accept: application/vnd.example.v2+json
```
**Sạch URL.** Khó test với curl.

### 3. Query param:
```
GET /users?version=2
```
Đơn giản nhưng không recommended (URL "bẩn").

### 4. Subdomain:
```
v1.api.example.com/users
v2.api.example.com/users
```

### NestJS:
```typescript
app.enableVersioning({
  type: VersioningType.URI,
  defaultVersion: '1',
});

@Controller({ path: 'users', version: '2' })
export class UsersV2Controller {}
```

### Best practice:
- Backward compat càng lâu càng tốt (deprecate trước remove).
- Document breaking change rõ.
- Notice deprecate qua header `Sunset: <date>`.

---

## 18.10. Idempotent Migration?

**Câu hỏi:** DB migration em làm thế nào? An toàn cho production?

**Trả lời:**

### Migration tool:
- **TypeORM Migration**, **Prisma Migrate**, **Knex**, **Flyway**, **Liquibase**.

### Workflow:
1. Dev: write migration file (SQL hoặc code).
2. Apply local: `npm run migration:run`.
3. Commit migration.
4. CI/CD: deploy → tự apply migration.

### File migration:
```typescript
export class AddUserAvatar1700000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE users ADD COLUMN avatar VARCHAR(255)`);
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE users DROP COLUMN avatar`);
  }
}
```

### An toàn cho production:

**1. Backward-compatible migration:**
- Thêm column NULLABLE (không default).
- Code mới handle cả 2 trường hợp (NULL hoặc có data).
- Backfill data background.
- Sau đó migration nữa: set NOT NULL.

**2. KHÔNG làm migration phá vỡ:**
- ❌ Đổi tên column (deploy time = code cũ chạy với schema mới → crash).
- ❌ Đổi type không tương thích.
- ❌ Drop column ngay khi code còn dùng.

**3. Expand-Contract pattern:**
- **Expand:** Thêm column mới, dual-write cả cũ và mới.
- **Migrate:** Copy data cũ → mới.
- **Contract:** Code chỉ đọc mới, drop column cũ.

**4. Migration với data lớn:**
- `ALTER TABLE` trên 100M row có thể lock vài giờ.
- Dùng tool `pt-online-schema-change` (Percona) hoặc `gh-ost` (GitHub) → migrate online không lock.

**5. Test migration:**
- Apply lên staging có data giống prod.
- Đo thời gian.
- Test rollback.

---

## 18.11. Multi-tenancy?

**Câu hỏi:** Em đã làm SaaS multi-tenant chưa? Có những pattern nào?

**Trả lời:**

**Multi-tenancy:** 1 hệ thống phục vụ nhiều khách hàng (tenant), data cô lập.

### 3 patterns:

#### 1. Database per tenant:
- Mỗi tenant 1 DB riêng.
- **Ưu:** Cô lập tốt nhất, backup riêng, dễ migrate 1 khách.
- **Nhược:** Tốn, khó schema migration đồng loạt.

#### 2. Schema per tenant (PostgreSQL):
- 1 DB, mỗi tenant 1 schema riêng.
- **Ưu:** Cô lập tốt, ít tốn hơn.
- **Nhược:** Khó query cross-tenant (admin, analytics).

#### 3. Shared schema (row-level):
- 1 DB, 1 schema, mỗi table có cột `tenant_id`.
- **Ưu:** Tốn ít nhất, dễ scale.
- **Nhược:** Cô lập yếu nhất, mọi query phải filter `tenant_id` (dễ leak).

### Row-level security (PostgreSQL):
```sql
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON orders
  USING (tenant_id = current_setting('app.tenant_id')::int);
```
DB tự inject WHERE → không dễ quên.

### Tenant context trong NestJS:
- Middleware đọc `Host` hoặc subdomain → set `tenantId` vào request.
- Repository tự filter.

---

## 18.12. Feature Flag?

**Câu hỏi:** Feature flag là gì? Use case?

**Trả lời:**

**Feature flag** = bật/tắt feature runtime mà không deploy.

### Use case:
1. **Gradual rollout:** Bật cho 10% user → monitor → 50% → 100%.
2. **Kill switch:** Bật sai → tắt ngay không cần rollback deploy.
3. **A/B testing:** 50% user thấy feature A, 50% feature B.
4. **Beta access:** Chỉ user nội bộ thấy feature mới.
5. **Trunk-based development:** Merge code chưa hoàn thiện (sau flag) lên main.

### Implementation:

```typescript
@Injectable()
class FeatureService {
  isEnabled(flag: string, userId: string): boolean {
    if (flag === 'new-checkout') {
      // 10% rollout
      return hash(userId) % 100 < 10;
    }
    // ...
  }
}

// Dùng:
if (featureService.isEnabled('new-checkout', user.id)) {
  return newCheckoutFlow();
}
return oldCheckoutFlow();
```

### Tool:
- **Self-host:** ConfigCat, Unleash.
- **Cloud:** LaunchDarkly, Flagsmith, Optimizely.

### Best practice:
- Flag có **expiry** — sau khi rollout xong → xóa flag (tránh tích lũy spaghetti).
- Document mục đích flag.
- Test cả 2 đường (flag on/off).

---

## 18.13. Distributed Tracing?

**Câu hỏi:** Distributed tracing là gì? OpenTelemetry?

**Trả lời:**

**Vấn đề:** 1 request đi qua 10 service → log mỗi service riêng → không biết toàn bộ flow.

### Distributed Tracing:
- Mỗi request có **trace ID** (gen ở entry point, propagate qua mọi service).
- Mỗi operation là 1 **span** (có start, end, parent span).
- Visualize → thấy được flow + latency từng step.

### OpenTelemetry:
- Standard mới (merge OpenCensus + OpenTracing).
- SDK cho nhiều ngôn ngữ.
- Export sang Jaeger, Zipkin, Tempo, vendor (Datadog, New Relic).

```typescript
import { trace } from '@opentelemetry/api';

async function processOrder(orderId: string) {
  const tracer = trace.getTracer('order-service');
  return tracer.startActiveSpan('process_order', async (span) => {
    span.setAttribute('order.id', orderId);
    try {
      await chargePayment(orderId);   // tự tạo child span
      await shipOrder(orderId);
      span.setStatus({ code: SpanStatusCode.OK });
    } catch (err) {
      span.recordException(err);
      span.setStatus({ code: SpanStatusCode.ERROR });
      throw err;
    } finally {
      span.end();
    }
  });
}
```

### Trace context propagation:
- Inject vào HTTP header `traceparent` (W3C standard).
- Service nhận → extract → tạo child span.

### Sampling:
- Trace mọi request tốn quá → sample (vd: 1%).
- Sample 100% request error.

---

# PHẦN 19: DATA STRUCTURES & ALGORITHMS

> Một số buổi phỏng vấn backend có vòng coding cơ bản. Mục này tóm tắt nhanh các topic hay gặp.

## 19.1. Big-O Notation?

**Câu hỏi:** Big-O là gì? Em phân tích complexity thế nào?

**Trả lời:**

**Big-O** = upper bound asymptotic complexity (thời gian/không gian thuật toán khi input lớn).

### Common complexities (từ tốt → tệ):

| Big-O | Tên | Ví dụ |
|-------|-----|-------|
| O(1) | Constant | Truy cập array index, HashMap get |
| O(log n) | Logarithmic | Binary search, B-Tree lookup |
| O(n) | Linear | Loop array |
| O(n log n) | Linearithmic | Merge sort, quicksort avg |
| O(n²) | Quadratic | Nested loop, bubble sort |
| O(2ⁿ) | Exponential | Recursive Fibonacci (naive), subset enumeration |
| O(n!) | Factorial | Brute-force TSP |

### Tip phân tích:
- Loop trong loop → nhân (n × n = n²).
- Loop + recursive halve → n log n.
- Loop độc lập → cộng (chỉ giữ term lớn nhất).
- Bỏ constant: O(2n) → O(n).

### Space complexity:
- Memory dùng thêm (không tính input).
- Recursion → stack depth ≈ space.

---

## 19.2. Array vs Linked List?

**Câu hỏi:** Khi nào dùng cái nào?

**Trả lời:**

| Operation | Array | Linked List |
|-----------|-------|-------------|
| Access by index | O(1) | O(n) |
| Insert/delete đầu | O(n) | O(1) |
| Insert/delete cuối | O(1) amortized | O(1) (với tail ptr) |
| Insert/delete giữa | O(n) | O(1) nếu có ptr; O(n) tìm |
| Memory | Contiguous | Phân tán |
| Cache friendly | Có | Không |

### Khi nào dùng?
- Random access nhiều → Array.
- Insert/delete đầu nhiều → Linked List.
- Phần lớn case → Array (cache friendly).

---

## 19.3. HashMap (Hash Table)?

**Câu hỏi:** HashMap hoạt động thế nào? Collision resolve?

**Trả lời:**

### Cấu trúc:
- Array of bucket.
- Key → `hash(key) % array_size` → index.
- Value lưu ở bucket đó.

### Collision (2 key cùng index):

#### 1. Separate Chaining:
- Mỗi bucket là 1 linked list.
- Java HashMap, Go map.

#### 2. Open Addressing (Linear/Quadratic Probing):
- Va chạm → tìm bucket trống kế tiếp.
- Python dict.

### Complexity:
- Average: O(1) get/put.
- Worst case (mọi key cùng hash): O(n).

### Load factor:
- = items / buckets.
- > 0.75 → rehash (mở rộng array, redistribute).

### Use case backend:
- Cache (LRU = HashMap + DoubleLinkedList).
- Index (DB hash index).
- Deduplication.
- Idempotency tracking.

---

## 19.4. Binary Search?

**Câu hỏi:** Binary search code thế nào?

**Trả lời:**

**Yêu cầu:** Array đã sort.

```typescript
function binarySearch(arr: number[], target: number): number {
  let lo = 0, hi = arr.length - 1;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (arr[mid] === target) return mid;
    if (arr[mid] < target) lo = mid + 1;
    else hi = mid - 1;
  }
  return -1;
}
```

**Complexity:** O(log n).

### Pitfall:
- `(lo + hi) / 2` có thể overflow với int lớn → `lo + (hi - lo) / 2`.
- Off-by-one: dùng `<=` hay `<` nhất quán.

### Variant:
- Tìm first occurrence (lower bound).
- Tìm last occurrence (upper bound).
- Search trong rotated sorted array.

---

## 19.5. Sorting Algorithms?

**Câu hỏi:** Sort em biết những thuật toán nào? Khi nào dùng?

**Trả lời:**

| Algorithm | Avg | Worst | Space | Stable |
|----------|-----|-------|-------|--------|
| Bubble Sort | O(n²) | O(n²) | O(1) | ✅ |
| Insertion Sort | O(n²) | O(n²) | O(1) | ✅ |
| Selection Sort | O(n²) | O(n²) | O(1) | ❌ |
| **Merge Sort** | O(n log n) | O(n log n) | O(n) | ✅ |
| **Quick Sort** | O(n log n) | O(n²) | O(log n) | ❌ |
| **Heap Sort** | O(n log n) | O(n log n) | O(1) | ❌ |
| **Tim Sort** (JS, Python) | O(n log n) | O(n log n) | O(n) | ✅ |
| Counting Sort | O(n+k) | O(n+k) | O(k) | ✅ |
| Radix Sort | O(nk) | O(nk) | O(n+k) | ✅ |

### Stable vs unstable:
- **Stable:** Phần tử bằng nhau giữ thứ tự gốc.
- **Quick sort unstable** — đổi chỗ phá vỡ thứ tự.

### Thực tế:
- JavaScript `Array.sort()` dùng **TimSort** (V8) hoặc **mergesort** — stable, O(n log n).
- Khi sort theo nhiều key (vd: theo name, rồi theo age), cần stable.

### Lower bound:
- Comparison-based sort: **O(n log n)** là cận dưới.
- Non-comparison (Counting, Radix): O(n) nhưng giới hạn input.

---

## 19.6. Stack & Queue?

**Câu hỏi:** Khi nào dùng?

**Trả lời:**

### Stack (LIFO):
- Push/pop ở 1 đầu.
- Use case: undo, function call stack, balanced parentheses, DFS.

```typescript
const stack: number[] = [];
stack.push(1);
const top = stack.pop();
```

### Queue (FIFO):
- Push 1 đầu, pop đầu kia.
- Use case: BFS, task queue, buffer.

```typescript
const queue: number[] = [];
queue.push(1);
const first = queue.shift(); // O(n) trong JS — dùng linked list cho O(1)
```

### Priority Queue (Heap):
- Pop ra element max/min.
- Use case: Dijkstra, top-K, event scheduler.
- Implement: binary heap → O(log n) insert/extract.

### Deque (double-ended queue):
- Push/pop hai đầu.
- Use case: sliding window max, LRU cache.

---

## 19.7. Tree & Graph?

**Câu hỏi:** Phân biệt và dùng khi nào?

**Trả lời:**

### Binary Tree:
- Mỗi node có ≤ 2 con.
- Use case: expression parse, BST.

### Binary Search Tree (BST):
- Left < node < Right.
- Search/insert: O(log n) nếu balanced, O(n) skewed.

### Balanced BST:
- AVL, Red-Black Tree, B-Tree.
- Tự cân bằng → guarantee O(log n).
- DB index dùng B-Tree/B+ Tree.

### Heap:
- Complete binary tree.
- Parent ≥/≤ children.
- Implement với array.

### Trie (prefix tree):
- Node chứa ký tự, đường từ root xuống = string.
- Use case: autocomplete, spell check.

### Graph:
- Directed/Undirected.
- Cyclic/Acyclic.
- Weighted/Unweighted.
- Representation: adjacency list (sparse), adjacency matrix (dense).

### Traversal:
- **BFS** (Queue) — shortest path unweighted.
- **DFS** (Stack/recursion) — connectivity, cycle, topological sort.
- **Dijkstra** (Priority queue) — shortest path weighted.

---

## 19.8. Đệ quy vs Iterative?

**Câu hỏi:** Khi nào dùng đệ quy?

**Trả lời:**

### Đệ quy:
- Tự nhiên cho tree, divide-conquer.
- Code ngắn hơn.
- Stack overflow nếu sâu quá.

```typescript
function factorial(n: number): number {
  if (n <= 1) return 1;
  return n * factorial(n - 1);
}
```

### Iterative:
- Vòng lặp.
- Không stack overflow.
- Đôi khi dài hơn.

```typescript
function factorial(n: number): number {
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}
```

### Tail call:
- Đệ quy ở vị trí cuối → 1 số compiler optimize thành loop (TCO).
- JavaScript: V8 chưa support TCO → đệ quy sâu = crash.

### Convert đệ quy → iterative:
- Dùng stack explicit thay call stack.

---

## 19.9. Dynamic Programming?

**Câu hỏi:** DP là gì?

**Trả lời:**

**DP** = giải bài toán bằng cách:
1. Chia thành subproblem.
2. Lưu kết quả subproblem (memoization).
3. Combine.

### Khi nào DP?
- **Overlapping subproblems** — cùng subproblem xuất hiện nhiều lần.
- **Optimal substructure** — optimal của bài lớn = optimal của bài con.

### Ví dụ Fibonacci:
```typescript
// Naive — O(2ⁿ) — recompute liên tục
function fib(n: number): number {
  if (n <= 1) return n;
  return fib(n - 1) + fib(n - 2);
}

// Memoization (top-down) — O(n)
const memo: Record<number, number> = {};
function fib(n: number): number {
  if (n <= 1) return n;
  if (memo[n]) return memo[n];
  return memo[n] = fib(n - 1) + fib(n - 2);
}

// Tabulation (bottom-up) — O(n) time, O(1) space
function fib(n: number): number {
  let a = 0, b = 1;
  for (let i = 0; i < n; i++) [a, b] = [b, a + b];
  return a;
}
```

### Common DP problems:
- Knapsack.
- Longest Common Subsequence.
- Edit Distance.
- Coin Change.
- Longest Increasing Subsequence.

---

## 19.10. Bit Manipulation?

**Câu hỏi:** Bitwise operation hay dùng cho gì?

**Trả lời:**

### Operators:
- `&` AND
- `|` OR
- `^` XOR
- `~` NOT
- `<<` left shift
- `>>` right shift
- `>>>` unsigned right shift (JS)

### Trick phổ biến:

**Kiểm tra chẵn lẻ:**
```typescript
n & 1  // 1 = lẻ, 0 = chẵn
```

**Set/clear/toggle bit thứ i:**
```typescript
n | (1 << i)   // set
n & ~(1 << i)  // clear
n ^ (1 << i)   // toggle
```

**Check bit thứ i:**
```typescript
(n >> i) & 1
```

**Count bit 1 (popcount):**
```typescript
let count = 0;
while (n) { count += n & 1; n >>= 1; }
```

**Swap 2 số không cần biến tạm:**
```typescript
a ^= b; b ^= a; a ^= b;
```

### Use case backend:
- Permission bitmask (admin=1, write=2, read=4 → mix bằng OR).
- Compact storage (1 byte = 8 bool).
- Bitmap index trong DB.
- Bloom filter (xác suất check tồn tại).

---

## 19.11. LeetCode-style Problems quen gặp?

**Câu hỏi:** Em đã làm LeetCode chưa? Pattern nào hay gặp?

**Trả lời:**

### Pattern phổ biến cho phỏng vấn backend:

#### 1. Hash Map:
- Two Sum, Group Anagrams, Top K Frequent.

#### 2. Two Pointers:
- Reverse string, Remove duplicates, Container with most water.

#### 3. Sliding Window:
- Longest substring without repeat, Min window substring.

#### 4. Binary Search:
- Find first/last position, Search in rotated array, Median of 2 sorted arrays.

#### 5. BFS/DFS:
- Number of islands, Word ladder, Course schedule.

#### 6. Dynamic Programming:
- Climbing stairs, Coin change, Longest common subsequence.

#### 7. Heap:
- Top K elements, Merge K sorted lists, Sliding window median.

#### 8. Linked List:
- Reverse, Detect cycle (Floyd), Merge two sorted.

### Tip phỏng vấn:
1. **Clarify** input/output trước khi code.
2. **Discuss approach** — brute force → optimize.
3. **Analyze** complexity sau code.
4. **Test** bằng tay với ví dụ.
5. **Edge case:** empty input, 1 element, duplicates, negative.

### Ví dụ Two Sum:
```typescript
function twoSum(nums: number[], target: number): number[] {
  const map = new Map<number, number>();
  for (let i = 0; i < nums.length; i++) {
    const complement = target - nums[i];
    if (map.has(complement)) {
      return [map.get(complement)!, i];
    }
    map.set(nums[i], i);
  }
  return [];
}
```

→ O(n) time, O(n) space. (Brute force là O(n²).)

---

## 19.12. LRU Cache — Implement?

**Câu hỏi:** Implement LRU cache size N. Operations: `get(key)`, `put(key, val)` đều O(1).

**Trả lời:**

**Idea:** HashMap + Doubly Linked List.
- HashMap: key → node (O(1) lookup).
- Doubly Linked List: order theo recency. Head = mới nhất, Tail = cũ nhất.
- `get`: lookup hash → move node lên head.
- `put`: lookup → update + move; nếu key mới và full → remove tail.

```typescript
class LRUCache {
  private cache = new Map<number, number>();
  constructor(private capacity: number) {}

  get(key: number): number {
    if (!this.cache.has(key)) return -1;
    const value = this.cache.get(key)!;
    this.cache.delete(key);
    this.cache.set(key, value); // move to end (most recent)
    return value;
  }

  put(key: number, value: number): void {
    if (this.cache.has(key)) this.cache.delete(key);
    else if (this.cache.size >= this.capacity) {
      const oldest = this.cache.keys().next().value!;
      this.cache.delete(oldest);
    }
    this.cache.set(key, value);
  }
}
```

> JavaScript `Map` giữ insertion order → dùng được làm LRU đơn giản. Production nên dùng `lru-cache` (Node.js lib).

### Use case thực tế:
- Memory cache trong app.
- Redis có policy `maxmemory-policy allkeys-lru`.

---

# PHẦN 20: LINUX & OPERATING SYSTEMS

> Backend chạy trên Linux. Hiểu OS giúp em debug, tối ưu, troubleshoot production issue.

## 20.1. Process vs Thread?

**Câu hỏi:** Process và thread khác nhau ra sao?

**Trả lời:**

### Process:
- Đơn vị độc lập do OS quản lý.
- Có **memory space riêng** (virtual address space).
- Communication qua IPC (pipe, socket, shared memory).
- Tốn tài nguyên hơn (~MB RAM cho stack/heap riêng).
- Crash 1 process không ảnh hưởng process khác.

### Thread:
- Đơn vị thực thi **trong cùng process**.
- **Share memory** với thread khác cùng process.
- Communication qua shared variable + lock.
- Nhẹ (~KB stack).
- 1 thread crash → cả process chết.

### Trong Node.js:
- 1 Node.js = 1 process (V8 engine).
- Worker thread tạo thread (share `SharedArrayBuffer`).
- Cluster fork ra nhiều process.

### `fork()` system call:
- Copy process hiện tại thành child (copy-on-write).
- Child có PID khác, parent biết PID con.
- Linux dùng cho mọi process spawn.

---

## 20.2. File Descriptor?

**Câu hỏi:** File descriptor là gì? Limit ra sao?

**Trả lời:**

**File descriptor (FD)** = integer đại diện cho 1 "open file" trong Linux. **Mọi I/O đều là file** trong Linux:
- File thật (text, binary).
- Socket (network).
- Pipe.
- Stdin (0), Stdout (1), Stderr (2).

### Limit:
```bash
ulimit -n        # số FD tối đa mỗi process (default 1024)
ulimit -n 65535  # tăng
cat /proc/sys/fs/file-max   # system-wide
```

### Vì sao backend cần biết?
- Mỗi connection HTTP/TCP = 1 FD.
- Web server 10k connection → cần `ulimit -n 65535+`.
- **"Too many open files"** error → tăng limit, hoặc fix leak (forget to close).

### Check FD đang dùng:
```bash
ls /proc/<pid>/fd | wc -l    # đếm FD của process
lsof -p <pid>                 # liệt kê chi tiết
```

### Trong Node.js:
```javascript
process.getActiveResourcesInfo();  // các resource đang giữ event loop
```

---

## 20.3. Signal trong Linux?

**Câu hỏi:** SIGTERM, SIGKILL, SIGINT khác nhau?

**Trả lời:**

### Signal phổ biến:

| Signal | Số | Mô tả | Catchable |
|--------|----|----|-----------|
| SIGHUP | 1 | Terminal đóng / reload config | ✅ |
| SIGINT | 2 | Ctrl+C | ✅ |
| SIGQUIT | 3 | Ctrl+\ | ✅ |
| SIGKILL | 9 | **Force kill — không thể catch** | ❌ |
| SIGTERM | 15 | Polite termination (default `kill`) | ✅ |
| SIGSTOP | 19 | Pause | ❌ |
| SIGUSR1, SIGUSR2 | 10, 12 | User-defined | ✅ |

### Trong Node.js:
```javascript
process.on('SIGTERM', async () => {
  console.log('Graceful shutdown...');
  await server.close();
  await db.disconnect();
  process.exit(0);
});
```

### `kill` command:
```bash
kill <pid>         # SIGTERM (15)
kill -9 <pid>      # SIGKILL — last resort
kill -HUP <pid>    # SIGHUP — reload config
killall node       # mọi process tên 'node'
```

### Best practice:
- App nhận SIGTERM → cleanup → exit.
- K8s, Docker gửi SIGTERM trước, chờ `terminationGracePeriodSeconds` (default 30s), rồi SIGKILL.

---

## 20.4. /proc filesystem?

**Câu hỏi:** /proc là gì?

**Trả lời:**

`/proc` = filesystem ảo, view vào kernel & process. Đọc như file thường.

### Useful paths:
```bash
/proc/cpuinfo                 # info CPU
/proc/meminfo                 # info RAM
/proc/loadavg                 # load average
/proc/uptime
/proc/<pid>/status            # info process
/proc/<pid>/cmdline           # command
/proc/<pid>/environ           # env vars
/proc/<pid>/fd/               # FD đang mở
/proc/<pid>/limits            # ulimit của process
/proc/<pid>/maps              # memory map
/proc/<pid>/stat              # CPU usage
/proc/net/tcp                 # mọi TCP connection
/proc/sys/fs/file-max         # system FD max
```

### Ví dụ:
```bash
cat /proc/$(pgrep -f node)/status | grep -E 'VmRSS|Threads'
# VmRSS:    234567 kB         ← RAM
# Threads:  8                  ← số thread
```

---

## 20.5. Useful Linux commands cho backend?

**Câu hỏi:** Em hay dùng command nào để debug production?

**Trả lời:**

### CPU & Memory:
```bash
top              # real-time process
htop             # đẹp hơn (cần cài)
ps aux | grep node
free -h          # RAM
vmstat 1         # system stats every 1s
```

### Network:
```bash
netstat -tunlp           # listening port
ss -tunlp                # nhanh hơn (replacement)
ss -tn state established # active TCP connections
tcpdump -i eth0 port 3000  # sniff packet (cần sudo)
curl -v https://api.example.com
dig example.com         # DNS lookup
nslookup example.com
traceroute example.com
mtr example.com         # traceroute liên tục
```

### Disk:
```bash
df -h                # disk free
du -sh /var/log/*    # disk usage by directory
iostat -x 1          # I/O stats
```

### Log:
```bash
tail -f /var/log/app.log
grep -i error /var/log/app.log
grep -i error /var/log/app.log | wc -l
journalctl -u myservice -f       # systemd log
journalctl --since "1 hour ago"
```

### Process:
```bash
strace -p <pid>      # trace syscall (debug treo, slow)
lsof -p <pid>        # file/socket process mở
lsof -i :3000        # process đang nghe port 3000
```

### Search file:
```bash
find / -name "*.log" -size +100M
grep -r "TODO" src/
ag "function foo" .  # silver searcher (nhanh hơn grep)
rg "function foo"    # ripgrep (nhanh nhất)
```

---

## 20.6. OOM Killer?

**Câu hỏi:** Process bỗng nhiên bị kill, em check thế nào?

**Trả lời:**

**OOM (Out Of Memory) Killer** là cơ chế Linux khi RAM hết → chọn 1 process để kill.

### Check OOM kill:
```bash
dmesg | grep -i 'killed process'
# hoặc:
journalctl -k | grep -i oom
```

### OOM score:
- Mỗi process có `/proc/<pid>/oom_score`.
- Score cao → khả năng bị kill cao.
- Process ăn nhiều RAM → score cao.

### Tránh OOM kill:
```bash
echo -1000 > /proc/<pid>/oom_score_adj   # ưu tiên (không bị kill)
```

### Trong Docker/K8s:
- Set memory limit → container vượt limit bị OOM kill.
- Set `requests` thấp hơn `limits` → có "burst" tạm thời.

### Node.js & memory:
- Default heap = 1.7GB (V8 limit).
- Tăng: `node --max-old-space-size=4096 app.js` (4GB).

---

## 20.7. systemd service?

**Câu hỏi:** Em chạy Node.js app như systemd service thế nào?

**Trả lời:**

### File `/etc/systemd/system/myapp.service`:
```ini
[Unit]
Description=My Node App
After=network.target

[Service]
Type=simple
User=nodeuser
WorkingDirectory=/opt/myapp
ExecStart=/usr/bin/node dist/main.js
Restart=on-failure
RestartSec=10
Environment="NODE_ENV=production"
EnvironmentFile=/etc/myapp/env

# Limits
LimitNOFILE=65535

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=myapp

[Install]
WantedBy=multi-user.target
```

### Commands:
```bash
sudo systemctl daemon-reload
sudo systemctl start myapp
sudo systemctl enable myapp     # auto start on boot
sudo systemctl status myapp
sudo systemctl restart myapp
sudo journalctl -u myapp -f    # tail log
```

### So với PM2:
- systemd: tích hợp OS, đơn giản.
- PM2: cluster mode, dashboard, monitor, ecosystem.
- Có thể kết hợp: systemd → start PM2.

---

# PHẦN 21: GIT WORKFLOW

## 21.1. Git basic flow?

**Câu hỏi:** Em làm việc với Git như thế nào?

**Trả lời:**

### Basic commands:
```bash
git init / git clone <url>
git status
git add <file>            # stage
git add .                 # stage all
git commit -m "msg"
git push origin <branch>
git pull --rebase         # update branch (rebase thay vì merge)
git log --oneline --graph --all
git diff                  # working dir vs staged
git diff --cached         # staged vs last commit
```

### Branch:
```bash
git branch                # list local
git branch -a             # list all (incl. remote)
git checkout -b feature/login
git switch feature/login  # mới hơn checkout
git branch -d <branch>    # delete (safe)
git branch -D <branch>    # force delete
```

### Merge vs Rebase:

**Merge:**
```
A---B---C (main)
     \
      D---E (feature)

git merge feature →

A---B---C---M (main, M là merge commit)
     \   /
      D-E (feature)
```

**Rebase:**
```
A---B---C (main)
         \
          D'---E' (feature, đã rebase)
```
Lịch sử tuyến tính, sạch hơn nhưng "viết lại" history.

### Quy tắc vàng:
**Không rebase branch đã push public** (mọi người đang base trên đó).

---

## 21.2. Gitflow vs Trunk-based?

**Câu hỏi:** Em dùng branching strategy nào?

**Trả lời:**

### Gitflow:
```
master ───────────────────────────── (production)
   ↑                          ↑
   │                          │
develop ───────────────────── (integration)
   ↑     ↑       ↑
   │     │       │
feature/X feature/Y bugfix/Z
```
- `master` — production.
- `develop` — integration.
- `feature/*` — feature mới (branch từ develop).
- `release/*` — chuẩn bị release.
- `hotfix/*` — fix gấp production.

**Phù hợp:** Project có release cycle dài (mobile app, library).

### Trunk-based:
```
main ─────────────────────────
       ↑   ↑   ↑   ↑
       │   │   │   │
     short-lived feature branch (vài giờ - vài ngày)
```
- Tất cả merge vào `main` nhanh.
- Short-lived branch (vài giờ-1 ngày).
- Feature chưa xong → ẩn sau **feature flag**.
- Deploy `main` bất kỳ lúc nào.

**Phù hợp:** Web app, SaaS, deploy hàng ngày.

### GitHub Flow (giữa 2 cái):
- `main` luôn deployable.
- Feature branch ngắn → PR → review → merge.

### Pull Request flow:
1. Tạo branch từ main.
2. Commit, push.
3. Mở PR.
4. CI chạy test, lint.
5. Reviewer comment.
6. Approve → merge (squash, rebase, hoặc merge commit).

---

## 21.3. Git rebase interactive — squash, reword, drop?

**Câu hỏi:** Em đã dùng `git rebase -i` chưa?

**Trả lời:**

`git rebase -i HEAD~5` → mở editor:
```
pick abc123 first commit
pick def456 fix typo
pick ghi789 fix typo again
pick jkl012 add feature
pick mno345 wip
```

Options:
- `pick` — giữ commit.
- `reword` (r) — đổi message.
- `edit` (e) — pause để sửa code.
- `squash` (s) — gộp vào commit trước (giữ message của commit này).
- `fixup` (f) — gộp vào commit trước (drop message).
- `drop` (d) — xóa commit.
- `reorder` — đổi thứ tự dòng.

### Use case:
- Clean up history trước khi tạo PR (gộp "fix typo" "wip" vào commit chính).
- Đổi message sai chính tả.

### Khi nào KHÔNG?
- Branch đã push public và người khác base trên đó → KHÔNG rebase.

---

## 21.4. Conflict — Xử lý thế nào?

**Câu hỏi:** Em gặp conflict khi merge, xử lý ra sao?

**Trả lời:**

### Conflict markers:
```
<<<<<<< HEAD
your code (current branch)
=======
their code (incoming)
>>>>>>> feature
```

### Xử lý:
1. Mở file → đọc cả 2 phiên bản.
2. Edit: giữ logic đúng (có thể giữ cả 2, hoặc một, hoặc rewrite).
3. Xóa marker `<<<`, `===`, `>>>`.
4. `git add <file>`.
5. `git rebase --continue` (nếu rebase) hoặc `git commit` (nếu merge).

### Tool:
- VSCode có UI tích hợp.
- `git mergetool` mở external tool (kdiff3, meld, vimdiff).

### Abort:
```bash
git merge --abort
git rebase --abort
```

### Chiến lược cho conflict thường gặp:
- `package-lock.json` conflict → xóa, `npm install` lại.
- Migration file → tạo migration mới sau cùng.
- Generated file (proto, swagger) → regenerate.

---

## 21.5. Reset vs Revert vs Checkout?

**Câu hỏi:** 3 cái này khác nhau ra sao?

**Trả lời:**

### `git reset`:
**Di chuyển HEAD** về commit khác. Có 3 mode:

- `--soft`: chỉ di HEAD, giữ staged + working dir.
- `--mixed` (default): di HEAD, reset staged, giữ working dir.
- `--hard`: di HEAD, reset staged + working dir. **Mất changes!**

```bash
git reset --hard HEAD~3   # undo 3 commit cuối, mất hết
git reset HEAD~1          # undo commit cuối, giữ code
```

### `git revert`:
**Tạo commit mới** undo commit cũ. **An toàn cho public branch.**

```bash
git revert abc123   # tạo commit "Revert abc123"
```

### `git checkout` (cho file):
**Lấy file từ commit/branch khác** vào working dir.

```bash
git checkout HEAD -- file.ts   # khôi phục file về như commit cuối
git checkout main -- src/      # lấy folder src từ main
```

### `git restore` (Git 2.23+):
Tách trách nhiệm của `checkout`:
```bash
git restore file.ts                # discard changes
git restore --staged file.ts       # unstage
git restore --source=main file.ts  # lấy từ branch khác
```

### Cẩn thận với `git reset --hard`:
- Mất commit chưa push → check `git reflog` để recover.

---

## 21.6. Git hooks?

**Câu hỏi:** Git hook là gì?

**Trả lời:**

**Git hook** = script chạy tự động ở các event Git.

### Phổ biến:
- `pre-commit` — trước khi commit (lint, format, test).
- `commit-msg` — validate commit message (conventional commits).
- `pre-push` — trước khi push (run test).

### Husky + lint-staged (Node.js):
```bash
npm install -D husky lint-staged
npx husky install
```

```json
// package.json
{
  "lint-staged": {
    "*.ts": ["eslint --fix", "prettier --write"]
  }
}
```

```bash
# .husky/pre-commit
npx lint-staged
```

→ Mỗi commit, file `.ts` staged được auto-lint + format.

### Conventional commits:
```
feat(auth): add password reset
fix(api): handle null user
chore(deps): bump axios to 1.5
docs(readme): update install steps
test(user): add edge case test
refactor: extract validation logic
perf(db): add composite index
```

→ Auto-generate CHANGELOG.

---

## 21.7. Cherry-pick & Stash?

**Câu hỏi:** Cherry-pick và stash dùng khi nào?

**Trả lời:**

### Cherry-pick:
Lấy 1 commit từ branch khác sang branch hiện tại.

```bash
git cherry-pick abc123
git cherry-pick abc123..def456   # range
```

**Use case:** Hotfix trên main cần apply qua develop, hoặc copy bug fix qua branch khác.

### Stash:
Lưu tạm thay đổi chưa commit.

```bash
git stash               # save
git stash save "WIP"    # với message
git stash list          # xem
git stash pop           # apply + remove
git stash apply         # apply, giữ stash
git stash drop          # xóa stash
git stash branch new-branch  # tạo branch từ stash
```

**Use case:** Đang code dở phải switch branch để fix bug khác.

---

# PHẦN 22: NETWORKING DEEP DIVE

## 22.1. OSI Model & TCP/IP Model?

**Câu hỏi:** OSI model là gì? Layer nào quan trọng cho backend?

**Trả lời:**

### OSI 7 Layer (lý thuyết):

| # | Layer | Mô tả | Protocol/Device |
|---|-------|-------|----------------|
| 7 | Application | App protocol | HTTP, FTP, SMTP, DNS |
| 6 | Presentation | Encoding, encryption | TLS/SSL |
| 5 | Session | Connection state | NetBIOS, RPC |
| 4 | Transport | End-to-end, reliable | **TCP, UDP** |
| 3 | Network | Routing | **IP**, ICMP, OSPF |
| 2 | Data Link | Frame, MAC | Ethernet, Wi-Fi |
| 1 | Physical | Bit | Cable, signal |

### TCP/IP 4 Layer (thực tế):
1. **Link** (= 1+2 OSI).
2. **Internet** (= 3 OSI) — IP.
3. **Transport** (= 4 OSI) — TCP, UDP.
4. **Application** (= 5+6+7 OSI) — HTTP, WebSocket.

### Backend quan tâm layer nào?
- **Transport (L4)** — load balancer L4, TCP keep-alive.
- **Application (L7)** — HTTP, gRPC, WebSocket.

---

## 22.2. IPv4 vs IPv6?

**Câu hỏi:** Khác nhau?

**Trả lời:**

### IPv4:
- 32-bit (4 byte) — vd `192.168.1.1`.
- ~4.3 tỷ địa chỉ → đã cạn.
- NAT (Network Address Translation) để share IP.

### IPv6:
- 128-bit — vd `2001:0db8:85a3::8a2e:0370:7334`.
- 3.4 × 10³⁸ địa chỉ.
- No NAT.
- Header đơn giản hơn (header xử lý nhanh).
- Built-in IPsec.

### Triển khai:
- Dual stack (cả IPv4 + IPv6) phổ biến.
- Modern app phải hỗ trợ cả 2.

---

## 22.3. Public IP vs Private IP, NAT?

**Câu hỏi:** Em giải thích Private IP và NAT?

**Trả lời:**

### Private IP ranges (RFC 1918):
- `10.0.0.0/8`
- `172.16.0.0/12`
- `192.168.0.0/16`
- `127.0.0.0/8` — loopback.

→ Chỉ dùng nội bộ, không route public.

### NAT (Network Address Translation):
- Router public IP, nội bộ private IP.
- Router map `(private_ip, port) ↔ (public_ip, port_external)`.
- Nhiều device share 1 public IP.

```
Internet ←→ Router (public IP) ←→ Switch → device 1, 2, 3 (private)
```

### Port forwarding:
- Khi từ ngoài muốn vào trong (vd: SSH server tại nhà).
- Router config: `public_ip:2222 → 192.168.1.10:22`.

### Hệ quả cho backend:
- Server backend cần public IP (cloud) hoặc cloud public LB.
- User behind NAT → IP không unique (rate limit theo IP sẽ ảnh hưởng nhiều người).

---

## 22.4. Port, Socket?

**Câu hỏi:** Port là gì? Socket?

**Trả lời:**

### Port:
- 16-bit (0-65535).
- Phân biệt nhiều service trên cùng 1 IP.
- **Well-known ports** (0-1023): HTTP 80, HTTPS 443, SSH 22, MySQL 3306, PostgreSQL 5432, Redis 6379.
- **Registered** (1024-49151).
- **Dynamic** (49152-65535) — outbound port.

### Socket:
- = `(IP, Port, Protocol)`.
- 1 server "bind" 1 socket → listen.
- Mỗi client connect tạo 1 socket mới.

### Ví dụ:
```
Server bind:    server_ip:3000 (TCP)
Client connect: client_ip:54321 → server_ip:3000
```
→ TCP connection được định danh bằng tuple `(src_ip, src_port, dst_ip, dst_port)`.

### Kiểm tra port:
```bash
ss -tunlp                    # listening
ss -tn state established     # active
netstat -tan | grep :3000
lsof -i :3000                # process gì giữ port
```

---

## 22.5. TCP Keep-alive?

**Câu hỏi:** TCP keep-alive là gì?

**Trả lời:**

**Vấn đề:** TCP connection không có activity → các bên không biết bên kia còn sống hay đã chết.

### Keep-alive:
- Sau X giây idle → gửi probe packet.
- Nếu N lần không response → close connection.

### Linux setting:
```bash
sysctl net.ipv4.tcp_keepalive_time     # 7200 (2 giờ)
sysctl net.ipv4.tcp_keepalive_intvl    # 75 (75s giữa probe)
sysctl net.ipv4.tcp_keepalive_probes   # 9
```

### Tại sao quan trọng?
- Load balancer giữ connection idle → backend không biết LB chết → connection leak.
- Cloud (AWS NLB) tự đóng idle connection sau 350s → app cần keep-alive ngắn hơn.

### Trong Node.js HTTP keep-alive:
- HTTP/1.1 mặc định keep-alive: `Connection: keep-alive`.
- Server set `keepAliveTimeout`:
```javascript
app.listen(3000);
server.keepAliveTimeout = 65000; // 65s
server.headersTimeout = 66000;   // > keepAliveTimeout
```

---

## 22.6. TIME_WAIT, CLOSE_WAIT?

**Câu hỏi:** Server có nhiều CLOSE_WAIT, có vấn đề gì?

**Trả lời:**

### TCP states quan trọng:

```
LISTEN     - server listen
ESTABLISHED - đang trao đổi data
TIME_WAIT  - đã đóng, chờ packet stray
CLOSE_WAIT - **bên kia đã đóng**, mình chưa đóng
```

### TIME_WAIT:
- Bên active close → vào TIME_WAIT 2*MSL (~60-240s).
- Đảm bảo packet trễ không nhầm sang connection mới.
- **Bình thường**, không phải bug.
- Quá nhiều TIME_WAIT → cạn port (49152-65535).

### CLOSE_WAIT:
- Client đã FIN, server **chưa close socket**.
- **Là bug!** Code quên `socket.close()`.
- Tích lũy → cạn FD, memory leak.

### Check:
```bash
ss -tn state close-wait
netstat -an | awk '{print $6}' | sort | uniq -c
```

### Fix:
- Đảm bảo mọi exception path đều close socket.
- Trong Node.js: `try/finally` close, hoặc dùng stream pipe (auto cleanup).

---

## 22.7. DNS records?

**Câu hỏi:** Em biết những DNS record nào?

**Trả lời:**

| Record | Mô tả | Ví dụ |
|--------|-------|-------|
| **A** | Domain → IPv4 | example.com → 1.2.3.4 |
| **AAAA** | Domain → IPv6 | example.com → ::1 |
| **CNAME** | Alias domain | www → example.com |
| **MX** | Mail server | example.com → mail.google.com |
| **TXT** | Text (SPF, DKIM, verification) | "v=spf1 ..." |
| **NS** | Name server | dns1.example.com |
| **SOA** | Authority info | (start of authority) |
| **PTR** | Reverse (IP → domain) | dùng cho reverse DNS |
| **SRV** | Service location | _sip._tcp.example.com |

### TTL (Time To Live):
- Cache duration ở resolver.
- TTL ngắn → đổi nhanh, query nhiều.
- TTL dài → cache lâu, đổi chậm.

### Use case:
- **A/AAAA:** Mỗi domain phải có.
- **CNAME:** Subdomain trỏ đến CDN.
- **MX:** Email.
- **TXT:** SPF, DKIM (chống mạo danh email), domain verification (Google Workspace, AWS).

---

## 22.8. CIDR?

**Câu hỏi:** CIDR là gì? `10.0.0.0/24` có bao nhiêu IP?

**Trả lời:**

**CIDR (Classless Inter-Domain Routing):** notation cho IP range bằng cách viết `IP/prefix_length`.

### Cách đọc:
- `/n` = n bit đầu là network, 32-n bit còn lại là host.

```
10.0.0.0/24 =
  binary: 00001010.00000000.00000000.00000000
  24 bit network, 8 bit host
  range: 10.0.0.0 - 10.0.0.255
  total: 2^8 = 256 IP (sub 2 broadcast & network)
  usable: 254 IP
```

### Common:
| CIDR | IPs | Use case |
|------|-----|---------|
| /32 | 1 | 1 host |
| /24 | 256 | small subnet |
| /16 | 65536 | medium network |
| /8 | 16M | huge |
| /0 | all | "any" |

### Trong cloud (AWS VPC):
- VPC `10.0.0.0/16` (65k IP).
- Subnet `10.0.1.0/24` (256 IP cho 1 AZ).

---

## 22.9. HTTP Keep-Alive vs WebSocket?

**Câu hỏi:** HTTP keep-alive có giống WebSocket không?

**Trả lời:**

### HTTP Keep-Alive (HTTP/1.1):
- TCP connection **được tái sử dụng** cho nhiều HTTP request.
- Vẫn là **request-response** mô hình.
- Sau idle X giây → đóng.

### WebSocket:
- TCP connection **persistent**, **full-duplex**.
- Hai bên gửi data bất kỳ lúc nào.
- Không phải request-response.

→ Khác nhau **về model communication**, dù cả 2 đều "giữ connection".

---

## 22.10. CORS Preflight chi tiết?

**Câu hỏi:** Khi nào browser gửi preflight OPTIONS?

**Trả lời:**

### Simple Request (KHÔNG preflight):
- Method: `GET`, `HEAD`, `POST`.
- Content-Type: `application/x-www-form-urlencoded`, `multipart/form-data`, `text/plain`.
- Không có custom header (chỉ allowed: Accept, Accept-Language, Content-Language, Content-Type).
- Không upload qua XMLHttpRequest.

### Non-simple (cần preflight):
- Method khác (PUT, DELETE, PATCH).
- Content-Type `application/json`.
- Custom header (Authorization, X-Custom-*).
- Cookies với credentials.

### Preflight request:
```
OPTIONS /api/users HTTP/1.1
Origin: https://app.com
Access-Control-Request-Method: POST
Access-Control-Request-Headers: Authorization, Content-Type
```

### Preflight response:
```
HTTP/1.1 204 No Content
Access-Control-Allow-Origin: https://app.com
Access-Control-Allow-Methods: GET, POST, PUT, DELETE
Access-Control-Allow-Headers: Authorization, Content-Type
Access-Control-Allow-Credentials: true
Access-Control-Max-Age: 86400
```

`Max-Age` = cache preflight kết quả N giây → giảm preflight.

### Performance tip:
- Set `Access-Control-Max-Age: 86400` (1 ngày) → preflight chỉ chạy 1 lần / ngày.

---

# PHẦN 23: CLOUD & AWS BASICS

## 23.1. Cloud Service Models?

**Câu hỏi:** IaaS, PaaS, SaaS khác nhau?

**Trả lời:**

### IaaS (Infrastructure as a Service):
- VM, network, storage thô.
- Bạn quản OS, runtime, app.
- Ví dụ: **EC2, GCE, Azure VM**.

### PaaS (Platform):
- Runtime + scaling sẵn.
- Bạn chỉ deploy code.
- Ví dụ: **Heroku, Google App Engine, AWS Elastic Beanstalk, Render**.

### SaaS (Software):
- App hoàn chỉnh.
- Bạn chỉ dùng.
- Ví dụ: Gmail, Notion, Slack, Stripe.

### FaaS (Function as a Service) / Serverless:
- Function chạy on-demand.
- Pay per invocation.
- Ví dụ: **AWS Lambda, Vercel Functions, Cloudflare Workers**.

### So sánh trách nhiệm:

| Layer | On-premise | IaaS | PaaS | SaaS |
|-------|-----------|------|------|------|
| App | You | You | You | Vendor |
| Runtime | You | You | Vendor | Vendor |
| OS | You | You | Vendor | Vendor |
| Hardware | You | Vendor | Vendor | Vendor |

---

## 23.2. AWS Core Services?

**Câu hỏi:** Em đã dùng AWS chưa? Service nào?

**Trả lời:**

### Compute:
- **EC2** — Virtual machine.
- **Lambda** — Serverless function.
- **ECS/Fargate** — Container.
- **EKS** — Kubernetes managed.

### Storage:
- **S3** — Object storage (file, ảnh, backup).
- **EBS** — Block storage cho EC2.
- **EFS** — Network file system.

### Database:
- **RDS** — Managed SQL (PostgreSQL, MySQL).
- **DynamoDB** — NoSQL key-value/document.
- **ElastiCache** — Redis/Memcached managed.
- **Aurora** — High-performance MySQL/PostgreSQL.

### Network:
- **VPC** — Virtual network.
- **Route 53** — DNS.
- **CloudFront** — CDN.
- **ELB** — Load balancer (ALB L7, NLB L4).
- **API Gateway** — Managed API endpoint.

### Messaging:
- **SQS** — Queue (như RabbitMQ).
- **SNS** — Pub/Sub notification.
- **EventBridge** — Event bus.
- **Kinesis** — Stream (như Kafka).

### Identity:
- **IAM** — User & permission.
- **Cognito** — Auth cho app (login, JWT).

### Monitoring:
- **CloudWatch** — Metrics, logs, alarm.
- **X-Ray** — Distributed tracing.

---

## 23.3. EC2, S3, RDS cơ bản?

**Câu hỏi:** EC2 dùng ra sao?

**Trả lời:**

### EC2:
- Launch instance (chọn AMI, instance type, security group, key pair).
- SSH vào: `ssh -i key.pem ec2-user@ip`.
- Instance type: t3.micro (free tier), m5.large (general), c5.large (compute), r5.large (memory).
- Lưu ý: stop ≠ terminate. Terminate = mất ổ.

### S3:
- Bucket = container.
- Object có key (path-like) và value (file).
- Versioning, lifecycle (auto move to cold storage), encryption.
- Public/private (mặc định private).
- Access qua URL: `https://bucket.s3.amazonaws.com/key` (nếu public).

```typescript
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
const s3 = new S3Client({ region: 'ap-southeast-1' });
await s3.send(new PutObjectCommand({
  Bucket: 'my-bucket',
  Key: 'file.jpg',
  Body: buffer,
  ContentType: 'image/jpeg',
}));
```

### RDS:
- Managed DB → tự backup, patch, replica.
- Multi-AZ → HA (auto failover).
- Read replica → scale read.
- Snapshots → restore point-in-time.

---

## 23.4. IAM — Role, Policy, User?

**Câu hỏi:** IAM dùng để làm gì?

**Trả lời:**

**IAM (Identity & Access Management)** = quản lý ai có quyền gì trên AWS.

### Concepts:
- **User** — người (có credential).
- **Group** — gộp user.
- **Role** — gán cho service hoặc cross-account.
- **Policy** — JSON document defining permission.

### Policy example:
```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["s3:GetObject", "s3:PutObject"],
    "Resource": "arn:aws:s3:::my-bucket/*"
  }]
}
```

### Best practice:
- **Least privilege** — cấp quyền tối thiểu cần.
- **MFA** cho user.
- **Role for EC2** — không hard-code credential trong code.
- **No root account** for daily use.

### EC2 dùng S3 cách an toàn:
- Tạo IAM Role với S3 permission.
- Attach role vào EC2.
- App trong EC2 dùng SDK → SDK tự lấy temporary credential từ instance metadata.
- **Không cần** hard-code `AWS_ACCESS_KEY` trong code.

---

## 23.5. Lambda & Serverless?

**Câu hỏi:** Lambda là gì? Khi nào dùng?

**Trả lời:**

### Lambda:
- Function chạy on-demand.
- Trigger: HTTP (qua API Gateway), S3 event, SQS, schedule (CRON), DynamoDB stream.
- Pay per: invocation + duration.
- Auto-scale (concurrent).

```typescript
exports.handler = async (event) => {
  const body = JSON.parse(event.body);
  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Hello ' + body.name }),
  };
};
```

### Ưu:
- Không quản server.
- Auto-scale (10k+ concurrent).
- Pay per use.
- Tốt cho workload sporadic.

### Nhược:
- **Cold start** — lần đầu chạy chậm (vài trăm ms - vài giây).
- Max execution: 15 phút.
- Stateless (cần Redis/DynamoDB cho state).
- Vendor lock-in.

### Khi nào dùng?
- Webhook handler.
- Image processing (S3 upload → Lambda resize → S3).
- Cron job.
- API serverless với traffic không đều.

### Khi nào KHÔNG?
- Workload steady, high traffic → EC2/ECS cheaper.
- Long-running (> 15 phút).
- WebSocket persistent (cần dùng kèm WebSocket API Gateway).

---

## 23.6. VPC, Subnet, Security Group?

**Câu hỏi:** VPC, public subnet, private subnet?

**Trả lời:**

### VPC (Virtual Private Cloud):
- Mạng ảo riêng trong AWS.
- CIDR vd: `10.0.0.0/16`.

### Subnet:
- Chia VPC thành subnet, mỗi AZ.
- **Public subnet** — có route tới Internet Gateway → IP public, vào ra Internet.
- **Private subnet** — không Internet (an toàn). Đi Internet qua NAT Gateway.

### Architecture điển hình:
```
Internet
   ↓
Internet Gateway
   ↓
Public Subnet:      [ALB, Bastion host]
   ↓
Private Subnet:     [App servers, RDS, Redis]
   ↑
NAT Gateway (cho app gọi out)
```

→ DB không expose trực tiếp Internet, chỉ ALB public.

### Security Group:
- Firewall ở instance level.
- Stateful: allow inbound → response tự cho out.
- Rule: allow `port 3000 from 0.0.0.0/0`.

### NACL (Network ACL):
- Firewall ở subnet level.
- Stateless: phải allow cả 2 chiều.

---

## 23.7. SQS, SNS, EventBridge?

**Câu hỏi:** Khi nào dùng cái nào?

**Trả lời:**

### SQS (Simple Queue Service):
- Queue (giống RabbitMQ).
- Standard (at-least-once) hoặc FIFO (exactly-once trong group).
- Pull model.
- Dead letter queue có sẵn.

### SNS (Simple Notification Service):
- Pub/Sub.
- 1 topic → nhiều subscriber (SQS, Lambda, Email, SMS).
- Push model.

### EventBridge:
- Event bus với routing rules.
- Filter event qua pattern.
- Tích hợp 100+ AWS service + third-party.

### Combo phổ biến:
```
Service A → SNS topic
              ↓ (fan-out)
        ┌─────┼─────┐
       SQS-1 SQS-2 Lambda
        ↓     ↓
     Worker-1 Worker-2
```

→ Mỗi worker xử lý event độc lập, có queue đệm.

---

# PHẦN 24: PERFORMANCE & PROFILING

## 24.1. Latency Numbers Every Programmer Should Know?

**Câu hỏi:** Em biết thứ tự độ lớn của các operation không?

**Trả lời:**

| Operation | Latency | Tương quan (nếu CPU = 1s) |
|-----------|---------|---------------------------|
| L1 cache hit | 0.5 ns | 1 giây |
| Branch mispredict | 5 ns | 10 giây |
| L2 cache | 7 ns | 14 giây |
| Mutex lock/unlock | 25 ns | 50 giây |
| RAM access | 100 ns | 3 phút |
| Compress 1KB (zstd) | 3 μs | 100 phút |
| Send 1KB over 1Gbps | 10 μs | 5 giờ |
| SSD read (4KB) | 150 μs | 3 ngày |
| Read 1MB sequential RAM | 250 μs | 5 ngày |
| Round-trip in same DC | 500 μs | 11 ngày |
| Read 1MB sequential SSD | 1 ms | 23 ngày |
| HDD seek | 10 ms | 8 tháng |
| Read 1MB sequential HDD | 20 ms | 16 tháng |
| Packet US → EU → US | 150 ms | 12 năm |

### Take-away:
- **Network 100,000x chậm hơn RAM** → cache!
- **Disk 100,000x chậm hơn RAM** → tận dụng RAM.
- **Sequential nhanh hơn random** → batch I/O.
- **Network DC nội bộ ~ 0.5ms** → microservice không phải free.

---

## 24.2. Profiling Node.js?

**Câu hỏi:** Em profile Node.js app thế nào?

**Trả lời:**

### 1. CPU profiling:
```bash
node --inspect app.js
# Mở chrome://inspect → Profiler tab → start → ... → stop
```

Hoặc `--prof`:
```bash
node --prof app.js
node --prof-process isolate-0xnnn-v8.log > processed.txt
```

### 2. Memory profiling:
- Heap snapshot trong Chrome DevTools.
- So sánh 2 snapshot → tìm object tăng bất thường.
- Tool: `clinic.js`, `0x` (flame graph).

```bash
npx clinic doctor -- node app.js
npx clinic flame -- node app.js
```

### 3. Production:
- **APM:** New Relic, Datadog, Sentry, Elastic APM.
- Tự lấy heap snapshot lúc memory cao: `process.kill(pid, 'SIGUSR2')`.

### 4. Event loop monitoring:
```javascript
const start = process.hrtime();
setImmediate(() => {
  const [s, ns] = process.hrtime(start);
  const lagMs = s * 1000 + ns / 1e6;
  if (lagMs > 100) console.warn('Event loop lag:', lagMs);
});
```

Lag > 100ms = event loop bị block bởi sync code.

---

## 24.3. Tối ưu Database Query?

**Câu hỏi:** Em tối ưu query chậm theo quy trình nào?

**Trả lời:**

### Quy trình:
1. **Identify** query chậm (slow query log).
2. **EXPLAIN** xem plan execution.
3. **Fix:** Index, refactor query, cache.
4. **Verify** với load test.

### Slow query log:
```sql
-- MySQL
SET GLOBAL slow_query_log = 'ON';
SET GLOBAL long_query_time = 1; -- log query > 1s
```

```sql
-- PostgreSQL
ALTER SYSTEM SET log_min_duration_statement = 1000;  -- ms
SELECT pg_reload_conf();
```

### Common fixes:
1. **Missing index** — EXPLAIN cho `type: ALL` → thêm index.
2. **N+1** — dùng JOIN hoặc batch query.
3. **SELECT *** — chỉ lấy field cần.
4. **OR → IN/UNION** — đôi khi `OR` không dùng được index.
5. **Function trên column** — `WHERE YEAR(date) = 2024` → `WHERE date >= '2024-01-01'`.
6. **Subquery → JOIN** — đôi khi JOIN nhanh hơn.
7. **LIMIT** khi không cần all.
8. **Denormalize** field hot.
9. **Materialized view** cho query phức tạp lặp lại.
10. **Partition** bảng cực lớn (theo ngày, theo user).

### Connection pool:
- Đo: `SHOW PROCESSLIST` (MySQL), `pg_stat_activity` (PostgreSQL).
- Pool quá nhỏ → request chờ.
- Pool quá lớn → DB quá tải.

---

## 24.4. V8 Engine, Hidden Classes?

**Câu hỏi:** Vì sao thêm field vào object đã tạo sẽ chậm?

**Trả lời:**

V8 (engine của Node.js, Chrome) dùng **hidden class** để optimize.

### Cách hoạt động:
- Object cùng shape (cùng field, cùng thứ tự) → share hidden class.
- V8 inline cache code → truy cập field nhanh như array.

### Anti-pattern:
```typescript
// ❌ Bad — 2 object có shape khác nhau
const p1 = {};
p1.x = 1;
p1.y = 2;

const p2 = {};
p2.y = 1;  // ⚠ thứ tự khác
p2.x = 2;
// V8 tạo 2 hidden class khác → deoptimize.

// ✅ Good
const p1 = { x: 1, y: 2 };
const p2 = { x: 2, y: 1 };
// Cùng shape.
```

### Cảnh báo:
- **Đừng** xóa field (`delete obj.x`) → tạo hidden class mới.
- **Đừng** thêm field động.
- Khai báo class với constructor để cố định shape.

### TypeScript hint:
```typescript
class Point {
  constructor(public x: number, public y: number) {}
}
```

V8 dễ optimize hơn.

---

## 24.5. Memory leak debug?

**Câu hỏi:** App RAM tăng dần không giảm, em debug thế nào?

**Trả lời:**

### Quy trình:
1. **Monitor:** `process.memoryUsage()` log mỗi N phút.
2. **Snapshot:** Gắn debugger, take heap snapshot lúc app khởi động và sau X giờ.
3. **Diff:** So sánh — class/array nào tăng nhiều?
4. **Trace retain path:** Tại sao GC không free? Object đang được giữ bởi ai?

### Cause phổ biến:
1. **Global cache không giới hạn** — dùng `lru-cache`.
2. **Event listener leak** — `removeListener` khi unmount.
3. **Closure giữ big object.**
4. **Timer không clear.**
5. **Outgoing HTTP not consuming response body** (Node.js sẽ leak).

### Code pattern an toàn:
```typescript
// Cache có giới hạn
import LRU from 'lru-cache';
const cache = new LRU({ max: 1000, ttl: 60_000 });

// Cleanup listener
class Worker {
  private timer: NodeJS.Timer;
  start() {
    this.timer = setInterval(() => this.tick(), 1000);
  }
  stop() {
    clearInterval(this.timer);
  }
}

// Consume response
const res = await fetch(url);
await res.text(); // hoặc res.body.dispose()
```

---

## 24.6. p50, p95, p99 — Percentile?

**Câu hỏi:** p99 là gì? Vì sao quan trọng?

**Trả lời:**

**Percentile** = giá trị mà N% sample dưới giá trị này.

- **p50 (median):** 50% request nhanh hơn → "median latency".
- **p95:** 95% request nhanh hơn → 5% chậm hơn.
- **p99:** 99% — 1% slowest.

### Vì sao không dùng average?
- Average dễ bị skew bởi outlier.
- 99 request 10ms + 1 request 10s → average 100ms, nhưng đa số user thấy 10ms.
- **p99 phản ánh "worst experience"** mà tỷ lệ đáng kể user gặp.

### Ví dụ:
- p50 = 50ms — đa số nhanh.
- p99 = 2000ms — 1% user thấy chậm.
- Với 1 triệu request/ngày → 10,000 user gặp 2s.

### Best practice:
- Dashboard luôn show **p50, p95, p99** (không chỉ avg).
- Alert dựa p99 hoặc p99.9.
- Tail latency thường do: GC, lock contention, slow query lúc cold cache.

### Trong dự án em:
"Soak test 1000 RPS, p99 < 500ms" — phải đo p99 chứ không avg.

---

# PHẦN 25: XỬ LÝ THỰC TẾ (Money, Time, i18n)

## 25.1. Money — Vì sao không dùng float?

**Câu hỏi:** Em lưu giá tiền thế nào? Vì sao không dùng `float`/`double`?

**Trả lời:**

### Vấn đề float:
```javascript
0.1 + 0.2 === 0.3  // false (!)
0.1 + 0.2  // 0.30000000000000004
```
Float dùng binary nên không biểu diễn chính xác 0.1, 0.2.

### Hậu quả:
- 1 cent sai khi cộng → user khiếu nại.
- Round-off compound qua nhiều transaction.
- Kế toán không match → audit fail.

### Cách đúng:

**1. Lưu integer (cent):**
```javascript
// Tiền $19.99 → lưu 1999 (cents)
const priceInCents = 1999;
const totalInCents = priceInCents * 3;  // 5997 = $59.97
```

→ Không float, an toàn cộng trừ.

**2. Decimal type ở DB:**
- PostgreSQL: `DECIMAL(15,2)` — 15 digit, 2 sau dấu phẩy.
- MySQL: tương tự.
- Trong code: dùng library `decimal.js`, `big.js`, hoặc Java `BigDecimal`.

```typescript
import Decimal from 'decimal.js';
const a = new Decimal('0.1');
const b = new Decimal('0.2');
console.log(a.plus(b).toString());  // '0.3' ✅
```

### Tiền tệ:
- Lưu kèm currency code (ISO 4217): `USD`, `VND`, `EUR`.
- Convert ở 1 chỗ tập trung (tránh round nhiều lần).
- Tỷ giá: fetch định kỳ, cache.

### Trong project:
- Sacred Dragon Warriors: lưu currency là integer.
- PayOS trả về VND số nguyên (không có cent).

---

## 25.2. Time Zone — Lưu UTC?

**Câu hỏi:** Em lưu thời gian thế nào? UTC hay local?

**Trả lời:**

### Quy tắc:
- **Lưu UTC ở DB và backend.**
- **Convert sang local timezone CHỈ khi hiển thị cho user.**

### Vì sao?
- User ở nhiều timezone, server có thể ở khác nữa.
- Daylight Saving Time → giờ có thể "lặp" hoặc "skip" → bug.
- UTC không có DST, ổn định.

### Format ISO 8601:
```
2024-01-15T10:30:00Z          (UTC, Z = Zulu = +00:00)
2024-01-15T17:30:00+07:00     (Vietnam)
```

### Trong code:
```typescript
// Lưu DB
const now = new Date();  // V8 mặc định UTC bên trong
const isoString = now.toISOString();  // "2024-01-15T03:30:00.000Z"

// Hiển thị (frontend làm là tốt nhất)
new Date('2024-01-15T03:30:00Z').toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
```

### Library:
- **date-fns**, **dayjs** (gọn, immutable).
- **luxon** (timezone tốt).
- **moment** (deprecated, lớn).

### Lưu ý:
- Đừng dùng `new Date('2024-01-15')` (không Z) → tùy browser interpret local hoặc UTC.
- Luôn append `Z` hoặc offset rõ.
- Lưu cả `createdAt` (UTC) lẫn `timezone` của user nếu cần (vd: report theo timezone user).

### Cron job với timezone:
```typescript
@Cron('0 9 * * *', { timeZone: 'Asia/Ho_Chi_Minh' })
async sendDailyReport() { /* chạy 9:00 GMT+7 */ }
```

---

## 25.3. Date arithmetic — Pitfalls?

**Câu hỏi:** "30 ngày sau" tính thế nào?

**Trả lời:**

### Pitfall 1: Tháng có 28-31 ngày
```typescript
const d = new Date('2024-01-31');
d.setMonth(d.getMonth() + 1);  // "2024-03-02" — không phải Feb!
```
JS overflow ngày → tự nhảy tháng.

### Pitfall 2: DST
- Mỹ đổi DST → 24h sau không phải lúc nào cũng "cùng giờ ngày sau".
- Vietnam không DST → ít gặp.

### Đúng:
```typescript
import { addDays, addMonths } from 'date-fns';
addDays(new Date(), 30);
addMonths(new Date('2024-01-31'), 1);  // 2024-02-29 (clamp)
```

### Lưu ý "ngày":
- "Hôm nay" của user phụ thuộc timezone user.
- Server hỏi: "hôm nay là ngày bao nhiêu của user?" — phải biết timezone user.

---

## 25.4. i18n (Internationalization)?

**Câu hỏi:** Em làm app đa ngôn ngữ thế nào?

**Trả lời:**

### Concepts:
- **i18n** (Internationalization) — code sẵn sàng cho nhiều ngôn ngữ.
- **L10n** (Localization) — bản dịch cụ thể.

### Backend trả gì?

**Option 1: Trả message key:**
```json
{ "error": { "code": "USER_NOT_FOUND" } }
```
Frontend lookup `USER_NOT_FOUND` → "Không tìm thấy user" hoặc "User not found".

**Option 2: Trả message theo Accept-Language:**
```
GET /users/123
Accept-Language: vi-VN

→ { "error": "Không tìm thấy user" }
```

→ Option 1 sạch hơn, option 2 đơn giản hơn.

### NestJS i18n:
```typescript
// nestjs-i18n
@Get(':id')
async findOne(@I18n() i18n: I18nContext) {
  throw new NotFoundException(i18n.t('error.user_not_found'));
}
```

### Format số, tiền, ngày:
- JS `Intl`:
```javascript
new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' })
  .format(1500000);  // "1.500.000 ₫"

new Intl.DateTimeFormat('vi-VN').format(new Date());  // "15/01/2024"
```

### Pitfalls:
- Plural rules khác nhau (Anh: 1/many; Slavic: 1/few/many).
- Right-to-left language (Arabic, Hebrew) — UI consider.
- Hardcode string trong code → khó dịch.

---

## 25.5. Pagination response format?

**Câu hỏi:** Format chuẩn cho paginated response?

**Trả lời:**

### Offset-based:
```json
{
  "data": [...],
  "meta": {
    "total": 1000,
    "page": 1,
    "limit": 20,
    "totalPages": 50
  }
}
```

### Cursor-based:
```json
{
  "data": [...],
  "meta": {
    "nextCursor": "eyJpZCI6MTIzfQ==",
    "hasNext": true
  }
}
```

→ Cursor nên là **opaque** (base64-encoded JSON) để client không depend on format → backend đổi internal được.

### REST chuẩn:
- Query: `?page=1&limit=20` hoặc `?cursor=xxx&limit=20`.
- Có thể đặt `total` trong header `X-Total-Count: 1000`.

### GraphQL Relay-style:
```graphql
{
  users(first: 20, after: "cursor") {
    edges { node { id name } cursor }
    pageInfo { hasNextPage endCursor }
  }
}
```

---

# PHẦN 26: ANTI-PATTERNS & MISTAKES TO AVOID

## 26.1. God Object / God Class?

**Câu hỏi:** Code smell em hay tránh?

**Trả lời:**

**God Object/Class** = class chứa quá nhiều trách nhiệm.

### Triệu chứng:
- File > 1000 dòng.
- Class với 30+ method.
- Tên class chung chung: `Manager`, `Helper`, `Util`.
- Vi phạm SRP.

### Refactor:
- Tách theo trách nhiệm (UserService, EmailService, ReportService).
- Extract method, extract class.

---

## 26.2. Magic Number / Magic String?

**Câu hỏi:**

**Trả lời:**

**Magic value** = hardcoded value không có ý nghĩa rõ.

```typescript
// ❌
if (status === 3) { ... }
setTimeout(retry, 30000);

// ✅
const ORDER_STATUS = { PENDING: 1, PAID: 2, SHIPPED: 3, DELIVERED: 4 } as const;
const RETRY_DELAY_MS = 30_000;

if (status === ORDER_STATUS.SHIPPED) { ... }
setTimeout(retry, RETRY_DELAY_MS);
```

---

## 26.3. Premature Optimization?

> "Premature optimization is the root of all evil." — Donald Knuth

**Trả lời:**

Đừng tối ưu khi chưa đo. Đo first, optimize second.

### Pattern:
1. **Make it work** — code chạy đúng.
2. **Make it right** — code clean, dễ đọc.
3. **Make it fast** — optimize khi cần (đã đo).

### Khi nào optimize?
- Bottleneck đã profile.
- Yêu cầu performance cụ thể.

### Khi nào KHÔNG?
- "Tôi nghĩ chỗ này có thể chậm" — nhưng chưa đo.
- "Code này không gọn" — vì optimization khó đọc.

---

## 26.4. Callback Hell?

**Trả lời:**

```typescript
// ❌ Callback hell
getUser(id, (err, user) => {
  if (err) return cb(err);
  getOrders(user.id, (err, orders) => {
    if (err) return cb(err);
    getPayment(orders[0].id, (err, payment) => {
      if (err) return cb(err);
      // ...
    });
  });
});

// ✅ async/await
try {
  const user = await getUser(id);
  const orders = await getOrders(user.id);
  const payment = await getPayment(orders[0].id);
} catch (err) {
  // ...
}
```

---

## 26.5. Catch & Ignore?

**Trả lời:**

```typescript
// ❌ Anti-pattern
try {
  await doSomething();
} catch (e) {
  // ignore
}
```

→ Bug ẩn, không log, không monitor.

```typescript
// ✅
try {
  await doSomething();
} catch (e) {
  logger.error('failed to doSomething', { error: e.message, stack: e.stack });
  // Quyết định: rethrow, fallback, hoặc skip + alert.
  throw e;
}
```

### Trừ trường hợp:
- Optional operation (cleanup, analytics): log + continue.
- Nhưng vẫn phải log.

---

## 26.6. Silent Data Loss?

**Trả lời:**

```typescript
// ❌
await db.user.update({ ...user, ...patch });
// Patch không có field email → email = undefined → DB set NULL → mất data
```

```typescript
// ✅
const updates = pick(patch, ['name', 'avatar']); // chỉ allowed field
await db.user.update({ ...user, ...updates });
```

→ Validate input, whitelist field.

---

## 26.7. Hard-coded credentials?

**Trả lời:**

```typescript
// ❌
const db = mysql.createConnection({
  password: 'admin123',  // 🚨 commit lên git
});

// ✅
const db = mysql.createConnection({
  password: process.env.DB_PASSWORD,
});
```

- `.env` file NOT commit (`.gitignore`).
- Secret rotation định kỳ.
- Production: dùng secret manager (AWS Secrets Manager, Vault).

### Nếu lỡ commit credential:
1. **Rotate ngay** (thay password ngay).
2. `git filter-branch` hoặc BFG repo cleaner xóa khỏi history.
3. Force push (lưu ý team).

---

## 26.8. Boolean Argument Hell?

**Trả lời:**

```typescript
// ❌
function createUser(name, email, true, false, true, 30) {}
// True, false, true, 30 — đoán không ra

// ✅
function createUser({ name, email, isAdmin, sendWelcomeMail, isActive, age }) {}
createUser({ name, email, isAdmin: true, sendWelcomeMail: false, isActive: true, age: 30 });
```

Object argument tự document.

---

## 26.9. Trying to be clever?

```typescript
// ❌ Smart-ass
const result = arr.reduce((a, c, i, A) => /* ... 5 dòng cryptic */ , {});

// ✅ Boring (good)
const result = {};
for (const item of arr) {
  // logic rõ ràng
}
```

> "Programs should be written for people to read, and only incidentally for machines to execute." — Abelson & Sussman

---

## 26.10. Anti-pattern em phải biết để khỏi mắc:

- **Singleton** lạm dụng (global state).
- **Static** method khắp nơi (khó test).
- **Inheritance** sâu (> 3 level) — prefer composition.
- **Side-effect** trong getter.
- **Mutate parameter** truyền vào.
- **Long parameter list** (> 4-5).
- **Feature envy** — class A truy cập thuộc tính class B nhiều hơn của mình.
- **Shotgun surgery** — đổi 1 thứ phải sửa 10 file.
- **Primitive obsession** — dùng string/number cho concept domain (vd: dùng `string` cho email thay vì `Email` value object).

---

# PHẦN 27: CHEATSHEET & QUICK REFERENCE

## 27.1. HTTP Status Code — Mnemonic

```
1xx — Hold on (Informational)
2xx — Here you go (Success)
3xx — Go away (Redirect)
4xx — You messed up (Client Error)
5xx — I messed up (Server Error)
```

| Code | Khi nào |
|------|---------|
| 200 | OK general |
| 201 | Created (POST success) |
| 204 | No Content (DELETE success) |
| 301 | Permanent redirect (SEO friendly) |
| 302 | Temp redirect |
| 304 | Not Modified (cache hit) |
| 400 | Bad Request (validation) |
| 401 | Unauthorized (chưa login) |
| 403 | Forbidden (login rồi, không quyền) |
| 404 | Not Found |
| 409 | Conflict (vd: email exists) |
| 422 | Unprocessable Entity (validation business) |
| 429 | Too Many Requests (rate limit) |
| 500 | Internal Server Error |
| 502 | Bad Gateway (upstream sai) |
| 503 | Service Unavailable (overload) |
| 504 | Gateway Timeout |

---

## 27.2. Big-O Cheatsheet

| Cấu trúc | Access | Search | Insert | Delete |
|----------|--------|--------|--------|--------|
| Array | O(1) | O(n) | O(n) | O(n) |
| Linked List | O(n) | O(n) | O(1) | O(1) |
| Stack | O(n) | O(n) | O(1) | O(1) |
| Queue | O(n) | O(n) | O(1) | O(1) |
| Hash Table | N/A | O(1) avg | O(1) avg | O(1) avg |
| BST avg | O(log n) | O(log n) | O(log n) | O(log n) |
| BST worst | O(n) | O(n) | O(n) | O(n) |
| AVL/Red-Black | O(log n) | O(log n) | O(log n) | O(log n) |
| Heap | O(1) min/max | O(n) | O(log n) | O(log n) |

---

## 27.3. SQL Quick Reference

```sql
-- Read
SELECT col1, col2 FROM table WHERE cond ORDER BY col LIMIT 10 OFFSET 20;

-- Aggregate
SELECT user_id, COUNT(*) AS cnt FROM orders
GROUP BY user_id HAVING cnt > 5
ORDER BY cnt DESC;

-- JOIN
SELECT u.name, o.total FROM users u
INNER JOIN orders o ON u.id = o.user_id
WHERE o.status = 'paid';

-- Insert
INSERT INTO users (name, email) VALUES ('Đăng', 'a@b.com');

-- Update
UPDATE users SET name = 'Đăng' WHERE id = 1;

-- Delete
DELETE FROM users WHERE id = 1;

-- Transaction
BEGIN;
  UPDATE accounts SET balance = balance - 100 WHERE id = 1;
  UPDATE accounts SET balance = balance + 100 WHERE id = 2;
COMMIT;

-- Index
CREATE INDEX idx_user_email ON users(email);
CREATE UNIQUE INDEX idx_user_email ON users(email);
CREATE INDEX idx_orders_user_status ON orders(user_id, status);

-- Window function
SELECT name, salary,
  ROW_NUMBER() OVER (PARTITION BY dept ORDER BY salary DESC) AS rank
FROM employees;

-- CTE
WITH active_users AS (
  SELECT * FROM users WHERE active = true
)
SELECT * FROM active_users WHERE created_at > '2024-01-01';

-- Upsert (PostgreSQL)
INSERT INTO users (id, name) VALUES (1, 'Đăng')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- Upsert (MySQL)
INSERT INTO users (id, name) VALUES (1, 'Đăng')
ON DUPLICATE KEY UPDATE name = VALUES(name);
```

---

## 27.4. Linux Command Cheatsheet

```bash
# Process
ps aux | grep node
kill -TERM <pid>
htop

# File
find / -name "*.log" -mtime -7
grep -r "pattern" .
tail -f /var/log/app.log
du -sh *

# Network
ss -tunlp
curl -X POST -H "Content-Type: application/json" -d '{"key":"val"}' https://api.example.com
dig example.com
mtr -n example.com

# Disk
df -h
iostat -x 1

# Permission
chmod 755 file
chown user:group file

# Compress
tar czf out.tar.gz dir/
tar xzf in.tar.gz

# SSH
ssh -i key.pem user@host
scp file user@host:/path

# JSON in shell
curl ... | jq '.data[].name'
```

---

## 27.5. Docker Commands

```bash
# Image
docker build -t myimg:v1 .
docker images
docker rmi myimg:v1
docker pull node:20-alpine

# Container
docker run -d --name app -p 3000:3000 myimg:v1
docker ps
docker ps -a              # incl. stopped
docker logs -f app
docker exec -it app sh    # shell into
docker stop app
docker rm app

# Cleanup
docker system prune       # remove unused
docker system df          # disk usage

# Compose
docker compose up -d
docker compose logs -f api
docker compose down -v    # also remove volumes
```

---

## 27.6. Git Cheatsheet

```bash
# Setup
git config --global user.name "Đăng"
git config --global user.email "..."

# Daily flow
git status
git add .
git commit -m "feat: add X"
git push

# Branch
git checkout -b feature/x
git checkout main
git merge feature/x
git branch -d feature/x

# Sync
git fetch
git pull --rebase

# Undo
git restore file              # discard changes
git restore --staged file     # unstage
git reset HEAD~1              # undo last commit (keep changes)
git revert <sha>              # safe undo for public branch

# Stash
git stash
git stash pop

# History
git log --oneline --graph --all
git blame file
git diff main..feature

# Tag
git tag v1.0.0
git push origin v1.0.0
```

---

## 27.7. Regex Cheatsheet (Backend hay dùng)

```
^         start
$         end
.         any char
*         0+
+         1+
?         0 or 1
{n,m}     n to m times
[abc]     a, b, or c
[^abc]    not a, b, c
\d        digit
\w        word char (a-z, 0-9, _)
\s        whitespace
\b        word boundary
(...)     capture group
(?:...)   non-capture
(?=...)   lookahead
```

**Examples:**
```typescript
/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/  // email basic
/^\+?[\d\s-]{10,15}$/                                // phone
/^\d{4}-\d{2}-\d{2}$/                                // YYYY-MM-DD
```

⚠ **Cẩn thận ReDoS:** Regex tham lam có thể chậm exponential với input đặc biệt. Test với input dài.

---

## 27.8. Network Ports cần nhớ

| Port | Service |
|------|---------|
| 20, 21 | FTP |
| 22 | SSH |
| 25 | SMTP |
| 53 | DNS |
| 80 | HTTP |
| 110 | POP3 |
| 143 | IMAP |
| 443 | HTTPS |
| 465 | SMTPS |
| 587 | SMTP submission |
| 993 | IMAPS |
| 995 | POP3S |
| 1433 | SQL Server |
| 3306 | MySQL |
| 3389 | RDP |
| 5432 | PostgreSQL |
| 5672 | RabbitMQ |
| 6379 | Redis |
| 8080 | HTTP alt |
| 9092 | Kafka |
| 27017 | MongoDB |

---

## 27.9. Common Time Conversion

```
1 ms = 0.001 s
1 s = 1,000 ms = 1,000,000 μs = 1,000,000,000 ns

1 phút = 60 s
1 giờ = 3,600 s
1 ngày = 86,400 s ≈ 86.4k
1 tuần = 604,800 s
1 năm ≈ 31,536,000 s ≈ 31.5M
```

**Trong code:**
```typescript
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

// JWT 15 phút
expiresIn: '15m'  // hoặc 15 * 60

// Redis TTL 1 ngày
redis.set(key, val, 'EX', 86400);
```

---

## 27.10. Conventional Commit Types

```
feat:     thêm feature mới
fix:      sửa bug
docs:     thay đổi document
style:    format (không sửa logic)
refactor: refactor code (không thêm feature/fix)
perf:     cải thiện performance
test:     thêm/sửa test
chore:    maintenance (deps, build config)
ci:       CI/CD config
revert:   revert commit trước
```

**Format:**
```
<type>(<scope>): <subject>

<body — optional, giải thích vì sao>

<footer — optional, BREAKING CHANGE, Closes #123>
```

**Examples:**
```
feat(auth): add password reset
fix(api): handle null user in /profile
chore(deps): bump axios to 1.5
refactor: extract validation to pipe
docs(readme): update install instructions

BREAKING CHANGE: response format of /users changed
Closes #234
```

---


- [ ] Đọc qua tài liệu này 2-3 lần.
- [ ] Practice nói thành tiếng các câu CV (ghi âm lại nghe).
- [ ] Research công ty: domain, tech stack, team blog, GitHub.
- [ ] Chuẩn bị 5-7 câu hỏi cho interviewer.
- [ ] Test camera, micro, internet (nếu remote).
- [ ] Ngủ đủ.

## Trong phỏng vấn:
- [ ] Tự tin nhưng không tự cao.
- [ ] **Trung thực** — không biết thì nói không biết.
- [ ] Suy luận to (think aloud) cho câu khó.
- [ ] Hỏi clarification khi câu hỏi mơ hồ.
- [ ] Đưa example từ project khi giải thích concept.
- [ ] Nối với CV: "ở project X em đã làm tương tự bằng cách...".

## Sau phỏng vấn:
- [ ] Gửi email cảm ơn trong 24h.
- [ ] Ghi lại câu hỏi gặp, câu trả lời chưa tốt → improve.
- [ ] Đừng quá lo lắng về kết quả — học từ process.

---

## 📌 CHECKLIST CV CẦN SỬA TRƯỚC PHỎNG VẤN:

1. **"0% partial-failure"** → đổi thành "đảm bảo eventual consistency qua Outbox pattern, không quan sát thấy partial-failure trong test sample".
2. **"95% deployment success"** → đổi thành "478 deployment qua CI/CD, đa số rolling-update zero-downtime".
3. **"1 year experience" + "14 services"** → trong CV không cần đổi, nhưng khi nói: "project cá nhân học pattern, không phải production scale".
4. **"~70% latency reduction"** → giữ nguyên nếu có evidence cụ thể (trước/sau, endpoint cụ thể).
5. **"1000 RPS soak test"** → ghi rõ "synthetic test in staging, k6 script" trong khi nói.

---

**CHÚC EM PHỎNG VẤN THÀNH CÔNG! 🚀**

> "The expert in anything was once a beginner." — Helen Hayes