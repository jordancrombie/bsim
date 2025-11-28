/**
 * User domain model
 */
export class User {
  constructor(
    public readonly id: string,
    public readonly email: string,
    public readonly firstName: string,
    public readonly lastName: string,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}

  getFullName(): string {
    return `${this.firstName} ${this.lastName}`;
  }
}

/**
 * User with password (for authentication)
 */
export interface UserWithPassword extends User {
  password: string;
}
