# Multi-Server Game Architecture — Hướng dẫn toàn diện

> Tài liệu thiết kế authentication & authorization cho game online có nhiều server (multi-realm/multi-shard), phù hợp cho cả desktop client lẫn web portal.

---

## Mục lục

1. [Bài toán đặt ra](#1-bài-toán-đặt-ra)
2. [Các cách giải quyết và trade-off](#2-các-cách-giải-quyết-và-trade-off)
3. [Những suy nghĩ sai phổ biến](#3-những-suy-nghĩ-sai-phổ-biến)
   - Sai lầm 1: Trust client input
   - Sai lầm 2: Login trả profile + client gửi profileId không check ownership
   - Sai lầm 3: Session-based thay vì JWT
   - Sai lầm 4: Không có scope
   - **Sai lầm 5: Trả profileIds list, check ownership ở server (đáng bàn riêng)**
4. [Design được chọn cho game này](#4-design-được-chọn-cho-game-này)
5. [Flow implementation chi tiết](#5-flow-implementation-chi-tiết)
6. [Race condition và idempotency](#6-race-condition-và-idempotency)
7. [Thay đổi phía client](#7-thay-đổi-phía-client)
8. [Các game nổi tiếng làm như nào](#8-các-game-nổi-tiếng-làm-như-nào)
9. [Security checklist](#9-security-checklist)
10. [Operational concerns](#10-operational-concerns)
11. [FAQ](#11-faq)

---

## 1. Bài toán đặt ra

### Bối cảnh

Game online có nhiều server (server 1, server 2, server 3, ..., server Test, ...). Mỗi user có 1 tài khoản (auth) duy nhất, nhưng có thể tạo nhân vật riêng trên mỗi server. Ví dụ:

```
auth_id: 1 (username: dragon123)
  ├── profile id: 101 → server "Rồng Đỏ"     (cấp 50, Chiến Binh)
  ├── profile id: 205 → server "Phượng Hoàng" (cấp 30, Pháp Sư)
  └── chưa có nhân vật ở các server khác
```

### Câu hỏi cốt lõi

Sau khi user đăng nhập (verify OTP xong), làm thế nào để:

1. Server biết user đang thao tác trên server nào — một cách đáng tin cậy
2. User không thể giả mạo `serverName` để truy cập nhân vật của mình ở server khác (cross-server exploit)
3. Performance tốt — không phải query DB liên tục để verify ownership
4. UX mượt — user không phải đăng nhập lại khi đổi server

### Các use case cần handle

| Use case | Mô tả |
|---|---|
| **Đăng nhập lần đầu** | User mới hoàn toàn, chưa có nhân vật ở bất kỳ server nào |
| **Đăng nhập có nhân vật** | User đã có nhân vật ở 1 hoặc nhiều server |
| **Tạo nhân vật mới** | User muốn chơi server mới, chưa có profile ở đó |
| **Đổi server giữa session** | User đang chơi server A, muốn vào nhân vật server B |
| **Web portal** | User vào web để nạp tiền, đăng bán item, claim quà sự kiện |
| **Admin panel** | Admin xem/ban nhân vật của user khác |

---

## 2. Các cách giải quyết và trade-off

### Cách 1 — Trust client input (KHÔNG dùng)

```
Login → token { authId }
Mọi request game → gửi kèm serverName trong header/body
Server query (authId, serverName) → tìm profile → xử lý
```

**Trade-off:**
- ✅ Đơn giản, ít endpoint
- ❌ **Lỗ hổng bảo mật nghiêm trọng** — client có thể giả `serverName`
- ❌ Mỗi request phải query DB để verify ownership (chậm)
- ❌ Không có scope phân quyền rõ ràng

**Tại sao sai:** Xem chi tiết ở mục [Những suy nghĩ sai phổ biến](#3-những-suy-nghĩ-sai-phổ-biến).

---

### Cách 2 — Eager fetch all profiles

```
Login → token { authId }
Client gọi getProfiles(authId) → trả TẤT CẢ profile của TẤT CẢ server
UI hiện list nhân vật, user click chọn 1 cái
Generate token mới { authId, profileId, serverName }
```

**Trade-off:**
- ✅ User thấy ngay nhân vật ở mọi server
- ❌ Lãng phí băng thông — fetch hết 10+ server profile mỗi lần login
- ❌ Mỗi profile có thể có inventory, stats... nặng → response chậm
- ❌ Không phù hợp khi N server lớn (10+, hoặc hàng trăm như WoW)

**Phù hợp khi:** Số profile cố định và nhỏ (ví dụ tối đa 3 nhân vật trong cùng 1 hệ).

---

### Cách 3 — Lazy load với 2 phase token (DESIGN ĐƯỢC CHỌN)

```
Phase 1:
  Login → token1 { authId, scope: 'select_server' }
  Client xem profile tài khoản, ví, lịch sử nạp — đều OK với token1

Phase 2:
  User chọn server X → getTokenGame(token1, server)
    → Server query (authId, serverName), nếu có profile:
       trả token2 { authId, profileId, serverName, scope: 'game' }
    → Nếu không có profile: trả 404 → client vào màn tạo nhân vật

  Mọi game API dùng token2 — server lấy profileId từ token đã ký, không cần query thêm
```

**Trade-off:**
- ✅ Server hoàn toàn tin tưởng `profileId` và `serverName` từ token (đã ký)
- ✅ Không cần query DB để verify ownership mỗi request
- ✅ Phân quyền rõ ràng — token1 không dùng được cho game API
- ✅ Lazy load — chỉ fetch profile của server user thực sự muốn vào
- ✅ Scale tốt với hàng chục/trăm server
- ❌ Phức tạp hơn cách 1 — có thêm endpoint `getTokenGame`
- ❌ Client phải quản lý 2 token (cache hashmap theo server)

**Đây là pattern industry-standard** — WoW, FFXIV, Lost Ark, MapleStory đều làm tương đương.

---

## 3. Những suy nghĩ sai phổ biến

### Sai lầm 1: "Chỉ cần token 1 + client gửi serverName là đủ"

**Lập luận của họ:** Server có thể query `(authId, serverName)` rồi verify, không cần tạo token mới.

**Tại sao sai:**

#### Vector tấn công cụ thể

User A có 2 nhân vật:
- Server 1: cấp 10, có 100 vàng
- Server 2: cấp 80, có 1.000.000 vàng

Với design "trust client":

```http
POST /buy-item
Authorization: Bearer <token1_user_A>
{
  "serverName": "server2",       ← user TỰ KHAI
  "itemId": "expensive_item"
}
```

User A đang ở server 1 nhưng khai server 2 → server tìm nhân vật server 2 (giàu) → trừ vàng nhân vật giàu, item về nhân vật nghèo. **Free arbitrage giữa các server.**

Hoặc tệ hơn:

```http
POST /transfer-gold
Authorization: Bearer <token1>
{
  "serverName": "server2",
  "to": "userBserver1",
  "amount": 1000000
}
```

→ Money laundering cross-server.

#### Nguyên tắc nền tảng bị vi phạm

> **Authorization data MUST come from a trusted source.**

JWT đã ký = trusted (server tự ký, client không sửa được).
Header/body từ client = untrusted (client tự khai, dễ tamper).

Đây là OWASP A01:2021 — Broken Access Control. Đứng đầu top 10 lỗ hổng web 20+ năm nay.

#### "Server vẫn query DB verify mà?"

Đúng, query DB sẽ trả ra profile thuộc `authId` và `serverName`. Nhưng:

- **Performance**: 1000 req/s = 1000 query thừa/s, trong khi JWT verify ~0.1ms (CPU only)
- **TOCTOU race**: profile tồn tại lúc check, nhưng có thể bị thay đổi giữa check và action
- **Logic phức tạp**: mỗi endpoint phải nhớ verify, dễ quên 1 chỗ → bug
- **Scope blur**: token 1 lẽ ra chỉ để chọn server, dùng cho game endpoint là phá vỡ trách nhiệm rõ ràng

---

### Sai lầm 2: "Login xong trả profile luôn, sau đó client gửi profileId"

**Lập luận của họ:** Đơn giản, ít token, ít endpoint.

**Tại sao sai:**

```http
GET /profile?id=101
Authorization: Bearer <token_userA>
```

Nếu server không verify `profileId` thuộc `authId`, user A có thể đổi `id=101` thành `id=999` → xem profile user khác. **Insecure Direct Object Reference (IDOR)** — OWASP A04:2021.

Nếu có verify → mỗi request đều phải query DB → quay lại vấn đề performance + scope blur.

---

### Sai lầm 3: "Dùng session-based, lưu state ở Redis là đủ"

**Lập luận:** Session ID đơn giản hơn JWT, có thể revoke ngay.

**Tại sao không phù hợp game:**

- Game realtime có 1000+ req/s → mỗi request hit Redis = 1000 round-trip/s
- Scale ngang nhiều game server → tất cả phải share Redis = single point of failure
- JWT stateless → mỗi server tự verify, không phụ thuộc Redis

JWT vẫn revoke được qua `tokenVersion` bumping (cache 10 phút), trade-off chấp nhận được.

---

### Sai lầm 4: "Không cần scope, token có authId là đủ"

**Tại sao sai:** Nếu refresh token và access token đều dùng chung scope, attacker steal được refresh token có thể call game API trực tiếp. Scope tách biệt giúp:

- Refresh token không call được game API
- Token 1 (select server) không call được game API
- Token 2 chỉ call được game API của đúng `serverName` đã ký

Defense in depth — nhiều lớp bảo vệ, một lớp thủng vẫn còn lớp khác.

---

### Sai lầm 5: "Trả profileIds list trong token 1, client gửi profileId, server check ownership"

**Đây là design đáng bàn riêng** — không phải tệ về security cơ bản, nhưng inferior về architecture so với token 2. Nhiều dev nhầm đây là alternative tốt — cần phân tích kỹ.

#### Design cụ thể

```
verifyOtp → token1 { authId } + profileIds: [101, 205, 308]
                                   ↑ list ID profile của user

Client click profile 101 → GET /profile?id=101
   Header: Authorization: Bearer <token1>
   ↓
Server:
   - Verify token1 → lấy authId
   - Query profile WHERE id = 101
   - Check profile.auth_id === token.authId
   - Nếu khớp → trả profile
   - Nếu không khớp → 403
```

#### Khác gì với "trust client" (Sai lầm 1)?

**Khác hoàn toàn về security baseline:**

| | Sai lầm 1 (Trust client) | Sai lầm 5 (Ownership check) |
|---|---|---|
| Có verify ownership ở server không? | KHÔNG | CÓ — query DB, check `auth_id` |
| IDOR vulnerability | CÓ | KHÔNG (nếu implement đúng) |
| Cross-server money laundering | Có thể exploit | Không exploit được |
| Đáng coi là "broken security"? | CÓ | KHÔNG |

→ Sai lầm 5 KHÔNG phải broken security. Nhưng vẫn inferior về kiến trúc — vì lý do dưới đây.

#### Vấn đề 1: Performance và kiến trúc microservice

**Cập nhật quan trọng — phân tích lại fair hơn:**

Nhiều dev sẽ phản bác:

> "findOne by PK là O(1) lookup, ~0.5ms — không đắt."

> "Token 2 cũng phải query profile để lấy data thao tác mà, có khác gì đâu?"

**Cả 2 phản bác này đều đúng phần.** Cần phân tích lại chính xác.

##### Sự thật: Phần lớn endpoint game đều cần load profile

```
POST /game/buy-item { itemId }
   ↓
1. Verify auth (JWT hoặc DB lookup)
2. Query profile → lấy current vàng, inventory  ← cả 2 design đều cần
3. Check đủ vàng → trừ vàng → thêm item
```

Cả Token 2 lẫn Sai lầm 5 đều phải query profile cho logic. Trong **80% endpoint game** (mua bán, combat, sử dụng skill), số lượng query DB như nhau.

→ **Performance thuần không phải khác biệt chính.**

##### Sự khác biệt thật nằm ở 4 chỗ

###### Khác biệt 1: Endpoint không cần profile data

Có những endpoint không cần load profile để xử lý logic:

```
POST /game/heartbeat         → ping giữ session
POST /game/check-online      → check user còn online
GET /game/server-status      → thông tin server
GET /game/leaderboard        → bảng xếp hạng (không cần profile của caller)
```

| | Sai lầm 5 | Token 2 |
|---|---|---|
| Verify ownership | BẮT BUỘC query profile | Không cần |
| Cần data profile | Không | Không |
| **Tổng query** | **1 query** | **0 query** |

###### Khác biệt 2: Endpoint chỉ cần subset data

```
POST /game/move { x, y }
```

Logic chỉ cần update bảng `user_position`, không cần load `userGameStats` hay `inventory`.

- **Sai lầm 5:** Phải query bảng `users` để verify ownership + query `user_position` để update = 2 query
- **Token 2:** Chỉ query `user_position` = 1 query

###### Khác biệt 3: Cross-service authorization (QUAN TRỌNG NHẤT)

Đây là điểm khác biệt lớn nhất khi có microservice:

```
Pay Service nhận request "trừ tiền của profile X"
```

Pay service không có bảng `users`, không thuộc user-service domain:

- **Sai lầm 5:** Pay Service phải gRPC sang User Service để verify "profile X có thuộc auth Y không?"
  ```
  client → pay-service → (gRPC) user-service → DB
                       ← (gRPC) ←
                       ← OK ←
                       → trừ tiền → DB
  ```
  Latency: 1 cross-service call (~5-20ms) + 2 DB query
  
- **Token 2:** Pay Service tự verify JWT (CPU), trust `profileId` ngay
  ```
  client → pay-service → DB
                       → trừ tiền
  ```
  Latency: 0 cross-service call + 1 DB query

→ Càng nhiều microservice (Pay, Inventory, Mail, Guild, Auction, ...), lợi thế Token 2 càng nhân lên. Mỗi service tự verify token, không cần consult auth-service / user-service.

###### Khác biệt 4: DB connection pool và scaling

```
Token 2 verify: CPU only → scale với CPU cores
Sai lầm 5 verify: DB query → scale với DB connection pool
```

DB connection pool có **giới hạn cứng** (thường 100-500 connection). Khi traffic tăng:

- Token 2: Add CPU → giải quyết
- Sai lầm 5: Add CPU không giải quyết (DB là bottleneck) → cần scale DB / read replica / cache layer

##### Vấn đề riêng của WebSocket realtime — chỗ Sai lầm 5 sụp đổ rõ rệt

Đây là phần **quan trọng nhất** cần hiểu. WebSocket khác HTTP ở chỗ:

```
HTTP:       request → verify → xử lý → đóng connection
WebSocket:  connect 1 lần → giữ connection lâu → nhận N event qua connection đó
```

Verify ở thời điểm connect rồi sau đó **trust** cho cả phiên (có thể hàng giờ). Thiếu sót ở handshake = thiếu sót cho toàn phiên.

###### Bug 1: Phải trust profileId/serverName từ client handshake

Token 1 không có `profileId` và `serverName`. Khi client connect WS, phải gửi 2 thông tin này qua handshake:

```typescript
// Server áp Sai lầm 5 vào WS
async handleConnection(client: Socket) {
  const token1 = client.handshake.auth.token;
  const profileId = client.handshake.auth.profileId;   // ← CLIENT TỰ KHAI
  const serverName = client.handshake.auth.serverName; // ← CLIENT TỰ KHAI
  
  const payload = jwt.verify(token1);  // chỉ có authId
  
  const profile = await db.findOne({ where: { id: profileId } });
  if (profile.auth_id !== payload.authId) return client.disconnect();
  if (profile.serverName !== serverName) return client.disconnect();
  
  // OK, accept connection
  client.data.profileId = profileId;
  client.data.serverName = serverName;
}
```

Bề ngoài đúng — có check ownership và serverName. **Nhưng phụ thuộc vào dev nhớ check đầy đủ.** Nếu dev quên check `serverName` (vì "đã check authId là đủ rồi"), lỗ hổng cross-server xuất hiện ngay.

So với Token 2:
```typescript
const payload = jwt.verify(token2);
// payload = { authId, profileId, serverName, scope: 'game' } — TẤT CẢ đã ký
client.data = payload;  // Trust 100% từ JWT, không có gì client khai
```

→ Token 2 **enforce qua kiến trúc**, không phụ thuộc dev cẩn thận.

###### Bug 2: Cross-server attack qua handshake giả

```
User A có 2 profile:
  - profile 101 ở "Rồng Đỏ" (cấp 80, giàu)
  - profile 205 ở "Phượng Hoàng" (cấp 10, nghèo)

Attack:
  Client open WS với:
    profileId = 205 (của Phượng Hoàng)
    serverName = "Rồng Đỏ" (KHAI SAI)
  
  Nếu server có check serverName: reject. OK.
  Nếu server quên check serverName (chỉ check authId): accept.
    → Server load profile 205, nhưng client UI nói đang ở Rồng Đỏ
    → State inconsistent
    → Có thể exploit để mua item server A bằng tiền profile server B,
      hoặc các bug logic không lường trước
```

Đây không phải giả thuyết — đây là lỗ hổng đã xảy ra ở nhiều game thật khi dev quên 1 dòng check.

###### Bug 3: Reconnect attack

```
[Time 0] User A connect WS với profileId=101
[Time 1] User A logout, login lại, chọn server khác → token1 mới (vẫn cùng authId)
[Time 2] User A reconnect WS, gửi token1 mới + profileId=101 (cũ)
         → authId match ✓
         → profile 101 thuộc auth A ✓
         → Accept connection cho profile 101
         
         NHƯNG: intent của user lúc này lẽ ra là profile 205
         User vô tình thao tác profile 101 mà không hay biết
```

Token 2 không có bug này: token mới có `profileId=205`, không thể dùng cho `profile=101`.

###### Bug 4: TOCTOU sau khi connection được accept

```
[Time 0]  Client A connect WS với profileId=101, verify pass
[Time 1]  Connection accepted, server cache profileId=101
[Time 2]  Admin transfer profile 101 cho user khác (paid feature)
[Time 3]  Client A vẫn giữ WS connection cũ
[Time 4]  Client A gửi event → server vẫn xử lý cho profile 101
          → Client A đang thao tác profile của user khác!
```

Verify chỉ ở thời điểm connect. Sau đó state thay đổi nhưng connection không re-verify.

Token 2 cũng có vấn đề tương tự (cần `tokenVersion` bump để fix), NHƯNG:
- Token 2: bump `tokenVersion` → mọi token cũ invalid → WS gateway check periodic và disconnect
- Sai lầm 5: bump `tokenVersion` cũng disconnect được, nhưng cộng thêm các vấn đề khác (xem dưới)

###### Bug 5: Multi-tab / Multi-device session confusion

```
User A mở:
  - Tab 1: profile 101 (Rồng Đỏ)
  - Tab 2: profile 205 (Phượng Hoàng)
  
Cả 2 tab dùng cùng token1 (cùng authId).
```

Vấn đề kick session:

```typescript
// Key Redis cho game session
const key = `???:gameSession`;

// Option A: key theo authId
key = `user:${authId}:gameSession`
  → Tab 1 connect: set key = sessionId_1
  → Tab 2 connect: set key = sessionId_2 → KICK Tab 1
  → Sai! 2 tab khác profile lẽ ra phải coexist được

// Option B: key theo profileId
key = `profile:${profileId}:gameSession`
  → Đúng, nhưng profileId từ đâu?
  → Từ client handshake → trust client
```

Token 2 native giải quyết: profileId trusted từ JWT, dùng làm key Redis chính xác, không trust client gì cả.

###### Bug 6: Scope blur cho WS authorization

Token 1 lẽ ra là **"select server"** — chỉ để chọn server, không phải để chơi game. Nhưng Sai lầm 5 dùng token 1 cho WS connect → blur scope.

Hệ quả nếu attacker steal token 1:
- Lưu trên disk lâu dài (token 1 thường có TTL dài, vd 7 ngày)
- Có thể connect WS giả mạo **bất kỳ profile nào** của user đó
- Chỉ cần biết profileId (có thể enumerate qua các trick)

Token 2 với scope `'game'`:
- TTL ngắn hơn (1 ngày)
- Chỉ ký cho **1 profile cụ thể**
- Leak token = leak 1 nhân vật, không phải toàn bộ tài khoản
- Lưu trong RAM, mất khi tắt app → khó steal

###### Tại sao bug WebSocket khó nhận ra?

Đây là lý do Sai lầm 5 là **insidious failure mode**:

| | Sai lầm 1 (trust serverName) | Sai lầm 5 (ownership check) |
|---|---|---|
| Sai từ gốc | Có — không verify gì | Không — có verify ownership |
| Junior dev nhận ra ngay | Có | Khó |
| Senior dev nhận ra | Có ngay | Cần implement và gặp bug mới thấy |
| Code review catch được | Dễ | Khó (vì code "đúng kỹ thuật") |
| Bug xuất hiện khi nào | Ngay từ đầu | Tích lũy theo thời gian khi mở rộng feature |

Sai lầm 5 với HTTP đơn lẻ có thể chấp nhận được. Sai lầm 5 với WebSocket realtime → **không kiểm soát được tốt**, từ vấn đề nhỏ tích lũy thành lỗ hổng lớn.

###### Token 2 enforce qua kiến trúc

Điểm cốt lõi: **Token 2 không cho phép dev mắc các bug trên** vì kiến trúc không cho client gửi profileId/serverName tự do.

```
Sai lầm 5: "Hãy nhớ check ownership ở mọi handshake và mọi event"
            ↓
            Phụ thuộc dev cẩn thận, code review, test coverage

Token 2: "profileId và serverName đã ký trong token, không thể giả mạo"
          ↓
          Enforce qua kiến trúc, không phụ thuộc dev
```

Đây mới là **lý do thật** Token 2 vượt trội — không chỉ performance, mà là **security model cứng cáp hơn**, đặc biệt với WebSocket realtime.

##### Bảng so sánh chính xác — fair hơn

| Endpoint type | Sai lầm 5 | Token 2 |
|---|---|---|
| Endpoint cần load profile data (mua item, combat) | 1 query | 1 query |
| Endpoint không cần profile data (heartbeat, leaderboard) | 1 query | **0 query** |
| Endpoint chỉ cần subset (move, position) | 2 query | **1 query** |
| Cross-service (pay service trừ tiền) | 1 query + cross-call | **0 cross-call** |
| Multi-profile operation (transfer item) | 2+ query verify | **0 query verify** |
| **WS connect verify** | **Phụ thuộc dev cẩn thận** | **Enforce kiến trúc** |
| **Cross-server attack qua WS** | **Có thể nếu code lỏng** | **Impossible** |
| **Reconnect attack** | **Có** | **Không** |
| **Multi-tab session** | **Confused** | **Đúng (theo profileId)** |

##### Kết luận chính xác về performance

**Trong monolith với endpoint cần load profile:** Khác biệt KHÔNG đáng kể. Cả 2 design đều có 1 query DB. Đừng chọn Token 2 chỉ vì "performance" trong case này.

**Trong microservice architecture:** Token 2 thực sự vượt trội vì:
- Mỗi service tự verify, không cross-service call
- Endpoint không-cần-data có 0 query
- DB connection pool không bão hòa vì verify ownership

**Đó mới là lý do industry chọn signed token cho production multi-service game** — không phải vì DB lookup chậm, mà vì kiến trúc microservice đòi hỏi mỗi service phải tự verify được mà không cần consult dịch vụ khác.

##### Cách đáp lại fair khi tranh luận

> "Bạn nói đúng — findOne by PK không đắt, và Token 2 cũng cần query profile cho logic. Trong endpoint cần load profile, performance gần như tương đương. Khác biệt thực sự nằm ở: (1) endpoint không cần profile data có 0 query với Token 2, (2) microservice không cần cross-service call để verify ownership. Càng nhiều service riêng (Pay, Inventory, ...), lợi thế Token 2 càng rõ."

Đừng phủ nhận argument họ — fair acknowledge nhưng đưa context kiến trúc microservice để giải thích.

#### Vấn đề 2: Scope blur — token 1 quá quyền lực

Token 1 với design này có thể call **mọi endpoint** — chỉ cần gửi đúng `profileId` thuộc của mình. Lẽ ra phải tách:

- **Token 1 = "tôi là chủ tài khoản"** → chỉ làm việc account-level (xem ví, đổi mật khẩu)
- **Token 2 = "tôi đang chơi profile X ở server Y"** → chỉ làm việc profile-level (game logic)

Trộn lẫn → một token leak = toàn bộ tài khoản + tất cả profile compromise. Không có lớp giới hạn.

#### Vấn đề 3: Không native multi-server

Design này thiếu `serverName` trong token. Nếu profile có `serverName`, làm sao verify request đang đúng server?

- **Cách A:** Client gửi `serverName` trong request → quay về Sai lầm 1 (trust client serverName)
- **Cách B:** Server query luôn ra `serverName` từ profile, dùng làm context → mỗi request lại query thêm, tăng load DB
- **Cách C:** Match từ URL (vd `/server-1/buy-item`) → vẫn cần check khớp với profile.serverName → vẫn query DB

Token 2 giải quyết cleanly: `serverName` đã ký trong token, mọi service trust 100%, không query thêm.

#### Vấn đề 4: Không granular revoke

Muốn ban riêng nhân vật X nhưng cho phép user vẫn dùng nhân vật Y, Z?

- **Token 2:** Có `profileId` trong token → dễ implement `profileTokenVersion` riêng
- **Sai lầm 5:** Token 1 cover toàn bộ → bump tokenVersion = kill cả tài khoản, không granular được

#### Vấn đề 5: Eager fetch profileIds

Trả `profileIds: [...]` ngay sau verify OTP nghĩa là fetch hết. Với user có 50 profile (như WoW có thể có), đây là overhead không cần thiết — user chỉ chơi 1-2 server thôi.

Token 2 lazy load — chỉ fetch khi user thực sự chọn server.

#### Vấn đề 6: Audit trail kém rõ ràng

Log của hệ thống token 2:
```
[user authId=100, profile=205, server="Phượng Hoàng"] mua item X giá 5000 vàng
```
→ Rõ ràng ngay từ token, không cần join DB.

Log của Sai lầm 5:
```
[user authId=100] mua item X cho profileId=205
```
→ Phải join với bảng users để biết profile 205 ở server nào — phân tích log phức tạp hơn.

#### Khi nào design của họ chấp nhận được?

**Có thể OK khi:**

- Game scale nhỏ (< 100 concurrent users) — overhead query DB không đáng kể
- Single server — không cần worry về cross-server
- Không có nhu cầu revoke granular
- Team junior, ưu tiên code đơn giản dễ hiểu
- Web CRUD app thông thường (không phải game realtime)

**Không nên dùng khi:**

- Game realtime traffic cao (≥ 1000 req/s)
- Multi-server architecture
- Có in-app purchase / giao dịch tiền thật
- Cần audit trail rõ ràng theo profile/server
- Cần granular access control

#### So sánh head-to-head

| Tiêu chí | Token 2 (design này) | Token 1 + ownership check |
|---|---|---|
| Bảo mật cơ bản | ✅ JWT-signed ownership | ✅ DB-verified ownership |
| IDOR vulnerability | Không | Không (nếu check đúng) |
| Performance | ✅ Tốt (verify CPU) | ❌ Kém (query DB mỗi request) |
| Scope rõ ràng | ✅ Có | ❌ Blur |
| Multi-server native | ✅ Có | ❌ Cần thêm validation |
| Granular revoke | ✅ Per profile | ❌ Per account |
| Audit trail | ✅ Rõ từ token | ⚠️ Cần join DB |
| Code complexity | Trung bình | Đơn giản hơn |
| Phù hợp realtime game | ✅ | ⚠️ Chỉ scale nhỏ |
| Phù hợp web CRUD | ✅ | ✅ |

#### Kết luận về Sai lầm 5

**KHÔNG phải broken security ở HTTP đơn giản**, NHƯNG **insidious failure mode** với WebSocket realtime game.

##### Tính chất riêng của Sai lầm 5

| | Sai lầm 1-4 | Sai lầm 5 |
|---|---|---|
| Sai từ gốc | Có | Không |
| Code review dễ catch | Dễ | Khó |
| Junior dev nhận ra | Có | Khó |
| Bug xuất hiện | Ngay | Tích lũy theo thời gian |
| Đặc điểm | Wrong by design | Right at first glance, leaky over time |

→ Sai lầm 5 là **failure mode tinh vi nhất** — bề ngoài đúng kỹ thuật, sâu thì lỏng. Đặc biệt với WebSocket realtime game, các vấn đề nhỏ tích lũy: TOCTOU, cross-server qua handshake giả, reconnect attack, multi-tab confusion, scope blur.

##### Khi nào chấp nhận được

**Có thể OK:**
- Web CRUD app HTTP đơn giản (không có WebSocket)
- Game scale rất nhỏ (< 100 concurrent users), single server
- Không có nhu cầu revoke granular
- Team junior, ưu tiên code đơn giản
- KHÔNG có realtime gameplay

**Không nên dùng:**
- **WebSocket realtime game** (như game của bạn) — tính chất long-lived connection làm các bug tích lũy
- Production multi-server MMO
- Có in-app purchase / giao dịch tiền thật
- Cần audit trail rõ ràng

##### Insight cốt lõi

Token 2 không vượt trội ở:
- ❌ Performance đơn lẻ (cả 2 đều cần query profile cho logic)

Token 2 vượt trội ở:
- ✅ **Security model qua kiến trúc**, không phụ thuộc dev cẩn thận
- ✅ **Microservice authorization** — mỗi service tự verify
- ✅ **WebSocket realtime** — không có chỗ để mắc bug TOCTOU/cross-server
- ✅ **Granular control** — revoke từng profile

Nếu ai đó đề xuất Sai lầm 5 cho **HTTP web app**, có thể chấp nhận. Nếu đề xuất cho **game realtime với WebSocket**, hãy đưa ra 6 bug ở trên — họ sẽ thấy ngay tại sao Token 2 cần thiết.

---

## 4. Design được chọn cho game này

### Tổng quan kiến trúc

```
┌─────────────────────────────────────────────────────────────┐
│                       AUTH SERVICE                           │
│  - Quản lý tài khoản (auth_id, username, password, email)   │
│  - Issue token1 (sau verify OTP)                            │
│  - Issue token2 (sau khi user chọn server)                  │
│  - Verify scope, tokenVersion                               │
└─────────────────┬───────────────────────────────────────────┘
                  │ gRPC
                  ▼
┌─────────────────────────────────────────────────────────────┐
│                       USER SERVICE                           │
│  - Quản lý profile (auth_id, serverName, gameName, stats)   │
│  - Composite unique (auth_id, serverName)                   │
│  - createProfile, getProfile, findByAuthAndServer           │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│                       PAY SERVICE                            │
│  - Ví tiền gắn với auth_id (không gắn với profile)          │
│  - Cross-server: 1 ví dùng cho mọi nhân vật                 │
└─────────────────────────────────────────────────────────────┘
```

### Database schema chính

```
AuthEntity:
  id (PK), username (unique), password, email, role, tokenVersion, biBan

User_Entity (profile):
  id (PK)
  auth_id (FK ảo, không unique)
  serverName
  gameName
  + composite unique (auth_id, serverName)
  + index (auth_id, serverName)
  ... (stats, position, inventory)

PayEntity:
  id (PK), auth_id (FK ảo, unique), balance, ...
```

### Token structure

#### Phase 1 token (sau verify OTP)

```json
{
  "authId": 100,
  "username": "dragon123",
  "role": "USER",
  "scope": "select_server",
  "tokenVersion": 1,
  "exp": "1d"
}
```

**Dùng cho:** Xem/sửa thông tin tài khoản, xem ví, lịch sử nạp, danh sách server, gọi `getTokenGame`, gọi `createProfile`.

#### Phase 2 token (sau khi chọn server)

```json
{
  "authId": 100,
  "profileId": 101,
  "serverName": "Rồng Đỏ",
  "role": "USER",
  "scope": "game",
  "tokenVersion": 1,
  "exp": "1d"
}
```

**Dùng cho:** Mọi game API — di chuyển, chiến đấu, inventory, mua bán, claim quà sự kiện theo nhân vật.

### Phân quyền theo endpoint

| Endpoint | Token cần | Note |
|---|---|---|
| `POST /register` | Public | Tạo auth + pay (chưa có profile) |
| `POST /login` | Public | Trả sessionId tạm để verify OTP |
| `POST /verify-otp` | Public | Trả token1 |
| `GET /servers` | Public | List server, status (online/maintenance) |
| `GET /me` | Token1 | Profile tài khoản (email, role) |
| `GET /pay/balance` | Token1 | Số dư ví |
| `GET /pay/history` | Token1 | Lịch sử nạp |
| `POST /auth/get-token-game` | Token1 | Nhận token2 cho server đã chọn |
| `POST /profiles` | Token1 | Tạo nhân vật mới ở server |
| `POST /game/play` | Token2 | Vào game, tạo session |
| `POST /game/move` | Token2 | Di chuyển |
| `POST /game/buy-item` | Token2 | Mua item |
| `GET /admin/users/:id` | Token1 + ADMIN | Admin xem user khác |

---

## 5. Flow implementation chi tiết

### 5.1 Flow đăng ký

```
[Client] register(username, password)
   ↓
[Auth Service]
   - Validate username (không phải email format)
   - Check duplicate
   - Hash password
   - Transaction: tạo AuthEntity + outbox event
   ↓
[Pay Service] createPay(authId)
   - Tạo ví, balance = 0
   ↓
Trả về: { success: true, authId }

KHÔNG tạo User_Entity (profile) ở bước này. Profile được tạo lazy khi user chọn server lần đầu.
```

**Lưu ý:** So với 1-1-1 cũ, register KHÔNG còn nhận `gameName` và KHÔNG gọi user-service. Đơn giản hơn.

---

### 5.2 Flow đăng nhập

```
[Client] login(username, password)
   ↓
[Auth Service]
   - Verify password (bcrypt compare)
   - Check rate limit (5 lần sai → khóa 10 phút)
   - Generate OTP 6 số → cache Redis 5 phút
   - Emit email với OTP
   ↓
Trả về: { sessionId } (base64 username, tạm)

[Client] verifyOtp(sessionId, otp)
   ↓
[Auth Service]
   - Decode sessionId → username
   - Check OTP từ cache
   - Issue token1 { authId, scope: 'select_server', tokenVersion }
   ↓
Trả về: { access_token, refresh_token, role }
```

---

### 5.3 Flow chọn server và nhận token 2

```
[Client] GET /servers (background prefetch)
   ↓
Trả về: list server với status online/maintenance/full

[Client] User click server X → POST /auth/get-token-game
   Body: { serverName: "Rồng Đỏ" }
   Header: Authorization: Bearer <token1>
   ↓
[Auth Service]
   - Verify token1, check scope === 'select_server'
   - Verify server "Rồng Đỏ" tồn tại và online
   - gRPC → User Service: findByAuthAndServer(authId, "Rồng Đỏ")
   ↓
   ├── CÓ profile:
   │   - Issue token2 { authId, profileId, serverName, scope: 'game' }
   │   - Trả về { access_token, refresh_token }
   │
   └── KHÔNG có profile:
       - Trả về 404 NOT_FOUND với message "no_profile"
```

---

### 5.4 Flow tạo nhân vật mới (lần đầu vào server)

```
Client nhận 404 từ get-token-game
   ↓
Client hiển thị UI tạo nhân vật:
   - Input: gameName
   - (Tùy game) chọn class, chọn avatar
   ↓
[Client] POST /profiles
   Body: { serverName: "Rồng Đỏ", gameName: "DragonSlayer" }
   Header: Authorization: Bearer <token1>
   ↓
[User Service]
   - Verify token1
   - Validate gameName (length, ký tự, profanity filter)
   - Try insert User_Entity với (authId, serverName, gameName)
   - Composite unique constraint → idempotent nếu trùng
   - Tạo default stats (vàng 1000, ngọc 20, sức mạnh 2000)
   - Tạo default position (Nhà Gôhan, x=100, y=175)
   ↓
   Trả về: { profile, profileId }

Client tự động gọi lại getTokenGame để nhận token2
   ↓
Vào game
```

---

### 5.5 Flow vào game (sau khi có token 2)

```
[Client] POST /game/play
   Header: Authorization: Bearer <token2>
   ↓
[Game Service]
   - Guard: scope === 'game' && profileId tồn tại
   - Lua script atomic ở Redis:
     * GETSET key=profile:{profileId}:gameSession value=newSessionId
     * Nếu có oldSession → emit kick socket
   - Trả về: { gameSessionId, profile }
   ↓
[Client] WebSocket connect với gameSessionId
   ↓
[WebSocket Gateway]
   - Verify token2 + serverName matches game server
   - Authorize connection
   ↓
Vào game thật sự
```

---

### 5.6 Flow đổi server giữa session

```
User đang ở server "Rồng Đỏ" muốn chuyển sang "Phượng Hoàng"
   ↓
Client check hashmap cache: token2["Phượng Hoàng"] có không?
   ├── Có và còn hạn → dùng luôn
   └── Không / hết hạn → POST /auth/get-token-game(server="Phượng Hoàng")
   ↓
Disconnect WS hiện tại (nếu có)
   ↓
Dùng token2 mới gọi POST /game/play
   ↓
WS connect mới → vào game ở server mới
```

---

## 6. Race condition và idempotency

### Race condition 1: User click "Tạo nhân vật" 2 lần liên tiếp

**Vấn đề:** 2 request POST /profiles cùng lúc → cả 2 đi qua check `findByAuthAndServer` → cả 2 cùng insert → 1 thành công, 1 fail (composite unique).

**Giải pháp:** DB-level composite unique + handle gracefully ở application:

```
try INSERT
catch DUPLICATE_KEY:
  → query existing record
  → return như success (idempotent)
```

User không thấy lỗi, UX mượt.

---

### Race condition 2: User mở 2 tab/device cùng login

**Vấn đề:** Cả 2 đều có token2 hợp lệ → cùng gọi /play → cùng tạo session.

**Giải pháp:** Lua script ATOMIC ở Redis:

```lua
local oldId = redis.call('GETSET', key, newId)
redis.call('EXPIRE', key, ttl)
if oldId then return oldId end
return false
```

`GETSET` là atomic — chỉ 1 trong 2 request thấy `oldId = nil`, request kia thấy `oldId` của request đầu → kick session đầu, giữ session sau. Không bao giờ có 2 session cùng tồn tại.

**Key đúng:** `profile:{profileId}:gameSession` — KHÔNG phải `auth:{authId}` vì 1 auth có nhiều profile ở nhiều server, có thể chạy song song.

---

### Race condition 3: Token revoke khi user đang chơi

**Vấn đề:** Admin ban user → bump tokenVersion. Nhưng user vẫn có token2 cũ trong tay, vẫn gọi API được.

**Giải pháp:** Token version check ở Guard với cache:

```
Guard check:
  cached_version = cache.get(`TOKEN_VER:${authId}`)
  nếu miss → query DB, cache 10 phút
  
  nếu token.tokenVersion !== cached_version → 401

Khi admin ban:
  - DB update tokenVersion += 1
  - Cache invalidate `TOKEN_VER:${authId}`
  
Trong 10 phút worst case (cache TTL), user vẫn dùng được. Có thể giảm TTL hoặc pub/sub invalidate nếu cần realtime.
```

---

### Race condition 4: Outbox event khi server crash

**Vấn đề:** Auth tạo xong, đang gọi pay-service thì server crash → có auth nhưng không có pay.

**Giải pháp:** Outbox pattern + Saga:

```
Transaction:
  - Insert AuthEntity
  - Insert OutboxEvent { type: 'create_pay', authId, status: 'PENDING' }
COMMIT (cả 2 cùng commit hoặc cùng rollback)

Fast path:
  - Gọi pay-service ngay
  - Thành công → update outbox.status = 'DONE'
  - Thất bại → compensate (xóa auth) hoặc retry

Cron fallback (5 giây/lần):
  - Pick up outbox PENDING
  - Optimistic lock: UPDATE WHERE status='PENDING' SET status='PROCESSING'
  - Retry với exponential backoff
  - Hết retry → compensate

Stuck recovery (30 giây/lần):
  - PROCESSING quá 5 phút → reset về PENDING
```

---

### Race condition 5: Concurrent token refresh

**Vấn đề:** Mobile có thể có nhiều thread cùng refresh token khi cận hạn → multiple refresh calls.

**Giải pháp ở client:** Single-flight pattern — chỉ 1 thread refresh, các thread khác chờ kết quả của thread đó.

**Giải pháp ở server:** Refresh token có `jti` (unique ID) — track jti đã dùng để chống replay (optional, tùy mức security).

---

## 7. Thay đổi phía client

### 7.1 Game client (desktop)

#### Storage strategy

```
Token 1 (access + refresh):
  - Lưu file/keychain (persistent)
  - Vẫn còn sau khi tắt app
  - Dùng để auto-login lần sau

Token 2 (access + refresh):
  - HashMap trong RAM theo serverName
  - Mất khi tắt app
  - Tắt app = out game = phải chọn server lại (đúng behavior game)
```

#### State machine UI

```
[Login Screen] 
   └─ verify OTP →
[Server Selection Screen]
   ├─ Click server đã chơi (cache có token2) → vào game thẳng
   ├─ Click server chưa có nhân vật → 404 →
   │  [Create Character Screen]
   │     └─ Submit gameName → tạo profile + token2 → vào game
   └─ Click server đã có nhân vật (cache miss) →
      get-token-game → token2 → vào game
```

#### So với flow cũ (1-1-1)

| Thay đổi | Cũ | Mới |
|---|---|---|
| Sau verify OTP | Vào thẳng game | Vào màn chọn server |
| Tạo nhân vật | Lúc đăng ký | Lúc lần đầu vào server |
| Số token | 1 | 2 |
| Khi đổi server | Không có khái niệm | get-token-game lấy token mới |

---

### 7.2 Web portal (user)

#### Storage strategy

```
Token 1:
  - HttpOnly Cookie (chống XSS đọc được)
  - Secure flag (HTTPS only)
  - SameSite=Lax (chống CSRF cơ bản)

Token 2:
  - sessionStorage hoặc memory
  - Mất khi đóng tab (đúng behavior)
  - HashMap theo serverName để cache
```

#### Trigger chọn server — Lazy

User vào web bình thường, không bị ép chọn server. Chỉ khi click vào trang cần token 2 mới popup chọn server:

```
Trang KHÔNG cần chọn server:
  - Trang chủ
  - Profile tài khoản (email, đổi mật khẩu, 2FA)
  - Số dư ví
  - Lịch sử nạp tiền
  - Forum, CSKH

Trang CẦN chọn server (popup khi click):
  - Xem nhân vật
  - Đăng bán vật phẩm in-game
  - Nạp vàng/ngọc cho nhân vật cụ thể
  - Claim quà sự kiện
  - Bảng xếp hạng theo server (có thể public, không cần token)
```

#### Pseudo flow

```
User click "Đăng bán vật phẩm"
  ↓
Check sessionStorage có token2 không?
  ├── Có → dùng luôn
  └── Không →
     Popup "Vui lòng chọn server"
     User chọn → get-token-game → cache vào sessionStorage
     ↓
Render trang đăng bán với data từ token2
```

---

### 7.3 Web admin panel

#### Khác biệt quan trọng

Admin **không dùng pattern token 2** vì admin có quyền cross-account, cross-server. Token 2 chỉ ký cho 1 profileId của chính user — không phù hợp admin xem profile của user khác.

```
Admin login → token1 { authId, role: 'ADMIN', scope: 'admin' }

Admin endpoint:
  - Guard: token1 + role === 'ADMIN'
  - Truyền profileId/userId/serverName qua query/path param
  - Server query trực tiếp, không cần token 2
```

#### Endpoint riêng cho admin

```
GET /admin/users → list all users
GET /admin/profiles?serverName=X → list profiles theo server
PATCH /admin/profiles/:id/ban → ban nhân vật
GET /admin/profiles/:id → xem chi tiết
POST /admin/profiles/:id/transfer → chuyển vàng
```

Tất cả đều check `role === 'ADMIN'`, không dùng token 2.

---

## 8. Các game nổi tiếng làm như nào

### 8.1 World of Warcraft (Blizzard)

Pattern y hệt design này:

```
1. Battle.net account login → Battle.net session
2. WoW client connect → realm list (server list)
3. User chọn realm → realm authentication ticket (= token 2)
4. Connect realm → tạo character hoặc chọn character có sẵn
5. Vào game
```

Mỗi realm có character pool riêng. Account có thể có nhân vật ở nhiều realm. Mỗi realm cần re-authenticate ticket — KHÔNG dùng Battle.net session trực tiếp cho game traffic.

**Tham khảo:** Battle.net account có thể có tối đa 8 WoW licenses, mỗi realm có thể có 10 nhân vật, tổng 50 nhân vật/account.

---

### 8.2 Final Fantasy XIV (Square Enix)

```
1. Square Enix account login → SE session
2. Service account selection (mỗi account có thể có nhiều service account)
3. World (server) selection → world session
4. Character selection trong world đó
5. Vào game
```

Cấu trúc 3 cấp: Square Enix Account → Service Account → World → Character. Tương đương 3 phase token nếu áp pattern JWT.

---

### 8.3 Lost Ark (Smilegate / Amazon)

```
1. Steam login → Steam ticket
2. Server selection → server-specific token
3. Roster (list nhân vật trên server đó)
4. Character selection
5. Vào game
```

Roster là khái niệm "danh sách nhân vật trên 1 server". Mỗi server roster độc lập.

---

### 8.4 MapleStory (Nexon)

```
1. Nexon account login
2. World selection (server)
3. Channel selection (sub-server)
4. Character selection / creation
5. Vào game
```

MapleStory có thêm cấp "channel" — chia nhỏ trong 1 world để load balance, nhưng concept tổng giống nhau.

---

### 8.5 Ngọc Rồng Online (game tham chiếu)

```
1. Login
2. Chọn server (server 1, 2, 3, Test)
3. Vào game (1 nhân vật / server / account)
```

Pattern đơn giản hóa của design này — 1 nhân vật/server, không có character selection screen sau khi chọn server.

---

### 8.6 So sánh tổng hợp

| Game | Account-level auth | Server/Realm auth | Character selection |
|---|---|---|---|
| WoW | Battle.net session | Realm ticket | Trong realm |
| FFXIV | SE session | World session | Trong world |
| Lost Ark | Steam ticket | Server token | Trong roster |
| MapleStory | Nexon session | World + Channel | Trong world |
| NRO | Login session | (gắn cùng) | 1 char/server |
| **Design này** | **Token 1** | **Token 2** | **createProfile lần đầu** |

**Kết luận:** Pattern 2 phase token này không phải mới phát minh — đã được industry xác nhận 20+ năm. Sự khác biệt chỉ là cài đặt cụ thể (ticket vs JWT vs session).

---

## 9. Security checklist

### Authentication

- [x] Password hash bằng bcrypt (cost ≥ 10)
- [x] Rate limit login (5 lần sai → khóa 10 phút)
- [x] OTP 6 số, TTL 5 phút, dùng `crypto.randomInt` (không phải `Math.random()`)
- [x] Email alert khi tài khoản bị khóa
- [x] 2FA qua OTP email

### Authorization

- [x] JWT signed (HS256 hoặc RS256)
- [x] Scope-based access control (token1 vs token2)
- [x] Token version để revoke
- [x] Composite unique `(authId, serverName)` ở DB
- [x] Verify ownership qua signed token, KHÔNG qua client input
- [x] Refresh token có scope riêng (không reuse cho access)

### Transport

- [x] HTTPS bắt buộc (TLS 1.2+)
- [x] HSTS header
- [x] HttpOnly cookie cho web (chống XSS đọc token)
- [x] CORS strict whitelist

### Application

- [x] Validate input (gameName length, ký tự cho phép)
- [x] Profanity filter cho gameName
- [x] Anti-bot ở createProfile (rate limit theo authId + IP)
- [x] SQL injection prevention (dùng ORM/prepared statements)
- [x] Idempotency cho operations quan trọng

### Operational

- [x] Log mọi failed login attempt
- [x] Alert khi có suspicious activity (nhiều failed login từ 1 IP)
- [x] Backup DB định kỳ
- [x] Disaster recovery plan

---

## 10. Operational concerns

### 10.1 Server maintenance

`GET /servers` trả status mỗi server:

```json
[
  { "name": "Rồng Đỏ", "status": "online", "load": "high" },
  { "name": "Phượng Hoàng", "status": "maintenance", "until": "2026-04-28T03:00Z" },
  { "name": "Bạch Hổ", "status": "online", "load": "normal" }
]
```

`getTokenGame` check status trước khi issue token2 → reject với code rõ ràng nếu maintenance.

### 10.2 Server full

Nếu server đạt giới hạn concurrent users, có thể:
- Reject `getTokenGame` với code `SERVER_FULL`
- Hoặc cấp token2 + cho vào hàng đợi (queue) như WoW làm

### 10.3 Migration data giữa các server

Nếu user muốn chuyển nhân vật từ server A → server B (paid feature):
- Endpoint riêng `POST /admin/profiles/:id/transfer-server`
- Lock profile trong quá trình transfer
- Update `serverName`
- User cần `getTokenGame` mới (token cũ với serverName cũ vẫn valid trong TTL)
- Bump tokenVersion để invalidate token cũ ngay

### 10.4 Observability

Log + metric quan trọng:

- Số lượng `getTokenGame` per server (đo popularity)
- Số `createProfile` mới mỗi ngày (đo growth)
- Latency của các endpoint critical (login, getTokenGame, /play)
- Failed token verification rate (đo brute force / replay attack)
- Outbox processing lag (đo health của saga)

### 10.5 Cost optimization

JWT verify rất rẻ (CPU only) nhưng nếu scale lớn có thể:
- Cache decoded payload trong process (LRU cache)
- Dùng `kid` header để rotate key dễ hơn
- Asymmetric key (RS256) cho phép service không cần biết secret để verify

---

## 11. FAQ

### Q1: Tại sao token2 cần `serverName` trong payload, không chỉ `profileId`?

**A:** `profileId` là PK của bảng users — query 1 cái là biết nhân vật ở server nào. Nhưng có `serverName` trong token cho phép:

- WS gateway reject nhanh nếu kết nối sai server (không cần query DB)
- Game server logic biết ngay context mà không cần load profile
- Audit log rõ ràng hơn

Trade-off: token to hơn vài chục bytes — không đáng kể.

---

### Q2: Token 1 có cần `serverName` không?

**A:** KHÔNG. Token 1 issued trước khi user chọn server, không có context server. Nếu nhét vào sẽ phá nguyên tắc least-privilege.

---

### Q3: Refresh token có cần scope không?

**A:** CÓ. Refresh token nên có scope khác access token (vd `refresh:select_server` vs `refresh:game`). Lý do: nếu attacker steal access token, không refresh được. Nếu steal refresh token, không gọi được API trực tiếp. Defense in depth.

---

### Q4: Cache token 2 ở client bao lâu?

**A:** Không quá TTL của access token (1 ngày). Khi expire → refresh hoặc gọi getTokenGame mới. Khi user logout → clear toàn bộ hashmap.

---

### Q5: Scale nhiều region (US, EU, Asia) thì sao?

**A:** Mỗi region có thể có auth-service riêng, hoặc shared auth-service nhưng game-service riêng. Token có thể thêm `region` claim nếu cần. WoW làm region-locked — token EU không dùng được ở US.

---

### Q6: Có cần encrypt JWT không (JWE)?

**A:** Thường không. JWT signed (JWS) đủ vì payload không chứa data nhạy cảm — chỉ có authId, profileId, scope. Nếu phải lưu PII trong token (hiếm) thì dùng JWE.

---

### Q7: Khi user đổi mật khẩu, token có invalid không?

**A:** Bump `tokenVersion` ở AuthEntity → invalidate cache → tất cả token cũ (cả token1, token2 mọi server) đều fail. User cần login lại.

---

### Q8: Web admin xem nhân vật của user — có nguy hiểm không?

**A:** Không nếu làm đúng:
- Admin endpoint check `role === 'ADMIN'` strict
- Log mọi action admin (audit trail)
- 2FA bắt buộc cho admin
- IP whitelist nếu có thể
- Separate admin panel (subdomain riêng, network khác)

---

### Q9: Nếu game không có multi-server thì pattern này có over-engineering không?

**A:** CÓ thể. Nếu chắc chắn game 1-1-1 mãi mãi, dùng 1 token đơn giản hơn. Nhưng nếu có khả năng scale lên multi-server trong tương lai, design 2 phase token từ đầu rẻ hơn refactor sau.

---

### Q10: "Bạn tôi nói cách này phức tạp quá, không cần" — đáp lại sao?

**A:** Cách "đơn giản" mà bạn họ đề xuất (trust client với serverName) là **broken security**, không phải simplicity. Đơn giản và đúng > phức tạp và đúng > đơn giản và sai. Cách này (2 phase token) là **đơn giản nhất mà vẫn đúng** cho multi-server. Đơn giản hơn nữa = hy sinh security = không chấp nhận được.

---

### Q11: Phân biệt "trust client" (Sai lầm 1) và "ownership check ở server" (Sai lầm 5)?

**A:** Đây là 2 design KHÁC NHAU về security baseline:

- **Sai lầm 1** (trust client): Server KHÔNG verify ownership → có IDOR vulnerability → BROKEN SECURITY
- **Sai lầm 5** (ownership check): Server CÓ verify `profile.auth_id === token.authId` → KHÔNG có IDOR → SECURE nhưng inferior

Sai lầm 5 không phải "broken", chỉ là kém hơn token 2 ở:
- Performance (query DB mỗi request)
- Scope blur (token 1 quyền lực quá)
- Không native multi-server
- Không granular revoke
- Audit trail kém rõ

Khi tranh luận với người đề xuất Sai lầm 5, đừng dùng argument "không secure" (vì họ check ownership rồi). Dùng argument về performance, scope, multi-server, granularity — đó mới là điểm khác biệt thật.

---

### Q12: Vậy có khi nào nên dùng Sai lầm 5?

### Q12: Vậy có khi nào nên dùng Sai lầm 5?

**A:** CÓ, trong các trường hợp:

- Web app CRUD thông thường (không phải game realtime)
- Game scale rất nhỏ (< 100 concurrent users)
- Single server, không có kế hoạch scale lên multi-server
- Team nhỏ, ưu tiên code đơn giản dễ hiểu hơn performance

**Không** dùng khi:
- Production MMO multi-server
- Traffic ≥ 1000 req/s
- Có in-app purchase
- Cần granular access control hoặc audit trail rõ

Nếu game của bạn dự kiến scale lên multi-server trong tương lai, design 2 phase token từ đầu rẻ hơn refactor sau khi đã có user.

---

### Q13: "findOne by PK là O(1), Token 2 cũng cần query profile — khác gì?"

**A:** Argument này **đúng phần lớn**. Trong 80% endpoint game (cần load profile để xử lý logic), cả 2 design đều có 1 query DB. Performance gần như tương đương.

**Khác biệt thật nằm ở 4 chỗ:**

1. **Endpoint không cần profile data** (heartbeat, leaderboard, server-status)
   - Sai lầm 5: 1 query (để verify ownership)
   - Token 2: 0 query

2. **Endpoint chỉ cần subset data** (move chỉ cần update position)
   - Sai lầm 5: 2 query (verify + update)
   - Token 2: 1 query (chỉ update)

3. **Cross-service authorization** (Pay service trừ tiền)
   - Sai lầm 5: cần gRPC sang User Service verify ownership
   - Token 2: tự verify JWT, không cross-call

4. **Multi-profile operation** (transfer item giữa 2 profile)
   - Sai lầm 5: query verify cả 2 profile
   - Token 2: token đã ký rằng caller chính là profile A

**Kết luận:** Token 2 vượt trội ở **kiến trúc microservice**, không phải ở performance đơn lẻ. Càng nhiều service riêng (Pay, Inventory, Mail, Guild, Auction), lợi thế càng rõ.

**Cách đáp lại fair:**

> "Bạn nói đúng — findOne by PK không đắt, và Token 2 cũng query profile cho logic. Trong monolith với endpoint cần load profile, performance gần như tương đương. Khác biệt thực sự là khi có microservice: mỗi service (Pay, Inventory) phải tự verify được mà không cần consult User Service. Token 2 cho phép điều đó, Sai lầm 5 thì không."

Đừng cãi cùn "Token 2 nhanh hơn" — vì trong nhiều case không nhanh hơn thật. Tập trung vào **lý do thật**: kiến trúc microservice, scope rõ ràng, granular control.

---

### Q14: "Vậy nếu game của tôi monolith, không có microservice, thì có cần Token 2 không?"

**A:** Cân nhắc trade-off:

**Nếu monolith và không có kế hoạch tách microservice:**
- Performance khác biệt không đáng kể
- Sai lầm 5 đơn giản hơn (1 token, 1 set of code)
- Có thể dùng Sai lầm 5 nếu ưu tiên simplicity **VÀ KHÔNG CÓ WEBSOCKET REALTIME**

**Nhưng nếu game có WebSocket realtime (như hầu hết MMO):**
- Sai lầm 5 không kiểm soát được tốt (xem Q15)
- Phải dùng Token 2

**Cân nhắc Token 2 ngay cả với monolith vì:**

1. **Scope rõ ràng** — token 1 không call được game API là biên giới security tốt
2. **Multi-server native** — nếu sau này thêm server, không cần refactor lớn
3. **Granular revoke** — ban từng nhân vật riêng được
4. **WebSocket-safe** — kiến trúc enforce, không phụ thuộc dev cẩn thận
5. **Future-proof** — game thành công thường tách microservice, design Token 2 từ đầu rẻ hơn refactor sau

**Kết luận:** Nếu chỉ HTTP CRUD đơn giản, monolith, scale nhỏ → Sai lầm 5 OK. Nếu có WebSocket hoặc realtime gameplay → Token 2.

---

### Q15: "Tại sao Sai lầm 5 đặc biệt nguy hiểm với WebSocket realtime game?"

**A:** WebSocket khác HTTP ở 1 điểm cốt lõi:

```
HTTP:       request → verify → xử lý → đóng
WebSocket:  connect → giữ connection lâu (hàng giờ) → nhận N event
```

→ Verify ở thời điểm connect rồi sau đó **trust cho cả phiên**. Thiếu sót ở handshake = thiếu sót cho toàn phiên.

Với Sai lầm 5, token 1 không có `profileId` và `serverName`. Khi WS connect, client phải gửi 2 thông tin này qua handshake → server **trust client cho việc xác định scope phiên**. Tích lũy thành 6 bug:

1. **Trust client cho profileId/serverName** — phụ thuộc dev nhớ check đầy đủ
2. **Cross-server attack** — khai sai serverName, nếu code quên check là exploit được
3. **Reconnect attack** — token mới + profileId cũ vẫn pass verify
4. **TOCTOU sau connect** — verify chỉ ở handshake, profile thay đổi sau không re-verify
5. **Multi-tab confusion** — không biết key Redis nên dùng authId hay profileId
6. **Scope blur** — token 1 (TTL dài) bị steal = compromise mọi profile

Token 2 enforce qua kiến trúc:
```
JWT đã ký { authId, profileId, serverName, scope: 'game' }
→ Mọi thông tin trusted, không có gì client khai
→ Dev không có cơ hội mắc bug
```

**Insight quan trọng:** Sai lầm 5 với HTTP đơn lẻ là chấp nhận được. Sai lầm 5 với WebSocket realtime là **insidious** — bề ngoài đúng, sâu thì lỏng, bug tích lũy theo thời gian. Nếu game có realtime gameplay, Token 2 không phải tùy chọn — là yêu cầu kỹ thuật.

---

## Tham khảo

- [OWASP Top 10 — A01 Broken Access Control](https://owasp.org/Top10/A01_2021-Broken_Access_Control/)
- [OWASP Top 10 — A04 Insecure Design](https://owasp.org/Top10/A04_2021-Insecure_Design/)
- [RFC 7519 — JSON Web Token](https://datatracker.ietf.org/doc/html/rfc7519)
- [microservices.io — JWT-based authorization](https://microservices.io/post/architecture/2025/07/22/microservices-authn-authz-part-3-jwt-authorization.html)
- [Battle.net Account Architecture](https://wowwiki-archive.fandom.com/wiki/Account)

---

## Lời kết

Design này được rút ra từ:
- Pattern industry-standard của các MMO 20+ năm
- Nguyên tắc bảo mật nền tảng (never trust client)
- Trade-off thực tế giữa performance, security, complexity
- Phân tích từ first principles, không copy máy móc

Nếu bạn đang implement và gặp tình huống chưa cover trong tài liệu này, quay về 3 câu hỏi gốc:

1. **Authorization data của tôi đang đến từ trusted source chưa?** (ký bằng JWT, không phải client gửi)
2. **Endpoint này nên cần token nào?** (dựa trên dữ liệu nó đụng tới — auth-level hay profile-level)
3. **Có race condition nào không?** (idempotency ở DB, atomic ở Redis)

Nắm chắc 3 câu này, mọi quyết định sẽ đi đúng hướng.

---

*Tài liệu được viết ngày 2026-04-27, dựa trên design thực tế và research industry pattern. Cập nhật khi cần.*