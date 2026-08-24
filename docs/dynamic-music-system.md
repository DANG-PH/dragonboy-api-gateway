# Hệ thống quản lý nhạc nền động cho game

Tài liệu thiết kế kỹ thuật và bài học rút ra từ quá trình implement hệ thống quản lý nhạc nền cho game LibGDX, cho phép admin thêm/sửa/xóa nhạc mà không cần update client.

## 1. Bài toán

### Hiện trạng ban đầu

Game LibGDX có 12 bài nhạc nền được nhúng cứng trong APK, load lúc khởi động:

```java
String[] tenFile = {
    "",
    "khauthitamphi.mp3",
    "demngayxaem.mp3",
    "ketheoduoianhsang.mp3",
    "thaproitudo.mp3",
    "dieuanhbiet.mp3",
    "dandan.mp3",
    "saominhchuanamtaynhau.mp3",
    "thoigiansetraloi.mp3",
    "suthatdaboquen.mp3",
    "khonglayduocvo.mp3",
    "seasons.mp3",
    "vokichcuaem.mp3"
};

for (int i = 1; i < tenFile.length; i++) {
    nhacNen[i] = Gdx.audio.newMusic(Gdx.files.internal("nhacnen/" + tenFile[i]));
    nhacNen[i].setLooping(true);
    nhacNen[i].setVolume(0.5f);
}
```

### Vấn đề

Mọi thay đổi về danh sách nhạc đều yêu cầu:

1. Sửa code Java
2. Build lại APK
3. Release version mới lên store
4. User phải update game

Quá trình này mất hàng giờ tới hàng ngày chỉ để thêm/đổi 1 bài nhạc. Không phù hợp khi muốn thử nghiệm, A/B test, hay thêm nhạc theo mùa/sự kiện.

### Mục tiêu

Cho phép admin:
- Upload bài hát mới bất kỳ lúc nào
- Tắt/bật bài đang có
- Tất cả thay đổi reflect ngay trên client mà **không cần update game**

## 2. Tư duy thiết kế

### Tách biệt build-time và runtime

Vấn đề cốt lõi: danh sách nhạc đang là **build-time data** (compile vào APK). Để admin sửa được mà không rebuild, phải chuyển sang **runtime data** (load từ network khi game chạy).

```
BUILD-TIME (fixed)              RUNTIME (dynamic)
────────────────                ─────────────────
File mp3 trong APK              File mp3 trên server
List bài trong code             List bài trong DB
Update = rebuild + release      Update = upload + DB insert
```

### Tách biệt metadata và file binary

Một bài nhạc gồm 2 phần thông tin:

| Loại | Dữ liệu | Phù hợp lưu ở |
|------|---------|---------------|
| Metadata | id, tên, status, hash | Database (MySQL/Postgres) |
| Binary | File mp3 5MB | Object storage (S3/Supabase/R2) |

**Tại sao tách?**

- Query metadata cần SQL, index, transaction → DB phù hợp
- Serve file binary cần CDN, bandwidth lớn, không cần query phức tạp → Object storage phù hợp
- Lưu binary trong DB (BLOB) là anti-pattern: DB chậm, backup tốn, không scale

### Immutable URL (content-addressable storage)

Quyết định quan trọng nhất của hệ thống: **tên file = hash MD5 của nội dung**.

```typescript
const hash = crypto.createHash('md5').update(file.buffer).digest('hex');
const key = `${hash}.${ext}`;  // VD: "2a678803b231fa974dca1c7ab108a264.mp3"
```

**Lợi ích**:

1. **Deduplication**: 2 file giống hệt → cùng hash → không tốn dung lượng
2. **Cache busting tự động**: File đổi nội dung → hash đổi → URL đổi → cache cũ vô hiệu
3. **No cache invalidation problem**: Không bao giờ cần "purge cache" vì mỗi version có URL riêng
4. **Idempotent upload**: Upload cùng 1 file 2 lần thì ghi đè cùng 1 key, không tốn thêm chỗ

**Trade-off**:

- Tên file không "đẹp" — `2a678803b231fa974dca1c7ab108a264.mp3` thay vì `khauthitamphi.mp3`
- User thấy URL kỳ → không vấn đề vì user không bao giờ nhìn URL
- Cần lưu `name` riêng trong DB để hiển thị

> "There are only two hard things in Computer Science: cache invalidation and naming things." — Phil Karlton
>
> Hash-based URL giải quyết cả 2: không cần invalidate vì URL immutable, và đặt tên cũng không cần nghĩ.

### Cache nhiều tầng

```
┌─────────────────────────────────────────────────┐
│ TẦNG 3: Local cache (LibGDX)                    │
│ File mp3 lưu trong Gdx.files.local("nhacnen/")  │
└─────────────────────────────────────────────────┘
                    ↓ cache miss
┌─────────────────────────────────────────────────┐
│ TẦNG 2: Cloudflare Worker cache                 │
│ Edge cache ở Singapore/HK cho user VN           │
└─────────────────────────────────────────────────┘
                    ↓ cache miss
┌─────────────────────────────────────────────────┐
│ TẦNG 1: Supabase CDN (mặc định)                 │
│ Built-in CDN của Supabase                       │
└─────────────────────────────────────────────────┘
                    ↓ cache miss
┌─────────────────────────────────────────────────┐
│ ORIGIN: Supabase Storage                        │
│ File mp3 thật (Singapore region)                │
└─────────────────────────────────────────────────┘
```

**Tại sao nhiều tầng?**

Mỗi tầng giải quyết 1 vấn đề khác nhau:

- Local cache: tiết kiệm bandwidth user, làm app load nhanh sau lần đầu
- CDN edge: giảm latency, giảm tải origin
- Origin: nguồn duy nhất, source of truth

## 3. Lựa chọn provider — quyết định và trade-off

### Yêu cầu

- Lưu file mp3 (max 20MB)
- Bandwidth đủ cho hàng nghìn user/tháng
- Có CDN để tốc độ tải tốt cho user VN
- **Không phải add credit card** (constraint từ dev)
- Free tier hoặc rẻ

### Các phương án đã xem xét

| Provider | Cần card | Free Storage | Free Egress | Đánh giá |
|----------|----------|--------------|-------------|----------|
| AWS S3 | ✅ (gắt) | 5GB (12 tháng) | 100GB (12 tháng) | Đắt, sau 12 tháng tính tiền hết |
| Cloudflare R2 | ✅ | 10GB vĩnh viễn | **Unlimited** | Best nếu có card |
| Backblaze B2 | ❌ | 10GB | 1GB/ngày | OK nhưng phức tạp setup CDN |
| Supabase | ❌ | 1GB | 10GB/tháng | **Chọn** — đơn giản, đủ dùng |
| GitHub Release | ❌ | "Unlimited" | "Unlimited" | Vi phạm ToS, không dùng |
| VPS tự host | ❌ | Tùy VPS | Tùy bandwidth | Không scale được |

### Tại sao loại GitHub Release

Có vẻ hấp dẫn vì free và không card, nhưng:

- GitHub ToS cấm dùng làm CDN
- Không có upload API tiện lợi (phải tạo release rồi upload asset từng cái)
- Rate limit nặng (60 req/giờ anonymous)
- Tốc độ chậm cho user VN
- Có thể bị ban repo bất kỳ lúc nào

→ Đây là **anti-pattern**, đừng dùng cho production.

### Tại sao loại VPS tự host

