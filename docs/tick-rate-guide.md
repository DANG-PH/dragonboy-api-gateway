# Game Service Go — Tài Liệu Kỹ Thuật WebSocket Layer

> Tài liệu này ghi lại kiến trúc, thiết kế và các quyết định kỹ thuật của WebSocket layer trong game 2D MMORPG dạng Ngọc Rồng Online. Code viết bằng Go, dùng custom binary protocol + NATS.

---

## Mục Lục

1. [Tổng quan kiến trúc](#1-tổng-quan-kiến-trúc)
2. [Connection Lifecycle — Từ TCP đến Game State](#2-connection-lifecycle--từ-tcp-đến-game-state)
3. [Binary Protocol — Tại sao và như thế nào](#3-binary-protocol--tại-sao-và-như-thế-nào)
4. [Two-Phase Tick Rate — Trái tim của hệ thống](#4-two-phase-tick-rate--trái-tim-của-hệ-thống)
5. [State Management — MapState và Manager](#5-state-management--mapstate-và-manager)
6. [Cross-Instance Messaging — Redis Bus vs NATS Bus](#6-cross-instance-messaging--redis-bus-vs-nats-bus)
7. [Hub — Bộ não trung tâm](#7-hub--bộ-não-trung-tâm)
8. [O(N²) → O(N) — Batch Broadcast Optimization](#8-on²--on--batch-broadcast-optimization)
9. [Goroutine Pool Pattern](#9-goroutine-pool-pattern)
10. [Security — Handshake, Auth và Rate Limiting tự nhiên](#10-security--handshake-auth-và-rate-limiting-tự-nhiên)
11. [Concurrency Patterns trong codebase này](#11-concurrency-patterns-trong-codebase-này)
12. [Double-Check Locking — Pattern quan trọng](#12-double-check-locking--pattern-quan-trọng)
13. [Go Syntax Guide — Những thứ khó hiểu](#13-go-syntax-guide--những-thứ-khó-hiểu)
14. [Metrics & Monitoring](#14-metrics--monitoring)
15. [Checklist cho Developer](#15-checklist-cho-developer)
16. [Khi nào cần refactor tiếp?](#16-khi-nào-cần-refactor-tiếp)
17. [Tóm tắt các quyết định thiết kế](#17-tóm-tắt-các-quyết-định-thiết-kế)

---

## 1. Tổng quan kiến trúc

```
Client (LibGDX)           Go Game Service                  Other Instances
───────────────           ───────────────                  ───────────────

[TCP connect]
    │
    │ HTTP Upgrade
    ▼
┌──────────┐
│  Server  │ ← http.Handler (Duck Typing)
│ ServeHTTP│
└────┬─────┘
     │ doHandshake()   ← 5s deadline, chống slowloris
     │ verify JWT + sessionID
     ▼
┌──────────┐   register()    ┌──────────────────────┐
│   Conn   │ ──────────────► │         Hub          │
│ readLoop │                 │  connsByUser map      │
│ writeLoop│                 │  roomsByMap  map      │
└──────────┘                 └──────┬──────────┬────┘
     │                              │          │
     │ PlayerMove                   │ Broadcast│ Publish
     ▼                              ▼          ▼
┌──────────┐  UpdateFromMove  ┌─────────┐  ┌──────────┐
│ Handler  │ ────────────────►│ Manager │  │ NATSBus  │
│          │                  │ MapState│  │ (or Redis│
└──────────┘                  └────┬────┘  │  Bus)    │
                                   │       └──────────┘
                               ┌───┴────┐       │
                               │ Ticker │       │ cross-instance
                               │  20Hz  │       ▼
                               └───┬────┘  ┌──────────┐
                                   │       │ Instance │
                                   │ Batch │   B, C   │
                                   └───────►  (their  │
                                           │  clients)│
                                           └──────────┘
```

### Các component chính

| Component | File | Trách nhiệm |
|---|---|---|
| `Server` | `server.go` | HTTP → WebSocket upgrade, handshake |
| `Conn` | `conn.go` | Quản lý 1 WebSocket connection (readLoop/writeLoop) |
| `Hub` | `hub.go` | Registry tất cả conn, broadcast, kick |
| `Handler` | `handler.go` | Route message theo msgType, update state |
| `Ticker` | `ticker.go` | Tick loop 20Hz, collect dirty state, broadcast batch |
| `Manager` | `state/manager.go` | Registry tất cả MapState đang active |
| `MapState` | `state/mapstate.go` | State in-memory của tất cả player trong 1 map |
| `Bus` / `NATSBus` | `bus.go` / `natsbus.go` | Cross-instance pub/sub |

---

## 2. Connection Lifecycle — Từ TCP đến Game State

### Lifecycle đầy đủ

```
1. TCP Connect
   └─ HTTP GET /ws-game với header Upgrade: websocket

2. Server.ServeHTTP()
   └─ upgrader.Upgrade() → *websocket.Conn
   └─ NewConn(wsConn) → *Conn wrapper

3. doHandshake() [timeout 5s]
   ├─ ReadMessage() → [0x00][protocolVersion uint16][token][sessionID][userID]
   ├─ Verify protocolVersion
   ├─ auth.Verify(token, sessionID, userID) [timeout 3s]
   ├─ Nếu fail → sendNack(reason) → Close()
   └─ Nếu OK   → sendAck() → reset deadline

4. hub.register(conn)
   ├─ Lưu conn vào connsByUser
   └─ Nếu user đã có conn cũ → kick conn cũ

5. Spawn goroutines
   ├─ go conn.writeLoop()    ← ghi từ send channel xuống websocket
   └─ conn.readLoop(handler) ← đọc từ websocket, gọi handler (block)

6. Handler.Handle() [per message]
   ├─ data[0] = msgType
   └─ switch msgType → handlePlayerMove()
      ├─ Decode binary payload
      ├─ Nếu đổi map → hub.MoveToRoom() + cleanup state cũ
      ├─ manager.GetOrCreateMap().UpdateFromMove()
      └─ go playerService.HandleMove() [Redis, fire-and-forget]

7. Ticker.tick() [20Hz, goroutine riêng]
   ├─ manager.AllMaps()
   ├─ ms.CollectDirty() → []PlayerState
   ├─ buildBatch() → 1 packet
   └─ hub.BroadcastToMap() → gửi đến tất cả Conn trong map

8. Connection đóng
   ├─ readLoop return (EOF hoặc error)
   ├─ hub.unregister(conn)
   ├─ manager.RemovePlayerFromMap()
   └─ conn.Close()
```

### Tại sao writeLoop chạy TRƯỚC readLoop?

```go
go conn.writeLoop()      // ← spawn trước
conn.readLoop(s.handler) // ← chạy sau (blocking)
```

Lý do: ngay sau khi register, Hub có thể gửi message cho conn (ví dụ: kick message vì user đang online ở chỗ khác). Nếu writeLoop chưa chạy mà Hub đã push vào send channel → channel buffer đầy → Hub block → deadlock hoặc drop message. Spawn writeLoop trước đảm bảo conn luôn sẵn sàng nhận message ngay từ đầu.

---

## 3. Binary Protocol — Tại sao và như thế nào

### So sánh JSON vs Binary

```
JSON packet điển hình:
{"type":"playerSync","userId":12345,"x":320.5,"y":180.3,"trangthai":1,"dir":1,
 "dau":"dau_001","than":"than_002","chan":"chan_003",...}
→ ~400-600 bytes

Binary packet tương đương:
[0x82][int32 userId][float32 x][float32 y][uint8 trangthai][int8 dir]
[uint16 len][dau bytes][uint16 len][than bytes][uint16 len][chan bytes]...
→ ~80-120 bytes

Tỉ lệ: giảm ~5x bandwidth
Với 100 CCU/map × 20Hz = 2000 packet/giây/map:
  JSON:   2000 × 500 bytes = 1 MB/giây/map
  Binary: 2000 × 100 bytes = 200 KB/giây/map
```

### Tại sao Big Endian (Network Byte Order)?

Big Endian là chuẩn của các network protocol (TCP/IP, HTTP, DNS). Khi dump hex packet bằng Wireshark:

```
Little Endian (x86 native): 0x01000000 → số 1
Big Endian (network order): 0x00000001 → số 1

Trong hexdump: 0x00000001 trực quan hơn — đọc trái sang phải là đúng.
```

### Message Type Encoding — Bit Trick

```
Client → Server: 0x00 - 0x7F  (bit cao = 0)
Server → Client: 0x80 - 0xFF  (bit cao = 1)

Check hướng chỉ bằng 1 bit:
if msgType >= 0x80 { // server → client }
if msgType < 0x80  { // client → server }

Hoặc bitmask:
if msgType & 0x80 != 0 { // server → client }
```

Ý nghĩa thực tế: nhìn vào hexdump của bất kỳ packet nào, byte đầu tiên cho biết ngay chiều của message. Debug nhanh hơn nhiều.

```
0x00 = 0000 0000 → Handshake (đặc biệt, connection mới)
0x01 = 0000 0001 → PlayerMove (client → server)
0x80 = 1000 0000 → HandshakeAck (server → client)
0x81 = 1000 0001 → HandshakeNack
0x82 = 1000 0010 → PlayerSync (1 player)
0x83 = 1000 0011 → PlayerSyncBatch (N players)
0xFF = 1111 1111 → Error (tất cả bit bật → "something wrong")
```

### Handshake Protocol — Tại sao packet đầu tiên đặc biệt?

```
0x00 dành riêng cho handshake vì:
1. Tại thời điểm này server chưa auth được client
2. Server chưa biết đây là player nào
3. Dễ nhận dạng trong log: thấy msgType=0x00 → biết ngay là connection mới
4. Tách biệt với game message → không thể giả mạo handshake packet giữa session
```

### Tại sao 0xFF cho Error?

`0xFF = 1111 1111` — tất cả bit đều bật. Convention phổ biến trong nhiều protocol (USB, CAN bus, SPI): giá trị max thường mang nghĩa "invalid", "error", hoặc "unset". Nhìn vào hexdump thấy `FF` là biết ngay có vấn đề.

---

## 4. Two-Phase Tick Rate — Trái tim của hệ thống

### Hai tầng hoạt động độc lập

```
Tầng 1 — Client Tick (giữ nguyên từ kiến trúc cũ):
Client set interval 50ms, gửi vị trí lên server
Server nhận → update state in-memory → KHÔNG broadcast

Tầng 2 — Server Tick Loop (thêm mới):
Goroutine riêng chạy mỗi 50ms (20Hz)
Mỗi tick: lấy dirty state → encode batch → broadcast

Timeline:
T=0ms:   Client A gửi move → state update
T=10ms:  Client A gửi move → state update (ghi đè)
T=20ms:  Client A gửi move → state update (ghi đè)
T=50ms:  Server tick → CollectDirty() → broadcast trạng thái mới nhất → reset Dirty

Client A gửi 3 packet nhưng server chỉ broadcast 1 lần.
```

### Tại sao KHÔNG broadcast ngay khi nhận move?

Kiến trúc cũ (broadcast ngay):
```
Client A (lag 500ms) → gửi packet mỗi 500ms
→ Server broadcast mỗi 500ms
→ B, C, D nhận sync mỗi 500ms
→ B, C, D thấy A giật lag

Client A (DDoS) → gửi 1000 packet/giây
→ Server broadcast 1000 lần/giây
→ B, C, D mỗi người nhận 1000 packet/giây
→ 1 attacker → DDoS tất cả client cùng map
```

Kiến trúc mới (server tick):
```
Client A (lag 500ms) → gửi ít packet
→ Server tick vẫn chạy đều 20Hz
→ B, C, D nhận sync đều đặn 20Hz
→ Client prediction + interpolation bù đắp

Client A (DDoS) → gửi 1000 packet/giây
→ Server chỉ lấy state mới nhất mỗi 50ms
→ Broadcast đúng 20 lần/giây
→ Tự nhiên rate-limited, không amplify
```

### Server-Authoritative Model — Broadcast về chính chủ

```go
t.hub.BroadcastToMap(ms.MapID, packet, nil) // nil = không exclude ai
```

Server broadcast kết quả tick **về tất cả player bao gồm cả chính chủ**. Đây là quyết định có chủ ý:

Kiến trúc cũ (NestJS): `client.to(room).emit()` — tự động exclude người gửi.

Kiến trúc mới: include chính chủ vì:
1. **Server-authoritative**: client phải reconcile vị trí của mình theo server.
2. **Anti-cheat**: nếu server từ chối input (speed hack, wall hack), state không update → tick không gửi → client tự biết bị reject, snap về vị trí cũ.
3. **Consistency**: mọi client nhận cùng 1 batch packet → dễ debug, dễ replay.

### Dirty Flag Pattern

```go
type PlayerState struct {
    // ... game state fields
    Dirty bool  // true nếu state thay đổi từ tick trước
}

// UpdateFromMove — set Dirty = true
func (ms *MapState) UpdateFromMove(userID int32, m *messages.PlayerMove) {
    p.Dirty = true
}

// CollectDirty — lấy và reset
func (ms *MapState) CollectDirty() []PlayerState {
    for _, p := range ms.players {
        if p.Dirty {
            dirty = append(dirty, *p)
            p.Dirty = false  // reset ngay trong lock
        }
    }
    return dirty
}
```

Pattern này đơn giản nhưng rất hiệu quả. Tick loop chỉ xử lý player có thay đổi thực sự — player đứng yên không tốn bandwidth.

**Tại sao CollectDirty cần write lock dù chỉ "đọc" state?**
Vì hàm này vừa đọc (`if p.Dirty`) vừa ghi (`p.Dirty = false`). Dùng RLock sẽ gây race condition khi 2 goroutine cùng đọc Dirty=true và cùng reset về false — có thể broadcast cùng 1 player 2 lần trong 1 tick.

---

## 5. State Management — MapState và Manager

### Hai tầng lock độc lập

```
Manager.mu (sync.RWMutex)
└── Chỉ lock khi tạo/xóa MapState entry
└── Fast path: RLock (map đã tồn tại)
└── Slow path: Lock (tạo mới)

MapState.mu (sync.RWMutex) — mỗi map có lock RIÊNG
└── Lock khi update/đọc player state trong map
└── Player ở map "lang_tu_4" di chuyển KHÔNG block player ở "lang_xay_da_1"
```

Điều này cực kỳ quan trọng cho performance. Nếu dùng 1 lock toàn cục:
```
Player A (map 1) di chuyển → lock toàn cục
Player B (map 2) di chuyển → phải chờ A xong
→ Mọi map block nhau → throughput giảm tuyến tính theo số map
```

### GetOrCreateMap — Double-Check Locking Pattern

```go
func (m *Manager) GetOrCreateMap(mapID string) *MapState {
    // Fast path: optimistic read
    m.mu.RLock()
    ms, ok := m.maps[mapID]
    m.mu.RUnlock()
    if ok {
        return ms  // 99% case → không cần write lock
    }

    // Slow path: write lock + double-check
    m.mu.Lock()
    defer m.mu.Unlock()
    if ms, ok := m.maps[mapID]; ok {
        return ms  // goroutine khác vừa tạo → dùng lại
    }
    ms = newMapState(mapID)
    m.maps[mapID] = ms
    return ms
}
```

Tại sao cần double-check?

```
Goroutine A: RLock → không thấy map → RUnlock
                                              ↑
Goroutine B: RLock → không thấy map → RUnlock
             Lock → tạo map → Unlock
                    ↓
Goroutine A: Lock → [KHÔNG double-check] → tạo map thứ 2 → RACE CONDITION

Goroutine A: Lock → [double-check] → thấy map đã có → dùng lại → OK
```

### RemovePlayerFromMap — Cleanup Chain

```go
func (m *Manager) RemovePlayerFromMap(mapID string, userID int32) {
    ms, ok := m.GetMap(mapID)  // chỉ lookup, không tạo
    if !ok { return }

    ms.RemovePlayer(userID)

    if ms.IsEmpty() {
        m.mu.Lock()
        defer m.mu.Unlock()
        // Double-check: player mới có thể join trong khoảng thời gian này
        if ms.IsEmpty() {
            delete(m.maps, mapID)
        }
    }
}
```

Cleanup chain: xóa player → check map rỗng → xóa map entry. Tránh leak entry rỗng khi map không có ai trong giờ thấp điểm.

### CollectDirty trả về copy — Không phải pointer

```go
func (ms *MapState) CollectDirty() []PlayerState {
    dirty = append(dirty, *p)  // copy by value, KHÔNG phải &p
    //                   ^^
}
```

Tại sao? Nếu trả `*PlayerState`:
- Ticker iterate slice ngoài lock
- Handler đồng thời update player trong lock
- Cùng lúc đọc và ghi vào cùng struct → race condition

Trả copy: Ticker làm việc với snapshot, Handler update struct gốc → hoàn toàn độc lập, không cần lock khi iterate.

---

## 6. Cross-Instance Messaging — Redis Bus vs NATS Bus

### Vấn đề: Tại sao cần cross-instance bus?

```
Instance A (pod 1): Player 1, 2, 3 trên map "lang_tu_4"
Instance B (pod 2): Player 4, 5, 6 trên map "lang_tu_4"

Player 1 di chuyển → Instance A broadcast → Player 2, 3 thấy → OK
                   → Instance B KHÔNG biết → Player 4, 5, 6 KHÔNG thấy → BUG
```

Bus giải quyết bằng cách relay message cross-instance:

```
Player 1 di chuyển:
1. Instance A: local fan-out → Player 2, 3 thấy ngay
2. Instance A: publish lên bus với originNode=A
3. Instance B: nhận từ bus, kiểm tra originNode != B → local fan-out → Player 4, 5, 6 thấy
```

### Echo Prevention — Tại sao cần nodeID?

```
Cả 2 instance đều subscribe cùng channel.
Khi Instance A publish:
  → Instance A nhận lại (ECHO)
  → Instance B nhận (OK)

Không có echo prevention:
  A publish → A nhận → A fan-out lại → Player 2, 3 nhận 2 lần!

Với echo prevention (nodeID trong payload header):
  A publish với header [16 byte nodeID-A][msgType][body]
  A nhận → originNode == nodeIDBytes(A) → skip
  B nhận → originNode != nodeIDBytes(B) → process
```

### Redis Bus vs NATS Bus

| | Redis Bus | NATS Bus |
|---|---|---|
| Số connection | 2 (pub + sub riêng biệt) | 1 (multiplex) |
| Publish blocking | Có (network round-trip) | Không (~µs, local buffer) |
| Subscriber loop | Tự code goroutine | NATS tự manage |
| Reconnect | Cần xử lý thủ công | Built-in, infinite retry |
| Cleanup | cancel + wg.Wait + Close (4 bước) | nc.Drain() (1 bước) |
| Buffer lúc disconnect | Không | 8MB outbound buffer |
| Code complexity | Cao hơn | Thấp hơn ~40% |

### Tại sao Redis Bus cần 2 connection?

```
Redis subscribe mode:
  Khi gọi pubsub.Subscribe(), connection chuyển sang "subscribe mode"
  Trong mode này: CHỈ có thể nhận, KHÔNG thể publish
  Gọi Publish() trên connection đang subscribe → lỗi

→ Cần 2 connection riêng: 1 cho pub, 1 cho sub
→ Tốn tài nguyên gấp đôi

NATS không có constraint này:
  nc.Subscribe() và nc.Publish() dùng cùng 1 connection
  NATS client tự multiplex bên trong
  → 1 connection cho tất cả
```

### NATS ReconnectBufSize — Buffer khi disconnect

```
Scenario không có ReconnectBufSize:
  T=0s:  NATS server xuống
  T=0-3s: nc.Publish() → lỗi connection refused → message mất
  T=3s:  NATS lên lại
  → Mất ~60 broadcast trong 3s → player thấy game "đứng hình"

Với ReconnectBufSize(8MB):
  T=0s:  NATS server xuống
  T=0-3s: nc.Publish() → ghi vào local buffer 8MB
  T=3s:  NATS lên lại, reconnect
  T=3.1s: Buffer flush → tất cả message đến tay instance khác
  → Gameplay tiếp tục sau reconnect, không mất message
```

8MB ≈ ~55k message (150 bytes/msg) ≈ đủ buffer cho vài giây. Nếu NATS chết quá lâu và buffer overflow → publish mới fail. Acceptable với game realtime (drop frame ok).

### NATS Subject Convention

```
Redis style:  gamebus:broadcast   (dùng dấu :)
NATS style:   gamebus.broadcast   (dùng dấu .)

Tại sao dấu . quan trọng?
NATS wildcard subscription:
  nc.Subscribe("gamebus.>", ...)  → match MỌI subject bắt đầu bằng "gamebus."
  nc.Subscribe("gamebus.*", ...)  → match 1 token sau "gamebus."

Ví dụ tương lai:
  gamebus.broadcast
  gamebus.kick
  gamebus.chat
  nc.Subscribe("gamebus.*", ...) → handle tất cả trong 1 subscriber
```

---

## 7. Hub — Bộ não trung tâm

### Hai chiều data flow qua Hub

```
INBOUND (từ bus → local clients):
  Bus.dispatch() → handler.OnBroadcast() → Hub.BroadcastToMap()
  Bus.dispatch() → handler.OnKickUser()  → Hub.KickUser()

OUTBOUND (từ local action → bus):
  Hub.BroadcastToMap() → [local fan-out] + [enqueue publish job]
  Hub.KickUser()       → [local kick]    + [enqueue publish job]
```

### Room Management

Hub dùng concept "room" (hay "map") để group connection:

```go
type Hub struct {
    connsByUser map[int32]*Conn        // userID → conn (1 user = 1 conn)
    roomsByMap  map[string]map[*Conn]bool // mapID → set of conn
}
```

Khi player đổi map (Handler nhận MsgPlayerMove với mapID khác):

```go
func (h *Hub) MoveToRoom(c *Conn, newMapID string) {
    h.mu.Lock()
    defer h.mu.Unlock()

    // Rời room cũ
    if c.mapID != "" {
        delete(h.roomsByMap[c.mapID], c)
        if len(h.roomsByMap[c.mapID]) == 0 {
            delete(h.roomsByMap, c.mapID)
        }
    }

    // Vào room mới
    c.mapID = newMapID
    if h.roomsByMap[newMapID] == nil {
        h.roomsByMap[newMapID] = make(map[*Conn]bool)
    }
    h.roomsByMap[newMapID][c] = true
}
```

### One User, One Connection

```go
func (h *Hub) register(conn *Conn) {
    h.mu.Lock()
    defer h.mu.Unlock()

    if old, ok := h.connsByUser[conn.userID]; ok {
        // User đã có conn từ lần login trước (tab khác, thiết bị khác)
        old.Close()  // kick conn cũ ngay
    }
    h.connsByUser[conn.userID] = conn
}
```

Đảm bảo mỗi userID chỉ tồn tại 1 Conn trong hub. Kết hợp với cross-instance kick (PublishKickUser) để handle trường hợp 2 instance.

---

## 8. O(N²) → O(N) — Batch Broadcast Optimization

### Vấn đề ban đầu

```go
// CÁCH CŨ — O(N²)
for _, p := range dirty {          // lặp N player dirty
    packet := p.ToSync().Encode()
    hub.BroadcastToMap(mapID, packet, nil)
    //   ^^^^^^^^^^^^^ bên trong lặp N conn
}
// Tổng: N × N = N² Send() calls
```

Số liệu thực tế:

| N players/map | Send() calls/tick | Send() calls/giây (20Hz) |
|---|---|---|
| 50 | 2,500 | 50,000 |
| 100 | 10,000 | 200,000 |
| 200 | 40,000 | 800,000 |

### Giải pháp: Batch per Map

```go
// CÁCH MỚI — O(N)
syncs := make([]messages.PlayerSync, len(dirty))
for i := range dirty {
    syncs[i] = *dirty[i].ToSync()  // encode tất cả vào 1 slice
}

batch := &messages.PlayerSyncBatch{Players: syncs}
packet := batch.Encode()                          // encode 1 lần
hub.BroadcastToMap(ms.MapID, packet, nil)         // broadcast 1 lần
// ^^^^^^^^^^^^^ bên trong chỉ lặp N conn 1 lần
```

Sau khi optimize:

| N players/map | Send() calls/tick | Giảm |
|---|---|---|
| 50 | 50 | 50× |
| 100 | 100 | 100× |
| 200 | 200 | 200× |

### MsgPlayerSyncBatch (0x83) Format

```
[1 byte]   0x83 (msgType)
[2 bytes]  count (uint16, số player)
[variable] PlayerSync × count

Mỗi PlayerSync:
[4 bytes]  userId (int32)
[4 bytes]  x (float32)
[4 bytes]  y (float32)
[1 byte]   trangthai (uint8)
[1 byte]   dir (int8)
[2+N bytes] dau (uint16 len + bytes)
[2+N bytes] than
[2+N bytes] chan
... (các string field khác)
[4 bytes]  timeChoHienBay (float32)
... (các float field khác)
[1 byte]   dangMangVanBay (bool)
[2+N bytes] tenVanBay
[4 bytes]  rong (float32)
[4 bytes]  cao (float32)
[2+N bytes] avatar
[8 bytes]  serverTime (int64 unix milli) ← thêm mới so với PlayerSync
```

### Thêm ServerTime vào batch

```go
s.ServerTime = now  // unix milli tại thời điểm tick
```

Client dùng `serverTime` để đo one-way latency và sync đồng hồ:

```java
// Java client
long serverTime = buf.getLong();
long latency = System.currentTimeMillis() - serverTime;
// Dùng latency để interpolate animation mượt hơn
```

---

## 9. Goroutine Pool Pattern

### Vấn đề: Spawn goroutine mỗi publish

```go
// Cách naïve — BAD
go func() {
    bus.PublishBroadcast(ctx, mapID, data, excludeUserID)
}()

// 20Hz × 10 maps = 200 goroutine/giây được tạo và hủy
// Mỗi goroutine: 2KB stack ban đầu
// GC phải dọn dẹp 200 goroutine/giây
// → GC pause tăng dần → tick jitter → gameplay không mượt
```

### Giải pháp: Bounded Worker Pool

```
Topology:
                    ┌─────────────────────────────┐
  Hub tick ─────►  │  publishCh (buffer 1024)     │
  Hub kick ─────►  │  [job][job][job][job]...      │
                    └──────────────┬──────────────┘
                                   │ fan-out
                    ┌──────────────┼──────────────┐
                    ▼              ▼              ▼
              Worker 1       Worker 2       Worker 3,4
              (goroutine)    (goroutine)    (goroutine)
              bus.Publish()  bus.Publish()  bus.Publish()
```

### Implementation chi tiết

```go
// Job struct — data cần để publish
type publishJob struct {
    kind          publishKind  // broadcast hoặc kick
    mapID         string       // chỉ dùng cho broadcast
    data          []byte
    excludeUserID int32
    userID        int32        // chỉ dùng cho kick
}

type publishKind uint8
const (
    publishBroadcast publishKind = iota  // = 0
    publishKick                          // = 1
)

// Khởi tạo trong NewHub()
func NewHub(...) *Hub {
    h := &Hub{
        publishCh: make(chan publishJob, 1024),
    }
    for i := 0; i < 4; i++ {
        go h.publishWorker()
    }
    return h
}

// Worker — chạy vô hạn, drain channel
func (h *Hub) publishWorker() {
    for job := range h.publishCh {  // block nếu rỗng, exit khi closed
        ctx, cancel := context.WithTimeout(context.Background(), 1*time.Second)
        switch job.kind {
        case publishBroadcast:
            if err := h.bus.PublishBroadcast(ctx, job.mapID, job.data, job.excludeUserID); err != nil {
                h.log.Warn("publish broadcast failed", "err", err)
            }
        case publishKick:
            if err := h.bus.PublishKickUser(ctx, job.userID); err != nil {
                h.log.Warn("publish kick failed", "err", err)
            }
        }
        cancel()
    }
}

// Enqueue — non-blocking với drop
func (h *Hub) enqueue(job publishJob) {
    select {
    case h.publishCh <- job:  // thành công
    default:
        h.log.Warn("publish channel full, dropping", "kind", job.kind)
        // Drop thay vì block — tick loop không thể chờ
    }
}

// Shutdown — close channel, workers tự drain
func (h *Hub) Close() {
    close(h.publishCh)
    // Worker đang xử lý job cuối sẽ xử lý xong rồi mới exit
    // vì `for job := range ch` đọc hết trước khi exit
}
```

### Tại sao DROP thay vì BLOCK khi channel đầy?

```
Tick loop timeline:
T=0ms:   tick() bắt đầu
T=5ms:   encode xong, gọi enqueue()
T=5ms:   [enqueue BLOCK vì channel đầy]
T=55ms:  tick kế tiếp bị trễ vì tick trước chưa xong!
T=55ms+: cascade → tất cả tick sau bị trễ → gameplay lag

Với DROP:
T=0ms:   tick() bắt đầu
T=5ms:   encode xong, gọi enqueue()
T=5ms:   [channel đầy → DROP → log warning]
T=5ms:   tick() tiếp tục và kết thúc đúng hạn
T=50ms:  tick kế tiếp chạy đúng lịch
```

Drop cross-instance broadcast là chấp nhận được vì local broadcast đã chạy. Instance B miss 1 tick sẽ nhận tick kế tiếp sau 50ms.

### Trade-off của Pool so với spawn-per-call

| | Spawn goroutine/call | Goroutine pool |
|---|---|---|
| GC pressure | Cao | ~0 |
| Latency | Ngay lập tức | Delay nếu workers bận |
| Drop | Không bao giờ | Khi channel đầy |
| Goroutine count | Unbounded | Cố định = 4 |
| Complexity | Đơn giản | Trung bình |

Với game realtime: GC pressure quan trọng hơn latency của cross-instance (local broadcast đã chạy rồi).

---

## 10. Security — Handshake, Auth và Rate Limiting tự nhiên

### Handshake — Tại sao không dùng JWT trong query string?

```
Cách thường thấy:
  ws://server/ws-game?token=eyJhbGci...

Vấn đề:
1. Query string ghi vào access log → JWT bị leak vào log file
2. Log file thường được ship đến ELK/Loki/S3 → token leak ra external system
3. Nếu referer header bị set → URL (kèm token) leak sang site khác

Cách trong codebase này:
  Kết nối xong (sau upgrade) → gửi binary handshake packet
  Token chỉ đi qua WebSocket payload, không bao giờ trong URL
```

### Handshake Deadline — Chống Slowloris

```go
c.ws.SetReadDeadline(time.Now().Add(5 * time.Second))
```

Slowloris attack: kẻ tấn công mở hàng ngàn connection, gửi HTTP request rất chậm (1 byte/giây) để giữ connection không đóng → chiếm hết connection pool.

Với WebSocket: tương tự, kẻ tấn công connect nhưng không gửi handshake → connection tồn tại mãi → chiếm goroutine và file descriptor.

5 giây deadline: nếu handshake không hoàn thành trong 5s → đóng connection ngay.

### Auth Timeout — 3 Giây

```go
ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
defer cancel()
authResult, err := s.auth.Verify(ctx, hs.Token, hs.GameSessionID, hs.UserID)
```

Auth thường gọi database hoặc Redis. Không có timeout → auth service chậm → connection treo → goroutine leak. 3 giây là balance giữa UX (không timeout quá nhanh khi server bận) và resource protection.

### Rate Limiting Tự Nhiên

```
Client gửi 1000 move packets/giây (flood):
  - Handler.handlePlayerMove() được gọi 1000 lần
  - ms.UpdateFromMove() được gọi 1000 lần → ghi đè state
  - Dirty = true chỉ cần set 1 lần
  - Tick 50ms sau: CollectDirty() → lấy 1 state duy nhất
  - Broadcast: 1 packet thay vì 1000

Input rate bị cap tự nhiên ở 20Hz bất kể client gửi bao nhiêu.
Không cần middleware rate-limit riêng cho PlayerMove.
```

### Nack Reasons — Structured Error

```go
const (
    NackReasonVersion  uint8 = 1   // client cũ chưa update
    NackReasonAuth     uint8 = 2   // token hết hạn
    NackReasonSession  uint8 = 3   // session không tồn tại
    NackReasonInternal uint8 = 99  // server bug
)
```

Thứ tự 1, 2, 3 theo tần suất gặp — version mismatch (client chưa update app) hay gặp nhất. Client nhận được Nack biết lý do cụ thể để hiển thị đúng thông báo cho user.

---

## 11. Concurrency Patterns trong codebase này

### Pattern 1: Goroutine-per-connection

```
Mỗi Conn có 2 goroutine:
  writeLoop: đọc từ send channel → ghi xuống websocket
  readLoop:  đọc từ websocket → gọi handler

Tại sao cần 2 goroutine riêng?
  websocket.WriteMessage() không thread-safe — chỉ 1 goroutine ghi tại 1 thời điểm
  websocket.ReadMessage() blocking

Nếu dùng 1 goroutine:
  Đang chờ ReadMessage() → không ghi được → message bị drop
  Hoặc: interleave ghi và đọc → race condition

2 goroutine: đọc và ghi hoàn toàn độc lập, không cần lock
```

### Pattern 2: Send Channel với Buffered Queue

```go
type Conn struct {
    send chan []byte  // buffered channel, thường 256 hoặc 512
}

func (c *Conn) Send(data []byte) bool {
    select {
    case c.send <- data:
        return true
    default:
        // send channel đầy → client lag hoặc chậm
        // DROP thay vì block Hub
        return false
    }
}
```

Hub gọi `conn.Send()` trong lock để broadcast. Nếu `Send()` block → Hub block → tất cả connection khác không nhận được message. Buffered channel + drop giải quyết client lag mà không ảnh hưởng client khác.

### Pattern 3: Fire-and-Forget với Timeout

```go
go func(userID int32, move messages.PlayerMove) {
    ctx, cancel := context.WithTimeout(context.Background(), 1*time.Second)
    defer cancel()
    if err := h.playerService.HandleMove(ctx, userID, &move); err != nil {
        h.log.Warn("redis update failed", "err", err, "userID", userID)
    }
}(c.userID, m)
```

Redis update là side effect không cần thiết cho gameplay. Fire-and-forget giữ hot path (`readLoop → handler → state update`) dưới 1ms. Timeout 1s đảm bảo goroutine không tồn tại quá lâu nếu Redis chậm.

**Lưu ý quan trọng**: Arguments được copy vào closure (`c.userID, m` là value copy) — tránh race condition khi `c.userID` hoặc `m` bị modify sau khi goroutine spawn.

### Pattern 4: Interface cho Testability

```go
type BusHandler interface {
    OnBroadcast(mapID string, data []byte, excludeUserID int32)
    OnKickUser(userID int32)
}

// Compile-time check — không làm gì lúc runtime
var _ BusHandler = (*Hub)(nil)
```

`var _ BusHandler = (*Hub)(nil)` là idiom Go để ép compiler verify interface implementation. Nếu `*Hub` thiếu bất kỳ method nào của `BusHandler` → compile error ngay, không phải runtime panic khi gọi method.

### Pattern 5: Two-Phase Construction

```go
// Phase 1: tạo Bus (Handler = nil)
bus := NewBus(redisURL, log)

// Phase 2: tạo Hub, gắn handler
hub := NewHub(bus, log, manager)
bus.SetHandler(hub)  // Hub implement BusHandler
```

Tại sao không truyền Hub vào NewBus? Circular dependency:
- `Bus` cần `Hub` (để gọi OnBroadcast)
- `Hub` cần `Bus` (để publish)

Two-phase construction phá vòng tròn: tạo cả hai trước, kết nối sau.

---

## 12. Double-Check Locking — Pattern quan trọng

Pattern này xuất hiện ở nhiều chỗ trong codebase. Hiểu rõ một lần, nhận ra mọi nơi.

### Template chung

```go
// Fast path: optimistic read với RLock
mu.RLock()
val, ok := shared_map[key]
mu.RUnlock()
if ok {
    return val  // phần lớn request đi theo đây
}

// Slow path: write lock + verify lại
mu.Lock()
defer mu.Unlock()
if val, ok := shared_map[key]; ok {
    return val  // goroutine khác vừa tạo → dùng lại
}
val = create_new()
shared_map[key] = val
return val
```

### Tại sao fast path dùng RLock mà không dùng Lock ngay?

```
Scenario: map "lang_tu_4" đã tồn tại, 1000 packet/giây đi qua

Với Lock (write lock mọi lúc):
  1000 goroutine/giây tranh lock → serialized → throughput thấp

Với RLock (read lock khi tìm thấy):
  1000 goroutine/giây đọc song song → không block nhau → throughput cao

Write lock chỉ cần khi tạo mới (hiếm hơn nhiều).
```

### Tại sao cần double-check sau Lock?

```
Timeline của race condition:
T=0: Goroutine A: RLock → not found → RUnlock
T=1: Goroutine B: RLock → not found → RUnlock
T=2: Goroutine B: Lock → not found → create → Unlock
T=3: Goroutine A: Lock → [KHÔNG check lại] → create → 2 MapState cho cùng key!

Với double-check:
T=3: Goroutine A: Lock → check lại → found (B vừa tạo) → dùng lại → OK
```

### Ứng dụng trong RemovePlayerFromMap

```go
if ms.IsEmpty() {                      // check 1: trước lock (nhanh)
    m.mu.Lock()
    defer m.mu.Unlock()
    if ms.IsEmpty() {                  // check 2: sau lock (chắc chắn)
        delete(m.maps, mapID)
    }
}
```

Giữa check 1 và lock, player mới có thể join → map không còn rỗng → check 2 bảo vệ khỏi xóa map đang có người.

---

## 13. Go Syntax Guide — Những thứ khó hiểu

### `iota` — Enum tự động

```go
type publishKind uint8

const (
    publishBroadcast publishKind = iota  // = 0
    publishKick                          // = 1 (tự tăng)
    publishSomething                     // = 2
)

// Dùng type riêng thay vì uint8:
enqueue(publishJob{kind: publishBroadcast})  // ✅ type-safe
enqueue(publishJob{kind: uint8(1)})          // ❌ compile error
```

`iota` reset về 0 mỗi khi vào `const` block mới. Tương đương enum trong Java/C++.

### `chan` — Channel (pipe thread-safe)

```go
publishCh chan publishJob     // type: channel chứa publishJob
publishCh = make(chan publishJob, 1024)  // buffered, chứa tối đa 1024 item

publishCh <- job              // gửi vào (block nếu đầy)
job := <-publishCh            // đọc ra (block nếu rỗng)
close(publishCh)              // đóng channel

for job := range publishCh {  // đọc đến khi closed+rỗng
    // xử lý
}
```

### `select` — Switch cho channel

```go
select {
case publishCh <- job:     // nếu có thể gửi → gửi
    // thành công
default:                   // nếu tất cả case block → chạy default
    // channel đầy → drop (non-blocking)
}
```

Không có `default` → `select` block cho đến khi 1 case sẵn sàng. Có `default` → non-blocking.

### Composite Literal + Pointer

```go
batch := &messages.PlayerSyncBatch{Players: syncs}
//       ^                                        — lấy địa chỉ của struct mới tạo
//        ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^  — tạo struct với giá trị field

// Tương đương:
var b messages.PlayerSyncBatch
b.Players = syncs
batch := &b
```

### `defer` và cleanup pattern

```go
m.mu.Lock()
defer m.mu.Unlock()  // chạy khi function return, dù return ở đâu
// ... xử lý
```

`defer` đảm bảo Unlock luôn được gọi, kể cả khi hàm có nhiều return point hay panic. Không cần nhớ gọi Unlock ở mỗi return.

### Named return với naked return

```go
func decodeBroadcast(body []byte) (mapID string, data []byte, excludeUserID int32, err error) {
    if len(body) < 6 {
        return "", nil, 0, errors.New("broadcast body too short")
    }
    // ...
    mapID = string(body[6 : 6+mapLen])
    data = body[6+mapLen:]
    return  // naked return: trả về tất cả named return values
}
```

Named return: khai báo tên cho return values trong signature. Useful khi có nhiều return value và muốn code rõ hơn.

### Interface check lúc compile

```go
var _ BusHandler = (*Hub)(nil)
```

`_` = blank identifier (bỏ qua giá trị). `(*Hub)(nil)` = nil pointer kiểu `*Hub`. Câu này tạo temporary `*Hub` nil và assign cho `BusHandler` interface — compiler kiểm tra type compatibility. Không làm gì lúc runtime, chỉ để catch lỗi sớm.

---

## 14. Metrics & Monitoring

### Metrics cần monitor

```go
type HubStats struct {
    TotalConns      int  // tổng số connection đang active
    TotalRooms      int  // tổng số map có ít nhất 1 player
    PublishQueueLen int  // backlog của publishCh
}

func (h *Hub) Stats() HubStats {
    h.mu.RLock()
    defer h.mu.RUnlock()
    return HubStats{
        TotalConns:      len(h.connsByUser),
        TotalRooms:      len(h.roomsByMap),
        PublishQueueLen: len(h.publishCh),
    }
}
```

| Metric | Bình thường | Cảnh báo | Nguy hiểm |
|---|---|---|---|
| `publish_queue_len` | 0 - 50 | 500+ | 1000 (channel đầy, drop) |
| `tick_duration_ms` | < 10ms | 25ms | > 50ms (tick chậm hơn interval) |
| `goroutine_count` | Ổn định | Tăng liên tục | Leak |
| `gc_pause_ms` | < 1ms | 5ms | > 10ms (ảnh hưởng tick jitter) |
| `conns_per_map` | < 50 | 100 | 200+ |
| `redis_update_errors/s` | 0 | < 5 | Tăng liên tục |

### Tick Slow Warning

```go
elapsed := time.Since(start)
if elapsed > t.interval/2 {
    t.log.Warn("tick slow",
        "elapsed", elapsed,
        "maps", len(maps),
        "packets", totalPackets,
    )
}
```

Nếu tick mất > 25ms (nửa interval 50ms) → nguy cơ tick kế tiếp không kịp → jitter. Log ngay để debug kịp thời.

### Đo Latency Thực tế — ServerTime trong Batch

```go
s.ServerTime = time.Now().UnixMilli()  // thêm vào mỗi PlayerSync trong batch
```

Client đo:
```java
// Java client LibGDX
long serverTime = buf.getLong();
long estimatedLatency = System.currentTimeMillis() - serverTime;
// Dùng estimatedLatency để:
// 1. Hiển thị ping cho user
// 2. Điều chỉnh interpolation speed
// 3. Alert nếu latency > 200ms
```

Lưu ý: đây là one-way latency ước tính (không account for clock skew giữa client và server). Đủ tốt cho game, không cần NTP-level accuracy.

### Prometheus Integration (gợi ý)

```go
var (
    tickDuration = prometheus.NewHistogram(prometheus.HistogramOpts{
        Name:    "game_tick_duration_seconds",
        Help:    "Duration of each tick",
        Buckets: []float64{.005, .01, .025, .05, .1},
    })
    publishQueueLen = prometheus.NewGauge(prometheus.GaugeOpts{
        Name: "game_publish_queue_len",
        Help: "Current publish queue length",
    })
    activeConns = prometheus.NewGauge(prometheus.GaugeOpts{
        Name: "game_active_connections",
        Help: "Number of active WebSocket connections",
    })
)

// Trong tick():
timer := prometheus.NewTimer(tickDuration)
defer timer.ObserveDuration()

publishQueueLen.Set(float64(len(h.publishCh)))
```

---

## 15. Checklist cho Developer

### Khi thêm message type mới

- [ ] Thêm const vào `protocol/msgtype.go`
  - Client→Server: `0x01-0x7F` (nhớ kiểm tra không trùng)
  - Server→Client: `0x80-0xFF`
- [ ] Tạo struct message trong `messages/`
  - Implement `Decode([]byte) error` nếu nhận từ client
  - Implement `Encode() []byte` nếu gửi về client
- [ ] Thêm `case` trong `Handler.Handle()`
- [ ] Thêm `case` trong client Java `handleBinaryMessage()`
- [ ] Nếu cần broadcast batch: tạo `*Batch` struct, thêm msgType `original+1`, update ticker
- [ ] Viết unit test cho Encode/Decode (đặc biệt edge cases: empty string, max values)

### Khi thêm field vào PlayerState/PlayerMove

- [ ] Thêm field vào `PlayerState` (state/mapstate.go)
- [ ] Thêm field vào `PlayerMove` (messages/)
- [ ] Thêm field vào `PlayerSync` (messages/)
- [ ] Update `UpdateFromMove()` — copy field mới từ Move sang State
- [ ] Update `ToSync()` — copy field mới từ State sang Sync
- [ ] Update `Encode()`/`Decode()` của PlayerMove và PlayerSync
- [ ] Update Java client: thêm field, update encode/decode
- [ ] Bump `PROTOCOL_VERSION` nếu breaking change (field bắt buộc mới, reorder)

### Khi tune performance

- [ ] Benchmark trước khi optimize — đừng đoán
- [ ] `go test -bench=. -benchmem -cpuprofile=cpu.prof`
- [ ] `go tool pprof cpu.prof` → tìm hot function
- [ ] Monitor `publish_queue_len` — nếu thường > 500, tăng workers hoặc buffer
- [ ] Monitor `tick_duration` — nếu thường > 25ms, profile `CollectDirty()` và encode
- [ ] Monitor GC pause (`GODEBUG=gctrace=1`) — nếu > 5ms, giảm allocation trong tick loop

### Khi debug vấn đề sync

```bash
# Hexdump packet để verify binary format
# Server side: log payload hex
h.log.Debug("packet", "hex", hex.EncodeToString(data))

# Client side (Java): in ra bytes
System.out.println(DatatypeConverter.printHexBinary(bytes));

# So sánh hex để tìm parse mismatch
```

---

## 16. Khi nào cần refactor tiếp?

### Dấu hiệu cần Redis Pipeline cho state update

```
Hiện tại: mỗi PlayerMove → 1 goroutine → 1 Redis call
100 player × 20Hz = 2000 Redis call/giây/instance

Khi nào cần pipeline:
  Redis CPU > 60%
  Redis latency p99 > 10ms
  Log thấy "redis update failed" > 1% requests

Giải pháp:
  Tick loop batch update Redis 1 lần bằng pipeline:
  pipe := rdb.Pipeline()
  for _, p := range dirty {
      pipe.HSet(ctx, "player:"+userID, p.ToRedisMap())
  }
  pipe.Exec(ctx)
  → Từ 2000 round-trip/giây → 20 round-trip/giây (1/map)
```

### Dấu hiệu cần Delta Compression

```
Vấn đề: player đứng yên vẫn dirty nếu có bất kỳ field nào thay đổi
Hoặc: broadcast full state ngay cả khi chỉ x, y thay đổi

Giải pháp: dirty bitmask
  const (
      DirtyPosition   uint32 = 1 << 0  // x, y thay đổi
      DirtyAnimation  uint32 = 1 << 1  // trangthai, dir, dau, than, chan
      DirtyVehicle    uint32 = 1 << 2  // tenVanBay,
      DirtyAppearance uint32 = 1 << 3  // avatar, rong, cao
  )

  Format packet với bitmask:
  [4 bytes dirtyMask][chỉ các field có bit = 1]

  Tiết kiệm: 30-50% bandwidth khi nhiều player đứng yên (town map)
```

### Dấu hiệu cần Sharded Lock

```
pprof cho thấy: goroutine block > 20% thời gian tại Hub.mu
Metric: mutex contention spike khi nhiều conn vào/ra cùng lúc

Giải pháp: shard Hub theo map
  type Hub struct {
      shards [256]*hubShard
  }
  type hubShard struct {
      mu    sync.RWMutex
      conns map[int32]*Conn
      rooms map[string]map[*Conn]bool
  }
  func (h *Hub) shardOf(mapID string) *hubShard {
      return h.shards[hashMapID(mapID) % 256]
  }
  → Contention giảm 256 lần
```

### Dấu hiệu cần Spatial Partitioning

```
Map có > 200 player nhưng phần lớn ở xa nhau:
  Player A ở góc trên trái, Player B ở góc dưới phải
  A và B không cần thấy nhau nhưng vẫn nhận sync của nhau

Giải pháp: Area of Interest (AoI)
  Chia map thành grid (ví dụ: cell 256×256 units)
  Player chỉ nhận sync của player trong cell cùng và 8 cell lân cận
  → Giảm bandwidth O(N²) → O(local_density²) << O(N²)
  → Phức tạp hơn nhiều, chỉ cần khi > 300 CCU/map
```

---

## 17. Tóm tắt các quyết định thiết kế

| Quyết định | Lý do | Trade-off |
|---|---|---|
| Custom binary protocol | 5x ít bandwidth hơn JSON, no overhead | Phải maintain Encode/Decode thủ công |
| Server tick loop 20Hz | Rate-limit tự nhiên, client lag không lan | Tăng avg latency 0ms→25ms |
| Broadcast về chính chủ | Server-authoritative, anti-cheat | Client phải xử lý reconciliation |
| Batch per map tick | O(N) thay vì O(N²) | Client cần handle MsgPlayerSyncBatch |
| Goroutine pool 4 workers | GC pressure gần 0 | Drop job khi quá tải |
| NATS thay Redis pub/sub | 1 connection, non-blocking publish | Phải deploy NATS server |
| Dirty flag pattern | Chỉ broadcast player có thay đổi | Cần reset đúng thời điểm |
| Copy-by-value trong CollectDirty | Thread-safe iterate ngoài lock | Dùng nhiều memory hơn |
| Double-check locking | High throughput + correctness | Code phức tạp hơn một chút |
| Two-phase construction (Bus+Hub) | Tránh circular dependency | SetHandler phải gọi đúng thứ tự |
| nodeID trong payload header | Echo prevention cross-instance | 16 bytes overhead mỗi message |
| Fire-and-forget Redis update | Hot path không bị block bởi Redis | Possible state stale, race ghi |

---

*Tài liệu phản ánh kiến trúc Phase 1. TODO Phase 2: Redis pipeline batch, delta compression với dirty bitmask, sharded Hub lock, Area of Interest cho map đông.*