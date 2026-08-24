# Cache Strategy — API Documentation

## Bảng tiêu chí chọn cache

| Tình huống | Chiến lược cache |
|---|---|
| Dữ liệu **ít được xem**, nhưng mỗi lần xem thì **phải gọi nhiều bảng** hoặc **tốn CPU/DB** (query phức tạp, join nhiều bảng, tính toán nặng); dữ liệu **thay đổi thường xuyên** và **chỉ thuộc về 1 user cụ thể** | 🔵 **Lazy cache** |
| Dữ liệu **được xem rất nhiều** bởi nhiều user cùng lúc (high read traffic); **thay đổi chậm** (không cập nhật liên tục); **dùng chung cho tất cả hoặc nhiều user** (không phân biệt theo từng người) | 🟢 **Prefetch / Cron job** |
| Dữ liệu **luôn thay đổi theo từng request** (realtime); hoặc **cực kỳ nhạy cảm** (tài chính, xác thực, bảo mật); hoặc là **write operation** (POST/PUT/PATCH/DELETE) — đọc stale data ở đây có thể gây **lỗi nghiệp vụ hoặc lỗ hổng bảo mật** | ❌ **Không cache** |

---

## Chi tiết từng API

---

### 🔐 Api Auth

#### ❌ Không cache — `/auth/login`, `/auth/register`, `/auth/verify-otp`, `/auth/refresh`, `/auth/change-password`, `/auth/change-email`, `/auth/change-avatar`, `/auth/request-reset-password`, `/auth/reset-password`, `/auth/change-role-partner`

**Lý do:** Đây là các endpoint **xác thực và thay đổi trạng thái** — dữ liệu luôn thay đổi (token, password, OTP có TTL ngắn), cực kỳ sensitive, và bản chất là **write operation**. Cache bất kỳ bước nào trong luồng auth có thể gây lỗ hổng bảo mật nghiêm trọng (replay attack, stale token).

#### 🔵 Lazy cache — `GET /auth/profile/{id}`

**Lý do:** Profile của 1 user cụ thể — user-specific, không được xem quá thường xuyên, có thể thay đổi bất cứ lúc nào (đổi avatar, email). Lazy cache hợp lý: chỉ cache khi có request, invalidate khi user cập nhật profile.

- **TTL đề xuất:** 5–10 phút
- **Key:** `auth:profile:{id}`
- **Invalidate khi:** `PATCH /auth/change-avatar`, `PATCH /auth/change-email` được gọi

#### 🟢 Prefetch / Cron job — `GET /auth/all-user`

**Lý do:** Danh sách tất cả user để kết bạn — **shared cho nhiều user**, được xem nhiều (mỗi người đều cần danh sách này), thay đổi chậm (user mới không đăng ký liên tục). Prefetch hoặc cron job refresh định kỳ sẽ hiệu quả hơn là cache per-request.

- **TTL đề xuất:** 5–15 phút
- **Key:** `auth:all-user`
- **Cron:** Refresh mỗi 10 phút hoặc invalidate khi có user mới đăng ký

---

### 👤 Api User

#### ❌ Không cache — `PATCH /user/add-vang-web`, `PATCH /user/add-ngoc-web`, `PATCH /user/use-vang-web`, `PATCH /user/use-ngoc-web`, `POST /user/add-item-web`, `DELETE /user/use-item-web`, `PUT /user/save-game`, `GET /user/heart-beat`

**Lý do:**
- Các endpoint **thay đổi số dư / tài nguyên**: dữ liệu thay đổi mỗi lần gọi, cần độ chính xác tuyệt đối, không được phép đọc stale data (có thể gây exploit trùng lặp tài nguyên).
- `heart-beat`: realtime check online — cache vô nghĩa và sai.

#### 🔵 Lazy cache — `GET /user/profile/{id}`, `GET /user/balance-web`, `GET /user/item-web`

**Lý do:** Đây là dữ liệu **user-specific**, được gọi định kỳ nhưng không quá cao tần. Balance và item-web có thể thay đổi khi user nạp/dùng, nên không nên cache quá dài. Lazy cache phù hợp: chỉ cache khi có request, invalidate khi có write operation liên quan.

- **TTL đề xuất:** 1–3 phút
- **Keys:** `user:profile:{id}`, `user:balance-web:{id}`, `user:item-web:{id}`
- **Invalidate khi:** Các PATCH/POST/DELETE liên quan đến user đó được gọi

#### 🟢 Prefetch / Cron job — `GET /user/top10-suc-manh`, `GET /user/top10-vang`

**Lý do:** Bảng xếp hạng top 10 — **shared cho tất cả user**, được xem rất nhiều (hiển thị trên web), thay đổi chậm (thứ hạng không đảo lộn từng giây). Prefetch hoặc cron job là lựa chọn tối ưu để giảm tải DB.

