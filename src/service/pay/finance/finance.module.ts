import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { join } from 'path';
import { PAY_PACKAGE_NAME } from 'proto/pay.pb';
import { FinanceController } from './finance.controller';
import { FinanceService } from './finance.service';
import { JwtStrategy } from 'src/security/JWT/jwt.strategy';
import { RolesGuard } from 'src/security/guard/role.guard';
import { UserModule } from 'src/service/user/user.module';

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
    UserModule,
  ],
  controllers: [FinanceController],
  providers: [FinanceService,JwtStrategy,RolesGuard],
  exports: [FinanceService]
})
export class FinanceModule {}
