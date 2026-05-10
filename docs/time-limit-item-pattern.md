# Tài liệu kỹ thuật: Patterns xử lý Time-limited Items trong Game

> **Phiên bản:** 2.0
> **Ngày:** 2026-05-09
> **Trạng thái:** Tham khảo kỹ thuật
> **Đối tượng đọc:** Backend dev, Game architect, Tech Lead

---

## Mục lục

1. [Tổng quan](#1-tổng-quan)
2. [Định nghĩa 3 patterns](#2-định-nghĩa-3-patterns)
3. [So sánh đặc tính kỹ thuật](#3-so-sánh-đặc-tính-kỹ-thuật)
4. [Use case: Daily/Weekly Reset Shop](#4-use-case-dailyweekly-reset-shop)
5. [Use case: Event Shop có deadline](#5-use-case-event-shop-có-deadline)
6. [Use case: Flash Sale chính xác](#6-use-case-flash-sale-chính-xác)
7. [Sử dụng pattern sai use case sẽ gây vấn đề gì?](#7-sử-dụng-pattern-sai-use-case-sẽ-gây-vấn-đề-gì)
8. [Bảng quyết định nhanh](#8-bảng-quyết-định-nhanh)
9. [Độ trễ thực tế của Pattern 1 (sửa lại cho chính xác)](#9-độ-trễ-thực-tế-của-pattern-1-sửa-lại-cho-chính-xác)
10. [Xử lý multi-region: Timezone & Clock Skew](#10-xử-lý-multi-region-timezone--clock-skew)
11. [Cristian's Algorithm — đồng bộ đồng hồ client với server](#11-cristians-algorithm--đồng-bộ-đồng-hồ-client-với-server)
12. [Kiến trúc kết hợp cả 3 patterns](#12-kiến-trúc-kết-hợp-cả-3-patterns)
13. [Tham khảo từ industry](#13-tham-khảo-từ-industry)

---

## 1. Tổng quan

Trong game live-service, hầu như mọi hệ thống shop/event đều có yếu tố thời gian. Có **3 patterns kỹ thuật** thường được dùng để xử lý time-limited items:

- **Pattern 1 — Lazy Filter (filter `start_at`/`end_at` khi fetch/render)**
- **Pattern 2 — Scheduled Cron (reset đồng loạt theo lịch cố định)**
- **Pattern 3 — Delayed Job (job per-item kích hoạt đúng giây)**

**Sự thật quan trọng:** không có pattern nào "thống trị". Game prod lớn (Genshin, WoW, Lost Ark, FFXIV, MLBB) đều dùng **kết hợp cả 3**, mỗi pattern cho 1 use case khác nhau. Việc chọn sai pattern cho use case sẽ dẫn đến vấn đề kỹ thuật và UX nghiêm trọng.

Tài liệu này phân tích **vì sao mỗi use case bắt buộc phải dùng pattern tương ứng**, và **dùng sai sẽ gặp vấn đề gì**, kèm theo cách xử lý multi-region (server châu Á, user toàn cầu).

---

## 2. Định nghĩa 3 patterns

### Pattern 1 — Lazy Filter

**Cơ chế:** Item có 2 field `start_at` và `end_at` (lưu UTC). Mỗi lần render UI, filter theo `now`:

```typescript
const now = Date.now();  // hoặc serverNow nếu có clock sync
return allItems.filter(item =>
    item.is_active &&
    (!item.start_at || item.start_at <= now) &&
    (!item.end_at || item.end_at > now)
);
```

**Đặc điểm quan trọng:**
- Mỗi item có **lifecycle độc lập**.
- **Không cần background job** xử lý expiration.
- **Không cần WS event "trigger hết hạn"** — item tự "biến mất" qua filter khi `now > end_at`.
- Server validate `now < end_at` lúc transaction (anti-cheat).
- WS event `RELOAD_SHOP` chỉ cần khi admin **sửa data**, không phải khi item hết hạn tự nhiên.

### Pattern 2 — Scheduled Cron

**Cơ chế:** Cron job chạy đúng giờ cố định (vd: 4h sáng UTC+7) reset stock/items đồng loạt:

```typescript
@Cron('0 4 * * *', { timeZone: 'Asia/Bangkok' })
async dailyShopReset() {
    await db.shopItem.updateMany({ stock: 'reset_to_default' });
    await redis.flushPrefix('shop:');
    wsServer.broadcast({ action: 'DAILY_RESET' });
}
```

**Đặc điểm:**
- **Đồng bộ tuyệt đối** giữa các player tại 1 thời điểm cố định.
- Reset **counter** (purchase limit, stock) — không chỉ là time filter.
- Cần WS broadcast để client update ngay.

### Pattern 3 — Delayed Job

**Cơ chế:** Khi tạo item có `end_at`, schedule background job (BullMQ/Sidekiq/Quartz) chạy đúng `end_at`:

```typescript
async function createFlashSaleItem(item) {
    const result = await db.shopItem.create(item);
    const delayMs = item.end_at.getTime() - Date.now();
    await flashSaleQueue.add(
        'expire-item',
        { itemId: result.id },
        { delay: delayMs, jobId: `expire-${result.id}` }
    );
    return result;
}

flashSaleQueue.process('expire-item', async (job) => {
    await db.shopItem.update({ id: job.data.itemId, is_active: false });
    wsServer.broadcast({ action: 'FLASH_SALE_END', itemId: job.data.itemId });
});
```

**Đặc điểm:**
- Chính xác đến **giây/millisecond**.
- Có thể trigger logic phức tạp khi item bắt đầu/kết thúc (broadcast, init counter, log, refund).
- Cần infrastructure queue.

---

## 3. So sánh đặc tính kỹ thuật

| Tiêu chí | Pattern 1 (Lazy) | Pattern 2 (Cron) | Pattern 3 (Delayed Job) |
|---|---|---|---|
| **Độ chính xác hết hạn** | ~1 frame UI render (~16-1000ms) | Tuyệt đối tại giờ cron | Đến giây/millisecond |
| **Đồng bộ giữa player** | Phụ thuộc đồng hồ từng client | Tất cả player reset cùng lúc | Server push event đồng thời |
| **Background job** | Không cần | Cần cron (1 job/ngày) | Cần queue (N job/N item) |
| **WS event khi hết hạn** | Không cần (client tự filter) | Có (DAILY_RESET) | Có (FLASH_SALE_END) |
| **Trigger logic phức tạp khi hết hạn** | Khó | Có thể (tại lúc cron chạy) | Dễ (tại đúng `end_at`) |
| **Scale với số lượng item** | Tốt (chỉ filter) | Tốt (1 cron cho tất cả) | Kém (1 job/item) |
| **Phụ thuộc đồng hồ client** | Có (cần Cristian sync) | Không | Không |
| **Phù hợp với "reset đồng bộ"** | Không | Có | Không |
| **Phù hợp với "lifecycle độc lập"** | Có | Không | Có |

---

## 4. Use case: Daily/Weekly Reset Shop

### 4.1. Đặc điểm use case

- Shop reset stock/items **đồng loạt** cho tất cả player tại cùng 1 thời điểm.
- Player kỳ vọng "mỗi sáng mở game thấy shop mới".
- Reset là **đồng bộ toàn server**, không tính từ thời điểm player vào game.

### 4.2. Ví dụ thực tế từ game prod

**World of Warcraft:** Daily reset 8h sáng PST/CET, weekly reset thứ 3 (US) hoặc thứ 4 (EU). Reset áp dụng cho daily quests, dungeon lockouts, world bosses, raid lockouts.

**Genshin Impact:** Daily reset 4h sáng theo timezone server. Weekly reset thứ 2 lúc 4h sáng. Hầu hết shop refresh stock theo daily/weekly reset.

**Final Fantasy XIV:** Có 2 daily resets khác nhau cho các nội dung khác nhau (Duty/Beast Tribe vs Grand Company), mỗi cái có giờ riêng cố định.

**Mobile Legends Bang Bang (MLBB):** Daily reset 16:00 PHT (UTC+8) — daily tasks, login rewards, shop refresh, free chest limits.

**Neverness to Everness (NTE):** Daily reset 5:00 AM server time. "Server time always takes priority over your local timezone, so players in different parts of the world on the same server all reset at the same real-world moment."

### 4.3. Vì sao bắt buộc dùng Pattern 2 (Cron)?

**Lý do 1: Đồng bộ tuyệt đối giữa player**

Player A và B phải thấy shop reset cùng lúc. Nếu một player thấy shop mới mà người khác chưa thấy → "không công bằng", "server lỗi".

**Lý do 2: Reset là 1 hành động atomic, không chỉ là filter time**

Reset không chỉ là "thay đổi list items" mà còn:
- Reset stock counter (player đã mua hôm qua → giờ mua lại được).
- Reset purchase limit (mua tối đa 5 cái/ngày → reset về 0).
- Reset rotation (item ngẫu nhiên hôm nay khác hôm qua).

Tất cả phải xảy ra **cùng lúc**. Pattern 1 không làm được vì mỗi item có lifecycle độc lập.

**Lý do 3: Player expectation đã hình thành 20+ năm**

Cụm "daily reset", "weekly reset" là term chuẩn ngành từ thời WoW (2004).

**Lý do 4: Server load dễ kiểm soát**

Cron chạy 1 lần/ngày, biết trước → có thể chuẩn bị infrastructure.

### 4.4. Implementation chuẩn

```typescript
@Cron('0 4 * * *', { timeZone: 'Asia/Bangkok' })
async dailyShopReset() {
    const log = createResetLog();

    try {
        await db.shopItem.resetDailyStock();
        await db.playerPurchase.resetDailyLimit();
        await rollDailyShopRotation();
        await redis.del('shop:daily:*');
        wsServer.broadcast({
            action: 'DAILY_RESET',
            timestamp: Date.now(),
            type: 'shop'
        });
        log.write('Daily reset completed');
    } catch (err) {
        log.error('Daily reset failed', err);
        await alertOps('Daily reset failed', err);
    }
}
```

### 4.5. Edge cases

| Edge case | Xử lý |
|---|---|
| Player offline lúc cron chạy | Khi login lại → fetch fresh qua API thường |
| Cron chạy lỗi giữa chừng | Idempotent: cron có thể chạy lại an toàn |
| Multi-server (cluster) | Distributed lock: chỉ 1 instance chạy cron |
| Player đang mở dialog shop | WS event `DAILY_RESET` → client refresh dialog |

---

## 5. Use case: Event Shop có deadline

### 5.1. Đặc điểm use case

- Event shop xuất hiện trong khoảng thời gian xác định (vd: 1/6 - 7/6).
- **Mỗi event có deadline riêng**, không đồng bộ.
- Có thể có nhiều event chạy song song với deadline khác nhau.
- Player kỳ vọng "thấy countdown timer" trên item.

### 5.2. Ví dụ thực tế

**Genshin Impact (event banner):**

```json
{
  "id": 301,
  "name": "Yelan Banner",
  "from": "2026-05-09T18:00:00+08:00",
  "to": "2026-05-30T14:59:59+08:00"
}
```

**Project SEKAI (event banner):**

```typescript
interface GachaInfo {
    id: number;
    gachaType: string;
    name: string;
    startAt: string;  // milliseconds timestamp
    endAt: string;
}
```

Logic: "The system identifies active banners by comparing current time against banner start/end timestamps."

**WoW MaNGOS emulator — game_event table:**

```sql
CREATE TABLE game_event (
    entry MEDIUMINT,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    occurence BIGINT,
    length BIGINT
);
```

Schema chuẩn cho event: "Absolute start date of the event. The event will start occurring only if the local time at the server is after the one set here."

### 5.3. Vì sao bắt buộc dùng Pattern 1 (Lazy)?

**Lý do 1: Mỗi event có lifecycle độc lập**

Game có thể có 20-30 event chạy song song với deadline khác nhau. Cron không phù hợp vì không có "1 thời điểm reset chung".

**Lý do 2: Số lượng event scale tùy ý**

Pattern 3 (Delayed Job) tạo N job cho N event → tốn infra. Pattern 1 chỉ cần 1 query `WHERE end_at > NOW()` → scale O(1).

**Lý do 3: Không cần chính xác đến giây**

Event 7 ngày, deadline lệch vài giây không ảnh hưởng. Pattern 1 đủ.

**Lý do 4: Countdown UI là native**

Client biết `end_at` → tự render countdown. Không cần WS event.

**Lý do 5: Đơn giản nhất, dễ debug**

Chỉ thêm 2 field, filter mỗi lần fetch. Không cron, không queue, không job nào fail được.

### 5.4. Implementation chuẩn

**Schema:**
```sql
CREATE TABLE shop_item (
    id INT PRIMARY KEY,
    name VARCHAR(255),
    price BIGINT,
    is_active BOOLEAN DEFAULT TRUE,
    start_at TIMESTAMP NULL,  -- Lưu UTC
    end_at TIMESTAMP NULL     -- Lưu UTC
);
CREATE INDEX idx_shop_active_time ON shop_item(is_active, end_at);
```

**Server query (cache lưu raw data):**
```typescript
async function getShopItems(npcId: number) {
    const cached = await redis.get(`shop:npc:${npcId}`);
    let allItems = cached
        ? JSON.parse(cached)
        : await db.shopItem.findByNpcId(npcId);

    if (!cached) {
        await redis.setex(`shop:npc:${npcId}`, 300, JSON.stringify(allItems));
    }

    // Filter theo time TẠI request
    const now = Date.now();  // server clock
    const items = allItems.filter(item =>
        item.is_active &&
        (!item.start_at || new Date(item.start_at).getTime() <= now) &&
        (!item.end_at || new Date(item.end_at).getTime() > now)
    );

    return {
        items,
        server_now: now  // gửi kèm để client sync clock
    };
}
```

**Validate khi mua (anti-cheat — quan trọng nhất):**
```typescript
async function purchaseItem(playerId: string, itemId: number) {
    const item = await db.shopItem.findById(itemId);
    const now = Date.now();

    if (!item.is_active) throw new Error('Item không khả dụng');
    if (item.start_at && new Date(item.start_at).getTime() > now) {
        throw new Error('Item chưa bắt đầu bán');
    }
    if (item.end_at && new Date(item.end_at).getTime() <= now) {
        throw new Error('Item đã hết hạn');
    }

    // Process transaction...
}
```

**Client filter + countdown UI:**
```java
public List<ShopItemServerData> getDisplayItems(int npcId) {
    List<ShopItemServerData> allItems = shopCache.get(npcId);

    // Dùng serverNow đã sync, không phải System.currentTimeMillis() trực tiếp
    long now = clockSync.getServerNow();

    return allItems.stream()
        .filter(item -> item.is_active)
        .filter(item -> item.start_at == null || item.start_at <= now)
        .filter(item -> item.end_at == null || item.end_at > now)
        .collect(Collectors.toList());
}
```

### 5.5. Edge cases

| Edge case | Xử lý |
|---|---|
| Đồng hồ client lệch | Dùng Cristian's algorithm (xem Section 11) |
| Player đang xem item lúc nó hết hạn | Countdown về 0 → tự ẩn item |
| Player đã add item vào cart, sắp confirm | Server validate lại lúc confirm |
| Cache chưa expire nhưng item đã hết hạn | Filter logic xử lý → item không xuất hiện |

---

## 6. Use case: Flash Sale chính xác

### 6.1. Đặc điểm use case

- Sale bắt đầu/kết thúc tại thời điểm **chính xác đến giây**.
- Có **thundering herd**: hàng nghìn user click "Mua" cùng 1 giây khi sale bắt đầu.
- Cần trigger logic phức tạp tại đúng thời điểm (notification, init counter, log).
- Số lượng item bán có giới hạn, chống oversell.

### 6.2. Ví dụ thực tế

**Amazon Lightning Deals, Flipkart Big Billion Days, Alibaba Singles' Day:**

Theo bài system design về Flash Sale: "Flash sales create a thundering herd problem where traffic can spike 100x or more within seconds of the sale starting."

**Architecture flash sale:** "Inventory overselling. 50,000 users click 'Buy Now' on the same 500-unit item within 200 milliseconds of T-0. A naive SELECT quantity ... UPDATE quantity = quantity - 1 will oversell."

**Trong game:** Hiếm. Hầu hết MMO không có flash sale precise. Đây là pattern e-commerce hơn là game.

### 6.3. Vì sao bắt buộc dùng Pattern 3 (Delayed Job)?

**Lý do 1: Cần precision đến giây**

Pattern 1 phụ thuộc client tự fetch và đồng hồ máy → không đảm bảo công bằng giữa các user.

Pattern 2 (cron) chỉ chạy được tại các thời điểm cố định trên crontab.

**Lý do 2: Cần trigger logic phức tạp tại đúng thời điểm**

Khi flash sale bắt đầu/kết thúc, cần:
- Push notification toàn server.
- Mở/đóng UI flash sale ở client.
- Reset inventory counter atomic.
- Log analytics start/end.

Pattern 1 không có "thời điểm trigger". Pattern 3 chạy job đúng giây → trigger được.

**Lý do 3: Fairness giữa user toàn cầu**

Pattern 1: User A đồng hồ chính xác mua được, User B đồng hồ lệch +5s không thấy sale tới 5 giây sau → không công bằng.

Pattern 3: Server push event đồng thời, mọi user nhận trong vòng vài trăm ms → công bằng.

**Lý do 4: Số lượng flash sale ít**

Một game thường chỉ có 1-3 flash sale active cùng lúc → tạo 1-3 delayed job không tốn infra.

**Lý do 5: Combine với queue cho thundering herd**

Flash sale thường kết hợp với:
- Virtual queue (xếp hàng).
- Token bucket rate limit.
- Atomic inventory decrement (Redis INCR/DECR).

Pattern 3 (queue-based) tự nhiên integrate.

### 6.4. Implementation chuẩn

```typescript
async function scheduleFlashSale(sale: FlashSale) {
    await db.flashSale.create(sale);

    const startDelay = sale.start_at.getTime() - Date.now();
    await flashSaleQueue.add(
        'start-sale',
        { saleId: sale.id },
        { delay: startDelay, jobId: `start-${sale.id}` }
    );

    const endDelay = sale.end_at.getTime() - Date.now();
    await flashSaleQueue.add(
        'end-sale',
        { saleId: sale.id },
        { delay: endDelay, jobId: `end-${sale.id}` }
    );
}

flashSaleQueue.process('start-sale', async (job) => {
    const sale = await db.flashSale.findById(job.data.saleId);

    await db.flashSale.update({ id: sale.id, is_active: true });
    await redis.set(`flash_sale:${sale.id}:stock`, sale.total_stock);

    wsServer.broadcast({
        action: 'FLASH_SALE_START',
        saleId: sale.id,
        endAt: sale.end_at,
        server_now: Date.now()  // để client sync
    });

    pushNotificationToAllPlayers({
        title: 'Flash Sale!',
        body: `${sale.name} đang diễn ra! Còn ${sale.duration} phút.`
    });

    analytics.track('flash_sale_started', { saleId: sale.id });
});

async function purchaseFlashSaleItem(playerId: string, saleId: number) {
    const remaining = await redis.decr(`flash_sale:${saleId}:stock`);

    if (remaining < 0) {
        await redis.incr(`flash_sale:${saleId}:stock`);
        throw new Error('Hết hàng!');
    }

    await orderQueue.add('process-order', { playerId, saleId });
}
```

### 6.5. Edge cases

| Edge case | Xử lý |
|---|---|
| Server crash trước khi job chạy | BullMQ persist → retry sau restart |
| Job chạy trễ vài ms | Acceptable nếu < 1s |
| Hủy flash sale trước thời điểm | Remove job qua jobId |
| Multi-server | BullMQ shared queue, worker pool tự balance |
| Thundering herd lúc bắt đầu | Virtual queue + rate limit + atomic Redis |

---

## 7. Sử dụng pattern sai use case sẽ gây vấn đề gì?

### 7.1. Dùng Pattern 1 (Lazy) cho Daily Reset

**Vấn đề 1: Không reset đồng bộ giữa player**

```
Player A: login 3h59 → cache shop → admin update lúc 4h cron → A vẫn thấy data cũ.
Player B: login 4h05 → fetch fresh → thấy data mới.
→ Khiếu nại "tại sao bạn tôi có item này mà tôi không có".
```

**Vấn đề 2: Không reset purchase limit / stock counter**

Pattern 1 chỉ filter `start_at`/`end_at`. Daily reset cần reset:
- `daily_purchase_count` per-player về 0.
- `current_stock` về `default_stock`.
- Random rotation.

→ Pattern 1 không làm được vì không có "trigger point".

**Vấn đề 3: Workaround phức tạp**

Để hack Pattern 1 cho daily reset: tạo N item mới mỗi ngày với `start_at`, `end_at` = phạm vi ngày đó → 100 shop × 10 item × 365 ngày = 365k row/năm. DB phình to.

### 7.2. Dùng Pattern 1 (Lazy) cho Flash Sale

**Vấn đề 1: Không trigger được notification "Sale bắt đầu"**

Marketing nói: "Đúng 12h00, push notification toàn user." Pattern 1 không có job nào chạy lúc 12h00.

**Vấn đề 2: Không init stock atomic**

Flash sale 100 cái. Cần init counter = 100 tại đúng thời điểm start. Pattern 1 không có hook.

**Vấn đề 3: Thundering herd**

Pattern 1 không integrate queue → không shape traffic được.

**Vấn đề 4: Fairness**

User toàn cầu đồng hồ khác nhau → user lợi/thiệt khác nhau dựa vào clock skew.

### 7.3. Dùng Pattern 2 (Cron) cho Event Shop

**Vấn đề 1: Mỗi event cần 1 cron riêng**

30 event = 30 cron entry. Quản lý kinh hoàng. Mỗi lần admin tạo event mới phải SSH vào server sửa crontab.

**Vấn đề 2: Không scale với event tạo runtime**

Admin tạo event qua web panel: "Sale mới, kết thúc 3 ngày sau". Pattern 2 không tạo dynamic cron dễ dàng.

(Có dynamic scheduler runtime, nhưng đó về bản chất đã chuyển sang Pattern 3.)

### 7.4. Dùng Pattern 3 (Delayed Job) cho Event Shop

**Vấn đề 1: Tốn infra**

100 event banner = 100 delayed job trong queue.

**Vấn đề 2: Lifecycle phức tạp khi sửa**

Admin sửa `end_at` → phải tìm job cũ, cancel, tạo job mới. Pattern 1 chỉ cần `UPDATE`.

**Vấn đề 3: Over-engineering**

Event 7 ngày không cần precision đến giây.

### 7.5. Dùng Pattern 2 (Cron) cho Flash Sale

**Vấn đề 1: Crontab không hỗ trợ giây**

Crontab format: `phút giờ ngày tháng tuần`. Sale bắt đầu 12h00:30 → cron không làm được.

**Vấn đề 2: Khó cancel dynamic**

Admin muốn cancel flash sale → SSH sửa crontab. Pattern 3 chỉ cần `removeJob(jobId)`.

### 7.6. Tổng kết

| Use case | Pattern đúng | Pattern sai → vấn đề |
|---|---|---|
| Daily reset shop | Pattern 2 | P1: không reset đồng bộ, không reset counter |
| Event shop deadline | Pattern 1 | P2: không scale; P3: tốn job, lifecycle phức tạp |
| Flash sale precise | Pattern 3 | P1: không trigger, không init stock, không fair; P2: không có giây |

---

## 8. Bảng quyết định nhanh

```
Hỏi 1: Reset đồng bộ giữa tất cả player tại 1 giờ cố định?
├── CÓ → Pattern 2 (Cron)
└── KHÔNG → Hỏi 2

Hỏi 2: Cần precision đến giây + trigger logic phức tạp?
├── CÓ → Pattern 3 (Delayed Job)
└── KHÔNG → Hỏi 3

Hỏi 3: Nhiều entity với deadline riêng?
├── CÓ → Pattern 1 (Lazy Filter)
└── KHÔNG → Pattern 1 hoặc Pattern 3 đều OK
```

---

## 9. Độ trễ thực tế của Pattern 1 (sửa lại cho chính xác)

Phần này **đính chính** một số nhận định trong các tài liệu trước.

### 9.1. Pattern 1 KHÔNG phụ thuộc cache TTL để hết hạn item

**Nhận định sai trước đây:** "TTL cache 5 phút làm Pattern 1 trễ 5 phút."

**Sự thật:**

Pattern 1 hoạt động bằng cách filter `now < end_at` mỗi lần render. **Cache lưu raw data có `end_at`**, không cache đã filter. Vì vậy:

```java
// Cache vô hạn — không TTL
shopCache.put(npcId, items);  // items có item A với end_at = 12:00

// 11:55 — render dialog
filter(items, now=11:55);  // hiện A

// 12:01 — render dialog (cache vẫn có A)
filter(items, now=12:01);  // KHÔNG hiện A nữa
```

→ **Item biến mất đúng giờ kể cả cache vô hạn.** TTL cache chỉ ảnh hưởng đồng bộ khi admin **sửa data** (qua WS `RELOAD_SHOP`), không liên quan tới item tự hết hạn.

### 9.2. Vậy Pattern 1 trễ ở đâu thực sự?

Độ trễ thực tế đến từ:

**1. Đồng hồ client lệch (lớn nhất):**
- User tự set giờ máy → lệch vài giây tới vài phút.
- User đi du lịch chuyển múi giờ máy.
- Đồng hồ máy drift theo thời gian (vài giây/ngày).

→ **Fix: Cristian's Algorithm** (xem Section 11). Sau khi sync, lệch chỉ còn ~RTT/2 (vài chục ms).

**2. UI tick interval:**
- Countdown UI thường update mỗi 1000ms.
- Item hết hạn 12:00:00.000, tick gần nhất 12:00:00.500 → lệch tối đa 1s.

→ Fix: tăng tần suất tick gần thời điểm `end_at` (vd: 100ms khi còn < 10s).

**3. Network round-trip lúc mua:**
- Client click "Mua" → server xử lý → response.
- Total ~100-500ms.

→ Không phải vấn đề. Server validate `now < end_at` tại lúc transaction → an toàn.

**4. Frame render rate:**
- Game render 30-60fps → mỗi frame 16-33ms.
- Item biến mất ở frame tiếp theo sau khi hết hạn.

→ Không phải vấn đề thực tế.

### 9.3. Tổng kết độ trễ Pattern 1

| Nguồn trễ | Độ lớn | Fix |
|---|---|---|
| Cache TTL | **0ms** (không liên quan) | N/A |
| Đồng hồ client lệch | Vài giây tới vài phút | **Cristian's Algorithm** |
| UI tick interval | ~500ms-1s | Tăng tick rate gần deadline |
| Network round-trip | ~100-500ms (chỉ khi mua) | Server validate → an toàn |
| Frame render | ~16-33ms | Không cần fix |

**Sau khi fix bằng Cristian + tick rate cao gần deadline:** độ trễ ~100-300ms — **đủ chính xác cho event shop**.

**Vẫn không đủ cho flash sale** vì:
1. Mỗi client tự sync, có thể có client mất gói/sync sai.
2. Không có "trigger point" để init stock counter, push notification.
3. Không integrate được với queue chống thundering herd.

---

## 10. Xử lý multi-region: Timezone & Clock Skew

Khi game có user toàn cầu (server châu Á, user Mỹ), có **2 vấn đề tách biệt**:

### 10.1. Vấn đề A — Timezone (múi giờ)

**Nhầm lẫn phổ biến:** "Server châu Á và user Mỹ có múi giờ khác → time-limited item phức tạp."

**Sự thật:** Timezone **không phải vấn đề** nếu tuân theo best practice:

**1. Server LUÔN lưu thời gian dạng UTC (timestamp):**

```sql
-- ĐÚNG: lưu UTC
end_at TIMESTAMP NOT NULL  -- '2026-05-09 12:00:00 UTC'

-- SAI: lưu local time
end_at DATETIME NOT NULL   -- '2026-05-09 19:00:00' (không biết timezone nào)
```

UTC là **absolute** — không phụ thuộc múi giờ. Một timestamp UTC `1715256000000` là 1 thời điểm duy nhất trên toàn thế giới.

**2. API trả timestamp UTC (millisecond Unix epoch):**

```json
{
  "id": 123,
  "name": "Skin Limited",
  "start_at": 1715169600000,
  "end_at": 1715256000000,
  "server_now": 1715200000000
}
```

**3. Client convert sang local timezone CHỈ khi hiển thị:**

```java
long endAtUtc = item.end_at;  // UTC timestamp
String localDisplay = formatLocalTime(endAtUtc, deviceTimezone);
// User PHT: "Hết hạn 9/5/2026 20:00 PHT"
// User EST: "Hết hạn 9/5/2026 08:00 EST"
```

→ Cùng 1 thời điểm UTC, hiển thị khác nhau theo địa phương — **đây là behavior mong muốn**.

### 10.2. Vấn đề B — Clock Skew (đồng hồ máy lệch)

**Đây mới là vấn đề thật.** Hai loại lệch:

**Loại 1 — Lệch hệ thống:**
- User tự set giờ máy lệch (cố ý hoặc vô tình).
- Đồng hồ máy drift theo thời gian.
- User đi du lịch chuyển múi giờ máy nhưng app cache giờ cũ.

**Loại 2 — Lệch nhỏ tự nhiên:**
- Đồng hồ phần cứng có drift ~vài giây/ngày.
- Sync NTP có thể không chính xác hoàn hảo.

**Hậu quả với Pattern 1:**

```
Server thật: 11:59:55 UTC
Item end_at: 12:00:00 UTC

User A (đồng hồ chính xác):
  System.currentTimeMillis() = 11:59:55 → item còn → mua được

User B (đồng hồ lệch +10 giây):
  System.currentTimeMillis() = 12:00:05 → item đã hết → không thấy
  Nhưng server thật vẫn 11:59:55 → User A đang mua được mà B không
  → User B thua thiệt
```

**Hậu quả với Pattern 3:**

Server push event `FLASH_SALE_END` đồng thời cho tất cả → tất cả client cùng nhận → fair. Nhưng vẫn có thể delay vài trăm ms vì network.

### 10.3. Khi nào Clock Skew là vấn đề thực sự?

| Use case | Clock skew quan trọng? | Lý do |
|---|---|---|
| Event shop 7 ngày | **Không** | Lệch 10s vs 604,800s = 0.0017%, không ai care |
| Daily reset cố định 4h sáng | **Trung bình** | Player có thể vào sớm/muộn 1-2 phút |
| Flash sale 1 giờ | **Có** | Lệch 10s = 0.28% — user thấy sale lệch nhau |
| Flash sale 1 phút | **Rất quan trọng** | Lệch 10s = 16% — không công bằng nghiêm trọng |

→ **Pattern 1 với Cristian's algorithm đủ tốt cho event shop**, không cần Pattern 3.

---

## 11. Cristian's Algorithm — đồng bộ đồng hồ client với server

### 11.1. Nguyên lý

Cristian's Algorithm (Flaviu Cristian, 1989) là phương pháp chuẩn để đồng bộ đồng hồ client với server qua mạng.

**Ý tưởng:**
- Client gửi request lúc `T0` (theo đồng hồ client).
- Server reply với timestamp server `Ts` (theo đồng hồ server).
- Client nhận response lúc `T1` (theo đồng hồ client).
- RTT (round-trip time) = `T1 - T0`.
- Giả định mạng đối xứng: one-way delay ≈ `RTT/2`.
- Server time tại lúc client nhận response: `Ts + RTT/2`.
- **Clock offset** = `(Ts + RTT/2) - T1`.

Sau đó client luôn dùng `realNow = System.currentTimeMillis() + offset` thay vì `System.currentTimeMillis()` trực tiếp.

### 11.2. Implementation Java client

```java
public class ClockSync {
    private long offset = 0;  // server_now - client_now
    private final TimeApi timeApi;

    public void syncWithServer() {
        long t0 = System.currentTimeMillis();
        TimeResponse response = timeApi.getServerTime();  // Ts
        long t1 = System.currentTimeMillis();

        long rtt = t1 - t0;
        long oneWayDelay = rtt / 2;

        // Server time tại t1
        long serverNowAtT1 = response.serverNow + oneWayDelay;

        // Offset = server_now - client_now
        this.offset = serverNowAtT1 - t1;

        log.info("Clock synced. RTT: {}ms, offset: {}ms", rtt, offset);
    }

    public long getServerNow() {
        return System.currentTimeMillis() + offset;
    }
}
```

### 11.3. Cải tiến: Multiple readings + min RTT

Theo nghiên cứu, "Want to improve accuracy? Take multiple readings and use the minimum RTT for a tighter bound."

```java
public void syncWithServer() {
    int samples = 5;
    long bestRtt = Long.MAX_VALUE;
    long bestOffset = 0;

    for (int i = 0; i < samples; i++) {
        long t0 = System.currentTimeMillis();
        TimeResponse response = timeApi.getServerTime();
        long t1 = System.currentTimeMillis();

        long rtt = t1 - t0;
        if (rtt < bestRtt) {
            bestRtt = rtt;
            bestOffset = (response.serverNow + rtt / 2) - t1;
        }
    }

    this.offset = bestOffset;
    log.info("Clock synced. Best RTT: {}ms, offset: {}ms", bestRtt, bestOffset);
}
```

Lý do: chọn sample có RTT nhỏ nhất → giả định "mạng đối xứng" chính xác hơn → offset chuẩn hơn.

### 11.4. Khi nào sync clock?

**Cách 1 — Sync khi vào game (đơn giản nhất):**

```java
@OnLogin
public void onPlayerLogin() {
    clockSync.syncWithServer();
}
```

**Cách 2 — Sync định kỳ (chính xác hơn):**

```java
// Sync mỗi 5 phút
scheduler.scheduleAtFixedRate(() -> {
    clockSync.syncWithServer();
}, 0, 5, TimeUnit.MINUTES);
```

**Cách 3 — Embed serverNow vào mọi response (tận dụng API call sẵn có):**

```typescript
// Server middleware
app.use((req, res, next) => {
    res.setHeader('X-Server-Now', Date.now().toString());
    next();
});
```

```java
// Client interceptor
public Response intercept(Chain chain) {
    long t0 = System.currentTimeMillis();
    Response response = chain.proceed(request);
    long t1 = System.currentTimeMillis();

    long serverNow = Long.parseLong(response.header("X-Server-Now"));
    long rtt = t1 - t0;
    clockSync.updateOffset(serverNow, rtt, t1);

    return response;
}
```

→ Mỗi API call tự động cập nhật clock offset, không cần endpoint riêng.

### 11.5. Hạn chế của Cristian's Algorithm

Theo Wikipedia: "Cristian observed that this simple algorithm is probabilistic, in that it only achieves synchronization when the round-trip time of the request is significantly shorter than the desired accuracy."

**Hạn chế:**

1. **Giả định mạng đối xứng** (request delay = response delay). Thực tế mạng không đều → có sai số.
2. **Phụ thuộc vào server reliable.** Nếu server bị tấn công NTP poisoning → toàn bộ client lệch.
3. **Không phù hợp khi RTT cao** (vd: kết nối vệ tinh).

**Tham khảo thay thế:**

- **Berkeley Algorithm:** không cần "true time", lấy trung bình clocks của tất cả nodes.
- **NTP/PTP:** chính xác hơn nhưng phức tạp hơn nhiều.

→ Cho game mobile, **Cristian's là đủ**: simple, hiệu quả, error chỉ vài chục ms.

### 11.6. Ví dụ tính toán cụ thể

```
T0 = 08:02:01.670 (client)
Ts = 08:02:02.130 (server, gửi về)
T1 = 08:02:04.325 (client nhận)

RTT = T1 - T0 = 2.655s
One-way delay ≈ RTT/2 = 1.328s
Server time tại T1 = Ts + 1.328 = 08:02:03.458
Offset = 08:02:03.458 - 08:02:04.325 = -867ms

→ Client lệch nhanh hơn server 867ms.
→ Mỗi lần check: realNow = clientNow - 867ms
```

(Ví dụ từ Cambridge distributed systems lecture.)

### 11.7. Tích hợp với Pattern 1

```java
public class ShopFilter {
    private final ClockSync clockSync;

    public List<ShopItemServerData> filterActiveItems(
        List<ShopItemServerData> items
    ) {
        long now = clockSync.getServerNow();  // ← QUAN TRỌNG: dùng serverNow

        return items.stream()
            .filter(item -> item.is_active)
            .filter(item -> item.start_at == null || item.start_at <= now)
            .filter(item -> item.end_at == null || item.end_at > now)
            .collect(Collectors.toList());
    }
}
```

Sau khi áp dụng Cristian:
- User Mỹ và user châu Á đều thấy item biến mất gần như cùng lúc (lệch ~50-100ms).
- User cố ý sửa giờ máy → vẫn không hack được vì server validate khi mua.

---

## 12. Kiến trúc kết hợp cả 3 patterns

Game lớn dùng **kết hợp cả 3** trong 1 hệ thống:

```
┌────────────────────────────────────────────────────────────────┐
│                       Game Backend                              │
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐   │
│  │  Daily Shop     │  │  Event Shop     │  │  Flash Sale  │   │
│  │                 │  │                 │  │              │   │
│  │  Pattern 2      │  │  Pattern 1      │  │  Pattern 3   │   │
│  │  Cron 4h sáng   │  │  Filter         │  │  Delayed     │   │
│  │  reset stock    │  │  start_at /     │  │  Job với     │   │
│  │                 │  │  end_at         │  │  precision   │   │
│  └─────────────────┘  └─────────────────┘  └──────────────┘   │
│         │                     │                    │           │
│         └─────────────────────┼────────────────────┘           │
│                               │                                │
│                  ┌────────────▼────────────┐                   │
│                  │  Time Service           │                   │
│                  │  - Trả serverNow        │                   │
│                  │  - X-Server-Now header  │                   │
│                  │  → Client sync Cristian │                   │
│                  └────────────┬────────────┘                   │
│                               │                                │
│                  ┌────────────▼────────────┐                   │
│                  │  Shop API + Cache       │                   │
│                  │  (Redis + DB)           │                   │
│                  └────────────┬────────────┘                   │
│                               │                                │
│                  ┌────────────▼────────────┐                   │
│                  │  WS Broadcast Layer     │                   │
│                  │  - DAILY_RESET          │                   │
│                  │  - RELOAD_SHOP          │                   │
│                  │  - FLASH_SALE_START/END │                   │
│                  └─────────────────────────┘                   │
└────────────────────────────────────────────────────────────────┘
```

### Ví dụ Genshin Impact:

- **Daily commission, daily shop refresh** → Pattern 2 (cron 4h sáng).
- **Event banner Yelan (21 ngày)** → Pattern 1 (`from`/`to` trong gacha.json).
- **Bonus drop rate event 1 giờ** → Pattern 3 (delayed job).

### Ví dụ WoW:

- **Daily/Weekly raid lockout** → Pattern 2 (cron).
- **Hallow's End event (21 ngày)** → Pattern 1 (`game_event` table).
- **Server first kill achievement window** → Pattern 3 (delayed job).

### Ví dụ MLBB (Mobile Legends):

- **Daily reset 16:00 PHT** → Pattern 2 (cron UTC+8).
- **Starlight monthly cycle** → Pattern 2 (cron monthly).
- **Limited skin event 14 ngày** → Pattern 1 (start/end timestamp).

---

## 13. Tham khảo từ industry

### 13.1. Genshin Impact

Schema gacha banner: ISO 8601 với UTC+8: "Each banner entry defines precise temporal boundaries using ISO 8601 format with UTC+8 timezone offset (China Standard Time)"

Daily reset 4h sáng theo timezone server.

### 13.2. Project SEKAI

Schema gacha banner: `startAt`, `endAt` (milliseconds timestamp).

Logic: "The system identifies active banners by comparing current time against banner start/end timestamps"

→ Pattern 1 thuần.

### 13.3. WoW (MaNGOS emulator)

Bảng `game_event` với `start_time`, `end_time`. Daily reset 8h sáng PST/CET.

### 13.4. MLBB (Mobile Legends)

Daily reset 16:00 PHT (UTC+8): "Mobile Legends: Bang Bang uses UTC+8 as its server timezone"

→ Pattern 2 cho daily reset, **server time priority**: "server time always takes priority over your local timezone".

### 13.5. Trophy (gamification SaaS)

Best practice cho streak countdown: "The expires timestamp is in UTC and represents the end of the user's current streak period in their local timezone. On the client, convert it with toLocaleString()"

Lưu UTC, convert local khi hiển thị.

### 13.6. Cristian's Algorithm

Flaviu Cristian (1989). Tham khảo:
- Cambridge distributed systems lecture notes.
- GeeksforGeeks: T_CLIENT = T_SERVER + (T1 - T0)/2.
- Wikipedia: probabilistic algorithm cho intranet/low-latency.

### 13.7. UTC best practice (AppSignal)

"Using UTC reduces the need for complex time zone conversions, removing the risk of variations in data handling and processing"

→ Server LUÔN UTC, client convert khi hiển thị.

---

## 14. Kết luận

### 14.1. Tóm tắt

| Pattern | Use case chính | Lý do bắt buộc |
|---|---|---|
| **Pattern 1 (Lazy)** | Event shop deadline | Scale O(1), độc lập, đơn giản |
| **Pattern 2 (Cron)** | Daily/weekly reset | Đồng bộ + reset counter |
| **Pattern 3 (Delayed Job)** | Flash sale precise | Trigger logic + fairness + chống thundering herd |

### 14.2. Đính chính các điểm sai trong tài liệu trước

1. **Pattern 1 KHÔNG phụ thuộc TTL cache.** Item tự biến mất qua filter logic kể cả cache vô hạn.

2. **Pattern 1 KHÔNG cần WS event "trigger hết hạn".** Client tự filter. WS event chỉ cần khi admin **sửa data**.

3. **Độ trễ Pattern 1 thực tế ~100-300ms** sau khi áp dụng Cristian's algorithm + tick rate cao gần deadline. Đủ chính xác cho event shop.

4. **Multi-region (server châu Á, user Mỹ)** không phải vấn đề nếu:
   - Server lưu UTC.
   - Client convert local khi hiển thị.
   - Áp dụng Cristian's algorithm để fix clock skew.

### 14.3. Áp dụng cho game của bạn

**Phase 1 (MVP):** shop NPC thường, không cần pattern thời gian → chỉ `is_active`.

**Phase 2 (Event content):**
- Thêm Pattern 1: `start_at`, `end_at` UTC.
- Thêm Cristian's algorithm để sync clock client.
- Server middleware trả `X-Server-Now` header.
- Server validate `now < end_at` lúc transaction.

**Phase 3 (Daily content):** thêm Pattern 2 (cron) khi có daily shop / daily quest.

**Phase 4 (Flash sale):** thêm Pattern 3 chỉ khi business yêu cầu rõ ràng.

---

## Phụ lục: Lịch sử thay đổi

| Version | Ngày | Nội dung |
|---|---|---|
| 1.0 | 2026-05-09 | Khởi tạo, phân tích 3 patterns |
| 2.0 | 2026-05-09 | Đính chính độ trễ Pattern 1, bổ sung Cristian's algorithm, multi-region timezone handling |

---

## Tham khảo

1. **Genshin Impact** - Daily/weekly reset & gacha banner schema
2. **World of Warcraft** - Daily/weekly reset architecture
3. **Project SEKAI** - Gacha banner với startAt/endAt
4. **WoW MaNGOS Emulator** - game_event table
5. **Mobile Legends Bang Bang** - Daily reset 16:00 PHT
6. **AlgoMaster** - Flash Sale system design
7. **CrackingWalnuts** - Flash sale architecture với queue
8. **Cristian, F. (1989)** - "Probabilistic clock synchronization"
9. **Cambridge Distributed Systems Lecture Notes** - Cristian's algorithm example
10. **GeeksforGeeks** - Cristian's Algorithm formula
11. **Wikipedia** - Cristian's algorithm
12. **AppSignal** - UTC best practices
13. **Trophy** - Gamification timezone handling