import { EventServiceService, startGrpcServer } from "../../../utils/src/index";
import { handlers } from "./handler";

export const startEventGrpcServer = () => {
  startGrpcServer(EventServiceService, handlers, "50052");
};