- **TTL đề xuất:** 5–10 phút
- **Keys:** `user:top10-suc-manh`, `user:top10-vang`
- **Cron:** Refresh mỗi 5 phút

---

### 🎮 Api Game

#### ❌ Không cache — `POST /game/play`

**Lý do:** Đây là điểm vào game — gắn với session, trạng thái realtime của từng user. Cache session game là không an toàn và vô nghĩa.

---

### 🎒 Api Item

#### ❌ Không cache — `PUT /item/items`, `POST /item/item`

**Lý do:** Write operations — thay đổi item trong game. Cache có thể gây mất đồng bộ với game server.

#### 🔵 Lazy cache — `GET /item/user-items`, `POST /item/itemUuids`

**Lý do:** Dữ liệu item của user — user-specific, được game client gọi khi cần (không liên tục). Thay đổi khi user nhặt/bán đồ trong game, nên TTL ngắn.

- **TTL đề xuất:** 1–2 phút
- **Keys:** `item:user-items:{userId}`, `item:uuids:{hash(uuids)}`
- **Invalidate khi:** `PUT /item/items` hoặc `POST /item/item` được gọi

---

### 👥 Api Social Network

#### ❌ Không cache — `POST /social_network/add-friend`, `PATCH /social_network/accept-friend`, `DELETE /social_network/reject-friend`, `DELETE /social_network/unfriend`, `PATCH /social_network/block-user`, `POST /social_network/create-comment`, `PATCH /social_network/update-comment`, `PATCH /social_network/delete-comment`, `POST /social_network/like-comment`, `DELETE /social_network/unlike-comment`, `POST /social_network/create-notification`

**Lý do:** Toàn bộ là write operations — thay đổi trạng thái quan hệ, bình luận, lượt thích. Cache sẽ gây stale data ngay lập tức.

#### 🔵 Lazy cache — `GET /social_network/sent-friend`, `GET /social_network/incoming-friend`, `GET /social_network/all-friend`, `GET /social_network/notification`

**Lý do:** Dữ liệu user-specific, thay đổi khi có hành động kết bạn / thông báo mới. Lazy cache với TTL ngắn phù hợp, invalidate khi có write.

- **TTL đề xuất:** 1–3 phút
- **Keys:** `social:sent:{userId}`, `social:incoming:{userId}`, `social:friends:{userId}`, `social:notification:{userId}`
- **Invalidate khi:** Có thay đổi quan hệ bạn bè hoặc thông báo mới

#### 🟢 Prefetch / Cron job — `GET /social_network/all-comment`

**Lý do:** Comment của 1 bài post — **shared cho nhiều user đọc cùng 1 bài**, lượt đọc cao hơn lượt viết nhiều. Prefetch khi bài post được publish, refresh định kỳ hoặc invalidate khi có comment mới.

- **TTL đề xuất:** 2–5 phút
- **Key:** `social:comments:{postId}`
- **Invalidate khi:** Có comment mới, update, hoặc xóa trên `postId` đó

---

### 💬 Api Chat

#### ❌ Không cache — `POST /chat/1-1`, `POST /chat/create-group`, `POST /chat/add-user-group`

**Lý do:** Write operations — tạo room, thêm user. Không có gì để cache.

#### ❌ Không cache — `GET /chat/message`

**Lý do:** Tin nhắn chat là **realtime, luôn thay đổi**. Cache sẽ khiến user không thấy tin nhắn mới — trải nghiệm tệ, không thể chấp nhận.

#### 🔵 Lazy cache — `GET /chat/all-group`

**Lý do:** Danh sách group của user — user-specific, thay đổi khi được thêm vào group mới. Lazy cache với TTL vừa phải.

- **TTL đề xuất:** 3–5 phút
- **Key:** `chat:groups:{userId}`
- **Invalidate khi:** User được thêm vào group mới

---

### 🧙 Api Đệ Tử

#### ❌ Không cache — `PUT /detu/save-game`, `POST /detu/create-de-tu`

**Lý do:** Write operations — lưu và tạo đệ tử.

#### 🔵 Lazy cache — `GET /detu/de-tu`

**Lý do:** Danh sách đệ tử của user — user-specific, thay đổi khi săn được đệ tử mới. Lazy cache phù hợp.

- **TTL đề xuất:** 3–5 phút
- **Key:** `detu:{userId}`
- **Invalidate khi:** `POST /detu/create-de-tu` hoặc `PUT /detu/save-game` được gọi

---

### 💳 Api Pay

#### ❌ Không cache — `POST /pay/create-pay`

**Lý do:** Write operation — tạo ví.

#### ❌ Không cache — `GET /pay/pay`

**Lý do:** Thông tin số dư ví — **sensitive, luôn thay đổi** (nạp/rút tiền). Cache số dư tài chính là cực kỳ nguy hiểm, có thể gây sai lệch giao dịch.