Đây là phương án ban đầu mình đã cân nhắc kỹ:

**Ưu**:
- VPS đã có (50GB storage, dùng 20GB) — dư chỗ
- Code đơn giản nhất: `fs.writeFile` + Nginx serve static
- Hoàn toàn free, không cần subscription
- Tự kiểm soát hoàn toàn

**Nhược chí mạng**:

```
Setup hiện tại (1 VPS):           Khi scale ngang:

┌──────────────┐                  ┌──────────────┐  ┌──────────────┐
│  VPS         │                  │  VPS 1       │  │  VPS 2       │
│  /music/     │                  │  /music/     │  │  /music/     │
│   abc.mp3 ✓  │                  │   abc.mp3 ✓  │  │   abc.mp3 ✗  │
└──────────────┘                  └──────────────┘  └──────────────┘
                                          ↑                ↑
                                          └──── LB ────────┘

                                  Admin upload vào VPS 1 → user lock
                                  vào VPS 2 → 404 not found
```

VPS storage là **stateful**. Không tách được khỏi compute. Sau này không thể chạy multi-instance được. Đây là decision quan trọng vì game dùng load balancer (`upstream` của nginx có 2 server).

→ **Object storage tách biệt khỏi VPS là quyết định kiến trúc đúng**, dù trước mắt chưa thấy benefit.

### Tại sao chọn Supabase

So với Backblaze B2 (cũng không cần card):

- B2 setup CDN phức tạp (cần Transform Rule, Cache Rule)
- Supabase có CDN built-in, hoạt động ngay
- Code Supabase Storage compatible với S3 SDK → cùng pattern
- Sau này muốn migrate sang R2 chỉ cần đổi endpoint

### Trade-off của Supabase

| Ưu | Nhược |
|----|-------|
| Không cần card | Free tier nhỏ (1GB storage, 10GB bandwidth) |
| S3-compatible API | Project pause sau 7 ngày không activity |
| CDN built-in | Datacenter chính ở SG (xa user EU/US) |
| Dashboard đẹp, dễ dùng | Nếu game scale → phải upgrade hoặc migrate |

**Mitigation**:
- Cache nhiều tầng → giảm hit Supabase tới mức tối thiểu
- Setup keep-alive ping → tránh pause
- Có exit strategy: migrate sang R2 chỉ cần đổi env

## 4. Kiến trúc tổng thể

```
                                    ┌─────────────────┐
                                    │  Admin Panel    │
                                    │  (Web UI)       │
                                    └────────┬────────┘
                                             │ HTTP POST multipart
                                             │ /game-data/music
                                             ▼
┌───────────────────────────────────────────────────────────────┐
│  API Gateway (NestJS)                                         │
│  - REST endpoint nhận file upload                             │
│  - Tính MD5 hash                                              │
│  - Upload Supabase qua S3 SDK                                 │
│  - Gọi gRPC sang game-data-service lưu metadata               │
└────────┬──────────────────────────────────────────┬───────────┘
         │ gRPC                                     │ S3 PutObject
         ▼                                          ▼
┌──────────────────────┐                ┌──────────────────────┐
│ game-data-service    │                │  Supabase Storage    │
│ (NestJS Microservice)│                │  Bucket: music/      │
│ - Insert MySQL       │                │  └─ <hash>.mp3       │
└──────────────────────┘                └──────────┬───────────┘
                                                   │
                                                   │ public URL
                                                   ▼
┌───────────────────────────────────────────────────────────────┐
│  Client game (LibGDX)                                         │
│  1. GET /game-data/music → list nhạc                          │
│  2. Download file qua Cloudflare Worker proxy                 │
│     https://music-proxy.ngocrongdark.com/...mp3               │
│  3. Save vào Gdx.files.local("nhacnen/<hash>.mp3")            │
│  4. Phát nhạc từ file local                                   │
└───────────────────────────────────────────────────────────────┘
```

## 5. Implementation backend

### 5.1 Schema database

```typescript
// music.entity.ts (game-data-service)
@Entity('music')
export class MusicEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 255 })
  name: string;

  @Column({ length: 500 })
  fileUrl: string;

  @Column({ length: 32 })
  hash: string;

  @Column({ type: 'enum', enum: MusicStatus, default: MusicStatus.ACTIVE })
  status: MusicStatus;
}
```

**Decision: giữ schema tối thiểu**

Ban đầu schema có nhiều field (artist, duration, displayOrder, defaultVolume, isLooping, uploadedBy, fileSize, fileKey, timestamps). Sau khi review nhu cầu thực, **trim xuống còn 5 field**:

- `name`: hiển thị cho user
- `fileUrl`: client tải về
- `hash`: client check file đã đổi để re-download
- `status`: tắt/bật bài

