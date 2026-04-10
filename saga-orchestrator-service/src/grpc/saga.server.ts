import { SagaService } from "../services/saga.service";
import {
  toGrpcError,
  StartCancelEventSagaRequest,
  StartCancelEventSagaResponse,
  StartInitiatePaymentSagaRequest,
  StartInitiatePaymentSagaResponse,
} from "../../../utils/src";
import { ServerUnaryCall, SendUnaryData } from "../../../utils/src";

export class SagaGrpcController {
  private readonly sagaService: SagaService;

  constructor({ sagaService }: { sagaService: SagaService }) {
    this.sagaService = sagaService;
  }

  startCancelEventSaga(
    call: ServerUnaryCall<StartCancelEventSagaRequest, StartCancelEventSagaResponse>,
    callback: SendUnaryData<StartCancelEventSagaResponse>,
  ) {
    const { eventId } = call.request;
    this.sagaService
      .startCancelEventSaga({ eventId })
      .then((result) =>
        callback(null, {
          success: true,
          message: "Cancel event saga started successfully",
          sagaId: result.sagaId,
          status: result.status,
        }),
      )
      .catch((err) => callback(toGrpcError(err), null));
  }

  startInitiatePaymentSaga(
    call: ServerUnaryCall<StartInitiatePaymentSagaRequest, StartInitiatePaymentSagaResponse>,
    callback: SendUnaryData<StartInitiatePaymentSagaResponse>,
  ) {
    const { bookingId, actorId, actorRole } = call.request;
    this.sagaService
      .startInitiatePaymentSaga({ bookingId, actorId, actorRole })
      .then((result) =>
        callback(null, {
          success: true,
          message: "Initiate payment saga completed successfully",
          sagaId: result.sagaId,
          status: result.status,
          paymentId: result.paymentId,
          razorpayOrderId: result.razorpayOrderId,
          amount: result.amount,
          currency: result.currency,
        }),
      )
      .catch((err) => callback(toGrpcError(err), null));
  }
}
