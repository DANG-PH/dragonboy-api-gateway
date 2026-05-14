import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { Job } from 'bullmq';
import Redis from 'ioredis';
import { SHOP_START_QUEUE } from './queue.constants';
import { ShopStartJobData } from './shop-queue.service';

@Processor(SHOP_START_QUEUE)
export class ShopStartProcessor extends WorkerHost {
    constructor(
        @Inject(String(process.env.RABBIT_GAME_SERVICE))
        private readonly gameClient: ClientProxy,
        @Inject('REDIS_CLIENT') private readonly redis: Redis,
    ) {
        super();
    }

    async process(job: Job<ShopStartJobData>): Promise<void> {
        const { itemId, npcId } = job.data;

        // 1. Invalidate cache server
        await this.redis.del(`shop:npc:${npcId}`);

        // 2. Emit cho client reload shop
        this.gameClient.emit('game.reload_shop', { npcId });

        // 3. TODO: Alert cho admin & user
        // Alert Discord/Email/Telegram cho admin
        // Alert Realtime cho user đang chơi game
        // Alert tới mail các user
    }
}