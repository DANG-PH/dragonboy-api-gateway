import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Inject } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Cache } from '@nestjs/cache-manager';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { HttpException, HttpStatus } from '@nestjs/common';

@Injectable()
export class TemporaryBanInterceptor implements NestInterceptor {
  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  async intercept(context: ExecutionContext, next: CallHandler<any>): Promise<Observable<any>> {
    const req = context.switchToHttp().getRequest();
    const userId = req.user?.userId;

    if (userId) {
        const ban = await this.cacheManager.get(`temporary-ban:${userId}`) as {
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
    }

    return next.handle();
  }
}
