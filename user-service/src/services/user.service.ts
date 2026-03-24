import { UserEntity } from "../entity/user.entity";
import { NotFoundError, ValidationError } from "../../../utils/src/error.handling.middleware";
import { IUserRepository } from "../interface/IUser.repository";
import { logger } from "../../../utils/src";

export class UserService {
  private readonly userRepository: IUserRepository;
  constructor({ userRepository }: { userRepository: IUserRepository }) {
    this.userRepository = userRepository;
  }

  async findUserById(
    id: string,
    isGrpcCall: boolean,
  ): Promise<
    | (Omit<UserEntity, "password"> & {
        password?: string;
      })
    | undefined
  > {
    if (!id) throw new ValidationError("User id is required");

    const user = await this.userRepository.findById(id);
    if (!user) {
      if (isGrpcCall) return undefined;
      throw new NotFoundError("User not found, Please try again later");
    }

    if (!isGrpcCall) {
      const { password, ...safeUser } = user;
      return safeUser;
    }
    return user;
  }

  // USED IN GRPC
  async createUser(data: { name: string; email: string; password: string }): Promise<void> {
    const { email, password, name } = data;
    if (!email || !password || !name)
      throw new ValidationError("Email,password and name are required");
    await this.userRepository.create({ ...data });
  }

  // DO NOT USER THIS FN IN GRPC THROWING ERROR WHEN
  // USER NOT FOUND
  // USED IN GRPC
  async findUserByEmail(data: { email: string }): Promise<UserEntity | undefined> {
    const { email } = data;
    if (!email) throw new ValidationError("Email is required");
    logger.info(`Finding user by email ${email}`);
    const user = await this.userRepository.findOne({ email });
    return user ? user : undefined;
  }

  // USED IN GRPC
  async updateUserPassword(data: { userId: string; password: string }): Promise<void> {
    const { userId, password } = data;
    if (!userId || !password) throw new ValidationError("User id and password are required");
    await this.userRepository.update({ id: userId }, { password });
  }

  async updateUser(id: string, name: string): Promise<void> {
    if (!id || !name) throw new ValidationError("User id and name are required");
    await this.userRepository.update({ id }, { name });
  }
}
