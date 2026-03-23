import { Router } from "express";
import { container } from "../container";
import { UserController } from "./../controllers/user.controller";
import { asyncHandler } from "../../../utils/src";

const router = Router();

const userController = container.resolve<UserController>("userController");

router.post("/:id", asyncHandler(userController.findUserById.bind(userController)));
router.put("/", asyncHandler(userController.updateUser.bind(userController)));

export { router };
