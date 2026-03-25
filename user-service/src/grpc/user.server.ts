import { UserService } from "../services/user.service";
import {
  toGrpcError,
  FindUserByEmailRequest,
  FindUserByEmailResponse,
  UpdateUserPasswordRequest,
  UpdateUserPasswordResponse,
  FindUserByIdRequest,
  FindUserByIdResponse,
  Role,
} from "../../../utils/src/index";
import { ServerUnaryCall, SendUnaryData } from "../../../utils/src/index";
import { CreateUserRequest, CreateUserResponse } from "../../../utils/src/index";

export class UserGrpcController {
  private readonly userService: UserService;
  constructor({ userService }: { userService: UserService }) {
    this.userService = userService;
  }

  createUser(
    call: ServerUnaryCall<CreateUserRequest, CreateUserResponse>,
    callback: SendUnaryData<CreateUserResponse>,
  ): void {
    const { email, password, name } = call.request;
    this.userService
      .createUser({
        email,
        password,
        name,
      })
      .then(() => callback(null, { success: true, message: "User created successfully" }))
      .catch((err) => callback(toGrpcError(err), null));
  }

  findUserByEmail(
    call: ServerUnaryCall<FindUserByEmailRequest, FindUserByEmailResponse>,
    callback: SendUnaryData<FindUserByEmailResponse>,
  ) {
    const { email } = call.request;
    this.userService
      .findUserByEmail({ email })
      .then((user) =>
        callback(null, {
          success: true,
          message: "User found successfully",
          user: user ? { ...user, role: this.mapRole(user.role) } : undefined,
        }),
      )
      .catch((err) => callback(toGrpcError(err), null));
  }

  updateUserPassword(
    call: ServerUnaryCall<UpdateUserPasswordRequest, UpdateUserPasswordResponse>,
    callback: SendUnaryData<UpdateUserPasswordResponse>,
  ) {
    const { userId, password } = call.request;
    this.userService
      .updateUserPassword({ userId, password })
      .then(() =>
        callback(null, {
          success: true,
          message: "User password updated successfully",
        }),
      )
      .catch((err) => callback(toGrpcError(err), null));
  }

  findUserById(
    call: ServerUnaryCall<FindUserByIdRequest, FindUserByIdResponse>,
    callback: SendUnaryData<FindUserByIdResponse>,
  ) {
    const { userId } = call.request;
    this.userService
      .findUserById(userId)
      .then((user) =>
        callback(null, {
          success: true,
          message: "User found successfully",
          user: user ? { ...user, role: this.mapRole(user.role) } : undefined,
        }),
      )
      .catch((err) => callback(toGrpcError(err), null));
  }

  private mapRole(role: "ADMIN" | "USER"): Role {
    // 1. If it's the string "ADMIN" or the gRPC-equivalent number/value
    if (role === "ADMIN") {
      // Check what your gRPC returns (usually 0 or 1)
      return 0;
    }

    // 2. If it's the string "USER" or the gRPC-equivalent number
    if (role === "USER") {
      return 1;
    }

    return 1;
  }
}
