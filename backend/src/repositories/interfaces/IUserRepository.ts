import { User } from '../../models/user';

export interface CreateUserDto {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface IUserRepository {
  create(data: CreateUserDto): Promise<User>;
  findByEmail(email: string): Promise<(User & { password: string }) | null>;
  findById(id: string): Promise<User | null>;
  updatePassword(id: string, hashedPassword: string): Promise<void>;
}
