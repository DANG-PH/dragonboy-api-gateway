import { Body, Controller, Delete, Get, Inject, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Roles } from 'src/security/decorators/role.decorator';
import { Role } from 'src/enums/role.enum';
import { JwtAuthGuard } from 'src/security/JWT/jwt-auth.guard';
import { RolesGuard } from 'src/security/guard/role.guard';
import { GameDataService } from './game-data.service';
import {
  GetAllMapResponseDto,
  ThemMapRequestDto,
  SuaMapRequestDto,
  XoaMapRequestDto,
  MapBaseDto,
  GetAllNpcBaseResponseDto,
  ThemNpcBaseRequestDto,
  SuaNpcBaseRequestDto,
  XoaNpcBaseRequestDto,
  NpcBaseDto,
  GetNpcTheoMapRequestDto,
  GetNpcTheoMapResponseDto,
  ThemNpcSpawnRequestDto,
  SuaNpcSpawnRequestDto,
  XoaNpcSpawnRequestDto,
  NpcSpawnDto,
  GetShopTheoNpcRequestDto,
  GetShopTheoNpcResponseDto,
  ThemShopItemRequestDto,
  NpcShopItemDto,
  SuaShopItemRequestDto,
  XoaShopItemRequestDto,
  GetAllItemBaseResponseDto,
  ThemItemBaseRequestDto,
  SuaItemBaseRequestDto,
  XoaItemBaseRequestDto,
  ItemBaseDto,
} from '../../../dto/game-data.dto';
import { ClientProxy } from '@nestjs/microservices';
import { ShopQueueService } from './queue/shop-queue.service';

@ApiTags('Api Game Data')
@Controller('game-data')
export class GameDataController {
  constructor(
    private readonly gameDataService: GameDataService,
    private readonly shopQueueService: ShopQueueService,
    @Inject(String(process.env.RABBIT_GAME_SERVICE)) private readonly gameClient: ClientProxy,
  ) {}

  // ===== MAP BASE =====

  @Get('map')
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Lấy tất cả map (ADMIN)(WEB)' })
  async getAllMap(): Promise<GetAllMapResponseDto> {
    return this.gameDataService.handleGetAllMap();
  }

  // @Post('map')
  // @ApiBearerAuth()
  // @Roles(Role.ADMIN)
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @ApiOperation({ summary: 'Thêm map mới (ADMIN)(WEB)' })
  // @ApiBody({ type: ThemMapRequestDto })
  // async themMap(@Body() body: ThemMapRequestDto): Promise<MapBaseDto> {
  //   return this.gameDataService.handleThemMap(body);
  // }

  // @Patch('map')
  // @ApiBearerAuth()
  // @Roles(Role.ADMIN)
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @ApiOperation({ summary: 'Sửa map (ADMIN)(WEB)' })
  // @ApiBody({ type: SuaMapRequestDto })
  // async suaMap(@Body() body: SuaMapRequestDto): Promise<MapBaseDto> {
  //   return this.gameDataService.handleSuaMap(body);
  // }

  // @Delete('map')
  // @ApiBearerAuth()
  // @Roles(Role.ADMIN)
  // @UseGuards(JwtAuthGuard, RolesGuard)  
  // @ApiOperation({ summary: 'Xóa map (ADMIN)(WEB)' })
  // @ApiQuery({ name: 'id', type: Number })
  // async xoaMap(@Query() query: XoaMapRequestDto): Promise<void> {
  //   await this.gameDataService.handleXoaMap(query);
  // }

  @Get('map/npcs')
  @ApiOperation({ summary: 'Lấy danh sách NPC spawn theo map (ADMIN)(WEB)' })
  @ApiQuery({ name: 'map_id', type: Number })
  @UseGuards()
  async getNpcTheoMap(@Query() query: GetNpcTheoMapRequestDto): Promise<GetNpcTheoMapResponseDto> {
    return this.gameDataService.handleGetNpcTheoMap(query);
  }

  // ===== NPC BASE =====

