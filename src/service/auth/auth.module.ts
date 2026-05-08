import { forwardRef, Global, Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { join } from 'path';
import { AUTH_PACKAGE_NAME } from 'proto/auth.pb';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from 'src/security/JWT/jwt.strategy';
import { RolesGuard } from 'src/security/guard/role.guard';
import { UserModule } from 'src/service/user/user.module';
import { SocialNetworkModule } from '../social_network/social_network.module';
import { WsChatModule } from '../chat/ws-chat.module';

@Global()
@Module({
  imports: [
    ClientsModule.register([
      {
        name: AUTH_PACKAGE_NAME,
        transport: Transport.GRPC,
        options: {
          package: AUTH_PACKAGE_NAME,
          protoPath: join(process.cwd(), 'proto/auth.proto'),
          url: process.env.AUTH_URL,
          loader: {
            keepCase: true,
            objects: true,
            arrays: true,
          },
        },
      },
    ]),
    ClientsModule.register([
      {
          name: String(process.env.RABBIT_GAME_SERVICE),
          transport: Transport.RMQ,
          options: {
          urls: [String(process.env.RABBIT_URL)],
          queue: process.env.RABBIT_GAME_QUEUE,
          queueOptions: { durable: true },
          },
      },
    ]),
    UserModule,
    forwardRef(() => SocialNetworkModule) ,
    forwardRef(() => WsChatModule),
  ],
  controllers: [AuthController],
  providers: [AuthService,JwtStrategy,RolesGuard],
  exports: [AuthService]
})
export class AuthModule {}

// JwtAuthGuard cần AuthService
//         ↓
// AuthService nằm trong AuthModule
//         ↓
// Module nào dùng JwtAuthGuard → phải import AuthModule
//         ↓
// UserModule, OrderModule, ProductModule... đều phải import AuthModule
//         ↓
// Lặp lại ở mọi nơi → rất dư thừa
//         ↓
// Giải pháp: @Global() + import 1 lần ở AppModule

// ===================================================

// Tại sao chỉ import ở AppModule là đủ?
//         ↓
// Bình thường: NestJS DI hoạt động theo module scope
// → Mỗi module chỉ thấy provider của chính nó
//    và các module mà nó đã import
//         ↓
// Khi thêm @Global() vào AuthModule:
// → NestJS tạo thêm 1 "Global Container" dùng chung cho toàn app
// → Tất cả exports của AuthModule được đẩy vào Global Container
// → Mọi module đều tự động thấy mà KHÔNG cần import AuthModule

// ===================================================

// Nhưng @Global() không tự kích hoạt:
//         ↓
// NestJS vẫn cần khởi tạo AuthModule ít nhất 1 lần
// để đưa exports vào Global Container
//         ↓
// → Import AuthModule tại AppModule (root)
// → NestJS khởi tạo AuthModule khi app start
// → Thấy @Global() → đẩy AuthService, JwtAuthGuard vào Global Container
// → Từ đây toàn bộ app dùng được, không cần import lại ở đâu nữa

// ===================================================

// Minh họa:

// Không có @Global():
// ┌─────────────────────────────────────┐
// │ AppModule                           │
// │  ├── UserModule    (import AuthModule) │
// │  ├── OrderModule   (import AuthModule) │
// │  ├── ProductModule (import AuthModule) │
// │  └── AuthModule                     │
// └─────────────────────────────────────┘
// → Mỗi module tự import → lặp lại, dư thừa

// Có @Global():
// ┌─────────────────────────────────────────────┐
// │ AppModule                                   │
// │  ├── [Global Container]                     │
// │  │      └── AuthService, JwtAuthGuard       │
// │  │           (ai cũng thấy, không cần import)│
// │  ├── UserModule    ✅ thấy Global Container  │
// │  ├── OrderModule   ✅ thấy Global Container  │
// │  ├── ProductModule ✅ thấy Global Container  │
// │  └── AuthModule → đăng ký vào Global Container│
// └─────────────────────────────────────────────┘
// → Chỉ import AuthModule 1 lần ở AppModule là đủ
