import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MinLength, Length } from 'class-validator';
import { IsEnum, IsInt } from 'class-validator';
import { Type } from 'class-transformer';
import { LoginWithGoogleRequest, LogoutRequest, LogoutResponse } from 'proto/auth.pb';

// ===== REGISTER =====
export class RegisterRequest {
  @ApiProperty({ example: 'dang123', description: 'Tên đăng nhập' })
  @IsString()
  @IsNotEmpty({ message: 'Username không được để trống' })
  username: string;

  @ApiProperty({ example: 'Hải Đăng', description: 'Tên người dùng' })
  @IsString()
  @IsNotEmpty({ message: 'Tên người dùng không được để trống' })
  realname: string;

  @ApiProperty({ example: '123456', description: 'Mật khẩu đăng ký' })
  @IsString()
  @MinLength(6, { message: 'Mật khẩu phải có ít nhất 6 ký tự' })
  password: string;
  
  @ApiProperty({ example: 'phamhaidang28092006@gmail.com', description: 'Email đăng ký' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'DZno1st', description: 'Tên nhân vật trong game' })
  @IsString()
  @IsNotEmpty({ message: 'Tên game không được để trống' })
  gameName: string;
}

export class RegisterResponse {
  @ApiProperty({ example: true })
  success: boolean;
  
  @ApiProperty({
    example: '1',
    description: 'Auth ID trả về để người dùng truy cập được API bên user'
  })
  auth_id: number;
}

// ===== LOGIN =====
export class LoginRequest {
  @ApiProperty({ example: 'dang123', description: 'Tên đăng nhập' })
  @IsString()
  @IsNotEmpty({ message: 'Username không được để trống' })
  username: string;

  @ApiProperty({ example: '123456', description: 'Mật khẩu đăng nhập' })
  @IsString()
  @MinLength(6, { message: 'Mật khẩu phải có ít nhất 6 ký tự' })
  password: string;
}

export class LoginResponse {
  @ApiProperty({
    example: 'ZGFuZzEyMw==',
    description: 'sessionId trả về từ bước LoginStep1 (Base64 hoặc UUID)',
  })
  sessionId: string;
}

// ===== REFRESH TOKEN =====
export class RefreshRequest {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI...',
    description: 'Refresh Token hợp lệ'
  })
  @IsString()
  @IsNotEmpty({ message: 'Refresh token không được để trống' })
  refreshToken: string;
}

export class RefreshResponse {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5c...',
    description: 'Access Token mới'
  })
  access_token: string;

  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5c...',
    description: 'Refresh Token mới'
  })
  refresh_token: string;
}

// ===== VERIFY OTP =====
export class VerifyOtpRequestDto {
  @ApiProperty({
    example: 'ZGFuZzEyMw==',
    description: 'Mã sessionId trả về từ bước LoginStep1',
  })
  @IsString()
  @IsNotEmpty({ message: 'sessionId không được để trống' })
  sessionId: string;

  @ApiProperty({
    example: '123456',
    description: 'Mã OTP gồm 6 chữ số gửi đến email',
  })
  @IsString()
  @Length(6, 6, { message: 'OTP phải gồm đúng 6 ký tự số' })
  otp: string;
}

export class VerifyOtpResponseDto {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI...',
    description: 'Access Token cấp sau khi OTP hợp lệ'
  })
  access_token: string;

  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI...',
    description: 'Refresh Token dài hạn'
  })
  refresh_token: string;

  @ApiProperty({
    example: '1',
    description: 'Auth ID trả về để người dùng truy cập được API bên user'
  })
  auth_id: number;
}

export class LogoutRequestDto implements LogoutRequest {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI...',
    description: 'Refresh token cần loại bỏ',
  })
  @IsString()
  @IsNotEmpty({ message: 'Refresh token không được để trống' })
  refreshToken: string;
}

export class LogoutResponseDto implements LogoutResponse {
  @ApiProperty({ example: true })
  success: boolean;
}

// ===== USER METHODS =====

// Change Password
export class ChangePasswordRequestDto {
  // @ApiProperty({ example: 'c2FtcGxlVXNlcg==', description: 'SessionId của user (Base64)' })
  // @IsString()
  // @IsNotEmpty()
  // sessionId: string;

  @ApiProperty({ example: 'oldPass123', description: 'Mật khẩu cũ' })
  @IsString()
  @MinLength(6)
  oldPassword: string;

  @ApiProperty({ example: 'newPass456', description: 'Mật khẩu mới' })
  @IsString()
  @MinLength(6)
  newPassword: string;
}

export class ChangePasswordResponseDto {
  @ApiProperty({ example: true })
  success: boolean;
}

// Reset Password (quên mật khẩu)
export class ResetPasswordRequestDto {
  @ApiProperty({ example: 'dang123', description: 'Tên đăng nhập' })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty({ example: '123456', description: 'OTP gửi về email' })
  @IsString()
  @Length(6, 6)
  otp: string;

  @ApiProperty({ example: 'newPass456', description: 'Mật khẩu mới' })
  @IsString()
  @MinLength(6)
  newPassword: string;
}

