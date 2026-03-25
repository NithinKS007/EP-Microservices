import { Router } from "express";
import { container } from "../container";
import { BookingController } from "../controllers/booking.controller";
import { asyncHandler, CustomMiddleware } from "../../../utils/src";

const router = Router();

const bookingController = container.resolve<BookingController>("bookingController");
const customMiddleware = container.resolve<CustomMiddleware>("CustomMiddleware");

router.use(customMiddleware.context.bind(customMiddleware));
router.use(customMiddleware.requestLogger.bind(customMiddleware));  
router.post("/",customMiddleware.authorize(["USER"]), asyncHandler(bookingController.create.bind(bookingController)));

export default router
