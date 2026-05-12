import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { join } from 'path';
import { GAME_DATA_PACKAGE_NAME } from 'proto/game-data.pb';
import { JwtStrategy } from 'src/security/JWT/jwt.strategy';
import { RolesGuard } from 'src/security/guard/role.guard';
import { GameDataController } from './game-data.controller';
import { GameDataService } from './game-data.service';
import { BullModule } from '@nestjs/bullmq';
import { ShopQueueService } from './queue/shop-queue.service';
import { ShopStartProcessor } from './queue/shop-start.processor';
import { SHOP_START_QUEUE } from './queue/queue.constants';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: GAME_DATA_PACKAGE_NAME,
        transport: Transport.GRPC,
        options: {
          package: GAME_DATA_PACKAGE_NAME,
          protoPath: join(process.cwd(), 'proto/game-data.proto'),
          url: process.env.GAME_DATA_URL,
          loader: {
                keepCase: true,
                objects: true,
                arrays: true,
          },
        },
      },
    ]),
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
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
      },
    }),
    BullModule.registerQueue({ name: SHOP_START_QUEUE }),
  ],
  controllers: [GameDataController],
  providers: [JwtStrategy,RolesGuard, GameDataService, ShopQueueService, ShopStartProcessor],
  exports: [GameDataService]
})
export class GameDataModule {}
