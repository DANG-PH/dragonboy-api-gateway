import { Module } from "@nestjs/common";
import { JwtAuthGuard } from "src/security/JWT/jwt-auth.guard";
import { RolesGuard } from "src/security/guard/role.guard";
import { JwtStrategy } from "src/security/JWT/jwt.strategy";
import { JwtService } from "@nestjs/jwt";
import { ClientsModule, Transport } from "@nestjs/microservices";
import { GameController } from "./game.controller";

@Module({
    imports: [
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
    ],
    controllers: [GameController],
    providers: [JwtAuthGuard,JwtStrategy, RolesGuard, JwtService],
    exports: []
})
export class GameModule{};