import * as grpc from "@grpc/grpc-js";
import { fromGrpcError } from "./grpc.error.mapper";

export function createGrpcClient<T extends grpc.Client>(
  ClientClass: new (
    address: string,
    credentials: grpc.ChannelCredentials,
    options?: grpc.ClientOptions,
  ) => T,
  address: string,
): T {
  return new ClientClass(address, grpc.credentials.createInsecure());
}

export interface ExecuteUnaryGrpcCallOptions<TResult> {
  timeoutMs?: number;
  metadata?: grpc.Metadata;
  mapError?: (error: grpc.ServiceError) => Error;
  invoke: (
    metadata: grpc.Metadata,
    options: grpc.CallOptions,
    callback: (error: grpc.ServiceError | null, response: TResult) => void,
  ) => void;
}

/**
 * Executes a unary gRPC request with a deadline and normalized error mapping.
 */
export function executeUnaryGrpcCall<TResult>({
  timeoutMs = 4000,
  metadata = new grpc.Metadata(),
  mapError = fromGrpcError,
  invoke,
}: ExecuteUnaryGrpcCallOptions<TResult>): Promise<TResult> {
  return new Promise((resolve, reject) => {
    invoke(metadata, { deadline: new Date(Date.now() + timeoutMs) }, (error, response) => {
      if (error) return reject(mapError(error));
      resolve(response);
    });
  });
}
