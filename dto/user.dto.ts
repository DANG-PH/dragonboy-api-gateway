import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsString, IsNotEmpty, IsInt, IsNumber, IsOptional, Min, Max, IsBoolean, IsArray,ValidateNested } from 'class-validator';

// ===== USER =====
export class UserDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  id: number;

  @ApiProperty({ example: 1000 })
  @IsNumber()
  vang: number;

  @ApiProperty({ example: 50 })
  @IsNumber()
  ngoc: number;

  @ApiProperty({ example: 200 })
  @IsNumber()
  sucManh: number;

  @ApiProperty({ example: 500 })
  @IsNumber()
  vangNapTuWeb: number;

  @ApiProperty({ example: 100 })
  @IsNumber()
  ngocNapTuWeb: number;

  @ApiProperty({ example: 10 })
  @IsInt()
  x: number;

  @ApiProperty({ example: 20 })
  @IsInt()
  y: number;

  @ApiProperty({ example: 'Map1' })
  @IsString()
  mapHienTai: string;

  @ApiProperty({ example: true })
  @IsBoolean()
  daVaoTaiKhoanLanDau: boolean;

  @ApiProperty({ example: false })
  @IsBoolean()
  coDeTu: boolean;

  @ApiProperty({ example: [1, 2, 3] })
  @IsArray()
  @IsInt({ each: true })
  danhSachVatPhamWeb: number[];

  @ApiProperty({ example: 123 })
  @IsOptional()
  @IsInt()
  auth_id: number;

  @ApiProperty({ example: 'DZno1st', description: 'Tên nhân vật trong game' })
  @IsString()
  @IsNotEmpty({ message: 'Tên game không được để trống' })
  gameName: string;
}

export class UserBxhDto {
  @ApiProperty({ example: 1000 })
  @IsNumber()
  vang: number;

  @ApiProperty({ example: 50 })
  @IsNumber()
  ngoc: number;

  @ApiProperty({ example: 200 })
  @IsNumber()
  sucManh: number;

  @ApiProperty({ example: 'DZno1st', description: 'Tên nhân vật trong game' })
  @IsString()
  @IsNotEmpty({ message: 'Tên game không được để trống' })
  gameName: string;

  @ApiProperty({})
  @IsString()
  @IsNotEmpty({ message: 'Avatar không được trống' })
  avatartUrl: string;
}

export class ItemWebDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  itemId: number;

  @ApiProperty({ example: 10000 })
  @IsInt()
  price: number;
}

export class UserDtoNoId {
  @ApiProperty({ example: 1000 })
  @IsNumber()
  vang: number;

  @ApiProperty({ example: 50 })
  @IsNumber()
  ngoc: number;

  @ApiProperty({ example: 200 })
  @IsNumber()
  sucManh: number;

  @ApiProperty({ example: 500 })
  @IsNumber()
  vangNapTuWeb: number;

  @ApiProperty({ example: 100 })
  @IsNumber()
  ngocNapTuWeb: number;

  @ApiProperty({ example: 10 })
  @IsInt()
  x: number;

  @ApiProperty({ example: 20 })
  @IsInt()
  y: number;

  @ApiProperty({ example: 'Map1' })
  @IsString()
  mapHienTai: string;

  @ApiProperty({ example: true })
  @IsBoolean()
  daVaoTaiKhoanLanDau: boolean;

  @ApiProperty({ example: false })
  @IsBoolean()
  coDeTu: boolean;

  @ApiProperty({ example: [1, 2, 3] })
  @IsArray()
  @IsInt({ each: true })
  danhSachVatPhamWeb: number[];

  @ApiProperty({ example: 'DZno1st', description: 'Tên nhân vật trong game' })
  @IsString()
  @IsNotEmpty({ message: 'Tên game không được để trống' })
  gameName: string;
}

// ===== REGISTER =====
export class RegisterRequestDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  id: number;

  @ApiProperty({ example: 'DZno1st', description: 'Tên game' })
  @IsString()
  @IsNotEmpty({ message: 'Tên game không được để trống' })
  gameName: string;
}

export class RegisterResponseDto {
  @ApiProperty({ example: true })
  success: boolean;
}

// ===== GET PROFILE =====
export class GetUserRequestDto {
  @ApiProperty({ example: 1 })
  @Type(() => Number) // biến string từ query sang number trước khi thực thi lệnh
  @IsInt()
  id: number;
}

export class UserResponseDto {
  @ApiProperty({ type: UserDto })
  user: UserDto;
}

// ===== SAVE GAME =====
export class SaveGameRequestDto {
  @ApiProperty({ type: UserDtoNoId })
  @ValidateNested()     //Báo cho class-validator rằng trường này là object con cần validate theo class của nó.Nếu thiếu, object sẽ bị coi là một property bình thường → ValidationPipe sẽ loại bỏ vì trong kia k có field nào tên user.
  @Type(() => UserDtoNoId)    
  user: UserDtoNoId;
}

export class SaveGameResponseDto {
  @ApiProperty({ example: 'Lưu game thành công' })
  @IsString()
  message: string;
}

// ===== BALANCE =====
export class UsernameRequestDto {
  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  id: number;
}

export class BalanceResponseDto {
  @ApiProperty({ example: 500 })
  @IsNumber()
  vangNapTuWeb: number;

  @ApiProperty({ example: 100 })
  @IsNumber()
  ngocNapTuWeb: number;
}

export class UseBalanceRequestDto {
  // @ApiProperty({ example: 1 })
  // @IsInt()
  // id: number;

  @ApiProperty({ example: 10000 })
  @IsNumber()
  amount: number;
}

export class UpdateBalanceRequestDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  id: number;

  @ApiProperty({ example: 'vangNapTuWeb', description: 'vangNapTuWeb | ngocNapTuWeb' })
  @IsString()
  type: string;

  @ApiProperty({ example: 100 })
  @IsNumber()
  amount: number;
}

export class AddBalanceRequestDto {
  // @ApiProperty({ example: 1 })
  // @IsInt()
  // id: number;

  @ApiProperty({ example: 10000 })
  @IsNumber()
  amount: number;
}

// ===== USER LIST =====
export class UserListResponseDto {
  @ApiProperty({ type: [UserBxhDto] })
  users: UserBxhDto[];
}

// ===== ITEM =====
export class AddItemAdminRequestDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  id: number;

  @ApiProperty({ example: 1 })
  @IsInt()
  itemId: number;
}

export class AddItemRequestDto {
  // @ApiProperty({ example: 1 })
  // @IsInt()
  // id: number;

  @ApiProperty({ example: 1 })
  @IsInt()
  itemId: number;
}

export class ItemListResponseDto {
  @ApiProperty({ type: [ItemWebDto] })
  itemWebs: ItemWebDto[];
}

export class UseItemRequestDto {
  // @ApiProperty({ example: 1 })
  // @IsInt()
  // id: number;

  @ApiProperty({ type: [Number] })
  @IsArray()
  @Type(() => Number)
  itemIds: number[];
}

export class UseItemAdminRequestDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  id: number;

  @ApiProperty({ type: [Number] })
  @IsArray()
  @Type(() => Number)
  itemIds: number[];
}

export class UseItemResponseDto {
  @ApiProperty({ type: [Number] })
  @Type(() => Number)
  successItemIds: number[];
}

export class MessageResponseDto {
  @ApiProperty({ example: 'Thao tác thành công' })
  @IsString()
  message: string;
}

// ===== EMPTY =====
export class EmptyDto {}
