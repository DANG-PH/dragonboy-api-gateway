import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

// ===== ENTITY =====
export class FinanceDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 2, description: 'ID người dùng thực hiện giao dịch' })
  userId: number;

  @ApiProperty({
    example: 'NAP',
    description: 'Loại giao dịch: NAP (nạp tiền) hoặc RUT (rút tiền)',
  })
  type: string;

  @ApiProperty({ example: 10000, description: 'Số tiền giao dịch (VNĐ)' })
  amount: number;

  @ApiProperty({ example: '2025-11-08T12:00:00Z', description: 'Thời điểm tạo giao dịch' })
  create_at: string;
}

// ===== GET BY USER =====
export class GetFinanceByUserRequestDto {
  @ApiProperty({ example: 2, description: 'ID người dùng cần xem lịch sử giao dịch' })
  @Type(() => Number)
  @IsInt()
  userId: number;
}

// ===== EMPTY =====
export class EmptyDto {}

// ===== RESPONSES =====
export class FinanceResponseDto {
  @ApiProperty({ type: FinanceDto })
  finance?: FinanceDto;
}

export class ListFinanceResponseDto {
  @ApiProperty({ type: [FinanceDto] })
  finances: FinanceDto[];
}

export class FinanceSummaryResponseDto {
  @ApiProperty({ example: 10000000, description: 'Tổng số tiền đã nạp (VNĐ)' })
  total_nap: number;

  @ApiProperty({ example: 4000000, description: 'Tổng số tiền đã rút (VNĐ)' })
  total_rut: number;

  @ApiProperty({
    example: 6000000,
    description: 'Số dư (balance = total_nap - total_rut)',
  })
  balance: number;
}