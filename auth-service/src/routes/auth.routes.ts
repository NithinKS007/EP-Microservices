import { Router } from "express";
import { container } from "../container";
import { AuthController } from "./../controllers/auth.controller";
import { asyncHandler, CustomMiddleware } from "../../../utils/src";
import { PasswordController } from "./../controllers/password.controller";

const router = Router();

const authController = container.resolve<AuthController>("authController");
const passController = container.resolve<PasswordController>("passwordController");
const customMiddleware = container.resolve<CustomMiddleware>("customMiddleware");

// AUTHENTICATION NOT REQUIRED APIS
router.use(customMiddleware.metaData.bind(customMiddleware));
router.use(customMiddleware.requestLogger.bind(customMiddleware));
router.post("/sign-up", asyncHandler(authController.signup.bind(authController)));
router.post("/sign-in", asyncHandler(authController.signin.bind(authController)));
router.post("/password-reset",asyncHandler(passController.sendResetPassLink.bind(passController)));
router.patch("/password-reset/:token",asyncHandler(passController.changePassUsingToken.bind(passController)));

// AUTHENTICATION REQUIRED APIS
router.use( customMiddleware.context.bind(customMiddleware));
router.use( customMiddleware.authorize(["ADMIN","USER"]).bind(customMiddleware));
router.post("/sign-out",asyncHandler(authController.signout.bind(authController)));
router.post("/refresh-token",asyncHandler(authController.refreshToken.bind(authController)));
router.patch("/password/change",asyncHandler(passController.changePass.bind(passController)));


export { router };
