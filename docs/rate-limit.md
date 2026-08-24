# Rate Limiting — Tài liệu kỹ thuật

> **Mục đích:** Tài liệu này giải thích các thuật toán rate limiting, và hướng dẫn implement đúng cho dự án NestJS + Redis.

---

## Mục lục

1. [Code hiện tại đang sai ở đâu](#1-code-hiện-tại-đang-sai-ở-đâu)
2. [Tổng quan các thuật toán](#2-tổng-quan-các-thuật-toán)
3. [Fixed Window Counter](#3-fixed-window-counter)
4. [Sliding Window Log](#4-sliding-window-log)
5. [Sliding Window Counter](#5-sliding-window-counter)
6. [Token Bucket](#6-token-bucket)
7. [Leaky Bucket](#7-leaky-bucket)
8. [So sánh tổng hợp](#8-so-sánh-tổng-hợp)
9. [Lựa chọn phù hợp nhất & lý do](#9-lựa-chọn-phù-hợp-nhất--lý-do)
10. [Implementation cuối cùng](#10-implementation-cuối-cùng)

---

## 1. Code hiện tại đang sai ở đâu

### Code gốc (ở phần `// Rate limit tai day`)

```typescript
const key = `rate_limit:${identifier}`;
const limit = 100;
const ttl = 60;

let count = (await this.cacheManager.get<number>(key)) || 0;
count++;

if (count > limit) {
  throw new HttpException('Too many requests', HttpStatus.TOO_MANY_REQUESTS);
}

await this.cacheManager.set(key, count, ttl * 1000);
```

### ❌ Lỗi 1: Race Condition (Critical)

Flow hiện tại là **GET → tính toán → SET**, không phải atomic. Dưới tải cao:

```
Timeline:
  User A: GET key → nhận count = 50
  User B: GET key → nhận count = 50  ← cùng lúc, đọc cùng giá trị
  User A: SET key = 51
  User B: SET key = 51               ← ghi đè, mất 1 lần đếm

Kết quả: 2 requests chỉ được đếm là 1
→ Dưới tải 1000 req/s, limit 100 thực tế có thể bị vượt hàng chục lần
```

### ❌ Lỗi 2: TTL bị reset liên tục — window không cố định

Mỗi lần `cacheManager.set()` đều **ghi đè TTL**, khiến cửa sổ thời gian trôi theo request cuối:

```
t=0s:   req 1  → count=1,  TTL reset → expire lúc t=60s
t=30s:  req 50 → count=50, TTL reset → expire lúc t=90s   ← window bị dời
t=59s:  req 99 → count=99, TTL reset → expire lúc t=119s  ← window tiếp tục trôi
```

**Hệ quả thực tế:**
- Không phải "100 req/phút" nữa — mà là "100 req liên tiếp không nghỉ"
- Nếu user gửi 99 req rồi dừng → TTL expire → gửi tiếp 99 req: **198 req, không bị block lần nào**
- Window tự reset mỗi khi có request, không bao giờ là fixed 60 giây thực sự

### ❌ Lỗi 3: Behavior là "Inactivity-reset Counter" — không có tên chuẩn

Đây là một **anti-pattern** không tương đương với bất kỳ thuật toán rate limiting chuẩn nào:

| Behavior | Mô tả |
|---|---|
| Chặn khi | count > 100 VÀ TTL vẫn còn (tính từ request cuối) |
| Không chặn khi | User gửi rải rác, dừng > 60s giữa các burst |
| Tên gọi | ❌ Không có — đây là broken implementation |

---

## 2. Tổng quan các thuật toán

```
                    ┌─────────────────────────────────────┐
                    │         Rate Limiting Algorithms     │
                    └──────────────────┬──────────────────┘
                                       │
          ┌────────────────────────────┼────────────────────────────┐
          │                            │                            │
   ┌──────▼──────┐            ┌───────▼───────┐           ┌───────▼───────┐
   │   Window-   │            │    Bucket-    │           │   Hybrid      │
   │   based     │            │    based      │           │               │
   └──────┬──────┘            └───────┬───────┘           └───────┬───────┘
          │                           │                           │
   ┌──────┴──────┐            ┌───────┴───────┐          ┌───────▼───────┐
   │ Fixed Window│            │  Token Bucket │          │Sliding Window │
   │ Sliding Log │            │  Leaky Bucket │          │   Counter     │
   └─────────────┘            └───────────────┘          └───────────────┘
```

---

## 3. Fixed Window Counter

### Cách hoạt động

Chia timeline thành các cửa sổ cố định (ví dụ: mỗi phút từ `:00` đến `:59`). Đếm request trong mỗi cửa sổ, reset về 0 khi sang cửa sổ mới.

```
|--- Window 1 (00:00–00:59) ---|--- Window 2 (01:00–01:59) ---|
  req1  req2 ... req99  req100       req1  req2 ... req100
  ✅    ✅        ✅     ✅           ✅    ✅        ✅
                              req101 ❌ (block)
```

**Vấn đề Boundary Burst:**

```
00:59 — gửi 100 req (cuối window 1) ✅
01:00 — gửi 100 req (đầu window 2) ✅
→ 200 req trong vòng 1 giây, không bị block
```

### ✅ Ưu điểm
- Implement đơn giản nhất
- Memory O(1) — chỉ lưu 1 counter per user
- Atomic với Redis `INCR`

### ❌ Nhược điểm
- **Boundary burst:** 2x limit request có thể xảy ra tại ranh giới giữa 2 window
- Window cứng nhắc, không smooth

### Implementation

```typescript
async checkRateLimit(identifier: string): Promise<void> {
  const windowSize = 60; // seconds
  const limit = 100;
  
  // Key gắn với window timestamp → tự động sang window mới
  const window = Math.floor(Date.now() / 1000 / windowSize);
  const key = `rl:fw:${identifier}:${window}`;

  // INCR atomic — Redis tự tạo key = 0 nếu chưa tồn tại
  const count = await this.redis.incr(key);

  // Chỉ set TTL lần đầu tiên
  if (count === 1) {
    await this.redis.expire(key, windowSize * 2); // *2 để an toàn
  }

  if (count > limit) {
    throw new HttpException('Too many requests', HttpStatus.TOO_MANY_REQUESTS);
  }
}
```

---

## 4. Sliding Window Log

### Cách hoạt động

Lưu timestamp của **từng request** trong Redis Sorted Set. Mỗi lần có request mới, xóa các timestamp cũ hơn `now - windowSize` và đếm số còn lại.

```
Sorted Set: user:123
  Score (timestamp ms) | Member (request ID)
  1700000000000        | req_abc
  1700000030000        | req_def
  1700000055000        | req_ghi
  ...

Khi có request mới lúc t=1700000070000:
  1. Xóa entries có score < (1700000070000 - 60000) = 1699999070000... (có thể là req_abc)
  2. Đếm entries còn lại
  3. Nếu count >= 100 → block
  4. Nếu không → thêm entry mới
```

### ✅ Ưu điểm
- **Chính xác nhất** — không có boundary burst
- Sliding window thực sự, luôn đếm đúng 60s gần nhất

### ❌ Nhược điểm
- **Memory tốn kém:** O(n) per user — lưu từng timestamp, 100 req/user = 100 entries
- Với 10,000 users active → hàng triệu entries trong Redis
- Nhiều Redis operations hơn (ZADD + ZREMRANGEBYSCORE + ZCARD)

### Implementation

```typescript
async checkRateLimit(identifier: string): Promise<void> {
  const windowMs = 60 * 1000;
  const limit = 100;
  const now = Date.now();
  const key = `rl:swl:${identifier}`;

  const pipeline = this.redis.pipeline();
  
  // Xóa entries cũ hơn window
  pipeline.zremrangebyscore(key, 0, now - windowMs);
  // Đếm entries còn trong window
  pipeline.zcard(key);
  // Thêm request hiện tại
  pipeline.zadd(key, now, `${now}-${Math.random()}`);
  // Set TTL
  pipeline.expire(key, 120);

  const results = await pipeline.exec();
  const count = results[1][1] as number;

  if (count >= limit) {
    // Xóa request vừa thêm vào vì bị block
    await this.redis.zremrangebyscore(key, now, now);
    throw new HttpException('Too many requests', HttpStatus.TOO_MANY_REQUESTS);
  }
}
```

---

## 5. Sliding Window Counter

### Cách hoạt động

Kết hợp Fixed Window (ít memory) với tính gần đúng của Sliding Window. Dùng 2 counter: window hiện tại và window trước, tính trọng số dựa trên thời gian đã trôi qua.

```
Công thức:
  estimate = count_current + count_prev × (1 - elapsed/window_size)

Ví dụ: window 60s, hiện tại t=75s (tức là 15s vào window thứ 2):
  count_prev    = 80 (window 60–120s trước)
  count_current = 30 (window 0–60s hiện tại)
  elapsed       = 15s / 60s = 0.25

  estimate = 30 + 80 × (1 - 0.25) = 30 + 60 = 90 ✅ dưới limit
```

```
Timeline:
  |--- prev window (0–60s) ---|--- current window (60–120s) ---|
       count_prev = 80              count_current = 30
                              t=75s ↑
                              overlap = (120-75)/60 = 75% của prev còn tính
                              estimate = 30 + 80×0.75 = 90
```

### ✅ Ưu điểm
- **Cân bằng tốt nhất** giữa độ chính xác và memory
- Memory O(1) — chỉ 2 counters per user
- Không có boundary burst như Fixed Window
- Atomic với Redis `INCR`

### ❌ Nhược điểm
- Là **xấp xỉ** (approximation), không chính xác 100%
- Logic tính toán phức tạp hơn Fixed Window một chút
- Sai số tối đa khoảng ~10% trong worst case

### Implementation

```typescript
async checkRateLimit(identifier: string): Promise<void> {
  const windowSize = 60; // seconds
  const limit = 100;
  const now = Math.floor(Date.now() / 1000);
  const currentWindow = Math.floor(now / windowSize);
  const prevWindow = currentWindow - 1;

  const currentKey = `rl:swc:${identifier}:${currentWindow}`;
  const prevKey = `rl:swc:${identifier}:${prevWindow}`;

  // Đọc cả 2 counters song song
  const [prevCount, currentCount] = await Promise.all([
    this.redis.get(prevKey).then(v => parseInt(v || '0')),
    this.redis.get(currentKey).then(v => parseInt(v || '0')),
  ]);

  // Tính phần trăm đã trôi qua trong window hiện tại
  const elapsed = now % windowSize;
  const prevWeight = 1 - elapsed / windowSize;
  const estimate = currentCount + prevCount * prevWeight;

  if (estimate >= limit) {
    throw new HttpException('Too many requests', HttpStatus.TOO_MANY_REQUESTS);
  }

  // Tăng counter window hiện tại (atomic)
  const pipeline = this.redis.pipeline();
  pipeline.incr(currentKey);
  pipeline.expire(currentKey, windowSize * 2);
  await pipeline.exec();
}
```

---

## 6. Token Bucket

### Cách hoạt động

Mỗi user có một "bucket" chứa token. Token được nạp đều đặn theo tốc độ cố định. Mỗi request tiêu 1 token. Nếu bucket rỗng → block.

```
Bucket capacity: 100 tokens
Refill rate: 100 tokens/60s ≈ 1.67 token/giây

t=0s:    bucket = 100, gửi 50 req → bucket = 50
t=30s:   bucket = 50 + 30×1.67 = 100 (đã đầy), gửi 80 req → bucket = 20
t=31s:   gửi 25 req → bucket = 20-25 = -5 → BLOCK từ req thứ 21
```

**Cho phép burst có kiểm soát:**

```
t=0s:    bucket đầy = 100, gửi 100 req cùng lúc → hết token
t=1s:    bucket = 1.67, chỉ cho phép 1 req
→ Burst ngắn được phép, sau đó throttle dần về rate bình thường
```

### ✅ Ưu điểm
- **Linh hoạt nhất** — cho phép burst ngắn hạn một cách có kiểm soát
- Được dùng bởi Cloudflare, AWS API Gateway
- Smooth rate limiting — không có cliff edge

### ❌ Nhược điểm
- Phức tạp hơn để implement đúng
- Cần lưu thêm `last_refill_time` → state phức tạp hơn
- Khó giải thích cho user: "bạn còn X token" ít trực quan hơn "bạn đã dùng X/100 req"
- Race condition nếu không dùng Lua script

### Implementation

```typescript
async checkRateLimit(identifier: string): Promise<void> {
  const capacity = 100;       // bucket size
  const refillRate = 100 / 60; // tokens per second

  const key = `rl:tb:${identifier}`;

  // Dùng Lua để atomic read-modify-write
  const luaScript = `
    local key = KEYS[1]
    local capacity = tonumber(ARGV[1])
    local refill_rate = tonumber(ARGV[2])
    local now = tonumber(ARGV[3])

    local data = redis.call('HMGET', key, 'tokens', 'last_refill')
    local tokens = tonumber(data[1]) or capacity
    local last_refill = tonumber(data[2]) or now

    -- Tính tokens được nạp thêm
    local elapsed = now - last_refill
    tokens = math.min(capacity, tokens + elapsed * refill_rate)

    if tokens < 1 then
      return 0  -- block
    end

    tokens = tokens - 1
    redis.call('HMSET', key, 'tokens', tokens, 'last_refill', now)
    redis.call('EXPIRE', key, 3600)
    return 1  -- allow
  `;

  const now = Date.now() / 1000;
  const allowed = await this.redis.eval(
    luaScript, 1, key,
    capacity.toString(),
    refillRate.toString(),
    now.toString()
  );

  if (!allowed) {
    throw new HttpException('Too many requests', HttpStatus.TOO_MANY_REQUESTS);
  }
}
```

---

## 7. Leaky Bucket

### Cách hoạt động

Request vào "queue" (bucket). Queue xử lý với tốc độ cố định, bất kể input rate. Nếu queue đầy → reject.

```
Input (bất kỳ rate nào):   ████████████████████
                                    ↓ (queue capacity = 100)
Bucket:                    [req1][req2]...[req100]
                                    ↓ (leak rate = 10 req/s)
Output (đều đặn):          req1...req2...req3...
```

### ✅ Ưu điểm
- Output rate hoàn toàn đều đặn (smooth)
- Phù hợp để bảo vệ downstream services

### ❌ Nhược điểm
- **Không phù hợp làm API rate limiter** — nó queue request, không reject ngay
- Tăng latency cho mọi request
- Complex implementation với queue management
- Về bản chất giống Token Bucket nhưng nhìn từ góc độ output

> **Kết luận:** Leaky Bucket phù hợp cho traffic shaping (network/infrastructure), **không phù hợp** cho API rate limiting ở tầng middleware.

---

## 8. So sánh tổng hợp

| Tiêu chí | Fixed Window | Sliding Log | Sliding Counter | Token Bucket |
|---|---|---|---|---|
| **Độ chính xác** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Memory** | ✅ O(1) | ❌ O(n) | ✅ O(1) | ✅ O(1) |
| **Complexity** | Thấp | Trung bình | Trung bình | Cao |
| **Boundary burst** | ❌ Có | ✅ Không | ✅ Không | ✅ Không |
| **Cho phép burst** | ❌ | ❌ | ❌ | ✅ |
| **Atomic** | ✅ INCR | ✅ Pipeline | ✅ INCR | ✅ Lua |
| **Dễ debug** | ✅ | ⭐⭐ | ⭐⭐⭐ | ⭐⭐ |
| **Production usage** | Nginx | Hiếm | Redis Labs | Cloudflare, AWS |

---

## 9. Lựa chọn phù hợp nhất & lý do

### ✅ Khuyến nghị: **Sliding Window Counter**

**Lý do:**

1. **Loại bỏ boundary burst của Fixed Window** — điểm yếu chết người nhất của thuật toán đơn giản nhất. Với Fixed Window, user có thể gửi 200 req trong 1 giây tại boundary mà không bị block.

2. **Memory hiệu quả hơn Sliding Log** — O(1) thay vì O(n). Với 10,000 users active mỗi người 100 req, Sliding Log cần lưu 1 triệu entries; Sliding Counter chỉ cần 20,000 entries (2 per user).

3. **Đơn giản hơn Token Bucket** — không cần Lua script, không cần track `last_refill_time`, logic dễ đọc và debug hơn.

4. **Sai số chấp nhận được** — worst case sai số ~10%, hoàn toàn ổn cho API rate limiting thông thường. Nếu cần chính xác tuyệt đối thì dùng Sliding Log, nhưng cost không đáng.

5. **Phù hợp với use case hiện tại** — rate limit theo user (authenticated), không cần burst flexibility của Token Bucket. Mục tiêu là ngăn abuse, không phải smooth traffic shaping.

**Khi nào nên chọn khác:**
- Cần burst flexibility → **Token Bucket**
- Cần chính xác tuyệt đối, memory không phải vấn đề → **Sliding Log**
- Cần đơn giản tối đa, chấp nhận boundary burst → **Fixed Window**

---

## 10. Implementation cuối cùng

Đây là code hoàn chỉnh cho `RateLimitMiddleware` dùng **Sliding Window Counter**:

```typescript
import {
  Injectable,
  NestMiddleware,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { Inject } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { JwtService } from '@nestjs/jwt';
import Redis from 'ioredis';

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private jwtService: JwtService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers['authorization'];
    let identifier: string | null = null;

    if (authHeader) {
      try {
        const token = authHeader.replace('Bearer ', '');
        const payload = this.jwtService.verify(token, {
          secret: process.env.JWT_SECRET,
        });
        identifier = `user:${payload.userId}`;
      } catch {
        // JWT invalid — fallthrough to null
      }
    }

    // TODO: Anonymous rate limiting bị vô nghĩa ở case Vercel SSR vì
    // cf-connecting-ip / x-forwarded-for đều trả về IP Vercel server thay vì IP browser thật.
    // Cần FE gửi kèm header `x-browser-ip` (đọc từ Vercel middleware) hoặc dùng
    // anonymous session token (`x-anonymous-id`) thì mới xử lý tiếp được.
    // Tạm thời: bỏ qua request không xác định được userId.
    if (!identifier) {
      return next();
    }

    await this.checkRateLimit(identifier);
    next();
  }

  private async checkRateLimit(identifier: string): Promise<void> {
    const WINDOW_SIZE = 60;  // seconds
    const LIMIT = 100;       // max requests per window

    const now = Math.floor(Date.now() / 1000);
    const currentWindow = Math.floor(now / WINDOW_SIZE);
    const prevWindow = currentWindow - 1;

    const currentKey = `rl:swc:${identifier}:${currentWindow}`;
    const prevKey    = `rl:swc:${identifier}:${prevWindow}`;

    // Đọc song song 2 counters, không block nhau
    const [prevCountStr, currentCountStr] = await Promise.all([
      this.redis.get(prevKey),
      this.redis.get(currentKey),
    ]);

    const prevCount    = parseInt(prevCountStr    || '0', 10);
    const currentCount = parseInt(currentCountStr || '0', 10);

    // Tính trọng số: bao nhiêu % của window trước còn nằm trong 60s gần nhất
    const elapsedInCurrentWindow = now % WINDOW_SIZE;
    const prevWeight = 1 - elapsedInCurrentWindow / WINDOW_SIZE;
    const estimate   = currentCount + prevCount * prevWeight;

    if (estimate >= LIMIT) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Too many requests. Please slow down.',
          retryAfter: WINDOW_SIZE - elapsedInCurrentWindow,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Tăng counter hiện tại (atomic INCR) + set TTL
    const pipeline = this.redis.pipeline();
    pipeline.incr(currentKey);
    pipeline.expire(currentKey, WINDOW_SIZE * 2); // *2 để key không expire giữa chừng
    await pipeline.exec();
  }
}
```

### Điểm khác biệt so với code cũ

| | Code cũ | Code mới |
|---|---|---|
| Atomicity | ❌ GET + SET (race condition) | ✅ INCR (atomic) |
| TTL behavior | ❌ Reset mỗi request | ✅ Set 1 lần khi tạo key |
| Window type | ❌ Inactivity-reset (broken) | ✅ Sliding Window Counter |
| Boundary burst | ❌ Không kiểm soát | ✅ Được xử lý |
| Algorithm | ❌ Anti-pattern | ✅ Chuẩn |

### Response headers nên thêm (optional nhưng best practice)

```typescript
// Thêm vào trước next() để client biết trạng thái rate limit
res.setHeader('X-RateLimit-Limit', LIMIT);
res.setHeader('X-RateLimit-Remaining', Math.max(0, LIMIT - Math.ceil(estimate) - 1));
res.setHeader('X-RateLimit-Reset', (currentWindow + 1) * WINDOW_SIZE);
```

---

*Tài liệu này được tạo dựa trên phân tích code `RateLimitMiddleware` trong dự án NestJS.*
*Thuật toán được chọn: **Sliding Window Counter** — cân bằng giữa độ chính xác, memory, và độ phức tạp.*