import { Injectable, NestMiddleware } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Request, Response, NextFunction } from 'express';

// Middleware này giảm tải cho việc verify 2 lần ở temporary ban và ratelimit middleware
// Nhưng vẫn sẽ bị duplicate với passport (accept được vì việc implement thêm 1 lần decode
// đổi lại độ phức tạp chưa đáng so với latency tiết kiệm được)
// Giảm được 1 lần JWT verify ~1-2ms
@Injectable()
export class JwtDecodeMiddleware implements NestMiddleware {
  constructor(private jwtService: JwtService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const token = req.headers['authorization']?.replace('Bearer ', '');
    if (token) {
        try {
        req['_jwtPayload'] = this.jwtService.verify(token, {
            secret: process.env.JWT_SECRET,
        });
        } catch {}
    }
    next();
  }
}