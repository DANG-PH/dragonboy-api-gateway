import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { join } from 'path';
import { GAME_DATA_PACKAGE_NAME } from 'proto/game-data.pb';
import { JwtStrategy } from 'src/security/JWT/jwt.strategy';
import { RolesGuard } from 'src/security/guard/role.guard';
import { GameDataController } from './game-data.controller';
import { GameDataService } from './game-data.service';
import { AuthModule } from '../auth/auth.module';
import { ShopModule } from '../queue/modules/shop/shop.module';

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
    AuthModule,
    ShopModule
  ],
  controllers: [GameDataController],
  providers: [JwtStrategy,RolesGuard, GameDataService],
  exports: [GameDataService]
})
export class GameDataModule {}
