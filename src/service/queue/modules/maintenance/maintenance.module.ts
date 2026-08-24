import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { MaintenanceService } from './maintenanace.service';
import { MaintenanceProcessor } from './processors/maintenance.processor';

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
  ],
  providers: [
    MaintenanceService,
    MaintenanceProcessor
  ],
  exports: [
    MaintenanceService
  ],
})
export class MaintenanceModule {}