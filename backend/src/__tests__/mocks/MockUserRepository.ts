import { IUserRepository, CreateUserDto } from '../../repositories/interfaces/IUserRepository';
import { User } from '../../models/user';

/**
 * Mock user data type - plain object representation
 */
interface MockUserData {
  id: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  dateOfBirth: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Creates a User instance from mock data
 */
function createUserFromData(data: MockUserData): User {
  return new User(
    data.id,
    data.email,
    data.firstName,
    data.lastName,
    data.createdAt,
    data.updatedAt,
    data.phone,
    data.address,
    data.city,
    data.state,
    data.postalCode,
    data.country,
    data.dateOfBirth
  );
}

/**
 * Mock user repository for testing
 * Stores users in memory and provides all IUserRepository methods
 */
export class MockUserRepository implements IUserRepository {
  private users: Map<string, MockUserData> = new Map();
  private emailIndex: Map<string, string> = new Map(); // email -> id

  constructor(initialUsers: Array<MockUserData> = []) {
    for (const user of initialUsers) {
      this.users.set(user.id, user);
      this.emailIndex.set(user.email, user.id);
    }
  }

  async create(data: CreateUserDto): Promise<User> {
    const id = `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();

    const userData: MockUserData = {
      id,
      email: data.email,
      password: data.password,
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone || null,
      address: data.address || null,
      city: data.city || null,
      state: data.state || null,
      postalCode: data.postalCode || null,
      country: data.country || null,
      dateOfBirth: data.dateOfBirth || null,
      createdAt: now,
      updatedAt: now,
    };

    this.users.set(id, userData);
    this.emailIndex.set(data.email, id);

    return createUserFromData(userData);
  }

  async findByEmail(email: string): Promise<(User & { password: string }) | null> {
    const id = this.emailIndex.get(email);
    if (!id) return null;
    const userData = this.users.get(id);
    if (!userData) return null;

    const user = createUserFromData(userData);
    return Object.assign(user, { password: userData.password });
  }

  async findById(id: string): Promise<User | null> {
    const userData = this.users.get(id);
    if (!userData) return null;
    return createUserFromData(userData);
  }

  async updatePassword(id: string, hashedPassword: string): Promise<void> {
    const userData = this.users.get(id);
    if (userData) {
      userData.password = hashedPassword;
      userData.updatedAt = new Date();
      this.users.set(id, userData);
    }
  }

  // Helper methods for testing
  clear(): void {
    this.users.clear();
    this.emailIndex.clear();
  }

  getUserCount(): number {
    return this.users.size;
  }

  getAllUsers(): Array<MockUserData> {
    return Array.from(this.users.values());
  }
}
