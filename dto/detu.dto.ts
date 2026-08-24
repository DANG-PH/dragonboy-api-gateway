import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNumber, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class DeTuDto {
  @ApiProperty({ example: 1, description: 'ID của đệ tử' })
  @IsInt()
  id: number;

  @ApiProperty({ example: 1, description: 'ID của user sở hữu đệ tử' })
  @IsInt()
  userId: number;

  @ApiProperty({ example: 2000, description: 'Sức mạnh của đệ tử' })
  @IsNumber()
  sucManh: number;
}

export class SaveGameDeTuRequestDto {
  // @ApiProperty({ example: 1, description: 'ID của user' })
  // @IsInt()
  // userId: number;

  @ApiProperty({ example: 5000, description: 'Sức mạnh mới của đệ tử' })
  @IsNumber()
  sucManh: number;
}

export class SaveGameDeTuResponseDto {
  @ApiProperty({ example: 'Cập nhật dữ liệu game thành công!' })
  @IsString()
  message: string;
}

export class CreateDeTuRequestDto {
  @ApiProperty({ example: 1, description: 'ID của user cần tạo đệ tử' })
  @IsInt()
  userId: number;

  @ApiProperty({ example: 2000, description: 'Sức mạnh khởi tạo của đệ tử' })
  @IsNumber()
  sucManh: number;
}

export class CreateDeTuResponseDto {
  @ApiProperty({ example: 'Tạo đệ tử mới thành công!' })
  @IsString()
  message: string;
}

export class GetDeTuRequestDto {
  @ApiProperty({ example: 1, description: 'ID của user cần lấy đệ tử' })
  @Type(() => Number)
  @IsInt()
  userId: number;
}

export class DeTuResponseDto {
  @ApiProperty({ type: () => DeTuDto })
  detu: DeTuDto;
}
