import { Controller, UseGuards, Req, Get, Inject, Patch, Post, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody,ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/security/JWT/jwt-auth.guard';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Cache } from '@nestjs/cache-manager';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { createRoomRequest } from 'dto/auth.dto';
import Redis from 'ioredis';
import { SocialNetworkService } from '../social_network/social-network.service';
import { AddUserToGroupRequestDto, AddUserToGroupResponseDto, CreateGroupRequestDto, CreateGroupResponseDto, GetAllGroupResponseDto, GetMessageRequestDto, GetMessageResponseDto } from 'dto/social-network.dto';

@Controller('chat')
@ApiTags('Api Chat') 
export class ChatController {
  constructor(
    private readonly socialService: SocialNetworkService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {
  }

  @Post('1-1')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Tạo room chat cho 2 user ( còn group chat thì không cần vì có group entity đại diện cho 1 room luôn )' })
  @ApiBody({ type: createRoomRequest })
  async createRoom(@Body() body: createRoomRequest, @Req() req: any): Promise<{roomId: string}> {
    const userId = req.user.userId;
    const targetUserId = body.friendId;

    if (userId === targetUserId) {
        throw new BadRequestException('Cannot chat with yourself');
    }

    const allowed = await this.socialService.handleCanChat({userId: userId, friendId: targetUserId});
    if (!allowed) {
        throw new ForbiddenException();
    }

    const [a, b] = [userId, targetUserId].sort((x, y) => x - y);
    const roomId = `dm:${a}:${b}`;

    const roomKey = `CHAT_ROOM:${roomId}`;
    const exists = await this.cacheManager.get(roomKey);

    if (exists) {
        return { roomId }; 
    }

    await this.cacheManager.set(roomKey, { users: [a, b] }, 1000 * 60 * 60 * 24 * 30);
    // await this.redis.sadd(`hdgstudio::hdgstudio:USER_ROOMS:${a}`, roomId);
    // await this.redis.sadd(`hdgstudio::hdgstudio:USER_ROOMS:${b}`, roomId);
    // await this.redis.expire(`hdgstudio::hdgstudio:USER_ROOMS:${a}`, 60 * 60 * 24 * 30); 
    // await this.redis.expire(`hdgstudio::hdgstudio:USER_ROOMS:${b}`, 60 * 60 * 24 * 30); 

    return { roomId };
  }

  @Get('message')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Lấy tin nhắn của 1 room' })
  async message(@Query() query: GetMessageRequestDto, @Req() req: any): Promise<GetMessageResponseDto> {
    const userId = req.user.userId;
    
    const request = {
      ...query,
      userId: userId
    }

    return this.socialService.handleGetMessage(request);
  }

  @Post('create-group')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Tạo room chat ( Group ) cho nhiều user' })
  @ApiBody({ type: CreateGroupRequestDto })
  async createGroup(@Body() body: CreateGroupRequestDto, @Req() req: any): Promise<CreateGroupResponseDto> {
    const userId = req.user.userId;

    const request = {
      ...body,
      ownerId: userId 
    }

    return this.socialService.handleCreateGroup(request)
  }

  @Post('add-user-group')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Tạo room chat ( Group ) cho nhiều user' })
  @ApiBody({ type: AddUserToGroupRequestDto })
  async addGroup(@Body() body: AddUserToGroupRequestDto, @Req() req: any): Promise<AddUserToGroupResponseDto> {
    return this.socialService.handleAddUserToGroup(body)
  }
  
  @Get('all-group')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Xem danh sách group của bản thân' })
  async allGroup(@Req() req: any): Promise<GetAllGroupResponseDto> {
    const request = {
      userId: req.user?.userId
    }
    return this.socialService.handleAllGroup(request)
  }
}