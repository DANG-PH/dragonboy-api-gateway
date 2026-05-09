import { Injectable, CanActivate, ExecutionContext, Inject, HttpException, HttpStatus } from '@nestjs/common';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import Redis from 'ioredis';
// import { JwtService } from '@nestjs/jwt';

@Injectable()
export class TemporaryBanGuard implements CanActivate {
  constructor(
    // @Inject(CACHE_MANAGER) private cacheManager: Cache, // cách cũ (commit 328 đổ về)
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
    // private jwtService: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();

    // Lấy payload đã decode sẵn từ JwtDecodeMiddleware — không verify lại
    const payload = req['_jwtPayload'];
    if (!payload?.userId) return true; // gộp 2 check thành 1

    const raw = await this.redis.get(`temporary-ban:${payload.userId}`)
    if (!raw) return true;

    const ban = JSON.parse(raw) as {
      admin: string;
      expireAt: string;
      why: string;
    };

    if (ban) {
      throw new HttpException(
        `Tài khoản đang bị khóa đến ${ban.expireAt}. Lý do: ${ban.why}, vui lòng liên hệ ADMIN ${ban.admin}`,
        HttpStatus.FORBIDDEN,
      );
    }

    return true;
  }

  // Logic cũ 

  // async canActivate(context: ExecutionContext): Promise<boolean> {
  //   // vì Guard này chạy trc JwtAuthGuard nên là k có req.user, phải tự lấy data từ trên token
  //   const req = context.switchToHttp().getRequest();

  //   // Sau fix chỗ này vì đang làm tăng latency vì decode 2 lần
  //   // Tự decode token thay vì phụ thuộc req.user
  //   const token = this.extractToken(req);
  //   if (!token) return true; // không có token => không check ban

  //   let userId: string;
  //   try {
  //     const payload = this.jwtService.verify(token, {
  //       secret: process.env.JWT_SECRET,
  //     });
  //     userId = payload.userId;
  //   } catch {
  //     return true; // token invalid => để JwtAuthGuard xử lý sau
  //   }

  //   if (userId) {
  //     const ban = await this.cacheManager.get(`temporary-ban:${userId}`) as {
  //       admin: string;
  //       expireAt: string;
  //       why: string;
  //     };

  //     if (ban) {
  //       throw new HttpException(
  //         `Tài khoản đang bị khóa đến ${ban.expireAt}. Lý do: ${ban.why}, vui lòng liên hệ ADMIN ${ban.admin}`,
  //         HttpStatus.FORBIDDEN,
  //       );
  //     }
  //   }

  //   return true;
  // }

  // private extractToken(req: any): string | null {
  //   const authHeader = req.headers?.authorization;
  //   if (authHeader?.startsWith('Bearer ')) {
  //     return authHeader.substring(7);
  //   }
  //   return null;
  // }
}