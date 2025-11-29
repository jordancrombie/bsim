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
    public readonly updatedAt: Date,
    // Customer Information File (CIF) fields
    public readonly phone?: string | null,
    public readonly address?: string | null,
    public readonly city?: string | null,
    public readonly state?: string | null,
    public readonly postalCode?: string | null,
    public readonly country?: string | null,
    public readonly dateOfBirth?: Date | null
  ) {}

  getFullName(): string {
    return `${this.firstName} ${this.lastName}`;
  }

  getFormattedAddress(): string | null {
    if (!this.address) return null;
    const parts = [this.address, this.city, this.state, this.postalCode, this.country].filter(Boolean);
    return parts.join(', ');
  }
}

/**
 * User with password (for authentication)
 */
export interface UserWithPassword extends User {
  password: string;
}
