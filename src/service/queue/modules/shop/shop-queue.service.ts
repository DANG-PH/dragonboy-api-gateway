import { Injectable, Logger, Inject } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ClientProxy } from '@nestjs/microservices';
import { SHOP_START_QUEUE } from '../../queue.constants';

export interface ShopStartJobData {
  itemId: number;
  npcId: number;
}

@Injectable()
export class ShopQueueService {
  private readonly logger = new Logger(ShopQueueService.name);

  constructor(
    @InjectQueue(SHOP_START_QUEUE) private readonly shopStartQueue: Queue<ShopStartJobData>,
  ) {}

  /**
   * Schedule job để active item khi đến start_at.
   * Nếu start_at đã qua hoặc null → không tạo job.
   */
  async scheduleStartItem(itemId: number, npcId: number, startAt: number | null): Promise<void> {
    if (!startAt) return;

    const delayMs = startAt - Date.now();
    if (delayMs <= 0) {
      this.logger.warn(`Item ${itemId} có start_at đã qua (${startAt}), skip schedule.`);
      return;
    }

    const jobId = `start-shop-${itemId}`;

    // Xóa job cũ nếu có (handle case admin sửa start_at)
    await this.removeStartJob(itemId);

    await this.shopStartQueue.add(
      'start-shop-item',
      { itemId, npcId },
      {
        delay: delayMs,
        jobId,
        removeOnComplete: true,
        removeOnFail: false,  // giữ failed job để debug
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      },
    );
  }

  /**
   * Hủy job start (khi admin sửa start_at hoặc xóa item).
   */
  async removeStartJob(itemId: number): Promise<void> {
    const jobId = `start-shop-${itemId}`;
    const job = await this.shopStartQueue.getJob(jobId);
    if (job) {
      await job.remove();
    }
  }
}