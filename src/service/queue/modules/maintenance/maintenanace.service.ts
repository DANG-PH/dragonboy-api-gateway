import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { MAINTENANCE_QUEUE } from '../../queue.constants';

@Injectable()
export class MaintenanceService {
  private readonly logger = new Logger(MaintenanceService.name);

  constructor(
    @InjectQueue(MAINTENANCE_QUEUE) private readonly maintenanceQueue: Queue,
  ) {}

  async startMaintenance(startAt: number | null): Promise<void> {
    if (!startAt) return;

    const delayMs = startAt - Date.now();
    if (delayMs <= 0) {
      this.logger.warn(`startAt ${startAt} đã qua, bỏ qua`);
      return;
    }

    const jobId = `maintenance-${startAt}`;

    await this.maintenanceQueue.add(
      'start-maintenance',
      { startAt },
      {
        delay: delayMs,
        jobId,
        removeOnComplete: true,
        removeOnFail: false,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      },
    );

    this.logger.log(`Đã schedule bảo trì lúc ${new Date(startAt).toLocaleString('vi-VN')}`);
  }
}