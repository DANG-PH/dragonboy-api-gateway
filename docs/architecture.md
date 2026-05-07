# Dragon Boy - System Architecture

Tài liệu mô tả kiến trúc tổng thể của hệ thống Dragon Boy - game online dạng microservice.

## 1. Tổng quan kiến trúc

Hệ thống được xây dựng theo kiến trúc microservice với pattern **database-per-service**. Mỗi service sở hữu DB riêng và giao tiếp với nhau qua gRPC (sync), WebSocket (realtime với client), hoặc Outbox/Saga pattern (async).

### Stack chính

- **Backend**: NestJS + TypeORM + gRPC, Go (game-service-go)
- **Database**:
  - MySQL InnoDB: auth, user, item, pay, social, detu, game-data
  - PostgreSQL: admin (vì cần `jsonb` cho saga payload)
  - MongoDB: logger
  - Redis: cache, session, OTP
- **Realtime với client**: WebSocket (game-service NestJS), UDP/TCP custom (game-service-go với tickrate 20Hz)
- **Infra**: Cloudflared, Nginx (reverse proxy DB), Docker Compose, 3 VPS
- **Patterns**: Saga, Outbox, Idempotency Key, Optimistic Lock

### Service Topology

```mermaid
graph TB
    Client[Game Client / Web Client]
    CF[Cloudflared Tunnel]

    Client -->|HTTPS| CF
    CF --> Gateway

    subgraph App["Application Layer"]
        Gateway[API Gateway<br/>gRPC Client]
        Auth[Auth Service]
        User[User Service]
        Pay[Pay Service]
        Item[Item Service]
        Social[Social Service]
        Admin[Admin Service]
        Detu[Đệ Tử Service]
        GameData[Game Data Service]
        Queue[Queue Service]
        Devops[Devops Service]
        GameNest[Game Service NestJS<br/>WebSocket Server]
        GameGo[Game Service Go<br/>20Hz Tickrate]
    end

    subgraph DB["Database Layer - VPS Infra"]
        Nginx[Nginx Reverse Proxy]
        MySQL[(MySQL)]
        Postgres[(PostgreSQL)]
        Mongo[(MongoDB)]
        Redis[(Redis)]
    end

    Client -.WebSocket.-> GameNest
    Client -.UDP/TCP.-> GameGo

    Gateway --> Auth
    Gateway --> User
    Gateway --> Pay
    Gateway --> Item
    Gateway --> Social
    Gateway --> Admin
    Gateway --> Detu
    Gateway --> GameData
    Gateway --> Queue
    Gateway --> Devops

    Auth --> User
    Auth --> Pay
    Admin --> Auth
    Admin --> Pay
    Social --> Auth
    User --> Pay
    User --> Detu
    GameNest --> User
    GameNest --> Item
    Queue --> Item

    Auth --> Nginx
    User --> Nginx
    Pay --> Nginx
    Item --> Nginx
    Social --> Nginx
    Admin --> Nginx
    Detu --> Nginx
    GameData --> Nginx
    Queue --> Nginx
    GameNest --> Nginx
    GameGo --> Nginx

    Nginx --> MySQL
    Nginx --> Postgres
    Nginx --> Mongo
    Nginx --> Redis

    classDef gateway fill:#fef3c7,stroke:#d97706
    classDef game fill:#fce7f3,stroke:#be185d
    classDef infra fill:#e0e7ff,stroke:#4338ca
    classDef db fill:#e1f5ff,stroke:#0369a1
    class Gateway gateway
    class GameNest,GameGo game
    class CF,Nginx infra
    class MySQL,Postgres,Mongo,Redis db
```

**Quy ước:**
- Mũi tên liền `-->`: sync gRPC call
- Mũi tên đứt `-.->`: realtime WebSocket/UDP với client

### Coupling Matrix

Bảng này tổng hợp tất cả coupling giữa các service trong hệ thống:

| From → To | Auth | User | Pay | Item | Social | Admin | Detu | GameData | Queue | Devops | GameNest | GameGo |
|-----------|------|------|-----|------|--------|-------|------|----------|-------|--------|----------|--------|
| **API Gateway** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Auth** | - | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **User** | ❌ | - | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Pay** | ❌ | ❌ | - | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Item** | ❌ | ❌ | ❌ | - | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Social** | ✅ | ❌ | ❌ | ❌ | - | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Admin** | ✅ | ❌ | ✅ | ❌ | ❌ | - | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Detu** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | - | ❌ | ❌ | ❌ | ❌ | ❌ |
| **GameData** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | - | ❌ | ❌ | ❌ | ❌ |
| **Queue** | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | - | ❌ | ❌ | ❌ |
| **GameNest** | ❌ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | - | ❌ |
| **GameGo** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | - |

**Nhận xét:**
- `Pay`, `Item`, `Detu`, `GameData`, `GameGo` là **leaf services** (không gọi ai)
- `API Gateway` là entry point chính cho web client
- `GameNest` và `GameGo` được client game gọi trực tiếp, không qua Gateway
- `Auth` và `Admin` là 2 service có nhiều outgoing call nhất do chứa business logic phức tạp

## 2. ERD tổng thể toàn hệ thống

ERD bên dưới hiển thị **toàn bộ entity** của hệ thống, kèm theo cả physical FK (trong cùng DB) lẫn logical FK (xuyên service).

> ⚠️ **Lưu ý quan trọng**: Quan hệ giữa các service là **logical FK** - chỉ tồn tại ở tầng application, không có constraint vật lý ở DB. Tool reverse-engineering sẽ không detect được các quan hệ này.

