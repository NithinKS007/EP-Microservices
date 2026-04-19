import * as grpc from "@grpc/grpc-js";
import {
  ConflictError,
  DatabaseError,
  ForbiddenError,
  NotFoundError,
  ServiceUnavailableError,
  TimeoutError,
  UnauthorizedError,
  ValidationError,
} from "./../../src/error.handling.middleware";

/**
 * Convert domain error to gRPC ServiceError
 */
export const toGrpcError = (err: Error): grpc.ServiceError => {
  const grpcErr: grpc.ServiceError = {
    name: err.name,
    message: err.message,
    code: grpc.status.UNKNOWN,
    details: err.message,
    metadata: new grpc.Metadata(),
  };

  if (err instanceof ConflictError) grpcErr.code = grpc.status.ALREADY_EXISTS;
  if (err instanceof ValidationError) grpcErr.code = grpc.status.INVALID_ARGUMENT;
  if (err instanceof NotFoundError) grpcErr.code = grpc.status.NOT_FOUND;
  if (err instanceof ForbiddenError) grpcErr.code = grpc.status.PERMISSION_DENIED;
  if (err instanceof UnauthorizedError) grpcErr.code = grpc.status.UNAUTHENTICATED;
  if (err instanceof TimeoutError) grpcErr.code = grpc.status.DEADLINE_EXCEEDED;
  if (err instanceof ServiceUnavailableError) grpcErr.code = grpc.status.UNAVAILABLE;
  if (err instanceof DatabaseError) grpcErr.code = grpc.status.INTERNAL;

  return grpcErr;
};

export const fromGrpcError = (err: grpc.ServiceError): Error => {
  const cleanMessage = err.message.replace(/^(\d+)\s+[A-Z_]+:\s+/, "");

  switch (err.code) {
    case grpc.status.ALREADY_EXISTS:
      return new ConflictError(cleanMessage);
    case grpc.status.INVALID_ARGUMENT:
      return new ValidationError(cleanMessage);
    case grpc.status.NOT_FOUND:
      return new NotFoundError(cleanMessage);
    case grpc.status.PERMISSION_DENIED:
      return new ForbiddenError(cleanMessage);
    case grpc.status.UNAUTHENTICATED:
      return new UnauthorizedError(cleanMessage);
    case grpc.status.DEADLINE_EXCEEDED:
      return new TimeoutError(cleanMessage || "Upstream request timed out");
    case grpc.status.UNAVAILABLE:
      return new ServiceUnavailableError(cleanMessage || "Upstream service is unavailable");
    case grpc.status.INTERNAL:
    case grpc.status.UNKNOWN:
      return new DatabaseError(cleanMessage);
    default:
      return new DatabaseError(cleanMessage);
  }
};