Lesson: **YAGNI** (You Aren't Gonna Need It). Thêm field khi cần, đừng thêm "phòng khi".

### 5.2 gRPC interface

```protobuf
// game-data.proto
service GameDataService {
  rpc GetAllMusic (Empty) returns (GetAllMusicResponse);
  rpc ThemMusic   (ThemMusicRequest) returns (Music);
  rpc SuaMusic    (SuaMusicRequest)  returns (Music);
  rpc XoaMusic    (XoaMusicRequest)  returns (Empty);
}

message Music {
  int32  id        = 1;
  string name      = 2;
  string file_url  = 3;
  string hash      = 4;
  string status    = 5;
}

message ThemMusicRequest {
  string name     = 1;
  string file_url = 2;
  string hash     = 3;
}
```

**Decision: tách upload file ra khỏi gRPC**

gRPC giỏi cho structured data, **không phù hợp cho file binary lớn**. Lý do:
- gRPC-Web không support client streaming
- File 20MB qua gRPC phức tạp hơn HTTP multipart nhiều
- Không tận dụng được resumable upload, progress

→ Chia trách nhiệm:
- **API Gateway (HTTP REST)**: nhận file upload, tính hash, upload Supabase, gọi gRPC
- **game-data-service (gRPC)**: chỉ CRUD metadata, không biết gì về storage

### 5.3 Upload service (API Gateway)

```typescript
async handleThemMusic(
  body: { name: string },
  file: any,
): Promise<Music> {
  if (!file) throw new BadRequestException('Thiếu file mp3');

  // 1. Tính MD5 hash
  const hash = crypto.createHash('md5').update(file.buffer).digest('hex');

  // 2. Upload Supabase
  const ext = (file.originalname.split('.').pop() ?? 'mp3').toLowerCase();
  const key = `${hash}.${ext}`;

  await this.s3.send(
    new PutObjectCommand({
      Bucket: process.env.SUPABASE_BUCKET!,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    }),
  );

  const file_url = `${process.env.SUPABASE_PUBLIC_DOMAIN}/${key}`;

  // 3. Lưu metadata qua gRPC
  return grpcCall(
    GameDataService.name,
    this.gameDataGrpcService.themMusic({
      name: body.name,
      file_url,
      hash,
    }),
  );
}
```

### 5.4 Tại sao dùng `PutObjectCommand` thay vì JSON

Đoạn code:
```typescript
await this.s3.send(new PutObjectCommand({ ... }));
```

Là pattern Command của AWS SDK v3. **Không gửi JSON thẳng** vì:

- S3 protocol là REST + XML, không phải JSON-RPC
- Mỗi thao tác là HTTP method khác nhau (PUT, GET, DELETE)
- Cần ký request bằng AWS Signature V4 (HMAC-SHA256 phức tạp)
- SDK gói tất cả 50+ dòng signing code vào 1 hàm

**Trade-off của Command pattern**: trông lạ với người mới nhưng tree-shakeable → bundle nhỏ hơn so với aggregated client kiểu cũ.

### 5.5 Setup S3 client cho Supabase

```typescript
this.s3 = new S3Client({
  region: process.env.SUPABASE_S3_REGION!,
  endpoint: process.env.SUPABASE_S3_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.SUPABASE_S3_ACCESS_KEY!,
    secretAccessKey: process.env.SUPABASE_S3_SECRET_KEY!,
  },
  forcePathStyle: true,
});
```

**Key insight**: `@aws-sdk/client-s3` không chỉ cho AWS. Mọi S3-compatible storage đều dùng được, chỉ đổi `endpoint`:

```typescript
// AWS S3
endpoint: undefined  // mặc định AWS
region: 'ap-southeast-1'

// Cloudflare R2
endpoint: 'https://<account>.r2.cloudflarestorage.com'
region: 'auto'

// Backblaze B2
endpoint: 'https://s3.us-west-002.backblazeb2.com'
region: 'us-west-002'

// Supabase
endpoint: 'https://<project>.supabase.co/storage/v1/s3'
forcePathStyle: true
```

`forcePathStyle: true` cần thiết cho Supabase vì URL của họ dùng path-style (`endpoint/bucket/key`) thay vì virtual-host-style (`bucket.endpoint/key`).

→ **Lợi thế**: switch provider cực dễ. Đổi env, không đổi code.

## 6. Implementation client

### 6.1 Tách logic vào MusicManager

```java
public class MusicManager {
    private static final String LOCAL_DIR = "nhacnen/";
    public static final Map<Integer, Music> nhacNen = new HashMap<>();
    private static final List<MusicServerData> danhSachNhac = new ArrayList<>();
    private static boolean daLoad = false;

    public static void init(Runnable onXong) {
        if (daLoad) {
            if (onXong != null) onXong.run();
            return;
        }

        ApiService.layDanhSachNhac(danhSach -> {
            new Thread(() -> taiVaLoad(danhSach, onXong)).start();
        });
    }
    // ...
}
```

**Decision: dùng Map thay vì Array**

Code cũ:
```java
nhacNen[1].play();  // bài id=1
```

Code mới:
```java
MusicManager.play(1);  // gọi qua id từ server
```

**Lý do**: ID từ server không liên tục. Admin xóa bài → có lỗ trong dãy ID (1, 3, 5, 99). Array sẽ NPE, Map xử lý gọn.

### 6.2 Flow load nhạc

```java
private static void taiVaLoad(List<MusicServerData> danhSach, Runnable onXong) {
    FileHandle dir = Gdx.files.local(LOCAL_DIR);
    if (!dir.exists()) dir.mkdirs();

    danhSachNhac.clear();
    for (MusicServerData m : danhSach) {
        if ("active".equalsIgnoreCase(m.status)) {
            danhSachNhac.add(m);
        }
    }

    Set<String> validFiles = new HashSet<>();

    for (MusicServerData m : danhSachNhac) {
        String fileName = m.hash + ".mp3";  // tên file local = hash
        validFiles.add(fileName);

        FileHandle local = Gdx.files.local(LOCAL_DIR + fileName);

        // Cache check: file đã có chưa?
        if (!local.exists()) {
            boolean ok = ApiService.taiFileNhacVeLocal(m.file_url, local);
            if (!ok) continue;
        }

        // Load Music phải chạy trên main thread (LibGDX yêu cầu)
        final int id = m.id;
        Gdx.app.postRunnable(() -> {
            Music music = Gdx.audio.newMusic(local);
            music.setLooping(true);
            music.setVolume(0.5f);
            nhacNen.put(id, music);
        });
    }

    // Dọn file rác: file local không còn trong danh sách
    for (FileHandle f : dir.list()) {
        if (!validFiles.contains(f.name())) {
            f.delete();
        }
    }

    daLoad = true;
    if (onXong != null) Gdx.app.postRunnable(onXong);
}
```

**Key points**:

1. **Hash-based filename**: dùng `m.hash + ".mp3"` làm tên file local. Khi admin upload bài mới với cùng tên, hash khác → file local không match → tự download lại.

2. **Cleanup orphan files**: liệt kê file local, file nào không có trong danh sách server thì xóa. Tránh tích tụ file rác sau khi admin xóa bài.

3. **Main thread requirement**: `Gdx.audio.newMusic()` phải chạy trên main thread. Background thread chỉ làm download và file I/O. Dùng `Gdx.app.postRunnable()` để chuyển lên main thread.

### 6.3 Tại sao client không cần fetch file mỗi lần

Game khởi động:
- Lần 1: fetch list (200 bytes JSON) → tải 12 bài (60MB) → cache local
- Lần 2+: fetch list (200 bytes) → tất cả file đã có local → 0 byte download

So với mỗi lần play bài mới phải stream từ server: tiết kiệm 99% bandwidth.

**Trade-off**: tốn ~60MB disk của user. Nhưng:
- Game hiện đại nhiều khi 1-2GB
- 60MB không đáng kể
- User có lợi: chạy offline được, nghe nhạc không lag

## 7. Tầng cache Cloudflare Worker

### 7.1 Vấn đề Supabase free tier

```
Free egress: 10GB/tháng

12 bài × 5MB = 60MB/user
1000 user mới/tháng = 60GB
                      ↑
                      Vượt 5× free tier
```

Sau 170 user, bắt đầu phải trả tiền. Không scale được.

### 7.2 Giải pháp: Cloudflare Worker proxy

Đặt Cloudflare Worker giữa client và Supabase:

```
Client → Cloudflare Worker (cache lớp ngoài) → Supabase
```

User VN luôn hit Cloudflare edge gần nhất (Singapore/HK). Worker check cache:
- HIT (99%): trả ngay từ edge → **0 byte bandwidth Supabase**
- MISS (1%): fetch Supabase 1 lần → cache → trả user

### 7.3 Tại sao Worker chứ không phải VPS Nginx proxy

Phương án thay thế: tự build proxy bằng VPS Nginx.

| | Cloudflare Worker | VPS Nginx proxy |
|---|---|---|
| Setup | 10 phút | 30 phút |
| Cache distribution | 300+ edge toàn cầu | 1 region (VPS) |
| Bandwidth VPS | 0 | Tốn (proxy traffic) |
| Latency cho user VN | ~50ms (SG edge) | Tùy region VPS |
| Cost | Free (100k req/ngày) | Tốn bandwidth VPS |
| Scaling | Auto | Manual |
| Uptime | 99.99% | Phụ thuộc VPS |

→ Cloudflare Worker thắng mọi mặt. VPS Nginx proxy chỉ phù hợp khi không thể dùng Worker (rare).

### 7.4 Code Worker

```javascript
const SUPABASE_HOST = 'buvbhprlufjqioimiqlu.supabase.co';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    if (!url.pathname.startsWith('/storage/v1/object/public/')) {
      return new Response('Not found', { status: 404 });
    }
    
    const supabaseUrl = `https://${SUPABASE_HOST}${url.pathname}`;
    
    const cacheKey = new Request(supabaseUrl);
    const cache = caches.default;
    
    let response = await cache.match(cacheKey);
    
    if (!response) {
      response = await fetch(supabaseUrl, {
        cf: {
          cacheTtl: 2592000,        // 30 ngày
          cacheEverything: true,
        },
      });
      
      if (!response.ok) return response;
      
      response = new Response(response.body, response);
      response.headers.set('Cache-Control', 'public, max-age=2592000, immutable');
      response.headers.set('Access-Control-Allow-Origin', '*');
      response.headers.set('X-Cache', 'MISS');
      
      ctx.waitUntil(cache.put(cacheKey, response.clone()));
    } else {
      response = new Response(response.body, response);
      response.headers.set('X-Cache', 'HIT');
    }
    
    return response;
  },
};
```

**Giải thích chỗ khó**:

- `caches.default`: cache instance toàn cục của Worker. Key-value store, key là Request object (URL), value là Response.

- `ctx.waitUntil(cache.put(...))`: lưu cache **không block response**. Worker trả file cho user trước, sau đó mới lưu cache. Tăng tốc response.

- `cf: { cacheTtl: 2592000, cacheEverything: true }`: hint cho fetch() về cache behavior. `cacheEverything: true` override default Cloudflare logic (chỉ cache file tĩnh theo extension).

- `Cache-Control: immutable`: nói với browser file không bao giờ đổi → browser cache vĩnh viễn → không bao giờ revalidate. Đúng vì URL của ta hash-based → immutable thực sự.

### 7.5 Cache không sync giữa region

**Quan trọng phải hiểu**: Cloudflare cache **không replicate** giữa data center. Mỗi edge cache riêng.

```
User VN → Singapore edge → cache key "abc.mp3"
User US → LA edge        → cache key "abc.mp3" (riêng, không sync từ SG)
```

→ Mỗi region miss cache 1 lần đầu. Với game user 99% VN → chỉ Singapore edge cache → Supabase chỉ bị hit 1 lần đầu duy nhất.

Đây là **đặc tính, không phải bug**. Sync cache giữa region sẽ tốn bandwidth nội bộ Cloudflare → họ không làm.

### 7.6 Tại sao cache hoạt động bất kể admin thay đổi nhiều ít

Đây là điểm mạnh của hash-based URL.

**Scenario A**: Admin thêm bài mới
```
File mới → hash mới → URL mới
Cache cũ vẫn còn (không bị ảnh hưởng)
Cache mới được build cho URL mới
```

**Scenario B**: Admin xóa bài
```
DB set status=inactive
API không trả bài đó nữa
Cache CDN vẫn còn nhưng không ai gọi → tự expire sau 30 ngày
```

**Scenario C**: Admin "thay" bài (xóa + upload lại với file mp3 khác cùng tên hiển thị)
```
Hash khác → URL khác hoàn toàn
Cache cũ tự expire
Cache mới build cho URL mới
```

**Không bao giờ cần purge cache thủ công.** Đây là magic của immutable URL.

### 7.7 So với mutable URL (anti-pattern)

```
URL cố định: /music/song.mp3

