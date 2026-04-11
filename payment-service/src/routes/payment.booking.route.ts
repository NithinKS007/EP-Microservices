import { Router } from "express";
import { container } from "../container";
import { PaymentController } from "./../controllers/payment.controller";
import { asyncHandler, CustomMiddleware } from "../../../utils/src";

const router = Router();

const bookingController = container.resolve<PaymentController>("paymentController");
const customMiddleware = container.resolve<CustomMiddleware>("customMiddleware");

router.use(customMiddleware.context.bind(customMiddleware));
router.use(customMiddleware.requestLogger.bind(customMiddleware));

router.post(
  "/bookings/:id/payments/initiate",
  customMiddleware.authorize(["USER"]),
  asyncHandler(bookingController.initiate.bind(bookingController)),
);


export default router;