import { Router } from "express";
import { container } from "../container";
import { asyncHandler } from "../../../utils/src";
import { AuthMiddleware } from "../../../utils/src/auth.middleware";
import { SeatController } from "./../controllers/seat.controller";

const router = Router({mergeParams: true});

const seatController = container.resolve<SeatController>("seatController");
const authMidUtils = container.resolve<AuthMiddleware>("authMidUtils");

router.use(authMidUtils.context.bind(authMidUtils));
router.use(authMidUtils.authorize(["admin"]));

router.post("/", asyncHandler(seatController.create.bind(seatController)));
router.get("/", asyncHandler(seatController.findSeatsWithPagination.bind(seatController)));

export default router;
