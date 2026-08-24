# RBAC vs ABAC — Góc nhìn thực tế trong production

> Không phải lý thuyết. Đây là những quyết định bạn sẽ phải đưa ra hàng ngày khi thiết kế API.

---

## Mục lục

1. [RBAC và ABAC là gì?](#1-rbac-và-abac-là-gì)
2. [So sánh nhanh](#2-so-sánh-nhanh)
3. [Khi nào dùng RBAC?](#3-khi-nào-dùng-rbac)
4. [Khi nào dùng ABAC / CASL?](#4-khi-nào-dùng-abac--casl)
5. [Gộp endpoint hay tách API?](#5-gộp-endpoint-hay-tách-api)
6. [Decision Tree](#6-decision-tree)
7. [Ví dụ thực tế](#7-ví-dụ-thực-tế)
   - [7.1 Orders — bài toán ownership cơ bản](#71-orders--bài-toán-ownership-cơ-bản)
   - [7.2 Profile — gộp hay tách?](#72-profile--gộp-hay-tách)
   - [7.3 Partner xem tài khoản — context-aware endpoint](#73-partner-xem-tài-khoản--context-aware-endpoint)
   - [7.4 Manager / Team-scoped — ABAC thực sự](#74-manager--team-scoped--abac-thực-sự)
8. [CASL trong NestJS — Cách tổ chức](#8-casl-trong-nestjs--cách-tổ-chức)
9. [Những lỗi hay gặp](#9-những-lỗi-hay-gặp)
10. [Checklist trước khi code](#10-checklist-trước-khi-code)
11. [Tóm tắt](#11-tóm-tắt)

---

## 1. RBAC và ABAC là gì?

### RBAC — Role-Based Access Control

Phân quyền dựa trên **role** của user. Không cần biết gì thêm về resource.

```
"ADMIN được xóa order"  →  check role → done
"USER không được xóa"   →  check role → done
```

### ABAC — Attribute-Based Access Control

Phân quyền dựa trên **attribute của resource hoặc user**. Phải biết nội dung của resource mới quyết định được.

```
"User chỉ được sửa order của chính mình"
→ Phải fetch order → check order.ownerId === user.id → mới quyết định
```

### CASL

Thư viện implement ABAC cho Node/TypeScript. Cho phép viết rule tập trung ở một chỗ thay vì rải if-else khắp controller.

---

## 2. So sánh nhanh

| | RBAC | ABAC / CASL |
|---|---|---|
| Phân quyền dựa trên | Role | Attribute của resource/user |
| Cần fetch resource trước? | Không | Có |
| Độ phức tạp setup | Thấp | Trung bình |
| Phù hợp khi | Rule đơn giản, ít thay đổi | Rule phức tạp, nhiều điều kiện, cần reuse |
| Khi rule thay đổi | Sửa nhiều chỗ | Chỉ sửa AbilityFactory |

---

## 3. Khi nào dùng RBAC?

Khi rule chỉ cần biết **role là gì** — không cần biết resource là của ai, trạng thái là gì.

```typescript
// Chỉ ADMIN được xóa → RBAC là đủ, không cần CASL
@Roles(Role.ADMIN)
@UseGuards(JwtAuthGuard, RolesGuard)
@Delete('/users/:id')
deleteUser(@Param('id') id: string) { ... }
```

**Dùng RBAC khi:**
- Chặn toàn bộ endpoint theo role (`ADMIN` only, `PARTNER` only...)
- Feature flag theo role (chỉ `PREMIUM` được export)
- Rule không phụ thuộc vào nội dung của resource

**Không dùng RBAC khi:**
- Cùng role nhưng chỉ được thao tác resource của chính mình ( Ví dụ A và B cùng role Partner thì A có thể bypass B nếu B không có lớp bảo vệ thứ 2, vì RBAC chỉ check role )
- Quyền phụ thuộc vào trạng thái resource (`order.status`, `user.region`)

---

## 4. Khi nào dùng ABAC / CASL?

Khi rule phụ thuộc vào **attribute của resource** — phải biết resource là gì mới quyết định được.

**A. Ownership check:**

```
PUT /orders/:id
→ USER chỉ được sửa order của chính mình
→ Phải fetch order → check order.ownerId === user.id
→ RBAC không làm được, cần CASL
```

**B. Attribute của resource quyết định quyền:**

```
Manager chỉ xem order của team mình
→ order.teamId === user.teamId
→ Không phải check role, mà check attribute
```

**C. Trạng thái resource ảnh hưởng tới quyền:**

```
User bị suspend → chỉ read, không write
→ user.status === 'suspended' → cannot('update', ...)
```

**D. Rule dùng lại ở nhiều endpoint:**

```
"Chỉ được sửa resource của mình" áp dụng cho:
PUT /orders/:id, PATCH /orders/:id, DELETE /orders/:id
→ Định nghĩa 1 lần trong AbilityFactory, guard tự enforce
```

**Quan trọng:** CASL không thay thế RBAC. Trong thực tế dùng cả hai — RBAC chặn endpoint-level, CASL enforce ownership/attribute-level.

```typescript
@Roles(Role.USER, Role.ADMIN)                          // RBAC: chặn role không hợp lệ
@CheckPolicies(ability.can('update', 'Order'))         // CASL: check ownership
@UseGuards(JwtAuthGuard, RolesGuard, PoliciesGuard)
```

---

## 5. Gộp endpoint hay tách API?

Đây là câu hỏi hay bị nhầm nhất. **Câu trả lời không phụ thuộc vào input có giống nhau không — mà phụ thuộc vào response shape và business logic có khác nhau không.**

### Thực tế: Gộp hay tách đều làm được về mặt kỹ thuật

```typescript
// Gộp: id là optional, fallback về JWT
GET /profile?id=xxx   // ADMIN truyền id → xem người đó
GET /profile          // USER không truyền → server tự lấy từ JWT

// Tách
GET /profile/me       // USER
GET /profile/:id      // ADMIN
```

Cả hai hoạt động như nhau. Câu hỏi là cái nào maintainable hơn trong dự án của bạn.

### Nên gộp khi:

- Response shape **giống nhau** cho các role
- Logic xử lý **chỉ khác ở WHERE clause** (filter)
- Số role xử lý ≤ 2–3, behavior không quá khác nhau

```typescript
// Gộp tốt: chỉ khác WHERE clause
const partnerId = role === Role.ADMIN ? query.partner_id : userId;
return this.service.getAccounts({ partnerId });
```

### Nên tách khi:

- Response shape **khác nhau** (Admin thấy thêm field nhạy cảm: `internalNote`, `bannedReason`...)
- Business logic **khác hoàn toàn**, không chỉ là filter khác
- Có hơn 3 role với behavior khác nhau → gộp thành mớ if-else không đọc được
- Security quan trọng → muốn tường minh từng endpoint, dễ audit, dễ test

```typescript
// Tách tốt: response shape khác nhau
GET /orders/:id         // USER: trả { id, status, total, items }
GET /admin/orders/:id   // ADMIN: trả { id, status, total, items, userId, internalNote, ... }
```

### Ngữ nghĩa resource khác nhau → luôn tách (không bàn cãi)

```
GET /orders/:id         → :id là orderId → tìm 1 order cụ thể
GET /users/:id/orders   → :id là userId  → tìm tất cả orders của 1 user
```

Hai endpoint làm việc hoàn toàn khác nhau. Không nên gộp bằng query param nhập nhằng:

```
❌ GET /orders/:id?userId=xxx   → :id là orderId hay userId?
❌ GET /orders?type=user&id=xxx → magic param, không RESTful
```

---

## 6. Decision Tree

```
Cần phân quyền cho endpoint?
│
├─ Chặn toàn bộ endpoint theo role, không cần biết resource?
│   └─ RBAC (RolesGuard) — đừng over-engineer
│
├─ Cần check ownership hoặc attribute của resource?
│   └─ CASL / ABAC
│       ├─ Rule đơn giản, dùng 1–2 chỗ → inline check trong service là OK
│       └─ Rule phức tạp, dùng nhiều chỗ → AbilityFactory
│
└─ Nhiều role cùng dùng 1 endpoint?
    │
    ├─ Response giống, chỉ khác filter/scope?
    │   └─ Gộp (context-aware endpoint)
    │
    ├─ Response khác, logic khác?
    │   └─ Tách API
    │
    └─ :id trỏ đến resource type khác nhau tùy role?
        └─ Tách API (bắt buộc)
```

---

## 7. Ví dụ thực tế

### 7.1 Orders — bài toán ownership cơ bản

| Endpoint | Role | Cơ chế | Lý do |
|---|---|---|---|
| `GET /orders/:id` | USER + ADMIN | CASL | Cùng orderId, khác ownership check |
| `PUT /orders/:id` | USER (owner) + ADMIN | CASL | Check ownership trước khi cho sửa |
| `DELETE /orders/:id` | ADMIN only | RBAC | Không cần check resource |
| `GET /users/:id/orders` | ADMIN only | RBAC + tách API | `:id` là userId, khác ngữ nghĩa |

**CASL hoạt động thế nào với `GET /orders/:id`:**

```
Client gửi: GET /orders/order_123
                    ↓
Server fetch order_123 từ DB
  → { id: 'order_123', ownerId: 'user_456', ... }
                    ↓
CASL evaluate với user từ JWT:
  ADMIN → can('read', 'all')                          → 200
  USER  → can('read', 'Order', { ownerId: user.id })
        → check order.ownerId === user.id
        → Đúng chủ → 200 / Sai chủ → 403
```

Client không truyền thêm gì. Logic hoàn toàn ở server, dựa trên data trong DB.

### 7.2 Profile — gộp hay tách?

**Gộp được — nếu response shape giống nhau:**

```typescript
@Get('profile')
async getProfile(@Query('id') id: string, @Req() req: any) {
  const { userId, role } = req.user;

  const targetId = role === Role.ADMIN
    ? id ?? userId   // Admin truyền id → xem người đó; không truyền → xem mình
    : userId;        // User: luôn lấy từ JWT, không trust query param

  return this.userService.findById(targetId);
}
```

**Nên tách — nếu response shape khác nhau:**

```typescript
// User chỉ thấy data của chính mình
GET /profile
// → { name, email, avatar }

// Admin thấy thêm field nhạy cảm
GET /admin/profile/:id
// → { name, email, avatar, bannedAt, internalNote, loginHistory, ... }
```

Quyết định không phải về `/me` hay `/:id`. Quyết định về **response và logic có thực sự khác không**.

### 7.3 Partner xem tài khoản — context-aware endpoint

```typescript
@Get('account-sell-by-partner')
@Roles(Role.PARTNER, Role.ADMIN)
@UseGuards(JwtAuthGuard, RolesGuard)
async getAccountsByPartner(
  @Query() query: PaginationByPartnerRequestDto,
  @Req() req: any,
): Promise<ListAccountSellResponseDto> {
  const { userId, role } = req.user;

  // PARTNER: không truyền gì, server lấy từ JWT → không thể giả mạo
  // ADMIN: truyền partner_id để filter, hoặc không truyền để xem all
  const partnerId = role === Role.ADMIN
    ? query.partner_id  // undefined = xem tất cả
    : userId;           // luôn là chính họ, bỏ qua query.partner_id nếu có

  return this.partnerService.handleGetAccountsByPartner({ partner_id: partnerId, ... });
}
```

Gộp được vì: response shape giống nhau, chỉ khác WHERE clause.

Tại sao không dùng CASL ở đây? Vì rule đơn giản — "Partner xem của mình, Admin filter hoặc xem all". 3 dòng if-else trong service là đủ, không cần overhead của AbilityFactory.

### 7.4 Manager / Team-scoped — ABAC thực sự

Đây là trường hợp CASL thực sự tỏa sáng — RBAC không giải quyết được.

```typescript
// AbilityFactory — toàn bộ rule nằm ở đây
if (user.role === Role.MANAGER) {
  can('read',   'Order', { teamId: user.teamId });
  can('update', 'Order', { teamId: user.teamId });
  can('read',   'User',  { teamId: user.teamId });
  cannot('delete', 'Order'); // Ngay cả trong team cũng không được xóa
}
```

```typescript
// Controller — không có if-else nào, không biết rule cụ thể
@Get(':id')
@UseGuards(JwtAuthGuard, PoliciesGuard)
async getOrder(@Param('id') id: string, @Req() req: any) {
  const order = await this.orderService.findById(id);
  if (!order) throw new NotFoundException();

  const ability = this.caslAbilityFactory.createForUser(req.user);
  if (!ability.can('read', subject('Order', order))) {
    throw new ForbiddenException();
  }

  return order;
}
```

Mai sau thêm rule "Manager chỉ xem order trong region mình" — chỉ sửa AbilityFactory, controller không đụng đến.

---

## 8. CASL trong NestJS — Cách tổ chức

### Cấu trúc thư mục

```
src/
├── auth/
│   ├── casl/
│   │   ├── casl-ability.factory.ts   ← Toàn bộ rule phân quyền ở đây
│   │   ├── policies.guard.ts
│   │   └── check-policies.decorator.ts
│   └── guards/
│       ├── jwt-auth.guard.ts
│       └── roles.guard.ts
```

### AbilityFactory

```typescript
export type Subjects = InferSubjects<typeof Order | typeof User> | 'all';
export type AppAbility = MongoAbility<[Action, Subjects]>;

@Injectable()
export class CaslAbilityFactory {
  createForUser(user: JwtPayload): AppAbility {
    const { can, cannot, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

    if (user.role === Role.ADMIN) {
      can('manage', 'all');
    }

    if (user.role === Role.USER) {
      can('read',   'Order', { ownerId: user.userId });
      can('update', 'Order', { ownerId: user.userId });
      cannot('delete', 'Order');
    }

    if (user.role === Role.MANAGER) {
      can('read',   'Order', { teamId: user.teamId });
      can('update', 'Order', { teamId: user.teamId });
      can('read',   'User',  { teamId: user.teamId });
    }

    return build();
  }
}
```

### Dùng trong controller

```typescript
@Get(':id')
@UseGuards(JwtAuthGuard, PoliciesGuard)
async getOrder(@Param('id') id: string, @Req() req: any) {
  const order = await this.orderService.findById(id);
  if (!order) throw new NotFoundException();

  const ability = this.caslAbilityFactory.createForUser(req.user);
  if (!ability.can('read', subject('Order', order))) {
    throw new ForbiddenException();
  }

  return order;
}
```

### Pattern inject condition vào WHERE (tối ưu hơn)

Thay vì fetch rồi check quyền (2 bước), đưa điều kiện vào query luôn:

```typescript
async getOrder(id: string, user: JwtPayload) {
  const where = user.role === Role.ADMIN
    ? { id }
    : { id, ownerId: user.userId };

  const order = await this.orderRepo.findOne({ where });
  if (!order) throw new NotFoundException(); // 404: không tìm thấy hoặc không có quyền
  return order;
}
```

Ưu điểm: 1 DB query, không lộ "record tồn tại nhưng bạn không có quyền". Nhược điểm: khó debug hơn (404 thay vì 403). Chọn tùy context.

---

## 9. Những lỗi hay gặp

### Lỗi 1: Trust client input cho ownership

```typescript
// SAI: Ai cũng truyền userId của người khác được
@Get('my-orders')
getMyOrders(@Query('userId') userId: string) {
  return this.orderService.findByUser(userId);
}

// ĐÚNG
@Get('my-orders')
getMyOrders(@Req() req: any) {
  return this.orderService.findByUser(req.user.userId);
}
```

### Lỗi 2: Magic query param để phân biệt role

```typescript
// SAI: Client tự khai báo mình là admin
GET /orders/:id?asAdmin=true

// ĐÚNG: Server đọc role từ JWT
GET /orders/:id
```

### Lỗi 3: CASL overkill cho rule đơn giản

```typescript
// OVERKILL
@CheckPolicies((ability) => ability.can('delete', 'User'))
@Delete('/users/:id')
deleteUser() { ... }

// ĐỦ DÙNG
@Roles(Role.ADMIN)
@Delete('/users/:id')
deleteUser() { ... }
```

CASL có chi phí setup và cognitive overhead. Đừng dùng khi RBAC là đủ.

### Lỗi 4: If-else role rải khắp controller

```typescript
// SAI: Controller làm việc của AbilityFactory
async getOrder(id: string, req: any) {
  const order = await this.orderRepo.findById(id);
  if (req.user.role === 'ADMIN') return order;
  if (req.user.role === 'MANAGER' && order.teamId === req.user.teamId) return order;
  if (req.user.role === 'USER' && order.ownerId === req.user.userId) return order;
  throw new ForbiddenException();
}

// ĐÚNG: Rule tập trung ở AbilityFactory
async getOrder(id: string, req: any) {
  const order = await this.orderRepo.findById(id);
  if (!order) throw new NotFoundException();
  if (!ability.can('read', subject('Order', order))) throw new ForbiddenException();
  return order;
}
```

### Lỗi 5: `:id` nhập nhằng cho 2 loại resource

```typescript
// SAI: :id đôi khi là orderId, đôi khi là userId
GET /orders/:id?byUser=true

// ĐÚNG
GET /orders/:id          // :id luôn là orderId
GET /users/:id/orders    // :id luôn là userId
```

---

## 10. Checklist trước khi code

```
□ Rule có phụ thuộc vào attribute của resource không?
  Không → RBAC thuần là đủ
  Có    → CASL / ABAC

□ Rule có dùng lại ở nhiều endpoint không?
  Không → Inline check trong service là OK
  Có    → AbilityFactory

□ Nhiều role cùng dùng 1 endpoint:
  Response giống, chỉ khác filter → Gộp (context-aware)
  Response khác, logic khác       → Tách API

□ :id trỏ đến loại resource nào?
  Cùng loại cho mọi role → Gộp được
  Khác loại tùy role     → Tách API (bắt buộc)

□ userId lấy từ đâu?
  Từ JWT         → OK
  Từ client input → Security risk, xem lại
```

---

## 11. Tóm tắt

```
Rule chỉ phụ thuộc role, không cần biết resource
→ RBAC (RolesGuard)

Rule phụ thuộc attribute của resource (ownership, teamId, status...)
→ CASL / ABAC

Nhiều role, cùng endpoint, chỉ khác WHERE clause, response giống nhau
→ Gộp (context-aware), không cần CASL nếu rule đơn giản

Nhiều role, response khác hoặc logic khác
→ Tách API

:id trỏ đến loại resource khác nhau tùy role
→ Tách API — không bàn cãi

userId luôn lấy từ JWT
→ Không bao giờ trust client truyền userId của chính họ
```

---

*Rule không phải luôn đúng — context của dự án quan trọng hơn bất kỳ convention nào.*