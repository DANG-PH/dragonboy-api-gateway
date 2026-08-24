import { Controller, UseGuards, Req, Get, Inject, Patch, Post, Body, Param, Query, Delete, Put } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody,ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/security/JWT/jwt-auth.guard';
import { Roles } from 'src/security/decorators/role.decorator';
import { Role } from 'src/enums/role.enum';
import { RolesGuard } from 'src/security/guard/role.guard';
import { HttpException, HttpStatus } from '@nestjs/common';
import { AcceptFriendRequestDto, AcceptFriendResponseDto, AddFriendRequestDto, AddFriendResponseDto, BlockUserRequestDto, BlockUserResponseDto, CreateCommentRequestDto, CreateCommentResponseDto, CreateNotificationRequestDto, CreateNotificationResponseDto, DeleteCommentRequestDto, DeleteCommentResponseDto, GetAllCommentRequestDto, GetAllCommentResponseDto, GetAllFriendResponseDto, GetIncomingFriendResponseDto, GetNotificationByUserRequestDto, GetNotificationByUserResponseDto, GetSentFriendResponseDto, LikeCommentRequestDto, LikeCommentResponseDto, RejectFriendRequestDto, RejectFriendResponseDto, UnfriendRequestDto, UnfriendResponseDto, UnlikeCommentRequestDto, UnlikeCommentResponseDto, UpdateCommentRequestDto, UpdateCommentResponseDto } from 'dto/social-network.dto';
import { AuthService } from 'src/service/auth/auth.service';
import { SocialNetworkService } from './social-network.service';
import { GetAllCommentRequest } from 'proto/social-network.pb';
import { WsChatGateway } from '../chat/ws-chat.gateway';

@Controller('social_network')
@ApiTags('Api Social network') 
export class SocialNetworkController {
  constructor(
    private socialService: SocialNetworkService,
    private wsChatGateway: WsChatGateway
  ) {}

  @Post('add-friend')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Gửi lời mời kết bạn tới 1 User bất kì' })
  @ApiBody({ type: AddFriendRequestDto })
  async addFriend(@Body() body: AddFriendRequestDto, @Req() req: any): Promise<AddFriendResponseDto> {
    const request = {
      ...body,
      userId: req.user?.userId
    }
    return this.socialService.handleAddFriend(request);
  }

  @Get('sent-friend')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Xem tất cả yêu cầu kết bạn mà bản thân đã gửi đi ( status pending )' })
  async sentFriend(@Req() req: any): Promise<GetSentFriendResponseDto> {
    const request = {
      userId: req.user?.userId
    }
    return this.socialService.handleGetSendFriend(request)
  }

  @Get('incoming-friend')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Xem tất cả yêu cầu kết bạn mà bản thân nhận được từ người khác ( status pending )' })
  async incomingFriend(@Req() req: any): Promise<GetIncomingFriendResponseDto> {
    const request = {
      userId: req.user?.userId
    }
    return this.socialService.handleGetIncomingFriend(request)
  }

  @Patch('accept-friend')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Chấp nhận lời mời kết bạn' })
  @ApiBody({ type: AcceptFriendRequestDto })
  async acceptFriend(@Body() body: AcceptFriendRequestDto, @Req() req: any): Promise<AcceptFriendResponseDto> {
    const request = {
      ...body,
      userId: req.user.userId
    }
    return this.socialService.handleAcceptFriend(request);
  }

  @Delete('reject-friend')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Từ chối lời mời kết bạn' })
  @ApiBody({ type: RejectFriendRequestDto })
  async rejectFriend(@Body() body: RejectFriendRequestDto, @Req() req: any): Promise<RejectFriendResponseDto> {
    const request = {
      ...body,
      userId: req.user.userId
    }
    return this.socialService.handleRejectFriend(request);
  }

  @Get('all-friend')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Xem danh sách bạn bè của bản thân' })
  async allFriend(@Req() req: any): Promise<GetAllFriendResponseDto> {
    const request = {
      userId: req.user?.userId
    }
    return this.socialService.handleGetAllFriend(request)
  }

