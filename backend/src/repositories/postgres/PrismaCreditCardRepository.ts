import { PrismaClient } from '@prisma/client';
import { ICreditCardRepository, CreateCreditCardDto, CreditCardData } from '../interfaces/ICreditCardRepository';

export class PrismaCreditCardRepository implements ICreditCardRepository {
  constructor(private prisma: PrismaClient) {}

  async create(data: CreateCreditCardDto): Promise<CreditCardData> {
    const cardNumber = this.generateCardNumber();
    const cvv = this.generateCVV();
    const expiryDate = this.generateExpiryDate();

    const creditCard = await this.prisma.creditCard.create({
      data: {
        cardNumber,
        cardHolder: data.cardHolder || 'Card Holder',
        expiryMonth: expiryDate.month,
        expiryYear: expiryDate.year,
        cvv,
        creditLimit: data.creditLimit,
        availableCredit: data.creditLimit, // Start with full credit available
        userId: data.userId,
      },
    });

    return {
      id: creditCard.id,
      cardNumber: creditCard.cardNumber,
      cardHolder: creditCard.cardHolder,
      expiryMonth: creditCard.expiryMonth,
      expiryYear: creditCard.expiryYear,
      cvv: creditCard.cvv,
      creditLimit: Number(creditCard.creditLimit),
      availableCredit: Number(creditCard.availableCredit),
      userId: creditCard.userId,
      createdAt: creditCard.createdAt,
      updatedAt: creditCard.updatedAt,
    };
  }

  async findByCardNumber(cardNumber: string): Promise<CreditCardData | null> {
    const creditCard = await this.prisma.creditCard.findUnique({
      where: { cardNumber },
    });

    if (!creditCard) return null;

    return {
      id: creditCard.id,
      cardNumber: creditCard.cardNumber,
      cardHolder: creditCard.cardHolder,
      expiryMonth: creditCard.expiryMonth,
      expiryYear: creditCard.expiryYear,
      cvv: creditCard.cvv,
      creditLimit: Number(creditCard.creditLimit),
      availableCredit: Number(creditCard.availableCredit),
      userId: creditCard.userId,
      createdAt: creditCard.createdAt,
      updatedAt: creditCard.updatedAt,
    };
  }

  async findByUserId(userId: string): Promise<CreditCardData[]> {
    const creditCards = await this.prisma.creditCard.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return creditCards.map((creditCard) => ({
      id: creditCard.id,
      cardNumber: creditCard.cardNumber,
      cardHolder: creditCard.cardHolder,
      expiryMonth: creditCard.expiryMonth,
      expiryYear: creditCard.expiryYear,
      cvv: creditCard.cvv,
      creditLimit: Number(creditCard.creditLimit),
      availableCredit: Number(creditCard.availableCredit),
      userId: creditCard.userId,
      createdAt: creditCard.createdAt,
      updatedAt: creditCard.updatedAt,
    }));
  }

  async findById(id: string): Promise<CreditCardData | null> {
    const creditCard = await this.prisma.creditCard.findUnique({
      where: { id },
    });

    if (!creditCard) return null;

    return {
      id: creditCard.id,
      cardNumber: creditCard.cardNumber,
      cardHolder: creditCard.cardHolder,
      expiryMonth: creditCard.expiryMonth,
      expiryYear: creditCard.expiryYear,
      cvv: creditCard.cvv,
      creditLimit: Number(creditCard.creditLimit),
      availableCredit: Number(creditCard.availableCredit),
      userId: creditCard.userId,
      createdAt: creditCard.createdAt,
      updatedAt: creditCard.updatedAt,
    };
  }

  async updateAvailableCredit(id: string, newAvailableCredit: number): Promise<void> {
    await this.prisma.creditCard.update({
      where: { id },
      data: { availableCredit: newAvailableCredit },
    });
  }

  private generateCardNumber(): string {
    // Generate a 16-digit card number (starting with 4 for Visa)
    const prefix = '4';
    const digits = Array.from({ length: 15 }, () => Math.floor(Math.random() * 10)).join('');
    return prefix + digits;
  }

  private generateCVV(): string {
    return Math.floor(100 + Math.random() * 900).toString();
  }

  private generateExpiryDate(): { month: number; year: number } {
    const now = new Date();
    const year = now.getFullYear() + 3; // Card expires in 3 years
    const month = now.getMonth() + 1; // 1-12
    return { month, year };
  }
}
