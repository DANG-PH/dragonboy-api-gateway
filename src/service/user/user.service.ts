import { Injectable, Inject, Logger } from '@nestjs/common';
import type { ClientGrpc, ClientProxy } from '@nestjs/microservices';
import {
  RegisterRequest,
  RegisterResponse,
  SaveGameRequest,
  SaveGameResponse,
  UserResponse,
  AddItemRequest,
  BalanceResponse,
  GetUserRequest,
  MessageResponse,
  UseItemRequest,
  ItemListResponse,
  UserListResponse,
  UsernameRequest,
  AddBalanceRequest,
  UseBalanceRequest,
  UpdateBalanceRequest,
  UserServiceClient,
  USER_PACKAGE_NAME,
  USER_SERVICE_NAME,
  Empty,
  GetPositionRequest,
  GetPositionResponse,
  SavePositionRequest,
  SavePositionResponse,
  UseItemResponse
} from 'proto/user.pb';
import { grpcCall } from 'src/helpers/grpc.helper';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { LoaiNapTien } from 'src/enums/nap.enum';
import Redis from 'ioredis';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);
  private userGrpcService: UserServiceClient;

  constructor(
    @Inject(USER_PACKAGE_NAME) private readonly client: ClientGrpc,
    // private eventEmitter: EventEmitter2,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
    @Inject(String(process.env.RABBIT_GAME_SERVICE)) private readonly gameClient: ClientProxy,
  ) {}

  onModuleInit() {
    this.userGrpcService = this.client.getService<UserServiceClient>(USER_SERVICE_NAME);
  }

  async handleRegister(req: RegisterRequest) {
    return grpcCall(UserService.name,this.userGrpcService.register(req));
  }

  async handleProfile(req: GetUserRequest) {
    return grpcCall(UserService.name,this.userGrpcService.getProfile(req));
  }

  async handleSaveGame(req: SaveGameRequest): Promise<SaveGameResponse> {
    // Client gọi mỗi 20s — nhưng vẫn check dirty
    // vì player có thể idle, không move gì cả -> khỏi write DB thừa
    const isDirty = await this.redis.exists(`dirty:${req.user.auth_id}`);
    if (!isDirty) {
      return;
    }
    return grpcCall(UserService.name,this.userGrpcService.saveGame(req));
  }

  async handleGetBalanceWeb(req: UsernameRequest ) {
    return grpcCall(UserService.name,this.userGrpcService.getBalance(req));
  }

  async handleUseVangWeb(req: UseBalanceRequest ) {
    return grpcCall(UserService.name,this.userGrpcService.useVangNapTuWeb(req));
  }

  async handleUseNgocWeb(req: UseBalanceRequest ) {
    return grpcCall(UserService.name,this.userGrpcService.useNgocNapTuWeb(req));
  }

  async handleAddVangWeb(req: AddBalanceRequest ) {
    const result = await grpcCall(UserService.name,this.userGrpcService.addVangNapTuWeb(req));
    if (result.vangNapTuWeb && result.ngocNapTuWeb) {
      this.gameClient.emit('user.nap_tien', {
        event: {
          userId: req.id,
          type: LoaiNapTien.VANG,
          amount: req.amount
        }
      });
    }
    return result;
  }

  async handleAddNgocWeb(req: AddBalanceRequest ) {
    const result = await grpcCall(UserService.name,this.userGrpcService.addNgocNapTuWeb(req));
    if (result.vangNapTuWeb && result.ngocNapTuWeb) {
      this.gameClient.emit('user.nap_tien', {
        event: {
          userId: req.id,
          type: LoaiNapTien.NGOC,
          amount: req.amount
        }
      });
    }
    return result;
  }

  async handleUpdateBalance(req: UpdateBalanceRequest ) {
    return grpcCall(UserService.name,this.userGrpcService.updateBalance(req));
  }

  async handleAddItemWeb(req: AddItemRequest ) {
    const result = await grpcCall(UserService.name,this.userGrpcService.addItemWeb(req));
    if (result.message) {
      this.gameClient.emit('user.nap_tien', {
        event: {
          userId: req.id,
          type: LoaiNapTien.ITEM,
          itemId: req.itemId,
          quantity: 1
        }
      });
    }
    return result;
  }

  async handleUseItemWeb(req: UseItemRequest ): Promise<UseItemResponse> {
    return grpcCall(UserService.name,this.userGrpcService.useItemWeb(req));
  }

  async handleGetItemWeb(req: UsernameRequest ) {
    return grpcCall(UserService.name,this.userGrpcService.getItemsWeb(req));
  }

  async handleGetTop10SucManh(req: Empty ) {
    return grpcCall(UserService.name,this.userGrpcService.getTop10BySucManh(req));
  }

  async handleGetTop10Vang(req: Empty ) {
    return grpcCall(UserService.name,this.userGrpcService.getTop10ByVang(req));
  }

  async handleGetPosition(req: GetPositionRequest): Promise<GetPositionResponse> {
    return grpcCall(UserService.name,this.userGrpcService.getPosition(req))
  }

  async handleSavePosition(req: SavePositionRequest): Promise<SavePositionResponse> {
    return grpcCall(UserService.name,this.userGrpcService.savePosition(req))
  }
}
