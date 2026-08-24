# Go cho dev mới — Đọc hiểu game-service-go

> Tài liệu này dạy Go từ con số 0 thông qua chính source code `game-service-go`. Không cần học Go riêng trước. Sau khi đọc xong, bạn sẽ hiểu được toàn bộ codebase và có thể tự sửa/mở rộng.

---

## Mục lục

1. [Trước khi đọc — Go khác gì TypeScript/Java](#1-trước-khi-đọc--go-khác-gì-typescriptjava)
2. [Cấu trúc project](#2-cấu-trúc-project)
3. [Thứ tự đọc file](#3-thứ-tự-đọc-file)
4. [Syntax Go cơ bản (qua code thật)](#4-syntax-go-cơ-bản-qua-code-thật)
5. [Đọc từng file một](#5-đọc-từng-file-một)
6. [Concurrency — goroutine và channel](#6-concurrency--goroutine-và-channel)
7. [Pattern Go đặc trưng (vs Nest)](#7-pattern-go-đặc-trưng-vs-nest)
8. [Pitfall thường gặp khi mới học](#8-pitfall-thường-gặp-khi-mới-học)
9. [Tooling và workflow](#9-tooling-và-workflow)
10. [Cheatsheet — tra nhanh khi quên](#10-cheatsheet--tra-nhanh-khi-quên)

---

## 1. Trước khi đọc — Go khác gì TypeScript/Java

Trước khi nhìn code, hiểu mindset Go khác các ngôn ngữ khác:

### Go là ngôn ngữ "ít magic"

Go cố tình thiếu nhiều thứ mà TS/Java có:
- **Không có class** — chỉ có `struct` (data) và method gắn vào struct
- **Không có inheritance** — chỉ có composition (nhúng struct vào struct)
- **Không có generics phức tạp** (Go 1.18+ có generics nhưng đơn giản)
- **Không có exception** — error là return value bình thường
- **Không có decorator** — chỉ có function thường
- **Không có DI framework như Nest** — wire dependency thủ công ở `main()`

Mới đầu nhìn sẽ thấy Go "thô", nhưng chính sự thô này làm Go cực kỳ đơn giản và rõ ràng. **Code Go đọc 1 lần là hiểu**, không cần biết 50 decorator của framework.

### Tóm tắt mapping mental model

| TypeScript/Nest | Go |
|---|---|
| `class User { ... }` | `type User struct { ... }` |
| `class UserService { constructor(...) }` | `func NewUserService(...) *UserService` |
| `interface IUser { ... }` | `type IUser interface { ... }` |
| `extends`, `implements` | composition (không có inheritance) |
| `try/catch` | `if err != nil { return err }` |
| `async function` | `go func() { ... }()` |
| `Promise<T>` | không có, dùng channel hoặc sync return |
| `EventEmitter.emit(...)` | gửi vào `channel` |
| `npm install xxx` | `go get github.com/.../xxx` |
| `package.json` | `go.mod` |
| `node_modules/` | không có (Go cache global) |
| `tsc` build | `go build` |
| `import` | `import` (giống nhưng dùng đường dẫn full) |
| `export` | viết hoa chữ đầu = export, viết thường = private |

### Triết lý Go nổi tiếng

> "Don't communicate by sharing memory; share memory by communicating."

Nghĩa là: thay vì nhiều thread share biến rồi lock/unlock, dùng channel để gửi data giữa các goroutine. Bạn sẽ thấy pattern này trong file `ws/conn.go`.

---

## 2. Cấu trúc project

```
game-service-go/
├── cmd/
│   └── api/
│       └── main.go              ← Entry point
├── internal/
│   ├── app/
│   │   └── app.go               ← Wire dependencies, lifecycle
│   ├── config/
│   │   └── config.go            ← Load env vars
│   ├── infra/
│   │   └── redis/
│   │       └── redis.go         ← Init Redis client
│   ├── shared/
│   │   ├── enums/
│   │   │   └── trangthai.go     ← Enum trạng thái
│   │   ├── messages/
│   │   │   ├── handshake.go     ← Định nghĩa message handshake
│   │   │   └── player_move.go   ← Định nghĩa message move
│   │   └── protocol/
│   │       ├── codec.go         ← Encoder/Decoder binary
│   │       ├── codec_test.go    ← Test codec
│   │       └── msgtype.go       ← Hằng số msgType
│   ├── transport/
│   │   └── ws/
│   │       ├── server.go        ← HTTP upgrade WebSocket
│   │       ├── conn.go          ← Wrap connection
│   │       ├── hub.go           ← Quản lý connection
│   │       ├── handler.go       ← Route message
│   │       └── auth.go          ← Verify JWT
│   └── game/
│       └── player/
│           └── service.go       ← Business logic player
├── go.mod                       ← Manifest dependency
├── go.sum                       ← Lock file
├── Makefile                     ← Shortcut command
└── .air.toml                    ← Hot reload config
```

### Quy ước thư mục Go

- `cmd/`: chứa các binary có thể chạy (mỗi folder con là 1 binary). Ở đây có `api`.
- `internal/`: code chỉ project này dùng được, package khác `import` vào không được. Đây là cơ chế **package private** ở mức folder.
- `pkg/` (không có ở đây): nếu có, là code public cho project khác dùng.

**Nguyên tắc Go:** Mỗi folder = 1 package. Không có "barrel file" như TS (`index.ts`). File trong cùng folder share package name.

---

## 3. Thứ tự đọc file

Đây là thứ tự khuyến nghị để hiểu codebase từ ngoài vào trong:

### Lượt 1 — Hiểu lifecycle (đọc nhanh, không cần hiểu hết)

1. **`cmd/api/main.go`** — entry point, app start ở đây
2. **`internal/app/app.go`** — wire mọi dependency
3. **`internal/config/config.go`** — load config

### Lượt 2 — Hiểu protocol (binary encoding)

4. **`internal/shared/protocol/msgtype.go`** — hằng số message type
5. **`internal/shared/protocol/codec.go`** — encoder/decoder byte-level
6. **`internal/shared/messages/handshake.go`** — message struct đơn giản
7. **`internal/shared/messages/player_move.go`** — message struct phức tạp hơn

### Lượt 3 — Hiểu WebSocket layer

8. **`internal/transport/ws/server.go`** — HTTP upgrade WS
9. **`internal/transport/ws/conn.go`** — wrap connection, 2 goroutine read/write
10. **`internal/transport/ws/hub.go`** — quản lý connection theo map
11. **`internal/transport/ws/auth.go`** — verify JWT
12. **`internal/transport/ws/handler.go`** — route message

### Lượt 4 — Hiểu business logic

13. **`internal/game/player/service.go`** — logic xử lý move
14. **`internal/shared/enums/trangthai.go`** — enum

### Lượt 5 — Test và tooling

15. **`internal/shared/protocol/codec_test.go`** — học cách viết test Go
16. **`Makefile`** — shortcut
17. **`.air.toml`** — hot reload

---

## 4. Syntax Go cơ bản (qua code thật)

### 4.1 Khai báo package và import

```go
package main

import (
    "context"
    "log/slog"
    "os"

    "github.com/joho/godotenv"
    "github.com/DANG-PH/game-service-go/internal/config"
)
```

- Mỗi file Go phải bắt đầu bằng `package <tên>`
- File trong cùng folder có cùng package name
- `package main` đặc biệt — chỉ package `main` mới có hàm `main()` để chạy
- Import dùng full path (giống Java, không phải relative như Node)
- Import nhiều dòng dùng dấu `()` bao quanh

### 4.2 Khai báo biến

```go
// Cách 1: explicit type
var x int = 5
var name string = "Goku"

// Cách 2: short declaration (chỉ trong function)
x := 5           // type int suy luận tự động
name := "Goku"   // type string suy luận tự động

// Cách 3: explicit nhưng không gán (zero value)
var x int      // x = 0
var name string // name = ""
var done bool   // done = false
```

→ Bạn sẽ thấy `:=` rất nhiều trong code. Đây là cú pháp Go đặc trưng.

### 4.3 Hàm

```go
// Hàm không trả gì
func sayHello(name string) {
    fmt.Println("Hello", name)
}

// Hàm trả 1 giá trị
func add(a, b int) int {
    return a + b
}

// Hàm trả NHIỀU giá trị — ĐẶC TRƯNG GO
func divide(a, b float64) (float64, error) {
    if b == 0 {
        return 0, errors.New("divide by zero")
    }
    return a / b, nil
}

// Cách dùng
result, err := divide(10, 2)
if err != nil {
    // xử lý lỗi
}
```

**Multi-return value là core của Go.** Pattern `(value, error)` thay thế cho exception. Mỗi lần gọi hàm có thể fail, bạn check `err != nil` ngay tại chỗ.

### 4.4 Struct và Method

```go
// Định nghĩa struct
type User struct {
    ID    int
    Name  string
    Email string
}

// Tạo instance
u := User{ID: 1, Name: "Goku", Email: "goku@example.com"}

// Hoặc
u := &User{ID: 1, Name: "Goku"}  // & = lấy pointer

// Method gắn vào struct
// (u *User) là "receiver" — giống `this` trong TS nhưng explicit
func (u *User) Greet() string {
    return "Hello, I'm " + u.Name
}

// Cách gọi
u.Greet()
```

**Method receiver có 2 loại:**
- `func (u *User) ...` — pointer receiver, có thể sửa data
- `func (u User) ...` — value receiver, copy ra, không sửa được

→ Trong code project này, hầu hết dùng pointer receiver vì cần sửa state.

### 4.5 Constructor pattern

Go không có `constructor` keyword. Convention:

```go
// Tên hàm bắt đầu bằng "New" + tên struct
func NewUser(name, email string) *User {
    return &User{
        Name:  name,
        Email: email,
    }
}

// Dùng
u := NewUser("Goku", "goku@example.com")
```

Bạn sẽ thấy: `NewService`, `NewHub`, `NewConn`, `NewAuthenticator`, ... đều theo pattern này. Đây là DI thủ công — không có `@Injectable` magic.

### 4.6 Interface — implicit implementation

Đây là điểm Go khác hoàn toàn TS/Java:

```go
type Animal interface {
    Sound() string
}

type Dog struct{}

// KHÔNG cần "implements Animal"
// Chỉ cần Dog có method Sound() là tự động implement Animal
func (d *Dog) Sound() string {
    return "Woof"
}

// Có thể dùng như Animal
var a Animal = &Dog{}
a.Sound() // "Woof"
```

→ Trong code: `MessageHandler` interface trong `conn.go`:

```go
type MessageHandler interface {
    Handle(conn *Conn, data []byte)
}
```

Bất kỳ struct nào có method `Handle(conn *Conn, data []byte)` đều **tự động** là `MessageHandler`. Không cần khai báo `implements`. `Handler` struct trong `handler.go` có method này nên nó là `MessageHandler`.

### 4.7 Error handling

```go
// Hàm trả error
func loadConfig() (*Config, error) {
    data, err := os.ReadFile("config.json")
    if err != nil {
        return nil, fmt.Errorf("read file: %w", err)  // wrap error
    }
    
    var cfg Config
    if err := json.Unmarshal(data, &cfg); err != nil {
        return nil, fmt.Errorf("parse json: %w", err)
    }
    
    return &cfg, nil
}

// Cách dùng
cfg, err := loadConfig()
if err != nil {
    log.Fatal(err)
}
```

`%w` là verb đặc biệt cho `fmt.Errorf` — wrap error gốc vào error mới, có thể `errors.Unwrap` ra sau.

### 4.8 Slice và Map

```go
// Slice = dynamic array (giống Array trong TS)
nums := []int{1, 2, 3}
nums = append(nums, 4)  // [1, 2, 3, 4]
fmt.Println(len(nums))   // 4

// Tạo slice rỗng với capacity hint (tối ưu)
nums := make([]int, 0, 100)  // length 0, capacity 100

// Map = giống object/Map trong TS
ages := map[string]int{
    "Goku":  30,
    "Vegeta": 32,
}
ages["Trunks"] = 18

// Check key tồn tại
age, ok := ages["Goku"]
if ok {
    fmt.Println(age)
}
```

→ Trong `hub.go`:
```go
connsByUser map[int32]*Conn               // userID → connection
roomsByMap  map[string]map[*Conn]struct{} // mapID → set of conn
```

`map[*Conn]struct{}` là pattern Go cho **set** — không có Set struct built-in, dùng map với value rỗng (`struct{}` không tốn memory).

### 4.9 Defer

```go
func readFile() error {
    f, err := os.Open("file.txt")
    if err != nil {
        return err
    }
    defer f.Close()  // chạy KHI hàm return, dù return ở đâu

    // đọc file ...
    return nil
}
```

`defer` push function vào stack, execute khi function chứa nó return. Tương đương `try { ... } finally { f.close() }` trong Java.

→ Trong `conn.go`:
```go
defer func() {
    c.hub.unregister(c)
    c.Close()
}()
```

Khi `readLoop` return (vì client disconnect), defer chạy, cleanup connection.

---

## 5. Đọc từng file một

### 5.1 `cmd/api/main.go` — Entry point

```go
package main

func main() {
    // Load .env
    _ = godotenv.Load()

    // Logger - JSON cho production
    log := slog.New(slog.NewJSONHandler(os.Stdout, ...))

    // Load config
    cfg, err := config.Load()
    if err != nil {
        log.Error("config load failed", "err", err)
        os.Exit(1)
    }

    // Init app
    a, err := app.New(cfg, log)
    if err != nil {
        log.Error("app init failed", "err", err)
        os.Exit(1)
    }

    // Run trong goroutine
    errCh := make(chan error, 1)
    go func() {
        errCh <- a.Run()
    }()

    // Đợi signal SIGINT/SIGTERM
    sigCh := make(chan os.Signal, 1)
    signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

    select {
    case sig := <-sigCh:
        log.Info("signal received", "signal", sig.String())
    case err := <-errCh:
        log.Error("server failed", "err", err)
        os.Exit(1)
    }

    // Graceful shutdown với timeout 10s
    ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
    defer cancel()
    a.Shutdown(ctx)
}
```

#### Khái niệm mới ở đây

**`chan` (channel) — pipe truyền data giữa goroutine:**

```go
errCh := make(chan error, 1)  // buffered channel, sức chứa 1
errCh <- a.Run()              // gửi vào channel
err := <-errCh                // nhận từ channel
```

**`select` — chờ nhiều channel cùng lúc:**

```go
select {
case sig := <-sigCh:    // nếu có signal
    // xử lý signal
case err := <-errCh:    // nếu server fail
    // xử lý error
}
```

`select` chờ tới khi 1 trong các case sẵn sàng, rồi chạy case đó. Đây là cốt lõi của Go concurrency.

**Pattern graceful shutdown:**

1. Run server trong goroutine riêng
2. Chờ signal (Ctrl+C) hoặc server fail
3. Khi có signal → call `Shutdown(ctx)` với timeout
4. Server đợi connection hiện tại xong rồi mới close

So với Nest: Nest cũng có `app.enableShutdownHooks()`, concept giống nhưng Go phải tự viết.

---

### 5.2 `internal/config/config.go` — Load env vars

```go
type Config struct {
    HTTPPort  string
    RedisURL  string
    JWTSecret string
    LogLevel  string
}

func Load() (*Config, error) {
    cfg := &Config{
        HTTPPort:  getEnv("HTTP_PORT", "3001"),
        RedisURL:  getEnv("REDIS_URL", "redis://localhost:6379"),
        JWTSecret: os.Getenv("JWT_SECRET"),
        LogLevel:  getEnv("LOG_LEVEL", "info"),
    }

    if cfg.JWTSecret == "" {
        return nil, fmt.Errorf("JWT_SECRET is required")
    }

    return cfg, nil
}
```

So với Nest `@nestjs/config`:
- Nest: `ConfigModule.forRoot()`, inject `ConfigService`, validate qua schema
- Go: tự viết struct, đọc `os.Getenv`, validate trong `Load()`

Đơn giản hơn rất nhiều, không có magic. Trade-off: viết tay nhiều hơn.

---

### 5.3 `internal/shared/protocol/codec.go` — Binary encoder/decoder

Đây là file quan trọng nhất để hiểu protocol game. Game gửi/nhận **binary** thay vì JSON để tiết kiệm băng thông (giảm 3-5x).

```go
type Encoder struct {
    buf []byte
}

func NewEncoder(msgType uint8) *Encoder {
    buf := make([]byte, 0, 64)  // length 0, capacity 64
    buf = append(buf, msgType)
    return &Encoder{buf: buf}
}

func (e *Encoder) WriteUint16(v uint16) {
    e.buf = binary.BigEndian.AppendUint16(e.buf, v)
}

func (e *Encoder) WriteFloat32(v float32) {
    // Float32 → uint32 bits → 4 bytes BigEndian
    e.buf = binary.BigEndian.AppendUint32(e.buf, math.Float32bits(v))
}
```

#### Khái niệm cần hiểu

**Byte order (BigEndian vs LittleEndian):**

Số `0x12345678` (4 byte) lưu trong memory:
- BigEndian: `12 34 56 78` (byte cao trước)
- LittleEndian: `78 56 34 12` (byte thấp trước)

Game protocol dùng BigEndian (network byte order). Java `DataInputStream` cũng dùng BigEndian, nên dễ tương thích với Java client.

**Float32 → uint32 bits:**

Float32 trong memory cũng là 4 byte, nhưng cách diễn giải khác. `math.Float32bits` lấy raw 4 byte mà không convert giá trị. Đây là cách chuẩn để serialize float qua network.

**String encoding:**

```go
func (e *Encoder) WriteString(s string) error {
    if len(s) > 65535 {
        return ErrStringTooLong
    }
    e.WriteUint16(uint16(len(s)))  // 2 byte length prefix
    e.buf = append(e.buf, s...)    // sau đó là raw bytes
    return nil
}
```

Format: `[uint16 length][N bytes UTF-8]`. Đọc length trước → biết đọc tiếp bao nhiêu byte.

**Decoder pattern — đọc tuần tự:**

```go
type Decoder struct {
    buf []byte
    pos int  // con trỏ vị trí hiện tại
}

func (d *Decoder) ReadUint16() (uint16, error) {
    if d.Remaining() < 2 {
        return 0, ErrBufferTooShort
    }
    v := binary.BigEndian.Uint16(d.buf[d.pos:])
    d.pos += 2  // advance pointer
    return v, nil
}
```

**Quy tắc vàng:** Thứ tự `Read` phải khớp với thứ tự `Write` ở phía gửi. Sai 1 field là toàn bộ message sai.

---

### 5.4 `internal/shared/messages/player_move.go` — Message struct

```go
type PlayerMove struct {
    MapID          string
    X              float32
    Y              float32
    Trangthai      uint8
    // ... nhiều field nữa
}

func (m *PlayerMove) Decode(data []byte) error {
    d := protocol.NewDecoder(data)
    var err error

    if m.MapID, err = d.ReadString(); err != nil {
        return err
    }
    if m.X, err = d.ReadFloat32(); err != nil {
        return err
    }
    // ...
    return nil
}
```

#### Pattern đọc nhiều field

```go
if m.X, err = d.ReadFloat32(); err != nil {
    return err
}
```

Đây là cú pháp Go: assign + check error trong cùng `if`. Tương đương:

```go
m.X, err = d.ReadFloat32()
if err != nil {
    return err
}
```

Viết gọn lại để code ngắn hơn. Tuy lặp lại nhiều dòng, nhưng đây là Go style chuẩn — explicit hơn là dùng macro/decorator.

---

### 5.5 `internal/transport/ws/conn.go` — Wrap WebSocket connection

Đây là file phức tạp nhất, chứa pattern concurrency quan trọng nhất.

```go
type Conn struct {
    ws  *websocket.Conn
    hub *Hub
    log *slog.Logger

    userID int32
    mapID  string

    send chan []byte           // buffered channel cho outbound message

    closeOnce sync.Once         // đảm bảo close chỉ chạy 1 lần
}
```

#### Pattern 2 goroutine cho 1 connection

```go
// Trong server.go:
go conn.writeLoop()        // goroutine 1: ghi
conn.readLoop(s.handler)   // goroutine 2: đọc (chạy trong goroutine của ServeHTTP)
```

**Tại sao 2 goroutine?**

Gorilla WebSocket library KHÔNG thread-safe — concurrent write từ 2 goroutine = panic. Pattern chuẩn:

- 1 goroutine **read**: gọi `conn.ReadMessage()`, nhận data từ client
- 1 goroutine **write**: gọi `conn.WriteMessage()`, gửi data tới client

Goroutine khác muốn gửi tin → push vào `send channel`, write goroutine pick lên và gửi.

```go
func (c *Conn) Send(data []byte) {
    select {
    case c.send <- data:        // gửi vào channel
    default:                    // channel đầy → kick client (slow client)
        c.Close()
    }
}
```

**`select` với `default`:**

`select` thông thường chờ tới khi 1 case sẵn sàng. Có `default` thì:
- Nếu có case nào sẵn sàng → chạy case đó
- Nếu không → chạy `default` ngay (không chờ)

→ Đây là **non-blocking send**. Nếu channel đầy (256 item), không chờ — kick client luôn. Đây là **backpressure** — không để slow client làm chậm cả hệ thống.

#### `sync.Once` — đảm bảo chạy đúng 1 lần

```go
closeOnce sync.Once

func (c *Conn) Close() {
    c.closeOnce.Do(func() {
        close(c.send)
        c.ws.Close()
    })
}
```

`Close()` có thể được gọi nhiều lần từ nhiều goroutine khác nhau. `sync.Once.Do(f)` đảm bảo `f` chỉ chạy **đúng 1 lần** dù gọi 1000 lần.

#### `select` trong write loop

```go
func (c *Conn) writeLoop() {
    ticker := time.NewTicker(pingPeriod)
    defer ticker.Stop()

    for {
        select {
        case message, ok := <-c.send:
            if !ok {
                return  // channel closed
            }
            c.ws.WriteMessage(websocket.BinaryMessage, message)

        case <-ticker.C:
            // Ping định kỳ
            c.ws.WriteMessage(websocket.PingMessage, nil)
        }
    }
}
```

`for { select { ... } }` là pattern **event loop** trong Go. Vòng lặp vô tận chờ event:
- Có message từ `send` channel → gửi tới client
- Tới giờ ping (`ticker.C` fire) → gửi ping

So với Nest: Nest dùng `EventEmitter` + decorator `@OnEvent`. Go viết tay với `for select` — verbose hơn nhưng rõ ràng hơn nhiều, không có magic.

---

### 5.6 `internal/transport/ws/hub.go` — Quản lý connection

```go
type Hub struct {
    log *slog.Logger

    mu sync.RWMutex                              // read-write lock
    connsByUser map[int32]*Conn                  // userID → conn
    roomsByMap  map[string]map[*Conn]struct{}    // mapID → set of conn
}
```

#### `sync.RWMutex` — Read-Write lock

```go
mu sync.RWMutex
```

- `mu.Lock()` / `mu.Unlock()` — exclusive lock (cho write)
- `mu.RLock()` / `mu.RUnlock()` — shared lock (nhiều reader cùng lúc)

```go
func (h *Hub) BroadcastToMap(mapID string, data []byte, excludeConn *Conn) {
    h.mu.RLock()
    room, ok := h.roomsByMap[mapID]
    if !ok {
        h.mu.RUnlock()
        return
    }

    // Copy danh sách conn ra slice để release lock sớm
    conns := make([]*Conn, 0, len(room))
    for c := range room {
        if c != excludeConn {
            conns = append(conns, c)
        }
    }
    h.mu.RUnlock()  // ← release lock TRƯỚC khi Send()

    for _, c := range conns {
        c.Send(data)  // không giữ lock khi Send
    }
}
```

**Pattern quan trọng:** Copy data ra trước, release lock, rồi mới làm I/O. Vì:
- Giữ lock trong khi `Send()` → block cả các broadcast khác
- Slow client làm chậm `Send()` → nếu giữ lock, ai cũng đợi

#### Pattern register/unregister

```go
func (h *Hub) register(c *Conn) {
    h.mu.Lock()
    defer h.mu.Unlock()

    // Nếu user đã có connection cũ → kick
    if oldConn, exists := h.connsByUser[c.userID]; exists {
        oldConn.Close()
        h.removeFromRoomLocked(oldConn)
    }

    h.connsByUser[c.userID] = c
    h.addToRoomLocked(c)
}
```

Lưu ý: tên hàm có suffix `Locked` (như `addToRoomLocked`) là convention báo hiệu "hàm này phải được gọi khi đã giữ lock". Caller chịu trách nhiệm acquire lock trước.

#### `defer mu.Unlock()`

```go
h.mu.Lock()
defer h.mu.Unlock()
// ... logic ...
```

Đảm bảo unlock dù function return ở đâu, kể cả panic. Pattern bắt buộc — nếu quên unlock → deadlock cả hệ thống.

---

### 5.7 `internal/transport/ws/auth.go` — Verify JWT

```go
type Authenticator struct {
    jwtSecret []byte
    redis     *redis.Client
}

func (a *Authenticator) Verify(ctx context.Context, token string, gameSessionID string, claimedUserID int32) (*AuthResult, error) {
    // Parse JWT
    parsed, err := jwt.Parse(token, func(t *jwt.Token) (interface{}, error) {
        if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
            return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
        }
        return a.jwtSecret, nil
    })
    // ...
}
```

#### Function as value

```go
jwt.Parse(token, func(t *jwt.Token) (interface{}, error) {
    return a.jwtSecret, nil
})
```

Đây là **closure** — function inline truyền làm tham số. Giống TS:

```typescript
jwt.parse(token, (t) => secret)
```

Nhưng Go cần khai báo signature đầy đủ.

#### Type assertion

```go
claims, ok := parsed.Claims.(jwt.MapClaims)
if !ok {
    return nil, ErrInvalidToken
}
```

`parsed.Claims` có type là `jwt.Claims` (interface). `.(jwt.MapClaims)` là type assertion — chuyển sang concrete type. `ok` báo có chuyển được không.

So với TS: tương đương `as jwt.MapClaims` nhưng có check runtime.

#### Sentinel error

```go
var (
    ErrInvalidToken   = errors.New("invalid token")
    ErrInvalidSession = errors.New("invalid game session")
    ErrUserIDMismatch = errors.New("userID in JWT doesn't match handshake")
)
```

Pattern Go: định nghĩa error là biến package-level, dùng `errors.Is` để check:

```go
if errors.Is(err, ErrInvalidToken) {
    // xử lý
}
```

So với TS exception class: Go không có class, dùng biến static. Đơn giản hơn, type-safe hơn.

---

### 5.8 `internal/game/player/service.go` — Business logic

```go
type Service struct {
    redis *redis.Client
}

func NewService(rdb *redis.Client) *Service {
    return &Service{redis: rdb}
}

func (s *Service) HandleMove(ctx context.Context, userID int32, m *messages.PlayerMove) error {
    key := fmt.Sprintf("GAME:PLAYER:%d", userID)
    
    // Pipeline: gửi nhiều command trong 1 round-trip
    pipe := s.redis.Pipeline()
    pipe.SetNX(ctx, dirtyKey, time.Now().UnixMilli(), 600*time.Second)
    pipe.HSet(ctx, key, map[string]interface{}{
        "x": ...,
        "y": ...,
    })
    _, err := pipe.Exec(ctx)
    return err
}
```

#### `context.Context` — quản lý timeout/cancel

```go
ctx, cancel := context.WithTimeout(context.Background(), 1*time.Second)
defer cancel()

s.playerService.HandleMove(ctx, userID, &move)
```

Context truyền từ caller xuống callee để:
- Hủy operation khi caller hết kiên nhẫn
- Truyền timeout
- Truyền request-scoped data (vd traceID)

→ Hầu như **mọi** function I/O trong Go nhận `ctx` làm param đầu tiên. Đây là convention bắt buộc.

So với Nest: tương đương `Cancellation Token` nhưng được dùng phổ biến hơn rất nhiều.

#### `map[string]interface{}` — generic map

```go
pipe.HSet(ctx, key, map[string]interface{}{
    "x": "100.5",
    "y": "200.3",
})
```

`interface{}` (hoặc `any` từ Go 1.18) là type chấp nhận mọi giá trị, giống `any` trong TS. Dùng khi cần map có giá trị heterogeneous.

Nhưng Go đề cao type safety, nên `interface{}` chỉ dùng khi thực sự cần (như map cho Redis).

---

### 5.9 `internal/transport/ws/handler.go` — Route message

```go
func (h *Handler) Handle(c *Conn, data []byte) {
    msgType := data[0]
    payload := data[1:]

    switch msgType {
    case protocol.MsgPlayerMove:
        h.handlePlayerMove(c, payload)

    default:
        h.log.Warn("unknown message type", "type", msgType)
    }
}
```

**Pattern dispatcher đơn giản** — switch theo byte đầu, route tới handler tương ứng. Không có decorator như Nest `@SubscribeMessage('event_name')` — viết tay nhưng minh bạch.

#### Fire-and-forget với goroutine

```go
func (h *Handler) handlePlayerMove(c *Conn, payload []byte) {
    var m messages.PlayerMove
    if err := m.Decode(payload); err != nil {
        return
    }

    // Broadcast NGAY — không chờ Redis
    syncPacket := player.BuildSyncPacket(c.userID, &m)
    h.hub.BroadcastToMap(m.MapID, syncPacket, c)

    // Update Redis trong goroutine riêng — fire and forget
    go func(userID int32, move messages.PlayerMove) {
        ctx, cancel := context.WithTimeout(context.Background(), 1*time.Second)
        defer cancel()
        if err := h.playerService.HandleMove(ctx, userID, &move); err != nil {
            h.log.Warn("redis update failed", "err", err)
        }
    }(c.userID, m)
}
```

**`go func() { ... }()`** — spawn goroutine. Cú pháp:
- `go` keyword đứng trước function call
- Function chạy trong goroutine mới
- Code chính tiếp tục chạy ngay, không chờ

Goroutine ở Go **rẻ** — chỉ ~2KB stack, có thể spawn hàng nghìn không vấn đề. Khác hẳn thread OS (1MB).

So với Nest:
- Nest: `eventEmitter.emit('pay.create', ...)` + `@OnEvent` xử lý async
- Go: `go func() { ... }()` thẳng tay — đơn giản hơn

**Tại sao truyền `c.userID, m` vào closure?**

```go
go func(userID int32, move messages.PlayerMove) {
    // ...
}(c.userID, m)
```

Thay vì:
```go
go func() {
    h.playerService.HandleMove(ctx, c.userID, &m)  // ← capture biến ngoài
}()
```

Vì: nếu `m` thay đổi sau khi spawn goroutine, closure đọc giá trị mới (race condition). Truyền explicit làm parameter → goroutine có copy riêng, an toàn.

---

## 6. Concurrency — goroutine và channel

Đây là phần thay đổi mindset lớn nhất nếu bạn quen Node.js single-thread.

### 6.1 Goroutine = lightweight thread

```go
go func() {
    // Code này chạy "song song"
}()
```

- Spawn rẻ (~2KB stack)
- Có thể spawn hàng triệu (Node spawn 1000 thread là chết)
- Go runtime tự schedule lên các OS thread (M:N scheduling)

Trong code project này:
- Mỗi WebSocket connection có 2 goroutine (read + write)
- Mỗi message move spawn thêm 1 goroutine update Redis
- Server start spawn 1 goroutine để run

→ Nếu có 10.000 connection: ~30.000+ goroutine chạy. Hoàn toàn bình thường với Go.

### 6.2 Channel — pipe truyền data

```go
ch := make(chan int)        // unbuffered
ch := make(chan int, 100)   // buffered 100 item

ch <- 5     // gửi (blocking nếu unbuffered và không có receiver)
v := <-ch   // nhận (blocking nếu không có sender)

close(ch)   // đóng channel — receiver biết không còn data
```

#### Channel patterns trong code

**Pattern 1: Worker thông qua channel (`Conn.send`)**

```go
send chan []byte  // queue cho outbound message

// Sender (nhiều goroutine):
c.send <- data

// Receiver (1 goroutine — writeLoop):
for message := range c.send {
    c.ws.WriteMessage(...)
}
```

→ N producer, 1 consumer. Channel là queue thread-safe built-in.

**Pattern 2: Signal qua channel (`main.go`)**

```go
sigCh := make(chan os.Signal, 1)
signal.Notify(sigCh, syscall.SIGINT)

select {
case <-sigCh:
    // signal nhận được
case <-errCh:
    // server fail
}
```

→ Channel làm signal/notification, không truyền data thực sự.

### 6.3 `sync.Mutex` vs Channel — khi nào dùng cái nào?

**Mutex** khi: bảo vệ shared state đơn giản (map, counter)
```go
mu.Lock()
m["key"] = value
mu.Unlock()
```

**Channel** khi: truyền data hoặc signal giữa goroutine
```go
work := <-jobs  // worker pull job
```

Trong code này:
- `Hub` dùng `sync.RWMutex` — quản lý map of connection
- `Conn.send` dùng `chan` — queue message gửi đi

Đúng tool cho đúng việc.

### 6.4 Goroutine leak — bug phổ biến nhất

```go
// SAI: goroutine leak
go func() {
    for {
        // làm gì đó
        time.Sleep(time.Second)
    }
}()
```

Goroutine này **không bao giờ kết thúc**. Mỗi lần gọi function chứa nó là spawn 1 goroutine không cleanup → leak memory.

**Fix:** dùng `context.Context` để cancel:

```go
go func(ctx context.Context) {
    ticker := time.NewTicker(time.Second)
    defer ticker.Stop()
    for {
        select {
        case <-ctx.Done():
            return  // exit khi context cancel
        case <-ticker.C:
            // làm gì đó
        }
    }
}(ctx)
```

---

## 7. Pattern Go đặc trưng (vs Nest)

### 7.1 Dependency Injection thủ công

Nest:
```typescript
@Module({
  providers: [PlayerService, Hub, Authenticator],
})
export class AppModule {}

@Injectable()
export class WsGateway {
  constructor(
    private hub: Hub,
    private auth: Authenticator,
  ) {}
}
```

Go (`app.go`):
```go
func New(cfg *Config, log *slog.Logger) (*App, error) {
    rdb, _ := redisclient.New(cfg.RedisURL)
    hub := ws.NewHub(log)
    auth := ws.NewAuthenticator(cfg.JWTSecret, rdb)
    playerService := player.NewService(rdb)
    handler := ws.NewHandler(log, hub, playerService)
    wsServer := ws.NewServer(log, hub, auth, handler)
    
    // ...
}
```

→ Wire thủ công. Verbose hơn nhưng:
- Không có magic — đọc 1 lần là biết ai depend ai
- Không cần framework, không cần decorator
- Dependency cycle bị compile error ngay (Go không cho phép import vòng)

### 7.2 Logger pattern — không inject

Nest:
```typescript
constructor(private logger: Logger) {}
this.logger.log('hello');
```

Go: logger được truyền vào struct hoặc dùng global `slog`:
```go
type Hub struct {
    log *slog.Logger
}

h.log.Info("conn registered", "userID", c.userID)
```

`slog.Logger` là **structured logger** built-in từ Go 1.21. Format: `key, value, key, value, ...`. Output JSON dễ ingest vào log aggregator.

### 7.3 Error wrapping

```go
if err != nil {
    return fmt.Errorf("init redis: %w", err)
}
```

`%w` wrap error gốc vào error mới. Sau này `errors.Unwrap` ra được error gốc. Tương đương `throw new Error('...', { cause: err })` trong JS.

### 7.4 Struct embedding (composition)

Go không có inheritance, nhưng có **embedding**:

```go
type Animal struct {
    Name string
}

func (a *Animal) Greet() {
    fmt.Println("I'm", a.Name)
}

type Dog struct {
    Animal  // ← embed (không có field name)
    Breed string
}

d := &Dog{Animal: Animal{Name: "Rex"}, Breed: "Labrador"}
d.Greet()  // gọi method của Animal qua Dog
```

`Dog` không inherit `Animal`, mà **chứa** `Animal`. Method của `Animal` có thể gọi qua `Dog` như syntactic sugar.

So với TS `extends`: tương đương về effect nhưng concept khác — composition over inheritance.

### 7.5 Naming convention

- **Hoa chữ đầu** → exported (public): `func NewUser`, `type Config`, `const MaxSize`
- **Thường chữ đầu** → unexported (private): `func parseToken`, `type cache`

Không có `public`/`private` keyword. Chỉ cần case của ký tự đầu.

→ Trong code: `Hub.register()` (private), `Hub.BroadcastToMap()` (public).

---

## 8. Pitfall thường gặp khi mới học

### 8.1 Forget `err` check

```go
data, err := json.Marshal(obj)
// quên check err → bug ngầm
return data
```

Go không throw exception. Quên check `err` = bỏ qua lỗi. **Luôn check `err`** ngay sau khi gọi function trả error.

### 8.2 Nil pointer dereference

```go
var u *User
fmt.Println(u.Name)  // panic: nil pointer dereference
```

Tương đương `null.name` trong JS. Go có nil safe ở compile time **không tốt như TS strict mode**. Phải tự check:

```go
if u == nil {
    return
}
fmt.Println(u.Name)
```

### 8.3 Goroutine capture biến vòng lặp

```go
// SAI (Go < 1.22):
for _, item := range items {
    go func() {
        process(item)  // tất cả goroutine có thể đều thấy item cuối cùng!
    }()
}

// ĐÚNG: truyền explicit
for _, item := range items {
    go func(it Item) {
        process(it)
    }(item)
}

// Go 1.22+: vòng lặp tự tạo biến mới mỗi iteration → không cần fix
```

Project này dùng Go 1.22+ chưa? Check `go.mod` dòng `go 1.22` hoặc cao hơn.

### 8.4 Channel deadlock

```go
ch := make(chan int)  // unbuffered
ch <- 5               // BLOCK MÃI vì không có receiver
```

Unbuffered channel: send block tới khi có receiver. Chạy 1 mình là deadlock.

**Fix:** buffer channel hoặc spawn goroutine để receive:

```go
ch := make(chan int, 1)  // buffer 1
ch <- 5                  // OK
```

### 8.5 Map race condition

```go
m := make(map[string]int)
go func() { m["a"] = 1 }()
go func() { m["b"] = 2 }()
// PANIC: concurrent map writes
```

Go map **không thread-safe**. Phải dùng `sync.Mutex` để bảo vệ, hoặc dùng `sync.Map` (concurrent map built-in).

→ Trong `hub.go`, mọi access `connsByUser`, `roomsByMap` đều có lock.

### 8.6 Defer trong loop

```go
for _, file := range files {
    f, _ := os.Open(file)
    defer f.Close()  // SAI: defer chạy khi FUNCTION return, không phải iteration
    // file chỉ close khi hết function → leak fd nếu có 1000 file
}
```

**Fix:** wrap thành function:

```go
for _, file := range files {
    func() {
        f, _ := os.Open(file)
        defer f.Close()  // OK: close khi closure return
        // ...
    }()
}
```

---

## 9. Tooling và workflow

### 9.1 `go.mod` — manifest

```
module github.com/DANG-PH/game-service-go

go 1.22

require (
    github.com/gorilla/websocket v1.5.0
    github.com/redis/go-redis/v9 v9.0.0
    // ...
)
```

Tương đương `package.json`. Khác: dùng path full (`github.com/...`) làm module name.

### 9.2 Lệnh thường dùng

```bash
# Cài dependency mới
go get github.com/abc/xyz

# Dọn unused dep
go mod tidy

# Compile
go build -o bin/api cmd/api/main.go

# Run trực tiếp
go run cmd/api/main.go

# Test
go test ./...                    # tất cả package
go test -race ./...              # với race detector (PHẢI dùng khi có concurrency)
go test -cover ./...             # với coverage

# Format
go fmt ./...                     # format toàn project (chuẩn duy nhất, không cần Prettier)

# Static check
go vet ./...                     # bắt bug đơn giản
```

### 9.3 Hot reload với Air

Project có `.air.toml`:

```bash
make dev
```

Tương đương `npm run dev` với nodemon. Air watch file `.go`, rebuild + restart khi save.

### 9.4 Race detector — **bắt buộc** khi test concurrency

```bash
go test -race ./...
```

Race detector phát hiện concurrent access không có lock. **Luôn chạy** với `-race` khi develop. Trong Makefile project có sẵn.

### 9.5 Test pattern Go

`codec_test.go`:

```go
func TestCodecRoundTrip(t *testing.T) {
    enc := NewEncoder(0x42)
    enc.WriteUint8(255)
    
    data := enc.Bytes()
    
    dec := NewDecoder(data[1:])
    if v, _ := dec.ReadUint8(); v != 255 {
        t.Errorf("uint8: got %d", v)
    }
}
```

- Function bắt đầu `Test...` được Go test runner tìm
- Param `t *testing.T` để báo cáo lỗi
- `t.Errorf` báo fail nhưng tiếp tục test
- `t.Fatal` báo fail và dừng test

Không cần Jest/Mocha — Go có test runtime built-in.

---

## 10. Cheatsheet — tra nhanh khi quên

### Khai báo

```go
var x int = 5           // explicit
x := 5                  // short (function only)
const Pi = 3.14         // constant
type User struct { ... } // type alias / struct
```

### Function

```go
func Add(a, b int) int { return a + b }
func Divide(a, b int) (int, error) { ... }
func (u *User) Greet() string { ... }   // method
func New(...) *User { return &User{...} }  // constructor
```

### Control flow

```go
if x > 0 { ... } else { ... }
if v, err := f(); err != nil { ... }     // assign + check

for i := 0; i < 10; i++ { ... }
for _, item := range slice { ... }
for key, value := range m { ... }
for { ... }                              // infinite loop

switch x {
case 1: ...
case 2, 3: ...                           // multiple values
default: ...
}
```

### Slice

```go
s := []int{1, 2, 3}
s = append(s, 4)
s[0]                                     // access
s[1:3]                                   // slice [1, 3)
len(s), cap(s)                           // length, capacity
make([]int, 0, 10)                       // length 0, cap 10
```

### Map

```go
m := map[string]int{"a": 1}
m["b"] = 2
v, ok := m["a"]                          // check exists
delete(m, "a")
for k, v := range m { ... }
```

### Struct

```go
type User struct {
    ID   int
    Name string
}
u := User{ID: 1, Name: "Goku"}
u := &User{ID: 1}                        // pointer
u.Name = "Vegeta"                         // access (auto deref)
```

### Interface

```go
type Reader interface {
    Read(p []byte) (n int, err error)
}

// Implement implicit — không cần "implements"
func (f *File) Read(p []byte) (int, error) { ... }
```

### Concurrency

```go
go func() { ... }()                      // spawn goroutine

ch := make(chan int)                     // unbuffered
ch := make(chan int, 100)                // buffered

ch <- 5                                  // send
v := <-ch                                // recv
close(ch)                                // close

select {
case v := <-ch1: ...
case ch2 <- x: ...
case <-time.After(1*time.Second): ...    // timeout
default: ...                             // non-blocking
}

var mu sync.Mutex
mu.Lock(); defer mu.Unlock()

var rwmu sync.RWMutex
rwmu.RLock(); defer rwmu.RUnlock()       // for readers
```

### Error

```go
errors.New("simple error")
fmt.Errorf("wrapped: %w", err)
errors.Is(err, ErrNotFound)
errors.As(err, &myErr)

if err != nil { return err }
```

### Defer

```go
defer f.Close()                          // run when function returns
defer fmt.Println("done")
```

---

## Lời kết

Go đơn giản đến mức "thô". Mới đầu sẽ thấy verbose, không có sugar. Nhưng chính sự thô này giúp:

- Đọc code 1 lần là hiểu — không có magic
- Concurrency dễ — goroutine và channel là first-class
- Performance cao — compile native, không có VM
- Tooling tuyệt vời — `go fmt` chuẩn duy nhất, `go test` built-in, `go race` detector

**3 thứ quan trọng nhất khi học Go từ TS/Nest:**

1. **Error là return value** — không có exception, luôn check `err`
2. **Concurrency là native** — goroutine + channel thay thế cho async/await + EventEmitter
3. **Composition thay inheritance** — không có class, chỉ có struct + interface implicit

Sau khi đọc tài liệu này 1-2 lần và lướt qua source code, bạn nên có thể:
- Hiểu được flow của 1 WebSocket message từ client tới Redis
- Tự thêm 1 message type mới (ví dụ `MsgChat`)
- Debug được 1 goroutine leak hoặc race condition
- Sửa được logic handler khi business thay đổi

Khi bí, quay về cheatsheet ở mục 10. Khi gặp pattern lạ trong code, search file đó ở mục 5.

Chúc code vui!

---

*Tài liệu viết cho dev mới học Go thông qua codebase game-service-go. Dựa trên Go 1.22+.*