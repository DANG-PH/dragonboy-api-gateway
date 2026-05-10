import { Injectable, Inject, Logger } from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import {
  GameDataServiceClient,
  GAME_DATA_PACKAGE_NAME,
  GAME_DATA_SERVICE_NAME,
  Empty,
  GetAllMapResponse,
  GetAllNpcBaseResponse,
  GetNpcTheoMapRequest,
  GetNpcTheoMapResponse,
  MapBase,
  NpcBase,
  NpcSpawn,
  ThemMapRequest,
  SuaMapRequest,
  XoaMapRequest,
  ThemNpcBaseRequest,
  SuaNpcBaseRequest,
  XoaNpcBaseRequest,
  ThemNpcSpawnRequest,
  SuaNpcSpawnRequest,
  XoaNpcSpawnRequest,
  GetShopTheoNpcRequest,
  GetShopTheoNpcResponse,
  NpcShopItem,
  ThemShopItemRequest,
  SuaShopItemRequest,
  XoaShopItemRequest,
  GetAllItemBaseResponse,
  ThemItemBaseRequest,
  ThemItemBaseResponse,
  SuaItemBaseRequest,
  SuaItemBaseResponse,
  XoaItemBaseRequest,
  ItemBase,
  XoaShopItemResponse,

} from 'proto/game-data.pb';
import { grpcCall } from 'src/helpers/grpc.helper';

@Injectable()
export class GameDataService {
  private readonly logger = new Logger(GameDataService.name);
  private gameDataGrpcService: GameDataServiceClient;

  constructor(
    @Inject(GAME_DATA_PACKAGE_NAME) private readonly client: ClientGrpc,
  ) {}

  onModuleInit() {
    this.gameDataGrpcService = this.client.getService<GameDataServiceClient>(GAME_DATA_SERVICE_NAME);
  }

  // ===== MAP BASE =====

  async handleGetAllMap(): Promise<GetAllMapResponse> {
    return grpcCall(GameDataService.name, this.gameDataGrpcService.getAllMap({}));
  }

  async handleThemMap(req: ThemMapRequest): Promise<MapBase> {
    return grpcCall(GameDataService.name, this.gameDataGrpcService.themMap(req));
  }

  async handleSuaMap(req: SuaMapRequest): Promise<MapBase> {
    return grpcCall(GameDataService.name, this.gameDataGrpcService.suaMap(req));
  }

  async handleXoaMap(req: XoaMapRequest): Promise<Empty> {
    return grpcCall(GameDataService.name, this.gameDataGrpcService.xoaMap(req));
  }

  async handleGetNpcTheoMap(req: GetNpcTheoMapRequest): Promise<GetNpcTheoMapResponse> {
    return grpcCall(GameDataService.name, this.gameDataGrpcService.getNpcTheoMap(req));
  }

  // ===== NPC BASE =====

  async handleGetAllNpcBase(): Promise<GetAllNpcBaseResponse> {
    return grpcCall(GameDataService.name, this.gameDataGrpcService.getAllNpcBase({}));
  }

  async handleThemNpcBase(req: ThemNpcBaseRequest): Promise<NpcBase> {
    return grpcCall(GameDataService.name, this.gameDataGrpcService.themNpcBase(req));
  }

  async handleSuaNpcBase(req: SuaNpcBaseRequest): Promise<NpcBase> {
    return grpcCall(GameDataService.name, this.gameDataGrpcService.suaNpcBase(req));
  }

  async handleXoaNpcBase(req: XoaNpcBaseRequest): Promise<Empty> {
    return grpcCall(GameDataService.name, this.gameDataGrpcService.xoaNpcBase(req));
  }

  // ===== NPC SPAWN =====

  async handleThemNpcSpawn(req: ThemNpcSpawnRequest): Promise<NpcSpawn> {
    return grpcCall(GameDataService.name, this.gameDataGrpcService.themNpcSpawn(req));
  }

  async handleSuaNpcSpawn(req: SuaNpcSpawnRequest): Promise<NpcSpawn> {
    return grpcCall(GameDataService.name, this.gameDataGrpcService.suaNpcSpawn(req));
  }

  async handleXoaNpcSpawn(req: XoaNpcSpawnRequest): Promise<Empty> {
    return grpcCall(GameDataService.name, this.gameDataGrpcService.xoaNpcSpawn(req));
  }

  // ===== NPC SHOP ITEM =====
  async handleGetShopTheoNpc(req: GetShopTheoNpcRequest): Promise<GetShopTheoNpcResponse> {
    return grpcCall(GameDataService.name, this.gameDataGrpcService.getShopTheoNpc(req));
  }

  async handleThemShopItem(req: ThemShopItemRequest): Promise<NpcShopItem> {
    return grpcCall(GameDataService.name, this.gameDataGrpcService.themShopItem(req));
  }

  async handleSuaShopItem(req: SuaShopItemRequest): Promise<NpcShopItem> {
    return grpcCall(GameDataService.name, this.gameDataGrpcService.suaShopItem(req));
  }

  async handleXoaShopItem(req: XoaShopItemRequest): Promise<XoaShopItemResponse> {
    return grpcCall(GameDataService.name, this.gameDataGrpcService.xoaShopItem(req));
  }

  // ===== ITEM BASE =====

  async handleGetAllItemBase(): Promise<GetAllItemBaseResponse> {
    return grpcCall(GameDataService.name, this.gameDataGrpcService.getAllItemBase({}));
  }

  async handleThemItemBase(req: ThemItemBaseRequest): Promise<ItemBase> {
    const res: ThemItemBaseResponse = await grpcCall(GameDataService.name, this.gameDataGrpcService.themItemBase(req));
    return res.item;
  }

  async handleSuaItemBase(req: SuaItemBaseRequest): Promise<ItemBase> {
    const res: SuaItemBaseResponse = await grpcCall(GameDataService.name, this.gameDataGrpcService.suaItemBase(req));
    return res.item;
  }

  async handleXoaItemBase(req: XoaItemBaseRequest): Promise<Empty> {
    return grpcCall(GameDataService.name, this.gameDataGrpcService.xoaItemBase(req));
  }
}