```mermaid
erDiagram
    %% ========== AUTH SERVICE (MySQL) ==========
    AUTH ||--o{ REGISTER_OUTBOX : "saga register"

    AUTH {
        int id PK
        string username UK
        string email
        string realname
        boolean biBan
        string role "USER/ADMIN/EDITOR/PARTNER"
        int tokenVersion
        string password
        string avatarUrl
        int type "0=normal 1=google"
        timestamp createdAt
        timestamp updatedAt
    }
    REGISTER_OUTBOX {
        uuid id PK
        json payload
        string status "PENDING/PROCESSING/DONE/FAILED"
        int retries
        int maxRetries
        datetime nextRetryAt
        text lastError
    }
    AUTH_IDEMPOTENCY {
        string key PK
        json response
        datetime expires_at
    }

    %% ========== USER SERVICE (MySQL) ==========
    USERS ||--|| USER_GAME_STATS : "1-1"
    USERS ||--|| USERS_POSITION : "1-1"
    USERS ||--o{ USERS_WEB_ITEM : "1-n"

    USERS {
        int id PK
        bigint auth_id UK "logical FK AUTH.id"
        string gameName
        string avatarUrl "duplicated from AUTH"
        timestamp createdAt
        timestamp updatedAt
    }
    USER_GAME_STATS {
        int id PK
        int userId FK
        bigint vang "indexed leaderboard"
        bigint ngoc
        bigint sucManh "indexed leaderboard"
        bigint vangNapTuWeb
        bigint ngocNapTuWeb
        boolean daVaoTaiKhoanLanDau
        boolean coDeTu
    }
    USERS_POSITION {
        int id PK
        int userId FK
        float x
        float y
        string mapHienTai
    }
    USERS_WEB_ITEM {
        int id PK
        int userId FK
        bigint item_id "logical FK ITEMS"
        bigint price
        timestamp createdAt
    }
    BUY_ITEM_OUTBOX {
        int id PK
        json payload
        string status
        int retries
        datetime nextRetryAt
    }
    CREATE_PAY_OUTBOX {
        uuid id PK
        json payload
        string status
        int retries
        datetime nextRetryAt
    }

    %% ========== DETU SERVICE (MySQL) ==========
    DETU {
        int id PK
        bigint sucManh "default 2000"
        int userId "logical FK USERS.id"
    }

    %% ========== ITEM SERVICE (MySQL) ==========
    ITEMS {
        int id PK
        string maItem
        string ten
        string loai
        text moTa
        int soLuong
        string hanhTinh
        string setKichHoat
        int soSaoPhaLe
        int soSaoPhaLeCuongHoa
        int soCap
        float hanSuDung
        string sucManhYeuCau
        string linkTexture
        string viTri
        text chiso "JSON string"
        int userId "indexed logical FK USERS"
        string uuid
    }

    %% ========== PAY SERVICE (MySQL) ==========
    PAY ||..o{ CASH_FLOW_MANAGEMENT : "lịch sử"

    PAY {
        int id PK
        string tien "default 0"
        int userId UK "logical FK USERS"
        string status "open/closed"
        timestamp updatedAt
    }
    CASH_FLOW_MANAGEMENT {
        int id PK
        int userId "indexed logical FK"
        string type "NAP/RUT"
        int amount
        timestamp create_at
    }
    PAY_IDEMPOTENCY {
        string key PK
        json response
        datetime expires_at
    }

    %% ========== SOCIAL SERVICE (MySQL) ==========
    CHAT_GROUPS ||--o{ CHAT_GROUP_MEMBERS : "có thành viên"
    COMMENTS ||..o{ COMMENT_LIKES : "logical"
    COMMENTS ||..o{ COMMENTS : "parent-child"

    CHAT {
        int id PK
        string roomId "composite idx with createdAt"
        int userId "logical FK"
        longtext content
        timestamp createdAt
    }
    CHAT_GROUPS {
        int id PK
        string name
        string avatarUrl
        string description
        int ownerId "logical FK USERS"
        int maxMember "default 500"
        timestamp createdAt
    }
    CHAT_GROUP_MEMBERS {
        int id PK
        int groupId FK
        int userId "indexed logical FK"
        int role
        timestamp joinedAt
    }
    COMMENTS {
        int id PK
        int postId "indexed logical FK POSTS"
        int parentId "self-ref"
        int userId "logical FK"
        int likeCount "denormalized"
        boolean isDelete "soft delete"
        string content
        timestamp createdAt
    }
    COMMENT_LIKES {
        int id PK
        int commentId "logical FK"
        int userId "logical FK"
        timestamp createdAt
    }
    NOTIFICATION {
        int id PK
        int userId "indexed logical FK"
        string title
        longtext content
        timestamp createdAt
    }
    SOCIAL_NETWORK {
        int id PK
        int userId "logical FK"
        int friendId "logical FK"
        int status "0=pending 1=accepted 2=blocked"
        timestamp createdAt
    }

    %% ========== ADMIN SERVICE (PostgreSQL) ==========
    ACCOUNTS_SELL ||..o{ OUTBOX_EVENTS : "BUY_ACCOUNT saga"
    OUTBOX_EVENTS ||..|| SAGA_STATE : "tracks progress"

    WITHDRAW_MONEY {
        int id PK
        int userId "indexed logical FK AUTH"
        int amount
        string bank_name
        string bank_number
        string bank_owner
        string status "PENDING/SUCCESS/ERROR"
        int finance_id "admin duyệt"
        timestamp request_at
        timestamp success_at
    }
    POSTS {
        int id PK
        string title
        string url_anh
        text content
        int editor_id "indexed logical FK AUTH"
        string editor_realname "duplicated"
        string status "ACTIVE/LOCKED"
        timestamp create_at
        timestamp update_at
    }
    ACCOUNTS_SELL {
        int id PK
        string username
        string password
        string url
        string description
        int price
        string status "SOLD/ACTIVE"
        int partner_id "logical FK AUTH"
        int buyer_id "logical FK AUTH"
        int version "optimistic lock"
        timestamp createdAt
    }
    OUTBOX_EVENTS {
        uuid id PK
        string sagaType "BUY_ACCOUNT"
        jsonb payload
        string status
        int retries
        int maxRetries
        timestamp nextRetryAt
        text lastError
    }
    SAGA_STATE {
        uuid saga_id PK
        enum phase "FORWARD/COMPENSATING/DONE/FAILED"
        int attempt
        jsonb completed_steps
        text original_password
        text original_email
    }

    %% ========== GAME-DATA SERVICE (MySQL - master data) ==========
    MAP_BASE ||--o{ NPC_SPAWN : "có spawn"
    NPC_BASE ||--o{ NPC_SPAWN : "được spawn"
    NPC_BASE ||--o{ NPC_SHOP_ITEM : "shop của NPC"
    ITEM_BASE ||--o{ NPC_SHOP_ITEM : "item bán"

    MAP_BASE {
        int id PK
        string ten UK
    }
    NPC_BASE {
        int id PK
        string ten UK
        enum loai "NGUOI/CAYDAU/RUONGDO/DUIGA"
    }
    ITEM_BASE {
        int id PK
        string ten UK
        string ma UK
    }
    NPC_SPAWN {
        int id PK
        int npc_base_id FK
        int map_id FK
        float x
        float y
        boolean is_active
    }
    NPC_SHOP_ITEM {
        int id PK
        int npc_base_id FK
        int item_base_id FK
        int gia
        enum loaiTien "VANG/NGOC"
        enum tab "AO_QUAN/PHU_KIEN/DAC_BIET"
        boolean is_active
    }

    %% ========== LOGICAL FK XUYÊN SERVICE ==========
    AUTH ||..|| USERS : "logical 1-1"
    USERS ||..|| DETU : "logical 1-1"
    USERS ||..o{ ITEMS : "logical 1-n"
    USERS ||..|| PAY : "logical 1-1"
    USERS ||..o{ CHAT : "logical chat"
    USERS ||..o{ CHAT_GROUPS : "owner"
    USERS ||..o{ CHAT_GROUP_MEMBERS : "member"
    USERS ||..o{ COMMENTS : "viết comment"
    USERS ||..o{ NOTIFICATION : "nhận noti"
    USERS ||..o{ SOCIAL_NETWORK : "friend"
    AUTH ||..o{ WITHDRAW_MONEY : "rút tiền"
    AUTH ||..o{ POSTS : "editor viết"
    AUTH ||..o{ ACCOUNTS_SELL : "partner bán"
    POSTS ||..o{ COMMENTS : "logical bài viết"
    ITEMS ||..o{ USERS_WEB_ITEM : "logical mua web"
```

