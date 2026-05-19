import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards,Query,Req, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/security/JWT/jwt-auth.guard';
import { RolesGuard } from 'src/security/guard/role.guard';
import { Roles } from 'src/security/decorators/role.decorator';
import { Role } from 'src/enums/role.enum';
import { PartnerService } from './partner.service';
import {
  CreateAccountSellRequestDto,
  UpdateAccountSellRequestDto,
  DeleteAccountSellRequestDto,
  GetAccountByIdRequestDto,
  UpdateAccountStatusRequestDto,
  AccountResponseDto,
  ListAccountSellResponseDto,
  BuyAccountRequestDto,
  AccountInformationResponseDto,
  GetAllAccountByBuyerRequest,
  GetAllAccountByBuyerResponse,
  ListAccountSellRequestDto,
  PaginationRequestDto,
  PaginationByPartnerRequestDto,
  CreateAccountSellResponseDto,
  ConfirmAccountSellRequestDto,
  ConfirmAccountSellResponseDto,
  BuyAccountResponseDto
} from 'dto/partner.dto';
import type { Response as ResExpress } from 'express';
import { ERROR_PAGE, SUCCESS_PAGE } from 'src/template/confirmSell.template';

@Controller('partner')
@ApiTags('Api Partner')
export class PartnerController {
  constructor(private readonly partnerService: PartnerService) {}
 
