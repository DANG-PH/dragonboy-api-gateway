// // player_manager.service.ts
// import { Injectable } from '@nestjs/common';
// import { CACHE_MANAGER } from '@nestjs/cache-manager';
// import { Inject } from '@nestjs/common';

// @Injectable()
// export class PlayerManagerService {
//   constructor(
//     @Inject(CACHE_MANAGER) private readonly cacheManager: any
//   ) {}

//   async getOnlineUsersVer2(): Promise<{ total: number; users: string[] }> {
//     const store = this.cacheManager.stores[1];
  
//     const onlineUsers: string[] = [];  // Chỉ lưu username
//     // const onlineUsersData: Record<string, any> = {};  // Lưu cả data
    
//     if (store.iterator) {
//       // Scan toàn bộ key, vì truyền undefined, cách này k ổn, sau dùng ws để track useronline
//       for await (const [key, value] of store.iterator(undefined)) {
//         // Chỉ lấy keys bắt đầu với "online:"
//         if (key.startsWith('online:')) {
//           // Extract username từ "online:username" → "username"
//           const username = key.replace('online:', '');
          
//           onlineUsers.push(username);  // Thêm username vào array
//           // onlineUsersData[username] = value;  // Lưu data (nếu cần)
//         }
//       }
//     }
    
//     return {
//       total: onlineUsers.length,
//       users: onlineUsers,  
//     };
//   }
// }