### Quy ước trong ERD

| Ký hiệu | Ý nghĩa |
|---------|---------|
| `\|\|--o{` | Quan hệ 1-n có physical FK (cùng DB) |
| `\|\|--\|\|` | Quan hệ 1-1 có physical FK |
| `\|\|..o{` | Quan hệ 1-n logical (xuyên service, không có FK vật lý) |
| `\|\|..\|\|` | Quan hệ 1-1 logical (xuyên service) |

## 3. Use Case Flows

Phần này mô tả các luồng nghiệp vụ chính của hệ thống. Mỗi flow có sequence diagram thể hiện chính xác RPC calls, sync/async, và error handling.

### 3.1. Register Flow (Saga)

User đăng ký tài khoản mới. Flow này dùng saga vì cần tạo record ở 3 service: auth, user, pay.

```mermaid
sequenceDiagram
    autonumber
    participant C as Client
    participant GW as API Gateway
    participant Auth as Auth Service
    participant Outbox as register_outbox
    participant User as User Service
    participant Pay as Pay Service

    C->>GW: POST /register {username, password, email, realname, gameName}
    GW->>Auth: Register(RegisterRequest)
    Auth->>Auth: validate username unique
    Auth->>Auth: hash password
    Auth->>Auth: BEGIN TX
    Auth->>Auth: INSERT auth (status verified)
    Auth->>Outbox: INSERT register_outbox (PENDING)<br/>payload: {authId, gameName, sagaId}
    Auth->>Auth: COMMIT TX
    Auth-->>GW: RegisterResponse {success: true, auth_id}
    GW-->>C: 201 Created

    Note over Outbox: Outbox poller chạy nền

    loop Poller every Ns
        Outbox->>Outbox: SELECT WHERE status=PENDING<br/>AND nextRetryAt <= NOW()
        Outbox->>User: Register(RegisterRequest {id, gameName})

        User->>User: BEGIN TX
        User->>User: INSERT users
        User->>User: INSERT user_game_stats (default vang=0...)
        User->>User: INSERT users_position (default x=100, y=175)
        User->>User: INSERT create_pay_outbox (PENDING)
        User->>User: COMMIT TX
        User-->>Outbox: success

        Note over User,Pay: Sub-saga: tạo ví
        loop User's outbox poller
            User->>Pay: CreatePay(CreatePayRequest {userId})
            Pay->>Pay: INSERT pay (tien=0, status=open)
            Pay-->>User: PayResponse
            User->>User: mark create_pay_outbox DONE
        end

        Outbox->>Outbox: mark register_outbox DONE
    end
```

**Đặc điểm:**
- Auth response cho client ngay khi insert auth thành công, **không đợi user/pay tạo xong** (eventual consistency)
- Nếu user/pay tạo lỗi, outbox poller sẽ retry tới khi thành công
- Client có thể login ngay sau register (auth đã có), nhưng game data có thể chưa sẵn sàng vài giây đầu

### 3.2. Login Flow (với OTP)

