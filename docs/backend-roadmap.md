# Lộ Trình Senior Backend Engineer — Theo Độ Ưu Tiên

> **Cho:** Phạm Hải Đăng — năm 2 PTIT, ~1 năm production, vận hành MMORPG 14 services.
> **Cấu trúc:** Tier theo độ ưu tiên, KHÔNG timeline. Mỗi item: **Là gì** + **Tại sao bạn cần** + **Cách học/làm** + **Signal thu được**.
> **Verified với JD thực tế:** VNG Games (Senior BE JD), Sky Mavis (Senior BE Ronin Platform), Homebase VN, ANDPAD, NAB Innovation Centre, Krystal DeFi Hanoi, GitLab Senior Backend Career Framework công khai, Google SRE Book, MIT 6.5840, CMU 15-445, Vietnam IT Salary Report 2025-2026.

---

## MỤC LỤC

- **Tier 0 — Foundation Skills** (way of working, làm song song mọi tier)
- **Tier 1 — CRITICAL** (gap rõ nhất so với JD, ưu tiên 6 tháng đầu)
- **Tier 2 — HIGH** (lý thuyết nền + interview prep, ưu tiên 6-12 tháng)
- **Tier 3 — MEDIUM** (kiến thức cần biết, áp khi gặp vấn đề cụ thể)
- **Tier 4 — SPECIALIZATION** (chọn 1-2 hướng để khác biệt)
- **Tier 5 — Soft Skills & Career** (gap chỉ giải bằng môi trường + thực hành)
- **Bonus: Những gì Claude recommend thêm** (ít người nói nhưng giá trị cao)
- **Appendix: CV samples, resources, mistakes, việc tuần này**

---

# TIER 0 — FOUNDATION SKILLS

> Đây là "way of working" — KHÔNG phải kiến thức cần học rồi xong, mà là cách bạn vận hành mỗi ngày, song song mọi tier khác. **Đây là gap lớn nhất của solo dev** và là điều kiện CẦN để senior thật sự, dù technical đủ mạnh đến đâu.

## 0.1. Technical Writing (ADR + Design Doc + Postmortem)

**Là gì:** Bốn loại document kỹ thuật core mà senior phải thành thạo viết và đọc:
- **ADR** (Architecture Decision Record): ngắn 1-2 trang, ghi quyết định + alternatives + trade-off
- **Design Doc**: chi tiết trước khi code feature/service phức tạp (Google-style template)
- **Postmortem**: sau incident, blameless, timeline + root cause + action items
- **Tech Spec**: spec triển khai cho dev khác implement

**Tại sao bạn cần:**
- GitLab Senior BE Framework công khai yêu cầu "communicates clearly and effectively, both written and verbally" như tiêu chí #1
- 1 trong những skill underrated quan trọng nhất phân biệt 10x engineer (research lặp lại)
- Solo dev = không bao giờ phải viết doc cho người khác → gap nặng so với người làm team
- Phỏng vấn senior chắc chắn hỏi: "kể về incident X" → có postmortem viết ra >> kể chay
- Trong VNG/MoMo/VNPay, viết design doc trước implement là quy trình BẮT BUỘC

**Cách học/làm:**
1. Tạo thư mục `adr/` trong repo MMORPG ngay tuần này
2. Viết lại 5-7 quyết định cũ thành ADR (Outbox, Socket.IO→Go migration, NestJS+Go polyglot, Saga orchestration, PayOS idempotent, RAG cache strategy...) — tập viết không rủi ro vì quyết định đã làm rồi
3. Mỗi feature mới từ giờ: viết Design Doc TRƯỚC khi code
4. Viết lại 3 incident lớn trong 25 incidents đã detect thành postmortem chuẩn
5. Đọc template: structurizr.com (C4 model), Google SRE postmortem template

**Signal thu được:**
- Link `adr/` folder trong CV — bằng chứng "engineering maturity"
- Bullet CV: "Authored 14 Architecture Decision Records capturing alternatives considered and trade-offs accepted"
- Tài liệu phỏng vấn behavioral cực mạnh

## 0.2. Code Review Skills (cho + nhận)

**Là gì:** Kỹ năng đọc code người khác và đưa feedback có cấu trúc; nhận feedback không phản ứng emotional.

**Tại sao bạn cần:**
- GitLab Senior framework: "**Performs Code Reviews across multiple stages on a regular cadence**" và "**Provides reviews across many domains and be mindful of how changes may impact other teams**" — code review là JOB chính thức của senior
- Solo dev = chưa từng bị code review nghiêm túc → CV bị nhà tuyển dụng discount 30-50%
- VNG interview verified: "Coding interview 1-2h" → code style + reasoning đều bị chấm

**Cách học/làm:**
1. Chọn 3 OSS repo bạn dùng (NestJS, BullMQ, NATS Go client) → đọc 20 PR đã merge gần nhất → quan sát maintainer review thế nào
2. Submit PR nhỏ vào OSS (docs typo → bug fix → feature nhỏ) → trải nghiệm bị review từ phía nhận
3. Tự review chính mình sau 1 tuần: mở lại PR cũ với mindset người ngoài
4. Học checklist 8 mục theo ưu tiên: Correctness → Design → Security → Test → Performance → Observability → Readability → Style
5. Tone: phân biệt **nit:** / **question:** / **blocking:** trong comment

**Signal thu được:**
- GitHub contribution graph có PR vào OSS
- Bullet CV: "Contributor to [OSS project] with X+ merged PRs"
- Trong phỏng vấn nói được: "Tôi đã review N PR/tuần trong M tháng qua"

## 0.3. Reading-to-Build Ratio 50/50

**Là gì:** Tỷ lệ thời gian giữa "đọc/học có cấu trúc" và "build code". Bạn hiện tại ~95/5 (95% build, 5% đọc).

**Tại sao bạn cần:**
- Plateau hiện tại của bạn ĐÚNG là vì 95/5 — build tạo skill tay, đọc tạo mental model. Senior được trả tiền cho **mental model**, không phải code chạy
- Mỗi feature mới hiện tại = thêm 1% kiến thức vì cùng pattern lặp; trong khi 1h đọc DDIA = thêm 1 concept fundamental không bao giờ quên

**Cách học/làm:**
1. Block 60-90 phút/ngày BUỔI SÁNG cho đọc lý thuyết — trước mọi thứ khác (não tươi nhất)
2. 1 sách kỹ thuật chuyên sâu/quý (DDIA quarter 1, SRE Book quarter 2...)
3. 1 paper/tháng từ "Papers We Love" — Raft, Dynamo, MapReduce, Spanner
4. 1 engineering blog post/ngày qua RSS (Feedly/Inoreader) — 15 phút sáng

**Signal thu được:**
- Note repo công khai với 100+ atomic notes
- Trong phỏng vấn nhắc paper/sách cụ thể với insight cá nhân → khác hẳn người chỉ "tôi dùng X"

## 0.4. Public Output (Blog + OSS + Mock Interview)

**Là gì:** Convert kinh nghiệm cá nhân thành signal công khai mà thị trường tin được.

**Tại sao bạn cần:**
- Solo project bị discount 30-50% bởi recruiter vì "không verify được" → cần signal bên ngoài bù
- Blog/OSS tạo compound effect — 1 bài viết tốt có thể bring inbound recruiter messages 2 năm sau
- Mock interview cho FEEDBACK khách quan từ thị trường (không phải bạn tự đánh giá)
- "Output > Input" — viết ra ép retain kiến thức gấp 5 lần đọc thuần

**Cách học/làm:**
1. **Blog:** đăng dev.to hoặc personal site (domain riêng ~$10/năm + Astro/Hugo static). Mục tiêu: 1 bài/2 tuần × 6 tháng = 12 bài. Topic từ chính kinh nghiệm bạn:
   - "Tracing across RabbitMQ in a polyglot NestJS+Go microservices system"
   - "Cutting database writes by 95% with Redis dirty flag + RabbitMQ batching"
   - "Idempotent webhook handling for VietQR/PayOS: production lessons"
   - "Building a RAG chatbot with 40% cache hit rate and 50% LLM cost reduction"
   - "From Socket.IO to raw WebSocket+Protobuf: a 60% payload reduction"
   - "Saga + Outbox in NestJS: zero partial-failure across 100K transactions"
2. **OSS module:** release 1 thứ từ kinh nghiệm thật. Ý tưởng: `nestjs-outbox`, `nestjs-saga-orchestrator`, `go-game-ws` (Go WebSocket framework cho game), `pgvector-semantic-cache`
3. **Mock interview:** Pramp (free peer-to-peer), interviewing.io (paid với real engineer). Mục tiêu: 1 mock/tuần × 3 tháng = 12 mock trước khi apply công ty quan trọng

**Signal thu được:**
- Personal site có 10+ posts → inbound recruiter
- GitHub profile có 1 pinned OSS repo với star + contributors
- "Featured on [HackerNews/dev.to homepage]" — bullet siêu mạnh nếu đạt

---

# TIER 1 — CRITICAL (LẤP GAP NẶNG NHẤT 6 THÁNG ĐẦU)

> Verified từ JD VNG Games, Sky Mavis, Homebase, ANDPAD, NAB, fintech VN — TẤT CẢ JD senior backend 2026 đều yêu cầu. Đây là gap khiến CV bạn không pass screening cho job tier S/A hiện tại.

## 1.1. Kubernetes Production (gap critical #1)

**Là gì:** Container orchestration platform — đóng gói, deploy, scale, self-heal microservices trên cluster.

**Tại sao bạn cần:**
- VNG Games Senior BE JD verified: cloud experience là requirement; K8s là implementation chuẩn
- Sky Mavis, Homebase, ANDPAD, NAB — TẤT CẢ JD senior VN tier S/A yêu cầu K8s
- Hiện tại bạn dùng PM2 + 3 VPS — phù hợp solo, nhưng 95% production-grade team dùng K8s; không có K8s = không pass screening
- Học K8s mở ra cloud (EKS/GKE), GitOps (ArgoCD), service mesh, game server orchestration (Agones — bạn theo gaming sẽ cần)

**Cách học/làm:**
1. **Concepts (1-2 tuần):** Pod → Deployment → Service → Ingress → ConfigMap/Secret → Namespace. Học qua kubernetes.io tutorial + minikube/kind local
2. **Vận hành (3-4 tuần):** liveness/readiness/startup probe, resource requests vs limits, HPA, PDB, affinity, StatefulSet vs Deployment, RBAC, NetworkPolicy
3. **Ecosystem (2-3 tuần):** Helm chart, Kustomize, ingress-nginx + cert-manager, ArgoCD (GitOps)
4. **Production lab:** dựng **k3s** (K8s nhẹ production-ready) trên 3 VPS hiện tại → migrate staging MMORPG → chạy song song với prod PM2 → khi tự tin migrate prod
5. **Nâng cao (sau khi vững):** "Kubernetes The Hard Way" của Kelsey Hightower — dựng cluster bằng tay không installer, làm 1 lần trong đời

**Signal thu được:**
- Helm charts cho 14 services trên GitHub
- Bullet CV: "Migrated 14-service MMORPG backend from PM2/VPS to self-managed Kubernetes (k3s), implementing Helm charts, HPA, and rolling updates with zero-downtime deploys"

## 1.2. Cloud (AWS hoặc GCP) + Cert SAA

**Là gì:** Managed cloud platform — thay thế self-host VPS. Bạn chọn 1, không 2.

**Tại sao bạn cần:**
- Homebase VN: "Cloud services (AWS, Azure, GCP) and containerization technologies highly desirable"
- ANDPAD: "AWS" required
- NAB: "Microsoft Azure cloud-based technologies"
- Tất cả tier S/A VN dùng managed cloud — không phải VPS tự host
- **AWS chiếm market share lớn nhất VN + global** → học AWS có ROI cao nhất (60-70% job có thể apply); GCP nếu nhắm Google/startup AI; Azure nếu nhắm banking/enterprise
- Cert SAA-C03 = forcing function học có hệ thống + signal CV (recruiter VN check cert)

