import { Injectable, Inject, Logger } from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import {
  CreateWithdrawRequestt,
  GetWithdrawsByUserRequest,
  UpdateWithdrawStatusRequest,
  CashierServiceClient,
  Empty
} from '../../../../proto/admin.pb';
import { grpcCall } from 'src/helpers/grpc.helper';
import { ADMIN_PACKAGE_NAME } from '../../../../proto/admin.pb';
import { CASHIER_SERVICE_NAME } from '../../../../proto/admin.pb';

@Injectable()
export class CashierService {
  private readonly logger = new Logger(CashierService.name);
  private cashierGrpcService: CashierServiceClient;

  constructor(
    @Inject(ADMIN_PACKAGE_NAME) private readonly client: ClientGrpc,
  ) {}

  onModuleInit() {
    this.cashierGrpcService = this.client.getService<CashierServiceClient>(CASHIER_SERVICE_NAME);
  }

  async handleCreateWithdrawRequest(req: CreateWithdrawRequestt) {
    return grpcCall(CashierService.name,this.cashierGrpcService.createWithdrawRequest(req));
  }

  async handleGetWithdrawsByUser(req: GetWithdrawsByUserRequest) {
    return grpcCall(CashierService.name,this.cashierGrpcService.getWithdrawsByUser(req));
  }

  async handleGetAllWithdrawRequests(req: Empty) {
    return grpcCall(CashierService.name,this.cashierGrpcService.getAllWithdrawRequests(req));
  }

  async handleApproveWithdraw(req: UpdateWithdrawStatusRequest) {
    return grpcCall(CashierService.name,this.cashierGrpcService.approveWithdraw(req));
  }

  async handleRejectWithdraw(req: UpdateWithdrawStatusRequest) {
    return grpcCall(CashierService.name,this.cashierGrpcService.rejectWithdraw(req));
  }
}