```mermaid
sequenceDiagram
    autonumber
    participant C as Client
    participant GW as API Gateway
    participant Auth as Auth Service
    participant Redis as Redis<br/>(session/OTP)
    participant Mail as Email Service

    C->>GW: POST /login {username, password}
    GW->>Auth: Login(LoginRequest)
    Auth->>Auth: verify password
    Auth->>Auth: check biBan
    Auth->>Redis: SET session:{sessionId} TTL 5min
    Auth->>Auth: generate OTP 6 digits
    Auth->>Redis: SET otp:{sessionId} TTL 5min
    Auth->>Mail: send OTP email
    Auth-->>GW: LoginResponse {sessionId}
    GW-->>C: 200 OK {sessionId}

    Note over C: User check email và nhập OTP

    C->>GW: POST /verify-otp {sessionId, otp}
    GW->>Auth: VerifyOTP(VerifyOtpRequest)
    Auth->>Redis: GET otp:{sessionId}
    Auth->>Auth: compare OTP
    Auth->>Auth: generate JWT (access + refresh)<br/>include tokenVersion
    Auth->>Redis: DEL otp:{sessionId}
    Auth-->>GW: VerifyOtpResponse {access_token, refresh_token, auth_id, role}
    GW-->>C: 200 OK + tokens
```

### 3.3. Login với Google OAuth

```mermaid
sequenceDiagram
    autonumber
    participant C as Client
    participant GW as API Gateway
    participant Auth as Auth Service
    participant Google as Google API
    participant User as User Service
    participant Pay as Pay Service

    C->>Google: OAuth flow
    Google-->>C: tokenFromGoogle
    C->>GW: POST /login-google {tokenFromGoogle}
    GW->>Auth: LoginWithGoogle(LoginWithGoogleRequest)
    Auth->>Google: verify token
    Google-->>Auth: user info {email, name, picture}

    alt User chưa tồn tại
        Auth->>Auth: INSERT auth (type=1)
        Auth->>User: Register (qua outbox như Register Flow)
        Auth->>Pay: CreatePay (qua sub-saga)
        Note over Auth: register=true
    else User đã tồn tại
        Auth->>Auth: SELECT auth WHERE email=?
        Note over Auth: register=false
    end

    Auth->>Auth: generate JWT tokens
    Auth-->>GW: LoginWithGoogleResponse {access_token, refresh_token, auth_id, role, register}
    GW-->>C: 200 OK
```

### 3.4. Buy Item from Web (Saga với Outbox)

User mua item từ web. Item phải có trong inventory **trước** khi trừ tiền (nếu trừ tiền trước, lỡ tạo item fail thì khó refund tự động).

```mermaid
sequenceDiagram
    autonumber
    participant C as Client
    participant GW as API Gateway
    participant User as User Service
    participant Item as Item Service
    participant Outbox as buy_item_outbox
    participant Pay as Pay Service

    C->>GW: POST /buy-item {itemId, idempotencyKey}
    GW->>User: AddItemWeb(AddItemRequest)

    User->>Item: AddItem(AddItemRequest {userId, item})
    Item->>Item: INSERT items
    Item-->>User: ItemResponse {item}

    User->>User: BEGIN TX
    User->>User: INSERT users_web_item
    User->>Outbox: INSERT buy_item_outbox PENDING<br/>{userId, amount, idempotencyKey}
    User->>User: COMMIT TX
    User-->>GW: MessageResponse {success}
    GW-->>C: 200 OK "Item added, deducting balance..."

    loop Outbox poller
        Outbox->>Pay: UpdateMoney(UpdateMoneyRequest<br/>{userId, -amount, idempotencyKey})
        Pay->>Pay: check idempotency key
        alt Key chưa dùng
            Pay->>Pay: BEGIN TX
            Pay->>Pay: UPDATE pay SET tien = tien - amount
            Pay->>Pay: INSERT cash_flow_management (RUT)
            Pay->>Pay: INSERT idempotency_keys
            Pay->>Pay: COMMIT TX
            Pay-->>Outbox: success
            Outbox->>Outbox: mark DONE
        else Key đã dùng (replay)
            Pay-->>Outbox: cached response
            Outbox->>Outbox: mark DONE
        end
    end
```

**Lưu ý design:**
- `BUY_ITEM_OUTBOX` không có status `FAILED` - **bắt buộc phải retry** đến khi trừ được tiền vì item đã tạo
- Idempotency key đảm bảo retry nhiều lần không trừ tiền nhiều lần
- Trade-off: nếu user hết tiền thì admin phải intervene manual

### 3.5. Buy Account Flow (Saga phức tạp với Compensation)

Đây là flow phức tạp nhất hệ thống. User mua account từ partner thông qua admin service.

