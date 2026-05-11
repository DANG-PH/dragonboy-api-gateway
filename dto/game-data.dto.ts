import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { NpcSpawn } from 'proto/game-data.pb';

export enum LoaiNPC {
  NGUOI   = 'NGUOI',
  CAYDAU  = 'CAYDAU',
  RUONGDO = 'RUONGDO',
  DUIGA   = 'DUIGA',
}

// ===== MAP BASE =====

export class MapBaseDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  id: number;

  @ApiProperty({ example: 'Nhà Gôhan' })
  @IsString()
  ten: string;
}

export class GetAllMapResponseDto {
  @ApiProperty({ type: () => [MapBaseDto] })
  maps: MapBaseDto[];
}

export class ThemMapRequestDto {
  @ApiProperty({ example: 'Nhà Gôhan', description: 'Tên map mới' })
  @IsString()
  ten: string;
}

export class SuaMapRequestDto {
  @ApiProperty({ example: 1, description: 'ID của map cần sửa' })
  @IsInt()
  id: number;

  @ApiProperty({ example: 'Đồi Hoa Cúc', description: 'Tên mới' })
  @IsString()
  ten: string;
}

export class XoaMapRequestDto {
  @ApiProperty({ example: 1, description: 'ID của map cần xóa' })
  @Type(() => Number)
  @IsInt()
  id: number;
}

// ===== NPC BASE =====

export class NpcBaseDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  id: number;

  @ApiProperty({ example: 'admin_haidang' })
  @IsString()
  ten: string;

  @ApiProperty({ example: LoaiNPC.NGUOI, enum: LoaiNPC })
  @IsEnum(LoaiNPC)
  loai: string;
}

export class GetAllNpcBaseResponseDto {
  @ApiProperty({ type: () => [NpcBaseDto] })
  npcs: NpcBaseDto[];
}

export class ThemNpcBaseRequestDto {
  @ApiProperty({ example: 'admin_haidang', description: 'Tên NPC mới' })
  @IsString()
  ten: string;

  @ApiProperty({ example: LoaiNPC.NGUOI, enum: LoaiNPC, description: 'Loại NPC' })
  @IsEnum(LoaiNPC)
  loai: string;
}

export class SuaNpcBaseRequestDto {
  @ApiProperty({ example: 1, description: 'ID của NPC base cần sửa' })
  @IsInt()
  id: number;

  @ApiProperty({ example: 'Thợ Săn', description: 'Tên mới' })
  @IsString()
  ten: string;

  @ApiProperty({ example: LoaiNPC.NGUOI, enum: LoaiNPC, description: 'Loại mới' })
  @IsEnum(LoaiNPC)
  loai: string;
}

export class XoaNpcBaseRequestDto {
  @ApiProperty({ example: 1, description: 'ID của NPC base cần xóa' })
  @Type(() => Number)
  @IsInt()
  id: number;
}

// ===== NPC SPAWN =====

export class NpcSpawnDto implements NpcSpawn {
  @ApiProperty({ example: 1 })
  @IsInt()
  id: number;

  @ApiProperty({ example: 2 })
  @IsInt()
  npc_base_id: number;

  @ApiProperty({ example: 'admin_haidang' })
  @IsString()
  ten_npc: string;

  @ApiProperty({ example: LoaiNPC.NGUOI, enum: LoaiNPC })
  @IsEnum(LoaiNPC)
  loai_npc: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  map_id: number;

  @ApiProperty({ example: 'Nhà Gôhan' })
  @IsString()
  ten_map: string;

  @ApiProperty({ example: 12.5 })
  @IsNumber()
  x: number;

  @ApiProperty({ example: 7.3 })
  @IsNumber()
  y: number;

  @ApiProperty({ example: true })
  @IsBoolean()
  is_active: boolean;
}

export class GetNpcTheoMapRequestDto {
  @ApiProperty({ example: 1, description: 'ID của map cần lấy danh sách NPC' })
  @Type(() => Number)
  @IsInt()
  map_id: number;
}

export class GetNpcTheoMapResponseDto {
  @ApiProperty({ type: () => [NpcSpawnDto] })
  npcs: NpcSpawnDto[];
}

export class ThemNpcSpawnRequestDto {
  @ApiProperty({ example: 2, description: 'ID của NPC base' })
  @IsInt()
  npc_base_id: number;

  @ApiProperty({ example: 1, description: 'ID của map' })
  @IsInt()
  map_id: number;

  @ApiProperty({ example: 12.5, description: 'Tọa độ X' })
  @IsNumber()
  x: number;

  @ApiProperty({ example: 7.3, description: 'Tọa độ Y' })
  @IsNumber()
  y: number;

  @ApiProperty({ example: true, description: 'Trạng thái active' })
  @IsBoolean()
  is_active: boolean;
}

export class SuaNpcSpawnRequestDto {
  @ApiProperty({ example: 1, description: 'ID của NPC spawn cần sửa' })
  @IsInt()
  id: number;

  @ApiProperty({ example: 1, description: 'ID map mới (nếu muốn chuyển map)' })
  @IsInt()
  map_id: number;

  @ApiProperty({ example: 15.0, description: 'Tọa độ X mới' })
  @IsNumber()
  x: number;

  @ApiProperty({ example: 9.1, description: 'Tọa độ Y mới' })
  @IsNumber()
  y: number;

  @ApiProperty({ example: false, description: 'Trạng thái active mới' })
  @IsBoolean()
  is_active: boolean;
}

