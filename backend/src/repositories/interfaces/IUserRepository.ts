import { User } from '../../models/user';

export interface CreateUserDto {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  // Customer Information File (CIF) fields
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  dateOfBirth?: Date;
}

export interface IUserRepository {
  create(data: CreateUserDto): Promise<User>;
  findByEmail(email: string): Promise<(User & { password: string }) | null>;
  findById(id: string): Promise<User | null>;
  updatePassword(id: string, hashedPassword: string): Promise<void>;
}
