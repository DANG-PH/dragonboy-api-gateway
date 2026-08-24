// import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
// import { Action, CaslAbilityFactory } from "./casl.factory";
// import { Reflector } from "@nestjs/core";
// import { Role } from "src/enums/role.enum";

// @Injectable()
// export class PoliciesGuard implements CanActivate {
//   constructor(
//     private reflector: Reflector,
//     private caslAbilityFactory: CaslAbilityFactory,
//   ) {}

//   async canActivate(context: ExecutionContext): Promise<boolean> {
//     const request = context.switchToHttp().getRequest();
//     const user = request.user;
//     const ability = this.caslAbilityFactory.createForUser(user);

//     if (!ability.can(Action.Read, 'Profile')) {
//       throw new ForbiddenException();
//     }

//     // USER thường → inject userId từ token vào request, bỏ qua param
//     if (user.role === Role.USER) {
//       request.params.id = user.userId;
//     }
//     // ADMIN/MANAGER → giữ nguyên param.id

//     return true;
//   }
// }