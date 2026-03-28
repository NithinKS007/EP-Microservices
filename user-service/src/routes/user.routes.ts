import { Router } from "express";
import { container } from "../container";
import { UserController } from "./../controllers/user.controller";
import { asyncHandler, CustomMiddleware } from "../../../utils/src";

const router = Router();

const userController = container.resolve<UserController>("userController");
const customMiddleware = container.resolve<CustomMiddleware>("customMiddleware");

router.use(customMiddleware.context.bind(customMiddleware));
router.use(customMiddleware.requestLogger.bind(customMiddleware));

router.get("/:id", asyncHandler(userController.findUserById.bind(userController)));
router.put("/", customMiddleware.authorize(["USER"]), asyncHandler(userController.updateUser.bind(userController)));
router.patch("/",customMiddleware.authorize(["USER"]), asyncHandler(userController.updateRole.bind(userController)));
router.get("/", customMiddleware.authorize(["ADMIN"]), asyncHandler(userController.findUsers.bind(userController)));

export { router };
