import { Router } from "express";
import { SagaController } from "../controllers/saga.controller";
import { asyncHandler, CustomMiddleware } from "../../../utils/src";
import { container } from "./../container";

const router = Router();
const sagaController = container.resolve<SagaController>("sagaController");
const customMiddleware = container.resolve<CustomMiddleware>("customMiddleware");

const adminOnly = [
  customMiddleware.context.bind(customMiddleware),
  customMiddleware.metaData.bind(customMiddleware),
  customMiddleware.requestLogger.bind(customMiddleware),
  customMiddleware.authorize(["ADMIN"]),
];

router.use(adminOnly);

// Status/Polling Endpoints
router.get("/:sagaId/status", asyncHandler(sagaController.findSagaStatus.bind(sagaController)));
router.get("/:sagaId", asyncHandler(sagaController.findSagaDetails.bind(sagaController)));

// Advanced Admin Endpoints
router.post("/recovery", asyncHandler(sagaController.triggerRecovery.bind(sagaController)));
router.post("/:sagaId/compensate", asyncHandler(sagaController.forceCompensate.bind(sagaController)));

export default router;
