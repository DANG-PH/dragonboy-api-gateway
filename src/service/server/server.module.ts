import { Module } from '@nestjs/common';
import { ServerController } from './server.controller';
import { JwtStrategy } from 'src/security/JWT/jwt.strategy';
import { RolesGuard } from 'src/security/guard/role.guard';

@Module({
  imports: [],
  controllers: [ServerController],
  providers: [JwtStrategy,RolesGuard]
})
export class ServerModule {}
