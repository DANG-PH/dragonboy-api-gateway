import { Module, Global } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-ioredis-yet';
import KeyvRedis from '@keyv/redis';
import { Keyv } from 'keyv';
import { CacheableMemory } from 'cacheable';
import Redis from 'ioredis';


@Global()
@Module({
  imports: [
    CacheModule.registerAsync({
      useFactory: async () => {
        return {
          stores: [
            // new Keyv({
            //   store: new CacheableMemory({ ttl: 0, lruSize: 5000 }),
            // }),
            new KeyvRedis(process.env.REDIS_URL), // hoặc kết nối cổng 6379 của local
          ],
          ttl: 0,
          namespace: process.env.NAME_SPACE_CACHE_KEY
        };
      },
    }),
  ],
  providers: [{
    provide: 'REDIS_CLIENT',
    useFactory: () => new Redis(process.env.REDIS_URL || ''),
  }],
  exports: [CacheModule, 'REDIS_CLIENT'],
})
export class RedisModule {}

/*

Cơ chế của redis và cache khi lấy key là xóa bỏ namespace, 
đây là điều hoàn toàn hợp lí Ví dụ product:123 và user:123 
thì nó đều chỉ trả về key chính là 123, nhưng hệ thống đang 
cần namespace của key để chọn những key nào có phần đó, ví dụ 
chọn all key product:, nhưng namespace tự động xóa mất r, 
cách tốt nhất là thêm namespace tổng , ở đây tôi thêm hdgstudio, 
có thể đánh lừa redis và cache để xóa hdgstudio và giữ lại product:123 
để get all key có chữ product dễ dàng hơn 

tại sao có 2 store ??, vì khi set cache thì nó sẽ set lên all keyv trong stores, lúc get thì nó xem từ trên xuống dưới

*/