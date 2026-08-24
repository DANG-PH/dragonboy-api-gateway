import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Withdraw } from 'proto/admin.pb';
import { Type } from 'class-transformer';
import {
  CreateWithdrawRequestt,
  GetWithdrawsByUserRequest,
  UpdateWithdrawStatusRequest,
  WithdrawResponse,
  ListWithdrawResponse,
  CashierServiceClient,
  Empty
} from 'proto/admin.pb';

// ===== ENTITY =====
export class WithdrawDto implements Withdraw {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 2, description: 'ID người dùng yêu cầu rút tiền' })
  @Type(() => Number)
  userId: number;

  @ApiProperty({ example: 10000, description: 'Số tiền rút (VNĐ)' })
  amount: number;

  @ApiProperty({ example: 'Vietinbank', description: 'Tên ngân hàng' })
  bank_name: string;

  @ApiProperty({ example: '0396436954', description: 'Số tài khoản ngân hàng' })
  bank_number: string;

  @ApiProperty({ example: 'PHAM HAI DANG', description: 'Chủ tài khoản' })
  bank_owner: string;

  @ApiProperty({
    example: 'PENDING',
    description: 'Trạng thái giao dịch: PENDING / SUCCESS / ERROR',
  })
  status: string;

  @ApiProperty({
    example: 1,
    description: 'ID của admin duyệt yêu cầu (finance_id)',
    required: false,
  })
  finance_id: number;

  @ApiProperty({ example: '2025-11-08T12:00:00Z' })
  request_at: string;

  @ApiProperty({
    example: '2025-11-08T13:00:00Z',
    required: false,
    description: 'Thời gian hoàn tất (nếu thành công)',
  })
  success_at: string;
}

// ===== CREATE REQUEST =====

export class CreateWithdrawRequestDto {
  // @ApiProperty({ example: 2, description: 'ID người dùng gửi yêu cầu rút tiền' })
  // @Type(() => Number)
  // @IsInt()
  // userId: number;

  @ApiProperty({ example: 10000, description: 'Số tiền muốn rút (VNĐ)' })
  @IsNumber()
  @Min(10000)
  amount: number;

  @ApiProperty({ example: 'Vietinbank', description: 'Tên ngân hàng' })
  @IsString()
  @IsNotEmpty()
  bank_name: string;

  @ApiProperty({ example: '0396436954', description: 'Số tài khoản ngân hàng' })
  @IsString()
  @IsNotEmpty()
  bank_number: string;

  @ApiProperty({ example: 'PHAM HAI DANG', description: 'Chủ tài khoản ngân hàng' })
  @IsString()
  @IsNotEmpty()
  bank_owner: string;
}

// ===== UPDATE STATUS (Admin duyệt hoặc từ chối) =====
export class UpdateWithdrawStatusRequestDto {
  @ApiProperty({ example: 1, description: 'ID của yêu cầu rút tiền' })
  @IsInt()
  id: number;

  @ApiProperty({ example: 1, description: 'ID của admin thực hiện duyệt hoặc từ chối' })
  @IsInt()
  finance_id: number;

  @ApiProperty({
    example: 'SUCCESS',
    description: 'Trạng thái cập nhật: SUCCESS hoặc ERROR',
  })
  @IsString()
  @IsNotEmpty()
  status: string;
}

// ===== EMPTY =====
export class EmptyDto {}

// ===== RESPONSES =====

export class WithdrawResponseDto implements WithdrawResponse {
  @ApiProperty({ type: WithdrawDto })
  withdraw: WithdrawDto | undefined;
}

export class ListWithdrawResponseDto {
  @ApiProperty({ type: [WithdrawDto] })
  withdraws: WithdrawDto[];
}
