import { SagaServiceService, startGrpcServer } from "../../../utils/src";
import { handlers } from "./handler";

export const startSagaGrpcServer = () => {
  startGrpcServer(SagaServiceService, handlers, "50055");
};