```mermaid
sequenceDiagram
    autonumber
    participant C as Client
    participant GW as API Gateway
    participant Admin as Admin Service
    participant Outbox as outbox_events
    participant Saga as saga_state
    participant Pay as Pay Service
    participant Auth as Auth Service

    C->>GW: POST /buy-account {accountId, userId}
    GW->>Admin: BuyAccount(BuyAccountRequest)

    Admin->>Admin: BEGIN TX
    Admin->>Admin: SELECT FOR UPDATE accounts_sell<br/>WHERE id=? AND status=ACTIVE<br/>(optimistic lock với version)
    Admin->>Admin: UPDATE accounts_sell SET status=PROCESSING, buyer_id=?, version+1
    Admin->>Outbox: INSERT BUY_ACCOUNT (PENDING)<br/>payload: {accountId, buyerId, partnerId, price}
    Admin->>Saga: INSERT saga_state (phase=FORWARD, attempt=1)
    Admin->>Admin: COMMIT TX
    Admin-->>GW: BuyAccountResponse {message: "Processing"}
    GW-->>C: 202 Accepted

    Note over Outbox,Saga: Saga forward

    loop Outbox poller
        Outbox->>Pay: UpdateMoney(buyer, -price)

        alt Step 1: trừ tiền buyer thành công
            Pay-->>Saga: completed_steps += "DEDUCT_BUYER"
            Saga->>Pay: UpdateMoney(partner, +price)

            alt Step 2: cộng tiền partner thành công
                Pay-->>Saga: completed_steps += "CREDIT_PARTNER"
                Saga->>Auth: GetEmailUser(partner_id)
                Saga->>Saga: lưu original_email, generate new password
                Saga->>Auth: SystemChangePassword(account, newPassword)

                alt Step 3: đổi password thành công
                    Auth-->>Saga: completed_steps += "CHANGE_PASSWORD"
                    Saga->>Auth: ChangeEmail(account, newEmail)

                    alt Step 4: đổi email thành công
                        Auth-->>Saga: completed_steps += "CHANGE_EMAIL"
                        Saga->>Admin: UPDATE accounts_sell SET status=SOLD
                        Saga->>Saga: phase=DONE
                        Note over Saga: ✅ Saga complete
                    else Step 4 fail
                        Saga->>Saga: phase=COMPENSATING
                        Note over Saga: bắt đầu rollback ngược
                    end
                end
            end
        else Step 1 fail (buyer hết tiền)
            Pay-->>Outbox: ERROR
            Outbox->>Outbox: retries++, nextRetryAt = NOW + backoff
            alt retries > maxRetries
                Outbox->>Outbox: status=FAILED
                Saga->>Admin: UPDATE accounts_sell SET status=ACTIVE (rollback)
                Saga->>Saga: phase=FAILED
            end
        end
    end

    Note over Saga: Compensation flow (nếu fail giữa chừng)

    alt phase=COMPENSATING
        Saga->>Saga: đọc completed_steps reverse
        opt CHANGE_EMAIL trong completed
            Saga->>Auth: ChangeEmail(account, original_email)
        end
        opt CHANGE_PASSWORD trong completed
            Saga->>Auth: SystemChangePassword(account, original_password)
        end
        opt CREDIT_PARTNER trong completed
            Saga->>Pay: UpdateMoney(partner, -price)
        end
        opt DEDUCT_BUYER trong completed
            Saga->>Pay: UpdateMoney(buyer, +price)
        end
        Saga->>Admin: UPDATE accounts_sell SET status=ACTIVE
        Saga->>Saga: phase=FAILED
    end
```

**Tại sao phức tạp vậy:**
- Nhiều bước cross-service, mỗi bước đều có thể fail
- Cần lưu `original_password`, `original_email` trong `saga_state` để rollback chính xác
- `completed_steps` (jsonb) track step nào đã chạy để compensation đúng thứ tự ngược
- Optimistic lock (`version`) tránh 2 user mua cùng 1 account

### 3.6. Withdraw Money Flow (Admin duyệt)

User yêu cầu rút tiền, admin xét duyệt thủ công.

```mermaid
sequenceDiagram
    autonumber
    participant U as User
    participant A as Admin
    participant GW as API Gateway
    participant Cashier as Admin Service
    participant Pay as Pay Service

    U->>GW: POST /withdraw {amount, bank info}
    GW->>Cashier: CreateWithdrawRequest
    Cashier->>Pay: GetPayByUserId(userId)
    Pay-->>Cashier: current balance
    Cashier->>Cashier: validate balance >= amount
    Cashier->>Cashier: INSERT withdraw_money (PENDING)
    Cashier-->>GW: WithdrawResponse
    GW-->>U: 201 Created

    Note over A: Admin xem dashboard

    A->>GW: GET /withdraws/all
    GW->>Cashier: GetAllWithdrawRequests
    Cashier-->>A: list pending withdraws

    Note over A: Admin chuyển khoản thủ công ở bank, rồi confirm

    A->>GW: POST /withdraw/approve {id, finance_id}
    GW->>Cashier: ApproveWithdraw
    Cashier->>Cashier: BEGIN TX
    Cashier->>Pay: UpdateMoney(userId, -amount, idempotencyKey)
    Pay->>Pay: trừ tiền + ghi cash_flow (RUT)
    Pay-->>Cashier: success
    Cashier->>Cashier: UPDATE withdraw SET status=SUCCESS, finance_id, success_at
    Cashier->>Cashier: COMMIT TX
    Cashier-->>A: WithdrawResponse
```

### 3.7. Game Connect Flow (Realtime)

Client game kết nối tới game server. Đây là flow đặc biệt vì client không qua API Gateway.

```mermaid
sequenceDiagram
    autonumber
    participant C as Game Client
    participant GameNest as Game Service NestJS
    participant Auth as Auth Service
    participant User as User Service
    participant Item as Item Service
    participant GameGo as Game Service Go

    Note over C,GameGo: Phase 1: WebSocket connect tới NestJS

    C->>GameNest: WS connect + JWT
    GameNest->>Auth: GetTokenVersion + verify JWT
    Auth-->>GameNest: valid + role

    GameNest->>User: GetProfile(authId)
    User-->>GameNest: {x, y, mapHienTai, vang, ngoc, sucManh, gameName...}

    GameNest->>Item: GetItemsByUser(userId)
    Item-->>GameNest: inventory list

    GameNest->>GameNest: build initial game state
    GameNest-->>C: WS message: GAME_STATE_INIT

    Note over C,GameGo: Phase 2: kết nối UDP/TCP tới Go server cho realtime movement

    C->>GameGo: UDP connect + sessionToken
    GameGo->>GameGo: register client vào room theo map

    Note over C,GameGo: Phase 3: realtime loop

    loop Mỗi 50ms (20Hz)
        C->>GameGo: input (move, action)
        GameGo->>GameGo: update game state in-memory
        GameGo->>C: broadcast state của all players cùng map
        GameGo->>C: broadcast state của other players cùng map
    end

    Note over C,GameGo: Phase 4: định kỳ persist state

    loop Mỗi N giây
        C->>GameNest: WS message: SAVE_GAME
        GameNest->>User: SavePosition(userId, x, y, map)
        GameNest->>User: SaveGame(stats updated)
        User-->>GameNest: success
    end
```

