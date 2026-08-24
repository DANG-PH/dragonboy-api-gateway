# Payment System — Tài liệu kỹ thuật

## Mục lục

1. [Bài toán đặt ra](#1-bài-toán-đặt-ra)
2. [Tổng quan kiến trúc](#2-tổng-quan-kiến-trúc)
3. [Luồng nạp tiền end-to-end](#3-luồng-nạp-tiền-end-to-end)
4. [Chi tiết từng thành phần](#4-chi-tiết-từng-thành-phần)
   - [4.1 Tạo QR nạp tiền](#41-tạo-qr-nạp-tiền)
   - [4.2 Webhook nhận giao dịch từ Casso](#42-webhook-nhận-giao-dịch-từ-casso)
   - [4.3 Xác thực chữ ký HMAC-SHA512](#43-xác-thực-chữ-ký-hmac-sha512)
   - [4.4 Phân tích nội dung chuyển khoản](#44-phân-tích-nội-dung-chuyển-khoản)
   - [4.5 Cộng tiền và ghi lịch sử](#45-cộng-tiền-và-ghi-lịch-sử)
5. [Cấu trúc Webhook Payload từ Casso](#5-cấu-trúc-webhook-payload-từ-casso)
6. [Convention nội dung chuyển khoản](#6-convention-nội-dung-chuyển-khoản)
7. [Tại sao chọn các giải pháp này](#7-tại-sao-chọn-các-giải-pháp-này)
8. [Cấu hình cần thiết](#8-cấu-hình-cần-thiết)
9. [Các điểm cần lưu ý / edge cases](#9-các-điểm-cần-lưu-ý--edge-cases)

---

## 1. Bài toán đặt ra

Hệ thống game cần cho phép người chơi **nạp tiền vào ví** thông qua chuyển khoản ngân hàng, đảm bảo:

- **Không cần tích hợp cổng thanh toán truyền thống**: không muốn phụ thuộc PayOS SDK, không cần redirect, không cần lưu thông tin thẻ.
- **Tự động hóa hoàn toàn**: sau khi người chơi chuyển khoản, tiền được cộng tự động vào ví mà không cần thao tác thủ công.
- **Xác thực bảo mật**: bảo đảm chỉ request hợp lệ từ Casso mới được xử lý, không cho phép bất kỳ ai giả mạo webhook.
- **Trích xuất thông tin đúng người**: từ nội dung chuyển khoản tự do, server phải xác định được đây là nạp tiền cho user nào, số tiền bao nhiêu.
- **Ghi lịch sử tài chính**: mỗi giao dịch nạp tiền phải được lưu lại để audit.

Thách thức kỹ thuật cốt lõi:

| Thách thức | Biểu hiện |
|---|---|
| Chuyển khoản ngân hàng là bất đồng bộ | Server không biết khi nào tiền đến — cần webhook từ bên thứ ba |
| Nội dung chuyển khoản tự do | Ngân hàng không kiểm soát format — cần convention và parser mạnh |
| Giả mạo webhook | Bất kỳ ai biết endpoint đều có thể POST dữ liệu giả → cần xác thực chữ ký |
| Trùng lặp giao dịch | Casso có thể gửi lại webhook nếu không nhận được 200 OK — cần idempotency |
| rawBody cho HMAC | NestJS mặc định parse JSON trước, làm mất rawBody cần thiết để verify chữ ký |

---

## 2. Tổng quan kiến trúc

```
[Người chơi]
    │
    │  1. Yêu cầu tạo QR
    ▼
[Game Gateway]  ──gRPC──►  [Pay Service]
                                │
                                │  2. Tạo URL VietQR với addInfo embed userId + username + amount
                                │  3. Trả về QR image URL
                                ▼
                           [Client hiển thị QR]
    │
    │  4. Người chơi chuyển khoản qua app ngân hàng
    ▼
[Ngân hàng OCB]
    │
    │  5. Casso lắng nghe giao dịch qua Open Banking / bank feed
    ▼
[Casso]  ──POST Webhook──►  [Pay REST Controller]
                                │
                                │  6. Verify HMAC-SHA512 signature
                                │  7. Parse nội dung chuyển khoản
                                │  8. updateMoney(userId, amount)
                                │  9. createFinanceRecord(...)
                                │  10. Log thông báo nạp tiền
                                ▼
                           [Ví người chơi được cập nhật]
```

**Hai lớp service:**
- **Pay Service** (gRPC): xử lý logic nghiệp vụ — tạo QR, cộng tiền, ghi lịch sử.
- **Pay REST Controller**: nhận webhook HTTP từ Casso, verify chữ ký, rồi delegate sang Pay Service.

---

## 3. Luồng nạp tiền end-to-end

```
Bước 1:  Client gọi createPayOrder(userId, username, amount)
              → Server tạo URL VietQR với addInfo đã encode
              → Client render QR

Bước 2:  Người chơi quét QR, chuyển khoản
              → Nội dung tự động điền: "HDG STUDIO {userId} {username} {amount}"
              → Số tiền tự động điền từ QR

Bước 3:  Ngân hàng ghi nhận giao dịch
              → Casso phát hiện giao dịch mới qua bank feed
              → Casso gọi POST /webhook/casso với payload + chữ ký HMAC

Bước 4:  Pay REST Controller nhận webhook
              → Đọc rawBody (không dùng parsed body để verify chữ ký)
              → Verify HMAC-SHA512 với secret key
              → Nếu invalid: trả 403, dừng

Bước 5:  Pay Service xử lý giao dịch
              → Parse nội dung: tìm "STUDIO" → lấy userId, username
              → Dùng amount từ Casso (không tin amount trong nội dung)
              → updateMoney(userId, amount)
              → createFinanceRecord(...)
              → Log thông báo

Bước 6:  Trả về 200 OK cho Casso
              → Nếu không trả 200, Casso sẽ retry
```

---

## 4. Chi tiết từng thành phần

### 4.1 Tạo QR nạp tiền

```typescript
async createPayOrder(data: CreatePayOrderRequest): Promise<QrResponse>
```

**Logic:**

1. Kiểm tra ví của user có tồn tại không.
2. Kiểm tra `amount > 0`.
3. Chọn ngẫu nhiên một trong 4 template QR (`UMdcQhV`, `Jot2fKT`, `0yWfPjD`, `TmyuxXw`) — đây là các template VietQR đã được tạo sẵn cho tài khoản OCB, mỗi template cho phép hiển thị logo/màu sắc khác nhau.
4. Build URL VietQR với:
   - `amount`: số tiền nạp.
   - `addInfo`: nội dung chuyển khoản đã encode — format `HDG STUDIO {userId} {username} {amount}`.

```
https://img.vietqr.io/image/ocb-CASS99999-{template}.jpg
  ?amount={amount}
  &addInfo=HDG%20STUDIO%20{userId}%20{username}%20{amount}
  &accountName=Pham+Hai+Dang
```

Khi người dùng quét QR bằng app ngân hàng, **toàn bộ thông tin sẽ tự động điền** — người dùng chỉ cần bấm xác nhận chuyển khoản.

**Tại sao embed `amount` vào addInfo dù đã có `?amount=` trên URL?**
Vì `?amount=` chỉ điền số tiền vào form chuyển khoản, còn `addInfo` là nội dung do ngân hàng ghi lại. Server dùng `addInfo` để nhận biết giao dịch, không dùng số tiền trong nội dung (xem mục 4.4 và 4.5 về lý do dùng `amount` từ Casso thay vì từ nội dung).

---

### 4.2 Webhook nhận giao dịch từ Casso

```typescript
@Post('casso')
async handleCassoWebhook(@Req() req: Request, @Res() res: Response)
```

**Endpoint**: `POST /webhook/casso`

**Flow:**

```
1. Đọc rawBody (Buffer → string)
2. Parse JSON từ rawBody (không dùng req.body đã parse sẵn)
3. Lấy header x-casso-signature
4. Verify chữ ký HMAC-SHA512
5. Nếu valid → gọi payService.handleCassoTransaction(parsedBody)
6. Trả 200 OK
```

**Tại sao dùng `rawBody` thay vì `req.body`?**

Chữ ký HMAC được Casso tính trên raw string của JSON trước khi gửi. Nếu NestJS parse JSON xong rồi `JSON.stringify` lại để verify, thứ tự key hoặc khoảng trắng có thể thay đổi → signature không khớp. Phải dùng rawBody — chính xác byte-for-byte như Casso đã gửi.

> ⚠️ Cần bật rawBody trong `main.ts`:
> ```typescript
> app.use((req, res, next) => {
>   express.json({
>     verify: (req: any, res, buf) => { req.rawBody = buf; }
>   })(req, res, next);
> });
> ```

---

### 4.3 Xác thực chữ ký HMAC-SHA512

```typescript
private verifyCassoSignature(signatureHeader: string, data: any, secretKey: string): boolean
```

**Header format từ Casso:**
```
x-casso-signature: t=1738000000,v1=a3f9e2b1c4d5...
```

**Thuật toán verify:**

```
1. Parse header → tách timestamp (t) và signature (v1)
2. Sort object theo key (đệ quy, giống TreeMap trong Java)
3. Build message = "{timestamp}.{JSON.stringify(sortedData)}"
4. Tính HMAC-SHA512 của message với secretKey
5. So sánh constant-time với receivedSig
```

**Tại sao phải sort key trước khi stringify?**

Casso sort key theo alphabetical order trước khi tính chữ ký. JavaScript không đảm bảo thứ tự key trong object. Nếu không sort, `JSON.stringify` có thể ra thứ tự khác → HMAC khác → verify fail. Hàm `sortObjByKey` xử lý đệ quy cả nested object và array.

**Tại sao dùng HMAC-SHA512 thay vì chỉ so sánh secret token?**

Một số webhook provider dùng shared secret token đặt trong header — bất kỳ ai chặn được một request hợp lệ đều có thể replay. HMAC-SHA512 embed timestamp vào chữ ký, nên mỗi request có chữ ký khác nhau và không thể tái sử dụng.

---

### 4.4 Phân tích nội dung chuyển khoản

```typescript
const normalized = description.replace(/%/g, ' ').trim();
const parts = normalized.split(/\s+/);
const studioIndex = parts.findIndex(p => p.toUpperCase() === 'STUDIO');
```

**Convention nội dung:** `HDG STUDIO {userId} {username} {amount}`

**Ví dụ thực tế:**
```
Input:  "HDG%20STUDIO%201234%20dang123%2050000"
Sau normalize: "HDG STUDIO 1234 dang123 50000"
parts: ["HDG", "STUDIO", "1234", "dang123", "50000"]
studioIndex: 1
userId: parts[2] = 1234
username: parts[3] = "dang123"
```

**Tại sao tìm theo vị trí của "STUDIO" thay vì split fixed index?**

Nội dung chuyển khoản thực tế có thể bị ngân hàng thêm prefix hoặc ngân hàng của người gửi thêm mã giao dịch vào đầu. Việc tìm `studioIndex` linh hoạt hơn — miễn là có từ "STUDIO" ở đâu đó trong chuỗi, parser vẫn tìm ra dữ liệu đúng. Index cố định sẽ fail ngay khi có tiền tố lạ.

**Tại sao replace `%` thành space?**

Một số ngân hàng gửi nội dung đã URL-encode (dấu cách thành `%20` hoặc `%`). Bước normalize đảm bảo parser luôn làm việc với plain text.

---

### 4.5 Cộng tiền và ghi lịch sử

```typescript
const inputAmount = amount; // Lấy từ Casso, không từ nội dung chuyển khoản

await this.updateMoney(request);
await this.financeService.createFinanceRecord({
  userId: userId,
  type: "NAP",
  amount: inputAmount
});
```

**Tại sao dùng `amount` từ Casso thay vì `parts[studioIndex + 3]` trong nội dung?**

Số tiền trong `addInfo` chỉ là gợi ý điền sẵn vào form — người dùng hoàn toàn có thể sửa lại số tiền trước khi chuyển. Số tiền thực tế ngân hàng ghi nhận là `amount` trong payload của Casso — đây là giá trị đáng tin cậy duy nhất. Dùng số tiền từ nội dung sẽ dẫn đến cộng sai ví.

---

## 5. Cấu trúc Webhook Payload từ Casso

```json
{
  "error": 0,
  "data": {
    "id": 123456789,
    "reference": "BANK_REF_ID",
    "description": "HDG STUDIO 1 dang123 50000",
    "amount": 50000,
    "runningBalance": 25000000,
    "transactionDateTime": "2025-02-12 15:36:21",
    "accountNumber": "CASS99999",
    "bankName": "OCB",
    "bankAbbreviation": "OCB",
    "virtualAccountNumber": "",
    "virtualAccountName": "",
    "counterAccountName": "",
    "counterAccountNumber": "",
    "counterAccountBankId": "",
    "counterAccountBankName": ""
  }
}
```

**Các field được sử dụng:**

| Field | Dùng để |
|---|---|
| `data.description` | Parse userId, username |
| `data.amount` | Số tiền thực tế cộng vào ví |
| `data.id` | Logging, có thể dùng cho idempotency check |
| `data.transactionDateTime` | Logging, audit |

---

## 6. Convention nội dung chuyển khoản

```
HDG STUDIO {userId} {username} {amount}
```

| Token | Ý nghĩa | Ví dụ |
|---|---|---|
| `HDG` | Prefix cố định, nhận dạng hệ thống | `HDG` |
| `STUDIO` | Anchor word để parser định vị | `STUDIO` |
| `{userId}` | ID người chơi trong database | `1234` |
| `{username}` | Tên đăng nhập (không có dấu cách) | `dang123` |
| `{amount}` | Số tiền (chỉ để điền sẵn, không dùng để cộng tiền) | `50000` |

**Ràng buộc:**
- `username` không được chứa khoảng trắng (vì parser split theo whitespace).
- `userId` phải là số nguyên hợp lệ.
- Toàn bộ chuỗi được `encodeURIComponent` khi tạo QR URL, ngân hàng decode lại khi hiển thị.

---

## 7. Tại sao chọn các giải pháp này

### VietQR + Casso thay vì PayOS hay Stripe

PayOS và Stripe yêu cầu tích hợp SDK phức tạp, có redirect flow, phí giao dịch, và quy trình xét duyệt. VietQR là chuẩn QR ngân hàng Việt Nam — người dùng chuyển khoản bình thường như mọi giao dịch khác, không cần tải thêm app hay điền thông tin thẻ. Casso đóng vai trò middleware lắng nghe giao dịch và gửi webhook — đơn giản, chi phí thấp, phù hợp với game indie.

### HMAC-SHA512 với sorted key

Đây là chuẩn Casso quy định (Webhook V2). Việc sort key giống Java TreeMap là yêu cầu bắt buộc từ phía Casso để đảm bảo cả hai bên tính HMAC trên cùng một chuỗi. Không tự chọn thuật toán — tuân theo spec của provider.

### rawBody cho HMAC, không dùng req.body

Framework parse JSON có thể normalize key order, loại bỏ trailing whitespace, hoặc re-serialize khác đi. HMAC phải tính trên chính xác bytes như Casso gửi. Đây là pattern tiêu chuẩn của mọi webhook verification (Stripe, GitHub, Casso đều yêu cầu tương tự).

### Anchor "STUDIO" thay vì split fixed index

Nội dung chuyển khoản thực tế không hoàn toàn kiểm soát được — ngân hàng trung gian, app mobile banking của từng nhà cung cấp có thể thêm prefix vào nội dung. Dùng anchor word linh hoạt hơn nhiều so với `parts[2]` cứng nhắc.

### amount từ Casso, không từ nội dung

Nguyên tắc bảo mật: **không bao giờ tin input từ client để xác định số tiền thực tế**. Người dùng có thể chỉnh sửa addInfo trước khi chuyển khoản. Số tiền Casso báo là số tiền ngân hàng thực sự ghi nhận — đây là nguồn sự thật duy nhất.

### Hai lớp service (REST Controller + gRPC Service)

REST Controller chỉ lo verify chữ ký và routing. Pay Service (gRPC) lo toàn bộ logic nghiệp vụ. Tách biệt này giúp: Pay Service có thể được gọi từ nhiều nguồn khác nhau (gRPC từ gateway, internal call...), và dễ test từng lớp độc lập.

---

## 8. Cấu hình cần thiết

### Environment Variables

```env
WEBHOOK_KEY=your_casso_webhook_secret_key
```

### main.ts — Bật rawBody

```typescript
import * as express from 'express';

// Trong bootstrap():
app.use(
  express.json({
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);
```

> ⚠️ Nếu không bật rawBody, controller sẽ trả 400 và toàn bộ webhook từ Casso bị bỏ qua.

### Casso Dashboard

- Tạo Webhook V2 với endpoint: `https://your-domain.com/webhook/casso`
- Copy Secret Key vào `WEBHOOK_KEY`
- Chọn sự kiện: **Giao dịch mới** (new transaction)

---

## 9. Các điểm cần lưu ý / edge cases

### Idempotency — Casso retry khi không nhận được 200

Nếu server trả lỗi hoặc timeout, Casso sẽ gửi lại webhook — cùng một `data.id` nhưng request mới. Hiện tại chưa có cơ chế check `tid` đã xử lý chưa. Cần bổ sung:

```typescript
const processed = await this.redis.get(`CASSO:TID:${tid}`);
if (processed) return; // Đã xử lý, bỏ qua

// ... xử lý ...

await this.redis.set(`CASSO:TID:${tid}`, '1', 'EX', 86400); // TTL 1 ngày
```

### Username có dấu cách

Parser split theo whitespace. Nếu username có dấu cách (hiếm nhưng có thể xảy ra), `parts[studioIndex + 2]` sẽ lấy sai. Nên enforce username không có dấu cách ở tầng đăng ký tài khoản.

### Chuyển khoản sai nội dung

Người dùng quên điền nội dung hoặc điền sai format → `studioIndex === -1` → log cảnh báo và bỏ qua. Tiền đến tài khoản ngân hàng nhưng không tự động cộng vào ví. Cần có quy trình manual xử lý những trường hợp này, hoặc thông báo người dùng kiểm tra lại nội dung.

### Số tiền âm hoặc bằng 0

`createPayOrder` chỉ validate `amount < 0`. Nên sửa thành `amount <= 0` để chặn QR số tiền bằng 0.

### Không có cơ chế timeout QR

QR được tạo ra không có expiry — người dùng có thể dùng QR cũ để nạp bất kỳ lúc nào. Nếu muốn giới hạn thời gian QR có hiệu lực, cần lưu QR session vào Redis kèm TTL và validate khi nhận webhook.

### Log nhạy cảm

`winstonLogger.log({ nhiemVu: 'thongBaoNapTien', username, amount })` — cần đảm bảo log này không chứa thông tin quá nhạy cảm (số tài khoản ngân hàng, họ tên đầy đủ) và log được lưu trữ bảo mật, không expose ra ngoài.