import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { join } from 'path';
import { DETU_PACKAGE_NAME } from 'proto/detu.pb';
import { DeTuController } from './detu.controller';
import { DeTuService } from './detu.service';
import { JwtStrategy } from 'src/security/JWT/jwt.strategy';
import { RolesGuard } from 'src/security/guard/role.guard';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: DETU_PACKAGE_NAME,
        transport: Transport.GRPC,
        options: {
          package: DETU_PACKAGE_NAME,
          protoPath: join(process.cwd(), 'proto/detu.proto'),
          url: process.env.DETU_URL,
          loader: {
                keepCase: true,
                objects: true,
                arrays: true,
          },
        },
      },
    ]),
  ],
  controllers: [DeTuController],
  providers: [DeTuService,JwtStrategy,RolesGuard],
  exports: [DeTuService]
})
export class DeTuModule {}
