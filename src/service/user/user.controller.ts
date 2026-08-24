import { JwtAuthGuard } from 'src/security/JWT/jwt-auth.guard';
import { UserService } from './user.service';
import { Controller, Post, Body, UseGuards, Param, Get, Patch, Put, Delete, Query, Req, Inject } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody,ApiBearerAuth, ApiQuery, ApiParam, ApiOkResponse } from '@nestjs/swagger';
import {UseItemAdminRequestDto,AddItemAdminRequestDto,UserDto,UpdateBalanceRequestDto,UseBalanceRequestDto,UseItemRequestDto,UserListResponseDto,UserResponseDto,UsernameRequestDto,GetUserRequestDto,EmptyDto,AddItemRequestDto,BalanceResponseDto,MessageResponseDto,RegisterRequestDto,SaveGameRequestDto,ItemListResponseDto,RegisterResponseDto,SaveGameResponseDto,AddBalanceRequestDto} from "dto/user.dto"
import { Roles } from 'src/security/decorators/role.decorator';
import { Role } from 'src/enums/role.enum';
import { RolesGuard } from 'src/security/guard/role.guard';
import { LoaiNapTien } from 'src/enums/nap.enum';
import { Cron, CronExpression } from '@nestjs/schedule';
import Redis from 'ioredis';

@Controller('user')
@ApiTags('Api User') 
export class UserController {
  constructor(
    private readonly userService: UserService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {}

  @Get('profile/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'User xem profile của chính mình (USER)(GAME/WEB) (ĐÃ DÙNG)' })
  async profile(@Req() req: any) {
    const userId = req.user.userId;
    const platform = req.user.platform; // lấy từ JWT

    if (platform === 'game') {
      // Game luôn lấy từ DB - cần data chính xác
      // console.log("Game lấy data profile")
      return this.userService.handleProfile({ id: userId });
    }

    // Web: lazy cache, case này no lock is fine (cùng lắm 2-3 req hit db, k gây ra vấn đề quá lớn)
    const key = `profile:${userId}`;
    const cache = await this.redis.get(key);
    if (cache) return JSON.parse(cache);

    const data = await this.userService.handleProfile({ id: userId });
    // Chưa có invalidate on write thì 2 phút cache là sweet pot
    this.redis.set(key, JSON.stringify(data), 'EX', 120); // TTL, Fire and Forget 
    return data;
  }

  @Put('save-game')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'User tự lưu thông tin của mình vào database (USER)(GAME) (ĐÃ DÙNG)' })
  @ApiBody({ type:  SaveGameRequestDto })
  async saveGame(@Body() body: SaveGameRequestDto, @Req() req: any) {
    const userId = req.user.userId;
    const request = {
      user: {
        ...body.user,
        id: userId,
        auth_id: userId,
      }
    }
    return this.userService.handleSaveGame(request);
  }

