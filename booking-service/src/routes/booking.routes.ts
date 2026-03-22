import { Router } from "express";
import { container } from "../container";
import { BookingController } from "../controllers/booking.controller";
import { asyncHandler } from "../../../utils/src";

const router = Router();

const bookingController = container.resolve<BookingController>("bookingController");

router.post("/", asyncHandler(bookingController.create.bind(bookingController)));

export default router
