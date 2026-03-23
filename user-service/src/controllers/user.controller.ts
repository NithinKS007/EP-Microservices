import { UserService } from "services/user.service";
import { AuthReq, sendResponse, StatusCodes, validateDto } from "../../../utils/src";
import { Request, Response } from "express";
import { FindUserByIdRequestDto, UpdateUserRequestDto } from "./../dtos/user.dto";

export class UserController {
  private readonly userService: UserService;
  constructor({ userService }: { userService: UserService }) {
    this.userService = userService;
  }

  async findUserById(req: AuthReq, res: Response): Promise<void> {
    const data = await validateDto(FindUserByIdRequestDto, req.params);
    const { id } = data;
    const result = await this.userService.findUserById(id, false);
    sendResponse(res, StatusCodes.OK, result, "User found successfully");
  }

  async updateUser(req: AuthReq, res: Response): Promise<void> {
    const data = await validateDto(UpdateUserRequestDto, { ...req.body, id: req?.user?.id });
    const { id, name } = data;
    await this.userService.updateUser(id, name);
    sendResponse(res, StatusCodes.OK, null, "User updated successfully");
  }
}
