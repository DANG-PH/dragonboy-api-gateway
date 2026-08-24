import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { join } from 'path';
import { ITEM_PACKAGE_NAME } from 'proto/item.pb';
import { ItemService } from './item.service';
import { ItemController } from './item.controller';
import { JwtStrategy } from 'src/security/JWT/jwt.strategy';
import { RolesGuard } from 'src/security/guard/role.guard';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: ITEM_PACKAGE_NAME,
        transport: Transport.GRPC,
        options: {
          package: ITEM_PACKAGE_NAME,
          protoPath: join(process.cwd(), 'proto/item.proto'),
          url: process.env.ITEM_URL,
          loader: {
                keepCase: true,
                objects: true,
                arrays: true,
          },
        },
      },
    ]),
  ],
  controllers: [ItemController],
  providers: [ItemService,JwtStrategy,RolesGuard],
  exports: [ItemService]
})
export class ItemModule {}
