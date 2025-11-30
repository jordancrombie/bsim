// User types
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  // Customer Information File (CIF) fields
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
  dateOfBirth?: string | null;
  createdAt: string;
  updatedAt: string;
}

// Account types
export enum AccountType {
  CHECKING = 'CHECKING',
  SAVINGS = 'SAVINGS',
  MONEY_MARKET = 'MONEY_MARKET',
  CERTIFICATE_OF_DEPOSIT = 'CERTIFICATE_OF_DEPOSIT',
}

export interface Account {
  id: string;
  accountNumber: string;
  accountType: AccountType;
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
  // Customer Information File (CIF) fields
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  dateOfBirth?: string;
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
export enum CreditCardType {
  VISA = 'VISA',
  VISA_DEBIT = 'VISA_DEBIT',
  MC = 'MC',
  MC_DEBIT = 'MC_DEBIT',
  AMEX = 'AMEX',
}

export interface CreditCard {
  id: string;
  cardNumber: string;
  cardType: CreditCardType;
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
  cardType?: CreditCardType;
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
