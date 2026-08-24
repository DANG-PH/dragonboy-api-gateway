import { Injectable, Inject, Logger } from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import {
  CreateFinanceRequest,
  GetFinanceByUserRequest,
  FinanceResponse,
  ListFinanceResponse,
  FinanceSummaryResponse,
  Empty,
  FinanceServiceClient,
} from '../../../../proto/pay.pb';
import { grpcCall } from 'src/helpers/grpc.helper';
import { PAY_PACKAGE_NAME, FINANCE_SERVICE_NAME } from '../../../../proto/pay.pb';

@Injectable()
export class FinanceService {
  private readonly logger = new Logger(FinanceService.name);
  private financeGrpcService: FinanceServiceClient;

  constructor(
    @Inject(PAY_PACKAGE_NAME) private readonly client: ClientGrpc,
  ) {}

  onModuleInit() {
    this.financeGrpcService = this.client.getService<FinanceServiceClient>(FINANCE_SERVICE_NAME);
  }

  /* Ghi lại dòng tiền khi nạp hoặc rút thành công */
  async handleCreateFinanceRecord(req: CreateFinanceRequest) {
    return grpcCall(FinanceService.name, this.financeGrpcService.createFinanceRecord(req));
  }

  /* Lấy danh sách giao dịch của 1 user */
  async handleGetFinanceByUser(req: GetFinanceByUserRequest) {
    return grpcCall(FinanceService.name, this.financeGrpcService.getFinanceByUser(req));
  }

  /* Lấy tất cả giao dịch (dành cho admin) */
  async handleGetAllFinance(req: Empty) {
    return grpcCall(FinanceService.name, this.financeGrpcService.getAllFinance(req));
  }

  /* Thống kê tổng nạp, tổng rút và số dư */
  async handleGetFinanceSummary(req: Empty) {
    return grpcCall(FinanceService.name, this.financeGrpcService.getFinanceSummary(req));
  }
}
