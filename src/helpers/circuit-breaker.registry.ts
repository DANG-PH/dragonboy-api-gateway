import {
  circuitBreaker,
  CircuitBreakerPolicy,
  CircuitState,
  ConsecutiveBreaker,
  handleWhen,
} from 'cockatiel';
import { HttpException } from '@nestjs/common';
import { publishCbState } from './cb-redis-sync';
import { DiscordAlert } from 'src/shared/discord.alert';

/**
 * CB phải được SHARE giữa tất cả lần gọi tới cùng 1 service.
 * Nếu tạo CB mới mỗi lần thì failure count không bao giờ tích lũy đủ để trip.
 */
const breakerRegistry = new Map<string, CircuitBreakerPolicy>();

// breaker.state trả về CircuitState enum (number), không phải string.
// Map này để convert sang string cho log và health endpoint.
const STATE_LABEL: Record<CircuitState, string> = {
  [CircuitState.Closed]:   'CLOSED',
  [CircuitState.Open]:     'OPEN',
  [CircuitState.HalfOpen]: 'HALF-OPEN',
  [CircuitState.Isolated]: 'ISOLATED',
};

export function getBreakerFor(serviceName: string): CircuitBreakerPolicy {
  if (!breakerRegistry.has(serviceName)) {
    const breaker = circuitBreaker(
      /**
       * Chỉ đếm lỗi >= 500 (server error) vào failure count.
       * Lỗi 4xx là business logic (sai input, không có quyền...) — service vẫn sống,
       * không nên trip CB. Ví dụ: 1000 user nhập sai password → 1000 lần 401
       * → nếu dùng handleAll() thì CB trip dù auth-service hoàn toàn bình thường.
       */
      handleWhen((err: unknown) =>
        err instanceof HttpException && err.getStatus() >= 500
      ),
      {
        halfOpenAfter: 10_000, // ms chờ ở OPEN trước khi thử 1 request (HALF-OPEN)
        breaker: new ConsecutiveBreaker(5), // trip sau 5 lần fail LIÊN TIẾP
      },
    );

    breaker.onStateChange(state => {
      const label = STATE_LABEL[state];
      const logFn = state === CircuitState.Open ? console.error : console.log;
      logFn(`[CB] [${serviceName}] → ${label} (instance: pm2-${process.pid})`);

      /**
       * Chỉ broadcast Open và Closed — 2 event cần sync toàn cluster:
       *   Open   → báo các instance khác isolate ngay
       *   Closed → báo các instance khác close (service đã recover)
       *
       * Không broadcast HalfOpen: đây là trạng thái nội bộ, CB đang tự test
       * recovery. Các instance khác không cần biết, chờ Closed event.
       *
       * Không broadcast Isolated: Isolated được set bởi chính Redis sync
       * (isolate() call từ message nhận được). Nếu broadcast lại sẽ tạo
       * vòng lặp: A isolate B → B publish Isolated → A nhận → A isolate → ...
       */
      if (state === CircuitState.Open) {
        publishCbState(serviceName, state);
        DiscordAlert.cbOpen({ serviceName, pid: process.pid });
      } else if (state === CircuitState.Closed) {
        publishCbState(serviceName, state);
        DiscordAlert.cbClosed({ serviceName, pid: process.pid });
      }
    });

    breakerRegistry.set(serviceName, breaker);
  }

  return breakerRegistry.get(serviceName)!;
}

export function getAllBreakerStates(): Record<string, string> {
  const result: Record<string, string> = {};
  breakerRegistry.forEach((breaker, name) => {
    result[name] = STATE_LABEL[breaker.state];
  });
  return result;
}

export { breakerRegistry };