  @Get('balance-web') 
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'User lấy thông tin vàng nạp từ web và ngọc nạp từ web của bản thân (USER)(GAME/WEB) (ĐÃ DÙNG)' })
  async getBalanceWeb(@Req() req: any) {
    const userId = req.user.userId;
    return this.userService.handleGetBalanceWeb({id: userId});
  }

  @Patch('add-vang-web')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Thêm vàng ( nạp trên web ) (USER)(WEB) (CHƯA DÙNG)' })
  @ApiBody({ type:  AddBalanceRequestDto })
  async addVangWeb(@Body() body: AddBalanceRequestDto, @Req() req: any) {
    const userId = req.user.userId;
    const request = {
      ...body,
      id: userId
    }
    return this.userService.handleAddVangWeb(request);
  }

  @Patch('add-ngoc-web')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Thêm ngọc ( nạp trên web ) (USER)(WEB) (CHƯA DÙNG)' })
  @ApiBody({ type:  AddBalanceRequestDto })  
  async addNgocWeb(@Body() body: AddBalanceRequestDto, @Req() req: any) {
    const userId = req.user.userId;
    const request = {
      ...body,
      id: userId
    }
    return this.userService.handleAddNgocWeb(request);
  }

  @Patch('use-vang-web')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Sử dụng vàng ( nạp trên web ) (USER)(GAME) (ĐÃ DÙNG)' })
  @ApiBody({ type:  UseBalanceRequestDto })
  async useVangWeb(@Body() body: UseBalanceRequestDto, @Req() req: any) {
    const userId = req.user.userId;
    const request = {
      ...body,
      id: userId
    }
    return this.userService.handleUseVangWeb(request);
  }

  @Patch('use-ngoc-web')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Sử dụng ngọc ( nạp trên web ) (USER)(GAME) (ĐÃ DÙNG)' })
  @ApiBody({ type:  UseBalanceRequestDto })  
  async useNgocWeb(@Body() body: UseBalanceRequestDto, @Req() req: any) {
    const userId = req.user.userId;
    const request = {
      ...body,
      id: userId
    }
    return this.userService.handleUseNgocWeb(request);
  }

  @Post('add-item-web')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'User add item web ( id đồ ) cho bản thân (USER)(WEB) (ĐÃ DÙNG)' })
  @ApiBody({ type:  AddItemRequestDto })  
  async addItemWeb(@Body() body: AddItemRequestDto, @Req() req: any) {
    const userId = req.user.userId;
  
    return this.userService.handleAddItemWeb({
      ...body,
      id: userId
    });
  }

  @Delete('use-item-web')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'User sử dụng item web ( id đồ ) cho bản thân (USER)(GAME) (ĐÃ DÙNG)' })
  @ApiBody({ type:  UseItemRequestDto })  
  async useItemWeb(@Body() body: UseItemRequestDto, @Req() req: any) {
    const userId = req.user.userId;
    const request = {
      ...body,
      id: userId
    }
    return this.userService.handleUseItemWeb(request);
  }

  @Get('item-web')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'User lấy item web của bản thân (USER)(GAME/WEB) (ĐÃ DÙNG)' })
  async getItemWeb(@Req() req: any) {
    const userId = req.user.userId;
    return this.userService.handleGetItemWeb({id: userId});
  }

  @Get('top10-suc-manh')
  @ApiOperation({ summary: 'Lấy top 10 user có sức mạnh cao nhất (ALL)(WEB) (ĐÃ DÙNG)' })
  @ApiOkResponse({ type: UserListResponseDto })
  async getTop10SucManh() {
    const key = 'leaderboard:top10:sucmanh';
    const cache = await this.redis.get(key);
    if (cache) return JSON.parse(cache);

    // Chỉ hit DB khi lần đầu chưa có cache
    const data = await this.userService.handleGetTop10SucManh({});
    await this.redis.set(key, JSON.stringify(data), 'EX', 35);
    return data;
  }

  @Get('top10-vang')
  @ApiOperation({ summary: 'Lấy top 10 user có vang cao nhất (ALL)(WEB) (ĐÃ DÙNG)' })
  @ApiOkResponse({ type: UserListResponseDto })
  async getTop10Vang() {
    const key = 'leaderboard:top10:vang';
    const cache = await this.redis.get(key);
    if (cache) return JSON.parse(cache);

    // Chỉ hit DB khi lần đầu chưa có cache
    const data = await this.userService.handleGetTop10Vang({});
    await this.redis.set(key, JSON.stringify(data), 'EX', 35);
    return data;
  }

  @Cron(CronExpression.EVERY_30_SECONDS, {
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async cacheTop() {
    const query: EmptyDto = {};
    const [dataVang, dataSucManh] = await Promise.all([
      this.userService.handleGetTop10Vang(query),
      this.userService.handleGetTop10SucManh(query),
    ]);
    await this.redis.set(
      'leaderboard:top10:vang',
      JSON.stringify(dataVang),
      'EX',
      35 // TTL > cron interval (important)
    );
    await this.redis.set(
      'leaderboard:top10:sucmanh',
      JSON.stringify(dataSucManh),
      'EX',
      35 // TTL > cron interval (important)
    );
  }
}