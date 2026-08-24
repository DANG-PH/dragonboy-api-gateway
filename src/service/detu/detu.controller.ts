import { JwtAuthGuard } from 'src/security/JWT/jwt-auth.guard';
import { DeTuService } from './detu.service';
import { Controller, Post, Body, UseGuards, Param, Get, Patch, Put, Delete, Query, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody,ApiBearerAuth, ApiQuery, ApiParam } from '@nestjs/swagger';
import { SaveGameDeTuRequestDto, SaveGameDeTuResponseDto, CreateDeTuRequestDto, CreateDeTuResponseDto, GetDeTuRequestDto, DeTuResponseDto} from 'dto/detu.dto'
import { Roles } from 'src/security/decorators/role.decorator';
import { Role } from 'src/enums/role.enum';
import { RolesGuard } from 'src/security/guard/role.guard';
import { EmptyDto } from 'dto/user.dto';

@Controller('detu')
@ApiTags('Api Đệ Tử') 
export class DeTuController {
  constructor(private readonly deTuService: DeTuService) {}

  @Put('save-game')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'User lưu thông tin đệ tử của bản thân ( ghi đè toàn bộ ) (USER)(GAME) (CHƯA DÙNG)' })
  @ApiBody({ type: SaveGameDeTuRequestDto })
  async getUserItem(@Body() body: SaveGameDeTuRequestDto, @Req() req: any) {
    const userId = req.user.userId;
    const request = {
      ...body,
      userId: userId
    }
    return this.deTuService.handleSaveDeTu(request);
  }

  // @Post('create-de-tu-admin')
  // @ApiBearerAuth()
  // @Roles(Role.ADMIN)
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @ApiOperation({ summary: 'Tạo đệ tử cho 1 user bất kì (ADMIN)(WEB)' })
  // @ApiBody({ type: CreateDeTuRequestDto })
  // async createDeTuAdmin(@Body() body: CreateDeTuRequestDto) {
  //   return this.deTuService.handleCreateDeTu(body);
  // }

  @Post('create-de-tu')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'User tạo đệ tử khi săn đệ thành công (USER)(GAME) (CHƯA DÙNG)' })
  @ApiBody({ type: EmptyDto })
  async createDeTu(@Body() body: EmptyDto, @Req() req: any) {
    const userId = req.user.userId;
    const request = {
      sucManh: 2000,
      userId: userId
    }
    return this.deTuService.handleCreateDeTu(request);
  }

  // @Get('de-tu-admin')
  // @ApiBearerAuth()
  // @Roles(Role.ADMIN)
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @ApiOperation({ summary: 'Lấy đệ tử của user bất kì (ADMIN)(WEB)' })
  // async getDeTuAdmin(@Query() query: GetDeTuRequestDto) {
  //   return this.deTuService.handleGetDeTu(query);
  // }

  @Get('de-tu')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'User lấy đệ tử của bản thân (USER)(GAME) (CHƯA DÙNG)' })
  async getDeTu(@Req() req: any) {
    const userId = req.user.userId;
    return this.deTuService.handleGetDeTu({userId: userId});
  }
}