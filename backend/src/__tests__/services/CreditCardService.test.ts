import { CreditCardService } from '../../services/CreditCardService';
import { MockCreditCardRepository, MockCreditCardType } from '../mocks/MockCreditCardRepository';
import { MockCreditCardTransactionRepository } from '../mocks/MockCreditCardTransactionRepository';
import { CreditCardTransactionType } from '../../models/creditCardTransaction';

describe('CreditCardService', () => {
  let creditCardService: CreditCardService;
  let mockCreditCardRepository: MockCreditCardRepository;
  let mockTransactionRepository: MockCreditCardTransactionRepository;

  const testUserId = 'user-123';

  beforeEach(() => {
    mockCreditCardRepository = new MockCreditCardRepository();
    mockTransactionRepository = new MockCreditCardTransactionRepository();
    creditCardService = new CreditCardService(mockCreditCardRepository, mockTransactionRepository);
  });

  afterEach(() => {
    mockCreditCardRepository.clear();
    mockTransactionRepository.clear();
  });

  describe('createCreditCard', () => {
    it('should create a credit card with specified credit limit', async () => {
      const creditLimit = 5000;
      const card = await creditCardService.createCreditCard(testUserId, creditLimit);

      expect(card).toBeDefined();
      expect(card.userId).toBe(testUserId);
      expect(card.creditLimit).toBe(creditLimit);
      expect(card.availableCredit).toBe(creditLimit);
      expect(card.cardNumber).toBeDefined();
    });

    it('should generate valid card number', async () => {
      const card = await creditCardService.createCreditCard(testUserId, 5000);

      // Default is VISA, should start with 4
      expect(card.cardNumber.startsWith('4')).toBe(true);
      expect(card.cardNumber.length).toBe(16);
    });

    it('should create card with custom card holder name', async () => {
      const cardHolder = 'John Smith';
      const card = await creditCardService.createCreditCard(testUserId, 5000, cardHolder);

      expect(card.cardHolder).toBe(cardHolder);
    });

    it('should create card with specified card type', async () => {
      const card = await creditCardService.createCreditCard(
        testUserId,
        5000,
        undefined,
        MockCreditCardType.AMEX as any
      );

      expect(card.cardType).toBe(MockCreditCardType.AMEX);
      // AMEX cards start with 34 or 37
      expect(card.cardNumber.startsWith('34') || card.cardNumber.startsWith('37')).toBe(true);
    });

    it('should create initial transaction for card opening', async () => {
      await creditCardService.createCreditCard(testUserId, 5000);

      const transactions = mockTransactionRepository.getAllTransactions();
      expect(transactions.length).toBe(1);
      expect(transactions[0].type).toBe(CreditCardTransactionType.PAYMENT);
      expect(transactions[0].amount).toBe(0);
      expect(transactions[0].availableAfter).toBe(5000);
      expect(transactions[0].description).toBe('Credit card opened');
    });

    it('should throw error for non-positive credit limit', async () => {
      await expect(creditCardService.createCreditCard(testUserId, 0)).rejects.toThrow(
        'Credit limit must be positive'
      );

      await expect(creditCardService.createCreditCard(testUserId, -1000)).rejects.toThrow(
        'Credit limit must be positive'
      );
    });

    it('should set expiry date 3 years in the future', async () => {
      const card = await creditCardService.createCreditCard(testUserId, 5000);
      const now = new Date();
      const expectedYear = now.getFullYear() + 3;

      expect(card.expiryYear).toBe(expectedYear);
      expect(card.expiryMonth).toBeGreaterThanOrEqual(1);
      expect(card.expiryMonth).toBeLessThanOrEqual(12);
    });

    it('should generate CVV with correct length', async () => {
      // Regular card (VISA) should have 3-digit CVV
      const visaCard = await creditCardService.createCreditCard(testUserId, 5000);
      expect(visaCard.cvv.length).toBe(3);

      // AMEX should have 4-digit CVV
      const amexCard = await creditCardService.createCreditCard(
        testUserId,
        5000,
        undefined,
        MockCreditCardType.AMEX as any
      );
      expect(amexCard.cvv.length).toBe(4);
    });
  });

  describe('getCreditCardsByUserId', () => {
    it('should return empty array when user has no cards', async () => {
      const cards = await creditCardService.getCreditCardsByUserId(testUserId);

      expect(cards).toEqual([]);
    });

    it('should return all cards for a user', async () => {
      await creditCardService.createCreditCard(testUserId, 1000);
      await creditCardService.createCreditCard(testUserId, 2000);
      await creditCardService.createCreditCard(testUserId, 3000);

      const cards = await creditCardService.getCreditCardsByUserId(testUserId);

      expect(cards.length).toBe(3);
      expect(cards.map((c) => c.creditLimit).sort()).toEqual([1000, 2000, 3000]);
    });

    it('should not return cards from other users', async () => {
      await creditCardService.createCreditCard(testUserId, 1000);
      await creditCardService.createCreditCard('other-user', 2000);

      const cards = await creditCardService.getCreditCardsByUserId(testUserId);

      expect(cards.length).toBe(1);
      expect(cards[0].creditLimit).toBe(1000);
    });
  });

  describe('getCreditCardByNumber', () => {
    it('should return card when found', async () => {
      const created = await creditCardService.createCreditCard(testUserId, 5000);
      const found = await creditCardService.getCreditCardByNumber(created.cardNumber);

      expect(found).toBeDefined();
      expect(found!.id).toBe(created.id);
      expect(found!.creditLimit).toBe(5000);
    });

    it('should return null when card not found', async () => {
      const result = await creditCardService.getCreditCardByNumber('0000000000000000');

      expect(result).toBeNull();
    });
  });

  describe('charge', () => {
    it('should charge card and reduce available credit', async () => {
      const card = await creditCardService.createCreditCard(testUserId, 5000);

      const updated = await creditCardService.charge({
        cardNumber: card.cardNumber,
        amount: 1000,
      });

      expect(updated.availableCredit).toBe(4000);
    });

    it('should create charge transaction with merchant details', async () => {
      const card = await creditCardService.createCreditCard(testUserId, 5000);
      mockTransactionRepository.clear();

      await creditCardService.charge({
        cardNumber: card.cardNumber,
        amount: 100,
        description: 'Purchase',
        merchantName: 'Test Store',
        merchantId: 'MERCH123',
        mccCode: '5411',
      });

      const transactions = mockTransactionRepository.getAllTransactions();
      expect(transactions.length).toBe(1);
      expect(transactions[0].type).toBe(CreditCardTransactionType.CHARGE);
      expect(transactions[0].amount).toBe(100);
      expect(transactions[0].availableAfter).toBe(4900);
      expect(transactions[0].merchantName).toBe('Test Store');
      expect(transactions[0].merchantId).toBe('MERCH123');
      expect(transactions[0].mccCode).toBe('5411');
    });

    it('should throw error for non-positive amount', async () => {
      const card = await creditCardService.createCreditCard(testUserId, 5000);

      await expect(
        creditCardService.charge({
          cardNumber: card.cardNumber,
          amount: 0,
        })
      ).rejects.toThrow('Charge amount must be positive');

      await expect(
        creditCardService.charge({
          cardNumber: card.cardNumber,
          amount: -100,
        })
      ).rejects.toThrow('Charge amount must be positive');
    });

    it('should throw error for insufficient credit', async () => {
      const card = await creditCardService.createCreditCard(testUserId, 1000);

      await expect(
        creditCardService.charge({
          cardNumber: card.cardNumber,
          amount: 1500,
        })
      ).rejects.toThrow('Insufficient credit available');
    });

    it('should throw error for non-existent card', async () => {
      await expect(
        creditCardService.charge({
          cardNumber: '0000000000000000',
          amount: 100,
        })
      ).rejects.toThrow('Credit card not found');
    });

    it('should allow charging up to the full available credit', async () => {
      const card = await creditCardService.createCreditCard(testUserId, 1000);

      const updated = await creditCardService.charge({
        cardNumber: card.cardNumber,
        amount: 1000,
      });

      expect(updated.availableCredit).toBe(0);
    });

    it('should track multiple charges correctly', async () => {
      const card = await creditCardService.createCreditCard(testUserId, 5000);

      await creditCardService.charge({ cardNumber: card.cardNumber, amount: 1000 });
      await creditCardService.charge({ cardNumber: card.cardNumber, amount: 500 });
      const final = await creditCardService.charge({ cardNumber: card.cardNumber, amount: 250 });

      expect(final.availableCredit).toBe(3250);
    });
  });

  describe('payment', () => {
    it('should accept payment and increase available credit', async () => {
      const card = await creditCardService.createCreditCard(testUserId, 5000);

      // First charge to create a balance
      await creditCardService.charge({ cardNumber: card.cardNumber, amount: 2000 });

      // Make payment
      const updated = await creditCardService.payment({
        cardNumber: card.cardNumber,
        amount: 1000,
      });

      expect(updated.availableCredit).toBe(4000);
    });

    it('should create payment transaction', async () => {
      const card = await creditCardService.createCreditCard(testUserId, 5000);
      await creditCardService.charge({ cardNumber: card.cardNumber, amount: 2000 });
      mockTransactionRepository.clear();

      await creditCardService.payment({
        cardNumber: card.cardNumber,
        amount: 500,
        description: 'Monthly payment',
      });

      const transactions = mockTransactionRepository.getAllTransactions();
      expect(transactions.length).toBe(1);
      expect(transactions[0].type).toBe(CreditCardTransactionType.PAYMENT);
      expect(transactions[0].amount).toBe(500);
      expect(transactions[0].description).toBe('Monthly payment');
    });

    it('should throw error for non-positive amount', async () => {
      const card = await creditCardService.createCreditCard(testUserId, 5000);
      await creditCardService.charge({ cardNumber: card.cardNumber, amount: 1000 });

      await expect(
        creditCardService.payment({
          cardNumber: card.cardNumber,
          amount: 0,
        })
      ).rejects.toThrow('Payment amount must be positive');
    });

    it('should throw error when payment exceeds balance', async () => {
      const card = await creditCardService.createCreditCard(testUserId, 5000);
      await creditCardService.charge({ cardNumber: card.cardNumber, amount: 1000 });

      // Current balance is $1000, try to pay $2000
      await expect(
        creditCardService.payment({
          cardNumber: card.cardNumber,
          amount: 2000,
        })
      ).rejects.toThrow('Payment amount exceeds current balance');
    });

    it('should throw error for non-existent card', async () => {
      await expect(
        creditCardService.payment({
          cardNumber: '0000000000000000',
          amount: 100,
        })
      ).rejects.toThrow('Credit card not found');
    });

    it('should allow paying off full balance', async () => {
      const card = await creditCardService.createCreditCard(testUserId, 5000);
      await creditCardService.charge({ cardNumber: card.cardNumber, amount: 2000 });

      const updated = await creditCardService.payment({
        cardNumber: card.cardNumber,
        amount: 2000,
      });

      expect(updated.availableCredit).toBe(5000);
    });
  });

  describe('refund', () => {
    it('should process refund and increase available credit', async () => {
      const card = await creditCardService.createCreditCard(testUserId, 5000);
      await creditCardService.charge({ cardNumber: card.cardNumber, amount: 2000 });

      const updated = await creditCardService.refund({
        cardNumber: card.cardNumber,
        amount: 500,
      });

      expect(updated.availableCredit).toBe(3500);
    });

    it('should create refund transaction', async () => {
      const card = await creditCardService.createCreditCard(testUserId, 5000);
      await creditCardService.charge({ cardNumber: card.cardNumber, amount: 2000 });
      mockTransactionRepository.clear();

      await creditCardService.refund({
        cardNumber: card.cardNumber,
        amount: 300,
        description: 'Return item',
      });

      const transactions = mockTransactionRepository.getAllTransactions();
      expect(transactions.length).toBe(1);
      expect(transactions[0].type).toBe(CreditCardTransactionType.REFUND);
      expect(transactions[0].amount).toBe(300);
      expect(transactions[0].description).toBe('Return item');
    });

    it('should throw error for non-positive amount', async () => {
      const card = await creditCardService.createCreditCard(testUserId, 5000);

      await expect(
        creditCardService.refund({
          cardNumber: card.cardNumber,
          amount: 0,
        })
      ).rejects.toThrow('Refund amount must be positive');
    });

    it('should throw error when refund exceeds credit limit', async () => {
      const card = await creditCardService.createCreditCard(testUserId, 5000);

      // Card has full credit available, refund would exceed limit
      await expect(
        creditCardService.refund({
          cardNumber: card.cardNumber,
          amount: 100,
        })
      ).rejects.toThrow('Refund would exceed credit limit');
    });

    it('should throw error for non-existent card', async () => {
      await expect(
        creditCardService.refund({
          cardNumber: '0000000000000000',
          amount: 100,
        })
      ).rejects.toThrow('Credit card not found');
    });
  });

  describe('getTransactionHistory', () => {
    it('should return transaction history for card', async () => {
      const card = await creditCardService.createCreditCard(testUserId, 5000);
      await creditCardService.charge({ cardNumber: card.cardNumber, amount: 1000 });
      await creditCardService.charge({ cardNumber: card.cardNumber, amount: 500 });
      await creditCardService.payment({ cardNumber: card.cardNumber, amount: 300 });

      const history = await creditCardService.getTransactionHistory(card.cardNumber);

      // Initial "card opened" + 2 charges + 1 payment = 4 transactions
      expect(history.length).toBe(4);
    });

    it('should throw error for non-existent card', async () => {
      await expect(creditCardService.getTransactionHistory('0000000000000000')).rejects.toThrow(
        'Credit card not found'
      );
    });
  });
});
