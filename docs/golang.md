# Go — Hướng dẫn toàn diện

> Tài liệu này được viết cho dev đã có kinh nghiệm với Java hoặc NestJS/Node.js muốn chuyển sang Go.
> Đọc xong tài liệu này → hiểu đủ để bắt đầu làm việc với Go project ngay.

---

## 📑 Mục lục

**Phần 1 — Go là gì và tại sao dùng**

1. [Go là gì? Sinh ra để làm gì?](#1-go-là-gì-sinh-ra-để-làm-gì)
2. [So sánh Go vs Java vs NestJS/Node.js](#2-so-sánh-go-vs-java-vs-nestjsnodejs)
3. [Triết lý thiết kế của Go](#3-triết-lý-thiết-kế-của-go)

**Phần 2 — Go hoạt động như thế nào bên dưới**

4. [Compiled vs Interpreted — Go compile ra gì?](#4-compiled-vs-interpreted--go-compile-ra-gì)
5. [Go Runtime — Bộ máy chạy Go](#5-go-runtime--bộ-máy-chạy-go)
6. [Goroutine — Không phải Thread](#6-goroutine--không-phải-thread)
7. [Go Scheduler — GMP Model](#7-go-scheduler--gmp-model)
8. [Blocking IO nhưng vẫn nhanh hơn Non-blocking — Tại sao?](#8-blocking-io-nhưng-vẫn-nhanh-hơn-non-blocking--tại-sao)
9. [Memory Management — Stack, Heap, GC](#9-memory-management--stack-heap-gc)

**Phần 3 — Syntax và ngôn ngữ**

10. [Khai báo biến — Khác gì Java/JS?](#10-khai-báo-biến--khác-gì-javajs)
11. [Kiểu dữ liệu trong Go](#11-kiểu-dữ-liệu-trong-go)
12. [Function — Multiple Return Values](#12-function--multiple-return-values)
13. [Struct — Thay thế Class](#13-struct--thay-thế-class)
14. [Pointer — Bắt buộc phải hiểu](#14-pointer--bắt-buộc-phải-hiểu)
15. [Interface — Implicit Implementation](#15-interface--implicit-implementation)
16. [Embedding — Thay thế Inheritance](#16-embedding--thay-thế-inheritance)
17. [Generics (Go 1.18+)](#17-generics-go-118)
18. [Error Handling — Không có Exception](#18-error-handling--không-có-exception)
19. [defer, panic, recover](#19-defer-panic-recover)
20. [Goroutine và Channel — Concurrency](#20-goroutine-và-channel--concurrency)
21. [select Statement](#21-select-statement)
22. [Context — Truyền thông tin xuyên call chain](#22-context--truyền-thông-tin-xuyên-call-chain)
23. [Slice và Array — Hiểu đúng bản chất](#23-slice-và-array--hiểu-đúng-bản-chất)
24. [Map — Cạm bẫy thường gặp](#24-map--cạm-bẫy-thường-gặp)
25. [sync Package — Đồng bộ hóa](#25-sync-package--đồng-bộ-hóa)
26. [init() và Blank Import](#26-init-và-blank-import)
27. [Blank Identifier _](#27-blank-identifier-_)

**Phần 4 — Tooling và hệ sinh thái**

28. [go.mod và go.sum — Quản lý dependency](#28-gomod-và-gosum--quản-lý-dependency)
29. [Makefile — Task runner của Go](#29-makefile--task-runner-của-go)
30. [Air — Hot reload](#30-air--hot-reload)
31. [.golangci.yml — Linter](#31-golangciyml--linter)
32. [go vet, go fmt, go build, go run](#32-go-vet-go-fmt-go-build-go-run)
33. [Race Detector](#33-race-detector)
34. [Build Tags](#34-build-tags)
35. [go generate và Code generation](#35-go-generate-và-code-generation)
36. [Các file config thường gặp](#36-các-file-config-thường-gặp)

**Phần 5 — Project structure**

37. [Package và Module — Tổ chức code](#37-package-và-module--tổ-chức-code)
38. [internal/ pkg/ cmd/ — Quy ước thư mục](#38-internal-pkg-cmd--quy-ước-thư-mục)
39. [Dependency Injection trong Go — Không có framework](#39-dependency-injection-trong-go--không-có-framework)

**Phần 6 — Testing**

40. [Testing trong Go — Không cần framework](#40-testing-trong-go--không-cần-framework)
41. [Table-driven Test](#41-table-driven-test)
42. [Mock — Test không cần infra thật](#42-mock--test-không-cần-infra-thật)
43. [Benchmark và Profiling](#43-benchmark-và-profiling)

**Phần 7 — Những điều cần biết khi bắt đầu**

44. [Lỗi phổ biến của người mới](#44-lỗi-phổ-biến-của-người-mới)
45. [Go vs Java — Bảng so sánh chi tiết](#45-go-vs-java--bảng-so-sánh-chi-tiết)
46. [Go vs NestJS — Bảng so sánh chi tiết](#46-go-vs-nestjs--bảng-so-sánh-chi-tiết)
47. [Thuật ngữ toàn diện](#47-thuật-ngữ-toàn-diện)

---

# Phần 1 — Go là gì và tại sao dùng

## 1. Go là gì? Sinh ra để làm gì?

Go (hay Golang) được tạo ra tại **Google năm 2009** bởi Robert Griesemer, Rob Pike và Ken Thompson — những người đã xây dựng Unix, UTF-8, và nhiều nền tảng của ngành.

**Vấn đề họ muốn giải quyết:**

Google có codebase C++ khổng lồ. C++ biên dịch chậm, quản lý bộ nhớ phức tạp, viết concurrent code khó. Java thì có JVM overhead nặng. Python thì quá chậm cho hệ thống. Họ cần một ngôn ngữ:

- **Compile nhanh** như scripting language (Go compile 1 triệu dòng trong vài giây)
- **Chạy nhanh** như C/C++ (không có VM overhead)
- **Viết concurrent code dễ** như mô hình CSP (Communicating Sequential Processes)
- **Đơn giản** — dễ học, dễ đọc, dễ maintain

**Go được dùng ở đâu:**

- **Infrastructure**: Kubernetes, Docker, Terraform, Prometheus — tất cả viết bằng Go
- **Backend services**: Uber, Dropbox, Twitch, Cloudflare, Discord
- **CLI tools**: GitHub CLI, Hugo, Cobra
- **Network services**: Load balancer, proxy, API gateway

**Go KHÔNG phải lựa chọn tốt cho:**
- Frontend (dùng JS/TS)
- Data science / ML (dùng Python)
- Mobile app (dùng Swift/Kotlin)
- Script ngắn (dùng Python/Bash)

---

## 2. So sánh Go vs Java vs NestJS/Node.js

### Tổng quan

| | Go | Java (Spring) | NestJS/Node.js |
|---|---|---|---|
| **Paradigm** | Procedural + OOP nhẹ | OOP nặng | OOP + Functional |
| **Type system** | Static, strong | Static, strong | Dynamic (JS) / Static (TS) |
| **Runtime** | Không VM, native binary | JVM | V8 engine |
| **Startup time** | < 10ms | 2–30 giây | 1–5 giây |
| **Memory** | Rất thấp (~10MB) | Cao (~200MB+) | Trung bình (~50MB) |
| **Concurrency** | Goroutine (native) | Thread / Virtual Thread | Event loop (single-thread) |
| **Learning curve** | Thấp — spec 50 trang | Cao — framework phức tạp | Trung bình |
| **Ecosystem** | Nhỏ nhưng chất lượng | Khổng lồ, mature | Khổng lồ, nhanh |
| **Deployment** | 1 binary file duy nhất | JAR + JRE | Node.js + node_modules |

### Concurrency model — Khác nhau hoàn toàn

```
Java (Thread-per-request):
Request → Thread 1 → xử lý → trả về
Request → Thread 2 → xử lý → trả về
(tốn RAM: mỗi thread ~1MB stack)

NestJS (Event loop, single-thread):
Request A → Event loop → gửi I/O → không chờ → nhận request B
Request B → Event loop → gửi I/O → không chờ → nhận request C
I/O xong → callback → xử lý tiếp
(ít RAM, nhưng CPU-heavy task block event loop)

Go (Goroutine):
Request → Goroutine (2KB) → gọi DB → BLOCK (goroutine bị park)
          ↓
          Scheduler chạy goroutine khác trên cùng OS thread
          ↓
          DB trả về → goroutine được unpark → tiếp tục
(developer viết code blocking đơn giản, Go tự làm non-blocking bên dưới)
```

### Error handling — Triết lý khác nhau

```java
// Java — Exception
try {
    User user = userService.findById(id);
    return user;
} catch (UserNotFoundException e) {
    throw new ResponseStatusException(HttpStatus.NOT_FOUND);
}
```

```typescript
// NestJS — Exception (tương tự Java)
async findUser(id: string): Promise<User> {
    const user = await this.userService.findById(id);
    if (!user) throw new NotFoundException();
    return user;
}
```

```go
// Go — Error là giá trị, không phải exception
user, err := userService.GetUser(ctx, id)
if err != nil {
    if errors.Is(err, ErrNotFound) {
        http.Error(w, "not found", 404)
        return
    }
    http.Error(w, "internal error", 500)
    return
}
// dùng user
```

### Dependency Injection

```java
// Java Spring — Framework-managed DI với annotation
@Service
public class UserService {
    @Autowired
    private UserRepository userRepository;
}
```

```typescript
// NestJS — Decorator-based DI
@Injectable()
export class UserService {
    constructor(private userRepository: UserRepository) {}
}
```

```go
// Go — Manual DI, không có framework, không có magic
type userService struct {
    repo UserRepository
}

func NewUserService(repo UserRepository) *userService {
    return &userService{repo: repo}
}

// Wire up trong main.go
repo := postgres.NewUserRepository(db)
service := user.NewUserService(repo)
handler := user.NewHandler(service)
```

---

## 3. Triết lý thiết kế của Go

### "Less is more"

Go có **25 keywords** (Python 35, Java 50+). Không có:
- Inheritance (chỉ có embedding)
- Overloading (mỗi function 1 tên duy nhất)
- Exception (chỉ có error values)
- Ternary operator
- `while` loop (chỉ có `for`)

**Mục tiêu:** Code Go của người này dễ đọc như code của người kia — không có "clever tricks".

### "Errors are values"

Error là **giá trị bình thường** được trả về — không phải exception cần bắt bằng try/catch. Developer phải xử lý explicitly.

### "Share memory by communicating"

Thay vì shared memory + lock, Go khuyến khích dùng **channel** để giao tiếp giữa goroutine — motto: *"Don't communicate by sharing memory; share memory by communicating."*

### Không có "magic"

Spring Boot, NestJS có nhiều annotation magic. Go không có — mọi thứ đều explicit, đọc code là thấy luồng chạy ngay.

---

# Phần 2 — Go hoạt động như thế nào bên dưới

## 4. Compiled vs Interpreted — Go compile ra gì?

### Java và JVM

```
Java source (.java)
        ↓ javac
Bytecode (.class)  ← chạy trên bất kỳ OS nào có JVM
        ↓ JVM interpret/JIT compile
CPU instructions
```

JVM mang lại portability nhưng có overhead: startup chậm, RAM cao cho JVM.

### Node.js và V8

```
TypeScript → tsc → JavaScript → V8 interpret + JIT → CPU
```

Node.js không compile trước — interpret at runtime.

### Go — AOT Compiled

```
Go source (.go) → go build (AOT) → Native binary → CPU trực tiếp
```

**AOT (Ahead-Of-Time):** Compile ra machine code trực tiếp. Không cần VM, không cần interpreter.

**Kết quả:**
- Startup < 10ms (không có VM khởi động)
- Không có JIT warmup
- Binary chạy được ngay, không cần cài Go runtime trên máy đích

### Cross-compilation — Điểm mạnh của Go

```bash
# Từ Windows, build binary cho Linux
GOOS=linux GOARCH=amd64 go build -o api-linux cmd/api/main.go

# Build cho Mac ARM (M1/M2)
GOOS=darwin GOARCH=arm64 go build -o api-mac cmd/api/main.go

# Build cho Windows
GOOS=windows GOARCH=amd64 go build -o api.exe cmd/api/main.go
```

Một lệnh, không cần VM hay cross-compiler phức tạp — lý do Go phổ biến cho DevOps tooling.

---

## 5. Go Runtime — Bộ máy chạy Go

Go có runtime nhưng nó **embed vào binary** — không cần cài riêng như JVM hay Node.js:

```
Binary = Go code + Go runtime (~5-15MB total)
```

Go runtime bao gồm:
- **Goroutine scheduler** — quản lý hàng triệu goroutine trên ít OS thread
- **Garbage Collector** — tự động giải phóng memory, pause < 1ms
- **netpoller** — quản lý network I/O non-blocking (epoll/kqueue/IOCP tùy OS)
- **Stack management** — tự động grow/shrink goroutine stack
- **Memory allocator** — phân bổ memory hiệu quả

---

## 6. Goroutine — Không phải Thread

### So sánh

| | OS Thread | Goroutine |
|---|---|---|
| **Stack ban đầu** | 1–8 MB (cố định) | **2 KB** (dynamic) |
| **Stack tối đa** | Cố định khi tạo | **Tự grow đến 1GB** |
| **Tạo mới** | ~1ms, kernel call | **~300ns, user space** |
| **Context switch** | Kernel space, chậm | **User space, rất nhanh** |
| **Số lượng thực tế** | Vài nghìn | **Hàng triệu** |
| **Quản lý** | OS kernel | **Go runtime** |

```go
// Tạo goroutine — từ khóa "go"
go doSomething()

go func() {
    result := heavyComputation()
    fmt.Println(result)
}()
```

### Goroutine Stack tự co giãn

```
Goroutine mới: Stack = 2KB
    ↓ (function sâu / nhiều local var)
Stack sắp đầy → Go runtime phát hiện
    ↓
Cấp stack mới gấp đôi (4KB)
Copy toàn bộ stack cũ → update tất cả pointer
    ↓
Function return nhiều → stack shrink
```

1 triệu goroutine ≈ 2GB RAM. 1 triệu OS thread ≈ 1TB RAM.

### Goroutine không phải async/await

```typescript
// NestJS — explicit async marker
async function fetchUser(id: string): Promise<User> {
    const user = await db.findUser(id);  // explicit await
    return user;
}
```

```go
// Go — code trông synchronous, runtime làm async bên dưới
func fetchUser(ctx context.Context, id string) (*User, error) {
    user, err := db.FindUser(ctx, id)  // goroutine block nhưng không waste CPU
    return user, err
}

// Muốn chạy thật sự concurrent:
go fetchUser(ctx, id)  // tạo goroutine riêng
```

---

## 7. Go Scheduler — GMP Model

```
G = Goroutine    — unit of work (triệu cái)
M = Machine      — OS thread thật (vài chục cái)
P = Processor    — logical CPU = GOMAXPROCS (= số core)
```

```
[G1][G2]...[Gn]  ← Hàng triệu goroutine
       ↕
  Go Scheduler
       ↕
 [P1]  [P2]  [P3]  [P4]   ← Logical processors
  ↕      ↕     ↕     ↕
 [M1]  [M2]  [M3]  [M4]   ← OS threads
  ↕      ↕     ↕     ↕
CPU0   CPU1  CPU2  CPU3
```

### Work Stealing

Khi P1 rảnh (local queue trống), thay vì ngồi chờ — P1 "steal" goroutine từ P2. Đảm bảo CPU luôn được tận dụng.

### Goroutine block không stuck scheduler

```
G2 chạy trên P1/M1 → gọi db.Query() → BLOCK
    ↓
P1 detach khỏi M1 → attach vào M2
P1 chạy G3 tiếp trên M2
    ↓
M1 vẫn chờ DB ở kernel level
DB xong → M1 báo scheduler → G2 được schedule lại
```

CPU không bao giờ ngồi không chờ I/O.

### GOMAXPROCS

```go
runtime.GOMAXPROCS(0)  // in số P hiện tại
runtime.GOMAXPROCS(4)  // set thủ công
```

```bash
GOMAXPROCS=2 ./api  # qua env variable
```

---

## 8. Blocking IO nhưng vẫn nhanh hơn Non-blocking — Tại sao?

### Non-blocking I/O của Node.js

```
Node.js Event Loop (1 thread):
  Request A → gọi DB → đăng ký callback → nhận Request B
  Request B → gọi DB → đăng ký callback → nhận Request C
  ...poll... DB_A xong → callback → xử lý tiếp
```

**Vấn đề:** CPU-heavy task block event loop → tất cả request khác delay.

### Blocking I/O của Go — Thực chất là gì?

Developer thấy code blocking bình thường. Nhưng bên dưới:

```
goroutine gọi db.Query()
    ↓
Go runtime dịch sang non-blocking syscall (epoll/kqueue/IOCP)
    ↓
Goroutine bị "park" (không chiếm CPU)
    ↓
netpoller theo dõi file descriptor
    ↓
Data về → netpoller báo scheduler → goroutine "unpark"
```

**Developer thấy:** Code blocking đơn giản.
**Runtime thực hiện:** Non-blocking ở kernel level.

### Kết quả thực tế

```
Node.js:  1 thread → 10k req/s (limited bởi event loop)
Java:     200 threads → bị giới hạn bởi thread overhead + context switch
Go:       4 OS threads, hàng triệu goroutine → 100k+ req/s
          (goroutine 2KB vs thread 1MB → tạo được nhiều hơn 500x)
```

**Tóm lại:** Go cho trải nghiệm viết code blocking đơn giản, đạt performance của non-blocking nhờ scheduler thông minh. Không phải chọn giữa simplicity và performance — có cả hai.

---

## 9. Memory Management — Stack, Heap, GC

### Stack vs Heap

```go
// Stack — nhanh, tự giải phóng khi function return
func calculate() int {
    x := 42  // x nằm trên stack
    return x  // x tự giải phóng
}

// Heap — dynamic, GC quản lý
func createUser() *User {
    u := User{Name: "Đăng"}
    return &u  // u phải lên heap vì pointer sống lâu hơn function
}
```

### Escape Analysis

Go compiler tự quyết định biến nào lên heap:

```bash
go build -gcflags="-m" ./...
# Output:
# user.go:5: &u escapes to heap
# calc.go:3: x does not escape
```

Giảm escape to heap = giảm GC pressure = faster.

### Garbage Collector

Go dùng **concurrent tricolor mark-and-sweep GC**:

```
Mark phase (concurrent — chạy song song với code):
  Đánh dấu tất cả object còn được reference

Sweep phase (concurrent):
  Giải phóng object không được đánh dấu

STW (Stop-The-World):
  Chỉ pause rất ngắn ở đầu/cuối mỗi phase
  Mục tiêu: < 1ms
```

So sánh GC pause:
- Java G1GC: 50–200ms pause
- Java ZGC: < 10ms pause
- **Go GC: < 1ms pause** ← critical cho low-latency service

---

# Phần 3 — Syntax và ngôn ngữ

## 10. Khai báo biến — Khác gì Java/JS?

```go
// Cách 1: khai báo đầy đủ
var name string = "Đăng"
var age int = 25

// Cách 2: type inference
var name = "Đăng"

// Cách 3: short declaration (phổ biến nhất, chỉ trong function)
name := "Đăng"
age := 25

// Khai báo nhóm
var (
    host  = "localhost"
    port  = 8080
    debug = false
)

// Constant
const MaxRetries = 3
const (
    StatusActive   = "active"
    StatusInactive = "inactive"
)
```

### Iota — Enum trong Go

Go không có `enum`. Dùng `iota` để tạo sequence tăng dần:

```go
type Status int

const (
    StatusPending  Status = iota  // 0
    StatusActive                  // 1
    StatusInactive                // 2
    StatusBanned                  // 3
)

// Iota với bit shift — dùng cho flags/permissions
type Permission uint

const (
    PermRead    Permission = 1 << iota  // 1 (001)
    PermWrite                           // 2 (010)
    PermExecute                         // 4 (100)
)

userPerm := PermRead | PermWrite      // 3 (011)
canWrite := userPerm & PermWrite != 0 // true
```

---

## 11. Kiểu dữ liệu trong Go

### Numeric types

```go
int, int8, int16, int32, int64
uint, uint8, uint16, uint32, uint64
byte    // alias uint8
rune    // alias int32 — Unicode code point
float32, float64
```

### String

```go
s := "Hello, 世界"    // UTF-8
len(s)               // số BYTES, không phải ký tự!

// Iterate đúng theo Unicode character
for i, r := range s {
    fmt.Printf("index %d: %c\n", i, r)
}

// String immutable — muốn sửa, convert sang []byte
b := []byte(s)
b[0] = 'h'
s2 := string(b)
```

### Struct tags

```go
type User struct {
    ID       string    `json:"id" db:"id" validate:"required"`
    Name     string    `json:"name" validate:"required,min=2,max=100"`
    Email    string    `json:"email" validate:"required,email"`
    Password string    `json:"-"`  // bỏ qua khi marshal JSON
    Created  time.Time `json:"created_at"`
}
```

Tags là string metadata, đọc bởi thư viện qua reflection tại runtime.

---

## 12. Function — Multiple Return Values

Tính năng Go mà Java và JS không có:

```go
// Trả 2 giá trị
func divide(a, b float64) (float64, error) {
    if b == 0 {
        return 0, errors.New("divide by zero")
    }
    return a / b, nil
}

result, err := divide(10, 2)
if err != nil {
    // xử lý error
}

// Named return values
func minMax(arr []int) (min, max int) {
    min, max = arr[0], arr[0]
    for _, v := range arr[1:] {
        if v < min { min = v }
        if v > max { max = v }
    }
    return  // naked return — trả min và max
}
```

### Variadic functions

```go
func sum(nums ...int) int {
    total := 0
    for _, n := range nums { total += n }
    return total
}

sum(1, 2, 3)
nums := []int{1, 2, 3}
sum(nums...)  // spread
```

### Function là first-class citizen

```go
// Function là giá trị
add := func(a, b int) int { return a + b }

// Higher-order function
func apply(nums []int, fn func(int) int) []int {
    result := make([]int, len(nums))
    for i, n := range nums { result[i] = fn(n) }
    return result
}

doubled := apply([]int{1, 2, 3}, func(n int) int { return n * 2 })
```

### Closure

```go
func makeCounter() func() int {
    count := 0
    return func() int {
        count++   // capture biến từ outer scope
        return count
    }
}

counter := makeCounter()
counter()  // 1
counter()  // 2
counter()  // 3
```

---

## 13. Struct — Thay thế Class

```go
type User struct {
    ID        string
    Name      string
    Email     string
    CreatedAt time.Time
}

// Constructor (convention: NewXxx)
func NewUser(name, email string) *User {
    return &User{
        ID:        uuid.New().String(),
        Name:      name,
        Email:     email,
        CreatedAt: time.Now(),
    }
}

// Method với pointer receiver
func (u *User) UpdateEmail(email string) {
    u.Email = email
}

// Method với value receiver (read-only)
func (u User) FullInfo() string {
    return fmt.Sprintf("%s <%s>", u.Name, u.Email)
}
```

### Exported vs Unexported

```go
type User struct {
    ID   string  // Exported (public) — chữ HOA
    name string  // unexported (private to package) — chữ thường
}

func (u *User) Name() string    { return u.name }    // getter
func (u *User) SetName(n string) { u.name = n }      // setter
```

---

## 14. Pointer — Bắt buộc phải hiểu

### Cơ bản

```go
x := 42
p := &x    // & lấy địa chỉ → p là *int
*p = 100   // * dereference → thay đổi giá trị
fmt.Println(x)  // 100
```

### Tại sao cần pointer

```go
// Không có pointer — nhận bản sao, thay đổi vô nghĩa
func wrongIncrement(n int) { n++ }

// Có pointer — thay đổi thật sự
func increment(n *int) { *n++ }

x := 5
wrongIncrement(x)  // x vẫn = 5
increment(&x)      // x = 6
```

### Pointer receiver vs Value receiver

```go
type Counter struct{ count int }

// Value receiver — nhận bản sao
func (c Counter) Get() int { return c.count }

// Pointer receiver — thay đổi được
func (c *Counter) Inc() { c.count++ }
```

**Quy tắc:**
- Method cần thay đổi struct → pointer receiver `*T`
- Struct lớn → pointer receiver (tránh copy)
- Consistency: nếu 1 method dùng `*T`, tất cả dùng `*T`

### Nil pointer

```go
var p *User  // nil
p.Name       // PANIC: nil pointer dereference

// Luôn check nil
if p != nil {
    fmt.Println(p.Name)
}
```

---

## 15. Interface — Implicit Implementation

### Java/TS — Explicit

```java
class PostgresRepo implements UserRepository { ... }
```

### Go — Implicit (Duck typing tĩnh)

```go
type UserRepository interface {
    FindByID(ctx context.Context, id string) (*User, error)
    Create(ctx context.Context, user *User) error
}

// Không cần khai báo "implements"
type postgresUserRepository struct{ db *sql.DB }

func (r *postgresUserRepository) FindByID(ctx context.Context, id string) (*User, error) { ... }
func (r *postgresUserRepository) Create(ctx context.Context, user *User) error { ... }

// postgresUserRepository TỰ ĐỘNG implement UserRepository
// vì có đủ method với đúng signature
```

### Compile-time check

```go
// Pattern hay: đảm bảo implementation đúng tại compile time
var _ UserRepository = (*postgresUserRepository)(nil)
// Nếu thiếu method → compile error ngay, không phải runtime error
```

### Empty interface và Type assertion

```go
// any (= interface{}) — bất kỳ type nào
func print(v any) { fmt.Println(v) }

// Type assertion
var v any = "hello"
s, ok := v.(string)   // ok = true, s = "hello"
n, ok := v.(int)      // ok = false, n = 0

// Type switch
switch val := v.(type) {
case string:  fmt.Println("string:", val)
case int:     fmt.Println("int:", val)
default:      fmt.Println("unknown")
}
```

---

## 16. Embedding — Thay thế Inheritance

```go
type BaseModel struct {
    ID        string
    CreatedAt time.Time
    UpdatedAt time.Time
}

func (b *BaseModel) Touch() { b.UpdatedAt = time.Now() }

// Embed BaseModel vào User
type User struct {
    BaseModel        // không có tên field
    Name  string
    Email string
}

user := &User{Name: "Đăng"}
user.Touch()             // method của BaseModel
fmt.Println(user.ID)     // field của BaseModel — access trực tiếp
```

**Embedding vs Inheritance:**
- Java: `Dog IS-A Animal` (inheritance)
- Go: `User HAS-A BaseModel` (composition) — Go thúc đẩy *composition over inheritance*

---

## 17. Generics (Go 1.18+)

```go
// Type-safe, compiler check
func Contains[T comparable](slice []T, item T) bool {
    for _, v := range slice {
        if v == item { return true }
    }
    return false
}

Contains([]int{1, 2, 3}, 2)      // ✅
Contains([]string{"a"}, "a")    // ✅
Contains([]int{1, 2, 3}, "2")   // ❌ compile ERROR

// Union constraint
type Number interface {
    ~int | ~int32 | ~int64 | ~float32 | ~float64
}

func Sum[T Number](nums []T) T {
    var total T
    for _, n := range nums { total += n }
    return total
}

// Generic struct
type Result[T any] struct {
    Data  T
    Error error
}
```

**Khi nào dùng:** Utility functions (filter, map, contains), data structures, generic repository. Không dùng cho business logic.

---

## 18. Error Handling — Không có Exception

### Triết lý

```go
// Error là return value bình thường
func getUser(id string) (*User, error) {
    user, err := db.FindUser(id)
    if err != nil {
        return nil, fmt.Errorf("getUser %s: %w", id, err)
        //                                        ↑ %w wrap để giữ error gốc
    }
    return user, nil
}
```

### Sentinel errors

```go
var (
    ErrNotFound     = errors.New("not found")
    ErrUnauthorized = errors.New("unauthorized")
)

// errors.Is — check qua nhiều lớp wrap
if errors.Is(err, ErrNotFound) {
    http.Error(w, "not found", 404)
}
```

### Custom error type

```go
type AppError struct {
    Code    int
    Message string
    Err     error
}

func (e *AppError) Error() string { return fmt.Sprintf("[%d] %s", e.Code, e.Message) }
func (e *AppError) Unwrap() error { return e.Err }

// errors.As — lấy typed error qua nhiều lớp wrap
var appErr *AppError
if errors.As(err, &appErr) {
    http.Error(w, appErr.Message, appErr.Code)
}
```

### Pattern trong HTTP handler

```go
func (h *Handler) GetUser(w http.ResponseWriter, r *http.Request) {
    user, err := h.service.GetUser(r.Context(), r.PathValue("id"))
    if err != nil {
        switch {
        case errors.Is(err, ErrNotFound):
            writeJSON(w, 404, map[string]string{"error": "not found"})
        case errors.Is(err, ErrUnauthorized):
            writeJSON(w, 401, map[string]string{"error": "unauthorized"})
        default:
            log.Printf("GetUser error: %v", err)
            writeJSON(w, 500, map[string]string{"error": "internal error"})
        }
        return
    }
    writeJSON(w, 200, user)
}
```

---

## 19. `defer`, `panic`, `recover`

### `defer`

Trì hoãn thực thi đến khi function return — dù return bình thường hay panic:

```go
func processFile(path string) error {
    f, err := os.Open(path)
    if err != nil { return err }
    defer f.Close()  // LUÔN được gọi

    db, err := connectDB()
    if err != nil { return err }  // f.Close() vẫn chạy
    defer db.Close()

    return nil  // f.Close() và db.Close() chạy theo LIFO: db trước, f sau
}
```

### `panic`

Dừng khẩn cấp — dùng cho lỗi không thể recover (lỗi programmer, thiếu config bắt buộc):

```go
func mustGetConfig(key string) string {
    val := os.Getenv(key)
    if val == "" {
        panic(fmt.Sprintf("required env var %s not set", key))
    }
    return val
}
```

### `recover`

Bắt panic — phải dùng trong `defer`:

```go
func Recovery(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        defer func() {
            if err := recover(); err != nil {
                buf := make([]byte, 4096)
                n := runtime.Stack(buf, false)
                log.Printf("PANIC: %v\n%s", err, buf[:n])
                w.WriteHeader(http.StatusInternalServerError)
            }
        }()
        next.ServeHTTP(w, r)
    })
}
```

---

## 20. Goroutine và Channel — Concurrency

### Channel

```go
ch := make(chan int)       // unbuffered — gửi block cho đến khi có receiver
ch := make(chan int, 10)   // buffered — gửi không block nếu buffer còn chỗ

ch <- 42            // gửi
val := <-ch         // nhận
val, ok := <-ch     // ok = false nếu channel đã close

close(ch)           // chỉ sender đóng channel

for v := range ch { // loop cho đến khi channel closed
    fmt.Println(v)
}
```

### Pattern: Fan-out

```go
func fetchAll(ctx context.Context, ids []string) ([]*User, error) {
    type result struct { user *User; err error }
    ch := make(chan result, len(ids))

    for _, id := range ids {
        go func(id string) {
            user, err := fetchUser(ctx, id)
            ch <- result{user, err}
        }(id)
    }

    users := make([]*User, 0, len(ids))
    for range ids {
        r := <-ch
        if r.err != nil { return nil, r.err }
        users = append(users, r.user)
    }
    return users, nil
}
```

### Pattern: Worker Pool

```go
func processWithPool(jobs []Job, workerCount int) {
    jobCh := make(chan Job, len(jobs))
    var wg sync.WaitGroup

    for i := 0; i < workerCount; i++ {
        wg.Add(1)
        go func() {
            defer wg.Done()
            for job := range jobCh { process(job) }
        }()
    }

    for _, job := range jobs { jobCh <- job }
    close(jobCh)
    wg.Wait()
}
```

---

## 21. `select` Statement

Chờ nhiều channel operation, chọn cái ready trước:

```go
select {
case msg := <-ch1:
    fmt.Println("từ ch1:", msg)
case ch2 <- "hello":
    fmt.Println("gửi vào ch2 OK")
case <-time.After(5 * time.Second):
    fmt.Println("timeout!")
default:
    fmt.Println("không có gì ready — non-blocking")
}
```

### Pattern: Context cancellation

```go
func backgroundWorker(ctx context.Context) {
    ticker := time.NewTicker(1 * time.Second)
    defer ticker.Stop()

    for {
        select {
        case <-ctx.Done():
            return  // dừng khi context cancel
        case t := <-ticker.C:
            doWork(t)
        }
    }
}

ctx, cancel := context.WithCancel(context.Background())
go backgroundWorker(ctx)

time.Sleep(10 * time.Second)
cancel()  // dừng worker
```

---

## 22. Context — Truyền thông tin xuyên call chain

### Tạo context

```go
ctx := context.Background()  // root context, dùng trong main()
ctx := context.TODO()        // placeholder

// Với timeout
ctx, cancel := context.WithTimeout(parent, 5*time.Second)
defer cancel()  // LUÔN gọi cancel

// Với deadline cụ thể
ctx, cancel := context.WithDeadline(parent, time.Now().Add(5*time.Second))
defer cancel()

// Có thể cancel thủ công
ctx, cancel := context.WithCancel(parent)
cancel()  // cancel khi muốn
```

### Convention

```go
// Context luôn là tham số ĐẦU TIÊN
func (s *service) GetUser(ctx context.Context, id string) (*User, error) {
    return s.repo.FindByID(ctx, id)  // truyền tiếp xuống
}

func (r *repo) FindByID(ctx context.Context, id string) (*User, error) {
    // Query tự cancel nếu ctx bị cancel
    row := r.db.QueryRowContext(ctx, "SELECT * FROM users WHERE id=$1", id)
    // ...
}
```

### Context value (dùng hạn chế)

```go
type contextKey string
const userIDKey contextKey = "userID"

// Set
ctx = context.WithValue(ctx, userIDKey, "user-123")

// Get
userID, ok := ctx.Value(userIDKey).(string)
```

Chỉ dùng cho request-scoped data: requestID, traceID, userID từ auth middleware.

---

## 23. Slice và Array — Hiểu đúng bản chất

### Slice là view vào Array

```
Slice header = pointer + len + cap
     │
     ▼
Underlying Array: [1][2][3][4][5]
```

```go
s := []int{1, 2, 3, 4, 5}
s2 := s[1:4]   // [2,3,4] — CÙNG array với s!

s2[0] = 99
fmt.Println(s)  // [1 99 3 4 5] — s bị ảnh hưởng!

// Muốn độc lập:
s3 := make([]int, len(s[1:4]))
copy(s3, s[1:4])
```

### append và reallocation

```go
s := make([]int, 3, 5)  // len=3, cap=5
s = append(s, 4)         // len=4, cap=5, cùng array
s = append(s, 5, 6)      // vượt cap=5 → array mới được cấp phát, cap tăng ~2x

// Best practice: pre-allocate khi biết size
users := make([]User, 0, 100)  // tránh reallocation nhiều lần
```

### Nil slice vs Empty slice

```go
var s []int      // nil slice — s == nil → true
s2 := []int{}   // empty slice — s2 == nil → false

json.Marshal(s)   // → null
json.Marshal(s2)  // → []
```

---

## 24. Map — Cạm bẫy thường gặp

```go
m := make(map[string]int)
m["key"] = 42

// Luôn dùng 2-value form
val, ok := m["key"]
if !ok { /* key không tồn tại */ }

delete(m, "key")

// Range — thứ tự RANDOM!
for k, v := range m { fmt.Println(k, v) }
```

### Nil map panic

```go
var m map[string]int
m["key"] = 1  // PANIC

m := make(map[string]int)  // ĐÚNG
```

### Map không thread-safe

```go
// Dùng sync.Map cho concurrent access
var m sync.Map
m.Store("key", 42)
val, ok := m.Load("key")
m.Delete("key")
m.Range(func(k, v any) bool {
    fmt.Println(k, v)
    return true
})
```

---

## 25. sync Package — Đồng bộ hóa

### sync.Mutex

```go
type BankAccount struct {
    mu      sync.Mutex
    balance float64
}

func (a *BankAccount) Deposit(amount float64) {
    a.mu.Lock()
    defer a.mu.Unlock()
    a.balance += amount
}
```

### sync.RWMutex — Nhiều reader, 1 writer

```go
type Cache struct {
    mu   sync.RWMutex
    data map[string]string
}

func (c *Cache) Get(key string) string {
    c.mu.RLock()           // nhiều goroutine RLock cùng lúc được
    defer c.mu.RUnlock()
    return c.data[key]
}

func (c *Cache) Set(key, val string) {
    c.mu.Lock()            // chỉ 1 goroutine Lock tại một thời điểm
    defer c.mu.Unlock()
    c.data[key] = val
}
```

### sync.WaitGroup

```go
var wg sync.WaitGroup

for _, item := range items {
    wg.Add(1)
    go func(item Item) {
        defer wg.Done()
        process(item)
    }(item)
}

wg.Wait()
```

### sync.Once — Singleton

```go
var (
    dbInstance *sql.DB
    dbOnce     sync.Once
)

func GetDB() *sql.DB {
    dbOnce.Do(func() {
        dbInstance, _ = sql.Open("postgres", dsn)
    })
    return dbInstance
    // Thread-safe: 1000 goroutine gọi đồng thời → chỉ connect 1 lần
}
```

### sync.Pool — Giảm GC

```go
var bufPool = sync.Pool{
    New: func() any { return make([]byte, 0, 4096) },
}

func handle(data []byte) {
    buf := bufPool.Get().([]byte)
    defer bufPool.Put(buf[:0])  // trả về pool, reset length

    buf = append(buf, data...)
    // xử lý...
}
```

---

## 26. `init()` và Blank Import

### init()

```go
func init() {
    // Tự động chạy khi package import, trước main()
    // Thứ tự: package vars → init() → main()
}
```

### Blank import — Side-effect only

```go
import _ "github.com/lib/pq"  // chỉ chạy init() của pq

// Trong pq:
func init() {
    sql.Register("postgres", &Driver{})  // đăng ký driver
}
```

---

## 27. Blank Identifier `_`

```go
val, _ := strconv.Atoi("42")   // bỏ qua error

for _, v := range slice { }    // bỏ qua index

import _ "github.com/lib/pq"  // side-effect import

// Compile-time interface check — pattern quan trọng
var _ UserService = (*userServiceImpl)(nil)
// Thiếu method → compile error ngay
```

---

# Phần 4 — Tooling và hệ sinh thái

## 28. `go.mod` và `go.sum` — Quản lý dependency

### go.mod

```
module github.com/DANG-PH/game-service-go

go 1.22

require (
    github.com/gin-gonic/gin v1.9.1
    github.com/jackc/pgx/v5 v5.5.0
)
```

Module name = prefix của mọi import path trong project:

```go
import "github.com/DANG-PH/game-service-go/internal/config"
//     ↑ module name                         ↑ đường dẫn folder
```

### Lệnh thường dùng

```bash
go mod init github.com/ten/project   # Tạo go.mod
go mod tidy                          # Xóa dep thừa, thêm dep thiếu
go get package@version               # Thêm/update 1 dep
go get package@latest                # Lấy version mới nhất
go mod download                      # Download tất cả dep về cache
```

### go.sum

Checksum file — Go tự quản lý, không bao giờ edit tay. Phải commit cùng `go.mod`.

---

## 29. Makefile — Task runner của Go

```makefile
.PHONY: dev run build test lint fmt tidy clean

dev:
    air

build:
    go build -ldflags="-s -w" -o bin/api cmd/api/main.go
    # -s: strip symbol table | -w: strip debug info → binary nhỏ hơn ~30%

test:
    go test ./... -race -cover -timeout 30s

test/cover:
    go test ./... -race -coverprofile=coverage.out
    go tool cover -html=coverage.out -o coverage.html

lint:
    golangci-lint run ./...

fmt:
    go fmt ./...

tidy:
    go mod tidy

clean:
    rm -rf bin/ tmp/ coverage.out coverage.html
```

**`.PHONY`:** Khai báo target không tạo ra file — tránh conflict với file cùng tên.

**TAB, không phải spaces:** Dòng lệnh trong Makefile phải bắt đầu bằng TAB.

---

## 30. Air — Hot reload

```bash
go install github.com/air-verse/air@latest
air        # đọc .air.toml tự động
make dev   # qua Makefile
```

### .air.toml

```toml
root = "."
tmp_dir = "tmp"

[build]
  cmd = "go build -o tmp/api.exe cmd/api/main.go"
  bin = "tmp/api.exe"
  include_ext = ["go", "env"]
  exclude_dir  = ["vendor", "bin", "tmp", "testdata"]
  delay = 500  # ms — chờ sau khi detect change để tránh rebuild liên tục

[misc]
  clean_on_exit = true
```

**Windows:** Binary build vào `tmp/api.exe` cố định → Windows Firewall chỉ hỏi 1 lần.

---

## 31. `.golangci.yml` — Linter

```yaml
run:
  timeout: 5m
  go: "1.22"
  skip-dirs: [vendor/, tmp/, bin/]

linters:
  disable-all: true
  enable:
    - errcheck      # Quên check error
    - govet         # Suspicious constructs
    - staticcheck   # Static analysis nâng cao
    - unused        # Code không dùng
    - gofmt         # Format chuẩn
    - goimports     # Import đúng chuẩn
    - gosec         # Security vulnerability
    - gocyclo       # Function quá phức tạp
    - bodyclose     # Quên close HTTP response body
    - noctx         # HTTP request không có context

linters-settings:
  gocyclo:
    min-complexity: 15

issues:
  exclude-rules:
    - path: _test\.go
      linters: [gosec, errcheck]
    - path: ".*\\.pb\\.go"
      linters: [all]
```

---

## 32. `go vet`, `go fmt`, `go build`, `go run`

```bash
go fmt ./...         # Format tất cả file
go vet ./...         # Static analysis
go build ./...       # Build tất cả (check compile error)
go build -o bin/api cmd/api/main.go  # Build binary cụ thể
go run cmd/api/main.go               # Compile + chạy ngay (không lưu binary)
go install tool@latest               # Cài binary tool vào $GOPATH/bin
```

### Build flags

```bash
# Giảm size binary
go build -ldflags="-s -w" -o api cmd/api/main.go

# Inject version vào binary
go build -ldflags="-X main.Version=1.0.0" -o api

# Cross-compile
GOOS=linux GOARCH=amd64 go build -o api-linux cmd/api/main.go

# Static binary cho Docker Alpine
CGO_ENABLED=0 go build -o api cmd/api/main.go
```

---

## 33. Race Detector

```bash
go test ./... -race   # Phát hiện race condition trong test
go run -race main.go  # Phát hiện trong khi chạy
```

Instrument code — theo dõi mọi memory access. Phát hiện race condition → báo ngay.

**Overhead:** Chậm hơn ~5x → chỉ dùng trong dev/test, không dùng production.

---

## 34. Build Tags

```go
//go:build integration
package integration_test
```

```bash
go test ./...                     # Chỉ unit test
go test ./... -tags integration   # Kèm integration test
```

---

## 35. `go generate` và Code generation

```go
//go:generate mockery --name=UserService --output=../../test/mock
//go:generate stringer -type=Status
//go:generate sqlc generate
```

```bash
go generate ./...   # Chạy tất cả directive
```

---

## 36. Các file config thường gặp

### `.goreleaser.yml` — Release đa platform

```yaml
builds:
  - env: [CGO_ENABLED=0]
    goos: [linux, darwin, windows]
    goarch: [amd64, arm64]
    ldflags: ["-s -w"]
```

Gọi bởi: `goreleaser release` hoặc GitHub Actions khi push tag.

### `.mockery.yaml` — Generate mock

```yaml
with-expecter: true
dir: "test/mock"
packages:
  github.com/DANG-PH/game-service-go/internal/user:
    interfaces: [UserService, UserRepository]
```

Gọi bởi: `mockery --config=.mockery.yaml`

### `sqlc.yaml` — Generate type-safe SQL

```yaml
version: "2"
sql:
  - engine: "postgresql"
    queries: "queries.sql"
    schema: "migrations/"
    gen:
      go:
        package: "db"
        out: "internal/db"
        emit_json_tags: true
```

Gọi bởi: `sqlc generate`

### `buf.yaml` — Protobuf management

```yaml
version: v1
name: buf.build/org/service
lint:
  use: [DEFAULT]
```

```yaml
# buf.gen.yaml
plugins:
  - plugin: go
    out: internal/pb
    opt: [paths=source_relative]
  - plugin: go-grpc
    out: internal/pb
    opt: [paths=source_relative]
```

Gọi bởi: `buf generate`

---

# Phần 5 — Project structure

## 37. Package và Module — Tổ chức code

### Package

1 folder = 1 package. Tất cả file `.go` trong folder phải cùng package name:

```go
// internal/user/handler.go
package user

// internal/user/service.go
package user

// internal/user/service_test.go
package user_test  // black-box test
// hoặc
package user       // white-box test (access unexported)
```

### Import

```go
import (
    // 1. stdlib
    "context"
    "fmt"
    "net/http"

    // 2. external
    "github.com/gin-gonic/gin"

    // 3. internal
    "github.com/DANG-PH/game-service-go/internal/config"
)
```

3 group phân tách bằng blank line — `goimports` tự sắp xếp.

---

## 38. `internal/` `pkg/` `cmd/` — Quy ước thư mục

### `cmd/` — Entry points

```
cmd/
├── api/main.go      → HTTP server
├── worker/main.go   → Background worker
└── migrate/main.go  → DB migration CLI
```

Mỗi `main.go`: load config → wire deps → run. Không có business logic.

### `internal/` — Business code

Go compiler enforce: code trong `internal/` **không thể import từ module khác**.

```
internal/
├── config/           → Config loading
├── app/              → Bootstrap
├── transport/        → Inbound (HTTP, gRPC, MQ)
│   └── http/
│       ├── server.go
│       ├── router.go
│       └── middleware/
├── external/         → Outbound calls
│   ├── client/       → Sync (gRPC, HTTP client)
│   └── messaging/    → Async publish
├── shared/           → Enums, errors, types dùng chung
└── user/             → Domain
    ├── handler.go
    ├── service.go         → Interface
    ├── service_impl.go    → Implementation
    ├── repository.go      → Interface
    ├── model.go
    └── postgres/
        └── repository.go  → DB implementation
```

### `pkg/` — Reusable utilities

Code có thể import từ module khác. Chỉ đặt đây khi: không có business logic đặc thù + service khác có thể dùng không cần sửa.

```
pkg/
├── response/   → HTTP JSON response format
├── apperror/   → Custom error types
├── logger/     → Structured logging wrapper
├── paginate/   → Pagination helpers
└── testutil/   → Test helpers
```

---

## 39. Dependency Injection trong Go — Không có framework

### Manual DI (phổ biến nhất)

```go
func main() {
    cfg := config.Load()

    // Infrastructure
    db := postgres.Connect(cfg.Database)
    redisClient := redis.Connect(cfg.Redis)

    // Repository
    userRepo := userpostgres.NewRepository(db)

    // Service
    userService := user.NewService(userRepo)

    // Handler
    userHandler := user.NewHandler(userService)

    // Transport
    router := http.NewRouter(userHandler)
    server := http.NewServer(cfg.App, router)
    server.Run()
}
```

Ưu điểm: Không magic, đọc `main.go` là thấy toàn bộ dependency graph.

### Wire — Code generation DI (Google)

```go
//go:build wireinject

func InitApp(cfg *config.Config) (*App, error) {
    wire.Build(
        postgres.NewDB,
        userpostgres.NewRepository,
        user.NewService,
        user.NewHandler,
        NewApp,
    )
    return nil, nil
}
```

```bash
wire gen ./...  # Generate wire_gen.go
```

---

# Phần 6 — Testing

## 40. Testing trong Go — Không cần framework

```go
// internal/user/service_test.go
package user_test

import "testing"

func TestCreateUser(t *testing.T) {
    // Arrange
    repo := &mockUserRepository{}
    svc := NewService(repo)

    // Act
    user, err := svc.CreateUser(context.Background(), CreateUserRequest{
        Name:  "Đăng",
        Email: "dang@example.com",
    })

    // Assert
    if err != nil {
        t.Fatalf("expected no error, got: %v", err)
    }
    if user.Name != "Đăng" {
        t.Errorf("expected 'Đăng', got: %s", user.Name)
    }
}
```

```bash
go test ./...                   # Chạy tất cả
go test -v ./...                # Verbose
go test -run TestCreateUser     # Chạy đúng 1 test
go test -timeout 30s ./...
```

### testify

```go
import (
    "github.com/stretchr/testify/assert"
    "github.com/stretchr/testify/require"
)

func TestCreateUser(t *testing.T) {
    user, err := svc.CreateUser(ctx, req)

    require.NoError(t, err)              // FAIL NGAY nếu có error
    assert.Equal(t, "Đăng", user.Name)  // ghi nhận lỗi, tiếp tục
    assert.NotEmpty(t, user.ID)
}
```

### httptest

```go
func TestGetUser(t *testing.T) {
    handler := NewHandler(&mockService{})
    req := httptest.NewRequest(http.MethodGet, "/users/123", nil)
    w := httptest.NewRecorder()

    handler.GetUser(w, req)

    assert.Equal(t, http.StatusOK, w.Code)
}
```

---

## 41. Table-driven Test

Pattern chuẩn và được khuyến khích nhất trong Go:

```go
func TestDivide(t *testing.T) {
    tests := []struct {
        name    string
        a, b    float64
        want    float64
        wantErr bool
    }{
        {"normal", 10, 2, 5, false},
        {"divide by zero", 10, 0, 0, true},
        {"negative", -10, 2, -5, false},
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            got, err := Divide(tt.a, tt.b)
            if tt.wantErr {
                require.Error(t, err)
                return
            }
            require.NoError(t, err)
            assert.Equal(t, tt.want, got)
        })
    }
}
```

```bash
go test -run "TestDivide/divide_by_zero" ./...
```

---

## 42. Mock — Test không cần infra thật

### Mockery — Generate tự động

```bash
mockery --name=UserRepository --output=test/mock
```

```go
// Dùng trong test
func TestGetUser(t *testing.T) {
    mockRepo := &mock.UserRepository{}
    mockRepo.On("FindByID", mock.Anything, "123").
        Return(&User{ID: "123", Name: "Đăng"}, nil)

    svc := NewService(mockRepo)
    user, err := svc.GetUser(context.Background(), "123")

    require.NoError(t, err)
    assert.Equal(t, "Đăng", user.Name)
    mockRepo.AssertExpectations(t)
}
```

---

## 43. Benchmark và Profiling

### Benchmark

```go
func BenchmarkCreateUser(b *testing.B) {
    svc := NewService(&mockRepo{})
    b.ResetTimer()
    for i := 0; i < b.N; i++ {
        svc.CreateUser(context.Background(), req)
    }
}
```

```bash
go test -bench=. -benchmem ./...
# Output:
# BenchmarkCreateUser-8   500000   2340 ns/op   512 B/op   8 allocs/op
```

### pprof

```go
import _ "net/http/pprof"  // dev only!

go func() { http.ListenAndServe("localhost:6060", nil) }()
```

```bash
go tool pprof http://localhost:6060/debug/pprof/profile?seconds=30
go tool pprof http://localhost:6060/debug/pprof/heap
# Trong shell: top10, web, list funcName
```

---

# Phần 7 — Những điều cần biết khi bắt đầu

## 44. Lỗi phổ biến của người mới

### ❌ 1. Capture loop variable trong goroutine

```go
// SAI — tất cả goroutine cùng capture biến i
for i := 0; i < 5; i++ {
    go func() { fmt.Println(i) }()  // có thể in 5,5,5,5,5
}

// ĐÚNG
for i := 0; i < 5; i++ {
    go func(i int) { fmt.Println(i) }(i)
}
// Go 1.22+: loop variable tự copy, không còn bug này
```

### ❌ 2. Goroutine leak

```go
// SAI — goroutine stuck mãi
func leak() {
    ch := make(chan int)
    go func() { ch <- compute() }()
    return  // không đọc ch → goroutine block forever
}

// ĐÚNG
func noLeak(ctx context.Context) {
    ch := make(chan int, 1)
    go func() {
        select {
        case ch <- compute():
        case <-ctx.Done():
        }
    }()
}
```

### ❌ 3. Interface nil != nil

```go
// Bug khó nhất của Go
func getError() error {
    var err *MyError = nil
    return err  // KHÔNG phải nil interface!
}

getError() != nil  // TRUE! interface = (type=*MyError, value=nil)

// ĐÚNG
func getError() error {
    if condition {
        return &MyError{...}
    }
    return nil  // nil interface thật sự
}
```

### ❌ 4. Slice share underlying array

```go
original := []int{1, 2, 3, 4, 5}
slice := original[1:3]
slice[0] = 99
fmt.Println(original)  // [1 99 3 4 5] — bị sửa!

// ĐÚNG — copy độc lập
s := make([]int, 2)
copy(s, original[1:3])
```

### ❌ 5. Nil map panic

```go
var m map[string]int
m["key"] = 1  // PANIC

m := make(map[string]int)  // ĐÚNG
```

### ❌ 6. Quên close channel khi range

```go
ch := make(chan int)
go func() {
    for i := 0; i < 5; i++ { ch <- i }
    // Quên close(ch) → range block mãi
}()
for v := range ch { fmt.Println(v) }  // block forever!

// ĐÚNG
go func() {
    defer close(ch)
    for i := 0; i < 5; i++ { ch <- i }
}()
```

### ❌ 7. Goroutine không sync với main

```go
func main() {
    go func() { fmt.Println("xin chào") }()
    // main return → goroutine bị kill trước khi chạy
}

// ĐÚNG
func main() {
    var wg sync.WaitGroup
    wg.Add(1)
    go func() {
        defer wg.Done()
        fmt.Println("xin chào")
    }()
    wg.Wait()
}
```

---

## 45. Go vs Java — Bảng so sánh chi tiết

| Concept | Java | Go |
|---|---|---|
| **Class** | `class User {}` | `type User struct {}` |
| **Inheritance** | `extends BaseClass` | Embedding |
| **Interface** | `implements UserRepo` | Implicit (duck typing) |
| **Constructor** | `new User()` | `NewUser()` (convention) |
| **Access modifier** | `public/private/protected` | HOA = exported, thường = unexported |
| **Exception** | `try/catch/throw` | `return error value` |
| **Null safety** | NullPointerException | `nil` check thủ công |
| **Generic** | `List<T>` | `[T any]` |
| **Thread** | `new Thread()`, ExecutorService | `go func(){}()` |
| **Sync primitive** | `synchronized`, Lock | `sync.Mutex`, channel |
| **Enum** | `enum Status {}` | `const` + `iota` |
| **Annotation** | `@Bean`, `@Autowired`... | Không có |
| **DI framework** | Spring IoC | Manual / Wire (code gen) |
| **ORM** | Hibernate, JPA | GORM, sqlx, sqlc |
| **HTTP** | Spring MVC | net/http, Gin, Fiber |
| **Testing** | JUnit, Mockito | testing (built-in), testify |
| **Build output** | JAR (cần JRE) | Native binary (độc lập) |
| **Startup** | 2–30 giây | < 100ms |
| **Memory** | 200MB+ (JVM) | 10–30MB |
| **GC pause** | 50–200ms (G1GC) | < 1ms |
| **Overloading** | Có | Không có |
| **Ternary** | `x ? a : b` | Không có |
| **Package** | `com.example.service` | `internal/user` |
| **Dependency** | Maven/Gradle + pom.xml | go.mod |

---

## 46. Go vs NestJS — Bảng so sánh chi tiết

| Concept | NestJS/Node.js | Go |
|---|---|---|
| **Language** | TypeScript/JavaScript | Go |
| **Runtime** | V8 Engine | Native binary |
| **Concurrency** | Event loop (1 thread) | Goroutine (M:N) |
| **I/O model** | Non-blocking, async/await | Blocking (scheduler làm non-blocking) |
| **Async syntax** | `async/await`, Promise | `go func(){}()`, channel |
| **Decorator** | `@Controller`, `@Injectable` | Không có |
| **DI** | NestJS IoC | Manual / Wire |
| **HTTP** | Express under the hood | net/http, Gin |
| **Middleware** | Express middleware chain | Function wrapper |
| **Validation** | class-validator + decorator | struct tags + validator |
| **ORM** | TypeORM, Prisma | GORM, sqlx, sqlc |
| **Error** | throw/catch, Exception filters | return error value |
| **Module system** | NestJS Module decorator | Go package + import |
| **Config** | ConfigModule | os.Getenv, viper |
| **Testing** | Jest | testing (built-in) |
| **Mock** | Jest mock | testify/mock, mockery |
| **Hot reload** | nodemon, ts-node-dev | Air |
| **Dependency** | package.json, npm | go.mod, go get |
| **Build output** | node_modules + JS files | 1 binary file |
| **Docker image** | ~200MB (node:18) | ~15MB (alpine + binary) |
| **Memory** | ~50–100MB | ~10–30MB |
| **Startup** | 1–5 giây | < 100ms |
| **Null** | `undefined`, `null` | `nil` |
| **Optional** | `T \| undefined` | `*T` (pointer) hoặc `(T, bool)` |

---

## 47. Thuật ngữ toàn diện

### Ngôn ngữ và Runtime

| Thuật ngữ | Giải thích |
|---|---|
| **Goroutine** | Lightweight thread của Go — 2KB stack, tạo ~300ns. Chạy hàng triệu cùng lúc. |
| **Channel** | Pipeline type-safe để goroutine giao tiếp: `make(chan T)` |
| **Buffered channel** | `make(chan T, n)` — gửi không block cho đến khi buffer đầy |
| **Unbuffered channel** | `make(chan T)` — gửi block cho đến khi có receiver |
| **select** | Switch trên nhiều channel — chọn cái ready trước |
| **defer** | Trì hoãn gọi function đến khi hàm return (LIFO) |
| **panic** | Runtime error nghiêm trọng — unwind stack, chỉ dùng cho lỗi programmer |
| **recover** | Bắt panic trong defer — cho phép tiếp tục |
| **Interface** | Contract định nghĩa method set — implicit implementation |
| **Embedding** | Nhúng type vào type khác — promote fields và methods |
| **Pointer** | Lưu địa chỉ bộ nhớ: `*T` type, `&` lấy địa chỉ, `*` dereference |
| **nil** | Zero value của pointer, interface, map, slice, channel, func |
| **Zero value** | Giá trị mặc định khi khai báo không gán |
| **Exported** | Bắt đầu bằng chữ HOA — public, dùng từ package khác |
| **Unexported** | Bắt đầu bằng chữ thường — private to package |
| **Receiver** | Type mà method gắn vào: `func (u *User) M()` — `*User` là receiver |
| **Pointer receiver** | `*T` — method thay đổi được struct |
| **Value receiver** | `T` — method nhận bản sao, không thay đổi original |
| **Type assertion** | `v.(T)` hoặc `v, ok := v.(T)` |
| **Type switch** | `switch v := x.(type)` |
| **Variadic** | `func f(args ...T)` — số lượng arg tùy ý |
| **Closure** | Function capture biến từ outer scope |
| **iota** | Counter tự tăng trong const block — enum pattern |
| **Blank identifier** | `_` — bỏ qua giá trị |
| **init()** | Tự động chạy khi package import, trước main() |
| **Blank import** | `import _ "pkg"` — chỉ chạy init() |
| **Named return** | `func f() (result int)` — return variable có tên |
| **Naked return** | `return` không argument |
| **Struct tag** | Metadata trong backtick: `` `json:"name"` `` |
| **Method set** | Tập methods mà type có — quyết định implement interface nào |
| **Generics** | `[T constraint]` — type parameter, Go 1.18+ |
| **Type constraint** | Giới hạn type trong generics: `comparable`, `any`, `int\|float64` |
| **Comparable** | Type có thể dùng `==` `!=` — dùng làm map key |

### Runtime và Memory

| Thuật ngữ | Giải thích |
|---|---|
| **Go runtime** | Built-in trong binary — scheduler, GC, netpoller, memory allocator |
| **GMP model** | Goroutine-Machine-Processor — mô hình scheduler |
| **G** | Goroutine — unit of work |
| **M** | Machine — OS thread thật |
| **P** | Processor — logical CPU, số lượng = GOMAXPROCS |
| **GOMAXPROCS** | Số P — mặc định = số CPU core |
| **Work stealing** | P rảnh lấy goroutine từ P khác |
| **Goroutine park** | Goroutine bị tạm dừng khi block — không chiếm CPU |
| **Goroutine unpark** | Goroutine được resume khi I/O xong |
| **netpoller** | Dùng epoll/kqueue/IOCP — quản lý network I/O non-blocking |
| **Stack** | Vùng nhớ nhanh per-goroutine, tự co giãn (2KB → 1GB) |
| **Heap** | Vùng nhớ dynamic — GC quản lý |
| **Escape analysis** | Compiler quyết định biến nào lên heap |
| **Escape to heap** | Biến phải lên heap vì sống lâu hơn function |
| **GC** | Garbage Collector — tricolor mark-and-sweep, concurrent |
| **STW** | Stop-The-World — GC pause < 1ms trong Go |
| **Goroutine leak** | Goroutine stuck, không bao giờ kết thúc |
| **AOT** | Ahead-Of-Time compile — Go compile ra native binary |
| **Static binary** | Binary độc lập, không phụ thuộc external lib |
| **CGO_ENABLED=0** | Tắt C interop — tạo pure Go static binary |

### Tooling và File

| Thuật ngữ | Giải thích |
|---|---|
| **Module** | Đơn vị phân phối code — 1 repo = 1 module, khai báo trong `go.mod` |
| **Package** | Đơn vị tổ chức code — 1 folder = 1 package |
| **Import path** | `"github.com/org/repo/internal/user"` |
| **go.mod** | Module name + dependencies — như `package.json` |
| **go.sum** | Checksum của dependencies — đảm bảo integrity |
| **go mod tidy** | Xóa dep thừa, thêm dep thiếu |
| **Makefile** | Shortcut commands — `make dev`, `make test` |
| **Air** | Hot-reload — rebuild + restart khi save |
| **.air.toml** | Config của Air |
| **golangci-lint** | Meta-linter — nhiều linter, 1 config |
| **.golangci.yml** | Config của golangci-lint |
| **Linter** | Tool phân tích code tĩnh, không chạy code |
| **go vet** | Built-in static analyzer |
| **go fmt / goimports** | Code formatter |
| **Race detector** | `-race` — phát hiện data race runtime |
| **Build tag** | `//go:build tag` — điều kiện compile file |
| **go generate** | Chạy code generator theo directive |
| **Wire** | DI code generation của Google |
| **mockery** | Generate mock từ interface |
| **sqlc** | Generate type-safe Go code từ SQL |
| **buf** | Protobuf management tool |
| **goreleaser** | Build + release binary đa platform |
| **testdata/** | Fixtures cho test — Go convention |
| **pprof** | Built-in profiler |
| **Benchmark** | `func BenchmarkXxx(b *testing.B)` |
| **Table-driven test** | Pattern test dùng slice of struct |

### Sync và Concurrency

| Thuật ngữ | Giải thích |
|---|---|
| **Race condition** | 2 goroutine read/write 1 biến không sync → undefined behavior |
| **Data race** | Race condition ở cấp memory |
| **Mutex** | Mutual exclusion lock |
| **sync.Mutex** | Khóa độc quyền |
| **sync.RWMutex** | Nhiều reader hoặc 1 writer |
| **sync.WaitGroup** | Chờ nhiều goroutine hoàn thành |
| **sync.Once** | Chạy đúng 1 lần, thread-safe |
| **sync.Pool** | Pool tái dùng object — giảm GC |
| **sync.Map** | Map thread-safe built-in |
| **Deadlock** | 2 goroutine chờ nhau mãi — Go runtime detect, panic |
| **Fan-out** | 1 input → nhiều goroutine song song |
| **Fan-in** | Nhiều goroutine → 1 channel |
| **Worker pool** | N goroutine xử lý queue — giới hạn concurrency |

### Error handling

| Thuật ngữ | Giải thích |
|---|---|
| **Sentinel error** | Error khai báo trước: `var ErrNotFound = errors.New(...)` |
| **Error wrapping** | `fmt.Errorf("ctx: %w", err)` — thêm context, giữ original |
| **errors.Is** | Check error qua nhiều lớp wrap |
| **errors.As** | Lấy typed error qua nhiều lớp wrap |
| **Unwrap** | `func (e *E) Unwrap() error` — cho errors.Is/As đi qua |

---

<p align="center">
  <sub>Tài liệu đủ để dev từ Java/NestJS bắt đầu làm việc với Go ngay. Cập nhật khi có khái niệm mới.</sub>
</p>