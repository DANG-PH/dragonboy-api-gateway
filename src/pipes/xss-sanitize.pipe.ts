import { PipeTransform, Injectable, ArgumentMetadata } from '@nestjs/common';
import * as sanitizeHtml from 'sanitize-html';

// Các field KHÔNG sanitize (giữ nguyên ký tự đặc biệt)
const SKIP_SANITIZE_FIELDS = new Set([
  'password',
  'oldPassword',
  'newPassword',
  'username',
  'email'
]);

@Injectable()
export class XssSanitizePipe implements PipeTransform {

  // Cấu hình sanitizeHtml: không cho phép bất kỳ tag hay attribute HTML nào
  // discard = xóa luôn tag thay vì báo lỗi
  private readonly options: sanitizeHtml.IOptions = {
    allowedTags: [],
    allowedAttributes: {},
    disallowedTagsMode: 'discard',
  };

  /**
   * @Override - Bắt buộc implement từ interface PipeTransform
   * NestJS tự động gọi hàm này trước khi dữ liệu vào Controller
   * 
   * @param value    - Giá trị thực tế từ request (body, query, param...)
   * @param metadata - Thông tin mô tả value đó: type là 'body'|'query'|'param'|'custom'
   */
  transform(value: any, metadata: ArgumentMetadata) {

    // Chỉ sanitize các nguồn dữ liệu từ client, bỏ qua các loại khác (custom...)
    if (metadata.type === 'body' || metadata.type === 'query' || metadata.type === 'param') {
      return this.sanitize(value);
    }

    // Không thuộc các loại trên thì trả về nguyên bản
    return value;
  }

  /**
   * Đệ quy sanitize toàn bộ dữ liệu đầu vào
   * Xử lý được mọi cấu trúc: string, object lồng nhau, array
   * 
   * @param value      - Giá trị cần sanitize (bất kỳ kiểu nào)
   * @param fieldName  - Tên field đang xử lý, dùng để kiểm tra whitelist skip
   */
  private sanitize(value: any, fieldName?: string): any {

    // Nếu field nằm trong danh sách SKIP (password...) → giữ nguyên không sanitize
    if (fieldName && SKIP_SANITIZE_FIELDS.has(fieldName)) {
      return value;
    }

    // String → sanitize trực tiếp, strip toàn bộ HTML/script
    // VD: "<script>alert(1)</script>hello" → "hello"
    if (typeof value === 'string') {
      return sanitizeHtml(value, this.options);
    }

    // Array → duyệt từng phần tử, gọi đệ quy
    // Không truyền fieldName vì phần tử array không có tên field riêng
    // VD: ["<b>hello</b>", "<script>xss</script>"] → ["hello", ""]
    if (Array.isArray(value)) {
      return value.map(item => this.sanitize(item));
    }

    // Object → duyệt từng key, gọi đệ quy và truyền key làm fieldName
    // Xử lý được object lồng nhau nhiều cấp
    // VD: { user: { name: "<b>John</b>", password: "<pass@123>" } }
    //   → { user: { name: "John",        password: "<pass@123>" } } ← password giữ nguyên
    if (value !== null && typeof value === 'object') {
      const sanitized: Record<string, any> = {};
      for (const key of Object.keys(value)) {
        sanitized[key] = this.sanitize(value[key], key); // key trở thành fieldName ở tầng tiếp theo
      }
      return sanitized;
    }

    // Các kiểu còn lại (number, boolean, null) → không cần sanitize, trả về nguyên bản
    return value;
  }
}