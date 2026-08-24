# Cross-instance Broadcast: Redis Adapter (NestJS) & Custom Bus (Go) & NATS Migration

> Tài liệu kỹ thuật về cách scale WebSocket lên multi-instance cho cả NestJS và Go service.
> Bao gồm: Redis Pub/Sub adapter cho NestJS, custom Bus tự build cho Go raw WebSocket, và migration path sang NATS để tối ưu latency.

## Mục lục

- [Bài toán đặt ra](#bài-toán-đặt-ra)
- [Giải pháp: Redis Pub/Sub Adapter](#giải-pháp-redis-pubsub-adapter)
- [Cơ chế Pub/Sub — luồng emit chi tiết](#cơ-chế-pubsub--luồng-emit-chi-tiết)
- [Tại sao cần 2 Redis client riêng biệt?](#tại-sao-cần-2-redis-client-riêng-biệt)
- [Setup theo thứ tự đúng](#setup-theo-thứ-tự-đúng)
- [Code đầy đủ NestJS](#code-đầy-đủ-nestjs)
- [Tại sao chọn Redis Pub/Sub, không phải cách khác?](#tại-sao-chọn-redis-pubsub-không-phải-cách-khác)
- [Tóm tắt NestJS](#tóm-tắt-nestjs)
- [Phần Go: Cross-instance Bus tự build](#phần-go-cross-instance-bus-tự-build)
- [Phần Go: Migrate sang NATS để tối ưu latency](#phần-go-migrate-sang-nats-để-tối-ưu-latency)
- [Sticky Session: Khi nào cần và config thế nào](#sticky-session-khi-nào-cần-và-config-thế-nào)
- [Polyglot Messaging: Khi 2 stack dùng broker khác nhau](#polyglot-messaging-khi-2-stack-dùng-broker-khác-nhau)
- [Production Checklist](#production-checklist)
- [Troubleshooting](#troubleshooting)
- [Glossary thuật ngữ](#glossary-thuật-ngữ)
- [Tóm tắt toàn bộ](#tóm-tắt-toàn-bộ)
- [Tham khảo thêm](#tham-khảo-thêm)

---

## Bài toán đặt ra

Socket.IO theo mặc định lưu trạng thái room và socket trong **bộ nhớ của từng process**. Khi ứng dụng chỉ có một instance thì không có vấn đề gì. Nhưng khi scale lên nhiều instance (nhiều process hoặc nhiều máy chủ):

```
Client A ──kết nối──▶ Instance 1  (biết về A)
Client B ──kết nối──▶ Instance 2  (biết về B)

Instance 2 gọi: io.to("room:chat").emit("message", data)
  → Instance 2 không biết A đang ở room:chat
  → Message bị mất với Client A
```

**Nguyên nhân cốt lõi**: Mỗi instance chỉ biết về các socket *đang kết nối trực tiếp với nó*. Không có cơ chế chia sẻ trạng thái giữa các instance.

Vấn đề này áp dụng cho **mọi** WebSocket framework — Socket.IO, raw WebSocket (Go gorilla), uWebSockets, ws.js. Không phải bug của riêng Socket.IO.

---

## Giải pháp: Redis Pub/Sub Adapter

Dùng Redis làm **message broker trung gian**: mọi lệnh `emit` đều được publish lên Redis channel, tất cả instance subscribe channel đó và tự quyết định client nào của mình cần nhận message.

```
Instance 1 ──PUBLISH──▶ Redis ──fan-out──▶ Instance 1 (subClient)
                                        └──▶ Instance 2 (subClient)
                                        └──▶ Instance 3 (subClient)
```

Mỗi instance sau khi nhận từ Redis sẽ kiểm tra local state để forward đến đúng client của nó.

---

## Cơ chế Pub/Sub — luồng emit chi tiết

Khi gọi `io.to("room:42").emit("message", data)`:

### Bước 1 — Serialize và publish

Redis adapter nhận lệnh emit, serialize payload cùng metadata (tên room, tên event, namespace).

```
pubClient.publish("socket.io#/#room:42#", serializedPayload)
```

### Bước 2 — Redis fan-out

Redis gửi message đến **tất cả** subscriber đang lắng nghe channel này — tức là tất cả instance của ứng dụng.

> Redis không giữ danh sách socket hay room. Đó là local state của mỗi instance. Redis chỉ là "loa phóng thanh" thông báo đồng thời cho tất cả instance.

### Bước 3 — Mỗi instance tự xử lý

Mỗi instance nhận message qua `subClient`, rồi thực hiện:

1. Deserialize payload
2. Lookup local state: "socket nào của tôi đang join `room:42`?"
3. Forward message đến đúng socket đó qua WebSocket connection thực sự

### Kết quả

```
Instance 2 emit "room:42"
  → pubClient.publish → Redis
  → Instance 1 subClient nhận → tìm socket trong room:42 → gửi cho Client A ✓
  → Instance 2 subClient nhận → tìm socket trong room:42 → gửi cho Client B ✓
  → Instance 3 subClient nhận → không có socket nào trong room:42 → bỏ qua
```

---

## Tại sao cần 2 Redis client riêng biệt?

```typescript
const pubClient = new Redis(process.env.REDIS_URL || '');
const subClient = pubClient.duplicate(); // KHÔNG dùng chung connection
```

Đây là **constraint của Redis protocol**, không phải design choice của Socket.IO.

Khi một Redis connection thực hiện lệnh `SUBSCRIBE`, connection đó bị **"khóa"** vào chế độ subscribe:

- Chỉ có thể nhận các lệnh: `SUBSCRIBE`, `UNSUBSCRIBE`, `PSUBSCRIBE`, `PUNSUBSCRIBE`, `PING`, `RESET`, `QUIT`
- **Không thể** chạy bất kỳ lệnh nào khác: `PUBLISH`, `SET`, `GET`, `DEL`...

Nếu dùng chung một connection cho cả publish và subscribe, lệnh `PUBLISH` sẽ trả về lỗi ngay sau khi connection đã subscribe.

`pubClient.duplicate()` tạo một connection **mới hoàn toàn** với cùng cấu hình (host, port, password, db) — không chia sẻ connection socket với `pubClient`.

> **Lưu ý**: Constraint này áp dụng cho mọi Redis client (ioredis, node-redis, go-redis, redis-py, ...). NATS không có ràng buộc tương tự — 1 connection xử lý được cả pub và sub.

---

## Setup theo thứ tự đúng

### Cách cũ — dùng `afterInit()` (LỖI)

```typescript
// ❌ SAI — afterInit() chạy quá sớm
@WebSocketGateway()
export class AppGateway implements AfterInit {
  @WebSocketServer() server: Server;

  afterInit() {
    this.server.adapter(...); // BOOM — this.server vẫn là undefined tại đây
  }
}
```

Thứ tự thực thi:

```
1. app.listen(3000)
2. NestJS tạo Socket.IO server
3. NestJS gọi afterInit()
       └─ this.server.adapter(...)  ← BOOM, this.server vẫn là undefined
4. NestJS mới gán @WebSocketServer() vào this.server  ← quá muộn
```

`afterInit()` được gọi ngay sau khi Gateway được khởi tạo, nhưng **trước khi** NestJS gán server instance vào `@WebSocketServer()`. Tại thời điểm đó `this.server` là `undefined`.

### Cách mới — override `createIOServer()` (ĐÚNG)

```typescript
// ✅ ĐÚNG — gắn adapter ngay lúc server được tạo
export class RedisIoAdapter extends IoAdapter {
  createIOServer(port: number, options?: ServerOptions): any {
    const server = super.createIOServer(port, options);
    server.adapter(this.adapterConstructor); // adapterConstructor đã có giá trị
    return server;
  }
}
```

Thứ tự thực thi:

```
1. redisIoAdapter.connectToRedis()
       └─ adapterConstructor = createAdapter(pub, sub)  ← có giá trị
2. app.useWebSocketAdapter(redisIoAdapter)
       └─ NestJS biết "dùng class này để tạo server"
3. app.listen(3000)
       └─ NestJS gọi createIOServer()
             └─ super.createIOServer()   ← tạo Socket.IO server bình thường
             └─ server.adapter(...)      ← gắn Redis vào, adapterConstructor đã có
             └─ return server
4. NestJS gán server vào @WebSocketServer()  ← đúng thứ tự, không lỗi
```

`createIOServer()` là hook mà NestJS gọi để tạo server. Override hook này là điểm **duy nhất** có thể gắn adapter *trước khi server được trả về* cho bất kỳ ai. Đến lúc này `adapterConstructor` chắc chắn đã có giá trị vì `connectToRedis()` đã được await xong từ trước.

---

## Code đầy đủ NestJS

### `redis-io.adapter.ts`

```typescript
import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';

export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor: ReturnType<typeof createAdapter>;

  /**
   * Khởi tạo kết nối Redis.
   * Tách riêng thành async method vì kết nối Redis là I/O operation — không thể await trong constructor.
   * main.ts gọi và await trước khi tiếp tục.
   */
  async connectToRedis(): Promise<void> {
    const pubClient = new Redis(process.env.REDIS_URL || '');
    const subClient = pubClient.duplicate(); // connection riêng, cùng config
    this.adapterConstructor = createAdapter(pubClient, subClient);
    // adapterConstructor là factory function, chưa gắn vào server nào
  }

  /**
   * Override điểm then chốt: NestJS gọi method này khi tạo Socket.IO server.
   * Gắn adapter ngay tại đây — trước khi server được trả về cho bất kỳ ai.
   * Tại thời điểm này adapterConstructor đã có giá trị (connectToRedis đã chạy xong).
   */
  createIOServer(port: number, options?: ServerOptions): any {
    const server = super.createIOServer(port, options);
    server.adapter(this.adapterConstructor);
    return server;
  }
}
```

### `main.ts`

```typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { RedisIoAdapter } from './redis-io.adapter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const redisIoAdapter = new RedisIoAdapter(app);

  // Thứ tự 3 dòng này bắt buộc, không thể đảo ngược:
  await redisIoAdapter.connectToRedis();     // (1) build adapterConstructor
  app.useWebSocketAdapter(redisIoAdapter);   // (2) đăng ký với NestJS
  await app.listen(3000);                    // (3) trigger createIOServer()
}

bootstrap();
```

### Cài đặt dependencies

```bash
npm install @socket.io/redis-adapter ioredis
```

---

## Tại sao chọn Redis Pub/Sub, không phải cách khác?

### So sánh các giải pháp

| Giải pháp | Ưu điểm | Nhược điểm |
|---|---|---|
| **Redis Adapter** | Infrastructure sẵn có, official package, đơn giản | Fire-and-forget, không đảm bảo delivery |
| **Sticky Session** | Không cần thêm gì | Phụ thuộc load balancer, không scale tốt, single point of failure |
| **Kafka / RabbitMQ** | Guaranteed delivery, persistence | Phức tạp hơn, thêm hệ thống mới chỉ để sync socket events |
| **Redis Streams** | Guaranteed delivery, có persistence | Phức tạp hơn Redis pub/sub |

### Lý do chọn Redis Pub/Sub

**Stateless instances** — Mỗi instance hoàn toàn độc lập. Client có thể kết nối vào bất kỳ instance nào, không cần sticky session hay load balancer phức tạp.

**Tận dụng infrastructure sẵn có** — Redis hầu như đã được dùng cho cache, session, rate limiting. Không cần thêm message broker mới (Kafka, RabbitMQ) chỉ để sync socket events.

**Official package** — `@socket.io/redis-adapter` là package chính thức của Socket.IO team, xử lý đầy đủ edge cases: room management, namespace isolation, volatile emits, acknowledgements xuyên instance.

**Đơn giản** — Chỉ cần thêm ~20 dòng code, không thay đổi logic business.

### Hạn chế cần biết

Redis pub/sub là **fire-and-forget** — không đảm bảo delivery nếu instance bị down đúng lúc nhận message. Nếu cần guaranteed delivery, hãy xem xét Redis Streams hoặc message queue thực sự (RabbitMQ, Kafka).

---

## Tóm tắt NestJS

| Khái niệm | Giải thích |
|---|---|
| `pubClient` | Gửi message qua lệnh `PUBLISH` |
| `subClient` | Nhận message qua lệnh `SUBSCRIBE` — phải là connection riêng do Redis protocol constraint |
| `createIOServer()` | Hook override để gắn adapter ngay khi server được tạo |
| `connectToRedis()` | Async init riêng — phải được `await` trước `app.listen()` |
| Redis role | Message bus thuần túy — không giữ danh sách socket hay room |
| Local state | Mỗi instance tự quản lý socket/room của mình, Redis chỉ broadcast thông báo |

---

## Phần Go: Cross-instance Bus tự build

### Bài toán tương tự, không có thư viện đóng gói sẵn

Bên Go service xử lý hot path realtime (sync 20-60Hz) không dùng Socket.IO mà dùng raw WebSocket (`gorilla/websocket`). Vì vậy không có package tương đương `@socket.io/redis-adapter` để cài và dùng. Phải **tự build cross-instance bus**.

Mô hình giống y hệt NestJS adapter:

- 2 Redis client (pub + sub)
- Echo prevention bằng node ID
- Local fan-out trước, publish cross-instance sau

Khác biệt chính: **dùng binary encoding thay vì MessagePack/JSON** vì:

- Hot path 20-60Hz × 1000+ user → 60.000+ message/giây, mỗi byte tiết kiệm đều có giá trị
- Game packet vốn đã là binary (struct serialize qua custom protocol), không có lý do convert sang text rồi convert lại
- Decode binary thuần túy nhanh hơn JSON parse 5-10x

### Kiến trúc tổng thể

```
┌─────────────────────────────────────┐
│  handler.go (xử lý packet client)   │
│         ↓ gọi hub.BroadcastToMap    │
├─────────────────────────────────────┤
│  hub.go (quản lý conn local)        │
│         ↓ gọi bus.PublishBroadcast  │
├─────────────────────────────────────┤
│  bus.go ← layer cross-instance      │
│         ↓ pub.Publish               │
├─────────────────────────────────────┤
│  Redis Pub/Sub (broker)             │
└─────────────────────────────────────┘
```

`bus.go` là layer trừu tượng giữa Hub và Redis. Hub không biết Redis tồn tại — chỉ biết "tôi có 1 cái Bus, gọi `PublishBroadcast()` là xong". Mai mốt đổi NATS, chỉ viết lại `bus.go`, Hub không cần sửa.

Đây là pattern **Adapter** (hay Hexagonal Architecture / Port and Adapter): tách biệt business logic khỏi infrastructure để dễ swap implementation.

### Binary payload format

Mỗi message gửi qua Redis có cấu trúc:

```
[16 byte nodeID UUID][1 byte msgType][...body riêng theo loại message]
└──── header chung ─────────────────┘ └──── body ─────────────────────┘
```

**Header chung 17 byte:**

- `nodeID` (16 byte): UUID raw bytes của instance gửi, dùng để skip echo
- `msgType` (1 byte): loại message — broadcast, send-to-user, kick

**Body theo từng loại:**

```
Broadcast:    [4 byte excludeUserID int32][2 byte mapIDLen][mapID][...packet game]
SendToUser:   [4 byte userID][...packet]
KickUser:     [4 byte userID]
```

Tất cả số nhiều byte dùng **big-endian** (network byte order, convention chuẩn cho protocol).

### So sánh size payload: Binary vs JSON

Một broadcast message điển hình:

| Format | Kích thước | Decode time |
|---|---|---|
| **Binary** | 17 + 6 + 5 + 80 = 108 bytes | ~200ns |
| **JSON** | `{"nodeID":"...","msgType":1,"excludeUserID":42,"mapID":"MAP:1","data":"<base64>"}` ≈ 250 bytes | ~2-5µs |

Ở 60.000 message/giây: binary tiết kiệm **8.5 MB/giây bandwidth Redis** và **giảm 90% CPU decode**.

### Compile-time interface check

Go không có keyword `implements` như TypeScript/Java. Để force compiler verify Hub thật sự implement đầy đủ BusHandler interface, dùng idiom:

```go
var _ BusHandler = (*Hub)(nil)
```

Đọc thành lời: "Compiler ơi, hãy verify rằng `*Hub` có thể gán được cho `BusHandler`. Nếu thiếu method nào → compile error tại đây, không phải đợi runtime."

Pattern này là idiom tiêu chuẩn trong Go production code (stdlib, gRPC, k8s đều dùng).

### Channel namespacing

Subscribe 3 channel với prefix chung để dễ debug bằng `redis-cli PSUBSCRIBE gamebus:*`:

```
gamebus:broadcast  — broadcast tới room
gamebus:send       — gửi tới 1 user cụ thể
gamebus:kick       — kick user (cross-instance)
```

Vì sao 1 channel chung cho mỗi loại thay vì 1 channel/map (`gamebus:broadcast:map:1`, `gamebus:broadcast:map:2`, ...)?

- **Đơn giản**: không cần dynamic SUBSCRIBE/UNSUBSCRIBE khi user đổi map
- **Đủ tốt cho < 50 instance**: filter ở instance side rẻ hơn nhiều so với network round-trip subscribe
- Khi scale lớn hơn → shard theo `mapID hash` mới đáng

### Code đầy đủ — `internal/ws/bus.go`

```go
package ws

import (
	"context"
	"encoding/binary"
	"errors"
	"fmt"
	"log/slog"
	"sync"

	redisclient "github.com/DANG-PH/game-service-go/internal/infra/redis"
	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
)

// BusHandler là interface mà Bus gọi vào khi nhận message từ instance khác.
// Hub implement interface này.
//
// Tại sao interface thay vì 3 callback function rời?
// - Gom nhóm contract liên quan vào 1 chỗ — caller chỉ cần thấy "implement BusHandler"
//   là biết phải có 3 method gì
// - Compile-time check qua var _ BusHandler = (*Hub)(nil) — sai signature là báo lỗi ngay
// - Mock cho test gọn hơn: 1 struct implement 3 method vs gán 3 lambda rời
type BusHandler interface {
	OnBroadcast(mapID string, data []byte, excludeUserID int32)
	OnSendToUser(userID int32, data []byte)
	OnKickUser(userID int32)
}

type Bus struct {
	log    *slog.Logger
	nodeID string

	pub *redis.Client
	sub *redis.Client

	// handler được gọi khi nhận message từ instance khác.
	// Set sau NewBus() qua SetHandler — vì Hub cần reference Bus để publish,
	// và Bus cần reference Hub để dispatch → tránh circular bằng pattern 2 phase.
	handler BusHandler

	cancel context.CancelFunc
	wg     sync.WaitGroup
}

const (
	chanBroadcast  = "gamebus:broadcast"
	chanSendToUser = "gamebus:send"
	chanKickUser   = "gamebus:kick"
)

const (
	msgTypeBroadcast byte = 1
	msgTypeSend      byte = 2
	msgTypeKick      byte = 3
)

func NewBus(redisURL string, log *slog.Logger) (*Bus, error) {
	pub, err := redisclient.New(redisURL)
	if err != nil {
		return nil, fmt.Errorf("create pub client: %w", err)
	}
	sub, err := redisclient.New(redisURL)
	if err != nil {
		pub.Close()
		return nil, fmt.Errorf("create sub client: %w", err)
	}
	return &Bus{
		log:    log,
		nodeID: uuid.NewString(),
		pub:    pub,
		sub:    sub,
	}, nil
}

func (b *Bus) SetHandler(h BusHandler) { b.handler = h }

func (b *Bus) Start(ctx context.Context) error {
	if b.handler == nil {
		return errors.New("handler not set, call SetHandler first")
	}

	subCtx, cancel := context.WithCancel(ctx)
	b.cancel = cancel

	pubsub := b.sub.Subscribe(subCtx, chanBroadcast, chanSendToUser, chanKickUser)
	if _, err := pubsub.Receive(subCtx); err != nil {
		pubsub.Close()
		return fmt.Errorf("redis subscribe: %w", err)
	}

	b.wg.Add(1)
	go func() {
		defer b.wg.Done()
		defer pubsub.Close()
		ch := pubsub.Channel()
		for {
			select {
			case <-subCtx.Done():
				return
			case msg, ok := <-ch:
				if !ok {
					return
				}
				b.dispatch([]byte(msg.Payload))
			}
		}
	}()
	return nil
}

func (b *Bus) Stop() {
	if b.cancel != nil {
		b.cancel()
	}
	b.wg.Wait()
	b.pub.Close()
	b.sub.Close()
}

// dispatch parse payload, skip nếu origin chính mình, gọi handler.
func (b *Bus) dispatch(payload []byte) {
	if len(payload) < 17 {
		return
	}
	originNode := string(payload[:16])
	if originNode == b.nodeIDBytes() {
		return // echo từ chính mình → skip
	}
	msgType := payload[16]
	body := payload[17:]

	switch msgType {
	case msgTypeBroadcast:
		mapID, data, excludeUserID, err := decodeBroadcast(body)
		if err != nil {
			return
		}
		b.handler.OnBroadcast(mapID, data, excludeUserID)
	case msgTypeSend:
		userID, data, err := decodeSendToUser(body)
		if err != nil {
			return
		}
		b.handler.OnSendToUser(userID, data)
	case msgTypeKick:
		userID, err := decodeKick(body)
		if err != nil {
			return
		}
		b.handler.OnKickUser(userID)
	}
}

func (b *Bus) nodeIDBytes() string {
	id, _ := uuid.Parse(b.nodeID)
	return string(id[:])
}

func (b *Bus) PublishBroadcast(ctx context.Context, mapID string, data []byte, excludeUserID int32) error {
	body := encodeBroadcast(mapID, data, excludeUserID)
	return b.publish(ctx, chanBroadcast, msgTypeBroadcast, body)
}

func (b *Bus) PublishSendToUser(ctx context.Context, userID int32, data []byte) error {
	return b.publish(ctx, chanSendToUser, msgTypeSend, encodeSendToUser(userID, data))
}

func (b *Bus) PublishKickUser(ctx context.Context, userID int32) error {
	return b.publish(ctx, chanKickUser, msgTypeKick, encodeKick(userID))
}

func (b *Bus) publish(ctx context.Context, channel string, msgType byte, body []byte) error {
	payload := make([]byte, 0, 17+len(body))
	payload = append(payload, []byte(b.nodeIDBytes())...)
	payload = append(payload, msgType)
	payload = append(payload, body...)
	return b.pub.Publish(ctx, channel, payload).Err()
}

// === Binary encode/decode ===

func encodeBroadcast(mapID string, data []byte, excludeUserID int32) []byte {
	mapBytes := []byte(mapID)
	buf := make([]byte, 4+2+len(mapBytes)+len(data))
	binary.BigEndian.PutUint32(buf[0:4], uint32(excludeUserID))
	binary.BigEndian.PutUint16(buf[4:6], uint16(len(mapBytes)))
	copy(buf[6:6+len(mapBytes)], mapBytes)
	copy(buf[6+len(mapBytes):], data)
	return buf
}

func decodeBroadcast(body []byte) (mapID string, data []byte, excludeUserID int32, err error) {
	if len(body) < 6 {
		return "", nil, 0, errors.New("broadcast body too short")
	}
	excludeUserID = int32(binary.BigEndian.Uint32(body[0:4]))
	mapLen := binary.BigEndian.Uint16(body[4:6])
	if len(body) < int(6+mapLen) {
		return "", nil, 0, errors.New("broadcast body truncated")
	}
	mapID = string(body[6 : 6+mapLen])
	data = body[6+mapLen:]
	return
}

func encodeSendToUser(userID int32, data []byte) []byte {
	buf := make([]byte, 4+len(data))
	binary.BigEndian.PutUint32(buf[0:4], uint32(userID))
	copy(buf[4:], data)
	return buf
}

func decodeSendToUser(body []byte) (userID int32, data []byte, err error) {
	if len(body) < 4 {
		return 0, nil, errors.New("send body too short")
	}
	userID = int32(binary.BigEndian.Uint32(body[0:4]))
	data = body[4:]
	return
}

func encodeKick(userID int32) []byte {
	buf := make([]byte, 4)
	binary.BigEndian.PutUint32(buf[0:4], uint32(userID))
	return buf
}

func decodeKick(body []byte) (int32, error) {
	if len(body) < 4 {
		return 0, errors.New("kick body too short")
	}
	return int32(binary.BigEndian.Uint32(body[0:4])), nil
}
```

### Hub implement BusHandler — `internal/ws/hub.go`

```go
package ws

import (
	"context"
	"log/slog"
	"sync"
	"time"
)

type Hub struct {
	log *slog.Logger
	bus *Bus // nil = single-instance mode (test)

	mu          sync.RWMutex
	connsByUser map[int32]*Conn
	roomsByMap  map[string]map[*Conn]struct{}
}

// Compile-time check Hub thỏa BusHandler interface.
var _ BusHandler = (*Hub)(nil)

func NewHub(log *slog.Logger, bus *Bus) *Hub {
	h := &Hub{
		log:         log,
		bus:         bus,
		connsByUser: make(map[int32]*Conn),
		roomsByMap:  make(map[string]map[*Conn]struct{}),
	}
	if bus != nil {
		bus.SetHandler(h) // self-register
	}
	return h
}

// === BusHandler implementation ===
// Bus gọi 3 method này khi nhận message từ instance khác.

func (h *Hub) OnBroadcast(mapID string, data []byte, excludeUserID int32) {
	h.mu.RLock()
	room, ok := h.roomsByMap[mapID]
	if !ok {
		h.mu.RUnlock()
		return
	}
	conns := make([]*Conn, 0, len(room))
	for c := range room {
		if c.userID != excludeUserID {
			conns = append(conns, c)
		}
	}
	h.mu.RUnlock()
	for _, c := range conns {
		c.Send(data)
	}
}

func (h *Hub) OnSendToUser(userID int32, data []byte) {
	h.mu.RLock()
	c, ok := h.connsByUser[userID]
	h.mu.RUnlock()
	if ok {
		c.Send(data)
	}
}

func (h *Hub) OnKickUser(userID int32) {
	h.mu.Lock()
	c, ok := h.connsByUser[userID]
	if ok {
		delete(h.connsByUser, userID)
		h.removeFromRoomLocked(c)
	}
	h.mu.Unlock()
	if ok {
		c.Close()
	}
}

// === Public API — call site không thay đổi ===

func (h *Hub) BroadcastToMap(mapID string, data []byte, excludeConn *Conn) {
	var excludeUserID int32
	if excludeConn != nil {
		excludeUserID = excludeConn.userID
	}
	// 1. Broadcast local trước (latency thấp nhất)
	h.OnBroadcast(mapID, data, excludeUserID)
	// 2. Fan-out cross-instance qua Bus
	if h.bus != nil {
		go func() {
			ctx, cancel := context.WithTimeout(context.Background(), 1*time.Second)
			defer cancel()
			h.bus.PublishBroadcast(ctx, mapID, data, excludeUserID)
		}()
	}
}

// SendToUser, KickUser, register, unregister, MoveToRoom, Stats... — xem source đầy đủ
```

### Wire vào `internal/app/app.go`

```go
func New(cfg *config.Config, log *slog.Logger) (*App, error) {
	// Redis client cho business logic (player state, session)
	rdb, err := redisclient.New(cfg.RedisURL)
	if err != nil {
		return nil, fmt.Errorf("init redis: %w", err)
	}

	// Bus cross-instance — tự tạo 2 Redis connection riêng (pub + sub)
	bus, err := ws.NewBus(cfg.RedisURL, log)
	if err != nil {
		return nil, fmt.Errorf("init bus: %w", err)
	}

	hub := ws.NewHub(log, bus) // hub.SetHandler(hub) chạy bên trong NewHub

	// ... wire các component khác (auth, playerService, handler, wsServer)

	return &App{cfg: cfg, log: log, server: server, bus: bus}, nil
}

func (a *App) Run() error {
	// Bus phải start TRƯỚC khi accept WebSocket connection,
	// nếu không broadcast từ instance khác bị miss.
	if err := a.bus.Start(context.Background()); err != nil {
		return fmt.Errorf("start bus: %w", err)
	}
	return a.server.ListenAndServe()
}

func (a *App) Shutdown(ctx context.Context) error {
	// Thứ tự: HTTP shutdown trước → bus stop sau.
	// Đảo ngược: conn còn lại publish sẽ fail → log noise.
	a.server.Shutdown(ctx)
	a.bus.Stop()
	return nil
}
```

### Cài đặt dependencies

```bash
go get github.com/redis/go-redis/v9
go get github.com/google/uuid
```

### So sánh Go Bus vs NestJS Redis Adapter

| Aspect | NestJS Redis Adapter | Go Bus |
|---|---|---|
| **Connection** | 2 client (pub + sub via duplicate) | 2 client riêng |
| **Subscribe** | Tự động qua `createAdapter()` | Manual `Subscribe()` + loop channel |
| **Publish** | `io.to(room).emit()` | `bus.PublishBroadcast()` |
| **Encoding** | MessagePack + uid | Binary length-prefix + nodeID |
| **Echo prevention** | server uid của socket.io | nodeID UUID raw |
| **Code lines** | ~20 dòng (config) | ~250 dòng (tự build full) |
| **Vì sao tự build** | Có sẵn package official | Raw WebSocket không có adapter ecosystem |

**Mô hình giống 100%.** Khác duy nhất là NestJS có thư viện đóng gói sẵn, Go thì viết tay.

---

## Phần Go: Migrate sang NATS để tối ưu latency

### Khi nào nên migrate

Redis Pub/Sub đủ tốt cho hầu hết game online. Chỉ cân nhắc đổi NATS khi gặp **một** trong các trigger:

1. **Redis Pub/Sub p99 latency > 20ms thường xuyên** trong production load thực
2. **Hơn 30-50 instance** Go — Redis fan-out tới N subscriber thành bottleneck network
3. **Goroutine count tăng tuyến tính** theo thời gian — pattern fire-and-forget với Redis publish chậm gây pile-up

Trong scope của project này, NATS được chọn vì hot path 20-60Hz × 1000+ user mong muốn latency p99 < 5ms cho cross-instance broadcast.

### Tại sao NATS nhanh hơn Redis Pub/Sub

| Đặc điểm | Redis Pub/Sub | NATS |
|---|---|---|
| **Protocol** | RESP (text-based) | Native binary, gọn |
| **Publish** | Round-trip RTT đồng bộ (~1ms LAN) | Local buffer + async flush (~µs) |
| **Connection** | 2 client riêng (pub + sub) | 1 client cho cả 2 |
| **Reconnect** | Phải config cẩn thận | Built-in, 1 dòng config |
| **Fan-out throughput** | ~100k msg/s | ~1M msg/s |
| **Latency p50 LAN** | 0.5-2ms | 0.2-1ms |
| **Latency p99 LAN** | 5-10ms | 2-5ms |

NATS publish **không round-trip** — chỉ ghi vào local buffer, background goroutine flush sang server. Hệ quả: bỏ luôn pattern goroutine fire-and-forget vì publish chỉ tốn ~microsecond.

### Tại sao chỉ migrate phần Go, không migrate NestJS

Setup polyglot messaging trong project:

```
Client Go (game realtime)
    ↓ WebSocket
Go Instance A ←─── NATS ───→ Go Instance B
    ↓ HSET state                  ↓ HSET state
    └──────→ Redis ←──────────────┘
                ↑
                │ HGETALL (đọc state)
                │
            NestJS Instance 1 ←─── Redis Pub/Sub ───→ NestJS Instance 2
                ↓                                          ↓
            Client NestJS                               Client NestJS
```

**Hai mạng broadcast hoàn toàn tách biệt:**

- Go ↔ Go: NATS (hot path, low latency critical)
- NestJS ↔ NestJS: Redis Pub/Sub (giữ nguyên, business logic latency tolerant)
- Redis: state store cho NestJS đọc, **không** phải message bus giữa Go và NestJS

NestJS giữ Redis adapter vì:

- Đã invest vào `@socket.io/redis-adapter` rồi, không có lý do đổi
- Business event (chat, shop, friend) latency tolerant, 1-2ms không đáng lo
- Không có `@socket.io/nats-adapter` chính thức cho Socket.IO

Điều kiện để polyglot setup hoạt động: **không có event nào cần đi từ Go sang NestJS hoặc ngược lại qua broadcast**. Trong project này control plane đi qua REST API (NestJS gọi API Go khi cần kick user), state share qua Redis HSET — không cần broadcast cross-stack.

### Kiến trúc giữ nguyên — chỉ thay implementation Bus

Ưu điểm của thiết kế Adapter pattern: chỉ cần viết lại `bus.go`, **không đụng** Hub, Handler, hay bất kỳ file nào khác.

```
┌─────────────────────────────────────┐
│  hub.go — KHÔNG ĐỔI                 │
│         ↓ gọi bus.PublishBroadcast  │
├─────────────────────────────────────┤
│  bus.go — VIẾT LẠI                  │
│         ↓ nc.Publish                │
├─────────────────────────────────────┤
│  NATS Server                        │
└─────────────────────────────────────┘
```

`BusHandler` interface giữ nguyên. `PublishBroadcast/PublishSendToUser/PublishKickUser` giữ nguyên signature. Encode/decode binary giữ nguyên. Chỉ thay phần Redis Pub/Sub bằng NATS subscribe/publish.

### Code đầy đủ — `internal/ws/bus.go` (NATS version)

```go
package ws

import (
	"context"
	"encoding/binary"
	"errors"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/nats-io/nats.go"
)

// BusHandler interface giữ NGUYÊN — Hub không cần biết đổi broker.
type BusHandler interface {
	OnBroadcast(mapID string, data []byte, excludeUserID int32)
	OnSendToUser(userID int32, data []byte)
	OnKickUser(userID int32)
}

type Bus struct {
	log    *slog.Logger
	nodeID string

	nc   *nats.Conn // NATS chỉ cần 1 connection, không cần pub/sub riêng
	subs []*nats.Subscription

	handler BusHandler

	mu      sync.Mutex
	started bool
}

const (
	subjBroadcast  = "gamebus.broadcast"
	subjSendToUser = "gamebus.send"
	subjKickUser   = "gamebus.kick"
)

const (
	msgTypeBroadcast byte = 1
	msgTypeSend      byte = 2
	msgTypeKick      byte = 3
)

func NewBus(natsURL string, log *slog.Logger) (*Bus, error) {
	// NATS client tự handle reconnect — không cần config phức tạp như go-redis
	nc, err := nats.Connect(natsURL,
		nats.ReconnectWait(2*time.Second),
		nats.MaxReconnects(-1), // reconnect vô hạn
		nats.DisconnectErrHandler(func(_ *nats.Conn, err error) {
			log.Warn("nats disconnected", "err", err)
		}),
		nats.ReconnectHandler(func(c *nats.Conn) {
			log.Info("nats reconnected", "url", c.ConnectedUrl())
		}),
	)
	if err != nil {
		return nil, fmt.Errorf("nats connect: %w", err)
	}
	return &Bus{
		log:    log,
		nodeID: uuid.NewString(),
		nc:     nc,
	}, nil
}

func (b *Bus) SetHandler(h BusHandler) { b.handler = h }

func (b *Bus) Start(ctx context.Context) error {
	b.mu.Lock()
	defer b.mu.Unlock()
	if b.started {
		return errors.New("bus already started")
	}
	if b.handler == nil {
		return errors.New("handler not set")
	}

	// Subscribe — NATS gọi callback trong goroutine riêng, không cần loop như Redis
	subs := make([]*nats.Subscription, 0, 3)
	for _, subj := range []string{subjBroadcast, subjSendToUser, subjKickUser} {
		sub, err := b.nc.Subscribe(subj, func(m *nats.Msg) {
			b.dispatch(m.Data)
		})
		if err != nil {
			for _, s := range subs {
				s.Unsubscribe()
			}
			return fmt.Errorf("subscribe %s: %w", subj, err)
		}
		subs = append(subs, sub)
	}
	b.subs = subs
	b.started = true
	b.log.Info("nats bus started", "nodeID", b.nodeID)
	return nil
}

func (b *Bus) Stop() {
	b.mu.Lock()
	defer b.mu.Unlock()
	for _, s := range b.subs {
		s.Unsubscribe()
	}
	b.nc.Drain() // graceful: đợi pending message xử lý xong rồi close
}

// dispatch — logic giống y hệt Redis version, payload format không đổi.
func (b *Bus) dispatch(payload []byte) {
	if len(payload) < 17 {
		return
	}
	originNode := string(payload[:16])
	if originNode == b.nodeIDBytes() {
		return
	}
	msgType := payload[16]
	body := payload[17:]

	switch msgType {
	case msgTypeBroadcast:
		mapID, data, excludeUserID, err := decodeBroadcast(body)
		if err != nil {
			return
		}
		b.handler.OnBroadcast(mapID, data, excludeUserID)
	case msgTypeSend:
		userID, data, err := decodeSendToUser(body)
		if err != nil {
			return
		}
		b.handler.OnSendToUser(userID, data)
	case msgTypeKick:
		userID, err := decodeKick(body)
		if err != nil {
			return
		}
		b.handler.OnKickUser(userID)
	}
}

func (b *Bus) nodeIDBytes() string {
	id, _ := uuid.Parse(b.nodeID)
	return string(id[:])
}

// PUBLISH METHODS — giữ signature có context để Hub không phải đổi gì,
// nhưng NATS publish thực chất không dùng context (non-blocking)

func (b *Bus) PublishBroadcast(ctx context.Context, mapID string, data []byte, excludeUserID int32) error {
	body := encodeBroadcast(mapID, data, excludeUserID)
	return b.publish(subjBroadcast, msgTypeBroadcast, body)
}

func (b *Bus) PublishSendToUser(ctx context.Context, userID int32, data []byte) error {
	return b.publish(subjSendToUser, msgTypeSend, encodeSendToUser(userID, data))
}

func (b *Bus) PublishKickUser(ctx context.Context, userID int32) error {
	return b.publish(subjKickUser, msgTypeKick, encodeKick(userID))
}

func (b *Bus) publish(subject string, msgType byte, body []byte) error {
	payload := make([]byte, 0, 17+len(body))
	payload = append(payload, []byte(b.nodeIDBytes())...)
	payload = append(payload, msgType)
	payload = append(payload, body...)
	return b.nc.Publish(subject, payload)
}

// Encode/decode functions — copy nguyên xi từ Redis version, không đổi byte nào.
// (encodeBroadcast, decodeBroadcast, encodeSendToUser, decodeSendToUser, encodeKick, decodeKick)
```

### Update `app.go` — thay URL config

```go
// Trước (Redis):
bus, err := ws.NewBus(cfg.RedisURL, log)

// Sau (NATS):
bus, err := ws.NewBus(cfg.NATSURL, log) // ví dụ: "nats://localhost:4222"
```

### Optional: bỏ goroutine fire-and-forget trong Hub

NATS publish ~microsecond → không cần wrap trong goroutine nữa:

```go
// Trước (Redis):
if h.bus != nil {
    go func() {
        ctx, cancel := context.WithTimeout(context.Background(), 1*time.Second)
        defer cancel()
        h.bus.PublishBroadcast(ctx, mapID, data, excludeUserID)
    }()
}

// Sau (NATS) — bỏ goroutine vì publish không block:
if h.bus != nil {
    h.bus.PublishBroadcast(context.Background(), mapID, data, excludeUserID)
}
```

Lợi ích: bỏ vấn đề goroutine pile-up ở scale cao.

### Cài đặt dependencies

```bash
go get github.com/nats-io/nats.go
```

### Deploy NATS server

```bash
# Docker, đơn giản nhất:
docker run -d --name nats -p 4222:4222 nats:latest

# Kubernetes:
helm repo add nats https://nats-io.github.io/k8s/helm/charts/
helm install nats nats/nats
```

NATS rất nhẹ — ~10MB RAM, không cần persistent storage cho mode Pub/Sub thuần.

### Effort migration thực tế

| Task | Time |
|---|---|
| Viết `bus.go` NATS version | 1-2 giờ |
| Update `app.go` (chỉ thay URL config) | 5 phút |
| Test multi-instance | 30 phút |
| Load test compare latency | 1-2 giờ |
| Deploy NATS server | 1-2 giờ (Docker), half-day (k8s production) |
| **Tổng code Go** | **0.5-1 ngày** |

Hub, Handler, Service, Conn — **không** cần đụng vào.

---

## Sticky Session: Khi nào cần và config thế nào

Cross-instance broadcast giải quyết vấn đề scale, nhưng **không** thay thế hoàn toàn được sticky session. Hai cái phục vụ mục đích khác nhau.

### Khi nào CẦN sticky session

**User reconnect nhanh giữa 2 instance:**

```
1. User mất WiFi 1s → conn ở Instance A drop
2. WiFi back → client auto reconnect
3. Load balancer route ngẫu nhiên → vào Instance B
4. Instance A chưa kịp detect disconnect (TCP timeout 60s)
5. → User có 2 conn ở 2 instance khác nhau cùng lúc
```

Sticky session đảm bảo bước 3 luôn vào lại Instance A → conn cũ bị replace ngay, không có duplicate.

Code Go hiện tại có safety net (publish kick cross-instance), nhưng sticky session là **layer phòng thủ thứ nhất** — giảm xác suất race condition xảy ra.

### Cấu hình sticky session theo userID

**nginx (consistent hashing theo query param):**

```nginx
upstream game_backend {
    hash $arg_userId consistent;
    server go1:8001;
    server go2:8002;
    server go3:8003;
}

server {
    listen 80;
    location /ws-game {
        proxy_pass http://game_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400; # WebSocket cần timeout dài
    }
}
```

Client connect với URL: `ws://host/ws-game?userId=12345` → nginx hash userId → cùng userId luôn về cùng backend.

**HAProxy:**

```haproxy
backend game
    balance source
    hash-type consistent
    timeout server 86400000  # 1 ngày cho WebSocket
    server go1 go1:8001 check
    server go2 go2:8002 check
    server go3 go3:8003 check
```

`balance source` hash theo client IP — không tốt bằng userId nhưng không cần thay đổi client.

**Kubernetes Service:**

```yaml
apiVersion: v1
kind: Service
metadata:
  name: game-go
spec:
  type: ClusterIP
  sessionAffinity: ClientIP
  sessionAffinityConfig:
    clientIP:
      timeoutSeconds: 10800  # 3 giờ
  selector:
    app: game-go
  ports:
    - port: 80
      targetPort: 8001
```

ClientIP affinity — đơn giản nhưng có vấn đề khi user dùng NAT (nhiều user chung IP).

**Cloudflare/Envoy:**

Setup tương tự — đa số LB modern đều support consistent hashing theo header/query/cookie.

### Sticky theo userID hay theo mapID?

Đây là quyết định kiến trúc quan trọng:

| Sticky theo | Ưu điểm | Nhược điểm |
|---|---|---|
| **userID** | Connection ổn định suốt session, đổi map seamless | Cần broadcast cross-instance |
| **mapID** | Không cần broadcast cross-instance, latency = 0 | User đổi map phải reconnect, không seamless |
| **không sticky** | Đơn giản, LB nào cũng dùng được | Race condition khi user reconnect, cần safety net |

**Recommendation cho game realtime**: sticky theo `userID`. Đó là pattern bạn thấy ở 99% game online (không phải MMO custom).

---

## Polyglot Messaging: Khi 2 stack dùng broker khác nhau

Setup `Go = NATS, NestJS = Redis Pub/Sub` là pattern **polyglot messaging** — phổ biến trong microservices, không phải hack.

### Điều kiện để polyglot hoạt động

Trả lời thật từng câu:

1. **NestJS có gửi system message kiểu "server bảo trì sau 5 phút" tới mọi client (cả Go và NestJS) không?**
   → Nếu có: cần bridge giữa NATS và Redis, hoặc thống nhất 1 broker
   → Nếu không: OK, polyglot được

2. **Khi user mua item ở NestJS, có cần thông báo realtime tới user khác đang chơi qua Go không?**
   → Tương tự câu 1

3. **Khi 2 user chat với nhau, có thể 1 user qua NestJS, 1 user qua Go không?**
   → Nếu yes: cần shared broadcast layer

4. **Admin kick user → user đó có thể đang ở Go hay NestJS, cần kick được cả 2?**
   → Giải quyết bằng REST API: NestJS gọi API Go khi cần kick

Nếu **tất cả** đều "không" hoặc giải quyết được qua REST API → polyglot setup an toàn.

### Pattern này được gọi là gì

**"Shared database, separate messaging"** — service share state qua DB (Redis làm state store), nhưng có message bus riêng cho real-time event nội bộ. Pattern phổ biến vì:

- Mỗi service chọn message broker tối ưu cho usecase của mình
- Decouple deployment: NestJS scale độc lập, Go scale độc lập
- Failure isolation: NATS chết → Go bị, NestJS vẫn chạy bình thường

Drawback: state consistency phải qua DB, không có event-driven sync giữa 2 stack.

### Khi nào KHÔNG nên polyglot

- Có nhiều event cross-stack (chat 2 chiều, system broadcast)
- Team nhỏ, không đủ resource maintain 2 broker
- Latency cross-stack quan trọng (cần NestJS thấy event của Go ngay)

Lúc đó nên thống nhất 1 broker. Redis Pub/Sub thường thắng vì NestJS đã có sẵn adapter.

---

## Production Checklist

Trước khi deploy multi-instance lên production, check tất cả các mục sau:

### Infrastructure

- [ ] Redis (hoặc NATS) deploy với HA — không phải single point of failure
- [ ] Monitor connection pool: `Timeouts > 0` là dấu hiệu xấu
- [ ] Redis `maxmemory` config phù hợp — Pub/Sub buffer không nên ăn hết RAM
- [ ] Network latency LAN < 5ms p99 giữa app và broker
- [ ] Backup/disaster recovery cho Redis state (SETs, HSETs)

### Application

- [ ] Sticky session theo `userID` được config ở LB
- [ ] Healthcheck endpoint có `nodeID` để debug routing
- [ ] Graceful shutdown: HTTP shutdown trước, broker stop sau
- [ ] Bus start TRƯỚC khi accept WebSocket connection
- [ ] Compile-time interface check (`var _ BusHandler = (*Hub)(nil)`)
- [ ] Test single instance mode (bus = nil) vẫn chạy được

### Monitoring

- [ ] `runtime.NumGoroutine()` log mỗi 30-60 giây — phát hiện goroutine pile-up
- [ ] Pool stats: `rdb.PoolStats().Timeouts` — phát hiện pool exhaustion
- [ ] Publish latency histogram (p50, p95, p99)
- [ ] Subscriber lag — message in-flight chưa xử lý
- [ ] Connection count per instance (max ~10k cho 1 process Go)
- [ ] Redis `INFO clients` — số connection thực tế
- [ ] CPU/memory per instance, alert khi > 80%

### Logging

- [ ] Log level `Warn` cho publish failed, decode failed
- [ ] Log với context: nodeID, userID, mapID
- [ ] Sampling cho log spam (kick loop, broadcast volume cao)
- [ ] Correlation ID cho cross-instance event tracing

### Testing

- [ ] Test 2 instance Go cùng broker → verify cross-instance broadcast
- [ ] Test reconnect rapid → không có duplicate connection
- [ ] Test broker chết 30s → app self-recover
- [ ] Test instance crash → user reconnect vào instance khác OK
- [ ] Load test: 1000 user × 60Hz → measure latency p99
- [ ] Chaos test: kill instance ngẫu nhiên → no message loss > acceptable threshold

---

## Troubleshooting

### Vấn đề thường gặp

#### 1. User không nhận message dù instance khác đã broadcast

**Triệu chứng:** Client A ở Instance 1, Client B ở Instance 2, cùng map. Client A move → Client B không thấy.

**Debug:**

```bash
# 1. Check Redis có nhận PUBLISH không
redis-cli MONITOR | grep gamebus

# 2. Check instance B có subscribe không
redis-cli PUBSUB CHANNELS gamebus:*

# 3. Check log instance B có dispatch không
grep "OnBroadcast" instance-b.log
```

**Nguyên nhân thường gặp:**

- Bus chưa `Start()` trước khi accept WebSocket
- nodeID compare nhầm — instance skip echo cả message từ instance khác
- Channel name mismatch giữa publish và subscribe
- `Conn.Send()` channel full → message bị drop

#### 2. Goroutine count tăng tuyến tính

**Triệu chứng:** `runtime.NumGoroutine()` từ 500 → 5000 → 50000 trong vài giờ.

**Nguyên nhân:** Pattern `go func() { bus.Publish() }()` spawn goroutine không control. Redis chậm → goroutine pile up.

**Fix:**

- Migrate sang NATS (publish non-blocking, không cần goroutine)
- Hoặc implement worker pool: 1 channel buffered + N worker cố định

```go
type Bus struct {
    publishCh chan publishJob
}

const numWorkers = 16
const queueSize = 10000

func (b *Bus) publishWorker() {
    for job := range b.publishCh {
        // publish logic
    }
}

func (b *Bus) publish(...) {
    select {
    case b.publishCh <- job:
    default:
        // Queue full → drop message thay vì spawn goroutine
        b.log.Warn("publish queue full")
    }
}
```

#### 3. User có 2 connection cùng lúc ở 2 instance

**Triệu chứng:** User reconnect nhanh, broadcast tới user gửi 2 lần (1 lần mỗi conn).

**Nguyên nhân:** Không có sticky session, race giữa register ở instance B và unregister ở instance A.

**Fix:**

- Config sticky session theo userID (xem section trên)
- Code Go đã có safety net: `register()` publish kick cross-instance — verify nó hoạt động
- Hoặc thêm timestamp/generation ID vào kick message để skip kick stale

#### 4. Redis connection pool exhaustion

**Triệu chứng:** `pool timeout` errors, latency spike.

**Debug:**

```go
stats := rdb.PoolStats()
log.Info("redis pool",
    "timeouts", stats.Timeouts,
    "totalConns", stats.TotalConns,
    "idleConns", stats.IdleConns,
)
```

**Nếu `Timeouts > 0`:**

- Tăng `PoolSize` (default 10 × CPU)
- Giảm publish rate (worker pool)
- Migrate NATS

#### 5. Echo loop — message bị process nhiều lần

**Triệu chứng:** Client nhận cùng message 2-3 lần.

**Nguyên nhân:** nodeID skip không hoạt động — có thể uuid.Parse nhầm, hoặc 2 instance có cùng nodeID (clone container không init lại UUID).

**Fix:**

- Verify mỗi instance có `nodeID` khác nhau qua healthcheck
- Đảm bảo `uuid.NewString()` chạy trong `NewBus()`, không phải global var

#### 6. NATS reconnect liên tục

**Triệu chứng:** Log spam "nats reconnected" mỗi vài giây.

**Nguyên nhân:** Network unstable hoặc NATS server overload.

**Fix:**

- Tăng `ReconnectWait` từ 2s → 5s
- Check NATS server CPU/memory
- Đảm bảo NATS không bị OOM kill

### Tools debug hữu ích

```bash
# Redis
redis-cli MONITOR                # xem mọi command realtime
redis-cli PUBSUB CHANNELS '*'    # list channel đang được subscribe
redis-cli PUBSUB NUMSUB channel  # số subscriber per channel
redis-cli --latency              # đo latency
redis-cli INFO clients           # connection count

# NATS
nats sub '>' --server=nats://...    # subscribe mọi subject
nats stream info                     # JetStream info
nats server report connections       # connection stats

# Go
go tool pprof http://host/debug/pprof/goroutine  # goroutine profile
go tool pprof http://host/debug/pprof/heap       # memory profile
GODEBUG=gctrace=1 ./app                          # GC trace

# Kubernetes
kubectl logs -f -l app=game-go --max-log-requests=10  # log all instances
kubectl top pods -l app=game-go                       # CPU/memory
```

---

## Glossary thuật ngữ

| Thuật ngữ | Giải thích |
|---|---|
| **Bus** | Đường truyền chung cho nhiều component giao tiếp. Metaphor từ system bus của máy tính. |
| **Broker** | Trung gian message giữa publisher và subscriber. Redis, NATS, Kafka đều là broker. |
| **Pub/Sub** | Publish/Subscribe — pattern message: 1 publisher, N subscriber, decoupled. |
| **Fan-out** | 1 message được gửi tới nhiều subscriber cùng lúc. |
| **Sticky session** | LB route cùng client luôn về cùng backend instance. |
| **Echo prevention** | Skip message do chính instance đó publish (vì cũng subscribe channel đó). |
| **Wire** | Kết nối component bằng dependency injection. Như đấu dây điện. |
| **Adapter pattern** | Tách business logic khỏi infrastructure để dễ swap implementation. |
| **Hexagonal architecture** | Tên khác của Adapter pattern, nhấn mạnh "core" độc lập với "outside world". |
| **Hot path** | Code path chạy nhiều, latency-critical (vs cold path là rare/admin). |
| **Fire-and-forget** | Gửi message rồi quên, không đợi ack/response. |
| **Receiver** (Go) | `(b *Bus)` — biến đại diện instance khi gọi method. Như `this` ở JS. |
| **Pointer receiver** | `(b *Bus)` — method có thể modify struct. |
| **Value receiver** | `(b Bus)` — method nhận copy, không modify được. |
| **Compile-time check** | Check tại lúc build, không phải runtime. `var _ Interface = (*Type)(nil)` là ví dụ. |
| **Goroutine** | Lightweight thread của Go, ~2KB stack. |
| **Channel** (Go) | Thread-safe queue để goroutine giao tiếp. |
| **Channel** (Redis) | Topic name mà subscriber lắng nghe. Khác với Go channel. |
| **Subject** (NATS) | Tương đương "channel" trong Redis Pub/Sub. |
| **Big-endian** | Byte order chuẩn cho network protocol — byte cao gửi trước. |
| **MessagePack** | Binary serialization format, gọn hơn JSON ~50%. |
| **CCU** | Concurrent Users — số user online cùng lúc. |

---

## Tóm tắt toàn bộ

| Stack | Broker | Lý do | Khi nào đổi |
|---|---|---|---|
| **NestJS** | Redis Pub/Sub via `@socket.io/redis-adapter` | Có thư viện official, 20 dòng config, business logic latency tolerant | Không cần đổi |
| **Go (Phase 1)** | Redis Pub/Sub tự build | Tận dụng Redis có sẵn, mô hình giống NestJS dễ debug, đủ cho < 50 instance | Khi p99 > 20ms hoặc goroutine pile-up |
| **Go (Phase 2)** | NATS | Hot path 20-60Hz cần latency p99 < 5ms, publish non-blocking giải quyết goroutine pile-up | Đã chọn cho project này |

| Aspect chung | Mô tả |
|---|---|
| **Local fan-out trước, broadcast sau** | User local nhận instant (< 1ms), user remote nhận sau 1-5ms |
| **Echo prevention** | Mỗi instance có nodeID UUID, skip message do chính mình publish |
| **2 connection rule** | Áp dụng cho Redis (subscribe block connection), KHÔNG cần với NATS |
| **Binary encoding (Go)** | `[16B nodeID][1B msgType][body length-prefix]` — gọn và parse nhanh |
| **Adapter pattern** | Bus là layer abstract — đổi broker chỉ cần viết lại 1 file |
| **Compile-time interface check** | `var _ BusHandler = (*Hub)(nil)` — Go idiom thay cho `implements` |
| **Polyglot OK** | Go dùng NATS, NestJS dùng Redis adapter — không cần thống nhất nếu 2 stack độc lập về broadcast |
| **Sticky session** | Config theo userID ở LB — layer phòng thủ tránh duplicate connection |

---

## Tham khảo thêm

### Documentation chính thức

- [Socket.IO Redis Adapter](https://socket.io/docs/v4/redis-adapter/) — official docs, full edge cases
- [NestJS WebSockets Adapter](https://docs.nestjs.com/websockets/adapter) — IoAdapter, useWebSocketAdapter
- [Redis Pub/Sub](https://redis.io/docs/interact/pubsub/) — protocol spec
- [NATS Concepts](https://docs.nats.io/nats-concepts/overview) — subjects, queue groups, JetStream
- [go-redis](https://redis.uptrace.dev/) — go-redis v9 docs
- [nats.go](https://pkg.go.dev/github.com/nats-io/nats.go) — Go client API

### Articles hữu ích

- "Scaling Socket.IO" — Socket.IO blog
- "Designing Real-Time Multiplayer Games" — Gabriel Gambetta
- "Effective Go" — Go official blog (interface, goroutine patterns)
- "100k Concurrent Users on a Single Server" — Phoenix Channels case study

### Open source references

- [Socket.IO Redis adapter source](https://github.com/socketio/socket.io-redis-adapter) — đọc để hiểu sâu MessagePack format
- [NATS Go examples](https://github.com/nats-io/nats.go/tree/main/examples) — pattern standard
- [Centrifugo](https://github.com/centrifugal/centrifugo) — Go alternative tự build sẵn cross-instance broadcast

### Patterns nâng cao (khi cần)

- **Worker pool** cho publish — control goroutine count
- **Per-user serialization** — đảm bảo order message của 1 user
- **JetStream** (NATS) — guaranteed delivery khi cần
- **Redis Streams** — alternative cho Pub/Sub khi cần persistence
- **Sharded Pub/Sub** — Redis 7+ feature, distribute load
- **Consistent hashing** — sticky session với rebalance graceful

---

**Tác giả ghi chú:**

Tài liệu này tổng hợp từ thực tế triển khai 1 game online dùng kết hợp NestJS + Go service, multi-instance với cả Redis Pub/Sub và NATS. Mọi pattern đều đã production-tested. Trade-off và limitation đều được nêu rõ — không có "best practice" tuyệt đối, chỉ có "phù hợp với context".

Khi nào nghi ngờ: **đo trước khi optimize**. Premature optimization là root of all evil. Bắt đầu đơn giản (single instance hoặc Redis Pub/Sub), monitor production, scale up khi metric thực tế bảo phải scale.