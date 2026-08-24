import { Injectable, Inject, Logger } from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import {
  AddFriendRequest,
  AddFriendResponse,
  GetSentFriendRequest,
  GetSentFriendResponse,
  GetIncomingFriendRequest,
  GetIncomingFriendResponse,
  AcceptFriendRequest,
  AcceptFriendResponse,
  RejectFriendRequest,
  RejectFriendResponse,
  GetAllFriendRequest,
  GetAllFriendResponse,
  UnfriendRequest,
  UnfriendResponse,
  BlockUserRequest,
  BlockUserResponse,
  CanChatRequest,
  CanChatResponse,
  SocialNetworkServiceClient,
  SOCIAL_NETWORK_SERVICE_NAME,
  SOCIALNETWORK_PACKAGE_NAME,
  SaveMessageRequest,
  SaveMessageResponse,
  GetMessageRequest,
  GetMessageResponse,
  CreateGroupRequest,
  CreateGroupResponse,
  AddUserToGroupRequest,
  AddUserToGroupResponse,
  CheckGroupUserRequest,
  CheckGroupUserResponse,
  GetAllGroupRequest,
  GetAllGroupResponse,
  CreateCommentRequest,
  CreateCommentResponse,
  GetAllCommentRequest,
  GetAllCommentResponse,
  UpdateCommentRequest,
  UpdateCommentResponse,
  DeleteCommentRequest,
  DeleteCommentResponse,
  LikeCommentRequest,
  LikeCommentResponse,
  UnlikeCommentRequest,
  UnlikeCommentResponse,
  GetCommentRequest,
  GetCommentResponse,
  CreateNotificationRequest,
  CreateNotificationResponse,
  GetNotificationByUserRequest,
  GetNotificationByUserResponse
} from 'proto/social-network.pb';
import { grpcCall } from 'src/helpers/grpc.helper';

@Injectable()
export class SocialNetworkService {
  private readonly logger = new Logger(SocialNetworkService.name);
  private socialNetworkService: SocialNetworkServiceClient;

  constructor(
    @Inject(SOCIALNETWORK_PACKAGE_NAME) private readonly client: ClientGrpc,
  ) {}

  onModuleInit() {
    this.socialNetworkService = this.client.getService<SocialNetworkServiceClient>(SOCIAL_NETWORK_SERVICE_NAME);
  }

  async handleAddFriend(req: AddFriendRequest): Promise<AddFriendResponse> {
    return grpcCall(SocialNetworkService.name, this.socialNetworkService.addFriend(req))
  }

  async handleGetSendFriend(req: GetSentFriendRequest): Promise<GetSentFriendResponse> {
    return grpcCall(SocialNetworkService.name, this.socialNetworkService.getSentFriend(req))
  }

  async handleGetIncomingFriend(req: GetIncomingFriendRequest): Promise<GetIncomingFriendResponse> {
    return grpcCall(SocialNetworkService.name, this.socialNetworkService.getIncomingFriend(req))
  }

  async handleAcceptFriend(req: AcceptFriendRequest): Promise<AcceptFriendResponse> {
    return grpcCall(SocialNetworkService.name, this.socialNetworkService.acceptFriend(req))
  }

  async handleRejectFriend(req: RejectFriendRequest): Promise<RejectFriendResponse> {
    return grpcCall(SocialNetworkService.name, this.socialNetworkService.rejectFriend(req))
  }

  async handleGetAllFriend(req: GetAllFriendRequest): Promise<GetAllFriendResponse> {
    return grpcCall(SocialNetworkService.name, this.socialNetworkService.getAllFriend(req))
  }

  async handleUnfriend(req: UnfriendRequest): Promise<UnfriendResponse> {
    return grpcCall(SocialNetworkService.name, this.socialNetworkService.unfriend(req))
  }

  async handleBlockUser(req: BlockUserRequest): Promise<BlockUserResponse> {
    return grpcCall(SocialNetworkService.name, this.socialNetworkService.blockUser(req))
  }

  async handleCanChat(req: CanChatRequest): Promise<CanChatResponse> {
    return grpcCall(SocialNetworkService.name, this.socialNetworkService.canChat(req))
  }

  async handleSaveMessage(req: SaveMessageRequest): Promise<SaveMessageResponse> {
    return grpcCall(SocialNetworkService.name, this.socialNetworkService.saveMessage(req))
  }

  async handleGetMessage(req: GetMessageRequest): Promise<GetMessageResponse> {
    return grpcCall(SocialNetworkService.name, this.socialNetworkService.getMessage(req))
  }

  async handleCreateGroup(req: CreateGroupRequest): Promise<CreateGroupResponse> {
    return grpcCall(SocialNetworkService.name, this.socialNetworkService.createGroup(req))
  }

  async handleAddUserToGroup(req: AddUserToGroupRequest): Promise<AddUserToGroupResponse> {
    return grpcCall(SocialNetworkService.name, this.socialNetworkService.addUserToGroup(req))
  }

  async handleCheckGroupUser(req: CheckGroupUserRequest): Promise<CheckGroupUserResponse> {
    return grpcCall(SocialNetworkService.name, this.socialNetworkService.checkGroupUser(req))
  }

  async handleAllGroup(req: GetAllGroupRequest): Promise<GetAllGroupResponse> {
    return grpcCall(SocialNetworkService.name, this.socialNetworkService.getAllGroup(req))
  }

  async handleCreateComment(req: CreateCommentRequest): Promise<CreateCommentResponse> {
    return grpcCall(SocialNetworkService.name, this.socialNetworkService.createComment(req))
  }

  async handleGetAllComment(req: GetAllCommentRequest): Promise<GetAllCommentResponse> {
    return grpcCall(SocialNetworkService.name, this.socialNetworkService.getAllComment(req))
  }

  async handleUpdateComment(req: UpdateCommentRequest): Promise<UpdateCommentResponse> {
    return grpcCall(SocialNetworkService.name, this.socialNetworkService.updateComment(req))
  }

  async handleDeleteComment(req: DeleteCommentRequest): Promise<DeleteCommentResponse> {
    return grpcCall(SocialNetworkService.name, this.socialNetworkService.deleteComment(req))
  }

  async handleLikeComment(req: LikeCommentRequest): Promise<LikeCommentResponse> {
    return grpcCall(SocialNetworkService.name, this.socialNetworkService.likeComment(req))
  }

  async handleUnlikeComment(req: UnlikeCommentRequest): Promise<UnlikeCommentResponse> {
    return grpcCall(SocialNetworkService.name, this.socialNetworkService.unlikeComment(req))
  }

  async handleGetComment(req: GetCommentRequest): Promise<GetCommentResponse> {
    return grpcCall(SocialNetworkService.name, this.socialNetworkService.getComment(req))
  }

  async createNotification(req: CreateNotificationRequest): Promise<CreateNotificationResponse> {
    return grpcCall(SocialNetworkService.name, this.socialNetworkService.createNotification(req))
  }

  async getNotificationByUser(req: GetNotificationByUserRequest): Promise<GetNotificationByUserResponse> {
    return grpcCall(SocialNetworkService.name, this.socialNetworkService.getNotificationByUser(req))
  }
}
