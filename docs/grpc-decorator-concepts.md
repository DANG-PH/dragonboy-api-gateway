# GrpcErrorHandler Decorator - Tài liệu nghiên cứu

## Bài toán cần giải quyết

Hệ thống có nhiều service giao tiếp với nhau qua gRPC:

```
Client → API Gateway → admin-service → auth-service
```

Khi `auth-service` báo lỗi _"Tài khoản không tồn tại"_, **client phải nhận được HTTP 404**, không phải HTTP 500.

Nhưng nếu không xử lý gì, client luôn nhận **500** dù lỗi thực sự là 404, 409, 401,...

**Decorator này sinh ra để giải quyết đúng vấn đề đó.**

> Ngoài ra, sau này có thể đổi mô hình coupling trực tiếp sang coupling lỏng (pub/sub) event.
> Cách event emit có thể handle error mà không cần viết decorators này (nhưng cần giải quyết bài toán mới)

---

## Mục lục

1. [Vấn đề không có Decorator](#1-vấn-đề-không-có-decorator)
2. [Decorator là gì - giải thích đơn giản nhất](#2-decorator-là-gì---giải-thích-đơn-giản-nhất)
3. [Prototype - tại sao JS lại có khái niệm này](#3-prototype---tại-sao-js-lại-có-khái-niệm-này)
4. [Constructor vs Instance - bản thiết kế vs vật thể](#4-constructor-vs-instance---bản-thiết-kế-vs-vật-thể)
5. [Closure - function nhớ biến bên ngoài](#5-closure---function-nhớ-biến-bên-ngoài)
6. [apply() - gọi function với this tùy chỉnh](#6-apply---gọi-function-với-this-tùy-chỉnh)
7. [Property Descriptor - metadata của method](#7-property-descriptor---metadata-của-method)
8. [...args - gom tất cả argument vào array](#8-args---gom-tất-cả-argument-vào-array)
9. [?. và ?? và || - xử lý null an toàn](#9--và--và----xử-lý-null-an-toàn)
10. [instanceof - kiểm tra kiểu object](#10-instanceof---kiểm-tra-kiểu-object)
11. [Decorator Factory - tại sao có dấu ()](#11-decorator-factory---tại-sao-có-dấu-)
12. [Ghép lại - flow hoàn chỉnh](#12-ghép-lại---flow-hoàn-chỉnh)

---

## 1. Vấn đề không có Decorator

Nếu không có decorator, mỗi method phải tự xử lý lỗi:

```typescript
// ❌ Lặp code ở mọi nơi - 10 method = 10 đoạn try/catch giống nhau
async createAccountSell(payload) {
  try {
    await this.authService.handleCheckAccount(...)  // có thể throw lỗi
  } catch (err) {
    throw new RpcException({ code: err?.code, message: err?.details })
  }
  // ... logic
}

async updateAccount(payload) {
  try {
    await this.authService.someOtherCall(...)
  } catch (err) {
    throw new RpcException({ code: err?.code, message: err?.details })
  }
  // ... logic
}

// và còn 8 method nữa...
```

**Với Decorator:**

```typescript
// ✅ Viết error handling 1 lần, apply cho cả class
@GrpcErrorHandler()
class PartnerService {
  async createAccountSell(payload) {
    await this.authService.handleCheckAccount(...)  // lỗi tự động được xử lý
    // ... logic
  }

  async updateAccount(payload) {
    // ... logic, không cần try/catch
  }
}
```

---

## 2. Decorator là gì - giải thích đơn giản nhất

Decorator là **wrapper** — bọc thêm behavior vào ngoài mà không đụng vào code gốc bên trong.

**Ví dụ thực tế:** Decorator giống như màng bọc thực phẩm.

```
Thức ăn (method gốc)        = createAccountSell() { ... }
Màng bọc (decorator)        = try { ... } catch { convert lỗi }
Kết quả sau khi bọc         = method vẫn chạy như cũ, nhưng lỗi được xử lý tự động
```

**Trong code:**

```typescript
// Trước khi decorator chạy:
createAccountSell(payload) {
  // code gốc
}

// Sau khi decorator chạy (decorator tự động thay thế):
createAccountSell(payload) {        // ← wrapper bên ngoài (do decorator tạo)
  try {
    // code gốc chạy ở đây         // ← code gốc vẫn nguyên vẹn
  } catch(err) {
    // xử lý lỗi tự động
  }
}
```

---

## 3. Prototype - tại sao JS lại có khái niệm này

### Vấn đề cần giải quyết

Tưởng tượng NestJS tạo 100 instance của `PartnerService` (thực tế chỉ 1, nhưng giả sử).

```
Nếu MỖI instance lưu riêng method:
  instance1: { createAccountSell: fn, updateAccount: fn, deleteAccount: fn }  ← 3 fn
  instance2: { createAccountSell: fn, updateAccount: fn, deleteAccount: fn }  ← 3 fn copy
  instance3: ...                                                               ← 3 fn copy
  → 100 instance = 300 function trong memory (lãng phí)
```

### Giải pháp: Prototype

JavaScript lưu **tất cả method vào một chỗ chung** gọi là prototype:

```
PartnerService.prototype:
  createAccountSell: fn   ← chỉ 1 bản duy nhất
  updateAccount: fn
  deleteAccount: fn

instance1: {}   ← chỉ lưu data riêng (partnerRepository, authService,...)
instance2: {}   ← chỉ lưu data riêng
instance3: {}   ← chỉ lưu data riêng
→ 100 instance = vẫn chỉ 3 function trong memory ✓
```

### Khi gọi method, JS tìm ở đâu?

```javascript
instance1.createAccountSell(payload)

// JS hỏi: instance1 có createAccountSell không?
//   → Không có (instance chỉ lưu data)
// JS hỏi: prototype của instance1 có không?
//   → Có! → dùng function từ prototype
```

### Tại sao decorator sửa prototype?

Vì **sửa prototype = ảnh hưởng tất cả instance ngay lập tức**:

```javascript
// Decorator thay createAccountSell trong prototype bằng wrapper
PartnerService.prototype.createAccountSell = wrapperFunction

// Bây giờ mọi instance khi gọi createAccountSell đều gọi wrapper
instance1.createAccountSell  // → wrapperFunction ✓
instance2.createAccountSell  // → wrapperFunction ✓
```

---

## 4. Constructor vs Instance - bản thiết kế vs vật thể

### Constructor = Bản thiết kế

```typescript
class PartnerService {
  constructor(
    private partnerRepository: Repository<Partner>,
    private authService: AuthService,
  ) {}
}

// Constructor = chính cái class PartnerService
// Nó mô tả: "service này cần những gì, có method gì"
// Nhưng bản thân nó CHƯA có data thực tế
```

### Instance = Vật thể được tạo ra

```typescript
// NestJS tự tạo instance khi khởi động app
const instance = new PartnerService(
  actualPartnerRepository,  // ← data thực tế
  actualAuthService,        // ← data thực tế
)

// Bây giờ instance.partnerRepository mới có giá trị thực
// instance.authService mới có thể gọi được
```

### Decorator chạy lúc nào?

```
Bước 1: TypeScript đọc code → thấy class PartnerService
Bước 2: @GrpcErrorHandler() CHẠY NGAY ← nhận Constructor (bản thiết kế)
         (Instance CHƯA tồn tại, partnerRepository CHƯA có giá trị)
Bước 3: @Injectable() chạy
Bước 4: App khởi động xong
Bước 5: NestJS tạo Instance → inject partnerRepository, authService,...
Bước 6: Có request đến → instance.createAccountSell() được gọi
```

> **Quan trọng:** Decorator nhận **Constructor** (bước 2), không phải Instance (bước 5).  
> Đó là lý do decorator thao tác trên `constructor.prototype`, không phải trên `this`.

---

## 5. Closure - function nhớ biến bên ngoài

### Closure là gì?

Khi một function được tạo ra **bên trong** function khác, nó có thể **nhớ** biến của function bên ngoài — kể cả sau khi function bên ngoài đã chạy xong.

```javascript
function taoHam() {
  const tenBien = "Tôi được nhớ";  // biến của taoHam

  function hamBenTrong() {
    console.log(tenBien);  // nhớ được tenBien dù taoHam đã chạy xong
  }

  return hamBenTrong;
}

const fn = taoHam();  // taoHam chạy xong, tenBien "lẽ ra" bị xóa khỏi memory
fn();                 // nhưng vẫn in ra "Tôi được nhớ" → đây là closure
```

### Tại sao cần trong Decorator?

Decorator duyệt qua từng method và tạo wrapper. Mỗi wrapper cần **nhớ method gốc của chính nó**:

```javascript
methods.forEach(methodName => {
  //                    ↓ lưu method gốc vào biến
  const originalMethod = descriptor.value;

  //       ↓ tạo wrapper function mới
  descriptor.value = async function (...args) {
    return await originalMethod.apply(this, args);
    //           ↑ wrapper này nhớ originalMethod → đây là closure
  };
});
```

**Điều quan trọng:** Mỗi vòng lặp tạo closure riêng, không bị trộn lẫn:

```
forEach lần 1 (createAccountSell):
  originalMethod = createAccountSell  ← nhớ riêng
  wrapper1 = function() { originalMethod... }  ← nhớ createAccountSell

forEach lần 2 (updateAccount):
  originalMethod = updateAccount  ← biến mới hoàn toàn
  wrapper2 = function() { originalMethod... }  ← nhớ updateAccount

// wrapper1 và wrapper2 mỗi cái nhớ đúng method gốc của nó
```

**Nếu không lưu vào `originalMethod`:**

```javascript
descriptor.value = async function (...args) {
  return await descriptor.value.apply(this, args);
  //           ↑ descriptor.value lúc này đã bị thay = chính wrapper này
  //           → wrapper gọi lại chính nó → vòng lặp vô hạn → crash
};
```

---

## 6. apply() - gọi function với this tùy chỉnh

### `this` trong JavaScript là gì?

`this` trong một method là **object đang gọi method đó**:

```javascript
const instance = new PartnerService(...)

instance.createAccountSell(payload)
// this bên trong createAccountSell = instance
// → this.partnerRepository = instance.partnerRepository ✓
// → this.authService = instance.authService ✓
```

### Vấn đề khi gọi function gốc trong decorator

```javascript
descriptor.value = async function (...args) {
  // "this" ở đây = instance (vì được gọi là instance.createAccountSell())

  // ❌ Gọi thẳng - "this" bị mất
  originalMethod(...args)
  // bên trong originalMethod, this = undefined
  // → this.partnerRepository → crash: Cannot read property of undefined

  // ✅ Dùng apply - truyền "this" vào
  originalMethod.apply(this, args)
  // bên trong originalMethod, this = instance ✓
};
```

### apply vs call vs bind

```javascript
// Cả 3 đều dùng để chỉ định "this":

fn.call(thisArg, arg1, arg2)      // truyền argument riêng lẻ
fn.apply(thisArg, [arg1, arg2])   // truyền argument dạng array ← dùng ở đây vì ...args là array
fn.bind(thisArg)                  // trả về function mới, chưa gọi ngay
```

---

## 7. Property Descriptor - metadata của method

### Method không chỉ là function

Mỗi method trong JavaScript có thêm **thông tin đính kèm** (metadata):

```javascript
Object.getOwnPropertyDescriptor(PartnerService.prototype, 'createAccountSell')
// Trả về:
{
  value: [Function: createAccountSell],  // ← bản thân function
  writable: true,     // có thể thay bằng function khác không?
  enumerable: false,  // có hiện ra khi liệt kê properties không?
  configurable: true, // có thể xóa/sửa descriptor này không?
}
```

### Tại sao cần biết điều này?

Khi thay method gốc bằng wrapper, có 2 cách:

```javascript
// ❌ Cách 1: Gán thẳng
constructor.prototype[methodName] = wrapperFunction
// Vấn đề: enumerable bị reset từ false → true
// Method giờ hiện ra trong for...in loop (không đúng với behavior gốc)

// ✅ Cách 2: defineProperty
descriptor.value = wrapperFunction  // chỉ thay value, giữ nguyên writable/enumerable/configurable
Object.defineProperty(constructor.prototype, methodName, descriptor)
// enumerable vẫn false, giống method gốc
```

> **Với fresher:** Hiểu đơn giản là `defineProperty` = "thay thế nhưng giữ nguyên tất cả setting khác". Gán thẳng = "thay thế và reset hết setting về mặc định".

---

## 8. ...args - gom tất cả argument vào array

### Rest Parameters

```javascript
// Không biết trước sẽ nhận bao nhiêu argument? Dùng ...args
function example(...args) {
  console.log(args)
}

example(1)           // args = [1]
example(1, 2, 3)     // args = [1, 2, 3]
example({id: 1})     // args = [{id: 1}]
```

### Tại sao cần trong decorator?

Decorator wrap **tất cả method** của class, mỗi method có số lượng argument khác nhau:

```typescript
createAccountSell(payload: CreateAccountSellRequest)  // 1 argument
someMethod(a: string, b: number, c: boolean)          // 3 arguments

// Decorator không thể biết trước → dùng ...args để gom hết
descriptor.value = async function (...args) {
  return await originalMethod.apply(this, args)
  //                                       ↑ array rồi, apply tự trải ra
}
```

---

## 9. ?. và ?? và || - xử lý null an toàn

### Optional Chaining (?.)

Tránh crash khi truy cập property của null/undefined:

```javascript
const err = null

err.code    // 💥 TypeError: Cannot read property 'code' of null
err?.code   // ✅ undefined (không crash)
```

### Nullish Coalescing (??)

Fallback **chỉ khi** giá trị là `null` hoặc `undefined`:

```javascript
null      ?? 'fallback'  // 'fallback'
undefined ?? 'fallback'  // 'fallback'
0         ?? 'fallback'  // 0    ← 0 không phải null/undefined, giữ nguyên
''        ?? 'fallback'  // ''   ← '' không phải null/undefined, giữ nguyên
```

### Short-circuit (||)

Fallback khi giá trị là **falsy** (null, undefined, 0, '', false):

```javascript
null  || 'fallback'  // 'fallback'
0     || 'fallback'  // 'fallback'  ← 0 là falsy
''    || 'fallback'  // 'fallback'  ← '' là falsy
```

### Tại sao dùng ?? cho code, || cho message?

```javascript
throw new RpcException({
  code: err?.code ?? status.INTERNAL,
  //             ^^
  //  gRPC code = 0 có nghĩa là OK (hợp lệ)
  //  Nếu dùng ||: code 0 → falsy → fallback INTERNAL → sai
  //  Nếu dùng ??: code 0 → không phải null/undefined → giữ 0 → đúng

  message: err?.details || err?.message || 'Internal error',
  //                    ^^
  //  String rỗng '' không có ý nghĩa gì
  //  Nếu details = '' → falsy → thử message tiếp → đúng
})
```

---

## 10. instanceof - kiểm tra kiểu object

### instanceof là gì?

Kiểm tra xem object có phải được tạo từ class đó không:

```javascript
const rpcErr = new RpcException({ code: 6, message: '...' })
const grpcErr = { code: 5, details: '...', metadata: {...} }  // ServiceError từ gRPC

rpcErr instanceof RpcException   // true  ← do chính service tự throw
grpcErr instanceof RpcException  // false ← lỗi từ service khác qua gRPC
```

### Tại sao cần phân biệt?

Có 2 loại lỗi trong hệ thống:

```
Loại 1: RpcException - do chính service tự throw (có chủ đích)
  throw new RpcException({ code: status.ALREADY_EXISTS, message: 'Account đã tồn tại' })
  → Đã đúng format, không cần convert, re-throw nguyên vẹn

Loại 2: ServiceError - lỗi từ downstream service qua gRPC transport
  { code: 5, details: 'Tài khoản không tồn tại', metadata: {...} }
  → Cần convert sang RpcException để NestJS serialize đúng
```

```javascript
catch (err: any) {
  if (err instanceof RpcException) throw err  // Loại 1: giữ nguyên
  
  // Loại 2: convert
  throw new RpcException({
    code: err?.code ?? status.INTERNAL,
    message: err?.details || err?.message || 'Internal error',
  })
}
```

---

## 11. Decorator Factory - tại sao có dấu ()

### Hai cách viết decorator

```typescript
// Cách 1: Decorator thường - KHÔNG có ()
function GrpcErrorHandler(constructor: Function) {
  // nhận thẳng constructor
}
@GrpcErrorHandler    // ← không có ()
class PartnerService {}


// Cách 2: Decorator Factory - CÓ ()
function GrpcErrorHandler() {         // ← function ngoài, không nhận gì
  return function(constructor: Function) {  // ← function trong, nhận constructor
    // xử lý
  }
}
@GrpcErrorHandler()  // ← có (), gọi function ngoài trước
class PartnerService {}
```

### Tại sao dùng Factory?

**Hiện tại** chưa cần options, nhưng **tương lai** có thể mở rộng mà không cần sửa chỗ dùng:

```typescript
// Tương lai muốn thêm options:
@GrpcErrorHandler({ excludeMethods: ['healthCheck'] })
class PartnerService {}

// Nếu dùng decorator thường thì phải sửa lại cú pháp
// Nếu dùng factory thì chỉ cần thêm parameter vào factory function
```

---

## 12. Ghép lại - flow hoàn chỉnh

### Lúc app khởi động

```
NestJS đọc PartnerService
    ↓
@GrpcErrorHandler() được gọi
    ↓
Decorator duyệt qua prototype:
  ['constructor', 'createAccountSell', 'updateAccount', 'deleteAccount', ...]
    ↓
Bỏ qua 'constructor'
    ↓
Với mỗi method còn lại:
  1. Lấy descriptor (metadata + function gốc)
  2. Lưu function gốc vào originalMethod (closure)
  3. Thay descriptor.value = wrapper function (try/catch)
  4. Object.defineProperty → ghi đè prototype
    ↓
prototype.createAccountSell = wrapperFunction ✓
prototype.updateAccount     = wrapperFunction ✓
    ↓
NestJS tạo instance, inject dependency
    ↓
App ready
```

### Lúc có request

```
Client → POST /partner/create-account-sell
    ↓
API Gateway gọi admin-service qua gRPC
    ↓
NestJS gọi instance.createAccountSell(payload)
    ↓
instance tìm trong prototype → thấy wrapperFunction (decorator đã thay)
    ↓
wrapperFunction chạy:
  try {
    originalMethod.apply(instance, [payload])  ← code gốc chạy
      ↓
      authService.handleCheckAccount(...)  ← gọi sang auth-service
        ↓
        auth-service: không tìm thấy account
        → throw RpcException({ code: 5, message: "Tài khoản không tồn tại" })
        ↓
        gRPC transport serialize → ServiceError { code: 5, details: "..." }
        ↓
      handleCheckAccount() throw ServiceError
    originalMethod() throw ServiceError
  } catch (err) {
    err instanceof RpcException? → Không (ServiceError)
    ↓
    throw new RpcException({ code: 5, message: "Tài khoản không tồn tại" })
  }
    ↓
NestJS serialize RpcException → gRPC response: code=5, details="Tài khoản không tồn tại"
    ↓
API Gateway nhận: { code: 5, details: "Tài khoản không tồn tại" }
    ↓
parseGrpcError() → { code: 5, message: "Tài khoản không tồn tại" }
    ↓
grpcToHttp(5) → 404
    ↓
Client nhận: { statusCode: 404, message: "Tài khoản không tồn tại" } ✓
```

---

## Tóm tắt - Tại sao mỗi thứ tồn tại

| Khái niệm | Tồn tại để làm gì trong decorator này |
|---|---|
| **Prototype** | Nơi decorator sửa method, ảnh hưởng tất cả instance |
| **Constructor** | Thứ decorator nhận được khi app khởi động |
| **Closure** | Giúp mỗi wrapper nhớ đúng method gốc của nó |
| **apply()** | Giữ nguyên `this` khi gọi method gốc từ trong wrapper |
| **Property Descriptor** | Thay method mà không làm mất metadata của nó |
| **...args** | Gom argument vì không biết trước method có bao nhiêu arg |
| **?.** | Tránh crash khi `err` là null/undefined |
| **??** | Fallback code mà không mất giá trị 0 (gRPC OK) |
| **\|\|** | Fallback message khi string rỗng |
| **instanceof** | Phân biệt lỗi tự throw vs lỗi từ downstream service |
| **Factory Pattern** | Cho phép truyền options vào decorator sau này |