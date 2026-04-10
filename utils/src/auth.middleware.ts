import { Request, Response, NextFunction } from "express";
import { UnauthorizedError, ForbiddenError } from "./error.handling.middleware";
import { logger } from "./logger";

export interface AuthReq extends Request {
  user?: {
    id: string;
    role: "ADMIN" | "USER";
    email: string;
  };
  meta?: {
    ip: string;
    userAgent: string;
    requestId: string;
  };
}

export interface WithMetaData extends Request {
  meta?: {
    ip: string;
    userAgent: string;
    requestId: string;
  };
}

export class CustomMiddleware {
  /**
   * Sets auth context from headers
   */
  public context(req: AuthReq, _res: Response, next: NextFunction) {
    const id = req.headers["x-id"];
    const role = req.headers["x-role"];
    const email = req.headers["x-email"];

    if (!id || !role || !email) {
      throw new UnauthorizedError("Invalid auth context, Please try again later");
    }

    logger.info(`Auth context set id=${id} role=${role} email=${email}`);
    req.user = {
      id: String(id),
      role: role === "ADMIN" ? "ADMIN" : "USER",
      email: String(email),
    };

    next();
  }

  public metaData(req: WithMetaData, _res: Response, next: NextFunction) {
    const userAgent = req.headers["user-agent"];
    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
    const requestId = req.headers["x-request-id"];

    if (!userAgent || !ip || !requestId) {
      throw new UnauthorizedError("Invalid meta data, Please try again later");
    }

    logger.info(`Meta data set ip=${ip} ua=${userAgent} requestId=${requestId}`);
    req.meta = {
      ip: String(ip),
      userAgent: String(userAgent),
      requestId: String(requestId),
    };

    next();
  }

  public requestLogger = (req: AuthReq, _res: Response, next: NextFunction) => {
    const requestId = req.meta?.requestId || "unknown";
    const ip = req.meta?.ip || "unknown";
    const userAgent = req.meta?.userAgent || "unknown";

    const userId = req.user?.id || "unknown";
    const role = req.user?.role || "unknown";
    const email = req.user?.email || "unknown";

    logger.info(
      `[REQ] ${req.method} ${req.originalUrl} | requestId=${requestId} 
      | userId=${userId} | role=${role}  | email=${email} | ip=${ip} | ua=${userAgent}`,
    );

    next();
  };

  /**
   * Authorizes user based on role
   */
  public authorize(roles: Array<"ADMIN" | "USER">) {
    return (req: AuthReq, _res: Response, next: NextFunction) => {
      if (!req.user || !roles.includes(req.user.role)) {
        throw new ForbiddenError("You are not allowed to access this resource");
      }
      next();
    };
  }
}
