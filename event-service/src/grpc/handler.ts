import { GrpcHandler } from "../../../utils/src/index";
import { container } from "../container";
import { EventGrpcController } from "./event.server";
const controller = container.resolve<EventGrpcController>("eventGrpcController");

export const handlers: GrpcHandler = {
  lockSeats: controller.lockSeats.bind(controller),
  confirmSeats: controller.confirmSeats.bind(controller),
  releaseSeats: controller.releaseSeats.bind(controller),
  bulkReleaseSeats: controller.bulkReleaseSeats.bind(controller),
  markEventCancelled: controller.markEventCancelled.bind(controller),
};
