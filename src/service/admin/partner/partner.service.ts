import { Injectable, Inject, Logger } from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import {
  CreateAccountSellRequest,
  UpdateAccountSellRequest,
  DeleteAccountSellRequest,
  GetAccountsByPartnerRequest,
  GetAccountByIdRequest,
  UpdateAccountStatusRequest,
  ListAccountSellResponse,
  PartnerServiceClient,
  BuyAccountRequest,
  GetAllAccountByBuyerRequest,
  ListAccountSellRequest,
  CreateAccountSellResponse,
  ConfirmAccountSellRequest
} from '../../../../proto/admin.pb';
import { grpcCall } from 'src/helpers/grpc.helper';
import { ADMIN_PACKAGE_NAME, PARTNER_SERVICE_NAME } from '../../../../proto/admin.pb';

@Injectable()
export class PartnerService {
  private readonly logger = new Logger(PartnerService.name);
  private partnerGrpcService: PartnerServiceClient;

  constructor(
    @Inject(ADMIN_PACKAGE_NAME) private readonly client: ClientGrpc,
  ) {}

  onModuleInit() {
    this.partnerGrpcService = this.client.getService<PartnerServiceClient>(PARTNER_SERVICE_NAME);
  }

  /* Partner đăng acc bán */
  async handleCreateAccountSell(req: CreateAccountSellRequest): Promise<CreateAccountSellResponse> {
    return grpcCall(PartnerService.name, this.partnerGrpcService.createAccountSell(req));
  }

  /* Partner cập nhật thông tin acc */
  async handleUpdateAccountSell(req: UpdateAccountSellRequest) {
    return grpcCall(PartnerService.name, this.partnerGrpcService.updateAccountSell(req));
  }

  /* Partner xoá acc đã đăng */
  async handleDeleteAccountSell(req: DeleteAccountSellRequest) {
    return grpcCall(PartnerService.name, this.partnerGrpcService.deleteAccountSell(req));
  }

  /* Lấy danh sách tất cả acc đang bán (user xem) */
  async handleGetAllActiveAccounts(req: ListAccountSellRequest): Promise<ListAccountSellResponse> {
    return grpcCall(PartnerService.name, this.partnerGrpcService.getAllActiveAccounts(req));
  }

  /* Lấy danh sách acc theo partner (người bán/mua xem) */
  async handleGetAccountsByPartner(req: GetAccountsByPartnerRequest) {
    return grpcCall(PartnerService.name, this.partnerGrpcService.getAccountsByPartner(req));
  }

  /* Lấy chi tiết 1 acc */
  async handleGetAccountById(req: GetAccountByIdRequest) {
    return grpcCall(PartnerService.name, this.partnerGrpcService.getAccountById(req));
  }

  /* Đánh dấu acc đã bán hoặc kích hoạt lại */
  async handleMarkAccountAsSold(req: UpdateAccountStatusRequest) {
    return grpcCall(PartnerService.name, this.partnerGrpcService.markAccountAsSold(req));
  }

  /* User mua acc, trừ tiền */
  async handleBuyAccount(req: BuyAccountRequest) {
    return grpcCall(PartnerService.name, this.partnerGrpcService.buyAccount(req));
  }

  /* User xem thông tin acc mình đã mua */
  async handleGetAllAccountBuyer(req: GetAllAccountByBuyerRequest) {
    return grpcCall(PartnerService.name, this.partnerGrpcService.getAllAccountByBuyer(req));
  }

  async handleConfirmSell(req: ConfirmAccountSellRequest) {
    return grpcCall(PartnerService.name, this.partnerGrpcService.confirmAccountSell(req));
  }
}
