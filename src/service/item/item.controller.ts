import { JwtAuthGuard } from 'src/security/JWT/jwt-auth.guard';
import { ItemService } from './item.service';
import { Controller, Post, Body, UseGuards, Param, Get, Patch, Put, Delete, Query, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody,ApiBearerAuth, ApiQuery, ApiParam } from '@nestjs/swagger';
import {ItemDto, UserIdRequestDto, ItemIdRequestDto, ItemResponseDto, ItemsResponseDto, AddUserItemRequestDto, AddMultipleItemsRequestDto, MessageResponseDto, EmptyDto, GetItemsByItemUuidsRequestDto} from "dto/item.dto"
import { Roles } from 'src/security/decorators/role.decorator';
import { Role } from 'src/enums/role.enum';
import { RolesGuard } from 'src/security/guard/role.guard';

@Controller('item')
@ApiTags('Api Item') 
export class ItemController {
  constructor(private readonly itemService: ItemService) {}

  // @Get('user-items-admin')
  // @ApiBearerAuth()
  // @Roles(Role.ADMIN)
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @ApiOperation({ summary: 'Lấy tất cả thông tin item của 1 user bất kì (ADMIN)(WEB)' })
  // async getUserItemAdmin(@Query() query: UserIdRequestDto) {
  //   return this.itemService.handleGetItemByUser(query);
  // }

  @Get('user-items')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Lấy tất cả thông tin item của bản thân (USER)(GAME) (ĐÃ DÙNG)' })
  async getUserItem(@Req() req: any) {
    const userId = req.user.userId;
    return this.itemService.handleGetItemByUser({userId:userId});
  }

  // @Post('add-item-admin')
  // @ApiBearerAuth()
  // @Roles(Role.ADMIN)
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @ApiOperation({ summary: 'Thêm 1 item cho user bất kì (ADMIN)(WEB)' })
  // @ApiBody({ type:  AddUserItemRequestDto })
  // async addItem(@Body() body: AddUserItemRequestDto) {
  //   return this.itemService.handleAddItem(body);
  // }

  // @Put('update-item-admin')
  // @ApiBearerAuth()
  // @Roles(Role.ADMIN)
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @ApiOperation({ summary: 'Update thông tin của item bất kì ( có thể ghi đè toàn bộ ) (ADMIN)(WEB)' })
  // @ApiBody({ type:  ItemDto })
  // async updateItem(@Body() body: ItemDto) {
  //   return this.itemService.handleUpdateItem(body);
  // }

  // @Delete('delete-item-admin')
  // @ApiBearerAuth()
  // @Roles(Role.ADMIN)
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @ApiOperation({ summary: 'Xóa item bất kì theo id của item đó (ADMIN)(WEB)' })
  // @ApiBody({ type:  ItemIdRequestDto })
  // async deleteItem(@Body() body: ItemIdRequestDto) {
  //   return this.itemService.handleDeleteItem(body);
  // }

  @Put('items')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'User trong game khi thoat game (USER)(GAME) (ĐÃ DÙNG)' })
  @ApiBody({ type:  AddMultipleItemsRequestDto })
  async addItems(@Body() body: AddMultipleItemsRequestDto, @Req() req: any) {
    const userId = req.user.userId;
    const request = {
      userId: userId,
      items: body.items
    }
    return this.itemService.handleAddMultiItem(request);
  }

  @Post('item')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'User trong game goi khi muon add item (USER)(GAME) (ĐÃ DÙNG)' })
  @ApiBody({ type:  AddUserItemRequestDto })
  async addItem(@Body() body: AddUserItemRequestDto, @Req() req: any) {
    const userId = req.user.userId;
    const request = {
      userId: userId,
      item: body.item
    }
    return this.itemService.handleAddItem(request);
  }

  @Post('itemUuids')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'User gọi hàm này để fetch data item (USER)(GAME) (ĐÃ DÙNG)' })
  @ApiBody({ type:  GetItemsByItemUuidsRequestDto })
  async getItemsByIds(@Body() body: GetItemsByItemUuidsRequestDto) {
    return this.itemService.handleGetItemsByUuids(body);
  }
}