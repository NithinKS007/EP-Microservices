import { Router } from "express";
import { container } from "../container";
import { asyncHandler } from "../../../utils/src";
import { CustomMiddleware } from "../../../utils/src/auth.middleware";
import { SeatController } from "./../controllers/seat.controller";

const router = Router({mergeParams: true});

const seatController = container.resolve<SeatController>("seatController");
const customMiddleware = container.resolve<CustomMiddleware>("customMiddleware");

router.use(customMiddleware.context.bind(customMiddleware));
router.use(customMiddleware.requestLogger.bind(customMiddleware));
router.post("/", asyncHandler(seatController.create.bind(seatController)));
router.get("/", asyncHandler(seatController.findSeatsWithPagination.bind(seatController)));

export default router;
