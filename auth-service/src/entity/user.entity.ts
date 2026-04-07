export interface UserEntity {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "USER";
  password: string;
  createdAt?: Date | undefined;
  updatedAt?: Date | undefined;
}
