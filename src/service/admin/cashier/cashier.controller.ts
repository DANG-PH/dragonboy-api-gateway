import { Controller, Post, Body, UseGuards, Patch, Req, Inject, Get, Query, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody,ApiBearerAuth } from '@nestjs/swagger';
import { WithdrawResponseDto, EmptyDto, ListWithdrawResponseDto, CreateWithdrawRequestDto, UpdateWithdrawStatusRequestDto } from 'dto/cashier.dto';
import { JwtAuthGuard } from 'src/security/JWT/jwt-auth.guard';
import { Roles } from 'src/security/decorators/role.decorator';
import { Role } from 'src/enums/role.enum';
import { RolesGuard } from 'src/security/guard/role.guard';
import { CashierService } from './cashier.service';

@Controller('cashier')
@ApiTags('Api Cashier') 
export class CashierController {
  constructor(
    private readonly cashierService: CashierService,
  ) {}

  @Post('create-withdraw')
  @ApiBearerAuth()
  @Roles(Role.USER, Role.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Người dùng gửi yêu cầu rút tiền vào hệ thống (USER)(WEB) (ĐÃ DÙNG)' })
  @ApiBody({ type: CreateWithdrawRequestDto })
  async createWithdrawRequest(@Body() body: CreateWithdrawRequestDto, @Req() req: any): Promise<WithdrawResponseDto> {
    const userId = req.user.userId;
    const request = {
      ...body,
      userId: userId
    }
    return this.cashierService.handleCreateWithdrawRequest(request);
  }

  @Get('user-withdraw')
  @ApiBearerAuth()
  @Roles(Role.USER, Role.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Người dùng xem lịch sử rút tiền của bản thân (USER)(WEB) (CHƯA DÙNG)' })
  async getWithdrawsByUser(@Req() req: any): Promise<ListWithdrawResponseDto> {
    const userId = req.user.userId;
    return this.cashierService.handleGetWithdrawsByUser({userId: userId});
  }

  @Get('all-withdraw')
  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.CASHIER)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Admin/Cashier xem tất cả yêu cầu rút tiền trong hệ thống (ADMIN/CASHIER)(WEB) (ĐÃ DÙNG)' })
  async getAllWithdrawRequests(@Query() query: EmptyDto): Promise<ListWithdrawResponseDto> {
    return this.cashierService.handleGetAllWithdrawRequests(query);
  }

  @Patch('approve-withdraw')
  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.CASHIER)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Admin/Cashier duyệt yêu cầu rút tiền của User sau khi chuyển khoản (ADMIN/CASHIER)(WEB) (ĐÃ DÙNG)' })
  @ApiBody({ type: UpdateWithdrawStatusRequestDto })
  async approveWithdraw(@Body() body: UpdateWithdrawStatusRequestDto): Promise<WithdrawResponseDto> {
    return this.cashierService.handleApproveWithdraw(body);
  }

  @Patch('reject-withdraw')
  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.CASHIER)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Admin/Cashier từ chối (lỗi giao dịch, thông tin sai, ...) (ADMIN/CASHIER)(WEB) (ĐÃ DÙNG)' })
  @ApiBody({ type: UpdateWithdrawStatusRequestDto })
  async rejectWithdraw(@Body() body: UpdateWithdrawStatusRequestDto): Promise<WithdrawResponseDto> {
    return this.cashierService.handleRejectWithdraw(body);
  }
}