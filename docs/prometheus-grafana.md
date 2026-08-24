# Giám sát hệ thống với Prometheus & Grafana

> Tài liệu triển khai observability cho hệ thống game Ngọc Rồng Online
> Kiến trúc 3 VPS · NestJS + Golang · Docker Compose + Nginx
>
> **Tác giả:** DANG-PH
> **Ngày viết:** 22/05/2026
> **Phiên bản:** 1.0

---

## Mục lục

1. [Bài toán đặt ra](#1-bài-toán-đặt-ra)
2. [Observability là gì — ba trụ cột](#2-observability-là-gì--ba-trụ-cột)
3. [Tại sao chọn Prometheus](#3-tại-sao-chọn-prometheus)
4. [Tại sao chọn Grafana](#4-tại-sao-chọn-grafana)
5. [Tại sao không chọn các giải pháp khác](#5-tại-sao-không-chọn-các-giải-pháp-khác)
6. [Quan hệ Prometheus ↔ Grafana](#6-quan-hệ-prometheus--grafana)
7. [Kiến trúc tổng thể](#7-kiến-trúc-tổng-thể)
8. [Phần I — Expose metrics ở tầng ứng dụng](#8-phần-i--expose-metrics-ở-tầng-ứng-dụng)
9. [Phần II — Bảo mật: tách port & firewall](#9-phần-ii--bảo-mật-tách-port--firewall)
10. [Phần III — Dựng Prometheus](#10-phần-iii--dựng-prometheus)
11. [Phần IV — Dựng Grafana](#11-phần-iv--dựng-grafana)
12. [Phần V — DNS & Nginx reverse proxy](#12-phần-v--dns--nginx-reverse-proxy)
13. [Phần VI — Sử dụng Grafana từ A đến Z](#13-phần-vi--sử-dụng-grafana-từ-a-đến-z)
14. [Phần VII — Dựng 2 dashboard NodeJS & Go](#14-phần-vii--dựng-2-dashboard-nodejs--go)
15. [Đọc hiểu metrics — nhìn biểu đồ thế nào để biết khỏe hay bệnh](#15-đọc-hiểu-metrics--nhìn-biểu-đồ-thế-nào-để-biết-khỏe-hay-bệnh)
16. [PromQL — ngôn ngữ truy vấn](#16-promql--ngôn-ngữ-truy-vấn)
17. [So sánh với PM2 monitoring, Discord/Telegram alert & circuit breaker](#17-so-sánh-với-pm2-monitoring-discordtelegram-alert--circuit-breaker)
18. [Khó khăn gặp phải & cách giải quyết](#18-khó-khăn-gặp-phải--cách-giải-quyết)
19. [Thành quả](#19-thành-quả)
20. [Vận hành & bảo trì](#20-vận-hành--bảo-trì)
21. [TODO — các bước tiếp theo (chi tiết)](#21-todo--các-bước-tiếp-theo-chi-tiết)
22. [Mẹo & kiến thức hữu ích cho dev](#22-mẹo--kiến-thức-hữu-ích-cho-dev)
23. [Phụ lục — tham chiếu nhanh](#23-phụ-lục--tham-chiếu-nhanh)

---

## 1. Bài toán đặt ra

Hệ thống đang chạy production thật với kiến trúc phân tán trên 3 VPS, nhưng thiếu khả năng **quan sát** — tức không trả lời được những câu hỏi cơ bản khi vận hành:

- App có đang sống không? Service nào đang chết?
- CPU/RAM của từng service đang ở mức nào? Có service nào đang leak memory?
- Event loop của Node.js có bị nghẽn không?
- Service Go có bị leak goroutine không? Garbage collection có gây lag không?
- Khi có sự cố lúc 3h sáng, làm sao biết được nguyên nhân mà không phải SSH vào từng máy chạy `top`, `htop`, `docker stats` thủ công?

Trước khi có monitoring, cách duy nhất để biết hệ thống khỏe hay không là chờ người chơi báo lỗi — tức là **phát hiện sự cố sau khi nó đã xảy ra**. Mục tiêu của observability là đảo ngược điều này: thấy được vấn đề **trước** khi nó thành sự cố (ví dụ thấy memory bò lên đều đặn suốt 2 ngày trước khi service bị OOM-kill).

Hệ thống đã có sẵn Jaeger (distributed tracing) nhưng chưa wiring vào app. Phần còn thiếu rõ nhất của một hệ "prod-grade" là **metrics + visualization** — đó là phạm vi tài liệu này giải quyết.

### Yêu cầu cụ thể

| Yêu cầu | Mô tả |
|---|---|
| Thu thập metrics | Từ cả NestJS lẫn Golang, trên cả 2 VPS app |
| Lưu trữ | Giữ lịch sử đủ lâu để phân tích xu hướng (chọn 30 ngày) |
| Hiển thị | Dashboard trực quan, truy cập qua trình duyệt có HTTPS |
| Bảo mật | Metrics không được phơi ra internet công cộng |
| Không xâm lấn | Không phá vỡ các service đang chạy ổn định |

---

## 2. Observability là gì — ba trụ cột

"Observability" (khả năng quan sát) trong vận hành hệ thống được chia thành ba trụ cột (three pillars), mỗi trụ cột trả lời một loại câu hỏi khác nhau:

| Trụ cột | Trả lời câu hỏi | Công cụ phổ biến |
|---|---|---|
| **Metrics** | *Bao nhiêu? Khi nào?* — số liệu định lượng theo thời gian (CPU 80%, 1200 req/s) | Prometheus |
| **Logs** | *Chuyện gì đã xảy ra?* — bản ghi sự kiện chi tiết | Loki, ELK |
| **Traces** | *Request đi qua đâu, chậm ở khâu nào?* — đường đi xuyên các service | Jaeger, Tempo |

Tài liệu này tập trung vào trụ cột **Metrics**. Logs (Loki) và Traces (Jaeger) là phần mở rộng để sau.

Điểm mấu chốt cần hiểu: **metrics rất rẻ và gọn**. Một số đo như "CPU = 80%" chỉ tốn vài byte, nên có thể thu thập liên tục mỗi 15 giây và lưu hàng tháng mà không tốn nhiều tài nguyên. Logs và traces thì nặng hơn nhiều. Đó là lý do metrics luôn là trụ cột nên dựng đầu tiên.

---

## 3. Tại sao chọn Prometheus

### Bối cảnh lịch sử

Prometheus ra đời năm 2012 tại **SoundCloud**, được phát triển bởi các kỹ sư từng làm việc tại Google — lấy cảm hứng từ hệ thống giám sát nội bộ **Borgmon** của Google. Năm 2016, Prometheus trở thành dự án thứ hai gia nhập **CNCF** (Cloud Native Computing Foundation), ngay sau Kubernetes, và "tốt nghiệp" (graduated) năm 2018. Việc CNCF bảo trợ khiến Prometheus trở thành tiêu chuẩn de-facto cho monitoring trong thế giới cloud-native.

### Đặc điểm cốt lõi & vì sao phù hợp

**Mô hình Pull (kéo).** Đây là điểm khác biệt quan trọng nhất. Thay vì để app *đẩy* (push) metrics đi như nhiều hệ thống khác, Prometheus chủ động *kéo* (pull/scrape) metrics từ app theo định kỳ. Cách này có lợi:

- App chỉ cần expose một endpoint HTTP `/metrics` đơn giản, không cần biết Prometheus ở đâu hay cấu hình gì.
- Prometheus tự biết target nào "sống" hay "chết" — nếu kéo không được tức là target chết (chính là metric `up`). Với mô hình push thì không phân biệt được "service im lặng vì khỏe" hay "service đã chết".
- Dễ debug: chỉ cần `curl localhost:9091/metrics` là thấy ngay app đang phát gì.

**Time-Series Database (TSDB) tích hợp.** Prometheus tự lưu trữ dữ liệu chuỗi thời gian, không cần database ngoài. Mỗi metric được gắn nhãn (labels) như `{job="nestjs-gateway", instance="103.116.52.219:9091"}`, cho phép lọc và nhóm linh hoạt.

**PromQL.** Ngôn ngữ truy vấn mạnh, chuyên cho dữ liệu chuỗi thời gian — tính được rate, percentile, aggregate qua nhiều chiều. (Xem mục 15.)

**Hệ sinh thái exporter khổng lồ.** Hầu hết mọi thứ (database, OS, hàng đợi, phần cứng) đều có sẵn "exporter" — chương trình dịch metrics của nó sang định dạng Prometheus. Ví dụ `node_exporter` cho OS, `redis_exporter` cho Redis.

**Nhẹ và đơn giản triển khai.** Một binary duy nhất (hoặc một container), một file config YAML. Không cần cụm phức tạp cho quy mô vừa và nhỏ.

---

## 4. Tại sao chọn Grafana

### Bối cảnh lịch sử

Grafana được **Torkel Ödegaard** tạo ra năm 2014, tách (fork) từ Kibana. Mục tiêu ban đầu là làm một công cụ visualization đẹp và linh hoạt cho dữ liệu chuỗi thời gian. Grafana nhanh chóng trở thành tiêu chuẩn hiển thị, không gắn chặt với một nguồn dữ liệu nào — đây chính là sức mạnh của nó.

### Vì sao phù hợp

**Data source-agnostic (không phụ thuộc nguồn).** Grafana cắm được vào hàng chục loại nguồn: Prometheus, Loki, Elasticsearch, MySQL, PostgreSQL, CloudWatch... Một dashboard có thể trộn metrics (Prometheus) + logs (Loki) + dữ liệu nghiệp vụ (SQL) trên cùng màn hình. Điều này nghĩa là khi mở rộng sang logs/traces sau này, vẫn dùng đúng Grafana — không phải học công cụ mới.

**Kho dashboard cộng đồng.** Hàng nghìn dashboard dựng sẵn trên [grafana.com/dashboards](https://grafana.com/grafana/dashboards/), import bằng một ID số. Tài liệu này dùng dashboard `11159` (NodeJS) và `6671` (Go) — không phải vẽ lại từ đầu.

**Alerting tích hợp.** Grafana có thể tự gửi cảnh báo (email, Slack, Telegram, webhook) khi metric vượt ngưỡng. (Phần mở rộng — xem TODO.)

**Phân tách vai trò rõ ràng.** Grafana *chỉ* hiển thị, không lưu trữ. Đây là thiết kế tốt: mỗi công cụ làm một việc và làm giỏi việc đó.

---

## 5. Tại sao không chọn các giải pháp khác

| Giải pháp | Vì sao không chọn |
|---|---|
| **Zabbix / Nagios** | Thế hệ cũ, mô hình cấu hình nặng nề, UI lỗi thời, không hợp kiến trúc cloud-native và container. Mạnh cho giám sát hạ tầng truyền thống nhưng kém linh hoạt với app metrics. |
| **ELK Stack (Elasticsearch + Logstash + Kibana)** | Thiết kế cho **logs**, không phải metrics. Rất ngốn RAM (Elasticsearch là JVM, thường cần nhiều GB). Quá nặng cho nhu cầu metrics đơn thuần. Phù hợp khi trọng tâm là phân tích log khối lượng lớn. |
| **InfluxDB + Telegraf** | Một lựa chọn hợp lý và là đối thủ trực tiếp của Prometheus. Không chọn vì: mô hình push (Telegraf đẩy) khó biết target sống/chết; hệ sinh thái exporter nhỏ hơn; PromQL phổ biến hơn ngôn ngữ Flux/InfluxQL trong cộng đồng. |
| **Datadog / New Relic (SaaS)** | Dịch vụ trả tiền theo lượng host/metric. Mạnh, đẹp, không cần tự vận hành — nhưng **tốn phí định kỳ** và dữ liệu nằm trên cloud của bên thứ ba. Với self-hosted game server muốn kiểm soát chi phí và dữ liệu, Prometheus + Grafana (miễn phí, mã nguồn mở) hợp lý hơn. |
| **Tự viết (custom logging + cron)** | Tốn công bảo trì, không có visualization, không có alerting, không scale. "Reinventing the wheel". |

**Kết luận:** Prometheus + Grafana là cặp đôi tiêu chuẩn ngành cho metrics tự host — miễn phí, nhẹ, mã nguồn mở, hệ sinh thái lớn, và là kỹ năng có giá trị lâu dài cho dev.

---

## 6. Quan hệ Prometheus ↔ Grafana

Đây là điểm dễ nhầm nhất với người mới. Hai công cụ có vai trò **hoàn toàn khác nhau** và **nối tiếp** nhau:

```
   App (NestJS/Go)          Prometheus              Grafana
   :9091 /metrics    ←──    kéo về mỗi 15s    ←──   hỏi xin số liệu
   (phát số liệu)           (thu thập + lưu)        (hiển thị)
```

Một phép so sánh dễ nhớ — hệ thống camera an ninh:

| Thành phần | Vai trò | Tương đương |
|---|---|---|
| App `/metrics` | Phát tín hiệu, không lưu | **Camera** |
| Prometheus | Thu thập liên tục + lưu vào ổ cứng | **Đầu ghi hình (DVR)** |
| Grafana | Hiển thị đẹp cho người xem | **Màn hình TV phòng bảo vệ** |

- **Prometheus** chuyên thu thập và lưu trữ — nhưng UI vẽ biểu đồ rất sơ sài, chỉ dùng để debug query.
- **Grafana** chuyên hiển thị đẹp — nhưng **không tự thu thập gì cả**. Nó hỏi xin số liệu từ Prometheus.

Việc tách hai vai trò có lợi: mỗi công cụ làm tốt việc của nó, và Grafana có thể cắm vào nhiều nguồn cùng lúc. Mắt xích nối hai bên lại chính là bước **"Add data source"** trong Grafana (xem mục 13) — trước bước đó, Grafana là cái màn hình chưa cắm dây.

**Vì sao Prometheus không cần public mà Grafana thì cần?** Prometheus là hậu trường cho máy đọc, chỉ chạy nội bộ (bind `127.0.0.1`), muốn xem thì SSH tunnel. Grafana là mặt tiền cho con người mở hằng ngày, nên cần domain + HTTPS qua nginx.

---

## 7. Kiến trúc tổng thể

```
                          INTERNET
                             │
                             ▼
              ┌──────────────────────────────┐
              │   VPS 225 (103.116.52.225)    │
              │   "Control / Data plane"      │
              │                               │
              │   ┌─────────┐                 │
              │   │  Nginx  │ (network: host) │ ──► grafana.ngocrongdark.com (HTTPS)
              │   └────┬────┘                 │
              │        │ proxy 127.0.0.1:3001 │
              │   ┌────▼─────┐  ┌────────────┐│
              │   │ Grafana  │◄─┤ Prometheus ││ (scrape mỗi 15s)
              │   │  :3001   │  │   :9090    ││
              │   └──────────┘  └─────┬──────┘│
              │   + DB, Redis, NATS,  │       │
              │     RabbitMQ, Mongo,  │       │
              │     Jaeger (compose)  │       │
              └───────────────────────┼───────┘
                                      │ scrape qua public IP
                          ┌───────────┴───────────┐
                          ▼                       ▼
        ┌──────────────────────┐   ┌──────────────────────┐
        │ VPS 219              │   │ VPS 222              │
        │ "App plane"          │   │ "App plane"          │
        │                      │   │                      │
        │ NestJS gateway :3000 │   │ NestJS gateway :3000 │
        │   └ metrics    :9091 │   │   └ metrics    :9091 │
        │ NestJS pay     :3005 │   │ NestJS pay     :3005 │
        │   └ metrics    :9092 │   │   └ metrics    :9092 │
        │ NestJS game    :3009 │   │ NestJS game    :3009 │
        │   └ metrics    :9093 │   │   └ metrics    :9093 │
        │ Golang game    :3010 │   │ Golang game    :3010 │
        │   └ metrics    :2112 │   │   └ metrics    :2112 │
        └──────────────────────┘   └──────────────────────┘
              (firewall: chỉ cho 225 vào các port metrics)
```

### Phân chia vai trò các VPS

| VPS | IP | Vai trò | Chạy gì |
|---|---|---|---|
| **225** | 103.116.52.225 | Control/Data plane | Nginx + Docker Compose (DB, Redis, NATS, RabbitMQ, Mongo, Postgres, Jaeger) + **Prometheus + Grafana** |
| **219** | 103.116.52.219 | App plane | NestJS (gateway/pay/game) + Golang game |
| **222** | 103.116.52.222 | App plane | NestJS (gateway/pay/game) + Golang game |

### Bảng port metrics (quy ước)

| Service | Port nghiệp vụ | Port metrics | Ghi chú |
|---|---|---|---|
| NestJS gateway | 3000 | **9091** | metrics tách riêng |
| NestJS pay | 3005 | **9092** | metrics tách riêng |
| NestJS game | 3009 | **9093** | metrics tách riêng |
| Golang game | 3010 | **2112** | port quy ước của Prometheus cho Go |
| Prometheus | — | 9090 | bind 127.0.0.1 |
| Grafana | — | 3001→3000 | bind 127.0.0.1, proxy qua nginx |

**Quyết định kiến trúc quan trọng:** tách port metrics ra khỏi port nghiệp vụ. Lý do đầy đủ ở mục 9.

---

## 8. Phần I — Expose metrics ở tầng ứng dụng

> Làm trên: codebase NestJS và Go, sau đó deploy lên 219 & 222
> Đây là việc **phải làm đầu tiên** — không có nó thì Prometheus dựng lên cũng kéo về rỗng.

### 8.1. NestJS — cài package

```bash
npm install @willsoto/nestjs-prometheus prom-client
```

- `prom-client` là thư viện gốc của cộng đồng Node.js để tạo metrics theo định dạng Prometheus.
- `@willsoto/nestjs-prometheus` là lớp bọc (wrapper) tích hợp `prom-client` vào hệ thống module của NestJS.

### 8.2. NestJS — tạo `metrics.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';

@Module({
  imports: [
    PrometheusModule.register({
      defaultMetrics: { enabled: true },
    }),
  ],
})
export class MetricsModule {}
```

### 8.3. NestJS — sửa `main.ts` để chạy metrics trên port phụ

```typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { MetricsModule } from './metrics.module';

async function bootstrap() {
  // App chính — port nghiệp vụ như cũ
  const app = await NestFactory.create(AppModule);
  await app.listen(3000); // 3000 / 3005 / 3009 tùy service

  // App phụ — CHỈ serve /metrics, bind port riêng
  const metricsApp = await NestFactory.create(MetricsModule);
  await metricsApp.listen(9091, '0.0.0.0'); // 9091/9092/9093 tùy service
}
bootstrap();
```

### 8.4. Giải thích: tại sao tạo MetricsModule? Tại sao không cần controller `/metrics`?

Đây là câu hỏi cốt lõi để hiểu vì sao đoạn code trên hoạt động.

**MetricsModule để làm gì?** Trong NestJS, mọi thứ tổ chức theo module. `PrometheusModule.register()` khi được import vào một module sẽ tự động:

1. Khởi tạo một registry (sổ đăng ký) của `prom-client`.
2. Bật `defaultMetrics` — tức tự thu thập sẵn các chỉ số runtime của Node.js (CPU, heap, event loop lag, GC, số file descriptor mở...).
3. **Tự đăng ký sẵn một route `GET /metrics`** trả về toàn bộ số liệu đó ở định dạng text mà Prometheus đọc được.

**Vì sao không cần tự viết controller `/metrics`?** Bởi vì `@willsoto/nestjs-prometheus` đã tạo sẵn controller đó *bên trong* `PrometheusModule.register()`. Khi bạn import module này, route `/metrics` xuất hiện tự động — bạn không phải viết `@Controller()` hay `@Get('metrics')` nào cả. Module *là* đủ; controller đã nằm trong module. Viết thêm controller chỉ thừa và có thể gây xung đột route.

> **Tóm tắt:** `PrometheusModule.register()` = registry + default metrics + controller `/metrics`, gói trong một dòng. Đó là lý do chỉ cần module.

**Vì sao dùng app phụ trên port riêng thay vì để `/metrics` chung với app chính?** Đây là quyết định bảo mật, giải thích đầy đủ ở mục 9. Tóm tắt: port nghiệp vụ (3000...) bắt buộc phải mở ra cho nginx, nếu `/metrics` nằm chung đó thì nó cũng bị phơi ra internet. Tách sang port phụ (9091...) cho phép firewall khóa kín mà không ảnh hưởng port nghiệp vụ.

**Lưu ý kỹ thuật:** vì app chính và app phụ chạy **trong cùng một tiến trình Node.js** (cùng hàm `bootstrap`), chúng dùng chung global registry mặc định của `prom-client`. Nghĩa là các custom metric bạn tạo trong app chính (đếm request, latency...) sẽ tự xuất hiện ở endpoint `/metrics` của app phụ.

### 8.5. Golang — cài + thêm metrics server phụ

```bash
go get github.com/prometheus/client_golang/prometheus/promhttp
```

```go
import (
    "net/http"
    "github.com/prometheus/client_golang/prometheus/promhttp"
)

// Đặt trong hàm khởi động, chạy SONG SONG với server game chính
go func() {
    mux := http.NewServeMux()
    mux.Handle("/metrics", promhttp.Handler())
    _ = http.ListenAndServe("0.0.0.0:2112", mux)
}()
```

**Vì sao Go phải tách port `2112` riêng?** Service Go là WebSocket high-performance — server chính phục vụ game, không phải HTTP server thông thường. Không thể nhét `/metrics` vào nó dễ dàng. Nên ta mở một HTTP server phụ độc lập chỉ để serve metrics. Port `2112` là quy ước cộng đồng Prometheus dành cho ứng dụng Go. `promhttp.Handler()` mặc định đã expose sẵn toàn bộ Go runtime metrics (goroutines, GC, memory).

### 8.6. Deploy & kiểm tra

Sau khi deploy code mới lên cả 219 & 222, kiểm tra ngay trên từng VPS:

```bash
curl localhost:9091/metrics   # NestJS gateway → phải ra "# HELP ..."
curl localhost:9092/metrics   # NestJS pay
curl localhost:9093/metrics   # NestJS game
curl localhost:2112/metrics   # Golang
```

Cả 4 ra text metrics → Phần I xong. Nếu lỗi connection → app chưa bind đúng `0.0.0.0` hoặc chưa deploy code mới.

> **Quan trọng:** phải bind `0.0.0.0`, không phải `127.0.0.1`. Nếu bind `127.0.0.1`, app chỉ nghe trên localhost của VPS app, và Prometheus ở VPS 225 sẽ không kết nối được.

---

## 9. Phần II — Bảo mật: tách port & firewall

> Làm trên: 219 & 222

### 9.1. Vấn đề khi scrape qua public IP

Trong setup này (chưa có private network giữa các VPS), Prometheus ở 225 phải kéo metrics từ 219/222 **qua internet công cộng**. Hai rủi ro:

1. Nếu `/metrics` mở public, **bất kỳ ai** cũng `curl 103.116.52.219:9091/metrics` được — lộ tên route, lượng traffic, version thư viện, cấu trúc nội bộ.
2. Traffic không mã hóa (HTTP thường) và chậm hơn mạng nội bộ.

> **Món nợ kỹ thuật cần biết:** scrape qua public IP là giải pháp tạm. Khi có điều kiện nên chuyển sang **private network** của nhà cung cấp VPS, hoặc dựng **WireGuard/Tailscale** overlay giữa 3 VPS — giải quyết cả mã hóa lẫn tốc độ, và metrics không còn ra internet.

### 9.2. Vì sao tách port metrics là lời giải

Mấu chốt: **port nghiệp vụ bắt buộc phải mở** (cho nginx ở 225 load-balance vào), nên không thể khóa nó. Nếu `/metrics` nằm chung port nghiệp vụ, nó cũng phơi ra theo.

Giải pháp: cho metrics ra **port phụ riêng** (9091/9092/9093/2112). Khi đó:

- Port nghiệp vụ (3000/3005/3009/3010): mở như cũ, nhưng **không còn chứa `/metrics`**.
- Port metrics (9091...): firewall khóa kín, **chỉ cho IP của VPS 225 vào**.

Kết quả: metrics nằm hoàn toàn sau firewall, port nghiệp vụ không lộ gì thêm. Đồng nhất giữa NestJS và Go.

### 9.3. Cấu hình firewall (UFW)

Chạy trên **cả 219 và 222**:

```bash
sudo ufw allow from 103.116.52.225 to any port 9091 proto tcp  # nestjs gateway
sudo ufw allow from 103.116.52.225 to any port 9092 proto tcp  # nestjs pay
sudo ufw allow from 103.116.52.225 to any port 9093 proto tcp  # nestjs game
sudo ufw allow from 103.116.52.225 to any port 2112 proto tcp  # golang
sudo ufw status verbose    # xác nhận: Default: deny (incoming)
```

> **Cảnh báo về UFW:** lệnh `allow from <ip>` chỉ thực sự chặn IP khác nếu **default policy là deny incoming**. Kiểm tra bằng `ufw status verbose` — phải thấy `Default: deny (incoming)`. Nếu đang là allow, cần `sudo ufw default deny incoming` (và **nhớ allow SSH trước** kẻo tự khóa mình ra ngoài).

---

## 10. Phần III — Dựng Prometheus

> Làm trên: VPS 225

### 10.1. Tạo file `prometheus.yml`

Đặt cùng thư mục với `docker-compose.yml`:

```yaml
global:
  scrape_interval: 15s        # kéo metrics mỗi 15 giây
  evaluation_interval: 15s    # đánh giá rule mỗi 15 giây

scrape_configs:
  - job_name: 'prometheus'    # Prometheus tự giám sát chính nó
    static_configs:
      - targets: ['localhost:9090']

  - job_name: 'nestjs-gateway'
    metrics_path: '/metrics'
    static_configs:
      - targets: ['103.116.52.222:9091', '103.116.52.219:9091']

  - job_name: 'nestjs-pay'
    metrics_path: '/metrics'
    static_configs:
      - targets: ['103.116.52.222:9092', '103.116.52.219:9092']

  - job_name: 'nestjs-game'
    metrics_path: '/metrics'
    static_configs:
      - targets: ['103.116.52.222:9093', '103.116.52.219:9093']

  - job_name: 'golang-game'
    metrics_path: '/metrics'
    static_configs:
      - targets: ['103.116.52.222:2112', '103.116.52.219:2112']
```

**Giải thích các khái niệm:**

- `scrape_interval: 15s` — Prometheus kéo metrics 15 giây một lần. Đủ chi tiết cho hầu hết nhu cầu, không quá nặng.
- `job_name` — nhóm các target cùng loại. Mỗi job sẽ thành một nhãn `job=` trong dữ liệu, dùng để lọc sau này.
- `targets` — danh sách `IP:port` mà Prometheus sẽ kéo. Mỗi target thành nhãn `instance=`.
- `metrics_path` — đường dẫn endpoint, mặc định đã là `/metrics` nhưng ghi rõ cho minh bạch.

### 10.2. Thêm service vào `docker-compose.yml`

```yaml
  prometheus:
    image: prom/prometheus:latest
    container_name: prometheus
    restart: unless-stopped
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--storage.tsdb.retention.time=30d'   # giữ dữ liệu 30 ngày
    ports:
      - '127.0.0.1:9090:9090'                  # CHỈ bind localhost
```

**Giải thích:**

- `restart: unless-stopped` — tự khởi động lại nếu container chết hoặc VPS reboot.
- `volumes: prometheus_data:/prometheus` — **named volume** để dữ liệu không mất khi container bị xóa/tạo lại. Đây là điểm quan trọng: không có volume thì mỗi lần `docker compose down` là mất sạch lịch sử metrics.
- `prometheus.yml:...:ro` — mount file config dạng read-only.
- `retention.time=30d` — tự xóa dữ liệu cũ hơn 30 ngày, tránh đầy đĩa.
- `127.0.0.1:9090:9090` — chỉ bind localhost, không phơi Prometheus ra ngoài (nó là hậu trường).

### 10.3. Khai báo named volume

Ở cuối file compose, thêm vào key `volumes:` top-level (nếu chưa có thì tạo mới, có rồi thì thêm dòng):

```yaml
volumes:
  prometheus_data:
  grafana_data:
```

### 10.4. Khởi động

```bash
docker compose up -d prometheus
```

---

## 11. Phần IV — Dựng Grafana

> Làm trên: VPS 225

### 11.1. Thêm service vào `docker-compose.yml`

```yaml
  grafana:
    image: grafana/grafana:latest
    container_name: grafana
    restart: unless-stopped
    volumes:
      - grafana_data:/var/lib/grafana
    environment:
      GF_SECURITY_ADMIN_USER: ${GRAFANA_USER}
      GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_PASS}
      GF_SERVER_ROOT_URL: https://grafana.ngocrongdark.com/
      GF_USERS_ALLOW_SIGN_UP: 'false'
    ports:
      - '127.0.0.1:3001:3000'                  # map 3001 ra ngoài vì 3000 để cho app
    depends_on:
      - prometheus
```

**Giải thích:**

- `GF_SECURITY_ADMIN_USER/PASSWORD` — tài khoản admin khởi tạo, đọc từ `.env`.
- `GF_SERVER_ROOT_URL` — URL gốc, để Grafana sinh link đúng khi chạy sau reverse proxy.
- `GF_USERS_ALLOW_SIGN_UP: 'false'` — tắt tự đăng ký, chỉ admin tạo user. Quan trọng vì Grafana sẽ public qua domain.
- `127.0.0.1:3001:3000` — Grafana chạy port 3000 bên trong container, map ra `3001` của host (vì `3000` đã dành cho app NestJS). Vẫn chỉ bind localhost — ra ngoài qua nginx.
- `grafana_data` — named volume để giữ dashboard, user, cấu hình khi tạo lại container.

### 11.2. Thêm biến vào `.env`

```bash
GRAFANA_USER=admin
GRAFANA_PASS=mật-khẩu-mạnh-của-bạn
```

### 11.3. Khởi động

```bash
docker compose up -d grafana
```

---

## 12. Phần V — DNS & Nginx reverse proxy

> Làm trên: Cloudflare DNS + Nginx trên VPS 225

### 12.1. Tạo DNS record trên Cloudflare

1. Đăng nhập Cloudflare → chọn domain `ngocrongdark.com`.
2. Vào tab **DNS → Records**.
3. Bấm **Add record**:
   - **Type:** `A`
   - **Name:** `grafana` (Cloudflare tự ghép thành `grafana.ngocrongdark.com`)
   - **IPv4 address:** `103.116.52.225` (IP của VPS 225 chạy nginx)
   - **Proxy status:** tùy chọn —
     - **Proxied** (đám mây cam): traffic đi qua Cloudflare, ẩn IP gốc, có CDN/DDoS protection. Nếu dùng, lưu ý cert và header `CF-Connecting-IP`.
     - **DNS only** (đám mây xám): trỏ thẳng tới VPS, đơn giản hơn cho việc xin cert Let's Encrypt lần đầu.
4. **Save.**

> Khuyến nghị: lần đầu để **DNS only** cho dễ xin cert, ổn rồi mới bật Proxied nếu muốn.

### 12.2. Xin SSL certificate

Nếu cert hiện tại chỉ cover `api.*`, xin thêm cho subdomain Grafana:

```bash
certbot certonly --nginx -d grafana.ngocrongdark.com
```

Nếu đã có **wildcard cert** (`*.ngocrongdark.com`) thì bỏ qua, dùng cert cũ.

### 12.3. Thêm server block vào `nginx.conf`

Đặt trong khối `http { }`, cạnh các server block khác:

```nginx
# GRAFANA
server {
    listen 80;
    server_name grafana.ngocrongdark.com;
    return 301 https://$host$request_uri;        # ép HTTPS
}
server {
    listen 443 ssl;
    server_name grafana.ngocrongdark.com;
    ssl_certificate     /etc/letsencrypt/live/api.ngocrongdark.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.ngocrongdark.com/privkey.pem;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;

    location / {
        proxy_pass http://127.0.0.1:3001;        # trỏ tới Grafana
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;   # cần cho live tail / WebSocket
        proxy_set_header Connection $connection_header;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }
}
```

**Lưu ý quan trọng:**

- **Không đặt `auth_basic` cho Grafana** — Grafana có hệ thống login riêng, thêm basic auth nữa sẽ gây double-auth khó chịu và làm hỏng một số tính năng.
- Hai header `Upgrade`/`Connection` cần thiết vì Grafana dùng WebSocket cho live tail.
- Nếu xin cert riêng ở 12.2, sửa hai dòng `ssl_certificate*` trỏ về `/etc/letsencrypt/live/grafana.ngocrongdark.com/`.

### 12.4. Reload nginx

```bash
nginx -t && nginx -s reload
# nếu nginx chạy trong container:
docker compose restart nginx
```

`nginx -t` kiểm tra cú pháp config trước khi reload — luôn chạy bước này để tránh làm sập nginx vì lỗi cú pháp.

---

## 13. Phần VI — Sử dụng Grafana từ A đến Z

> Phần này ghi chi tiết từng thao tác trong giao diện Grafana, để không phải mò lại từ đầu.

### 13.1. Đăng nhập lần đầu

1. Mở trình duyệt: `https://grafana.ngocrongdark.com`
2. Login bằng `GRAFANA_USER` / `GRAFANA_PASS` đã đặt trong `.env`.

### 13.2. Các khu vực chính của Grafana

| Khu vực | Chức năng |
|---|---|
| **Connections → Data sources** | Khai báo nguồn dữ liệu (Prometheus, Loki...). Đây là nơi nối Grafana với Prometheus. |
| **Dashboards** | Danh sách & tạo dashboard. Mỗi dashboard chứa nhiều panel. |
| **Explore** | Khu thử nghiệm query nhanh, không cần tạo panel. Rất hữu ích để debug. |
| **Alerting** | Cấu hình cảnh báo khi metric vượt ngưỡng. (Phần mở rộng.) |
| **Administration** | Quản lý user, tổ chức, cấu hình hệ thống. |

### 13.3. Bước 1 — Thêm Data Source (mắt xích nối Grafana ↔ Prometheus)

Đây là bước quan trọng nhất — trước nó Grafana là màn hình chưa cắm dây.

1. Menu trái → **Connections → Data sources**.
2. Bấm **Add data source** → chọn **Prometheus**.
3. Ô **Connection URL**, điền:
   ```
   http://prometheus:9090
   ```
   > **Vì sao là `prometheus:9090` mà không phải `localhost`?** Grafana chạy trong container. Với nó, "localhost" là chính nó, không phải Prometheus. Trong cùng một Docker network, các container gọi nhau bằng **tên service** (`prometheus`) — Docker tự phân giải tên này thành IP nội bộ của container Prometheus.
4. Các ô khác để mặc định.
5. Kéo xuống cuối → **Save & test**.
6. Phải hiện báo xanh: *"Successfully queried the Prometheus API"*. Đây là dấu hiệu dây đã cắm xong.

### 13.4. Bước 2 — Kiểm tra dữ liệu chảy về (Explore)

Trước khi import dashboard, xác nhận Prometheus thực sự kéo được metrics. Vào **Explore** (menu trái):

1. Chọn data source **Prometheus** ở góc trên.
2. Chuyển ô query sang chế độ **Code** (nút gạt **Builder | Code** ở góc phải khu query).
   > **Builder vs Code:** Builder cho chọn metric/filter bằng dropdown (dễ cho người mới). Code cho gõ query PromQL tự do (nhanh cho người quen). Để gõ query viết tay như `up` thì phải ở Code.
3. Gõ:
   ```promql
   up
   ```
4. Bấm **Run query** (hoặc Shift+Enter).
5. Kết quả mong đợi — danh sách target với giá trị `1` (sống) hoặc `0` (chết):
   ```
   up{job="nestjs-gateway", instance="103.116.52.222:9091"}  1
   up{job="nestjs-pay",     instance="103.116.52.219:9092"}  1
   ... (9 dòng, đều = 1)
   ```

`up` là metric đặc biệt do chính Prometheus sinh ra cho mỗi target: `1` nếu kéo metrics thành công, `0` nếu thất bại. Đây là cách nhanh nhất kiểm tra toàn bộ chuỗi app → Prometheus đã thông.

### 13.5. Khái niệm Query, Panel, Dashboard

| Khái niệm | Là gì |
|---|---|
| **Query** | Một câu PromQL hỏi Prometheus, ví dụ `go_goroutines{job="golang-game"}`. |
| **Panel** | Một ô hiển thị, vẽ kết quả của một (hoặc nhiều) query thành biểu đồ. Có nhiều kiểu: Time series (đường), Stat (số lớn), Gauge (đồng hồ), Table... |
| **Dashboard** | Một trang gồm nhiều panel xếp cạnh nhau. |
| **Variable** | Biến template (ví dụ `$instance`) tạo dropdown lọc ở đầu dashboard, cho phép một dashboard xem được nhiều instance/service. |

### 13.6. Cách import dashboard có sẵn

1. Menu trái → **Dashboards** → nút **New** (góc phải) → **Import**.
   - Đường tắt: vào thẳng URL `/dashboard/import`.
2. Trong ô **"Import via grafana.com"**, gõ **ID** của dashboard (ví dụ `11159`) → bấm **Load**.
3. Grafana tải về và hiện form cấu hình:
   - **Name / Folder:** để mặc định hoặc đổi tên cho dễ tìm.
   - **Data source (DS_PROMETHEUS):** **bắt buộc chọn** đúng Prometheus đã tạo. Đây là lỗi hay gặp nhất khiến dashboard trống.
4. Bấm **Import** → nhảy thẳng vào dashboard.

### 13.7. Cách tự tạo panel (khi cần)

1. Trong dashboard → **Add → Visualization** (hoặc **Add panel**).
2. Chọn data source **Prometheus**.
3. Chuyển sang **Code** mode → gõ query PromQL.
4. **Run query** → biểu đồ hiện ở preview.
5. Cột phải tinh chỉnh:
   - **Panel options → Title:** đặt tên panel.
   - **Standard options → Unit:** chọn đơn vị (ví dụ `bytes(IEC)` cho memory để hiện MB/GB thay vì số thô; `seconds` cho thời gian).
   - **Legend:** gõ `{{instance}}` hoặc `{{job}} {{instance}}` để mỗi đường ghi rõ thuộc service nào.
   - **Visualization type** (Time series / Stat / Gauge...): chọn kiểu hiển thị phù hợp.
6. **Back to dashboard** để lưu panel.
7. **Save dashboard** (nút xanh góc phải) để lưu cả dashboard — **đừng quên bước này**, rời trang không Save là mất hết.

---

## 14. Phần VII — Dựng 2 dashboard NodeJS & Go

### 14.1. Dashboard NodeJS — ID `11159`

1. Import dashboard ID `11159` (theo mục 13.6), chọn data source Prometheus.
2. Mở ra, nhiều khả năng dropdown **instance** ở góc trái báo **tam giác đỏ** và trống → mọi panel "No data".

**Nguyên nhân:** dashboard này (xuất bản 2019) định nghĩa biến `instance` bằng query lỗi. Cần sửa lại biến.

**Cách sửa biến `instance`:**

1. Bấm **Edit** (góc phải) → **Settings** (bánh răng) → **Variables** → bấm biến **instance**.
2. Cấu hình:
   - **Type:** `Query` *(nếu type không phải Query, sẽ không có ô nhập query — đây là lý do hay bị kẹt)*
   - **Target data source:** `Prometheus` *(nếu để trống, Preview luôn rỗng)*
   - **Query type:** `Label values`
   - **Label:** `instance` *(KHÔNG phải `$instance` — dấu `$` khiến biến tự tham chiếu chính nó → rỗng)*
   - **Metric:** chọn một metric mà app phát ra (ví dụ `process_resident_memory_bytes`). **Lưu ý:** không chọn metric chỉ Prometheus có, vì sẽ chỉ ra `localhost:9090` (1 giá trị) thay vì đủ instance app.
3. Phần **Preview of values** phải hiện đủ ~9 instance:
   ```
   103.116.52.219:2112, 103.116.52.219:9091, ... 103.116.52.222:9093, localhost:9090
   ```
4. **Apply** → **Save dashboard**.
5. Ra dashboard, dropdown instance giờ chọn được. Chọn một instance NestJS (ví dụ `103.116.52.219:9091`) → panel hiện data.

> **Lưu ý:** chọn instance NestJS (`:9091/9092/9093`) cho dashboard NodeJS. Chọn `:2112` (Go) hoặc `localhost:9090` (Prometheus) sẽ ra trống vì khác loại metric.

**Các panel chính của dashboard này:** Process CPU Usage, Event Loop Lag, Process Memory Usage, Node.js Version, Process Restarts, Active Handlers/Requests.

### 14.2. Dashboard Go — ID `6671`

1. Import dashboard ID `6671` ("Go Processes"), chọn Prometheus.
2. Dashboard này dùng metric `client_golang` chuẩn nên **đa số panel chạy ngay**. Tuy nhiên nó được viết cho **Kubernetes** nên có hai vấn đề:

**Vấn đề A — hai biến `namespace` và `pod` báo đỏ.** Đây là khái niệm Kubernetes, vô nghĩa với Docker thuần. Có thể kệ (không ảnh hưởng data) hoặc ẩn đi: Settings → Variables → chọn từng biến → **Show on dashboard: Nothing**.

**Vấn đề B — query lọc theo `$namespace/$pod` rỗng → panel trống.** Nhiều panel có query kiểu:
```promql
go_goroutines{namespace=~"^($namespace)$",pod=~"^($pod)$"}
```
Vì `$namespace` và `$pod` rỗng, regex `=~"^()$"` lọc ra rỗng → panel trống.

**Cách sửa:** vào từng panel cần dùng → **Edit** → thay nguyên cụm filter K8s bằng filter `job` của ta:

| Panel | Query gốc (lỗi) | Query đã sửa |
|---|---|---|
| Goroutines | `go_goroutines{namespace=~...,pod=~...}` | `go_goroutines{job="golang-game"}` |
| Heap in use | `go_memstats_heap_inuse_bytes{namespace=~...}` | `go_memstats_heap_inuse_bytes{job="golang-game"}` |
| GC duration | `go_gc_duration_seconds{namespace=~...}` | `go_gc_duration_seconds{job="golang-game"}` |
| Open FDs | `process_open_fds{namespace=~...}` | `process_open_fds{job="golang-game"}` |

**Quy tắc chung:** thấy `{namespace=~"...",pod=~"..."}` → thay bằng `{job="golang-game"}`.

### 14.3. Bộ 4 panel cốt lõi cho service Go

Với một service Go, chỉ cần 4 panel này là đủ đọc sức khỏe — sửa đủ 4 cái là dừng được, không cần tỉa hết dashboard:

| Panel | Query | Ý nghĩa | Dấu hiệu xấu |
|---|---|---|---|
| **Goroutines** | `go_goroutines{job="golang-game"}` | Số goroutine đang chạy | Tăng tuyến tính không giảm = **goroutine leak** |
| **Heap in use** | `go_memstats_heap_inuse_bytes{job="golang-game"}` | RAM heap thực dùng | Phình mãi không giảm = **memory leak** |
| **GC duration** | `go_gc_duration_seconds{job="golang-game"}` | Thời gian thu gom rác | Thường xuyên > 50-100ms = **gây lag spike** |
| **Open FDs** | `process_open_fds{job="golang-game"}` | Số file descriptor mở (≈ số WebSocket connection) | Tiến sát `process_max_fds` = **sắp hết khả năng nhận connection** |

> **Mẹo:** thêm query `process_max_fds{job="golang-game"}` vào panel Open FDs để thấy cả ngưỡng trần — biết còn cách giới hạn bao xa. Kiểm tra giới hạn fd của OS bằng `ulimit -n` (mặc định 1024, thường cần nâng cho game đông).

> **Lưu ý về `process_virtual_memory_bytes`:** số này ở Go thường rất lớn nhưng phần lớn vô hại — Go runtime reserve sẵn vùng địa chỉ ảo khổng lồ mà không thực dùng. Theo dõi **RSS** (`process_resident_memory_bytes`) và **heap inuse**, không phải virtual memory.

---

## 15. Đọc hiểu metrics — nhìn biểu đồ thế nào để biết khỏe hay bệnh

> **Chương này dành cho người chưa từng làm monitoring.** Nếu bạn là backend dev mở Grafana lần đầu, nhìn vào một mớ đường lượn sóng nhiều màu và không biết bắt đầu từ đâu — chương này viết cho bạn. Ta đi từ con số 0: một biểu đồ gồm những gì, đọc theo thứ tự nào, rồi mới tới từng metric cụ thể. Đọc hết chương này bạn sẽ tự nhìn dashboard và nói được "cái này bình thường" hay "cái này có vấn đề".

---

### 15.0. Vỡ lòng: một biểu đồ trên Grafana gồm những gì?

Trước khi đọc được "khỏe hay bệnh", phải hiểu mình đang nhìn cái gì. Một panel biểu đồ đường (Time series — loại phổ biến nhất) gồm các thành phần sau:

```
   Process Memory Usage          ← (1) TIÊU ĐỀ PANEL: panel này đo cái gì
   ┌────────────────────────────────────────┐
200MB│                          ___________   │  ← (2) TRỤC TUNG (dọc): GIÁ TRỊ
   │                      ____/               │     (ở đây là dung lượng RAM)
150MB│                 ___/                    │
   │            _____/                        │
100MB│      _____/          ╱╲    ╱╲           │  ← (4) ĐƯỜNG: mỗi đường = 1 series
   │  ___/              ╱╲╱  ╲  ╱  ╲          │     (mỗi màu = 1 instance/service)
 50MB│_/        ╱╲    ╱╲                       │
   │                                          │
   └────────────────────────────────────────┘
    18:00   18:15   18:30   18:45   19:00      ← (3) TRỤC HOÀNH (ngang): THỜI GIAN
   ─────────────────────────────────────────
   🟢 gateway-219:9091   🟡 gateway-222:9091   ← (5) CHÚ THÍCH (legend): đường nào là gì
```

Giải thích từng phần:

**(1) Tiêu đề panel** — cho biết panel này đo gì. "Process Memory Usage" = đo RAM. Luôn đọc tiêu đề trước.

**(2) Trục tung (dọc)** — là **giá trị** của metric. Cao = nhiều, thấp = ít. Đơn vị nằm ở đây (MB, %, ms, số đếm...). Nhìn trục này để biết "đang là bao nhiêu".

**(3) Trục hoành (ngang)** — luôn là **thời gian**, chạy từ trái (cũ) sang phải (mới nhất). Mép phải là *hiện tại*. Đây là điểm cốt lõi của monitoring: ta xem giá trị *thay đổi theo thời gian*, không phải một con số tĩnh.

**(4) Đường (line)** — nối các điểm đo theo thời gian. Mỗi đường là một "series" — tức một nguồn dữ liệu riêng. Vì hệ thống có nhiều instance (gateway chạy trên cả 219 và 222), nên một panel thường có **nhiều đường, mỗi màu một instance**. Đường đi lên = giá trị tăng; đi xuống = giảm; nằm ngang = không đổi.

**(5) Chú thích (legend)** — bảng màu ở dưới (hoặc bên phải) cho biết đường màu nào thuộc instance/service nào. Đây là lý do ta đặt legend `{{instance}}` lúc tạo panel — để phân biệt được.

> **Quy tắc đọc một panel theo thứ tự:**
> 1. Đọc **tiêu đề** → biết đang đo gì.
> 2. Nhìn **trục tung** → biết đơn vị và mức giá trị hiện tại (nhìn mép phải = mới nhất).
> 3. Nhìn **hình dạng đường** từ trái sang phải → giá trị đang tăng, giảm, hay ổn định?
> 4. Nhìn **legend** → nếu một đường bất thường, nó là instance nào?

---

### 15.1. Ba câu hỏi vàng khi nhìn bất kỳ đường nào

Sau khi biết đọc các thành phần, đây là tư duy cốt lõi. Với *mọi* metric, hỏi ba câu:

**Câu 1 — Hình dạng đường ra sao?** Đây là câu quan trọng nhất. Có 4 hình dạng cơ bản, học thuộc chúng:

```
A. NẰM NGANG (phẳng)        B. RĂNG CƯA (lên xuống đều)
   │________________           │  /\  /\  /\  /\
   │                           │ /  \/  \/  \/  \
   └──────────────►            └──────────────►
   → Ổn định                   → Dao động bình thường (cấp phát rồi dọn)

C. LEO DỐC (tăng một chiều)  D. GAI NHỌN (spike đột ngột)
   │           ___/            │      |
   │       ___/                │      |
   │   ___/                    │______|________
   │__/                        │
   └──────────────►            └──────────────►
   → ⚠️ Thường là LEAK         → Burst ngắn, thường vô hại
```

- **A (nằm ngang)** và **B (răng cưa quanh một mức)** = thường **khỏe**.
- **C (leo dốc một chiều, không bao giờ xuống)** = **dấu hiệu xấu nhất** với hầu hết metric. Đây là "leak" (rò rỉ) — thứ gì đó tăng mãi mà không được giải phóng. Sẽ dẫn tới sập.
- **D (gai nhọn rồi về)** = thường vô hại, chỉ là một đợt bận đột ngột.

**Câu 2 — So với mức nền (baseline) thì sao?** "Bình thường" của hệ thống bạn là bao nhiêu? Phải quan sát vài ngày để biết. Ví dụ: nếu memory ngày thường ~200MB, hôm nay thấy 600MB → bất thường. Không có baseline thì không biết thế nào là lạ.

**Câu 3 — Có trùng với sự kiện gì không?** Đường vọt lên đúng lúc nào? Đúng lúc deploy? Đúng giờ cao điểm tối? Đúng lúc một service khác chết? Tương quan thời gian giúp tìm nguyên nhân.

> **Nguyên tắc nhàng đầu cần khắc cốt:**
> **Spike (gai nhọn) ngắn → kệ. Trend (xu hướng) kéo dài → điều tra.**
> CPU vọt 100% trong 5 giây rồi về = một burst, bình thường. CPU bò từ 30% lên 90% suốt 3 tiếng = vấn đề thật. Đừng hoảng vì một cái gai; hãy lo về một cái dốc.

---

### Cấu trúc đọc từng metric bên dưới

Từ đây, mỗi metric quan trọng được trình bày theo cùng một khuôn để dễ theo:
- **Nó là gì** (giải thích bằng ngôn ngữ thường, có ví dụ đời thực)
- **Vì sao phải quan tâm**
- **Đơn vị & con số bình thường**
- **Bảng đọc biểu đồ**: thấy thế này → nghĩa là → làm gì
- **Nếu bệnh thì sửa thế nào**

---

### 15.2. Event Loop Lag (NestJS) — chỉ số sức khỏe SỐ 1 của Node.js

**Nó là gì.** Node.js chạy **đơn luồng** (single-threaded) — nghĩa là cả app chỉ có *một* người làm việc, xử lý tuần tự từng việc một. "Event loop" là vòng lặp mà người làm việc đó liên tục quay để nhận và xử lý công việc mới. **Event loop lag** đo: khi có một việc mới cần làm, nó phải *chờ* bao lâu mới tới lượt được xử lý.

> **Ví dụ đời thực:** tưởng tượng một siêu thị chỉ có **một quầy thu ngân duy nhất**. Lag là thời gian một khách phải xếp hàng chờ tới lượt tính tiền. Nếu quầy đang xử lý một khách có 200 món (tác vụ nặng), thì *mọi khách khác* phải đứng chờ — dù họ chỉ mua 1 món.

**Vì sao quan trọng nhất.** Vì Node chỉ có một luồng, nếu một đoạn code chạy lâu mà không nhường (vòng lặp nặng, xử lý JSON khổng lồ, mã hóa đồng bộ), nó **chặn đứng toàn bộ** event loop. Hậu quả: *mọi* request của *mọi* người dùng đều bị treo chờ — kể cả khi CPU còn rảnh. Đây là lý do lag là chỉ số sức khỏe quan trọng nhất của một app Node: nó phản ánh trực tiếp "app có đang phản hồi nhanh không".

**Đơn vị & con số bình thường.** Đơn vị là **giây** (Grafana thường hiển thị ms). Bình thường **dưới ~10ms**. Trong hệ thống này đo được ~3–4ms → rất khỏe.

**Bảng đọc biểu đồ:**

| Đường trông thế nào | Nghĩa là | Làm gì |
|---|---|---|
| Phẳng, dưới ~10ms | 🟢 Khỏe, event loop thông thoáng | Không cần làm gì |
| Dao động 10–50ms lúc cao điểm | 🟡 Bắt đầu chịu tải, chấp nhận được | Để mắt, ghi nhận giờ cao điểm |
| Thường xuyên trên 100ms | 🟠 Event loop nghẽn, app chậm cho mọi user | Tìm code đồng bộ nặng đang chặn loop |
| Gai nhọn lên 500ms+ rồi về | 🟡 Có tác vụ blocking lẻ | Tìm tác vụ cụ thể đó |

**Nếu bệnh thì sửa thế nào.** Lag cao gần như luôn do **code đồng bộ (synchronous/blocking)** chặn loop. Các thủ phạm phổ biến: vòng lặp `for` xử lý mảng cực lớn, `JSON.parse`/`JSON.stringify` object khổng lồ, hàm `crypto` đồng bộ, regex phức tạp trên chuỗi dài, đọc file đồng bộ (`readFileSync`). Cách chữa: chuyển sang phiên bản async (`await`), chia nhỏ công việc thành nhiều lượt (cho loop "thở"), hoặc đẩy việc nặng sang **worker thread** (luồng riêng, không chặn loop chính).

---

### 15.3. Process Memory Usage (RSS) — RAM thực app đang chiếm

**Nó là gì.** RSS (Resident Set Size) = lượng RAM **vật lý thực tế** mà tiến trình đang chiếm dụng. Đây là con số RAM "thật" nhất, đáng tin nhất để theo dõi.

> **Ví dụ đời thực:** RSS giống như diện tích sàn nhà mà đồ đạc của bạn đang *thực sự* chiếm. Khác với "diện tích bạn đã thuê" (virtual memory — xem 15.8) thường lớn hơn nhiều nhưng không dùng hết.

**Vì sao quan trọng.** RAM là tài nguyên hữu hạn. Nếu app dùng hết RAM của máy, hệ điều hành Linux sẽ **giết tiến trình** (OOM-kill, xem bên dưới) để cứu máy → app chết đột ngột. Theo dõi RSS để thấy vấn đề *trước khi* điều đó xảy ra.

**Đơn vị & con số bình thường.** Đơn vị là **bytes** (Grafana hiển thị MB/GB nếu đặt unit `bytes(IEC)`). "Bình thường" tùy app — phải học baseline. Trong hệ thống này: gateway ~193 MiB ổn định, Go ~14.6 MiB (Go vốn nhẹ hơn Node nhiều).

**Đây là chỗ quan trọng nhất — học phân biệt 3 hình dạng:**

```
HÌNH A — KHỎE (răng cưa quanh một mức):
  MB │    /\    /\    /\
     │   /  \  /  \  /  \      ← lên rồi xuống, quanh một mức nền cố định
     │  /    \/    \/         (app cấp phát RAM, rồi GC dọn dẹp, lặp lại)
     └─────────────────► thời gian
  → Bình thường. Garbage Collector đang làm việc đúng.

HÌNH B — LEAK (leo dốc một chiều, KHÔNG BAO GIỜ xuống):
  MB │            ___/
     │        ___/            ← bò lên đều đặn, GC không dọn được
     │    ___/                  → MEMORY LEAK. Sẽ tăng đến khi hết RAM → OOM.
     │ __/
     └─────────────────► thời gian
  → ⚠️ Đây là vấn đề. Cần tìm và sửa.

HÌNH C — BẬC THANG (tăng theo tải rồi giữ ngang):
  MB │         __________
     │        /                ← tăng khi đông người chơi, rồi giữ ổn định
     │   ____/                   ở mức cao mới (thường bình thường)
     │  /
     └─────────────────► thời gian
  → Thường ổn NẾU khi tải giảm thì RAM cũng giảm lại. Đáng lo nếu tải giảm mà RAM cứ giữ cao.
```

**Bảng đọc biểu đồ:**

| Hình dạng | Nghĩa là | Làm gì |
|---|---|---|
| **A — răng cưa quanh mức nền** | 🟢 Bình thường, GC làm việc đúng | Không cần làm gì |
| **B — leo dốc không giảm** | 🔴 Memory leak, sẽ OOM | Tìm leak (xem dưới) — khẩn |
| **C — bậc thang theo tải** | 🟡 Thường ổn nếu giảm khi tải giảm | Quan sát; không giảm → nghi leak |

**OOM là gì.** OOM = Out Of Memory. Khi RAM máy cạn, Linux chạy "OOM killer" — chọn tiến trình ngốn RAM nhất và **giết nó** để cứu cả máy. App của bạn biến mất đột ngột, không lời từ biệt. Process Restarts (15.5) sẽ tăng lên. Đây chính là lý do phải theo dõi RSS: để bắt được hình B *trước khi* nó chạm trần RAM.

**Nếu bệnh (hình B) thì sửa thế nào.** Memory leak trong Node thường do: biến/mảng global cứ thêm vào mà không xóa, event listener đăng ký mà không gỡ (`addEventListener` không `removeEventListener`), cache không có giới hạn kích thước, closure giữ tham chiếu tới object lớn không cho GC dọn. Cách điều tra: dùng heap snapshot (Chrome DevTools / `--inspect`), so sánh 2 snapshot cách nhau để thấy object nào tăng mãi.

---

### 15.4. Process CPU Usage — mức độ bận rộn của vi xử lý

**Nó là gì.** Phần trăm thời gian CPU đang phải làm việc cho tiến trình này.

**Lưu ý đặc biệt — số có thể VƯỢT 100%.** Đây là chỗ hay gây hoang mang. Một CPU core = 100%. Máy nhiều core, và một tiến trình có thể dùng nhiều luồng cùng lúc (Node có các luồng nền cho I/O và GC), nên tổng có thể vượt 100%. **150% nghĩa là đang dùng 1.5 core** — hoàn toàn bình thường, không phải lỗi.

**Đơn vị & con số bình thường.** Đơn vị phần trăm (%). Tính bằng `rate(process_cpu_seconds_total[5m]) * 100`. Bình thường dao động thấp, theo nhịp tải.

**Bảng đọc biểu đồ:**

| Đường trông thế nào | Nghĩa là | Làm gì |
|---|---|---|
| Dao động thấp (10–40%), theo nhịp người dùng | 🟢 Khỏe | Không cần làm gì |
| Gai nhọn 100%+ lúc khởi động rồi về | 🟢 Bình thường — start app luôn tốn CPU | Kệ |
| Cao liên tục sát trần (vd 100% kéo dài) | 🟠 Nghẽn CPU, app xử lý không kịp | Tìm code tốn CPU; cân nhắc thêm instance |
| Bò lên đều theo thời gian | 🟡 Có thể tải tăng dần hoặc leak | Đối chiếu với số người chơi |

**Mẹo kết hợp với event loop lag:** Nếu CPU cao **và** lag cao cùng lúc → app thực sự quá tải tính toán, cần scale. Nếu lag cao nhưng CPU thấp → có code blocking nhưng không tốn CPU (vd đang chờ I/O đồng bộ) → vấn đề khác, không phải thiếu CPU.

---

### 15.5. Process Restarts — đếm số lần app khởi động lại

**Nó là gì.** Số lần tiến trình bị khởi động lại (restart) tính từ lúc bắt đầu đo.

**Vì sao quan trọng — đây là lý do "container Up" không đủ.** Một service có thể *luôn có tiến trình đang chạy* (Docker hiển thị "Up") nhưng thực ra liên tục chết và tự dựng lại. Chỉ nhìn "Up" thì tưởng khỏe, nhưng nhìn số restart mới thấy sự thật.

**Đơn vị & con số bình thường.** Số đếm. Bình thường con số này **không đổi** (phẳng).

**Bảng đọc biểu đồ:**

| Đường trông thế nào | Nghĩa là | Làm gì |
|---|---|---|
| Phẳng (không đổi) | 🟢 App chạy ổn định, không crash | Không cần làm gì |
| Tăng vài lần đúng lúc bạn deploy | 🟢 Bình thường — deploy = restart | Kệ |
| **Tăng liên tục, đều đặn, không ai deploy** | 🔴 **Crash loop** — app cứ chết rồi tự dựng lại | Khẩn: xem log tìm lỗi khiến app chết |

**Crash loop là gì.** App khởi động → chạy được vài giây → gặp lỗi → crash → trình quản lý (Docker/PM2) tự khởi động lại → lại crash... Vòng lặp này lặp mãi. Service "có vẻ sống" nhưng thực ra liên tục chết, người dùng gặp lỗi liên miên. Thường do: lỗi cấu hình (thiếu biến môi trường), không kết nối được DB lúc khởi động, lỗi code chí mạng (uncaught exception).

> Trong hệ thống này thấy Process Restarts = 6 — do deploy/test nhiều lần lúc dựng. Nếu sau này con số *tự* tăng mà không ai động vào → crash loop, điều tra ngay.

---

### 15.6. Goroutines (Go) — chỉ số sức khỏe SỐ 1 của Go

**Nó là gì.** Goroutine là "luồng siêu nhẹ" của Go. Trong khi Node đơn luồng, Go xử lý đồng thời bằng cách tạo ra **rất nhiều** goroutine chạy song song — mỗi WebSocket connection thường spawn vài cái. Metric này đếm số goroutine đang tồn tại.

> **Ví dụ đời thực:** nếu Node là siêu thị một quầy thu ngân, thì Go là siêu thị mở **hàng nghìn quầy nhỏ** cùng lúc, mỗi khách một quầy riêng. Goroutine là các quầy đó. Bình thường: khách đến mở quầy, khách đi đóng quầy. Bệnh: khách đi rồi mà quầy không đóng → quầy chất đống mãi.

**Vì sao quan trọng nhất với Go.** Mỗi goroutine ăn một ít RAM (stack). Nếu code tạo goroutine mà chúng không bao giờ kết thúc (goroutine leak), số lượng tăng vô hạn → ngốn RAM dần → cuối cùng OOM. Với game high-performance tạo goroutine cho mỗi connection, đây là bug cần bắt sớm nhất.

**Đơn vị & con số bình thường.** Số đếm. **Quy tắc vàng: số goroutine phải tỷ lệ với số connection/người chơi** — tăng khi đông, *giảm khi vắng*.

```
KHỎE (dao động theo số người chơi):     LEAK (leo mãi không giảm):
  số │   /\    /\                          số │           ___/
     │  /  \  /  \    ← lên khi đông          │       ___/      ← tăng cả khi
     │ /    \/    \     xuống khi vắng         │   ___/           người chơi giảm
     └──────────────►                         │__/             → goroutine leak
                                              └──────────────►
```

**Bảng đọc biểu đồ:**

| Hình dạng | Nghĩa là | Làm gì |
|---|---|---|
| Dao động lên/xuống theo tải | 🟢 Khỏe — goroutine sinh ra rồi kết thúc đúng | Không cần làm gì |
| **Tăng tuyến tính, không bao giờ giảm** | 🔴 Goroutine leak | Tìm goroutine không thoát — khẩn |

**Nếu bệnh thì sửa thế nào.** Goroutine leak thường do: quên đóng channel khiến goroutine chờ mãi, thiếu `context` để hủy goroutine khi không cần nữa, vòng lặp `for` trong goroutine không có điều kiện thoát, gửi vào channel không ai nhận. Cách điều tra: gói `net/http/pprof` cho phép xem goroutine dump — thấy hàng nghìn goroutine kẹt ở cùng một dòng code chính là chỗ leak.

---

### 15.7. GC Duration (Go) — thời gian dọn rác, ảnh hưởng TRỰC TIẾP độ mượt game

**Nó là gì.** GC = Garbage Collection (thu gom rác). Go tự động dọn dẹp vùng RAM không dùng nữa. Trong lúc dọn, chương trình có thể bị "khựng" lại một chút (gọi là *stop-the-world pause* — dừng cả thế giới). Metric này đo mỗi lần dọn mất bao lâu.

> **Ví dụ đời thực:** GC giống lúc lao công vào lau dọn phòng — trong vài giây đó, mọi người phải dừng lại nhường chỗ. Lau nhanh (vài ms) thì không ai để ý. Lau lâu (100ms+) thì mọi người thấy khó chịu.

**Vì sao quan trọng với game.** GC khựng 100ms = người chơi cảm nhận được một cú **giật lag** trong 100ms đó. Với game thời gian thực (đánh nhau, di chuyển), GC lâu = trải nghiệm tệ, giật cục. Đây là lý do GC duration đặc biệt nhạy với game.

**Đơn vị & cách đọc — metric này đặc biệt.** Đây là loại "summary", trả về **nhiều đường theo quantile** (phân vị):
- `quantile="0.5"` (trung vị) = một lần GC điển hình mất bao lâu.
- `quantile="1"` (max) = lần GC **tệ nhất** mất bao lâu. **Đây là đường đáng lo nhất** vì nó là cú giật tệ nhất người chơi gặp phải.

**Bảng đọc biểu đồ (nhìn đường `quantile="1"`):**

| Giá trị | Nghĩa là | Làm gì |
|---|---|---|
| Vài ms hoặc thấp hơn | 🟢 GC nhanh, không ảnh hưởng | Không cần làm gì |
| Thỉnh thoảng gai lên vài chục ms | 🟡 Chấp nhận được với game | Để mắt |
| Thường xuyên trên 50–100ms | 🟠 Gây lag spike rõ rệt cho người chơi | Tune GC (xem dưới) |

**Nếu bệnh thì sửa thế nào.** GC lâu thường do app cấp phát quá nhiều object nhỏ liên tục (tạo rác nhanh hơn dọn). Cách chữa: giảm cấp phát bằng cách tái sử dụng object (`sync.Pool`), tránh tạo slice/map mới trong vòng lặp nóng. Hoặc chỉnh biến môi trường **`GOGC`**: `GOGC=100` (mặc định) = GC chạy khi heap tăng gấp đôi. Tăng `GOGC` (vd 200) → GC chạy ít hơn (ít giật nhưng tốn RAM hơn).

---

### 15.8. Open File Descriptors (Go) — đếm "cửa" đang mở, ≈ số người chơi

**Nó là gì.** Trên Linux, *mọi thứ* đều được coi là file — kể cả mỗi kết nối mạng (socket). "File descriptor" (fd) là một con số mà hệ điều hành cấp cho mỗi file/socket đang mở, như số thứ tự gửi xe. Metric `process_open_fds` đếm số fd tiến trình đang giữ.

> **Ví dụ đời thực:** fd giống vé gửi xe. Mỗi người chơi kết nối = lấy một vé (mở một socket). Bãi xe có giới hạn số vé (`process_max_fds`). Hết vé = không nhận thêm xe = không nhận thêm người chơi.

**Vì sao quan trọng với game WebSocket.** Mỗi WebSocket connection = 1 fd. Nên `process_open_fds` xấp xỉ chính là **số người chơi đang kết nối** (cộng vài fd cho log/file hệ thống). Theo dõi nó = theo dõi số connection thực tế.

**Đơn vị & con số bình thường.** Số đếm. Quan trọng là so với **trần** `process_max_fds`.

**Bảng đọc biểu đồ:**

| Đường (so với trần `process_max_fds`) | Nghĩa là | Làm gì |
|---|---|---|
| Dao động theo người chơi, cách xa trần | 🟢 Khỏe | Không cần làm gì |
| Tiến gần sát `process_max_fds` | 🟠 Sắp hết fd → không nhận thêm connection | Nâng `ulimit -n` hoặc giới hạn connection |
| Leo mãi không giảm dù người chơi giảm | 🔴 FD leak — quên đóng socket/file | Tìm chỗ mở connection/file mà không `close()` |

**`ulimit -n` là gì.** Là giới hạn số fd tối đa mỗi tiến trình được mở, do hệ điều hành đặt. Mặc định thường **1024** — quá thấp cho game đông (chỉ 1024 người chơi là kịch trần!). Production game server cần nâng lên cao (vd 65536). Kiểm tra bằng lệnh `ulimit -n`.

> **Mẹo dashboard:** vẽ cả `process_open_fds` (đang dùng) và `process_max_fds` (trần) trên cùng panel — nhìn một cái là biết còn cách giới hạn bao xa.

---

### 15.9. Heap In Use (Go) — RAM heap thực sự đang dùng

**Nó là gì.** `go_memstats_heap_inuse_bytes` = lượng memory trong vùng "heap" mà Go đang thực sự sử dụng (đã trừ phần đã được GC giải phóng). Heap là nơi chương trình cấp phát các object động.

**Cách đọc.** Giống hệt RSS (15.3) — áp dụng đúng 3 hình dạng A/B/C. Răng cưa quanh mức nền = khỏe; leo dốc không giảm = memory leak. Đây thực ra là chỉ số memory leak **chính xác hơn RSS** cho Go, vì nó nhìn thẳng vào phần heap mà code Go cấp phát, không lẫn các vùng nhớ khác.

---

### 15.10. `up` — sống hay chết (metric đơn giản nhất nhưng quan trọng nhất)

**Nó là gì.** Prometheus tự sinh metric này cho **mỗi** target nó cố scrape. Chỉ có 2 giá trị:
- `1` = scrape thành công → **target đang sống**.
- `0` = scrape thất bại → **target chết** hoặc không kết nối được.

**Cách đọc.** Không cần biểu đồ phức tạp — chỉ cần biết `1` hay `0`. Đây là metric **đầu tiên nên đặt cảnh báo**: `up == 0` nghĩa là một service đã chết. Trong Explore gõ `up == 0` để xem ngay có gì đang chết không. Nếu mọi thứ khỏe, query này trả về rỗng (không có gì = 0).

> Đây là lý do ở bước kiểm tra (mục 13.4) ta gõ `up` đầu tiên — nó xác nhận toàn bộ chuỗi app → Prometheus có thông không, trước khi lo tới dashboard.

---

### 15.11. Bảng tra cứu tổng hợp — "thấy thế này thì lo thế kia"

In bảng này ra dán cạnh màn hình. Khi nhìn dashboard mà không chắc, tra ở đây:

| Thấy trên dashboard | Khả năng cao là | Mức độ |
|---|---|---|
| Memory/Heap leo dốc không giảm (hình B) | Memory leak → sắp OOM | 🔴 Khẩn |
| Goroutines leo mãi không giảm | Goroutine leak | 🔴 Khẩn |
| Process Restarts tự tăng đều | Crash loop | 🔴 Khẩn |
| `up == 0` | Service đã chết | 🔴 Khẩn |
| Open FDs tiến sát trần | Sắp hết khả năng nhận connection | 🟠 Cảnh báo |
| Event loop lag > 100ms thường xuyên | Code blocking, app chậm cho mọi user | 🟠 Cảnh báo |
| GC duration (q=1) > 100ms thường xuyên | Lag giật cho người chơi | 🟠 Cảnh báo |
| CPU cao liên tục sát trần | Nghẽn CPU, cần scale | 🟠 Cảnh báo |
| Gai nhọn ngắn rồi về bình thường | Burst công việc | 🟢 Bình thường |
| Memory/Heap răng cưa quanh mức nền (hình A) | GC làm việc đúng | 🟢 Bình thường |
| CPU/lag vọt lúc khởi động rồi về | Đang start app | 🟢 Bình thường |
| Goroutines/FDs lên xuống theo giờ chơi | Tải biến động bình thường | 🟢 Bình thường |

---

### 15.12. Một quy trình điều tra mẫu (khi nghi có sự cố)

Để thấy cách dùng thực tế, đây là các bước một dev nên làm khi nghi ngờ có vấn đề:

1. **Mở dashboard, nhìn `up` / Targets Up trước.** Có service nào `0` (chết) không? Nếu có → vào đó trước.
2. **Nhìn Process Restarts.** Có đang tăng không? Tăng → crash loop → đi xem log (`docker logs`).
3. **Nhìn Memory & Goroutines (hình dạng).** Có cái nào đang leo dốc một chiều (hình B) không? Có → leak → khoanh vùng instance qua legend.
4. **Nhìn CPU & Event loop lag / GC.** Có cao bất thường không? Đối chiếu: cao đúng giờ cao điểm (bình thường) hay cao cả lúc vắng (bất thường)?
5. **Đổi time range sang 7 ngày** (góc phải Grafana) để xem xu hướng dài — nhiều leak chỉ lộ ra khi nhìn cả tuần, 1 giờ không thấy.
6. **Khoanh vùng bằng legend.** Nếu chỉ 1 instance bất thường còn các instance khác bình thường → vấn đề cục bộ ở máy/instance đó, không phải lỗi code chung.

> Quy trình này biến việc "nhìn dashboard hoang mang" thành "kiểm tra có hệ thống". Làm vài lần sẽ thành phản xạ.

## 16. PromQL — ngôn ngữ truy vấn

PromQL (Prometheus Query Language) là cách hỏi dữ liệu. Vài mẫu thường dùng:

### 16.1. Query cơ bản

```promql
go_goroutines                          # tất cả series của metric này
go_goroutines{job="golang-game"}       # lọc theo nhãn job
process_open_fds{job="golang-game", instance="103.116.52.219:2112"}  # lọc nhiều nhãn
```

### 16.2. Toán tử khớp nhãn

| Toán tử | Ý nghĩa | Ví dụ |
|---|---|---|
| `=` | bằng chính xác | `{job="golang-game"}` |
| `!=` | khác | `{job!="prometheus"}` |
| `=~` | khớp regex | `{instance=~"103.*"}` |
| `!~` | không khớp regex | `{job!~"nestjs.*"}` |

### 16.3. `rate()` — chuyển counter thành tốc độ

Nhiều metric là **counter** — chỉ tăng dần (như tổng CPU-giây đã dùng). Vẽ thẳng counter thì vô nghĩa (đường tăng mãi). Dùng `rate()` để biến nó thành "tốc độ mỗi giây":

```promql
rate(process_cpu_seconds_total[5m]) * 100   # % CPU, trung bình trên cửa sổ 5 phút
```

`[5m]` là khoảng thời gian tính trung bình. `* 100` đổi sang phần trăm.

### 16.4. Aggregation — gộp nhiều series

```promql
sum(go_goroutines)                       # tổng goroutine tất cả instance
avg(go_goroutines) by (job)              # trung bình theo từng job
max(process_resident_memory_bytes) by (instance)  # max theo instance
count(up == 1)                           # đếm số target đang sống
```

### 16.5. Summary & quantile

Metric như `go_gc_duration_seconds` là **summary**, trả về nhiều đường theo `quantile`:

```promql
go_gc_duration_seconds{job="golang-game", quantile="1"}     # GC lâu nhất (worst case)
go_gc_duration_seconds{job="golang-game", quantile="0.5"}   # trung vị
```

---

## 17. So sánh với PM2 monitoring, Discord/Telegram alert & circuit breaker

Phần này so sánh setup Prometheus + Grafana với các cách tiếp cận khác mà dev Node.js hay dùng — và quan trọng hơn, làm rõ chúng **không loại trừ nhau** mà bổ sung cho nhau ở các tầng khác nhau.

### 17.1. PM2 monitoring

**PM2 là gì:** trình quản lý tiến trình (process manager) phổ biến cho Node.js. Ngoài việc giữ app sống (tự restart khi crash), PM2 còn có khả năng monitoring qua lệnh `pm2 monit` và dịch vụ web **PM2 Plus** (pm2.io).

**So sánh:**

| Tiêu chí | PM2 Monitoring | Prometheus + Grafana |
|---|---|---|
| Phạm vi | Chỉ Node.js (PM2 không quản lý Go) | Mọi ngôn ngữ, mọi service, cả OS |
| Cài đặt | Rất nhanh (`pm2 monit` có ngay) | Tốn công dựng ban đầu |
| Lưu lịch sử | Hạn chế (PM2 Plus trả phí mới lưu dài) | 30 ngày (hoặc tùy chỉnh), tự host |
| Custom metrics | Có (`pm2/io` API) nhưng ít linh hoạt | Rất linh hoạt (PromQL) |
| Tổng hợp đa máy | Khó (PM2 thiên về 1 máy) | Sinh ra để làm việc này |
| Alerting | PM2 Plus (trả phí) | Miễn phí (Grafana/Alertmanager) |
| Chi phí | PM2 Plus trả phí cho tính năng đầy đủ | Miễn phí, mã nguồn mở |

**Vì sao Prometheus + Grafana phù hợp hơn cho hệ thống này:** kiến trúc 3 VPS với cả NestJS *lẫn Go* — PM2 không quản được Go, và không tổng hợp đa máy tốt. PM2 monitoring hợp với dự án Node.js đơn lẻ trên một máy. Khi đã phân tán đa ngôn ngữ đa máy thì Prometheus là lựa chọn đúng.

> **Lưu ý:** vẫn có thể *dùng PM2 để quản lý tiến trình* (giữ app sống) song song với *dùng Prometheus để monitoring*. Hai việc khác nhau. PM2 lo "app có chạy không", Prometheus lo "app chạy thế nào". Thực tế nhiều team dùng PM2 chạy app Node + expose metrics qua `prom-client` cho Prometheus scrape — kết hợp cả hai.

### 17.2. Discord / Telegram alert

**Là gì:** thay vì (hoặc bổ sung cho) dashboard, gửi tin nhắn vào Discord/Telegram khi có sự cố. Đây **không phải đối thủ** của Grafana — nó là **kênh nhận cảnh báo** mà Grafana/Alertmanager đẩy tới.

**Quan hệ đúng:**

```
Prometheus (phát hiện điều kiện xấu, vd up==0)
      │
      ▼
Alertmanager / Grafana Alerting (quyết định cảnh báo, gộp, chống spam)
      │
      ▼
Discord webhook / Telegram bot (kênh giao tới người trực)
```

**Vì sao cần alert chủ động chứ không chỉ dashboard:** dashboard là **pull** — phải có người mở ra nhìn mới biết. Alert là **push** — tự tìm đến người trực kể cả lúc 3h sáng không ai mở dashboard. Một hệ prod nghiêm túc cần cả hai: dashboard để điều tra, alert để được đánh thức.

**Cách làm (tóm tắt, chi tiết ở TODO 21.2):**

Discord cực đơn giản — tạo Webhook URL trong cài đặt channel Discord, rồi trỏ Grafana contact point tới URL đó. Telegram thì tạo bot qua [@BotFather](https://t.me/botfather), lấy bot token + chat id, cấu hình vào Grafana. Khi alert kích hoạt (vd `up == 0` quá 1 phút), Grafana tự bắn tin nhắn kèm chi tiết service nào chết.

> **Mẹo chống "alert fatigue":** đừng cảnh báo mọi thứ. Quá nhiều alert → người ta tắt thông báo → bỏ lỡ cái quan trọng. Chỉ alert những gì *cần hành động ngay*: service chết, memory sắp OOM, disk sắp đầy. Đặt ngưỡng và thời gian chờ hợp lý (vd CPU cao *liên tục 5 phút* mới báo, không báo spike 10 giây).

### 17.3. Circuit breaker

**Là gì:** circuit breaker (cầu dao) là một **mẫu thiết kế phần mềm** (design pattern) — không phải công cụ monitoring. Nó nằm trong code app, bảo vệ app khỏi sụp đổ dây chuyền khi một dependency (DB, service khác, API ngoài) bị lỗi.

**Cách hoạt động — ví như cầu dao điện trong nhà:**

```
CLOSED (đóng — bình thường):  request đi qua bình thường
      │ (nếu lỗi liên tục vượt ngưỡng)
      ▼
OPEN (mở — ngắt mạch):        chặn ngay mọi request, trả lỗi tức thì
      │                        không gọi service đang hỏng nữa
      │ (sau một khoảng thời gian)
      ▼
HALF-OPEN (thử lại):          cho qua vài request thử
      │                        thành công → CLOSED, thất bại → OPEN lại
```

**Vì sao cần:** giả sử service game gọi sang DB, mà DB treo. Không có circuit breaker: mọi request game đều cố gọi DB, chờ timeout (vd 30s mỗi cái), connection pool cạn, **service game cũng treo theo** — sự cố lan từ DB sang game (cascading failure). Có circuit breaker: sau vài lần DB lỗi, breaker "mở", game **lập tức** trả lỗi/fallback thay vì chờ — game vẫn sống, chỉ tính năng cần DB tạm ngưng.

**Quan hệ với monitoring — đây là điểm mấu chốt:**

| | Vai trò | Tầng |
|---|---|---|
| **Circuit breaker** | **Phản ứng tự động** — bảo vệ app real-time khi dependency lỗi | Trong code app (chủ động phòng vệ) |
| **Prometheus + Grafana** | **Quan sát** — cho người thấy chuyện gì đang xảy ra | Bên ngoài (giám sát thụ động) |
| **Alert** | **Thông báo** — đánh thức người trực | Cầu nối |

Ba thứ này **bổ sung nhau hoàn hảo**:

1. Circuit breaker tự bảo vệ app (phản ứng trong mili-giây, không cần người).
2. Prometheus đo được **trạng thái breaker** (mở/đóng bao nhiêu lần) — expose breaker state thành metric.
3. Alert báo cho người biết "breaker đã mở" → người vào điều tra qua Grafana.

**Triển khai circuit breaker (gợi ý):**
- **NestJS/Node:** thư viện `opossum` — bọc các lời gọi tới DB/service ngoài. `opossum` có sẵn event để emit metrics.
- **Go:** thư viện `sony/gobreaker` hoặc `mercari/go-circuitbreaker`.

**Expose breaker metrics cho Prometheus** (ví dụ ý tưởng):
```javascript
// NestJS với opossum — đếm số lần breaker mở
const breakerOpenCounter = new Counter({
  name: 'circuit_breaker_open_total',
  help: 'Số lần circuit breaker chuyển sang OPEN',
  labelNames: ['service'],
});
breaker.on('open', () => breakerOpenCounter.inc({ service: 'database' }));
```
Rồi trong Grafana vẽ panel `circuit_breaker_open_total` + alert khi nó tăng → biết ngay dependency nào đang hỏng.

### 17.4. Bức tranh tổng thể — các lớp phòng vệ

Tóm lại, một hệ prod chững chạc có nhiều lớp, mỗi lớp một nhiệm vụ, **không thay thế nhau**:

```
┌─────────────────────────────────────────────────────────┐
│ LỚP 1 — Phòng vệ tự động (trong code, mili-giây)         │
│   Circuit breaker, retry, timeout, rate limit             │
│   → App tự bảo vệ, không cần người                        │
├─────────────────────────────────────────────────────────┤
│ LỚP 2 — Giữ app sống (process manager)                    │
│   PM2 / Docker restart policy                             │
│   → App chết thì tự dựng lại                              │
├─────────────────────────────────────────────────────────┤
│ LỚP 3 — Quan sát (Prometheus + Grafana)                   │
│   Thu thập + hiển thị metrics                             │
│   → Người thấy được chuyện gì đang xảy ra                 │
├─────────────────────────────────────────────────────────┤
│ LỚP 4 — Thông báo chủ động (Alert qua Discord/Telegram)   │
│   → Người được đánh thức khi cần, kể cả 3h sáng           │
└─────────────────────────────────────────────────────────┘
```

Setup trong tài liệu này hoàn thiện **Lớp 3**. Docker `restart: unless-stopped` đã lo một phần **Lớp 2**. Lớp 1 (circuit breaker) và Lớp 4 (alert) là bước nâng cấp tiếp theo — xem TODO.

---

## 18. Khó khăn gặp phải & cách giải quyết

Phần này ghi lại các vấn đề thực tế trong quá trình triển khai và cách xử lý — để lần sau gặp lại giải quyết nhanh.

### 18.1. `/metrics` nằm chung port nghiệp vụ → lộ ra internet

- **Vấn đề:** ban đầu `/metrics` của NestJS nằm chung port app (3000...). Port này bắt buộc mở cho nginx, nên `/metrics` cũng phơi ra public, firewall không khóa được.
- **Giải pháp:** tách metrics sang port phụ riêng (9091/9092/9093 cho NestJS, 2112 cho Go) qua một app/server phụ. Port phụ chỉ mở cho VPS 225 qua firewall. (Mục 8, 9.)

### 18.2. App bind `127.0.0.1` → Prometheus không kết nối được

- **Vấn đề:** nếu app metrics bind `127.0.0.1`, nó chỉ nghe trên localhost của VPS app, Prometheus ở 225 kéo không được → target `DOWN`.
- **Giải pháp:** bind `0.0.0.0` ở port phụ. (Mục 8.3, 8.5.)

### 18.3. Grafana data source URL dùng `localhost` → không kết nối

- **Vấn đề:** điền `http://localhost:9090` cho data source → lỗi, vì với container Grafana "localhost" là chính nó.
- **Giải pháp:** dùng tên service Docker `http://prometheus:9090`. (Mục 13.3.)

### 18.4. Dashboard 11159 trống — biến `instance` báo đỏ

- **Vấn đề:** import xong mọi panel "No data", dropdown instance có tam giác đỏ.
- **Nguyên nhân:** biến `instance` của dashboard 2019 query lỗi; thêm vào đó từng bị đặt Label = `$instance` (tự tham chiếu) → rỗng.
- **Giải pháp:** sửa biến: Type = Query, data source = Prometheus, Query type = Label values, Label = `instance` (không có `$`), Metric = một metric app thật phát ra. Preview phải ra ~9 instance. (Mục 14.1.)

### 18.5. Biến instance chỉ ra `localhost:9090` (1 giá trị)

- **Vấn đề:** khi chọn Metric là một metric chỉ Prometheus có, biến chỉ ra `localhost:9090`.
- **Giải pháp:** chọn Metric mà app cũng phát (như `process_resident_memory_bytes`), hoặc để trống Metric → ra đủ instance. (Mục 14.1.)

### 18.6. Dashboard Go 6671 là dashboard Kubernetes

- **Vấn đề:** dashboard này có biến `namespace`/`pod` (khái niệm K8s) báo đỏ, và query panel lọc theo `$namespace/$pod` rỗng → panel trống. Một số panel còn trộn lẫn metrics NestJS.
- **Giải pháp:** thay cụm `{namespace=~"...",pod=~"..."}` bằng `{job="golang-game"}` trong các panel cần dùng; ẩn hoặc kệ hai biến K8s. Chỉ sửa 4 panel cốt lõi, không tỉa hết. (Mục 14.2, 14.3.)

### 18.7. Quên Save dashboard → mất công sửa

- **Vấn đề:** sửa panel/biến xong rời trang mà không Save → mất hết.
- **Giải pháp:** luôn bấm **Save dashboard** (nút xanh) sau khi sửa. "Back to dashboard" chỉ lưu panel tạm trong phiên edit, chưa lưu vĩnh viễn.

---

## 19. Thành quả

Sau khi hoàn tất, hệ thống có một vòng observability metrics hoàn chỉnh, chạy thật với số liệu thật:

✅ **9 target** được Prometheus scrape, tất cả `up=1`:
- 6 NestJS instance (gateway/pay/game × 2 VPS) qua port 9091/9092/9093
- 2 Golang instance qua port 2112
- 1 Prometheus tự giám sát

✅ **Metrics an toàn:** mọi `/metrics` nằm sau firewall (port phụ chỉ mở cho VPS 225), port nghiệp vụ không lộ gì thêm.

✅ **Lưu trữ 30 ngày** trong named volume — không mất khi tạo lại container.

✅ **Grafana truy cập qua HTTPS:** `https://grafana.ngocrongdark.com`, login riêng, không sign-up công khai.

✅ **2 dashboard hoạt động:**
- NodeJS (11159): CPU, memory, event loop lag, restarts cho 3 service NestJS.
- Go (6671, đã tỉa): goroutines, heap, GC, open FDs cho service Go.

### Vài quan sát từ số liệu thật

- Event loop lag NestJS ~3-4ms → rất khỏe (dưới 10ms là tốt).
- Memory gateway ~193 MiB ổn định, không leak.
- Service Go chỉ ~14.6 MiB → nhẹ hơn Node nhiều, đúng kỳ vọng khi tách ra làm service high-performance.

---

## 20. Vận hành & bảo trì

### 20.1. Lệnh thường dùng

```bash
# Xem trạng thái container monitoring
docker compose ps prometheus grafana

# Xem log
docker compose logs -f prometheus
docker compose logs -f grafana

# Reload cấu hình Prometheus sau khi sửa prometheus.yml (không cần restart)
curl -X POST http://localhost:9090/-/reload    # cần bật --web.enable-lifecycle
# hoặc đơn giản:
docker compose restart prometheus

# Kiểm tra target qua SSH tunnel (Prometheus bind localhost)
ssh -L 9090:127.0.0.1:9090 user@103.116.52.225
# rồi mở http://localhost:9090/targets
```

### 20.2. Kiểm tra sức khỏe định kỳ

- Vào `https://grafana.ngocrongdark.com` xem dashboard.
- Trong Explore gõ `up` — mọi target phải `= 1`.
- Để mắt: Process Restarts (tăng đột biến = crash loop), goroutines (tăng mãi = leak), memory (phình = leak), open FDs (sát trần = sắp hết connection).

### 20.3. Khi thêm service mới

1. Cho service expose `/metrics` ở port phụ (theo mẫu mục 8).
2. Mở firewall cho VPS 225 vào port đó.
3. Thêm `job` mới vào `prometheus.yml`.
4. `docker compose restart prometheus`.
5. Kiểm tra `up` trong Explore.

---

## 21. TODO — các bước tiếp theo (chi tiết)

Xếp theo mức độ quan trọng cho một game production:

### 21.1. node_exporter — giám sát CPU/RAM/disk của máy (ưu tiên cao)

App metrics cho biết *app làm gì*; node_exporter cho biết *máy còn sống không*. Phần lớn sự cố sập lúc nửa đêm đến từ máy (đầy disk, hết RAM), không phải app. Đây là lớp đang thiếu.

- **Trên VPS 225** (có Docker): thêm vào compose:
  ```yaml
  node-exporter:
    image: prom/node-exporter:latest
    container_name: node-exporter
    restart: unless-stopped
    pid: host
    volumes:
      - '/:/host:ro,rslave'
    command:
      - '--path.rootfs=/host'
    ports:
      - '9100:9100'
  ```
- **Trên VPS 219 & 222:** cài binary + systemd:
  ```bash
  wget https://github.com/prometheus/node_exporter/releases/download/v1.8.2/node_exporter-1.8.2.linux-amd64.tar.gz
  tar xvf node_exporter-1.8.2.linux-amd64.tar.gz
  sudo cp node_exporter-1.8.2.linux-amd64/node_exporter /usr/local/bin/
  sudo tee /etc/systemd/system/node_exporter.service > /dev/null <<'EOF'
  [Unit]
  Description=Node Exporter
  After=network.target
  [Service]
  ExecStart=/usr/local/bin/node_exporter
  Restart=always
  [Install]
  WantedBy=multi-user.target
  EOF
  sudo systemctl daemon-reload
  sudo systemctl enable --now node_exporter
  ```
  (Nếu 219/222 có Docker, có thể dùng `docker run` tương tự 225 thay cho systemd.)
- Mở firewall cho 225 vào port 9100 trên 219/222.
- Thêm job `node` vào `prometheus.yml`:
  ```yaml
  - job_name: 'node'
    static_configs:
      - targets:
          - '103.116.52.225:9100'
          - '103.116.52.222:9100'
          - '103.116.52.219:9100'
  ```
- Import dashboard Grafana **ID 1860** (Node Exporter Full) — vẽ sẵn toàn bộ CPU/RAM/disk/network.

### 21.2. Alerting với Discord/Telegram (ưu tiên cao)

Dashboard là **pull** (phải mở ra nhìn); alert là **push** (tự tìm đến người trực). Hệ prod cần cả hai. Dưới đây là cách dựng alert bằng **Grafana Alerting** (đơn giản hơn Alertmanager, đủ dùng cho quy mô này) đẩy tới Discord và Telegram.

**Bước 1 — Tạo kênh nhận (Contact point):**

*Discord (đơn giản nhất):*
1. Trong Discord: chọn channel → ⚙️ Edit Channel → **Integrations → Webhooks → New Webhook** → copy **Webhook URL**.
2. Grafana: **Alerting → Contact points → Add contact point** → Integration chọn **Discord** → dán Webhook URL → Save & test.

*Telegram:*
1. Chat với [@BotFather](https://t.me/botfather) → `/newbot` → đặt tên → nhận **bot token**.
2. Thêm bot vào group (hoặc chat riêng), gửi một tin nhắn, rồi mở `https://api.telegram.org/bot<TOKEN>/getUpdates` để lấy **chat id**.
3. Grafana: **Contact points → Add** → Integration **Telegram** → điền bot token + chat id → Save & test.

**Bước 2 — Tạo Alert rule:**

**Alerting → Alert rules → New alert rule.** Ví dụ cảnh báo service chết:
- Query: `up == 0`
- Condition: `IS ABOVE 0` (có bất kỳ target nào = 0)
- Evaluation: kiểm tra mỗi `1m`, **for** `1m` (phải lỗi liên tục 1 phút mới báo — tránh báo nhầm khi restart nhanh)
- Contact point: chọn Discord/Telegram vừa tạo.

**Bộ alert rule nên có (theo mức quan trọng):**

| Alert | Query | Điều kiện | Vì sao |
|---|---|---|---|
| Service chết | `up == 0` | > 0, for 1m | Quan trọng nhất |
| Memory sắp OOM | `process_resident_memory_bytes` | > ngưỡng (vd 80% RAM), for 5m | Bắt leak trước khi OOM |
| Goroutine leak | `go_goroutines{job="golang-game"}` | > ngưỡng bất thường, for 10m | Bắt leak Go |
| Crash loop | `rate(...restart...[5m])` | tăng đột biến | App chết lặp |
| Disk sắp đầy *(cần node_exporter)* | `node_filesystem_avail_bytes` | < 10% | Hay gây sập nhất |
| CPU cao kéo dài | `rate(process_cpu_seconds_total[5m])*100` | > 90%, for 5m | Nghẽn |

> **Chống alert fatigue:** chỉ alert những gì *cần hành động ngay*. Dùng `for` (thời gian chờ) để bỏ qua spike ngắn. Quá nhiều alert → người tắt thông báo → bỏ lỡ cái thật. Một alert tốt phải trả lời được "tôi cần làm gì ngay bây giờ?".

### 21.3. Custom business metrics (giá trị nghiệp vụ thật sự)

Runtime metrics chỉ cho biết *tiến trình khỏe không*. Metrics nghiệp vụ mới cho biết *game đang chạy thế nào* — đây là bước tạo khác biệt thật sự, hơn hẳn việc tỉa thêm dashboard runtime.

**Nên đo gì cho game:** số WebSocket connection đang mở, số player online, số message/giây, latency xử lý mỗi packet, số trận đang diễn ra, số giao dịch pay/phút.

**NestJS — tạo custom metric:**
```typescript
import { makeCounterProvider, makeGaugeProvider } from '@willsoto/nestjs-prometheus';

// Trong module
providers: [
  makeGaugeProvider({
    name: 'ws_active_connections',
    help: 'Số WebSocket connection đang mở',
  }),
  makeCounterProvider({
    name: 'game_messages_total',
    help: 'Tổng số message game đã xử lý',
    labelNames: ['type'],
  }),
]

// Trong service — inject và dùng
constructor(
  @InjectMetric('ws_active_connections') private wsGauge: Gauge,
  @InjectMetric('game_messages_total') private msgCounter: Counter,
) {}

onConnect()    { this.wsGauge.inc(); }
onDisconnect() { this.wsGauge.dec(); }
onMessage(t)   { this.msgCounter.inc({ type: t }); }
```

**Go — tạo custom metric:**
```go
import "github.com/prometheus/client_golang/prometheus"

var (
    activeConns = prometheus.NewGauge(prometheus.GaugeOpts{
        Name: "ws_active_connections",
        Help: "Số WebSocket connection đang mở",
    })
    msgTotal = prometheus.NewCounterVec(prometheus.CounterOpts{
        Name: "game_messages_total",
        Help: "Tổng số message game đã xử lý",
    }, []string{"type"})
)

func init() {
    prometheus.MustRegister(activeConns, msgTotal)
}

// Khi có connection: activeConns.Inc() / activeConns.Dec()
// Khi xử lý message: msgTotal.WithLabelValues(msgType).Inc()
```

**Counter vs Gauge — phân biệt:**
- **Counter** — chỉ tăng (hoặc reset về 0 khi restart). Dùng cho "tổng số đã xảy ra": số message, số request, số lỗi. Đọc bằng `rate()` để ra tốc độ.
- **Gauge** — lên xuống tự do. Dùng cho "giá trị hiện tại": số connection đang mở, nhiệt độ, RAM. Đọc thẳng.

### 21.4. Circuit breaker — phòng vệ chống sụp đổ dây chuyền

(Xem giải thích đầy đủ ở chương 17.3.) Triển khai cầu dao bảo vệ các lời gọi tới DB/service ngoài, và expose trạng thái breaker thành metric để Prometheus theo dõi.

- **NestJS:** dùng `opossum`, bọc các call tới dependency, emit metric khi breaker `open`.
- **Go:** dùng `sony/gobreaker`, expose breaker state qua gauge.
- Thêm panel + alert cho `circuit_breaker_open_total` → biết ngay dependency nào hỏng.

### 21.5. Chuyển scrape sang mạng nội bộ (bảo mật + tốc độ)

Hiện scrape qua public IP (đã khóa firewall nhưng traffic không mã hóa). Khi có điều kiện, dựng **Tailscale/WireGuard** hoặc dùng **private network** của provider giữa 3 VPS → scrape qua IP nội bộ, mã hóa, nhanh hơn. Tailscale set up nhanh nhất: cài 3 máy, mỗi máy có IP `100.x`, đổi target trong `prometheus.yml` sang IP đó, và `/metrics` chỉ cần bind interface nội bộ.

### 21.6. Loki (log aggregation) & Jaeger (tracing)

Hoàn thiện ba trụ cột observability:
- **Loki + Promtail:** gom log tập trung từ mọi service, xem trong cùng Grafana cạnh metrics. Hết cảnh `docker logs` thủ công từng container.
- **Jaeger:** đã có container, cần wiring OpenTelemetry SDK vào app (exporter trỏ về `4317` OTLP gRPC hoặc `4318` OTLP HTTP). OTel tự sinh và propagate `trace_id` qua header `traceparent`, không cần tự tạo collection id thủ công. Tracing cho thấy một request đi xuyên gateway → game → DB mất bao lâu ở từng khâu — vô giá khi debug "vì sao request này chậm".

---

## 22. Mẹo & kiến thức hữu ích cho dev

Những điều không nằm trong "các bước làm" nhưng giúp dùng monitoring hiệu quả và tránh sai lầm phổ biến.

### 22.1. Bốn loại metric của Prometheus

Hiểu đúng loại metric thì mới query đúng:

| Loại | Đặc điểm | Ví dụ | Cách query |
|---|---|---|---|
| **Counter** | Chỉ tăng, reset khi restart | tổng request, tổng lỗi | luôn bọc `rate()` |
| **Gauge** | Lên xuống tự do | RAM, số connection, nhiệt độ | đọc thẳng |
| **Histogram** | Phân phối giá trị vào các "khoảng" (bucket) | latency request | `histogram_quantile()` |
| **Summary** | Như histogram nhưng tính quantile sẵn ở client | GC duration | lọc theo `quantile` |

Sai lầm kinh điển: vẽ thẳng một counter (đường tăng vô hạn, vô nghĩa) thay vì `rate(counter[5m])`.

### 22.2. Quy ước đặt tên metric

Prometheus có quy ước đặt tên giúp dashboard/alert nhất quán:
- Dùng `snake_case`: `http_requests_total`, không `httpRequests`.
- Counter kết thúc bằng `_total`: `game_messages_total`.
- Kèm đơn vị trong tên: `_bytes`, `_seconds`, `_total`. Ví dụ `request_duration_seconds` (luôn dùng giây, không phải ms — quy ước Prometheus).
- Đừng nhét giá trị biến vào tên metric; dùng **label** thay vì thế. Sai: `messages_chat_total`, `messages_battle_total`. Đúng: `messages_total{type="chat"}`, `messages_total{type="battle"}`.

### 22.3. Cẩn thận "cardinality bùng nổ"

**Cardinality** = số tổ hợp label khác nhau của một metric. Mỗi tổ hợp label là một chuỗi thời gian riêng mà Prometheus phải lưu. Nếu dùng label có giá trị *vô hạn* (như `user_id`, `request_id`, IP người chơi), số chuỗi bùng nổ → Prometheus ngốn RAM, chậm, có thể sập.

> **Quy tắc:** label chỉ dùng cho giá trị **hữu hạn, ít biến thể** (`type`, `status`, `method`, `service`). KHÔNG bao giờ dùng label cho ID, email, IP, timestamp. Cần truy theo ID thì đó là việc của **logs/traces**, không phải metrics.

### 22.4. Đặt khoảng thời gian (time range) đúng khi điều tra

Góc phải Grafana có chọn time range. Mẹo:
- Sự cố vừa xảy ra → xem **Last 1 hour** để thấy chi tiết.
- Tìm leak/xu hướng → xem **Last 7 days** để thấy đường bò lên chậm mà 1 giờ không thấy.
- So sánh "hôm nay vs hôm qua" → một số panel hỗ trợ so sánh khoảng.
- Bật **auto-refresh** (góc phải, vd 30s) khi đang theo dõi sự cố real-time.

### 22.5. Dùng Explore để debug nhanh, Dashboard để theo dõi lâu dài

- **Explore** = bàn thí nghiệm. Thử query, kiểm tra metric có tồn tại, điều tra sự cố tức thời. Không lưu.
- **Dashboard** = bảng theo dõi cố định. Những gì nhìn hằng ngày.
- Workflow tốt: điều tra trong Explore → tìm ra query hữu ích → "Add to dashboard" để giữ lại.

### 22.6. Metric không có dữ liệu? Cách debug theo thứ tự

Khi một panel "No data", kiểm tra từ gốc tới ngọn:
1. **Explore gõ `up`** — target sống không? `0` → app/firewall lỗi, không phải Grafana.
2. **Gõ thẳng tên metric** (vd `go_goroutines`) — metric có tồn tại không? Không ra → app chưa expose metric đó.
3. **Gõ `{job="..."}`** — xem *tất cả* metric một service phát ra, kiểm tra tên chính xác.
4. **Kiểm tra biến dashboard** — dropdown instance/job đã chọn giá trị chưa? (lỗi hay gặp nhất với dashboard import.)

### 22.7. Backup Grafana & Prometheus

- **Grafana:** dashboard nằm trong volume `grafana_data`. Nên **export dashboard ra JSON** (Dashboard → Share → Export) và lưu vào git — để tái tạo được nếu mất volume. Dashboard-as-code.
- **Prometheus:** dữ liệu trong `prometheus_data`. Với metrics thì thường chấp nhận mất (chỉ là lịch sử), nhưng nếu cần giữ lâu/độ tin cao thì xem **Thanos** hoặc **VictoriaMetrics** (lưu trữ dài hạn, scale ngang).

### 22.8. RED & USE — hai khung tư duy chọn metric

Khi không biết nên đo gì, dùng một trong hai khung chuẩn ngành:

**RED** (cho service xử lý request):
- **R**ate — số request/giây
- **E**rrors — số lỗi/giây
- **D**uration — thời gian xử lý (latency)

**USE** (cho tài nguyên: CPU, RAM, disk, network):
- **U**tilization — mức sử dụng (%)
- **S**aturation — mức bão hòa (hàng đợi chờ)
- **E**rrors — số lỗi

Áp RED cho NestJS gateway/pay (đo request), áp USE cho tài nguyên máy (node_exporter). Đây là cách các SRE chuyên nghiệp quyết định đo gì.

---

## 23. Phụ lục — tham chiếu nhanh

### 23.1. Bảng port toàn hệ thống

| Service | VPS | Port nghiệp vụ | Port metrics |
|---|---|---|---|
| NestJS gateway | 219, 222 | 3000 | 9091 |
| NestJS pay | 219, 222 | 3005 | 9092 |
| NestJS game | 219, 222 | 3009 | 9093 |
| Golang game | 219, 222 | 3010 | 2112 |
| Prometheus | 225 | — | 9090 (localhost) |
| Grafana | 225 | — | 3001→3000 (localhost) |
| node_exporter (TODO) | tất cả | — | 9100 |

### 23.2. Dashboard ID đã dùng

| ID | Tên | Dùng cho |
|---|---|---|
| 11159 | NodeJS Application Dashboard | 3 service NestJS |
| 6671 | Go Processes | service Golang |
| 1860 | Node Exporter Full | (TODO) CPU/RAM/disk 3 VPS |

### 23.3. Query kiểm tra nhanh trong Explore

```promql
up                                              # mọi target sống/chết
up == 0                                         # chỉ target đang chết
count(up == 1)                                  # đếm target sống
rate(process_cpu_seconds_total[5m]) * 100       # % CPU
process_resident_memory_bytes                   # RAM thực (RSS)
go_goroutines{job="golang-game"}                # goroutine Go
nodejs_eventloop_lag_seconds{job="nestjs-gateway"}  # event loop lag
```

### 23.4. Checklist triển khai từ đầu

```
[ ] 1. NestJS: cài package, tạo MetricsModule, sửa main.ts (port phụ 9091/92/93)
[ ] 2. Go: thêm metrics server phụ (port 2112)
[ ] 3. Deploy app lên 219 & 222, curl test 4 port
[ ] 4. Firewall: mở 4 port metrics cho VPS 225 (trên 219 & 222)
[ ] 5. Tạo prometheus.yml (4 job)
[ ] 6. Thêm service prometheus + grafana vào docker-compose
[ ] 7. Khai báo named volumes (prometheus_data, grafana_data)
[ ] 8. Thêm GRAFANA_USER/PASS vào .env
[ ] 9. docker compose up -d prometheus grafana
[ ] 10. Cloudflare: tạo A record grafana.ngocrongdark.com → 225
[ ] 11. Xin SSL cert cho subdomain (nếu chưa wildcard)
[ ] 12. Thêm nginx server block cho Grafana, reload nginx
[ ] 13. Login Grafana → add data source Prometheus (http://prometheus:9090)
[ ] 14. Explore: gõ `up` xác nhận 9 target = 1
[ ] 15. Import dashboard 11159 (NodeJS) → sửa biến instance
[ ] 16. Import dashboard 6671 (Go) → sửa query 4 panel cốt lõi
[ ] 17. Save tất cả dashboard
[ ] 18. (Quan trọng) Đọc chương 15 để biết cách nhìn biểu đồ — có dashboard mà không biết đọc thì vô dụng

TODO nâng cấp prod (chương 21):
[ ] node_exporter trên 3 VPS + dashboard 1860 (giám sát CPU/RAM/disk)
[ ] Alerting Discord/Telegram (up==0, OOM, disk đầy, crash loop)
[ ] Custom business metrics (connection, player online, message/s)
[ ] Circuit breaker (opossum cho Node, gobreaker cho Go) + metric breaker
[ ] Private network / Tailscale giữa 3 VPS (mã hóa scrape)
[ ] Loki (logs) + wiring Jaeger (traces) — hoàn thiện 3 trụ cột
```

---

*Hết tài liệu. Mọi cấu hình ở trên đã được triển khai và kiểm chứng chạy thật trên hệ thống 3 VPS.*