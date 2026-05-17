import { Module, Global } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import {
  SHOP_START_QUEUE,
} from './queue.constants';

@Global()
@Module({
  imports: [
    BullModule.forRoot({
        connection: {
        url: process.env.REDIS_URL,
        maxRetriesPerRequest: null,
        },
    }),
    BullModule.registerQueue({ name: SHOP_START_QUEUE }),
  ],
  exports: [BullModule],
})
export class QueueModule {}