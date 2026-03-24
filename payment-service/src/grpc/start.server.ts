import { startGrpcServer } from "../../../utils/src/index";
import { PaymentServiceService } from "../../../utils/src/index";
import { handlers } from "./handler";

export const startPaymentGrpcServer = () => {
  startGrpcServer(PaymentServiceService, handlers, "50054");
};
