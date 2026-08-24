import { Injectable, Inject, Logger } from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import {
  CreatePostRequest,
  GetPostByIdRequest,
  UpdatePostRequest,
  DeletePostRequest,
  UpdatePostStatusRequest,
  GetPostsByEditorRequest,
  Empty,
  EditorServiceClient,
} from '../../../../proto/admin.pb';
import { grpcCall } from 'src/helpers/grpc.helper';
import { ADMIN_PACKAGE_NAME, EDITOR_SERVICE_NAME } from '../../../../proto/admin.pb';

@Injectable()
export class EditorService {
  private readonly logger = new Logger(EditorService.name);
  private editorGrpcService: EditorServiceClient;

  constructor(
    @Inject(ADMIN_PACKAGE_NAME) private readonly client: ClientGrpc,
  ) {}

  onModuleInit() {
    this.editorGrpcService = this.client.getService<EditorServiceClient>(EDITOR_SERVICE_NAME);
  }

  /* Tạo bài viết mới */
  async handleCreatePost(req: CreatePostRequest) {
    return grpcCall(EditorService.name, this.editorGrpcService.createPost(req));
  }

  /* Lấy danh sách tất cả bài viết */
  async handleGetAllPosts(req: Empty) {
    return grpcCall(EditorService.name, this.editorGrpcService.getAllPosts(req));
  }

  /* Lấy bài viết theo ID */
  async handleGetPostById(req: GetPostByIdRequest) {
    return grpcCall(EditorService.name, this.editorGrpcService.getPostById(req));
  }

  /* Cập nhật bài viết */
  async handleUpdatePost(req: UpdatePostRequest) {
    return grpcCall(EditorService.name, this.editorGrpcService.updatePost(req));
  }

  /* Xóa bài viết */
  async handleDeletePost(req: DeletePostRequest) {
    return grpcCall(EditorService.name, this.editorGrpcService.deletePost(req));
  }

  /* Khóa bài viết */
  async handleLockPost(req: UpdatePostStatusRequest) {
    return grpcCall(EditorService.name, this.editorGrpcService.lockPost(req));
  }

  /* Mở khóa bài viết */
  async handleUnlockPost(req: UpdatePostStatusRequest) {
    return grpcCall(EditorService.name, this.editorGrpcService.unlockPost(req));
  }

  /* Lấy danh sách bài viết theo Editor */
  async handleGetPostsByEditor(req: GetPostsByEditorRequest) {
    return grpcCall(EditorService.name, this.editorGrpcService.getPostsByEditor(req));
  }
}