#### 🟢 Prefetch / Cron job — `GET /pay/qr`

**Lý do:** Thông tin QR chuyển khoản — **shared cho tất cả user**, thay đổi rất chậm (chỉ đổi khi thay ngân hàng/số tài khoản). Prefetch khi server khởi động, refresh theo cron.

- **TTL đề xuất:** 30–60 phút
- **Key:** `pay:qr`
- **Cron:** Refresh mỗi giờ hoặc khi admin cập nhật thông tin ngân hàng

---

### 🛡️ Api Admin

#### ❌ Không cache — Tất cả Admin endpoints

**Lý do:** Toàn bộ admin endpoints đều là **write operations nhạy cảm** (ban user, đổi role, cộng/trừ tài nguyên, xóa item, ...). Cache không có ý nghĩa ở đây và có thể gây ra rủi ro bảo mật.

---

### 🏪 Api Partner

#### ❌ Không cache — `POST /partner/create-account-sell`, `PATCH /partner/update-account-sell`, `DELETE /partner/delete-account-sell`, `PATCH /partner/mark-account-sell`, `POST /partner/buy-account-sell`

**Lý do:** Write operations liên quan đến giao dịch mua bán — cần độ chính xác tuyệt đối, không được cache.

#### 🟢 Prefetch / Cron job — `GET /partner/all-account-sell`

**Lý do:** Danh sách acc đang bán — **shared cho tất cả user** xem kho acc, được xem nhiều, thay đổi khi có acc mới hoặc bị mua. Prefetch định kỳ, invalidate khi có thay đổi.

- **TTL đề xuất:** 2–5 phút
- **Key:** `partner:all-accounts`
- **Invalidate khi:** Có tạo, cập nhật, xóa, hoặc đánh dấu bán acc

#### 🔵 Lazy cache — `GET /partner/account-sell/{id}`, `GET /partner/account-sell-by-partner`, `GET /partner/all-account-buyer`

**Lý do:** Dữ liệu chi tiết của 1 acc hoặc danh sách của 1 partner cụ thể — ít được xem hơn, user-specific hoặc partner-specific. Lazy cache phù hợp.

- **TTL đề xuất:** 2–5 phút
- **Keys:** `partner:account:{id}`, `partner:by-partner:{partnerId}`, `partner:buyer:{userId}`
- **Invalidate khi:** Acc liên quan bị cập nhật hoặc mua

---

### 🎛️ Api Player Manager

#### ❌ Không cache — `GET /player_manager/user-online-Ver1`, `GET /player_manager/user-online-Ver2`, `POST /player_manager/send-email`, `POST /player_manager/temporary-ban`, `DELETE /player_manager/temporary-ban/{userId}`

**Lý do:** Trạng thái online là **realtime**. Các ban/unban là write operations nhạy cảm.

#### 🔵 Lazy cache — `GET /player_manager/profile/{id}`, `GET /player_manager/balance-web`, `GET /player_manager/item-web`, `GET /player_manager/user-items`, `GET /player_manager/de-tu`, `GET /player_manager/pay`, `GET /player_manager/temporary-ban-all`

**Lý do:** Admin/Player Manager xem thông tin user cụ thể — không được xem liên tục, user-specific. Lazy cache giúp giảm tải DB khi admin tra cứu nhiều user.

- **TTL đề xuất:** 1–3 phút
- **Keys:** `pm:profile:{id}`, `pm:balance:{id}`, v.v.
- **Invalidate khi:** Dữ liệu user liên quan thay đổi

---

### 💰 Api Finance

#### ❌ Không cache — `POST /finance/create-record`

**Lý do:** Write operation — ghi dòng tiền.

#### ❌ Không cache — `GET /finance/by-user`, `GET /finance/all-record`, `GET /finance/system-cash-flow`

**Lý do:** Dữ liệu tài chính / giao dịch — **sensitive, luôn thay đổi** theo từng giao dịch nạp/rút. Cache số liệu tài chính có thể gây sai lệch nghiêm trọng khi đối soát.

---

### 🏧 Api Cashier

#### ❌ Không cache — `POST /cashier/create-withdraw`, `PATCH /cashier/approve-withdraw`, `PATCH /cashier/reject-withdraw`

**Lý do:** Write operations liên quan đến giao dịch tiền thật — không được cache.

#### ❌ Không cache — `GET /cashier/user-withdraw`, `GET /cashier/all-withdraw`

**Lý do:** Lịch sử rút tiền — **sensitive, thay đổi theo từng request** (pending → approved/rejected). Admin cần xem trạng thái mới nhất để duyệt. Cache có thể khiến admin thấy request đã xử lý, gây xử lý trùng lặp.

---

