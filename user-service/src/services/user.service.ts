import { UserEntity } from "../entity/user.entity";
import { NotFoundError, ValidationError } from "../../../utils/src/error.handling.middleware";
import { IUserRepository } from "../interface/IUser.repository";
import { logger } from "../../../utils/src";

export class UserService {
  private readonly userRepository: IUserRepository;
  constructor({ userRepository }: { userRepository: IUserRepository }) {
    this.userRepository = userRepository;
  }

  /**
   * Finds a user by id and removes password before returning.
   * Used in: User profile read flow
   * Triggered via: REST
   */
  async findUserByIdOrThrow(id: string): Promise<
    | (Omit<UserEntity, "password"> & {
        password?: string;
      })
    | undefined
  > {
    if (!id) throw new ValidationError("User id is required");

    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new NotFoundError("User not found, Please try again later");
    }

    const { password, ...safeUser } = user;
    logger.info(`Finding user by id ${id}`);
    logger.info(`user in findUserByIdOrThrow user service => ${JSON.stringify(safeUser)}`);
    return safeUser;
  }

  /**
   * Finds a user by id including password for internal flows.
   * Used in: Auth and password flows
   * Triggered via: gRPC
   */
  async findUserById(id: string): Promise<UserEntity | undefined> {
    if (!id) throw new ValidationError("User id is required");
    const user = await this.userRepository.findById(id);
    if (user) {
      const { password, ...safeUser } = user;
      logger.info(`Finding user by id ${id}`);
      logger.info(`user in findUserById user service => ${JSON.stringify(safeUser)}`);
    }
    return user ? user : undefined;
  }

  /**
   * Creates a new user record.
   * Used in: Auth signup flow
   * Triggered via: gRPC
   */
  async createUser(data: { name: string; email: string; password: string }): Promise<void> {
    const { email, password, name } = data;
    if (!email || !password || !name)
      throw new ValidationError("Email,password and name are required");
    await this.userRepository.create({ ...data });
  }

  /**
   * Finds a user by email without throwing when not found.
   * Used in: Auth signup/signin and password reset flows
   * Triggered via: gRPC
   */
  async findUserByEmail(data: { email: string }): Promise<UserEntity | undefined> {
    const { email } = data;
    if (!email) throw new ValidationError("Email is required");
    const user = await this.userRepository.findByEmail(email);
    if (user) {
      const { password, ...safeUser } = user;
      logger.info(`Finding user by email ${email}`);
      logger.info(`user in findUserByEmail user service => ${JSON.stringify(safeUser)}`);
    }
    return user ? user : undefined;
  }

  /**
   * Updates the password field for one user.
   * Used in: Password reset/change flows
   * Triggered via: gRPC
   */
  async updateUserPassword(data: { userId: string; password: string }): Promise<void> {
    const { userId, password } = data;
    if (!userId || !password) throw new ValidationError("User id and password are required");
    await this.userRepository.update({ id: userId }, { password });
  }

  /**
   * Updates the display name of a user.
   * Used in: User profile update flow
   * Triggered via: REST
   */
  async updateUser(id: string, name: string): Promise<void> {
    if (!id || !name) throw new ValidationError("User id and name are required");
    await this.userRepository.update({ id }, { name });
  }

  /**
   * Updates the role for a user.
   * Used in: Admin user-management flow
   * Triggered via: REST
   */
  async updateUserRole(id: string, role: "USER" | "ADMIN"): Promise<void> {
    if (!id || !role) throw new ValidationError("User id and role are required");
    await this.userRepository.update({ id }, { role });
  }

  async findUsers(data: {
    limit: number;
    page: number;
  }): Promise<{ data: UserEntity[]; meta: { total: number; page: number; limit: number } }> {
    const { limit, page } = data;
    if (!limit || !page) throw new ValidationError("Limit and page are required");
    return await this.userRepository.findUsersWithPagination({ limit, page });
  }
}
