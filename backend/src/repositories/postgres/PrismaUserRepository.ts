import { PrismaClient } from '@prisma/client';
import { IUserRepository, CreateUserDto } from '../interfaces/IUserRepository';
import { User } from '../../models/user';

export class PrismaUserRepository implements IUserRepository {
  constructor(private prisma: PrismaClient) {}

  async create(data: CreateUserDto): Promise<User> {
    const user = await this.prisma.user.create({
      data: {
        email: data.email,
        password: data.password,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        address: data.address,
        city: data.city,
        state: data.state,
        postalCode: data.postalCode,
        country: data.country,
        dateOfBirth: data.dateOfBirth,
      },
    });

    return new User(
      user.id,
      user.email,
      user.firstName,
      user.lastName,
      user.createdAt,
      user.updatedAt,
      user.phone,
      user.address,
      user.city,
      user.state,
      user.postalCode,
      user.country,
      user.dateOfBirth
    );
  }

  async findByEmail(email: string): Promise<(User & { password: string }) | null> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) return null;

    const userInstance = new User(
      user.id,
      user.email,
      user.firstName,
      user.lastName,
      user.createdAt,
      user.updatedAt,
      user.phone,
      user.address,
      user.city,
      user.state,
      user.postalCode,
      user.country,
      user.dateOfBirth
    );

    return Object.assign(userInstance, { password: user.password });
  }

  async findById(id: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) return null;

    return new User(
      user.id,
      user.email,
      user.firstName,
      user.lastName,
      user.createdAt,
      user.updatedAt,
      user.phone,
      user.address,
      user.city,
      user.state,
      user.postalCode,
      user.country,
      user.dateOfBirth
    );
  }

  async updatePassword(id: string, hashedPassword: string): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { password: hashedPassword },
    });
  }
}
