import { Router } from "express";
import { container } from "../container";
import { asyncHandler } from "../../../utils/src";
import { EventController } from "./../controllers/event.controller";
import { CustomMiddleware } from "../../../utils/src/auth.middleware";

const router = Router();

const eventController = container.resolve<EventController>("eventController");
const customMiddleware = container.resolve<CustomMiddleware>("customMiddleware");

router.use(customMiddleware.context.bind(customMiddleware));
router.use(customMiddleware.requestLogger.bind(customMiddleware));

router.post(
  "/",
  customMiddleware.authorize(["ADMIN"]),
  asyncHandler(eventController.create.bind(eventController)),
);
router.get("/", asyncHandler(eventController.findEventsWithPagination.bind(eventController)));
router.get("/:id", asyncHandler(eventController.findEventById.bind(eventController)));
router.put(
  "/:id",
  customMiddleware.authorize(["ADMIN"]),
  asyncHandler(eventController.updateEvent.bind(eventController)),
);
router.patch(
  "/:id/cancel",
  customMiddleware.authorize(["ADMIN"]),
  asyncHandler(eventController.cancelEvent.bind(eventController)),
);
router.delete(
  "/:id",
  customMiddleware.authorize(["ADMIN"]),
  asyncHandler(eventController.deleteEvent.bind(eventController)),
);

export default router;
