# Idempotency — Hướng Dẫn Toàn Diện

---

## Mục Lục

1. [Idempotency là gì?](#1-idempotency-là-gì)
2. [Tại sao cần Idempotency?](#2-tại-sao-cần-idempotency)
3. [Các trường hợp cần Idempotency](#3-các-trường-hợp-cần-idempotency)
4. [Khi nào KHÔNG cần Idempotency?](#4-khi-nào-không-cần-idempotency)
5. [Các kỹ thuật thực hiện Idempotency](#5-các-kỹ-thuật-thực-hiện-idempotency)
   - [5.1 Database Constraint (UNIQUE / PRIMARY KEY)](#51-database-constraint-unique--primary-key)
   - [5.2 Idempotency Key (Client-generated Key)](#52-idempotency-key-client-generated-key)
   - [5.3 State-based Idempotency (Kiểm tra trạng thái)](#53-state-based-idempotency-kiểm-tra-trạng-thái)
   - [5.4 Event ID / Message ID Deduplication](#54-event-id--message-id-deduplication)
   - [5.5 Transaction ID / Request ID Tracking](#55-transaction-id--request-id-tracking)
   - [5.6 Conditional Writes (Check-then-Act)](#56-conditional-writes-check-then-act)
   - [5.7 Upsert (INSERT OR UPDATE)](#57-upsert-insert-or-update)
   - [5.8 Optimistic Locking / Version Check](#58-optimistic-locking--version-check)
   - [5.9 Distributed Locking (Mutex)](#59-distributed-locking-mutex)
   - [5.10 At-least-once + Deduplication Store](#510-at-least-once--deduplication-store)
6. [So sánh tổng hợp các kỹ thuật](#6-so-sánh-tổng-hợp-các-kỹ-thuật)
7. [Quyết định chọn kỹ thuật theo use case](#7-quyết-định-chọn-kỹ-thuật-theo-use-case)
8. [Checklist triển khai Idempotency](#8-checklist-triển-khai-idempotency)
9. [Các Anti-pattern cần tránh](#9-các-anti-pattern-cần-tránh)

---

## 1. Idempotency là gì?

**Idempotency** (tính bất biến khi lặp lại) là tính chất của một thao tác mà dù thực hiện **một lần hay nhiều lần**, kết quả cuối cùng đều **giống nhau**.

Định nghĩa toán học:

```
f(f(x)) = f(x)
```

Ví dụ trực quan:

| Thao tác | Idempotent? | Lý do |
|---|---|---|
| `DELETE /users/123` | ✅ Có | Lần 1 xoá được, lần 2 trả 404 — trạng thái cuối như nhau (user không tồn tại) |
| `PUT /users/123 {name: "An"}` | ✅ Có | Gọi nhiều lần vẫn set name = "An" |
| `POST /orders` | ❌ Không | Mỗi lần gọi tạo thêm một đơn hàng mới |
| `PATCH /account/balance += 100` | ❌ Không | Mỗi lần cộng thêm 100 |
| `GET /users/123` | ✅ Có | Đọc thuần tuý, không thay đổi state |

> **Lưu ý quan trọng:** Idempotency **không** có nghĩa là không có side effect. Nó chỉ đảm bảo rằng **kết quả cuối cùng nhất quán** dù thao tác được thực hiện bao nhiêu lần.

---

## 2. Tại sao cần Idempotency?

### 2.1 Mạng và hệ thống phân tán vốn không đáng tin cậy

Trong thực tế, các tình huống sau xảy ra **thường xuyên**:

- **Timeout:** Client gửi request, server xử lý xong nhưng response bị mất → client retry → tạo duplicate.
- **Network partition:** Request đến server nhưng response không về được → client không biết đã thành công chưa.
- **Server crash giữa chừng:** Server nhận request, xử lý một phần, crash trước khi trả về → state không nhất quán.
- **Load balancer retry:** LB tự động retry khi không nhận được response → request chạy 2 lần.
- **Message queue redelivery:** Kafka, RabbitMQ, SQS đều có cơ chế "at-least-once delivery" — một message có thể được xử lý nhiều hơn một lần.

### 2.2 Hậu quả khi không có Idempotency

- **Giao dịch tài chính bị nhân đôi:** Khách hàng bị trừ tiền 2 lần cho cùng một đơn hàng.
- **Email marketing gửi spam:** Cùng một email promotional bị gửi 3 lần cho cùng một người.
- **Đơn hàng trùng lặp:** Kho hàng bị thiếu do hệ thống đặt hàng 2 lần với supplier.
- **Inconsistent state:** Một phần hệ thống nghĩ transaction thành công, phần khác nghĩ thất bại.
- **Dữ liệu corruption:** Các bản ghi bị tạo thừa, khó reconcile về sau.

### 2.3 Các nguyên tắc thiết kế hiện đại đòi hỏi Idempotency

- **Microservices:** Giao tiếp qua network, retry là bắt buộc để đảm bảo reliability.
- **Event-driven architecture:** Consumer phải xử lý được duplicate events.
- **Saga pattern:** Compensating transaction cần idempotent để rollback an toàn.
- **CQRS / Event sourcing:** Event được replay nhiều lần khi rebuild state.
- **Cloud-native:** AWS, GCP, Azure đều recommend thiết kế idempotent endpoints.

---

## 3. Các trường hợp cần Idempotency

### 3.1 API Endpoint nhận Payment / Giao dịch tài chính

**Tại sao cần:** Mất tiền hai lần là hậu quả nghiêm trọng nhất. Client hay mobile app thường tự retry khi gặp lỗi mạng.

**Ví dụ:** Stripe, PayPal, VNPay đều yêu cầu idempotency key cho mọi payment API call.

```
POST /payments
Idempotency-Key: uuid-abc-123
{ "amount": 100000, "currency": "VND" }
```

Nếu request này được gửi 3 lần (do retry), chỉ 1 payment được tạo.

---

### 3.2 Order / Booking Creation

**Tại sao cần:** Double submission là vấn đề kinh điển trong e-commerce. User bấm "Đặt hàng" 2 lần hoặc browser tự submit 2 lần → 2 đơn hàng được tạo.

**Ví dụ:** Shopee, Tiki, Grab Food đều cần đảm bảo một session checkout chỉ tạo 1 đơn hàng.

---

### 3.3 Message/Event Consumer (Kafka, SQS, RabbitMQ)

**Tại sao cần:** Hệ thống message queue hầu hết đảm bảo **at-least-once delivery**, không phải exactly-once. Consumer phải tự xử lý duplicate message.

**Ví dụ:**
- Kafka consumer xử lý event "UserRegistered" → gửi welcome email. Nếu consumer crash sau khi gửi email nhưng trước khi commit offset → event được reprocess → gửi email lần 2.

---

### 3.4 Webhook Receiver

**Tại sao cần:** Bên gửi webhook (Stripe, GitHub, Shopify) thường retry nếu không nhận được HTTP 2xx trong timeout. Cùng một event có thể được gửi nhiều lần.

**Ví dụ:** Webhook `payment.succeeded` từ Stripe có thể đến 2-3 lần nếu server của bạn phản hồi chậm.

---

### 3.5 Distributed Saga / Compensating Transactions

**Tại sao cần:** Trong Saga pattern, nếu một bước thất bại, hệ thống cần rollback bằng cách chạy compensating action. Compensating action cũng có thể được gọi nhiều lần.

**Ví dụ:**
- Booking flight → Book hotel → Charge payment. Nếu payment thất bại → cancel hotel booking. Nếu cancel hotel bị retry → phải idempotent để không cancel một booking đã được cancel.

---

### 3.6 Scheduled Jobs / Cron Jobs

**Tại sao cần:** Cron job có thể chạy overlap nếu instance trước chưa xong mà instance mới đã khởi động. Hoặc khi scale horizontally, nhiều worker cùng pick up job.

**Ví dụ:** Job gửi invoice hàng tháng, job sync dữ liệu, job cleanup expired sessions.

---

### 3.7 External API Integration (3rd party)

**Tại sao cần:** Khi gọi API của bên thứ ba (gửi SMS, gửi email, tạo record CRM), nếu call thất bại và retry → có thể tạo duplicate ở phía đối tác.

**Ví dụ:** Gọi Twilio gửi OTP, gọi SendGrid gửi email transactional.

---

### 3.8 File Upload / Data Import

**Tại sao cần:** Quá trình upload lớn có thể bị ngắt giữa chừng và resume. Import dữ liệu từ file CSV có thể được chạy lại nếu lần đầu thất bại.

**Ví dụ:** Import 100k records từ CSV, nếu job crash ở record 50k và restart → phải tránh duplicate 50k record đầu.

---

### 3.9 Database Migration / Data Backfill

**Tại sao cần:** Migration script có thể được chạy nhiều lần do lỗi hoặc do deploy rollback. Script phải an toàn khi chạy lại.

**Ví dụ:** Script backfill field `normalized_phone` cho 10 triệu user record.

---

### 3.10 Cache Invalidation / Cache Warm-up

**Tại sao cần:** Thundering herd problem — nhiều request cùng lúc phát hiện cache miss và cùng gọi DB. Cần đảm bảo chỉ 1 request rebuild cache.

---

### 3.11 User Registration / Account Creation

**Tại sao cần:** Network timeout có thể khiến user submit form 2 lần, tạo 2 tài khoản với cùng email.

---

### 3.12 Inventory Reservation / Stock Management

**Tại sao cần:** Race condition khi nhiều user cùng mua sản phẩm cuối cùng. Retry logic có thể reserve gấp đôi số lượng.

---

## 4. Khi nào KHÔNG cần Idempotency?

| Trường hợp | Lý do không cần |
|---|---|
| Read-only operations (`GET`, `SELECT`) | Không thay đổi state, tự nhiên idempotent |
| Internal in-memory operations không persist | Không có side effect bền vững |
| Operations đã atomic và không có retry | Không có khả năng duplicate |
| Analytics/logging append-only | Duplicate log thường chấp nhận được (không critical) |
| Test/dev environment throwaway data | Không ảnh hưởng production |

> **Nguyên tắc:** Nếu thao tác **thay đổi state** và có khả năng **được gọi nhiều hơn một lần** (do retry, duplicate message, user action), hãy thiết kế idempotent.

---

## 5. Các kỹ thuật thực hiện Idempotency

---

### 5.1 Database Constraint (UNIQUE / PRIMARY KEY)

**Cơ chế hoạt động:**

Dùng UNIQUE constraint ở database layer để từ chối bản ghi duplicate. Đây là lớp phòng thủ cuối cùng và mạnh nhất.

```sql
-- Ví dụ: Bảng payments với unique constraint trên payment_reference
CREATE TABLE payments (
    id BIGSERIAL PRIMARY KEY,
    payment_reference VARCHAR(255) UNIQUE NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    status VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Insert lần 1: thành công
INSERT INTO payments (payment_reference, amount, status)
VALUES ('ref-abc-123', 100000, 'completed');

-- Insert lần 2: lỗi UNIQUE VIOLATION → safe duplicate prevention
INSERT INTO payments (payment_reference, amount, status)
VALUES ('ref-abc-123', 100000, 'completed');
-- ERROR: duplicate key value violates unique constraint
```

**Ưu điểm:**

- ✅ Đơn giản, ít code
- ✅ Đảm bảo tuyệt đối — không thể bypass ở application layer
- ✅ Không cần logic phức tạp ở service layer
- ✅ Database đã optimize cho constraint check

**Nhược điểm:**

- ❌ Phải xử lý exception ở application layer
- ❌ Không lưu được response của lần đầu để trả về cho lần retry (chỉ biết là duplicate)
- ❌ Không áp dụng được cho cross-service operations
- ❌ Với distributed database (sharding), UNIQUE constraint có thể phức tạp hơn

**Khi nào dùng:**

- Đây là lớp bảo vệ cuối cùng và **nên luôn có** khi business logic không cho phép duplicate
- User registration (unique email)
- Payment reference number
- Order number
- Bất kỳ business entity nào có natural unique key

**Khi nào KHÔNG dùng:**

- Khi cần trả về response của lần xử lý đầu tiên (không phải chỉ báo lỗi)
- Khi không có natural unique key cho business entity
- Khi cần idempotency ở tầng distributed / cross-service

**Ví dụ thực tế:**

```python
def create_payment(payment_reference: str, amount: float):
    try:
        payment = Payment.objects.create(
            payment_reference=payment_reference,
            amount=amount,
            status='completed'
        )
        return {"status": "created", "id": payment.id}
    except IntegrityError:
        # Duplicate — trả về idempotent response
        existing = Payment.objects.get(payment_reference=payment_reference)
        return {"status": "already_exists", "id": existing.id}
```

---

### 5.2 Idempotency Key (Client-generated Key)

**Cơ chế hoạt động:**

Client tự sinh một unique key (thường là UUID v4) và gửi kèm trong request header hoặc body. Server lưu key này cùng response. Nếu cùng key đến lần 2, server trả về response đã cache mà **không xử lý lại**.

```
POST /api/payments
Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000
Content-Type: application/json

{
  "amount": 100000,
  "currency": "VND",
  "recipient_id": "user_456"
}
```

**Flow xử lý server:**

```
Nhận request với Idempotency-Key K
    │
    ▼
Lookup K trong idempotency store
    │
    ├─ FOUND ──→ Trả về cached response (HTTP 200 hoặc status gốc)
    │
    └─ NOT FOUND ──→ Xử lý business logic
                         │
                         ▼
                   Lưu {K: response} vào store (với TTL)
                         │
                         ▼
                   Trả về response
```

**Lưu ý về race condition:**

```
Client A gửi request với key K
Client A gửi lại key K (retry ngay lập tức)
    → Cả 2 request cùng lookup: NOT FOUND
    → Cả 2 xử lý business logic
    → DUPLICATE!
```

Cần dùng distributed lock hoặc `INSERT ... ON CONFLICT DO NOTHING` để tránh race condition:

```sql
-- PostgreSQL: Atomic check-and-insert
INSERT INTO idempotency_keys (key, status, created_at)
VALUES ($1, 'processing', NOW())
ON CONFLICT (key) DO NOTHING
RETURNING id;

-- Nếu RETURNING trả về null → key đã tồn tại → wait và lấy cached response
```

**Schema ví dụ:**

```sql
CREATE TABLE idempotency_keys (
    key VARCHAR(255) PRIMARY KEY,
    status VARCHAR(50) NOT NULL,  -- 'processing', 'completed', 'failed'
    request_hash VARCHAR(64),      -- Hash của request body để detect mismatch
    response_status INT,
    response_body JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL   -- TTL, ví dụ 24h
);
```

**Ưu điểm:**

- ✅ Trả về **đúng response gốc** cho retry → client nhận được kết quả nhất quán
- ✅ Áp dụng được cho bất kỳ operation phức tạp nào
- ✅ Transparent với business logic — có thể implement như middleware
- ✅ Industry standard (Stripe, Adyen, AWS đều dùng cách này)
- ✅ Client kiểm soát scope của idempotency (key per operation)

**Nhược điểm:**

- ❌ Phức tạp hơn — cần storage layer riêng cho idempotency keys
- ❌ Cần xử lý race condition khi concurrent retry
- ❌ Cần TTL strategy — key expire sau bao lâu?
- ❌ Storage overhead — cần lưu cả response
- ❌ Cần validate: nếu cùng key nhưng khác request body → 422 Unprocessable Entity

**Khi nào dùng:**

- Payment API, financial transactions
- Order creation, booking
- Bất kỳ mutation API quan trọng nào mà client cần retry-safe
- Khi cần trả về **đúng response gốc** cho lần retry

**Khi nào KHÔNG dùng:**

- GET requests (không cần)
- Internal service calls khi đã có cách idempotency khác
- Khi không có storage layer phù hợp (e.g., stateless lambda với cold start)

**Ví dụ thực tế (middleware):**

```python
class IdempotencyMiddleware:
    def __init__(self, app, store):
        self.app = app
        self.store = store  # Redis hoặc DB

    def __call__(self, request):
        key = request.headers.get('Idempotency-Key')
        if not key:
            return self.app(request)

        # Atomic: set NX (only if not exists)
        if self.store.set(f"idem:{key}", "processing", nx=True, ex=86400):
            # First time — process
            response = self.app(request)
            self.store.set(f"idem:{key}:response", response.serialize(), ex=86400)
            return response
        else:
            # Retry — return cached response
            cached = self.store.get(f"idem:{key}:response")
            if cached:
                return Response.deserialize(cached)
            else:
                # Still processing (concurrent request)
                return Response(status=409, body="Request in progress")
```

---

### 5.3 State-based Idempotency (Kiểm tra trạng thái)

**Cơ chế hoạt động:**

Trước khi thực hiện action, kiểm tra state hiện tại của entity. Nếu state đã ở trạng thái mong muốn rồi thì không làm gì (hoặc trả về success mà không xử lý lại).

```python
def approve_order(order_id: str):
    order = Order.get(order_id)

    # Idempotency check: đã approve rồi thì không làm gì
    if order.status == 'approved':
        return {"success": True, "message": "Already approved"}

    if order.status != 'pending':
        raise ValueError(f"Cannot approve order in status: {order.status}")

    # Business logic: chỉ chạy nếu status == 'pending'
    order.status = 'approved'
    order.approved_at = datetime.now()
    order.save()
    send_approval_email(order)

    return {"success": True, "message": "Order approved"}
```

**State machine approach:**

```
pending ──approve──→ approved ──ship──→ shipped ──deliver──→ delivered
    ↑                    │
    │                    └──cancel──→ cancelled
    └──retry approve (idempotent: already approved, return success)
```

**Ưu điểm:**

- ✅ Tự nhiên, dễ hiểu — code phản ánh business rules
- ✅ Không cần storage riêng cho idempotency
- ✅ Double-check business invariants
- ✅ Phù hợp với state machine / workflow design

**Nhược điểm:**

- ❌ Race condition: 2 concurrent request cùng check state → cùng thấy "pending" → cùng approve
- ❌ Không đủ nếu operation là append (không có state để check)
- ❌ Cần pessimistic/optimistic lock để tránh race condition
- ❌ Không cover được case "partial execution" (crash giữa chừng)

**Khi nào dùng:**

- Order lifecycle (pending → approved → shipped → delivered)
- User account status (active, suspended, deleted)
- Subscription status changes
- Workflow/process steps với rõ ràng trạng thái

**Khi nào KHÔNG dùng:**

- Append-only operations (không có state để check)
- Khi cần sub-millisecond performance (state check tốn thêm 1 DB read)
- Distributed system không có single source of truth cho state

**Ví dụ với locking:**

```python
def approve_order(order_id: str):
    with db.transaction():
        # SELECT FOR UPDATE: lock row để tránh race condition
        order = Order.select_for_update().get(order_id)

        if order.status == 'approved':
            return {"success": True, "already_processed": True}

        order.update(status='approved', approved_at=datetime.now())

    # Side effects ngoài transaction
    send_approval_email(order)
    return {"success": True}
```

---

### 5.4 Event ID / Message ID Deduplication

**Cơ chế hoạt động:**

Mỗi event/message mang theo một unique ID. Consumer lưu lại các ID đã xử lý. Trước khi xử lý, kiểm tra ID trong set đã xử lý.

```python
class OrderEventConsumer:
    def __init__(self, processed_events_store):
        self.store = processed_events_store  # Redis SET hoặc DB table

    def consume(self, event: dict):
        event_id = event['event_id']

        # Kiểm tra đã xử lý chưa
        if self.store.is_processed(event_id):
            logger.info(f"Skipping duplicate event: {event_id}")
            return

        # Xử lý event
        self.process_event(event)

        # Đánh dấu đã xử lý
        self.store.mark_processed(event_id, ttl=7*24*3600)  # giữ 7 ngày
```

**Redis implementation:**

```python
class RedisDeduplicationStore:
    def __init__(self, redis_client, key_prefix="processed_events"):
        self.redis = redis_client
        self.prefix = key_prefix

    def is_processed(self, event_id: str) -> bool:
        return self.redis.exists(f"{self.prefix}:{event_id}")

    def mark_processed(self, event_id: str, ttl: int = 86400):
        self.redis.setex(f"{self.prefix}:{event_id}", ttl, "1")
```

**SQS với Message Deduplication ID:**

```python
sqs.send_message(
    QueueUrl=queue_url,
    MessageBody=json.dumps(event),
    MessageDeduplicationId=event_id,  # SQS tự deduplicate trong 5 phút
    MessageGroupId="orders"
)
```

**Ưu điểm:**

- ✅ Phù hợp với event-driven architecture, message queue
- ✅ Consumer hoàn toàn stateless về business logic
- ✅ Có thể implement ở infrastructure layer (SQS FIFO tự handle)
- ✅ Flexible TTL cho deduplication window

**Nhược điểm:**

- ❌ Cần storage cho processed event IDs (có thể lớn theo thời gian)
- ❌ TTL phải đủ lớn để cover retry window của producer
- ❌ Nếu deduplication store fail → có thể xử lý duplicate
- ❌ Không cover distributed consumer race condition (cần atomic check-and-mark)

**Khi nào dùng:**

- Kafka / SQS / RabbitMQ consumer
- Webhook receiver (lưu webhook event ID)
- Event sourcing system
- Mọi async event processing

**Khi nào KHÔNG dùng:**

- Synchronous API calls (dùng idempotency key thay thế)
- Khi event không có unique ID (cần sinh ID trước khi gửi)
- Khi deduplication window quá ngắn so với retry window

---

### 5.5 Transaction ID / Request ID Tracking

**Cơ chế hoạt động:**

Tương tự Idempotency Key nhưng được sinh từ phía server dựa trên request context (không phải client-provided). Server track các request đang xử lý và đã hoàn thành.

```python
def process_payment(order_id: str, amount: float):
    # Request ID được tạo từ business context (không phải random)
    request_id = f"payment:{order_id}:{amount_cents}"

    existing = PaymentTransaction.get(request_id=request_id)
    if existing:
        return existing.to_response()

    # Xử lý mới
    with db.transaction():
        transaction = PaymentTransaction.create(
            request_id=request_id,
            order_id=order_id,
            amount=amount,
            status='pending'
        )
        result = payment_gateway.charge(amount)
        transaction.update(status='completed', gateway_ref=result.ref)

    return transaction.to_response()
```

**Ưu điểm:**

- ✅ Không phụ thuộc client — server tự tạo và quản lý
- ✅ Request ID có thể mang business meaning (traceable)
- ✅ Có thể dùng cho debugging và audit trail
- ✅ Không cần thêm header trong API

**Nhược điểm:**

- ❌ Cần xác định đúng "điều gì tạo nên uniqueness" của operation
- ❌ Khó áp dụng khi operation có thể hợp lệ với cùng parameters nhiều lần
- ❌ Cần storage để track các transactions

**Khi nào dùng:**

- Internal service-to-service calls
- Payment processing với business-meaningful reference
- Batch job tracking
- Audit log với traceability

**Khi nào KHÔNG dùng:**

- Khi user có thể hợp lệ tạo nhiều operation giống nhau (e.g., user mua cùng item nhiều lần)
- Khi không có natural business key

---

### 5.6 Conditional Writes (Check-then-Act)

**Cơ chế hoạt động:**

Thực hiện write operation kèm điều kiện. Nếu điều kiện không thoả, operation bị từ chối. Atomic ở database level.

```sql
-- Chỉ update nếu status vẫn là 'pending'
UPDATE orders
SET status = 'approved', approved_at = NOW()
WHERE id = $1 AND status = 'pending';

-- Kiểm tra affected rows
-- 0 rows affected → đã được xử lý rồi (idempotent)
-- 1 row affected → vừa xử lý thành công
```

**DynamoDB conditional write:**

```python
try:
    table.update_item(
        Key={'order_id': order_id},
        UpdateExpression='SET #status = :new_status',
        ConditionExpression='#status = :expected_status',
        ExpressionAttributeNames={'#status': 'status'},
        ExpressionAttributeValues={
            ':new_status': 'approved',
            ':expected_status': 'pending'
        }
    )
except ConditionalCheckFailedException:
    # Đã approve rồi → idempotent, không cần làm gì
    pass
```

**Ưu điểm:**

- ✅ Atomic — không cần lock riêng
- ✅ Database enforces the condition
- ✅ Tự nhiên với workflow/state machine
- ✅ Hiệu quả — chỉ 1 round trip DB

**Nhược điểm:**

- ❌ Khó phân biệt "condition failed vì đã xử lý" vs "condition failed vì state sai"
- ❌ Không cover partial execution (crash sau khi update DB nhưng trước khi gửi email)

**Khi nào dùng:**

- State transitions (pending → approved, reserved → cancelled)
- Kết hợp với optimistic locking
- DynamoDB, Cassandra, Redis operations
- Database-level atomic operations

---

### 5.7 Upsert (INSERT OR UPDATE)

**Cơ chế hoạt động:**

Thay vì INSERT, dùng UPSERT: nếu record đã tồn tại thì UPDATE thay vì tạo mới.

```sql
-- PostgreSQL: INSERT ON CONFLICT DO UPDATE
INSERT INTO user_preferences (userId, theme, language, updated_at)
VALUES ($1, $2, $3, NOW())
ON CONFLICT (userId)
DO UPDATE SET
    theme = EXCLUDED.theme,
    language = EXCLUDED.language,
    updated_at = NOW();

-- MySQL: INSERT ... ON DUPLICATE KEY UPDATE
INSERT INTO user_preferences (userId, theme, language)
VALUES (?, ?, ?)
ON DUPLICATE KEY UPDATE
    theme = VALUES(theme),
    language = VALUES(language);
```

**Ưu điểm:**

- ✅ Cực kỳ đơn giản và hiệu quả
- ✅ Atomic — không có race condition
- ✅ Không cần check-then-act
- ✅ Phù hợp cho PUT semantics (set to value, không phải delta)

**Nhược điểm:**

- ❌ Chỉ áp dụng khi operation là "set to value" (idempotent by nature)
- ❌ Không phù hợp với delta/increment operations (`amount += 100`)
- ❌ Cần careful về what to update vs what to preserve

**Khi nào dùng:**

- Sync/import data từ external source
- Configuration update (PUT semantics)
- Cache write-through
- Backfill operations
- Profile/settings update

**Khi nào KHÔNG dùng:**

- Increment/decrement operations
- Append operations (adding to array, counter++)
- Khi cần differentiate giữa create và update behavior

---

### 5.8 Optimistic Locking / Version Check

**Cơ chế hoạt động:**

Mỗi record có một `version` number. Khi update, phải kèm version hiện tại. Nếu version không khớp (ai khác đã update), operation bị reject.

```sql
-- Schema
CREATE TABLE accounts (
    id BIGINT PRIMARY KEY,
    balance DECIMAL(15,2),
    version INT DEFAULT 0
);

-- Read
SELECT id, balance, version FROM accounts WHERE id = 1;
-- Returns: id=1, balance=1000, version=5

-- Update (kèm version check)
UPDATE accounts
SET balance = 900, version = version + 1
WHERE id = 1 AND version = 5;

-- 0 rows affected → version conflict → retry hoặc fail
-- 1 row affected → thành công
```

**Ví dụ với JPA/Hibernate:**

```java
@Entity
public class Account {
    @Id
    private Long id;
    private BigDecimal balance;

    @Version  // Hibernate tự quản lý version
    private Integer version;
}

// Nếu 2 transactions cùng update → OptimisticLockException
```

**Ưu điểm:**

- ✅ Không block concurrent reads
- ✅ Detect stale reads và concurrent modification
- ✅ Phù hợp với high-read, low-write patterns
- ✅ Database-native với ETag / `If-Match` trong HTTP

**Nhược điểm:**

- ❌ Cần retry logic khi conflict
- ❌ Không phải idempotency theo nghĩa truyền thống — chống concurrent update, không chống retry
- ❌ Nếu retry không có idempotency key, vẫn có thể duplicate

**Khi nào dùng:**

- Kết hợp với các kỹ thuật khác để tránh lost update
- REST API với ETag + `If-Match` header
- Concurrent editing (document, inventory, balance)

**HTTP ETag pattern:**

```
GET /accounts/1
← ETag: "version-5"
← { "balance": 1000 }

PUT /accounts/1
→ If-Match: "version-5"
→ { "balance": 900 }

← 200 OK (version match, update success)
← 412 Precondition Failed (someone else updated first)
```

---

### 5.9 Distributed Locking (Mutex)

**Cơ chế hoạt động:**

Dùng distributed lock (Redis, ZooKeeper, etcd) để đảm bảo chỉ một instance xử lý một operation tại một thời điểm.

```python
import redis
from redlock import Redlock

dlm = Redlock([{"host": "redis-host", "port": 6379}])

def process_payment(payment_id: str):
    lock_key = f"payment_lock:{payment_id}"
    lock = dlm.lock(lock_key, 10000)  # Lock 10 giây

    if not lock:
        raise Exception("Could not acquire lock — another instance is processing")

    try:
        # Check nếu đã xử lý rồi
        payment = Payment.get(payment_id)
        if payment.is_processed():
            return payment.result

        # Xử lý
        result = do_process_payment(payment)
        payment.mark_processed(result)
        return result
    finally:
        dlm.unlock(lock)
```

**Ưu điểm:**

- ✅ Ngăn concurrent execution tuyệt đối
- ✅ Phù hợp cho critical sections trong distributed system
- ✅ Flexible — áp dụng được cho mọi loại operation

**Nhược điểm:**

- ❌ Phức tạp, nhiều failure mode (lock expiry, Redis crash)
- ❌ Performance overhead — mọi operation đều cần acquire/release lock
- ❌ Không thực sự idempotent nếu chỉ dùng lock — vẫn cần kết hợp state check
- ❌ Deadlock risk nếu lock không được release
- ❌ Redlock algorithm có tranh cãi về correctness

**Khi nào dùng:**

- Bảo vệ critical section trong distributed scheduled jobs
- Kết hợp với idempotency key để tránh concurrent processing cùng một key
- Rate limiting

**Khi nào KHÔNG dùng:**

- Thay thế cho proper idempotency design
- High-throughput operations (bottleneck)
- Khi có thể dùng database atomic operations thay thế

---

### 5.10 At-least-once + Deduplication Store

**Cơ chế hoạt động:**

Chấp nhận at-least-once delivery, nhưng có dedicated deduplication store để lọc duplicate trước khi xử lý. Pattern này phổ biến trong event streaming.

```
Producer → Kafka → Consumer → Dedup Store → Business Logic
                                   ↓
                            (event_id đã xử lý?)
                            YES → skip
                            NO  → process + mark
```

**Implementation với Redis:**

```python
class IdempotentConsumer:
    def __init__(self, redis, processor):
        self.redis = redis
        self.processor = processor

    def handle_event(self, event: dict):
        event_id = event['id']
        dedup_key = f"event_processed:{event_id}"

        # Atomic SET NX — chỉ set nếu chưa tồn tại
        was_set = self.redis.set(
            dedup_key,
            datetime.now().isoformat(),
            nx=True,        # Only set if Not eXists
            ex=7*24*3600    # Expire sau 7 ngày
        )

        if not was_set:
            # Đã xử lý → skip
            metrics.increment('events.skipped.duplicate')
            return

        try:
            self.processor.process(event)
        except Exception as e:
            # Nếu xử lý thất bại, xoá key để cho phép retry
            self.redis.delete(dedup_key)
            raise
```

**Ưu điểm:**

- ✅ Đơn giản và hiệu quả với Redis
- ✅ Phù hợp với event streaming (Kafka, Kinesis)
- ✅ TTL-based cleanup tự động
- ✅ Low latency check

**Nhược điểm:**

- ❌ Nếu Redis down → có thể duplicate hoặc không xử lý được
- ❌ Race condition với concurrent consumers (cần atomic NX)
- ❌ TTL phải lớn hơn maximum retry window
- ❌ Nếu processor fail sau khi mark processed → event bị lost

**Khi nào dùng:**

- Kafka consumer groups
- SQS worker
- Webhook processor
- Any async event consumer

---

## 6. So sánh tổng hợp các kỹ thuật

| Kỹ thuật | Độ phức tạp | Hiệu năng | Cần Storage? | Cover Race Condition? | Trả về cached response? | Best For |
|---|---|---|---|---|---|---|
| DB Constraint | 🟢 Thấp | 🟢 Cao | ❌ Không | ✅ Có (DB atomic) | ❌ Không | Business entities với natural key |
| Idempotency Key | 🟡 Trung bình | 🟡 Trung bình | ✅ Có | ✅ Với atomic SET NX | ✅ Có | Payment API, mutation API |
| State-based | 🟢 Thấp | 🟢 Cao | ❌ Không | ⚠️ Cần lock | ❌ Không | Workflow, state machine |
| Event ID Dedup | 🟡 Trung bình | 🟢 Cao | ✅ Có | ✅ Với atomic NX | ❌ Không | Message consumer, webhook |
| Transaction ID | 🟡 Trung bình | 🟡 Trung bình | ✅ Có | ⚠️ Phụ thuộc impl | ✅ Có | Internal service calls |
| Conditional Write | 🟢 Thấp | 🟢 Cao | ❌ Không | ✅ Có (DB atomic) | ❌ Không | State transitions |
| Upsert | 🟢 Thấp | 🟢 Cao | ❌ Không | ✅ Có (DB atomic) | ❌ Không | Sync, import, PUT operations |
| Optimistic Locking | 🟡 Trung bình | 🟢 Cao | ❌ Không | ⚠️ Cần retry | ❌ Không | Concurrent update |
| Distributed Lock | 🔴 Cao | 🔴 Thấp | ✅ Có | ✅ Có | ❌ Không | Critical section, scheduled jobs |
| Deduplication Store | 🟡 Trung bình | 🟢 Cao | ✅ Có | ✅ Với atomic NX | ❌ Không | Event streaming consumer |

---

## 7. Quyết định chọn kỹ thuật theo use case

```
Bạn đang xử lý loại operation nào?
│
├─ Read-only (GET, SELECT)
│   └─ → Không cần idempotency (đã naturally idempotent)
│
├─ External API endpoint nhận payment / financial transaction
│   └─ → Idempotency Key + DB Constraint (defense in depth)
│
├─ REST API mutation (create/update resource)
│   ├─ PUT / PATCH (set to value)
│   │   └─ → Upsert hoặc Conditional Write
│   └─ POST (create new resource)
│       └─ → Idempotency Key hoặc DB Constraint (nếu có natural key)
│
├─ Message / Event consumer (Kafka, SQS, Webhook)
│   └─ → Event ID Deduplication Store
│
├─ Workflow / State transition
│   └─ → State-based Idempotency + Conditional Write
│
├─ Distributed scheduled job / Cron
│   └─ → Distributed Lock + State check
│
├─ Data sync / Import / Backfill
│   └─ → Upsert
│
└─ Internal service-to-service (complex operation)
    └─ → Transaction ID Tracking hoặc Idempotency Key
```

---

## 8. Checklist triển khai Idempotency

### Design Phase

- [ ] Xác định tất cả các operation có thể bị retry hoặc duplicate
- [ ] Xác định "unit of work" — điều gì tạo nên uniqueness của mỗi operation
- [ ] Chọn kỹ thuật phù hợp với use case
- [ ] Define TTL cho idempotency keys / deduplication store

### Implementation Phase

- [ ] Implement atomic check-and-set (tránh race condition)
- [ ] Xử lý partial failures (crash sau khi thực hiện một phần)
- [ ] Phân biệt "duplicate" vs "conflict" trong error responses
- [ ] Đảm bảo side effects (email, notification) cũng idempotent

### Testing Phase

- [ ] Test concurrent requests với cùng idempotency key
- [ ] Test retry sau timeout
- [ ] Test partial failure scenarios
- [ ] Test TTL expiry behavior

### Monitoring Phase

- [ ] Log duplicate detection (metric: `duplicates_prevented`)
- [ ] Alert khi duplicate rate bất thường cao
- [ ] Monitor idempotency store size và performance

---

## 9. Các Anti-pattern cần tránh

### ❌ Anti-pattern 1: Check-then-Act không atomic

```python
# WRONG: Race condition giữa check và act
def create_payment(ref: str, amount: float):
    if Payment.exists(reference=ref):  # Check
        return                          # Another thread sneaks in here!
    Payment.create(reference=ref, amount=amount)  # Act

# CORRECT: Dùng DB constraint hoặc atomic INSERT
def create_payment(ref: str, amount: float):
    try:
        Payment.create(reference=ref, amount=amount)
    except UniqueViolation:
        return Payment.get(reference=ref)
```

### ❌ Anti-pattern 2: Idempotency Key không có TTL

```python
# WRONG: Key tồn tại mãi mãi → storage leak
redis.set(f"idem:{key}", response_data)

# CORRECT: Luôn có TTL
redis.set(f"idem:{key}", response_data, ex=86400)  # 24 giờ
```

### ❌ Anti-pattern 3: Side effects không idempotent

```python
# WRONG: Email vẫn được gửi 2 lần dù payment chỉ tạo 1 lần
def create_payment(idempotency_key: str):
    if cached := get_cached_response(idempotency_key):
        send_confirmation_email(cached)  # Gửi lại email!
        return cached

# CORRECT: Side effects chỉ chạy khi là lần đầu tiên
def create_payment(idempotency_key: str):
    if cached := get_cached_response(idempotency_key):
        return cached  # Return cache, không chạy side effects

    result = process_new_payment(...)
    send_confirmation_email(result)  # Chỉ gửi lần đầu
    cache_response(idempotency_key, result)
    return result
```

### ❌ Anti-pattern 4: Dùng timestamp làm idempotency key

```python
# WRONG: Timestamp không đủ unique
idempotency_key = str(datetime.now().timestamp())  # Collision nếu 2 request cùng millisecond

# CORRECT: UUID v4
import uuid
idempotency_key = str(uuid.uuid4())
```

### ❌ Anti-pattern 5: Quên idempotency trong compensating transactions

```python
# Saga compensating action cũng phải idempotent
def cancel_hotel_booking(booking_id: str):
    booking = HotelBooking.get(booking_id)

    # WRONG: Không check trạng thái → lỗi nếu đã cancel rồi
    booking.cancel()

    # CORRECT: State-based idempotency
    if booking.status == 'cancelled':
        return  # Already cancelled, idempotent
    if booking.status != 'confirmed':
        raise ValueError(f"Cannot cancel booking in status: {booking.status}")
    booking.cancel()
```

---

*Tài liệu này được xây dựng dựa trên các best practices từ ngành công nghiệp phần mềm, bao gồm kinh nghiệm từ Stripe, AWS, Google, và cộng đồng distributed systems. Idempotency không phải là afterthought — hãy thiết kế nó từ đầu.*