**Cách học/làm:**
1. **Tier 1 bắt buộc:** IAM (học đầu tiên), VPC (subnet, route table, IGW/NAT, SG vs NACL), EC2, S3, RDS, ElastiCache, ALB/NLB, Route 53, CloudWatch, SQS, SNS, EKS
2. **Tier 2 chọn theo nhu cầu:** Lambda + API Gateway, ECS/Fargate, DynamoDB, Secrets Manager, KMS, CloudFront
3. **Course:** Adrian Cantrill (sâu, kĩ — recommend) hoặc Stephane Maarek (nhanh) trên Udemy
4. **Practice:** Tutorials Dojo (https://portal.tutorialsdojo.com) — practice exam quality cao nhất
5. **Chi phí:** Free tier 12 tháng + đặt billing alarm $5 ngay ngày đầu
6. **Project:** dựng lại 1 phần MMORPG trên AWS (EC2 + RDS + ElastiCache + ALB) bằng Terraform, chạy 1 tuần, đo chi phí, **viết blog so sánh VPS vs AWS** — bài blog quý hiếm vì ít người có data cả 2

**Signal thu được:**
- Cert SAA-C03 in CV (giá ~$150, hiệu lực 3 năm)
- Bullet CV: "AWS Solutions Architect Associate certified; built and ran multi-AZ deployment on AWS with EC2/RDS/ElastiCache"

## 1.3. Kafka + Event Streaming

**Là gì:** Distributed log-based message platform. Khác RabbitMQ (queue) ở chỗ: message KHÔNG biến mất sau consume, replay được, multiple consumer group độc lập đọc cùng stream.

**Tại sao bạn cần:**
- **VNG Games Senior BE JD verified:** "Proficiency in developing with message brokers such as Kafka and event-driven architectures" — EXPLICIT yêu cầu Kafka
- Homebase, ANDPAD, NAB cũng yêu cầu Kafka hoặc tương đương
- Bạn có Rabbit + NATS + BullMQ rồi → câu chuyện CV đẹp: "thêm Kafka làm event backbone cho analytics/audit/CDC" — không phải "thay thế tất cả"
- Kafka mở ra: CDC (Debezium), Stream processing (Kafka Streams/Flink), data engineering pipeline

**Cách học/làm:**
1. **Core concepts:** Topic → Partition → Offset; Consumer group; Replication (ISR, acks=all + min.insync.replicas=2); Retention + log compaction; KRaft mode (không Zookeeper từ 3.x)
2. **Schema Registry + Avro/Protobuf:** schema evolution backward/forward compatible — bạn đã dùng Protobuf rồi, kiến thức nối liền
3. **Deploy:** **Redpanda** (Kafka-compatible, 1 binary, nhẹ — hợp VPS bạn) hoặc Kafka KRaft 1 node
4. **Áp dụng MMORPG:** Debezium đọc MySQL binlog → topic `game.transactions` → 2 consumer:
   - Analytics consumer → ClickHouse → Grafana dashboard doanh thu realtime
   - Fraud-detection consumer → rule đơn giản (nạp X lần trong Y phút) → Discord alert
5. **Demo replay:** cố tình cho consumer xử lý sai → fix code → reset offset → replay 7 ngày → số liệu đúng lại. **Demo "tại sao Kafka" thuyết phục nhất trong phỏng vấn**

**Signal thu được:**
- Bullet CV: "Implemented CDC pipeline with Debezium + Kafka/Redpanda, broadcasting transactional changes to 4 downstream services (analytics, fraud, notification, audit) with replay capability"
- Blog post: "Building a CDC pipeline from MySQL → Kafka → ClickHouse for game analytics"

## 1.4. Distributed Tracing (OpenTelemetry + Tempo/Jaeger)

**Là gì:** 1 trong 3 trụ cột observability — gắn `trace_id` vào mỗi request, mỗi service trên đường đi tạo "span", visual hóa thành timeline request đi qua đâu mất bao lâu.

**Tại sao bạn cần:**
- **VNG Games JD verified:** "Deep understand observability data types, such as logs and metrics (Prometheus/Grafana)" — và industry chuẩn 2026 thêm traces (LGTM stack)
- Bạn có Prometheus + Grafana (metrics) + Winston (log scattered) = 1/3 observability. 14 services không tracing = lỗ hổng cực lớn
- Microservices interview: "1 request user đi qua 5 services bị chậm, làm sao biết chậm ở service nào?" — câu trả lời là tracing
- Verified interview 2026: "observability, deployment strategy, rollback paths" không còn là bonus mà được CHẤM RÕ

**Cách học/làm:**
1. **OpenTelemetry (OTel):** chuẩn ngành thắng cuộc — không bao giờ phải migrate sau này
2. Auto-instrumentation cho Node: `@opentelemetry/auto-instrumentations-node`; cho Go: `otelhttp` + `otelgrpc` — HTTP/gRPC/DB query tự có span
3. **Tay:** propagate W3C `traceparent` context qua **RabbitMQ message headers** (auto-instrumentation chưa cover hết amqplib) → blog post hay
4. **Backend:** **Grafana Tempo** (rẻ, object storage backend, tích hợp Grafana sẵn có — recommend cho stack bạn) hoặc Jaeger (đơn giản, quen thuộc hơn)
5. **Correlation 3 trụ cột:** metric spike → click sang trace chậm → click sang logs cùng `trace_id`. **LGTM stack** (Loki/Grafana/Tempo/Mimir) làm được hết

**Signal thu được:**
- Bullet CV: "Implemented end-to-end distributed tracing across 14 NestJS+Go microservices with OpenTelemetry + Tempo, reducing MTTR for cross-service incidents by X%"
- Blog post tracing là một trong những blog "ăn khách" nhất 2026

## 1.5. Centralized Logging (Loki / ELK)

**Là gì:** Tập trung log từ mọi service vào 1 nơi có thể search/filter/visualize, thay vì SSH grep từng node.

**Tại sao bạn cần:**
- Bạn có Winston ghi file scattered trên 3 VPS → khi debug 1 user bug phải SSH từng node grep → cực kỳ chậm và không scale
- Mọi JD senior backend đều assume bạn có centralized logging
- Là điều kiện CẦN để có distributed tracing thực sự hữu ích (logs query by `trace_id`)

**Cách học/làm:**
1. **Cho stack bạn (recommend): Loki + Promtail/Alloy** — tích hợp Grafana sẵn có, rẻ (index theo label thay vì full-text), LogQL query
2. **Alternative:** ELK (Elasticsearch + Logstash + Kibana) hoặc OpenSearch — nặng hơn nhưng full-text search mạnh hơn (chỉ cần khi compliance/security requirement)
3. **Structured JSON logging:** Winston config lại với field chuẩn: `timestamp`, `level`, `service`, `trace_id`, `user_id`, `message`
4. **KHÔNG log:** PII, password, token, credit card — vi phạm GDPR/PDPL
5. Deploy bằng docker-compose trên 1 VPS, đổ log 2 services, query thử trong Grafana

**Signal thu được:**
- Bullet CV: "Built centralized logging pipeline with Loki + Promtail across 14 services, enabling cross-service log correlation by trace_id and user_id"

## 1.6. Infrastructure as Code — Terraform

**Là gì:** Code mô tả hạ tầng (EC2, RDS, DNS, Cloudflare config) → `terraform apply` tự gọi API tạo đúng những gì khai báo. Sửa code → plan diff → update.

**Tại sao bạn cần:**
- JD senior VN frequent yêu cầu: "Familiarity with infrastructure-as-code tooling (Helm, Terraform)" (Homebase, ANDPAD JDs)
- Reproducible: tạo staging giống hệt prod chỉ bằng đổi variable
- Version control infra trong Git → review qua PR, rollback được
- Disaster recovery: region chết → `terraform apply` ở region khác có cluster mới
- Senior-level signal: codify hạ tầng = mature engineering practice

**Cách học/làm:**
1. **Core workflow:** write → `plan` (xem diff) → `apply`. State file là trái tim — hiểu nó map resource thật ↔ code thế nào
2. **Remote state:** S3 + DynamoDB lock (hoặc Terraform Cloud free tier) — không bao giờ state local khi làm team
3. **Module reusable, `for_each` vs `count`, `lifecycle` (prevent_destroy cho DB!)**
4. **Cấu trúc repo:** theo môi trường (dev/staging/prod) + module chung
5. **Bài tập đầu:** Terraform hóa toàn bộ Cloudflare config của ngocrongdark.com — Cloudflare provider rất tốt, bạn đang dùng sẵn
6. **`terraform import`:** đưa hạ tầng có sẵn vào quản lý (đừng tạo lại từ đầu)

**Signal thu được:**
- Bullet CV: "Codified infrastructure with Terraform across Cloudflare, DNS, storage, and monitoring providers; reproducible environments via module composition"
- Repo `infrastructure/` công khai

---

# TIER 2 — HIGH (LÝ THUYẾT NỀN + INTERVIEW PREP)

> Tier 1 lấp gap thị trường ngay; Tier 2 xây nền tảng để CV pass phỏng vấn senior thật sự. Verified yêu cầu trong VNG/Sky Mavis interview rounds.

## 2.1. DDIA — Designing Data-Intensive Applications (Kleppmann)

**Là gì:** Sách "bible" của distributed systems backend engineering — phần lớn senior backend từng đọc.

**Tại sao bạn cần:**
- VNG Games Senior BE JD: "Understanding of software architecture principles, design patterns, and best practices" — DDIA dạy chính xác cái này
- Bạn đã LÀM Saga/Outbox/idempotency rồi → DDIA cho bạn **vocabulary chuẩn + mental model formal** để nói trong phỏng vấn
- Mọi phỏng vấn senior công ty tốt đều test concept từ DDIA (Ch.5-9)
- Plateau hiện tại của bạn 50% giải bằng việc đọc DDIA

**Cách học/làm:**
1. Thứ tự cho bạn (đã có thực hành): Ch.5 (Replication) → Ch.6 (Partitioning) → Ch.7 (Transactions) → **Ch.8 (Trouble with Distributed Systems)** → **Ch.9 (Consistency & Consensus)** → Ch.10-11 (Batch/Stream) → quay lại Ch.1-4
2. **Ch.8 + Ch.9 là tinh túy** — đọc 2-3 lần, viết note bằng từ của mình
3. 1 chương/tuần, ~2-3 tháng xong
4. Sau mỗi chương: viết blog post tóm tắt 1 concept khó (Feynman technique — dạy người khác là cách học sâu nhất)

**Signal thu được:**
- Trong phỏng vấn dùng đúng vocabulary (PACELC, write skew, snapshot isolation, hinted handoff...) → khác hẳn người nói "tôi dùng X"
- Blog post DDIA-inspired

## 2.2. MIT 6.5840 Distributed Systems (Lab 1 + Lab 2 Raft)

**Là gì:** Course Distributed Systems của MIT (tên cũ 6.824, đổi 6.5840 từ Spring 2023). Lecture toàn bộ free trên YouTube; labs công khai — Lab 1 (MapReduce) + Lab 2 (Raft) bằng Go.

**Tại sao bạn cần:**
- Build Raft từ đầu = trải nghiệm KHÔNG thay thế được. Hiểu Raft sâu = hiểu etcd, Consul, TiKV, NATS JetStream, Kafka KRaft hoạt động thế nào
- Bạn đã rành Go → khớp hoàn hảo
- Lab Raft nổi tiếng "torturing" — chính xác là độ khó bạn cần để phá plateau
- Debug race condition + edge case của election/replication dạy bạn nhiều hơn 10 dự án CRUD

**Cách học/làm:**
1. URL: pdos.csail.mit.edu/6.824 (vẫn dùng tên cũ trong URL)
2. Xem lecture YouTube playlist toàn bộ (~24 lectures, mỗi cái 60-80 phút)
3. **Lab 1 (MapReduce)** — warm-up, 1-2 tuần
4. **Lab 2 (Raft) chia 4 phần:**
   - 2A: leader election
   - 2B: log replication
   - 2C: persistence
   - 2D: log compaction (snapshot)
   - Dự kiến 60-80h tổng — đau nhưng đáng giá khủng khiếp
5. **KHÔNG copy solution trên mạng** — giá trị nằm ở quá trình debug race condition

**Signal thu được:**
- Blog post "Implementing Raft from scratch: lessons from MIT 6.5840" — dạng blog cộng đồng đón nhận cực mạnh
- Repo private (course quy định private) nhưng blog + skill thật sự thay đổi cách bạn nghĩ

## 2.3. Database Internals + CMU 15-445 (Andy Pavlo)

**Là gì:**
- Sách "Database Internals" (Alex Petrov) — storage engine, B-tree vs LSM, MVCC, consensus
- Course CMU 15-445 Database Systems của Andy Pavlo — được coi là course DB hay nhất thế giới, lecture YouTube full + project public

**Tại sao bạn cần:**
- DB là bottleneck cuối của mọi backend → đầu tư khối này ROI cao nhất sau DDIA
- VNG Games JD: "Proficiency in developing SQL and NoSQL databases" — không chỉ "biết dùng" mà "hiểu sâu"
- Phỏng vấn senior chắc chắn đào: isolation levels khác nhau Postgres vs MySQL, B-tree vs LSM, EXPLAIN ANALYZE, deadlock log...
- Bạn dùng 4 DB ở mức "biết dùng tốt" — gap "hiểu tại sao + dự đoán hành vi" sẽ lộ trong phỏng vấn

**Cách học/làm:**
1. **Đọc Database Internals** Part 1 (Storage Engines) trước — song song xem CMU 15-445
2. **CMU 15-445:**
   - Lecture YouTube full (~25 lectures): https://www.youtube.com/c/CMUDatabaseGroup
   - Spring 2026 version đang chạy — code mới nhất
   - Non-CMU student làm được project (build mini DB engine BusTub bằng C++) qua Gradescope
   - Nếu không làm project, chỉ xem lecture cũng đã đáng giá
3. **Áp dụng MMORPG:** đọc EXPLAIN ANALYZE 5 query nóng nhất; chuyển primary key UUID v4 → ULID/UUID v7 nếu đang dùng v4; setup `pg_stat_statements`; viết blog "Optimizing PostgreSQL queries in a production MMORPG: what EXPLAIN ANALYZE taught me"

**Signal thu được:**
- Trong phỏng vấn DB question đào tận đáy 3-4 layer → khác hẳn mid-level
- Blog post DB optimization từ kinh nghiệm thật

## 2.4. System Design Interview Prep (Alex Xu Vol 1 + 2)

**Là gì:** Framework + ~15 pattern + ~30 đề kinh điển cho system design interview round.

**Tại sao bạn cần:**
- **VNG interview verified (Glassdoor):** "System design + backend fundamentals + real-world problem solving" — system design là round chính
- Sky Mavis, MoMo, VNPay, banking tech — TẤT CẢ tier S/A có system design round
- Đây là round phân biệt mid-level vs senior rõ nhất — coding round có thể fluke, system design không

**Cách học/làm:**
1. **Vol 1** — đọc 1 chương/tuần, ~3-4 tháng. Vol 2 sau đó
2. **Học theo PATTERN, không theo đề:** ~15 pattern tái tổ hợp giải mọi đề:
   - Fan-out vs fan-in
   - Pub/sub + backpressure
   - Ordering guarantees
   - Consistent hashing
   - Rate limiting (centralized vs local-sync)
   - Caching tiers + invalidation
   - CDC (Change Data Capture)
   - Search indexing (inverted index)
   - Hot/cold storage tier
   - Sharding strategies
   - Replication patterns
   - Idempotency & exactly-once-effect
   - Distributed transactions (Saga + Outbox)
   - Geo-replication
   - Push vs pull notification
3. **Đề kinh điển tự thiết kế trên giấy ≥1 lần:** URL shortener, rate limiter, news feed, chat (ordering + presence + offline), notification multi-channel, ride-sharing (Uber), distributed cache, payment (idempotency — sân nhà bạn), **realtime leaderboard + matchmaking (sân nhà tuyệt đối — luôn lái về đây)**
4. **Mock nói to thành tiếng** — đọc 10 đề không bằng mock 3 đề. Pramp free, hellointerview.com framework, ByteByteGo newsletter weekly

**Luật 2026 đã đổi (verified):**
1. **AI layer mặc định** — "Design recommendation" = embedding + vector store + RAG; im lặng = mất điểm
2. **Right-sizing được chấm:** URL shortener hobby mà mở multi-region + Spanner = red flag "poor judgment". **Cost per request** hỏi thẳng
3. **Operational thinking bắt buộc:** observability + deploy strategy + rollback path không còn bonus
4. **2 component đào sâu thắng 5 component hời hợt**
5. **Senior follow-up đào trade-off cụ thể** — câu trả lời không bao giờ là tên tool, mà là "tool X với trade-off Y vì context Z"

**Signal thu được:**
- 5 đề tự viết design trên giấy đăng lên blog/GitHub Gist
- Mock interview rating tăng dần qua các quý

## 2.5. NeetCode 150 (Algorithm/Data Structure)

**Là gì:** 150 bài LeetCode được curate theo pattern — đủ cho 95% phỏng vấn (kể cả FAANG-lite).

**Tại sao bạn cần:**
- **VNG interview verified:** "Basic computer science concepts like data structures, networking, OS, database and 2 programming exercises" — coding round là filter chính
- Sky Mavis Mavis Seeds program test algorithm + DS
- FAANG/global remote: coding round = ~2 medium/45 phút trên ngôn ngữ chọn
- Không phải competitive programming — chỉ medium-level pattern recognition

**Cách học/làm:**
1. **NeetCode.io roadmap** — 150 bài theo pattern (arrays/hashing → two pointers → sliding window → stack → binary search → linked list → trees → tries → backtracking → heap → graphs → 1D DP → 2D DP → greedy → intervals → math/geometry → bit manipulation)
2. **Process:** 30-45 phút/ngày × 6 tháng = ~150 bài
3. **Mỗi bài:** tự làm 25 phút → nếu stuck xem hint → xem solution → đóng tab → code lại từ trắng → note pattern + insight 2 dòng
4. **1 ngôn ngữ duy nhất (Go hoặc TypeScript)** — không đổi giữa chừng
5. **Sau lần 1:** revisit bài làm sai sau 1 tuần, 1 tháng, 3 tháng (spaced repetition)

**Signal thu được:**
- Pass coding round VNG/Sky Mavis/MoMo
- LeetCode profile public với badges

## 2.6. Google SRE Book + SRE Workbook

**Là gì:** Hai cuốn sách free của Google về Site Reliability Engineering — SLO/SLI/Error Budget, On-call, Postmortem culture, Monitoring, Release Engineering.

**Tại sao bạn cần:**
- Senior backend 2026 = senior backend + một phần DevOps/SRE
- VNG Games JD: observability + reliability là core requirement
- Phỏng vấn senior chấm "operational thinking" — SRE book là vocabulary chuẩn
- Bạn đã có Prometheus + alerting + 25 incidents detected → SRE book formalize cái bạn đã làm bằng intuition

**Cách học/làm:**
1. Free tại **sre.google/books**
2. Đọc theo thứ tự cho bạn:
   - Ch.4 **Service Level Objectives** — định nghĩa SLO/SLI
   - Ch.6 Monitoring Distributed Systems
   - Ch.11 Being On-Call
   - Ch.12 Effective Troubleshooting
   - Ch.15 **Postmortem Culture** — blameless, root cause, action items
   - Ch.16 Tracking Outages
3. **SRE Workbook Ch.5 — Alerting on SLOs** (multi-window multi-burn-rate alerting) → áp dụng ngay vào game của bạn

**Áp dụng vào MMORPG:**
- Define SLO cho 3 service lõi (auth/payment/game loop): availability ≥99.5%, p99 ≤300ms
- Setup multi-burn-rate alert thay alert ngưỡng tĩnh dễ false positive
- Viết lại 3 incident lớn thành postmortem chuẩn

**Signal thu được:**
- Bullet CV: "Established SLO framework with multi-window multi-burn-rate alerting; reduced alert noise X% while improving real-incident MTTR"
- 3 postmortem chuẩn trong repo công khai

## 2.7. Engineering Excellence — Git Mastery + Code Quality + Static Analysis

**Là gì:** Bộ kỹ năng "tưởng cơ bản nhưng phỏng vấn senior đào sâu":
- Git nâng cao (rebase, bisect, reflog, hooks, worktree)
- Lint chặt (ESLint với plugin nghiêm, golangci-lint enable 30+ linter)
- Type system tận dụng (TS strict, Go custom types)
- Static analysis (SonarQube, CodeQL, Semgrep)
- Pre-commit hooks (gitleaks chặn commit secret)

**Tại sao bạn cần:**
- GitLab Senior framework: "Helps to set and enforce coding standards", "Looks to maintain coding consistency across the code base"
- Senior bị test code quality trong tech interview round (VNG verified)
- Bạn 478 deploys nhưng nếu chưa có pre-commit/lint chặt thì có tech debt ngầm

**Cách học/làm:**
1. **Git mastery (1 tuần):**
   - `git rebase -i` clean commit history trước khi mở PR
   - `git bisect` tìm regression bằng binary search trên history
   - `git reflog` cứu commit đã "mất"
   - `git worktree` nhiều branch checkout song song
   - Pre-commit framework (Python) hoặc Husky (Node) — pre-commit hook
2. **Conventional Commits:** `feat:`, `fix:`, `refactor:` → automated changelog + semver (semantic-release)
3. **Linter setup MMORPG:**
   - Node: ESLint + `@typescript-eslint/strict` + `eslint-plugin-security` + `eslint-plugin-no-floating-promises`
   - Go: `golangci-lint` enable preset + custom
   - Pre-commit: lint + format + gitleaks (chặn commit secret)
4. **TypeScript strict mode 100%:** `strict: true`, `noUncheckedIndexedAccess`, **không bao giờ `any`** (dùng `unknown`)
5. **Mutation testing:** Stryker (JS) hoặc go-mutesting — đo chất lượng test thật, không chỉ coverage

**Signal thu được:**
- Pre-commit hook config trong repo công khai
- Bullet CV: "Established strict linting (ESLint security + typescript-eslint strict, golangci-lint with 30+ rules), pre-commit hooks (gitleaks), and Conventional Commits with automated semver releases"

## 2.8. Testing Engineering — Pact + Testcontainers + Chaos

**Là gì:**
- **Contract testing (Pact):** consumer-driven contracts giữa services — chấm dứt "sửa API gateway vỡ service khác"
- **Testcontainers:** spin Postgres/Redis/RabbitMQ thật trong test thay vì mock
- **Chaos engineering:** chủ động phá staging để test resilience patterns

**Tại sao bạn cần:**
- CV bạn không có dòng testing nào — gap im lặng nguy hiểm
- "Test strategy cho 14 services?" là câu hỏi senior chắc chắn gặp
- Senior tạo institutional process, không phải "tôi viết test cho code tôi"

**Cách học/làm:**
1. **Testcontainers (Go + Node đều có):** spin real DB trong integration test → catch real bug mock không catch
2. **Pact** + Pact Broker:
   - Consumer viết "tôi expect API trả về structure X"
   - Producer verify "tôi đáp ứng được contract X"
   - CI block deploy nếu break contract của downstream
   - Cực kỳ phù hợp 14 services của bạn
3. **Integration test cho messaging:** test consumer idempotency (gửi 2 lần → side effect 1 lần), retry/backoff, outbox relay
4. **Property-based testing:** fast-check (TS), gopter/rapid (Go) — cho logic thuần (damage formula, drop rate)
5. **Mutation testing:** Stryker — đo test có thực sự bắt bug không
6. **Chaos game day:**
   - Bắt đầu thủ công: tắt 1 service, kill Redis, làm chậm network bằng `tc netem`
   - Document game day report (giả thuyết, observation, kết quả)
   - Sau khi lên K8s: chaos-mesh tự động
   - Mục tiêu: chứng minh circuit breaker + Saga compensation chạy đúng dưới hỗn loạn thật

**Signal thu được:**
- Bullet CV: "Implemented consumer-driven contract testing with Pact across 14 services, catching X breaking API changes before deploy"
- Bullet CV: "Conducted quarterly chaos engineering game days simulating Redis failure, RabbitMQ partition, pod kill — validating circuit breaker and Saga compensation behavior"

## 2.9. Production Safety — Feature Flags + Canary + Kill Switch

**Là gì:** Kỹ thuật "tách deploy khỏi release" cho phép ship liều nhưng an toàn.

**Tại sao bạn cần:**
- Bạn có 478 deploys 95% success → nâng 95% lên 99% bằng canary + auto-rollback
- Senior 2026 expected biết "feature flag thay vì if/else config"
- Phỏng vấn system design 2026 đều hỏi "rollout strategy + rollback path"

**Cách học/làm:**
1. **Feature flags self-host:** **Unleash** (open source, đủ tốt) hoặc Flagsmith
2. **4 loại flag (Pete Hodgson):**
   - **Release toggle** — ẩn feature đang dev (xóa sau release)
   - **Experiment toggle** — A/B test (xóa sau khi quyết)
   - **Ops toggle / Kill switch** — tắt nhanh feature gặp sự cố (giữ lâu dài)
   - **Permission toggle** — premium feature (vĩnh viễn)
3. **Quy tắc cleanup:** release toggle phải xóa trong 30 ngày sau full rollout
4. **Canary với Argo Rollouts:** 1% → 5% → 25% → 50% → 100% theo metric (error rate, latency, business metric)
5. **Dark launch:** triển khai code production nhưng KHÔNG expose user — chỉ shadow traffic. Bạn đã làm điều này với Socket.IO → Go migration (parallel-run 2 tuần) — **formalize và đưa vào CV**
6. **Auto-rollback rule:** error rate >5% trong 5 phút → rollback; p99 latency tăng >50% → rollback; custom business metric (payment success rate <99%) → rollback

**Signal thu được:**
- Bullet CV: "Implemented canary deployment with Argo Rollouts and metric-based auto-rollback, reducing failed prod deploys from 5% to <1%"
- Bullet CV: "Migrated game loop using 2-week dark launch with shadow traffic comparison before full cutover"

## 2.10. Working with Ambiguity + Estimation + Scoping

**Là gì:** Kỹ năng nhận requirement mơ hồ, chia thành tasks, estimate có ý nghĩa.

**Tại sao bạn cần:**
- **GitLab Senior framework EXPLICIT:** "Able to deliver work, even when given unclear requirements" và "Able to take on large issues with vague requirements and design an implementation"
- Junior cần ticket rõ; senior nhận "build X cho ổn định hơn" và tự định nghĩa scope
- Đây là phân biệt mid-level vs senior rõ nhất trong real work

**Cách học/làm:**
1. **Nhận requirement mơ hồ — pattern senior:**
   - Clarify 5W1H — What outcome (không phải feature), Who affected, When needed, Why now, How measure success
   - Viết back understanding — "Tôi hiểu là X, mục tiêu Y, ràng buộc Z. Đúng không?"
   - Tách must-have vs nice-to-have
   - Đề xuất 2-3 options với trade-off — không bao giờ chỉ 1 option, không bao giờ >3
   - **Define non-goals rõ ràng** — bảo vệ scope
2. **Estimation:**
   - Break down trước khi estimate — feature lớn = tổng các task ≤2 ngày
   - 3-point estimation: optimistic + realistic + pessimistic, bộc lộ uncertainty
   - Reference past data: feature tương tự lần trước mất bao lâu THẬT?
   - Include unknown unknowns: buffer 30-50% cho integration testing + edge case + code review cycle
   - **Track actuals** sau mỗi feature → calibrate dần
3. **Vertical slice breakdown:** mỗi task deliverable phải tự tạo giá trị (dù nhỏ). KHÔNG break theo layer (1 task DB, 1 task service, 1 task API)
4. **Bài tập:** lấy 1 feature dự định làm phase tới (vd "thêm guild war"), viết:
   - 1 trang context (what + why + non-goals)
   - Break thành 5-8 stories vertical slice
   - Estimate mỗi story với 3-point + total range
   - List 3 risks + mitigation

**Signal thu được:**
- Folder `design-docs/` trong repo công khai
- Behavioral interview: "Tell me about a project with unclear requirements" → có document cụ thể chỉ ra

---

# TIER 3 — MEDIUM (KIẾN THỨC CẦN BIẾT, ÁP KHI GẶP)

> Không phải gap critical nhưng senior bị hỏi sẽ phải biết. Học theo nhu cầu khi gặp vấn đề cụ thể.

## 3.1. AI/LLM Infrastructure (mandatory cho system design 2026)

**Là gì:** Stack vận hành LLM-powered features ở production:
- Vector DB (pgvector, Qdrant)
- LLM gateway pattern (routing model, fallback, retry, cost tracking)
- Semantic caching
- Guardrails (prompt injection defense, output validation, PII scrubbing)
- Observability LLM (token cost, latency p99)

**Tại sao bạn cần:**
- Verified interview 2026: "Design recommendation system" = embedding + vector store + RAG; "Design chat" kèm generative summary. **Không tự nêu AI layer = mất điểm vì im lặng là câu trả lời**
- Vietnam IT Market 2026: "Software Engineers with AI skills earn up to 25% more"
- Bạn đã có RAG chatbot 40% cache hit + 50% cost reduction → **lợi thế cạnh tranh thật, chỉ cần hệ thống hóa**

**Cách học/làm:**
1. **Nâng RAG chatbot hiện tại → mini LLM-gateway:**
   - Routing 2 model: rẻ (Haiku/4o-mini) cho FAQ đơn giản, đắt (Sonnet/GPT-4) cho câu khó
   - **Semantic cache với pgvector** (Postgres đã có sẵn — HNSW index)
   - Cost dashboard Grafana: token/user/feature/model
   - Prompt injection test suite (đặc biệt vì game của bạn có chat → user-generated content)
   - Fallback provider khi 1 LLM down
2. **RAG nâng cao:**
   - Chunking strategy (size/overlap/semantic)
   - Hybrid search (BM25 + vector + rerank)
   - Evaluation framework RAGAS (faithfulness, relevance)
   - Citation trong câu trả lời
3. **Function calling / structured output:** JSON schema enforcement — nền của agent

**Signal thu được:**
- Bullet CV: "Built LLM gateway with model routing (cost-optimized), semantic caching via pgvector HNSW index, and prompt injection defense, achieving 40% cache hit rate and 50% cost reduction across game support chatbot"
- **Blog post "Building a production LLM gateway: lessons from running a game support chatbot"** — ăn khách nhất bạn viết được năm 2026

## 3.2. Security Deep — OWASP + OAuth/OIDC + mTLS + Secrets

**Là gì:**
- OWASP Top 10 hiểu sâu, audit chính code mình
- OAuth 2.0 + OIDC flows (Authorization Code + PKCE chuẩn 2026)
- JWT đúng cách (RS256/ES256, JWKS, refresh rotation với reuse detection)
- mTLS service-to-service
- Secrets management (Vault, SOPS + age)
- Supply chain (Dependabot, gitleaks, SBOM với syft)
- Rate limiting deep (centralized vs local-sync trade-off)

**Tại sao bạn cần:**
- Senior backend = phòng thủ tuyến đầu cho security
- Fintech/banking VN (MoMo, VNPay, Techcombank) — security là pass/fail criteria
- Sau log4shell + xz backdoor 2024 → JD security questions ngày càng phổ biến
- Bạn có JWT/RBAC/rate-limit/CORS ở mức cơ bản — gap với "design + defend"

**Cách học/làm:**
1. **OWASP Top 10:** audit MMORPG cho từng mục — IDOR (đổi user_id URL đọc inventory người khác?), Injection (raw query nào không parameterized?), SSRF (webhook URL có validate?), Security Misconfiguration (Swagger mở prod?), Vulnerable Components
2. **Thực hành:** OWASP Juice Shop (app cố tình lỗ hổng để hack) + chạy OWASP ZAP scan staging của bạn
3. **OAuth 2.0 deep:** Authorization Code + PKCE flow chi tiết; Implicit và Password grant đã khai tử; refresh token rotation với reuse detection (token reuse = nghi bị đánh cắp → revoke cả family)
4. **mTLS service-to-service:** self-signed cert giữa 14 services, hoặc để service mesh (Istio/Linkerd) lo
5. **Supply chain:** Dependabot/Renovate, `npm audit`/`govulncheck`, **gitleaks** trong CI (chặn lỡ commit secret), SBOM với syft, image scan với Trivy
6. **Rate limiting nâng cao** — câu phỏng vấn senior thật/giả:
   - Centralized counter Redis: accuracy nhưng +1-2ms latency + SPOF — chọn cho **payment** (over-admission = mất tiền)
   - Local + sync: latency thấp nhưng over-admission tạm — chọn cho **social feed**
   - Câu trả lời không bao giờ là "dùng Redis", mà là "tool X với trade-off Y vì context Z"
7. **Audit log bất biến:** append-only cho fintech/game tiền thật

**Signal thu được:**
- Bullet CV: "Hardened production security with OWASP Top 10 audit, OAuth 2.0 + PKCE, JWT with refresh token rotation + reuse detection, mTLS service-to-service, and supply chain scanning (Dependabot, gitleaks, Trivy)"

## 3.3. Performance Engineering — Profiling + Tail Latency + Load Test

**Là gì:**
- Methodology: đo trước-đoán sau, USE + RED framework, Amdahl's law, Little's law
- Profiling cụ thể: Go pprof (CPU/heap/goroutine/block), Node clinic.js
- Continuous profiling: Grafana Pyroscope
- Tail latency analysis (paper "The Tail at Scale" — Jeff Dean)
- Load test nâng cao: soak / spike / stress / breakpoint test
- Brendan Gregg's USE method + 60-second debug

**Tại sao bạn cần:**
- VNG Games JD: "Experience in product development and delivering highly-available, scalable systems"
- Bạn đã optimize tốt (95% DB write reduction, 60% payload, p99<500ms) — gap là **phương pháp luận có thể repeat**, không phải thành tích đơn lẻ
- Senior bị hỏi: "Hệ thống chậm dần — quy trình debug của bạn?" — phải có process trong đầu

**Cách học/làm:**
1. **Go pprof master (Go là ngôn ngữ game loop của bạn):**
   - CPU profile, heap profile (inuse vs alloc), goroutine profile (leak detect), block/mutex profile
   - `import _ "net/http/pprof"` expose endpoint
   - Flame graph đọc thành thạo
   - **Grafana Pyroscope** — continuous profiling trên prod, không cần ssh thủ công
2. **Node profiling:** `--inspect` + Chrome DevTools, clinic.js doctor/flame/bubbleprof, heap snapshot diff
3. **Methodology:**
   - Đo baseline → profile → fix MỘT thứ → đo lại → lặp
   - **USE method** (Brendan Gregg): cho mỗi resource đo Utilization + Saturation + Errors
   - **60-second debug:** uptime → dmesg -T | tail → vmstat 1 → mpstat → pidstat → iostat -xz → free -m → sar -n DEV → ss -s
4. **Tail latency:** đọc paper "The Tail at Scale" — Jeff Dean. p99 quan trọng hơn average vì 1 request user qua nhiều service, xác suất chạm tail tăng theo fanout
5. **k6 nâng cao (bạn đã dùng):**
   - Phân biệt soak (tải đều lâu) vs spike (đột biến) vs stress (tăng dần đến breakpoint) vs breakpoint test
   - `ramping-arrival-rate` (đo đúng RPS thay vì VU)
   - Thresholds làm quality gate trong CI
6. **Caching hệ thống hóa:**
   - Pattern: cache-aside, read-through, write-through, **write-behind** (bạn đã làm với dirty flag!), refresh-ahead
   - Vấn đề thật: stampede (single-flight/logical expiry/jitter), penetration (bloom filter/null marker), avalanche (jitter TTL), hot key (local cache + replicate)

**Signal thu được:**
- Blog post: "Profiling Go game loop in production with pprof and Pyroscope: a methodology"
- Bullet CV: "Established performance engineering discipline with continuous profiling (Pyroscope), USE-method debugging, and load-test quality gates (k6 in CI)"

## 3.4. CS Fundamentals Deep — OS + Networks + Concurrency

**Là gì:** Phần PTIT dạy nhưng không đủ sâu — được test mạnh ở phỏng vấn senior công ty tốt.

**Tại sao bạn cần:**
- **VNG paper test verified:** "Basic computer science concepts like data structures, networking, operating system, database"
- Bạn realtime game backend = network + concurrency là sống còn
- Câu phỏng vấn "Tại sao Node single-thread mà handle 10k connections?" / "Goroutine khác OS thread thế nào?" — đều là OS

**Cách học/làm:**

**Operating Systems:**
- Process vs thread, context switch cost, **Go scheduler GMP model** (câu Go phỏng vấn phổ biến)
- Virtual memory, page table, TLB, page fault, OOM killer (bạn chạy VPS sẽ gặp)
- I/O models: blocking/non-blocking/multiplexing/async; **epoll** (nền Node event loop, Nginx, Redis — phải hiểu)
- Linux namespaces + cgroups (nền Docker)
- Resource: **OSTEP** (free, pages.cs.wisc.edu/~remzi/OSTEP/) — đọc Concurrency + Virtualization, không cần hết

**Computer Networks:**
- TCP chi tiết: handshake, **TIME_WAIT** (vấn đề thật của game server hàng nghìn connection), congestion control, Nagle (game thường tắt với TCP_NODELAY)
- UDP: tại sao FPS dùng UDP; reliable UDP (KCP/QUIC/ENet) xây thế nào — **liên quan trực tiếp game của bạn**
- HTTP/1.1 vs HTTP/2 (multiplexing) vs HTTP/3 (QUIC trên UDP giải HOL blocking)
- TLS 1.3: 1-RTT, 0-RTT resumption
- Load balancing L4 vs L7
- Resource: Kurose & Ross chương Transport + Application

**Concurrency (đào sâu — thế mạnh của bạn):**
- Memory model, happens-before, atomic, false sharing
- Go cụ thể: channel internals, sync.Mutex vs atomic, sync.Pool, goroutine leak (pprof), data race detector
- Node cụ thể: event loop phases, microtask vs macrotask, worker_threads, tại sao CPU-bound giết Node
- **Đọc bài Kleppmann vs antirez về Redlock** — bài học judgment kinh điển về distributed locking

**Signal thu được:**
- Pass paper test VNG round 1 dễ dàng
- Trong phỏng vấn dùng vocabulary đúng (epoll, GMP, TIME_WAIT, false sharing...)

## 3.5. Architecture Patterns + DDD

**Là gì:**
- **Strategic DDD:** Bounded Context, Context Map, Ubiquitous Language
- **Tactical DDD:** Entity vs Value Object, Aggregate + Aggregate Root, Domain Event
- **Microservices Patterns:** API Gateway, BFF, Strangler Fig, Service Discovery, Bulkhead, Sidecar
- **Resilience patterns:** Circuit Breaker, Retry với jitter, Retry Budget, Bulkhead, Load Shedding
- **Anti-patterns:** Distributed Monolith, Chatty Services, Shared Database

**Tại sao bạn cần:**
- VNG Games JD EXPLICIT: "Understanding of software architecture principles, design patterns, and best practices"
- Senior 2026 phải nói được CẢ HAI chiều microservices vs modular monolith — "microservices mặc định" đã lỗi thời sau Amazon Prime Video case
- Bạn đã LÀM nhiều pattern (Saga, Outbox, Circuit Breaker) — chỉ thiếu vocabulary chuẩn

**Cách học/làm:**
1. **Sách:** "Microservices Patterns" (Chris Richardson) — map gần 1:1 với những gì bạn đã build
2. **DDD intro:** "Learning Domain-Driven Design" (Vlad Khononov, 2021 — dễ vào nhất hiện nay)
3. **Áp dụng MMORPG:**
   - Vẽ **Context Map** cho 14 services — service nào là bounded context thật, service nào "cắt theo kỹ thuật"? Thường lòi ra 14 services nên là 8
   - Identify aggregates → ranh giới transaction → giải thích tại sao bạn cần Saga giữa các aggregate
4. **Resilience deep:**
   - **Retry budget** — cap % retry/total request, retry storm giết hệ thống nhanh hơn lỗi gốc
   - **Bulkhead** — pool tài nguyên riêng cho mỗi downstream, không share
   - **Load shedding** — drop request khi quá tải thay vì queue dài
5. **Anti-patterns audit:** distributed monolith (deploy theo cặp), chatty services (1 request → 15 internal calls?), shared database giữa microservices

**Signal thu được:**
- Context Map diagram của 14 services của bạn → tài liệu phỏng vấn cực mạnh
- Trong phỏng vấn dùng vocabulary DDD chuẩn

## 3.6. API Design ở mức Senior

**Là gì:**
- Versioning strategy (URL vs header vs field evolution)
- Backward compatibility rules nghiêm
- Pagination đúng (cursor-based)
- Error contract RFC 7807 (`type`, `code`, `retryable`, `request_id`)
- Idempotency-Key cho mọi mutation
- OpenAPI-first development
- gRPC deadline propagation + streaming
- GraphQL khi nào hợp / khi nào KHÔNG

**Tại sao bạn cần:**
- "At senior levels, API work becomes less about writing endpoints, more about contracts, edge cases, failure modes"
- VNG/Sky Mavis JD đều có "Strong understanding of REST/WebSocket, with experience integrating with Mobile and Web platforms"
- Bạn có 100+ APIs trên 14 services — formalize design discipline

**Cách học/làm:**
1. **Versioning:** URL versioning (`/v1/`) cho major break; field evolution cho minor. **KHÔNG bao giờ** break v1 không có deprecation policy + sunset date công bố ≥6 tháng trước
2. **Backward compat rules:**
   - ✅ Thêm field optional ok | ✅ Thêm endpoint mới ok
   - ❌ Bỏ field, đổi type, đổi nghĩa field giữ tên cũ, thêm field bắt buộc, đổi default value
   - Protobuf: KHÔNG đổi tag number; field mới optional + reserve tag bị xóa
   - **Event Kafka không có Schema Registry = mìn nổ chậm**
3. **Cursor pagination** (opaque base64 cursor) — KHÔNG offset cho data thay đổi; KHÔNG trả `total_count` trừ khi thực sự cần (count expensive)
4. **Error contract RFC 7807:**
   ```json
   {"type": "...", "title": "...", "status": 402,
    "code": "INSUFFICIENT_FUNDS", "retryable": false, "request_id": "req_xyz"}
   ```
   - `retryable` boolean để client biết retry hay không (cực quan trọng mobile/poor network)
   - `request_id` match với log/trace → hỗ trợ support
5. **Idempotency-Key header:** mọi mutation (POST/PUT/PATCH/DELETE); TTL 24-72h (Stripe 24h); provider event_id làm key cho webhook (bạn đã làm với PayOS/VietQR)
6. **OpenAPI-first:** schema là contract, codegen client/server, contract test từ schema
7. **GraphQL:** biết khi nào hợp (nhiều client hình dạng data khác nhau) và cái giá (N+1, complexity limit, cache khó)

**Signal thu được:**
- OpenAPI spec đầy đủ trong repo công khai
- Bullet CV: "Established API design discipline: cursor pagination, RFC 7807 error contracts, Idempotency-Key on all mutations, schema-first development with OpenAPI codegen"

## 3.7. CI/CD Nâng Cao — GitOps + DORA Metrics

**Là gì:**
- Pipeline chuẩn: lint → test → build → scan → integration → deploy staging → canary prod → auto-rollback
- GitOps với ArgoCD (Git là nguồn sự thật duy nhất)
- DORA metrics (Deployment frequency, Lead time, Change failure rate, MTTR)
- Trunk-based development + feature flags

**Tại sao bạn cần:**
- Bạn có 478 deploys 95% success — formalize bằng DORA metrics → bullet CV cực mạnh
- JD senior backend mặc định yêu cầu CI/CD experience
- GitOps là chuẩn deploy K8s 2026

**Cách học/làm:**
1. **Pipeline cho mỗi PR:**
   ```
   lint → unit test → build image → scan (Trivy + gitleaks) → integration test (testcontainers)
   → push registry (tag = git sha) → deploy staging (ArgoCD auto-sync) → smoke test
   → deploy prod (canary với Argo Rollouts) → post-deploy verification → auto-rollback
   ```
2. **ArgoCD GitOps:** declarative deploy K8s từ Git repo, drift detection, rollback bằng git revert
3. **DORA metrics dashboard:** đo chính pipeline của bạn:
   - Deployment frequency (lần/ngày)
   - Lead time (commit → prod)
   - Change failure rate (% deploy gây sự cố)
   - MTTR (mean time to recovery)
4. **Trunk-based development:** không Git Flow (long-lived branches → merge hell); merge nhỏ + thường xuyên + feature flag cho work-in-progress

**Signal thu được:**
- Bullet CV: "Established CI/CD pipeline (GitHub Actions + ArgoCD GitOps) achieving DORA Elite: 5+ deploys/day, lead time <1h, change failure rate <5%, MTTR <30min"

## 3.8. Data Engineering Cơ Bản cho Modern Backend

**Là gì:** Backend hiện đại overlap data engineer — fluency tối thiểu trong:
- Streaming integration (consume Kafka topics trong backend service)
- Data contracts (schema giữa producer/consumer)
- ETL vs ELT (transform trước load vs sau load — pattern modern)
- dbt khái niệm (SQL-based transformation framework)
- Orchestration (Airflow/Dagster — đọc DAG, không cần thiết kế)
- OLAP cho analytics (ClickHouse khác OLTP thế nào)
- CDC bridge OLTP → data ecosystem

**Tại sao bạn cần:**
- Verified 2026 trend: "Backend engineers expected to understand streaming data integration, data contracts"
- VNG Games có "Data Analytics team" → backend của bạn cần feed analytics pipeline
- Khi build Kafka CDC pipeline (Tier 1) → tự nhiên overlap data engineering

**Cách học/làm:**
1. **Không cần thành data engineer** — chỉ cần fluency để communicate
2. **Áp dụng MMORPG:** Debezium đọc binlog → Kafka → ClickHouse → Grafana dashboard. Đây là data pipeline đầy đủ chuẩn ngành, mini-version
3. **ETL vs ELT:**
   - ETL (cũ): transform trước khi load — phù hợp data nhỏ
   - ELT (modern): load raw vào warehouse, transform trong warehouse với dbt — scale tốt hơn
4. **dbt khái niệm:** SQL transformation versioned trong Git, test data quality (uniqueness, not_null, relationships, freshness)
5. **Data contracts:** Schema Registry với Avro/Protobuf — break contract = break consumer

**Signal thu được:**
- Bullet CV: "Designed data pipeline (MySQL binlog → Debezium → Kafka → ClickHouse) feeding realtime analytics dashboard, with schema evolution via Schema Registry"

## 3.9. Multi-tenancy + i18n + Privacy/Compliance

**Là gì:**
- **Multi-tenancy:** SaaS phục vụ nhiều khách hàng (3 mô hình: shared DB shared schema, shared DB schema-per-tenant, DB-per-tenant)
- **i18n:** time zone (lưu UTC, convert ở display), currency (lưu integer cents/dong, không float), locale-aware (number/date format, plural rules)
- **Privacy/Compliance:** GDPR/CCPA/PDPL VN khái niệm, PII tagging, audit log, right to be forgotten, encryption at rest + in transit

**Tại sao bạn cần:**
- Fintech/banking VN (MoMo, VNPay, Techcombank) — privacy/compliance là pass/fail criteria
- SaaS B2B (KMS, Manabie, Got It) — multi-tenancy là core architecture
- Game của bạn có chat → user-generated content → privacy concerns
- Phỏng vấn senior có thể hỏi: "Làm sao support 10k tenant trên cùng app?"

**Cách học/làm:**
1. **Multi-tenancy patterns:**
   - **Shared DB, shared schema + `tenant_id` column** (đơn giản nhất, RLS Postgres enforce)
   - Shared DB, schema-per-tenant (isolation tốt hơn, harder ops)
   - DB-per-tenant (isolation tuyệt đối, đắt nhất)
   - Vấn đề: noisy neighbor, per-tenant rate limit, per-tenant feature flag, backup per-tenant
2. **i18n:**
   - Time zones: **lưu UTC + tz column riêng**, convert ở display layer; KHÔNG bao giờ lưu local time. Postgres `timestamptz`
   - Currency: **lưu integer (cents/dong)**, KHÔNG bao giờ float; ISO 4217 code; conversion rate có timestamp
   - Locale: number format, date format, plural rules (slavic languages có 5 form số ít/nhiều)
3. **Privacy/Compliance:**
   - GDPR/CCPA/PDPL VN — biết tồn tại + 6 quyền user (truy cập, xóa, sửa, port data, etc.)
   - PII tagging trong schema; data retention policy có TTL
   - **Right to be forgotten:** soft-delete + anonymize PII thay vì hard-delete; chuẩn bị endpoint xóa-theo-yêu-cầu
   - Audit log bất biến: append-only; ai-truy-cập-data-nào-lúc-nào
   - Encryption: TLS 1.3 in-transit, AES-256 at-rest

**Signal thu được:**
- Bullet CV (nếu áp dụng game): "Designed PII handling with audit log, right-to-be-forgotten flow, and at-rest encryption for chat messages and transaction records"

## 3.10. Working with Legacy Code + Tech Debt

**Là gì:** Kỹ năng đọc/sửa codebase không phải bạn viết + quản lý tech debt chiến lược.

**Tại sao bạn cần:**
- JD senior chuyên hỏi: "Ability to understand complex systems and work with legacy code / unclear requirements"
- Bạn build green-field từ đầu → gap không tránh khỏi
- Joel Spolsky "Things You Should Never Do" (rewrite from scratch) — senior phải biết bài học này

**Cách học/làm:**
1. **Khi gặp codebase lạ — quy trình senior:**
   - Run nó trước — pull, install, chạy, đụng tay trước khi đọc
   - Đọc theo dòng chảy 1 request — chọn 1 endpoint, lần qua tất cả layer
   - Hỏi "tại sao", không "cái gì" — không assume code cũ là dở
   - Tìm test trước source code — test mô tả intent
   - Git blame để hiểu evolution
   - Vẽ system diagram khi đọc
   - **KHÔNG refactor trong 30 ngày đầu** — bạn chưa hiểu đủ để biết refactor gì là an toàn
2. **Tech debt management:** 4 loại (Martin Fowler quadrant):
   - **Deliberate + prudent** ("phải ship gấp, sẽ refactor sau") — OK nếu thực sự refactor sau
   - **Deliberate + reckless** ("không có thời gian thiết kế đẹp") — nguồn 80% debt thật
   - **Inadvertent + prudent** ("giờ ta biết cách đáng lẽ phải làm") — học được, refactor khi cơ hội
   - **Inadvertent + reckless** ("không hiểu nên làm thế") — debt nguy hiểm nhất, ẩn
3. **Quy tắc trả debt:**
   - **Boy Scout Rule:** mỗi PR fix feature, cải code 1 chút trong phạm vi đụng vào
   - **Strangler Fig Pattern:** rewrite lớn — build module mới song song, dần redirect traffic, kill module cũ. KHÔNG big-bang rewrite (90% fail)
   - **Quantify debt cost:** "function này gây 30% bug trong 6 tháng" → ưu tiên hơn "code này xấu"
   - **Tech debt budget mỗi sprint:** 10-20% thời gian cho refactor — institutional, không xin xỏ
4. **Sách:** "Working Effectively with Legacy Code" (Michael Feathers — kinh điển)

**Signal thu được:**
- Trong phỏng vấn behavioral: "Tell me about a complex legacy system you worked on" → có vocabulary chuẩn + framework để trả lời

---

# TIER 4 — SPECIALIZATION (CHỌN 1-2 ĐỂ KHÁC BIỆT)

> Senior generalist > junior generalist, nhưng **senior + niche expert > senior generalist**. Bạn có gaming + realtime backend là niche tốt. Chọn 1-2 nhánh dưới đây để go deep và trở thành "go-to person".

## 4.1. Game Backend Deep (nếu nhắm VNG Games / Sky Mavis / Garena)

**Là gì:** Stack chuyên sâu game backend production scale:
- Realtime networking nâng cao (state sync, lag compensation, deterministic lockstep)
- AOI (Area of Interest) / Interest Management
- World sharding (zone-based, seamless world, instance)
- Game session orchestration trên K8s (**Agones** + **Open Match**)
- Anti-cheat phía server (speedhack, teleport, duplication, packet replay, bot detection)
- Game economy + kinh tế ảo (sink/faucet analysis, audit trail)

**Tại sao bạn cần:**
- **VNG Games Senior BE JD** match background bạn gần như hoàn hảo — VNG Games có Võ Lâm Truyền Kỳ cùng dòng MMORPG bạn build
- Sky Mavis (Axie/Ronin), Garena, Gameloft VN, Hiker Games — tất cả cần backend gaming chuyên sâu
- Đây là niche RIÊNG của bạn — ít người VN có background gaming production thật

**Cách học/làm:**
1. **Đọc series Glenn Fiedler (gafferongames.com)** — kinh thánh game networking, free
2. **State sync models deep:**
   - Snapshot interpolation (FPS chuẩn)
   - Delta compression
   - Deterministic lockstep (RTS/fighting — đòi hỏi determinism: floating point, RNG seed)
   - Client-side prediction + server reconciliation (cảm giác mượt dù ping 80ms)
   - Lag compensation
3. **AOI implementation trong MMORPG của bạn:**
   - Grid-based spatial hashing (đơn giản, đủ đa số) vs quadtree/octree (động hơn)
   - Tối ưu quan trọng nhất MMO — không AOI thì băng thông O(n²)
   - **Bài tập + blog post:** "Implementing Area of Interest in a Go MMO server: 70% bandwidth reduction"
4. **Agones + Open Match:** Google open source — quản lý fleet game server stateful trên K8s. Combo chuẩn ngành 2026 — đặc biệt mạnh nếu kết hợp với K8s skill ở Tier 1
5. **Anti-cheat patterns:**
   - Authoritative server: KHÔNG tin client
   - Validate mọi action: tốc độ di chuyển, cooldown, tầm đánh, tài nguyên đủ
   - Speedhack (distance/tick), teleport (sanity check), duplication (idempotency + transaction), packet replay (nonce/sequence), bot detection (behavioral pattern)
   - Shadow ban + honeypot
6. **Engineering blogs phải đọc:** Riot Games tech blog (series "Running online services" rất hay), Discord blog (scale Elixir/Rust, Cassandra→Scylla migration), EVE Online (single-shard MMO), Roblox. **GDC talks YouTube** free: search "GDC networking", "Overwatch netcode", "Halo networking"

**Signal thu được:**
- Match perfect VNG Games JD — interview xác suất pass cao nhất
- OSS: `go-game-ws` (Go WebSocket framework cho game với AOI helper built-in)
- Blog series về game backend

## 4.2. Fintech/Payment (nếu nhắm MoMo / VNPay / Techcombank / Cake by VPBank)

**Là gì:**
- Double-entry bookkeeping (ledger system)
- Idempotent payment processing (bạn đã có nền với PayOS/VietQR)
- 3DS, EMVCo, PCI-DSS compliance khái niệm
- Reconciliation (đối soát) với bank
- Fraud detection patterns
- High-volume transaction processing
- Distributed transactions cho money movement (Saga + Outbox — bạn đã có)
- Audit log bất biến + compliance reporting

**Tại sao bạn cần:**
- MoMo, VNPay, Techcombank Tech, Cake by VPBank — lương top VN, ổn định, scale lớn thật
- Bạn đã có PayOS + VietQR integration → nền payment thực tế
- Fintech VN đang boom — nhiều cơ hội remote cho công ty SG/global

**Cách học/làm:**
1. **Sách:**
   - "Payments Systems in the U.S." (Carol Coye Benson) — payment infrastructure 101
   - Stripe Engineering Blog (chuẩn vàng payment engineering)
2. **Double-entry bookkeeping:** hiểu ledger system, debit/credit, journal entry — nền của mọi payment system. Mỗi giao dịch luôn balance (sum = 0)
3. **Reconciliation flow:** end-of-day matching giữa internal transaction log vs bank statement; xử lý mismatch (settled/unsettled/disputed)
4. **Fraud patterns:** velocity check (X lần trong Y phút), unusual amount, unusual location, device fingerprint, behavioral biometric
5. **PCI-DSS khái niệm:** không bao giờ store CVV; tokenize card data; encrypt PAN at rest; audit log
6. **Compliance VN:** NHNN, PCI-DSS Level 1 cho payment switch
7. **Áp dụng MMORPG:** game có in-game purchase real money → audit trail giao dịch, reconciliation với PayOS/VietQR, fraud check (nạp X lần trong Y phút)

**Signal thu được:**
- Bullet CV: "Designed payment integration with idempotent webhook handling, double-entry ledger for in-game currency, and reconciliation with PayOS/VietQR achieving 100% transaction accuracy"
- Blog: "Building idempotent payment webhooks: lessons from PayOS/VietQR integration"

## 4.3. Web3/Blockchain (nếu nhắm Sky Mavis / Krystal DeFi / blockchain space)

**Là gì:**
- Solidity smart contract development
- Ethereum/EVM ecosystem + Ronin chain specifics
- Web3 JS/Go SDK (web3.js, ethers.js, go-ethereum)
- Data indexing on-chain (event log → DB)
- IPFS/Arweave (decentralized storage)
- Wallet integration (MetaMask, WalletConnect)
- Cross-chain bridges + security implications

**Tại sao bạn cần:**
- **Sky Mavis Senior BE JD verified:** "Proficient in at least one modern backend language, ideally Go, Typescripts, Rust, **Solidity**"
- Krystal DeFi Hanoi: $2k-3k senior backend blockchain
- Niche cao, lương cạnh tranh
- Bạn có nền Go strong → học Solidity dễ hơn người khác

**Cách học/làm:**
1. **Solidity course:** Patrick Collins (CryptoZombies → Solidity course free trên YouTube)
2. **Foundry framework** (Rust-based, faster than Hardhat) — viết test smart contract bằng Solidity
3. **Project portfolio Web3:**
   - ERC-20 token deploy testnet
   - ERC-721 NFT với metadata
   - Simple DEX (Uniswap v2 fork)
   - Game item NFT marketplace
4. **Backend Web3 (sân nhà bạn):**
   - Indexer service: listen smart contract events → ghi DB → expose REST API
   - Đây chính xác là **Ronin Platform Backend Engineer JD** của Sky Mavis
5. **Security:** đọc Trail of Bits audit reports, Code4rena contest writeups — học common vulnerability (reentrancy, overflow, front-running)

**Signal thu được:**
- OSS smart contract + indexer
- Bullet CV: "Built blockchain data indexer service consuming Ronin chain events, exposing REST API for downstream services"

## 4.4. Data Engineering / ML Platform (nếu thích data-heavy)

**Là gì:**
- Apache Spark / Flink (distributed compute)
- Apache Airflow / Dagster / Prefect (orchestration)
- dbt (SQL transformation)
- Snowflake / BigQuery / Databricks (cloud DW)
- Apache Iceberg / Delta Lake / Hudi (open table formats — trend 2026)
- ML serving: vLLM, Triton, BentoML
- Feature store: Feast, Tecton

**Tại sao bạn cần:**
- Vietnam IT 2026: "AI/ML engineer earns up to 25% more" (Glassdoor 2026)
- ML Platform Engineer = niche cực hot, ít competition
- Bạn có nền RAG chatbot → leverage thành ML infra

**Cách học/làm:**
1. Vào sau khi đã có Kafka + ClickHouse pipeline ở Tier 1 (nền data đã có)
2. **Spark cơ bản:** PySpark batch processing, structured streaming
3. **Airflow:** viết DAG đầu tiên (extract Kafka → transform Spark → load Snowflake)
4. **dbt project:** model trên ClickHouse data warehouse của bạn
5. **ML serving:** deploy LLM bằng vLLM trên GPU rental (Vast.ai, Runpod)

**Signal thu được:**
- Bullet CV: "Built end-to-end ML platform: Kafka ingestion → Spark transformation → Feature store → ML serving with vLLM"

---

# TIER 5 — SOFT SKILLS & CAREER (GAP MÔI TRƯỜNG)

> Đây là gap KHÔNG học được bằng đọc sách + build solo — chỉ giải bằng môi trường thực tế. Vẫn list ra để bạn biết và chủ động tìm cơ hội luyện.

## 5.1. English Speaking + Technical Communication

**Là gì:** Trình bày kỹ thuật bằng tiếng Anh trôi chảy: kiến trúc, trade-off, design discussion, code review feedback.

**Tại sao bạn cần:**
- **NAB Innovation Centre JD verified:** "Strong English communication skills (both verbal & written), especially in the global software development environment"
- Sky Mavis, công ty quốc tế tại VN, remote global — English speaking là gateway
- Lương remote global gấp 2-3 lần lương VN cùng level
- CV bạn đã viết English tốt → reading + writing ổn; gap chính là speaking + listening

**Cách học/làm:**
1. **Shadowing 15-30 phút/ngày:** chọn lecture MIT/CMU/Andy Pavlo bạn đang xem cho phần technical study → vừa học CS vừa học English (1 công đôi việc)
2. **iTalki / Cambly tutor 2 buổi/tuần:** tập trung **chủ đề kỹ thuật** — mô tả kiến trúc MMORPG bằng English, giải thích Saga pattern, defend technical decision. Chính là tập phỏng vấn
3. **Tự thuyết trình:** quay video 10 phút bằng English mô tả 1 design doc của bạn → xem lại, sửa lỗi
4. **Mock interview tiếng Anh:** Pramp / interviewing.io — book session với người nước ngoài
5. **Mục tiêu IELTS speaking 6.5-7.0** trong 6-12 tháng nếu nhắm remote global

**Signal thu được:**
- Pass tech interview English ở Sky Mavis / NAB / remote global
- Talk tại Vietnam meetup bằng English

## 5.2. Mentoring + Code Review (cho người khác)

**Là gì:** Hướng dẫn junior, review code, giúp người khác hiểu vấn đề.

**Tại sao bạn cần:**
- **GitLab Senior framework EXPLICIT:** "Mentors others on best practices", "Acts as a Coach and Mentor to others"
- Senior promotion blocker #5 (verified): "Refuse to mentor" = mãi không lên
- Multiplier effect = output bạn + output người khác tốt hơn nhờ bạn → khái niệm core của senior

**Cách học/làm (khi chưa có team):**
1. **Mentor cộng đồng:** trả lời câu hỏi NestJS/Go/distributed systems trên Discord, Stack Overflow, Reddit. Mentorship là "two-way street" — dạy người khác chính là cách học sâu nhất + bằng chứng public
2. **Mentor PTIT junior:** trong trường — bạn năm 2 nhưng đã có production experience → có thể mentor năm 1
3. **Code review OSS:** chọn 1 repo bạn dùng (NestJS, BullMQ), review PR pending — không cần submit comment thật, làm bài tập
4. **Khi vào team:** chủ động nhận onboard người mới, viết tài liệu — con đường ngắn nhất tới "performing at senior level" trước khi có title

**Signal thu được:**
- Stack Overflow reputation cao trong niche
- Bullet CV: "Active mentor in Golang Vietnam / NestJS Vietnam Discord community"

## 5.3. Stakeholder Collaboration + PM Negotiation

**Là gì:** Làm việc với PM, designer, leadership — dịch requirement business thành solution kỹ thuật, negotiate scope, push back có cấu trúc.

**Tại sao bạn cần:**
- **GitLab Senior framework:** "Demonstrates knowledge about how their group and stage fit into the larger business" và "Able to suggest alternative solutions to customer problems"
- Senior thực sự = giao tiếp với non-tech, không chỉ code giỏi
- Solo dev = không có experience này

**Cách học/làm (khi chưa có team):**
1. **Trong part-time job (Mobifos JSC + Gamota):** chủ động hỏi gặp PM của họ, không chỉ tech lead
2. **Viết design doc cho non-tech audience:** mỗi tuần 1 lần, mô tả tech decision dưới góc nhìn business
3. **Pretend PM mode:** khi tự build feature MMORPG, viết requirement như PM đặt ra trước → tự argue lại với chính mình
4. **Disagree-and-commit** practice: có dữ liệu/lý do, không emotional. Mỗi quyết định kỹ thuật phải defend được bằng số

**Signal thu được:**
- Khi vào team thật, ramp lên nhanh phần này → senior performance

## 5.4. Negotiation + Career Navigation

**Là gì:** Kỹ năng có giá trị nhất nhưng ít người dạy: negotiate salary, offer evaluation, chuyển việc đúng thời điểm.

**Tại sao bạn cần:**
- 80% tăng thu nhập engineer giỏi đến từ **chuyển việc + negotiate**, không phải tăng nội bộ
- Tăng nội bộ phổ biến 5-15%/năm; chuyển việc + negotiate đúng → 20-50%
- Engineer giỏi negotiate yếu = nuôi ngân sách HR công ty bằng lương của mình

**Cách học/làm:**
1. **Trước khi có offer:**
   - KHÔNG nêu salary expectation trước — hỏi range vị trí trước
   - Nếu bị ép số: đưa range rộng dựa trên data (Glassdoor/NodeFlair/Vietnamworks), bắt đầu cao hơn mức chấp nhận 20%
   - Hiểu rõ comp package VN: base × 12 + tháng 13 (mặc định) + bonus + ESOP + benefits
2. **Khi nhận offer:**
   - KHÔNG accept ngay — "Cho tôi 24-48h" (chuẩn ngành, luôn ok)
   - Lấy offer bằng văn bản chi tiết
   - Counter base 10-20% nếu có cơ sở (scope + experience + data thị trường)
   - **Có offer thứ 2 trong tay** = đòn bẩy tốt nhất → phỏng vấn 3-5 nơi song song
   - ĐỪNG bluff offer không có — bị check là mất uy tín vĩnh viễn
3. **Khi reject:** lịch sự — chính người đó có thể tuyển bạn 2 năm sau

## 5.5. Phỏng vấn định kỳ — đo bằng thị trường

**Là gì:** Apply phỏng vấn dù KHÔNG định chuyển việc — chỉ để FEEDBACK thị trường.

**Tại sao bạn cần:**
- Đo skill khách quan + miễn phí nhất
- Biết market value thực sự của bạn
- Build network với recruiter
- Practice phỏng vấn — đậu chỉ là bonus

**Cách học/làm:**
1. Apply 5-10 công ty mỗi 6 tháng dù đang ở vị trí thoải mái
2. Pass 1-2 vòng đầu rồi từ chối lịch sự
3. Track tất cả phỏng vấn — câu hỏi nào trả lời không tốt → học lại

---

# BONUS: NHỮNG GÌ CLAUDE RECOMMEND THÊM

> Những thứ mà nhiều roadmap không đề cập nhưng giá trị cao theo kinh nghiệm engineering community.

## B.1. Đọc Production Code của OSS Lớn

**Là gì:** Không chỉ dùng OSS — đọc source code để học engineering style cấp cao.

**Tại sao:** Senior level reading happens trên production code thật. Pattern, abstraction, error handling, naming — bạn học được từ Redis, Postgres, Kubernetes nhiều hơn bất kỳ sách nào.

**Recommend đọc theo thứ tự:**
1. **Redis source code** (C, ~200K lines) — code nhỏ, beautiful, well-commented; đọc data structures (dict.c, ziplist.c, sds.c)
2. **Postgres docs (đọc như sách)** — postgresql.org/docs/current — coverage huyền thoại
3. **Kubernetes controllers** (Go) — pattern controller/reconciliation kinh điển
4. **NATS Go client** (mới hơn, modern Go) — code idiomatic
5. **Nginx source code** (C) — event loop + reverse proxy mẫu mực

## B.2. Maintain "Things Learned" Journal

**Là gì:** Viết 1-2 câu/ngày về điều bạn học được hôm nay.

**Tại sao:** Compound effect. Sau 1 năm = 365 insights bạn không quên. Không cần dài — chỉ cần đều.

**Cách làm:** `journal/2026-06-15.md` — 3 dòng "today I learned: 1. ... 2. ... 3. ...". Commit vào private repo. Review cuối quý.

## B.3. Side Projects với Constraints

**Là gì:** Build small projects với ràng buộc cố ý.

**Tại sao:** MMORPG là big project — sẽ vô tình copy pattern cũ. Small constrained project ép bạn học deep concept.

**Ý tưởng:**
- "Build a key-value store in Go handling 100k RPS with p99 <1ms"
- "Build a rate limiter library implementing 4 algorithms (token bucket, leaky bucket, fixed window, sliding window)"
- "Build a mini Kafka consumer rebalancer in Go"
- "Implement Raft in 500 lines" (extension của MIT 6.5840 Lab)
- "Build a job scheduler with exponential backoff + DLQ in 200 lines"

Mỗi project 1-2 tuần, 200-500 lines, có README + benchmark + blog post → OSS portfolio.

## B.4. Quarterly Career Review

**Là gì:** Như product review nhưng cho bản thân — 1 lần/quý.

**Cấu trúc:**
- Mục tiêu quý trước → đạt %?
- Skill nào tăng đáng kể?
- Skill nào bị plateau?
- Network mới expanded?
- Output public (blog/OSS/talk) đăng bao nhiêu?
- Mục tiêu quý tiếp + 3 metric cụ thể

Mở doc này ra cuối mỗi quý.

## B.5. Find a Mentor (Even Informal)

**Là gì:** 1 senior/staff engineer cho bạn 30 phút/tháng — không cần chính thức.

**Tại sao:** Câu hỏi đúng từ người đi trước tiết kiệm bạn 6 tháng học sai hướng. Mentor cũng học từ việc mentor.

**Cách tìm:**
- LinkedIn message senior VN bạn ngưỡng mộ — ngắn gọn, lịch sự, nêu rõ "30 phút/tháng, café/Zoom, hỏi câu cụ thể, không expect anything"
- Hầu hết senior love mentor 30 phút/tháng — bạn ngại nhiều hơn họ
- Sau 6 tháng, có thể "graduate" và tìm mentor mới level cao hơn

## B.6. Build a Personal Knowledge Management System

**Là gì:** Second brain — note-taking system bạn maintain lâu dài.

**Tool:** Obsidian (local-first, markdown, link giữa note — recommend), Notion, hoặc 1 Git repo `notes/`.

**Nguyên tắc (Zettelkasten đơn giản hóa):**
- **Atomic notes** — 1 note = 1 ý tưởng (không phải 1 chương sách)
- **Link giữa notes** — VACUUM Postgres → link MVCC → link Snapshot Isolation → link DDIA Ch.7
- **Write in your own words** — copy paste = không nhớ; viết lại bằng từ của mình mới retain
- **Spaced repetition cho concept khó:** Anki cho định nghĩa, công thức, bảng trade-off (vd "Isolation level nào dính phantom?"). 15-20 phút/ngày × 2 tháng = ~500 card vững

## B.7. Public Speaking Practice — Bắt Đầu Nhỏ

**Là gì:** Speak tại meetup, dù nhỏ.

**Tại sao:** Force structured thinking ở mức độ khác hẳn viết. Phải hiểu rất sâu để dạy được trong 20 phút.

**Lộ trình:**
1. **Tháng 1-3:** đi meetup nghe, network với speaker
2. **Tháng 4-6:** lightning talk 5 phút tại meetup nhỏ (Grokking Vietnam, NestJS VN, Golang VN)
3. **Tháng 7-12:** talk 20 phút full
4. **Năm 2+:** speak tại conference (Vietnam Web Summit, DevDay VN)

**Topic gợi ý từ kinh nghiệm bạn:** "Running an MMORPG backend for 14 months: lessons learned", "Saga + Outbox in production: a NestJS implementation".

## B.8. Pick ONE Niche to Be World-Class At

**Là gì:** Trong khi học breadth, có 1 niche bạn deeper hơn 99% người khác.

**Tại sao:** "Senior generalist" market crowded. "Senior + niche expert" = giá thị trường cao gấp 1.5-2 lần.

**Niche tiềm năng cho bạn (chọn 1):**
1. **Realtime game backend production** — nền có sẵn, blog series + OSS framework + GDC-grade talk → "go-to person" trong VN
2. **NestJS distributed patterns** — TS ecosystem có Outbox/Saga library tốt thiếu — bạn fill gap
3. **AI infra for game/realtime** — LLM gateway pattern cho realtime app — niche overlap mới hot
4. **Payment integration patterns VN** — PayOS/VietQR/VNPay/Momo integration là pain point thật, ít doc tiếng Anh

Mỗi niche cần ~2 năm tập trung để thành "world-class".

## B.9. Engineering Excellence Habits Hằng Ngày

**Là gì:** Quy tắc nhỏ nhưng compound:

- **`git diff` trước mọi commit** — chặn commit nhầm
- **Conventional Commits 100%** — `feat:`, `fix:`, `refactor:`, etc.
- **Pre-commit hook chuẩn:** lint + format + gitleaks + test fast
- **Dotfiles management** — repo `.dotfiles` công khai, sync máy mới trong 5 phút
- **Shell aliases cho thao tác lặp lại** — `gst` cho `git status`, `gc` cho `git commit`, etc. → tiết kiệm hàng giờ/tuần
- **Personal `.bashrc/.zshrc` repo** — version controlled
- **PR template + CODEOWNERS** trong repo team
- **Branch protection on main** — không direct push, yêu cầu ≥1 review + CI pass
- **Đặt billing alarm $5 ngay ngày đầu** mọi cloud account

## B.10. Time Tracking 1 Tuần

**Là gì:** Track CHÍNH XÁC thời gian bạn dùng 1 tuần (Toggl, RescueTime).

**Tại sao:** Eye-opening. Hầu hết engineer nghĩ họ code 6h/ngày nhưng thực ra ~2h. Còn lại: meeting, Slack, "research", deep thinking, distraction. Biết thực tế = optimize được.

**Cách làm:** 1 tuần track mọi thứ → review cuối tuần → identify time leaks → tuần sau optimize.

## B.11. Đăng Ký Online Course Cohort-Based

**Là gì:** Course có deadline, peer cohort, instructor — không phải video learning đơn lẻ.

**Tại sao:** Structured learning + peers >> solo learning. Deadline ép progress.

**Recommendation:**
- **Bradfield CS** (bradfieldcs.com) — courses chuyên CS fundamentals, computer architecture, distributed systems. Đắt nhưng giá trị
- **Recurse Center** (recurse.com) — 6-12 tuần remote retreat cho engineer cải thiện. Free. Apply competitive
- **MIT Missing Semester** (missing.csail.mit.edu) — free YouTube, các kỹ năng "trường không dạy" (shell, git, vim, debugger, version control deep)

## B.12. Track "Cái Tôi Chưa Biết" (Learning Backlog)

**Là gì:** Maintain list "thuật ngữ/concept mới gặp nhưng chưa hiểu sâu" — backlog học liên tục.

**Tại sao:** Não tự nhiên skip cái không hiểu khi đọc. Ghi xuống ép quay lại học.

**Format:** `unknown.md` trong second brain. Mỗi item: thuật ngữ, gặp ở đâu, ưu tiên (P0/P1/P2), follow-up resource. Review tuần.

Ví dụ entry: "**CRDT** (Conflict-free Replicated Data Types) — gặp ở DDIA Ch.5 mention; chưa hiểu cách hoạt động; P1; resource: paper Shapiro 2011 + Redis docs CRDT support"

## B.13. Quarterly "Boring Day" — Reflect, Not Code

**Là gì:** 1 ngày/quý KHÔNG code — chỉ đọc lại CV, journal, design doc, postmortem. Reflect.

**Tại sao:** Engineer giỏi code nhưng không reflect → đi vòng tròn. Reflect tạo course correction.

**Việc làm:**
- Đọc lại CV — bullet nào còn đúng? Nâng cấp bullet nào?
- Đọc lại postmortem — pattern lỗi lặp lại?
- Đọc lại design doc — quyết định nào hối tiếc?
- Update career goal cho quý tới
- 1 ngày này tạo giá trị nhiều hơn 1 tuần code thuần

## B.14. Newsletter Subscribe (Curated)

Subscribe và đọc đều đặn (15 phút/ngày):
- **ByteByteGo** (Alex Xu) — system design tuần
- **Pragmatic Engineer** (Gergely Orosz) — career + industry insider
- **DevOps Weekly** — DevOps news curated
- **Postgres Weekly**, **Node Weekly**, **Golang Weekly** — language ecosystem
- **The New Stack** — cloud-native trends
- **Last Week in AWS** (Corey Quinn) — AWS news với humor

## B.15. Build Public Portfolio Site (1 Trang)

**Là gì:** 1 trang web cá nhân `dangph.dev` (domain riêng ~$10/năm) — không phải Notion/dev.to.

**Tại sao:** Own domain = own brand. Recruiter google "Phạm Hải Đăng backend" → tìm thấy site bạn = signal thiết lập từ đầu.

**Stack:** Astro / Hugo static site → deploy Cloudflare Pages free.

**Content:**
- Above-the-fold: tagline + portfolio button + blog button
- About: 1 đoạn ngắn
- Projects: pin 3 (MMORPG live demo + 2 OSS modules)
- Blog: 12 posts
- Talks: list speaking (nếu có)
- Contact: email + LinkedIn + GitHub

---

# APPENDIX

## A.1. CV Bullet Transformation Samples

Công thức bullet senior: **Action verb + What + How (technical detail) + Measurable impact + Trade-off/scale context**.

| Before | After (senior-level) |
|---|---|
| "Used Saga + Outbox pattern for distributed transactions — 0% partial-failure" | "Designed orchestration-based Saga with transactional Outbox for cross-service workflows (purchase, trade, mail), guaranteeing eventual consistency across 4 services and 8 databases; eliminated dual-write hazard, achieving 0 partial-failure incidents across ~100K transactions over 14 months; documented in ADR-0001 with alternatives considered (2PC, eventual-consistency-naive, CDC) and trade-offs accepted" |
| "Migrated game loop from Socket.IO to Go/Protobuf — 60% payload reduction" | "Led migration of realtime game loop from NestJS/Socket.IO to Go with raw WebSocket + Protobuf + NATS after pprof profiling identified JSON serialization and event-loop blocking as primary p99 contributors; reduced payload ~60%, cut p99 from Xms → Yms, increased single-node CCU N → M; executed as 2-week dark launch (parallel-run shadow traffic) before cutover; documented in ADR-0002 with rollback plan" |
| "Optimized data access with indexing and caching — 70% latency reduction" | "Reduced read p95 latency ~70% (Xms → Yms) by establishing query-profiling discipline: enabled slow query log, identified top 10 offenders via pt-query-digest, added 6 composite indexes (verified with EXPLAIN ANALYZE), introduced cache-aside layer with jittered TTL to prevent stampede; established institutional process — every PR touching DB requires EXPLAIN ANALYZE in description" |

**Bullet nên THÊM (sau khi làm migration plan):**
- "Authored 14 Architecture Decision Records (ADRs) and 5 design docs capturing alternatives considered and trade-offs accepted"
- "Designed DR procedure with RTO=30min, RPO=1hr, validated via quarterly restore drills across MySQL, Postgres, MongoDB, Redis"
- "Conducted quarterly chaos engineering game days simulating Redis failure, RabbitMQ partition, pod kill — validating circuit breaker and Saga compensation under controlled chaos"
- "Established SLO framework (availability ≥99.5%, p99 ≤300ms) with multi-burn-rate alerting; reduced alert noise X% while improving real-incident MTTR"
- "Implemented canary deployment with Argo Rollouts and metric-based auto-rollback, reducing failed prod deploys from 5% to <1%"

## A.2. Resource List (Curated)

**Sách (theo thứ tự đọc):**
1. **Designing Data-Intensive Applications** — Kleppmann *(nền tảng #1)*
2. **Google SRE Book + SRE Workbook** — free tại sre.google/books
3. **System Design Interview Vol 1 & 2** — Alex Xu
4. **Database Internals** — Petrov
5. **Microservices Patterns** — Richardson
6. **Learning Domain-Driven Design** — Khononov
7. **Release It! 2nd ed** — Nygard
8. **Working Effectively with Legacy Code** — Michael Feathers
9. **The Pragmatic Programmer** — Hunt & Thomas
10. **Staff Engineer: Leadership Beyond the Management Track** — Will Larson *(đọc khi vào team, để biết đích sau senior)*
11. **OSTEP** — free *(OS, đọc theo nhu cầu)*

**Free Courses chất lượng đỉnh:**
- **MIT 6.5840 Distributed Systems** — pdos.csail.mit.edu/6.824
- **CMU 15-445 Database Systems** (Andy Pavlo) — Spring 2026 đang chạy
- **Kubernetes The Hard Way** (Kelsey Hightower, GitHub)
- **AWS SAA**: Adrian Cantrill hoặc Stephane Maarek + Tutorials Dojo
- **MIT Missing Semester** — missing.csail.mit.edu

**Blog/Newsletter:**
- **ByteByteGo** (Alex Xu) — system design tuần
- **Pragmatic Engineer** (Gergely Orosz) — career + industry insider
- Engineering blogs: Riot Games, Discord, Cloudflare, Netflix, Uber, Stripe, **GitLab handbook**
- **jepsen.io/analyses**, **gafferongames.com**, **use-the-index-luke.com**, **brendangregg.com**, **martinfowler.com**

**Cộng đồng VN:**
- **Grokking Vietnam** — chuyên system design + paper reading (hợp phase học)
- Golang Vietnam, NestJS Vietnam, Vietnam DevOps
- GDG Hanoi meetups

## A.3. Vietnam Career Landscape (verified 2026)

**Số liệu thị trường (Vietnam IT Salary Report 2025-2026):**
- Backend median VN: ~22.5M VND/tháng, range 10-70M
- **Backend high seniority: ~54.9M VND/tháng**
- Tech Lead: median 51.8M VND
- IT Manager: 50.25M VND
- CTO/CIO/VPoE: 101.25M VND
- Senior backend HCMC: ~38-84M VND phổ biến, top >100M
- Senior HN: ~10-15% thấp hơn HCMC
- Senior remote công ty nước ngoài: $2,800-4,500+ (>100M VND)
- Senior remote global (US/EU): $4-8k+

**Tier S — Unicorn (top fit cho bạn):**

| Công ty | Office | Lý do match | JD requirement verified |
|---|---|---|---|
| **VNG Games** | HCMC + HN | Background MMORPG khớp 100% — Võ Lâm Truyền Kỳ cùng dòng | "4+ years Go; SQL+NoSQL (MySQL/MongoDB/Redis); REST/WebSocket; Kafka + event-driven; Prometheus/Grafana observability; cloud" |
| **VNPay** | HN office lớn | Lương top + ngay HN + payment domain bạn có nền | 2000 engineers, fintech-focused, modern stack |
| **MoMo** | HCMC | Lương top VN, scale millions DAU | Strong backend + payment + fraud + scale |
| **Tiki** | HCMC | E-commerce, engineering blog public | Modern stack, mature engineering |
| **Sky Mavis** (Axie/Ronin) | HCMC | Gaming + Web3 crossover | "Go, Typescripts, Rust, Solidity" — Web3 niche |

**Tier A — Banking tech:**
- Techcombank Tech (HN), VPBank Tech, MB Bank tech, **Cake by VPBank** — lương rất tốt, modern stack, scale lớn
- Verified hiring backend Java/Spring + Kafka + microservices + Azure/AWS

**Tier B — Game studio:**
- VNG Games, Garena Vietnam, Gameloft VN, Hiker Games, Topebox, Sky Mavis

**Tier C — Remote công ty nước ngoài (lương đô):**
- WeWorkRemotely, Working Nomads, RemoteOK
- Agency: Toptal, Turing, Andela
- Yêu cầu: English + tự kỷ luật làm việc lệch giờ

**Tier D — Outsource lớn:**
- FPT Software, KMS Technology, NashTech — pad ban đầu nếu cần income, không phải đích senior lâu dài

**Job boards VN tốt nhất:**
- **ITviec** (itviec.com) — chất lượng cao, vetted
- **TopCV** (topcv.vn) — coverage rộng
- **VietnamDevs** (vietnamdevs.com) — chuyên engineer, English-speaking jobs
- **LinkedIn Vietnam** — recruiter inbound
- **Glassdoor Vietnam** — interview reviews

## A.4. Common Mistakes — TRÁNH

**Anti-patterns học tập:**
1. **Tutorial hell** — 10h video K8s < 1h tự dựng cluster vỡ. Quy tắc 1h xem → 2h tay
2. **Sưu tầm tool** — thêm Istio + Vault + Flink chỉ để "có trên CV" = distributed monolith của CV
3. **Học rộng cùng lúc** — 5 cái mỗi thứ 20% = 0 cái dùng được
4. **Bỏ qua lý thuyết vì "thực chiến"** — chính là nguyên nhân plateau hiện tại
5. **Đợi sẵn sàng mới phỏng vấn** — không bao giờ cảm thấy sẵn sàng. Phỏng vấn = đo lường
6. **Hy sinh trường** — GPA 3.3 giữ được; bằng PTIT là visa/bảo lãnh sau này
7. **Burnout** — bạn đang ở vùng nguy cơ. Ngủ ≥7h, 1 ngày/tuần không code

**Senior promotion blockers (audit chính mình — verified):**

| # | Blocker | Áp với bạn? |
|---|---|---|
| 1 | Stuck IC mode — không multiplier | ⚠️ Solo nên chưa luyện |
| 2 | Avoid ambiguity — chờ ticket rõ | ⚠️ Cần luyện qua Tier 2.10 |
| 3 | No measurable business impact | ✅ Tốt — bạn có số |
| 4 | Bad communicator — code giỏi không doc | ⚠️ Solo nên chưa luyện → Tier 0.1 |
| 5 | Refuse to mentor | ⚠️ Chưa có cơ hội → Tier 5.2 |
| 6 | Tech-focused, ignore people | ⚠️ Solo nên chưa luyện → Tier 5.3 |
| 7 | Never disagree up | ⚠️ Chưa có cơ hội thật |
| 8 | Own output not outcome | ✅ Tốt — bạn có "live 14 tháng" |
| 9 | Knowledge silo — người duy nhất hiểu module | ⚠️ Solo nên 100% silo |
| 10 | Give up at plateau | ⚠️ Đang ở plateau — quyết định ở đây |

Phổ biến nhất ở solo dev VN: #1, #2, #4, #5, #6, #9. **Lý do mục tiêu cuối lộ trình phải là "vào team" — môi trường giải quyết 6/10 blocker tự nhiên.**

## A.5. Việc Cụ Thể Tuần Này (Quick Wins)

1. Đặt mua/tải **DDIA**, đọc Ch.5 (Replication), ghi note đầu tiên trong Obsidian/Notion
2. Cấu hình **Winston** thành structured JSON logging có `trace_id` placeholder (chuẩn bị OTel)
3. Dựng **Loki + Promtail** bằng docker-compose trên 1 VPS, đổ log 2 services, query trong Grafana
4. Tạo repo `adr/` — viết **ADR-0001 "Why we use Outbox pattern"** (viết lại quyết định cũ — luyện viết không rủi ro)
5. Mua domain `dangph.dev` (~$10/năm) — đặt landing page tạm thời, plan blog Astro
6. Review **5 PR đã merge** gần đây của 1 OSS repo bạn dùng (đọc, không comment) — luyện code review eye
7. Giải **5 bài NeetCode** đầu (arrays & hashing)
8. **Subscribe ByteByteGo + Pragmatic Engineer newsletter** — bắt đầu reading habit
9. Lên lịch cố định calendar: **60-90 phút buổi sáng học lý thuyết** trước mọi thứ khác
10. Bắt đầu file `journal/today.md` — viết 3 dòng "today I learned"

---

# TÓM TẮT TƯ TƯỞNG

**Chẩn đoán plateau hiện tại:** Bạn không thiếu năng lực — bạn thiếu:
1. **Lý thuyết nền** để chuyển từ làm-theo-pattern sang suy-luận-từ-nguyên-lý → **Tier 2** (DDIA + 6.5840 + 15-445 + SRE Book)
2. **Bộ kỹ năng cloud-native** mà thị trường mặc định → **Tier 1** (K8s + AWS + Kafka + Tracing + Loki + Terraform)
3. **Kỹ năng nền không phải tech** (writing, code review, ambiguity, legacy) → **Tier 0 + 5**
4. **Môi trường team** để luyện phần senior phi-kỹ-thuật → outcome dài hạn
5. **Signal công khai** (blog/OSS/ADR/postmortem/mock) → **Tier 0.4**

**4 nguyên tắc quan trọng nhất:**

1. **Plateau là dấu hiệu sắp đột phá, không phải hết potential.** Đảo tỷ lệ build/đọc từ 95/5 → 50/50. DDIA + MIT 6.5840 + CMU 15-445 + SRE Book là 4 thứ giá trị nhất nhét vào não năm tới.

2. **Mọi thứ học PHẢI áp lên MMORPG trong 2 tuần.** Đừng học chay. Không đáp xuống dự án = sẽ quên trong 1 tháng.

3. **Output ra ngoài ngay tuần này.** ADR + design doc + postmortem + blog — không cần hoàn hảo. Public signal compound như lãi kép. Đây là cách solo dev convert kinh nghiệm thành signal thị trường tin được.

4. **Mục tiêu phase cuối phải là VÀO TEAM engineering thật ≥10 người.** Technical bạn sẽ đủ; phần thiếu là 6/10 promotion blocker chỉ môi trường thật chữa được — VNG Games là target match nhất cho background.

---

*Verified với:*
- *JD senior backend thực tế VN: VNG Games (Senior BE), Sky Mavis (Senior BE Ronin Platform), Homebase VN, ANDPAD, NAB Innovation Centre, Krystal DeFi Hanoi, fintech*
- *JD senior backend global 2026: Grafana Labs, Accenture, Varicent, Close, OpenAI, DuckDuckGo*
- ***GitLab Senior/Staff Backend Career Framework công khai*** (handbook.gitlab.com)
- *Engineering ladder Amazon SDE I/II/III, Microsoft L62-68+, Google L3-L6+*
- *Interview trends 2026: DesignGurus, ByteByteGo, Pragmatic Engineer*
- *Google SRE Book/Workbook, MIT 6.5840 Spring 2026, CMU 15-445 Spring 2026*
- *Vietnam IT Market Report 2025-2026, NodeFlair Salary Report*

*Cập nhật: 06/2026.*