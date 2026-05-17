import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ShopQueueService } from './shop-queue.service';
import { ShopStartProcessor } from './processors/shop-start.processor';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: String(process.env.RABBIT_GAME_SERVICE),
        transport: Transport.RMQ,
        options: {
          urls: [String(process.env.RABBIT_URL)],
          queue: process.env.RABBIT_GAME_QUEUE,
          queueOptions: { durable: true },
        },
      },
    ]),
  ],
  providers: [
    ShopQueueService,
    ShopStartProcessor,
  ],
  exports: [
    ShopQueueService,
  ],
})
export class ShopModule {}