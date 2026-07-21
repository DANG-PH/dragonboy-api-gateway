import { AuthModule } from "src/service/auth/auth.module";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { JwtStrategy } from "./jwt.strategy";
import { Global, Module } from "@nestjs/common";

@Global()
@Module({
  imports: [AuthModule],        // AuthModule export AuthService
  providers: [JwtAuthGuard, JwtStrategy],
  exports: [JwtAuthGuard],      // export ra ngoài dùng
})
export class SecurityModule {}