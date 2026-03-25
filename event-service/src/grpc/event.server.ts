import { SeatService } from "./../services/seat.service";
import { toGrpcError } from "../../../utils/src/index";
import { ServerUnaryCall, SendUnaryData } from "../../../utils/src/index";
import {
  LockSeatsRequest,
  LockSeatsResponse,
  ConfirmSeatsRequest,
  ConfirmSeatsResponse,
  ReleaseSeatsRequest,
  ReleaseSeatsResponse,
} from "../../../utils/src/index";

export class EventGrpcController {
  private readonly seatService: SeatService;
  constructor({ seatService }: { seatService: SeatService }) {
    this.seatService = seatService;
  }

  lockSeats(
    call: ServerUnaryCall<LockSeatsRequest, LockSeatsResponse>,
    callback: SendUnaryData<LockSeatsResponse>,
  ): void {
    const { bookingId, eventId, expiresAt, seatIds } = call.request;
    this.seatService
      .lockSeats({
        bookingId,
        eventId,
        expiresAt,
        seatIds,
      })
      .then(() => callback(null, { success: true, message: "Seats locked successfully" }))
      .catch((err) => callback(toGrpcError(err), null));
  }

  confirmSeats(
    call: ServerUnaryCall<ConfirmSeatsRequest, ConfirmSeatsResponse>,
    callback: SendUnaryData<ConfirmSeatsResponse>,
  ) {
    const { bookingId } = call.request;
    this.seatService
      .confirmSeats({ bookingId })
      .then((user) =>
        callback(null, {
          success: true,
          message: "Seats confirmed successfully",
        }),
      )
      .catch((err) => callback(toGrpcError(err), null));
  }

  releaseSeats(
    call: ServerUnaryCall<ReleaseSeatsRequest, ReleaseSeatsResponse>,
    callback: SendUnaryData<ReleaseSeatsResponse>,
  ) {
    const { bookingId } = call.request;
    this.seatService
      .releaseSeats({ bookingId })
      .then((user) =>
        callback(null, {
          success: true,
          message: "Seats released successfully",
        }),
      )
      .catch((err) => callback(toGrpcError(err), null));
  }
}
