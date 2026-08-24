# System Performance Report 

**Endpoint:** `GET /user/top10-vang`  
**Test tool:** k6  
**Test environment:** Cross-region (client local → server `api.dangpham.id.vn`)  
**Last updated:** 2025

---

## Mục lục

1. [Infrastructure hiện tại](#1-infrastructure-hiện-tại)
2. [Thuật ngữ](#2-thuật-ngữ)
3. [Stress Test — Xác định breaking point](#3-stress-test--xác-định-breaking-point)
4. [Soak Test — 1000 RPS (stable)](#4-soak-test--1000-rps-stable)
5. [Soak Test — 1500 RPS (saturation)](#5-soak-test--1500-rps-saturation)
6. [So sánh tổng hợp](#6-so-sánh-tổng-hợp)
7. [Phân tích bottleneck](#7-phân-tích-bottleneck)
8. [Giới hạn hiện tại và hướng mở rộng](#8-giới-hạn-hiện-tại-và-hướng-mở-rộng)

---

## 1. Infrastructure hiện tại

### Topology

```
Internet
    |
    v
[ VPS 1 — 2 vCPU / 4 GB RAM ]
    Nginx (reverse proxy + load balancer)
    Database (MySQL / PostgreSQL)
    |
    +----------------------+
    |                      |
    v                      v
[ VPS 2 — 2 vCPU / 4 GB ] [ VPS 3 — 2 vCPU / 4 GB ]
  api-gateway               api-gateway
  service-A                 service-A
  service-B                 service-B
  ...                       ...
  (10 services)             (10 services)
```

Traffic flow cho mỗi request:

```
Client → Nginx (VPS 1) → API Gateway (VPS 2 hoặc VPS 3) → Service X (cùng VPS) → DB (VPS 1)
```

Nginx load balance request giữa 2 API Gateway instance. Mỗi API Gateway route tiếp vào các service nằm trên cùng VPS với nó. Tất cả service đều query về DB duy nhất trên VPS 1.

### Thông số

| Node | Role | CPU | RAM |
|---|---|---|---|
| VPS 1 | Nginx reverse proxy + Database | 2 vCPU | 4 GB |
| VPS 2 | 10 services (api-gateway + 9 service khác) | 2 vCPU | 4 GB |
| VPS 3 | 10 services (mirror của VPS 2) | 2 vCPU | 4 GB |

### Phân tích giới hạn từng node

**VPS 1 — hai vai trò trên một máy, đây là điểm rủi ro cao nhất.**

Nginx và DB đang tranh nhau 2 vCPU và 4 GB RAM. Ở tải cao, DB cần CPU để xử lý query và cần RAM cho buffer pool — trong khi Nginx cần CPU để xử lý SSL handshake và proxy connection. Thực tế DB chỉ có khoảng 2–2.5 GB RAM cho buffer pool sau khi OS và Nginx chiếm phần còn lại. Nếu working set của DB lớn hơn buffer pool, mỗi query là disk read.

Đây cũng là single point of failure: nếu VPS 1 xuống, toàn bộ hệ thống mất cả entry point lẫn database.

**VPS 2 và VPS 3 — 10 process cạnh tranh 2 vCPU.**

Mỗi VPS chạy 10 Node.js service. Giả sử mỗi service chạy cluster mode với ít nhất 1 worker, có 10+ process đang tranh nhau 2 vCPU. Trong điều kiện bình thường, phần lớn service idle nên không thành vấn đề. Nhưng khi tải tăng vào một service cụ thể (ví dụ api-gateway), OS scheduler vẫn phải chia CPU time cho 9 service còn lại, làm giảm throughput thực tế của service đang bị load.

Memory cũng bị cạnh tranh: 10 Node.js process × ~100–200 MB baseline mỗi process = 1–2 GB chỉ để giữ các service up, còn lại ~2 GB cho heap và buffer runtime.

**DB trên VPS 1 là bottleneck tập trung nhất.**

Toàn bộ 10 service trên VPS 2 và 10 service trên VPS 3 đều query về một DB instance duy nhất. Ở 1000 RPS vào endpoint top10-vang, chỉ tính riêng endpoint này đã có thể tạo ra hàng trăm concurrent query tới DB mỗi giây. Nếu các service khác cũng đang active, DB chịu aggregate load từ tất cả.

---

## 2. Thuật ngữ

**RPS (Requests Per Second):** Số HTTP request server xử lý được mỗi giây.

**CCU (Concurrent Users):** Số người dùng đang tương tác với hệ thống tại cùng một thời điểm. Ước tính bằng Little's Law: `CCU ≈ RPS × avg_response_time(s)`. Ở 1000 RPS với avg 83ms: `1000 × 0.083 ≈ 83` connection in-flight tại bất kỳ thời điểm nào. Tính cả think time thực tế (~1–2s giữa các action), 1000 RPS tương đương khoảng 1000–2000 CCU.

**Throughput:** Số request thành công hệ thống hoàn thành trong một đơn vị thời gian.

**Latency percentiles:** Average không dùng được vì bị kéo lệch bởi outlier. Percentile phản ánh phân phối thực tế.

| Metric | Ý nghĩa |
|---|---|
| p50 | 50% request nhanh hơn giá trị này — trải nghiệm người dùng trung vị |
| p90 | 90% request nhanh hơn — bắt đầu thấy slow request |
| p95 | Thường dùng làm SLA threshold |
| p99 | Tail latency — 1% worst-case, thường là nạn nhân của queue buildup hoặc GC pause |

**Dropped iterations:** Số lần k6 định gửi request nhưng không có VU nào rảnh. Tương đương request bị drop trước khi vào hàng đợi xử lý.

**Saturation zone:** Vùng tải mà hệ thống vẫn phản hồi nhưng latency tăng phi tuyến. Server chưa crash nhưng internal queue bắt đầu tích lũy.

**Stress test:** Tăng tải vượt ngưỡng thiết kế để xác định breaking point. Dùng `ramping-arrival-rate` executor.

**Soak test:** Giữ tải cố định trong thời gian dài để phát hiện memory leak, connection exhaustion, hoặc performance drift. Dùng `constant-arrival-rate` executor.

---

## 3. Stress Test — Xác định breaking point

### Cấu hình

```
Executor:    ramping-arrival-rate
Start rate:  50 RPS
Max VUs:     3000
Stages:
  20s → 100 RPS   (warm-up)
  30s → 300 RPS
  30s → 600 RPS
  30s → 1000 RPS
  30s → 1500 RPS
  30s → 2000 RPS
  30s → 3000 RPS
  20s → 0 RPS     (cool-down)
```

### Ngưỡng xác định được

| RPS | Trạng thái |
|---|---|
| 50–600 | Ổn định, latency thấp |
| 600–1000 | Ổn định, tăng nhẹ |
| 1000–1200 | Gần ngưỡng, vẫn trong SLA |
| ~1500 | Saturation — p95/p99 vượt threshold |
| ~2000+ | Latency collapse, dropped iterations tăng vọt |
| ~3000 | Breaking point — không theo kịp target RPS |

**Max RPS trước khi SLA breach:** ~1000–1200 RPS  
**Breaking point:** ~1500 RPS (p99 > 1s, error rate > 2%)

---

## 4. Soak Test — 1000 RPS (stable)

### Cấu hình

```
Executor:        constant-arrival-rate
Rate:            1000 RPS
Duration:        10 phút
preAllocatedVUs: 200
maxVUs:          600
```

### Kết quả

| Metric | Giá trị |
|---|---|
| Actual throughput | 997.94 RPS |
| Total requests | 599,287 |
| Data received | 2.8 GB (4.7 MB/s) |
| Data sent | 68 MB (114 kB/s) |
| avg latency | 83.47 ms |
| p50 latency | 59.42 ms |
| p90 latency | 127.83 ms |
| p95 latency | 234.26 ms |
| p99 latency | 405.62 ms |
| max latency | 5.03 s |
| http_req_failed | 0.00% |
| soak_error_rate | 0.12% |
| dropped_iterations | 715 (0.12%) |
| checks_succeeded | 99.93% |
| VUs active | avg 96 / max 563 |

### Threshold results

| Threshold | Result |
|---|---|
| `http_req_failed < 0.5%` | PASSED (0.00%) |
| `p(99) < 1000ms` | PASSED (405ms) |
| `p(95) < 400ms` | PASSED (234ms) |

### Nhận xét

Hệ thống ổn định trong toàn bộ 10 phút. Latency profile không drift — p95 đầu và cuối bài test xấp xỉ nhau, không có dấu hiệu memory leak hay connection pool degradation. 715 dropped iterations (~0.12%) là mức chấp nhận được, nhiều khả năng do network jitter hoặc k6 scheduler overhead.

Max latency 5s là outlier cần chú ý. Ở production cần có request timeout config để tránh request treo lâu giữ connection và ảnh hưởng downstream.

---

## 5. Soak Test — 1500 RPS (saturation)

### Cấu hình

```
Executor:        constant-arrival-rate
Rate:            1500 RPS
Duration:        10 phút
preAllocatedVUs: 200
maxVUs:          600
```

### Kết quả

| Metric | Giá trị |
|---|---|
| Actual throughput | 1,455.32 RPS |
| Total requests | 873,692 |
| Data received | 4.1 GB (6.8 MB/s) |
| Data sent | 99 MB (165 kB/s) |
| avg latency | 229.08 ms |
| p50 latency | 149.37 ms |
| p90 latency | 426.12 ms |
| p95 latency | 666.33 ms |
| p99 latency | 1,430 ms |
| max latency | 34.99 s |
| http_req_failed | 0.00% |
| soak_error_rate | 2.18% |
| dropped_iterations | 26,308 (2.9%) |
| checks_succeeded | 98.90% |
| VUs active | avg 207 / max 600 |

### Threshold results

| Threshold | Result |
|---|---|
| `http_req_failed < 0.5%` | PASSED (0.00%) |
| `p(99) < 1000ms` | FAILED (1430ms) |
| `p(95) < 400ms` | FAILED (666ms) |

### Nhận xét

`http_req_failed = 0.00%` có nghĩa server vẫn trả response với status code hợp lệ — không crash, không trả 5xx. Tuy nhiên `soak_error_rate = 2.18%` cho thấy 2.18% request có latency vượt 1000ms (threshold trong check script), tức là vẫn "thành công" theo HTTP nhưng đã quá chậm để có giá trị với người dùng.

26,308 dropped iterations (~2.9%) là dấu hiệu rõ ràng của overload: k6 không thể maintain đúng 1500 RPS vì thiếu capacity, thực tế chỉ đạt 1455 RPS. Max latency 35s là queue accumulation — request đang chờ trong hàng đợi của API Gateway hoặc DB connection pool trước khi được xử lý.

---

## 6. So sánh tổng hợp

| Metric | 1000 RPS | 1500 RPS | Delta |
|---|---|---|---|
| Actual RPS | 997.9 | 1455.3 | +45.8% |
| avg latency | 83.47 ms | 229.08 ms | +174% |
| p50 latency | 59.42 ms | 149.37 ms | +151% |
| p90 latency | 127.83 ms | 426.12 ms | +233% |
| p95 latency | 234.26 ms | 666.33 ms | +184% |
| p99 latency | 405.62 ms | 1,430 ms | +252% |
| max latency | 5.03 s | 34.99 s | +595% |
| http_req_failed | 0.00% | 0.00% | — |
| soak_error_rate | 0.12% | 2.18% | +18x |
| dropped_iterations | 715 (0.12%) | 26,308 (2.9%) | +36x |
| data_received | 4.7 MB/s | 6.8 MB/s | +44% |

Throughput tăng 45.8% nhưng dropped_iterations tăng 36x — dấu hiệu của non-linear degradation. Khi vượt ngưỡng, một lượng nhỏ tải tăng thêm gây ra hậu quả không cân xứng.

---

## 7. Phân tích bottleneck

### Tại sao latency tăng phi tuyến?

Hành vi quan sát được — latency tăng ~3x khi RPS tăng 1.5x — là dấu hiệu điển hình của queue buildup tại một shared resource. Khi arrival rate xấp xỉ service rate, queue length tăng nhanh theo queueing theory (M/M/1: utilization tiến gần 1 thì wait time tiến về vô cực).

Với topology hiện tại, có ba điểm nghi ngờ theo thứ tự khả năng:

**DB connection pool.** Tất cả service trên cả VPS 2 và VPS 3 đều query về DB trên VPS 1. Đây là funnel point — mọi request cuối cùng đều đi qua đây. Mỗi service giữ một pool connection riêng tới DB. Ở 1000 RPS phân phối đều cho 2 API Gateway instance, mỗi gateway xử lý ~500 RPS. Nếu mỗi query mất ~50ms, cần `500 × 0.05 = 25` concurrent DB connections chỉ từ một service trên một VPS — nhân lên cho tất cả service đang active, DB đang chịu hàng trăm concurrent connection trên 2 vCPU.

**CPU contention trên VPS 2/3.** 10 Node.js process tranh nhau 2 vCPU. Khi API Gateway bị load cao, OS vẫn schedule CPU time cho 9 service còn lại. Thực tế API Gateway chỉ có thể dùng khoảng 1 vCPU hiệu quả, tương đương 1 cluster worker thực sự chạy được song song tại một thời điểm.

**DB query không có index hoặc chưa tối ưu.** Query top10-vang có thể đang sort một lượng row lớn để lấy top 10. Không có index phù hợp thì mỗi query là filesort trên DB 2 vCPU đang đã bận xử lý connection từ nhiều service khác.

### Tại sao http_req_failed = 0% nhưng soak_error_rate = 2.18%?

Server trả response đúng HTTP status nhưng latency vượt timeout threshold của check script (1000ms). Đây là latency-based failure, không phải connection failure. Với người dùng thực tế, request mất 1–35s là failure về UX dù HTTP status là 200.

### Rủi ro ẩn: Nginx và DB cùng VPS

Ở 1000 RPS, Nginx đang xử lý khoảng 1000 concurrent connection, SSL termination, và proxy overhead — tất cả trên 2 vCPU đang chia sẻ với DB. Chưa có dấu hiệu Nginx là bottleneck ở load hiện tại, nhưng khi tải tăng lên hoặc khi DB bắt đầu spike CPU, hai process này sẽ tranh nhau resource trên cùng một máy và ảnh hưởng lẫn nhau theo cách khó dự đoán.

---

## 8. Giới hạn hiện tại và hướng mở rộng

### Capacity hiện tại

| Mức | RPS | CCU ước tính | Trạng thái |
|---|---|---|---|
| Safe operating point | 700 RPS | ~700–1400 CCU | p95 < 250ms, còn 30% headroom |
| Stable ceiling | ~1000 RPS | ~1000–2000 CCU | p95 ~234ms, p99 ~406ms |
| Saturation zone | 1200–1500 RPS | ~1200–3000 CCU | SLA breach, không dùng production |
| Breaking point | ~1500+ RPS | — | p99 > 1.4s, dropped iterations tăng vọt |

Recommend operating point là 700 RPS để có 30% headroom cho traffic spike mà không chạm saturation zone.

### Tăng capacity mà không thay infra

**Cache leaderboard query — tác động lớn nhất, effort thấp nhất.**

Leaderboard top10 là read-heavy, không cần realtime. Cache result trong Redis với TTL 10–30s, refresh async. Toàn bộ DB load từ endpoint này gần như biến mất.

```
Trước cache: 1000 RPS → ~500–1000 DB queries/s (tùy cache miss rate)
Sau cache TTL 10s, hit rate ~99%: 1000 RPS → ~10 DB queries/s
```

Redis nên đặt trên VPS 2 và VPS 3 (mỗi VPS một instance), API Gateway query Redis local thay vì DB remote. Latency thêm vào ~1ms. Capacity kỳ vọng sau cache: 3000–5000 RPS với p95 dưới 50ms vì DB gần như hoàn toàn bị bypass cho endpoint này.

**Kiểm tra và fix DB index.**

Chạy `EXPLAIN ANALYZE` trên query top10. Phải có index trên cột rank/score để query là index scan. Nếu chưa có, đây là thay đổi đơn giản nhất có tác động cao nhất sau caching.

**Giảm số lượng DB connection pool.**

Với 10 service trên mỗi VPS và 2 VPS app, DB có thể đang nhận tới `10 × 2 × pool_size` concurrent connection. Nếu pool_size mặc định là 10, đó là 200 connection tới DB 2 vCPU. Giảm pool size xuống 3–5 per service, tổng giữ dưới 100, và dùng connection queue thay vì để mỗi service mở connection tự do.

**Node.js cluster tuning trên VPS 2/3.**

Với 2 vCPU và 10 service, không phải service nào cũng cần 2 worker. Service có traffic thấp chạy 1 worker, API Gateway chạy 2 worker (dùng hết 2 vCPU). Tránh trường hợp tất cả service đều set 2 worker dẫn đến 20 Node.js worker tranh nhau 2 vCPU.

### Để tăng capacity vượt ~5000 RPS (cần thay đổi infra)

| Thay đổi | Tác động | Ghi chú |
|---|---|---|
| Tách DB ra VPS riêng | Loại bỏ resource contention giữa Nginx và DB trên VPS 1, unblock DB bottleneck | Thay đổi quan trọng nhất nếu có budget |
| Thêm DB read replica | Phân tải read query, tất cả SELECT sang replica | Cần thay đổi connection config trong từng service |
| Thêm VPS app thứ 3 + Nginx upstream | Tăng capacity app layer thêm 50% | Cần config Nginx upstream, deploy script cho node mới |
| Nâng VPS 1 lên 4 vCPU | Nginx và DB có thêm room, delay saturation | Giải pháp tạm, không giải quyết root cause |
| Tách Nginx ra node riêng | VPS 1 chỉ chạy DB, Nginx về node khác | Hợp lý khi traffic tăng nhiều |

Thứ tự ưu tiên nếu phải chọn một: tách DB ra VPS riêng trước. Đây là thay đổi có tác động lớn nhất vì giải quyết cả resource contention lẫn single point of failure.

### Monitoring cần có trước khi tăng tải production

Hiện tại không có visibility vào bên trong hệ thống khi đang chạy — chỉ thấy được latency từ ngoài vào. Trước khi tăng tải production lên gần ngưỡng, cần tối thiểu:

- DB query time histogram — xác nhận bottleneck là DB hay App
- Node.js event loop lag per service — xác định service nào đang bị CPU starved
- DB connection pool utilization per service (active vs idle vs waiting)
- Memory usage trend theo thời gian trên VPS 2 và VPS 3 — phát hiện leak trước khi OOM kill một trong 10 service
- CPU usage breakdown per process trên VPS 2/3 — biết service nào đang ăn CPU bất thường

Không có những metric này, khi hệ thống chậm ở production chỉ có thể restart service và chờ, không thể chỉ ra nguyên nhân cụ thể.

---

> Kết quả test được đo từ client đặt khác region với server. Latency thực tế từ cùng datacenter sẽ thấp hơn. Nên chạy lại bài test với k6 đặt trên một server cùng datacenter với VPS 1 để có số baseline chính xác hơn cho capacity planning.