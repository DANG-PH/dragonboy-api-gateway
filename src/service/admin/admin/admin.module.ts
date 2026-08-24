import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { JwtStrategy } from 'src/security/JWT/jwt.strategy';
import { RolesGuard } from 'src/security/guard/role.guard';
import { AuthModule } from 'src/service/auth/auth.module';
import { UserModule } from 'src/service/user/user.module';
import { ItemModule } from 'src/service/item/item.module';
import { DeTuModule } from 'src/service/detu/detu.module';
import { PayModule } from 'src/service/pay/pay/pay.module';
import { PartnerModule } from '../partner/partner.module';
import { ClientsModule, Transport } from '@nestjs/microservices';

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
    AuthModule, UserModule, ItemModule, DeTuModule, PayModule, PartnerModule
  ],
  controllers: [AdminController],
  providers: [JwtStrategy,RolesGuard]
})
export class AdminModule {}
