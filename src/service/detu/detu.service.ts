import { Injectable, Inject, Logger } from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import Redis from 'ioredis';
import {
    SaveGameDeTuRequest,
    SaveGameDeTuResponse,
    CreateDeTuRequest,
    CreateDeTuResponse,
    GetDeTuRequest,
    DeTuResponse,
    DeTuServiceClient,
    DETU_PACKAGE_NAME,
    DE_TU_SERVICE_NAME
} from 'proto/detu.pb';
import { grpcCall } from 'src/helpers/grpc.helper';

@Injectable()
export class DeTuService {
  private readonly logger = new Logger(DeTuService.name);
  private deTuGrpcService: DeTuServiceClient;

  constructor(
    @Inject(DETU_PACKAGE_NAME) private readonly client: ClientGrpc,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {}

  onModuleInit() {
    this.deTuGrpcService = this.client.getService<DeTuServiceClient>(DE_TU_SERVICE_NAME);
  }

  async handleSaveDeTu(req: SaveGameDeTuRequest): Promise<SaveGameDeTuResponse> {
    // Client gọi mỗi 20s — nhưng vẫn check dirty
    // vì player không có action -> đệ k tăng gì cả (sức mạnh...) nên k save
    // Sau thêm event nếu mặc đồ cho đệ, tăng sm đệ thì set là dirty
    const isDirty = await this.redis.exists(`dirty:${req.userId}`);
    if (!isDirty) {
      return;
    }
    return grpcCall(DeTuService.name,this.deTuGrpcService.saveGameDeTu(req));
  }

  async handleCreateDeTu(req: CreateDeTuRequest): Promise<CreateDeTuResponse> {
    return grpcCall(DeTuService.name,this.deTuGrpcService.createDeTu(req));
  }

  async handleGetDeTu(req: GetDeTuRequest): Promise<DeTuResponse> {
    return grpcCall(DeTuService.name,this.deTuGrpcService.getDeTuByUserId(req));
  }
}
