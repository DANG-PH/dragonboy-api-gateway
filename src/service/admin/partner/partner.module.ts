import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { join } from 'path';
import { ADMIN_PACKAGE_NAME } from 'proto/admin.pb';
import { PartnerController } from './partner.controller';
import { PartnerService } from './partner.service';
import { JwtStrategy } from 'src/security/JWT/jwt.strategy';
import { RolesGuard } from 'src/security/guard/role.guard';
import { UserModule } from 'src/service/user/user.module';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: ADMIN_PACKAGE_NAME,
        transport: Transport.GRPC,
        options: {
          package: ADMIN_PACKAGE_NAME,
          protoPath: join(process.cwd(), 'proto/admin.proto'),
          url: process.env.ADMIN_URL,
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
  controllers: [PartnerController],
  providers: [PartnerService,JwtStrategy,RolesGuard],
  exports: [PartnerService]
})
export class PartnerModule {}
