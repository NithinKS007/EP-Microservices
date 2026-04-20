import { envConfig } from "../config/env.config";
import {
  createCircuitBreaker,
  createGrpcClient,
  executeUnaryGrpcCall,
  findCircuitBreakerPolicy,
} from "../../../utils/src";
import { UserServiceClient, FindUserByIdRequest, FindUserByIdResponse } from "../../../utils/src";

export class UserServiceGrpcClient {
  private readonly GRPC_TIMEOUT_MS = 4000;
  private client = createGrpcClient(
    UserServiceClient,
    envConfig.USER_SERVICE_URL_GRPC || "user:50051",
  );

  private readonly findUserByIdBreaker = createCircuitBreaker<
    [FindUserByIdRequest],
    FindUserByIdResponse
  >({
    name: "payment.user.find_by_id",
    ...findCircuitBreakerPolicy("internalQuery"),
    action: (data) => this.executeFindUserById(data),
  });

  async findUserById(data: FindUserByIdRequest): Promise<FindUserByIdResponse> {
    return this.findUserByIdBreaker.fire(data);
  }

  private executeFindUserById(data: FindUserByIdRequest): Promise<FindUserByIdResponse> {
    return executeUnaryGrpcCall({
      timeoutMs: this.GRPC_TIMEOUT_MS,
      invoke: (metadata, options, callback) =>
        this.client.findUserById(data, metadata, options, callback),
    });
  }
}
