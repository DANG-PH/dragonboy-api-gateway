// src/filters/http-exception.filter.ts
import {
  ExceptionFilter,  // Interface bắt buộc implement
  Catch,            // Decorator khai báo filter này bắt loại lỗi gì
  ArgumentsHost,    // Object chứa context của request hiện tại (HTTP/WS/RPC)
  HttpException,    // Class base của mọi HTTP error trong NestJS
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * @Catch() không truyền tham số → bắt TẤT CẢ loại exception
 * Nếu viết @Catch(HttpException) → chỉ bắt HTTP error, còn lỗi DB/Runtime sẽ lọt qua
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  /**
   * @Override - Bắt buộc implement từ interface ExceptionFilter
   * NestJS tự động gọi hàm này khi có exception xảy ra ở bất kỳ đâu
   *
   * @param exception - Lỗi bị throw (có thể là HttpException, Error, string, bất cứ thứ gì)
   * @param host      - Context hiện tại, dùng để lấy req/res object
   */
  catch(exception: unknown, host: ArgumentsHost): void {

    // switchToHttp() → chuyển sang HTTP context (vì app có thể dùng cả WebSocket)
    // getRequest/getResponse → lấy object req, res của Express
    const ctx      = host.switchToHttp();
    const request  = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    // Phân loại lỗi:
    // HttpException  → lỗi có chủ đích (404 Not Found, 401 Unauthorized, 400 Bad Request...)
    // Các loại khác  → lỗi bất ngờ (DB connection fail, null pointer, timeout...)
    const isHttpException = exception instanceof HttpException;

    const statusCode = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR; // 500

    // Lấy message an toàn để trả về client
    // HttpException có sẵn message được lập trình viên định nghĩa
    // Lỗi khác → trả về chuỗi generic, KHÔNG trả stack trace
    const message = isHttpException
      ? exception.message
      : 'Internal server error';

    // Trả về response chuẩn hóa cho client
    // Không có stack trace, không có tên file, không có số dòng
    response.status(statusCode).json({
      statusCode,
      message,
      path:      request.url,       // giúp client biết endpoint nào lỗi
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Global Exception Filter — Bộ lọc lỗi toàn cục
 *
 * Tác dụng:
 *   Bắt TẤT CẢ exception chưa được xử lý trong toàn bộ ứng dụng
 *   Chuẩn hoá response lỗi về 1 format thống nhất trước khi trả về client
 *
 * Lợi ích so với không dùng (NestJS default):
 *
 *   1. Ẩn stack trace ở production
 *      Mặc định NestJS trả cả file path, số dòng, tên hàm ra response
 *      → hacker đọc được cấu trúc project
 *      Filter này chỉ trả "Internal server error", stack trace giữ trong log nội bộ
 *
 *   2. Response format thống nhất
 *      Mặc định mỗi loại lỗi trả format khác nhau → frontend phải xử lý nhiều case
 *      Filter này đảm bảo mọi lỗi đều có: statusCode, errorCode, message, path, timestamp
 *
 *   3. Phân biệt lỗi có chủ đích vs lỗi bất ngờ qua errorCode
 *      HttpException (404, 401...) 
 *      Lỗi DB crash, null pointer  
 */