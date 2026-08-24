# JWT Token Lifecycle — Thiết kế, Phân tích & Chiến lược Revoke

> Tài liệu này mô tả toàn bộ vòng đời của JWT token trong hệ thống có **Web (n-n multi-device)** và **Game (1-1 single session)**, từ lúc tạo ra đến lúc bị thu hồi hoặc hết hạn tự nhiên.

---

## Mục lục

1. [Bài toán đặt ra](#1-bài-toán-đặt-ra)
2. [Kiến trúc Token — Tạo token như thế nào](#2-kiến-trúc-token--tạo-token-như-thế-nào)
3. [Token Lifecycle — Vòng đời đầy đủ](#3-token-lifecycle--vòng-đời-đầy-đủ)
4. [Game Session — Cơ chế 1-1 tách biệt khỏi JWT](#4-game-session--cơ-chế-1-1-tách-biệt-khỏi-jwt)
5. [Chiến lược Revoke All — So sánh các cách](#5-chiến-lược-revoke-all--so-sánh-các-cách)
6. [Giải pháp Revoke All: tokenVersion](#6-giải-pháp-revoke-all-tokenversion)
7. [Caching & Performance](#7-caching--performance)
8. [Các trigger revoke — Ma trận đầy đủ](#8-các-trigger-revoke--ma-trận-đầy-đủ)
9. [Tóm tắt quyết định kiến trúc](#9-tóm-tắt-quyết-định-kiến-trúc)
10. [Future: Revoke Single Token (Logout đơn lẻ)](#10-future-revoke-single-token-logout-đơn-lẻ)

---

## 1. Bài toán đặt ra

### Bối cảnh hệ thống

| Platform | Login Policy | Mô tả |
|----------|-------------|-------|
| **Web** | **n-n** | Nhiều thiết bị/tab cùng login, không kick nhau. Cứ có token hợp lệ là được phép |
| **Game** | **1-1** | Chỉ 1 session tại 1 thời điểm. Vào game trên thiết bị mới → kick session cũ ngay |

### Yêu cầu nghiệp vụ

```
[WEB]
  ✦ Login trên nhiều thiết bị → tất cả đều hợp lệ song song
  ✦ Đổi mật khẩu → revoke TOÀN BỘ token web

[GAME]
  ✦ Gọi POST /game/play → nhận gameSessionId (cơ chế riêng, không nhúng vào JWT)
  ✦ Vào game thiết bị mới → kick session cũ ngay lập tức (atomic GETSET)
  ✦ Đổi mật khẩu → revoke token game + kick WebSocket đang kết nối

[CHUNG]
  ✦ Token hết hạn tự nhiên → không cần xử lý thêm
  ✦ Hệ thống phải scale, không tích lũy data rác
  ✦ Revoke all phải có hiệu lực gần như tức thì (< cache TTL)
```

---

## 2. Kiến trúc Token — Tạo token như thế nào

### 2.1. Cấu trúc JWT Payload

JWT gồm 3 phần: `header.payload.signature`. Phần quan trọng nhất là **payload** — dữ liệu được encode (không encrypted) trong token.

```typescript
// types/jwt-payload.ts
export interface JwtPayload {
  // === Standard Claims (RFC 7519) ===
  iat: number;          // Issued At — unix timestamp khi tạo (tự động bởi jsonwebtoken)
  exp: number;          // Expiration — unix timestamp hết hạn

  // === Custom Claims ===
  userId: string;        // Primary identifier
  role: string;          // Role của user (ADMIN, USER, ...)
  tokenVersion: number;  // Version để revoke all (xem phần 6)
}
```

> **Lưu ý quan trọng:** `gameSessionId` **KHÔNG** nằm trong JWT payload. Game session được quản lý hoàn toàn độc lập qua Redis và được truyền qua WebSocket handshake. JWT chỉ dùng để authenticate với REST API — sau khi có `gameSessionId` từ `/game/play`, game client dùng session đó để kết nối WebSocket, không cần mang JWT vào game logic.

### 2.2. Những gì nên và không nên đặt vào payload

```
❌ Không nên đặt vào payload:
  - permissions chi tiết  → thay đổi thường xuyên, token cũ sẽ stale
  - email, username       → có thể đổi, gây inconsistency
  - sensitive data        → payload chỉ là base64, KHÔNG encrypted
  - gameSessionId         → quản lý riêng qua Redis, không phải JWT concern

✅ Nên đặt vào payload:
  - userId                → immutable, dùng để lookup
  - role                  → ít thay đổi, tiện check nhanh
  - tokenVersion          → revoke signal khi đổi mật khẩu
```

---

## 3. Token Lifecycle — Vòng đời đầy đủ

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          TOKEN LIFECYCLE                                  │
│                                                                           │
│  [Login — Web & Game đều dùng chung 1 token]                             │
│     │                                                                     │
│     ▼                                                                     │
│  createToken({ userId, role, tokenVersion })                              │
│     │                                                                     │
│     └──→ return JWT  (không lưu gì vào Redis/DB)                         │
│                                                                           │
│  [Vào Game — bước riêng, sau khi đã có JWT]                              │
│     │                                                                     │
│     ▼                                                                     │
│  POST /game/play  (JWT trong Authorization header)                        │
│     │                                                                     │
│     ▼                                                                     │
│  Lua GETSET atomic:                                                       │
│    oldSessionId = GETSET user:{userId}:gameSession {newSessionId}         │
│    EXPIRE user:{userId}:gameSession 86400                                 │
│     │                                                                     │
│     ├── oldSessionId != null → kickSocket(userId)  [kick WS cũ]          │
│     │                                                                     │
│     └──→ return { gameSessionId }  ← client giữ để kết nối WS            │
│                                                                           │
│  [WebSocket Connect]                                                      │
│     │                                                                     │
│     ▼                                                                     │
│  handshake: { token: JWT, gameSessionId }                                 │
│     │                                                                     │
│     ├── jwtService.verifyAsync(token)  →  fail → disconnect               │
│     │                                                                     │
│     ├── redis.get(user:{userId}:gameSession)                              │
│     │     !== gameSessionId → disconnect (session bị thay thế)           │
│     │                                                                     │
│     └──→ Kết nối thành công, join MAP room, emit mapSnapshot ✅           │
│                                                                           │
│  [Mỗi REST Request — Web API]                                             │
│     │                                                                     │
│     ▼                                                                     │
│  JwtAuthGuard:                                                            │
│    jwt.verify()              → fail → 401 (expired / tampered)           │
│    check tokenVersion cache  → mismatch → 401 (revoked all)              │
│     │ ok                                                                  │
│     └──→ Request được xử lý ✅                                            │
│                                                                           │
│  [Đổi mật khẩu]                                                           │
│     │                                                                     │
│     ▼                                                                     │
│  UPDATE users SET token_version + 1   (DB transaction)                   │
│  DEL tokenVer:{userId}                (cache invalidate tức thì)         │
│  DEL user:{userId}:gameSession        (game session bị xóa)              │
│  emit('auth.password_changed')        (kick WebSocket)                   │
│     │                                                                     │
│     └──→ Toàn bộ JWT cũ bị chặn ở bước check tokenVersion ✅             │
│                                                                           │
│  [Token hết hạn tự nhiên]                                                 │
│     │                                                                     │
│     ▼                                                                     │
│  jwt.verify() → TokenExpiredError → 401  (không cần làm gì thêm) ✅      │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Game Session — Cơ chế 1-1 tách biệt khỏi JWT

### 4.1. Tại sao gameSessionId không nằm trong JWT?

Đây là điểm thiết kế quan trọng nhất của phần game:

```
Nếu nhét gameSessionId vào JWT payload:
  → JWT đã ký không thể thay đổi nội dung
  → Mỗi lần vào game phải tạo JWT mới (session mới = payload mới)
  → Client phải lưu JWT mới, token cũ lãng phí
  → Cồng kềnh, phức tạp không cần thiết

Tách gameSessionId ra Redis (cách hiện tại):
  → JWT chỉ authenticate "đây là user hợp lệ" (không đổi suốt 7 ngày)
  → gameSessionId là "vé vào cửa game" — tạo mới mỗi lần play, lưu Redis
  → WebSocket handshake mang cả hai: JWT (ai?) + gameSessionId (vé nào?)
  → Mỗi thứ lo đúng việc của nó, lifecycle độc lập
```

### 4.2. Flow POST /game/play

```typescript
// game/game.controller.ts
const PLAY_SCRIPT = `
  local key = KEYS[1]
  local newId = ARGV[1]
  local ttl = tonumber(ARGV[2])

  local oldId = redis.call('GETSET', key, newId)
  redis.call('EXPIRE', key, ttl)

  if oldId then
    return oldId   -- trả về sessionId cũ để caller biết cần kick
  end

  return false     -- không có session cũ, vào game lần đầu
`;

@Post('play')
@UseGuards(JwtAuthGuard)
async play(@Req() req: any) {
  const { userId } = req.user;
  const gameSessionId = randomUUID();

  // Atomic: GETSET + EXPIRE trong 1 round-trip Redis
  // Không có race condition dù 2 thiết bị gọi đồng thời
  const oldSessionId = await this.redis.eval(
    PLAY_SCRIPT,
    1,
    `user:${userId}:gameSession`,
    gameSessionId,
    '86400',
  ) as string | null;

  if (oldSessionId) {
    // Session cũ tồn tại → kick WebSocket đang kết nối
    await this.wsGateway.kickSocket(userId);
  }

  return { success: true, gameSessionId };
}
```

**Tại sao dùng Lua script thay vì GET rồi SET riêng?**

```
Không atomic (sai):                    Atomic với Lua (đúng):
  oldId = GET user:{uid}:gameSession     oldId = GETSET user:{uid}:gameSession newId
  // ← thiết bị khác chen vào đây!       EXPIRE user:{uid}:gameSession 86400
  SET user:{uid}:gameSession newId
  EXPIRE user:{uid}:gameSession 86400
  // race condition → 2 session cùng tồn tại
```

### 4.3. WebSocket handleConnection

```typescript
// game/ws.gateway.ts
async handleConnection(client: Socket) {
  try {
    // Lấy token từ nhiều nơi (auth object, query param, Authorization header)
    const token =
      client.handshake.auth?.token ||
      client.handshake.query?.token ||
      client.handshake.headers?.authorization?.split(' ')[1];

    if (!token) { client.disconnect(); return; }

    // Verify JWT — xác định userId và role
    // tokenVersion KHÔNG được check ở đây vì game dùng gameSessionId làm guard
    const payload = await this.jwtService.verifyAsync(token, {
      secret: process.env.JWT_SECRET,
    });

    // gameSessionId truyền qua handshake.auth — KHÔNG nằm trong JWT
    const gameSessionId = client.handshake.auth?.gameSessionId;
    if (!gameSessionId) { client.disconnect(); return; }

    // Check gameSessionId có match với session active của user không
    // → Cơ chế 1-1: chỉ đúng "vé" mới được vào
    const currentGameSessionId = await this.redis.get(
      `user:${payload.userId}:gameSession`
    );
    if (currentGameSessionId !== gameSessionId) {
      client.disconnect(); // Session đã bị thay thế hoặc đã expired
      return;
    }

    client.data.user = { ...payload, gameSessionId };

    // Load state, join room, emit snapshot...
  } catch (e) {
    client.disconnect();
  }
}
```

### 4.4. Kick WebSocket

```typescript
// game/ws.gateway.ts
async kickSocket(userId: string) {
  // Room Game:{userId} — mỗi user join room này khi connect
  const sockets = await this.server.in(`Game:${userId}`).fetchSockets();
  for (const socket of sockets) {
    socket.emit('force_logout', {
      reason: 'NEW_SESSION',
      message: 'Tài khoản đã đăng nhập ở thiết bị khác',
    });
    socket.disconnect(true);
  }
}

// Kick khi đổi mật khẩu
@OnEvent('auth.password_changed')
async handlePasswordChanged({ userId }: { userId: string }) {
  const sockets = await this.server.in(`Game:${userId}`).fetchSockets();
  for (const socket of sockets) {
    socket.emit('force_logout', {
      reason: 'PASSWORD_CHANGED',
      message: 'Mật khẩu đã được thay đổi, vui lòng đăng nhập lại',
    });
    socket.disconnect(true);
  }
}
```

---

## 5. Chiến lược Revoke All — So sánh các cách

### ❌ Cách 1: Blacklist toàn bộ token

**Ý tưởng:** Khi đổi pass, lấy toàn bộ JTI của user → đưa vào Redis blacklist.

**Vấn đề:**
- Multi-device → có thể hàng chục token active cùng lúc → phải track từng JTI
- Không biết JTI nào đã expired → **cron phải loop và `jwt.verify()` từng cái** → O(n) CPU
- Blacklist phình to theo số lần login

**Kết luận:** Không scalable. Cron nặng hoặc vô dụng.

---

### ❌ Cách 2: SADD Set — lưu token active, revoke = xóa khỏi set

**Ý tưởng:**
```
SADD webSession:<userId> <jti>   # login
SREM webSession:<userId> <jti>   # logout
DEL  webSession:<userId>          # đổi pass
```
Guard: nếu JTI không có trong set → từ chối.

**Vấn đề:**
- Set tích lũy JTI của token expired → data rác không tự dọn
- Cron dọn phải `jwt.verify()` từng JTI để biết cái nào hết hạn → O(n)
- Mọi request phải lookup Redis → mất lợi thế stateless của JWT

**Kết luận:** Data rác tích lũy. Cron không hiệu quả.

---

### ⚠️ Cách 3: ZADD với score = expiry timestamp

**Ý tưởng:** Sorted Set, score = unix timestamp expire:

```
ZADD webSession:<userId> <expireAt> <jti>     # login
ZREM webSession:<userId> <jti>                # logout
ZREMRANGEBYSCORE webSession:<userId> 0 <now>  # cron dọn — không cần verify!
DEL  webSession:<userId>                      # đổi pass
```

**Ưu điểm:**
- Cron dọn hiệu quả bằng `ZREMRANGEBYSCORE` — **không cần verify JWT**
- Biết chính xác token nào expired dựa vào score

**Vẫn còn vấn đề:**
- Mọi request vẫn phải lookup Redis → stateful auth
- Nếu Redis down → toàn bộ auth sập
- Phức tạp hơn cần thiết nếu chỉ cần revoke all

**Kết luận:** Tốt nhất trong nhóm stateful. Phù hợp nếu cần revoke từng token (xem phần 10).

---

### ❌ Cách 4: Overwrite token (1 user = 1 token)

**Ý tưởng:**
```
SET session:<userId> <newToken>  # ghi đè mỗi lần login
```

**Vấn đề:**
- Mâu thuẫn trực tiếp yêu cầu web n-n — login thiết bị 2 kick thiết bị 1

**Kết luận:** Loại bỏ cho web.

---

### ✅ Cách 5 (Được chọn): `tokenVersion` trong DB

**Ý tưởng cốt lõi:**

> Thay vì track từng token, ta track **thế hệ hợp lệ** của tất cả token bằng 1 số nguyên.

```
Trước đổi pass:   user.tokenVersion = 3
Token A (web):    payload.tokenVersion = 3  ✅ hợp lệ
Token B (web):    payload.tokenVersion = 3  ✅ hợp lệ

Sau đổi pass:     user.tokenVersion = 4
Token A (web):    payload.tokenVersion = 3  ❌ bị chặn (thế hệ cũ)
Token B (web):    payload.tokenVersion = 3  ❌ bị chặn
Token mới (web):  payload.tokenVersion = 4  ✅ hợp lệ
```

### So sánh tổng hợp

| Tiêu chí | Blacklist (C1) | SADD (C2) | ZADD (C3) | Overwrite (C4) | **tokenVersion (C5)** |
|---|---|---|---|---|---|
| Hỗ trợ multi-device web | ✅ | ✅ | ✅ | ❌ | ✅ |
| Revoke all khi đổi pass | ✅ | ✅ | ✅ | ✅ | ✅ |
| Cron dọn rác hiệu quả | ❌ O(n) verify | ❌ O(n) verify | ✅ ZREMRANGEBYSCORE | N/A | ✅ không cần |
| Không lookup Redis mỗi request | ❌ | ❌ | ❌ | ❌ | ✅* |
| Data tích lũy theo thời gian | ❌ | ❌ | ✅ tự dọn | ✅ | ✅ luôn nhỏ |
| Độ phức tạp implementation | Cao | Trung bình | Trung bình | Thấp | **Thấp** |
| Revoke single token | ✅ native | ✅ native | ✅ native | ❌ | ❌ cần thêm (future) |

> *tokenVersion vẫn cần 1 DB/Redis read per request, nhưng query đơn giản và cacheable.

---

## 6. Giải pháp Revoke All: tokenVersion

### 6.1. Schema DB

```sql
-- Migration: thêm 1 column INT vào bảng users
ALTER TABLE users
  ADD COLUMN token_version INT NOT NULL DEFAULT 0;
```

### 6.2. Tạo JWT với tokenVersion

```typescript
async createToken(user: User): Promise<string> {
  return this.jwtService.sign({
    userId: user.id,
    role: user.role,
    tokenVersion: user.tokenVersion,  // snapshot tại thời điểm login
  });
}
```

### 6.3. Guard validate tokenVersion

```typescript
// security/JWT/jwt-auth.guard.ts
@Injectable()
export class JwtAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractToken(request);

    // Bước 1: Verify signature + expiry (CPU only, không I/O)
    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_SECRET,
      });
    } catch {
      throw new UnauthorizedException('Token không hợp lệ hoặc đã hết hạn');
    }

    // Bước 2: Check tokenVersion — revoke all signal
    const currentVersion = await this.getTokenVersion(payload.userId);
    if (payload.tokenVersion !== currentVersion) {
      throw new UnauthorizedException('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại');
    }

    request.user = payload;
    return true;
  }

  private async getTokenVersion(userId: string): Promise<number> {
    const cacheKey = `tokenVer:${userId}`;

    try {
      const cached = await this.redis.get(cacheKey);
      if (cached !== null) return parseInt(cached, 10);
    } catch {
      // Redis lỗi → fallback thẳng DB, không để auth sập
    }

    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['tokenVersion'],
    });

    await this.redis.set(cacheKey, String(user.tokenVersion), 'EX', 30);
    return user.tokenVersion;
  }
}
```

### 6.4. Flow đổi mật khẩu

```typescript
// auth/auth.service.ts
async changePassword(userId: string, oldPassword: string, newPassword: string) {
  const user = await this.userRepository.findById(userId);

  const valid = await bcrypt.compare(oldPassword, user.password);
  if (!valid) throw new BadRequestException('Mật khẩu cũ không đúng');

  // Atomic: update password + increment tokenVersion trong 1 transaction
  await this.db.transaction(async (trx) => {
    await trx.users.update(userId, {
      password: await bcrypt.hash(newPassword, 10),
      tokenVersion: () => 'token_version + 1',
    });
  });

  // Invalidate cache ngay → không đợi 30 giây TTL
  // → Revoke có hiệu lực từ request tiếp theo
  await this.redis.del(`tokenVer:${userId}`);

  // Xóa game session → WebSocket connect mới sẽ fail gameSessionId check
  await this.redis.del(`user:${userId}:gameSession`);

  // Kick WebSocket đang kết nối
  this.eventEmitter.emit('auth.password_changed', { userId });
}
```

### 6.5. Chọn TTL hay No-TTL cho cache tokenVersion?
 
Khi cache `tokenVersion` vào Redis, có 2 cách tiếp cận. Phần này phân tích trade-off để chọn đúng.
 
---
 
#### ❌ Cách 1: No TTL (cache vĩnh viễn)
 
```typescript
await this.redis.set(cacheKey, String(user.tokenVersion));
// Không có EX → key tồn tại mãi mãi
```
 
**Vấn đề:**
 
| # | Vấn đề | Giải thích |
|---|--------|------------|
| 1 | **Key tích tụ không giới hạn** | Mỗi `userId` tạo 1 key. Hệ thống 1 triệu user → 1 triệu key không bao giờ tự xóa, Redis OOM theo thời gian |
| 2 | **Không tự sửa sai** | Nếu bước `redis.del()` sau `changePassword` bị lỗi (network blip, Redis restart), key cũ sẽ **tồn tại mãi mãi** → token đã revoke vẫn pass guard |
| 3 | **Phải tự quản lý vòng đời** | Cần cronjob dọn key của user không active → thêm complexity, dễ bug |
| 4 | **Không có safety net** | Không có cơ chế nào tự phục hồi khi cache lệch với DB |
 
---
 
#### ✅ Cách 2: TTL 5–15 phút (khuyến nghị)
 
```typescript
// security/JWT/jwt-auth.guard.ts
private async getTokenVersion(userId: string): Promise<number> {
  const cacheKey = `tokenVer:${userId}`;
 
  try {
    const cached = await this.redis.get(cacheKey);
    if (cached !== null) return parseInt(cached, 10);
  } catch {
    // Redis lỗi → fallback DB, không để auth sập
  }
 
  // Cache miss → đọc DB → ghi lại cache với TTL
  const user = await this.userRepository.findOne({
    where: { id: userId },
    select: ['tokenVersion'],
  });
 
  // TTL 5 phút: đủ để giảm tải DB, đủ ngắn để tự sửa sai
  await this.redis.set(cacheKey, String(user.tokenVersion), 'EX', 300);
  return user.tokenVersion;
}
```
 
**Tại sao TTL 5–15 phút là đủ:**
 
- **Giảm tải DB hiệu quả**: Mỗi user chỉ query DB tối đa 1 lần/5 phút, dù có hàng trăm request/phút (JWT còn hạn).
- **Tự sửa sai sau mỗi TTL cycle**: Nếu `redis.del()` sau `changePassword` bị lỗi, key cũ sẽ tự expire sau tối đa 5 phút → DB sẽ được đọc lại → version mới được cache → token cũ bị reject.
- **Redis tự dọn key**: Không cần cronjob, không lo OOM với user không active.
 
---
 
#### So sánh tổng quan
 
```
Scenario: User đổi mật khẩu → redis.del() bị lỗi mạng
                                                   
  No TTL:    [token cũ] ──── pass guard ────────────────────→ mãi mãi ❌
                                                   
  TTL 5p:   [token cũ] ── pass guard (≤5 phút) ── cache expire ── DB check ── REJECT ✅
```
 
| Tiêu chí | No TTL | TTL 5–15 phút |
|----------|--------|---------------|
| Tải DB | Thấp hơn | Thấp (1 query/TTL/user) |
| Tự sửa sai khi del() lỗi | ❌ Không | ✅ Sau mỗi TTL cycle |
| Quản lý bộ nhớ Redis | ❌ Phải tự dọn | ✅ Tự expire |
| Window revoke chậm nhất | Ngay lập tức* | ≤ TTL (5–15 phút) |
| Độ phức tạp vận hành | Cao (cần cronjob) | Thấp |
 
> *No TTL chỉ revoke ngay nếu `redis.del()` thành công 100% — điều không đảm bảo trong thực tế.
 
---
 
#### Chọn TTL bao nhiêu?
 
```typescript
// Gợi ý theo use case
const TTL = {
  // App thông thường: chấp nhận window 5 phút
  standard: 300,       // 5 phút
 
  // App tài chính / nhạy cảm: window ngắn hơn, tải DB cao hơn một chút  
  sensitive: 60,       // 1 phút
 
  // Game realtime: token check mỗi WS message → cần cache dài hơn
  realtime: 900,       // 15 phút (WS guard tách riêng, HTTP guard dùng TTL ngắn hơn)
};
```
 
**Nguyên tắc chọn TTL = thời gian bạn chấp nhận token đã revoke vẫn còn hiệu lực trong worst case** (khi `redis.del()` thất bại). Với hầu hết hệ thống, **5 phút là điểm cân bằng tốt nhất**.

> 💡 **Lưu ý:** TTL không phải là độ trễ bắt buộc sau mỗi lần đổi mật khẩu — trong happy path,
> `redis.del()` thành công ngay và revoke có hiệu lực từ request tiếp theo. TTL chỉ là
> **thời gian tự sửa sai trong worst case** (khi invalidate cache thất bại): sau tối đa TTL giây,
> cache tự expire, guard đọc lại DB, token cũ bị reject. Đây là sự đánh đổi có chủ đích giữa
> **Eventual Consistency** (cache sẽ đồng nhất với DB sau ≤ TTL, không phải ngay lập tức) và
> **read throughput** (DB chỉ bị query tối đa 1 lần/TTL/user thay vì mỗi request).
>
> Thực ra hệ thống này đảm bảo cả hai consistency model: **Read-your-writes** — chính user vừa
> đổi mật khẩu sẽ thấy hiệu lực revoke ngay lập tức (cache miss → đọc DB → version mới → reject),
> và **Eventual Consistency (bounded staleness)** — các session/device khác của cùng user sẽ bị
> revoke sau tối đa TTL, hoặc tự sửa trong worst case khi `redis.del()` thất bại.
---

## 7. Caching & Performance

### 7.1. Cache tokenVersion

Mỗi REST request cần check `tokenVersion`. Nếu không cache, mỗi request = 1 DB query → bottleneck với traffic cao.

```typescript
private readonly TOKEN_VERSION_CACHE_TTL = 30; // giây

async getTokenVersion(userId: string): Promise<number> {
  const cacheKey = `tokenVer:${userId}`;

  try {
    const cached = await this.redis.get(cacheKey);
    if (cached !== null) return parseInt(cached, 10);
  } catch {
    // Redis lỗi → fallback DB (không để auth sập)
  }

  const user = await this.userRepository.findOne({
    where: { id: userId },
    select: ['tokenVersion'],
  });

  await this.redis.set(cacheKey, String(user.tokenVersion), 'EX', TOKEN_VERSION_CACHE_TTL);
  return user.tokenVersion;
}
```

**Trade-off của cache 30 giây:**

```
Nếu KHÔNG invalidate cache sau đổi pass:
  → Tối đa 30 giây token cũ vẫn còn hiệu lực ⚠️

Với DEL cache ngay trong changePassword():
  → Cache bị xóa tức thì
  → Request tiếp theo miss cache → query DB → lấy version mới
  → Revoke có hiệu lực từ request đầu tiên sau khi đổi pass ✅
```

### 7.2. Latency profile mỗi request

```
[Web Request — cache hit (99% trường hợp)]
  jwt.verify()           ~0.1ms   (CPU only)
  redis.get(tokenVer)    ~0.5ms   (cache hit)
  ──────────────────────────────
  Total auth overhead    ~0.6ms   ✅

[Web Request — cache miss (sau invalidate hoặc cold start)]
  jwt.verify()           ~0.1ms
  db.findOne(userId)     ~2-5ms
  redis.set(tokenVer)    ~0.3ms
  ──────────────────────────────
  Total auth overhead    ~3-5ms   ✅

[Game WebSocket connect]
  jwt.verifyAsync()      ~0.1ms
  redis.get(gameSession) ~0.5ms
  ──────────────────────────────
  Total auth overhead    ~0.6ms   ✅
```

---

## 8. Các trigger revoke — Ma trận đầy đủ

```
╔══════════════════════════════╦══════════════════╦═══════════════════╦═══════════════════════╗
║ Trigger                      ║ Web tokens       ║ Game session      ║ Game WebSocket        ║
╠══════════════════════════════╬══════════════════╬═══════════════════╬═══════════════════════╣
║ POST /game/play              ║ Không ảnh hưởng  ║ GETSET overwrite  ║ Kick session cũ ngay  ║
║ (thiết bị mới vào game)      ║                  ║ (Lua atomic)      ║ kickSocket(userId)    ║
╠══════════════════════════════╬══════════════════╬═══════════════════╬═══════════════════════╣
║ Đổi mật khẩu                 ║ Revoke tất cả    ║ DEL gameSession   ║ Kick ngay lập tức     ║
║                              ║ (tokenVersion++) ║                   ║ (OnEvent emit)        ║
╠══════════════════════════════╬══════════════════╬═══════════════════╬═══════════════════════╣
║ Ban tài khoản                ║ Revoke tất cả    ║ DEL gameSession   ║ Kick ngay lập tức     ║
║                              ║ (tokenVersion++) ║                   ║ (OnEvent emit)        ║
╠══════════════════════════════╬══════════════════╬═══════════════════╬═══════════════════════╣
║ Token hết hạn tự nhiên       ║ JWT exp tự xử lý ║ Redis TTL 86400s  ║ verifyAsync fail      ║
║                              ║                  ║ tự dọn            ║ → disconnect          ║
╚══════════════════════════════╩══════════════════╩═══════════════════╩═══════════════════════╝
```

> Logout đơn lẻ (revoke 1 token web cụ thể) hiện chưa implement. Xem phần 10.

---

## 9. Tóm tắt quyết định kiến trúc

### Kiến trúc hiện tại

```
┌─────────────────────────────────────────────────────────────┐
│                      AUTH ARCHITECTURE                       │
│                                                             │
│  JWT Payload:  { userId, role, tokenVersion, iat, exp }    │
│                                                             │
│  [Web REST API]                                             │
│    Guard:       jwt.verify() → check tokenVersion          │
│    Revoke ALL → tokenVersion++  +  DEL tokenVer cache      │
│                                                             │
│  [Game]                                                     │
│    Vào game  → POST /game/play (JWT) → nhận gameSessionId  │
│    1-1 kick  → Lua GETSET atomic → kickSocket()            │
│    WS Auth   → JWT verify + gameSessionId match            │
│    Redis key: user:{userId}:gameSession  (TTL 86400s)      │
│                                                             │
│  [Revoke All — đổi pass / ban]                              │
│    1. tokenVersion++          → JWT cũ bị chặn tức thì    │
│    2. DEL tokenVer:{userId}   → cache invalidate ngay      │
│    3. DEL user:{uid}:gameSession → game guard từ chối      │
│    4. emit('auth.password_changed') → kick WebSocket       │
└─────────────────────────────────────────────────────────────┘
```

### Tại sao thiết kế này đúng

**tokenVersion** giải quyết revoke all vì nó thay đổi *điều kiện hợp lệ* thay vì track từng token. Token cũ không sai về chữ ký — chỉ sai về *thế hệ*. 1 DB UPDATE làm vô hiệu hóa tất cả token cũ, không cần biết có bao nhiêu token, không tích lũy data.

**gameSessionId tách khỏi JWT** vì hai thứ có lifecycle khác nhau hoàn toàn: JWT sống 7 ngày và không đổi, game session được tạo mới mỗi lần `play`. Nhét chúng vào chung là sai về trách nhiệm — JWT sẽ phải regenerate mỗi lần vào game.

**Lua GETSET atomic** đảm bảo không có race condition khi 2 thiết bị cùng gọi `/game/play` đồng thời — chỉ 1 cái thắng, cái kia bị kick, không có trạng thái trung gian mà cả 2 đều nghĩ mình thắng.

### Đánh đổi còn lại

```
⚠️  Mỗi request cần ~0.5ms Redis lookup (tokenVersion)
    → Chấp nhận được. Cache hit gần như không đáng kể.

⚠️  Nếu Redis down và không có fallback DB:
    → Cache miss → query DB trực tiếp → auth vẫn hoạt động
    → Chỉ chậm hơn ~3ms, không sập

⚠️  Hiện chưa có logout đơn lẻ (revoke 1 token web cụ thể)
    → Xem phần 10 (Future)
```

---

## 10. Future: Revoke Single Token (Logout đơn lẻ)

> **Trạng thái:** Chưa implement. Đây là thiết kế dự kiến khi cần tính năng logout từng thiết bị riêng lẻ.

### Bài toán

```
tokenVersion chỉ giải quyết revoke ALL.

User có 3 thiết bị: Phone, Laptop, Tablet
→ User muốn logout Laptop mà không ảnh hưởng Phone và Tablet
→ tokenVersion++ sẽ kick cả 3 → không phù hợp
```

### Giải pháp dự kiến: JTI Blacklist

Thêm field `jti` (UUID v4) vào JWT payload. Khi logout 1 thiết bị, đưa JTI vào Redis blacklist với TTL = thời gian còn lại của token.

```typescript
// Bổ sung jti vào payload khi implement
interface JwtPayload {
  userId: string;
  role: string;
  tokenVersion: number;
  jti: string;  // thêm mới — unique per token
}

// Tạo token
const payload = {
  userId: user.id,
  role: user.role,
  tokenVersion: user.tokenVersion,
  jti: randomUUID(),
};

// Logout đơn lẻ
async logout(token: string): Promise<void> {
  const payload = this.jwtService.decode(token) as JwtPayload;
  const now = Math.floor(Date.now() / 1000);
  const remainingTtl = payload.exp - now;

  if (remainingTtl > 0) {
    // TTL = remaining lifetime → Redis tự xóa khi token hết hạn
    // → Không tích lũy data rác, không cần cron
    await this.redis.set(`blacklist:${payload.jti}`, '1', 'EX', remainingTtl);
  }
}

// Guard: thêm check sau tokenVersion check
const isBlacklisted = await this.redis.get(`blacklist:${payload.jti}`);
if (isBlacklisted) {
  throw new UnauthorizedException('Token đã bị thu hồi');
}
```

**Tại sao JTI Blacklist ở đây không bị vấn đề data tích lũy** (khác với Cách 1 ở phần 5):

```
Cách 1 — Lưu tất cả JTI active để revoke all:
  → Phải track TẤT CẢ JTI của user → set phình to
  → Không biết cái nào expired → cron phải verify từng cái → O(n)

JTI Blacklist cho logout đơn lẻ:
  → Chỉ lưu JTI bị CHỦ ĐỘNG logout (rất ít so với tổng số token)
  → TTL = remaining lifetime → Redis tự xóa sau khi token hết hạn dù sao
  → Không cần cron, không tích lũy
```

### Khi nào nên implement

- Khi có UI "quản lý thiết bị đang đăng nhập" (xem danh sách, logout từng cái)
- Khi security requirement yêu cầu immediate revoke per-device
- Hiện tại `tokenVersion` đã đủ cho các usecase quan trọng: đổi mật khẩu, ban tài khoản