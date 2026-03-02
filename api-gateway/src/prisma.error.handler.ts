import { Request, Response, NextFunction } from "express";
import { AppError } from "../../utils/src/error.handling.middleware";


export const prismaErrorHandler = (
  err: AppError | any,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || "Internal Server Error";
  let code = err.code || "INTERNAL_ERROR";

  // Type guards for Prisma-like errors
  const isPrismaKnownError = (e: any) =>
    e && e.name === "PrismaClientKnownRequestError" && typeof e.code === "string";
  const isPrismaValidationError = (e: any) => e && e.name === "PrismaClientValidationError";
  const isPrismaUnknownError = (e: any) => e && e.name === "PrismaClientUnknownRequestError";
  const isPrismaInitializationError = (e: any) => e && e.name === "PrismaClientInitializationError";
  const isPrismaPanicError = (e: any) => e && e.name === "PrismaClientRustPanicError";

  if (isPrismaKnownError(err)) {
    // Inline Prisma error map
    const prismaErrorMap: Record<string, { message: string; code: string; status?: number }> = {
      P1000: {
        message: "Authentication failed. Invalid database credentials.",
        code: "DB_AUTH_FAILED",
        status: 401,
      },
      P1001: {
        message: "Cannot reach database server. Check host and port.",
        code: "DB_UNREACHABLE",
        status: 503,
      },
      P1002: { message: "Database server timed out.", code: "DB_TIMEOUT", status: 504 },
      P1003: { message: "Database does not exist.", code: "DB_NOT_FOUND", status: 404 },
      P1008: { message: "Operation timed out.", code: "OPERATION_TIMEOUT", status: 504 },
      P1009: { message: "Database already exists.", code: "DB_ALREADY_EXISTS", status: 409 },
      P1010: {
        message: "User denied access to the database.",
        code: "DB_ACCESS_DENIED",
        status: 403,
      },
      P1011: { message: "TLS connection error.", code: "TLS_CONNECTION_ERROR", status: 500 },
      P1012: {
        message: "Schema or generator validation error.",
        code: "SCHEMA_VALIDATION_ERROR",
        status: 400,
      },
      P1013: { message: "Invalid database string.", code: "INVALID_DB_STRING", status: 400 },
      P1014: {
        message: "Underlying model kind does not exist.",
        code: "MODEL_KIND_NOT_FOUND",
        status: 400,
      },
      P1015: {
        message: "Feature not supported for this database version.",
        code: "FEATURE_UNSUPPORTED",
        status: 400,
      },
      P1016: {
        message: "Incorrect number of parameters for raw query.",
        code: "RAW_QUERY_PARAM_ERROR",
        status: 400,
      },
      P1017: {
        message: "Server closed the connection unexpectedly.",
        code: "SERVER_CONNECTION_CLOSED",
        status: 500,
      },
      P2000: { message: "Value too long for column.", code: "VALUE_TOO_LONG", status: 400 },
      P2001: { message: "Record not found.", code: "RECORD_NOT_FOUND", status: 404 },
      P2002: { message: "Unique constraint failed.", code: "DUPLICATE_RECORD", status: 409 },
      P2003: {
        message: "Foreign key constraint failed.",
        code: "FOREIGN_KEY_CONSTRAINT",
        status: 409,
      },
      P2004: {
        message: "Database constraint violation.",
        code: "CONSTRAINT_VIOLATION",
        status: 409,
      },
      P2005: {
        message: "Invalid value stored in the database.",
        code: "INVALID_VALUE",
        status: 400,
      },
      P2006: { message: "Invalid column value.", code: "INVALID_COLUMN_VALUE", status: 400 },
      P2007: { message: "Data validation error.", code: "DATA_VALIDATION_ERROR", status: 400 },
      P2008: { message: "Query parsing error.", code: "QUERY_PARSING_ERROR", status: 400 },
      P2009: { message: "Query validation error.", code: "QUERY_VALIDATION_ERROR", status: 400 },
      P2010: {
        message: "Raw query failed due to database error.",
        code: "RAW_QUERY_FAILED",
        status: 500,
      },
      P2011: {
        message: "Null constraint violation on a required field.",
        code: "NULL_CONSTRAINT_VIOLATION",
        status: 400,
      },
      P2012: {
        message: "Missing required value for field.",
        code: "MISSING_REQUIRED_VALUE",
        status: 400,
      },
      P2013: {
        message: "Missing required argument for field.",
        code: "MISSING_REQUIRED_ARGUMENT",
        status: 400,
      },
      P2014: { message: "Invalid relation reference.", code: "INVALID_RELATION", status: 400 },
      P2015: {
        message: "Related record not found.",
        code: "RELATED_RECORD_NOT_FOUND",
        status: 404,
      },
      P2016: {
        message: "Query interpretation error.",
        code: "QUERY_INTERPRETATION_ERROR",
        status: 400,
      },
      P2017: {
        message: "Records for relation are not connected.",
        code: "RELATION_NOT_CONNECTED",
        status: 400,
      },
      P2018: {
        message: "Required connected records not found.",
        code: "REQUIRED_CONNECTED_RECORDS_NOT_FOUND",
        status: 404,
      },
      P2019: { message: "Invalid input value or type.", code: "INVALID_INPUT", status: 400 },
      P2020: { message: "Value out of range.", code: "VALUE_OUT_OF_RANGE", status: 400 },
      P2021: { message: "Table not found in database.", code: "TABLE_NOT_FOUND", status: 404 },
      P2022: { message: "Column not found in database.", code: "COLUMN_NOT_FOUND", status: 404 },
      P2023: {
        message: "Inconsistent column data.",
        code: "INCONSISTENT_COLUMN_DATA",
        status: 400,
      },
      P2024: { message: "Connection pool timeout.", code: "CONNECTION_TIMEOUT", status: 504 },
      P2025: {
        message: "Record not found or already deleted.",
        code: "RECORD_NOT_FOUND",
        status: 404,
      },
      // ... add more codes inline as needed
    };

    const mapped = prismaErrorMap[err.code];
    if (mapped) {
      message = mapped.message;
      code = mapped.code;
      statusCode = mapped.status || statusCode;
    } else {
      message = `Database error: ${err.message || "Unexpected database error."}`;
      code = err.code || "DATABASE_ERROR";
    }
  } else if (isPrismaValidationError(err)) {
    statusCode = 400;
    code = "PRISMA_VALIDATION_ERROR";
    message = "Invalid data sent to the database. Check input types.";
  } else if (isPrismaUnknownError(err)) {
    statusCode = 500;
    code = "PRISMA_UNKNOWN_ERROR";
    message = "Unknown database error occurred.";
  } else if (isPrismaInitializationError(err)) {
    statusCode = 500;
    code = "DB_CONNECTION_FAILED";
    message = "Cannot connect to database. Check credentials and network.";
  } else if (isPrismaPanicError(err)) {
    statusCode = 500;
    code = "DB_ENGINE_CRASH";
    message = "Prisma engine crashed unexpectedly.";
  } else if (err.message?.includes("Invalid value for argument")) {
    statusCode = 400;
    code = "PRISMA_VALIDATION_ERROR";
    message = "Invalid data provided to the database. Check field types and values.";
  } else {
    // generic fallback
    statusCode = err.statusCode || 500;
    code = err.code || "UNEXPECTED_ERROR";
    message = err.message || "Unexpected error occurred.";
  }

  console.error(`[${code}] ${statusCode} - ${message}`);
  next(new AppError(message, statusCode, code));
};
