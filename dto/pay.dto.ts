import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNumber, IsString, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { Pay } from 'proto/pay.pb';

export class PayDto implements Pay {
  @ApiProperty({ example: 1, description: 'ID của ví' })
  @IsInt()
  id: number;

  @ApiProperty({ example: 1, description: 'ID của người dùng sở hữu ví' })
  @IsInt()
  userId: number;

  @ApiProperty({ example: '0', description: 'Số tiền hiện tại trong ví' })
  @IsString()
  tien: string;

  @ApiProperty({ example: 'open', description: 'Trạng thái ví ("open" hoặc "locked")' })
  @IsString()
  @IsIn(['open', 'locked'])
  status: string;

  @ApiProperty({ example: '2025-11-05T18:00:00.000Z', description: 'Thời gian cập nhật gần nhất' })
  @IsString()
  updatedAt: string;
}

export class GetPayByUserIdRequestDto {
  @ApiProperty({ example: 1, description: 'ID của người dùng cần lấy ví' })
  @Type(() => Number)
  @IsInt()
  userId: number;
}

export class UpdateMoneyRequestDto {
  @ApiProperty({ example: 1, description: 'ID của người dùng cần cập nhật ví' })
  @Type(() => Number)
  @IsInt()
  userId: number;

  @ApiProperty({ example: 20000, description: 'Số tiền thay đổi (có thể âm hoặc dương)' })
  @Type(() => Number)
  @IsNumber()
  amount: number;
}

export class UpdateStatusRequestDto {
  @ApiProperty({ example: 1, description: 'ID của người dùng cần cập nhật trạng thái ví' })
  @Type(() => Number)
  @IsInt()
  userId: number;

  @ApiProperty({ example: 'locked', description: 'Trạng thái ví mới ("open" hoặc "locked")' })
  @IsString()
  @IsIn(['open', 'locked'])
  status: string;
}

export class CreatePayRequestDto {
  @ApiProperty({ example: 1, description: 'ID của người dùng cần tạo ví' })
  @Type(() => Number)
  @IsInt()
  userId: number;
}

export class CreatePayOrderRequestDto {
  // @ApiProperty({ example: 1, description: 'ID của người dùng' })
  // @Type(() => Number)
  // @IsInt()
  // userId: number;

  @ApiProperty({ example: 50000, description: 'Số tiền cần thanh toán' })
  @Type(() => Number)
  @IsNumber()
  amount: number;

  // @ApiProperty({ example: 'dang123', description: 'Tên tài khoản người dùng' })
  // @IsString()
  // username: string;
}

export class PayResponseDto {
  @ApiProperty({ type: () => PayDto })
  pay?: PayDto;

  @ApiProperty({ example: 'Thực hiện thành công!' })
  @IsString()
  message: string;
}

export class QrResponseDto {
  @ApiProperty({ example: 'https://fake.qr' })
  @IsString()
  qr: string;

  @ApiProperty({ example: 'dang123' })
  @IsString()
  username: string;
}