**Tại sao tách 2 game service:**
- **NestJS**: handle business logic (load profile, save game, validate action) - cần gọi gRPC nhiều
- **Go**: handle high-frequency realtime broadcast (20Hz = 20 lần/giây mỗi client) - cần performance cao, ít business logic
- Tách ra để mỗi service tối ưu cho mục đích riêng, NestJS không bị nghẽn vì broadcast

### 3.8. Friend & Chat Flow

```mermaid
sequenceDiagram
    autonumber
    participant U1 as User A
    participant U2 as User B
    participant GW as API Gateway
    participant Social as Social Service
    participant Auth as Auth Service

    Note over U1,U2: Add friend

    U1->>GW: POST /friend/add {friendId: B}
    GW->>Social: AddFriend(userId=A, friendId=B)
    Social->>Social: INSERT social_network (status=PENDING)
    Social-->>GW: AddFriendResponse
    GW-->>U1: 200 OK

    Note over U2: User B vào trang bạn bè

    U2->>GW: GET /friend/incoming
    GW->>Social: GetIncomingFriend(userId=B)
    Social->>Social: SELECT WHERE friendId=B AND status=PENDING
    Social->>Auth: GetRealnameAvatar(userIds=[A])
    Auth-->>Social: {realname, avatarUrl}
    Social-->>GW: list relations
    GW-->>U2: 200 OK

    U2->>GW: POST /friend/accept {relationId}
    GW->>Social: AcceptFriend
    Social->>Social: UPDATE social_network SET status=ACCEPTED
    Social-->>GW: success

    Note over U1,U2: Chat

    U1->>GW: POST /chat/send {friendId: B, content}
    GW->>Social: CanChat(userId=A, friendId=B)
    Social->>Social: check status=ACCEPTED, không bị BLOCKED
    Social-->>GW: canChat=true
    GW->>Social: SaveMessage({roomId, userId, content})
    Social->>Social: INSERT chat
    Social-->>GW: success
    GW-->>U1: 200 OK
```

### 3.9. Leaderboard Query (Read-heavy)

```mermaid
sequenceDiagram
    autonumber
    participant C as Client
    participant GW as API Gateway
    participant User as User Service
    participant Cache as Redis

    C->>GW: GET /leaderboard/sucManh

    alt Cache hit
        GW->>Cache: GET leaderboard:sucManh:top10
        Cache-->>GW: cached list
    else Cache miss
        GW->>User: GetTop10BySucManh
        User->>User: SELECT FROM user_game_stats<br/>ORDER BY sucManh DESC LIMIT 10<br/>(dùng index trên sucManh)
        User-->>GW: UserListResponse
        GW->>Cache: SETEX leaderboard:sucManh:top10 60s
    end

    GW-->>C: 200 OK
```

**Index strategy:** Vì query có `ORDER BY sucManh DESC LIMIT 10`, B+Tree index trên `sucManh` cho phép DB chỉ cần đọc 10 leaf node cuối thay vì sort toàn bảng. Trade-off: write chậm hơn O(log n) nhưng read leaderboard nhanh hơn rất nhiều.

### 3.10. Editor Post + Comment Flow

```mermaid
sequenceDiagram
    autonumber
    participant E as Editor
    participant U as User
    participant GW as API Gateway
    participant Admin as Admin Service
    participant Social as Social Service
    participant Auth as Auth Service

    Note over E: Editor đăng bài

    E->>GW: POST /post/create {title, content}
    GW->>Auth: verify role=EDITOR
    GW->>Admin: CreatePost(CreatePostRequest)
    Admin->>Admin: INSERT posts<br/>(editor_realname duplicated từ JWT)
    Admin-->>GW: PostResponse
    GW-->>E: 201 Created

    Note over U: User xem bài và comment

    U->>GW: GET /posts
    GW->>Admin: GetAllPosts
    Admin-->>GW: list posts
    GW-->>U: 200 OK

    U->>GW: POST /comment {postId, content, parentId}
    GW->>Social: CreateComment
    Social->>Social: INSERT comments
    Social->>Auth: GetRealnameAvatar(userId)
    Auth-->>Social: realname, avatarUrl
    Social-->>GW: CommentNode
    GW-->>U: 201 Created

    Note over U: Build cây comment

    U->>GW: GET /post/{id}/comments
    GW->>Social: GetAllComment(postId, userId)
    Social->>Social: SELECT WHERE postId=?<br/>(load hết, build cây ở app layer)
    Social->>Social: build tree by parentId
    Social->>Auth: GetRealnameAvatar(batch userIds)
    Auth-->>Social: batch info
    Social-->>GW: tree of CommentNode
    GW-->>U: 200 OK
```

## 4. Service Breakdown

### 4.1. Auth Service (MySQL)

Quản lý xác thực, phân quyền, đăng ký/đăng nhập.

**Entities**: `AUTH`, `REGISTER_OUTBOX`, `AUTH_IDEMPOTENCY`

**Outgoing calls**: User Service, Pay Service

**Key RPCs**:
- `Register/Login/VerifyOTP/Refresh`: auth flow chuẩn
- `ChangePassword/ResetPassword/ChangeEmail`: user actions với idempotency
- `SystemChangePassword`: API system-level cho admin service trong saga BUY_ACCOUNT
- `GetRealnameAvatar(batch)`: cho social service load info nhiều user
- `ChangeAvatar`: update avatar, sau đó event sync về user service

