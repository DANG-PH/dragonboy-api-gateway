import { Injectable, Inject, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { AuthService } from 'src/service/auth/auth.service';
import { RpcException } from '@nestjs/microservices';
import { status } from '@grpc/grpc-js';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt-1gio') {
    constructor(
        @Inject(CACHE_MANAGER) private cacheManager: Cache,
        private readonly authService: AuthService // DI được ( đọc comment cuối auth.module.ts )
    ) {
        super(); 
    }

    /**
     * @Override
     * @param context 
     * @returns 
     */
    async canActivate(context: ExecutionContext): Promise<boolean> {
        // Không override ( trước đây ):
        // AuthGuard.canActivate() → tự động chạy hết → gắn request.user ✅

        // Override ( hiện tại ):
        // canActivate() của bạn chạy → KHÔNG có gì xảy ra
        // → phải gọi super.canActivate() để trigger flow gốc ( tức là thay vì để nó tự gọi thì giờ override lại thì phải viết lại thủ công, vì mình đã thay thế hàm cũ bằng hàm mới )
        // → sau đó mới có request.user

        // 1. Chạy JWT strategy trước (verify signature, expiry)

        const isValid = await super.canActivate(context) as boolean;
        if (!isValid) return false;

        // 2. Lấy payload từ request (đã được JwtStrategy gắn vào)
        const request = context.switchToHttp().getRequest();
        const user = request.user; // { userId, tokenVersion, ... }

        // 3. Check tokenVersion
        const currentVersion = await this.getTokenVersion(user.userId);
        if (user.tokenVersion !== currentVersion) {
            throw new UnauthorizedException('Phiên đăng nhập đã hết hạn');
        }

        return true;
    }

    private async getTokenVersion(userId: number): Promise<number> {
        // Cache-first
        const cached = await this.cacheManager.get<number>(`TOKEN_VER:${userId}`);
        if (cached !== null && cached !== undefined) return cached;

        // Cache miss -> gọi DB qua authService
        const { tokenVersion } = await this.authService.handleGetTokenVersion({ userId: userId});
        await this.cacheManager.set(`TOKEN_VER:${userId}`, tokenVersion, 10 * 60 * 1000);
        return tokenVersion;
    }
}