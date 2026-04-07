import { Router } from "express";
import { container } from "../container";
import { BookingController } from "../controllers/booking.controller";
import { asyncHandler, CustomMiddleware } from "../../../utils/src";

const router = Router();

const bookingController = container.resolve<BookingController>("bookingController");
const customMiddleware = container.resolve<CustomMiddleware>("customMiddleware");

router.use(customMiddleware.context.bind(customMiddleware));
router.use(customMiddleware.requestLogger.bind(customMiddleware));
router.post(
  "/",
  customMiddleware.authorize(["USER"]),
  asyncHandler(bookingController.create.bind(bookingController)),
);
router.get(
  "/",
  customMiddleware.authorize(["USER", "ADMIN"]),
  asyncHandler(bookingController.findBookingsWithPagination.bind(bookingController)),
);
router.get(
  "/:id",
  customMiddleware.authorize(["USER", "ADMIN"]),
  asyncHandler(bookingController.findBookingByIdWithDetails.bind(bookingController)),
);
router.post(
  "/:id/confirm",
  customMiddleware.authorize(["ADMIN"]),
  asyncHandler(bookingController.confirm.bind(bookingController)),
);
router.post(
  "/:id/cancel",
  customMiddleware.authorize(["USER", "ADMIN"]),
  asyncHandler(bookingController.cancel.bind(bookingController)),
);
router.post(
  "/:id/expire",
  customMiddleware.authorize(["ADMIN"]),
  asyncHandler(bookingController.expire.bind(bookingController)),
);

export default router;
