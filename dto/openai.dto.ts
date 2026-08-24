import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MinLength, Length } from 'class-validator';

export class AskAiRequest {
  @ApiProperty({ example: 'xin chào!', description: 'Câu hỏi' })
  @IsString()
  @IsNotEmpty({ message: 'Tin nhắn không được để trống' })
  tinNhan: string;
}