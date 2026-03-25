import { PaymentService } from "../services/payment.service";
import { toGrpcError, CreatePaymentRequest, CreatePaymentResponse } from "../../../utils/src/index";
import { ServerUnaryCall, SendUnaryData } from "../../../utils/src/index";

export class PaymentGrpcController {
  private readonly paymentService: PaymentService;
  constructor({ paymentService }: { paymentService: PaymentService }) {
    this.paymentService = paymentService;
  }

  createPayment(
    call: ServerUnaryCall<CreatePaymentRequest, CreatePaymentResponse>,
    callback: SendUnaryData<CreatePaymentResponse>,
  ): void {
    const { amount, bookingId, currency, provider, userId } = call.request;
    this.paymentService
      .create({
        amount,
        bookingId,
        currency,
        provider,
        userId,
      })
      .then(() =>
        callback(null, {
          success: true,
          message: "Payment created successfully",
        }),
      )
      .catch((err) => callback(toGrpcError(err), null));
  }
}
