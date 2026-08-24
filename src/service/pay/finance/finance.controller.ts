import {Controller,Post,Body,UseGuards,Get,Query,} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/security/JWT/jwt-auth.guard';
import { RolesGuard } from 'src/security/guard/role.guard';
import { Roles } from 'src/security/decorators/role.decorator';
import { Role } from 'src/enums/role.enum';
import { FinanceService } from './finance.service';
import {
  GetFinanceByUserRequestDto,
  FinanceResponseDto,
  ListFinanceResponseDto,
  FinanceSummaryResponseDto,
  EmptyDto,
} from 'dto/finance.dto';

@Controller('finance')
@ApiTags('Api Finance')
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  // ====== CREATE RECORD ======
  // @Post('create-record')
  // @ApiBearerAuth()
  // @Roles(Role.ADMIN, Role.FINANCE)
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @ApiOperation({ summary: 'Ghi lại dòng tiền khi nạp hoặc rút thành công (ADMIN/FINANCE)(WEB) (ĐÃ DÙNG)' })
  // @ApiBody({ type: CreateFinanceRequestDto })
  // async createFinanceRecord(
  //   @Body() body: CreateFinanceRequestDto,
  // ): Promise<FinanceResponseDto> {
  //   return this.financeService.handleCreateFinanceRecord(body);
  // }

  // ====== GET FINANCE BY USER ======
  @Get('by-user')
  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.FINANCE)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Lấy danh sách giao dịch của một người dùng (ADMIN/FINANCE)(WEB) (CHƯA DÙNG)' })
  async getFinanceByUser(
    @Query() query: GetFinanceByUserRequestDto,
  ): Promise<ListFinanceResponseDto> {
    return this.financeService.handleGetFinanceByUser({
      userId: query.userId
    });
  }

  // ====== GET ALL FINANCE (ADMIN) ======
  @Get('all-record')
  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.FINANCE)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Admin lấy danh sách toàn bộ giao dịch (ADMIN/FINANCE)(WEB) (CHƯA DÙNG)' })
  async getAllFinance(
    @Query() query: EmptyDto,
  ): Promise<ListFinanceResponseDto> {
    return this.financeService.handleGetAllFinance(query);
  }

  // ====== GET FINANCE system cash flow ======
  @Get('system-cash-flow')
  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.FINANCE)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Thống kê tổng nạp, tổng rút và số dư toàn hệ thống (ADMIN/FINANCE)(WEB) (CHƯA DÙNG)' })
  async getFinanceSummary(
    @Query() query: EmptyDto,
  ): Promise<FinanceSummaryResponseDto> {
    return this.financeService.handleGetFinanceSummary(query);
  }
}
