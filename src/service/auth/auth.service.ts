import { Injectable, Inject, Logger } from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import {
  RegisterRequest,
  LoginRequest,
  RefreshRequest,
  VerifyOtpRequest,
  ChangePasswordRequest,
  ResetPasswordRequest,
  ChangeEmailRequest,
  ChangeRoleRequest,
  BanUserRequest,
  UnbanUserRequest,
  AUTH_PACKAGE_NAME,
  AUTH_SERVICE_NAME,
  AuthServiceClient,
  RequestResetPasswordRequest,
  ChangeRolePartnerRequest,
  GetProfileRequest,
  SendEmailToUserRequest,
  ChangeAvatarRequest,
  GetAllUserRequest,
  GetRealnameAvatarRequest,
  LoginWithGoogleRequest,
  GetTokenVersionRequest,
  GetBanRequest,
  LogoutRequest
} from 'proto/auth.pb';
import { grpcCall } from 'src/helpers/grpc.helper';
// import { winstonLogger } from 'src/logger/logger.config'; 
import { Metadata } from '@grpc/grpc-js';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private authGrpcService: AuthServiceClient;

  constructor(
    @Inject(AUTH_PACKAGE_NAME) private readonly client: ClientGrpc,
  ) {}

  onModuleInit() {
    this.authGrpcService = this.client.getService<AuthServiceClient>(AUTH_SERVICE_NAME);
  }

  async handleRegister(req: RegisterRequest) {
    return grpcCall(AuthService.name,this.authGrpcService.register(req));
  }

  async handleLogin(req: LoginRequest, metadata: Metadata) {
    const result = await grpcCall(AuthService.name,this.authGrpcService.login(req, metadata), true);
    // if (result.sessionId) {
    //   // gửi mail cho admin để biết ai login
    //   const username = Buffer.from(result.sessionId, 'base64').toString('ascii');
    //   winstonLogger.log({ message: "Đăng nhập thành công", service: AuthService.name, admin: process.env.ADMIN_TEST,nhiemVu: 'thongBaoLoginUser', username: username, })
    // }
    return result;
  }

  async handleVerifyOtp(req: VerifyOtpRequest, metadata: Metadata) {
    return grpcCall(AuthService.name,this.authGrpcService.verifyOtp(req, metadata), true);
  }

  async handleRefresh(req: RefreshRequest, metadata: Metadata) {
    return grpcCall(AuthService.name,this.authGrpcService.refresh(req, metadata));
  }

  async handleChangePassword(req: ChangePasswordRequest, metadata: Metadata) {
    return grpcCall(AuthService.name,this.authGrpcService.changePassword(req, metadata));
  }

  async handleResetPassword(req: ResetPasswordRequest, metadata: Metadata) {
    return grpcCall(AuthService.name,this.authGrpcService.resetPassword(req, metadata));
  }

  async handleChangeEmail(req: ChangeEmailRequest) {
    return grpcCall(AuthService.name,this.authGrpcService.changeEmail(req));
  }

  async handleChangeAvatar(req: ChangeAvatarRequest) {
    return grpcCall(AuthService.name,this.authGrpcService.changeAvatar(req));
  }

  async handleChangeRole(req: ChangeRoleRequest) {
    return grpcCall(AuthService.name,this.authGrpcService.changeRole(req));
  }

  async handleBanUser(req: BanUserRequest) {
    return grpcCall(AuthService.name,this.authGrpcService.banUser(req));
  }

  async handleUnbanUser(req: UnbanUserRequest) {
    return grpcCall(AuthService.name,this.authGrpcService.unbanUser(req));
  }

  async handleRequestResetPassword(req: RequestResetPasswordRequest) {
    return grpcCall(AuthService.name,this.authGrpcService.requestResetPassword(req));
  }

  async handleChangeRolePartner(req: ChangeRolePartnerRequest) {
    return grpcCall(AuthService.name,this.authGrpcService.changeRolePartner(req));
  }

  async handleProfile(req: GetProfileRequest) {
    return grpcCall(AuthService.name,this.authGrpcService.getProfile(req));
  }

  async handleSendEmailToUser(req: SendEmailToUserRequest) {
    return grpcCall(AuthService.name,this.authGrpcService.sendEmailToUser(req));
  }

  async handleGetAllUser(req: GetAllUserRequest) {
    return grpcCall(AuthService.name,this.authGrpcService.getAllUser(req));
  }

  async handleGetRealnameAvatar(req: GetRealnameAvatarRequest) {
    return grpcCall(AuthService.name,this.authGrpcService.getRealnameAvatar(req));
  }

  async handleLoginWithGoogle(req: LoginWithGoogleRequest, metadata: Metadata) {
    return grpcCall(AuthService.name,this.authGrpcService.loginWithGoogle(req, metadata), true);
  }

  async handleGetTokenVersion(req: GetTokenVersionRequest) {
    return grpcCall(AuthService.name,this.authGrpcService.getTokenVersion(req), true);
  }

  async handleGetBan(req: GetBanRequest) {
    return grpcCall(AuthService.name,this.authGrpcService.getBan(req), true);
  }

  async handleLogout(req: LogoutRequest) {
    return grpcCall(AuthService.name,this.authGrpcService.logout(req), true);
  }
}
