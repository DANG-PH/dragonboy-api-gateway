import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsString, IsNotEmpty, IsInt, IsNumber, IsOptional, IsArray, ValidateNested } from 'class-validator';
import type { Item } from 'proto/item.pb';

// ===== ITEM DTO =====
export class ItemDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  id: number;

  @ApiProperty({ example: 'set_than_linh' })
  @IsString()
  maItem: string;

  @ApiProperty({ example: 'Quần thần linh' })
  @IsString()
  ten: string;

  @ApiProperty({ example: 'QUAN' })
  @IsString()
  loai: string;

  @ApiProperty({ example: 'Giúp tăng HP' })
  @IsString()
  moTa: string;

  @ApiProperty({ example: 10 })
  @IsInt()
  soLuong: number;

  @ApiProperty({ example: 'xayda' })
  @IsString()
  hanhTinh: string;

  @ApiProperty({ example: 'Nappa' })
  @IsString()
  setKichHoat: string;

  @ApiProperty({ example: 7 })
  @IsInt()
  soSaoPhaLe: number;

  @ApiProperty({ example: 7 })
  @IsInt()
  soSaoPhaLeCuongHoa: number;

  @ApiProperty({ example: 3 })
  @IsInt()
  soCap: number;

  @ApiProperty({ example: -1 })
  @IsNumber()
  hanSuDung: number;

  @ApiProperty({ example: '20000000000' })
  @IsString()
  sucManhYeuCau: string;

  @ApiProperty({ example: 'vatpham/do/xayda/set_than_linh/quan.png' })
  @IsString()
  linkTexture: string;

  @ApiProperty({ example: 'hanhtrang' })
  @IsString()
  viTri: string;

  @ApiProperty({ example: '[0,0,0,0,0,0,35,0,0,110000,0,0,0}{hp flat,ki flat,sức đánh flat,crit(%),giáp flat,crit dmg,hp(%),ki(%),sd(%),hp gốc,ki gốc,sức đánh gốc,giảm sát thương(%]' })
  @IsString()
  chiso: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  userId: number;

  @ApiProperty({ example: 'dang' })
  @IsString()
  uuid: string;
}

// ===== ADD ITEM REQUEST =====
export class AddUserItemRequestDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  userId: number;

  @ApiProperty({ type: ItemDto })
  @ValidateNested()       //Báo cho class-validator rằng trường này là object con cần validate theo class của nó.Nếu thiếu, object sẽ bị coi là một property bình thường → ValidationPipe sẽ loại bỏ vì trong kia k có field nào tên item.
  @Type(() => ItemDto)    
  item: ItemDto;
}

// ===== ADD MULTIPLE ITEMS REQUEST =====
export class AddMultipleItemsRequestDto {
  // @ApiProperty({ example: 1 })
  // @IsInt()
  // userId: number;

  @ApiProperty({ type: [ItemDto] })
  @IsArray()
  items: ItemDto[];
}

// ===== ITEM ID REQUEST =====
export class ItemIdRequestDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  id: number;
}

// ===== RESPONSE DTO =====
export class ItemResponseDto {
  @ApiProperty({ type: ItemDto })
  item: Item;
}

export class ItemsResponseDto {
  @ApiProperty({ type: [ItemDto] })
  @IsArray()
  items: Item[];
}

export class MessageResponseDto {
  @ApiProperty({ example: 'Thao tác thành công' })
  @IsString()
  message: string;
}

// ===== EMPTY DTO =====
export class EmptyDto {}

export class UserIdRequestDto {
  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  userId: number;
}

export class GetItemsByItemUuidsRequestDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  itemUuids: string[];
}

export class GetItemsByItemUuidsResponseDto {
  @ApiProperty({ type: [ItemDto] })
  @IsArray()
  items: Item[];
}