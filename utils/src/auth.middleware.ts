import { Request, Response, NextFunction } from "express";
import { UnauthorizedError, ForbiddenError } from "./error.handling.middleware";

export interface AuthReq extends Request {
  user?: {
    id: string;
    role: "admin" | "user";
    email: string;
  };
}

export class AuthMiddleware {
  /**
   * Sets auth context from headers
   */
  public context(req: AuthReq, res: Response, next: NextFunction) {
    const id = req.headers["x-id"];
    const role = req.headers["x-role"];
    const email = req.headers["x-email"];

    if (!id || !role || !email) {
      throw new UnauthorizedError("Invalid auth context, Please try again later");
    }

    req.user = {
      id: String(id),
      role: role === "admin" ? "admin" : "user",
      email: String(email),
    };

    next();
  }

  /**
   * Authorizes user based on role
   */
  public authorize(roles: Array<"admin" | "user">) {
    return (req: AuthReq, res: Response, next: NextFunction) => {
      if (!req.user || !roles.includes(req.user.role)) {
        throw new ForbiddenError("You are not allowed to access this resource");
      }
      next();
    };
  }
}
