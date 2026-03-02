import { Request, Response, NextFunction } from "express";
import { UnauthorizedError } from "../../../utils/src/error.handling.middleware";
import { JwtService } from "../../../utils/src/jwt.service";
import { container } from "../container";
/**
 * Authentication middleware that validates the JWT access token
 * provided in the Authorization header. If valid, it extracts the
 * userId and role and attaches them to request headers for downstream use.
 *
 * @function authenticate
 *
 * @param {Request} req - Express request object.
 * @param {Response} res - Express response object.
 * @param {NextFunction} next - Callback to pass control to the next handler.
 *
 * @throws {UnauthorizedError} Throws when the access token is missing or invalid.
 *
 * @example
 * router.get("/profile", authenticate, userController.getProfile);
 */

export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers["authorization"];
  if (!authHeader) {
    next(new UnauthorizedError("Access token not found, Please try again later"));
    return;
  }
  const accessToken = authHeader.split(" ")[1];
  if (!accessToken) {
    next(new UnauthorizedError("Access token not found, Please try again later"));
    return;
  }
  try {
    const decoded = await container.resolve<JwtService>("jwtService").verifyAT(accessToken);
    req.headers["x-id"] = decoded.id;
    req.headers["x-role"] = decoded.role;
    req.headers["x-email"] = decoded.email;

    next();
  } catch (error: unknown) {
    console.log(`Error in authentication middleware${error} `);
    next(new UnauthorizedError("Invalid access token"));
    return;
  }
};
