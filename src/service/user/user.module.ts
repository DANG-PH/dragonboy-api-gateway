import { forwardRef, Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { join } from 'path';
import { USER_PACKAGE_NAME } from 'proto/user.pb';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { JwtStrategy } from 'src/security/JWT/jwt.strategy';
import { RolesGuard } from 'src/security/guard/role.guard';
import { JwtAuthGuard } from 'src/security/JWT/jwt-auth.guard';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: USER_PACKAGE_NAME,
        transport: Transport.GRPC,
        options: {
          package: USER_PACKAGE_NAME,
          protoPath: join(process.cwd(), 'proto/user.proto'),
          url: process.env.USER_URL,
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
  ],
  controllers: [UserController],
  providers: [UserService,JwtStrategy,JwtAuthGuard,RolesGuard],
  exports: [UserService]
})
export class UserModule {}
