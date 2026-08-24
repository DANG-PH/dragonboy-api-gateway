import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UseGuards } from '@nestjs/common';
import Redis from 'ioredis';
import { Inject } from '@nestjs/common';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { JwtService } from '@nestjs/jwt';
import { SocialNetworkService } from '../social_network/social-network.service';
import { group } from 'console';
import { AuthService } from '../auth/auth.service';

@WebSocketGateway({
  namespace: '/ws-chat',
})
export class WsChatGateway {
  @WebSocketServer()
  server: Server;

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly jwtService: JwtService,
    private readonly socialService: SocialNetworkService,
    private readonly authService: AuthService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {
  }

  async handleConnection(client: Socket) {
    // Auth handled by WsJwtGuard
    // Client only joins room after setActiveRoom

    try {
      const token = 
            client.handshake.auth?.token ||
            client.handshake.query?.token ||
            client.handshake.headers?.authorization?.split(' ')[1];
      if (!token) throw new Error('Missing token');

      const payload = await this.jwtService.verifyAsync(token, { secret: process.env.JWT_SECRET });
      client.data.user = payload;

      client.join(`Notification:${payload.userId}`);
    } catch (err) {
      client.disconnect();
      return;
    }

  }

  handleDisconnect(client: Socket) {
    // Socket.IO auto leave rooms
  }

  /* ================= SET ACTIVE ROOM ================= */
  @SubscribeMessage('setActiveRoom')
  async handleSetActiveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { roomId: string },
  ) {
    if (!body?.roomId) return;

    const userId = client.data.user.userId;

    if (body.roomId.startsWith('dm')) {
      const room = await this.cacheManager.get<{ users: number[] }>(
        `CHAT_ROOM:${body.roomId}`,
      );
      if (!room || !room.users.includes(userId)) return;
    } 
    else if (body.roomId.startsWith('group')) {
      const [, a] = body.roomId.split(':');
      const groupId = Number(a);
      const success = await this.socialService.handleCheckGroupUser({
        userId: userId,
        groupId: groupId
      })
      if (!success) return;
    }

    // Rời tất cả active chat cũ ( Rời room chat cũ để k nhận tin nhắn nữa )
    for (const room of client.rooms) {
      if (room.startsWith('ACTIVE_CHAT:')) {
        client.leave(room);
      }
    }

    // console.log(`ACTIVE_CHAT:${body.roomId}`)
    // Join active chat mới
    client.join(`ACTIVE_CHAT:${body.roomId}`);
  }

  /* ================= SEND MESSAGE ================= */
  @SubscribeMessage('chatMessage')
  async handleChat(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { roomId: string; content: string },
    ) {
    const { userId } = client.data.user;

    if (!body?.roomId || !body?.content) return;

    // Validate user có quyền chat trong room này
    if (body.roomId.startsWith('dm')) {
      const roomKey = `CHAT_ROOM:${body.roomId}`;
      const room = await this.cacheManager.get<{ users: string[] }>(roomKey);
      if (!room || !room?.users?.includes(userId)) {
          return; // không cho gửi
      }
    } 
    else if (body.roomId.startsWith('group')) {
      const [, a] = body.roomId.split(':');
      const groupId = Number(a);
      const success = await this.socialService.handleCheckGroupUser({
        userId: userId,
        groupId: groupId
      })
      if (!success) return;
    }

    // Gửi tới Chat Service (lưu DB, xử lý logic)
    await this.sendToChatService({
        type: 'SEND_MESSAGE',
        userId,
        roomId: body.roomId,
        content: body.content,
    });
  }

  async emitToRoom(roomId: string, payload: any) {
    if (roomId.startsWith('dm')) {
      const room = await this.cacheManager.get<{ users: number[] }>(
        `CHAT_ROOM:${roomId}`,
      );
      if (!room) return;
    }

    this.server
      .to(`ACTIVE_CHAT:${roomId}`)
      .emit('chatMessage', payload);
  }

  private async sendToChatService(command: any) {
    const realnameAvatarInfo = await this.authService.handleGetRealnameAvatar({
      userIds: [command.userId]
    })

    this.emitToRoom(command.roomId, {
        userId: command.userId,
        content: command.content,
        realname: realnameAvatarInfo.realnameAvatarInfo[0].realname,
        avatarUrl: realnameAvatarInfo.realnameAvatarInfo[0].avatarUrl,
        timestamp: new Date().toISOString(),
        roomId: command.roomId, 
    });

    // Hiện tại đang gRPC, có thể dùng RabbitMQ + gRPC để đồng bộ db sau ( nếu phát triển performance thêm )
    this.socialService.handleSaveMessage({
      message: {
        roomId: command.roomId,
        userId: command.userId,
        content: command.content,
        create_at: new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
      }
    })
  }

  // Dùng cho logic gửi thông báo khi reply comment nhau 

  // User vừa vào web thì cho phép nhận thông báo
  // @SubscribeMessage('setReadyNotification')
  // async handleSetReadyNotification(
  //   @ConnectedSocket() client: Socket,
  //   @MessageBody() body: {},
  // ) {
  //   const { userId } = client.data.user;
  //   client.join(`Notification:${userId}`);
  // }

  // Gửi thông báo
  async sendCommentNotification(userId: number, payload: any) {
    this.server
      .to(`Notification:${userId}`)
      .emit('setReadyNotification', payload);
  }
}

