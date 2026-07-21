import { Inject, Injectable } from "@nestjs/common";
import { EventEmitter2, OnEvent } from "@nestjs/event-emitter";
import { Server, Socket } from 'socket.io';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { AuthService } from "../auth/auth.service";
import { LRUCache } from 'lru-cache';
import Redis from "ioredis";

@Injectable()
export class WsAuthService {
    // LRU Cache
    private tokenCache = new LRUCache<string, { value: number; exp: number }>({ max: 5000 });
    private redis: Redis;
    constructor(
        private eventEmitter: EventEmitter2,
        @Inject(CACHE_MANAGER) private cacheManager: Cache,
        private readonly authService: AuthService
    ) {
      this.redis = new Redis(process.env.REDIS_URL || '')
    }

    async ensureAuthFresh(client: Socket) {
    const now = Date.now();

    // chỉ check mỗi 30s
    if (now - (client.data.lastAuthCheck || now) < 30000) {
      return;
    }

    const user = client.data.user;

    const currentVersion = await this.getTokenVersionCached(user.userId, user.tokenVersion);

    if (currentVersion !== user.tokenVersion) {
      client.emit('force_logout', {
        message: 'Phiên đăng nhập đã hết hiệu lực',
      });

      client.disconnect(true);
      return;
    }

    client.data.lastAuthCheck = now;
  }

  
  async getTokenVersionCached(userId: number, tokenVersion: number): Promise<number> {
    const cached = this.tokenCache.get(String(userId));

    if (cached && cached.exp > Date.now()) {
      return cached.value;
    }

    const value = Number(
      await this.cacheManager.get<number>(`TOKEN_VER:${userId}`)
    );

    // Xử lí case key redis hết mà chưa sync kịp từ database
    if (value == null) {
      const lockKey = `FIXING:${userId}`;
      const acquired = await this.redis.set(lockKey, '1', 'EX', 5, 'NX');
      // 1. CHO QUA (fail-soft)

      // 2. Async fix (không block event) ( Chấp nhận do game MMORPG cần latency > consistency )
      if (acquired) {
        // Chỉ 1 instance (bất kể Instance A hay B) chạy fix
        this.eventEmitter.emit('auth.fix_token_version', userId);
      }
      this.tokenCache.set(String(userId), {
        value: tokenVersion,
        exp: Date.now() + 2000,
      });
      return Number(tokenVersion);
    }

    this.tokenCache.set(String(userId), {
      value,
      exp: Date.now() + 2000, // cache 2s
    });

    return value;
  }

  @OnEvent('auth.fix_token_version')
  async handleFixTokenVer(userId: number) {
    const { tokenVersion } = await this.authService.handleGetTokenVersion({ userId: userId});
    await this.cacheManager.set(`TOKEN_VER:${userId}`, tokenVersion, 10 * 60 * 1000);
  }
}