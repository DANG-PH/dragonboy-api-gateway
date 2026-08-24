import { Controller, Post, Body, UseGuards, Patch, Req, Inject, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody,ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { LoginRequest, RegisterRequest, RefreshRequest, VerifyOtpRequestDto,ChangePasswordRequestDto,
  ChangePasswordResponseDto,
  ResetPasswordRequestDto,
  ResetPasswordResponseDto,
  ChangeEmailRequestDto,
  ChangeEmailResponseDto,
  RequestResetPasswordRequestDto, RequestResetPasswordResponseDto, 
  ChangeRolePartnerRequestDto,
  ChangeRolePartnerResponseDto,
  ChangeAvatarRequestDto,
  ChangeAvatarResponseDto,
  LoginWithGoogleRequestDto,
  BanUserRequestDto,
  LogoutRequestDto} from 'dto/auth.dto';
import { JwtAuthGuard } from 'src/security/JWT/jwt-auth.guard';
import { AuthService } from './auth.service';
import { Roles } from 'src/security/decorators/role.decorator';
import { Role } from 'src/enums/role.enum';
import { RolesGuard } from 'src/security/guard/role.guard';
import { UserService } from 'src/service/user/user.service';
import type { Cache } from 'cache-manager';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Request } from 'express';
import { HttpException, HttpStatus } from '@nestjs/common';
import type { RequestWithUser } from 'src/interface/RequestWithUser.interface';
import { Metadata } from '@grpc/grpc-js';
import { GetAllUserResponse } from 'proto/auth.pb';
import { WsChatGateway } from '../chat/ws-chat.gateway';
import { SocialNetworkService } from '../social_network/social-network.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { randomUUID } from 'crypto';
import { ClientProxy } from '@nestjs/microservices';

