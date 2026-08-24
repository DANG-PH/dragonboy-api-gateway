import { Injectable, Inject, Logger } from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import {
    GetPayByUserIdRequest,
    UpdateMoneyRequest,
    UpdateStatusRequest,
    CreatePayOrderRequest,
    CreatePayRequest,
    PayResponse,
    QrResponse,
    PAY_PACKAGE_NAME,
    PAY_SERVICE_NAME,
    PayServiceClient,
    Pay
} from 'proto/pay.pb';
import { grpcCall } from 'src/helpers/grpc.helper';
// import { winstonLogger } from 'src/logger/logger.config';

@Injectable()
export class PayService {
  private readonly logger = new Logger(PayService.name);
  private payGrpcService: PayServiceClient;

  constructor(
    @Inject(PAY_PACKAGE_NAME) private readonly client: ClientGrpc,
  ) {}

  onModuleInit() {
    this.payGrpcService = this.client.getService<PayServiceClient>(PAY_SERVICE_NAME);
  }

  async getPay(req: GetPayByUserIdRequest): Promise<PayResponse> {
    return grpcCall(PayService.name,this.payGrpcService.getPayByUserId(req));
  }

  async updateMoney(req: UpdateMoneyRequest): Promise<PayResponse> {
    return grpcCall(PayService.name,this.payGrpcService.updateMoney(req));
  }

  async createPay(req: CreatePayRequest): Promise<PayResponse> {
    return grpcCall(PayService.name,this.payGrpcService.createPay(req));
  }
  
  async updateStatus(req: UpdateStatusRequest): Promise<PayResponse> {
    return grpcCall(PayService.name,this.payGrpcService.updateStatus(req));
  }

  async getQr(req: CreatePayOrderRequest): Promise<QrResponse> {
    const result = await grpcCall(PayService.name,this.payGrpcService.createPayOrder(req));
    // if (result.qr) {
    //     winstonLogger.log({message: "Tạo QR thành công", service: PayService.name, admin: process.env.ADMIN_TEST, nhiemVu: 'thongBaoNapTien', username: result.username })
    // }
    return result;
  }
}
