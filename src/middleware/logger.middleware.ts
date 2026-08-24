import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger(LoggerMiddleware.name);

  use(req: Request, res: Response, next: NextFunction) {
    const { method, originalUrl } = req;
    const start = Date.now();

    res.on('finish', () => {
      const duration   = Date.now() - start;
      const statusCode = res.statusCode;
      const message    = `${method} ${originalUrl} → ${statusCode} (${duration}ms)`;

      if (statusCode >= 500) {
        // 5xx → đỏ, server có vấn đề, cần xem ngay
        this.logger.error(message);
      } else if (statusCode >= 400) {
        // 4xx → vàng, lỗi từ phía client (sai input, không có quyền...)
        this.logger.warn(message);
      } else {
        // 2xx, 3xx → xanh, bình thường
        this.logger.log(message);
      }
    });

    next();
  }
}

// Middleware nằm ở ngoài cùng, nên rất phù hợp để:
// Ghi lại request method, url, body
// Phát hiện lỗi sớm
// Dễ debug khi dev