export class XoaNpcSpawnRequestDto {
  @ApiProperty({ example: 1, description: 'ID của NPC spawn cần xóa' })
  @Type(() => Number)
  @IsInt()
  id: number;
}

// ===== NPC SHOP ITEM =====

export enum LoaiTien {
  VANG = 'VANG',
  NGOC = 'NGOC',
}

export enum TabShop {
  AO_QUAN  = 'AO_QUAN',
  PHU_KIEN = 'PHU_KIEN',
  DAC_BIET = 'DAC_BIET',
}

export class GetShopTheoNpcRequestDto {
  @ApiProperty({ example: 5, description: 'ID của NPC base cần lấy shop' })
  @Type(() => Number)
  @IsInt()
  npc_base_id: number;
}

export class GetShopTheoNpcResponseDto {
  @ApiProperty({ type: () => [NpcShopItemDto] })
  items: NpcShopItemDto[];
}

export class ThemShopItemRequestDto {
  @ApiProperty({ example: 5 })
  @IsInt()
  npc_base_id: number;

  @ApiProperty({ example: 2, description: 'ID của item base' })
  @IsInt()
  item_base_id: number;

  @ApiProperty({ example: 1000 })
  @IsNumber()
  @Min(0)
  gia: number;

  @ApiProperty({ example: LoaiTien.NGOC, enum: LoaiTien })
  @IsEnum(LoaiTien)
  loaiTien: string;

  @ApiProperty({ example: TabShop.DAC_BIET, enum: TabShop })
  @IsEnum(TabShop)
  tab: string;

  @ApiPropertyOptional({ example: true, description: 'Mặc định true nếu không gửi' })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @ApiPropertyOptional({ 
    example: 1715000000000, 
    description: 'Epoch millis. Không gửi = bán ngay (NULL)' 
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  start_at?: number;

  @ApiPropertyOptional({ 
    example: 1715100000000, 
    description: 'Epoch millis. Không gửi = vô thời hạn (NULL)' 
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  end_at?: number;
}

export class SuaShopItemRequestDto {
  @ApiProperty({ example: 1, description: 'ID của shop item cần sửa' })
  @IsInt()
  id: number;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsInt()
  item_base_id?: number;

  @ApiPropertyOptional({ example: 2000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  gia?: number;

  @ApiPropertyOptional({ example: LoaiTien.VANG, enum: LoaiTien })
  @IsOptional()
  @IsEnum(LoaiTien)
  loaiTien?: string;

  @ApiPropertyOptional({ example: TabShop.DAC_BIET, enum: TabShop })
  @IsOptional()
  @IsEnum(TabShop)
  tab?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @ApiPropertyOptional({ 
    example: 1715000000000, 
    description: 'Epoch millis. Không gửi = không đổi field này' 
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  start_at?: number;

  @ApiPropertyOptional({ 
    example: 1715100000000, 
    description: 'Epoch millis. Không gửi = không đổi field này' 
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  end_at?: number;
}

export class NpcShopItemDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 5 })
  npc_base_id: number;

  @ApiProperty({ example: 'admin_thanhle' })
  ten_npc: string;

  @ApiProperty({ example: 2 })
  item_base_id: number;

  @ApiProperty({ example: 'Bông tai Porata' })
  ten_item: string;

  @ApiProperty({ example: 'bongtaic1' })
  ma_item: string;

  @ApiProperty({ example: 1000 })
  gia: number;

  @ApiProperty({ example: 'NGOC', enum: LoaiTien })
  loaiTien: string;

  @ApiProperty({ example: 'DAC_BIET', enum: TabShop })
  tab: string;

  @ApiProperty({ example: true })
  is_active: boolean;

  @ApiPropertyOptional({ 
    example: 1715000000000, 
    nullable: true,
    description: 'Epoch millis. null = bán ngay' 
  })
  start_at?: number | null;

  @ApiPropertyOptional({ 
    example: 1715100000000, 
    nullable: true,
    description: 'Epoch millis. null = vô thời hạn' 
  })
  end_at?: number | null;
}

export class XoaShopItemRequestDto {
  @ApiProperty({ example: 1, description: 'ID của shop item cần xóa' })
  @Type(() => Number)
  @IsInt()
  id: number;
}

export class XoaShopItemResponseDto {
  @ApiProperty({ example: 1, description: 'Id Npc của item vừa bị xóa, cần cái này để server trigger shop reload' })
  @Type(() => Number)
  @IsInt()
  npcId: number;
}

// ===== ITEM BASE =====

export class ItemBaseDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  id: number;

  @ApiProperty({ example: 'Bông tai Porata' })
  @IsString()
  ten: string;

  @ApiProperty({ example: 'bongtaic1' })
  @IsString()
  ma: string;
}

export class GetAllItemBaseResponseDto {
  @ApiProperty({ type: () => [ItemBaseDto] })
  items: ItemBaseDto[];
}

export class ThemItemBaseRequestDto {
  @ApiProperty({ example: 'Bông tai Porata', description: 'Tên item — phải khớp với TEN_TO_INFO client' })
  @IsString()
  ten: string;

  @ApiProperty({ example: 'bongtaic1', description: 'Mã định danh unique' })
  @IsString()
  ma: string;
}

export class SuaItemBaseRequestDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  id: number;

  @ApiProperty({ example: 'Bông tai Porata' })
  @IsString()
  ten: string;

  @ApiProperty({ example: 'bongtaic1' })
  @IsString()
  ma: string;
}

export class XoaItemBaseRequestDto {
  @ApiProperty({ example: 1, description: 'ID item base cần xóa' })
  @Type(() => Number)
  @IsInt()
  id: number;
}