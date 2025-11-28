export interface CreateAccountDto {
  userId: string;
  initialBalance?: number;
}

export interface AccountData {
  id: string;
  accountNumber: string;
  balance: number;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IAccountRepository {
  create(data: CreateAccountDto): Promise<AccountData>;
  findByAccountNumber(accountNumber: string): Promise<AccountData | null>;
  findByUserId(userId: string): Promise<AccountData[]>;
  findById(id: string): Promise<AccountData | null>;
  updateBalance(id: string, newBalance: number): Promise<void>;
}
