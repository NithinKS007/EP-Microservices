import { sendResponse } from "./http.response";
import { NextFunction, Request, RequestHandler, Response } from "express";
import { StatusCodes } from "./http.status.codes";

/**
 * Middleware to handle undefined routes (404 Not Found).
 *
 * Place this after all route definitions to catch requests
 * to non-existent endpoints and return a standardized JSON response.
 *
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function (not used here)
 *
 * Response example:
 * {
 *   statusCode: 404,
 *   data: null,
 *   message: "Not found"
 * }
 */

export const notFoundMiddleware: RequestHandler = (
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  sendResponse(res, StatusCodes.NotFound, null, "Not found");
};
