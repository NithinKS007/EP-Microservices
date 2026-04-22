import { envConfig } from "../config/env.config";
import {
  createCircuitBreaker,
  createGrpcClient,
  executeUnaryGrpcCall,
  findCircuitBreakerPolicy,
  FindUserByEmailRequest,
  FindUserByEmailResponse,
  UpdateUserPasswordRequest,
  UpdateUserPasswordResponse,
  Role,
  FindUserByIdRequest,
  FindUserByIdResponse,
} from "../../../utils/src";
import { UserServiceClient, CreateUserRequest, CreateUserResponse } from "../../../utils/src";
import { UserEntity } from "./../entity/user.entity";

type FindUserByEmailResult = Omit<FindUserByEmailResponse, "user"> & {
  user?: UserEntity;
};

export class UserServiceGrpcClient {
  private readonly GRPC_TIMEOUT_MS = 4000;
  private client = createGrpcClient(
    UserServiceClient,
    envConfig.USER_SERVICE_URL_GRPC || "user:50051",
  );
  private readonly createUserBreaker = createCircuitBreaker<[CreateUserRequest], CreateUserResponse>(
    {
      name: "auth.user.create",
      ...findCircuitBreakerPolicy("internalCommand"),
      action: (data) => this.executeCreateUser(data),
    },
  );
  private readonly findUserByEmailBreaker = createCircuitBreaker<
    [FindUserByEmailRequest],
    FindUserByEmailResult
  >({
    name: "auth.user.find_by_email",
    ...findCircuitBreakerPolicy("internalQuery"),
    action: (data) => this.executeFindUserByEmail(data),
  });
  private readonly updateUserPasswordBreaker = createCircuitBreaker<
    [UpdateUserPasswordRequest],
    UpdateUserPasswordResponse
  >({
    name: "auth.user.update_password",
    ...findCircuitBreakerPolicy("internalCommand"),
    action: (data) => this.executeUpdateUserPassword(data),
  });
  private readonly findUserByIdBreaker = createCircuitBreaker<
    [FindUserByIdRequest],
    FindUserByIdResponse
  >({
    name: "auth.user.find_by_id",
    ...findCircuitBreakerPolicy("internalQuery"),
    action: (data) => this.executeFindUserById(data),
  });

  createUser(data: CreateUserRequest): Promise<CreateUserResponse> {
    return this.createUserBreaker.fire(data);
  }

  findUserByEmail(data: FindUserByEmailRequest): Promise<FindUserByEmailResult> {
    return this.findUserByEmailBreaker.fire(data);
  }

  updateUserPassword(data: UpdateUserPasswordRequest): Promise<UpdateUserPasswordResponse> {
    return this.updateUserPasswordBreaker.fire(data);
  }

  findUserById(data: FindUserByIdRequest): Promise<FindUserByIdResponse> {
    return this.findUserByIdBreaker.fire(data);
  }

  private executeCreateUser(data: CreateUserRequest): Promise<CreateUserResponse> {
    return executeUnaryGrpcCall({
      timeoutMs: this.GRPC_TIMEOUT_MS,
      invoke: (metadata, options, callback) =>
        this.client.createUser(data, metadata, options, callback),
    });
  }

  private executeFindUserByEmail(data: FindUserByEmailRequest): Promise<FindUserByEmailResult> {
    return executeUnaryGrpcCall<FindUserByEmailResponse>({
      timeoutMs: this.GRPC_TIMEOUT_MS,
      invoke: (metadata, options, callback) =>
        this.client.findUserByEmail(data, metadata, options, callback),
    }).then((response) => ({
      ...response,
      user: response?.user
        ? { ...response.user, role: this.mapRole(response.user.role) }
        : undefined,
    }));
  }

  private executeUpdateUserPassword(
    data: UpdateUserPasswordRequest,
  ): Promise<UpdateUserPasswordResponse> {
    return executeUnaryGrpcCall({
      timeoutMs: this.GRPC_TIMEOUT_MS,
      invoke: (metadata, options, callback) =>
        this.client.updateUserPassword(data, metadata, options, callback),
    });
  }

  private executeFindUserById(data: FindUserByIdRequest): Promise<FindUserByIdResponse> {
    return executeUnaryGrpcCall({
      timeoutMs: this.GRPC_TIMEOUT_MS,
      invoke: (metadata, options, callback) =>
        this.client.findUserById(data, metadata, options, callback),
    });
  }

  private mapRole(role: Role): "ADMIN" | "USER" {
    // 1. If it's the string "ADMIN" or the gRPC-equivalent number/value
    if (role === 0) {
      // Check what your gRPC returns (usually 0 or 1)
      return "ADMIN";
    }

    // 2. If it's the string "USER" or the gRPC-equivalent number
    if (role === 1) {
      return "USER";
    }

    return "USER";
  }
}