Day 1: file v1 (rock) → cache
Day 2: admin upload v2 (ballad) thay vào cùng URL
       → user vẫn nhận v1 từ cache 30 ngày! BUG
       → phải purge cache thủ công
```

→ Hash-based URL là **production-grade pattern**. Netflix, YouTube, Spotify đều dùng.

## 8. Setup Cloudflare Worker

### 8.1 Tạo Worker

1. Cloudflare Dashboard → Workers & Pages → Create
2. Chọn "Start with Hello World!"
3. Đặt tên: `music-proxy`
4. Deploy

### 8.2 Paste code

Edit code → xóa default → paste code section 7.4 → đổi `SUPABASE_HOST` → Save and deploy.

### 8.3 Test workers.dev

```
https://music-proxy.<subdomain>.workers.dev/storage/v1/object/public/music/<hash>.mp3
```

Phải tải được mp3 + header `X-Cache: MISS` (lần đầu) → `HIT` (lần sau).

### 8.4 Bind custom domain

Worker → tab Domains → Add Custom Domain → `cdn-music.ngocrongdark.com`.

Cloudflare tự tạo CNAME + SSL. Đợi 1-5 phút.

### 8.5 Update env + DB

```dotenv
SUPABASE_PUBLIC_DOMAIN=https://cdn-music.ngocrongdark.com/storage/v1/object/public/music
```

```sql
UPDATE music 
SET file_url = REPLACE(
  file_url,
  'https://buvbhprlufjqioimiqlu.supabase.co',
  'https://cdn-music.ngocrongdark.com'
);
```

## 9. Monitoring và operations

### 9.1 Verify cache hoạt động

```bash
# Lần 1
curl -I https://cdn-music.ngocrongdark.com/storage/v1/object/public/music/<hash>.mp3
# x-cache: MISS

# Lần 2 (ngay sau)
curl -I https://cdn-music.ngocrongdark.com/storage/v1/object/public/music/<hash>.mp3
# x-cache: HIT
```

### 9.2 Worker metrics

Worker `music-proxy` → tab Metrics:
- **Total Requests**: tổng request
- **Subrequests**: lần Worker phải fetch Supabase = cache miss

Target: Subrequests / Total < 5% (sau 1-2 ngày warm cache).

### 9.3 Supabase bandwidth

Supabase Dashboard → Usage → Bandwidth:
- Storage Egress phải gần như đứng yên sau khi Worker active

### 9.4 Vấn đề project pause của Supabase

```
Free tier: project pause sau 7 ngày không có API request
```

Với 3000+ user, không bao giờ pause. Nhưng với game nhỏ, nên có keep-alive:

```yaml
# .github/workflows/keepalive.yml
name: Keep Supabase Alive
on:
  schedule:
    - cron: '0 0 */3 * *'  # 3 ngày/lần

jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - run: curl -I https://buvbhprlufjqioimiqlu.supabase.co/storage/v1/object/public/music/<hash>.mp3
```

GitHub Actions free → đủ chạy mãi.

## 10. Capacity analysis

### Với 3000 user

```
DAU:               500-1000
User mới/tháng:    200-500

Storage:           12 bài × 5MB = 60MB
                   → 6% Supabase free (1GB)

Cloudflare Worker: ~500 req/ngày (user mới × 12 bài)
                   → 0.5% free tier (100k/ngày)

Supabase egress:   < 500MB/tháng (chỉ cache miss)
                   → 5% free tier (10GB)

VPS API:           ~5000 req/ngày (game open ~5 lần/user/ngày)
                   → không đáng kể
