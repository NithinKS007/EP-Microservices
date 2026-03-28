import { GrpcHandler } from "../../../utils/src";
import { container } from "../container";
import { SagaGrpcController } from "./saga.server";

const controller = container.resolve<SagaGrpcController>("sagaGrpcController");

export const handlers: GrpcHandler = {
  startCancelEventSaga: controller.startCancelEventSaga.bind(controller),
};