  @Post('create-account-sell')
  @ApiBearerAuth()
  @Roles(Role.PARTNER, Role.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Partner/Admin đăng acc cần bán vào kho acc của hệ thống (ADMIN/PARTNER)(WEB) (ĐÃ DÙNG)' })
  @ApiBody({ type: CreateAccountSellRequestDto })
  async createAccountSell(@Body() body: CreateAccountSellRequestDto, @Req() req: any): Promise<CreateAccountSellResponseDto> {
    const userId = req.user.userId;
    const username = req.user.username;
    const request = {
      ...body,
      partner_id: userId,
      partner_username: username
    }
    return this.partnerService.handleCreateAccountSell(request);
  }

  @Get('confirm-sell')
  @ApiOperation({ summary: '(CLIENT WEB KHÔNG DÙNG) Confirm đăng bán account qua email link' })
  async confirmSell(
    @Query('token') token: string,
    @Res() res: ResExpress
  ) {
    try {
      await this.partnerService.handleConfirmSell({ token });

      return res.send(this.renderHtml(true, 'Tài khoản của bạn đã được đăng bán.'));
    } catch (err: any) {
      return res.send(this.renderHtml(false, err.message || 'Link không hợp lệ hoặc đã hết hạn'));
    }
  }

  @Patch('update-account-sell')
  @ApiBearerAuth()
  @Roles(Role.PARTNER, Role.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Partner/Admin cập nhật thông tin acc cần bán trong kho acc của hệ thống (ADMIN/PARTNER)(WEB) (ĐÃ DÙNG)' })
  @ApiBody({ type: UpdateAccountSellRequestDto })
  async updateAccountSell(@Body() body: UpdateAccountSellRequestDto): Promise<AccountResponseDto> {
    return this.partnerService.handleUpdateAccountSell(body);
  }

  @Delete('delete-account-sell')
  @ApiBearerAuth()
  @Roles(Role.PARTNER, Role.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Partner/Admin xóa acc cần bán trong kho acc của hệ thống (ADMIN/PARTNER)(WEB) (ĐÃ DÙNG)' })
  @ApiBody({ type: DeleteAccountSellRequestDto })
  async deleteAccountSell(@Body() body: DeleteAccountSellRequestDto): Promise<AccountResponseDto> {
    return this.partnerService.handleDeleteAccountSell(body);
  }

  @Get('all-account-sell')
  // @ApiBearerAuth()
  // @Roles(Role.PARTNER, Role.ADMIN, Role.USER)
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'User Xem tất cả acc cần bán ( status: ACTIVE ) trong kho acc của hệ thống (ALL)(WEB) (ĐÃ DÙNG)' })
  async getAllAccountSell(@Query() query: PaginationRequestDto): Promise<ListAccountSellResponseDto> {
    return this.partnerService.handleGetAllActiveAccounts({
        paginationRequest: {
          page: query.page || "1",
          itemPerPage: query.itemPerPage || "10",
          search: query.search || ""
        }
    });
  }

  @Get('account-sell-by-partner')
  @ApiBearerAuth()
  @Roles(Role.PARTNER, Role.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Partner xem acc đã bán chính mình, admin xem all hoặc 1 partner cụ thể (ADMIN/PARTNER)(WEB) (ĐÃ DÙNG)' })
  async getAccountsByPartner(@Query() query: PaginationByPartnerRequestDto, @Req() req: any): Promise<ListAccountSellResponseDto> {
    const { userId, role } = req.user;

    // PATTERN: Context-aware endpoint — cùng 1 endpoint, behavior khác nhau tùy role
    //
    // TÁCH 2 ENDPOINT hay GỘP 1:
    // - Gộp 1 khi: chỉ khác nhau ở filter/input (WHERE clause) → như endpoint này
    // - Tách 2 khi:
    //   + Response shape khác nhau (role A trả về nhiều field hơn role B)
    //   + Business logic xử lý khác nhau hoàn toàn (không chỉ là filter)
    //   + Nhiều hơn 2-3 role với behavior khác nhau → gộp sẽ rối
    //   + Security nhạy cảm — muốn tường minh, không muốn nhầm lẫn giữa các role
    //
    // KHI NÀO DÙNG CASL + ABAC:
    // - KHÔNG cần khi rule đơn giản kiểu "role A xem của mình, role B xem tất cả"
    // - CẦN khi quyền phụ thuộc vào attribute của resource/user, ví dụ:
    //   + Manager chỉ xem acc của team mình
    //   + Admin chỉ xem acc của region mình quản lý
    //   + User bị suspend thì chỉ đọc, không sửa được
    //
    // KHI NÀO DÙNG CASL + ABAC vs TÁCH 2 ENDPOINT:
    // - Dùng CASL + ABAC khi:
    //   + Nhiều role, nhiều resource, rule phức tạp → tập trung logic ở 1 chỗ
    //   + Quyền thay đổi thường xuyên → chỉ sửa ở ability factory, không đụng controller
    //   + Cần reuse rule ở nhiều endpoint khác nhau
    // - Dùng tách 2 endpoint khi:
    //   + Rule đơn giản nhưng logic/response khác nhau hoàn toàn
    //   + Team nhỏ, không muốn overhead của CASL
    //   + Muốn tường minh từng endpoint cho dễ đọc, dễ maintain

    // Admin có thể truyền partner_id qua query để xem của người khác
    // Nếu không truyền thì xem tất cả (partner_id = undefined)
    // Partner chỉ được xem của chính mình
    const partnerId = role === Role.ADMIN 
      ? query.partner_id  // Admin: lấy từ query hoặc xem all
      : userId;           // Partner: luôn là id của chính họ

    return this.partnerService.handleGetAccountsByPartner(
      {
        partner_id: partnerId,
        paginationRequest: {
          page: query.page || "1",
          itemPerPage: query.itemPerPage || "10",
          search: query.search || ""
        }
      }
    );
  }

  @Get('account-sell/:id')
  @ApiBearerAuth()
  @Roles(Role.PARTNER, Role.ADMIN, Role.USER)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Xem chi tiết một account nhất định theo id account (ALL)(WEB) (ĐÃ DÙNG)' })
  async getAccountByIdr(@Param() param: GetAccountByIdRequestDto): Promise<AccountResponseDto> {
    return this.partnerService.handleGetAccountById(param);
  }

  // @Patch('mark-account-sell')
  // @ApiBearerAuth()
  // @Roles(Role.PARTNER, Role.ADMIN)
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @ApiOperation({ summary: 'Đánh dấu acc bất kì đã bán (ADMIN/PARTNER)(WEB) (ĐÃ DÙNG)' })
  // @ApiBody({ type: UpdateAccountStatusRequestDto })
  // async markAccountAsSold(@Body() body: UpdateAccountStatusRequestDto): Promise<AccountResponseDto> {
  //   return this.partnerService.handleMarkAccountAsSold(body);
  // }

  @Post('buy-account-sell')
  @ApiBearerAuth()
  @Roles(Role.PARTNER, Role.ADMIN, Role.USER)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'User mua account trong kho tài khoản của hệ thống (USER)(WEB) (ĐÃ DÙNG)' })
  @ApiBody({ type: BuyAccountRequestDto })
  async buyAccount(@Body() body: BuyAccountRequestDto, @Req() req: any): Promise<BuyAccountResponseDto> {
    const userId = req.user.userId;
    const username = req.user.username;
    const request = {
      userId: userId,
      username: username,
      ...body
    }
    return this.partnerService.handleBuyAccount(request);
  }
  
  @Get('all-account-buyer')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'User Xem tất cả acc mình đã mua trong kho acc của hệ thống (USER)(WEB) (ĐÃ DÙNG)' })
  async getAllAccountBuyer(@Query() query: GetAllAccountByBuyerRequest, @Req() req: any): Promise<GetAllAccountByBuyerResponse> {
    const userId = req.user.userId;
    const request = {
      ...query,
      buyer_id: userId
    }
    return this.partnerService.handleGetAllAccountBuyer(request);
  }

  public renderHtml(success: boolean, message: string) {
    return success ? SUCCESS_PAGE(message) : ERROR_PAGE(message);
  }
}
