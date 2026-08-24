# Tài liệu thiết kế: Migration từ TCP WebSocket sang Go UDP Server

> **Mục đích:** Ghi lại toàn bộ quá trình phân tích, tư duy thiết kế, các hướng đã xem xét và quyết định cuối cùng khi bổ sung Go UDP Server vào stack hiện tại.
>
> **Người viết:** DANG-PH.

---

## Mục lục

1. [Stack hiện tại và lý do cần thay đổi](#1-stack-hiện-tại-và-lý-do-cần-thay-đổi)
2. [Vấn đề cốt lõi: TCP Head-of-Line Blocking](#2-vấn-đề-cốt-lõi-tcp-head-of-line-blocking)
3. [Tại sao UDP không bị HOL blocking](#3-tại-sao-udp-không-bị-hol-blocking)
4. [Khó khăn khi chuyển sang UDP: Vấn đề Auth](#4-khó-khăn-khi-chuyển-sang-udp-vấn-đề-auth)
5. [Tại sao TCP không bị vấn đề auth mà UDP lại bị](#5-tại-sao-tcp-không-bị-vấn-đề-auth-mà-udp-lại-bị)
6. [Các hướng giải quyết auth cho UDP](#6-các-hướng-giải-quyết-auth-cho-udp)
7. [Hướng đã chốt và lý do](#7-hướng-đã-chốt-và-lý-do)
8. [Thiết kế Go UDP Server chi tiết](#8-thiết-kế-go-udp-server-chi-tiết)
9. [Tích hợp với stack hiện tại](#9-tích-hợp-với-stack-hiện-tại)
10. [Bài học và lưu ý cho dev](#10-bài-học-và-lưu-ý-cho-dev)
11. [Tham khảo](#11-tham-khảo)

---

## 1. Stack hiện tại và lý do cần thay đổi

### Stack hiện tại (trước migration)

```
Client (Mobile/.exe)
    │
    ├─ NestJS + SocketIO + Redis Adapter   ← business logic, trade, inventory
    │   └─ JSON protocol
    │
    └─ Go + WebSocket TCP thuần            ← hot path game loop
        └─ Custom binary protocol
            └─ NATS (message bus nội bộ)
```

### Tại sao stack này đã solid

NestJS + SocketIO đảm nhận đúng vai trò: các action cần **reliable delivery** như trade, mua đồ, gọi rồng, chat. Những thứ này mất packet là vấn đề nghiêm trọng — TCP là đúng.

Go + WebSocket TCP thuần với binary protocol là bước tối ưu đúng hướng so với JSON:
- Binary nhỏ hơn JSON ~3-5x
- Không cần parse text
- Custom protocol kiểm soát hoàn toàn frame format
- `SetNoDelay(true)` tắt Nagle algorithm, gửi packet ngay

### Vấn đề vẫn còn với TCP

Dù đã tắt Nagle và dùng binary, TCP vẫn có một vấn đề cơ bản không giải quyết được ở application layer: **head-of-line blocking**.

Game sau này định phát triển thêm combat system — nhân vật đánh nhau real-time, sync position 60Hz. Đây là thứ TCP bắt đầu gây ra vấn đề thực sự.

---

## 2. Vấn đề cốt lõi: TCP Head-of-Line Blocking

### HOL Blocking là gì

```
Server gửi liên tiếp:
Packet #47 (position t=0ms)
Packet #48 (position t=16ms)
Packet #49 (position t=32ms)
Packet #50 (position t=48ms)

→ Packet #47 bị drop trên network

TCP behavior:
- Packet #48, #49, #50 đến client → TCP BUFFER LẠI, không deliver lên app
- Chờ server retransmit #47
- RTT trung bình 50-100ms → game freeze 50-100ms
- #47 đến → TCP flush hết #47, #48, #49, #50 cùng lúc lên app
- App xử lý 4 frame trong 1 frame → nhân vật teleport / rubber-band
```

### Tại sao SetNoDelay không giải quyết được

`SetNoDelay(true)` chỉ tắt Nagle algorithm — thứ gây delay khi buffer data trước khi gửi. Nagle là vấn đề **sender-side**.

HOL blocking là vấn đề **receiver-side** — nằm trong TCP stack của OS, không config được từ application.

### Tác động thực tế theo điều kiện mạng

| Điều kiện | TCP + NoDelay | UDP |
|---|---|---|
| Mạng ổn định (0% loss) | ~15ms | ~12ms |
| 1% packet loss | ~50-100ms | ~15ms |
| 5% packet loss | ~150-300ms (stutter) | ~18ms |
| Mobile đổi mạng | Reconnect 1-3s | Re-register UDP session |

Ở mạng ổn định, TCP và UDP gần như bằng nhau. Sự khác biệt chỉ thực sự rõ khi có packet loss — đây là điều kiện thường xuyên trên mobile.

---

## 3. Tại sao UDP không bị HOL blocking

### Bản chất UDP

UDP là connectionless, không có guarantee:
- Không ordered delivery
- Không reliable delivery
- Không retransmit
- Không buffer chờ

```
Server gửi:
Packet #47 (position t=0ms)
Packet #48 (position t=16ms)

→ Packet #47 bị drop

UDP behavior:
- Packet #48 đến → deliver NGAY lên app, không chờ #47
- App biết #47 bị miss → dùng interpolation để smooth
- #47 không đến không sao — position cũ đã stale, bỏ luôn
```

### Tại sao game chấp nhận được packet loss

Với **position update** (60Hz): packet 16ms trước mà miss thì bỏ luôn, dùng dead-reckoning predict. Không ai nhận ra sự khác biệt.

Với **damage/skill**: vẫn cần reliable → dùng TCP/WebSocket (NestJS) cho những action này. **Không phải mọi thứ đều cần UDP**.

### Nguyên tắc thiết kế

```
Unreliable, latency-sensitive (position, input 60Hz)  → UDP
Reliable, correctness-critical (combat result, trade)  → TCP WebSocket
```

Đây chính xác là lý do giữ nguyên NestJS + SocketIO cho business logic trong khi thêm Go UDP cho hot path.

---

## 4. Khó khăn khi chuyển sang UDP: Vấn đề Auth

### Với TCP WebSocket — auth dễ dàng

```go
func (s *Server) doHandshake(c *Conn) error {
    // Verify JWT + gameSessionId 1 lần duy nhất
    authResult, err := s.auth.Verify(ctx, hs.Token, hs.GameSessionID, hs.UserID)
    c.SetUserID(authResult.UserID)
    // Sau đây mọi message đều biết đây là userId X
    // Không cần verify lại
}
```

TCP connection chính là identity. Connection còn sống → user còn được xác thực. OS đảm bảo không ai inject vào connection của người khác.

### Với UDP — không có connection state

```
TCP:  Client ──[TCP connection]──────────── Server
                ^ connection này = identity

UDP:  Client ──[packet]──► Server   ← packet 1
      Client ──[packet]──► Server   ← packet 2 (server không biết 2 cái cùng người)
      Attacker ─[packet]─► Server   ← ai cũng gửi được đến port này
```

Server nhận raw bytes từ `(IP, port)`. Không có gì "gắn" các packet lại với nhau. Attacker có thể gửi packet đến server UDP port bất kỳ lúc nào.

### Câu hỏi then chốt

Mỗi UDP packet đến, server cần biết:
1. **Identity**: packet này của userId nào?
2. **Anti-replay**: packet này có phải đã thấy rồi không?

---

## 5. Tại sao TCP không bị vấn đề auth mà UDP lại bị

| | TCP WebSocket | UDP |
|---|---|---|
| Connection state | Có — OS quản lý | Không có |
| Identity | TCP connection = identity | Phải tự carry trong packet |
| Auth | 1 lần lúc handshake | Phải có mechanism riêng |
| Packet ordering | OS đảm bảo | Không đảm bảo |
| Inject từ bên ngoài | Không thể | Có thể (bất kỳ ai gửi đến port) |

TCP là stateful ở tầng OS. UDP là stateless — application phải tự quản lý state.

---

## 6. Các hướng giải quyết auth cho UDP

### Hướng 1: Gửi JWT trong mỗi packet

```
Packet: [JWT: 200-500B][payload]
```

**Bị loại vì:**
- JWT dài 200-500 bytes, overhead quá lớn
- Verify JWT (HMAC-SHA256 hoặc RSA) mỗi packet → 60,000 verify/giây ở 1000 CCU
- CPU không chịu nổi

### Hướng 2: Dùng DTLS (Datagram TLS)

TLS nhưng chạy trên UDP. Library: `pion/dtls`.

```
DTLS handshake → sau đó mọi packet encrypted + authenticated
Server biết packet từ ai vì DTLS session
```

**Không chọn vì:**
- Complexity cao — DTLS handshake nhiều round-trip
- Mobile thay đổi IP → DTLS session drop, phải handshake lại
- Overhead mỗi packet vẫn còn (DTLS record header)
- Với client `.exe` bị crack được → encryption vô nghĩa

### Hướng 3: QUIC

UDP + TLS 1.3 built-in, Connection ID không phụ thuộc IP:port.

**Không chọn ngay vì:**
- Over-engineering cho giai đoạn hiện tại
- Client SDK support hạn chế (Unity, mobile)
- Sẽ xem xét trong tương lai nếu scale cần thiết

### Hướng 4: HMAC per-packet với sessionKey

```
Packet: [clientID: 4B][seq: 4B][payload][HMAC-8: 8B]
HMAC = HMAC-SHA256(sessionKey, packet_without_hmac)[:8]
```

**Bị loại vì:**
- Client là `.exe` → attacker dump memory → lấy được `sessionKey`
- Tự tính HMAC hợp lệ → HMAC vô nghĩa hoàn toàn
- Security theater — trông an toàn nhưng không có giá trị thực

### Hướng 5 (Đã chốt): UDP handshake HTTP + clientID + sequence number

Đây là pattern chuẩn được dùng trong production games (netcode.io, Valve SDR).

---

## 7. Hướng đã chốt và lý do

### Insight quan trọng nhất

Với game client là `.exe`, **không có cơ chế nào ở transport layer thực sự bảo vệ được** nếu attacker có thể crack client. Bảo vệ thực sự nằm ở **server-side authoritative validation** — không tin bất kỳ input nào từ client, tự validate game logic.

Vậy ở transport layer, chỉ cần giải quyết 2 thứ:

1. **Identity**: packet này của ai → dùng `clientID` uint32 làm key lookup RAM
2. **Anti-replay**: packet đã thấy rồi chưa → sliding window trên sequence number

### Tại sao dùng clientID uint32 thay vì gameSessionId string

`gameSessionId` là UUID string 36 bytes. Nếu carry trong mỗi packet:

```
[gameSessionId: 36B][seqNum: 4B][payload: 20B] = 60B
→ 60% packet là identifier

[clientID: 4B][seqNum: 4B][payload: 20B] = 28B
→ 14% overhead
```

Ở 60 packet/giây × 1000 CCU = 60,000 packet/giây, tiết kiệm 32 bytes/packet = **~1.9 MB/giây bandwidth**.

Ngoài ra:
- Integer map lookup O(1) nhanh hơn string map lookup
- Dễ shard theo `clientID % numShards` để tránh lock contention
- `gameSessionId` là concept của NestJS game session, không phải UDP connection — một game session có thể có nhiều lần reconnect UDP

### Tại sao giữ gameSessionId trong session object

`gameSessionId` vẫn cần để:
- Verify lúc `/udp-register` (check Redis khớp với session NestJS đang active)
- Push game state về đúng SocketIO room bên NestJS

Nó là bridge giữa 2 hệ thống, không phải identifier cho mỗi packet.

---

## 8. Thiết kế Go UDP Server chi tiết

### Flow tổng thể

```
Phase 1: NestJS (đã có, không sửa)
─────────────────────────────────
Client → POST /play (JWT)
NestJS: GETSET Redis "user:{userId}:gameSession" = newUUID (atomic)
        emit kick_socket nếu có session cũ
Return: { gameSessionId }

Phase 2: UDP Handshake (thêm mới trên Go, 1 lần)
─────────────────────────────────────────────────
Client → Go: POST /udp-register
Body: { JWT, gameSessionId }

Go:
  1. Verify JWT → lấy userId (parse HMAC-SHA256, cùng secret với NestJS)
  2. GET Redis "user:{userId}:gameSession" → verify khớp gameSessionId
  3. Sinh clientID = atomic.AddUint32(&counter, 1)
  4. Cache RAM:
     sessions[clientID] = {
         userId:        int32
         gameSessionId: string
         addr:          *net.UDPAddr
         lastSeen:      time.Time
         recvSeqMax:    uint32
         recvWindow:    uint64   // bitmask sliding window 64 packet
     }
  5. Return: { clientID: uint32 }

Phase 3: UDP Gameplay (hot path, mỗi packet)
────────────────────────────────────────────
Packet format:
┌────────────┬──────────┬──────────┬──────────────┐
│ clientID   │ seqNum   │ msgType  │ payload      │
│ 4 bytes    │ 4 bytes  │ 1 byte   │ N bytes      │
└────────────┴──────────┴──────────┴──────────────┘

Go nhận packet:
  1. Đọc clientID (4 bytes đầu) → lookup sync.Map → O(1)
  2. Check seqNum sliding window → chống replay
  3. Update lastSeen
  4. Đưa vào per-client worker queue
  5. Worker: validate game logic → apply state → push RabbitMQ
  6. NestJS nhận từ RabbitMQ → broadcast SocketIO
```

### Session Management

```go
type Session struct {
    UserID        int32
    GameSessionID string
    Addr          *net.UDPAddr

    // Anti-replay sliding window
    recvSeqMax  uint32
    recvWindow  uint64  // bit i = đã thấy packet (recvSeqMax - i)
    lastSeen    time.Time
    mu          sync.Mutex
}

func (s *Session) checkAndUpdateSeq(seq uint32) bool {
    s.mu.Lock()
    defer s.mu.Unlock()

    if seq > s.recvSeqMax {
        shift := seq - s.recvSeqMax
        if shift >= 64 {
            s.recvWindow = 0
        } else {
            s.recvWindow <<= shift
        }
        s.recvSeqMax = seq
        s.recvWindow |= 1
        return true
    }

    diff := s.recvSeqMax - seq
    if diff >= 64 { return false }              // quá cũ → drop
    if s.recvWindow&(1<<diff) != 0 { return false } // đã thấy → replay
    s.recvWindow |= (1 << diff)
    return true
}
```

### Per-client Worker Pool (tránh HOL blocking ở application layer)

Đây là điểm quan trọng bị bỏ qua: nếu xử lý packet tuần tự trong readLoop, một packet nặng (collision detection, pathfinding) block toàn bộ packet khác — tương đương HOL blocking của TCP nhưng tự tạo ra.

```go
type WorkerPool struct {
    // Mỗi clientID có 1 channel riêng
    // → order được đảm bảo PER CLIENT
    // → client A lag không ảnh hưởng client B
    queues sync.Map // map[uint32]chan Packet
}

func (p *WorkerPool) Submit(clientID uint32, pkt Packet) {
    v, ok := p.queues.Load(clientID)
    if !ok { return }

    q := v.(chan Packet)
    select {
    case q <- pkt:
        // OK
    default:
        // Queue đầy → drop packet cũ nhất
        // Game input cũ không còn value → drop là đúng
        // QUAN TRỌNG: không block readLoop
    }
}
```

### Sliding window anti-replay — tại sao quan trọng

Đây là thứ duy nhất có giá trị thực tế với `.exe` client về mặt security network:

**Scenario không có sliding window:**
```
Attacker capture packet hợp lệ từ player A:
Packet: [clientID=1][seq=100][ATTACK][target=B]

Gửi lại 100 lần → player B bị tấn công 100 lần
Server không phân biệt được
```

**Với sliding window:**
```
Lần 1: seq=100 → chưa thấy → ACCEPT, đánh dấu đã thấy
Lần 2-100: seq=100 → đã thấy → DROP
```

### Session cleanup (tránh memory leak)

```go
// Goroutine dọn session inactive
func (s *UDPServer) cleanupLoop() {
    ticker := time.NewTicker(30 * time.Second)
    for range ticker.C {
        now := time.Now()
        s.sessions.Range(func(k, v any) bool {
            sess := v.(*Session)
            if now.Sub(sess.lastSeen) > 5*time.Minute {
                s.sessions.Delete(k)
                s.workerPool.RemoveClient(k.(uint32))
            }
            return true
        })
    }
}
```

---

## 9. Tích hợp với stack hiện tại

### NestJS không cần sửa gì (trừ 1 điểm nhỏ)

Code NestJS hiện tại đã solid:

```typescript
// /play đã có: atomic GETSET, kick session cũ, redlock
// WsGateway đã có: verify JWT + gameSessionId, check Redis

// Chỉ cần thêm: Go cần biết JWT_SECRET để verify
// → share qua environment variable (đã có sẵn)
```

Redis key pattern Go dùng giống hệt NestJS:
```
user:{userId}:gameSession  ← Go đọc key này để verify
```

### Go → NestJS: push game state

```go
// Go publish sau khi xử lý game input
type GameStateEvent struct {
    GameSessionID string      `json:"gameSessionId"`
    Tick          uint32      `json:"tick"`
    Players       []PlayerState `json:"players"`
}

// Dùng RabbitMQ đã có (RABBIT_GAME_SERVICE)
ch.Publish("", "game.state_update", false, false,
    amqp.Publishing{Body: json.Marshal(event)})
```

```typescript
// NestJS consume và broadcast
@EventPattern('game.state_update')
async handleGameState(data: GameStateEvent) {
    this.server
        .to(data.gameSessionId)
        .emit('game:state', data);
}
```

### Architecture sau migration

```
Client (.exe / Mobile)
    │
    ├─ REST: POST /play (JWT) ──────────────► NestJS
    │                                              │
    │◄──── { gameSessionId } ─────────────────────┘
    │
    ├─ HTTP: POST /udp-register ────────────► Go UDP Server
    │  { JWT, gameSessionId }                      │
    │◄──── { clientID: uint32 } ───────────────────┘
    │
    ├═══ WebSocket TCP ════════════════════► Go WS Server (giữ nguyên)
    │    binary protocol                           │
    │    reliable actions                          │ NATS
    │                                              │
    ├═══ SocketIO ═════════════════════════► NestJS ◄────────────────┐
    │    trade, inventory, chat                    │                  │
    │    game state broadcast ◄────────────────────┘             RabbitMQ
    │                                                                 │
    └═══ UDP ══════════════════════════════► Go UDP Server ──────────┘
         [clientID:4][seq:4][type:1][payload]
         position sync, combat input (60Hz)
```

---

## 10. Bài học và lưu ý cho dev

### 1. SetNoDelay không giải quyết được HOL blocking

Nhiều dev nghĩ tắt Nagle là xong. Không phải. Nagle là sender-side buffering. HOL blocking là receiver-side TCP stack behavior. Hai vấn đề khác nhau hoàn toàn.

### 2. UDP auth không cần phức tạp như tưởng

Với client `.exe`, mọi crypto ở client đều bị crack được. DTLS, HMAC, connect token — tất cả đều vô nghĩa nếu attacker có thể dump memory.

Thứ thực sự cần ở transport layer chỉ là:
- **Identity**: clientID uint32 lookup RAM
- **Anti-replay**: sequence number + sliding window

Bảo vệ thực sự nằm ở server-side validation logic, không phải crypto.

### 3. Tại sao dùng clientID thay vì gameSessionId hay udpToken

| Identifier | Overhead/packet | Lookup | Semantic |
|---|---|---|---|
| gameSessionId (UUID) | 36 bytes | String hash | NestJS concept, không phải UDP |
| udpToken (random) | 16-32 bytes | String hash | Thêm round-trip không cần thiết |
| clientID (uint32) | 4 bytes | Integer O(1) | Đúng với UDP session |

### 4. Per-client worker queue — đừng bỏ qua

Nếu xử lý packet trong single goroutine, bạn tự tạo ra HOL blocking ở application layer. Mỗi client cần worker riêng với bounded queue. Drop policy khi queue đầy là đúng — game input cũ không có value.

### 5. Sequence number sliding window là thứ duy nhất có giá trị thực tế

Replay attack (record packet rồi gửi lại) là attack khả thi từ network mà không cần crack `.exe`. Sliding window 64-bit là đủ — cheap, hiệu quả.

### 6. Không phải mọi thứ đều cần UDP

```
Cần UDP:
- Position sync 60Hz
- Player input (di chuyển, attack direction)
- Real-time combat state

Cần TCP (giữ NestJS WebSocket):
- Combat result (damage number, kill)
- Trade, inventory
- Skill cast result
- Bất kỳ thứ gì mà mất packet = bug
```

### 7. Tham chiếu thực tế từ production

**Valve Steam Datagram Relay (SDR):** Dùng relay ticket có time limit, issued bởi game coordinator. Ticket authorize một client kết nối vào một server cụ thể trong thời gian nhất định. Tất cả traffic qua relay đều authenticated và rate-limited.

**netcode.io (Glenn Fiedler — Titanfall):** Connect token từ web backend, server-assigned client index, encrypted per-packet. Chuẩn de-facto cho indie và mid-size game.

**Riot Games (Valorant/LoL):** Authoritative dedicated server per match. Client chỉ gửi input, server simulate và broadcast kết quả. Không tin bất kỳ game state nào từ client.

**Chung:** Không có studio lớn nào dùng crypto phức tạp ở từng UDP packet với `.exe` client. Họ đầu tư vào server-side authoritative logic.

---

## 11. Tham khảo

- **netcode protocol standard** — Glenn Fiedler: https://github.com/mas-bandwidth/netcode/blob/main/STANDARD.md
- **Steam Datagram Relay** — Valve: https://partner.steamgames.com/doc/features/multiplayer/steamdatagramrelay
- **GameNetworkingSockets** — Valve open source: https://github.com/ValveSoftware/GameNetworkingSockets
- **Building a Game Network Protocol** — Glenn Fiedler (series): https://gafferongames.com/post/udp_vs_tcp/
- **TCP Head-of-Line Blocking** — High Performance Browser Networking (O'Reilly): https://hpbn.co/building-blocks-of-tcp/
- **Peeking into Valorant's Netcode** — Riot Games Engineering Blog
- **Game Networking Resources** (curated list): https://github.com/gafferongames/GameNetworkingResources

---

*Tài liệu này phản ánh quyết định thiết kế tại thời điểm 2026. Khi game scale lên hoặc có thêm yêu cầu (cross-region, anti-cheat nghiêm túc hơn), cần xem xét lại QUIC hoặc DTLS.*