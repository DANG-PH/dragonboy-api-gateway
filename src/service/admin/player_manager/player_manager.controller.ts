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
    
    if ( userId == userIdAdmin) {
      throw new HttpException(
        `Không thể ban chính mình`,
        HttpStatus.BAD_REQUEST,
      );
    }

    if (phut < 5 || phut > 4320) {
      throw new HttpException(
        `Thời gian ban phải từ 5 phút đến 3 ngày (4320 phút)`,
        HttpStatus.BAD_REQUEST,
      );
    }

    const user = await this.userService.handleProfile({id:userId});
    if (!user) {
      throw new HttpException(
        `User id ${userId} không tồn tại`,
        HttpStatus.NOT_FOUND,
      );
    }

    const now = Date.now();
    const timeHetHan = now + phut * 60 * 1000;

    const banData = {
      admin: usernameAdmin,
      why: why,
      startAt: new Date(now).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }),
      expireAt: new Date(timeHetHan).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }),
    }

    const currentBan = await this.cacheManager.get(`temporary-ban:${userId}`);
    this.gameClient.emit('auth.revoke_all_token', { userId: userId });
    
    if (currentBan) {
      await this.cacheManager.set(`temporary-ban:${userId}`, banData, phut * 60 * 1000);
      return {
        message: `Tài khoản có id ${userId} đang bị khóa. Đã cập nhật thành ${phut} phút.`,
        admin: usernameAdmin,
      };
    }

    await this.cacheManager.set(`temporary-ban:${userId}`, banData, phut * 60 * 1000);

    return {
      message: `Đã khóa tài khoản có id ${userId} trong ${phut} phút.`,
      admin: usernameAdmin,
    };
  }

  @Delete('temporary-ban/:userId')
  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.PLAYER_MANAGER)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'ADMIN/PLAYER MANAGER mở khóa tài khoản nếu đang bị khóa tạm thời' })
  async unbanUser(@Param('userId') userId: number) {
    const current = await this.cacheManager.get(`temporary-ban:${userId}`);
    if (!current) {
      return { message: `User id ${userId} hiện không bị khóa` };
    }

    await this.cacheManager.del(`temporary-ban:${userId}`);
    return { message: `Đã mở khóa tài khoản user id ${userId}` };
  }

  @Get('temporary-ban-all')
  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.PLAYER_MANAGER)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'ADMIN/PLAYER MANAGER xem danh sách user đang bị ban (tạm thời)' })
  async getAllTemporaryBannedUsers(): Promise<any> {
    const store = this.cacheManager.stores?.[1]; // store redis

    // const store1 = this.cacheManager.stores?.[0].store; store ở RAM memory
    // for (const key of store._lru.nodesMap.keys()) {
    //   if (key.includes('temporary-ban:')) {
    //     const userId = key.split('temporary-ban:')[1];
    //     const value = store._lru.nodesMap.get(key)?.value;
    //     bans.push({ userId, data: value });
    //   }
    // }

    // console.log(store)

    const bans: Array<{
      userId: string,
      data: any
    }> = [];

    if (store?.iterator) {
      for await (const [key, value] of store.iterator(undefined)) {
        // Lọc các key bắt đầu bằng "temporary-ban:"
        if (key.startsWith('temporary-ban:')) {
          const userId = key.replace('temporary-ban:', '');
          bans.push({ userId, data: value });
        }
      }
    }

    return {
      total: bans.length,
      bans,
    };
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
}