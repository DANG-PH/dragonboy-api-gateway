import { Controller, Post, Body, UseGuards, Patch, Inject, Get, Query, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody,ApiBearerAuth } from '@nestjs/swagger';
import { 
    GetPayByUserIdRequestDto,
    PayResponseDto,
    UpdateMoneyRequestDto,
    UpdateStatusRequestDto,
    CreatePayOrderRequestDto,
    CreatePayRequestDto,
    QrResponseDto
 } from 'dto/pay.dto';
import { JwtAuthGuard } from 'src/security/JWT/jwt-auth.guard';
import { Roles } from 'src/security/decorators/role.decorator';
import { Role } from 'src/enums/role.enum';
import { RolesGuard } from 'src/security/guard/role.guard';
import { HttpException, HttpStatus } from '@nestjs/common';
import { PayService } from './pay.service';
import type { Request } from 'express';
import { Cache } from '@nestjs/cache-manager';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { RequestWithUser } from 'src/interface/RequestWithUser.interface';

@Controller('pay')
@ApiTags('Api Pay') 
export class PayController {
  constructor(
    private readonly payService: PayService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache
  ) {}

  // @Get('pay-admin')
  // @ApiBearerAuth()
  // @Roles(Role.ADMIN)
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @ApiOperation({ summary: 'Lấy thông tin ví của user bất kì (ADMIN)(WEB)' })
  // async getPayAdmin(@Query() query: GetPayByUserIdRequestDto): Promise<PayResponseDto> {
  //   return this.payService.getPay(query);
  // }

  @Get('pay')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'User tự xem thông tin ví của bản thân (USER)(GAME/WEB) (ĐÃ DÙNG)' })
  async getPay(@Req() req: any): Promise<PayResponseDto> {
    const userId = req.user.userId;
    return this.payService.getPay({userId: userId});
  }
  
  // @Patch('money')
  // @ApiBearerAuth()
  // @Roles(Role.ADMIN)
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @ApiOperation({ summary: 'Update thông tin ví của user bất kì ( tiền trong ví ) (ADMIN)(WEB)' })
  // @ApiBody({ type:  UpdateMoneyRequestDto })
  // async updateMoney(@Body() body: UpdateMoneyRequestDto): Promise<PayResponseDto> {
  //   return this.payService.updateMoney(body);
  // }

  // @Patch('status')
  // @ApiBearerAuth()
  // @Roles(Role.ADMIN)
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @ApiOperation({ summary: 'Update thông tin ví của user bất kì ( khóa / mở khóa ) ví (ADMIN)(WEB)' })
  // @ApiBody({ type:  UpdateStatusRequestDto })
  // async updateStatus(@Body() body: UpdateStatusRequestDto): Promise<PayResponseDto> {
  //   return this.payService.updateStatus(body);
  // }

  @Post('create-pay')
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Tạo ví cho user bất kì (BACKEND DEV)(SWAGGER) (ĐÃ DÙNG)' })
  @ApiBody({ type:  CreatePayRequestDto })
  async createPay(@Body() body: CreatePayRequestDto): Promise<PayResponseDto> {
    return this.payService.createPay(body);
  }

  @Get('qr')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Lấy thông tin chuyển khoản ( mã QR ) (ALL)(WEB) (ĐÃ DÙNG)' })
  async getQr(@Query() query: CreatePayOrderRequestDto, @Req() req: RequestWithUser): Promise<QrResponseDto> {
    const userId = req.user.userId;
    const username = req.user.username;
    const request = {
      userId: userId,
      username: username,
      ...query
    }
    return this.payService.getQr(request);
  }
}