# NestJS Request Lifecycle

> Hướng dẫn đầy đủ về vòng đời request — khi nào dùng tầng nào, tại sao, ưu nhược điểm, và ví dụ thực tế.

---

## Mục lục

- [1. Tổng quan](#1-tổng-quan)
  - [1.1 Sơ đồ pipeline](#11-sơ-đồ-pipeline)
  - [1.2 Bảng tóm tắt nhanh](#12-bảng-tóm-tắt-nhanh)
- [2. Middleware](#2-middleware)
  - [2.1 Cơ chế hoạt động](#21-cơ-chế-hoạt-động)
  - [2.2 Khi nào NÊN dùng](#22-khi-nào-nên-dùng)
  - [2.3 Khi nào KHÔNG nên dùng](#23-khi-nào-không-nên-dùng)
  - [2.4 Ưu và nhược điểm](#24-ưu-và-nhược-điểm)
  - [2.5 Ví dụ code](#25-ví-dụ-code)
- [3. Guards](#3-guards)
  - [3.1 Cơ chế hoạt động](#31-cơ-chế-hoạt-động)
  - [3.2 Khi nào NÊN dùng](#32-khi-nào-nên-dùng)
  - [3.3 Khi nào KHÔNG nên dùng](#33-khi-nào-không-nên-dùng)
  - [3.4 Ưu và nhược điểm](#34-ưu-và-nhược-điểm)
  - [3.5 Ví dụ code](#35-ví-dụ-code)
- [4. Interceptors](#4-interceptors)
  - [4.1 Cơ chế hoạt động](#41-cơ-chế-hoạt-động)
  - [4.2 Khi nào NÊN dùng](#42-khi-nào-nên-dùng)
  - [4.3 Khi nào KHÔNG nên dùng](#43-khi-nào-không-nên-dùng)
  - [4.4 Ưu và nhược điểm](#44-ưu-và-nhược-điểm)
  - [4.5 Ví dụ code](#45-ví-dụ-code)
- [5. Pipes](#5-pipes)
  - [5.1 Cơ chế hoạt động](#51-cơ-chế-hoạt-động)
  - [5.2 Khi nào NÊN dùng](#52-khi-nào-nên-dùng)
  - [5.3 Khi nào KHÔNG nên dùng](#53-khi-nào-không-nên-dùng)
  - [5.4 Ưu và nhược điểm](#54-ưu-và-nhược-điểm)
  - [5.5 Ví dụ code](#55-ví-dụ-code)
- [6. Exception Filters](#6-exception-filters)
  - [6.1 Cơ chế hoạt động](#61-cơ-chế-hoạt-động)
  - [6.2 Khi nào NÊN dùng](#62-khi-nào-nên-dùng)
  - [6.3 Khi nào KHÔNG nên dùng](#63-khi-nào-không-nên-dùng)
  - [6.4 Ưu và nhược điểm](#64-ưu-và-nhược-điểm)
  - [6.5 Ví dụ code](#65-ví-dụ-code)
- [7. Hướng dẫn quyết định nhanh](#7-hướng-dẫn-quyết-định-nhanh)
- [8. Phối hợp các tầng trong thực tế](#8-phối-hợp-các-tầng-trong-thực-tế)
  - [8.1 Setup global đầy đủ](#81-setup-global-đầy-đủ)
  - [8.2 Lỗi thường gặp](#82-lỗi-thường-gặp)

---

## 1. Tổng quan

Khi một HTTP request đến NestJS, nó đi qua một pipeline gồm nhiều tầng xử lý trước khi controller method được gọi và trả về response. Hiểu rõ thứ tự và trách nhiệm của từng tầng là chìa khoá để thiết kế ứng dụng dễ bảo trì, đúng kiến trúc, và không để logic lạc chỗ.

### 1.1 Sơ đồ pipeline

```
Incoming Request
      │
  ┌───▼────────────────────────────────────────────────┐
  │  MIDDLEWARE  (global → module-bound)               │
  └───┬────────────────────────────────────────────────┘
      │
  ┌───▼────────────────────────────────────────────────┐
  │  GUARDS  (global → controller → route)             │──→ 401/403 nếu fail
  └───┬────────────────────────────────────────────────┘
      │
  ┌───▼────────────────────────────────────────────────┐
  │  INTERCEPTORS  pre-controller                      │
  │  (global → controller → route)                     │
  └───┬────────────────────────────────────────────────┘
      │
  ┌───▼────────────────────────────────────────────────┐
  │  PIPES  (global → controller → route → param)      │──→ 400 nếu fail
  └───┬────────────────────────────────────────────────┘
      │
  ┌───▼────────────────────────────────────────────────┐
  │  CONTROLLER method handler                         │
  │  └──→ SERVICE (nếu có)                             │
  └───┬────────────────────────────────────────────────┘
      │
  ┌───▼────────────────────────────────────────────────┐
  │  INTERCEPTORS  post-request  (FILO)                │
  │  (route → controller → global)                     │
  └───┬────────────────────────────────────────────────┘
      │
  ┌───▼────────────────────────────────────────────────┐
  │  EXCEPTION FILTERS  (route → controller → global)  │← chỉ khi có lỗi
  └───┬────────────────────────────────────────────────┘
      │
Server Response
```

### 1.2 Bảng tóm tắt nhanh

| Tầng | Mục đích chính | Thứ tự vào | Dùng khi |
|---|---|---|---|
| Middleware | Pre-process HTTP thô | Global → Module | Log, CORS, helmet, body parse |
| Guard | Quyết định req có đi tiếp không | Global → Controller → Route | Auth, phân quyền, ban, rate-limit |
| Interceptor (pre) | Bổ sung context trước controller | Global → Controller → Route | Request ID, timing start, transform req |
| Pipe | Validate & transform tham số | Global → Controller → Route → Param (last→first) | DTO validation, ParseInt, sanitize |
| Controller / Service | Xử lý nghiệp vụ | — | Logic chính của app |
| Interceptor (post) | Transform response, logging sau | Route → Controller → Global (FILO) | Serialize res, cache store, audit log |
| Exception Filter | Bắt và format lỗi | Route → Controller → Global (đảo ngược) | Chuẩn hoá error, log lỗi, Sentry |

---

## 2. Middleware

### 2.1 Cơ chế hoạt động

Middleware trong NestJS tương đương Express middleware — nhận vào `(req, res, next)` và có thể đọc/sửa request, kết thúc response sớm, hoặc gọi `next()` để chuyển tiếp. **Middleware không có access vào Nest execution context** — không biết route nào, handler nào sẽ xử lý request, không đọc được decorator metadata.

**Thứ tự thực thi:**

1. **Global middleware** — đăng ký bằng `app.use()` trong `main.ts`, chạy trước tất cả
2. **Module-bound middleware** — đăng ký trong `configure()` của module, chạy theo thứ tự module được `import`
3. Trong cùng module, chạy theo thứ tự `consumer.apply()` được gọi

### 2.2 Khi nào NÊN dùng

- **HTTP request logging** (method, path, status code, duration, IP) — đây là use-case điển hình nhất vì middleware chạy đầu tiên, capture được cả request bị guard chặn sớm
- **CORS headers** — `app.enableCors()` thực chất là middleware
- **Security headers** — `helmet()` là middleware
- **Body parsing** — `json()`, `urlencoded()`, `multipart`
- **Compression** — `compression()` middleware
- **Rate limiting cơ bản theo IP** — chạy trước khi bất kỳ guard nào khởi động
- **Request ID injection** — gán UUID vào `req` để trace request xuyên suốt hệ thống
- **Session / cookie parsing**

> **Tại sao log request ở Middleware chứ không phải Interceptor?**
> Nếu đặt log ở Interceptor, những request bị **Guard chặn** sẽ không được log vì Interceptor chạy sau Guard. Middleware chạy đầu tiên nên capture được 100% request kể cả 401, 403, và các lỗi sớm. Ngoài ra, middleware nhận `req`/`res` raw — có thể đọc headers gốc trước khi bất kỳ tầng nào transform.

### 2.3 Khi nào KHÔNG nên dùng

- **Xác thực token / phân quyền** — middleware không đọc được `@Roles()`, `@Public()` hay bất kỳ decorator metadata nào. Dùng Guard thay thế.
- **Validate request body (DTO)** — dùng Pipe. Middleware phải tự parse body và không tích hợp được class-validator.
- **Transform response** — middleware không có access vào response body sau khi controller trả về. Dùng Interceptor.
- **Bắt exception và format lỗi** — dùng Exception Filter. Middleware không bắt được exception từ controller/service.
- **Logic phụ thuộc vào route metadata** — bất kỳ gì cần `@SetMetadata()` hay `Reflector` đều không dùng được ở Middleware.

### 2.4 Ưu và nhược điểm

**Ưu điểm:**
- Chạy sớm nhất — trước guard, interceptor, pipe
- Tương thích với toàn bộ ecosystem Express middleware (passport, helmet, cors...)
- Có thể kết thúc response ngay (`res.end()`) không cần vào pipeline
- Functional middleware (không `@Injectable`) không có overhead DI, nhanh hơn
- Dễ áp dụng cho path pattern cụ thể qua `forRoutes()`

**Nhược điểm:**
- Không có `ExecutionContext` — không biết handler nào sẽ chạy
- Không đọc được decorator metadata (`@Roles`, `@Public`...)
- Functional middleware không inject được service NestJS
- Không thể transform response (chỉ transform request)
- Khó test hơn Guard/Interceptor do thiếu Nest context

### 2.5 Ví dụ code

```typescript
// logger.middleware.ts
@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  constructor(private readonly logger: LoggerService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const { method, originalUrl, ip } = req;
    const userAgent = req.get('user-agent') ?? '';
    const start = Date.now();

    // Lắng nghe sự kiện finish của response để có status code
    res.on('finish', () => {
      const ms = Date.now() - start;
      const { statusCode } = res;
      this.logger.log(
        `${method} ${originalUrl} ${statusCode} — ${ms}ms — ${ip} — ${userAgent}`,
      );
    });

    next();
  }
}

// app.module.ts
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(LoggerMiddleware)
      .forRoutes('*'); // áp dụng mọi route
  }
}
```

```typescript
// Functional middleware (không cần DI) — dùng khi logic đơn giản
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  req['requestId'] = randomUUID();
  res.setHeader('X-Request-Id', req['requestId']);
  next();
}

// main.ts
app.use(helmet());
app.use(compression());
app.use(requestIdMiddleware);
```

---

## 3. Guards

### 3.1 Cơ chế hoạt động

Guard implement interface `CanActivate`, trả về `boolean` hoặc `Observable<boolean>`. Nếu trả về `false` hoặc throw exception, request bị chặn và NestJS tự động trả về **403 Forbidden** (hoặc exception bạn throw). Guard có quyền truy cập vào `ExecutionContext` — từ đó lấy được handler, class, và quan trọng là **đọc metadata từ decorator** thông qua `Reflector`.

**Thứ tự thực thi:**

1. Global guards — `app.useGlobalGuards()`
2. Controller guards — `@UseGuards()` trên class
3. Route guards — `@UseGuards()` trên method (chạy sau cùng)

Tất cả guards phải pass thì request mới được phép đi tiếp.

### 3.2 Khi nào NÊN dùng

- **Xác thực JWT / OAuth token** — kiểm tra token hợp lệ, chưa hết hạn, chữ ký đúng
- **Role-based access control (RBAC)** — `@Roles('admin')` kết hợp `RolesGuard` dùng `Reflector`
- **Temporary ban / blacklist** — kiểm tra user bị ban tạm thời trước khi vào bất kỳ logic nào
- **API key validation** — kiểm tra `x-api-key` header
- **Subscription / plan check** — user có plan phù hợp để dùng endpoint này không
- **IP whitelist / blacklist** — chặn theo IP trước khi tốn tài nguyên xử lý
- **Feature flag** — endpoint chỉ mở với nhóm người dùng nhất định
- **Ownership check** — user có quyền truy cập resource của chính mình không

> **Tại sao temporary ban nên đặt ở Guard chứ không phải Service?**
> Guard là điểm dừng sớm nhất sau khi request đã được parse. Nếu đặt logic ban trong Service, thì Interceptor và Pipe vẫn chạy trước đó — tốn tài nguyên không cần thiết. Guard trả về `false` ngay lập tức, request dừng lại, không có gì phía sau được thực thi. Hơn nữa, Guard có thể inject `UsersService` để query database, và có `ExecutionContext` để đọc metadata nếu cần bỏ qua check cho một số route.

### 3.3 Khi nào KHÔNG nên dùng

- **Validate dữ liệu request body** — dùng Pipe. Guard không phải chỗ validate DTO.
- **Transform response** — dùng Interceptor.
- **Logging** — dùng Middleware (trước guard) hoặc Interceptor (sau guard).
- **Logic nghiệp vụ không liên quan phân quyền** — đưa vào Service.
- **Rate limiting phức tạp cần sliding window** — cân nhắc Interceptor hoặc middleware chuyên dụng như `nestjs/throttler`.

### 3.4 Ưu và nhược điểm

**Ưu điểm:**
- Có `ExecutionContext` — đọc được handler, class, request object
- Dùng `Reflector` để đọc `@SetMetadata()` — rất tiện cho RBAC và `@Public()`
- Inject được bất kỳ service NestJS nào (DbService, CacheService, RedisService...)
- Fail fast — chặn request trước Interceptor và Pipe, tiết kiệm tài nguyên
- Cú pháp rõ ràng: `return false` = 403, `throw` = custom exception

**Nhược điểm:**
- Chỉ trả về `true`/`false` — không transform được request hay response
- Không có access vào response object
- Nếu throw exception custom, cần Exception Filter để format đúng
- Multiple guards chạy tuần tự — tất cả phải pass, không thể short-circuit giữa chừng theo điều kiện phức tạp

### 3.5 Ví dụ code

```typescript
// jwt-auth.guard.ts — bỏ qua route @Public()
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context);
  }
}

// public.decorator.ts
export const Public = () => SetMetadata('isPublic', true);

// roles.guard.ts — RBAC
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles) return true;

    const { user } = context.switchToHttp().getRequest();
    return requiredRoles.some(role => user.roles?.includes(role));
  }
}
```

```typescript
// ban.guard.ts — temporary ban (đặt SAU JwtAuthGuard để có req.user)
@Injectable()
export class BanGuard implements CanActivate {
  constructor(private usersService: UsersService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const userId = req.user?.id;
    if (!userId) return true; // chưa auth — để JwtGuard xử lý

    const user = await this.usersService.findById(userId);

    if (user.bannedUntil && user.bannedUntil > new Date()) {
      throw new ForbiddenException(
        `Tài khoản bị khoá đến ${user.bannedUntil.toISOString()}. Lý do: ${user.banReason}`,
      );
    }
    return true;
  }
}

// Áp dụng global — thứ tự quan trọng: Jwt trước, Ban sau (cần req.user)
app.useGlobalGuards(
  new JwtAuthGuard(reflector),
  new BanGuard(usersService),
);
```

---

## 4. Interceptors

### 4.1 Cơ chế hoạt động

Interceptor implement `NestInterceptor`, nhận `ExecutionContext` và `CallHandler`. Gọi `next.handle()` trả về `Observable` bao bọc kết quả của controller method. Nhờ đó Interceptor có thể:

- Chạy logic **trước** khi controller thực thi (pre)
- Chạy logic **sau** khi controller trả kết quả (post) — thông qua `pipe()` trên Observable
- Bắt exception bằng `catchError()`
- Short-circuit — trả về response từ cache mà không gọi controller (`of(cachedValue)`)

**Thứ tự chiều vào (pre):** Global → Controller → Route

**Thứ tự chiều ra (post) là FILO:** Route → Controller → Global (ngược lại)

Lý do FILO: Interceptors bao bọc nhau như nested functions. Interceptor đăng ký sau cùng (route level) là lớp trong cùng, nên nó "unwrap" trước tiên khi response đi ra.

### 4.2 Khi nào NÊN dùng

- **Response transformation** — bọc response vào `{ data, statusCode, timestamp }` thống nhất
- **Timing / performance logging** — đo thời gian xử lý từ sau guard đến khi controller trả về
- **Caching** — trả về cached response, bypass controller hoàn toàn
- **Thêm response header** — `X-Response-Time`, `X-Request-Id`...
- **Serialize / exclude fields** — loại bỏ field nhạy cảm (password, secret) trước khi trả về
- **Retry logic** — tự động retry khi gọi external service thất bại
- **Audit log** — log sau khi action thành công (không log khi action fail)
- **Timeout** — tự động cancel request sau N giây bằng `timeout()` operator

> **Tại sao timing log đặt ở Interceptor chứ không phải Middleware?**
> Middleware đo thời gian từ khi nhận request đến khi response kết thúc (bao gồm cả serialization). Interceptor đo thời gian xử lý của controller thuần tuý — không tính guard, pipe, response serialization. Tuỳ mục đích: cần đo toàn bộ HTTP roundtrip → Middleware; cần đo business logic trong controller → Interceptor.

### 4.3 Khi nào KHÔNG nên dùng

- **Quyết định request có được phép không** — đó là Guard. Nếu chặn ở Interceptor, Pipe đã chạy rồi, lãng phí.
- **Validate / transform tham số đầu vào route** — đó là Pipe
- **Log HTTP thô (status, method, IP)** — dùng Middleware để capture cả request bị chặn bởi Guard
- **Format error response phức tạp** — dùng Exception Filter. Interceptor có thể bắt lỗi nhưng Exception Filter là nơi đúng cho việc này.

### 4.4 Ưu và nhược điểm

**Ưu điểm:**
- Duy nhất có thể transform **cả request lẫn response** trong cùng một class
- Bắt exception bằng `catchError()` — có thể xử lý trước khi Exception Filter nhận
- Short-circuit controller — trả từ cache mà controller không hay biết
- RxJS operators cực mạnh: `tap`, `map`, `catchError`, `timeout`, `retry`, `switchMap`
- Có `ExecutionContext` — đọc được metadata decorator như Guard

**Nhược điểm:**
- Cú pháp RxJS (Observable) có learning curve, dễ gây confusion với async/await
- Thứ tự FILO ở post-phase dễ nhầm khi debug với nhiều interceptor
- Không nên dùng để chặn request (sẽ vẫn chạy hết Pipe trước)
- Xử lý lỗi phức tạp hơn Exception Filter chuyên dụng

### 4.5 Ví dụ code

```typescript
// transform.interceptor.ts — bọc response vào format thống nhất
@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponse<T>> {
    const now = Date.now();
    const req = context.switchToHttp().getRequest();

    return next.handle().pipe(
      map(data => ({
        success: true,
        data,
        statusCode: context.switchToHttp().getResponse().statusCode,
        timestamp: new Date().toISOString(),
        path: req.url,
        duration: `${Date.now() - now}ms`,
      })),
    );
  }
}
```

```typescript
// cache.interceptor.ts — bypass controller nếu cache hit
@Injectable()
export class HttpCacheInterceptor implements NestInterceptor {
  constructor(private cacheService: CacheService) {}

  async intercept(ctx: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const req = ctx.switchToHttp().getRequest();

    // Chỉ cache GET request
    if (req.method !== 'GET') return next.handle();

    const cacheKey = req.url;
    const cached = await this.cacheService.get(cacheKey);

    if (cached) {
      return of(cached); // short-circuit — controller không chạy
    }

    return next.handle().pipe(
      tap(response => this.cacheService.set(cacheKey, response, 60)),
    );
  }
}
```

```typescript
// timeout.interceptor.ts — tự cancel request sau 5 giây
@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      timeout(5000),
      catchError(err => {
        if (err instanceof TimeoutError) {
          throw new RequestTimeoutException('Request xử lý quá 5 giây');
        }
        throw err;
      }),
    );
  }
}
```

---

## 5. Pipes

### 5.1 Cơ chế hoạt động

Pipe nhận giá trị của một argument (`@Body()`, `@Param()`, `@Query()`...) và trả về giá trị đã được transform, hoặc throw `BadRequestException` nếu validation fail. Pipe **chỉ xử lý tham số của route handler**, không có access vào toàn bộ request như Middleware hay Interceptor.

**Thứ tự thực thi có điểm đặc biệt ở cấp tham số:**

```
Global pipes → Controller pipes → Route pipes → Route parameter pipes (last param → first param)
```

Ví dụ với 3 tham số `@Body()`, `@Param()`, `@Query()`:
- Route pipes chạy trước: validate `query` → `params` → `body` (last to first)
- Pipe cụ thể trên từng param chạy sau

### 5.2 Khi nào NÊN dùng

- **Validate DTO** với `class-validator` — `@Body() dto: CreateUserDto` kết hợp `ValidationPipe` global
- **Parse kiểu dữ liệu** — `ParseIntPipe`, `ParseUUIDPipe`, `ParseBoolPipe`, `ParseArrayPipe`
- **Sanitize input** — trim whitespace, loại bỏ HTML tags nguy hiểm, normalize email
- **Transform shape** — chuyển đổi cấu trúc dữ liệu trước khi vào controller
- **Custom validation phức tạp** — validate định dạng ngày tháng, số điện thoại, mã bưu điện

> **Tại sao validate UUID ở Pipe chứ không phải Service?**
> Nếu `id` không phải UUID hợp lệ, query database sẽ throw database error không rõ ràng, hoặc return `null` rồi service phải check. Với `ParseUUIDPipe`, NestJS tự trả 400 Bad Request với message cụ thể trước khi service chạy — code service sạch hơn, không cần defensive check.

### 5.3 Khi nào KHÔNG nên dùng

- **Quyết định access control** — đó là Guard
- **Transform response** — đó là Interceptor
- **Logic nghiệp vụ cần nhiều service** — đưa vào Service
- **Validate dữ liệu từ database** (cross-field validation với data ngoài request) — kiểm tra trong Service, ví dụ "email đã tồn tại" thì query DB trong service, không dùng pipe

### 5.4 Ưu và nhược điểm

**Ưu điểm:**
- Tách biệt validation ra khỏi service — service nhận dữ liệu đã sạch và đúng kiểu
- Tự động trả `400 Bad Request` với message cụ thể, không cần code thêm
- `class-validator` + `class-transformer` rất mạnh, ít boilerplate
- Reusable — một Pipe dùng lại ở nhiều route, controller
- Built-in pipes phong phú: `ParseInt`, `ParseUUID`, `ParseBool`, `ParseArray`, `ParseEnum`, `DefaultValue`, `ValidationPipe`

**Nhược điểm:**
- Không biết toàn bộ request context — chỉ thấy giá trị của một tham số
- Không phù hợp cho validation cross-field phức tạp cần nhiều nguồn dữ liệu
- Thứ tự last-to-first ở param level dễ gây nhầm khi có nhiều pipe phức tạp
- Global `ValidationPipe` cần cấu hình `whitelist: true` để tránh mass assignment vulnerability

### 5.5 Ví dụ code

```typescript
// main.ts — Global ValidationPipe chuẩn nhất
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,               // strip fields không có trong DTO
    forbidNonWhitelisted: true,    // throw 400 nếu client gửi field lạ
    transform: true,               // auto transform sang DTO instance
    transformOptions: {
      enableImplicitConversion: true, // '1' → 1, 'true' → true
    },
  }),
);
```

```typescript
// create-user.dto.ts
export class CreateUserDto {
  @IsEmail()
  @Transform(({ value }) => value.toLowerCase().trim())
  email: string;

  @IsString()
  @MinLength(8)
  @MaxLength(32)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'Mật khẩu cần có chữ hoa, chữ thường và số',
  })
  password: string;

  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole = UserRole.USER;

  @IsDateString()
  @IsOptional()
  dateOfBirth?: string;
}
```

```typescript
// Controller dùng ParseUUIDPipe trên param
@Controller('users')
export class UsersController {
  // ParseUUIDPipe validate :id trước khi service chạy
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findOne(id);
  }

  // Custom pipe kết hợp
  @Get()
  findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.usersService.findAll({ page, limit });
  }

  @Post()
  create(@Body() dto: CreateUserDto) {
    // ValidationPipe global tự validate DTO, service nhận dữ liệu sạch
    return this.usersService.create(dto);
  }
}
```

---

## 6. Exception Filters

### 6.1 Cơ chế hoạt động

Exception Filters là tầng **duy nhất không tuân theo thứ tự global-first**. Thứ tự thực thi từ thấp lên cao: **route filter → controller filter → global filter**. Filter gần với nơi xảy ra lỗi nhất được xử lý trước.

> ⚠️ **Exception không thể truyền từ filter này sang filter khác.** Nếu route-level filter đã bắt exception, controller và global filter sẽ không nhận được exception đó. Để tái sử dụng logic giữa các filter, dùng class inheritance.

Filter chỉ được kích hoạt khi có **uncaught exception**. Exception đã được bắt bằng `try/catch` trong service hoặc controller sẽ **không trigger filter**. Khi exception xảy ra, toàn bộ phần còn lại của lifecycle bị bỏ qua và request chuyển thẳng đến filter.

### 6.2 Khi nào NÊN dùng

- **Chuẩn hoá error response format** toàn ứng dụng — mọi lỗi trả về cùng một schema
- **Log lỗi vào hệ thống** — Sentry, Datadog, file log. Đây là nơi có exception object đầy đủ nhất.
- **Map database error sang HTTP exception** — `PrismaClientKnownRequestError` → `409 Conflict`; TypeORM `QueryFailedError` → `400 Bad Request`
- **Xử lý lỗi đặc thù của một domain** — payment error, shipping error, third-party API error
- **Ẩn stack trace trong production** — trả error message thân thiện, không expose internal details
- **Internationalization lỗi** — trả message lỗi theo ngôn ngữ của user

### 6.3 Khi nào KHÔNG nên dùng

- **Validate dữ liệu** — dùng Pipe (trả 400 tự động)
- **Quyết định access** — dùng Guard (trả 403 tự động)
- **Bắt lỗi bạn đã xử lý trong service** — Exception Filter sẽ không thấy exception đã bị catch
- **Logic nghiệp vụ** — filter chỉ dùng để format và log lỗi, không chứa business logic

### 6.4 Ưu và nhược điểm

**Ưu điểm:**
- Bắt được mọi uncaught exception trong toàn bộ pipeline (bao gồm cả exception từ Guard, Pipe)
- Có `ArgumentsHost` — đọc được request, response, route handler
- Có thể inject service (LoggerService, SentryService, SlackNotifyService...)
- Thứ tự route → global cho phép override error format cho từng endpoint cụ thể

**Nhược điểm:**
- Thứ tự **ngược** với các tầng khác — dễ nhầm lẫn khi setup nhiều filter
- Exception không truyền được giữa các filter
- Chỉ chạy khi có lỗi — không dùng cho happy path
- `try/catch` trong code sẽ "nuốt" exception trước khi filter nhận được

### 6.5 Ví dụ code

```typescript
// http-exception.filter.ts — base filter
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: LoggerService) {}

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    const errorBody = {
      success: false,
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: req.url,
      method: req.method,
      message:
        typeof exceptionResponse === 'string'
          ? exceptionResponse
          : (exceptionResponse as any).message,
      // Chỉ expose error detail trong development
      ...(process.env.NODE_ENV !== 'production' && {
        stack: exception.stack,
      }),
    };

    this.logger.warn(
      `${req.method} ${req.url} ${status} — ${JSON.stringify(errorBody.message)}`,
    );

    res.status(status).json(errorBody);
  }
}
```

```typescript
// all-exceptions.filter.ts — catch-all, map database error
@Catch()
export class AllExceptionsFilter extends HttpExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    // HttpException — dùng logic base
    if (exception instanceof HttpException) {
      return super.catch(exception, host);
    }

    // Prisma unique constraint violation → 409 Conflict
    if (exception instanceof PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        const field = (exception.meta?.target as string[])?.join(', ');
        return super.catch(
          new ConflictException(`${field} đã tồn tại trong hệ thống`),
          host,
        );
      }
      if (exception.code === 'P2025') {
        return super.catch(new NotFoundException('Không tìm thấy bản ghi'), host);
      }
    }

    // Lỗi không xác định — log full stack, trả 500 chung chung
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    this.logger.error(
      `Unhandled exception: ${req.method} ${req.url}`,
      exception instanceof Error ? exception.stack : String(exception),
    );

    return super.catch(new InternalServerErrorException('Lỗi hệ thống, vui lòng thử lại sau'), host);
  }
}
```

```typescript
// Áp dụng theo cấp độ
// 1. Route level — override format lỗi cho endpoint cụ thể
@UseFilters(CustomPaymentExceptionFilter)
@Post('payments')
processPayment(@Body() dto: PaymentDto) { ... }

// 2. Controller level
@UseFilters(HttpExceptionFilter)
@Controller('cats')
export class CatsController { ... }

// 3. Global level trong main.ts — áp dụng toàn app
app.useGlobalFilters(new AllExceptionsFilter(logger));
```

---

## 7. Hướng dẫn quyết định nhanh

Khi gặp một yêu cầu mới, dùng bảng này để quyết định đặt logic ở đâu:

| Tình huống | Nên dùng | Lý do |
|---|---|---|
| Log HTTP request (method, path, IP, status) | **Middleware** | Chạy đầu tiên, capture cả req bị Guard chặn |
| Đo thời gian toàn bộ HTTP roundtrip | **Middleware** | Bắt đầu trước mọi thứ, kết thúc sau `res.finish` |
| Đo thời gian xử lý của controller | **Interceptor** | Bao bọc đúng controller execution |
| Xác thực JWT / OAuth token | **Guard** | Có `Reflector`, trả 401 sớm trước Pipe |
| Kiểm tra user bị temporary ban | **Guard** | Quyết định req có đi tiếp không — fail fast |
| Phân quyền RBAC theo role | **Guard** | Đọc `@Roles()` metadata qua `Reflector` |
| Validate request body (DTO) | **Pipe (ValidationPipe)** | Tách validation ra khỏi service, 400 tự động |
| Parse `:id` sang UUID / number | **Pipe (ParseUUIDPipe...)** | Transform tham số trước controller |
| Bọc response vào `{ data, statusCode }` | **Interceptor (post)** | Transform response trước khi trả về client |
| Cache response theo URL | **Interceptor** | Short-circuit controller nếu cache hit |
| Thêm header `X-Response-Time` | **Interceptor (post)** | Có access response sau khi controller chạy xong |
| Audit log sau action thành công | **Interceptor (post)** | Chỉ log khi controller không throw |
| Serialize response, ẩn field password | **Interceptor (post)** | Transform response object trước khi gửi |
| CORS, helmet, compression | **Middleware** | Tương thích trực tiếp với thư viện Express |
| Format error response thống nhất | **Exception Filter** | Bắt uncaught exception, format error body |
| Map Prisma error → 409 Conflict | **Exception Filter** | `@Catch(PrismaClientKnownRequestError)` |
| Log lỗi lên Sentry / Datadog | **Exception Filter** | Có exception object đầy đủ, inject service |
| Rate limiting (sliding window, Redis) | **Guard hoặc Interceptor** | Guard nếu cần block request, Interceptor nếu cần headers `Retry-After` |

**5 câu hỏi quyết định:**

1. "Request này có được phép đi tiếp không?" → **Guard**
2. "Dữ liệu đầu vào có hợp lệ? Cần parse/transform gì?" → **Pipe**
3. "Cần làm gì trước/sau controller, liên quan đến cả request lẫn response?" → **Interceptor**
4. "Cần xử lý HTTP thô, không cần Nest context, không quan tâm route nào?" → **Middleware**
5. "Có exception? Cần format và log lỗi thế nào?" → **Exception Filter**

---

## 8. Phối hợp các tầng trong thực tế

### 8.1 Setup global đầy đủ

```typescript
// main.ts — cấu hình global đầy đủ cho REST API production
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // DI manual cho global providers
  const reflector = app.get(Reflector);
  const logger = app.get(LoggerService);
  const usersService = app.get(UsersService);
  const cacheService = app.get(CacheService);

  // ── 1. MIDDLEWARE ──────────────────────────────────────
  app.use(helmet());                   // security headers
  app.use(compression());              // gzip
  app.use(requestIdMiddleware);        // gán UUID cho mỗi request
  app.enableCors({
    origin: process.env.ALLOWED_ORIGINS?.split(','),
    credentials: true,
  });

  // ── 2. GUARDS (thứ tự quan trọng) ─────────────────────
  app.useGlobalGuards(
    new JwtAuthGuard(reflector),       // auth trước
    new BanGuard(usersService),        // ban check sau (cần req.user)
    new RolesGuard(reflector),         // role check sau cùng
  );

  // ── 3. INTERCEPTORS ────────────────────────────────────
  app.useGlobalInterceptors(
    new LoggingInterceptor(logger),    // timing log
    new HttpCacheInterceptor(cacheService),
    new TransformInterceptor(),        // bọc response
  );

  // ── 4. PIPES ───────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // ── 5. EXCEPTION FILTERS ───────────────────────────────
  app.useGlobalFilters(
    new AllExceptionsFilter(logger),   // catch-all filter
  );

  await app.listen(3000);
}
```

### 8.2 Lỗi thường gặp

**Lỗi 1: Đặt auth logic ở Middleware**

```typescript
// ❌ Sai — Middleware không đọc được @Public() decorator
export class AuthMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Không có cách nào biết route này có @Public() không
    const token = req.headers.authorization;
    if (!token) throw new UnauthorizedException(); // chặn cả @Public() route
    next();
  }
}

// ✅ Đúng — Guard dùng Reflector đọc được @Public()
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) { super(); }
  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride('isPublic', [
      context.getHandler(), context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context);
  }
}
```

**Lỗi 2: Validate DTO trong Service**

```typescript
// ❌ Sai — validate thủ công trong service, controller nhận dữ liệu bẩn
@Post()
create(@Body() body: any) { // any — không có validation
  return this.usersService.create(body);
}

async create(body: any) {
  if (!body.email || !isEmail(body.email)) throw new BadRequestException('...');
  if (!body.password || body.password.length < 8) throw new BadRequestException('...');
  // ... service đầy logic validate không liên quan nghiệp vụ
}

// ✅ Đúng — ValidationPipe global xử lý, service chỉ lo nghiệp vụ
@Post()
create(@Body() dto: CreateUserDto) { // dto đã validated và typed
  return this.usersService.create(dto);
}

async create(dto: CreateUserDto) {
  // Service chỉ chứa business logic, không validate input
  const hashedPassword = await bcrypt.hash(dto.password, 10);
  return this.usersRepository.save({ ...dto, password: hashedPassword });
}
```

**Lỗi 3: `try/catch` trong Service nuốt mất exception**

```typescript
// ❌ Sai — catch tất cả rồi không rethrow, Exception Filter không nhận được
async findOne(id: string) {
  try {
    return await this.usersRepository.findOneOrFail({ where: { id } });
  } catch (e) {
    console.error(e); // log nhưng nuốt exception
    return null;      // controller nhận null và không biết có lỗi
  }
}

// ✅ Đúng — chỉ catch khi bạn biết cách handle cụ thể, còn lại để bubble up
async findOne(id: string) {
  const user = await this.usersRepository.findOne({ where: { id } });
  if (!user) {
    throw new NotFoundException(`Không tìm thấy user với id ${id}`);
    // Exception Filter sẽ bắt và format lỗi này
  }
  return user;
}
```

**Lỗi 4: Nhầm thứ tự thực thi của Exception Filter**

```typescript
// ❌ Nhầm — nghĩ global filter chạy trước
// Thực tế: route filter → controller filter → global filter
// Nếu route filter bắt exception, global filter KHÔNG nhận được

// ✅ Đúng — hiểu rõ: filter nào gần nơi xảy ra lỗi nhất thì chạy trước
// Muốn tất cả exception đều đến global filter → không dùng route/controller filter
// Muốn override cho route cụ thể → dùng @UseFilters() ở route level
```

**Lỗi 5: Log request ở Interceptor, bỏ sót request bị Guard chặn**

```typescript
// ❌ Sai — Interceptor chạy sau Guard, request bị 403 không được log
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    // Request bị BanGuard chặn sẽ không bao giờ đến đây
    console.log('Request:', context.switchToHttp().getRequest().url);
    return next.handle();
  }
}

// ✅ Đúng — Middleware log mọi request trước khi bất kỳ guard nào chạy
export class LoggerMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Chạy trước tất cả — log 100% request kể cả 401, 403
    res.on('finish', () => console.log(`${req.method} ${req.url} ${res.statusCode}`));
    next();
  }
}
```

---

*Tham khảo: [docs.nestjs.com/faq/request-lifecycle](https://docs.nestjs.com/faq/request-lifecycle)*