  @Get('npc-base')
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)  
  @ApiOperation({ summary: 'Lấy tất cả NPC base (ADMIN)(WEB)' })
  async getAllNpcBase(): Promise<GetAllNpcBaseResponseDto> {
    return this.gameDataService.handleGetAllNpcBase();
  }

  // @Post('npc-base')
  // @ApiBearerAuth()
  // @Roles(Role.ADMIN)
  // @UseGuards(JwtAuthGuard, RolesGuard)  
  // @ApiOperation({ summary: 'Thêm NPC base mới (ADMIN)(WEB)' })
  // @ApiBody({ type: ThemNpcBaseRequestDto })
  // async themNpcBase(@Body() body: ThemNpcBaseRequestDto): Promise<NpcBaseDto> {
  //   return this.gameDataService.handleThemNpcBase(body);
  // }

  // @Patch('npc-base')
  // @ApiBearerAuth()
  // @Roles(Role.ADMIN)
  // @UseGuards(JwtAuthGuard, RolesGuard)  
  // @ApiOperation({ summary: 'Sửa NPC base (ADMIN)(WEB)' })
  // @ApiBody({ type: SuaNpcBaseRequestDto })
  // async suaNpcBase(@Body() body: SuaNpcBaseRequestDto): Promise<NpcBaseDto> {
  //   return this.gameDataService.handleSuaNpcBase(body);
  // }

  // @Delete('npc-base')
  // @ApiBearerAuth()
  // @Roles(Role.ADMIN)
  // @UseGuards(JwtAuthGuard, RolesGuard)  
  // @ApiOperation({ summary: 'Xóa NPC base (ADMIN)(WEB)' })
  // @ApiQuery({ name: 'id', type: Number })
  // async xoaNpcBase(@Query() query: XoaNpcBaseRequestDto): Promise<void> {
  //   await this.gameDataService.handleXoaNpcBase(query);
  // }

  // ===== NPC SPAWN =====

  @Post('npc-spawn')
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)  
  @ApiOperation({ summary: 'Thêm NPC spawn vào map (ADMIN)(WEB)' })
  @ApiBody({ type: ThemNpcSpawnRequestDto })
  async themNpcSpawn(@Body() body: ThemNpcSpawnRequestDto): Promise<NpcSpawnDto> {
    return this.gameDataService.handleThemNpcSpawn(body);
  }

  @Patch('npc-spawn')
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)  
  @ApiOperation({ summary: 'Sửa NPC spawn (ADMIN)(WEB)' })
  @ApiBody({ type: SuaNpcSpawnRequestDto })
  async suaNpcSpawn(@Body() body: SuaNpcSpawnRequestDto): Promise<NpcSpawnDto> {
    return this.gameDataService.handleSuaNpcSpawn(body);
  }

  @Delete('npc-spawn')
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)  
  @ApiOperation({ summary: 'Xóa NPC spawn (ADMIN)(WEB)' })
  @ApiQuery({ name: 'id', type: Number })
  async xoaNpcSpawn(@Query() query: XoaNpcSpawnRequestDto): Promise<void> {
    await this.gameDataService.handleXoaNpcSpawn(query);
  }

  // ===== NPC SHOP ITEM =====
  @Get('npc-shop')
  @ApiOperation({ summary: 'Lấy danh sách item shop theo NPC (PUBLIC)' })
  @ApiQuery({ name: 'npc_base_id', type: Number })
  async getShopTheoNpc(@Query() query: GetShopTheoNpcRequestDto): Promise<GetShopTheoNpcResponseDto> {
    return this.gameDataService.handleGetShopTheoNpc(query);
  }

  @Post('npc-shop')
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Thêm item vào shop NPC (ADMIN)(WEB)' })
  @ApiBody({ type: ThemShopItemRequestDto })
  async themShopItem(@Body() body: ThemShopItemRequestDto): Promise<NpcShopItemDto> {
      const result = await this.gameDataService.handleThemShopItem(body);
      if (result == null) return result;

      const now = Date.now();
      const startAt = body.start_at;

      // Chỉ set job cho start at (đây là lợi thế của pattern hybrid 1+3, xem trong docs ở api gateway)
      // Vì end at thì client tự filter khi hết hạn và server author nên server chỉ cần trigger N job cho start chứ k cần N job cho end như pattern 3 nữa, và cũng tối ưu cho pattern 1 hơn về notification và setup tương lai, vì pattern 1 k có điểm hook point, user phải out ra vào lại game,...
      if (startAt && startAt > now) {
          // Item chưa đến giờ → schedule job tại start_at
          // KHÔNG emit reload ngay vì client fetch về sẽ bị filter loại ra
          await this.shopQueueService.scheduleStartItem(
              result.id,
              result.npc_base_id,
              startAt,
          );
      } else {
          // Item active ngay (start_at đã qua hoặc null) → emit reload
          this.gameClient.emit('game.reload_shop', { npcId: result.npc_base_id });
      }

      return result;
  }

  @Patch('npc-shop')
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Sửa item trong shop NPC (ADMIN)(WEB)' })
  @ApiBody({ type: SuaShopItemRequestDto })
  async suaShopItem(@Body() body: SuaShopItemRequestDto): Promise<NpcShopItemDto> {
      const result = await this.gameDataService.handleSuaShopItem(body);
      if (result == null) return result;

      const now = Date.now();
      const startAt = body.start_at;

      // Luôn cancel job cũ (phòng trường hợp admin sửa start_at hoặc bỏ start_at)
      await this.shopQueueService.removeStartJob(result.id);

      // Nếu start_at mới còn trong tương lai → schedule job mới
      if (startAt && startAt > now) {
          await this.shopQueueService.scheduleStartItem(
              result.id,
              result.npc_base_id,
              startAt,
          );
      }

      // Luôn emit reload — admin sửa item đang active (đổi giá, đổi tab...)
      // → client cần biết để refresh. Nếu item chưa đến giờ, server filter sẽ loại ra → an toàn.
      this.gameClient.emit('game.reload_shop', { npcId: result.npc_base_id });

      return result;
  }

  @Delete('npc-shop')
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Xóa item khỏi shop NPC (ADMIN)(WEB)' })
  @ApiQuery({ name: 'id', type: Number })
  async xoaShopItem(@Query() query: XoaShopItemRequestDto): Promise<void> {
      const result = await this.gameDataService.handleXoaShopItem(query);
      if (result == null) return;

      // Hủy job pending (nếu item bị xóa khi đang chờ start_at)
      await this.shopQueueService.removeStartJob(query.id);

      // Emit reload để client xóa item khỏi UI
      this.gameClient.emit('game.reload_shop', { npcId: result.npcId });
  }

  // ===== ITEM BASE =====
  @Get('item-base')
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Lấy tất cả item base (ADMIN)(WEB)' })
  async getAllItemBase(): Promise<GetAllItemBaseResponseDto> {
    return this.gameDataService.handleGetAllItemBase();
  }

  // @Post('item-base')
  // @ApiBearerAuth()
  // @Roles(Role.ADMIN)
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @ApiOperation({ summary: 'Thêm item base mới (ADMIN)(WEB)' })
  // @ApiBody({ type: ThemItemBaseRequestDto })
  // async themItemBase(@Body() body: ThemItemBaseRequestDto): Promise<ItemBaseDto> {
  //   return this.gameDataService.handleThemItemBase(body);
  // }

  // @Patch('item-base')
  // @ApiBearerAuth()
  // @Roles(Role.ADMIN)
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @ApiOperation({ summary: 'Sửa item base (ADMIN)(WEB)' })
  // @ApiBody({ type: SuaItemBaseRequestDto })
  // async suaItemBase(@Body() body: SuaItemBaseRequestDto): Promise<ItemBaseDto> {
  //   return this.gameDataService.handleSuaItemBase(body);
  // }

  // @Delete('item-base')
  // @ApiBearerAuth()
  // @Roles(Role.ADMIN)
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @ApiOperation({ summary: 'Xóa item base (ADMIN)(WEB)' })
  // @ApiQuery({ name: 'id', type: Number })
  // async xoaItemBase(@Query() query: XoaItemBaseRequestDto): Promise<void> {
  //   await this.gameDataService.handleXoaItemBase(query);
  // }
}