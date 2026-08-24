// ============================================================
// NGUYÊN TẮC CHỌN ABAC/CASL vs TÁCH API
// ============================================================
//
// 1. ABAC/CASL
//    Khi: Cùng endpoint, cùng input, chỉ khác quyền truy cập
//
//    VD: GET /orders/:id   — :id là orderId
//
//        USER  gọi GET /orders/order_123
//              → CASL kiểm tra order_123.ownerId === req.user.userId
//              → Đúng chủ  → trả về order
//              → Sai chủ   → 403 Forbidden
//
//        ADMIN gọi GET /orders/order_123
//              → CASL bỏ qua kiểm tra ownership
//              → Trả về order
//
//        Lý do KHÔNG tách thành 2 API:
//              GET /orders/me/order_123  → USER
//              GET /orders/order_123     → ADMIN
//        Vì cả 2 role đều cần truy cập order bằng orderId
//        → Input giống nhau, chỉ khác quyền → dùng CASL
//
// ============================================================
//
// 2. TÁCH 2 API
//    Khi: Input khác nhau, ngữ nghĩa khác nhau
//
//    VD A: Profile
//        GET /profile/me    → USER tự xem profile, không cần truyền id
//        GET /profile/:id   → ADMIN xem profile bất kỳ, cần truyền userId
//        Lý do tách: Input khác nhau (me vs :id)
//
//    VD B: ADMIN muốn xem toàn bộ orders của 1 user bất kỳ
//        GET /orders/:id        → tìm 1 order cụ thể bằng orderId  (CASL)
//        GET /users/:id/orders  → tìm tất cả orders của 1 userId   (ADMIN only, tách API)
//        Lý do tách: Input khác nhau (orderId vs userId), ngữ nghĩa khác nhau
//
//        KHÔNG viết thành:
//        GET /orders/:id?userId=xxx  → query param lủng củng, không RESTful
//        GET /orders/:id             → :id nhập nhằng vừa là orderId vừa là userId
//
// ============================================================
//
// TÓM LẠI
//    Input giống, chỉ khác quyền/ownership  →  CASL
//    Input khác, ngữ nghĩa khác             →  Tách API

// // casl/casl.factory.ts
// import { AbilityBuilder, createMongoAbility } from '@casl/ability';
// import { Injectable } from '@nestjs/common';
// import { Role } from 'src/enums/role.enum';

// export enum Action {
//   Read = 'read',
// }

// export class AppAbility {
//   can: (action: string, subject: any) => boolean;
// }

// // Cùng endpoint, cùng input, khác quyền?  →  ABAC/CASL
// // Khác input, khác đối tượng dùng?        →  Tách 2 API + RBAC 
 
// @Injectable()
// export class CaslAbilityFactory {
//   createForUser(user: any) {
//     const { can, build } = new AbilityBuilder(createMongoAbility);

//     if (user.role === Role.ADMIN || user.role === Role.PLAYER_MANAGER) {
//       can(Action.Read, 'Profile');
//     } else {
//       can(Action.Read, 'Profile');
//     }

//     return build();
//   }
// }