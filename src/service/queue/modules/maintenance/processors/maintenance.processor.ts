import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { Job } from 'bullmq';
import { firstValueFrom } from 'rxjs';
import Redis from 'ioredis';
import { MAINTENANCE_QUEUE } from '../../../queue.constants';

const MAINTENANCE_KEY = 'maintenance:active';
const MAINTENANCE_TTL = 3600; // 1 tiếng

@Processor(MAINTENANCE_QUEUE)
export class MaintenanceProcessor extends WorkerHost {

  constructor(
    @Inject(String(process.env.RABBIT_GAME_SERVICE))
    private readonly gameClient: ClientProxy,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {
    super();
  }

  async process(job: Job<{ startAt: number }>): Promise<void> {
    const startedAt = Date.now();

    // 1. Set flag cố định, có metadata để hiển thị
    await this.redis.set(
      MAINTENANCE_KEY,
      JSON.stringify({
        startedAt,
        startedAtFormatted: new Date(startedAt).toLocaleString('vi-VN'),
        reason: 'Bảo trì hàng ngày',
      }),
      'EX',
      MAINTENANCE_TTL,
    );

    // 2. Emit logout - await để retry hoạt động đúng (để bullmq retry nếu có lỗi, k fire and forget)
    await firstValueFrom(this.gameClient.emit('game.logout_all', {}));

    // 3. Invalid cache, Daily reset (Chưa có nhưng có thể làm sau/hoặc item per-user/per-day)
    
    // 4. Move logic alert doanh thu từ cron 12h vào đây (4h sáng)

    // 5. Lấy data setup từ queue task redis như đổi map, đổi vị trí npc, ...

    // 6. TODO: Alert
  }
}