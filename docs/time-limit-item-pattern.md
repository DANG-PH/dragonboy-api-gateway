# Tài liệu kỹ thuật: Patterns xử lý Time-limited Items trong Game Realtime

> **Phiên bản:** 3.0
> **Ngày:** 2026-05-12
> **Trạng thái:** Tham khảo kỹ thuật
> **Đối tượng đọc:** Backend dev, Game architect, Tech Lead, Game Dev

---

## Mục lục

1. [Tổng quan](#1-tổng-quan)
2. [Định nghĩa 4 patterns](#2-định-nghĩa-4-patterns)
3. [Cơ chế chi tiết từng pattern](#3-cơ-chế-chi-tiết-từng-pattern)
   - 3.1 Pattern 1 — Lazy Filter (standalone)
   - 3.2 Pattern 2 — Scheduled Cron (standalone)
   - 3.3 Pattern 3 — Delayed Job (standalone)
   - 3.4 Pattern 4 — Polling Cron (Anti-pattern: hiểu để tránh)
   - 3.5 Hybrid Pattern 1+3
4. [So sánh đặc tính kỹ thuật — tất cả 4 variants](#4-so-sánh-đặc-tính-kỹ-thuật--tất-cả-4-variants)
5. [Use case: Daily/Weekly Reset Shop → Pattern 2](#5-use-case-dailyweekly-reset-shop--pattern-2)
6. [Use case: Event Shop có deadline → Hybrid 1+3](#6-use-case-event-shop-có-deadline--hybrid-13)
7. [Use case: Flash Sale chính xác → Pattern 3 standalone](#7-use-case-flash-sale-chính-xác--pattern-3-standalone)
8. [Dùng sai pattern sẽ gây vấn đề gì?](#8-dùng-sai-pattern-sẽ-gây-vấn-đề-gì)
9. [Bảng quyết định nhanh](#9-bảng-quyết-định-nhanh)
10. [Độ trễ thực tế của Pattern 1 và Hybrid](#10-độ-trễ-thực-tế-của-pattern-1-và-hybrid)
11. [Xử lý multi-region: Timezone & Clock Skew](#11-xử-lý-multi-region-timezone--clock-skew)
12. [Cristian's Algorithm](#12-cristians-algorithm--đồng-bộ-đồng-hồ-client-với-server)
13. [Kiến trúc kết hợp tổng thể](#13-kiến-trúc-kết-hợp-tổng-thể)
14. [Đánh giá hiệu năng và khả năng mở rộng](#14-đánh-giá-hiệu-năng-và-khả-năng-mở-rộng)
15. [Tham khảo từ industry](#15-tham-khảo-từ-industry)

---

## 1. Tổng quan

Trong game live-service, hầu như mọi hệ thống shop/event đều có yếu tố thời gian. Tài liệu này phân tích **4 variants kỹ thuật** để xử lý time-limited items:

| Variant | Tên | Dùng cho |
|---|---|---|
| **Pattern 1** | Lazy Filter (standalone) | Event shop, không cần notify real-time |
| **Pattern 2** | Scheduled Cron | Daily/Weekly reset đồng bộ |
| **Pattern 3** | Delayed Job (standalone) | Flash sale precise, ít item |
| **Pattern 4** | Polling Cron | ❌ Anti-pattern — hiểu để tránh |
| **Hybrid 1+3** | Lazy Filter + Delayed Job notify | Event shop cần notify + UX tốt hơn |

**Nguyên tắc chọn:** không có pattern nào "thống trị". Game prod lớn (Genshin, WoW, Lost Ark, FFXIV, MLBB) đều dùng **kết hợp**, mỗi pattern cho 1 use case riêng. Chọn sai dẫn đến vấn đề kỹ thuật và UX nghiêm trọng.

---

## 2. Định nghĩa 4 patterns

### Pattern 1 — Lazy Filter (standalone)

**Cơ chế:** Item có 2 field `start_at` và `end_at` (lưu UTC). Mỗi lần render UI, filter theo `now`. **Không có job nào chạy** khi item bắt đầu hoặc kết thúc.

```typescript
const now = Date.now();  // hoặc serverNow nếu có clock sync
return allItems.filter(item =>
    item.is_active &&
    (!item.start_at || item.start_at <= now) &&
    (!item.end_at || item.end_at > now)
);
```

**Đặc điểm:**
- Mỗi item có **lifecycle độc lập** được định nghĩa bởi 2 field.
- **Không có background job** xử lý expiration hay activation.
- **Không có WS event** khi item tự xuất hiện/biến mất theo thời gian.
- Client tự phát hiện trạng thái item mỗi lần render.
- WS event `RELOAD_SHOP` chỉ cần khi admin **sửa data** thủ công.

---

### Pattern 2 — Scheduled Cron

**Cơ chế:** Cron job chạy đúng giờ cố định reset stock/items đồng loạt. Không liên quan đến `start_at`/`end_at` per-item.

```typescript
@Cron('0 4 * * *', { timeZone: 'Asia/Bangkok' })
async dailyShopReset() {
    await db.shopItem.resetDailyStock();
    await db.playerPurchase.resetDailyLimit();
    await rollDailyShopRotation();
    await redis.flushPrefix('shop:');
    wsServer.broadcast({ action: 'DAILY_RESET' });
}
```

**Đặc điểm:**
- **Đồng bộ tuyệt đối** tại 1 thời điểm cố định.
- Reset **counter** (purchase limit, stock) — không chỉ filter thời gian.
- Cần WS broadcast để client update ngay.

---

### Pattern 3 — Delayed Job (standalone)

**Cơ chế:** Không dùng `start_at`/`end_at` như field filter. Thay vào đó, scheduled jobs **thực sự thay đổi trạng thái DB** khi item bắt đầu hoặc kết thúc: thêm item vào shop khi đến `start_at`, xóa/deactivate item khi đến `end_at`.

```typescript
async function scheduleEventItem(item: EventItem) {
    await db.shopItem.create({ ...item, is_active: false });

    // Job 1: Kích hoạt item đúng start_at
    const startDelay = item.start_at.getTime() - Date.now();
    await eventQueue.add(
        'activate-item',
        { itemId: item.id },
        { delay: startDelay, jobId: `activate-${item.id}` }
    );

    // Job 2: Vô hiệu hóa item đúng end_at
    const endDelay = item.end_at.getTime() - Date.now();
    await eventQueue.add(
        'deactivate-item',
        { itemId: item.id },
        { delay: endDelay, jobId: `deactivate-${item.id}` }
    );
}

// Worker: kích hoạt item
eventQueue.process('activate-item', async (job) => {
    await db.shopItem.update({ id: job.data.itemId, is_active: true });
    wsServer.broadcast({ action: 'RELOAD_SHOP', itemId: job.data.itemId });
});

// Worker: vô hiệu hóa item
eventQueue.process('deactivate-item', async (job) => {
    await db.shopItem.update({ id: job.data.itemId, is_active: false });
    wsServer.broadcast({ action: 'RELOAD_SHOP', itemId: job.data.itemId });
});
```

**Đặc điểm:**
- **Không có field `start_at`/`end_at` như filter** — trạng thái item (`is_active`) thực sự thay đổi theo thời gian.
- Mỗi item cần **2 job** trong queue (1 activate, 1 deactivate).
- WS broadcast đúng thời điểm → client reload shop ngay.
- Nếu admin sửa `end_at`: phải cancel job cũ, tạo job mới.
- Tốn infra: N items × 2 = 2N jobs.

---

### Hybrid Pattern 1+3 — Lazy Filter + Delayed Notify

**Cơ chế:** Kết hợp tốt nhất của cả hai:
- **Giữ `start_at`/`end_at` như Pattern 1**: item luôn tồn tại trong DB với lifecycle được định nghĩa bởi 2 field. Filter logic hoạt động mọi lúc.
- **Thêm BullMQ jobs như Pattern 3**: khi tạo item, schedule job tại đúng `start_at` và `end_at` để **push WS notify** cho client reload shop — không phải để thay đổi DB state.

```typescript
async function createTimedShopItem(item: TimedShopItem) {
    // Lưu item với start_at/end_at như Pattern 1
    const saved = await db.shopItem.create({
        ...item,
        is_active: true,  // luôn active, filter logic xử lý thời gian
        start_at: item.start_at,
        end_at: item.end_at
    });

    const now = Date.now();

    // Schedule notify khi item BẮT ĐẦU xuất hiện
    if (item.start_at && item.start_at.getTime() > now) {
        // start_at trong tương lai → schedule job
        const startDelay = item.start_at.getTime() - now;
        await shopNotifyQueue.add(
            'notify-item-available',
            { itemId: saved.id, npcId: item.npc_id },
            { delay: startDelay, jobId: `notify-start-${saved.id}` }
        );
    } else {
        // start_at <= now → item đã sẵn sàng, push reload ngay
        wsServer.broadcast({
            action: 'RELOAD_SHOP',
            npcId: item.npc_id,
            reason: 'item_available'
        });
    }

    // Schedule notify khi item HẾT HẠN
    if (item.end_at) {
        const endDelay = item.end_at.getTime() - now;
        await shopNotifyQueue.add(
            'notify-item-expired',
            { itemId: saved.id, npcId: item.npc_id },
            { delay: endDelay, jobId: `notify-end-${saved.id}` }
        );
    }

    return saved;
}

// Worker: notify item available
shopNotifyQueue.process('notify-item-available', async (job) => {
    // Không cần thay đổi DB — item đã có start_at và filter tự xử lý
    wsServer.broadcast({
        action: 'RELOAD_SHOP',
        npcId: job.data.npcId,
        reason: 'item_available'
    });
    // Tùy chọn: push notification
    pushNotificationToActivePlayers({
        npcId: job.data.npcId,
        title: 'New item available in shop!',
    });
});

// Worker: notify item expired
shopNotifyQueue.process('notify-item-expired', async (job) => {
    // Không cần thay đổi DB — filter tự ẩn item khi end_at > now
    wsServer.broadcast({
        action: 'RELOAD_SHOP',
        npcId: job.data.npcId,
        reason: 'item_expired'
    });
});
```

**Client xử lý:**
```java
// Nhận WS event RELOAD_SHOP → fetch lại từ server
wsClient.on("RELOAD_SHOP", event -> {
    if (event.npcId == currentOpenNpcId) {
        shopViewModel.refreshItems(event.npcId);
        // Với reason = 'item_expired': có thể show toast "Một số item đã hết hạn"
        // Với reason = 'item_available': có thể show toast "Item mới đã xuất hiện!"
    }
});
```

**Đặc điểm:**
- **DB state không thay đổi** khi item bắt đầu/kết thúc — chỉ notify client reload.
- **Filter logic (`start_at`/`end_at`) làm nguồn sự thật** — không thể desync.
- **BullMQ jobs chỉ gửi WS event** — không cần cancel/recreate khi admin sửa `end_at`.
- Khi admin sửa `end_at`: chỉ cần `UPDATE` DB + cancel job cũ + tạo job mới cho notify.
- UX tốt hơn Pattern 1 standalone: client không cần poll, nhận event đúng lúc.

---

## 3. Cơ chế chi tiết từng pattern

### 3.1. Pattern 1 Standalone — Ưu điểm, nhược điểm, và khi nào đủ tốt

**Luồng hoàn chỉnh khi item hết hạn:**

```
12:00:00 — item.end_at
          ├── DB: item vẫn tồn tại với is_active=true, end_at=12:00:00
          ├── Redis cache: item vẫn nằm trong cache
          └── Client: KHÔNG nhận được event nào

12:00:01 — Player A mở dialog shop
          ├── Client filter: now=12:00:01 > end_at=12:00:00 → ẩn item
          └── Player A không thấy item (đúng)

12:00:01 — Player B đang mở dialog shop (không đóng lại)
          ├── UI re-render tick: now=12:00:01 > end_at=12:00:00 → item biến mất
          └── Nếu có countdown timer → countdown về 0 → UI tự ẩn

12:00:01 — Player C đang xem item với giỏ hàng đã chứa item này
          ├── Click "Confirm" → server validate: now > end_at → reject
          └── Client nhận error "Item đã hết hạn" → clear cart
```

**Ưu điểm Pattern 1 standalone:**
- Zero infra overhead — không cần queue, worker, job scheduling.
- Admin sửa `end_at` chỉ cần `UPDATE` 1 row — không có side effect nào.
- Scale tốt: 10,000 event banner cùng lúc → vẫn chỉ là filter SQL.
- Không có race condition, không có job failure.

**Nhược điểm Pattern 1 standalone:**
- Client không được notify khi item xuất hiện/biến mất.
- Player phải tự đóng/mở dialog để thấy item mới, hoặc client phải poll định kỳ.
- Với item `start_at` trong tương lai: player đang mở shop sẽ không thấy item mới cho đến khi họ refresh.
- UX kém hơn Hybrid khi có nhiều event chạy song song.

**Khi nào Pattern 1 standalone đủ tốt:**
- Event dài (7+ ngày): player không quan tâm lệch 1-2 phút.
- Team nhỏ, MVP, chưa có WS infrastructure.
- Item không có countdown UI — chỉ hiển thị ngày kết thúc tĩnh.
- Client đã có cơ chế poll định kỳ (vd: refresh shop mỗi 5 phút).

---

### 3.2. Pattern 2 Standalone — Cách hoạt động đầy đủ và trade-off

**Khác biệt cốt lõi với Pattern 1 và 3:** Pattern 2 không xử lý lifecycle của từng item riêng lẻ. Thay vào đó, một cron job chạy tại **thời điểm cố định định kỳ** và thực hiện reset đồng loạt toàn bộ hệ thống shop.

**Cơ chế hoạt động:**

Không có field `start_at`/`end_at` per-item. Thay vào đó, logic "hôm nay shop có gì" được tính toán **tại thời điểm cron chạy**, hoặc được định nghĩa trước bởi rotation table/config.

```
Mỗi ngày 4h sáng UTC+7:
  ├── Reset stock counter: current_stock = default_stock (cho tất cả item)
  ├── Reset purchase limit: daily_bought = 0 (cho tất cả player)
  ├── Roll rotation: chọn ngẫu nhiên N item từ pool để bày bán hôm nay
  ├── Invalidate Redis cache
  └── WS broadcast DAILY_RESET → tất cả client refresh
```

**Schema điển hình cho daily shop:**

```sql
-- Pool tất cả item có thể xuất hiện trong shop
CREATE TABLE shop_item_pool (
    id INT PRIMARY KEY,
    name VARCHAR(255),
    price BIGINT,
    default_stock INT,
    rarity VARCHAR(20)  -- common/rare/epic — ảnh hưởng tỉ lệ rotation
);

-- Rotation hôm nay (được cron tính lại mỗi ngày)
CREATE TABLE daily_shop_rotation (
    id INT PRIMARY KEY,
    item_id INT REFERENCES shop_item_pool(id),
    rotation_date DATE NOT NULL,
    current_stock INT NOT NULL,
    INDEX (rotation_date)
);

-- Purchase limit per player per day
CREATE TABLE player_daily_purchase (
    player_id VARCHAR(36),
    item_id INT,
    date DATE,
    bought_count INT DEFAULT 0,
    PRIMARY KEY (player_id, item_id, date)
);
```

**Cron implementation đầy đủ:**

```typescript
@Cron('0 21 * * *', { timeZone: 'UTC' })  // 21:00 UTC = 04:00 UTC+7
async dailyShopReset() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const log = createResetLog('daily_shop', today);

    try {
        // Bước 1: Roll rotation mới cho hôm nay
        const newRotation = await rollDailyRotation(today);

        // Bước 2: Xóa rotation cũ (giữ lại N ngày để analytics)
        await db.dailyShopRotation.deleteOlderThan(subDays(today, 30));

        // Bước 3: Insert rotation mới
        await db.dailyShopRotation.insertMany(newRotation);

        // Bước 4: Reset purchase limit hôm qua (không xóa để giữ history)
        // Thực tế: chỉ cần query theo date, không cần reset

        // Bước 5: Invalidate cache
        await redis.del('shop:daily:rotation');
        await redis.del('shop:daily:stock:*');

        // Bước 6: Broadcast cho tất cả player
        wsServer.broadcast({
            action: 'DAILY_RESET',
            timestamp: Date.now(),
            type: 'shop',
            next_reset_at: getNextResetTimestamp()  // client hiển thị countdown đến reset tiếp theo
        });

        log.write('Daily reset completed', { itemCount: newRotation.length });
    } catch (err) {
        log.error('Daily reset failed', err);
        // Alert ops nhưng KHÔNG throw — cron phải tiếp tục chạy ngày mai
        await alertOps('Daily shop reset failed', err);
    }
}

// Idempotent: gọi lại nhiều lần trong cùng ngày vẫn ra kết quả đúng
async function rollDailyRotation(date: Date) {
    // Kiểm tra đã roll chưa (tránh double-roll khi retry)
    const existing = await db.dailyShopRotation.findByDate(date);
    if (existing.length > 0) return existing;

    // Seed ngẫu nhiên theo date → cùng ngày luôn ra cùng rotation (reproducible)
    const seed = dateToDeterministicSeed(date);
    const pool = await db.shopItemPool.findAll();
    return selectRotationFromPool(pool, seed, DAILY_ITEM_COUNT);
}
```

**Server query daily shop:**

```typescript
async function getDailyShopItems() {
    const cached = await redis.get('shop:daily:rotation');
    if (cached) return JSON.parse(cached);

    const today = getCurrentServerDate();  // theo timezone server
    const items = await db.dailyShopRotation.findByDate(today);

    await redis.setex('shop:daily:rotation', 3600, JSON.stringify(items));
    return items;
}

// Kiểm tra purchase limit khi mua
async function checkPurchaseLimit(playerId: string, itemId: number, today: Date) {
    const record = await db.playerDailyPurchase.findOne({ playerId, itemId, date: today });
    const item = await db.shopItemPool.findById(itemId);

    if (record && record.bought_count >= item.daily_limit) {
        throw new Error(`Đã mua đủ số lượng hôm nay (tối đa ${item.daily_limit})`);
    }
}
```

**Luồng đầy đủ khi cron chạy:**

```
03:59:59 UTC+7 — Trước reset
  Player A đang mở daily shop → thấy rotation hôm qua
  Player B offline

04:00:00 UTC+7 — Cron chạy
  ├── rollDailyRotation(today) → tính rotation mới
  ├── INSERT daily_shop_rotation (hôm nay)
  ├── redis.del('shop:daily:*')
  └── WS broadcast DAILY_RESET

04:00:00 — Player A nhận DAILY_RESET
  └── client refresh dialog → thấy rotation mới ngay

04:05:00 — Player B vào game
  └── fetch daily shop → query by today's date → thấy rotation mới (đúng)

04:00:00 — Player C đang click "Mua" ngay lúc cron chạy
  ├── Server validate: purchase_date = hôm qua → OK (vẫn trong ngày cũ)
  └── Nếu cron đã chạy xong: purchase_date = hôm nay → daily limit reset
  (race condition nhỏ, acceptable trong ~1s window)
```

**Multi-server (distributed lock):**

```typescript
@Cron('0 21 * * *', { timeZone: 'UTC' })
async dailyShopReset() {
    // Chỉ 1 instance trong cluster được chạy
    const lock = await redlock.acquire(['lock:daily_shop_reset'], 60_000);

    try {
        await this.performReset();
    } finally {
        await lock.release();
    }
}
```

**Ưu điểm Pattern 2 standalone:**
- **Đồng bộ tuyệt đối**: tất cả player nhận rotation mới cùng lúc.
- **Reset counter atomic**: stock, purchase limit, rotation — tất cả trong 1 transaction.
- **Predictable load**: biết trước khi nào heavy operation → có thể chuẩn bị.
- **Player expectation**: "daily reset" là term chuẩn 20+ năm, player hiểu và mong đợi.
- **Idempotent dễ**: chạy lại cùng ngày → kết quả như nhau.

**Nhược điểm Pattern 2 standalone:**
- **Không xử lý được lifecycle độc lập**: không thể dùng cho 30 event banner chạy song song với deadline khác nhau.
- **Giờ reset cố định**: không thể tạo "reset lúc 14:37" dễ dàng — crontab chỉ hỗ trợ đến phút.
- **DB spike tại giờ reset**: tất cả write xảy ra cùng lúc → cần chuẩn bị infra.
- **Dynamic schedule khó**: admin muốn thêm "reset vào thứ 6 tuần này" → phải sửa code.

**Khi nào Pattern 2 standalone phù hợp:**
- Daily shop, weekly shop với giờ reset cố định.
- Daily quest reset, daily login reward reset.
- Weekly raid lockout, weekly PvP season reset.
- Bất kỳ content nào cần **đồng bộ toàn server tại 1 thời điểm cố định**.

---

### 3.3. Pattern 3 Standalone — Cách hoạt động đầy đủ và trade-off

**Khác biệt cốt lõi với Pattern 1:** Pattern 3 không dùng `start_at`/`end_at` như filter condition. Thay vào đó, **DB state thực sự thay đổi** tại đúng thời điểm.

**Schema Pattern 3 standalone:**
```sql
CREATE TABLE shop_item (
    id INT PRIMARY KEY,
    name VARCHAR(255),
    price BIGINT,
    is_active BOOLEAN DEFAULT FALSE,  -- Bắt đầu là FALSE, job sẽ set TRUE
    -- KHÔNG có start_at, end_at như filter field
    -- Có thể lưu target_start/target_end để reference, nhưng không dùng để filter
    created_at TIMESTAMP DEFAULT NOW()
);
```

**Luồng đầy đủ khi tạo event item:**
```
Admin tạo item "Skin Limited" start=14:00, end=18:00
  ↓
DB: INSERT shop_item (is_active=FALSE)
  ↓
BullMQ: add job 'activate-item' delay=2h (đến 14:00)
BullMQ: add job 'deactivate-item' delay=6h (đến 18:00)
```

```
14:00:00 — job 'activate-item' chạy
  ↓
DB: UPDATE shop_item SET is_active=TRUE WHERE id=123
Redis: invalidate cache 'shop:npc:5'
WS: broadcast RELOAD_SHOP → tất cả client đang mở shop của NPC 5 fetch lại
Push notify: "Skin Limited đã có mặt!"
```

```
18:00:00 — job 'deactivate-item' chạy
  ↓
DB: UPDATE shop_item SET is_active=FALSE WHERE id=123
Redis: invalidate cache 'shop:npc:5'
WS: broadcast RELOAD_SHOP → client refresh
```

**Vấn đề khi admin sửa end_at:**
```typescript
async function updateItemEndAt(itemId: number, newEndAt: Date) {
    // Bước 1: Cập nhật DB
    await db.shopItem.update({ id: itemId, target_end: newEndAt });

    // Bước 2: Cancel job cũ (phải có jobId để tìm)
    await eventQueue.removeJob(`deactivate-${itemId}`);

    // Bước 3: Tạo job mới với thời điểm mới
    const newDelay = newEndAt.getTime() - Date.now();
    await eventQueue.add(
        'deactivate-item',
        { itemId },
        { delay: newDelay, jobId: `deactivate-${itemId}` }
    );
}
```

**Vấn đề khi server crash:**
- BullMQ persist jobs vào Redis → jobs survive restart.
- Nhưng nếu job đã đến hạn trong khi server down → job chạy ngay sau restart (có thể trễ vài giây-phút).
- `is_active` vẫn đúng sau khi job chạy bù → không mất data.

**Ưu điểm Pattern 3 standalone:**
- DB state luôn reflect trạng thái thực tế — query `WHERE is_active=TRUE` là đủ, không cần filter thời gian.
- WS event đúng giây → UX tốt nhất cho user đang mở shop.
- Có thể trigger logic phức tạp (notification, analytics, init counter) tại đúng thời điểm.

**Nhược điểm Pattern 3 standalone:**
- 2 jobs/item → N items = 2N jobs trong queue.
- Admin sửa `end_at` → phải cancel + recreate job → code phức tạp hơn.
- Mất 2 field `start_at`/`end_at` như nguồn sự thật trực quan.
- Nếu job fail → item không deactivate → player thấy item quá hạn (cần retry logic + dead letter queue).
- Over-engineering cho event dài ngày.

**Khi nào Pattern 3 standalone phù hợp:**
- Flash sale precise (< 1 giờ), số lượng hạn chế.
- Item cần trigger logic phức tạp tại start/end (init counter, push notification rộng).
- Hệ thống đã có queue infrastructure sẵn.

---

### 3.4. Pattern 4 — Polling Cron (Anti-pattern: hiểu để tránh)

#### Ý tưởng và cách một số team tiếp cận

Thay vì dùng BullMQ delayed job (phức tạp về infra) hoặc `start_at`/`end_at` filter (cần clock sync), một số team nghĩ đến cách đơn giản hơn: **dùng cron chạy liên tục mỗi vài giây** để scan DB/Redis, phát hiện item nào vừa đến `target_start` hoặc `target_end` rồi thay đổi state và broadcast WS.

```
Mỗi 10 giây:
  ├── Query: SELECT * FROM shop_item WHERE target_start <= now AND is_active = FALSE
  ├── → UPDATE is_active = TRUE cho những item đó
  ├── Query: SELECT * FROM shop_item WHERE target_end <= now AND is_active = TRUE
  ├── → UPDATE is_active = FALSE cho những item đó
  └── Nếu có thay đổi → WS broadcast RELOAD_SHOP
```

#### Vì sao pattern này xuất hiện

- Team không muốn setup BullMQ/Redis queue (infra phức tạp).
- Nghĩ rằng "cron đơn giản hơn delayed job".
- Không muốn dùng `start_at`/`end_at` filter vì lo ngại clock skew client.
- Ý tưởng nghe có vẻ hợp lý: "cứ mỗi 10s kiểm tra một lần là đủ".

#### Cần lưu gì và cơ chế hoạt động

Không có `start_at`/`end_at` như filter field của Pattern 1. Thay vào đó có 2 cách lưu:

**Cách A — Lưu target time trong DB:**
```sql
CREATE TABLE shop_item (
    id INT PRIMARY KEY,
    name VARCHAR(255),
    is_active BOOLEAN DEFAULT FALSE,
    target_start TIMESTAMP NULL,  -- mục tiêu kích hoạt
    target_end   TIMESTAMP NULL,  -- mục tiêu hủy
    -- target_start/end KHÔNG dùng để filter như P1 — chỉ để cron đọc
);
```

**Cách B — Lưu danh sách pending activation trong Redis:**
```typescript
// Khi tạo item:
await redis.zadd('shop:pending_start', item.start_at.getTime(), item.id);
await redis.zadd('shop:pending_end',   item.end_at.getTime(),   item.id);

// Cron mỗi 10s:
const now = Date.now();
const toActivate   = await redis.zrangebyscore('shop:pending_start', 0, now);
const toDeactivate = await redis.zrangebyscore('shop:pending_end',   0, now);
```

**Cron implementation:**
```typescript
// Chạy mỗi 10 giây
@Interval(10_000)
async pollShopStateChanges() {
    const now = Date.now();

    // Kích hoạt item đến giờ
    const toActivate = await db.shopItem.findWhere({
        is_active: false,
        target_start: { lte: now }
    });
    if (toActivate.length > 0) {
        await db.shopItem.updateMany(
            { id: { in: toActivate.map(i => i.id) } },
            { is_active: true }
        );
        const npcIds = [...new Set(toActivate.map(i => i.npc_id))];
        npcIds.forEach(npcId =>
            wsServer.broadcast({ action: 'RELOAD_SHOP', npcId })
        );
    }

    // Deactivate item hết hạn
    const toDeactivate = await db.shopItem.findWhere({
        is_active: true,
        target_end: { lte: now }
    });
    if (toDeactivate.length > 0) {
        await db.shopItem.updateMany(
            { id: { in: toDeactivate.map(i => i.id) } },
            { is_active: false }
        );
        const npcIds = [...new Set(toDeactivate.map(i => i.npc_id))];
        npcIds.forEach(npcId =>
            wsServer.broadcast({ action: 'RELOAD_SHOP', npcId })
        );
    }
}
```

#### Tại sao đây là anti-pattern — phân tích từng điểm yếu

**Điểm yếu 1: Precision tệ hơn Pattern 3, không tốt hơn Pattern 1**

```
Item end_at = 14:00:00

Pattern 3 (Delayed Job):  item expire đúng 14:00:00 ± vài ms
Pattern 1 (Lazy Filter):  item ẩn tại frame render đầu tiên sau 14:00:00 ± vài ms
Pattern 4 (Polling 10s):  item expire tại lần poll tiếp theo sau 14:00 → trễ 0 đến 10s

→ Pattern 4 KÉMHƠN cả Pattern 1 về precision, trong khi tốn nhiều tài nguyên hơn
```

Với interval 10s, trung bình mỗi item trễ **5 giây**. Người chơi A thấy item biến mất lúc 14:00:02, người chơi B thấy lúc 14:00:09 — không đồng nhất giữa các player vì phụ thuộc vào khi nào server poll.

**Điểm yếu 2: DB load liên tục không cần thiết**

```
Interval 10s → 6 lần/phút → 360 lần/giờ → 8,640 lần/ngày

Mỗi lần: 2 query scan toàn bộ shop_item (WHERE is_active=FALSE AND target_start <= now)

Với 10,000 item → 8,640 × 2 full scan = 172,800 query/ngày chỉ để "không có gì thay đổi"
(99% các lần poll là no-op)

Pattern 3: 0 query/ngày ngoài lúc item thực sự start/end
Pattern 1: 0 query background — chỉ query khi player mở shop
```

**Điểm yếu 3: Vẫn tốn infra nhưng phức tạp hơn Pattern 1, không bằng Pattern 3**

```
Pattern 1: Không cần infra gì thêm
Pattern 3: Cần BullMQ + Redis queue (nhưng đổi lại precision tuyệt đối)
Pattern 4: Cần cron scheduler + DB polling (tốn tài nguyên, precision tệ)

→ Pattern 4 tệ nhất ở cả 2 mặt: tốn tài nguyên VÀ precision kém
```

**Điểm yếu 4: Race condition và thundering herd tự tạo ra**

```
Cron chạy trên multi-server cluster:
  Server A poll lúc T=0s → phát hiện item X cần activate → UPDATE is_active=TRUE
  Server B poll lúc T=2s → cũng phát hiện item X (nếu chưa có lock) → UPDATE lại
  → Double broadcast WS RELOAD_SHOP → client reload 2 lần không cần thiết

Fix: cần distributed lock → lại phải dùng Redis → tốn thêm infra
Với BullMQ (Pattern 3): queue đảm bảo mỗi job chạy đúng 1 lần, không cần lock thêm
```

**Điểm yếu 5: Không có `start_at`/`end_at` như nguồn sự thật**

Giống Pattern 3 standalone, nếu chỉ dùng `target_start`/`target_end` để cron đọc mà không dùng làm filter:
```
- Admin query "item này còn hạn đến khi nào?" → phải đọc target_end
- Nhưng is_active=TRUE/FALSE mới là state thực → 2 nguồn sự thật tiềm ẩn conflict
- Nếu cron fail trong 1 giờ → is_active không được update → data sai cho đến khi cron chạy lại
- Debug: "tại sao item này vẫn active?" → phải trace cron log xem poll nào bị skip
```

**Điểm yếu 6: Không thể trigger logic phức tạp tại đúng thời điểm**

```
Pattern 3: job chạy đúng 14:00:00 → init Redis counter, push notification, log analytics
Pattern 4: poll chạy lúc 14:00:07 → trigger muộn 7s → notification "Flash sale bắt đầu!" đến tay user lúc 14:00:08
           Đối với flash sale 10 phút → 7s trễ = 1.2% thời gian sale đã qua khi user nhận notify
```

#### So sánh trực tiếp Pattern 4 vs các pattern khác

| Tiêu chí | P1 Lazy | P3 Delayed Job | P4 Polling Cron |
|---|---|---|---|
| **Precision** | ~100ms (với clock sync) | ~ms | Trung bình 5s (interval/2) |
| **DB query background** | 0 | 0 | 8,640+/ngày (no-op hầu hết) |
| **Infra cần thêm** | Không | BullMQ + Redis queue | Cron scheduler + lock |
| **Multi-server safe** | ✅ (stateless filter) | ✅ (queue đảm bảo) | ❌ (cần distributed lock thêm) |
| **Job/query fail impact** | N/A | High (item stuck) → retry | High (item stuck đến poll tiếp) |
| **Admin sửa end_at** | UPDATE 1 row | Cancel + recreate job | UPDATE target_end (đơn giản) |
| **Nguồn sự thật rõ ràng** | ✅ start_at/end_at | ❌ is_active | ❌ is_active (target chỉ là ref) |
| **Scale với N items** | O(1) | O(2N) jobs | O(N) mỗi 10s scan |
| **Complexity** | Thấp | Trung bình | Trung bình (nhưng kết quả tệ hơn) |

#### Kết luận: Khi nào Pattern 4 có thể chấp nhận được?

Pattern 4 **không bao giờ là lựa chọn tốt** so với các pattern khác, nhưng có thể chấp nhận trong điều kiện rất hạn chế:

- **Precision không quan trọng** (item dài ngày, trễ 5-10s hoàn toàn không ai quan tâm).
- **Không có BullMQ/queue infra** và không muốn setup.
- **Số lượng item rất nhỏ** (< 20 item) → scan cost negligible.
- **Interval đủ thưa** (5 phút thay vì 10s) → chấp nhận trễ tối đa 5 phút.

Trong thực tế, nếu đã đáp ứng các điều kiện trên thì **Pattern 1 standalone còn đơn giản hơn và không tốn tài nguyên background** — Pattern 4 không có lý do tồn tại so với P1.

> **Tóm gọn:** Pattern 4 (Polling Cron) là Pattern 3 nhưng kém hơn ở mọi mặt quan trọng — precision tệ hơn, tốn tài nguyên hơn, không an toàn hơn trên multi-server, không có nguồn sự thật rõ ràng hơn. Đây là anti-pattern điển hình xuất hiện khi team muốn tránh BullMQ nhưng vẫn muốn "server tự động thay đổi state" — giải pháp đúng cho nhu cầu đó vẫn là Pattern 3 hoặc Hybrid 1+3.

---

### 3.5. Hybrid Pattern 1+3 — Sự kết hợp thông minh

**Câu hỏi cốt lõi:** Hybrid 1+3 giải quyết được vấn đề gì mà riêng lẻ không làm được?

#### Vấn đề Pattern 1 standalone không giải quyết được:

**Vấn đề 1: Client không biết khi nào item mới xuất hiện**

```
Scenario: Event shop có item mới bắt đầu bán lúc 15:00.
Player đang mở dialog shop lúc 14:55.

Pattern 1 standalone:
  - 15:00 → item filter tự "bật lên" trong logic
  - Nhưng dialog ĐANG MỞ → không re-fetch → player không thấy item mới
  - Player phải đóng/mở lại dialog để thấy

Hybrid 1+3:
  - 15:00 → BullMQ job chạy → WS broadcast RELOAD_SHOP
  - Client nhận event → fetch lại → item mới xuất hiện ngay trong dialog đang mở
  - Toast: "Item mới vừa xuất hiện trong shop!"
```

**Vấn đề 2: Không có push notification khi item sắp hết hạn**

```
Pattern 1 standalone:
  - Không có hook nào để trigger "còn 1 giờ là hết hạn"
  - Chỉ client tự đếm countdown, không thể push notification server-side

Hybrid 1+3:
  - Có thể schedule thêm job "notify-expiring-soon" 1 giờ trước end_at
  - Push notification: "Item X còn 1 giờ nữa là hết! Mua ngay!"
```

**Vấn đề 3: Player offline không biết shop đã thay đổi**

```
Pattern 1 standalone:
  - Player offline → vào game → fetch shop → filter tự xử lý đúng
  - OK về data, nhưng không có gì "thông báo" shop đã thay đổi

Hybrid 1+3:
  - Có thể log WS events để khi player login → server check "có reload event nào lúc offline không?"
  - Hiện badge "Shop đã có item mới" khi player vào game
```

#### Vấn đề Pattern 3 standalone không giải quyết được:

**Vấn đề 1: Admin sửa end_at quá phức tạp**

```
Pattern 3 standalone:
  - Admin sửa end_at qua panel
  - Backend phải: UPDATE db + removeJob(old) + addJob(new)
  - Nếu bất kỳ bước nào fail → data inconsistent
  - Cần transaction + rollback logic phức tạp

Hybrid 1+3:
  - Admin sửa end_at qua panel
  - Backend: UPDATE db (end_at field) + removeJob(notify-end-X) + addJob(notify-end-X, newDelay)
  - Job fail → chỉ mất WS notify, không ảnh hưởng data
  - Filter vẫn đúng vì dựa trên end_at trong DB
  - Không cần rollback: DB update và job là 2 concerns độc lập
```

**Vấn đề 2: Job failure = item stuck**

```
Pattern 3 standalone:
  - Job 'deactivate-item' fail → retry fail → dead letter
  - is_active vẫn TRUE → player thấy item đã hết hạn
  - Cần monitor + alert + manual fix

Hybrid 1+3:
  - Job 'notify-item-expired' fail → chỉ là WS notify không được gửi
  - Client không reload shop real-time, nhưng filter vẫn đúng
  - Player refresh/re-open dialog → thấy item đã biến mất (filter xử lý)
  - Degraded gracefully, không cần manual fix
```

**Vấn đề 3: DB state không phản ánh "thực tế đang diễn ra"**

```
Pattern 3 standalone:
  - Giữa T=start_at và lúc job chạy (có thể trễ vài ms): is_active=FALSE
  - Nếu query trực tiếp DB (bypass filter): thấy item inactive mặc dù đang trong thời gian active
  - Debug khó hơn

Hybrid 1+3:
  - DB luôn có start_at, end_at rõ ràng
  - Bất kỳ ai query DB cũng biết item đang trong thời gian nào
  - Debug dễ hơn nhiều
```

#### Tóm tắt: Hybrid giải quyết gì mà riêng lẻ không làm được

| Vấn đề | P1 alone | P3 alone | Hybrid 1+3 |
|---|---|---|---|
| Client tự phát hiện item active | ✅ | ✅ (qua is_active) | ✅ |
| Push WS notify đúng lúc item available | ❌ | ✅ | ✅ |
| Push WS notify đúng lúc item expired | ❌ | ✅ | ✅ |
| Admin sửa end_at đơn giản | ✅ | ❌ (cancel+recreate job) | ✅ (update + đổi notify job) |
| Job failure → graceful degrade | N/A | ❌ item stuck | ✅ chỉ mất notify |
| DB state là nguồn sự thật rõ ràng | ✅ | ❌ (phụ thuộc job) | ✅ |
| Scale với nhiều event | ✅ | ❌ (2N jobs) | ✅ (2N jobs nhẹ hơn P3) |
| Trigger push notification | ❌ | ✅ | ✅ |
| Real-time UX khi dialog đang mở | ❌ | ✅ | ✅ |

**Kết luận:** Hybrid 1+3 là sự kết hợp thông minh vì:
1. **Nguồn sự thật là DB** (`start_at`/`end_at`) — không bao giờ sai.
2. **Jobs chỉ làm nhiệm vụ notify** — không thay đổi state → job fail không phá data.
3. **UX real-time** nhờ WS event đúng thời điểm.
4. **Admin workflow đơn giản** — sửa DB là đủ, notify job chỉ là side effect.

---

## 4. So sánh đặc tính kỹ thuật — tất cả 4 variants

| Tiêu chí | P1 Lazy Standalone | P2 Cron | P3 Delayed Standalone | Hybrid 1+3 |
|---|---|---|---|---|
| **Nguồn sự thật** | `start_at`/`end_at` trong DB | Cron schedule | `is_active` trong DB | `start_at`/`end_at` trong DB |
| **DB thay đổi khi item expire** | Không | Có (reset counter) | Có (is_active=FALSE) | Không |
| **WS event khi item expire** | Không | Có (DAILY_RESET) | Có (RELOAD_SHOP) | Có (RELOAD_SHOP) |
| **WS event khi item start** | Không | Không (chỉ reset) | Có (RELOAD_SHOP) | Có (RELOAD_SHOP) |
| **Background job** | Không | 1 cron/schedule | 2 job/item | 2 job/item (nhẹ hơn) |
| **Job failure impact** | N/A | High (reset không chạy) | High (item stuck) | Low (chỉ mất notify) |
| **Admin sửa end_at** | UPDATE 1 row | N/A | UPDATE + cancel + recreate job | UPDATE + swap notify job |
| **Độ chính xác notify** | N/A | Đến giờ | Đến giây/ms | Đến giây/ms |
| **Scale với N items** | O(1) | O(1) | O(2N) jobs | O(2N) jobs (nhẹ) |
| **Phụ thuộc đồng hồ client** | Có (cần Cristian) | Không | Không | Không (server push) |
| **Reset counter đồng bộ** | Không | Có | Không | Không |
| **Debug độ phức tạp** | Thấp | Trung bình | Cao | Trung bình |
| **Phù hợp event dài (7+ ngày)** | ✅ | ❌ | ❌ (over-engineered) | ✅ |
| **Phù hợp flash sale (< 1h)** | ❌ | ❌ | ✅ | Overkill |
| **Phù hợp daily reset** | ❌ | ✅ | ❌ | ❌ |
| **Phù hợp event shop có UX tốt** | ❌ | ❌ | Có thể | ✅ |

---

## 5. Use case: Daily/Weekly Reset Shop → Pattern 2

### 5.1. Đặc điểm use case

- Shop reset stock/items **đồng loạt** cho tất cả player tại cùng 1 thời điểm.
- Player kỳ vọng "mỗi sáng mở game thấy shop mới".
- Reset là **đồng bộ toàn server**, không tính từ thời điểm player vào game.

### 5.2. Ví dụ thực tế

**World of Warcraft:** Daily reset 8h sáng PST/CET, weekly reset thứ 3 (US). Reset áp dụng cho daily quests, dungeon lockouts, world bosses.

**Genshin Impact:** Daily reset 4h sáng theo timezone server. Hầu hết shop refresh stock theo daily/weekly reset.

**Mobile Legends Bang Bang (MLBB):** Daily reset 16:00 PHT (UTC+8) — daily tasks, login rewards, shop refresh.

**Neverness to Everness (NTE):** Daily reset 5:00 AM server time. "Server time always takes priority over your local timezone."

### 5.3. Vì sao bắt buộc dùng Pattern 2?

**Lý do 1: Đồng bộ tuyệt đối giữa player.** Player A và B phải thấy shop reset cùng lúc.

**Lý do 2: Reset là hành động atomic.** Reset không chỉ filter time mà còn reset counter (purchase limit, stock), rotation ngẫu nhiên — tất cả phải xảy ra cùng lúc.

**Lý do 3: Player expectation hình thành 20+ năm.** "Daily reset", "weekly reset" là term chuẩn ngành từ WoW (2004).

**Lý do 4: Server load dễ kiểm soát.** Cron chạy 1 lần/ngày, biết trước.

### 5.4. Implementation chuẩn

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

### 5.5. Edge cases

| Edge case | Xử lý |
|---|---|
| Player offline lúc cron chạy | Khi login lại → fetch fresh qua API thường |
| Cron chạy lỗi giữa chừng | Idempotent: cron có thể chạy lại an toàn |
| Multi-server (cluster) | Distributed lock: chỉ 1 instance chạy cron |
| Player đang mở dialog shop | WS event `DAILY_RESET` → client refresh dialog |

---

## 6. Use case: Event Shop có deadline → Hybrid 1+3

### 6.1. Đặc điểm use case

- Event shop xuất hiện trong khoảng thời gian xác định (vd: 1/6 - 7/6).
- Mỗi event có deadline riêng, không đồng bộ.
- Có thể có nhiều event chạy song song với deadline khác nhau.
- Player kỳ vọng "thấy countdown timer" trên item.
- **UX tốt:** khi item mới xuất hiện hoặc biến mất, client được notify real-time mà không cần poll.

### 6.2. Ví dụ thực tế

**Genshin Impact (event banner):**
```json
{
  "id": 301,
  "name": "Yelan Banner",
  "from": "2026-05-09T18:00:00+08:00",
  "to": "2026-05-30T14:59:59+08:00"
}
```

**Project SEKAI:**
```typescript
interface GachaInfo {
    id: number;
    gachaType: string;
    startAt: string;  // milliseconds timestamp
    endAt: string;
}
```

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

### 6.3. Vì sao Hybrid 1+3 là lựa chọn tốt nhất?

**So với Pattern 1 standalone:** Hybrid thêm WS notify, client không cần poll, UX tốt hơn khi dialog đang mở.

**So với Pattern 3 standalone:** Hybrid dễ maintain hơn (admin sửa end_at chỉ cần UPDATE DB), job failure không gây data inconsistency, scale tốt hơn khi N items lớn.

**So với Pattern 2:** Hybrid xử lý được nhiều event độc lập, không cần cron per-event.

### 6.4. Schema

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
CREATE INDEX idx_shop_start ON shop_item(start_at) WHERE start_at IS NOT NULL;
```

### 6.5. Implementation đầy đủ — Hybrid 1+3

**Tạo item:**
```typescript
async function createTimedShopItem(item: TimedShopItem) {
    const saved = await db.shopItem.create({
        ...item,
        is_active: true,
        start_at: item.start_at,
        end_at: item.end_at
    });

    const now = Date.now();

    // Notify khi item bắt đầu
    if (item.start_at && item.start_at.getTime() > now) {
        const startDelay = item.start_at.getTime() - now;
        await shopNotifyQueue.add(
            'notify-item-available',
            { itemId: saved.id, npcId: item.npc_id },
            { delay: startDelay, jobId: `notify-start-${saved.id}` }
        );
    } else {
        // Item đã sẵn sàng ngay
        wsServer.broadcast({ action: 'RELOAD_SHOP', npcId: item.npc_id, reason: 'item_available' });
    }

    // Notify khi item hết hạn
    if (item.end_at) {
        const endDelay = item.end_at.getTime() - now;
        await shopNotifyQueue.add(
            'notify-item-expired',
            { itemId: saved.id, npcId: item.npc_id },
            { delay: endDelay, jobId: `notify-end-${saved.id}` }
        );
    }

    return saved;
}
```

**Workers:**
```typescript
// Worker: notify available
shopNotifyQueue.process('notify-item-available', async (job) => {
    wsServer.broadcast({
        action: 'RELOAD_SHOP',
        npcId: job.data.npcId,
        reason: 'item_available',
        server_now: Date.now()
    });
});

// Worker: notify expired
shopNotifyQueue.process('notify-item-expired', async (job) => {
    wsServer.broadcast({
        action: 'RELOAD_SHOP',
        npcId: job.data.npcId,
        reason: 'item_expired',
        server_now: Date.now()
    });
});
```

**Server query (vẫn giữ filter logic của Pattern 1):**
```typescript
async function getShopItems(npcId: number) {
    const cached = await redis.get(`shop:npc:${npcId}`);
    let allItems = cached ? JSON.parse(cached) : await db.shopItem.findByNpcId(npcId);

    if (!cached) {
        await redis.setex(`shop:npc:${npcId}`, 300, JSON.stringify(allItems));
    }

    // Filter theo time — nguồn sự thật
    const now = Date.now();
    return {
        items: allItems.filter(item =>
            item.is_active &&
            (!item.start_at || new Date(item.start_at).getTime() <= now) &&
            (!item.end_at || new Date(item.end_at).getTime() > now)
        ),
        server_now: now
    };
}
```

**Validate khi mua (anti-cheat):**
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

**Admin sửa end_at — đơn giản hơn Pattern 3:**
```typescript
async function updateItemEndAt(itemId: number, newEndAt: Date) {
    // Bước 1: Update DB (nguồn sự thật)
    await db.shopItem.update({ id: itemId, end_at: newEndAt });

    // Bước 2: Swap notify job (chỉ là notify, không phải state)
    try {
        await shopNotifyQueue.removeJob(`notify-end-${itemId}`);
        const newDelay = newEndAt.getTime() - Date.now();
        if (newDelay > 0) {
            await shopNotifyQueue.add(
                'notify-item-expired',
                { itemId, npcId: item.npc_id },
                { delay: newDelay, jobId: `notify-end-${itemId}` }
            );
        }
    } catch (err) {
        // Job swap fail → log nhưng KHÔNG rollback DB
        // Filter vẫn đúng, chỉ mất WS notify
        log.warn('Notify job swap failed, data is still correct', err);
    }

    // Broadcast ngay để client biết end_at đã thay đổi
    wsServer.broadcast({ action: 'RELOAD_SHOP', npcId: item.npc_id, reason: 'item_updated' });
}
```

**Client Java:**
```java
public class ShopController {
    private final ClockSync clockSync;

    // Nhận WS event → reload
    @WsListener("RELOAD_SHOP")
    public void onReloadShop(ReloadShopEvent event) {
        if (event.npcId == currentOpenNpcId) {
            shopViewModel.refreshItems(event.npcId);
            if ("item_available".equals(event.reason)) {
                showToast("Item mới vừa xuất hiện!");
            } else if ("item_expired".equals(event.reason)) {
                showToast("Một số item đã hết hạn.");
            }
        }
    }

    // Filter vẫn chạy mỗi render — double protection
    public List<ShopItem> getDisplayItems(int npcId) {
        long now = clockSync.getServerNow();
        return shopCache.get(npcId).stream()
            .filter(item -> item.is_active)
            .filter(item -> item.start_at == null || item.start_at <= now)
            .filter(item -> item.end_at == null || item.end_at > now)
            .collect(Collectors.toList());
    }
}
```

### 6.6. Edge cases

| Edge case | Pattern 1 | Hybrid 1+3 |
|---|---|---|
| Player offline lúc item xuất hiện | Thấy item khi mở shop tiếp theo | Thấy item khi mở shop tiếp theo (filter đúng) + badge "có item mới" |
| Dialog đang mở lúc item hết hạn | Countdown về 0 → ẩn tại tick tiếp theo | WS event → reload ngay |
| Dialog đang mở lúc item start | Không thấy cho đến khi refresh | WS event → reload + toast |
| Admin sửa end_at | UPDATE 1 row | UPDATE + swap notify job |
| Notify job fail | N/A | Chỉ mất UX notify, data vẫn đúng |
| Player đã add vào cart, item hết hạn | Server reject khi confirm | WS event → client clear cart + notify |

---

## 7. Use case: Flash Sale chính xác → Pattern 3 Standalone

### 7.1. Đặc điểm use case

- Sale bắt đầu/kết thúc **chính xác đến giây**.
- Có **thundering herd**: hàng nghìn user click "Mua" cùng 1 giây.
- Cần trigger logic phức tạp (notification toàn server, init counter, log analytics).
- Số lượng item bán có giới hạn, chống oversell.

### 7.2. Vì sao Pattern 3 standalone (không phải Hybrid)?

Với flash sale:
- Precision đến giây là bắt buộc.
- `is_active` phải thực sự `FALSE` trước khi sale bắt đầu — không thể để client filter tự xử lý vì thundering herd cần gate rõ ràng.
- Cần init Redis counter atomic tại đúng thời điểm start — không chỉ là notify.
- Hybrid sẽ không đủ vì vẫn cần thay đổi state (init stock counter, set is_active) tại đúng giây.

### 7.3. Implementation

```typescript
async function scheduleFlashSale(sale: FlashSale) {
    await db.flashSale.create({ ...sale, is_active: false });

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
    // Init stock counter atomic — PHẢI làm tại đây
    await redis.set(`flash_sale:${sale.id}:stock`, sale.total_stock);

    wsServer.broadcast({
        action: 'FLASH_SALE_START',
        saleId: sale.id,
        endAt: sale.end_at,
        server_now: Date.now()
    });

    pushNotificationToAllPlayers({
        title: 'Flash Sale!',
        body: `${sale.name} đang diễn ra!`
    });

    analytics.track('flash_sale_started', { saleId: sale.id });
});

async function purchaseFlashSaleItem(playerId: string, saleId: number) {
    // Atomic decrement — chống oversell
    const remaining = await redis.decr(`flash_sale:${saleId}:stock`);
    if (remaining < 0) {
        await redis.incr(`flash_sale:${saleId}:stock`);
        throw new Error('Hết hàng!');
    }
    await orderQueue.add('process-order', { playerId, saleId });
}
```

### 7.4. Edge cases

| Edge case | Xử lý |
|---|---|
| Server crash trước khi job chạy | BullMQ persist → retry sau restart |
| Job chạy trễ vài ms | Acceptable nếu < 1s |
| Hủy flash sale | Remove job qua jobId |
| Thundering herd | Virtual queue + rate limit + atomic Redis DECR |

---

## 8. Dùng sai pattern sẽ gây vấn đề gì?

### 8.1. Dùng P1 standalone cho Event Shop (khi UX cần notify)

Không phải lỗi kỹ thuật, nhưng UX kém:
- Player đang mở dialog shop không thấy item mới xuất hiện.
- Phải poll định kỳ → tăng load server không cần thiết.
- Không thể push notification "item sắp hết hạn".

→ **Dùng Hybrid 1+3 thay thế.**

### 8.2. Dùng P1 standalone cho Daily Reset

- Không reset đồng bộ giữa player.
- Không reset purchase limit / stock counter.
- Workaround phức tạp: tạo N item mới mỗi ngày → DB phình to.

→ **Dùng Pattern 2.**

### 8.3. Dùng P1 standalone cho Flash Sale

- Không trigger được notification "Sale bắt đầu" đúng giây.
- Không init stock counter atomic.
- Không integrate được queue chống thundering herd.
- Fairness kém vì phụ thuộc clock skew client.

→ **Dùng Pattern 3 standalone.**

### 8.4. Dùng P3 standalone cho Event Shop (nhiều events)

- 100 event = 200 delayed jobs → tốn infra.
- Admin sửa `end_at` → cancel + recreate job → code phức tạp.
- Job failure → item stuck (is_active sai).
- Over-engineering cho event 7 ngày.

→ **Dùng Hybrid 1+3 thay thế.**

### 8.5. Dùng P2 cho Event Shop

- Mỗi event cần 1 cron riêng → quản lý kinh hoàng.
- Không tạo dynamic cron dễ dàng khi admin tạo event runtime.
- Crontab không hỗ trợ giây.

→ **Dùng Hybrid 1+3.**

### 8.6. Dùng Hybrid 1+3 cho Flash Sale

- Hybrid không thay đổi `is_active` — chỉ notify.
- Nhưng flash sale cần gate rõ ràng: `is_active=FALSE` trước giờ mở.
- Thundering herd cần init Redis counter atomic tại đúng giây.
- Hybrid không đủ — cần Pattern 3 standalone.

### 8.7. Tổng kết

| Use case | Pattern đúng | Pattern sai → hậu quả |
|---|---|---|
| Daily reset shop | Pattern 2 | P1/Hybrid: không reset đồng bộ, không reset counter |
| Event shop UX tốt | **Hybrid 1+3** | P1 alone: không notify; P3 alone: over-complex |
| Event shop MVP nhanh | P1 standalone | P3: over-engineering |
| Flash sale precise | Pattern 3 standalone | P1/Hybrid: không gate is_active, không init counter |

---

## 9. Bảng quyết định nhanh

```
Hỏi 1: Reset đồng bộ tất cả player tại 1 giờ cố định + reset counter?
├── CÓ → Pattern 2 (Cron)
└── KHÔNG → Hỏi 2

Hỏi 2: Flash sale precision đến giây + thundering herd + init counter atomic?
├── CÓ → Pattern 3 Standalone
└── KHÔNG → Hỏi 3

Hỏi 3: Nhiều event độc lập với deadline riêng?
├── CÓ → Hỏi 4
└── KHÔNG → Pattern 1 hoặc tùy use case

Hỏi 4: Cần UX tốt (notify client real-time khi item xuất hiện/biến mất)?
├── CÓ → Hybrid 1+3
└── KHÔNG → Pattern 1 Standalone
```

---

## 10. Độ trễ thực tế của Pattern 1 và Hybrid

### 10.1. Pattern 1 KHÔNG phụ thuộc TTL cache để expire item

Cache lưu **raw data** (có `end_at`), không cache kết quả đã filter. Item tự biến mất qua filter kể cả cache vô hạn:

```java
// Cache vô hạn — không TTL
shopCache.put(npcId, items);  // items có item A với end_at = 12:00

// 12:01 — render dialog (cache vẫn có A)
filter(items, now=12:01);  // KHÔNG hiện A nữa dù cache chưa expire
```

TTL cache chỉ ảnh hưởng đến đồng bộ khi admin **sửa data** (handled bởi WS `RELOAD_SHOP`), không liên quan tới item tự hết hạn.

### 10.2. Nguồn trễ thực tế

| Nguồn trễ | Độ lớn | Fix |
|---|---|---|
| Cache TTL | **0ms** (không liên quan) | N/A |
| Đồng hồ client lệch | Vài giây - vài phút | Cristian's Algorithm |
| UI tick interval | ~500ms-1s | Tăng tick rate gần deadline |
| Network round-trip (khi mua) | ~100-500ms | Server validate → an toàn |
| Frame render | ~16-33ms | Không cần fix |

**Sau khi áp dụng Cristian + tick rate cao gần deadline:** độ trễ ~100-300ms — đủ cho event shop.

### 10.3. Hybrid 1+3 giảm trễ perceived thêm

Với Hybrid, ngay cả khi filter có độ trễ 100-300ms, **WS event đến trước**:
- Server push `RELOAD_SHOP` tại đúng `end_at`.
- Client nhận event → fetch lại → filter chạy → item biến mất.
- Perceived latency = network RTT (~50-200ms) thay vì phụ thuộc tick rate UI.

---

## 11. Xử lý multi-region: Timezone & Clock Skew

### 11.1. Timezone không phải vấn đề nếu dùng UTC

Server LUÔN lưu thời gian dạng UTC timestamp:

```sql
-- ĐÚNG
end_at TIMESTAMP NOT NULL  -- '2026-05-09 12:00:00 UTC'

-- SAI
end_at DATETIME NOT NULL   -- '2026-05-09 19:00:00' (không rõ timezone)
```

API trả Unix epoch milliseconds:
```json
{
  "start_at": 1715169600000,
  "end_at": 1715256000000,
  "server_now": 1715200000000
}
```

Client convert sang local timezone CHỈ khi hiển thị:
```java
long endAtUtc = item.end_at;
String localDisplay = formatLocalTime(endAtUtc, deviceTimezone);
// VN: "9/5/2026 20:00 ICT"
// US: "9/5/2026 08:00 EST"
```

### 11.2. Clock Skew là vấn đề thực sự với Pattern 1

```
Server thật: 11:59:55 UTC — item end_at: 12:00:00

User A (đồng hồ chính xác): thấy item còn hạn → mua được
User B (đồng hồ lệch +10s): thấy 12:00:05 → item đã hết → không thấy

→ User B bị thiệt dù server thật vẫn cho mua
```

**Hybrid 1+3 giảm vấn đề này:** WS event từ server push đồng thời → tất cả client reload cùng lúc. Không phụ thuộc clock skew để biết khi nào item hết hạn.

### 11.3. Khi nào Clock Skew quan trọng

| Use case | Clock skew quan trọng? |
|---|---|
| Event shop 7 ngày | Không (lệch 10s vs 604,800s = 0.0017%) |
| Daily reset 4h sáng | Trung bình |
| Flash sale 1 giờ | Có (lệch 10s = 0.28%) |
| Flash sale 1 phút | Rất quan trọng (lệch 10s = 16%) |

---

## 12. Cristian's Algorithm — đồng bộ đồng hồ client với server

### 12.1. Nguyên lý

```
T0 = client gửi request
Ts = server timestamp trong response
T1 = client nhận response

RTT = T1 - T0
One-way delay ≈ RTT/2
Server time tại T1 = Ts + RTT/2
Offset = (Ts + RTT/2) - T1

→ realNow = System.currentTimeMillis() + offset
```

### 12.2. Implementation Java

```java
public class ClockSync {
    private long offset = 0;

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
    }

    public long getServerNow() {
        return System.currentTimeMillis() + offset;
    }
}
```

### 12.3. Embed serverNow vào mọi response (khuyến nghị)

```typescript
// Server middleware
app.use((req, res, next) => {
    res.setHeader('X-Server-Now', Date.now().toString());
    next();
});
```

```java
// Client OkHttp interceptor
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

### 12.4. Tích hợp với Hybrid 1+3

```java
public List<ShopItem> getDisplayItems(int npcId) {
    long now = clockSync.getServerNow();  // serverNow, không phải System.currentTimeMillis()

    return shopCache.get(npcId).stream()
        .filter(item -> item.is_active)
        .filter(item -> item.start_at == null || item.start_at <= now)
        .filter(item -> item.end_at == null || item.end_at > now)
        .collect(Collectors.toList());
}
```

**Với Hybrid:** Cristian vẫn quan trọng cho countdown UI chính xác, nhưng ít critical hơn P1 standalone vì WS event là trigger chính để reload.

---

## 13. Kiến trúc kết hợp tổng thể

```
┌──────────────────────────────────────────────────────────────────────┐
│                          Game Backend                                 │
│                                                                       │
│  ┌──────────────────┐  ┌───────────────────────┐  ┌───────────────┐  │
│  │   Daily Shop     │  │   Event Shop          │  │  Flash Sale   │  │
│  │                  │  │                       │  │               │  │
│  │   Pattern 2      │  │   Hybrid 1+3          │  │  Pattern 3    │  │
│  │   Cron 4h sáng   │  │   ┌─────────────────┐ │  │  Standalone   │  │
│  │   reset stock    │  │   │ DB: start_at/   │ │  │  is_active    │  │
│  │   reset limit    │  │   │      end_at     │ │  │  thay đổi     │  │
│  │                  │  │   │ Filter logic    │ │  │  theo job     │  │
│  │                  │  │   │ BullMQ notify   │ │  │               │  │
│  │                  │  │   └─────────────────┘ │  │               │  │
│  └──────────────────┘  └───────────────────────┘  └───────────────┘  │
│         │                         │                       │           │
│         └─────────────────────────┼───────────────────────┘           │
│                                   │                                   │
│                    ┌──────────────▼──────────────┐                    │
│                    │  Time Service               │                    │
│                    │  - GET /time → server_now   │                    │
│                    │  - X-Server-Now header      │                    │
│                    │  → Client Cristian sync     │                    │
│                    └──────────────┬──────────────┘                    │
│                                   │                                   │
│                    ┌──────────────▼──────────────┐                    │
│                    │  Shop API + Cache            │                   │
│                    │  Redis (raw data, has        │                   │
│                    │  start_at/end_at)            │                   │
│                    │  Filter tại request time     │                   │
│                    └──────────────┬──────────────┘                    │
│                                   │                                   │
│                    ┌──────────────▼──────────────┐                    │
│                    │  BullMQ Queue               │                    │
│                    │  - notify-item-available     │                   │
│                    │  - notify-item-expired       │                   │
│                    │  - start-flash-sale          │                   │
│                    │  - end-flash-sale            │                   │
│                    └──────────────┬──────────────┘                    │
│                                   │                                   │
│                    ┌──────────────▼──────────────┐                    │
│                    │  WS Broadcast Layer         │                    │
│                    │  - DAILY_RESET              │                    │
│                    │  - RELOAD_SHOP              │                    │
│                    │  - FLASH_SALE_START/END     │                    │
│                    └─────────────────────────────┘                    │
└──────────────────────────────────────────────────────────────────────┘
```

### Ví dụ mapping trong game thực tế

**Genshin Impact:**
- Daily commission, shop refresh → Pattern 2 (cron 4h sáng).
- Event banner Yelan (21 ngày) → Hybrid 1+3 (`from`/`to` + WS notify khi banner bắt đầu/kết thúc).
- Bonus drop rate event 1 giờ → Pattern 3 standalone.

**WoW:**
- Daily/Weekly raid lockout → Pattern 2 (cron).
- Hallow's End event (21 ngày) → Hybrid 1+3 (`game_event` table + event trigger WS).
- Server first achievement window → Pattern 3 standalone.

**MLBB:**
- Daily reset 16:00 PHT → Pattern 2 (cron UTC+8).
- Limited skin event 14 ngày → Hybrid 1+3.

---

## 14. Đánh giá hiệu năng và khả năng mở rộng

### 14.1. Hiệu năng DB

| Pattern | Số lượng write khi item expire | Read complexity | Index cần thiết |
|---|---|---|---|
| P1 Standalone | 0 (không write) | Filter trên 2 field | `(is_active, end_at)` |
| P2 Cron | Nhiều (reset toàn bộ) | O(n) mỗi cron | Tùy reset logic |
| P3 Standalone | 1 write/item (UPDATE is_active) | Chỉ `WHERE is_active=TRUE` | `(is_active)` |
| Hybrid 1+3 | 0 (không write) | Filter trên 2 field | `(is_active, end_at)` |

**Nhận xét:** P1 và Hybrid win về write throughput. P3 win về read simplicity (`WHERE is_active=TRUE` nhanh hơn filter 2 field). Với N < 10,000 items, sự khác biệt không đáng kể.

### 14.2. Hiệu năng queue

| Pattern | Jobs/item | Jobs tổng (1000 events) | Job payload | Job failure impact |
|---|---|---|---|---|
| P1 Standalone | 0 | 0 | N/A | N/A |
| P3 Standalone | 2 | 2,000 | Thay đổi state + notify | High (item stuck) |
| Hybrid 1+3 | 2 | 2,000 | Chỉ notify | Low (chỉ mất notify) |

**Nhận xét:** Hybrid và P3 tốn infra như nhau về số job, nhưng Hybrid an toàn hơn vì job failure không ảnh hưởng đến data.

### 14.3. Khả năng mở rộng

**Pattern 1 Standalone:**
- Scale tốt nhất: O(1) ops khi thêm item mới.
- Horizontal scale dễ: mọi app server filter independently.
- Không có shared state ngoài DB.

**Pattern 2 (Cron):**
- Scale tốt: 1 cron/ngày, distributed lock đảm bảo chỉ 1 node chạy.
- Bottleneck: tất cả reset xảy ra cùng lúc → DB spike tại giờ reset.

**Pattern 3 Standalone:**
- Scale với infra: BullMQ hỗ trợ worker pool, horizontal scale workers.
- Bottleneck: Redis queue với 2N items có thể là bottleneck khi N lớn.
- Khó scale admin panel: mỗi edit end_at = 1 job operation.

**Hybrid 1+3:**
- Scale gần bằng P1 về DB.
- Queue chỉ dùng cho notify, nhẹ hơn P3 standalone (payload nhỏ, không có DB write trong worker).
- Redis queue với 2N jobs nhẹ hơn vì mỗi job xử lý nhanh hơn (chỉ broadcast, không write DB).

### 14.4. Khả năng maintain

| Tiêu chí | P1 | P2 | P3 | Hybrid 1+3 |
|---|---|---|---|---|
| Admin sửa end_at | ✅ Đơn giản | N/A | ❌ Cancel+recreate job | ✅ Update + swap notify |
| Debug khi item không hiện | ✅ Kiểm tra 2 field | Trung bình | ❌ Phải check job status | ✅ Kiểm tra 2 field + job |
| Onboarding dev mới | ✅ Dễ hiểu | Trung bình | ❌ Phức tạp | Trung bình |
| Test coverage | ✅ Unit test filter | Trung bình | ❌ Cần mock queue/timer | Trung bình |
| Rollback khi lỗi | ✅ UPDATE 1 row | Cần idempotent | ❌ Phức tạp | ✅ UPDATE + log |

### 14.5. Tóm tắt đánh giá tổng thể

| Tiêu chí | P1 | P2 | P3 | Hybrid 1+3 |
|---|---|---|---|---|
| **Hiệu năng** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Scale** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| **UX real-time** | ⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Maintain** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ |
| **Reliability** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Phức tạp impl** | ⭐⭐⭐⭐⭐ (đơn giản) | ⭐⭐⭐⭐ | ⭐⭐ (phức tạp) | ⭐⭐⭐ |

**Kết luận cho event shop:** Hybrid 1+3 là lựa chọn cân bằng tốt nhất giữa UX, reliability và maintainability. Pattern 1 standalone phù hợp cho MVP hoặc khi team chưa có WS infrastructure.

---

## 15. Tham khảo từ industry

### 15.1. Genshin Impact

Schema gacha banner: ISO 8601 với UTC+8. Daily reset 4h sáng theo timezone server. Event banner với `from`/`to` field rõ ràng — Pattern 1/Hybrid.

### 15.2. Project SEKAI

`startAt`, `endAt` dạng milliseconds timestamp. Logic: "The system identifies active banners by comparing current time against banner start/end timestamps" → Pattern 1 thuần.

### 15.3. WoW (MaNGOS emulator)

Bảng `game_event` với `start_time`, `end_time`. Daily reset 8h sáng PST/CET.

### 15.4. MLBB (Mobile Legends)

Daily reset 16:00 PHT (UTC+8). "Server time always takes priority over your local timezone" → Pattern 2 cho daily reset, Pattern 1/Hybrid cho event content.

### 15.5. Cristian's Algorithm

Flaviu Cristian (1989). Tham khảo: Cambridge distributed systems lecture notes, GeeksforGeeks, Wikipedia.

### 15.6. UTC best practice (AppSignal)

"Using UTC reduces the need for complex time zone conversions" → Server LUÔN UTC, client convert khi hiển thị.

---

## Kết luận

### Tóm tắt patterns

| Pattern | Use case chính | Khi nào dùng |
|---|---|---|
| **Pattern 1 Standalone** | Event shop MVP | Không cần notify real-time, team nhỏ, infra đơn giản |
| **Pattern 2 (Cron)** | Daily/Weekly reset | Reset đồng bộ + reset counter toàn server |
| **Pattern 3 Standalone** | Flash sale precise | Precision đến giây + thundering herd + init counter |
| **Hybrid 1+3** | Event shop production | UX tốt + reliability cao + admin dễ maintain |

### Đính chính các điểm từ tài liệu trước

1. **Pattern 1 KHÔNG phụ thuộc TTL cache.** Item tự biến mất qua filter dù cache vô hạn.
2. **Pattern 1 KHÔNG cần WS event "trigger hết hạn".** Client tự filter. WS chỉ cần khi admin sửa data.
3. **Pattern 3 standalone ≠ Pattern 1 với jobs thêm vào.** P3 thực sự thay đổi `is_active` trong DB.
4. **Hybrid 1+3 là kết hợp thông minh:** Jobs chỉ làm nhiệm vụ notify, không thay đổi state → job failure không phá data, admin workflow đơn giản.
5. **Multi-region** không phải vấn đề nếu server lưu UTC + client convert khi hiển thị + Cristian's algorithm fix clock skew.

### Lộ trình áp dụng theo phase

**Phase 1 (MVP):** Shop NPC thường → chỉ `is_active`, không cần time pattern.

**Phase 2 (Event content, team nhỏ):** Thêm Pattern 1 standalone: `start_at`, `end_at` UTC, Cristian's algorithm, server validate khi transaction.

**Phase 3 (Event content, production):** Nâng lên Hybrid 1+3: thêm BullMQ notify jobs, WS broadcast khi item start/end.

**Phase 4 (Daily content):** Thêm Pattern 2 (cron) khi có daily shop/daily quest.

**Phase 5 (Flash sale):** Thêm Pattern 3 standalone chỉ khi business yêu cầu rõ ràng.

---

## Phụ lục: Lịch sử thay đổi

| Version | Ngày | Nội dung |
|---|---|---|
| 1.0 | 2026-05-09 | Khởi tạo, phân tích 3 patterns |
| 2.0 | 2026-05-09 | Đính chính độ trễ Pattern 1, bổ sung Cristian's algorithm, multi-region |
| 3.0 | 2026-05-12 | Bổ sung Hybrid 1+3, chi tiết P1/P3 standalone, đánh giá hiệu năng và khả năng mở rộng toàn diện |

---

## Tham khảo

1. **Genshin Impact** — Daily/weekly reset & gacha banner schema
2. **World of Warcraft** — Daily/weekly reset architecture
3. **Project SEKAI** — Gacha banner với startAt/endAt
4. **WoW MaNGOS Emulator** — game_event table
5. **Mobile Legends Bang Bang** — Daily reset 16:00 PHT
6. **AlgoMaster** — Flash Sale system design
7. **CrackingWalnuts** — Flash sale architecture với queue
8. **Cristian, F. (1989)** — "Probabilistic clock synchronization"
9. **Cambridge Distributed Systems Lecture Notes** — Cristian's algorithm example
10. **GeeksforGeeks** — Cristian's Algorithm formula
11. **Wikipedia** — Cristian's algorithm
12. **AppSignal** — UTC best practices
13. **Trophy** — Gamification timezone handling
14. **BullMQ** — Job queue documentation