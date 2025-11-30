import {
  ICreditCardRepository,
  CreateCreditCardDto,
  CreditCardData,
} from '../../repositories/interfaces/ICreditCardRepository';

// Define CreditCardType locally since we can't import from @prisma/client in tests
export enum MockCreditCardType {
  VISA = 'VISA',
  VISA_DEBIT = 'VISA_DEBIT',
  MC = 'MC',
  MC_DEBIT = 'MC_DEBIT',
  AMEX = 'AMEX',
}

/**
 * Mock credit card repository for testing
 * Stores credit cards in memory and provides all ICreditCardRepository methods
 */
export class MockCreditCardRepository implements ICreditCardRepository {
  private creditCards: Map<string, CreditCardData> = new Map();
  private cardNumberIndex: Map<string, string> = new Map(); // cardNumber -> id
  private userCardsIndex: Map<string, string[]> = new Map(); // userId -> cardIds[]

  constructor(initialCards: Array<CreditCardData> = []) {
    for (const card of initialCards) {
      this.creditCards.set(card.id, card);
      this.cardNumberIndex.set(card.cardNumber, card.id);

      const userCards = this.userCardsIndex.get(card.userId) || [];
      userCards.push(card.id);
      this.userCardsIndex.set(card.userId, userCards);
    }
  }

  async create(data: CreateCreditCardDto): Promise<CreditCardData> {
    const id = `card-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const cardNumber = this.generateCardNumber(data.cardType as unknown as MockCreditCardType);
    const now = new Date();
    const expiryDate = new Date();
    expiryDate.setFullYear(expiryDate.getFullYear() + 3);

    const creditCard: CreditCardData = {
      id,
      cardNumber,
      cardType: data.cardType || (MockCreditCardType.VISA as any),
      cardHolder: data.cardHolder || 'Card Holder',
      expiryMonth: expiryDate.getMonth() + 1,
      expiryYear: expiryDate.getFullYear(),
      cvv: this.generateCVV(data.cardType as unknown as MockCreditCardType),
      creditLimit: data.creditLimit,
      availableCredit: data.creditLimit,
      userId: data.userId,
      createdAt: now,
      updatedAt: now,
    };

    this.creditCards.set(id, creditCard);
    this.cardNumberIndex.set(cardNumber, id);

    const userCards = this.userCardsIndex.get(data.userId) || [];
    userCards.push(id);
    this.userCardsIndex.set(data.userId, userCards);

    return creditCard;
  }

  async findByCardNumber(cardNumber: string): Promise<CreditCardData | null> {
    const id = this.cardNumberIndex.get(cardNumber);
    if (!id) return null;
    return this.creditCards.get(id) || null;
  }

  async findByUserId(userId: string): Promise<CreditCardData[]> {
    const cardIds = this.userCardsIndex.get(userId) || [];
    return cardIds
      .map((id) => this.creditCards.get(id))
      .filter((card): card is CreditCardData => card !== undefined);
  }

  async findById(id: string): Promise<CreditCardData | null> {
    return this.creditCards.get(id) || null;
  }

  async updateAvailableCredit(id: string, newAvailableCredit: number): Promise<void> {
    const card = this.creditCards.get(id);
    if (card) {
      card.availableCredit = newAvailableCredit;
      card.updatedAt = new Date();
      this.creditCards.set(id, card);
    }
  }

  // Helper methods for testing
  private generateCardNumber(cardType?: MockCreditCardType): string {
    let prefix: string;
    switch (cardType) {
      case MockCreditCardType.AMEX:
        prefix = '34';
        break;
      case MockCreditCardType.MC:
      case MockCreditCardType.MC_DEBIT:
        prefix = '51';
        break;
      case MockCreditCardType.VISA:
      case MockCreditCardType.VISA_DEBIT:
      default:
        prefix = '4';
        break;
    }

    const length = cardType === MockCreditCardType.AMEX ? 15 : 16;
    const remaining = length - prefix.length;
    let number = prefix;
    for (let i = 0; i < remaining; i++) {
      number += Math.floor(Math.random() * 10);
    }
    return number;
  }

  private generateCVV(cardType?: MockCreditCardType): string {
    const length = cardType === MockCreditCardType.AMEX ? 4 : 3;
    let cvv = '';
    for (let i = 0; i < length; i++) {
      cvv += Math.floor(Math.random() * 10);
    }
    return cvv;
  }

  clear(): void {
    this.creditCards.clear();
    this.cardNumberIndex.clear();
    this.userCardsIndex.clear();
  }

  getCardCount(): number {
    return this.creditCards.size;
  }

  getAllCards(): Array<CreditCardData> {
    return Array.from(this.creditCards.values());
  }
}
