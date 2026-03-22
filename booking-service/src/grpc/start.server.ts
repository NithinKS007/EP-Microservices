import { startGrpcServer } from "../../../utils/src/index";
import { BookingServiceService } from "../../../utils/src/index";
import { handlers } from "./handler";

export const startBookingGrpcServer = () => {
  startGrpcServer(BookingServiceService, handlers, "50053");
};
