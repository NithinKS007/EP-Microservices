import { UserService } from "services/user.service";
import { AuthReq, sendResponse, StatusCodes, validateDto } from "../../../utils/src";
import { Request, Response } from "express";
import {
  FindUserByIdRequestDto,
  UpdateSystemRoleRequestDto,
  UpdateUserRequestDto,
} from "./../dtos/user.dto";
import { envConfig } from "./../config/env.config";

export class UserController {
  private readonly userService: UserService;
  constructor({ userService }: { userService: UserService }) {
    this.userService = userService;
  }

  async findUserById(req: AuthReq, res: Response): Promise<void> {
    const data = await validateDto(FindUserByIdRequestDto, req.params);
    const { id } = data;
    const result = await this.userService.findUserByIdOrThrow(id);
    sendResponse(res, StatusCodes.OK, result, "User found successfully");
  }

  async updateUser(req: AuthReq, res: Response): Promise<void> {
    const data = await validateDto(UpdateUserRequestDto, { ...req.body, id: req?.user?.id });
    const { id, name } = data;
    await this.userService.updateUser(id, name);
    sendResponse(res, StatusCodes.OK, null, "User updated successfully");
  }

  async updateRole(req: AuthReq, res: Response): Promise<void> {
    const data = await validateDto(UpdateSystemRoleRequestDto, { ...req.body });
    if (data.systemCode !== envConfig.SYSTEM_CODE) {
      sendResponse(res, StatusCodes.Unauthorized, null, "Unauthorized");
      return;
    }
    if (req.user?.id === data.id) {
      sendResponse(res, StatusCodes.BadRequest, null, "You cannot update your own role");
      return;
    }
    const { id, role } = data;
    await this.userService.updateUserRole(id, role);
    sendResponse(res, StatusCodes.OK, null, "Role updated successfully");
  }
}