  @Delete('unfriend')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Hủy bạn bè ( nếu đã là bạn bè )' })
  @ApiBody({ type: UnfriendRequestDto })
  async unFriend(@Body() body: UnfriendRequestDto, @Req() req: any): Promise<UnfriendResponseDto> {
    const request = {
      ...body,
      userId: req.user?.userId
    }
    return this.socialService.handleUnfriend(request);
  }

  @Patch('block-user')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Chặn 1 user bất kì bất kể có đang là bạn bè hay không' })
  @ApiBody({ type: BlockUserRequestDto })
  async blockUser(@Body() body: BlockUserRequestDto, @Req() req: any): Promise<BlockUserResponseDto> {
    const request = {
      ...body,
      userId: req.user?.userId
    }
    return this.socialService.handleBlockUser(request);
  }

  @Post('create-comment')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Tạo comment mới vào bài post mà ADMIN/EDITOR tạo' })
  @ApiBody({ type: CreateCommentRequestDto })
  async createComment(@Body() body: CreateCommentRequestDto, @Req() req: any): Promise<CreateCommentResponseDto> {
    const request = {
      ...body,
      userId: req.user?.userId
    }
    const result = await this.socialService.handleCreateComment(request);
    if (body.parentId != 0 && result.comment) {
      // Lấy người được bạn reply để gửi thông báo cho người đó
      const comment = (await this.socialService.handleGetComment({commentId: body.parentId})).comment

      await this.wsChatGateway.sendCommentNotification(Number(comment?.userId), {
        message: `${result.comment.realname} vừa reply comment của bạn` // sau này có thể thêm thông tin Post nào
      })
    }
    
    return result;
  }

  @Get('all-comment')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Lấy hết comment của 1 bài post bất kỳ' })
  async getAllComment(@Query() query: GetAllCommentRequestDto, @Req() req: any): Promise<GetAllCommentResponseDto> {
    const request = {
      ...query,
      userId: req.user.userId
    }
    return this.socialService.handleGetAllComment(request)
  }

  @Patch('update-comment')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Chỉnh sửa comment của 1 bài viết' })
  @ApiBody({ type: UpdateCommentRequestDto })
  async updateComment(@Body() body: UpdateCommentRequestDto, @Req() req: any): Promise<UpdateCommentResponseDto> {
    const request = {
      ...body,
      userId: req.user?.userId
    }
    return this.socialService.handleUpdateComment(request);
  }

  @Patch('delete-comment')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Xóa comment của 1 bài viết ( Soft Delete )' })
  @ApiBody({ type: DeleteCommentRequestDto })
  async deleteComment(@Body() body: DeleteCommentRequestDto, @Req() req: any): Promise<DeleteCommentResponseDto> {
    const request = {
      ...body,
      userId: req.user?.userId
    }
    return this.socialService.handleDeleteComment(request);
  }

  @Post('like-comment')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Like comment 1 bài viết' })
  @ApiBody({ type: LikeCommentRequestDto })
  async likeComment(@Body() body: LikeCommentRequestDto, @Req() req: any): Promise<LikeCommentResponseDto> {
    const request = {
      ...body,
      userId: req.user?.userId
    }
    return this.socialService.handleLikeComment(request);
  }

  @Delete('unlike-comment')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Unlike comment 1 bài viết' })
  @ApiBody({ type: UnlikeCommentRequestDto })
  async unlikeComment(@Body() body: UnlikeCommentRequestDto, @Req() req: any): Promise<UnlikeCommentResponseDto> {
    const request = {
      ...body,
      userId: req.user?.userId
    }
    return this.socialService.handleUnlikeComment(request);
  }

  @Post('create-notification')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Tạo thông báo cho User (WEB)(CHƯA DÙNG)' })
  @ApiBody({ type: CreateNotificationRequestDto })
  async createNotification(@Body() body: CreateNotificationRequestDto, @Req() req: any): Promise<CreateNotificationResponseDto> {
    const notification = body.notification;
    notification.userId = req.user.userId;
    return this.socialService.createNotification({
      notification: notification
    });
  }

  @Get('notification')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Lấy hết notification theo user' })
  async getNotification(@Query() query: GetNotificationByUserRequestDto, @Req() req: any): Promise<GetNotificationByUserResponseDto> {
    const request = {
      ...query,
      userId: req.user.userId
    }
    return this.socialService.getNotificationByUser(request)
  }
}