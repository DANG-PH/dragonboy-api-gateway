# Register Flow — Thiết kế & Quyết định kỹ thuật

> **Mục tiêu tài liệu**: Giải thích tại sao hệ thống register được thiết kế theo cách hiện tại,
> không phải chỉ mô tả _what_ mà còn giải thích _why_. Phù hợp cho mọi level từ intern đến staff.

---

## Mục lục

1. [Bài toán](#1-bài-toán)
2. [Thuật ngữ chuyên ngành](#2-thuật-ngữ-chuyên-ngành)
3. [Các hướng tiếp cận](#3-các-hướng-tiếp-cận)
4. [Tại sao chọn cách hiện tại](#4-tại-sao-chọn-cách-hiện-tại)
5. [Flow mới — giải thích chi tiết](#5-flow-mới--giải-thích-chi-tiết)
6. [Tại sao không dùng SagaState](#6-tại-sao-không-dùng-sagastate)
7. [Góc nhìn theo level](#7-góc-nhìn-theo-level)
8. [Câu hỏi thường gặp](#8-câu-hỏi-thường-gặp)
9. [Những điều cần chú ý khi maintain](#9-những-điều-cần-chú-ý-khi-maintain)

---

## 1. Bài toán

### Context

Hệ thống là microservice game online. Khi user đăng ký tài khoản, cần tạo dữ liệu ở **3 service khác nhau**, mỗi service có **database riêng**:

```
Auth Service  (MySQL) — lưu username, password, role
User Service  (MySQL) — lưu game data: vàng, ngọc, vị trí, gameName
Pay Service   (MySQL) — lưu ví tiền của user
```

### Vấn đề cốt lõi

Đây là bài toán **distributed transaction** — làm thế nào để đảm bảo cả 3 service đều tạo dữ liệu thành công, hoặc nếu có bước nào fail thì hệ thống tự phục hồi, không để lại dữ liệu không nhất quán (inconsistent state).

### Yêu cầu cụ thể

| Yêu cầu | Lý do |
|---|---|
| User vào game ngay sau đăng ký phải có data | Auth + User phải tạo xong trước khi trả response |
| Không để lại orphan record khi có lỗi | Auth tạo mà User không tạo → user bị "kẹt", không đăng ký lại được |
| Hệ thống tự phục hồi khi server crash | Không thể yêu cầu admin vào fix tay mọi lúc |
| Pay không cần có ngay khi vào game | User cần vàng/ngọc ngay, không cần ví tiền ngay |

### Constraint quan trọng

- **3 database khác nhau** → không thể dùng 1 ACID transaction bao trùm cả 3
- **gRPC giữa các service** → mỗi call có thể timeout, fail, retry
- **Server có thể crash** bất kỳ lúc nào giữa chừng

---

## 2. Thuật ngữ chuyên ngành

Hiểu rõ những khái niệm này trước khi đọc tiếp:

### Distributed Transaction
Transaction trải dài trên nhiều database/service khác nhau. Không thể dùng SQL `BEGIN/COMMIT` thông thường vì mỗi service có DB riêng.

### ACID (trong context này)
- **Atomicity**: Tất cả hoặc không có gì — không để trạng thái nửa vời
- **Consistency**: Data luôn ở trạng thái hợp lệ
- **Isolation**: Các operation không ảnh hưởng lẫn nhau
- **Durability**: Đã commit thì không mất dù crash

Trong microservice, ACID chỉ đảm bảo được **per-service**, không phải cross-service.

### Saga Pattern
Chuỗi các local transaction, mỗi transaction ở một service. Nếu một bước fail → chạy **compensating transaction** để undo các bước đã chạy trước đó.

```
Step 1: Auth Service tạo auth     → thành công
Step 2: User Service tạo user     → fail
Compensate Step 1: Xóa auth đã tạo
```

Có 2 loại Saga:
- **Orchestration**: Một orchestrator trung tâm điều phối tất cả bước
- **Choreography**: Các service tự lắng nghe event và tự quyết định bước tiếp theo

### Outbox Pattern
Ghi event vào bảng `outbox` **trong cùng một local transaction** với data thay đổi. Đảm bảo event không bao giờ bị mất dù server crash ngay sau khi commit.

```
Transaction {
  INSERT INTO auth_entity ...
  INSERT INTO register_outbox ...  ← cùng transaction
}
// Nếu commit thành công → chắc chắn có outbox row
// Nếu crash trước commit → cả 2 rollback, không orphan
```

### Compensating Transaction
Hành động undo một transaction đã commit. Khác với rollback vì transaction gốc đã commit rồi — cần một transaction mới để đảo ngược.

```
Auth tạo thành công (committed) → User fail
Compensating transaction: DELETE FROM auth WHERE id = ?
```

### Idempotency
Gọi một operation nhiều lần cho kết quả giống như gọi một lần. Cực kỳ quan trọng khi có retry.

```typescript
// KHÔNG idempotent
if (exists) throw Error('Already exists'); // retry sẽ luôn fail

// Idempotent
if (exists) return { success: true }; // retry an toàn
```

### Eventual Consistency
Dữ liệu sẽ nhất quán **sau một khoảng thời gian**, không phải ngay lập tức. Chấp nhận được khi operation không cần kết quả ngay.

### At-least-once Delivery
Đảm bảo một message/event được xử lý **ít nhất một lần**. Có thể xử lý nhiều hơn 1 lần → cần idempotency để an toàn.

### Optimistic Locking
Tránh duplicate processing bằng cách dùng điều kiện trong câu `UPDATE`:
```sql
UPDATE outbox SET status = 'PROCESSING' WHERE id = ? AND status = 'PENDING'
-- affected = 0 → instance khác đã lock trước → skip
```

### Dead Letter
Event đã retry hết số lần cho phép mà vẫn fail → đánh dấu `FAILED`, alert dev xử lý tay.

### Fast Path / Slow Path
- **Fast path**: Xử lý ngay trong request, không chờ cron
- **Slow path**: Cron pick up và xử lý sau (fallback)

---

## 3. Các hướng tiếp cận

### Cách 1 — Sequential gRPC (cách cũ)

```
API Gateway → gRPC Auth → gRPC User → gRPC Pay → trả response
```

```typescript
const authResult = await authService.register(body);
const userResult = await userService.register({ id: authResult.auth_id });
await payService.createPay({ userId: authResult.auth_id });
return { success: true };
```

**Ưu điểm:**
- Đơn giản, dễ hiểu, ít code
- Debug dễ — lỗi ở đâu rõ ngay

**Nhược điểm:**
- Không có recovery khi crash — Auth tạo xong, server crash → User không tạo, orphan record mãi mãi
- Client phải chờ cả Pay Service → latency cao không cần thiết
- Không có retry tự động
- Không có compensating transaction

**Verdict**: Chỉ phù hợp prototype, không production-grade.

---

### Cách 2 — Saga thuần (không Outbox)

```
Auth tạo → ghi saga log → User tạo → ghi saga log → Pay tạo
Crash → admin nhìn saga log → fix tay
```

**Ưu điểm:**
- Có audit trail (biết lỗi ở đâu)
- Có compensating transaction

**Nhược điểm:**
- Nếu crash **trước khi ghi saga log** → không biết phải compensate gì
- Vẫn cần admin can thiệp tay nhiều case
- Không có retry tự động

**Verdict**: Tốt hơn cách 1 nhưng vẫn có gap khi crash giữa chừng.

---

### Cách 3 — Full Saga Orchestrator + SagaState

```
Orchestrator ghi SagaState → chạy từng step → ghi completed_steps → compensate đúng chỗ
```

```typescript
// SagaState lưu từng bước đã chạy
completed_steps: ['createAuth', 'createUser', 'createPay']
// Crash và retry → biết chính xác phải chạy tiếp từ đâu
```

**Ưu điểm:**
- Cover mọi crash case
- Biết chính xác bước nào đã chạy → compensate đúng
- Pattern dùng ở hệ thống phức tạp nhiều bước

**Nhược điểm:**
- **Overkill cho 2 bước đơn giản** — register chỉ có Auth → User, compensate duy nhất là xóa auth
- Thêm complexity không cần thiết
- Khó maintain hơn

**Verdict**: Phù hợp cho flow phức tạp như mua bán account (6+ bước). Không phù hợp cho register.

---

### Cách 4 — Outbox + Fast Path + Cron (cách hiện tại) ✅

```
1 transaction {auth + outbox} → fast path gRPC User ngay → cron fallback
User Service: 1 transaction {user + pay_outbox} → emit pay.create → cron fallback
```

**Ưu điểm:**
- Không mất data dù crash bất kỳ đâu
- Client nhận response nhanh (Pay không block)
- Tự phục hồi không cần admin
- Code đủ đơn giản để maintain

**Nhược điểm:**
- Nhiều moving part hơn cách 1 (outbox table, cron, event emitter)
- Pay là eventual consistent (chấp nhận được)

**Verdict**: Production-grade, cân bằng tốt giữa reliability và complexity.

---

### So sánh tổng quan

| Tiêu chí | Cách 1 | Cách 2 | Cách 3 | Cách 4 |
|---|---|---|---|---|
| Crash recovery | ❌ | ⚠️ | ✅ | ✅ |
| Retry tự động | ❌ | ❌ | ✅ | ✅ |
| Latency | ❌ | ❌ | ⚠️ | ✅ |
| Complexity | ✅ | ✅ | ❌ | ⚠️ |
| Production-grade | ❌ | ⚠️ | ✅ | ✅ |
| Phù hợp bài toán này | ❌ | ❌ | ❌ | ✅ |

---

## 4. Tại sao chọn cách hiện tại

### Nguyên tắc quyết định

> **Dùng đúng tool cho đúng vấn đề.** Không over-engineer, không under-engineer.

### Quy tắc chọn gRPC hay Event

Đây là câu hỏi cốt lõi của mọi distributed system. Quy tắc đơn giản:

```
Cần biết kết quả để quyết định bước tiếp theo   →  gRPC đồng bộ
Không cần biết kết quả, không block UX           →  Event + fire and forget
```

Nhưng quy tắc trên chưa đủ. Cần thêm 2 câu hỏi:

```
1. User có cần data này ngay khi vào app/game không?
   Có  →  đồng bộ (gRPC)
   Không  →  eventual (Event)

2. Nếu downstream fail, có gì để compensate không?
   Có  →  gRPC, biết fail để compensate ngay
   Không  →  Event + retry mãi vì không có gì để undo
```

---

### Auth → User: Tại sao gRPC đồng bộ + Outbox

**Câu hỏi 1**: User có cần data ngay không?

```
Client nhận success → vào game ngay → query User Service lấy vàng/ngọc/vị trí
→ Nếu User chưa tạo xong → 404, crash UX
→ Bắt buộc phải đồng bộ
```

**Câu hỏi 2**: Nếu User fail, có gì để compensate không?

```
Auth đã tạo, User fail
→ User không tồn tại nhưng Auth tồn tại
→ User thử đăng ký lại → "username đã tồn tại" → bị kẹt mãi
→ Phải compensate: xóa Auth đi
→ Cần biết kết quả của User Service để quyết định có compensate không
→ Phải gRPC đồng bộ, không thể fire and forget
```

**Kết luận**: gRPC đồng bộ + await result. Outbox là safety net cho crash case.

---

### User → Pay: Tại sao Event + fire and forget

**Câu hỏi 1**: User có cần Pay ngay không?

```
User vào game → cần vàng, ngọc, vị trí (từ User Service)
             → KHÔNG cần ví tiền (từ Pay Service) ngay lúc này
→ Pay có thể tạo sau vài giây/phút, UX không bị ảnh hưởng
→ Eventual consistency chấp nhận được
```

**Câu hỏi 2**: Nếu Pay fail, có gì để compensate không?

```
Auth ✅ đã tạo → không thể xóa (user đã đăng nhập được rồi)
User ✅ đã tạo → không thể xóa (user đã vào game rồi)
Pay ❌ fail
→ Không có gì để compensate — không thể undo Auth và User
→ Bắt buộc phải retry đến khi Pay tạo được
→ Không cần biết kết quả ngay → Event + fire and forget + outbox retry mãi
```

**Kết luận**: Event + fire and forget. Outbox đảm bảo retry mãi đến khi Pay tạo được, không có `FAILED` status.

---

### Bảng quyết định

| | Auth → User | User → Pay |
|---|---|---|
| User cần data ngay? | ✅ Có | ❌ Không |
| Có thể compensate nếu fail? | ✅ Có (xóa auth) | ❌ Không |
| Cần biết kết quả? | ✅ Có | ❌ Không |
| Blocking client? | ✅ Phải block | ❌ Không block |
| **Quyết định** | **gRPC đồng bộ** | **Event + fire and forget** |
| Nếu fail? | Compensate xóa auth + retry có giới hạn | Retry mãi, không FAILED |

---

### Tại sao không dùng Event cho Auth → User?

Câu hỏi này thường gặp. Dùng event cho Auth → User sẽ trông như sau:

```typescript
// Auth Service emit event
this.eventEmitter.emit('auth.created', { authId, gameName });
return { success: true }; // ← trả về NGAY, User chưa tạo xong
```

```
Client nhận success: true
→ Vào game ngay
→ Game query User Service: GET /user?authId=xxx
→ User chưa tạo xong → 404
→ Crash UX, user hoang mang
```

Ngoài ra còn vấn đề compensate:

```
Auth tạo xong → emit event → trả success
User Service nhận event → fail
→ Lúc này Auth Service đã trả response rồi
→ Không biết phải compensate gì
→ Auth orphan mãi mãi
```

**Kết luận**: Event cho Auth → User chỉ hợp lý nếu game có **loading screen sau đăng ký** đủ dài để User Service tạo xong. Hệ thống hiện tại không có điều đó → phải gRPC đồng bộ.

---

### Tại sao không cần SagaState cho register

SagaState sinh ra để trả lời câu hỏi: **"Trong N bước đã chạy, bước nào thành công, bước nào cần compensate?"**

Register chỉ có **1 compensating action duy nhất**: xóa auth.

```
Dù crash ở đâu sau khi auth tạo xong:
→ Compensate = DELETE auth WHERE id = ?
→ Không cần biết thêm gì, không cần SagaState
```

So sánh với mua account (cần SagaState):
```
completed_steps: ['deductBuyer', 'changePass', 'changeEmail', 'creditPartner']
→ Crash sau changeEmail → cần compensate: creditPartner (skip), changeEmail, changePass, deductBuyer
→ Phải biết chính xác bước nào đã chạy → cần SagaState
```

---

## 5. Flow mới — giải thích chi tiết

### Sơ đồ tổng quan

```
Client
  │
  ▼
API Gateway ──gRPC──► Auth Service
                           │
                    ┌──────┴──────────────────────────────────────┐
                    │  1 Transaction                               │
                    │  ┌─────────────┐   ┌──────────────────────┐ │
                    │  │ AuthEntity  │   │   RegisterOutbox      │ │
                    │  │ (tạo auth)  │   │   status: PENDING     │ │
                    │  └─────────────┘   └──────────────────────┘ │
                    └─────────────────────────────────────────────┘
                           │
                    fast path (await, đồng bộ)
                           │
                           ▼
                      User Service ──────────────────────────────────┐
                           │                                          │
                    ┌──────┴──────────────────────────────────────┐  │
                    │  1 Transaction                               │  │
                    │  ┌─────────────┐   ┌──────────────────────┐ │  │
                    │  │ User_Entity │   │  CreatePayOutbox      │ │  │
                    │  │ (tạo user)  │   │  status: PENDING      │ │  │
                    │  └─────────────┘   └──────────────────────┘ │  │
                    └─────────────────────────────────────────────┘  │
                           │                                          │
                    emit 'pay.create' (fire and forget)               │
                           │                                          │
                           ▼                                          │
                      Pay Service                                     │
                    (eventual, cron retry mãi)                        │
                                                                      │
                    ◄─────────────────────────────────────────────────┘
                    { success: true }
                           │
                    ◄──────┘
                    { success: true }
                           │
                    ◄──────┘
                  Client nhận response
                  (Auth + User đã tạo xong, Pay đang tạo ngầm)
```

### Giải thích từng hàm

#### `registerSaga(data)` — Auth Service, entry point

```typescript
async registerSaga(data: RegisterRequest): Promise<RegisterResponse>
```

**Làm gì**: Entry point của toàn bộ flow. Validate, hash password, rồi chạy transaction + fast path.

**Tại sao tên là `registerSaga`**: Đây là saga orchestrator — nó điều phối các bước và xử lý compensate nếu fail.

**Điểm quan trọng**: `await callUserService()` — phải await để đảm bảo đồng bộ. Nếu bỏ await thành fire and forget thì user vào game có thể chưa có data.

---

#### Transaction block — Auth + Outbox

```typescript
await this.authRepo.manager.transaction(async (manager) => {
  const auth = await manager.save(AuthEntity, ...);
  await manager.save(RegisterOutbox, { payload: { authId }, status: 'PENDING' });
});
```

**Làm gì**: Tạo auth record và outbox event trong **cùng một local transaction**.

**Tại sao cần cùng transaction**: Đây là điểm mấu chốt của Outbox pattern. Nếu tạo auth rồi mới tạo outbox (2 operation riêng):

```
auth tạo thành công
server crash
outbox chưa tạo → cron không biết có auth cần xử lý
→ auth orphan mãi mãi
```

Trong cùng transaction: commit thành công → cả 2 đều có. Crash trước commit → cả 2 rollback.

---

#### `callUserService(authId, gameName)` — Auth Service

```typescript
private async callUserService(authId: number, gameName: string): Promise<void>
```

**Làm gì**: gRPC call sang User Service để tạo user record. Throw nếu fail.

**Tại sao tách ra hàm riêng**: Được gọi ở cả fast path lẫn `processOutboxEvent` (khi cron retry). DRY principle.

---

#### `pollOutbox()` — Auth Service, cron mỗi 5 giây

```typescript
@Cron(CronExpression.EVERY_5_SECONDS)
async pollOutbox(): Promise<void>
```

**Làm gì**: Quét outbox tìm các event `PENDING`, xử lý chúng.

**Tại sao cần**: Fallback cho crash case. Fast path xử lý 99.9% request. Cron chỉ chạy khi server crash sau transaction commit nhưng trước khi fast path xong.

**Optimistic lock**: `UPDATE WHERE status = 'PENDING'` đảm bảo chỉ 1 instance pick up 1 event khi scale ngang. Không cần Redis lock vì chỉ cần 1 câu SQL atomic.

---

#### `recoverStuckProcessing()` — cron mỗi 30 giây

```typescript
@Cron('*/30 * * * * *')
async recoverStuckProcessing(): Promise<void>
```

**Làm gì**: Reset các event bị kẹt ở `PROCESSING` quá 5 phút về `PENDING`.

**Tại sao cần**: Nếu server crash khi đang `PROCESSING`, status bị treo mãi. Cron này là safety net để event được pick up lại.

---

#### `processOutboxEvent(event)` — Auth Service

```typescript
async processOutboxEvent(event: RegisterOutbox): Promise<void>
```

**Làm gì**: Kiểm tra auth còn tồn tại không → gọi User Service → đánh DONE hoặc retry.

**Check auth tồn tại**: Nếu fast path đã compensate xóa auth (vì User Service fail liên tục đến hết retry) thì cron không cần gọi User Service nữa — auth đã xóa, không có gì để tạo user.

---

#### `handleFailure(event, error)` — Auth Service

```typescript
private async handleFailure(event: RegisterOutbox, error: unknown): Promise<void>
```

**Làm gì**: Exponential backoff retry hoặc compensate xóa auth khi hết retry (dead letter).

**Exponential backoff**: `2^retries * 10_000ms` → 10s, 20s, 40s. Tránh hammer service đang có vấn đề.

**Dead letter**: Hết `maxRetries` → xóa auth (compensate), đánh `FAILED`, alert. Không retry mãi vì User Service có thể có bug thật → cần dev xem.

---

#### `register()` — User Service, gRPC handler

```typescript
@GrpcMethod(USER_SERVICE_NAME, 'Register')
async register(data: RegisterRequest): Promise<RegisterResponse>
```

**Điểm quan trọng**: `if (exists) return { success: true }` — **idempotent**. Trả `true` chứ không phải `false` hay throw. Vì Auth Service có thể gọi lại nhiều lần khi cron retry — user đã tạo rồi là trạng thái hợp lệ, không phải lỗi.

**Transaction User + CreatePayOutbox**: Tương tự Auth Service — đảm bảo Pay event không bao giờ mất.

---

#### `handlePayCreate(event)` — User Service, event handler

```typescript
@OnEvent('pay.create')
async handlePayCreate(event: { userId: number }): Promise<void>
```

**Làm gì**: Fast path tạo Pay account ngay sau khi emit event.

**Tại sao không await**: Pay không block response. Emit rồi return về Auth Service ngay, client không chờ Pay.

**Handle `ALREADY_EXISTS`**: Pay Service throw `ALREADY_EXISTS` thay vì trả `alreadyExists: true` → buộc caller phải `parseGrpcError`. Đây là trade-off — nếu sửa được proto thì thêm field `alreadyExists` vào response sẽ tốt hơn, các caller không cần bắt error code.

---

#### `pollCreatePayOutbox()` — User Service, cron

**Tại sao retry mãi, không có `FAILED`**: Auth và User đã tạo rồi. Không có gì để compensate. Pay **bắt buộc** phải tạo được. Nếu Pay Service down lâu → retry mãi với backoff, alert dev sau 10 lần.

---

## 6. Tại sao không dùng SagaState

### SagaState là gì và khi nào cần

SagaState lưu trạng thái chi tiết của saga, đặc biệt là `completed_steps` — danh sách các bước đã chạy thành công:

```typescript
completed_steps: ['deductBuyer', 'changePass', 'changeEmail'] // creditPartner chưa chạy
```

Cần thiết khi:
1. Có nhiều bước (3+)
2. Mỗi bước có compensating action khác nhau
3. Cần biết chính xác bước nào đã chạy để compensate đúng chỗ

### Register không cần vì

Register chỉ có **1 compensating action duy nhất**:

```
Dù crash ở đâu sau khi auth tạo:
  → completed_steps = ['createAuth'] hoặc ['createAuth', 'createUser']
  → Compensate duy nhất = xóa auth
  → Không cần biết createUser đã chạy chưa để quyết định compensate
```

Outbox payload đã chứa đủ thông tin cần thiết (`authId`) để cron biết phải làm gì.

### So sánh register vs mua account

```
Register (2 bước):
  Auth → User → (Pay eventual)
  Compensate: chỉ xóa auth
  → Outbox đủ

Mua account (6 bước):
  deductBuyer → changePass → changeEmail → creditPartner → markSold → emailSent
  Compensate:
    creditPartner fail → undo creditPartner
    changeEmail fail   → undo changeEmail + undo changePass + undo deductBuyer
  → Phải biết chính xác bước nào đã chạy → cần SagaState
```

### Rule of thumb

> Dùng SagaState khi compensating action **phụ thuộc vào** bước nào đã chạy.
> Dùng Outbox thuần khi compensating action **luôn giống nhau** bất kể crash ở đâu.

---

## 7. Góc nhìn theo level

### Intern

**Cần hiểu**: Flow cơ bản và lý do mỗi hàm tồn tại.

- Đọc `registerSaga` → hiểu đây là entry point
- Đọc transaction block → hiểu tại sao auth và outbox phải cùng transaction
- Đọc `pollOutbox` → hiểu đây là cron chạy định kỳ để retry
- **Không cần lo**: Tại sao chọn pattern này thay vì pattern khác

**Lỗi thường gặp ở level này**: Thêm `await` vào `this.eventEmitter.emit('pay.create', ...)` → Pay block response, mất đi lợi ích fire and forget.

---

### Junior

**Cần hiểu**: Tại sao cần Outbox, idempotency là gì và tại sao quan trọng.

- Hiểu `if (exists) return { success: true }` — tại sao không throw
- Hiểu optimistic lock `affected === 0 → continue`
- Hiểu exponential backoff — tại sao không retry ngay lập tức
- **Bắt đầu đặt câu hỏi**: "Nếu cả fast path lẫn cron đều fail thì sao?"

**Lỗi thường gặp**: Quên handle `ALREADY_EXISTS` ở cron → Pay outbox retry mãi không thoát được.

---

### Mid-level

**Cần hiểu**: Trade-off giữa các approach, khi nào dùng gRPC vs Event.

- Hiểu tại sao Auth→User dùng gRPC (cần đồng bộ) còn User→Pay dùng Event (không cần ngay)
- Hiểu tại sao không dùng SagaState cho register
- Hiểu crash scenario và cách hệ thống tự phục hồi
- **Bắt đầu đặt câu hỏi**: "Scale lên 100 instance thì optimistic lock có đủ không?"

---

### Senior

**Góc nhìn**: Nhìn hệ thống qua lens của **failure mode** và **operational burden**.

Câu hỏi senior đặt ra:
- Khi `COMPENSATION_FAILED` (xóa auth fail) → admin biết không? Alert ở đâu?
- Cron 5 giây poll 20 event — nếu có 10,000 event PENDING thì sao? Cần tăng `take` hay thêm worker?
- `recoverStuckProcessing` reset sau 5 phút — nếu operation thật sự mất hơn 5 phút thì sao? Duplicate processing?
- Pay outbox retry mãi — nếu Pay Service có bug vĩnh viễn thì outbox table phình to mãi?
- Index `(status, nextRetryAt)` trên outbox table — có đủ selective không khi 99% row là `DONE`?

**Nhận xét về thiết kế hiện tại**:
- Tốt: Outbox + fast path là pattern đúng cho bài toán này
- Tốt: Idempotency được xử lý đúng chỗ
- Cần cải thiện: Alert/monitoring còn là TODO
- Cần cải thiện: Dead letter handling cần rõ ràng hơn — ai nhận alert, quy trình xử lý tay là gì
- Cần theo dõi: Pay outbox không có `FAILED` → cần dashboard để biết có bao nhiêu event đang stuck

---

### Staff / Principal

**Góc nhìn**: Nhìn hệ thống ở tầng **architecture evolution** và **organizational impact**.

**Hiện tại**: Pattern đúng cho scale hiện tại (game mid-size). Outbox + cron là pragmatic choice — không over-engineer với Kafka/Temporal.

**Khi nào cần evolve**:

```
Hiện tại (đủ):
  EventEmitter (in-process) + cron poll DB

Khi scale ngang nhiều instance:
  EventEmitter không đủ vì in-process → chỉ 1 instance nhận event
  → Cần message broker: RabbitMQ hoặc Redis Pub/Sub

Khi có 10+ service phức tạp:
  Cron poll DB ở mỗi service → N cron jobs khó quản lý
  → Cần dedicated event relay: Kafka + Debezium (CDC)

Khi saga có 10+ bước phức tạp:
  Manual saga orchestration khó maintain
  → Cần workflow engine: Temporal hoặc Conductor
```

**Vấn đề tổ chức**: Pattern này yêu cầu mọi developer hiểu idempotency. Nếu một developer mới thêm một gRPC call mà không handle idempotency → bug tinh vi khó phát hiện. Cần:
- Document rõ ràng (file này)
- Code review checklist
- Integration test cho crash scenario

**Điểm mù của thiết kế hiện tại**: EventEmitter là in-process. Khi scale lên 2+ instance Auth Service, `emit('pay.create')` chỉ được xử lý bởi instance phát ra event. Cron vẫn hoạt động đúng nhưng fast path mất tác dụng với các instance khác. Cần để ý khi horizontal scale.

---

## 8. Câu hỏi thường gặp

**Q: Tại sao không dùng Redis Redlock thay vì optimistic lock DB?**

A: Optimistic lock (`UPDATE WHERE status = 'PENDING'`) đủ cho outbox polling — chỉ cần 1 câu SQL atomic, không cần thêm Redis dependency. Redlock cần thiết khi critical section phức tạp, cần giữ lock lâu, hoặc có nhiều resource cần lock cùng lúc.

---

**Q: Nếu cả fast path lẫn cron đều fail hết retry thì sao?**

A: Auth outbox có `maxRetries = 3`. Hết retry → compensate xóa auth → đánh `FAILED` → alert dev. User thử đăng ký lại bình thường được vì auth đã bị xóa.

---

**Q: Pay outbox retry mãi có nguy hiểm không?**

A: Có nếu Pay Service có bug vĩnh viễn → outbox table phình to, cron tốn resource. Cần monitor số lượng event `PENDING` trong `create_pay_outbox`. Alert khi có event retry > 10 lần (đã có trong code, cần nối với Discord/Slack).

---

**Q: Tại sao `completed_steps: ['createAuth']` ngay từ đầu trong transaction?**

A: Vì auth đã được tạo trong transaction đó rồi. Nếu cron pick up và retry, nó thấy `createAuth` đã done → skip, chỉ chạy `createUser`. Tránh tạo auth 2 lần.

---

**Q: `@Index(['status', 'nextRetryAt'])` trên outbox table có đủ không?**

A: Đủ cho scale hiện tại. Nếu outbox table có hàng triệu row `DONE`, nên thêm partial index hoặc định kỳ archive/delete row `DONE` cũ để giữ table nhỏ.

---

## 9. Những điều cần chú ý khi maintain

### Thêm bước mới vào register flow

Nếu cần thêm bước (ví dụ: tạo inventory service), cần đánh giá:
- Cần đồng bộ (user cần data ngay) → thêm vào fast path gRPC, xử lý compensate
- Không cần ngay → thêm outbox mới tương tự `CreatePayOutbox`

### Thêm caller mới cho `createPay`

Nếu có service khác gọi `createPay`, phải đảm bảo caller đó cũng handle `ALREADY_EXISTS` — hoặc tốt hơn là thêm `alreadyExists: true` vào proto response để không bỏ sót.

### Khi thay đổi RegisterOutbox payload

Payload cũ vẫn còn trong DB (các event chưa DONE). Cần backward compatible hoặc migrate data trước khi deploy.

### Monitor cần có

- Số lượng event `PENDING` trong `register_outbox` theo thời gian
- Số lượng event `PENDING` trong `create_pay_outbox` theo thời gian
- Số lượng event `FAILED` trong `register_outbox`
- Alert khi có event retry > 10 lần

---

*Tài liệu này phản ánh thiết kế tại thời điểm viết. Khi hệ thống evolve, cập nhật tài liệu cùng lúc với code.*