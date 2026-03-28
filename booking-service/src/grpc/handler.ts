import { GrpcHandler } from "../../../utils/src/index";

import { container } from "../container";
import { BookingGrpcController } from "./booking.server";
const controller = container.resolve<BookingGrpcController>("bookingGrpcController");

export const handlers: GrpcHandler = {
  findBooking: controller.findBooking.bind(controller),
  findBookingsByEvent: controller.findBookingsByEvent.bind(controller),
  updateBookingStatus: controller.updateBookingStatus.bind(controller),
  updateBookingAmount: controller.updateBookingAmount.bind(controller),
};
