import { CreditCardTransactionType } from '../../models/creditCardTransaction';

export interface CreateCreditCardTransactionDto {
  type: CreditCardTransactionType;
  amount: number;
  availableAfter: number;
  description?: string;
  creditCardId: string;
}

export interface CreditCardTransactionData {
  id: string;
  type: CreditCardTransactionType;
  amount: number;
  availableAfter: number;
  description?: string;
  creditCardId: string;
  createdAt: Date;
}

export interface ICreditCardTransactionRepository {
  create(data: CreateCreditCardTransactionDto): Promise<CreditCardTransactionData>;
  findByCreditCardId(creditCardId: string): Promise<CreditCardTransactionData[]>;
  findById(id: string): Promise<CreditCardTransactionData | null>;
}
