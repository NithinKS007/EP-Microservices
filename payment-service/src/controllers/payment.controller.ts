import { Response } from "express";
import { PaymentService } from "../services/payment.service";
import { AuthReq,StatusCodes, validateDto } from "../../../utils/src";
import { sendResponse } from "../../../utils/src";
import { GetPaymentByBookingIdRequestDto, GetPaymentByIdRequestDto } from "dtos/payment..dtos";

export class PaymentController {
  private readonly paymentService: PaymentService;
  constructor({ paymentService }: { paymentService: PaymentService }) {
    this.paymentService = paymentService;
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
}
