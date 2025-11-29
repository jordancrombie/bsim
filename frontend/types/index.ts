// User types
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  createdAt: string;
  updatedAt: string;
}

// Account types
export interface Account {
  id: string;
  accountNumber: string;
  balance: number;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

// Transaction types
export enum TransactionType {
  DEPOSIT = 'DEPOSIT',
  WITHDRAWAL = 'WITHDRAWAL',
  TRANSFER = 'TRANSFER',
}

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  balanceAfter: number;
  description?: string;
  accountId: string;
  createdAt: string;
}

// API Request types
export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface CreateAccountRequest {
  initialBalance?: number;
}

export interface DepositRequest {
  accountNumber: string;
  amount: number;
  description?: string;
}

export interface WithdrawRequest {
  accountNumber: string;
  amount: number;
  description?: string;
}

export interface TransferRequest {
  fromAccountNumber: string;
  toAccountNumber: string;
  amount: number;
  description?: string;
}

// API Response types
export interface AuthResponse {
  user: User;
  token: string;
}

export interface AccountResponse {
  account: Account;
}

export interface AccountsResponse {
  accounts: Account[];
}

export interface TransactionsResponse {
  transactions: Transaction[];
}

export interface ErrorResponse {
  error: string;
}

// Credit Card types
export interface CreditCard {
  id: string;
  cardNumber: string;
  cardHolder: string;
  expiryMonth: number;
  expiryYear: number;
  cvv: string;
  creditLimit: number;
  availableCredit: number;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

// Credit Card Transaction types
export enum CreditCardTransactionType {
  CHARGE = 'CHARGE',
  PAYMENT = 'PAYMENT',
  REFUND = 'REFUND',
}

export interface CreditCardTransaction {
  id: string;
  type: CreditCardTransactionType;
  amount: number;
  availableAfter: number;
  description?: string;
  creditCardId: string;
  createdAt: string;
}

// Credit Card API Request types
export interface CreateCreditCardRequest {
  creditLimit: number;
  cardHolder?: string;
}

export interface ChargeRequest {
  cardNumber: string;
  amount: number;
  description?: string;
}

export interface PaymentRequest {
  cardNumber: string;
  amount: number;
  description?: string;
}

export interface RefundRequest {
  cardNumber: string;
  amount: number;
  description?: string;
}

// Credit Card API Response types
export interface CreditCardResponse {
  creditCard: CreditCard;
}

export interface CreditCardsResponse {
  creditCards: CreditCard[];
}

export interface CreditCardTransactionsResponse {
  transactions: CreditCardTransaction[];
}
