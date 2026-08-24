import { Controller, UseGuards, Req, Get, Inject, Patch, Post, Body, Param, Query, Delete, Put } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody,ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/security/JWT/jwt-auth.guard';
import { Roles } from 'src/security/decorators/role.decorator';
import { Role } from 'src/enums/role.enum';
import { RolesGuard } from 'src/security/guard/role.guard';
import { Cache } from '@nestjs/cache-manager';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {ItemDto, ItemIdRequestDto, AddUserItemRequestDto} from "dto/item.dto"
import {UseItemAdminRequestDto,AddItemAdminRequestDto,UpdateBalanceRequestDto} from "dto/user.dto"
import { 
  ChangeRoleRequestDto,
  ChangeRoleResponseDto,
  BanUserRequestDto,
  BanUserResponseDto,
  UnbanUserRequestDto,
  UnbanUserResponseDto
} from 'dto/auth.dto';
import { AuthService } from 'src/service/auth/auth.service';
import { UserService } from 'src/service/user/user.service';
import { DeTuService } from 'src/service/detu/detu.service';
import { ItemService } from 'src/service/item/item.service';
import { CreateDeTuRequestDto } from 'dto/detu.dto'
import { 
    PayResponseDto,
    UpdateMoneyRequestDto,
    UpdateStatusRequestDto,
 } from 'dto/pay.dto';
import { PayService } from 'src/service/pay/pay/pay.service';
import {
  GetAccountsByPartnerRequestDto,
  ListAccountSellResponseDto,
  GetAllAccountByBuyerResponse,
  PaginationByPartnerRequestDto
} from 'dto/partner.dto';
import { PartnerService } from '../partner/partner.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { randomUUID } from 'crypto';
import { ClientProxy } from '@nestjs/microservices';

