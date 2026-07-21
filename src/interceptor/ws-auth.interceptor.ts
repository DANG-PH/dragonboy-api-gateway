import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { Socket } from "dgram";
import { WsAuthService } from "src/service/ws-for-game/ws-auth.service";

@Injectable()
export class WsAuthInterceptor implements NestInterceptor {
  constructor(private readonly wsAuthService: WsAuthService) {}

  async intercept(context: ExecutionContext, next: CallHandler) {
    const client: Socket = context.switchToWs().getClient();

    await this.wsAuthService.ensureAuthFresh(client);

    return next.handle();
  }
}