import { AcceptFriendResponse, FriendStatus, role } from 'proto/social-network.pb';
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MinLength, Length, IsArray, ArrayNotEmpty, IsBoolean } from 'class-validator';
import { IsEnum, IsInt } from 'class-validator';
import { Type } from 'class-transformer';
// FriendShip

export class RelationFriendInfoDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  relationId: number;

  @ApiProperty({ example: 2 })
  @IsInt()
  friendId: number;

  @ApiProperty({ example: 'Hải Đăng' })
  @IsString()
  @IsNotEmpty()
  friendRealname: string;

  @ApiProperty({ example: 'https://avatar' })
  @IsString()
  @IsNotEmpty()
  avatarUrl: string;

  @ApiProperty({ enum: FriendStatus, example: FriendStatus.PENDING })
  @IsEnum(FriendStatus)
  status: FriendStatus;

  @ApiProperty({ example: '2025-01-01T10:00:00Z' })
  @IsString()
  create_at: string;
}

export class FriendInfoDto {
  @ApiProperty({ example: 2 })
  @IsInt()
  friendId: number;

  @ApiProperty({ example: 'Hải Đăng' })
  @IsString()
  @IsNotEmpty()
  friendRealname: string;

  @ApiProperty({ example: 'https://avatar' })
  @IsString()
  @IsNotEmpty()
  avatarUrl: string;

  @ApiProperty({ enum: FriendStatus, example: FriendStatus.ACCEPTED })
  @IsEnum(FriendStatus)
  status: FriendStatus;
}


export class AddFriendRequestDto {
  @ApiProperty({ example: 2, description: 'ID người muốn kết bạn' })
  @IsInt()
  friendId: number;
}

export class AddFriendResponseDto {
  @ApiProperty({ example: 10 })
  relationId: number;

  @ApiProperty({ example: 1 })
  userId: number;

  @ApiProperty({ example: 2 })
  friendId: number;

  @ApiProperty({ enum: FriendStatus })
  status: FriendStatus;

  @ApiProperty({ example: '2025-01-01T10:00:00Z' })
  create_at: string;
}

export class GetSentFriendRequestDto {}

export class GetSentFriendResponseDto {
  @ApiProperty({ type: [RelationFriendInfoDto] })
  relationFriendInfo: RelationFriendInfoDto[];
}

export class GetIncomingFriendRequestDto {}

export class GetIncomingFriendResponseDto {
  @ApiProperty({ type: [RelationFriendInfoDto] })
  relationFriendInfo: RelationFriendInfoDto[];
}

export class AcceptFriendRequestDto {
  @ApiProperty({ example: 10, description: 'ID của quan hệ friend' })
  @IsInt()
  relationId: number;
}

export class AcceptFriendResponseDto {
  @ApiProperty({ type: RelationFriendInfoDto })  
  relationFriendInfo?: RelationFriendInfoDto;
}

export class RejectFriendRequestDto {
  @ApiProperty({ example: 10, description: 'ID của quan hệ friend' })
  @IsInt()
  relationId: number;
}

export class RejectFriendResponseDto {
  @ApiProperty({ example: true })
  success: boolean;
}

export class GetAllFriendRequestDto {}

export class GetAllFriendResponseDto {
  @ApiProperty({ type: [FriendInfoDto] })
  friendInfo: FriendInfoDto[];
}

export class UnfriendRequestDto {
  @ApiProperty({ example: 2, description: 'ID của người bạn cần xoá' })
  @IsInt()
  friendId: number;
}

export class UnfriendResponseDto {
  @ApiProperty({ example: true })
  success: boolean;
}

export class BlockUserRequestDto {
  @ApiProperty({ example: 2, description: 'ID của user cần block' })
  @IsInt()
  friendId: number;
}

export class BlockUserResponseDto {
  @ApiProperty({ example: true })
  success: boolean;
}

export class CanChatRequestDto {
  @ApiProperty({ example: 2, description: 'ID của friend' })
  @IsInt()
  friendId: number;
}

export class CanChatResponseDto {
  @ApiProperty({ example: true })
  canChat: boolean;
}

export class MessageDto {
  @ApiProperty({ example: 'dm:1:2' })
  @IsString()
  @IsNotEmpty()
  roomId: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  userId: number;

  @ApiProperty({ example: 'Xin chào' })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiProperty({ example: '2025-01-01T10:00:00Z' })
  @IsString()
  @IsNotEmpty()
  create_at: string;
}

export class MessageTraVeDto {
  @ApiProperty({ example: 'dm:1:2' })
  @IsString()
  @IsNotEmpty()
  roomId: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  userId: number;

  @ApiProperty({ example: 'Hải Đăng' })
  @IsString()
  @IsNotEmpty()
  realname: string;

  @ApiProperty({ example: 'https://avatar' })
  @IsString()
  @IsNotEmpty()
  avatarUrl: string;

  @ApiProperty({ example: 'Xin chào' })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiProperty({ example: '2025-01-01T10:00:00Z' })
  @IsString()
  @IsNotEmpty()
  create_at: string;
}