### 4.2. User Service (MySQL)

Quản lý dữ liệu game của người chơi: stats, vị trí, vật phẩm web.

**Entities**: `USERS`, `USER_GAME_STATS`, `USERS_POSITION`, `USERS_WEB_ITEM`, `BUY_ITEM_OUTBOX`, `CREATE_PAY_OUTBOX`

**Outgoing calls**: Pay Service, Đệ Tử Service

**Key RPCs**:
- `Register`: tạo user record (gọi từ auth qua outbox)
- `GetProfile/SaveGame/SavePosition`: game state CRUD
- `GetTop10BySucManh/GetTop10ByVang`: leaderboard
- `AddItemWeb/UseItemWeb`: mua/dùng item từ web (trigger BUY_ITEM_OUTBOX)
- `UpdateBalance/UseVangNapTuWeb`: quản lý vàng/ngọc

### 4.3. Pay Service (MySQL)

**Entities**: `PAY`, `CASH_FLOW_MANAGEMENT`, `PAY_IDEMPOTENCY`

**Outgoing calls**: ❌ không gọi ai (leaf service)

**Key RPCs**:
- `CreatePay`: tạo ví khi register
- `UpdateMoney`: cộng/trừ tiền với idempotency key
- `CreatePayOrder`: tạo QR thanh toán
- `CreateFinanceRecord/GetFinanceSummary`: lịch sử dòng tiền

### 4.4. Item Service (MySQL)

**Entities**: `ITEMS`

**Outgoing calls**: ❌ không gọi ai (leaf service)

**Key RPCs**:
- `GetItemsByUser`: load inventory (critical path)
- `AddItem/AddMultipleItems`: thêm vào inventory
- `SwapItem`: chuyển item giữa 2 user
- `GetItemsByItemUuids`: batch lookup

### 4.5. Social Service (MySQL)

**Entities**: `CHAT`, `CHAT_GROUPS`, `CHAT_GROUP_MEMBERS`, `COMMENTS`, `COMMENT_LIKES`, `NOTIFICATION`, `SOCIAL_NETWORK`

**Outgoing calls**: Auth Service (lấy realname/avatar)

**Key RPCs**:
- Friend: `AddFriend/AcceptFriend/RejectFriend/Unfriend/BlockUser/CanChat`
- Chat: `SaveMessage/GetMessage`
- Group: `CreateGroup/AddUserToGroup/CheckGroupUser/GetAllGroup`
- Comment: `CreateComment/GetAllComment/UpdateComment/DeleteComment/LikeComment`
- Notification: `CreateNotification/GetNotificationByUser`

### 4.6. Admin Service (PostgreSQL)

**Entities**: `WITHDRAW_MONEY`, `POSTS`, `ACCOUNTS_SELL`, `OUTBOX_EVENTS`, `SAGA_STATE`

**Outgoing calls**: Auth Service, Pay Service

**Sub-services trong Admin:**
- **EditorService**: CRUD post (`CreatePost/GetAllPosts/UpdatePost/LockPost...`)
- **CashierService**: rút tiền (`CreateWithdrawRequest/ApproveWithdraw...`)
- **PartnerService**: mua bán account (`CreateAccountSell/BuyAccount/MarkAccountAsSold...`)

### 4.7. Đệ Tử Service (MySQL)

**Entities**: `DETU`

**Outgoing calls**: ❌ không gọi ai

**Key RPCs**: `CreateDeTu/SaveGameDeTu/GetDeTuByUserId`

### 4.8. Game Data Service (MySQL)

**Entities**: `MAP_BASE`, `NPC_BASE`, `ITEM_BASE`, `NPC_SPAWN`, `NPC_SHOP_ITEM`

**Outgoing calls**: ❌ không gọi ai

**Key RPCs**: CRUD cho map/npc/item base + shop config. Read-heavy, có thể cache aggressive.

### 4.9. Game Service NestJS (WebSocket)

Server WebSocket cho game client, handle business logic game.

**Outgoing calls**: User Service, Item Service (qua gRPC)

**Use cases**:
- `handleConnection`: gọi `User.GetProfile` lấy state, gọi `Item.GetItemsByUser` lấy inventory
- `handleSaveGame`: gọi `User.SaveGame`, `User.SavePosition`
- `handleBuyFromNPC`: gọi `Item.AddItem`, `User.UpdateBalance`

### 4.10. Game Service Go (Realtime 20Hz)

Server Go xử lý realtime movement, không cần gRPC client.

**Outgoing calls**: ❌ không gọi service khác

**Use cases**:
- Nhận input từ client (di chuyển, attack)
- Update state in-memory
- Broadcast state cho clients cùng map ở 20Hz

**Persist state**: client sẽ định kỳ gửi save về NestJS, không phải Go server tự save.

### 4.11. Queue Service

Service consumer xử lý job nền.

**Incoming**: trigger từ API Gateway, Auth Service và các service khác

**Outgoing calls**: Item Service

**Use cases**: xử lý batch job liên quan item (bulk add, cleanup expired items...)

### 4.12. Devops Service

**Trigger từ**: các service khác (CI webhooks, manual deploy)

**Outgoing calls**: ❌ không gọi service business, chỉ thực hiện deploy lên VPS

### 4.13. Logger Service (MongoDB)

Log tập trung từ tất cả service.

**Schema document**:

```
{
  _id: ObjectId,
  timestamp: Date,    // indexed
  status: String,     // INFO/WARN/ERROR/DEBUG
  service: String,    // tên service phát log
  message: String,
  metadata?: Object
}
```

Có TTL index để tự xóa log cũ (giữ ~30 ngày).

## 5. Data Flow Map

