# Dragon Wish — Tài liệu thiết kế hệ thống Gọi Rồng Thần

**Actor:** DANG-PH  
**Ngày viết:** 04/05/2026  
**Phiên bản:** Production-ready

---

## Mục lục

1. [Bài toán đặt ra](#1-bài-toán-đặt-ra)
2. [Thiết kế ban đầu](#2-thiết-kế-ban-đầu)
3. [Thiết kế hiện tại](#3-thiết-kế-hiện-tại)
4. [Các Redis key và vai trò](#4-các-redis-key-và-vai-trò)
5. [Các khó khăn gặp phải và cách giải quyết](#5-các-khó-khăn-gặp-phải-và-cách-giải-quyết)
   - 5.1 [Race condition — đọc rồi ghi không đảm bảo tính nguyên tử](#51-race-condition--đọc-rồi-ghi-không-đảm-bảo-tính-nguyên-tử)
   - 5.2 [Key expire làm mất data — tại sao cần SNAPSHOT_KEY](#52-key-expire-làm-mất-data--tại-sao-cần-snapshot_key)
   - 5.3 [Cron chạy trên nhiều instance — dùng Redlock](#53-cron-chạy-trên-nhiều-instance--dùng-redlock)
   - 5.4 [Bug cooldown: cửa sổ gọi rồng tự do khi crash](#54-bug-cooldown-cửa-sổ-gọi-rồng-tự-do-khi-crash)
   - 5.5 [Race condition khi emit HET_HAN giữa Cron và handleUocXong](#55-race-condition-khi-emit-het_han-giữa-cron-và-handleuocxong)
6. [Flow hoàn chỉnh sau tất cả các cải tiến](#6-flow-hoàn-chỉnh-sau-tất-cả-các-cải-tiến)
7. [Hằng số thời gian](#7-hằng-số-thời-gian)
8. [Tóm tắt bài học](#8-tóm-tắt-bài-học)

---

## 1. Bài toán đặt ra

Hệ thống game Dragon Ball online cần triển khai tính năng Gọi Rồng Thần với các ràng buộc nghiệp vụ cụ thể như sau.

Tại một thời điểm chỉ một người chơi duy nhất được phép gọi rồng thần. Sau khi gọi thành công, toàn bộ màn hình game của tất cả người chơi trong server phải tối lại — đúng với behavior trong phim Dragon Ball khi cả thế giới tối lại mỗi khi rồng xuất hiện. Người gọi rồng có một khoảng thời gian giới hạn để thực hiện điều ước. Sau khi ước xong, hoặc hết thời gian mà chưa ước, màn hình phải sáng lại cho toàn bộ người chơi đồng thời.

Sau mỗi lần gọi rồng, server cần áp dụng một thời gian cooldown để tránh việc người chơi spam gọi rồng liên tục. Cooldown này là cooldown toàn server, không phải per-user — nghĩa là trong thời gian cooldown, không ai gọi được rồng, không chỉ người vừa gọi.

Quan trọng hơn, hệ thống phải xử lý được tình huống người chơi đang giữ rồng bị crash hoặc mất kết nối đột ngột mà không gửi được event kết thúc. Trong tình huống đó, hệ thống không được treo vĩnh viễn ở trạng thái rồng đang active — phải tự phục hồi sau một khoảng thời gian nhất định.

---

## 2. Thiết kế ban đầu

Thiết kế đầu tiên tiếp cận bài toán theo hướng đơn giản nhất có thể: dùng một Redis key duy nhất với TTL để đại diện cho toàn bộ trạng thái của phiên gọi rồng.

```
Gọi rồng  --> SET RONG_THAN_KEY {userId, map, ...} EX TIME_ACTIVE
Ước xong  --> DEL RONG_THAN_KEY
Cron 5p   --> GET RONG_THAN_KEY
              null + snapshot != null --> emit reset, del snapshot
              null + snapshot == null --> bỏ qua
              != null                 --> cập nhật snapshot
```

Scope broadcast lúc này là `MAP:{map}` — chỉ tối một map duy nhất là map của người gọi rồng, không phải toàn server.

Thiết kế này hoạt động được ở mức cơ bản nhưng bộc lộ nhiều vấn đề khi xem xét kỹ hơn.

**Vấn đề thứ nhất: không phân biệt được hai trạng thái khác nhau.**

Chỉ có một key nên hệ thống không phân biệt được "rồng đang active" và "server đang trong cooldown". Khi key expire, hệ thống không biết đây là expire do hết giờ ước hay do người chơi chưa ước. Quan trọng hơn, sau khi key expire, không có cơ chế nào ngăn người khác gọi rồng ngay lập tức trong khoảng thời gian Cron chưa kịp chạy.

**Vấn đề thứ hai: Cron chạy mỗi 5 phút là quá chậm.**

Nếu người chơi crash, Cron phải đợi tối đa 5 phút mới detect và emit reset. Trong 5 phút đó, toàn server vẫn tối, không ai làm gì được.

**Vấn đề thứ ba: scope broadcast sai.**

Chỉ tối một map là không đúng behavior. Đúng ra phải tối toàn server.

**Vấn đề thứ tư: cooldown chỉ được set sau khi ước xong.**

Điều này dẫn đến một lỗ hổng nghiêm trọng được phân tích chi tiết ở mục 5.4.

---

## 3. Thiết kế hiện tại

Thiết kế hiện tại tách biệt rõ ràng ba khái niệm thành ba Redis key độc lập: trạng thái active của phiên gọi rồng, cooldown toàn server, và snapshot để phục vụ Cron.

Thay vì set cooldown sau khi ước xong, cooldown được set ngay tại thời điểm gọi rồng thành công với TTL bằng tổng thời gian cooldown mong muốn. Vì `TIME_ACTIVE < TIME_COOLDOWN`, khi `ACTIVE_KEY` expire thì `COOLDOWN_KEY` vẫn còn sống — không có cửa sổ nào để gọi rồng tự do.

Scope broadcast được chuyển từ `MAP:{map}` sang room `NotificationGame` — một room mà tất cả client join vào khi kết nối — để đảm bảo toàn server nhận được event.

Cron được rút xuống còn mỗi 10 giây thay vì 5 phút, chỉ đóng vai trò safety-net cho trường hợp crash. Trong luồng bình thường, client tự đếm ngược theo `timeHienRongThan` nhận được từ server và tự emit `uoc-xong` khi hết giờ dù có bấm ước hay không. Server gửi `timeHienRongThan` về cho client ngay tại thời điểm gọi rồng thành công để client có đủ thông tin tự quản lý timer.

Toàn bộ các thao tác check-and-set đều được thực thi trong Lua Script để đảm bảo tính nguyên tử, tránh race condition.

---

## 4. Các Redis key và vai trò

```typescript
private readonly RONG_THAN_ACTIVE_KEY         = 'GAME:RONG_THAN:ACTIVE';
private readonly RONG_THAN_SNAPSHOT_KEY        = 'GAME:RONG_THAN:SNAPSHOT';
private readonly RONG_THAN_COOLDOWN_SERVER_KEY = 'GAME:RONG_THAN:COOLDOWN:SERVER';

private readonly TIME_ACTIVE_RONG      = 300;  // 5 phút — tối đa giữ rồng (production)
private readonly TIME_COOLDOWN_UOC     = 600;  // 10 phút — cooldown server (production)
private readonly TIME_ACTIVE_RONG_DEV  = 30;   // 30 giây (dev/test)
private readonly TIME_COOLDOWN_UOC_DEV = 60;   // 1 phút (dev/test)
```

**ACTIVE_KEY** là key chính đại diện cho phiên gọi rồng đang diễn ra. Nó lưu toàn bộ thông tin của người gọi dưới dạng JSON: userId, map, tọa độ, tên nhân vật, điều ước. TTL của key này bằng `TIME_ACTIVE`. Khi key tồn tại, rồng đang hiện. Khi key không tồn tại, rồng không còn active — nhưng không có nghĩa là được phép gọi rồng tiếp, vì còn phải kiểm tra `COOLDOWN_KEY`.

**COOLDOWN_KEY** là key chặn việc gọi rồng trong thời gian cooldown. Nó không chứa thông tin gì có ý nghĩa ngoài sự tồn tại của nó — giá trị chỉ là `'1'`. TTL của key này bằng `TIME_COOLDOWN`. Key này được set ngay tại thời điểm gọi rồng thành công, không phải sau khi ước xong. Đây là điểm mấu chốt trong thiết kế hiện tại.

**SNAPSHOT_KEY** là bản sao của `ACTIVE_KEY` được Cron duy trì trong suốt thời gian rồng active. Key này không có TTL — nó tồn tại cho đến khi bị xóa thủ công bởi `uoc-xong` hoặc Cron. Mục đích của nó là giữ lại thông tin `map` và các metadata khác sau khi `ACTIVE_KEY` đã expire, để Cron biết cần emit reset về đâu. Không có `SNAPSHOT_KEY`, khi `ACTIVE_KEY` expire thì mọi thông tin về phiên gọi rồng vừa kết thúc đều bị mất vĩnh viễn.

`SNAPSHOT_KEY` còn đóng vai trò phân biệt hai trường hợp khi `ACTIVE_KEY` null:

- `SNAPSHOT_KEY` còn tồn tại: rồng vừa expire do crash hoặc hết giờ mà `uoc-xong` chưa xử lý — Cron cần emit `HET_HAN`.
- `SNAPSHOT_KEY` đã bị xóa: `uoc-xong` đã xử lý rồi — Cron bỏ qua để không emit trùng.

---

## 5. Các khó khăn gặp phải và cách giải quyết

### 5.1 Race condition — đọc rồi ghi không đảm bảo tính nguyên tử

Khi nhiều người chơi cùng gọi `uoc-rong-than` đồng thời trên nhiều WebSocket connection, nếu logic check-and-set được thực thi bằng các lệnh Redis riêng lẻ, tình huống sau có thể xảy ra:

```
Client A: GET ACTIVE_KEY --> null
Client B: GET ACTIVE_KEY --> null
Client A: SET ACTIVE_KEY ...    (A ghi thành công)
Client B: SET ACTIVE_KEY ...    (B ghi đè lên A)
```

Kết quả là cả A và B đều nghĩ mình gọi rồng thành công, nhưng chỉ có thông tin của B được lưu trong Redis. Server emit `BAT_DAU` hai lần, client nhận tín hiệu tối màn hình hai lần, trạng thái bị lệch.

Giải pháp là dùng Lua Script trong Redis. Redis đảm bảo mỗi Lua Script được thực thi nguyên tử — không có bất kỳ lệnh Redis nào từ client khác có thể chen vào giữa hai dòng của script. Toàn bộ logic check `COOLDOWN_KEY`, check `ACTIVE_KEY`, rồi set cả hai được đặt trong một script duy nhất:

```lua
local cooldown = redis.call('TTL', KEYS[1])
if cooldown > 0 then return {'COOLDOWN', tostring(cooldown)} end

local active = redis.call('EXISTS', KEYS[2])
if active == 1 then
  local remain = redis.call('TTL', KEYS[1])
  return {'ACTIVE', tostring(remain)}
end

redis.call('SET', KEYS[2], ARGV[1], 'EX', ARGV[2])
redis.call('SET', KEYS[1], '1',     'EX', ARGV[3])
return {'OK', '0'}
```

Tương tự, event `uoc-xong` cũng dùng Lua để thực hiện GET (kiểm tra owner) và DEL atomic trong một script.

### 5.2 Key expire làm mất data — tại sao cần SNAPSHOT_KEY

Khi Redis tự xóa `ACTIVE_KEY` do TTL hết, toàn bộ payload JSON lưu trong key đó biến mất hoàn toàn. Cron cần biết map của phiên gọi rồng vừa kết thúc để emit đúng event reset về đúng scope, nhưng lúc này không còn cách nào đọc được thông tin đó nữa.

Cách tiếp cận đầu tiên là lưu thông tin trong memory của process, nhưng điều này không hoạt động khi có nhiều instance server chạy song song — instance detect expire có thể không phải instance đã lưu data vào memory.

Giải pháp là dùng `SNAPSHOT_KEY` lưu trong Redis. Mỗi lần Cron chạy và thấy `ACTIVE_KEY` còn tồn tại, nó ghi lại một bản sao vào `SNAPSHOT_KEY`. Key này không có TTL nên không tự expire. Khi `ACTIVE_KEY` expire ở lần chạy tiếp theo, `SNAPSHOT_KEY` vẫn còn và Cron có thể đọc thông tin `map` từ đó.

Sau khi emit xong, Cron xóa `SNAPSHOT_KEY` để lần chạy sau không emit lại. Và khi `uoc-xong` được gọi bình thường (không phải crash), nó cũng xóa `SNAPSHOT_KEY` trong cùng Lua Script để Cron thấy `SNAPSHOT_KEY` null mà bỏ qua.

### 5.3 Cron chạy trên nhiều instance — dùng Redlock

Khi server được scale ngang (horizontal scaling), nhiều instance cùng chạy, tất cả đều có Cron. Nếu không có cơ chế phối hợp, tất cả instance sẽ cùng chạy Cron đồng thời, cùng detect expire, và cùng emit `HET_HAN` nhiều lần đến toàn bộ client.

Giải pháp là dùng Redlock — một thuật toán distributed lock xây dựng trên Redis. Trước khi thực thi bất kỳ logic nào, Cron cố gắng acquire một distributed lock với TTL 10 giây. Instance nào acquire được lock thì chạy, instance nào không acquire được (vì instance khác đang giữ) thì nhận `ResourceLockedError` và return ngay, không làm gì cả.

```typescript
lock = await this.redlock.acquire(['lock:cron:rongThanExpiry'], 10_000);
```

Điều này đảm bảo tại mỗi thời điểm chỉ có đúng một instance thực sự xử lý logic Cron, bất kể có bao nhiêu instance đang chạy.

### 5.4 Bug cooldown: cửa sổ gọi rồng tự do khi crash

Đây là bug quan trọng nhất được phát hiện trong quá trình review thiết kế và là lý do chính dẫn đến sự thay đổi behavior của toàn bộ hệ thống cooldown.

**Thiết kế cũ: set cooldown sau khi ước xong**

Trong thiết kế ban đầu, `COOLDOWN_KEY` được set tại hai thời điểm: trong `uoc-xong` sau khi người chơi ước xong, và trong Cron sau khi detect `ACTIVE_KEY` expire.

Thoạt nhìn có vẻ đúng, nhưng xét kỹ luồng crash:

```
T=0:     Người chơi A gọi rồng thành công
         SET ACTIVE_KEY EX 30s
         (COOLDOWN_KEY chưa được set)

T=15:    A crash, không gửi được uoc-xong

T=30:    ACTIVE_KEY tự expire
         COOLDOWN_KEY vẫn chưa tồn tại

T=30~40: Cửa sổ nguy hiểm — không có ACTIVE_KEY, không có COOLDOWN_KEY
         Bất kỳ người chơi nào cũng gọi được rồng ngay lập tức

T=40:    Cron chạy, detect snapshot, set COOLDOWN_KEY
         Đã muộn — người chơi B có thể đã gọi rồng trong cửa sổ T=30~40
```

Cửa sổ nguy hiểm này dài tối đa bằng interval của Cron. Dù là 5 phút hay 10 giây, đây vẫn là một lỗ hổng không chấp nhận được vì về mặt lý thuyết ai cũng có thể khai thác nó bằng cách crash đúng lúc hoặc đơn giản là may mắn gọi rồng đúng vào khoảng thời gian đó.

**Thiết kế mới: set cooldown ngay khi gọi rồng thành công**

Giải pháp là đơn giản hóa hoàn toàn: set `COOLDOWN_KEY` với TTL bằng `TIME_COOLDOWN` ngay tại thời điểm gọi rồng, trong cùng Lua Script với việc set `ACTIVE_KEY`. Điều kiện bất biến phải luôn đúng là `TIME_ACTIVE < TIME_COOLDOWN`.

```
T=0:     Người chơi A gọi rồng thành công
         SET ACTIVE_KEY   EX 30s   (TIME_ACTIVE)
         SET COOLDOWN_KEY EX 60s   (TIME_COOLDOWN)

T=15:    A crash

T=30:    ACTIVE_KEY expire
         COOLDOWN_KEY vẫn còn 30s TTL
         --> Không ai gọi được rồng, không có cửa sổ nguy hiểm

T=60:    COOLDOWN_KEY expire --> mở cửa gọi rồng lại
```

Behavior mới này loại bỏ hoàn toàn cửa sổ nguy hiểm, không phụ thuộc vào việc Cron có chạy kịp hay không. Cooldown được đảm bảo bởi chính Redis TTL, không cần bất kỳ tác nhân ngoài nào.

Hệ quả của thay đổi này là `uoc-xong` và Cron không cần set `COOLDOWN_KEY` nữa — `COOLDOWN_KEY` đã tự chạy từ đầu và tự expire đúng thời điểm. Điều này giúp tập trung toàn bộ logic cooldown tại một nơi duy nhất, giảm bề mặt lỗi đáng kể.

Thông điệp hiển thị cho người chơi cũng được thống nhất: cả khi rồng đang active lẫn khi đang cooldown, thời gian hiển thị đều lấy từ TTL của `COOLDOWN_KEY`. Đây là thời điểm thực tế server sẽ cho phép gọi lại, không cần tính toán phức tạp `TTL(ACTIVE_KEY) + TIME_COOLDOWN` như trong thiết kế cũ.

### 5.5 Race condition khi emit HET_HAN giữa Cron và handleUocXong

Khi `ACTIVE_KEY` expire đúng lúc client emit `uoc-xong` (do clock skew hoặc đếm ngược không hoàn toàn chính xác), cả `handleUocXong` và Cron có thể cùng cố gắng emit `HET_HAN` trong cùng một khoảng thời gian ngắn.

Trong `handleUocXong`, khi Lua Script trả về `EXPIRED`, code TypeScript thực hiện ba bước riêng lẻ: GET `SNAPSHOT_KEY`, DEL `SNAPSHOT_KEY`, emit `HET_HAN`. Nếu Cron chạy chen vào giữa bước GET và bước DEL:

```
handleUocXong: GET SNAPSHOT_KEY --> có data
Cron:          GET SNAPSHOT_KEY --> có data --> emit HET_HAN --> DEL SNAPSHOT_KEY
handleUocXong: DEL SNAPSHOT_KEY (xóa key đã bị Cron xóa, nhưng vẫn emit tiếp)
               --> emit HET_HAN lần hai
```

Client nhận `HET_HAN` hai lần, màn hình có thể sáng lại rồi xử lý event thứ hai gây ra behavior bất thường.

Giải pháp là dùng Lua Script atomic cho cả bước GET và DEL trong `handleUocXong` case EXPIRED:

```lua
local snap = redis.call('GET', KEYS[1])
if not snap then return '' end
redis.call('DEL', KEYS[1])
return snap
```

Script này đảm bảo nếu Cron đã DEL `SNAPSHOT_KEY` trước thì GET trả về null, script trả về chuỗi rỗng và TypeScript không emit. Ngược lại nếu `handleUocXong` DEL trước thì Cron GET trả về null và Cron bỏ qua. Chỉ một trong hai phía emit được `HET_HAN`, không bao giờ cả hai.

---

## 6. Flow hoàn chỉnh sau tất cả các cải tiến

**Event uoc-rong-than:**

Lua Script atomic kiểm tra `COOLDOWN_KEY` trước. Nếu còn TTL, trả về `COOLDOWN` kèm số giây còn lại để client hiển thị. Nếu `COOLDOWN_KEY` không tồn tại, kiểm tra tiếp `ACTIVE_KEY`. Nếu `ACTIVE_KEY` tồn tại, trả về `ACTIVE` kèm TTL của `COOLDOWN_KEY` (vì đó là thời gian thực tế phải chờ). Nếu cả hai đều không tồn tại, set `ACTIVE_KEY` và `COOLDOWN_KEY` trong cùng một script, trả về `OK`.

Khi OK, server emit `uocRongThanResult` cho client gọi (kèm `timeHienRongThan` để client tự đếm ngược), đồng thời broadcast `BAT_DAU` và notification cho toàn room `NotificationGame`.

**Event uoc-xong:**

Lua Script atomic GET `ACTIVE_KEY`. Nếu null trả về `EXPIRED`. Nếu có data nhưng userId không khớp trả về `NOT_OWNER`. Nếu đúng owner thì DEL `ACTIVE_KEY` và DEL `SNAPSHOT_KEY` trong cùng script, trả về `OK`. `COOLDOWN_KEY` không bị đụng đến, tự chạy hết.

Case OK: emit `uocXongResult` cho client, broadcast `KET_THUC` cho toàn server.

Case EXPIRED: dùng Lua Script atomic GET+DEL `SNAPSHOT_KEY`. Nếu trả về data thì emit `HET_HAN` cho toàn server. Emit `uocXongResult { success: false }` cho client.

Case NOT_OWNER: chỉ emit lỗi cho client đó.

**Cron mỗi 10 giây (có Redlock):**

Nếu `ACTIVE_KEY` còn tồn tại, cập nhật `SNAPSHOT_KEY`.

Nếu `ACTIVE_KEY` không tồn tại và `SNAPSHOT_KEY` còn tồn tại: rồng vừa expire do crash (vì `uoc-xong` đã xóa `SNAPSHOT_KEY` nếu xử lý bình thường). Emit `HET_HAN` cho toàn server, DEL `SNAPSHOT_KEY`. `COOLDOWN_KEY` tự expire không cần động vào.

Nếu cả hai đều null: `uoc-xong` đã xử lý, bỏ qua.

---

## 7. Hằng số thời gian

| Hằng số | Production | Dev/Test | Ý nghĩa |
|---------|-----------|---------|---------|
| `TIME_ACTIVE_RONG` | 300s | 30s | Thời gian tối đa người chơi giữ rồng |
| `TIME_COOLDOWN_UOC` | 600s | 60s | Thời gian cooldown toàn server sau mỗi lần gọi |

Bất biến bắt buộc phải luôn đúng: `TIME_ACTIVE < TIME_COOLDOWN`. Nếu vi phạm điều kiện này, sẽ có khoảng thời gian `ACTIVE_KEY` đã expire nhưng `COOLDOWN_KEY` cũng đã expire — tái tạo lại bug cửa sổ gọi rồng tự do.

---

## 8. Tóm tắt bài học

**Không phân tách trạng thái rõ ràng dẫn đến logic chồng chéo.** Dùng một key duy nhất để đại diện cho cả "đang active" lẫn "đang cooldown" khiến hệ thống không thể xử lý đúng các trường hợp biên. Mỗi trạng thái nghiệp vụ cần một key riêng với TTL riêng phản ánh đúng vòng đời của nó.

**Set cooldown sau khi sự kiện kết thúc là thiết kế sai về mặt nguyên tắc.** Cooldown là ràng buộc được áp đặt từ thời điểm sự kiện bắt đầu, không phải kết thúc. Nếu set cooldown sau khi kết thúc, bất kỳ tình huống nào làm gián đoạn quá trình kết thúc (crash, network, timeout) đều có thể làm cooldown không bao giờ được set, tạo ra cửa sổ khai thác.

**Các thao tác check-then-act trên shared state bắt buộc phải atomic.** Trong môi trường concurrent, không có lệnh Redis nào đứng độc lập là an toàn nếu logic phụ thuộc vào kết quả của lệnh trước đó. Lua Script là giải pháp đúng đắn cho Redis vì Redis đảm bảo mỗi script chạy nguyên tử.

**Cron là safety-net, không phải primary handler.** Cron không nên là nơi duy nhất xử lý một nghiệp vụ quan trọng vì nó có độ trễ cố định. Client chủ động emit event khi hết giờ là cách tiếp cận đúng — Cron chỉ đảm bảo hệ thống tự phục hồi khi client không thể emit được do crash.

**Distributed lock là bắt buộc khi Cron chạy trên nhiều instance.** Không có Redlock, emit trùng lặp là không thể tránh khỏi khi scale ngang.

**Metadata của một key expire phải được lưu trước khi key biến mất.** Redis TTL không cho phép đọc data của key đã expire. Nếu cần thông tin từ một key có TTL để xử lý sự kiện expire của nó, phải chủ động snapshot data đó vào một key khác trong khi key gốc còn sống.