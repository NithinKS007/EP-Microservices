import { GrpcHandler } from "../../../utils/src/index";

import { container } from "../container";
import { UserGrpcController } from "./user.server";
const controller = container.resolve<UserGrpcController>("userGrpcController");

export const handlers: GrpcHandler = {
  createUser: controller.createUser.bind(controller),
  findUserByEmail: controller.findUserByEmail.bind(controller),
  updateUserPassword: controller.updateUserPassword.bind(controller),
  findUserById: controller.findUserById.bind(controller),
};
