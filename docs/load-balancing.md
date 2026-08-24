# LoadBalancer — Nginx Configuration Documentation

## Áp dụng

Dùng cho Nginx Service trong hệ thống 11 services

## Mục lục
1. [Nginx đang làm gì trong hệ thống này?](#1-nginx-đang-làm-gì-trong-hệ-thống-này)
2. [Kiến trúc tổng quan](#2-kiến-trúc-tổng-quan)
3. [Upstream & Load Balancing](#3-upstream--load-balancing)
4. [Passive Health Check](#4-passive-health-check)
5. [SSL/TLS Termination](#5-ssltls-termination)
6. [Virtual Hosts — Server Blocks](#6-virtual-hosts--server-blocks)
7. [Stream Proxy — TCP Tunneling](#7-stream-proxy--tcp-tunneling)
8. [Thuật ngữ quan trọng](#8-thuật-ngữ-quan-trọng)
9. [Nginx vs HAProxy — Khi nào nên chuyển?](#9-nginx-vs-haproxy--khi-nào-nên-chuyển)

---

## 1. Nginx đang làm gì trong hệ thống này?

Nginx trong hệ thống này **không chỉ là web server** — nó đảm nhận 4 vai trò cùng lúc:

| Vai trò | Mô tả |
|---|---|
| **Reverse Proxy** | Nhận request từ client, forward tới backend services |
| **Load Balancer** | Phân phối traffic giữa 2 server backend |
| **SSL Terminator** | Xử lý HTTPS, backend chỉ cần chạy HTTP |
| **TCP Proxy** | Mở tunnel TCP để expose MySQL, Redis, Postgres, MongoDB |

### Lợi ích khi dùng Nginx làm tầng trung gian:

- **Backend không cần biết về SSL** — Nginx lo hết, giảm complexity cho service
- **Một cert duy nhất** cho nhiều domain (`api.`, `pay.`, `data.`, ...) — tất cả đều dùng cert của `api.ngocrongdark.com`
- **Che giấu topology** — client không biết backend đang chạy ở IP nào, port nào
- **Centralized security** — auth_basic, security headers chỉ config 1 chỗ
- **Failover tự động** — khi 1 server chết, traffic tự chuyển sang server còn lại

---

## 2. Kiến trúc tổng quan

```
Internet (Client)
       │
       ▼
  Cloudflare CDN
  (CF-Connecting-IP header)
       │
       ▼
  Nginx (port 80/443)
  ┌────────────────────────────────────────┐
  │  SSL Termination                       │
  │  Virtual Host routing theo domain      │
  │  Security headers & auth_basic         │
  └────────────────────────────────────────┘
       │
       ├──► upstream api_gateway  ──► 103.116.52.222:3000
       │                          ──► 103.116.52.219:3000
       │
       ├──► upstream pay_service  ──► 103.116.52.222:3005
       │                          ──► 103.116.52.219:3005
       │
       ├──► 127.0.0.1:8081  (MinIO/Data)
       ├──► 127.0.0.1:5540  (Redis UI)
       ├──► 127.0.0.1:5050  (pgAdmin)
       │
       └── stream proxy (TCP tunnel)
           ├── :33306 → MySQL   :3306
           ├── :36379 → Redis   :6379
           ├── :35432 → Postgres :5432
           ├── :35674 → AMQP    :5674
           └── :37017 → MongoDB :27017
```

---

## 3. Upstream & Load Balancing

### Cú pháp

```nginx
upstream <tên_upstream> {
    <thuật_toán>;
    server <ip>:<port> [options];
    server <ip>:<port> [options];
}
```

### Thuật toán đang dùng: `least_conn`

```nginx
upstream api_gateway {
    least_conn;
    server 103.116.52.222:3000 max_fails=3 fail_timeout=30s;
    server 103.116.52.219:3000 max_fails=3 fail_timeout=30s;
}
```

### Tại sao chọn `least_conn` thay vì Round Robin?

Hệ thống có **WebSocket (long-lived connections)** cho game multiplayer.
Round Robin phân phối đều theo số lượt request — không quan tâm connection đang sống bao lâu.

Ví dụ sự cố với Round Robin:
```
Server A: 800 WebSocket connections đang chơi game
Server B: 50 WebSocket connections
→ Round Robin vẫn gửi request mới lần lượt A→B→A→B
→ Server A ngày càng quá tải
```

`least_conn` luôn chọn server **ít active connections nhất** → cân bằng thực sự.

### Tất cả các thuật toán Nginx OSS hỗ trợ

| Directive | Tên | Khi nào dùng |
|---|---|---|
| *(không có)* | Round Robin | HTTP stateless đơn giản, request nhanh |
| `least_conn` | Least Connections | WebSocket, long-lived, game realtime |
| `ip_hash` | IP Hash | Session sticky theo IP (không cần Redis session) |
| `hash $variable` | Custom Hash | Sticky theo cookie, URI, hoặc bất kỳ biến nào |
| `random` | Random | Ít dùng, có thể kết hợp `two least_conn` |
| `weight=N` | Weight | Kết hợp với algo khác khi server mạnh/yếu khác nhau |
| `least_time` | Least Time | **Nginx Plus only** — không có trong OSS |

---

## 4. Passive Health Check

### Cú pháp

```nginx
server <ip>:<port> max_fails=<N> fail_timeout=<time>;
```

### Config hiện tại

```nginx
server 103.116.52.222:3000 max_fails=3 fail_timeout=30s;
```

### Luồng hoạt động

```
Request thật từ user
       │
       ▼
Nginx forward tới server
       │
       ├── Thành công → bình thường, reset bộ đếm fail
       │
       └── Thất bại → tăng bộ đếm
                  │
                  └── Đủ 3 lần trong 30 giây?
                             │
                             ├── Chưa → vẫn tiếp tục dùng server đó
                             │
                             └── Rồi → mark "unavailable" 30 giây
                                        Toàn bộ traffic → server còn lại
                                        Sau 30s → thử probe 1 request
                                        OK → đưa trở lại pool
```

### Giới hạn của Passive Health Check

- **Phải có request thật bị lỗi** trước khi phát hiện server chết
- Với `max_fails=3` → ít nhất 3 user sẽ gặp lỗi trước khi failover
- Không phát hiện được "server chậm nhưng không chết hẳn"
- Đây là lý do gọi là **lazy** — không chủ động, chờ lỗi xảy ra

---

## 5. SSL/TLS Termination

### Config hiện tại

```nginx
server {
    listen 443 ssl;
    server_name api.ngocrongdark.com api.dangpham.id.vn;

    ssl_certificate     /etc/letsencrypt/live/api.ngocrongdark.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.ngocrongdark.com/privkey.pem;

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
}
```

### Giải thích từng phần

| Config | Ý nghĩa |
|---|---|
| `listen 443 ssl` | Lắng nghe HTTPS trên port 443 |
| `server_name` | Nginx match domain từ HTTP Host header |
| `ssl_certificate` | fullchain.pem = cert của domain + intermediate CA |
| `ssl_certificate_key` | Private key để decrypt TLS handshake |
| `HSTS` | Bắt buộc browser dùng HTTPS trong 1 năm, kể cả subdomain |
| `X-Frame-Options SAMEORIGIN` | Chống clickjacking — chỉ cho phép iframe từ cùng domain |

### Một cert cho nhiều domain

```
ssl_certificate /etc/letsencrypt/live/api.ngocrongdark.com/fullchain.pem
```

Cert này là **wildcard hoặc SAN cert** bao gồm:
- `api.ngocrongdark.com`
- `pay.ngocrongdark.com`
- `data.ngocrongdark.com`
- `redis.ngocrongdark.com`
- `postgres.ngocrongdark.com`

Tất cả server block đều trỏ vào cùng 1 cert — không cần cert riêng cho từng subdomain.

### HTTP → HTTPS redirect

```nginx
server {
    listen 80;
    server_name api.ngocrongdark.com;
    return 301 https://$host$request_uri;  # 301 = permanent redirect
}
```

`$host` giữ nguyên domain gốc, `$request_uri` giữ nguyên path + query string.

---

## 6. Virtual Hosts — Server Blocks

Nginx dùng `server_name` để phân biệt domain và route traffic đúng chỗ.

### API Gateway (có auth + WebSocket)

```nginx
# Khóa root endpoint
location = / {
    auth_basic "Restricted";
    auth_basic_user_file /etc/nginx/.htpasswd;
    proxy_pass http://api_gateway;
    ...
}

# Khóa Swagger UI
location /api-docs {
    auth_basic "Restricted";
    auth_basic_user_file /etc/nginx/.htpasswd;
    proxy_pass http://api_gateway;
    ...
}

# WebSocket + HTTP thông thường
location / {
    proxy_pass http://api_gateway;
    proxy_http_version 1.1;

    # Bắt buộc cho WebSocket upgrade
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";

    # Game realtime — không timeout giữa chừng
    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;

    # Tắt buffering — gửi data ngay, không chờ buffer đầy
    proxy_buffering off;
}
```

### Headers quan trọng

| Header | Giá trị | Mục đích |
|---|---|---|
| `Host` | `$host` | Backend biết domain đang được gọi |
| `X-Real-IP` | `$remote_addr` | IP của Nginx (hoặc Cloudflare nếu có) |
| `X-Forwarded-For` | `$proxy_add_x_forwarded_for` | Chain IP qua nhiều proxy |
| `CF-Connecting-IP` | `$http_cf_connecting_ip` | IP thật của user qua Cloudflare |
| `X-Forwarded-Proto` | `https` | Backend biết request gốc là HTTPS |

### Priority của `location` matching

```
= /          → Exact match (ưu tiên cao nhất)
/api-docs    → Prefix match
/            → Catch-all (ưu tiên thấp nhất)
```

---

## 7. Stream Proxy — TCP Tunneling

```nginx
stream {
    server {
        listen 33306;
        proxy_pass 127.0.0.1:3306;  # MySQL
    }
    server {
        listen 36379;
        proxy_pass 127.0.0.1:6379;  # Redis
    }
    server {
        listen 35432;
        proxy_pass 127.0.0.1:5432;  # Postgres
    }
    server {
        listen 35674;
        proxy_pass 127.0.0.1:5674;  # RabbitMQ AMQP
    }
    server {
        listen 37017;
        proxy_pass 127.0.0.1:27017; # MongoDB
    }
}
```

### Stream vs HTTP block

| | `http {}` | `stream {}` |
|---|---|---|
| Layer | L7 (Application) | L4 (Transport) |
| Hiểu protocol | HTTP, WebSocket | Raw TCP/UDP |
| Header manipulation | Được | Không được |
| SSL termination | Được | Được (stream_ssl) |
| Dùng để | Web, API, WS | DB, cache, queue |

**Lưu ý bảo mật:** Stream proxy expose database ra ngoài theo port tùy chỉnh. Nên kết hợp với firewall chỉ allow IP whitelist (VPN/Tailscale) vào các port này.

---

## 8. Thuật ngữ quan trọng

| Thuật ngữ | Giải thích |
|---|---|
| **Reverse Proxy** | Proxy đứng phía server — client không biết backend thật |
| **Forward Proxy** | Proxy đứng phía client — server không biết client thật |
| **Upstream** | Nhóm backend servers mà Nginx forward request tới |
| **Load Balancer** | Phân phối traffic đều giữa nhiều server |
| **SSL Termination** | Nginx xử lý SSL, backend nhận HTTP thuần |
| **Virtual Host** | Nhiều domain chạy trên cùng 1 IP/server |
| **Active Health Check** | Tự động ping server định kỳ để kiểm tra còn sống không |
| **Passive Health Check** | Phát hiện server chết dựa trên request thật bị lỗi |
| **WebSocket Upgrade** | HTTP → WebSocket protocol upgrade qua header `Upgrade` |
| **HSTS** | HTTP Strict Transport Security — bắt buộc HTTPS |
| **Sticky Session** | Đảm bảo 1 user luôn vào đúng 1 server |
| **Keepalive** | Tái sử dụng TCP connection giữa Nginx và upstream |
| **proxy_buffering** | Nginx buffer response trước khi gửi về client |
| **max_fails** | Số lần fail tối đa trước khi mark server unavailable |
| **fail_timeout** | Khoảng thời gian đếm fail và thời gian server bị "cấm" |
| **worker_processes** | Số process Nginx chạy song song (thường = số CPU core) |
| **worker_connections** | Số connection tối đa mỗi worker xử lý cùng lúc |

---

## 9. Nginx vs HAProxy — Khi nào nên chuyển?

### So sánh tổng quan

| Tiêu chí | Nginx OSS | HAProxy |
|---|---|---|
| **Health check** | Passive (lazy) | Active (chủ động ping) |
| **Load balancing** | Cơ bản (5 algo) | Nâng cao (nhiều algo hơn) |
| **SSL Termination** | ✅ Tốt | ✅ Tốt |
| **Web server / serve file** | ✅ Có | ❌ Không |
| **Reverse proxy HTTP** | ✅ Tốt | ✅ Tốt |
| **WebSocket** | ✅ Hỗ trợ | ✅ Hỗ trợ |
| **Dashboard monitoring** | ❌ Không có (OSS) | ✅ Có sẵn (Stats page) |
| **Connection draining** | ❌ Hạn chế | ✅ Graceful shutdown |
| **ACL phức tạp** | Hạn chế | ✅ Rất mạnh |
| **Reload không drop connection** | Gần đúng | ✅ Hoàn toàn |
| **Circuit breaker** | ❌ | ❌ (cần Envoy/Istio) |
| **Cộng đồng / tài liệu** | Rất lớn | Lớn |
| **Độ phức tạp config** | Thấp | Trung bình |

---

### Khi nên giữ Nginx

- Hệ thống còn nhỏ (2–5 server)
- Cần serve static file, redirect, hoặc làm web server luôn
- Team chưa quen HAProxy
- Chưa cần SLA cao (chấp nhận 3 request đầu bị lỗi khi failover)
- Chưa cần monitoring dashboard realtime

---

### Khi nên chuyển sang HAProxy (hoặc thêm HAProxy phía trước)

```
Dấu hiệu cần HAProxy:

1. Scale lên 5+ backend servers
   → Nginx passive check không đủ nhanh phát hiện server chết

2. Cần zero-downtime deploy thực sự
   → HAProxy connection draining đợi request hiện tại xong rồi mới remove server

3. Cần health check thực sự
   → HAProxy ping HTTP /health mỗi 2 giây, phát hiện server chết ngay
   → Không có user nào bị lỗi trước khi failover

4. Cần monitoring dashboard
   → HAProxy có stats page realtime: req/s, error rate, server status

5. Cần routing phức tạp
   → HAProxy ACL: route dựa trên header, cookie, URL pattern, IP range
```

---

### Kiến trúc khi thêm HAProxy

```
Internet
    │
    ▼
Cloudflare
    │
    ▼
HAProxy (port 80/443)          ← Active health check
├── /health ping mỗi 2s
├── Stats dashboard :8080
└── Connection draining
    │
    ├──► Nginx node 1           ← Nginx làm reverse proxy + SSL
    │       ├── api_gateway
    │       └── pay_service
    │
    └──► Nginx node 2
            ├── api_gateway
            └── pay_service
```

**Trade-off khi thêm HAProxy:**

| | Lợi ích | Nhược điểm |
|---|---|---|
| **Reliability** | Failover không có user bị lỗi | Thêm 1 điểm single point of failure (cần HA cho HAProxy) |
| **Visibility** | Dashboard realtime, metrics | Phải học HAProxy config syntax |
| **Complexity** | Tách biệt LB và proxy rõ ràng | Thêm 1 layer → debug khó hơn |
| **Performance** | HAProxy nhanh hơn ở L4 LB thuần | Không đáng kể với traffic hiện tại |

---

### Khuyến nghị cho hệ thống hiện tại

```
Hiện tại (2 server):
  → Giữ Nginx, đủ dùng
  → Thêm keepalive upstream để tối ưu HTTP
  → Cân nhắc Nginx Plus nếu budget có (có active health check)

Khi scale lên 4+ server hoặc cần SLA cao hơn:
  → Thêm HAProxy phía trước Nginx
  → Nginx vẫn giữ vai trò SSL termination + reverse proxy
  → HAProxy chuyên lo load balancing + health check

Dài hạn (microservices nhiều):
  → Cân nhắc Service Mesh (Istio/Envoy)
  → Hoặc Cloud LB (AWS ALB, GCP Load Balancer)
```