```

→ Dư capacity gấp 20-30 lần. Có thể scale tới ~30k user mà không cần upgrade.

### Bottleneck thực sự khi scale lớn

Không phải storage hay bandwidth, mà là:

- **Admin upload speed**: file lớn qua API → timeout. Fix: tăng Nginx `client_max_body_size`, `client_body_timeout`
- **VPS connection limit**: nhiều user gọi `/game-data/music` cùng lúc → tăng worker process Node
- **Database hot row**: nhiều request đọc DB music → cần Redis cache layer

Nhưng những vấn đề này **chỉ xuất hiện khi đông user thật**, không phải vấn đề bây giờ.

## 11. Bài học và best practices

### 11.1 YAGNI — đừng over-engineer

Schema ban đầu có 12 field, sau trim còn 5. Field như `duration`, `displayOrder`, `defaultVolume`, `isLooping`, `uploadedBy` đều "có vẻ hữu ích" nhưng:
- Không có UI dùng tới
- Game không cần thông tin đó
- Thêm sau khi cần dễ, bỏ ra khó

**Lesson**: thêm field khi có user story cụ thể, đừng phỏng đoán.

### 11.2 Tách trách nhiệm dịch vụ

```
game-data-service (gRPC): chỉ CRUD metadata
api-gateway (REST):       handle upload, gọi storage, forward gRPC
storage provider:         lưu file
```

`game-data-service` **không biết Supabase tồn tại**. Sau này swap provider chỉ cần đổi api-gateway. Đây là **separation of concerns** đúng nghĩa.

### 11.3 Đừng tối ưu sớm

Ban đầu mình đã đề xuất:
- Manifest version để track changes
- Audit log
- Hash check 2 chiều
- Lazy load
- Progressive download

Tất cả đều bị bỏ. Lý do: case của bạn không cần. Thêm complexity = thêm bug = thêm maintenance cost.

Khi nào cần thì thêm. Không cần thì để đó.

### 11.4 Cache là cách rẻ nhất để scale

Trước khi nâng cấp infrastructure, hỏi: "Cache layer nào còn thiếu?"

Hệ thống này có 3 tầng cache. Sau khi setup hết:
- Storage egress giảm 99%
- Latency giảm 80%
- Cost vẫn $0

Cache > Scale up server.

### 11.5 Immutable data dễ hơn mutable rất nhiều

Hash-based URL là quyết định kiến trúc tốt nhất của hệ thống này:
- Không cần cache invalidation
- Không cần version tracking
- Không cần rollback strategy
- File mới = URL mới, file cũ = URL cũ, hai cái coexist

Whenever possible, **make things immutable**.

### 11.6 Tin vào abstraction (S3-compatible)

Code dùng `@aws-sdk/client-s3` cho Supabase, sau này có thể chuyển R2/B2/AWS chỉ đổi env. Không bao giờ bị vendor lock-in.

Lesson: chọn provider có open standard (S3 API), tránh proprietary API.

### 11.7 Đo lường trước khi tối ưu

Cách kiểm tra Worker cache có work không:
```bash
curl -I <url> | grep x-cache
```

Nếu thấy `MISS` mãi → có vấn đề. Không đoán mò, phải đo.

### 11.8 Khi nào dùng PATCH vs PUT vs POST

```
POST /game-data/music              → tạo mới
PATCH /game-data/music             → sửa metadata
DELETE /game-data/music?id=X       → soft delete
```

REST conventions giúp API self-documenting. Đừng dùng POST cho mọi thứ.

### 11.9 gRPC cho service-to-service, REST cho client-facing

```
Client (game/web) → REST → API Gateway → gRPC → Microservices
```

gRPC tốt cho microservice communication (typed, performant), không tốt cho public API (browser không native support, hard to debug).

### 11.10 Database soft delete > hard delete

```typescript
async xoaMusic(data: XoaMusicRequest): Promise<Empty> {
  music.status = MusicStatus.INACTIVE;  // không xóa thật
  await this.musicRepo.save(music);
  return {};
}
```

Lý do:
- Có thể restore khi admin xóa nhầm
- Giữ referential integrity nếu có FK
- Audit log: biết bài nào từng tồn tại
- File trên storage không bị orphan ngay

Chỉ hard delete khi có cron cleanup chạy định kỳ.

## 12. Vấn đề đã gặp và cách fix

### 12.1 Nginx 413 Request Entity Too Large

Default `client_max_body_size` của Nginx là 1MB. File mp3 5MB → 413.

Fix: thêm vào block `http {}`:
```nginx
client_max_body_size 50M;
```

### 12.2 TypeScript error: `Express.Multer` namespace

```
Namespace 'global.Express' has no exported member 'Multer'.
```

Fix:
```bash
npm i -D @types/multer
```

Restart TS server.

### 12.3 URL path double "music/music/"

Bug: code dùng `music/${hash}` làm key, env `SUPABASE_PUBLIC_DOMAIN` có sẵn `/music` → URL thành `.../music/music/<hash>.mp3`.

Fix: bỏ prefix trong code:
```typescript
const key = `${hash}.${ext}`;  // không có "music/"
```

**Lesson**: env và code phải align. Document rõ format từng env.

### 12.4 Cloudflare Worker không cache khi test trong Playground

Cloudflare Workers Cache API **không work trong Playground/Preview**. Phải deploy thật mới chạy.

Fix: test trên `*.workers.dev` URL, không phải Playground preview.

## 13. Exit strategy — khi nào cần migrate

Mô hình hiện tại scale tới ~30k user. Khi nào cần upgrade:

### Migrate Supabase → R2 (khi vượt 10GB egress)

Chỉ cần:
1. Tạo bucket R2
2. Copy file từ Supabase sang R2 (rclone)
3. Đổi env api-gateway (endpoint, credentials)
4. UPDATE DB đổi domain URL
5. Optional: cập nhật Worker proxy nếu cần custom logic

Code không đổi. Downtime ~5 phút.

### Add monitoring (khi > 5k user)

- Cloudflare Notifications: alert khi Worker > 80% quota
- Supabase: alert khi bandwidth > 80%
- Sentry: track error rate

### Add CDN backup (khi cần high availability)

- Setup Cloudflare R2 thay vì Supabase
- R2 không bao giờ pause, egress free vô hạn
- Cost: cần credit card

## 14. Giải thích các syntax/API khó hiểu

Phần này dành cho dev mới đọc code và bị tắc ở các API/pattern lạ. Mỗi đoạn giải thích từng cái cụ thể, không cần thuộc bài.

### 14.1 Java client — Thread + `Gdx.app.postRunnable()`

Đoạn code:
```java
public static void init(Runnable onXong) {
    if (daLoad) {
        if (onXong != null) onXong.run();
        return;
    }

    ApiService.layDanhSachNhac(danhSach -> {
        new Thread(() -> taiVaLoad(danhSach, onXong)).start();
    });
}

private static void taiVaLoad(...) {
    // ... download file ở background thread
    
    Gdx.app.postRunnable(() -> {
        Music music = Gdx.audio.newMusic(local);
        music.setLooping(true);
        nhacNen.put(id, music);
    });
}
```

**Vấn đề muốn giải quyết**:

LibGDX (và OpenGL nói chung) có quy tắc bất di bất dịch: **mọi thao tác với graphics/audio API phải chạy trên 1 thread duy nhất** — gọi là "OpenGL thread" hay "main render thread".

Nếu gọi `Gdx.audio.newMusic()` từ thread khác → crash với lỗi `GLException` hoặc undefined behavior.

Nhưng download file 5MB qua HTTP thì **không thể chạy trên main thread** — nó block render → game freeze.

→ Mâu thuẫn: cần background thread để download, nhưng load Music phải main thread.

**Giải pháp 2 thread**:

```
Main Thread (render game @60fps)
    │
    │ Khởi tạo MusicManager.init(callback)
    │
    └─→ Spawn background thread ──┐
                                  │
                                  ▼
                          Background Thread
                          - Fetch API
                          - Download mp3 (HTTP)
                          - Save file local
                                  │
                                  │ postRunnable(() -> {...})
                                  │
                                  ▼ (queue job vào main thread)
                          
Main Thread tiếp tục render
    │
    │ Cuối mỗi frame, LibGDX runs queued runnables
    │
    └─→ Music music = Gdx.audio.newMusic(local); ← chạy ở main thread
