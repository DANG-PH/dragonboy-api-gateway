import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ListAccountSellRequest, ListAccountSellResponse, PaginationResponse } from 'proto/admin.pb';

// ===== ENTITY =====
export class AccountSellDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'accgame1', description: 'Tên tài khoản game' })
  username: string;

  @ApiProperty({ example: 'https://cdn3.upanh.info/upload/server-sw3/images/Qu%E1%BB%91c%20t%E1%BA%BF%20ph%E1%BB%A5%20n%E1%BB%AF/Nick/Nick%20So%20Sinh%20Co%20D%E1%BB%87%20T%E1%BB%AD.jpg', description: 'URL ảnh minh họa hoặc link acc' })
  url: string;

  @ApiProperty({ example: 'Acc sơ sinh có đệ tử', description: 'Mô tả chi tiết tài khoản' })
  description: string;

  @ApiProperty({ example: 20000, description: 'Giá bán tài khoản (VNĐ)' })
  price: number;

  @ApiProperty({
    example: 'ACTIVE',
    description: 'Trạng thái: ACTIVE (đang bán) hoặc SOLD (đã bán)',
  })
  status: string;

  @ApiProperty({
    example: 1,
    description: 'ID của Partner (người bán)',
  })
  partner_id: number;

  @ApiProperty({
    example: 2,
    description: 'ID của Partner (người bán)',
  })
  buyer_id: number;

  @ApiProperty({ example: '2025-11-08T12:00:00Z', description: 'Thời điểm tạo bài đăng' })
  createdAt: string;
}

// ===== CREATE REQUEST =====
export class CreateAccountSellRequestDto {
  @ApiProperty({ example: 'accgame1', description: 'Tên tài khoản game' })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty({ example: '123456', description: 'Mật khẩu tài khoản game' })
  @IsString()
  @IsNotEmpty()
  password: string;

  @ApiProperty({ example: 'https://cdn3.upanh.info/upload/server-sw3/images/Qu%E1%BB%91c%20t%E1%BA%BF%20ph%E1%BB%A5%20n%E1%BB%AF/Nick/Nick%20So%20Sinh%20Co%20D%E1%BB%87%20T%E1%BB%AD.jpg', description: 'URL ảnh minh họa' })
  @IsString()
  @IsNotEmpty()
  url: string;

  @ApiProperty({ example: 'Acc sơ sinh có đệ tử', description: 'Mô tả chi tiết' })
  @IsString()
  @IsOptional()
  description: string;

  @ApiProperty({ example: 20000, description: 'Giá bán (VNĐ)' })
  @IsNumber()
  @Min(1)
  price: number;

  // @ApiProperty({ example: 1, description: 'ID Partner (người bán)' })
  // @IsNumber()
  // @IsNotEmpty()
  // partner_id: number;
}

export class CreateAccountSellResponseDto {
  @ApiProperty({ example: true })
  success: boolean;
}

export class ConfirmAccountSellRequestDto {
  @ApiProperty({ example: 'token gui cho user B', description: 'Token gửi cho user B khi user A đăng bán acc user B' })
  @IsString()
  @IsNotEmpty()
  token: string;
}

export class ConfirmAccountSellResponseDto {
  @ApiProperty({ example: true })
  success: boolean;
}

// ===== UPDATE REQUEST =====
export class UpdateAccountSellRequestDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  id: number;

  @ApiProperty({ example: 'https://cdn3.upanh.info/upload/server-sw3/images/Qu%E1%BB%91c%20t%E1%BA%BF%20ph%E1%BB%A5%20n%E1%BB%AF/Nick/Nick%20So%20Sinh%20Co%20D%E1%BB%87%20T%E1%BB%AD.jpg', required: false })
  @IsOptional()
  @IsString()
  url: string;

  @ApiProperty({ example: 'Acc update thêm item mới', required: false })
  @IsOptional()
  @IsString()
  description: string;

  @ApiProperty({ example: 30000, required: false })
  @IsOptional()
  @IsNumber()
  @Min(1)
  price: number;
}

// Pagination

export class PaginationRequestDto {
  @ApiPropertyOptional({ example: '1', description: 'Trang cần xem (optional)' })
  @IsOptional()
  @IsString()
  page?: string;

  @ApiPropertyOptional({ example: '5', description: 'Bao nhiêu phần tử 1 trang (optional)' })
  @IsOptional()
  @IsString()
  itemPerPage?: string;

  @ApiPropertyOptional({ example: 'có đệ', description: 'Keyword để search (optional)' })
  @IsOptional()
  @IsString()
  search?: string;
}

export class PaginationByPartnerRequestDto extends PaginationRequestDto {
  @ApiPropertyOptional({ example: 1, description: 'Partner id bất kì (Chỉ ADMIN có thể xem) (optional)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  partner_id?: number;
}

export class PaginationResponseDto implements PaginationResponse {
  @ApiProperty({ example: 1 })
  @IsInt()
  total: number;

  @ApiProperty({ example: 1 })
  @IsInt()
  prevPage: number;

  @ApiProperty({ example: 2 })
  @IsInt()
  currentPage: number;

  @ApiProperty({ example: 3 })
  @IsInt()
  nextPage: number;

  @ApiProperty({ example: 3 })
  @IsInt()
  lastPage: number;
}

// ===== DELETE REQUEST =====
export class DeleteAccountSellRequestDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  id: number;
}

// ===== GET BY PARTNER =====
export class GetAccountsByPartnerRequestDto {
  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  partner_id: number;

  @ApiProperty({ type: PaginationRequestDto })
  paginationRequest: PaginationRequestDto;
}

// ===== GET BY ID =====
export class GetAccountByIdRequestDto {
  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  id: number;
}

// ===== UPDATE STATUS =====
export class UpdateAccountStatusRequestDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  id: number;

  @ApiProperty({
    example: 'SOLD',
    description: 'Trạng thái mới của tài khoản (SOLD hoặc ACTIVE)',
  })
  @IsString()
  @IsNotEmpty()
  status: string;
}

export class BuyAccountRequestDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @IsNotEmpty()
  id: number;

  // @ApiProperty({ example: 1, description: 'ID Người mua để check tiền' })
  // @IsNumber()
  // @IsNotEmpty()
  // userId: number;
}

// ===== EMPTY =====
export class EmptyDto {}

// ===== RESPONSES =====
export class AccountResponseDto {
  @ApiProperty({ type: AccountSellDto })
  account?: AccountSellDto;
}

export class ListAccountSellResponseDto {
  @ApiProperty({ type: [AccountSellDto] })
  accounts: AccountSellDto[];

  @ApiProperty({ type: PaginationResponseDto })
  paginationResponse?: PaginationResponseDto;
}

export class AccountInformationResponseDto {
  @ApiProperty({ example: 'accgame1', description: 'Tên tài khoản game' })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty({ example: '123456', description: 'Mật khẩu tài khoản game' })
  @IsString()
  @IsNotEmpty()
  password: string;
}

export class GetAllAccountByBuyerRequest {

}

export class GetAllAccountByBuyerResponse {
  @ApiProperty({ type: [AccountInformationResponseDto] })
  accounts: AccountInformationResponseDto[]
}

export class ListAccountSellRequestDto {
  @ApiProperty({ type: PaginationRequestDto })
  paginationRequest: PaginationRequestDto;
}

export class BuyAccountResponseDto {
  @ApiProperty({ description: 'Message backend trả' })
  message: string;
}

