import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';

// Đọc socket-redis-adapter.md
export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor: ReturnType<typeof createAdapter>;

  // Hàm thêm mới
  async connectToRedis(): Promise<void> {
    const pubClient = new Redis(process.env.REDIS_URL || '');
    const subClient = pubClient.duplicate();
    this.adapterConstructor = createAdapter(pubClient, subClient);
  }

  // @Override, Được chạy khi app.linsten, nhưng bên main.ts gọi connectToRedis trước nên luôn đúng
  createIOServer(port: number, options?: ServerOptions): any {
    const server = super.createIOServer(port, options); // ← tạo Socket.IO Server bình thường
    server.adapter(this.adapterConstructor); // ← gắn Redis adapter vào ngay lúc tạo
    return server;
  }
}