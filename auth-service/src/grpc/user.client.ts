import { envConfig } from "../config/env.config";
import {
  createGrpcClient,
  fromGrpcError,
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

export class UserServiceGrpcClient {
  private client = createGrpcClient(
    UserServiceClient,
    envConfig.USER_SERVICE_URL_GRPC || "user:50051",
  );

  createUser(data: CreateUserRequest): Promise<CreateUserResponse> {
    return new Promise((resolve, reject) => {
      this.client.createUser(data, (err, res) => {
        if (err) return reject(fromGrpcError(err));
        resolve(res);
      });
    });
  }

  findUserByEmail(data: FindUserByEmailRequest): Promise<
    Omit<FindUserByEmailResponse, "user"> & {
      user?: UserEntity;
    }
  > {
    return new Promise((resolve, reject) => {
      this.client.findUserByEmail(data, (err, res) => {
        if (err) return reject(fromGrpcError(err));
        resolve({
          ...res,
          user: res?.user ? { ...res.user, role: this.mapRole(res.user.role) } : undefined,
        });
      });
    });
  }

  updateUserPassword(data: UpdateUserPasswordRequest): Promise<UpdateUserPasswordResponse> {
    return new Promise((resolve, reject) => {
      this.client.updateUserPassword(data, (err, res) => {
        if (err) return reject(fromGrpcError(err));
        resolve(res);
      });
    });
  }

  findUserById(data: FindUserByIdRequest): Promise<FindUserByIdResponse> {
    return new Promise((resolve, reject) => {
      this.client.findUserById(data, (err, res) => {
        if (err) return reject(fromGrpcError(err));
        resolve(res);
      });
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
