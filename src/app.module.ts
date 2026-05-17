import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './service/auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import { UserModule } from './service/user/user.module';
import { ItemModule } from './service/item/item.module';
import { DeTuModule } from './service/detu/detu.module';
import { PayModule } from './service/pay/pay/pay.module';
import { RedisModule } from './redis/redis.module';
import { LoggerMiddleware } from './middleware/logger.middleware';
import { NestModule,MiddlewareConsumer } from '@nestjs/common';
import { RateLimitMiddleware } from './security/rate_limit/rate_limit.middleware';
import { CashierModule } from './service/admin/cashier/cashier.module';
import { EditorModule } from './service/admin/editor/editor.module';
import { FinanceModule } from './service/pay/finance/finance.module';
import { PartnerModule } from './service/admin/partner/partner.module';
import { PlayerManagerModule } from './service/admin/player_manager/player_manager.module';
// import { LoggingInterceptor } from './interceptor/logger.interceptors';
// import { OnlineInterceptor } from './interceptor/online.interceptor';
import { AdminModule } from './service/admin/admin/admin.module';
// import { JaegerInterceptor } from './interceptor/tracing.interceptors';
import { ServerModule } from './service/server/server.module';
import { OpenaiModule } from './service/open-ai/openai.module';
import { ScheduleModule } from '@nestjs/schedule';
import { SocialNetworkModule } from './service/social_network/social_network.module';
import { WsChatModule } from './service/chat/ws-chat.module';
import { GameModule } from './service/game/game.module';
import { TemporaryBanGuard } from './security/guard/temporary-ban.guard';
import { JwtModule } from '@nestjs/jwt';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { GameDataModule } from './service/game-data/game-data.module';
import { JwtDecodeMiddleware } from './middleware/jwt-decode.middleware';
import { QueueModule } from './service/queue/queue.module';
import { ShopModule } from './service/queue/modules/shop/shop.module';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET,
    }), // Thêm vào để DI và bên temporary ban dùng được
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,           
      envFilePath: '.env',     
    }),
    AuthModule,
    UserModule,
    SocialNetworkModule,
    WsChatModule,
    ItemModule,
    DeTuModule,
    RedisModule,
    PayModule,
    AdminModule,
    PlayerManagerModule,
    CashierModule,
    FinanceModule,
    EditorModule,
    PartnerModule,
    ServerModule,
    OpenaiModule,
    GameModule,
    GameDataModule,
    QueueModule,
    ShopModule,
    EventEmitterModule.forRoot(), 
  ],
  controllers: [AppController],
  providers: [
    // OnlineInterceptor, 
    // LoggingInterceptor, 
    // JaegerInterceptor, 
    TemporaryBanGuard
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(JwtDecodeMiddleware, LoggerMiddleware, RateLimitMiddleware).forRoutes('*');
  }
}

// HTTP Request
//    ↓
// Express App (global)
//    ↓
// A → (app.use - middleware của bạn)
//    ↓
// Express Router (do Nest đăng ký)
//    ↓
// B → (middleware qua consumer.apply)
//    ↓
// Guards
//    ↓
// Interceptors (before)
//    ↓
// Pipes
//    ↓
// Controller
//    ↓
// Interceptors (after)
//    ↓
// Response

// middleware tầng express low level hơn nên ít tác vụ phức tạp thì dùng nó
// middleware tầng nest khi cần dùng DI thì xài ở đây