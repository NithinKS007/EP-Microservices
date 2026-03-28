import { SagaService } from "../services/saga.service";
import {
  toGrpcError,
  StartCancelEventSagaRequest,
  StartCancelEventSagaResponse,
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
}
