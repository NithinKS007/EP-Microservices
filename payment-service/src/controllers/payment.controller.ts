import { Response } from "express";
import { PaymentService } from "../services/payment.service";
import { AuthReq, StatusCodes, validateDto } from "../../../utils/src";
import { sendResponse } from "../../../utils/src";
import {
  GetPaymentByBookingIdRequestDto,
  GetPaymentByIdRequestDto,
  InitiatePaymentRequestDto,
} from "../dtos/payment.dtos";
import { SagaServiceGrpcClient } from "../grpc/saga.client";

export class PaymentController {
  private readonly paymentService: PaymentService;
  private readonly sagaServiceGrpcClient: SagaServiceGrpcClient;
  constructor({
    paymentService,
    sagaServiceGrpcClient,
  }: {
    paymentService: PaymentService;
    sagaServiceGrpcClient: SagaServiceGrpcClient;
  }) {
    this.paymentService = paymentService;
    this.sagaServiceGrpcClient = sagaServiceGrpcClient;
  }

  async findPaymentById(req: AuthReq, res: Response): Promise<void> {
    const data = await validateDto(GetPaymentByIdRequestDto, req.params);
    const payment = await this.paymentService.findPayment(data.id);
    sendResponse(res, StatusCodes.OK, payment, "Payment fetched successfully");
  }

  async findPaymentByBookingId(req: AuthReq, res: Response): Promise<void> {
    const data = await validateDto(GetPaymentByBookingIdRequestDto, req.params);
    const payment = await this.paymentService.findPaymentByBookingId(data.id);
    sendResponse(res, StatusCodes.OK, payment, "Payment fetched successfully");
  }

  /**
   * Initiates a payment for a booking after validating the booking lifecycle.
   * Used in: Booking payment-init flow
   * Triggered via: REST
   */
  async initiate(req: AuthReq, res: Response): Promise<void> {
    const data = await validateDto(InitiatePaymentRequestDto, req.params);
    const payment = await this.sagaServiceGrpcClient.startInitiatePaymentSaga({
      bookingId: data.id,
      actorId: req.user?.id || "",
      actorRole: req.user?.role || "",
    });
    sendResponse(res, StatusCodes.OK, payment, "Payment initiated successfully");
  }

}
