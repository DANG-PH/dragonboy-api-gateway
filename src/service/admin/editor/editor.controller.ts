import { Controller, Post, Body, UseGuards, Patch, Req, Get, Query, Param, Delete } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody,ApiBearerAuth } from '@nestjs/swagger';
import {
  CreatePostRequestDto,
  UpdatePostRequestDto,
  DeletePostRequestDto,
  UpdatePostStatusRequestDto,
  GetPostByIdRequestDto,
  GetPostsByEditorRequestDto,
  ListPostResponseDto,
  PostResponseDto,
  EmptyDto,
} from 'dto/editor.dto';
import { JwtAuthGuard } from 'src/security/JWT/jwt-auth.guard';
import { Roles } from 'src/security/decorators/role.decorator';
import { Role } from 'src/enums/role.enum';
import { RolesGuard } from 'src/security/guard/role.guard';
import type { Request } from 'express';
import { HttpException, HttpStatus } from '@nestjs/common';
import { EditorService } from './editor.service';

@Controller('editor')
@ApiTags('Api Editor') 
export class EditorController {
  constructor(
    private readonly editorService: EditorService,
  ) {}

  // ====== CREATE ======
  @Post('create-post')
  @ApiBearerAuth()
  @Roles(Role.EDITOR, Role.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Editor/Admin tạo bài viết mới (ADMIN/EDITOR)(WEB) (ĐÃ DÙNG)' })
  @ApiBody({ type: CreatePostRequestDto })
  async createPost(@Body() body: CreatePostRequestDto, @Req() req: any): Promise<PostResponseDto> {
    const userId = req.user.userId;
    const request = {
      ...body,
      editor_id: userId
    }
    return this.editorService.handleCreatePost(request);
  }

  // ====== GET ALL ======
  @Get('all-posts')
  // @ApiBearerAuth()
  // @Roles(Role.ADMIN, Role.EDITOR, Role.USER)
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Lấy danh sách tất cả bài viết (ALL)(WEB) (ĐÃ DÙNG)' })
  async getAllPosts(@Query() query: EmptyDto): Promise<ListPostResponseDto> {
    return this.editorService.handleGetAllPosts(query);
  }

  // ====== GET BY ID ======
  @Get('post/:id')
  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.EDITOR, Role.USER)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Lấy thông tin chi tiết 1 bài viết theo ID (ALL)(WEB) (ĐÃ DÙNG)' })
  async getPostById(@Param() params: GetPostByIdRequestDto): Promise<PostResponseDto> {
    return this.editorService.handleGetPostById(params);
  }

  // ====== UPDATE ======
  @Patch('update-post')
  @ApiBearerAuth()
  @Roles(Role.EDITOR, Role.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Editor/Admin cập nhật nội dung bài viết (ADMIN/EDITOR)(WEB) (ĐÃ DÙNG)' })
  @ApiBody({ type: UpdatePostRequestDto })
  async updatePost(@Body() body: UpdatePostRequestDto): Promise<PostResponseDto> {
    return this.editorService.handleUpdatePost(body);
  }

  // ====== DELETE ======
  @Delete('delete-post')
  @ApiBearerAuth()
  @Roles(Role.EDITOR, Role.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Editor/Admin xóa bài viết (ADMIN/EDITOR)(WEB) (ĐÃ DÙNG)' })
  @ApiBody({ type: DeletePostRequestDto })
  async deletePost(@Body() body: DeletePostRequestDto): Promise<PostResponseDto> {
    return this.editorService.handleDeletePost(body);
  }

  // ====== LOCK ======
  @Patch('lock-post')
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Admin khóa một bài viết (ẩn khỏi người dùng) (ADMIN)(WEB) (CHƯA DÙNG)' })
  @ApiBody({ type: UpdatePostStatusRequestDto })
  async lockPost(@Body() body: UpdatePostStatusRequestDto): Promise<PostResponseDto> {
    return this.editorService.handleLockPost(body);
  }

  // ====== UNLOCK ======
  @Patch('unlock-post')
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Admin mở khóa bài viết (hiển thị lại) (ADMIN)(WEB) (CHƯA DÙNG)' })
  @ApiBody({ type: UpdatePostStatusRequestDto })
  async unlockPost(@Body() body: UpdatePostStatusRequestDto): Promise<PostResponseDto> {
    return this.editorService.handleUnlockPost(body);
  }

  // ====== GET BY EDITOR ======
  @Get('by-editor')
  @ApiBearerAuth()
  @Roles(Role.EDITOR, Role.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Editor/Admin xem danh sách bài viết của editor bất kì (ADMIN/EDITOR)(WEB) (CHƯA DÙNG)' })
  async getPostsByEditor(@Query() query: GetPostsByEditorRequestDto): Promise<ListPostResponseDto> {
    return this.editorService.handleGetPostsByEditor(query);
  }
}