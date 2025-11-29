export interface CreateCreditCardDto {
  userId: string;
  creditLimit: number;
  cardHolder?: string;
}

export interface CreditCardData {
  id: string;
  cardNumber: string;
  cardHolder: string;
  expiryMonth: number;
  expiryYear: number;
  cvv: string;
  creditLimit: number;
  availableCredit: number;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICreditCardRepository {
  create(data: CreateCreditCardDto): Promise<CreditCardData>;
  findByCardNumber(cardNumber: string): Promise<CreditCardData | null>;
  findByUserId(userId: string): Promise<CreditCardData[]>;
  findById(id: string): Promise<CreditCardData | null>;
  updateAvailableCredit(id: string, newAvailableCredit: number): Promise<void>;
}