Diagram thể hiện luồng dữ liệu chính giữa các service theo nhóm chức năng:

```mermaid
flowchart LR
    subgraph Identity["Identity Domain"]
        Auth[Auth Service]
    end

    subgraph GameCore["Game Core Domain"]
        User[User Service]
        Detu[Đệ Tử Service]
        Item[Item Service]
        GameData[Game Data]
    end

    subgraph Money["Money Domain"]
        Pay[Pay Service]
    end

    subgraph Social["Social Domain"]
        SocialSvc[Social Service]
    end

    subgraph AdminBiz["Admin Domain"]
        Admin[Admin Service]
    end

    subgraph Realtime["Realtime Domain"]
        GameNest[Game NestJS]
        GameGo[Game Go]
    end

    %% Identity -> Game Core (register flow)
    Auth -.register saga.-> User
    User -.create wallet.-> Pay
    User --> Detu

    %% Admin business flows
    Admin -->|change pwd/email| Auth
    Admin -->|deduct/credit| Pay

    %% Social reads identity
    SocialSvc -->|get realname/avatar| Auth

    %% Game realtime reads game core
    GameNest -->|profile/save| User
    GameNest -->|inventory| Item

    %% Game core money
    User -.buy item saga.-> Pay

    classDef identity fill:#fee2e2,stroke:#dc2626
    classDef core fill:#dbeafe,stroke:#2563eb
    classDef money fill:#dcfce7,stroke:#16a34a
    classDef social fill:#fef3c7,stroke:#d97706
    classDef admin fill:#f3e8ff,stroke:#9333ea
    classDef realtime fill:#fce7f3,stroke:#be185d

    class Auth identity
    class User,Detu,Item,GameData core
    class Pay money
    class SocialSvc social
    class Admin admin
    class GameNest,GameGo realtime
```

**Quy ước**: nét liền là sync gRPC, nét đứt là async qua outbox/saga.

## 6. Distributed Transaction Patterns

### 6.1. Outbox Pattern

Dùng cho **at-least-once delivery** giữa services. Mỗi service có bảng outbox riêng:

| Service | Bảng outbox | Use case |
|---------|-------------|----------|
| Auth | `register_outbox` | Sau register, tạo user ở user-service |
| User | `create_pay_outbox` | Tạo wallet ở pay-service |
| User | `buy_item_outbox` | Trừ tiền sau khi tạo item |
| Admin | `outbox_events` | Saga BUY_ACCOUNT |

**Cơ chế:**
1. Insert outbox row trong **cùng transaction** với business write
2. Poller chạy nền, scan rows `PENDING` với `nextRetryAt <= NOW()`
3. Gọi target service, mark `DONE` nếu thành công, retry với backoff nếu fail

**Index quan trọng:** `(status, nextRetryAt)` cho poller query nhanh.

### 6.2. Saga Pattern (Orchestration)

Dùng cho **multi-step distributed transaction** có thể fail giữa chừng. Hiện tại chỉ admin service có saga thực sự (BUY_ACCOUNT) với compensation.

**Các thành phần:**
- `outbox_events`: queue các saga cần xử lý
- `saga_state`: track tiến độ từng saga
  - `phase`: FORWARD → COMPENSATING → DONE/FAILED
  - `completed_steps`: jsonb array các step đã chạy
  - `original_password/email`: state cần để rollback

**Quy tắc:**
- Mỗi step phải **idempotent** (gọi 2 lần kết quả như 1)
- Compensation chạy theo thứ tự **ngược** với forward
- Dùng `SystemChangePassword` (có idempotencyKey) thay vì `ChangePassword` thường

### 6.3. Idempotency Key

Tránh side-effect khi retry. Hiện có ở:
- `auth_idempotency_keys`: cho ChangePassword, ChangeEmail
- `pay_idempotency_keys`: cho UpdateMoney
- Inline trong outbox payload

**Cơ chế:** lần đầu thực hiện và lưu response, lần sau với cùng key trả response cũ luôn không thực hiện lại.

## 7. Index Strategy

Tổng hợp các index quan trọng và lý do:

| Service | Bảng | Index | Lý do |
|---------|------|-------|-------|
| Auth | `auth` | `username` (UK) | Login query |
| User | `user_game_stats` | `vang`, `sucManh` | Leaderboard `ORDER BY ... LIMIT N` |
| Item | `items` | `userId` | Load inventory khi vào game |
| Social | `chat` | `(roomId, createdAt)` | Chat history sort |
| Social | `social_network` | `(userId, status)`, `(friendId, status)` | Friend list filter pending |
| Social | `chat_group_members` | `(groupId, userId)` UK + `userId` riêng | Cover cả 2 chiều query |
| Admin | `outbox_events` | `(status, nextRetryAt)` | Outbox poller |
| Admin | `outbox_events` | `(status, updatedAt)` | Cleanup job |
| Admin | `accounts_sell` | `partner_id`, `buyer_id` | Filter theo người bán/mua |
| Pay | `cash_flow_management` | `userId` | Lịch sử user |

### Nguyên tắc đánh index

1. **Composite index theo thứ tự selectivity → ORDER BY**
   - VD: `(status, nextRetryAt)` đặt status trước vì filter equality, nextRetryAt sau vì range scan

2. **Status có selectivity thấp vẫn đáng index nếu popularity của value cần query thấp**
   - VD: outbox `status='PENDING'` chiếm < 1% sau thời gian chạy → vẫn lọc được phần lớn rows

3. **Unique index cover được leftmost prefix queries**
   - VD: `UK(groupId, userId)` cover query chỉ filter `groupId`

4. **InnoDB tự đánh index cho FK** → không cần `@Index()` thủ công cho cột relation

*Tài liệu này nên được update mỗi khi có thay đổi lớn về schema, service boundary, hoặc thêm use case mới.*