// import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
// import { Observable, tap } from 'rxjs';

// @Injectable()
// export class LoggingInterceptor implements NestInterceptor {
//   private readonly logger = new Logger(LoggingInterceptor.name);

//   intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
//     const req = context.switchToHttp().getRequest();
//     const start = Date.now();

//     return next.handle().pipe(
//       tap(() => {
//         const duration = Date.now() - start;
//         this.logger.log(`${req.method} ${req.url} - ${duration}ms`);
//       }),
//     );
//   }
// }
