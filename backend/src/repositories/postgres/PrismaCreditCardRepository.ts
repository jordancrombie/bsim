import { PrismaClient, CreditCardType } from '@prisma/client';
import { ICreditCardRepository, CreateCreditCardDto, CreditCardData } from '../interfaces/ICreditCardRepository';

export class PrismaCreditCardRepository implements ICreditCardRepository {
  constructor(private prisma: PrismaClient) {}

  async create(data: CreateCreditCardDto): Promise<CreditCardData> {
    const cardType = data.cardType || CreditCardType.VISA;
    const cardNumber = this.generateCardNumber(cardType);
    const cvv = this.generateCVV(cardType);
    const expiryDate = this.generateExpiryDate();

    // Get card holder name from user if not provided
    let cardHolder = data.cardHolder;
    if (!cardHolder) {
      const user = await this.prisma.user.findUnique({
        where: { id: data.userId },
        select: { firstName: true, lastName: true },
      });
      cardHolder = user ? `${user.firstName} ${user.lastName}` : 'Card Holder';
    }

    const creditCard = await this.prisma.creditCard.create({
      data: {
        cardNumber,
        cardType,
        cardHolder,
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
      cardType: creditCard.cardType,
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
      cardType: creditCard.cardType,
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
      cardType: creditCard.cardType,
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
      cardType: creditCard.cardType,
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

  private generateCardNumber(cardType: CreditCardType): string {
    // Generate card number based on card type
    // VISA: starts with 4 (16 digits)
    // Mastercard: starts with 51-55 or 2221-2720 (16 digits)
    // AMEX: starts with 34 or 37 (15 digits)
    let prefix: string;
    let length: number;

    switch (cardType) {
      case CreditCardType.VISA:
      case CreditCardType.VISA_DEBIT:
        prefix = '4';
        length = 16;
        break;
      case CreditCardType.MC:
      case CreditCardType.MC_DEBIT:
        // Use 51-55 range for Mastercard
        prefix = '5' + Math.floor(1 + Math.random() * 5).toString();
        length = 16;
        break;
      case CreditCardType.AMEX:
        // AMEX uses 34 or 37
        prefix = Math.random() < 0.5 ? '34' : '37';
        length = 15;
        break;
      default:
        prefix = '4';
        length = 16;
    }

    const remainingDigits = length - prefix.length;
    const digits = Array.from({ length: remainingDigits }, () => Math.floor(Math.random() * 10)).join('');
    return prefix + digits;
  }

  private generateCVV(cardType: CreditCardType): string {
    // AMEX uses 4-digit CVV, others use 3-digit
    if (cardType === CreditCardType.AMEX) {
      return Math.floor(1000 + Math.random() * 9000).toString();
    }
    return Math.floor(100 + Math.random() * 900).toString();
  }

  private generateExpiryDate(): { month: number; year: number } {
    const now = new Date();
    const year = now.getFullYear() + 3; // Card expires in 3 years
    const month = now.getMonth() + 1; // 1-12
    return { month, year };
  }
}
