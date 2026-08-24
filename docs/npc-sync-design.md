# Tài liệu kỹ thuật: Đồng bộ dữ liệu NPC & Shop khi Admin cập nhật

> **Phiên bản:** 2.0
> **Ngày:** 2026-05-09
> **Trạng thái:** Đề xuất triển khai
> **Đối tượng đọc:** Backend dev, Game client dev (Java), Tech Lead, Product Owner

---

## Mục lục

1. [Bài toán đặt ra](#1-bài-toán-đặt-ra)
2. [Hiện trạng hệ thống](#2-hiện-trạng-hệ-thống)
3. [Tổng quan các phương án đã cân nhắc](#3-tổng-quan-các-phương-án-đã-cân-nhắc)
4. [Phân tích chi tiết từng phương án](#4-phân-tích-chi-tiết-từng-phương-án)
5. [So sánh đặc tính NPC Spawn vs Shop](#5-so-sánh-đặc-tính-npc-spawn-vs-shop)
6. [Tham khảo từ industry](#6-tham-khảo-từ-industry)
7. [Phương án được chọn](#7-phương-án-được-chọn)
8. [Thiết kế chi tiết - Shop](#8-thiết-kế-chi-tiết---shop-hot-reload--prefetch)
9. [Thiết kế chi tiết - NPC Spawn](#9-thiết-kế-chi-tiết---npc-spawn-bullmq--bảo-trì)
10. [Edge cases & xử lý](#10-edge-cases--xử-lý)
11. [Monitoring & Observability](#11-monitoring--observability)
12. [Kế hoạch triển khai](#12-kế-hoạch-triển-khai)
13. [Câu hỏi thường gặp (FAQ)](#13-câu-hỏi-thường-gặp-faq)
14. [Phụ lục](#14-phụ-lục)

---

## 1. Bài toán đặt ra

### 1.1. Mô tả tình huống

Hệ thống game hiện tại đang **lazy load + cache data NPC ở client**. Điều này dẫn tới vấn đề đồng bộ dữ liệu khi admin cập nhật:

- **User A** đã vào map X → đã cache data NPC → admin sửa data → User A **không thấy thay đổi**.
- **User B** chưa vào map X → admin sửa data → User B vào sau → **thấy data mới**.

Hai user nhìn thấy world khác nhau cho đến khi User A relog hoặc đổi map. Đây là vấn đề **data consistency** giữa các client.

### 1.2. Yêu cầu nghiệp vụ

Khi admin cập nhật data NPC/Shop, hệ thống phải đảm bảo:

1. Tất cả user online đồng bộ data với nhau (không có user thấy data cũ).
2. Server không bị burst tải lớn cùng lúc.
3. Trải nghiệm user không bị gián đoạn quá nhiều.
4. Admin có thể fix data gấp khi cần (sai giá shop, NPC spawn sai vị trí gây kẹt).
5. Hệ thống đơn giản, dễ maintain, dễ debug.

### 1.3. Phạm vi

Tài liệu này áp dụng cho 2 loại data:

- **NPC Spawn** (`NpcServerData`): vị trí, map_id, loại NPC, trạng thái active.
- **NPC Shop** (`ShopItemServerData`): giá, item, loại tiền, tab, trạng thái active.

Các action được hỗ trợ:

```java
public enum NpcAction {
    THEM_NPC_SPAWN, SUA_NPC_SPAWN, XOA_NPC_SPAWN,
    THEM_NPC_SHOP,  SUA_NPC_SHOP,  XOA_NPC_SHOP
}
```

---

## 2. Hiện trạng hệ thống

### 2.1. Kiến trúc cache hiện tại

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│  Admin      │         │  Server     │         │  Client     │
│  Web Panel  │ ──────► │  (DB+Cache) │ ◄────── │  (Java)     │
└─────────────┘         └─────────────┘         └─────────────┘
                              ▲                        │
                              │  API hit lần đầu       │
                              │                        ▼
                              │                  ┌──────────┐
                              │                  │ Cache    │
                              └──────────────────│ local    │
                                                 │ (memory) │
                                                 └──────────┘
```

### 2.2. Vấn đề cụ thể

- Cache client **không có cơ chế invalidation** từ server.
- Cache chỉ được refresh khi user **relog** hoặc **chuyển map** (mà map đó chưa cache).
- Admin cập nhật data → server có data mới, client vẫn dùng data cũ.
- Không có cách nào để admin biết user nào đang thấy data cũ.

---

## 3. Tổng quan các phương án đã cân nhắc

| # | Tên phương án | Cơ chế chính | Trạng thái |
|---|---|---|---|
| A | Bảo trì 4h sáng cố định | Gom thay đổi, apply lúc bảo trì định kỳ | Phù hợp một phần |
| B | Invalidate cache + force fetch | Server bắn event xóa cache, client gọi API ngay | ❌ Loại |
| C | WS push delta + payload | Server push action + data, client patch cache | ❌ Loại |
| D | WS push delta + versioning | Cách C + version số tự heal | ❌ Loại |
| E | BullMQ + bảo trì 15p (toàn bộ) | Mọi thay đổi đều kick all sau 15p | ❌ Loại |
| F | Bỏ cache hoàn toàn ở client | Mỗi lần vào map / mở shop đều fetch | Tốt một phần |
| G | Lazy invalidate cache map + fetch khi đổi map + WS event cho user trong map | Hybrid cho NPC | Tốt cho NPC |
| H | Prefetch shop bằng background thread | Click NPC → fetch song song với animation | Tốt cho Shop |
| I | **Tách 2 loại + kết hợp G và H** | Mỗi loại 1 cơ chế tối ưu | ✅ **Được chọn** |

---

## 4. Phân tích chi tiết từng phương án

### 4.1. Phương án A — Bảo trì 4h sáng cố định

**Mô tả:**
- Tất cả thay đổi NPC/Shop của admin được gom vào queue.
- Bảo trì cố định 4h-5h sáng hằng ngày, kick all user trong giờ này.
- Server apply changes lúc bảo trì, user dậy login lại có data mới.

**Ưu điểm:**
- Đơn giản nhất để implement.
- Không có state conflict (giờ ít user nhất).
- Không có burst tải.
- Quen thuộc với player game mobile.

**Nhược điểm:**
- ❌ **Admin phải chờ tới hôm sau** mới thấy hiệu lực.
- ❌ Không phù hợp khi cần fix gấp (sai giá shop gây thiệt hại kinh tế ngay).
- ❌ Nếu admin sửa NPC sai vị trí gây kẹt map, player phải chờ tới sáng mới được fix.

**Khi nào phù hợp:**
- Thay đổi nội dung lớn theo lịch (mở event, balance kinh tế).
- Game không cần độ linh hoạt cao trong vận hành.

**Vì sao không chọn (làm chính):**
- Không đáp ứng yêu cầu fix gấp.
- Admin trong tổ chức cần thấy thay đổi ngay để verify.

---

### 4.2. Phương án B — Invalidate cache + force fetch

**Mô tả:**
- Server thực thi thay đổi ngay.
- Bắn event WS đến tất cả client → xóa cache + gọi API lấy data mới ngay lập tức.

**Ưu điểm:**
- Realtime tuyệt đối.
- Đơn giản về logic.

**Nhược điểm — nghiêm trọng:**
- ❌ **Thundering herd:** 5000 user trong map cùng nhận event → 5000 API call trong 1 giây → DB/cache layer ăn đòn.
- ❌ **State mismatch giữa lúc xóa cache và lúc fetch xong:** player có thể tương tác với NPC cũ trong khoảng thời gian này.
- ❌ Burst tải có thể làm sập server nếu map đông.

**Vì sao không chọn:**
- Burst tải không chấp nhận được ở scale prod.
- Có cách thay thế tốt hơn (lazy refetch).

---

### 4.3. Phương án C — WS push delta + payload

**Mô tả:**
- Server thực thi thay đổi.
- Push WS event với action + payload data đầy đủ.
- Client patch cache local theo action (THEM/SUA/XOA).

**Ưu điểm:**
- Realtime.
- Không gọi lại API → không burst.
- Bandwidth tiết kiệm (chỉ truyền delta).

**Nhược điểm:**
- ❌ **Phải sync schema giữa server DTO và client class Java** → mỗi lần thêm field phải sửa cả 2 phía.
- ❌ Logic patch cache phức tạp (3 action × 2 loại NPC = 6 case).
- ❌ **Không tự heal khi mất gói WS:** client miss 1 event → state lệch vĩnh viễn cho tới lần restart.
- ❌ Race condition khi event đến trước khi client load xong map.

**Vì sao không chọn:**
- Mất đồng bộ vĩnh viễn nếu mất gói WS là deal-breaker.
- Phức tạp duy trì schema.

---

### 4.4. Phương án D — WS push delta + versioning

**Mô tả:**
- Như cách C, nhưng thêm `mapVersion` tăng dần.
- Client kiểm tra version: lệch → fetch full, khớp → apply delta.

**Ưu điểm:**
- Tự heal khi mất gói WS.
- Vẫn realtime cho user đang ở map đó.

**Nhược điểm:**
- ❌ **Quá phức tạp** so với lợi ích.
- ❌ Phải maintain version field ở cả 2 phía.
- ❌ Test edge case rất khó (race condition, ordering của events).
- ❌ Vẫn phải sync schema.

**Vì sao không chọn:**
- Over-engineering cho use case này.
- Có giải pháp đơn giản hơn (cách F+G+H).

---

### 4.5. Phương án E — BullMQ + bảo trì 15p (áp dụng toàn bộ)

**Mô tả:**
- Mọi thay đổi (cả shop và NPC spawn) đều đi vào queue.
- Bảo trì 15p sau, kick all, apply changes.

**Ưu điểm:**
- Không có state conflict (kick hết).
- Batch nhiều thay đổi trong 15p chỉ kick 1 lần.
- Đơn giản về logic.

**Nhược điểm:**
- ❌ **Sửa giá 1 item shop cũng phải kick all 5000 user** trong 5 phút → UX tệ.
- ❌ Game prod không làm thế cho data nhỏ lẻ.
- ❌ Mỗi lần admin sửa = 1 lần gián đoạn → admin ngại sửa.

**Vì sao không chọn (cho shop):**
- Quá nặng tay với data có thể hot-reload an toàn.

**Vì sao vẫn dùng (cho NPC spawn):**
- NPC spawn có state conflict thật → cần kick để an toàn.

---

### 4.6. Phương án F — Bỏ cache hoàn toàn ở client

**Mô tả:**
- Client **không cache** data NPC/Shop.
- Mỗi lần vào map → fetch NPC list từ server.
- Mỗi lần mở shop → fetch shop items từ server.

**Ưu điểm:**
- ✅ **Đơn giản nhất ở client:** không cần cache management.
- ✅ Luôn có data mới nhất.
- ✅ Không cần WS event cho data update.
- ✅ Không có vấn đề đồng bộ giữa các user.

**Nhược điểm:**
- ❌ **Tăng tải server** đáng kể: mỗi lần đổi map → 1 request, mỗi lần mở shop → 1 request.
- ❌ **Latency cao hơn:** player phải chờ network round trip mỗi lần (200-500ms).
- ❌ **Phụ thuộc network:** mạng yếu → game lag mỗi lần đổi map.
- ❌ **Tốn bandwidth user:** đặc biệt với game mobile dùng 4G.

**Đánh giá:**
- Phù hợp nếu data thay đổi **rất thường xuyên** và không thể cache.
- Server phải scale mạnh để chịu tải.

**Khi nào phù hợp:**
- MVP/prototype giai đoạn đầu.
- Game scale nhỏ, ít user concurrent.

**Vì sao không chọn (làm chính):**
- Tốn tài nguyên không cần thiết.
- Có cách lai (cache + invalidate đúng lúc) tốt hơn.

---

### 4.7. Phương án G — Lazy invalidate cache map + WS event cho user trong map

**Mô tả:**

**Cho user CHƯA vào map:**
- Cache map của user đã bị xóa khi admin sửa.
- Khi user vào map (mới hoặc quay lại) → cache miss → fetch fresh.

**Cho user ĐANG TRONG map đó:**
- Server biết danh sách user đang trong map (room/zone manager).
- Push WS event **chỉ tới user đang trong map** với action + payload (THEM/SUA/XOA).
- Client patch cache local + render NPC tương ứng.

**Ưu điểm:**
- ✅ **Không burst tải:** chỉ user đang trong map nhận event (số lượng giới hạn).
- ✅ **Realtime cho user đang trong map:** thấy NPC mới spawn / xóa ngay.
- ✅ User chưa vào map → tự nhiên đồng bộ khi vào.
- ✅ Cache được tận dụng → giảm tải server.
- ✅ Bandwidth tiết kiệm (chỉ push tới user cần biết).

**Nhược điểm:**
- 🔶 **State conflict vẫn tồn tại** với user đang trong map: đang đánh quái spawn → admin xóa quái → quái biến mất giữa fight → game logic lỗi.
- 🔶 Phải maintain room/zone manager (track user nào trong map nào).
- 🔶 Logic patch cache + render phức tạp ở client.
- 🔶 Mất gói WS → state lệch (cần thêm versioning để tự heal).

**Đánh giá:**
- Pattern này là **cách MMO truyền thống** (L2J, EQEmu, Gothic Online) làm cho NPC.
- Phù hợp khi NPC có thể thêm/xóa runtime mà không gây crash logic.

**Vì sao không chọn cho NPC spawn:**
- Game của chúng ta có **state conflict thật** khi xóa NPC đang được tương tác.
- Không có cơ chế quest/combat đủ robust để xử lý NPC biến mất giữa chừng.
- Bảo trì 15p an toàn hơn cho NPC.

**Khi nào áp dụng:**
- Nếu sau này codebase đủ robust để handle NPC disappear runtime.
- Hoặc cho map "tĩnh" (chỉ NPC dialog, không có combat).

---

### 4.8. Phương án H — Prefetch shop bằng background thread

**Mô tả:**

**Flow:**
1. Player **bấm vào NPC shop** trong map.
2. Game hiển thị animation mở shop (vd: zoom camera, hiệu ứng 0.3-0.5s).
3. **Trong lúc animation chạy**, một background thread gọi API lấy shop items.
4. Khi animation xong → dialog shop xuất hiện → data đã sẵn sàng.
5. Player thấy "instant load" mặc dù thực tế đã có 1 API call.

```
Time     Main thread                    Background thread
──────   ─────────────                  ─────────────────
T+0ms    Player click NPC shop
         Hiển thị animation             Gửi API request shop
T+100ms  Animation đang chạy            Đang chờ response
T+300ms  Animation đang chạy            Response về, parse data
T+500ms  Animation kết thúc             Data sẵn sàng
         → Mở dialog với data           
```

**Ưu điểm:**
- ✅ **Không cần cache shop ở client** → đơn giản.
- ✅ Luôn có data mới nhất.
- ✅ User cảm nhận như instant load (animation che đi latency).
- ✅ Không cần WS event invalidate cache.
- ✅ Không cần đồng bộ schema.

**Nhược điểm:**
- 🔶 **Tăng số lượng API call** so với cache (mỗi lần mở shop = 1 call).
- 🔶 Phụ thuộc network: mạng yếu → animation xong nhưng data chưa về → phải hiển thị loading.
- 🔶 Phải có animation đủ dài để che latency (UX design).
- 🔶 Edge case: API fail → phải retry hoặc báo lỗi user.

**Đánh giá:**
- Pattern này là **kỹ thuật UX phổ biến** trong nhiều game/app: "perceived performance".
- Apple cũng dùng pattern tương tự khi mở app (animation che đi cold start).
- Số lượng API call shop thực tế không nhiều (player không mở shop liên tục).

**Vì sao chọn cho shop:**
- Đơn giản, hiệu quả, UX tốt.
- Không cần WS event phức tạp cho shop → giảm phức tạp tổng thể.
- Always-fresh data → không bao giờ thấy giá cũ.

**Lưu ý khi dùng:**
- Cần fallback: nếu API chậm hơn animation → hiện loading indicator nhỏ thay vì freeze UI.
- Cần handle khi API fail (timeout, error → retry hoặc thông báo).

---

### 4.9. Phương án I — Tách 2 loại data + kết hợp G và H

**Đây là phương án được chọn.** Chi tiết ở [Phần 7](#7-phương-án-được-chọn).

---

## 5. So sánh đặc tính NPC Spawn vs Shop

Chìa khóa để chọn đúng phương án là **hiểu rõ sự khác biệt đặc tính của 2 loại data**:

| Tiêu chí | NPC Spawn | Shop Item |
|---|---|---|
| **Số user bị ảnh hưởng cùng lúc** | Cao (tất cả user trong map) | Thấp (chỉ user đang mở dialog shop) |
| **State conflict** | Có (đang đánh quái, đang quest, đang nói chuyện NPC) | Không (transaction shop là atomic, ngắn) |
| **Tần suất admin sửa** | Thấp (vài lần/tuần, theo event) | Cao (sửa giá, balance kinh tế, fix lỗi) |
| **Risk khi hot-reload** | Cao (NPC biến mất giữa fight) | Thấp (close dialog là xong) |
| **Burst tải khi invalidate** | Có (cả nghìn user trong map) | Không |
| **Chấp nhận downtime** | Có (ít thay đổi nên hiếm) | Không (sửa thường xuyên) |
| **Có animation che latency được không** | Không (NPC phải có sẵn khi vào map) | Có (animation mở shop ~0.5s) |
| **Bao nhiêu data?** | Lớn (cả map, có thể vài chục NPC) | Nhỏ (1 NPC chỉ vài chục item) |
| **Tần suất user truy cập** | Liên tục (mỗi lần đổi map) | Thấp (chỉ khi cần mua/bán) |

**Kết luận:** Không thể dùng 1 cơ chế duy nhất cho cả 2 loại. Phải tách.

---

## 6. Tham khảo từ industry

### 6.1. Hot reload data trong MMO chuyên nghiệp

**Genshin Impact / Honkai Star Rail (miHoYo):**
- Shop event, banner mới, daily reset → **hot push** xuống client đang chơi.
- Patch lớn (đổi version game) → bảo trì định kỳ có lịch trước (vd: thứ 3 hàng tuần).
- Data shop fetch on-demand khi mở dialog.

**Liên Minh Tốc Chiến / Valorant (Riot Games):**
- Hotfix balance (sửa damage, sửa skill) → áp dụng trong trận tiếp theo, không kick.
- Update client binary lớn → patch tuần.
- Shop in-game fetch fresh mỗi lần mở (không cache lâu).

**Lineage 2 (NCSoft) / Lost Ark:**
- GM tools có lệnh `//reload npc`, `//reload multisell`, `//reload skill` → reload runtime.
- Maintenance định kỳ cho schema/code change.

**Lineage 2 mã nguồn mở (L2J) — gần với stack Java của chúng ta:**
- `//reload npc` — reload NPC data từ DB không cần restart.
- `//addShopItem`, `//editShopItem`, `//delShopItem` — sửa shop runtime.
- `//edit_npc`, `//save_npc` — sửa stat NPC runtime.
- Đây là pattern đã chạy ổn định 15+ năm.

**EverQuest Emulator (EQEmu):**
- Lệnh `#hotfix` dùng shared memory để hot reload spells, factions, base data — apply server-wide trong khi server đang chạy.
- Lệnh `#reload` cho từng loại data: doors, commands, content_flags, blocked_spells, quest...
- Cho NPC mới cần `#repop` (gần như reload zone).

### 6.2. Pattern industry chuẩn

Dựa trên các tham khảo trên, có thể rút ra **3 nhóm pattern**:

1. **Hot reload không kick** — dùng cho data nhẹ, không gây state conflict (shop, config, balance numbers).
2. **Maintenance window** — dùng cho schema change, code change, content lớn ảnh hưởng world state.
3. **Rolling update** — chỉ áp dụng cho hệ thống multi-server lớn (GuildWars, MY.GAMES); không cần cho single-server.

### 6.3. Patent liên quan

US Patent 9106963 ("Player-side cache") mô tả pattern delta sync với versioning. Đây là cách phức tạp hơn, áp dụng khi **client cache nặng và mạng yếu**. Trong bài toán hiện tại, ta không cần phức tạp tới mức này vì có thể tách shop hot-reload đơn giản hơn.

---

## 7. Phương án được chọn

### 7.1. Tổng quan

> **Tách 2 loại data, mỗi loại dùng 1 cơ chế phù hợp với đặc tính của nó.**

```
┌─────────────────────────────────────────────────────────────┐
│                     Admin Web Panel                          │
└──────────────┬──────────────────────────┬───────────────────┘
               │                          │
       ┌───────▼─────────┐        ┌───────▼─────────┐
       │  Shop Action    │        │  NPC Spawn      │
       │                 │        │  Action         │
       │  THEM/SUA/XOA   │        │  THEM/SUA/XOA   │
       │  NPC_SHOP       │        │  NPC_SPAWN      │
       └───────┬─────────┘        └───────┬─────────┘
               │                          │
       ┌───────▼─────────┐        ┌───────▼─────────┐
       │ Hot Reload +    │        │ BullMQ Queue    │
       │ Prefetch        │        │ (batch + kick)  │
       │                 │        │                 │
       │ - Update DB     │        │ - Push pending  │
       │ - Invalidate    │        │ - Schedule job  │
       │   server cache  │        │ - Countdown WS  │
       │ - WS broadcast  │        │ - Apply + kick  │
       │   RELOAD_SHOP   │        │                 │
       │   (chỉ npc_id)  │        │                 │
       └─────────────────┘        └─────────────────┘
```

### 7.2. Bảng quyết định cuối cùng

| Loại thay đổi | Cách xử lý | Lý do |
|---|---|---|
| Sửa giá shop item | Hot reload + prefetch | Atomic, ít user mở cùng lúc, sửa thường xuyên |
| Đổi tab/active shop | Hot reload + prefetch | Như trên |
| Thêm/xóa shop item | Hot reload + prefetch | Như trên |
| Thêm NPC spawn mới | BullMQ + bảo trì | Có thể có user đứng đè vị trí |
| Sửa vị trí NPC | BullMQ + bảo trì | State conflict, burst tải |
| Xóa NPC spawn | BullMQ + bảo trì | State conflict (đang interact) |
| Đổi loại NPC | BullMQ + bảo trì | Ảnh hưởng nhiều entity |
| Đại tu nhiều thứ cùng lúc | Gộp 4h sáng | Zero impact, an toàn nhất |

---

## 8. Thiết kế chi tiết - Shop hot reload + prefetch

### 8.1. Hai chế độ hoạt động kết hợp

Shop dùng **2 cơ chế bổ trợ nhau**:

**Cơ chế 1 — Cache với invalidation (cho user đã mở shop trước đó):**
- Client cache shop items với TTL ngắn (vd: 2-5 phút).
- Khi admin sửa → server bắn WS `RELOAD_SHOP { npc_id }` → client xóa cache.
- Lần sau player mở shop NPC đó → cache miss → fetch fresh.

**Cơ chế 2 — Prefetch song song animation (cho lần mở shop):**
- Player click NPC shop → trigger animation mở dialog (~0.3-0.5s).
- Background thread gọi API fetch shop items song song với animation.
- Animation xong → data đã sẵn sàng → hiển thị instant.

### 8.2. Flow tổng thể

```
Admin sửa shop item
        │
        ▼
┌──────────────────────────┐
│  Server                  │
│  1. Validate input        │
│  2. Update DB             │
│  3. Invalidate server     │
│     cache (Redis/memory) │
│  4. Broadcast WS event    │
│     {                     │
│       action: RELOAD_SHOP,│
│       npc_id: 123         │
│     }                     │
└──────────┬───────────────┘
           │
           ▼ (broadcast tới tất cả client online)
    ┌──────┴───────┐
    ▼              ▼
┌─────────┐   ┌─────────┐
│Client A │   │Client B │
│đang mở  │   │không mở │
│shop 123 │   │         │
└────┬────┘   └────┬────┘
     │             │
     ▼             ▼
  fetch lại     xóa cache
  + refresh     local của
  dialog        npc_id 123
  + toast       (lazy refetch
                 lần sau)


─────────────────────────────────────────

Player click NPC shop (lần đầu hoặc cache miss)
        │
        ├─► Main thread: bắt đầu animation mở shop
        │
        └─► Background thread: gọi API fetch shop items
                │
                ▼
        Animation xong (~500ms) + Data đã về
                │
                ▼
        Hiển thị dialog với data → instant load
```

### 8.3. Server-side

#### 8.3.1. Endpoint admin

```typescript
POST /admin/shop/:npcId/items
Body: ShopItemServerData (hoặc array)

Response: 200 OK
```

#### 8.3.2. Logic xử lý

```typescript
async function handleShopUpdate(npcId: number, data: ShopItemServerData) {
    // 1. Validate
    validateShopItem(data);

    // 2. Update DB (transaction)
    await db.transaction(async (tx) => {
        await tx.shopItem.upsert(data);
    });

    // 3. Invalidate server cache
    await redis.del(`shop:npc:${npcId}`);

    // 4. Broadcast WS event
    wsServer.broadcast({
        action: NpcAction.SUA_NPC_SHOP,
        npc_id: npcId,
        // KHÔNG gửi payload data nặng → tránh sync schema
    });

    // 5. Audit log
    await auditLog.write({
        adminId, action: 'UPDATE_SHOP', npcId, data, timestamp: Date.now()
    });
}
```

**Quan trọng:** Event WS chỉ gửi `npc_id`, **không gửi payload data**. Lý do:

- Tránh đồng bộ schema giữa server DTO và client class.
- Giảm bandwidth WS.
- Client tự fetch khi cần → kiểm soát thời điểm tốt hơn.

#### 8.3.3. Endpoint fetch shop

```typescript
GET /api/shop/:npcId/items

Response: ShopItemServerData[]
```

```typescript
async function getShopItems(npcId: number) {
    // 1. Try cache
    const cached = await redis.get(`shop:npc:${npcId}`);
    if (cached) return JSON.parse(cached);

    // 2. Fetch DB
    const items = await db.shopItem.findActiveByNpcId(npcId);

    // 3. Cache với TTL
    await redis.setex(`shop:npc:${npcId}`, 300, JSON.stringify(items));

    return items;
}
```

### 8.4. Client-side (Java)

#### 8.4.1. Handler nhận WS event

```java
public class ShopReloadHandler {

    private final ShopCache shopCache;
    private final UIManager uiManager;
    private final ShopApiService shopApi;

    public void onReloadShopEvent(ReloadShopEvent event) {
        int npcId = event.getNpcId();

        // 1. Xóa cache local
        shopCache.invalidate(npcId);

        // 2. Nếu đang mở dialog shop NPC đó
        if (uiManager.isShopDialogOpen(npcId)) {
            // Fetch ngay và refresh dialog
            shopApi.fetchShopItems(npcId)
                .thenAccept(newItems -> {
                    shopCache.put(npcId, newItems);
                    uiManager.refreshShopDialog(npcId, newItems);
                    uiManager.showToast("Shop vừa được cập nhật");
                });
        }
        // Else: không làm gì, lazy refetch lần sau
    }
}
```

#### 8.4.2. Logic mở shop với prefetch

```java
public class ShopOpener {

    private final ShopCache shopCache;
    private final ShopApiService shopApi;
    private final UIManager uiManager;
    private final ExecutorService backgroundExecutor;

    public void onPlayerClickShopNpc(int npcId) {
        // 1. Kiểm tra cache trước
        List<ShopItemServerData> cached = shopCache.get(npcId);

        if (cached != null) {
            // Cache hit → mở luôn (nhanh nhất)
            uiManager.openShopDialog(npcId, cached);
            return;
        }

        // 2. Cache miss → trigger animation + prefetch song song
        uiManager.startOpenShopAnimation(npcId);  // ~500ms

        CompletableFuture<List<ShopItemServerData>> fetchFuture =
            CompletableFuture.supplyAsync(
                () -> shopApi.fetchShopItems(npcId),
                backgroundExecutor
            );

        // 3. Đợi animation xong
        scheduler.schedule(() -> {
            // 4. Khi animation xong, kiểm tra fetch đã xong chưa
            if (fetchFuture.isDone()) {
                List<ShopItemServerData> items = fetchFuture.join();
                shopCache.put(npcId, items);
                uiManager.openShopDialog(npcId, items);
            } else {
                // Fetch chậm hơn animation → hiện loading indicator
                uiManager.showLoadingInDialog();
                fetchFuture.thenAccept(items -> {
                    shopCache.put(npcId, items);
                    uiManager.hideLoadingAndShowItems(items);
                });
            }
        }, 500, TimeUnit.MILLISECONDS);

        // 5. Handle error
        fetchFuture.exceptionally(err -> {
            uiManager.showError("Không tải được shop. Thử lại?");
            return null;
        });
    }
}
```

#### 8.4.3. Cấu hình cache

```java
public class ShopCache {
    private final Cache<Integer, List<ShopItemServerData>> cache =
        CacheBuilder.newBuilder()
            .maximumSize(100)
            .expireAfterWrite(5, TimeUnit.MINUTES)  // TTL ngắn
            .build();

    public List<ShopItemServerData> get(int npcId) { ... }
    public void put(int npcId, List<ShopItemServerData> items) { ... }
    public void invalidate(int npcId) { ... }
}
```

### 8.5. Tránh thundering herd

**Vấn đề tiềm ẩn:** nếu 5000 user nhận event `RELOAD_SHOP` cùng lúc và **tất cả đều fetch ngay**, server bị burst.

**Giải pháp đã áp dụng:**

- **Lazy refetch:** chỉ fetch khi player thực sự mở shop.
- **Chỉ fetch ngay khi đang mở dialog** (rất ít user).
- Phân tán tải tự nhiên: 50-100 player mở shop trong 1-2 phút sau, không phải 5000 trong 1 giây.

### 8.6. Trade-off của cách shop được chọn

| Trade-off | Đánh đổi gì? | Có chấp nhận được không? |
|---|---|---|
| TTL cache 5 phút | Player có thể thấy data cũ trong 5 phút nếu mất gói WS | Có (shop ít thay đổi đến mức 5 phút quan trọng) |
| Mỗi lần mở shop có thể fetch | Tăng nhẹ tải server | Có (số lần mở shop không nhiều) |
| Phụ thuộc animation che latency | Mạng yếu → lộ loading | Có (đã có fallback loading indicator) |

---

## 9. Thiết kế chi tiết - NPC Spawn BullMQ + bảo trì

### 9.1. Flow tổng thể

```
Admin submit thay đổi NPC spawn
        │
        ▼
┌────────────────────────────────────┐
│  Push change vào Redis list        │
│  (pending_npc_changes)             │
└────────────────┬───────────────────┘
                 │
                 ▼
┌────────────────────────────────────┐
│  Check job với jobId cố định       │
│  ('npc-maintenance-pending')       │
│                                    │
│  ├─ Đã có pending → KHÔNG tạo mới │
│  │     (auto batch)                │
│  └─ Chưa có → tạo job mới          │
└────────────────┬───────────────────┘
                 │
                 ▼
┌────────────────────────────────────┐
│  Admin chọn:                       │
│  ├─ Urgent → delay 15p             │
│  └─ Normal → schedule 4h sáng       │
└────────────────┬───────────────────┘
                 │
                 ▼
┌────────────────────────────────────┐
│  Broadcast countdown cho client    │
│  (chỉ khi urgent)                  │
└────────────────┬───────────────────┘
                 │  (sau 15p hoặc đến 4h sáng)
                 ▼
┌────────────────────────────────────┐
│  Worker chạy:                      │
│  1. Maintenance mode ON            │
│  2. Force save all sessions        │
│  3. Kick all WS connections        │
│  4. Apply tất cả pending changes   │
│  5. Flush cache server             │
│  6. Maintenance mode OFF           │
│  7. Clear pending_npc_changes      │
└────────────────────────────────────┘
```

### 9.2. Server-side

#### 9.2.1. Submit thay đổi

```typescript
const MAINTENANCE_JOB_ID = 'npc-maintenance-pending';
const URGENT_DELAY_MS = 15 * 60 * 1000;

async function submitNpcSpawnChange(
    change: NpcSpawnChange,
    mode: 'urgent' | 'normal'
) {
    // 1. Validate
    validateNpcChange(change);

    // 2. Push vào Redis list
    await redis.rpush(
        'pending_npc_changes',
        JSON.stringify({ ...change, submittedAt: Date.now() })
    );

    // 3. Check job existing
    const existingJob = await maintenanceQueue.getJob(MAINTENANCE_JOB_ID);

    if (existingJob) {
        // Đã có job pending → không làm gì thêm
        // (change đã vào queue, sẽ được apply cùng batch)
        await auditLog.write({
            adminId, action: 'BATCH_NPC_CHANGE', change
        });
        return { status: 'batched', willApplyAt: existingJob.opts.delay };
    }

    // 4. Tạo job mới
    const delay = mode === 'urgent'
        ? URGENT_DELAY_MS
        : computeDelayUntil4AM();

    await maintenanceQueue.add(
        'apply-npc-changes',
        { triggeredAt: Date.now(), mode },
        {
            delay,
            jobId: MAINTENANCE_JOB_ID,  // idempotent
            removeOnComplete: false,    // giữ log
        }
    );

    // 5. Broadcast countdown nếu urgent
    if (mode === 'urgent') {
        wsServer.broadcast({
            action: 'MAINTENANCE_SCHEDULED',
            startInSeconds: 15 * 60,
            durationEstimateSeconds: 5 * 60,
        });
    }

    return { status: 'scheduled', willApplyAt: Date.now() + delay };
}
```

#### 9.2.2. Worker xử lý

```typescript
maintenanceQueue.process('apply-npc-changes', async (job) => {
    const log = createMaintenanceLog(job.id);

    try {
        // Phase 1: Maintenance mode ON
        await redis.set('server:maintenance_mode', 'true');
        wsServer.broadcast({ action: 'MAINTENANCE_STARTING' });
        log.write('Maintenance mode ON');

        // Phase 2: Force save tất cả player state
        await saveAllActiveSessions();
        log.write('All sessions saved');

        // Phase 3: Kick tất cả connections
        await kickAllPlayers('Server đang bảo trì, vui lòng đăng nhập lại sau ~5 phút');
        log.write('All players kicked');

        // Phase 4: Apply tất cả pending changes
        const changes = await redis.lrange('pending_npc_changes', 0, -1);
        log.write(`Applying ${changes.length} changes`);

        for (const changeJson of changes) {
            const change = JSON.parse(changeJson);
            try {
                await applyNpcChange(change);
                log.write(`Applied: ${change.action} ${change.npcId}`);
            } catch (err) {
                log.error(`Failed to apply: ${changeJson}`, err);
                // Tiếp tục apply các change khác
            }
        }

        // Phase 5: Flush cache
        await flushNpcCache();
        log.write('Cache flushed');

        // Phase 6: Mở lại server
        await redis.del('server:maintenance_mode');
        await redis.del('pending_npc_changes');
        log.write('Server back online');

    } catch (err) {
        log.error('Maintenance failed', err);
        // Alert ops team
        await alertOps('Maintenance job failed', err);
        throw err;
    }
});
```

### 9.3. Client-side (Java)

#### 9.3.1. Countdown UI

```java
public class MaintenanceHandler {

    public void onMaintenanceScheduled(MaintenanceScheduledEvent event) {
        int seconds = event.getStartInSeconds();
        startCountdown(seconds);
    }

    private void startCountdown(int totalSeconds) {
        // Hiện banner
        ui.showMaintenanceBanner("Server bảo trì sau " + formatTime(totalSeconds));

        // Reminder mốc quan trọng
        scheduler.schedule(() -> {
            ui.showWarning("Bảo trì sau 5 phút. Hãy về nơi an toàn!");
        }, totalSeconds - 300, SECONDS);

        scheduler.schedule(() -> {
            ui.showWarning("Bảo trì sau 1 phút. Block giao dịch.");
            blockTradeAndCombat();
        }, totalSeconds - 60, SECONDS);
    }

    public void onMaintenanceStarting(MaintenanceStartingEvent event) {
        ui.showFullscreenMessage("Server đang bảo trì...\nVui lòng đợi ~5 phút.");
        prepareForDisconnect();
    }
}
```

### 9.4. Lịch trình countdown

```
T+0  min  : Admin submit → WS "Bảo trì sau 15 phút"
T+10 min  : "Bảo trì sau 5 phút, hãy về nơi an toàn"
T+14 min  : "1 phút nữa. Block giao dịch/combat"
T+15 min  : MAINTENANCE_STARTING + kick all
T+15-20m  : Server apply changes
T+20 min  : Server up, client tự reconnect
```

### 9.5. Tại sao không hot-reload NPC như shop?

Đây là câu hỏi tự nhiên: nếu shop hot-reload được, sao NPC spawn không?

**Lý do kỹ thuật:**

1. **State conflict thật sự:**
   - Player A đang đánh boss X. Admin xóa boss X. → Boss biến mất, damage dealt mất, drop không xuất hiện. Game logic crash hoặc state corrupt.
   - Player B đang chat với NPC quest. Admin xóa NPC. → Dialog hỏng, quest progress treo.
   - Player C đang đứng ở vị trí (10, 20). Admin spawn NPC ở (10, 20). → Player kẹt trong NPC.

2. **Burst tải:**
   - Map đông có thể có 500-1000 user. Nếu mọi người đều nhận event và phải re-render world → frame drop, lag spike.

3. **Tần suất thấp:**
   - Admin không sửa NPC spawn 10 lần/ngày. Thường vài lần/tuần.
   - Chấp nhận downtime 5 phút cho việc hiếm gặp là hợp lý.

4. **Code complexity:**
   - Nếu hot-reload, phải xử lý: cancel quest đang dở, refund player đang đánh quái bị xóa, di chuyển player kẹt, broadcast cho tất cả user trong map...
   - Bảo trì + kick là cách đơn giản hơn rất nhiều.

**Trade-off:** chấp nhận admin chờ 15p (hoặc tới 4h sáng) đổi lấy hệ thống đơn giản, an toàn.

---

## 10. Edge cases & xử lý

### 10.1. Shop

| Edge case | Xử lý |
|---|---|
| Player đang trong giao dịch (chọn item, chưa confirm) thì admin đổi giá | Server validate giá tại confirm transaction. Nếu lệch → return error "Giá đã thay đổi, vui lòng kiểm tra lại". |
| Player offline khi admin sửa shop | Lần sau login + mở shop → cache miss → fetch mới. Tự nhiên đồng bộ. |
| Mất gói WS (network chập chờn) | Cache local có TTL ngắn (5 phút). Tệ nhất player thấy data cũ 5 phút, không phải vĩnh viễn. |
| Admin sửa shop liên tục 10 lần/phút | Mỗi lần → 1 WS event. Client xóa cache mỗi lần. Lazy refetch khi player mở. Không vấn đề. |
| Mạng player rất yếu, prefetch chưa xong sau animation | Hiển thị loading indicator nhỏ trong dialog, không freeze UI. |
| API fetch shop fail | Retry 1 lần, sau đó hiện error toast: "Không tải được shop. Thử lại sau." |
| Player click shop liên tục (spam) | Debounce ở client: không tạo nhiều fetch request đồng thời cho cùng 1 NPC. |

### 10.2. NPC Spawn

| Edge case | Xử lý |
|---|---|
| Admin submit nhiều thay đổi trong 15p chờ | Batch: tất cả vào pending list, chỉ 1 lần kick |
| Admin chọn urgent rồi đổi ý | Endpoint cancel/reschedule job. WS broadcast "Hủy bảo trì". |
| Server crash giữa lúc apply changes | BullMQ retry job. Pending list không clear cho tới khi success. |
| Player ngắt kết nối trước khi nhận MAINTENANCE_STARTING | Khi reconnect, server check maintenance flag → từ chối connect cho tới khi xong. |
| Một change apply lỗi (DB constraint) | Log + skip change đó, tiếp tục apply các change khác. Báo admin sau khi xong. |
| Player đang trong combat/trade khi bắt đầu kick | Trong phút cuối (T-1), block trade/combat → khi T-0, player ở trạng thái idle, an toàn kick. |
| Player từ chối thoát (game treo) | Force disconnect WS connection sau timeout 30s. |

### 10.3. Cả hai

| Edge case | Xử lý |
|---|---|
| Race condition: shop reload event tới giữa lúc đang trong NPC maintenance | Maintenance đã kick all → không có client nhận event → không vấn đề. |
| Admin web panel bị tấn công | Audit log đầy đủ. RBAC chặt chẽ. Rate limit trên endpoint admin. |
| Server có nhiều instance (scaled out) | Dùng Redis pub/sub để broadcast event giữa các instance. |
| WS bị disconnect và reconnect liên tục | Client retry với exponential backoff. Server có cơ chế dedup. |

---

## 11. Monitoring & Observability

Để vận hành hệ thống tốt, cần theo dõi các metric sau:

### 11.1. Metric cho Shop

| Metric | Mục đích | Alert threshold |
|---|---|---|
| `shop.api.qps` | Số API call shop/giây | > 1000 qps liên tục → review prefetch logic |
| `shop.api.latency.p99` | Latency 99% percentile | > 500ms → có thể ảnh hưởng UX |
| `shop.cache.hit_rate` | Tỷ lệ cache hit ở client | < 50% → review TTL hoặc tần suất reload |
| `shop.reload_events.count` | Số WS event RELOAD_SHOP/giờ | > 100/giờ → admin sửa quá nhiều, review process |
| `shop.fetch.error_rate` | Tỷ lệ API fetch fail | > 1% → check infrastructure |

### 11.2. Metric cho NPC Spawn / Maintenance

| Metric | Mục đích | Alert threshold |
|---|---|---|
| `maintenance.frequency.daily` | Số lần bảo trì/ngày | > 3 lần/ngày → review tần suất sửa NPC |
| `maintenance.duration` | Thời gian bảo trì kéo dài | > 10 phút → có vấn đề apply changes |
| `maintenance.changes_per_batch` | Số change/batch trung bình | < 2 → admin không tận dụng batch |
| `maintenance.apply_errors` | Số change apply lỗi | > 0 → cần review ngay |
| `maintenance.cancellation_rate` | Tỷ lệ hủy bảo trì | > 20% → admin không chắc chắn khi submit |
| `players.kicked_per_maintenance` | Số player bị kick mỗi lần | Track để báo cáo impact |

### 11.3. Audit log

Tất cả thao tác admin phải được log với:

```json
{
  "timestamp": "2026-05-09T10:30:45Z",
  "admin_id": "admin_001",
  "admin_ip": "10.0.0.5",
  "action": "UPDATE_SHOP_ITEM",
  "target_npc_id": 123,
  "before": { ... },
  "after": { ... },
  "result": "success",
  "trace_id": "abc-123"
}
```

### 11.4. Dashboard đề xuất

- **Real-time:** số player online, số shop reload/phút, maintenance pending status.
- **Daily:** tổng số thay đổi shop/NPC, tổng số bảo trì, downtime tổng.
- **Weekly:** trending top NPC bị sửa nhiều nhất, top admin active, error rate.

---

## 12. Kế hoạch triển khai

### 12.1. Phase 1 - Shop hot reload + prefetch (1.5 tuần)

**Backend:**
- [ ] Endpoint `POST /admin/shop/:npcId/items`
- [ ] Endpoint `GET /api/shop/:npcId/items`
- [ ] Logic update DB + invalidate Redis cache
- [ ] WS broadcast `RELOAD_SHOP` event
- [ ] Audit log
- [ ] Test integration

**Client:**
- [ ] WS handler `ShopReloadHandler`
- [ ] Logic cache shop với TTL 5 phút
- [ ] Logic prefetch song song với animation
- [ ] Fallback loading indicator nếu fetch chậm
- [ ] Error handling + retry
- [ ] UI toast "Shop vừa được cập nhật"

**QA:**
- [ ] Test 100 client cùng nhận event (không burst)
- [ ] Test mất gói WS
- [ ] Test player đang trong transaction
- [ ] Test mạng yếu (3G simulation)
- [ ] Test admin sửa liên tục

### 12.2. Phase 2 - NPC Spawn BullMQ + bảo trì (2 tuần)

**Backend:**
- [ ] Setup BullMQ queue + worker
- [ ] Endpoint `POST /admin/npc-spawn` với mode urgent/normal
- [ ] Worker apply changes
- [ ] Maintenance mode flag (Redis)
- [ ] Force save all sessions logic
- [ ] Kick all connections logic
- [ ] Cancel/reschedule maintenance endpoint
- [ ] Audit log

**Client:**
- [ ] WS handler `MaintenanceHandler`
- [ ] Countdown UI (banner, warning popup)
- [ ] Block trade/combat ở phút cuối
- [ ] Reconnect logic sau bảo trì
- [ ] UI hủy bảo trì

**QA:**
- [ ] Test batch nhiều changes trong 15p
- [ ] Test apply changes thành công
- [ ] Test apply 1 change lỗi (skip + log)
- [ ] Test player offline lúc bảo trì
- [ ] Test reconnect
- [ ] Test admin cancel maintenance

### 12.3. Phase 3 - Monitoring & polish (1 tuần)

- [ ] Setup metric collection (Prometheus/Grafana)
- [ ] Dashboard real-time + daily
- [ ] Alert rules
- [ ] Audit log dashboard
- [ ] Document vận hành cho admin
- [ ] Training admin team

### 12.4. Tổng thời gian dự kiến

**~4.5 tuần** (tính cả test + buffer).

### 12.5. Rollback plan

Nếu Phase 1 hoặc Phase 2 có vấn đề nghiêm trọng:

- **Phase 1 rollback:** Tắt WS event RELOAD_SHOP. Client fallback về cache cũ với TTL dài. Admin tạm thời dùng bảo trì cho cả shop.
- **Phase 2 rollback:** Tạm dùng cách 1 (bảo trì 4h sáng cố định). Không có downtime giữa ngày.

---

## 13. Câu hỏi thường gặp (FAQ)

### 13.1. Tại sao không bỏ cache hoàn toàn cho đơn giản?

Đã đánh giá ở phương án F. Bỏ cache hoàn toàn:
- ✅ Đơn giản nhất.
- ❌ Tăng tải server đáng kể (mỗi lần đổi map = 1 request, mỗi lần mở dialog = 1 request).
- ❌ Latency cao hơn cho user.
- ❌ Tốn bandwidth user (mobile 4G).

Phương án được chọn (cache + invalidate đúng lúc) cân bằng tốt hơn giữa đơn giản, hiệu suất, và UX.

### 13.2. Tại sao shop không cần versioning như NPC?

Shop có TTL ngắn (5 phút) làm cơ chế tự heal. Tệ nhất player thấy giá cũ 5 phút. Với NPC nếu không có versioning thì state lệch vĩnh viễn.

Nhưng vì NPC dùng bảo trì kick all → không cần versioning luôn. Đơn giản hóa hệ thống.

### 13.3. Nếu admin chỉ sửa NPC mỗi tháng 1 lần, có cần BullMQ không?

Nếu thật sự chỉ 1 lần/tháng → có thể dùng cách A (bảo trì 4h sáng cố định) là đủ.

BullMQ + bảo trì 15p được chọn để **linh hoạt**: cho phép admin chọn urgent khi cần fix gấp, normal khi không cần. Phù hợp khi tần suất là vài lần/tuần.

### 13.4. Cách này có scale được không khi server nhiều instance?

Có, nhưng cần thêm:
- WS broadcast qua Redis pub/sub giữa các instance.
- BullMQ shared queue (đã hỗ trợ sẵn).
- Distributed lock cho maintenance worker (chỉ 1 instance chạy worker tại 1 thời điểm).

### 13.5. Nếu shop có hệ thống auction/realtime price thì sao?

Tài liệu này giả định shop là **static price** do admin set. Nếu shop có auction (giá thay đổi liên tục theo bid), cần thiết kế khác:
- Realtime price: WS push price update mỗi N giây.
- Player subscribe vào auction channel khi mở dialog.
- Đây là use case khác, ngoài phạm vi tài liệu này.

### 13.6. Tại sao chọn 15 phút mà không phải 5 hay 30 phút?

15 phút là cân bằng:
- Đủ để player kết thúc trận đấu/quest dở dang (5 phút thường không đủ).
- Đủ ngắn để admin không phải chờ quá lâu khi cần fix gấp (30 phút quá dài).
- Phù hợp với batching: admin có thể submit thêm changes trong 15p này.

Có thể config được, không hard-code.

### 13.7. Nếu game scale ra hàng triệu user thì kiến trúc này còn dùng được không?

- **Shop hot reload:** scale tốt, vì mỗi instance broadcast qua Redis pub/sub, không có bottleneck.
- **NPC bảo trì:** vẫn dùng được, nhưng cần phân tách bảo trì theo region/server (kick all 1 server thay vì cả game). Tham khảo cách MMO lớn (WoW, FF14) có maintenance per-realm.

---

## 14. Phụ lục

### 14.1. Bảng tổng hợp so sánh các phương án

| Tiêu chí | A (4h sáng) | B (Invalidate) | C (WS delta) | D (WS+ver) | E (BullMQ all) | F (No cache) | G (Lazy + WS) | H (Prefetch) | **I (Tách)** |
|---|---|---|---|---|---|---|---|---|---|
| Fix gấp shop | ❌ | ✅ | ✅ | ✅ | 🔶 | ✅ | ✅ | ✅ | ✅ |
| Fix gấp NPC | ❌ | ✅ | ✅ | ✅ | 🔶 | ✅ | ✅ | N/A | 🔶 |
| Tránh burst | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ |
| Tránh state conflict | ✅ | ❌ | 🔶 | 🔶 | ✅ | ❌ | ❌ | ✅ | ✅ |
| Đơn giản triển khai | ✅ | ✅ | ❌ | ❌ | 🔶 | ✅ | 🔶 | ✅ | 🔶 |
| UX shop | ✅ | 🔶 | ✅ | ✅ | ❌ | 🔶 | ✅ | ✅ | ✅ |
| UX NPC | ✅ | 🔶 | ✅ | ✅ | 🔶 | 🔶 | ✅ | N/A | 🔶 |
| Phù hợp tần suất | ❌ | 🔶 | ✅ | ✅ | 🔶 | ✅ | ✅ | ✅ | ✅ |
| Tải server | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ | ✅ | 🔶 | ✅ |
| Bandwidth user | ✅ | 🔶 | ✅ | ✅ | ✅ | ❌ | ✅ | 🔶 | ✅ |
| Code complexity | ✅ | ✅ | ❌ | ❌ | 🔶 | ✅ | ❌ | ✅ | 🔶 |
| **Tổng** | 6/11 | 5/11 | 7/11 | 7/11 | 6/11 | 5/11 | 8/11 | 9/11 | **9/11** ✅ |

### 14.2. DTO tham khảo

```java
// NPC Spawn data
public class NpcServerData {
    public int id;
    public int npc_base_id;
    public String ten_npc;
    public String loai_npc;
    public int map_id;
    public float x;
    public float y;
    public boolean is_active;
}

// Shop item data
public class ShopItemServerData {
    public int id;
    public int item_base_id;
    public String ten_item;
    public String ma_item;
    public long gia;
    public String loaiTien;
    public String tab;
    public boolean is_active;
}
```

### 14.3. WS Event Schema

```typescript
// Shop reload (nhẹ, không có payload data)
interface ReloadShopEvent {
    action: 'RELOAD_SHOP';
    npc_id: number;
}

// Maintenance scheduled
interface MaintenanceScheduledEvent {
    action: 'MAINTENANCE_SCHEDULED';
    startInSeconds: number;
    durationEstimateSeconds: number;
    reason?: string;
}

// Maintenance starting (T-0)
interface MaintenanceStartingEvent {
    action: 'MAINTENANCE_STARTING';
}

// Maintenance cancelled
interface MaintenanceCancelledEvent {
    action: 'MAINTENANCE_CANCELLED';
    reason?: string;
}
```

### 14.4. Cấu hình tham số

```yaml
# config.yaml
maintenance:
  urgent_delay_minutes: 15
  reminder_minutes: [10, 14]  # T-5min, T-1min
  estimated_duration_minutes: 5
  scheduled_4am_cron: "0 4 * * *"

shop:
  cache_ttl_seconds: 300  # 5 phút
  api_timeout_ms: 3000
  prefetch_animation_ms: 500
  retry_count: 1

npc:
  pending_changes_redis_key: "pending_npc_changes"
  maintenance_job_id: "npc-maintenance-pending"
  cache_key_prefix: "npc:cache:"
```

### 14.5. Nguyên tắc thiết kế áp dụng

Tài liệu này áp dụng các nguyên tắc:

1. **Right tool for the right job** — không one-size-fits-all.
2. **YAGNI** (You Aren't Gonna Need It) — không build versioning phức tạp khi chưa cần.
3. **Fail safe** — bảo trì + kick là an toàn nhất khi có nguy cơ state conflict.
4. **Perceived performance** — prefetch song song animation cho UX tốt.
5. **Lazy invalidation** — phân tán tải tự nhiên, tránh thundering herd.
6. **Audit everything** — admin actions phải traceable.
7. **Graceful degradation** — có fallback khi mạng yếu, server chậm.

### 14.6. Tham khảo

1. **Lineage 2 (L2J)** - GM commands documentation: `//reload npc`, `//addShopItem`, `//edit_npc`
2. **EverQuest Emulator (EQEmu)** - Hot reload với `#reload` và `#hotfix`
3. **Genshin Impact, Honkai Star Rail (miHoYo)** - Live shop/event update không kick user
4. **Liên Minh Tốc Chiến, Valorant (Riot Games)** - Hotfix balance trong trận
5. **US Patent 9106963** - Player-side cache versioning pattern
6. **BullMQ documentation** - Queue + delayed job + idempotent jobId
7. **MMO Architecture (PRDeving)** - CAS với version hash
8. **Apple HIG** - Perceived performance, animation che cold start
9. **Google SRE Book** - Graceful degradation, cache invalidation strategies

---

**Lịch sử thay đổi:**

| Version | Ngày | Người | Nội dung |
|---|---|---|---|
| 1.0 | 2026-05-09 | - | Khởi tạo, đề xuất phương án tách shop/NPC spawn |
| 2.0 | 2026-05-09 | - | Mở rộng các phương án F (no cache), G (lazy invalidate), H (prefetch). Thêm monitoring, FAQ, edge cases chi tiết. |

**Người soạn:** [Tên]
**Reviewer:** [Tech Lead]
**Approved by:** [Product Owner]