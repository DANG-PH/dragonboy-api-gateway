import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { join } from 'path';
import { PAY_PACKAGE_NAME } from 'proto/pay.pb';
import { PayController } from './pay.controller';
import { PayService } from './pay.service';
import { JwtStrategy } from 'src/security/JWT/jwt.strategy';
import { RolesGuard } from 'src/security/guard/role.guard';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: PAY_PACKAGE_NAME,
        transport: Transport.GRPC,
        options: {
          package: PAY_PACKAGE_NAME,
          protoPath: join(process.cwd(), 'proto/pay.proto'),
          url: process.env.PAY_URL,
          loader: {
                keepCase: true,
                objects: true,
                arrays: true,
          },
        },
      },
    ]),
  ],
  controllers: [PayController],
  providers: [PayService,JwtStrategy,RolesGuard],
  exports: [PayService]
})
export class PayModule {}
