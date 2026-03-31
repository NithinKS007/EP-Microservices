import { Router } from "express";
import { container } from "../container";
import { PaymentController } from "./../controllers/payment.controller";
import { asyncHandler, CustomMiddleware } from "../../../utils/src";

const router = Router();

const bookingController = container.resolve<PaymentController>("bookingController");
const customMiddleware = container.resolve<CustomMiddleware>("customMiddleware");

router.use(customMiddleware.context.bind(customMiddleware));
router.use(customMiddleware.requestLogger.bind(customMiddleware));  
router.get("/:id", asyncHandler(bookingController.findPaymentById.bind(bookingController)));
router.get("/bookings/:id", asyncHandler(bookingController.findPaymentByBookingId.bind(bookingController)));

export default router
