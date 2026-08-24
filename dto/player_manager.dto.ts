import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, IsNotEmpty, Min, Max } from 'class-validator';

export class TemporaryBanRequestDto {
  @ApiProperty({ example: 2, description: 'ID của user cần ban' })
  @IsInt()
  @IsNotEmpty()
  userId: number;

  @ApiProperty({ 
    example: 5, 
    description: 'Thời gian ban (phút) – từ 5 phút đến 3 ngày (4320 phút)', 
    minimum: 5, 
    maximum: 4320 
  })
  @IsInt()
  @Min(5)
  @Max(4320)
  phut: number;

  @ApiProperty({ example: 'Hành vi vi phạm điều khoản sử dụng', description: 'Lý do ban' })
  @IsString()
  @IsNotEmpty()
  why: string;
}
