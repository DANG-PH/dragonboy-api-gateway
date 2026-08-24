import { Module } from '@nestjs/common';
import { JwtStrategy } from 'src/security/JWT/jwt.strategy';
import { RolesGuard } from 'src/security/guard/role.guard';
import { AuthModule } from 'src/service/auth/auth.module';
import { SocialNetworkController } from './social_network.controller';
import { SocialNetworkService } from './social-network.service';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { join } from 'path';
import { SOCIALNETWORK_PACKAGE_NAME } from 'proto/social-network.pb';
import { WsChatModule } from '../chat/ws-chat.module';
import { forwardRef } from '@nestjs/common';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: SOCIALNETWORK_PACKAGE_NAME,
        transport: Transport.GRPC,
        options: {
          package: SOCIALNETWORK_PACKAGE_NAME,
          protoPath: join(process.cwd(), 'proto/social-network.proto'),
          url: process.env.SOCIAL_URL,
          loader: {
            keepCase: true,
            objects: true,
            arrays: true,
          },
        },
      },
    ]),
    forwardRef(() => AuthModule),
    forwardRef(() => WsChatModule)
  ],
  controllers: [SocialNetworkController],
  providers: [SocialNetworkService,JwtStrategy,RolesGuard],
  exports: [SocialNetworkService]
})
export class SocialNetworkModule {}
