import { Injectable, Inject, Logger } from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import {
    Empty,
    Item,
    ItemIdRequest,
    ItemResponse,
    ItemServiceClient,
    ITEM_PACKAGE_NAME,
    ItemServiceController,
    ItemServiceControllerMethods,
    ItemsResponse,
    ITEM_SERVICE_NAME,
    AddItemRequest,
    AddMultipleItemsRequest,
    MessageResponse,
    UserIdRequest,
    GetItemsByItemUuidsRequest,
    GetItemsByItemUuidsResponse,
    SwapItemRequest,
    SwapItemResponse
} from 'proto/item.pb';
import { grpcCall } from 'src/helpers/grpc.helper';

@Injectable()
export class ItemService {
  private readonly logger = new Logger(ItemService.name);
  private itemGrpcService: ItemServiceClient;

  constructor(
    @Inject(ITEM_PACKAGE_NAME) private readonly client: ClientGrpc,
  ) {}

  onModuleInit() {
    this.itemGrpcService = this.client.getService<ItemServiceClient>(ITEM_SERVICE_NAME);
  }

  async handleGetItemByUser(req: UserIdRequest): Promise<ItemsResponse> {
    return grpcCall(ItemService.name,this.itemGrpcService.getItemsByUser(req));
  }

  async handleAddItem(req: AddItemRequest): Promise<ItemResponse> {
    return grpcCall(ItemService.name,this.itemGrpcService.addItem(req));
  }
  
  async handleUpdateItem(req: Item): Promise<ItemResponse> {
    return grpcCall(ItemService.name,this.itemGrpcService.updateItem(req));
  }

  async handleDeleteItem(req: ItemIdRequest): Promise<MessageResponse> {
    return grpcCall(ItemService.name,this.itemGrpcService.deleteItem(req));
  }

  async handleAddMultiItem(req: AddMultipleItemsRequest): Promise<ItemsResponse> {
    return grpcCall(ItemService.name,this.itemGrpcService.addMultipleItems(req));
  }

  async handleGetItemsByUuids(req: GetItemsByItemUuidsRequest): Promise<GetItemsByItemUuidsResponse> {
    return grpcCall(ItemService.name,this.itemGrpcService.getItemsByItemUuids(req));
  }

  async handleSwapItem(req: SwapItemRequest): Promise<SwapItemResponse> {
    return grpcCall(ItemService.name,this.itemGrpcService.swapItem(req));
  }
}
