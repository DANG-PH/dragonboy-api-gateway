// import {
//   Injectable,
//   NestInterceptor,
//   ExecutionContext,
//   CallHandler,
// } from '@nestjs/common';
// import { Observable } from 'rxjs';
// import { tap } from 'rxjs/operators';
// import { Tracer, Span } from 'opentracing';
// import { initTracer } from "jaeger-client";

// @Injectable()
// export class JaegerInterceptor implements NestInterceptor {
//   private tracer;

//   constructor() {
//     this.tracer = initTracer(
//       {
//         serviceName: "api-gateway",
//         sampler: { type: "const", param: 1 },
//         reporter: {
//             logSpans: true,
//             agentHost: process.env.JAEGER_CONNECT_HOST,
//             agentPort: process.env.JAEGER_CONNECT_PORT,
//         },
//       },
//       {},
//     );
//   }

//   intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
//     const http = context.switchToHttp();
//     const request = http.getRequest();
//     const response = http.getResponse();
//      const { method, url: path, headers, body, query } = request;

//     const spanContext = this.tracer.extract('http_headers', headers);

//     const span = this.tracer.startSpan(`HTTP Request ${path}`, {
//       childOf: spanContext || undefined,
//       tags: {
//         "http.method": method,
//         "http.path": path,
//         "span.kind": "server",
//       },
//     });

//     span.log({
//       event: 'request',
//       method,
//       path,
//       query: JSON.stringify(query),
//       body: body ? JSON.stringify(body).slice(0, 500) : null, // cắt ngắn
//       headers: {
//         'content-type': headers['content-type'],
//       },
//     });

//     const startTime = Date.now();

//     return next.handle().pipe(
//       tap({
//         next: (res) => {
//           // Log response
//           span.log({
//             event: 'response',
//             statusCode: response.statusCode,
//             body: res ? JSON.stringify(res).slice(0, 500) : null,
//           });

//           // Mark error nếu status >= 400
//           if (response.statusCode >= 400) {
//             span.setTag('error', true);
//             span.log({ event: 'error', message: `HTTP ${response.statusCode}` });
//           }

//           // Log latency
//           span.log({ event: 'request_end', duration_ms: Date.now() - startTime });

//           // Kết thúc span
//           span.finish();
//         },
//         error: (err) => {
//           // Log exception
//           span.setTag('error', true);
//           span.log({
//             event: 'exception',
//             'error.object': err,
//             message: err.message,
//             stack: err.stack,
//           });
//           span.log({ event: 'request_end', duration_ms: Date.now() - startTime });
//           span.finish();
//         },
//       }),
//     );
//   }
// }


/*

Type	                     Mô tả
const	                     Luôn tạo span (param=1) hoặc không tạo (param=0)
probabilistic	             Tạo span theo xác suất (param=0.1 → 10% request được trace)
rateLimiting	             Giới hạn số span tối đa/giây
remote	                     Lấy config từ Jaeger agent/collector

Ví dụ đang dùng:

sampler: { type: "const", param: 1 }

→ nghĩa là trace tất cả request (thích hợp dev/test, production có thể dùng probabilistic).

*/