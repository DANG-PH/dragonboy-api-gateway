import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import { Role } from 'src/enums/role.enum';
import { RolesGuard } from 'src/security/guard/role.guard';

export const ROLES_KEY = process.env.ROLES_KEY;

// export function Roles(...roles: Role[]) {
//   return applyDecorators(SetMetadata(ROLES_KEY, roles), UseGuards(RolesGuard));
// }

export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

// 🔍 Tại sao dùng applyDecorators(...)?

// Vì bạn muốn decorator @Roles() bao gồm nhiều decorator khác bên trong.
// Nếu không dùng, bạn phải viết thế này:

// @SetMetadata(ROLES_KEY, [Role.Admin, Role.User])
// @UseGuards(RolesGuard)
// @Get('admin')
// findAdmin() {}


// → Rất dài, lặp đi lặp lại nhiều nơi 

// Nên người ta gom lại thành 1 decorator duy nhất:

// @Roles(Role.Admin, Role.User)
// @Get('admin')
// findAdmin() {}

// viết ... để roles tự gom thành array thay vì bên controller phải viết []

// khi gọi phải có @Role thay vì Role vì:

// Vì @ chính là ký hiệu TypeScript để biểu thị decorator
// → Khi parse code, TS mới biết:

// 📌 “Hàm này không chỉ chạy mà còn phải gắn vào class/method/property phía sau”

// ✅ Có @
// @Roles('ADMIN')
// getUsers() {}
// ➡ NestJS hiểu:

// “Method này có metadata ROLE = ADMIN”
// → RolesGuard sẽ đọc metadata & chặn user không đủ quyền ✅

// k có @ thì hàm chỉ chạy và method sau nó k nhận đc guard và metadata

// Khi viết:

// @Decorator
// method() {}

// TypeScript dịch ngầm thành:

// method = Decorator(method);