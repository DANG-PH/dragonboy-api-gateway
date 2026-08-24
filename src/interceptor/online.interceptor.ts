
// Sau này track online bằng Websocket

// import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Inject } from '@nestjs/common';
// import { Observable } from 'rxjs';
// import { tap } from 'rxjs/operators';
// import { Cache } from '@nestjs/cache-manager';
// import { CACHE_MANAGER } from '@nestjs/cache-manager';

// @Injectable()
// export class OnlineInterceptor implements NestInterceptor {
//   constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

//   intercept(context: ExecutionContext, next: CallHandler<any>): Observable<any> {
//     const req = context.switchToHttp().getRequest();
//     const username = req.user?.username; // đây là lí do đặt ở interceptor, vì cái này chạy sau guard nên có user từ token

//     const platform = this.detectPlatform(req);

//     if (username) {
//         const updateOnline = async () => {
//           //Ver1
//           let onlineUsers = await this.cacheManager.get<string[]>('online_users') || [];
//           let timeConLai = await this.cacheManager.ttl('online_users'); // trả về time hết hạn
//           if (timeConLai) timeConLai = timeConLai-Date.now();
//           else timeConLai = 60 * 1000;
//           if (!onlineUsers.includes(username)) onlineUsers.push(username);
//           await this.cacheManager.set('online_users', onlineUsers, timeConLai);

//           //Ver2
//           // console.log(req.ip);
//           await this.cacheManager.set(`online:${username}:${platform}`, req.headers['x-forwarded-for'] || req.ip, 60 * 1000);
//         };
//         updateOnline()
//         // from(updateOnline()).subscribe(); 
//         /*
//           chỗ này viết from subscribe để biến promise thành obversable chạy ngầm, hoặc dùng bình thường k await
//           còn nếu viết await updateOnline thì reponse sẽ trả chậm hơn cho người dùng
//         */
//     }
//     return next.handle();
//   }

//   private detectPlatform(req: any): 'web' | 'mobile' | 'game' {
//     const ua = req.headers?.['user-agent'];
//     if (ua && /mobile|android|iphone/i.test(ua)) return 'mobile';
//     if (ua && /mozilla|chrome|safari|edge|node/i.test(ua)) return 'web';
//     return 'game';  // fallback nếu là socket/gRPC/WebSocket
//   }
// }
