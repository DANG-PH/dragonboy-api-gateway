import { BadRequestException, Injectable, Inject, Logger } from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import * as crypto from 'crypto';
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
  GetAllMusicResponse,
  Music,
  SuaMusicRequest,
  XoaMusicRequest,
} from 'proto/game-data.pb';
import { grpcCall } from 'src/helpers/grpc.helper';

@Injectable()
export class GameDataService {
  private readonly logger = new Logger(GameDataService.name);
  private gameDataGrpcService: GameDataServiceClient;
  private readonly s3: S3Client;

  constructor(
    @Inject(GAME_DATA_PACKAGE_NAME) private readonly client: ClientGrpc,
  ) {
    // AWS S3 / Cloudflare R2 / Blackblaze B2 dùng cái này
    // this.s3 = new S3Client({
    //   region: 'auto',
    //   endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    //   credentials: {
    //     accessKeyId: process.env.R2_ACCESS_KEY!,
    //     secretAccessKey: process.env.R2_SECRET_KEY!,
    //   },
    // });

    // Supabase
    this.s3 = new S3Client({
      region: process.env.SUPABASE_S3_REGION!,
      endpoint: process.env.SUPABASE_S3_ENDPOINT!,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY!,
        secretAccessKey: process.env.R2_SECRET_KEY!,
      },
      forcePathStyle: true,  
    });
  }

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

  // ===== MUSIC =====

  async handleGetAllMusic(): Promise<GetAllMusicResponse> {
    return grpcCall(GameDataService.name, this.gameDataGrpcService.getAllMusic({}));
  }

  async handleThemMusic(
    body: { name: string },
    file: any,
  ): Promise<Music> {
    if (!file) {
      throw new BadRequestException('Thiếu file mp3');
    }

    // 1. Tính MD5 hash
    const hash = crypto.createHash('md5').update(file.buffer).digest('hex');

    // 2. Upload lên R2
    // Ví dụ: "music/d41d8cd98f00b204e9800998ecf8427e.mp3"
    //
    // Tại sao dùng hash làm tên file?
    // - Tránh trùng tên: 2 admin upload file khác nhau cùng tên "song.mp3" sẽ không đè nhau
    // - Cache busting: file mới sẽ có URL mới
    // - Idempotent: cùng 1 file upload 2 lần thì ghi đè vào cùng 1 key (không tốn dung lượng)
    const ext = (file.originalname.split('.').pop() ?? 'mp3').toLowerCase();
    const key = `music/${hash}.${ext}`;

    await this.s3.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET!,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      }),
    );

    const file_url = `${process.env.R2_PUBLIC_DOMAIN}/${key}`;

    // 3. Gọi gRPC ThemMusic
    return grpcCall(
      GameDataService.name,
      this.gameDataGrpcService.themMusic({
        name: body.name,
        file_url,
        hash,
      }),
    );
  }

  async handleSuaMusic(req: SuaMusicRequest): Promise<Music> {
    return grpcCall(GameDataService.name, this.gameDataGrpcService.suaMusic(req));
  }

  async handleXoaMusic(req: XoaMusicRequest): Promise<Empty> {
    return grpcCall(GameDataService.name, this.gameDataGrpcService.xoaMusic(req));
  }
}