import { CreditCardTransactionType } from '../../models/creditCardTransaction';

export interface CreateCreditCardTransactionDto {
  type: CreditCardTransactionType;
  amount: number;
  availableAfter: number;
  description?: string;
  // Merchant details
  merchantName?: string;
  merchantId?: string;
  mccCode?: string;
  transactionDate?: Date;
  creditCardId: string;
}

export interface CreditCardTransactionData {
  id: string;
  type: CreditCardTransactionType;
  amount: number;
  availableAfter: number;
  description?: string;
  // Merchant details
  merchantName?: string | null;
  merchantId?: string | null;
  mccCode?: string | null;
  transactionDate: Date;
  creditCardId: string;
  createdAt: Date;
}

export interface ICreditCardTransactionRepository {
  create(data: CreateCreditCardTransactionDto): Promise<CreditCardTransactionData>;
  findByCreditCardId(creditCardId: string): Promise<CreditCardTransactionData[]>;
  findById(id: string): Promise<CreditCardTransactionData | null>;
}
