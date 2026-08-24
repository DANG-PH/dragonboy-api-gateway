# Port `player-move` từ NestJS Socket.IO sang Go WebSocket Binary

> Tài liệu này dành cho dev NestJS chưa biết Go. Đọc xong sẽ hiểu được vì sao port, port như thế nào, và Go syntax cơ bản đủ để maintain code.

## Mục lục

1. [Bài toán đặt ra](#1-bài-toán-đặt-ra)
2. [Tại sao port? Để làm gì?](#2-tại-sao-port-để-làm-gì)
3. [Tại sao chọn Go, WebSocket, Binary?](#3-tại-sao-chọn-go-websocket-binary)
4. [Tại sao chỉ port mỗi `player-move`?](#4-tại-sao-chỉ-port-mỗi-player-move)
5. [Stack so sánh: trước và sau](#5-stack-so-sánh-trước-và-sau)
6. [Kiến trúc tổng thể](#6-kiến-trúc-tổng-thể)
7. [Go syntax cơ bản cho dev NestJS](#7-go-syntax-cơ-bản-cho-dev-nestjs)
8. [Cấu trúc thư mục Go](#8-cấu-trúc-thư-mục-go)
9. [Giải thích từng file](#9-giải-thích-từng-file)
10. [Binary protocol design](#10-binary-protocol-design)
11. [Implementation: Server (Go)](#11-implementation-server-go)
12. [Implementation: Client (Java/LibGDX)](#12-implementation-client-javalibgdx)
13. [Fire-and-forget pattern: từ NestJS qua Go](#13-fire-and-forget-pattern-từ-nestjs-qua-go)
14. [Metrics và benchmark](#14-metrics-và-benchmark)
15. [Common pitfalls và bài học](#15-common-pitfalls-và-bài-học)
16. [Phụ lục: Go vs Node.js cheat sheet](#16-phụ-lục-go-vs-nodejs-cheat-sheet)

---

## 1. Bài toán đặt ra

Game MMO 2D có hot path là `player-move` — event được gọi nhiều nhất, broadcast tới mọi player trong cùng map. Hệ thống NestJS hiện tại có vấn đề:

- **Mỗi packet ~400-600 bytes JSON** với 19 field, lãng phí bandwidth
- **Event loop Node.js bị nghẽn** ở giờ peak khi nhiều player cùng move
- **Tail latency p99** tăng cao (50-200ms) khi load cao
- **Socket.IO overhead**: protocol negotiation, ack tracking, room iteration không sharded
- **GC pause** khi heap to (>2GB) gây lag

Mục tiêu: tách hot path này sang một service riêng tối ưu cho realtime, giữ nguyên các logic phức tạp khác (trade, skill, cosmetic, rồng thần) ở NestJS.

## 2. Tại sao port? Để làm gì?

### Vấn đề thực tế

Trong WsGateway NestJS, `handleMove` được gọi mỗi khi player di chuyển (~5-20 lần/giây/player). Với 1000 CCU active = **5k-20k events/giây** chỉ riêng move. Mỗi event:

1. Parse JSON (~100µs)
2. Pipeline 2 Redis command (1-3ms)
3. Broadcast Socket.IO tới room (1-5ms tùy số người)

Total ~5-10ms per move. Nhân 5k-20k events/s → event loop quá tải.

### Mục tiêu sau khi port

| Metric | Trước (NestJS) | Sau (Go) | Cải thiện |
|---|---|---|---|
| Bandwidth per move | 400-600 bytes | 80-150 bytes | 3-5x |
| Server processing time | 5-10ms | 0.5-2ms | 5-10x |
| RAM per connection | 30-60 KB | 2-10 KB | 5-10x |
| Concurrent connections | 10-20k | 100k+ | 5-10x |
| Tail latency p99 | 50-200ms | 5-15ms | 10-30x |
| Cost server | $X/tháng | $X/3-5/tháng | 3-5x rẻ hơn |

### Lợi ích phụ

- Học Go (kỹ năng có giá thị trường)
- Tách concern: hot path tối ưu, business logic ở stack quen thuộc
- Có thể scale 2 service độc lập (Go scale theo CCU, NestJS scale theo throughput business)

## 3. Tại sao chọn Go, WebSocket, Binary?

### Tại sao Go (không phải Rust, Elixir, Java)?

**Go mạnh ở concurrent I/O và networking** — đúng nhu cầu của hot path:

- **Goroutine rẻ**: 2KB stack mỗi goroutine, vs 1MB thread Java. 100k connection = 100k goroutine = ~200MB RAM. Java thread thì 100GB RAM (không khả thi).
- **GC ngắn**: pause time <1ms (Go 1.18+). Java GC có thể pause 100ms+ khi heap to.
- **Compile binary tĩnh**: 1 file, không cần JVM, deploy đơn giản.
- **Syntax đơn giản**: học 1 tuần là code được. Rust mất 3-6 tháng.
- **Ecosystem networking**: gorilla/websocket, net/http chuẩn, grpc-go đều mature.

**Đuối ở**: business logic verbose, không có decorator/DI elegant như NestJS, validation phải tự viết. Vì vậy chỉ port hot path, không port business logic.

### Tại sao WebSocket (không phải UDP, gRPC stream)?

**UDP** (đề xuất ban đầu, đã loại):
- Trình duyệt không hỗ trợ, mobile/native phức tạp
- Phải tự làm reliability layer cho skill cast (không được mất packet)
- Reverse proxy (nginx, cloudflare) không hỗ trợ tốt
- Debug cực khó (Wireshark cũng đau)
- Latency lợi 1-3ms — không đáng với cost

**gRPC stream**:
- Java/Go có sẵn support tốt
- Schema-driven (proto file)
- Nhưng overhead frame lớn hơn WebSocket binary
- Khó migrate từ Socket.IO (client phải đổi gRPC client)

**WebSocket binary** (chọn):
- Native browser support, mọi platform có lib
- Frame nhỏ (2-14 bytes header)
- TLS free qua wss://
- Có ping/pong built-in
- Debug được bằng Chrome DevTools, Wireshark

### Tại sao Binary (không phải JSON)?

JSON pros: dễ debug, human-readable.
JSON cons với hot path: tốn 3-5x bandwidth, parse chậm, GC pressure.

Binary pros:
- **Bandwidth nhỏ**: float32 chỉ 4 bytes, vs JSON `"x": 123.456789` ~20 bytes
- **Parse cực nhanh**: read 4 bytes thẳng vào float32, không string parsing
- **Không GC pressure**: không tạo string object trung gian
- **Type-safe**: schema cố định, sai field là sai compile time

Binary cons:
- Không debug bằng mắt được — phải có hex dump tool
- Phải sync schema 2 phía (Go + Java)
- Versioning phải tự design (chúng ta dùng PROTOCOL_VERSION header)

LibGDX (Java client) có `java.nio.ByteBuffer` built-in, encode/decode binary cực sạch. Nên binary là lựa chọn no-brainer cho hot path.

## 4. Tại sao chỉ port mỗi `player-move`?

NestJS WsGateway có ~25 message types. Phân loại theo độ phức tạp:

### Nhóm 1 — Hot path đơn giản (port Go đáng)
- `player-move` ← **CHỈ port cái này ở Phase 1**

Logic: validate → update Redis → broadcast. Đơn giản, traffic cao nhất, lợi ích port lớn nhất.

### Nhóm 2 — Logic vừa phải (port Go OK)
- `setMap`, `use-skill`, `cancel-skill`, `use-cosmetic`, `cancel-cosmetic`, `sync-my-state`, `player-chat`, `add-item`

Chỉ port khi đã chứng minh Phase 1 ổn định và có nhu cầu thực sự.

### Nhóm 3 — Logic phức tạp (KHÔNG port)
- `trade:*` (8 message types với 9 Redis keys + 2 Lua scripts)
- `uoc-rong-than` flow với cron + Redlock
- Notification, force_logout, NapTien event

Lý do không port:
- Code đã chạy ổn định nhiều tháng
- Lua script test kỹ, port sang Go = phải test lại từng race condition
- Trade flow sai = mất item user thật = mất uy tín
- Lợi ích port: gần như 0 (traffic thấp, không phải hot path)
- Risk port: cao (logic state machine phức tạp)

### Nguyên tắc: 80/20

Port 20% code chiếm 80% traffic. Còn lại để stack quen thuộc xử lý. **Đừng rewrite vì rewrite**.

## 5. Stack so sánh: trước và sau

### Trước

```
LibGDX Client (Java)
    │
    ├─── Socket.IO + JSON ───┐
    │                        ▼
    │              NestJS WsGateway
    │              ├── handleMove        ← bottleneck
    │              ├── handleSetMap
    │              ├── handleUseSkill
    │              ├── trade:*
    │              └── ...
    │                        │
    │                        ▼
    │                     Redis
```

### Sau

```
LibGDX Client (Java)
    │
    ├─── Socket.IO + JSON ───┐
    │   (master, login,      │
    │    trade, skill, etc)  ▼
    │              NestJS WsGateway
    │              ├── handleSetMap
    │              ├── handleUseSkill
    │              ├── trade:*
    │              └── ... (XÓA handleMove)
    │                        │
    │                        ▼
    │                     Redis ◄──────┐
    │                                  │
    └─── WebSocket + Binary ──┐        │
        (slave, CHỈ player-move)│       │
                                ▼      │
                          Go Service ──┘
                          (1 binary file,
                           không framework)
```

### Lifecycle 2 connection

- **Login**: client connect Socket.IO trước, lấy `gameSessionId`. Sau khi Socket.IO OK, mới connect Go.
- **Mất Socket.IO** → kill Go luôn (master/slave).
- **Mất Go** → retry Go 5 lần × 5s, KHÔNG động Socket.IO.
- **Logout**: disconnect cả 2.

## 6. Kiến trúc tổng thể

### Component diagram

```
┌────────────────────────────────────────────────────┐
│               LibGDX Client                        │
│  ┌──────────────────┐  ┌──────────────────────┐   │
│  │ GameSocket.java  │  │ GameSocketGo.java    │   │
│  │ (Socket.IO)      │  │ (WebSocket binary)   │   │
│  └────────┬─────────┘  └──────────┬───────────┘   │
└───────────┼───────────────────────┼───────────────┘
            │                       │
            │ JSON over WS          │ Binary over WS
            │                       │
            ▼                       ▼
   ┌────────────────┐      ┌────────────────┐
   │ NestJS         │      │ Go Service     │
   │ (Socket.IO)    │      │ (gorilla/ws)   │
   │ port 3009      │      │ port 3010      │
   └───────┬────────┘      └────────┬───────┘
           │                        │
           └────────┬───────────────┘
                    │
                    ▼
              ┌──────────┐
              │  Redis   │
              └──────────┘
```

### Data flow: 1 player move

```
1. Client A move ─────[binary 80B]────► Go Service
                                            │
                                            ├─► fire-and-forget update Redis
                                            │   (HSET GAME:PLAYER:1 ...)
                                            │
                                            └─► broadcast tới mọi conn cùng map
                                                                 │
2. Client B  ◄────[binary 90B]──────── Go Service ◄──────────────┘
3. Client C  ◄────[binary 90B]──────── Go Service
4. Client D  ◄────[binary 90B]──────── Go Service
```

**Quan trọng**: broadcast đi TRƯỚC, Redis update đi SAU (fire-and-forget). Lý do giải thích ở [section 13](#13-fire-and-forget-pattern-từ-nestjs-qua-go).

## 7. Go syntax cơ bản cho dev NestJS

Đây là phần quan trọng — nắm được syntax mới đọc hiểu được code. Mình so sánh với TypeScript/NestJS để dễ liên hệ.

### Khai báo biến

```go
// var với type
var name string = "Dang"

// := infer type (giống TypeScript const + auto type)
name := "Dang"

// const
const MAX_RETRY = 5
```

TypeScript:
```ts
let name: string = "Dang";
const name = "Dang";
const MAX_RETRY = 5;
```

### Function

```go
func add(a int, b int) int {
    return a + b
}

// Multiple return — Go đặc trưng
func divide(a, b int) (int, error) {
    if b == 0 {
        return 0, errors.New("division by zero")
    }
    return a / b, nil
}

// Caller phải xử lý cả 2 return
result, err := divide(10, 2)
if err != nil {
    log.Fatal(err)
}
```

TypeScript không có multiple return — phải dùng tuple hoặc object:
```ts
function divide(a: number, b: number): [number, Error | null] { ... }
const [result, err] = divide(10, 2);
```

### Struct (giống class nhưng không có inheritance)

```go
type User struct {
    ID   int64
    Name string
    Age  int
}

// Khởi tạo
u := User{ID: 1, Name: "Dang", Age: 25}

// Method gắn vào struct
func (u User) Greet() string {
    return "Hi " + u.Name
}

// Method với pointer receiver — modify struct
func (u *User) SetName(name string) {
    u.Name = name
}
```

TypeScript:
```ts
class User {
    constructor(public id: number, public name: string, public age: number) {}
    greet(): string { return "Hi " + this.name; }
    setName(name: string) { this.name = name; }
}
```

**Pointer (`*User`) vs Value (`User`)**:
- Value: copy struct khi pass vào function. An toàn nhưng tốn memory với struct lớn.
- Pointer: pass reference. Modify từ inside function ảnh hưởng outside.

### Interface (giống TypeScript interface, nhưng implicit implement)

```go
type Greeter interface {
    Greet() string
}

// User TỰ ĐỘNG implement Greeter vì có method Greet() string
// KHÔNG cần "implements Greeter" như Java/TS
```

TypeScript:
```ts
interface Greeter {
    greet(): string;
}
class User implements Greeter { ... }  // PHẢI khai báo implements
```

Đây là **duck typing static** của Go — ưu điểm là decoupling tốt.

### Error handling (KHÔNG có try-catch)

Go không có exception. Function trả về `error` là convention:

```go
data, err := os.ReadFile("config.json")
if err != nil {
    return fmt.Errorf("read config: %w", err)
}
// Dùng data
```

TypeScript:
```ts
try {
    const data = await fs.readFile("config.json");
    // Dùng data
} catch (err) {
    throw new Error("read config: " + err);
}
```

Go style trông verbose hơn, nhưng explicit — bạn biết EXACTLY chỗ nào có thể fail.

### Goroutine và channel (concurrency)

Đây là phần Go shine nhất:

```go
// Spawn goroutine — chạy song song, fire-and-forget
go doSomething()

// Channel — communicate giữa goroutine
ch := make(chan int, 10) // buffered channel, capacity 10

go func() {
    ch <- 42 // gửi
}()

value := <-ch // nhận
```

TypeScript tương đương dùng Promise/async, nhưng Go goroutine RẺ hơn rất nhiều — có thể tạo 1 triệu goroutine không sao, tạo 1 triệu Promise sẽ OOM.

### Package và import

Mỗi folder = 1 package. Tên package = tên folder (convention).

```go
// File: internal/config/config.go
package config

func Load() {...}
```

```go
// File khác:
import "myapp/internal/config"

func main() {
    config.Load()
}
```

Trong Go, **internal/** là magic folder — chỉ code trong cùng module mới import được. Đây là cách enforce private package.

### Defer (cleanup giống try-finally)

```go
func readFile() error {
    f, err := os.Open("file.txt")
    if err != nil {
        return err
    }
    defer f.Close() // Chạy KHI hàm return, dù success hay error

    // Dùng f
    return nil
}
```

TypeScript:
```ts
async function readFile() {
    const f = await fs.open("file.txt");
    try {
        // Dùng f
    } finally {
        await f.close();
    }
}
```

## 8. Cấu trúc thư mục Go

Go không có framework như NestJS. Không có module decorator, DI container, controller annotation. **Mọi thứ tự wire bằng tay** trong `main.go`.

Đây là điểm khác biệt lớn — quen rồi sẽ thấy đơn giản và explicit.

```
game-service-go/
├── cmd/
│   ├── api/
│   │   └── main.go              ← Entry point - wire mọi thứ
│   └── testclient/
│       └── main.go              ← CLI test client để debug
│
├── internal/
│   ├── config/
│   │   └── config.go            ← Load env vars
│   │
│   ├── app/
│   │   └── app.go               ← Bootstrap, khởi tạo dependency
│   │
│   ├── transport/
│   │   └── ws/                  ← WebSocket transport layer
│   │       ├── server.go        ← HTTP upgrader + handshake
│   │       ├── conn.go          ← Connection wrapper
│   │       ├── hub.go           ← Connection registry, broadcast
│   │       ├── handler.go       ← Route message theo msgType
│   │       └── auth.go          ← Verify JWT + gameSession
│   │
│   ├── game/
│   │   └── player/
│   │       └── service.go       ← Business logic move
│   │
│   ├── infra/
│   │   └── redis/
│   │       └── client.go        ← Redis client init
│   │
│   └── shared/
│       ├── protocol/
│       │   ├── codec.go         ← Binary encoder/decoder
│       │   ├── msgtype.go       ← Message type constants
│       │   └── codec_test.go    ← Unit test codec
│       │
│       ├── messages/
│       │   ├── handshake.go     ← Handshake message
│       │   └── player_move.go   ← PlayerMove + PlayerSync
│       │
│       └── enums/
│           └── trangthai.go     ← Enum trangthai (uint8 ↔ string)
│
├── go.mod                       ← Dependencies (giống package.json)
├── go.sum                       ← Lock file (giống package-lock.json)
├── Dockerfile                   ← Multi-stage build
└── .env.example
```

### Tại sao folder structure này?

**`cmd/`**: nơi chứa các binary entry. Mỗi sub-folder là 1 chương trình chạy được. `cmd/api` là server chính, `cmd/testclient` là tool test.

**`internal/`**: code business của riêng project này. Go enforce: package khác không import được `internal/`.

**`internal/transport/`**: layer giao tiếp với bên ngoài (WebSocket, HTTP, gRPC). Pattern hexagonal architecture.

**`internal/game/`**: domain logic. Tách khỏi transport để có thể test không cần WebSocket.

**`internal/infra/`**: integrate với hạ tầng (Redis, DB, queue). Tách để swap được implementation.

**`internal/shared/`**: types, enums, codec dùng chung nhiều layer.

So với NestJS:
- NestJS: `src/modules/user/{controller,service,dto,entity}.ts`
- Go: `internal/{transport/ws,game/player,shared/messages}/...`

Go tách theo layer (transport / domain / infra), NestJS tách theo feature (user / auth / order). Cả 2 đều OK.

## 9. Giải thích từng file

### `cmd/api/main.go` — Entry point

Đây là chỗ start chương trình. Tương đương `main.ts` của NestJS.

Trách nhiệm:
1. Load `.env`
2. Setup logger
3. Load config
4. Khởi tạo app (wire mọi dependency)
5. Start HTTP server
6. Đợi signal SIGTERM để graceful shutdown

NestJS tương đương:
```typescript
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(3000);
}
```

Go:
```go
func main() {
    _ = godotenv.Load()
    log := slog.New(slog.NewJSONHandler(os.Stdout, ...))
    cfg, _ := config.Load()
    a, _ := app.New(cfg, log)
    go a.Run()
    // ... wait signal, shutdown
}
```

Verbose hơn vì không có decorator, nhưng explicit — bạn thấy được mọi thứ chạy theo đúng thứ tự.

### `internal/config/config.go` — Config loader

Đọc env vars vào struct. Pattern này là **dependency injection thủ công**: load 1 lần, pass `*Config` xuống các module.

NestJS dùng `@nestjs/config`:
```typescript
constructor(private configService: ConfigService) {}
this.configService.get('JWT_SECRET');
```

Go:
```go
type Config struct {
    JWTSecret string
}
cfg := config.Load()
auth := NewAuthenticator(cfg.JWTSecret, ...)
```

### `internal/app/app.go` — Bootstrap

Wire dependency: tạo Redis client → Hub → Authenticator → Service → Handler → HTTP server. Đây là DI container thủ công.

NestJS dùng decorator `@Injectable()` + module imports tự động wire. Go thì viết tay nhưng bạn thấy được toàn bộ dependency graph trong 1 file.

### `internal/transport/ws/server.go` — HTTP upgrader

Nhận HTTP request, upgrade lên WebSocket, đọc handshake packet, verify auth, register vào Hub.

Tương đương `WsGateway` của NestJS — nhưng tách logic auth ra `auth.go`, logic broadcast ra `hub.go` để rõ ràng hơn.

### `internal/transport/ws/conn.go` — Connection wrapper

Wrap `*websocket.Conn` của gorilla. Mỗi connection có 2 goroutine:
- **readLoop**: đọc message từ client, dispatch tới handler
- **writeLoop**: đọc từ buffered channel `send`, ghi xuống socket

Tại sao 2 goroutine? Vì gorilla/websocket KHÔNG thread-safe — concurrent write từ 2 goroutine = panic. Pattern: tách read và write thành 2 goroutine, nơi khác muốn gửi → push vào channel.

```go
type Conn struct {
    ws     *websocket.Conn
    send   chan []byte // buffered, capacity 256
    userID int64
    mapID  string
}
```

NestJS Socket.IO ẩn pattern này — bạn `socket.emit()` là xong. Go phải làm tay.

### `internal/transport/ws/hub.go` — Connection registry

Quản lý:
- `connsByUser map[int64]*Conn` — lookup conn theo userID
- `roomsByMap map[string]map[*Conn]struct{}` — broadcast tới room

Method quan trọng:
- `register(c)` — thêm conn, kick conn cũ nếu user trùng
- `unregister(c)` — xóa khi disconnect
- `BroadcastToMap(mapID, data, exclude)` — gửi tới mọi conn trong map trừ exclude
- `SendToUser(userID, data)` — gửi point-to-point

Tương đương `this.server.to('room').emit()` của Socket.IO.

### `internal/transport/ws/handler.go` — Message dispatcher

Switch case theo msgType byte đầu tiên:

```go
switch msgType {
case protocol.MsgPlayerMove:
    h.handlePlayerMove(c, payload)
case protocol.MsgPing:
    h.handlePing(c, payload)
}
```

NestJS dùng decorator:
```typescript
@SubscribeMessage('player-move')
handleMove(...) {}
```

Go viết tay, nhưng bù lại bạn thấy được mọi event trong 1 file, không scatter ở nhiều decorator.

### `internal/transport/ws/auth.go` — Authentication

Verify JWT (cùng secret với NestJS) + check `user:${userId}:gameSession` trong Redis. Pattern y hệt `WsJwtGuard` của NestJS.

### `internal/game/player/service.go` — Business logic

Hàm `HandleMove`: nhận PlayerMove → update Redis HSET. Tách khỏi handler để test được không cần WebSocket.

### `internal/infra/redis/client.go` — Redis init

Khởi tạo `*redis.Client` từ URL, ping check. 1 dòng `redis.NewClient(opts)`.

### `internal/shared/protocol/codec.go` — Binary codec

Đây là phần học được nhiều nhất. Tự viết Encoder/Decoder bằng `binary.BigEndian`:

```go
func (e *Encoder) WriteFloat32(v float32) {
    e.buf = binary.BigEndian.AppendUint32(e.buf, math.Float32bits(v))
}

func (d *Decoder) ReadFloat32() (float32, error) {
    v, err := d.ReadUint32()
    return math.Float32frombits(v), err
}
```

`math.Float32bits` reinterpret float thành uint32 bits — không phải convert giá trị. Đây là kỹ thuật cơ bản của binary protocol.

### `internal/shared/messages/*.go` — Message structs

Mỗi file 1 message type với `Encode()` / `Decode()`. Schema cố định, sai field là sai compile.

```go
type PlayerMove struct {
    MapID string
    X, Y  float32
    // ...
}

func (m *PlayerMove) Decode(data []byte) error {
    d := protocol.NewDecoder(data)
    m.MapID, _ = d.ReadString()
    m.X, _ = d.ReadFloat32()
    m.Y, _ = d.ReadFloat32()
    // ...
}
```

### `internal/shared/enums/trangthai.go` — Enum mapping

Convert trangthai giữa Go uint8 và string (NestJS Redis lưu string, Java enum có name).

## 10. Binary protocol design

### Frame format

Mỗi WebSocket message:
```
[msgType: 1 byte] [payload: N bytes]
```

WebSocket đã handle length cho bạn — mỗi frame có boundary rõ ràng, không cần length prefix kiểu TCP raw.

### Byte order: Big Endian

Big Endian = MSB first = network byte order. Java `DataInputStream` mặc định, Go `binary.BigEndian` sẵn. Đừng dùng Little Endian — gây nhầm lẫn khi debug bằng Wireshark.

### Type encoding

| Type | Bytes | Notes |
|---|---|---|
| `uint8` | 1 | byte |
| `int8` | 1 | byte (-128..127) |
| `uint16` | 2 | BE |
| `int32` | 4 | BE, dùng cho ID nhỏ |
| `int64` | 8 | BE, dùng cho ID to (snowflake, timestamp) |
| `float32` | 4 | IEEE 754 BE, đủ cho position 2D |
| `bool` | 1 | 0 hoặc 1 |
| `string` | 2 + N | uint16 length + UTF-8 bytes |

### Message type codes

```
Client → Server: 0x01 - 0x7F
Server → Client: 0x80 - 0xFF
```

Tách 2 dải để hex dump nhìn vào biết hướng nào.

### Versioning

Byte đầu của HANDSHAKE chứa `PROTOCOL_VERSION uint16`. Server check, mismatch thì reject. Tăng version mỗi lần đổi schema breaking.

### Schema PlayerMove (client → server)

```
[0x01]                      msgType
[uint16 len] [bytes] mapID
[float32]    x
[float32]    y
[uint8]      trangthai (enum)
[int8]       dir
[uint16 len] [bytes] dau
[uint16 len] [bytes] than
[uint16 len] [bytes] chan
[float32]    timeChoHienBay
[float32]    lechDauX
[float32]    lechDauY
... (lechThanX/Y, lechChanX/Y, dangMangVanBay, tenVanBay, rong, cao, avatar)
```

Total ~80-150 bytes (tùy length string). So với JSON ~400-600 bytes → giảm 3-5x.

## 11. Implementation: Server (Go)

### Setup

```bash
go mod init game-service-go
go get github.com/gorilla/websocket
go get github.com/redis/go-redis/v9
go get github.com/golang-jwt/jwt/v5
go get github.com/joho/godotenv
```

`go.mod` tương đương `package.json`. `go.sum` tương đương `package-lock.json`.

### Run

```bash
go run ./cmd/api          # dev
go build -o bin/api ./cmd/api && ./bin/api  # production
go test ./...             # test toàn bộ
```

### Hub broadcast pattern (quan trọng)

```go
func (h *Hub) BroadcastToMap(mapID string, data []byte, excludeConn *Conn) {
    h.mu.RLock()
    room, ok := h.roomsByMap[mapID]
    if !ok {
        h.mu.RUnlock()
        return
    }

    // Copy danh sách conn ra slice để release lock SỚM.
    // Nếu giữ lock trong khi Send() → slow client làm chậm cả room.
    conns := make([]*Conn, 0, len(room))
    for c := range room {
        if c != excludeConn {
            conns = append(conns, c)
        }
    }
    h.mu.RUnlock()

    for _, c := range conns {
        c.Send(data) // non-blocking, push vào channel
    }
}
```

**Bài học**: trong concurrent code, **release lock càng sớm càng tốt**. Pattern "copy out then process" rất hữu dụng.

### Backpressure: kick slow client

```go
func (c *Conn) Send(data []byte) {
    select {
    case c.send <- data:
        // OK
    default:
        // Channel đầy → client quá chậm → kick
        c.Close()
    }
}
```

`select { case ... default: }` là non-blocking try-send. Nếu channel đầy, không block, đi vào default.

NestJS Socket.IO không có backpressure tốt — slow client làm chậm cả server. Go pattern này mạnh hơn.

## 12. Implementation: Client (Java/LibGDX)

### Setup `build.gradle`

```gradle
implementation 'org.java-websocket:Java-WebSocket:1.5.4'
```

### Connection lifecycle

```java
public class GameSocketGo {
    private static WebSocketClient client;
    private static volatile boolean handshakeOk = false;

    public static void connect(String token) {
        client = new WebSocketClient(URI.create("ws://server:3010/ws-game")) {
            @Override
            public void onOpen(ServerHandshake h) {
                sendHandshake(token);
            }

            @Override
            public void onMessage(ByteBuffer bytes) {
                handleBinaryMessage(bytes);
            }

            @Override
            public void onClose(int code, String reason, boolean remote) {
                if (!isManualDisconnect) scheduleReconnect();
            }
        };
        client.connect();
    }
}
```

### Encode handshake

```java
private static void sendHandshake(String token) {
    long userId = State_Management.getUserResponse().id;
    String sessionId = State_Management.gameSessionId;

    byte[] tokenBytes = token.getBytes(StandardCharsets.UTF_8);
    byte[] sessionBytes = sessionId.getBytes(StandardCharsets.UTF_8);

    int size = 1 + 2 + 8 + 2 + tokenBytes.length + 2 + sessionBytes.length;
    ByteBuffer buf = ByteBuffer.allocate(size).order(ByteOrder.BIG_ENDIAN);

    buf.put(MSG_HANDSHAKE);
    buf.putShort((short) PROTOCOL_VERSION);
    buf.putLong(userId);
    buf.putShort((short) tokenBytes.length);
    buf.put(tokenBytes);
    buf.putShort((short) sessionBytes.length);
    buf.put(sessionBytes);

    buf.flip();
    client.send(buf);
}
```

`ByteBuffer` của Java rất sạch — `putShort`, `putLong`, `putFloat` đều có sẵn. `flip()` chuyển buffer từ write mode sang read mode (set position về 0, limit về current position).

### Decode PlayerSync

```java
private static void handlePlayerSync(ByteBuffer buf) {
    long userId = buf.getLong();
    float x = buf.getFloat();
    float y = buf.getFloat();
    byte trangthai = buf.get();
    // ... đọc tuần tự theo schema

    // Convert sang JSONObject để gọi cùng handler với Socket.IO
    JSONObject data = new JSONObject();
    data.put("userId", userId);
    data.put("x", x);
    // ...

    WorldState.onPlayerSync(new Object[]{data}); // KHÔNG sửa WorldState
}
```

**Trick hay**: convert binary → JSONObject để gọi cùng callback với Socket.IO. Không phải sửa code game logic, chỉ swap lớp transport.

### Master/Slave lifecycle

```java
// Trong GameSocket.java (Socket.IO master)

socket.on(Socket.EVENT_CONNECT, args -> {
    // ... existing logic
    GameSocketGo.connect(token); // CONNECT slave sau khi master OK
});

socket.on(Socket.EVENT_DISCONNECT, args -> {
    GameSocketGo.disconnect(); // KILL slave khi master mất
    // ... existing logic
});

public static void guiPlayerMove(NhanVat nhanVat) {
    GameSocketGo.guiPlayerMove(nhanVat); // Forward to Go
}
```

## 13. Fire-and-forget pattern: từ NestJS qua Go

### NestJS pattern hiện tại

```typescript
@SubscribeMessage('player-move')
async handleMove(...) {
    this.redis.pipeline()
      .set(`dirty:${userId}`, ...)
      .hset(`GAME:PLAYER:${userId}`, ...)
      .exec();          // ← KHÔNG có await!

    this.server.to(`MAP:${map}`).emit('playerSync', ...);
}
```

`pipeline().exec()` trả Promise nhưng KHÔNG await. JS engine dispatch broadcast ngay, Redis write chạy background. **Đây là fire-and-forget** — đánh đổi durability lấy latency.

### Go tương đương

```go
func (h *Handler) handlePlayerMove(c *Conn, payload []byte) {
    var m messages.PlayerMove
    if err := m.Decode(payload); err != nil {
        return
    }

    if c.mapID != m.MapID {
        h.hub.MoveToRoom(c, m.MapID)
    }

    // === BROADCAST NGAY — không chờ Redis ===
    syncPacket := player.BuildSyncPacket(c.userID, &m)
    h.hub.BroadcastToMap(m.MapID, syncPacket, c)

    // === FIRE-AND-FORGET Redis update ===
    go func(userID int64, move messages.PlayerMove) {
        ctx, cancel := context.WithTimeout(context.Background(), 1*time.Second)
        defer cancel()
        if err := h.playerService.HandleMove(ctx, userID, &move); err != nil {
            h.log.Warn("redis update failed", "err", err, "userID", userID)
        }
    }(c.userID, m)
}
```

### 3 điểm quan trọng

**1. Broadcast TRƯỚC, Redis SAU**

Latency hot path = network + decode + broadcast. KHÔNG bao gồm Redis write. User cảm nhận instant.

**2. Goroutine pass by VALUE**

```go
go func(userID int64, move messages.PlayerMove) { ... }(c.userID, m)
                                ^^^^^^^^^^^^^^^^^^
                                Pass by value — copy struct
```

Pass by value an toàn vì goroutine có copy riêng. Nếu pass `*PlayerMove`, lần handler tiếp theo overwrite `m` → goroutine cũ thấy data mới → race condition.

**3. Context với timeout**

```go
ctx, cancel := context.WithTimeout(context.Background(), 1*time.Second)
defer cancel()
```

Nếu Redis chậm > 1s → cancel context → goroutine return → tránh backlog.

### Trade-off

**Lợi**: latency giảm 1-5ms (không chờ Redis).

**Hại**: nếu server crash giữa lúc broadcast và Redis write → mất state. Player A thấy player B ở vị trí mới (qua broadcast), nhưng Redis vẫn lưu vị trí cũ. Khi player C join map sau, đọc snapshot từ Redis, thấy B ở vị trí cũ.

**Tại sao trade-off này OK**:
- Crash là hiếm
- Mất 1-2 giây position khi crash là acceptable cho game
- NestJS có dirty flag + cron 20s flush DB, đủ recovery
- User cảm nhận latency mỗi packet > đôi khi mất 1 packet

### Pattern tối ưu hơn (Phase tiếp theo)

Hiện tại spawn goroutine mỗi packet → 5k-20k goroutine spawn/s. Tốt hơn:

**Worker pool pattern**:
```go
type RedisQueue struct {
    ch chan UpdateJob
}

// Init: spawn N worker
for i := 0; i < 10; i++ {
    go worker(rq.ch)
}

// Handler chỉ push vào channel
rq.ch <- UpdateJob{userID, m}
```

**Batch flush pattern** (tối ưu nhất):
```go
// In-memory map[userID]Position
// Goroutine flush mỗi 100ms bằng pipeline
// Giảm Redis QPS 100x
```

Khi nào cần làm? Khi metrics cho thấy goroutine spawn > 50k/s hoặc Redis QPS > 50% capacity. Hiện tại pattern đơn giản đủ dùng.

## 14. Metrics và benchmark

### Đo end-to-end latency (client side)

Add Ping/Pong message vào protocol:

```
Client gửi:  [0x02][int64 clientTimestampNanos]
Server reply: [0x83][int64 clientTs][int64 serverTs]
Client tính: rtt = now - clientTs, latency ≈ rtt / 2
```

Java code mẫu:
```java
public static void sendPing() {
    long now = System.nanoTime();
    ByteBuffer buf = ByteBuffer.allocate(9).order(ByteOrder.BIG_ENDIAN);
    buf.put(MSG_PING);
    buf.putLong(now);
    buf.flip();
    client.send(buf);
}

private static void handlePong(ByteBuffer buf) {
    long clientTs = buf.getLong();
    long rtt = System.nanoTime() - clientTs;
    long latencyMs = rtt / 2_000_000;
    System.out.println("Latency: " + latencyMs + "ms");
}
```

Trong game loop gọi `sendPing()` mỗi 2 giây. So sánh với Socket.IO ack.

### Đo server-side processing time

```go
func (h *Handler) handlePlayerMove(c *Conn, payload []byte) {
    start := time.Now()
    defer func() {
        elapsed := time.Since(start)
        if elapsed > 5*time.Millisecond {
            h.log.Warn("slow move", "elapsed_ms", elapsed.Milliseconds())
        }
    }()
    // ... rest
}
```

### Kỳ vọng kết quả

Trên cùng mạng/máy:

| Metric | Socket.IO + NestJS | Go binary |
|---|---|---|
| Latency p50 | 8-20 ms | 3-8 ms |
| Latency p99 (peak) | 50-200 ms | 5-15 ms |
| Bandwidth/move | 400-600 bytes | 80-150 bytes |
| Server CPU per 1k CCU | 30-60% | 5-15% |
| RAM per 1k CCU | 500MB-1GB | 50-200MB |

**Sự khác biệt thật ở p99** (tail latency). Khi server đông user, Node event loop bị queue → p99 spike, Go vẫn smooth nhờ goroutine model.

### Production observability (gợi ý)

Setup Prometheus + Grafana:

```go
import "github.com/prometheus/client_golang/prometheus"

var (
    moveLatency = prometheus.NewHistogramVec(
        prometheus.HistogramOpts{
            Name:    "player_move_duration_seconds",
            Buckets: prometheus.ExponentialBuckets(0.0001, 2, 15),
        },
        []string{},
    )
)

// Trong handler:
timer := prometheus.NewTimer(moveLatency.WithLabelValues())
defer timer.ObserveDuration()
```

Expose `/metrics` endpoint, Prometheus scrape, Grafana dashboard. Đây là cách "professional" hơn nhiều so với log raw.

## 15. Common pitfalls và bài học

### Pitfall 1: import cycle

Lỗi: `package A imports package B imports package A`

Fix: tách interface ra package thứ 3 (vd `shared`).

### Pitfall 2: forgot pointer receiver

```go
func (u User) SetName(name string) { u.Name = name }  // SAI — u là copy, không modify được

func (u *User) SetName(name string) { u.Name = name } // ĐÚNG — pointer
```

### Pitfall 3: nil channel hoặc closed channel

```go
ch := make(chan int)
close(ch)
ch <- 1 // panic: send on closed channel
```

Fix: dùng `sync.Once` hoặc flag để close 1 lần.

### Pitfall 4: goroutine leak

```go
for {
    go doWork() // spawn vô tận, không bao giờ stop
}
```

Fix: dùng `context.Context` để cancel, hoặc worker pool có limit.

### Pitfall 5: race condition khi pass by pointer cho goroutine

```go
go func(m *Move) { ... }(&m) // SAI — m có thể bị overwrite
go func(m Move) { ... }(m)   // ĐÚNG — copy struct
```

### Pitfall 6: forgot defer cancel

```go
ctx, cancel := context.WithTimeout(...)
// THIẾU defer cancel() → resource leak
```

Always pair `WithTimeout` với `defer cancel()`.

### Pitfall 7: WebSocket concurrent write

```go
// Gorilla websocket KHÔNG thread-safe
go conn.WriteMessage(...) // goroutine 1
go conn.WriteMessage(...) // goroutine 2 → PANIC
```

Fix: dùng send channel + 1 writeLoop goroutine duy nhất.

### Bài học rút ra

1. **Explicit > Magic**: Go verbose hơn NestJS nhưng bạn thấy mọi thứ. Khi debug production, không có gì ẩn.

2. **Fail fast**: Go convention là return error sớm. Nested if-err-return nhìn xấu nhưng dễ trace.

3. **Pass value, not pointer**: trừ khi cần modify hoặc struct quá lớn. Goroutine với pointer là race condition trap.

4. **Lock càng ngắn càng tốt**: copy data ra ngoài lock trước khi process.

5. **Channel = pipe giữa goroutine**: không phải callback. Tư duy như Unix pipe.

6. **Test concurrency với `-race`**: `go test -race ./...` detect race condition.

## 16. Phụ lục: Go vs Node.js cheat sheet

| Concept | Node.js / NestJS | Go |
|---|---|---|
| Package manager | `npm install` | `go get` |
| Manifest | `package.json` | `go.mod` |
| Lock file | `package-lock.json` | `go.sum` |
| Run script | `npm run dev` | `go run ./cmd/api` |
| Build | `tsc` | `go build` |
| Test | `jest` | `go test ./...` |
| Async | `async/await`, Promise | goroutine + channel |
| Concurrency | Event loop (single thread) | Goroutine (M:N scheduler) |
| Error handling | `try/catch`, throw | Return `error`, no throw |
| Class | `class` | `struct` + method |
| Inheritance | `extends` | Embed (composition) |
| Interface | `interface` (declarative) | `interface` (implicit implement) |
| Module | ES modules / CommonJS | Package per folder |
| Decorator | `@Injectable()` | Không có — wire tay |
| DI | NestJS module | Manual constructor injection |
| HTTP framework | Express, NestJS | `net/http` (built-in) |
| WebSocket | `socket.io`, `ws` | `gorilla/websocket` |
| ORM | Prisma, TypeORM | `gorm`, `sqlx`, hoặc raw SQL |
| Logger | Winston, pino | `log/slog` (built-in từ 1.21) |
| Config | `dotenv`, `@nestjs/config` | `os.Getenv` + `godotenv` |
| Process | Single process, multi-thread offload | Multi-goroutine native |
| GC | V8 (generational, ~10-100ms pause) | Go GC (concurrent, <1ms pause) |
| Memory per concurrent unit | ~1KB Promise + closures | 2KB goroutine stack |
| Hot reload | `nodemon`, `ts-node-dev` | `air`, `reflex` |
| Static binary | Không (cần Node.js runtime) | Có (1 file deploy) |
| Docker image size | 100-500 MB (Node + deps) | 10-30 MB (binary + alpine) |

### Mindset shift

**Từ Node sang Go**:
- Đừng tìm decorator — wire bằng tay
- Đừng tìm async/await — goroutine + channel
- Đừng tìm class inheritance — composition
- Đừng tìm exception — error return value
- Đừng cố ép Go thành NestJS — học Go pattern thật

**Khi nào dùng Go**:
- Hot path I/O concurrent (proxy, gateway, realtime)
- CPU-bound tasks (parsing, compression)
- Memory-constrained service
- Cần static binary deploy

**Khi nào KHÔNG dùng Go**:
- CRUD nhiều business rule (NestJS gọn hơn)
- Cần ecosystem mạnh (image processing, ML, payment SDK)
- Team không quen Go (cost training cao)
- Prototype nhanh (NestJS có CLI generator)

---

## Kết luận

Port `player-move` từ NestJS sang Go là quyết định **right-sized**: tối đa lợi ích (3-10x performance), tối thiểu rủi ro (chỉ 1 message type, không động trade/skill phức tạp).

Pattern "extract hot path" này áp dụng được cho nhiều use case:
- Realtime gateway (chat, gaming, IoT)
- API gateway (rate limit, routing)
- Stream processing (Kafka consumer, log shipper)

Khi build hệ thống lớn, đừng sợ polyglot. **Right tool for the job** — NestJS tốt cho business, Go tốt cho hot path. Hai stack chung sống tốt qua Redis pub/sub + gRPC.

---

**Tài liệu tham khảo**:
- [Effective Go](https://go.dev/doc/effective_go)
- [Go Concurrency Patterns](https://go.dev/blog/pipelines)
- [Gorilla WebSocket docs](https://pkg.go.dev/github.com/gorilla/websocket)
- [Java NIO ByteBuffer](https://docs.oracle.com/javase/8/docs/api/java/nio/ByteBuffer.html)