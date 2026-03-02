import { UserEntity } from "../entity/user.entity";
import { comparePassword, hashPassword } from "../../../utils/src";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from "../../../utils/src/error.handling.middleware";
import { IUserRepository } from "../interface/IUser.repository";

export class UserService {
  private readonly userRepository: IUserRepository;
  constructor({ userRepository }: { userRepository: IUserRepository }) {
    this.userRepository = userRepository;
  }

  async findUserById(id: string): Promise<UserEntity> {
    if (!id) throw new ValidationError("User id is required");
    const user = await this.userRepository.findById(id);

    if (!user) throw new NotFoundError("User not found,Please try again later");

    const role = this.mapRole(user.role);
    return { ...user, role };
  }

  async signup(data: { name: string; email: string; password: string }): Promise<void> {
    const { email, password, name } = data;
    if (!email || !password || !name)
      throw new ValidationError("Email,password and name are required");
    const userData = await this.userRepository.findOne({ email });
    if (userData) throw new ConflictError("Email already exists");
    await this.userRepository.create({ ...data, password: await hashPassword(password) });
  }

  async signin(data: { email: string; password: string }): Promise<UserEntity> {
    const { email, password } = data;
    if (!email || !password) throw new ValidationError("Email and password are required");
    const userData = await this.userRepository.findOne({ email });

    if (!userData) throw new NotFoundError("User not found,Please try again later");

    const isPasswordValid = await comparePassword(data.password, userData.password);
    if (!isPasswordValid) throw new ValidationError("Password is incorrect");

    const { password: userPassword, ...safeUser } = userData;

    const role = this.mapRole(userData.role);

    return { ...safeUser, role };
  }

  private mapRole(role: "admin" | "user" | null): "admin" | "user" | undefined {
    if (role === "admin" || role === "user") {
      return role;
    }
    return undefined;
  }
}