@Controller('admin')
@ApiTags('Api Admin') 
export class AdminController {
  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private authService: AuthService,
    private userService: UserService,
    private deTuService: DeTuService,
    private itemService: ItemService,
    private payService: PayService,
    private partnerService: PartnerService,
    private eventEmitter: EventEmitter2,
    @Inject(String(process.env.RABBIT_GAME_SERVICE)) private readonly gameClient: ClientProxy,
  ) {}

  // Gọi sang auth-service
  @Patch('change-role')
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Thay đổi role của user (ADMIN)(WEB) (Quản lí auth) (CHƯA DÙNG) ' })
  @ApiBody({ type: ChangeRoleRequestDto })
  async changeRole(@Body() body: ChangeRoleRequestDto): Promise<ChangeRoleResponseDto> {
    return this.authService.handleChangeRole(body);
  }

  @Patch('ban-user')
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Ban user (ADMIN)(WEB) (Quản lí auth) (CHƯA DÙNG)' })
  @ApiBody({ type: BanUserRequestDto })
  async banUser(@Body() body: BanUserRequestDto): Promise<BanUserResponseDto> {
    const result = await this.authService.handleBanUser(body);
    if (result.success) {
      this.gameClient.emit('auth.revoke_all_token', { userId: result.userId });
    } 
    return result;
  }

  @Patch('unban-user')
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Unban user (ADMIN)(WEB) (Quản lí auth) (CHƯA DÙNG)' })
  @ApiBody({ type: UnbanUserRequestDto })
  async unbanUser(@Body() body: UnbanUserRequestDto): Promise<UnbanUserResponseDto> {
    return this.authService.handleUnbanUser(body);
  }

  // Gọi sang user-service
  @Patch('update-balance')
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Chọn loại tài nguyên ( vang/ngoc ) để thêm or giảm bớt (GÁN) cho user (ADMIN)(WEB) (Quản lí user) (CHƯA DÙNG)' })
  @ApiBody({ type:  UpdateBalanceRequestDto })  
  async updateBalance(@Body() body: UpdateBalanceRequestDto) {
    return this.userService.handleUpdateBalance(body);
  }

  @Post('add-item-web')
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Add item web ( id đồ ) cho 1 user bất kì (ADMIN)(WEB) (Quản lí user) (CHƯA DÙNG)' })
  @ApiBody({ type:  AddItemAdminRequestDto })  
  async addItemWebAdmin(@Body() body: AddItemAdminRequestDto) {
    return this.userService.handleAddItemWeb(body);
  }

  @Delete('use-item-web')
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'sử dụng item web ( id đồ ) cho 1 user bất kì (ADMIN)(WEB) (Quản lí user) (CHƯA DÙNG)' })
  @ApiBody({ type:  UseItemAdminRequestDto })  
  async useItemWebAdmin(@Body() body: UseItemAdminRequestDto) {
    return this.userService.handleUseItemWeb(body);
  }

  // Gọi sang item-service
  // @Post('add-item')
  // @ApiBearerAuth()
  // @Roles(Role.ADMIN)
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @ApiOperation({ summary: 'Thêm 1 item cho user bất kì (ADMIN)(WEB) (Quản lí item) (CHƯA DÙNG)' })
  // @ApiBody({ type:  AddUserItemRequestDto })
  // async addItem(@Body() body: AddUserItemRequestDto) {
  //   return this.itemService.handleAddItem(body);
  // }

  // @Put('update-item')
  // @ApiBearerAuth()
  // @Roles(Role.ADMIN)
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @ApiOperation({ summary: 'Update thông tin của item bất kì ( có thể ghi đè toàn bộ ) (ADMIN)(WEB) (Quản lí item) (CHƯA DÙNG)' })
  // @ApiBody({ type:  ItemDto })
  // async updateItem(@Body() body: ItemDto) {
  //   return this.itemService.handleUpdateItem(body);
  // }

  // @Delete('delete-item')
  // @ApiBearerAuth()
  // @Roles(Role.ADMIN)
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @ApiOperation({ summary: 'Xóa item bất kì theo id của item đó (ADMIN)(WEB) (Quản lí item) (CHƯA DÙNG)' })
  // @ApiBody({ type:  ItemIdRequestDto })
  // async deleteItem(@Body() body: ItemIdRequestDto) {
  //   return this.itemService.handleDeleteItem(body);
  // }

  // Gọi sang đệ tử service
  @Post('create-de-tu')
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Tạo đệ tử cho 1 user bất kì (ADMIN)(WEB) (Quản lí đệ tử) (CHƯA DÙNG)' })
  @ApiBody({ type: CreateDeTuRequestDto })
  async createDeTuAdmin(@Body() body: CreateDeTuRequestDto) {
    return this.deTuService.handleCreateDeTu(body);
  }

  // Gọi sang pay-service
  @Patch('money')
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Update thông tin ví của user bất kì ( tiền trong ví ) (ADMIN)(WEB) (Quản lí ví) (CHƯA DÙNG)' })
  @ApiBody({ type:  UpdateMoneyRequestDto })
  async updateMoney(@Body() body: UpdateMoneyRequestDto): Promise<PayResponseDto> {
    return this.payService.updateMoney({
      ...body,
      idempotencyKey: "API_GATEWAY: "+randomUUID()
    });
  }

  @Patch('status')
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Update thông tin ví của user bất kì ( khóa / mở khóa ) ví (ADMIN)(WEB) (Quản lí ví) (CHƯA DÙNG)' })
  @ApiBody({ type:  UpdateStatusRequestDto })
  async updateStatus(@Body() body: UpdateStatusRequestDto): Promise<PayResponseDto> {
    return this.payService.updateStatus(body);
  }

  // Gọi sang admin service
  // @Get('account-sell-by-partner')
  // @ApiBearerAuth()
  // @Roles(Role.ADMIN)
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @ApiOperation({ summary: 'Xem tất cả acc đang/đã bán của 1 partner/admin nhất định (ADMIN)(WEB) (Quản lí acc đăng bán của partner) (CHƯA DÙNG)' })
  // async getAccountsByPartner(@Query() query: PaginationByPartnerRequestDto): Promise<ListAccountSellResponseDto> {
  //   return this.partnerService.handleGetAccountsByPartner(
  //     {
  //       partner_id: query.partner_id,
  //       paginationRequest: {
  //         page: query.page || "1",
  //         itemPerPage: query.itemPerPage || "10",
  //         search: query.search || ""
  //       }
  //     }
  //   );
  // }

  @Get('all-account-buyer')
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Admin Xem tất cả acc user bất kì đã mua trong kho acc của hệ thống (ADMIN)(WEB) (CHƯA DÙNG)' })
  async getAllAccountBuyer(@Query() query: GetAccountsByPartnerRequestDto): Promise<GetAllAccountByBuyerResponse> {
    // tạm thời sử dụng getAccount DTO vì chỗ này tôi lười viết thêm 1 dto nữa thôi.
    return this.partnerService.handleGetAllAccountBuyer({buyer_id: query.partner_id});
  }
}