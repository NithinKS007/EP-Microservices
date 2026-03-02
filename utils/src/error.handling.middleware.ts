import { Request, Response, NextFunction } from "express";
import { sendResponse } from "./http.response";
import { StatusCodes } from "./http.status.codes";

/**
 * Base class for application errors.
 * Extends the default Error object with HTTP status code.
 */

export class AppError extends Error {
  statusCode: number;
  code: string;
  details: any;
  constructor(message: string, statusCode: number, code?: string, details?: any) {
    super(message);
    this.statusCode = statusCode;
    this.code = code || "INTERNAL_ERROR";
    this.details = details;
  }
}

/**
 * Specific error types for common HTTP errors.
 * Each class sets a default status code from StatusCodes.
 */

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, StatusCodes.BadRequest);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(message, StatusCodes.NotFound);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string) {
    super(message, StatusCodes.Unauthorized);
  }
}

export class DatabaseError extends AppError {
  constructor(message: string) {
    super(message, StatusCodes.InternalServerError);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string) {
    super(message, StatusCodes.Forbidden);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, StatusCodes.Conflict);
  }
}

export class InternalServerError extends AppError {
  constructor(message: string) {
    super(message, StatusCodes.InternalServerError);
  }
}

/**
 * Express middleware to handle all AppError instances.
 * Sends a standardized response using `sendResponse`.
 * Falls back to 500 Internal Server Error if not specified.
 */

export const errorMiddleware = (err: AppError, req: Request, res: Response, next: NextFunction) => {
  const statusCode = err.statusCode || StatusCodes.InternalServerError;
  const message = err.message || "INTERNAL SERVER ERROR";
  sendResponse(res, statusCode, null, message);
};
