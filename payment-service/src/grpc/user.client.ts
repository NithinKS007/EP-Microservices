import { envConfig } from "../config/env.config";
import {
  createCircuitBreaker,
  createGrpcClient,
  fromGrpcError,
  Metadata,
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
    timeoutMs: 5000,
    action: (data) => this.executeFindUserById(data),
  });

  /**
   * Fetches user details by status for refund notifications.
   * Used in: Payment refund and settlement flow
   * Triggered via: gRPC
   */
  async findUserById(data: FindUserByIdRequest): Promise<FindUserByIdResponse> {
    return this.findUserByIdBreaker.fire(data);
  }

  /**
   * Executes the raw user fetch gRPC call with a deadline.
   * Used in: Payment refund and settlement flow
   * Triggered via: gRPC
   */
  private executeFindUserById(data: FindUserByIdRequest): Promise<FindUserByIdResponse> {
    return new Promise((resolve, reject) => {
      this.client.findUserById(
        data,
        new Metadata(),
        { deadline: new Date(Date.now() + this.GRPC_TIMEOUT_MS) },
        (err, res) => {
          if (err) return reject(fromGrpcError(err));
          resolve(res);
        },
      );
    });
  }
}
