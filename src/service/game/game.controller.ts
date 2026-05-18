import { randomUUID } from 'crypto';
import { JwtAuthGuard } from 'src/security/JWT/jwt-auth.guard';
import { Controller, Post, UseGuards, Req, Inject, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';
import Redis from 'ioredis';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ClientProxy } from '@nestjs/microservices';

const PLAY_SCRIPT = `
  local key = KEYS[1]
  local newId = ARGV[1]
  local ttl = tonumber(ARGV[2])

  local oldId = redis.call('GETSET', key, newId)
  redis.call('EXPIRE', key, ttl)

  if oldId then
    return oldId
  end

  return false
`;

@Controller('game')
@ApiTags('Api Game')
export class GameController {

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private eventEmitter: EventEmitter2,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
    @Inject(String(process.env.RABBIT_GAME_SERVICE)) private readonly gameClient: ClientProxy,
  ) {}

  @Post('play')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'User vào chơi game sau khi verifyOTP và ở màn hình menu' })
  async play(@Req() req: any) {
    // Check bảo trì (fail past nhanh ở đây)
    // Nếu k fail past nhanh ở đây thì logic security vẫn đúng
    // Nhưng trải nghiệm người dùng tệ vì /play pass -> màn hình loading
    // Chạy màn loading xong vào game mới connect ws xong -> mới đc emit để văng game ra -> ux tệ
    const maintenanceInfo = await this.redis.get('maintenance:active');
    if (maintenanceInfo) {
        throw new HttpException(
            "Server đang bảo trì, vui lòng thử lại sau",
            HttpStatus.SERVICE_UNAVAILABLE,
        );
    }

    const { userId } = req.user;
    const gameSessionId = randomUUID();

    // Atomic
    // Tất cả trong 1 round-trip Redis, không có race condition
    const oldSessionId = await this.redis.eval(
      PLAY_SCRIPT,
      1,
      `user:${userId}:gameSession`,
      gameSessionId,
      '86400',
    ) as string | null;

    if (oldSessionId) {
      // Kick bằng userId, adapter tự tìm đúng server
      this.gameClient.emit('auth.kick_socket', { userId: userId });
    }

    return { success: true, gameSessionId };
  }
}