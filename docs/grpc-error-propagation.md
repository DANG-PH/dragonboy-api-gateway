# Xử lý lỗi gRPC trong Microservice NestJS

## Mục lục

1. [Bài toán](#1-bài-toán)
2. [Kiến trúc hệ thống](#2-kiến-trúc-hệ-thống)
3. [Cách tiếp cận 1: Exception Filter](#3-cách-tiếp-cận-1-exception-filter)
4. [Cách tiếp cận 2: RxJS Interceptor](#4-cách-tiếp-cận-2-rxjs-interceptor)
5. [Cách tiếp cận 3: Method Decorator (Giải pháp đúng)](#5-cách-tiếp-cận-3-method-decorator-giải-pháp-đúng)
6. [Parse gRPC code sang HTTP status](#6-parse-grpc-code-sang-http-status)
7. [Tổng kết](#7-tổng-kết)

---

## 1. Bài toán

### Mục tiêu

Khi một service gọi sang service khác qua gRPC và nhận được lỗi, lỗi đó phải được **forward đúng status code và message** về API Gateway, để API Gateway trả về HTTP response đúng cho client.

### Ví dụ thực tế

```
Client
  → API Gateway (HTTP)
    → admin-service (gRPC)
      → auth-service (gRPC)  ← throw NOT_FOUND (code 5)
```

Mong muốn:

```json
{ "statusCode": 404, "message": "Tài khoản không tồn tại trong hệ thống" }
```

Thực tế nếu không xử lý đúng:

```json
{ "statusCode": 500, "message": "Internal server error" }
```

### Vấn đề cốt lõi

Khi `auth-service` throw `RpcException({ status: NOT_FOUND, message: "..." })`, `admin-service` nhận về một **`ServiceError`** (native gRPC error object), không phải `RpcException`. Object này có dạng:

```typescript
{
  code: 5,                                        // gRPC status code (number)
  details: "Tài khoản không tồn tại trong hệ thống",
  message: "5 NOT_FOUND: Tài khoản không tồn tại",
  metadata: Metadata { ... }
}
```

Nếu `admin-service` không xử lý `ServiceError` này, NestJS sẽ serialize nó thành `INTERNAL (500)` khi trả về API Gateway.

---

## 2. Kiến trúc hệ thống

```
┌─────────────┐     HTTP      ┌───────────────┐    gRPC     ┌───────────────┐
│   Client    │ ────────────► │  API Gateway  │ ──────────► │ admin-service │
└─────────────┘               └───────────────┘             └───────┬───────┘
                                      ▲                             │ gRPC
                                      │                             ▼
                                      │                     ┌───────────────┐
                                      │                     │ auth-service  │
                                      │                     └───────────────┘
                                      │
                               parseGrpcError()
                               grpcToHttp(code)
                               HttpException(message, httpStatus)
```

**API Gateway** có hàm parse lỗi gRPC thành HTTP:

```typescript
export function parseGrpcError(err: any) {
  if (err?.code !== undefined && err?.details) {
    return { code: err.code, message: err.details };
  }
  try {
    const parsed = JSON.parse(err.message);
    return {
      code: parsed.status ?? parsed.code ?? null,  // RpcException dùng key "status"
      message: parsed.message ?? parsed
    };
  } catch {
    return { code: err.code ?? null, message: err.message ?? 'Unknown error' };
  }
}

export function grpcToHttp(code: number | null): number {
  switch (code) {
    case grpcStatus.INVALID_ARGUMENT:  return 400;  // 3
    case grpcStatus.NOT_FOUND:         return 404;  // 5
    case grpcStatus.ALREADY_EXISTS:    return 409;  // 6
    case grpcStatus.PERMISSION_DENIED: return 403;  // 7
    case grpcStatus.RESOURCE_EXHAUSTED:return 429;  // 8
    case grpcStatus.UNAUTHENTICATED:   return 401;  // 16
    default:                           return 500;
  }
}
```

> **Lưu ý:** `parseGrpcError` phải dùng `parsed.status ?? parsed.code` vì `RpcException` serialize ra JSON với key là `status`, không phải `code`.

---

## 3. Cách tiếp cận 1: Exception Filter

### Ý tưởng

Dùng `@Catch()` để bắt tất cả exception và convert `ServiceError` thành `RpcException` trước khi NestJS xử lý.

```typescript
@Catch()
export class GrpcExceptionFilter extends BaseRpcExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    if (
      typeof exception === 'object' &&
      exception !== null &&
      'code' in exception &&
      'details' in exception
    ) {
      const err = exception as ServiceError;
      return throwError(() => ({
        code: err.code,
        message: err.details || err.message,
      }));
    }
    return super.catch(exception, host);
  }
}
```

### Đăng ký filter

```typescript
// main.ts
const grpcMicroservice = app.connectMicroservice<MicroserviceOptions>({...});
grpcMicroservice.useGlobalFilters(new GrpcExceptionFilter());
```

> **Lưu ý:** Phải register trên `grpcMicroservice` instance, **không phải** `app.useGlobalFilters()` — vì `app.useGlobalFilters()` chỉ apply cho HTTP context.

### Tại sao KHÔNG hoạt động ✗

```
createAccountSell()
  └── authService.handleCheckAccount()
        ↓ throws ServiceError (Promise reject)
        ↓
  [RpcExceptionsHandler]  ← NestJS built-in bắt TRƯỚC
        ↓
  GrpcExceptionFilter     ← không bao giờ được gọi
```

`GrpcExceptionFilter` chỉ được gọi **sau** khi exception đi qua `[RpcExceptionsHandler]`. Nhưng `[RpcExceptionsHandler]` là built-in handler của NestJS, nó bắt exception từ handler method **trước** filter. Kết quả: filter không bao giờ được trigger khi lỗi xảy ra bên trong `async` method.

---

## 4. Cách tiếp cận 2: RxJS Interceptor

### Ý tưởng

Dùng `catchError` trong RxJS pipeline để bắt exception trước khi `[RpcExceptionsHandler]` xử lý.

```typescript
@Injectable()
export class GrpcErrorInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      catchError(err => {
        if (err instanceof RpcException) return throwError(() => err);
        return throwError(() => new RpcException({
          status: err?.code ?? status.INTERNAL,
          message: err?.details || err?.message,
        }));
      })
    );
  }
}
```

```typescript
// main.ts
grpcMicroservice.useGlobalInterceptors(new GrpcErrorInterceptor());
```

### Tại sao KHÔNG hoạt động ✗

Interceptor wrap **Observable** trả về từ handler. Nhưng khi `ServiceError` xảy ra bên trong `async method`, nó làm **Promise reject** — không phải Observable error.

```
Interceptor
  └── next.handle()  ← wrap Observable
        └── handler method (async function)
              └── authService.handleCheckAccount()
                    ↓ Promise reject (ServiceError)
                    ↓
              NestJS convert Promise reject
                    ↓
              [RpcExceptionsHandler]  ← xử lý ở đây
                    ↓
              catchError trong interceptor KHÔNG được gọi
              vì lỗi không đi qua Observable pipeline
```

---

## 5. Cách tiếp cận 3: Method Decorator (Giải pháp đúng)

### Tại sao Decorator hoạt động ✓

Decorator **thay thế chính method đó** bằng một wrapper function. `try/catch` nằm **cùng execution level** với code đang chạy, nên bắt được mọi exception kể cả `Promise reject` từ downstream.

```
createAccountSell() ← đây chính là wrapper của decorator
  try {
    return await originalMethod()  ← method gốc chạy ở đây
      └── authService.handleCheckAccount()
            ↓ ServiceError
  } catch (err) {  ← bắt được ngay lập tức ✓
    throw new RpcException(...)
  }
        ↓
  [RpcExceptionsHandler] nhận RpcException → serialize đúng
        ↓
  API Gateway nhận { status: 5, message: "..." }
        ↓
  parseGrpcError() → grpcToHttp(5) → HTTP 404 ✓
```

### Implementation

#### Method Decorator

```typescript
// decorators/grpc-error-handler.decorator.ts
import { RpcException } from '@nestjs/microservices';
import { status } from '@grpc/grpc-js';

export function GrpcErrorHandler() {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      try {
        return await originalMethod.apply(this, args);
      } catch (err: any) {
        // Giữ nguyên RpcException tự throw (ALREADY_EXISTS, INVALID_ARGUMENT,...)
        if (err instanceof RpcException) throw err;

        // Convert ServiceError từ downstream sang RpcException
        throw new RpcException({
          status: err?.code ?? status.INTERNAL,
          message: err?.details || err?.message || 'Internal error',
        });
      }
    };

    return descriptor;
  };
}
```

#### Class Decorator (apply toàn bộ methods)

```typescript
export function GrpcErrorHandler() {
  return function (constructor: Function) {
    const methods = Object.getOwnPropertyNames(constructor.prototype);

    methods.forEach(methodName => {
      if (methodName === 'constructor') return;

      const descriptor = Object.getOwnPropertyDescriptor(constructor.prototype, methodName);
      if (!descriptor || typeof descriptor.value !== 'function') return;

      const originalMethod = descriptor.value;
      descriptor.value = async function (...args: any[]) {
        try {
          return await originalMethod.apply(this, args);
        } catch (err: any) {
          if (err instanceof RpcException) throw err;
          throw new RpcException({
            status: err?.code ?? status.INTERNAL,
            message: err?.details || err?.message || 'Internal error',
          });
        }
      };

      Object.defineProperty(constructor.prototype, methodName, descriptor);
    });
  };
}
```

### Cách dùng

```typescript
// Áp dụng cho toàn bộ class (khuyến nghị)
@GrpcErrorHandler()
@Injectable()
export class PartnerService {
  async createAccountSell(payload: CreateAccountSellRequest) {
    // Không cần try/catch ở đây
    await this.authService.handleCheckAccount({
      username: payload.username,
      password: payload.password,
    });
    // ... business logic
  }

  async updateAccount(payload: UpdateAccountRequest) {
    // Tự động được bảo vệ
  }
}

// Hoặc áp dụng cho từng method
@Injectable()
export class PartnerService {
  @GrpcErrorHandler()
  async createAccountSell(payload: CreateAccountSellRequest) {...}
}
```

### Lợi ích

| | Không dùng decorator | Dùng decorator |
|---|---|---|
| Business logic | Lẫn với error handling | Sạch, chỉ có logic |
| Tái sử dụng | Copy/paste ở mọi method | 1 decorator cho cả class |
| RpcException tự throw | Có thể bị double-wrap | Được giữ nguyên |
| Maintainability | Khó sửa khi đổi logic | Sửa 1 chỗ, apply everywhere |

---

## 6. Parse gRPC code sang HTTP status

### Bảng mapping

| gRPC Status | Code | HTTP | Ý nghĩa |
|---|---|---|---|
| `OK` | 0 | 200 | Thành công |
| `INVALID_ARGUMENT` | 3 | 400 | Dữ liệu đầu vào sai |
| `NOT_FOUND` | 5 | 404 | Không tìm thấy |
| `ALREADY_EXISTS` | 6 | 409 | Đã tồn tại |
| `PERMISSION_DENIED` | 7 | 403 | Không có quyền |
| `RESOURCE_EXHAUSTED` | 8 | 429 | Rate limit |
| `INTERNAL` | 13 | 500 | Lỗi server |
| `UNAUTHENTICATED` | 16 | 401 | Chưa xác thực |
| Còn lại | - | 500 | Default server error |

### Lưu ý quan trọng về `parseGrpcError`

Khi `admin-service` throw `RpcException({ status: 5, message: "..." })`, NestJS serialize thành JSON string trong `err.message`:

```json
{ "status": 5, "message": "Tài khoản không tồn tại" }
```

Key là **`status`**, không phải `code`. Nên `parseGrpcError` phải handle cả hai:

```typescript
const parsed = JSON.parse(err.message);
return {
  code: parsed.status ?? parsed.code ?? null,  // ← phải có parsed.status
  message: parsed.message ?? parsed
};
```

---

## 7. Tổng kết

### So sánh các cách tiếp cận

| Cách | Hoạt động | Lý do |
|---|---|---|
| Exception Filter | ✗ | `[RpcExceptionsHandler]` built-in bắt trước filter |
| RxJS Interceptor | ✗ | `Promise reject` không đi qua Observable pipeline |
| Method Decorator | ✓ | Wrap trực tiếp tại method, cùng execution level |

### Flow hoàn chỉnh khi hoạt động đúng

```
Client
  → API Gateway
    → grpcCall() → admin-service.createAccountSell()
        @GrpcErrorHandler() decorator wrap method
          → authService.handleCheckAccount()
              ↓ ServiceError { code: 5, details: "Tài khoản không tồn tại" }
          ← decorator catch → throw RpcException({ status: 5, message: "..." })
        ← [RpcExceptionsHandler] serialize RpcException đúng format
    ← parseGrpcError() → { code: 5, message: "Tài khoản không tồn tại" }
    ← grpcToHttp(5) → 404
    ← HttpException("Tài khoản không tồn tại", 404)
  ← { statusCode: 404, message: "Tài khoản không tồn tại" } ✓
```