import { ICreditCardRepository, CreditCardData } from '../repositories/interfaces/ICreditCardRepository';
import { ICreditCardTransactionRepository } from '../repositories/interfaces/ICreditCardTransactionRepository';
import { CreditCardTransactionType } from '../models/creditCardTransaction';

export interface ChargeDto {
  cardNumber: string;
  amount: number;
  description?: string;
}

export interface PaymentDto {
  cardNumber: string;
  amount: number;
  description?: string;
}

export interface RefundDto {
  cardNumber: string;
  amount: number;
  description?: string;
}

export class CreditCardService {
  constructor(
    private creditCardRepository: ICreditCardRepository,
    private creditCardTransactionRepository: ICreditCardTransactionRepository
  ) {}

  async createCreditCard(userId: string, creditLimit: number, cardHolder?: string): Promise<CreditCardData> {
    if (creditLimit <= 0) {
      throw new Error('Credit limit must be positive');
    }

    const creditCard = await this.creditCardRepository.create({ userId, creditLimit, cardHolder });

    // Create initial transaction to record the credit limit establishment
    await this.creditCardTransactionRepository.create({
      type: CreditCardTransactionType.PAYMENT,
      amount: 0,
      availableAfter: creditLimit,
      description: 'Credit card opened',
      creditCardId: creditCard.id,
    });

    return creditCard;
  }

  async getCreditCardsByUserId(userId: string): Promise<CreditCardData[]> {
    return this.creditCardRepository.findByUserId(userId);
  }

  async getCreditCardByNumber(cardNumber: string): Promise<CreditCardData | null> {
    return this.creditCardRepository.findByCardNumber(cardNumber);
  }

  async charge(data: ChargeDto): Promise<CreditCardData> {
    if (data.amount <= 0) {
      throw new Error('Charge amount must be positive');
    }

    const creditCard = await this.creditCardRepository.findByCardNumber(data.cardNumber);
    if (!creditCard) {
      throw new Error('Credit card not found');
    }

    if (data.amount > creditCard.availableCredit) {
      throw new Error('Insufficient credit available');
    }

    const newAvailableCredit = creditCard.availableCredit - data.amount;

    await this.creditCardRepository.updateAvailableCredit(creditCard.id, newAvailableCredit);
    await this.creditCardTransactionRepository.create({
      type: CreditCardTransactionType.CHARGE,
      amount: data.amount,
      availableAfter: newAvailableCredit,
      description: data.description,
      creditCardId: creditCard.id,
    });

    return { ...creditCard, availableCredit: newAvailableCredit };
  }

  async payment(data: PaymentDto): Promise<CreditCardData> {
    if (data.amount <= 0) {
      throw new Error('Payment amount must be positive');
    }

    const creditCard = await this.creditCardRepository.findByCardNumber(data.cardNumber);
    if (!creditCard) {
      throw new Error('Credit card not found');
    }

    const currentBalance = creditCard.creditLimit - creditCard.availableCredit;
    if (data.amount > currentBalance) {
      throw new Error('Payment amount exceeds current balance');
    }

    const newAvailableCredit = creditCard.availableCredit + data.amount;

    // Ensure available credit doesn't exceed the credit limit
    if (newAvailableCredit > creditCard.creditLimit) {
      throw new Error('Payment would exceed credit limit');
    }

    await this.creditCardRepository.updateAvailableCredit(creditCard.id, newAvailableCredit);
    await this.creditCardTransactionRepository.create({
      type: CreditCardTransactionType.PAYMENT,
      amount: data.amount,
      availableAfter: newAvailableCredit,
      description: data.description,
      creditCardId: creditCard.id,
    });

    return { ...creditCard, availableCredit: newAvailableCredit };
  }

  async refund(data: RefundDto): Promise<CreditCardData> {
    if (data.amount <= 0) {
      throw new Error('Refund amount must be positive');
    }

    const creditCard = await this.creditCardRepository.findByCardNumber(data.cardNumber);
    if (!creditCard) {
      throw new Error('Credit card not found');
    }

    const newAvailableCredit = creditCard.availableCredit + data.amount;

    // Ensure available credit doesn't exceed the credit limit
    if (newAvailableCredit > creditCard.creditLimit) {
      throw new Error('Refund would exceed credit limit');
    }

    await this.creditCardRepository.updateAvailableCredit(creditCard.id, newAvailableCredit);
    await this.creditCardTransactionRepository.create({
      type: CreditCardTransactionType.REFUND,
      amount: data.amount,
      availableAfter: newAvailableCredit,
      description: data.description,
      creditCardId: creditCard.id,
    });

    return { ...creditCard, availableCredit: newAvailableCredit };
  }

  async getTransactionHistory(cardNumber: string) {
    const creditCard = await this.creditCardRepository.findByCardNumber(cardNumber);
    if (!creditCard) {
      throw new Error('Credit card not found');
    }

    return this.creditCardTransactionRepository.findByCreditCardId(creditCard.id);
  }
}
