import { Controller, UseGuards, Req, Get, Inject, Patch, Post, Body, Param, Query, Delete, Put } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody,ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/security/JWT/jwt-auth.guard';
import { Roles } from 'src/security/decorators/role.decorator';
import { Role } from 'src/enums/role.enum';
import { RolesGuard } from 'src/security/guard/role.guard';
import { HttpException, HttpStatus } from '@nestjs/common';
import { Cache } from '@nestjs/cache-manager';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { AuthService } from 'src/service/auth/auth.service';
import { UserService } from 'src/service/user/user.service';
import { DeTuService } from 'src/service/detu/detu.service';
import { ItemService } from 'src/service/item/item.service';
import {UsernameRequestDto} from "dto/user.dto"
import {UserIdRequestDto } from "dto/item.dto"
import { GetDeTuRequestDto } from 'dto/detu.dto'
import { 
    GetPayByUserIdRequestDto,
    PayResponseDto,
 } from 'dto/pay.dto';
import { PayService } from 'src/service/pay/pay/pay.service';
import { SendEmailToUserRequestDto, SendemailToUserResponseDto } from 'dto/auth.dto';
import { TemporaryBanRequestDto } from 'dto/player_manager.dto';
import { Cron, CronExpression } from '@nestjs/schedule';
import { FinanceService } from 'src/service/pay/finance/finance.service';
// import { winstonLogger } from 'src/logger/logger.config';
// import { PlayerManagerService } from './player_manager.service';
import Redlock, { ResourceLockedError, ExecutionError, Lock as RLock } from 'redlock';
import Redis from 'ioredis';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ClientProxy } from '@nestjs/microservices';