```

**Giải thích từng API**:

| API | Vai trò |
|-----|---------|
| `new Thread(() -> {...}).start()` | Tạo thread mới, chạy hàm bên trong song song với main thread |
| `() -> {...}` | Lambda Java (như arrow function JS), shorthand cho `new Runnable() { run() {...} }` |
| `Gdx.app.postRunnable(runnable)` | Đẩy `runnable` vào queue. LibGDX sẽ chạy nó ở cuối frame hiện tại (main thread) |
| `Runnable onXong` | Callback truyền vào để báo "load xong rồi" — như callback trong JavaScript |

**Tại sao không dùng `Thread.sleep()` hay `synchronized`**: 2 cái đó để **đợi/đồng bộ thread**, không liên quan đến chuyển thread. `postRunnable()` là tool đúng cho việc "tao đang ở thread B, muốn chạy code này ở thread A".

**So với JavaScript**:

```javascript
// JS gần như tương đương
async function init(onXong) {
  const danhSach = await fetch('/music').then(r => r.json());
  
  // Mỗi async operation tự switch thread (event loop)
  for (const m of danhSach) {
    await downloadFile(m.url);
    
    // Không cần postRunnable vì JS single-thread
    const music = new Audio(localPath);
  }
  
  onXong();
}
```

JS dễ hơn vì single-thread (event loop), Java phải explicit chuyển thread.

### 14.2 Java client — Lambda + functional interface

```java
ApiService.layDanhSachNhac(danhSach -> {
    new Thread(() -> taiVaLoad(danhSach, onXong)).start();
});
```

`danhSach -> {...}` là **lambda expression**, viết tắt cho:

```java
new Consumer<List<MusicServerData>>() {
    @Override
    public void accept(List<MusicServerData> danhSach) {
        new Thread(...).start();
    }
}
```

Java chỉ chấp nhận lambda cho **functional interface** (interface có đúng 1 method abstract). `Consumer<T>` là functional interface có method `accept(T)`.

```java
@FunctionalInterface
public interface Consumer<T> {
    void accept(T t);
}
```

**Các functional interface phổ biến trong code**:

| Interface | Method | Mô tả |
|-----------|--------|-------|
| `Runnable` | `void run()` | Chạy gì đó, không trả về |
| `Consumer<T>` | `void accept(T t)` | Nhận tham số, không trả về |
| `Supplier<T>` | `T get()` | Không nhận tham số, trả về T |
| `Function<T,R>` | `R apply(T t)` | Nhận T, trả về R |

Trong `MusicManager.init(Runnable onXong)`:
- `onXong` là callback "khi load xong"
- Truyền vào lambda `() -> { System.out.println("Done"); }`

### 14.3 Java client — try-with-resources

```java
try (InputStream is = conn.getInputStream();
     OutputStream os = dest.write(false)) {
    byte[] buf = new byte[8192];
    int len;
    while ((len = is.read(buf)) > 0) {
        os.write(buf, 0, len);
    }
}
```

`try (...)` là **try-with-resources** — tự động đóng resource khi exit block. Tương đương:

```java
InputStream is = null;
OutputStream os = null;
try {
    is = conn.getInputStream();
    os = dest.write(false);
    // ...
} finally {
    if (is != null) is.close();
    if (os != null) os.close();
}
```

Resource phải implement `AutoCloseable` (interface có method `close()`).

**Tại sao quan trọng**: nếu không close stream → memory leak, file handle leak. Try-with-resources đảm bảo luôn close kể cả khi có exception.

**Read pattern**:

```java
byte[] buf = new byte[8192];   // buffer 8KB
int len;
while ((len = is.read(buf)) > 0) {
    os.write(buf, 0, len);
}
```

`is.read(buf)`:
- Đọc tối đa 8192 bytes vào `buf`
- Trả về số bytes thực đọc được, hoặc `-1` nếu hết stream
- Block thread đến khi có data hoặc EOF

`os.write(buf, 0, len)`: ghi `len` bytes từ `buf` (offset 0).

Đọc file 5MB cần ~640 iterations (5MB / 8KB). Không thể đọc 1 lần vì:
- Network truyền theo chunks
- File có thể lớn hơn RAM (không phải case này nhưng best practice)

### 14.4 Java client — Lưu ý generic và type erasure

```java
public static void layDanhSachNhac(Consumer<List<MusicServerData>> onHoanThanh)
```

Generic `<List<MusicServerData>>` chỉ tồn tại lúc compile. Lúc runtime, JVM thấy là `Consumer<Object>` — đây là **type erasure**.

Hệ quả:
- Không thể dùng `instanceof Consumer<String>` (compile error)
- Không thể `new T[]` (T bị xóa)
- Phải dùng `List<MusicServerData>` rõ ràng khi cast

Trong code này không gặp vấn đề, nhưng nếu sau muốn lưu callbacks vào collection thì cần để ý.

### 14.5 NestJS server — Decorator pattern

```typescript
@Controller('admin/music')
export class MusicController {
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @UploadedFile() file: any,
    @Body() body: ThemMusicRequestDto,
  ) {
    // ...
  }
}
```

Các `@Controller`, `@Post`, `@UseInterceptors`, `@UploadedFile`, `@Body` là **decorators** — function chạy lúc class load, gắn metadata vào class/method/parameter.

**Cách hoạt động (đơn giản hóa)**:

```typescript
function Controller(path: string) {
  return function (target: any) {
    // Gắn metadata "đây là controller với path X"
    Reflect.defineMetadata('path', path, target);
  };
}

@Controller('admin/music')   // gọi Controller('admin/music')(MusicController)
class MusicController {}
```

Lúc NestJS khởi động, nó **scan tất cả class**, đọc metadata, build router. Đây gọi là **metadata-driven framework** (giống Spring Boot Java, FastAPI Python).

**Lưu ý**: decorator order matters cho method:

```typescript
@Post('upload')
@UseInterceptors(FileInterceptor('file'))   // chạy TRƯỚC method handler
async upload(@UploadedFile() file: any) {}
```

`@UseInterceptors` chạy trước handler để parse multipart, gán file vào request.

### 14.6 NestJS server — Dependency Injection

```typescript
@Injectable()
export class MusicService {
  constructor(
    @InjectRepository(MusicEntity)
    private readonly musicRepo: Repository<MusicEntity>,
  ) {}
}

