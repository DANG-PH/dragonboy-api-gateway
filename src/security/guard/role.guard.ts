import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  HttpException, HttpStatus
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { ROLES_KEY } from 'src/security/decorators/role.decorator';
import { Role } from '../../enums/role.enum';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]); // get all để đọc metadata có Role key tồn tại trong handler hoặc class
    if (!requiredRoles) {
      return true;
    }
    const user = context.switchToHttp().getRequest().user;
    if (!user) {
      throw new HttpException({
        status: HttpStatus.UNAUTHORIZED,
        error: 'Bạn chưa đăng nhập',
      }, HttpStatus.UNAUTHORIZED);
    }
    const hasRole = requiredRoles.some((role) => user.role === role);
    if (!hasRole) {
      throw new HttpException({
        status: HttpStatus.FORBIDDEN,
        error: `Bạn không có quyền. Yêu cầu: ${requiredRoles.join(', ')}`,
      }, HttpStatus.FORBIDDEN);
    }

    return true;
  }
}

// CanActivate → interface để tạo Guard

// ExecutionContext → lấy thông tin api hiện tại

// ForbiddenException → lỗi 403 (cấm truy cập)

// Injectable → cho phép guard được inject vào hệ thống DI của Nest

// import { Reflector } from '@nestjs/core';
// Dùng để đọc metadata (thông tin từ decorator @Roles())

// import { ROLES_KEY } from 'src/decorators/role.decorator';
// import { Role } from '../enums/role.enum';
// ROLES_KEY → tên metadata, ví dụ: 'roles'

// Role → enum chứa các quyền: ADMIN, USER, …

// @Injectable()
// export class RolesGuard implements CanActivate {
// Đánh dấu guard là Injectable để Nest quản lý

// CanActivate → yêu cầu guard có hàm canActivate
// canActivate là hàm NestJS gọi trước controller

// Nếu return:

// true ✅ → cho request đi tiếp

// false ❌ → chặn lại


// Client Request
//    |
//    v
// Middleware        (trước controller – parse, attach token,…)
//    |
//    v
// Guards 🛑         (quyền truy cập? nếu sai → dừng tại đây)
//    |
//    v
// Interceptors →→→→ (trước controller)
//    |
//    v
// Pipes ✅           (validate body, query,…)
//    |
//    v
// Controller Handler 🎯 (code của bạn)
//    |
//    v
// Interceptors ←←←← (sau controller: modify response)
//    |
//    v
// Exception Filters ❗ (nếu lỗi xảy ra ở bất kỳ đâu)
//    |
//    v
// Response 🔁 client


// ExecutionContext đại diện cho toàn bộ ngữ cảnh của một lần thực thi handler
// (ví dụ một request đến một route)

// 📌 Trong "ngữ cảnh" này bao gồm:

// Thông tin	Ví dụ
// Kiểu request đang xử lý	HTTP / WebSocket / RPC
// Controller nào đang xử lý	UsersController
// Method nào đang chạy	getProfile()
// Các object gốc	req, res, client, data…

// ✅ Tại sao nó truy cập được hết?

// Vì NestJS core khi nhận request sẽ:

// Nhận dữ liệu từ platform (Express/Fastify/WebSocket…)

// Đóng gói toàn bộ vào ExecutionContext

// Truyền ExecutionContext vào Guard → Interceptor → Pipe → Controller

// → Nhờ vậy các thành phần chung không phụ thuộc HTTP, nhưng vẫn truy cập được vào request gốc nếu cần.