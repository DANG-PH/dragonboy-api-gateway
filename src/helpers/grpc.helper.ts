import { HttpException, HttpStatus } from '@nestjs/common';
import { catchError, throwError } from 'rxjs';
import { status as grpcStatus } from '@grpc/grpc-js';
import { firstValueFrom, lastValueFrom, Observable } from 'rxjs';
import { winstonLogger } from 'src/logger/logger.config'; 
import { getBreakerFor } from './circuit-breaker.registry';
import { BrokenCircuitError, IsolatedCircuitError } from 'cockatiel';

// Parse lỗi gRPC sang Http
export function grpcToHttp(code: number | null) {
  switch (code) {
    case grpcStatus.OK:                  return 200;  // 0
    case grpcStatus.INVALID_ARGUMENT:    return 400;  // 3 - dữ liệu đầu vào sai
    case grpcStatus.NOT_FOUND:           return 404;  // 5 - không tìm thấy
    case grpcStatus.ALREADY_EXISTS:      return 409;  // 6 - đã tồn tại
    case grpcStatus.PERMISSION_DENIED:   return 403;  // 7 - không có quyền
    case grpcStatus.RESOURCE_EXHAUSTED:  return 429;  // 8 - rate limit
    case grpcStatus.FAILED_PRECONDITION: return 400;  // 9 - điều kiện không thỏa (số dư không đủ,...)
    case grpcStatus.UNAUTHENTICATED:     return 401;  // 16 - chưa xác thực
    case grpcStatus.CANCELLED:           return 400;  // 1 - request bị cancel (tự bán acc chính mình,...)
    default:                             return 500;
  }
}

export function parseGrpcError(err: any) {
  if (err?.code !== undefined && err?.details) {
    return { code: err.code, message: err.details };
  }
}

export async function grpcCall<T>(serviceName = 'UnknownService',obs: Observable<T>, useLastValue = false, metadata?): Promise<T> {
  const wrapped = obs.pipe(
    catchError(err => {
      const parsed = parseGrpcError(err);
      const httpStatus = grpcToHttp(parsed.code);

      const message = `🆘 Error → HTTP ${httpStatus}: ${parsed.message}`;
      if (httpStatus >= 500) {
        winstonLogger.error({ message, service: serviceName, admin: process.env.ADMIN_TEST });
      }
      // trả về Observable<never> chứa error
      // pipe() nhận Observable này, tiếp tục chain
      return throwError(() => new HttpException(parsed.message, httpStatus));
    })
  );

  // CB lấy theo serviceName — mỗi service có breaker riêng.
  // Nếu CB đang OPEN hoặc ISOLATED: throw BrokenCircuitError ngay,
  // không execute callback, không gọi gRPC gì cả.
  const breaker = getBreakerFor(serviceName);

  try {
    return await breaker.execute(() =>
      useLastValue ? lastValueFrom(wrapped) : firstValueFrom(wrapped)
    );
    // → firstValueFrom(wrapped) subscribe Observable đó
    // → Observable emit error → firstValueFrom reject với HttpException
    // → breaker.execute() nhận reject → throw HttpException ra ngoài
    // → catch (err) bắt được ← lúc này mới throw thật
  } catch (err) {
    // CB đang OPEN hoặc ISOLATED — service tạm thời không khả dụng
    // Trả 503 thay vì 500 để client biết đây là vấn đề tạm thời, không phải lỗi logic
    if (err instanceof BrokenCircuitError || err instanceof IsolatedCircuitError) {
      throw new HttpException(
        'Service temporarily unavailable, please try again later',
        HttpStatus.SERVICE_UNAVAILABLE, // 503
      );
    }
    throw err; // lỗi thực từ service → throw lên bình thường
  }
}