@Controller('auth')
@ApiTags('Api Auth') 
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly userService: UserService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private wsChatGateway: WsChatGateway,
    private readonly socialService: SocialNetworkService,
    // private eventEmitter: EventEmitter2
    @Inject(String(process.env.RABBIT_GAME_SERVICE)) private readonly gameClient: ClientProxy,
  ) {}

  @Post('register')
  @ApiOperation({ summary: 'Đăng ký tài khoản user (USER)(GAME/WEB) (ĐÃ DÙNG) ' })
  @ApiBody({ type:  RegisterRequest })
  async register(@Body() body: RegisterRequest, @Req() req: RequestWithUser) {
    const authResult = await this.authService.handleRegister(body); 

    // Cách dưới sẽ lỗi nếu server crash, xem logic handleRegister auth để biết logic mới
    // if (!authResult.success) {
    //   return { success: false, message: 'Đăng ký auth thất bại' };
    // }
    // const userRequest = {
    //   id: authResult.auth_id, 
    //   gameName: body.gameName,
    // };

    // const userResult = await this.userService.handleRegister(userRequest);

    // return {
    //   auth: authResult,
    //   user: userResult,
    // };

    return authResult;
  }

  @Post('login')
  @ApiOperation({ summary: 'Đăng nhập tài khoản user (USER)(GAME/WEB) (ĐÃ DÙNG)' })
  @ApiBody({ type:  LoginRequest })
  async login(@Body() body: LoginRequest, @Req() req: RequestWithUser) {
    const metadata = new Metadata();
    const platform = String(req.headers['x-platform'] || 'web');
    metadata.set('platform', platform);

    return this.authService.handleLogin(body, metadata);
  }

  @Post('login-google')
  @ApiOperation({ summary: 'Đăng nhập tài khoản user bằng google (USER)(WEB) (CHƯA DÙNG)' })
  @ApiBody({ type:  LoginWithGoogleRequestDto })
  async loginWithGoogle(@Body() body: LoginWithGoogleRequestDto, @Req() req: RequestWithUser) {
    const metadata = new Metadata();
    const platform = String(req.headers['x-platform'] || 'web');
    metadata.set('platform', platform);
    
    const response = await this.authService.handleLoginWithGoogle(body, metadata);

    // Cách dưới sẽ lỗi nếu server crash, xem logic handleRegisterGoogle auth để biết logic mới
    // if (response.register) {
    //   const userRequest = {
    //     id: response.auth_id, 
    //     gameName: "GOOGLE USER "+response.auth_id
    //   };
  
    //   const userResult = await this.userService.handleRegister(userRequest);
    // }

    return response;
  }
  
  @Post('verify-otp')
  @ApiOperation({ summary: 'Bước 2: Xác thực OTP và nhận access + refresh token (USER)(GAME/WEB) (ĐÃ DÙNG)' })
  @ApiBody({ type: VerifyOtpRequestDto })
  async verifyOtp(@Body() body: VerifyOtpRequestDto, @Req() req: RequestWithUser) {
    const ua = req.headers?.['user-agent'];;

    const metadata = new Metadata();

    const platform = String(req.headers['x-platform'] || 'web');
    metadata.set('platform', platform);

    const result = await this.authService.handleVerifyOtp(body, metadata);

    // if (result.access_token) {
    //     const username = Buffer.from(body.sessionId, 'base64').toString('ascii');
    //     let onlineUsers = await this.cacheManager.get<string[]>('online_users') || [];
    //     let timeConLai = await this.cacheManager.ttl('online_users'); // trả về time hết hạn
    //     if (timeConLai) timeConLai = timeConLai-Date.now();
    //     else timeConLai = 60 * 1000;
    //     if (!onlineUsers.includes(username)) onlineUsers.push(username);
    //     await this.cacheManager.set('online_users', onlineUsers, timeConLai);
    // }
    return result;
  }

  @Post('logout')
  @ApiOperation({ summary: 'Sử dụng khi cần phát triển thêm tính năng logout (USER)(GAME/WEB) (CHƯA DÙNG)' })
  @ApiBody({ type: VerifyOtpRequestDto })
  async logout(@Body() body: LogoutRequestDto) {
    return this.authService.handleLogout(body);
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Làm mới Access Token bằng Refresh Token (USER)(GAME/WEB) (CHƯA DÙNG)' })
  @ApiBody({ type: RefreshRequest })
  async refresh(@Body() body: RefreshRequest, @Req() req: any) {
    const ua = req.headers?.['user-agent'];;

    const metadata = new Metadata();

    const platform = String(req.headers['x-platform'] || 'web');
    metadata.set('platform', platform);

    return this.authService.handleRefresh(body, metadata);
  }

  @Get('ban')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'User gọi khi check vào game, có 2 tác dụng là check server còn sống k và check xem còn quyền vào game k (success tức là k bị ban) (USER)(GAME) (ĐÃ DÙNG)' })
  async getBan(@Req() req: any) {
    const userId = req.user.userId;
    return this.authService.handleGetBan({
      userId: userId
    });
  }

  @Patch('change-password')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Thay đổi mật khẩu (USER)(WEB) (CHƯA DÙNG)' })
  @ApiBody({ type: ChangePasswordRequestDto })
  async changePassword(@Body() body: ChangePasswordRequestDto, @Req() req: any): Promise<ChangePasswordResponseDto> {
    const username = req.user.username;
    const request = {
      ...body,
      sessionId: Buffer.from(username).toString('base64')
    }
    const ua = req.headers?.['user-agent'];;

    const metadata = new Metadata();

    const platform = String(req.headers['x-platform'] || 'web');
    metadata.set('platform', platform);
    const result = await this.authService.handleChangePassword(request, metadata);
    if (result.success) {
      this.gameClient.emit('auth.revoke_all_token', { userId: req.user.userId });
    }
    return result;
  }

  @Patch('change-email')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Thay đổi email (USER)(WEB) (CHƯA DÙNG)' })
  @ApiBody({ type: ChangeEmailRequestDto })
  async changeEmail(@Body() body: ChangeEmailRequestDto, @Req() req: any): Promise<ChangeEmailResponseDto> {
    const username = req.user.username;
    const request = {
      ...body,
      sessionId: Buffer.from(username).toString('base64')
    }
    return this.authService.handleChangeEmail({
      ...request,
      idempotencyKey: "API_GATEWAY: "+randomUUID()
    });
  }

  @Patch('change-avatar')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Thay đổi avatar (USER)(WEB) (CHƯA DÙNG)' })
  @ApiBody({ type: ChangeAvatarRequestDto })
  async changeAvatar(@Body() body: ChangeAvatarRequestDto, @Req() req: any): Promise<ChangeAvatarResponseDto> {
    const userId = req.user.userId;
    const request = {
      ...body,
      userId: userId
    }
    return this.authService.handleChangeAvatar(request);
  }

  @Post('request-reset-password')
  @ApiOperation({ summary: 'Yêu cầu gửi OTP để reset mật khẩu (USER)(WEB) (CHƯA DÙNG)' })
  @ApiBody({ type: RequestResetPasswordRequestDto })
  async requestResetPassword(
    @Body() body: RequestResetPasswordRequestDto
  ): Promise<RequestResetPasswordResponseDto> {
    return this.authService.handleRequestResetPassword(body);
  }

  @Post('reset-password')
  @ApiOperation({ summary: 'Reset mật khẩu khi quên (USER)(WEB) (CHƯA DÙNG)' })
  @ApiBody({ type: ResetPasswordRequestDto })
  async resetPassword(@Body() body: ResetPasswordRequestDto, @Req() req: any): Promise<ResetPasswordResponseDto> {
    const ua = req.headers?.['user-agent'];;

    const metadata = new Metadata();

    const platform = String(req.headers['x-platform'] || 'web');
    metadata.set('platform', platform);
    return this.authService.handleResetPassword(body, metadata);
  }

  @Patch('change-role-partner')
  @ApiBearerAuth()
  @Roles(Role.USER)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Đổi role từ USER thành PARTNER để đăng bán acc (USER)(WEB) (CHƯA DÙNG)' })
  @ApiBody({ type: ChangeRolePartnerRequestDto })
  async changeRolePartner(@Req() req: any): Promise<ChangeRolePartnerResponseDto> {
    const username = req.user.username;
    const result = await this.authService.handleChangeRolePartner({username: username});
    if (result && result.success) {
      await this.socialService.createNotification({
        notification: {
          userId: req.user.userId,
          title: "Đổi role thành công",
          content: "Chúc mừng bạn đã đổi role thành Cộng Tác Viên thành công, vui lòng hợp tác vui vẻ với bạn trong tương lai!"
        }
      })
      await this.wsChatGateway.sendCommentNotification(Number(req.user.userId), {
        message: `Bạn có thông báo mới` 
      })
    }

    return result;
  }

  @Get('profile/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'User xem profile của chính mình (USER)(GAME/WEB) (CHƯA DÙNG)' })
  async profile(@Req() req: any) {
    const userId = req.user.userId;
    return this.authService.handleProfile({id: userId});
  }

  @Get('all-user')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Lấy thông tin user khác để kết bạn mạng xã hội (USER)(GAME/WEB) (CHƯA DÙNG)' })
  async getAllUser(): Promise<GetAllUserResponse> {
    return this.authService.handleGetAllUser({});
  }

  // chuyển sang player manager
  // @Patch('change-role')
  // @ApiBearerAuth()
  // @Roles(Role.ADMIN)
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @ApiOperation({ summary: 'Thay đổi role của user (ADMIN)(WEB)' })
  // @ApiBody({ type: ChangeRoleRequestDto })
  // async changeRole(@Body() body: ChangeRoleRequestDto): Promise<ChangeRoleResponseDto> {
  //   return this.authService.handleChangeRole(body);
  // }

  // @Patch('ban-user')
  // @ApiBearerAuth()
  // @Roles(Role.ADMIN)
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @ApiOperation({ summary: 'Ban user (ADMIN)(WEB)' })
  // @ApiBody({ type: BanUserRequestDto })
  // async banUser(@Body() body: BanUserRequestDto): Promise<BanUserResponseDto> {
  //   return this.authService.handleBanUser(body);
  // }

  // @Patch('unban-user')
  // @ApiBearerAuth()
  // @Roles(Role.ADMIN)
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @ApiOperation({ summary: 'Unban user (ADMIN)(WEB)' })
  // @ApiBody({ type: UnbanUserRequestDto })
  // async unbanUser(@Body() body: UnbanUserRequestDto): Promise<UnbanUserResponseDto> {
  //   return this.authService.handleUnbanUser(body);
  // }
}