/**
 * ========================= REALTIME CHAT EMIT STRATEGIES =========================
 *
 * Hiện tại có 3 cách tiếp cận để implement việc emit tin nhắn realtime trong hệ thống chat 1-1.
 * Mỗi cách có trade-off khác nhau về hiệu năng, bảo mật và độ phức tạp.
 *
 * -------------------------------------------------------------------------------
 * CÁCH 1 — BROADCAST THEO ROOM LOGIC + FRONTEND FILTER
 * -------------------------------------------------------------------------------
 * Cách thực thi:
 * - Backend cho tất cả client join vào room logic (vd: dm:userA:userB) ngay từ khi connect.
 * - Khi có tin nhắn, server emit broadcast tới toàn bộ room.
 * - Frontend tự kiểm tra trạng thái UI (đang mở room nào) để quyết định render hay không.
 *
 * Ưu điểm:
 * - Backend đơn giản, dễ triển khai.
 * - Ít logic trạng thái ở server.
 *
 * Nhược điểm:
 * - Emit thừa rất nhiều tin nhắn (hiệu năng kém khi scale).
 * - Backend không kiểm soát được client nào đang active.
 * - Bảo mật thấp hơn do trao quyền lọc dữ liệu cho frontend.
 * - Dễ phát sinh bug UX (nhận tin nhắn khi không ở màn hình chat).
 *
 * -------------------------------------------------------------------------------
 * CÁCH 2 — CACHE ACTIVE ROOM TRONG MEMORY (MAP / REDIS)
 * -------------------------------------------------------------------------------
 * Cách thực thi:
 * - Mỗi socket khi mở một room sẽ gọi event setActiveRoom.
 * - Backend lưu mapping socketId -> roomId (in-memory hoặc Redis).
 * - Khi emit, backend duyệt tất cả socket và chỉ gửi cho socket đang active room tương ứng.
 *
 * Ưu điểm:
 * - Backend kiểm soát chính xác client nào được nhận tin.
 * - Tránh được bug nhận tin nhắn sai context.
 *
 * Nhược điểm:
 * - Phải duyệt toàn bộ socket (O(N)) cho mỗi message.
 * - Khó scale khi số lượng kết nối lớn.
 * - Code phức tạp, dễ phát sinh memory leak nếu cleanup không tốt.
 *
 * -------------------------------------------------------------------------------
 * CÁCH 3 — SOCKET.IO ACTIVE ROOM (CÁCH ĐANG SỬ DỤNG)
 * -------------------------------------------------------------------------------
 * Cách thực thi:
 * - Mỗi khi user mở một phòng chat, client gọi setActiveRoom.
 * - Backend validate quyền truy cập, sau đó:
 *   + Leave tất cả room trạng thái cũ (ACTIVE_CHAT:*).
 *   + Join socket vào room trạng thái mới (ACTIVE_CHAT:{roomId}).
 * - Khi có tin nhắn, server emit trực tiếp tới ACTIVE_CHAT:{roomId}.
 *
 * Ưu điểm:
 * - Emit O(1), không duyệt socket.
 * - Backend kiểm soát tuyệt đối quyền nhận tin.
 * - Không emit thừa, hiệu năng và bảo mật cao.
 * - Tận dụng đúng cơ chế routing của Socket.IO.
 *
 * Nhược điểm:
 * - Cần thêm một event setActiveRoom.
 * - Cần quản lý trạng thái join/leave room chặt chẽ.
 *
 * -------------------------------------------------------------------------------
 * KẾT LUẬN
 * -------------------------------------------------------------------------------
 * Hệ thống hiện tại đang sử dụng CÁCH 3.
 * Đây là phương án tối ưu cho chat 1-1 realtime trong bối cảnh production:
 * cân bằng tốt giữa hiệu năng, bảo mật và khả năng mở rộng.
 */