@Controller()
export class MusicController {
  constructor(private readonly musicService: MusicService) {}
}
```

**Vấn đề muốn giải quyết**: ai khởi tạo `MusicRepository`? Ai truyền vào `MusicService`? Ai khởi tạo `MusicService` cho `MusicController`?

Không có DI:
```typescript
const repo = new Repository(...);  // cần dataSource, entity metadata, ...
const service = new MusicService(repo);
const controller = new MusicController(service);
```

Chain dependency dài, hard-code. Test khó (không mock được).

**Với DI (NestJS)**:

```typescript
@Module({
  imports: [TypeOrmModule.forFeature([MusicEntity])],
  providers: [MusicService],
  controllers: [MusicController],
})
export class MusicModule {}
```

NestJS đọc cấu hình, tự động:
1. Tạo `MusicRepository` (qua TypeORM)
2. Tạo `MusicService` với repo inject
3. Tạo `MusicController` với service inject

Đây là **inversion of control**: bạn không tự new, framework new giúp.

**Lợi ích**:
- Mock dễ: test `MusicService` chỉ cần inject fake repo
- Singleton: `MusicService` chỉ có 1 instance, share giữa các controller
- Lazy: chỉ tạo khi cần

### 14.7 NestJS server — `async/await` vs Promise vs Observable

```typescript
async getAll(): Promise<GetAllMusicResponse> {
  const musics = await this.musicRepo.find();
  return { musics: musics.map(m => this.toProto(m)) };
}
```

`async function` luôn trả về Promise. `await` đợi Promise resolve.

Tương đương:
```typescript
getAll(): Promise<GetAllMusicResponse> {
  return this.musicRepo.find().then(musics => ({
    musics: musics.map(m => this.toProto(m))
  }));
}
```

**Với gRPC client trong NestJS**:

```typescript
async handleGetAllMusic() {
  return grpcCall(GameDataService.name, this.gameDataGrpcService.getAllMusic({}));
}
```

`getAllMusic({})` trả về `Observable<T>` (RxJS), không phải Promise. Phải convert:

```typescript
import { firstValueFrom } from 'rxjs';

const result = await firstValueFrom(this.grpcClient.getAllMusic({}));
```

`grpcCall` helper trong code có thể đang làm việc này dưới capot.

**Tại sao gRPC dùng Observable**: gRPC support streaming (server stream, client stream, bidi). Observable model stream tốt hơn Promise (chỉ 1 giá trị).

### 14.8 NestJS server — `@aws-sdk/client-s3` PutObjectCommand pattern

```typescript
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

this.s3 = new S3Client({ ... });

await this.s3.send(
  new PutObjectCommand({
    Bucket: 'music',
    Key: 'abc.mp3',
    Body: file.buffer,
  })
);
```

**Tại sao `new PutObjectCommand({...})` chứ không phải `s3.putObject({...})`**?

Đây là **Command pattern** của AWS SDK v3:

1. **Tạo Command object**: chỉ là plain data, mô tả "tôi muốn làm gì"
2. **`s3.send(command)`**: thực thi command — sign request, fetch, retry, parse response

**Lợi ích**:
- Tree-shaking: chỉ import command cần dùng → bundle nhỏ
- Testable: mock `s3.send()` dễ hơn mock toàn bộ class
- Middleware: có thể intercept command trước/sau

**So với cách viết old-school (v2)**:
```typescript
// AWS SDK v2 — không tree-shakeable
import * as AWS from 'aws-sdk';
const s3 = new AWS.S3();
await s3.putObject({ Bucket, Key, Body }).promise();
```

V2 import toàn bộ SDK (~10MB), v3 chỉ import command cần dùng (~100KB).

### 14.9 NestJS server — TypeORM Repository pattern

```typescript
@InjectRepository(MusicEntity)
private readonly musicRepo: Repository<MusicEntity>

// Sử dụng
const music = await this.musicRepo.findOneBy({ id: 1 });
const newMusic = this.musicRepo.create({ name: 'X' });
await this.musicRepo.save(newMusic);
await this.musicRepo.remove(music);
```

`Repository<T>` là **abstraction** cho table. Không cần viết SQL.

**Sự khác biệt giữa các method**:

| Method | Hành động | SQL tương đương |
|--------|-----------|-----------------|
| `find()` | Lấy tất cả rows | `SELECT * FROM music` |
| `findOneBy({id: 1})` | Lấy 1 row theo điều kiện | `SELECT * FROM music WHERE id = 1 LIMIT 1` |
| `create({...})` | **Chỉ tạo object trong memory**, chưa insert DB | (không) |
| `save(entity)` | Insert hoặc update vào DB | `INSERT` hoặc `UPDATE` |
| `remove(entity)` | Delete khỏi DB | `DELETE` |

**Tại sao tách `create` và `save`**:

```typescript
const music = this.musicRepo.create({ name: 'X' });
// music là instance của MusicEntity, có default value, type-safe
// CHƯA insert DB

await this.musicRepo.save(music);
// LÚC NÀY mới insert
```

`create` chỉ là factory function, không touch DB. Có thể manipulate object trước khi save.

### 14.10 NestJS server — Validation pipe và DTO

```typescript
export class ThemMusicRequestDto {
  @IsString()
  name: string;
}

@Post('upload')
async upload(@Body() body: ThemMusicRequestDto) {
  // body đã được validate, name chắc chắn là string
}
```

NestJS có `ValidationPipe` (enable global trong `main.ts`):

```typescript
app.useGlobalPipes(new ValidationPipe());
```

Khi request đến:
1. `@Body()` parse JSON body
2. ValidationPipe transform thành instance của DTO class
3. Chạy validators (`@IsString`, `@IsInt`, ...)
4. Nếu fail → trả 400 ngay, không vào controller
5. Nếu pass → inject vào tham số `body`

**Tại sao dùng class chứ không phải interface**:

```typescript
// Interface — không có metadata runtime, validator không hoạt động
interface ThemMusicRequestDto {
  name: string;
}

// Class — có metadata, validator chạy được
class ThemMusicRequestDto {
  @IsString()
  name: string;
}
```

TypeScript interfaces bị erase lúc compile. Class survive đến runtime + có thể gắn decorator. Validation cần runtime info.

### 14.11 NestJS server — Multer + FileInterceptor

```typescript
@UseInterceptors(FileInterceptor('file'))
async upload(@UploadedFile() file: any) {
  console.log(file.buffer);    // Buffer chứa bytes
  console.log(file.mimetype);  // "audio/mpeg"
  console.log(file.originalname); // "song.mp3"
}
```

**Flow nội bộ**:

1. Request đến với `Content-Type: multipart/form-data`
2. `FileInterceptor('file')` chạy multer middleware
3. Multer parse body, tách field tên `'file'` ra
4. File được lưu vào `req.file` (default: in-memory buffer)
5. `@UploadedFile()` đọc `req.file` inject vào tham số

**Phương án storage**:

```typescript
// In-memory (mặc định, code hiện tại)
FileInterceptor('file', {
  storage: memoryStorage()
})
// → file.buffer có data

// Disk
FileInterceptor('file', {
  storage: diskStorage({ destination: '/tmp/uploads' })
})
// → file.path là đường dẫn file, file.buffer = undefined
```

Code hiện tại dùng memory vì tính hash ngay và upload Supabase ngay, không cần lưu disk.

### 14.12 Cloudflare Worker — `caches.default` và `ctx.waitUntil`

```javascript
const cache = caches.default;
let response = await cache.match(cacheKey);

if (!response) {
  response = await fetch(supabaseUrl, {...});
  ctx.waitUntil(cache.put(cacheKey, response.clone()));
}
```

**`caches.default`**: cache instance global, share với fetch cache của Cloudflare. Hoạt động như `Map<Request, Response>` nhưng lưu ở edge data center.

**`cache.match(key)`**: tìm response theo Request key. Trả `Response` hoặc `undefined`.

**`cache.put(key, response)`**: lưu response vào cache. Trả Promise.

**`ctx.waitUntil(promise)`**: nói với Worker runtime "đợi promise này xong rồi mới shutdown, nhưng đừng block response".

**Tại sao cần `waitUntil`**:

```javascript
// SAI — block response để chờ cache write
await cache.put(cacheKey, response.clone());
return response;