export class ResetPasswordResponseDto {
  @ApiProperty({ example: true })
  success: boolean;
}

// Change Email
export class ChangeEmailRequestDto {
  // @ApiProperty({ example: 'c2FtcGxlVXNlcg==', description: 'SessionId của user (Base64)' })
  // @IsString()
  // @IsNotEmpty()
  // sessionId: string;

  @ApiProperty({ example: 'newemail@gmail.com', description: 'Email mới' })
  @IsEmail()
  newEmail: string;
}

export class ChangeEmailResponseDto {
  @ApiProperty({ example: true })
  success: boolean;
}

export class ChangeAvatarRequestDto {
  @ApiProperty({ example: 'https://avatarfiles.alphacoders.com/227/thumb-1920-227760.png', description: 'Avatar mới' })
  @IsString()
  @IsNotEmpty()
  avatarUrl: string;
}

export class ChangeAvatarResponseDto {
  @ApiProperty({ example: true })
  success: boolean;
}

// ===== ADMIN METHODS =====

// Change Role
export class ChangeRoleRequestDto {
  @ApiProperty({ example: 'dang123', description: 'Tên user cần thay đổi role' })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty({ example: 'ADMIN', description: 'Role mới' })
  @IsString()
  @IsNotEmpty()
  newRole: string;
}

export class ChangeRoleResponseDto {
  @ApiProperty({ example: true })
  success: boolean;
}

// Ban User
export class BanUserRequestDto {
  @ApiProperty({ example: 'dang123', description: 'Tên user cần ban' })
  @IsString()
  @IsNotEmpty()
  username: string;
}

export class BanUserResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 1, description: 'UserId của user bị ban' })
  @IsInt()
  userId: number;
}

// Unban User
export class UnbanUserRequestDto {
  @ApiProperty({ example: 'dang123', description: 'Tên user cần unban' })
  @IsString()
  @IsNotEmpty()
  username: string;
}

export class UnbanUserResponseDto {
  @ApiProperty({ example: true })
  success: boolean;
}

// ===== REQUEST RESET PASSWORD OTP =====
export class RequestResetPasswordRequestDto {
  @ApiProperty({ example: 'dang123', description: 'Tên đăng nhập cần reset password' })
  @IsString()
  @IsNotEmpty({ message: 'Username không được để trống' })
  username: string;
}

export class RequestResetPasswordResponseDto {
  @ApiProperty({ example: true, description: 'Trạng thái gửi OTP thành công' })
  success: boolean;
}

export class ChangeRolePartnerRequestDto {
  // @ApiProperty({ example: 'dang123', description: 'Tên đăng nhập cần reset password' })
  // @IsString()
  // @IsNotEmpty({ message: 'Username không được để trống' })
  // username: string;
}

export class ChangeRolePartnerResponseDto {
  @ApiProperty({ example: true, description: 'Trạng thái đổi role' })
  success: boolean;
}

export class GetProfileRequestDto {}

export class GetProfileReponseDto {
  @ApiProperty({ example: 'ADMIN' })
  @IsString()
  @IsNotEmpty()
  role: string;

  @ApiProperty({ example: 'true' })
  biBan: boolean;

  @ApiProperty({ example: 'https://avatar' })
  @IsString()
  @IsNotEmpty()
  avatarUrl: string;

  @ApiProperty({ example: 'dang123', description: 'Tên đăng nhập' })
  @IsString()
  @IsNotEmpty({ message: 'Username không được để trống' })
  username: string;
}

export class SendEmailToUserRequestDto {
  @ApiProperty({ example: 'ALL, UserA,...' })
  @IsString()
  @IsNotEmpty()
  who: string;

  @ApiProperty({ example: 'THÔNG BÁO BẢO TRÌ' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: 'Bảo trì game vào tối nay...' })
  @IsString()
  @IsNotEmpty()
  content: string;
}

export class SendemailToUserResponseDto {
  @ApiProperty({ example: true, description: 'Trạng thái gửi email' })
  success: boolean;
}

export class createRoomRequest {
  @ApiProperty({ example: 2, description: 'ID của friend' })
  @IsInt()
  friendId: number;
}

export class LoginWithGoogleRequestDto implements LoginWithGoogleRequest {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI...',
    description: 'Token từ google',
  })
  @IsString()
  @IsNotEmpty({ message: 'Token không được để trống' })
  tokenFromGoogle: string;
}

export class LoginWithGoogleResponseDto {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI...',
    description: 'Access Token cấp sau khi OTP hợp lệ'
  })
  access_token: string;

  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI...',
    description: 'Refresh Token dài hạn'
  })
  refresh_token: string;

  @ApiProperty({
    example: '1',
    description: 'Auth ID trả về để người dùng truy cập được API bên user'
  })
  auth_id: number;

  @ApiProperty({ example: true })
  register: boolean;
}

export class GetBanRequestDto {

}

export class GetBanResponseDto {
  @ApiProperty({ example: true, description: 'Trạng thái bị ban hay không' })
  success: boolean;
  // success là không bị ban
}