export class GetMessageRequestDto {
  @ApiProperty({ example: 'dm:1:2' })
  @IsString()
  @IsNotEmpty()
  roomId: string;
}

export class GetMessageResponseDto {
  @ApiProperty({ type: [MessageTraVeDto] })
  message: MessageTraVeDto[];
}

export class CreateGroupRequestDto {
  @ApiProperty({ example: 'Box Chat Server 1' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'https://avatar' })
  @IsString()
  @IsNotEmpty()
  avatarUrl: string;

  @ApiProperty({ example: 'Box chat dành cho ae server 1' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ example: 50 })
  @IsInt()
  maxMember: number;

  @ApiProperty({ type: [Number], example: [1, 2, 3] })
  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  userId: number[];
}

export class CreateGroupResponseDto {
  @ApiProperty({ example: true })
  success: boolean;
}

export class AddUserToGroupRequestDto {
  @ApiProperty({ example: 2 })
  @IsInt()
  userId: number;

  @ApiProperty({ example: 1 })
  @IsInt()
  groupId: number;

  @ApiProperty({ enum: role, example: role.MEMBER })
  @IsEnum(role)
  role: role;
}

export class AddUserToGroupResponseDto {
  @ApiProperty({ example: true })
  success: boolean;
}

export class GroupInfoDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  groupId: number;

  @ApiProperty({ example: 'Box Chat Server 1' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'https://avatar' })
  @IsString()
  @IsNotEmpty()
  avatarUrl: string;

  @ApiProperty({ example: 'Box chat dành cho ae server 1' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  ownerId: number;
}

export class GetAllGroupRequestDto {

}

export class GetAllGroupResponseDto {
  @ApiProperty({ type: [GroupInfoDto] })
  groupInfo: GroupInfoDto[];
}

export class CommentNodeDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  id: number;

  @ApiProperty({ example: 10 })
  @IsInt()
  postId: number;

  @ApiProperty({ example: 0, description: '0 nếu là comment root' })
  @IsInt()
  parentId: number;

  @ApiProperty({ example: 5 })
  @IsInt()
  userId: number;

  @ApiProperty({ example: 'Nội dung comment' })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiProperty({ example: '2025-01-01T10:00:00Z' })
  @IsString()
  createdAt: string;

  @ApiProperty({ example: 12 })
  @IsInt()
  likeCount: number;

  @ApiProperty({ example: true })
  @IsBoolean()
  isLikedByCurrentUser: boolean;

  @ApiProperty({ example: false })
  @IsBoolean()
  isDelete: boolean;

  @ApiProperty({ example: 'Phạm Hải Đăng' })
  @IsString()
  @IsNotEmpty()
  realname: string;

  @ApiProperty({ example: 'https://avatar.url' })
  @IsString()
  @IsNotEmpty()
  avatarUrl: string;

  @ApiProperty({ type: () => [CommentNodeDto] })
  @IsArray()
  @Type(() => CommentNodeDto)
  children: CommentNodeDto[];
}

export class GetAllCommentRequestDto {
  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  postId: number;
}

export class GetAllCommentResponseDto {
  @ApiProperty({ type: [CommentNodeDto] })
  comments: CommentNodeDto[];
}

export class UpdateCommentRequestDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  commentId: number;

  @ApiProperty({ example: 'Nội dung mới' })
  @IsString()
  @IsNotEmpty()
  content: string;
}

export class UpdateCommentResponseDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  success: boolean;
}

export class DeleteCommentRequestDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  commentId: number;
}

export class DeleteCommentResponseDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  success: boolean;
}

export class LikeCommentRequestDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  commentId: number;
}

export class LikeCommentResponseDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  success: boolean;
}

export class UnlikeCommentRequestDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  commentId: number;
}

export class UnlikeCommentResponseDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  success: boolean;
}

export class CreateCommentRequestDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  postId: number;

  @ApiProperty({ example: 0, description: '0 nếu comment root' })
  @IsInt()
  parentId: number;

  @ApiProperty({ example: 'Nội dung comment' })
  @IsString()
  @IsNotEmpty()
  content: string;
}

export class CreateCommentResponseDto {
  @ApiProperty({ type: () => CommentNodeDto })
  comment?: CommentNodeDto;
}

export class NotificationDto {
  @ApiProperty({ example: 5 })
  @IsInt()
  userId: number;

  @ApiProperty({ example: 'Nội dung tiêu đề' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: 'Nội dung comment' })
  @IsString()
  @IsNotEmpty()
  content: string;
}

export class CreateNotificationRequestDto {
  @ApiProperty({ type: () => NotificationDto })
  notification: NotificationDto;
}

export class CreateNotificationResponseDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  success: boolean;
}

export class GetNotificationByUserRequestDto {

}

export class GetNotificationByUserResponseDto {
  @ApiProperty({ type: () => [NotificationDto] })
  @Type(() => NotificationDto)
  notification: NotificationDto[];
}