@Controller('player_manager')
@ApiTags('Api Player Manager') 
export class PlayerManagerController {
  private redlock: Redlock;
  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private authService: AuthService,
    private userService: UserService,
    private deTuService: DeTuService,
    private itemService: ItemService,
    private payService: PayService,
    private financeService: FinanceService,
    // private playerManagerService: PlayerManagerService,
    // private eventEmitter: EventEmitter2,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
    @Inject(String(process.env.RABBIT_GAME_SERVICE)) private readonly gameClient: ClientProxy,
  ) {
    this.redlock = new Redlock([this.redis], { retryCount: 0 }); // 1 node redis
  }

  // @Get('user-online-Ver1')
  // @ApiBearerAuth()
  // @Roles(Role.ADMIN, Role.PLAYER_MANAGER)
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @ApiOperation({ summary: 'Admin/Player Manager xem user nào đang online (ADMIN/PLAYER MANAGER)(WEB) (CHƯA DÙNG)' })
  // async getOnlineUsersVer1(): Promise<any> {
  //   const value = await this.cacheManager.get('online_users')
  //   return {
  //     users: value
  //   }
  // }

  // @Get('user-online-Ver2')
  // @ApiBearerAuth()
  // @Roles(Role.ADMIN, Role.PLAYER_MANAGER)
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @ApiOperation({ summary: 'Admin/Player Manager xem user nào đang online (ADMIN/PLAYER MANAGER)(WEB) (CHƯA DÙNG - VER2 NÀY CHÍNH XÁC HƠN VER1)' })
  // async getOnlineUsersVer2(): Promise<any> {
  //   return this.playerManagerService.getOnlineUsersVer2();
  // }

  // Gọi sang user-service
  @Get('profile/:id')
  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.PLAYER_MANAGER)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Lấy thông tin của 1 user bất kì dựa trên auth id của user đó (ADMIN/PLAYER MANAGER)(WEB) (CHƯA DÙNG)' })
  async profileadmin(@Param() param: UsernameRequestDto) {
    // BFF aggregation: merge data từ User service + Auth service
    // Admin/PM cần username để gửi mail cho user
    // TODO: migrate sang event-driven replication như avatar_url khi traffic tăng
    const [userProfile, authProfile] = await Promise.all([
      this.userService.handleProfile(param),
      this.authService.handleProfile(param).catch((err) => {
        return null;
      }),
    ]);

    return {
      ...userProfile,
      username: authProfile?.username ?? null,
    };
  }

  // @Get('balance-web') //dùng @query vì có thể thêm điều kiện sau, còn @Param thì truy vấn nhất định mới nên dùng 
  // @ApiBearerAuth()
  // @Roles(Role.ADMIN, Role.PLAYER_MANAGER)
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @ApiOperation({ summary: 'Lấy thông tin vàng nạp từ web và ngọc nạp từ web của user (ADMIN/PLAYER MANAGER)(WEB) (CHƯA DÙNG)' })
  // async getBalanceWebAdmin(@Query() query: UsernameRequestDto) {
  //   return this.userService.handleGetBalanceWeb(query);
  // }

  // @Get('item-web')
  // @ApiBearerAuth()
  // @Roles(Role.ADMIN, Role.PLAYER_MANAGER)
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @ApiOperation({ summary: 'lấy item web của 1 user bất kì (ADMIN/PLAYER MANAGER)(WEB) (CHƯA DÙNG)' })
  // async getItemWebAdmin(@Query() query: UsernameRequestDto) {
  //   return this.userService.handleGetItemWeb(query);
  // }
  
  // // Gọi sang item-service
  @Get('user-items')
  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.PLAYER_MANAGER)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Lấy tất cả thông tin item của 1 user bất kì (ADMIN/PLAYER MANAGER)(WEB) (CHƯA DÙNG)' })
  async getUserItemAdmin(@Query() query: UserIdRequestDto) {
    return this.itemService.handleGetItemByUser(query);
  }

  // Gọi sang đệ tử service
  @Get('de-tu')
  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.PLAYER_MANAGER)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Lấy đệ tử của user bất kì (ADMIN/PLAYER MANAGER)(WEB) (CHƯA DÙNG)' })
  async getDeTuAdmin(@Query() query: GetDeTuRequestDto) {
    return this.deTuService.handleGetDeTu(query);
  }

  // Gọi sang pay-service
  @Get('pay')
  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.PLAYER_MANAGER)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Lấy thông tin ví của user bất kì (ADMIN/PLAYER MANAGER)(WEB) (CHƯA DÙNG)' })
  async getPayAdmin(@Query() query: GetPayByUserIdRequestDto): Promise<PayResponseDto> {
    return this.payService.getPay(query);
  }

  // Gửi thông báo email cho user ( gọi sang auth )
  @Post('send-email')
  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.PLAYER_MANAGER)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'ADMIN/PLAYER MANAGER gửi thông báo qua email cho user ( hoặc all ) ví dụ như ( bảo trì, cập nhật, ... ) (CHƯA DÙNG) ' })
  @ApiBody({ type:  SendEmailToUserRequestDto })
  async sendEmailToUser(@Body() body: SendEmailToUserRequestDto): Promise<SendemailToUserResponseDto> {
    return this.authService.handleSendEmailToUser(body);
  }

  @Post('temporary-ban')
  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.PLAYER_MANAGER)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'ADMIN/PLAYER MANAGER khóa tài khoản tạm thời của 1 user ( max 3 ngày )' })
  @ApiBody({ type:  TemporaryBanRequestDto })
  async temporaryBan(@Body() body: TemporaryBanRequestDto, @Req() req: any) {
    const { userId, phut, why } = body;
    const usernameAdmin = req.user.username;
    const userIdAdmin = req.user.userId;

    if (userId == userIdAdmin) {
      throw new HttpException(`Không thể ban chính mình`, HttpStatus.BAD_REQUEST);
    }

    if (phut < 5 || phut > 4320) {
      throw new HttpException(
        `Thời gian ban phải từ 5 phút đến 3 ngày (4320 phút)`,
        HttpStatus.BAD_REQUEST,
      );
    }

    const user = await this.userService.handleProfile({ id: userId });
    if (!user) {
      throw new HttpException(`User id ${userId} không tồn tại`, HttpStatus.NOT_FOUND);
    }

    const now = Date.now();
    const banKey = `temporary-ban:${userId}`;

    const banData = JSON.stringify({
      admin: usernameAdmin,
      why,
      startAt: new Date(now).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }),
      expireAt: new Date(now + phut * 60 * 1000).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }),
    });

    const currentBan = await this.redis.get(banKey);

    await this.redis
      .pipeline()
      .set(banKey, banData, 'EX', phut * 60)
      .sadd('banned-users-index', String(userId))
      .exec();

    this.gameClient.emit('auth.revoke_all_token', { userId });

    return {
      message: currentBan
        ? `Tài khoản ${userId} đang bị khóa. Đã cập nhật thành ${phut} phút.`
        : `Đã khóa tài khoản ${userId} trong ${phut} phút.`,
      admin: usernameAdmin,
    };
  }

  @Delete('temporary-ban/:userId')
  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.PLAYER_MANAGER)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'ADMIN/PLAYER MANAGER mở khóa tài khoản nếu đang bị khóa tạm thời' })
  async unbanUser(@Param('userId') userId: number) {
    const banKey = `temporary-ban:${userId}`;

    const current = await this.redis.get(banKey);
    if (!current) {
      return { message: `User id ${userId} hiện không bị khóa` };
    }

    await this.redis
      .pipeline()
      .del(banKey)
      .srem('banned-users-index', String(userId))
      .exec();

    return { message: `Đã mở khóa tài khoản user id ${userId}` };
  }

  /**
   * Lấy danh sách tất cả user đang bị ban tạm thời.
   *
   * TẠI SAO DÙNG REDIS CLIENT THAY VÌ CACHE MANAGER?
   * CacheManager chỉ hỗ trợ get/set/del đơn giản — không có pipeline,
   * smembers, ttl, srem,... vì được thiết kế agnostic (có thể swap
   * backend memory/Redis/Memcached), nên chỉ expose interface chung nhất.
   * Cần Redis-specific API thì phải dùng thẳng Redis Client (ioredis).
   *
   * TẠI SAO DÙNG SET INDEX THAY VÌ ITERATOR (cách cũ - Commit 328 đổ về + đổi store[1] thành store[0])?
   * Cách cũ dùng store.iterator() của Keyv để duyệt toàn bộ keyspace,
   * tìm các key có prefix "temporary-ban:" → O(n) theo TỔNG SỐ KEY trong Redis.
   * Tức là Redis đang chứa 1 triệu key (game state, dirty flag, session,...)
   * thì phải duyệt hết 1 triệu key đó dù chỉ có 5 người bị ban.
   * Ngoài ra logic còn sai: iterator() trả về key đã bị Keyv strip namespace,
   * dẫn đến startsWith('temporary-ban:') có thể không bao giờ match
   * → luôn trả về mảng rỗng dù có user đang bị ban.
   *
   * CÁCH MỚI DÙNG REDIS SET INDEX:
   * Mỗi khi ban user → sadd 'banned-users-index' userId
   * Mỗi khi unban   → srem 'banned-users-index' userId
   * → smembers chỉ trả về đúng tập user đang bị ban → O(n) theo SỐ USER BỊ BAN.
   * Cùng là O(n) nhưng n của cách mới là số user bị ban (thường rất nhỏ),
   * còn n của cách cũ là tổng số key trong Redis (có thể rất lớn).
   * Pipeline gom toàn bộ GET + TTL thành 1 round trip duy nhất.
   */
  @Get('temporary-ban-all')
  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.PLAYER_MANAGER)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'ADMIN/PLAYER MANAGER xem danh sách user đang bị ban (tạm thời)' })
  async getAllTemporaryBannedUsers(): Promise<any> {
    const userIds = await this.redis.smembers('banned-users-index');

    if (!userIds.length) {
      return { total: 0, bans: [] };
    }

    const pipeline = this.redis.pipeline();
    for (const userId of userIds) {
      pipeline.get(`temporary-ban:${userId}`);
      pipeline.ttl(`temporary-ban:${userId}`);
    }
    const results = await pipeline.exec();

    // Lazy clean up - trade off hợp lí vì cái này để admin xem thôi (k liên quan tới logic time ban của user)
    // Có 1 vài cách như zadd rồi tính score nhưng có thể implement sau
    const bans = [];
    const expiredUserIds = [];

    for (let i = 0; i < userIds.length; i++) {
      const [, raw] = results[i * 2];
      const [, ttl] = results[i * 2 + 1];

      if (!raw || ttl === -2) {
        expiredUserIds.push(userIds[i]);
        continue;
      }

      bans.push({
        userId: userIds[i],
        data: JSON.parse(raw as string),
        ttl,
      });
    }

    if (expiredUserIds.length) {
      await this.redis.srem('banned-users-index', ...expiredUserIds);
    }

    return { total: bans.length, bans };
  }

  @Cron('0 20 * * *', {
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async callApi() {
    // Để xem tại sao xử lí như này => coi file redlock.md
    let lock: RLock | null = null;
    try {
      lock = await this.redlock.acquire(['lock:cron:callApi'], 60_000);
      return await this.authService.handleSendEmailToUser({
        who: "ALL",
        title: "Ngọc Rồng Tranh Bá",
        content: `Sự kiện hằng ngày Ngọc Rồng Sao Đen đã chính thức khởi động. 
                  <br/>
                  Đây là hoạt động thử thách khả năng sinh tồn, phối hợp bang hội và kỹ năng chiến đấu của mỗi chiến binh tham gia.
                  Mỗi ngày, hệ thống sẽ tạo ra một viên Ngọc Rồng Sao Đen duy nhất tại bản đồ sự kiện. Tất cả người chơi đều có thể tham gia tranh đoạt. Khi nhặt được Ngọc Rồng Sao Đen, người chơi sẽ bước vào trạng thái Người Mang Ngọc, trở thành mục tiêu mà toàn bộ khu vực có thể nhìn thấy.
                  <br/>
                  Nhiệm vụ rất đơn giản nhưng vô cùng khắc nghiệt:
                  duy trì việc cầm giữ Ngọc Rồng Sao Đen trong 30 phút liên tục.
                  <br/>
                  Hãy chuẩn bị trang bị mạnh nhất, tổ chức đội hình phù hợp và đừng bỏ lỡ cơ hội khẳng định vị thế của bang hội mình trong sự kiện Ngọc Rồng Sao Đen mỗi ngày.
                  <br/>
                  Chúc bạn may mắn và giành chiến thắng.`
      })
    } catch (err) {
      if (err instanceof ExecutionError || err instanceof ResourceLockedError) {
        console.warn('Cron job bị lock bởi instance khác, bỏ qua');
        return;
      }
      throw err;
    } finally {
      if (lock) {
        await lock.release();
      }
    }
  }

  @Cron('0 0 * * *', {
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async logDoanhThu() {
    let lock: RLock | null = null;
    try {
      // Để xem tại sao xử lí như này => coi file redlock.md
      lock = await this.redlock.acquire(['lock:cron:logDoanhThu'], 30_000);
      const doanhThu = await this.financeService.handleGetFinanceSummary({});
      const tienNap = doanhThu.total_nap;
      const tienRut = doanhThu.total_rut;
      const tienLai = doanhThu.balance;
      const now = new Date();
      const ngay = now.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
      const gio = now.toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
      // winstonLogger.log({ nhiemVu: 'thongBaoDoanhThu', doanhThu: tienLai })
      return await this.authService.handleSendEmailToUser({
        who: "ADMIN",
        title: "Thông kê doanh thu",
        content: `Báo cáo doanh thu ngày ${ngay} (lúc ${gio})

        Hệ thống đã tổng hợp doanh thu trong ngày với các số liệu sau:

        <br/>

        • Tổng tiền nạp: ${tienNap.toLocaleString('vi-VN')} VNĐ
        <br/>
        • Tổng tiền rút: ${tienRut.toLocaleString('vi-VN')} VNĐ
        <br/>
        • Lợi nhuận thực (sau khi trừ rút): ${tienLai.toLocaleString('vi-VN')} VNĐ
        <br/>
        <br/>

        Báo cáo được tạo tự động bởi hệ thống vào lúc ${gio}.
        Vui lòng kiểm tra lại trên hệ thống nếu cần đối soát chi tiết.`
      })
    } catch (err) {
      if (err instanceof ExecutionError || err instanceof ResourceLockedError) {
        console.warn('Cron job bị lock bởi instance khác, bỏ qua');
        return;
      }
      throw err;
    } finally {
      if (lock) {
        await lock.release();
      }
    }
  }

  // @Cron('30 3 * * *', {
  //   timeZone: 'Asia/Ho_Chi_Minh',
  // })
  // async baoTriHangNgay() {
  //   // Để xem tại sao xử lí như này => coi file redlock.md
  //   let lock: RLock | null = null;
  //   try {
  //     lock = await this.redlock.acquire(['lock:cron:baoTriHangNgay'], 60_000);
  //     // Alert cho all user trong game là game sắp bảo trì sau 30p
  //     this.gameClient.emit('game.notification', { tinNhan: "Game sẽ được bảo trì sau 30 phút nữa" });
  //     // Set bullmq 30p sau bảo trì (k dùng 2 cron vì chưa chắc 2 cron đều xảy ra, case này cần phụ thuộc nhau)
  //     // Mở khóa bảo trì cũng vậy
  //   } catch (err) {
  //     if (err instanceof ExecutionError || err instanceof ResourceLockedError) {
  //       console.warn('Cron job bị lock bởi instance khác, bỏ qua');
  //       return;
  //     }
  //     throw err;
  //   } finally {
  //     if (lock) {
  //       await lock.release();
  //     }
  //   }
  // }
}