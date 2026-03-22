export interface UserEntity {
  id: string;
  name: string;
  email: string;
  role?: "ADMIN" | "USER" | undefined;
  createdAt?: Date | undefined;
  updatedAt?: Date | undefined;
}
