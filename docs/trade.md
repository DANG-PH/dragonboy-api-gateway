# Trade System — Tài liệu kỹ thuật

## Mục lục

1. [Bài toán đặt ra](#1-bài-toán-đặt-ra)
2. [Tổng quan kiến trúc](#2-tổng-quan-kiến-trúc)
3. [Các giải pháp đã áp dụng](#3-các-giải-pháp-đã-áp-dụng)
4. [Logic Flow chi tiết](#4-logic-flow-chi-tiết)
   - [4.1 trade:request — Gửi yêu cầu giao dịch](#41-traderequest--gửi-yêu-cầu-giao-dịch)
   - [4.2 trade:accept — Chấp nhận giao dịch](#42-tradeaccept--chấp-nhận-giao-dịch)
   - [4.3 trade:offer:add / trade:offer:remove — Quản lý vật phẩm](#43-tradeofferadd--tradeofferremove--quản-lý-vật-phẩm)
   - [4.4 trade:lock — Khóa offer](#44-tradelock--khóa-offer)
   - [4.5 trade:check — Kiểm tra điều kiện](#45-tradecheck--kiểm-tra-điều-kiện)
   - [4.6 trade:confirm — Xác nhận & thực thi](#46-tradeconfirm--xác-nhận--thực-thi)
   - [4.7 trade:cancel — Hủy giao dịch](#47-tradecancel--hủy-giao-dịch)
5. [Redis Key Schema](#5-redis-key-schema)
6. [State Machine của một phiên giao dịch](#6-state-machine-của-một-phiên-giao-dịch)
7. [Tại sao chọn các giải pháp này](#7-tại-sao-chọn-các-giải-pháp-này)
8. [Các điểm cần lưu ý / edge cases](#8-các-điểm-cần-lưu-ý--edge-cases)

---

## 1. Bài toán đặt ra

Hệ thống cần cho phép **hai người chơi trao đổi vật phẩm (item) với nhau theo thời gian thực** trong một game online, đảm bảo:

- **Tính toàn vẹn dữ liệu**: mỗi giao dịch chỉ được thực thi đúng một lần, không bao giờ swap item hai lần dù có race condition.
- **Tính đồng thuận**: cả hai bên đều phải đồng ý trước khi swap diễn ra.
- **Kiểm tra điều kiện thực tế**: người nhận phải đủ chỗ trống trong hành trang.
- **Tránh trạng thái bị treo**: nếu một bên ngắt kết nối hoặc không hành động, session phải tự hết hạn.
- **Chống gian lận**: không cho phép một bên tự ý sửa offer của bên kia hoặc gửi packet giả.

Những thách thức kỹ thuật cốt lõi:

| Thách thức | Biểu hiện |
|---|---|
| Race condition khi confirm | Cả 2 user confirm gần như cùng lúc → swap chạy 2 lần |
| Fake packet | Client gửi `withUserId` tùy ý để thao túng session của người khác |
| Session orphan | Một bên mất kết nối, session bị treo mãi mãi |
| Hành trang không đủ chỗ | Item nhận về không có chỗ lưu, gây lỗi hoặc mất item |

---

## 2. Tổng quan kiến trúc

```
Client A  ──WebSocket──►  Game Gateway (NestJS)  ──►  Redis (state)
Client B  ──WebSocket──►  Game Gateway (NestJS)  ──►  Queue (swap job)
```

- **WebSocket (Socket.IO)**: kênh giao tiếp real-time giữa client và server.
- **Redis**: lưu toàn bộ trạng thái phiên giao dịch (session, offer, lock, confirm, check).
- **Message Queue**: nhận lệnh swap sau khi cả 2 confirm, xử lý bất đồng bộ phía database.
- **Lua Script trên Redis**: đảm bảo các thao tác check-and-set chạy atomic, tránh race condition.

---

## 3. Các giải pháp đã áp dụng

### 3.1 Redis làm shared state

Mọi trạng thái giao dịch đều lưu trên Redis thay vì in-memory của process. Lý do: trong môi trường multi-instance (nhiều server WebSocket), hai người chơi có thể kết nối vào hai instance khác nhau. Redis là nơi duy nhất cả hai đều "nhìn thấy" nhau.

### 3.2 TTL (Time To Live) trên mọi key

Tất cả các key Redis đều đặt `EX 300` (5 phút). Nếu bất kỳ bước nào bị timeout hoặc client ngắt kết nối mà không cancel, Redis tự dọn dẹp, tránh session bị treo vĩnh viễn.

### 3.3 Session ID cố định, không phụ thuộc thứ tự

```
sessionId = min(userId, withUserId) + ':' + max(userId, withUserId)
```

Cả hai phía đều tính ra cùng một `sessionId` mà không cần server trung gian đặt tên. Tránh được tình huống tạo ra hai session riêng biệt cho cùng một cặp giao dịch.

### 3.4 Lua Script cho atomic check-and-execute

Hai điểm trong flow sử dụng Lua Script để đảm bảo tính nguyên tử:

- **`trade:lock`**: SET lock của mình → kiểm tra lock của đối phương → nếu cả hai đã lock thì SET state sang `LOCKED`, tất cả trong một lệnh.
- **`trade:confirm`**: SET confirm của mình → kiểm tra confirm của đối phương → kiểm tra CHECK_OK của cả hai → acquire `EXECUTING` lock bằng `SET NX` → lấy data offer → dọn dẹp toàn bộ key → trả về data. Chỉ một trong hai request thắng được `SET NX`, request còn lại nhận `LOCKED` và dừng.

### 3.5 Phân tách bước Check và Confirm

Thay vì để client confirm ngay sau khi lock, server bắt buộc có bước **`trade:check`** ở giữa. Mục đích: kiểm tra hành trang trước khi cho phép confirm. Nếu một bên không đủ chỗ, hủy ngay tại đây, không để đến lúc swap mới phát hiện lỗi.

### 3.6 Xác thực session trước mọi thao tác

Hàm `getValidSession(userId, withUserId)` được gọi đầu tiên trong hầu hết các handler. Hàm này xác nhận:
- Key `GAME:TRADE:SESSION:${userId}` tồn tại trên Redis.
- Giá trị của key đó khớp với `sessionId` được tính từ cặp `(userId, withUserId)`.

Nếu không khớp, request bị bỏ qua ngay lập tức, ngăn fake packet hoặc replay attack.

---

## 4. Logic Flow chi tiết

### 4.1 `trade:request` — Gửi yêu cầu giao dịch

```
Client A gửi: { targetId: B }
  → Server kiểm tra A có đang trong game không (GAME:PLAYER:A)
  → emit 'trade:request' tới room Game:B
```

Đây chỉ là bước **gửi thông báo**, chưa tạo session. Server chỉ làm relay, kiểm tra A có hợp lệ không trước khi forward.

---

### 4.2 `trade:accept` — Chấp nhận giao dịch

```
Client B gửi: { fromUserId: A }
  → Kiểm tra cả A và B đều không có session đang mở
  → Tính sessionId = min(A,B):max(A,B)
  → Redis MULTI:
      SET GAME:TRADE:SESSION:B = sessionId  (EX 300)
      SET GAME:TRADE:SESSION:A = sessionId  (EX 300)
      SET GAME:TRADE:STATE:sessionId = 'OPEN'  (EX 300)
  → emit 'trade:open' cho cả A và B
```

**Tại sao dùng `MULTI` (pipeline)?** Để tất cả 3 key được set trong một roundtrip tới Redis, giảm latency và đảm bảo tính nhất quán (không có trạng thái nửa vời nếu server crash giữa chừng — dù MULTI của Redis không phải transaction thực sự, nó vẫn đảm bảo tất cả lệnh được gửi atomic về mặt network).

---

### 4.3 `trade:offer:add` / `trade:offer:remove` — Quản lý vật phẩm

```
Client A gửi: { withUserId: B, itemUuid: '...' }
  → getValidSession(A, B) → phải là sessionId hợp lệ
  → state phải là 'OPEN'
  → Kiểm tra GAME:TRADE:LOCK:sessionId:A — nếu đã lock thì từ chối
  → Đọc offer hiện tại của A từ Redis
  → add: kiểm tra trùng → push → ghi lại
  → remove: filter ra → ghi lại
  → emit 'trade:offer:update' tới B (chỉ gửi action + itemUuid, không gửi toàn bộ list)
```

**Tại sao chỉ emit delta (add/remove) thay vì full list?** Giảm bandwidth và tránh vấn đề race condition ở client khi nhiều update đến gần nhau — client tự maintain state local.

**Tại sao server kiểm tra trùng thay vì tin client?** Ngăn client malicious add cùng một item nhiều lần để bypass kiểm tra.

---

### 4.4 `trade:lock` — Khóa offer

Khi người chơi bấm "Lock" (không thay đổi offer nữa):

```
Client A gửi: { withUserId: B }
  → getValidSession → state phải là 'OPEN' hoặc 'LOCKED'
  → Chạy Lua Script (atomic):
      SET GAME:TRADE:LOCK:sessionId:A = 1
      GET GAME:TRADE:LOCK:sessionId:B
        → nếu B chưa lock: return 'WAIT'
        → nếu B đã lock:
            SET GAME:TRADE:STATE:sessionId = 'LOCKED'
            return 'BOTH_LOCKED'
  → Nếu BOTH_LOCKED: emit 'trade:bothLocked' cho cả A và B
```

**Tại sao dùng Lua ở đây?** Nếu dùng GET/SET riêng lẻ: A SET lock của mình, rồi GET lock của B — trong khoảng thời gian đó B cũng SET lock của mình và GET lock của A. Cả hai đều thấy nhau đã lock và cả hai đều SET state sang LOCKED — không có lỗi nghiêm trọng ở bước này nhưng vẫn là race condition tiềm ẩn. Lua đảm bảo chỉ đúng một trong hai mới trigger `SET state = LOCKED`.

---

### 4.5 `trade:check` — Kiểm tra điều kiện

Sau khi nhận `trade:bothLocked`, client tự gọi `trade:check` kèm số ô trống trong hành trang của mình:

```
Client A gửi: { withUserId: B, oConTrongBanThan: N }
  → state phải là 'LOCKED'
  → Lấy offer của B (số item A sẽ nhận)
  → So sánh: N >= số item của B?
      → Không đủ chỗ:
          DEL toàn bộ key của session
          emit 'trade:cancelled' + notification lý do cho cả 2
          return
      → Đủ chỗ:
          SET GAME:TRADE:CHECK_OK:sessionId:A = 1
          GET GAME:TRADE:CHECK_OK:sessionId:B
            → Nếu B cũng đã check OK: emit 'trade:check:ok' cho cả 2
```

**Tại sao client tự báo số ô trống thay vì server query?** Server không có trực tiếp thông tin hành trang real-time của từng player (đó là domain của game service khác). Client là nguồn duy nhất biết trạng thái hành trang hiện tại. Dù vậy, server vẫn là bên quyết định kết quả — client chỉ cung cấp input.

**Rủi ro**: client có thể gian lận bằng cách báo số ô trống cao hơn thực tế. Đây là điểm cần cân nhắc thêm nếu muốn bảo mật cao hơn (server-side inventory query).

---

### 4.6 `trade:confirm` — Xác nhận & thực thi

Đây là bước quan trọng nhất, xử lý race condition triệt để:

```
Client A gửi: { withUserId: B }
  → getValidSession → state phải là 'LOCKED'
  → Chạy Lua Script (atomic):
      SET GAME:TRADE:CONFIRM:sessionId:A = 1
      GET GAME:TRADE:CONFIRM:sessionId:B
        → B chưa confirm: return 'WAIT'
      GET CHECK_OK của A và B
        → Thiếu: return 'NOT_READY'
      SET GAME:TRADE:EXECUTING:sessionId NX EX 30
        → Không set được (đã tồn tại): return 'LOCKED'
      GET offer của A, GET offer của B
      DEL toàn bộ key của session (cleanup)
      return offerA + '|' + offerB
  
  → 'WAIT': notify A đợi
  → 'NOT_READY' / 'LOCKED': bỏ qua silently
  → Data: parse offer → push vào Message Queue để swap → emit 'trade:success'
```

**Tại sao `EXECUTING` lock dùng `SET NX`?** Đây là lớp bảo vệ cuối cùng. Dù Lua đảm bảo atomic, `SET NX` (chỉ set nếu key chưa tồn tại) đảm bảo rằng trong toàn bộ cụm Redis, chỉ duy nhất một request "thắng" và chạy tiếp. Request còn lại nhận `LOCKED` và dừng ngay — không swap, không emit gì thêm.

**Tại sao cleanup xảy ra bên trong Lua Script?** Vì sau khi lấy data và xóa key, không còn điểm nào để rollback. Làm trong Lua đảm bảo data được lấy và key được xóa là một operation duy nhất — không có window để request khác can thiệp.

**Tại sao swap được đẩy vào Queue thay vì xử lý trực tiếp?** Swap liên quan đến database (ghi lại owner của item) — thao tác này có thể chậm và có thể fail. Queue giúp: retry nếu fail, không block WebSocket handler, và dễ audit.

---

### 4.7 `trade:cancel` — Hủy giao dịch

```
Client A gửi: { withUserId: B }
  → GET GAME:TRADE:SESSION:A
  → So sánh với sessionId tính từ (A, B) — không khớp thì bỏ qua
  → DEL toàn bộ key của session (MULTI pipeline)
  → emit 'trade:cancelled' + notification cho cả 2
```

**Tại sao phải verify sessionId trước khi DEL?** Ngăn client gửi packet giả để hủy session của người khác. Ví dụ: A gửi `{ withUserId: C }` trong khi session thực của A là với B — server từ chối vì `SESSION:A` không chứa `A:C`.

---

## 5. Redis Key Schema

| Key | Giá trị | TTL | Mục đích |
|---|---|---|---|
| `GAME:TRADE:SESSION:{userId}` | `sessionId` | 300s | Xác định user đang trong session nào |
| `GAME:TRADE:STATE:{sessionId}` | `OPEN` / `LOCKED` / `CANCELLED` | 300s | Trạng thái hiện tại của session |
| `GAME:TRADE:OFFER:{sessionId}:{userId}` | JSON array `[{itemUuid}]` | 300s | Danh sách item user đang đưa ra |
| `GAME:TRADE:LOCK:{sessionId}:{userId}` | `1` | 300s | User đã lock offer |
| `GAME:TRADE:CHECK_OK:{sessionId}:{userId}` | `1` | 120s | User đã pass kiểm tra hành trang |
| `GAME:TRADE:CONFIRM:{sessionId}:{userId}` | `1` | 300s | User đã confirm giao dịch |
| `GAME:TRADE:EXECUTING:{sessionId}` | `1` | 30s | Mutex lock để chỉ một request thực thi swap |

**Session ID convention**: `min(userA, userB):max(userA, userB)` — đảm bảo cùng một key dù ai là người tính.

---

## 6. State Machine của một phiên giao dịch

```
                   [A gửi request]
                         │
                   [B accept]
                         │
                         ▼
                      ┌──────┐
                      │ OPEN │  ◄── add/remove offer tự do
                      └──────┘
                    A lock │ B lock
                         │
                    (cả 2 lock)
                         │
                         ▼
                     ┌────────┐
                     │ LOCKED │  ◄── không thay đổi offer được nữa
                     └────────┘
                A check │ B check
                         │
                 (cả 2 check OK)
                         │
                         ▼
                  [trade:check:ok]
                A confirm │ B confirm
                         │
               (cả 2 confirm + EXECUTING NX)
                         │
                         ▼
                  ┌────────────┐
                  │  EXECUTED  │  → push Queue → swap item
                  └────────────┘

Tại bất kỳ bước nào:
  → cancel → DEL all keys → CANCELLED (terminal)
  → check fail (không đủ hành trang) → DEL all keys → CANCELLED (terminal)
  → TTL hết hạn → Redis tự xóa → session mất (implicit cancel)
```

---

## 7. Tại sao chọn các giải pháp này

### Redis thay vì in-memory Map

Nếu dùng `Map` trong process NestJS, hệ thống chỉ hoạt động đúng khi mọi WebSocket connection của cùng một cặp user đều nằm trên cùng một instance. Trong thực tế, load balancer phân phối connection ngẫu nhiên. Redis là shared store duy nhất phù hợp cho môi trường multi-instance.

### Lua Script thay vì GET + SET riêng lẻ

Lệnh Redis không có built-in "compare and swap". Nếu dùng GET → kiểm tra ở application layer → SET, có window giữa GET và SET mà một request khác có thể chen vào và làm thay đổi state. Lua Script chạy single-threaded trên Redis server, không có bất kỳ command nào khác được xử lý trong khi script đang chạy.

### SET NX cho EXECUTING lock thay vì chỉ dựa vào Lua atomicity

Lua đảm bảo một invocation của script là atomic. Nhưng nếu có distributed Redis hoặc nếu cần thêm lớp bảo vệ ngoài application layer, `SET NX` là primitive được thiết kế cho distributed mutex. Đây là best practice cho "làm gì đó đúng một lần" trong hệ thống phân tán.

### Phân tách Check và Confirm thay vì gộp chung

Nếu kiểm tra hành trang trong bước confirm, và fail, thì cần rollback sau khi đã acquire lock — phức tạp hơn. Tách ra bước check riêng trước confirm giúp: (1) lỗi được phát hiện sớm và rõ ràng, (2) bước confirm chỉ cần lo việc swap, không phải lo validation.

### TTL trên mọi key thay vì cleanup thủ công

Không thể đảm bảo client luôn gửi `trade:cancel` khi ngắt kết nối (network drop, app crash...). TTL là safety net tự động, đảm bảo không có session "zombie" tồn tại mãi mãi trong Redis.

### Message Queue cho swap thay vì xử lý trực tiếp

Swap cần ghi vào database — thao tác I/O nặng, có thể fail. Đẩy vào Queue cho phép: retry tự động khi fail, không block WebSocket event loop, dễ monitor và audit trail, và tách biệt concern giữa "quyết định swap" và "thực thi swap".

---

## 8. Các điểm cần lưu ý / edge cases

### Client báo số ô trống không chính xác

Bước `trade:check` tin vào `oConTrongBanThan` do client gửi lên. Client malicious có thể báo cao hơn thực tế để vượt qua kiểm tra. Giải pháp hoàn chỉnh hơn: server query inventory service để lấy số ô trống thực tế, không phụ thuộc client input.

### Separator `|` trong kết quả Lua của confirm

`result.indexOf('|')` dùng để tách `offerMe` và `offerOther`. Nếu JSON của offer chứa ký tự `|` (không thể xảy ra với UUID chuẩn, nhưng cần lưu ý), việc parse sẽ sai. Có thể dùng separator an toàn hơn như `\x00` hoặc trả về hai giá trị riêng qua Redis list.

### MULTI không phải transaction thực sự

`redis.multi()` đảm bảo tất cả lệnh được gửi cùng nhau nhưng không rollback nếu một lệnh fail. Trong flow hiện tại điều này là chấp nhận được vì các lệnh là DEL (idempotent), nhưng cần lưu ý nếu mở rộng.

### Không có bước undo sau khi Queue nhận lệnh swap

Một khi `queueClient.emit('swap', ...)` được gọi, không có cơ chế rollback từ Gateway. Mọi lỗi phía sau (database fail, item không tồn tại...) phải được xử lý bởi Queue consumer.

### Race condition ở bước tradeCheck

Cả hai user A và B đều gọi `trade:check` gần như cùng lúc. Flow hiện tại: mỗi bên SET `CHECK_OK` của mình, rồi GET `CHECK_OK` của đối phương. Về lý thuyết có thể xảy ra race tương tự như lock — tuy nhiên hệ quả ở đây không nghiêm trọng (chỉ là emit `trade:check:ok` nhiều lần), và client có thể xử lý idempotent. Nếu muốn chặt chẽ hơn, bước này cũng có thể dùng Lua Script.