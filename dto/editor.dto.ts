import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import {
  CreatePostRequest,
  GetPostByIdRequest,
  UpdatePostRequest,
  DeletePostRequest,
  UpdatePostStatusRequest,
  GetPostsByEditorRequest,
  PostResponse,
  ListPostResponse,
  Empty,
  EditorServiceClient,
} from 'proto/admin.pb';

// ===== EMPTY =====
export class EmptyDto {}

// ===== ENTITY =====
export class PostDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'Cập nhật sự kiện mới' })
  title: string;

  @ApiProperty({ example: 'https://wallpaper.dog/large/20552811.jpg' })
  url_anh: string;

  
  @ApiProperty({ example: 'abcxyz' })
  content: string;

  @ApiProperty({ example: 1 })
  editor_id: number;

  @ApiProperty({ example: 'Hải Đăng' })
  editor_realname: string;

  @ApiProperty({ example: 'ACTIVE', description: 'Trạng thái bài viết (ACTIVE / INACTIVE)' })
  status: string;

  @ApiProperty({ example: '2025-11-08T12:00:00Z' })
  create_at: string;

  @ApiProperty({ example: '2025-11-08T12:30:00Z' })
  update_at: string;
}

export class PostResponseDto implements PostResponse {
  @ApiProperty({ type: PostDto })
  post: PostDto | undefined;
}

// ===== CREATE =====
export class CreatePostRequestDto {
  @ApiProperty({ example: 'Cập nhật sự kiện mới', description: 'Tiêu đề bài viết' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: 'https://wallpaper.dog/large/20552811.jpg', description: 'URL ảnh thumbnail' })
  @IsString()
  @IsNotEmpty()
  url_anh: string;

  @ApiProperty({ example: 'abcxyz', description: 'Content của bài báo' })
  @IsString()
  @IsNotEmpty()
  content: string;

  // @ApiProperty({ example: 1, description: 'ID của Editor tạo bài' })
  // @IsInt()
  // editor_id: number;

  @ApiProperty({ example: 'Hải Đăng', description: 'Tên thật của Editor' })
  @IsString()
  @IsNotEmpty()
  editor_realname: string;
}

// ===== GET BY ID =====
export class GetPostByIdRequestDto {
  @Type(() => Number)
  @ApiProperty({ example: 1 })
  @IsInt()
  id: number;
}

// ===== UPDATE =====
export class UpdatePostRequestDto implements UpdatePostRequest {
  @ApiProperty({ example: 1 })
  @IsInt()
  id: number;

  @ApiProperty({ example: 'Sự kiện cập nhật 2025', required: false })
  @IsOptional()
  @IsString()
  title: string;

  @ApiProperty({ example: 'https://wallpaper.dog/large/20552811.jpg', required: false })
  @IsOptional()
  @IsString()
  url_anh: string;

  @ApiProperty({ example: 'abcxyz', description: 'Content của bài báo' })
  @IsString()
  @IsNotEmpty()
  content: string;
}

// ===== DELETE =====
export class DeletePostRequestDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  id: number;
}

// ===== LOCK / UNLOCK =====
export class UpdatePostStatusRequestDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  id: number;
}

// ===== GET BY EDITOR =====
export class GetPostsByEditorRequestDto {
  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  editor_id: number;
}

export class ListPostResponseDto {
  @ApiProperty({ type: [PostDto] })
  posts: PostDto[];
}