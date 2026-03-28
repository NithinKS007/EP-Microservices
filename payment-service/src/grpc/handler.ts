import { GrpcHandler } from "../../../utils/src/index";

import { container } from "../container";
import { PaymentGrpcController } from "./payment.server";
const controller = container.resolve<PaymentGrpcController>("paymentGrpcController");

export const handlers: GrpcHandler = {
  createPayment: controller.createPayment.bind(controller),
  findPaymentsByBookingIds: controller.findPaymentsByBookingIds.bind(controller),
  updatePaymentStatus: controller.updatePaymentStatus.bind(controller),
};