### ✍️ Api Editor

#### ❌ Không cache — `POST /editor/create-post`, `PATCH /editor/update-post`, `DELETE /editor/delete-post`, `PATCH /editor/lock-post`, `PATCH /editor/unlock-post`

**Lý do:** Write operations — thay đổi nội dung bài viết.

#### 🟢 Prefetch / Cron job — `GET /editor/all-posts`

**Lý do:** Danh sách bài viết — **shared cho tất cả user**, được xem nhiều (trang chủ/feed), thay đổi khi editor đăng bài mới (không liên tục). Prefetch khi server khởi động, invalidate khi có bài mới hoặc xóa bài.

- **TTL đề xuất:** 5–10 phút
- **Key:** `editor:all-posts`
- **Invalidate khi:** Có tạo, cập nhật, xóa, lock/unlock bài viết

#### 🔵 Lazy cache — `GET /editor/post/{id}`, `GET /editor/by-editor`

**Lý do:** Chi tiết 1 bài viết hoặc danh sách bài của 1 editor cụ thể — ít được xem hơn all-posts, nhưng vẫn nên cache để giảm tải khi bài viral.

- **TTL đề xuất:** 5–10 phút
- **Keys:** `editor:post:{id}`, `editor:by-editor:{editorId}`
- **Invalidate khi:** Bài viết liên quan bị cập nhật/xóa/lock

---

### 🤖 Api Open AI

#### ❌ Không cache — `POST /ai/ask`

**Lý do:** Mỗi câu hỏi của user là **duy nhất, realtime**, kết quả phụ thuộc context. Cache AI response là không khả thi và có thể trả về câu trả lời không phù hợp cho user khác.

> **Ngoại lệ có thể xem xét:** Nếu hệ thống có FAQ cố định (câu hỏi lặp lại nhiều lần giống nhau), có thể áp dụng **semantic cache** (dùng vector similarity) — nhưng đây là kỹ thuật nâng cao, không phải cache thông thường.

---

## Tổng hợp

| Chiến lược | Số lượng API | Ví dụ tiêu biểu |
|---|---|---|
| ❌ Không cache | ~40 APIs | `/auth/login`, `/pay/pay`, `/cashier/*`, `/finance/*`, `/game/play`, `/chat/message` |
| 🔵 Lazy cache | ~18 APIs | `/user/profile/{id}`, `/item/user-items`, `/social_network/all-friend`, `/detu/de-tu` |
| 🟢 Prefetch / Cron job | ~6 APIs | `/user/top10-*`, `/editor/all-posts`, `/partner/all-account-sell`, `/pay/qr`, `/auth/all-user` |

---

## Cách triển khai cache

### Công nghệ đề xuất: Redis

**Lý do chọn Redis:**
- In-memory → latency cực thấp (< 1ms)
- Hỗ trợ TTL native → tự động expire
- Pub/Sub → dễ implement cache invalidation event-driven
- Phổ biến, có thư viện cho mọi ngôn ngữ backend

### Pattern Lazy Cache (Cache-Aside)

```
Client → Server → Kiểm tra Redis
                      ├── HIT  → Trả về data từ Redis
                      └── MISS → Query DB → Lưu vào Redis → Trả về data
```

```typescript
async function getWithLazyCache(key: string, ttl: number, fetchFn: () => Promise<any>) {
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached);

  const data = await fetchFn();
  await redis.setex(key, ttl, JSON.stringify(data));
  return data;
}
```

**Invalidation khi có write:**
```typescript
// Sau khi user cập nhật profile
await redis.del(`user:profile:${userId}`);
await redis.del(`auth:profile:${userId}`);
```

### Pattern Prefetch / Cron Job

```
Cron Job (mỗi N phút)
    → Query DB
    → Ghi vào Redis (overwrite)
    → Client luôn đọc từ Redis (không bao giờ miss)
```

```typescript
// cron: mỗi 5 phút
cron.schedule('*/5 * * * *', async () => {
  const top10 = await db.query('SELECT ... ORDER BY suc_manh DESC LIMIT 10');
  await redis.setex('user:top10-suc-manh', 600, JSON.stringify(top10));
});
```

**Lý do chọn Prefetch cho shared data:**
- Không bao giờ có cache miss → response luôn nhanh
- DB chỉ bị query bởi cron, không phải bởi mỗi user request
- Phù hợp khi data shared và traffic cao (top10, all-posts, all-account-sell)

### Event-driven Invalidation (nâng cao)

Thay vì chỉ dùng TTL, có thể invalidate ngay khi có write:

```typescript
// Sau khi tạo bài viết mới
await redis.del('editor:all-posts');
await eventBus.publish('post.created', { postId });
```

Cách này kết hợp tốt nhất: **data luôn fresh** mà không cần TTL ngắn làm tăng cache miss rate.