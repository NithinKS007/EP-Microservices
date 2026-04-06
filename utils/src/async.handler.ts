import { Request, Response, NextFunction } from "express";
import expressAsyncHandler from "express-async-handler";

/**
 * Wraps an async controller method with express-async-handler
 * to automatically catch and forward errors to Express error middleware.
 *
 * @function asyncHandler
 * @param {Function} controllerMethod - The async controller function to wrap.
 * @param {Request} controllerMethod.req - Express request object.
 * @param {Response} controllerMethod.res - Express response object.
 * @param {NextFunction} controllerMethod.next - Express next middleware callback.
 *
 * @returns {Function} A wrapped controller function that handles errors safely.
 *
 * @example
 * router.get('/users', asyncHandler(userController.getAllUsers));
 */
export const asyncHandler = (
  controllerMethod: (req: Request, res: Response, next: NextFunction) => Promise<void>,
) => expressAsyncHandler(controllerMethod);
