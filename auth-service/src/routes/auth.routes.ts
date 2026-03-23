import { Router } from "express";
import { container } from "../container";
import { AuthController } from "./../controllers/auth.controller";
import { asyncHandler } from "../../../utils/src";
import { PasswordController } from "./../controllers/password.controller";

const router = Router();

const authController = container.resolve<AuthController>("authController");
const passController = container.resolve<PasswordController>("passwordController");

// AUTHENTICATION NOT REQUIRED APIS
router.post("/signup", asyncHandler(authController.signup.bind(authController)));
router.post("/sign-in", asyncHandler(authController.signin.bind(authController)));
router.post("/password-reset",asyncHandler(passController.sendResetPassLink.bind(passController)));
router.patch("/password-reset/:token",asyncHandler(passController.changePassUsingToken.bind(passController)));

// AUTHENTICATION REQUIRED APIS
router.post("/sign-out",asyncHandler(authController.signout.bind(authController)));
router.post("/refresh-token",asyncHandler(authController.refreshToken.bind(authController)));
router.patch("/password/change",asyncHandler(passController.changePass.bind(passController)));


export { router };
