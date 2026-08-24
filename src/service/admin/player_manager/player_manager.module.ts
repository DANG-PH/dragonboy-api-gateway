import { Module } from '@nestjs/common';
import { PlayerManagerController } from './player_manager.controller'
import { JwtStrategy } from 'src/security/JWT/jwt.strategy';
import { RolesGuard } from 'src/security/guard/role.guard';
import { AuthModule } from 'src/service/auth/auth.module';
import { UserModule } from 'src/service/user/user.module';
import { ItemModule } from 'src/service/item/item.module';
import { DeTuModule } from 'src/service/detu/detu.module';
import { PayModule } from 'src/service/pay/pay/pay.module';
import { FinanceModule } from 'src/service/pay/finance/finance.module';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { MaintenanceModule } from 'src/service/queue/modules/maintenance/maintenance.module';
// import { PlayerManagerService } from './player_manager.service';

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
    AuthModule, UserModule, ItemModule, DeTuModule, PayModule, FinanceModule, MaintenanceModule
  ],
  controllers: [PlayerManagerController],
  providers: [
    JwtStrategy,
    RolesGuard,
    // PlayerManagerService
  ],
  exports: [
    // PlayerManagerService
  ],
})
export class PlayerManagerModule {}