// ĐÚNG — return response ngay, cache write trong background
ctx.waitUntil(cache.put(cacheKey, response.clone()));
return response;
```

Worker có lifecycle hữu hạn (vài giây sau response). Không có `waitUntil`, cache write có thể bị cancel.

**Tại sao `response.clone()`**: Response body là stream chỉ đọc 1 lần. Clone tạo bản copy để vừa trả về user vừa lưu cache.

### 14.13 Cloudflare Worker — `cf` object trong fetch

```javascript
response = await fetch(supabaseUrl, {
  cf: {
    cacheTtl: 2592000,
    cacheEverything: true,
  },
});
```

Object `cf` là **Cloudflare-specific extension** của fetch API. Browser fetch không có `cf`.

**Các option phổ biến**:

| Option | Mô tả |
|--------|-------|
| `cacheTtl: number` | TTL cache (giây) |
| `cacheEverything: true` | Override default rules, cache tất cả (kể cả URL có query string) |
| `cacheKey: string` | Custom cache key (Enterprise plan only) |
| `cacheTtlByStatus: {...}` | TTL khác nhau theo status code |
| `polish: 'lossy'` | Auto compress image (Pro+ plan) |
| `minify: { js: true }` | Minify response (Pro+ plan) |

**Khác với Cache API (`caches.default`)**:

| Đặc điểm | `caches.default` | `fetch({cf: {...}})` |
|---------|------------------|---------------------|
| Cache scope | Per Worker | Cloudflare global cache |
| Tiered cache | Không | Có |
| Control | Programmatic | Declarative |

Code hiện tại dùng cả 2: `cf` để fetch + auto cache, `caches.default` để Worker control thêm.

### 14.14 Cloudflare Worker — Module Worker vs Service Worker syntax

**Module Worker** (mới, đang dùng):

```javascript
export default {
  async fetch(request, env, ctx) {
    return new Response('Hello');
  },
};
```

**Service Worker** (cũ, deprecated):

```javascript
addEventListener('fetch', event => {
  event.respondWith(new Response('Hello'));
});
```

Module Worker:
- ES modules, có `import`/`export`
- `env` chứa environment variables, bindings
- `ctx` cho `waitUntil`, `passThroughOnException`
- Type-safe hơn với TypeScript

Tất cả code mới nên dùng Module Worker.

### 14.15 Java client — `static` field và lifecycle

```java
public class MusicManager {
    public static final Map<Integer, Music> nhacNen = new HashMap<>();
    private static final List<MusicServerData> danhSachNhac = new ArrayList<>();
    private static boolean daLoad = false;
}
```

Tất cả `static` → **shared toàn app**, không cần instance.

**Lifecycle**:
- Khởi tạo lần đầu khi class được load (lần đầu reference)
- Tồn tại đến khi app exit
- Không bị GC kể cả khi không có reference

**Trade-off của static**:

| Pro | Con |
|-----|-----|
| Truy cập từ bất kỳ đâu: `MusicManager.play(1)` | Hard to test (mock khó) |
| Không cần khởi tạo | Không thể có 2 instance độc lập |
| Memory hiệu quả (1 lần) | Coupling cao |

Trong game LibGDX, static manager pattern phổ biến vì game thường có 1 instance duy nhất. Trong web app server thì nên tránh (cần multi-tenancy, test isolation).

### 14.16 Java client — Concurrent collections

```java
public static final Map<Integer, Music> nhacNen = new HashMap<>();
```

`HashMap` **không thread-safe**. Nếu 2 thread cùng `put()` → có thể corrupt internal state.

Trong code hiện tại OK vì:
- Background thread chỉ download
- Main thread (qua `postRunnable`) mới `put` vào map
- → Chỉ main thread modify map

Nhưng nếu sau này có nhiều thread modify → cần đổi sang:

```java
import java.util.concurrent.ConcurrentHashMap;
public static final Map<Integer, Music> nhacNen = new ConcurrentHashMap<>();
```

`ConcurrentHashMap`:
- Thread-safe
- Performance tốt hơn `Collections.synchronizedMap()`
- Hỗ trợ atomic operations: `putIfAbsent`, `compute`, `merge`

Nói chung: nhiều thread → đừng dùng `HashMap`/`ArrayList` thô.

### 14.17 NestJS server — Process.env và validation

```typescript
endpoint: process.env.SUPABASE_S3_ENDPOINT!,
```

`process.env.X` là string hoặc `undefined`. TypeScript không biết — nó coi như `string | undefined`.

`!` là **non-null assertion**: "tao biết chắc nó không null, mặc kệ TS".

**Rủi ro**: nếu env thiếu, code crash ở runtime:
```
TypeError: Cannot read property 'X' of undefined
```

**Best practice**: validate env lúc khởi động:

```typescript
import { z } from 'zod';

const envSchema = z.object({
  SUPABASE_S3_ENDPOINT: z.string().url(),
  SUPABASE_S3_ACCESS_KEY: z.string().min(1),
  SUPABASE_S3_SECRET_KEY: z.string().min(1),
});

const env = envSchema.parse(process.env);
// Nếu thiếu → throw lỗi rõ ràng ngay khi app start
```

Hoặc dùng `@nestjs/config` với schema validation. Trong code hiện tại không có để giữ đơn giản — nhưng production tốt nhất nên có.

### 14.18 Tổng kết: pattern phổ biến

| Pattern | Ngữ cảnh | Lý do |
|---------|----------|-------|
| Lambda | Callbacks (Java) | Code ngắn, type-safe |
| Try-with-resources | I/O (Java) | Auto-close, tránh leak |
| `postRunnable` | Cross-thread (LibGDX) | OpenGL constraints |
| `async/await` | Async (TS) | Đơn giản hơn callback hell |
| Decorator | Framework (NestJS) | Metadata-driven |
| DI | Service composition | Test, loose coupling |
| Command pattern | AWS SDK v3 | Tree-shakeable |
| Repository | TypeORM | Abstract SQL |
| `waitUntil` | Worker async | Non-blocking cache write |
| `cf` object | Worker fetch | Cloudflare-specific behavior |

Mỗi pattern giải quyết 1 vấn đề cụ thể. Đừng học pattern vì pattern — hiểu vấn đề trước, pattern sau.

## 15. Tổng kết

### Đạt được gì

- Admin thêm/sửa/xóa nhạc không cần update client
- Cost: $0/tháng
- Scale: lên tới ~30k user trên free tier
- Performance: < 100ms tải nhạc cho user VN
- Reliability: ~99.5% uptime tổng hợp

### Trade-off đã chấp nhận

- Setup phức tạp hơn (1 file vs cả pipeline)
- Phụ thuộc 3 external service (Supabase, Cloudflare, ...)
- Cần biết DevOps cơ bản (env, DNS, CDN)

### Khi nào không nên dùng kiến trúc này

- Single-player offline game → cứ nhúng mp3 vào APK
- Prototype < 10 user → host VPS đơn giản hơn
- Game cần realtime stream nhạc → cần solution khác (WebRTC?)

### Bài học chung

> **Đừng optimize cho future bạn không chắc xảy ra. Build đơn giản nhất có thể work, monitor, scale khi cần.**

Tech này không phải là vũ khí khoe khoang. Nó là tool giải quyết bài toán. Trong case này: bài toán đơn giản (cho admin sửa nhạc), tool đơn giản (free tier 3 services), kết quả đủ tốt.

Triết lý: **80% giá trị với 20% effort**. 20% effort còn lại để fix bug, polish UX, làm game thật sự hay.