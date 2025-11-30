import { Response, NextFunction } from 'express';
import { CreditCardController } from '../../controllers/creditCardController';
import { CreditCardService } from '../../services/CreditCardService';
import { MockCreditCardRepository, MockCreditCardType } from '../mocks/MockCreditCardRepository';
import { MockCreditCardTransactionRepository } from '../mocks/MockCreditCardTransactionRepository';
import { AuthRequest } from '../../middleware/auth';

describe('CreditCardController', () => {
  let creditCardController: CreditCardController;
  let creditCardService: CreditCardService;
  let mockCreditCardRepository: MockCreditCardRepository;
  let mockTransactionRepository: MockCreditCardTransactionRepository;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  const testUserId = 'user-123';
  const testUserEmail = 'test@example.com';

  beforeEach(() => {
    mockCreditCardRepository = new MockCreditCardRepository();
    mockTransactionRepository = new MockCreditCardTransactionRepository();
    creditCardService = new CreditCardService(mockCreditCardRepository, mockTransactionRepository);
    creditCardController = new CreditCardController(creditCardService);

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
  });

  afterEach(() => {
    mockCreditCardRepository.clear();
    mockTransactionRepository.clear();
    jest.clearAllMocks();
  });

  describe('createCreditCard', () => {
    it('should create credit card and return 201 with card data', async () => {
      const mockRequest = {
        user: { userId: testUserId, email: testUserEmail },
        body: { creditLimit: 5000 },
      } as AuthRequest;

      await creditCardController.createCreditCard(mockRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          creditCard: expect.objectContaining({
            userId: testUserId,
            creditLimit: 5000,
            availableCredit: 5000,
          }),
        })
      );
    });

    it('should create credit card with custom card holder name', async () => {
      const mockRequest = {
        user: { userId: testUserId, email: testUserEmail },
        body: { creditLimit: 5000, cardHolder: 'John Smith' },
      } as AuthRequest;

      await creditCardController.createCreditCard(mockRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          creditCard: expect.objectContaining({
            cardHolder: 'John Smith',
          }),
        })
      );
    });

    it('should create credit card with specified card type', async () => {
      const mockRequest = {
        user: { userId: testUserId, email: testUserEmail },
        body: { creditLimit: 5000, cardType: 'AMEX' },
      } as AuthRequest;

      await creditCardController.createCreditCard(mockRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          creditCard: expect.objectContaining({
            cardType: 'AMEX',
          }),
        })
      );
    });

    it('should return 401 when user is not authenticated', async () => {
      const mockRequest = {
        user: undefined,
        body: { creditLimit: 5000 },
      } as AuthRequest;

      await creditCardController.createCreditCard(mockRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    });

    it('should return 400 for non-positive credit limit', async () => {
      const mockRequest = {
        user: { userId: testUserId, email: testUserEmail },
        body: { creditLimit: 0 },
      } as AuthRequest;

      await creditCardController.createCreditCard(mockRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 for missing credit limit', async () => {
      const mockRequest = {
        user: { userId: testUserId, email: testUserEmail },
        body: {},
      } as AuthRequest;

      await creditCardController.createCreditCard(mockRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });
  });

  describe('getCreditCards', () => {
    it('should return 200 with user credit cards', async () => {
      await creditCardService.createCreditCard(testUserId, 5000);
      await creditCardService.createCreditCard(testUserId, 10000);

      const mockRequest = {
        user: { userId: testUserId, email: testUserEmail },
      } as AuthRequest;

      await creditCardController.getCreditCards(mockRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      const jsonCall = (mockResponse.json as jest.Mock).mock.calls[0][0];
      expect(jsonCall.creditCards.length).toBe(2);
    });

    it('should return 401 when user is not authenticated', async () => {
      const mockRequest = {
        user: undefined,
      } as AuthRequest;

      await creditCardController.getCreditCards(mockRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    });

    it('should return empty array when user has no credit cards', async () => {
      const mockRequest = {
        user: { userId: testUserId, email: testUserEmail },
      } as AuthRequest;

      await creditCardController.getCreditCards(mockRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({ creditCards: [] });
    });

    it('should only return credit cards belonging to the authenticated user', async () => {
      await creditCardService.createCreditCard(testUserId, 5000);
      await creditCardService.createCreditCard('other-user', 10000);

      const mockRequest = {
        user: { userId: testUserId, email: testUserEmail },
      } as AuthRequest;

      await creditCardController.getCreditCards(mockRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      const jsonCall = (mockResponse.json as jest.Mock).mock.calls[0][0];
      expect(jsonCall.creditCards.length).toBe(1);
      expect(jsonCall.creditCards[0].creditLimit).toBe(5000);
    });
  });

  describe('getCreditCard', () => {
    it('should return 200 with credit card data', async () => {
      const card = await creditCardService.createCreditCard(testUserId, 5000);

      const mockRequest = {
        user: { userId: testUserId, email: testUserEmail },
        params: { cardNumber: card.cardNumber },
      } as unknown as AuthRequest;

      await creditCardController.getCreditCard(mockRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          creditCard: expect.objectContaining({
            cardNumber: card.cardNumber,
            creditLimit: 5000,
          }),
        })
      );
    });

    it('should return 404 when credit card not found', async () => {
      const mockRequest = {
        user: { userId: testUserId, email: testUserEmail },
        params: { cardNumber: '0000000000000000' },
      } as unknown as AuthRequest;

      await creditCardController.getCreditCard(mockRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Credit card not found' });
    });

    it('should return 403 when credit card belongs to another user', async () => {
      const card = await creditCardService.createCreditCard('other-user', 5000);

      const mockRequest = {
        user: { userId: testUserId, email: testUserEmail },
        params: { cardNumber: card.cardNumber },
      } as unknown as AuthRequest;

      await creditCardController.getCreditCard(mockRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Forbidden' });
    });
  });

  describe('getTransactions', () => {
    it('should return 200 with transaction history', async () => {
      const card = await creditCardService.createCreditCard(testUserId, 5000);
      await creditCardService.charge({ cardNumber: card.cardNumber, amount: 100 });
      await creditCardService.charge({ cardNumber: card.cardNumber, amount: 200 });

      const mockRequest = {
        user: { userId: testUserId, email: testUserEmail },
        params: { cardNumber: card.cardNumber },
      } as unknown as AuthRequest;

      await creditCardController.getTransactions(mockRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      const jsonCall = (mockResponse.json as jest.Mock).mock.calls[0][0];
      // Initial "card opened" + 2 charges = 3 transactions
      expect(jsonCall.transactions.length).toBe(3);
    });

    it('should return 404 when credit card not found', async () => {
      const mockRequest = {
        user: { userId: testUserId, email: testUserEmail },
        params: { cardNumber: '0000000000000000' },
      } as unknown as AuthRequest;

      await creditCardController.getTransactions(mockRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Credit card not found' });
    });

    it('should return 403 when credit card belongs to another user', async () => {
      const card = await creditCardService.createCreditCard('other-user', 5000);

      const mockRequest = {
        user: { userId: testUserId, email: testUserEmail },
        params: { cardNumber: card.cardNumber },
      } as unknown as AuthRequest;

      await creditCardController.getTransactions(mockRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Forbidden' });
    });
  });

  describe('charge', () => {
    it('should return 200 with updated card after charge', async () => {
      const card = await creditCardService.createCreditCard(testUserId, 5000);

      const mockRequest = {
        user: { userId: testUserId, email: testUserEmail },
        body: {
          cardNumber: card.cardNumber,
          amount: 1000,
        },
      } as AuthRequest;

      await creditCardController.charge(mockRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          creditCard: expect.objectContaining({
            availableCredit: 4000,
          }),
        })
      );
    });

    it('should accept merchant details', async () => {
      const card = await creditCardService.createCreditCard(testUserId, 5000);

      const mockRequest = {
        user: { userId: testUserId, email: testUserEmail },
        body: {
          cardNumber: card.cardNumber,
          amount: 100,
          description: 'Grocery purchase',
          merchantName: 'Whole Foods',
          merchantId: 'WF123',
          mccCode: '5411',
        },
      } as AuthRequest;

      await creditCardController.charge(mockRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
    });

    it('should return 400 for non-positive amount', async () => {
      const card = await creditCardService.createCreditCard(testUserId, 5000);

      const mockRequest = {
        user: { userId: testUserId, email: testUserEmail },
        body: {
          cardNumber: card.cardNumber,
          amount: 0,
        },
      } as AuthRequest;

      await creditCardController.charge(mockRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });

    it('should return 404 when credit card not found', async () => {
      const mockRequest = {
        user: { userId: testUserId, email: testUserEmail },
        body: {
          cardNumber: '0000000000000000',
          amount: 100,
        },
      } as AuthRequest;

      await creditCardController.charge(mockRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Credit card not found' });
    });

    it('should return 403 when credit card belongs to another user', async () => {
      const card = await creditCardService.createCreditCard('other-user', 5000);

      const mockRequest = {
        user: { userId: testUserId, email: testUserEmail },
        body: {
          cardNumber: card.cardNumber,
          amount: 100,
        },
      } as AuthRequest;

      await creditCardController.charge(mockRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Forbidden' });
    });

    it('should return 400 for insufficient credit', async () => {
      const card = await creditCardService.createCreditCard(testUserId, 1000);

      const mockRequest = {
        user: { userId: testUserId, email: testUserEmail },
        body: {
          cardNumber: card.cardNumber,
          amount: 2000,
        },
      } as AuthRequest;

      await creditCardController.charge(mockRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Insufficient credit available' });
    });
  });

  describe('payment', () => {
    it('should return 200 with updated card after payment', async () => {
      const card = await creditCardService.createCreditCard(testUserId, 5000);
      await creditCardService.charge({ cardNumber: card.cardNumber, amount: 2000 });

      const mockRequest = {
        user: { userId: testUserId, email: testUserEmail },
        body: {
          cardNumber: card.cardNumber,
          amount: 1000,
        },
      } as AuthRequest;

      await creditCardController.payment(mockRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          creditCard: expect.objectContaining({
            availableCredit: 4000,
          }),
        })
      );
    });

    it('should accept optional description', async () => {
      const card = await creditCardService.createCreditCard(testUserId, 5000);
      await creditCardService.charge({ cardNumber: card.cardNumber, amount: 2000 });

      const mockRequest = {
        user: { userId: testUserId, email: testUserEmail },
        body: {
          cardNumber: card.cardNumber,
          amount: 500,
          description: 'Monthly payment',
        },
      } as AuthRequest;

      await creditCardController.payment(mockRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
    });

    it('should return 400 for non-positive amount', async () => {
      const card = await creditCardService.createCreditCard(testUserId, 5000);
      await creditCardService.charge({ cardNumber: card.cardNumber, amount: 1000 });

      const mockRequest = {
        user: { userId: testUserId, email: testUserEmail },
        body: {
          cardNumber: card.cardNumber,
          amount: -100,
        },
      } as AuthRequest;

      await creditCardController.payment(mockRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });

    it('should return 404 when credit card not found', async () => {
      const mockRequest = {
        user: { userId: testUserId, email: testUserEmail },
        body: {
          cardNumber: '0000000000000000',
          amount: 100,
        },
      } as AuthRequest;

      await creditCardController.payment(mockRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Credit card not found' });
    });

    it('should return 403 when credit card belongs to another user', async () => {
      const card = await creditCardService.createCreditCard('other-user', 5000);
      await creditCardService.charge({ cardNumber: card.cardNumber, amount: 1000 });

      const mockRequest = {
        user: { userId: testUserId, email: testUserEmail },
        body: {
          cardNumber: card.cardNumber,
          amount: 500,
        },
      } as AuthRequest;

      await creditCardController.payment(mockRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Forbidden' });
    });

    it('should return 400 when payment exceeds balance', async () => {
      const card = await creditCardService.createCreditCard(testUserId, 5000);
      await creditCardService.charge({ cardNumber: card.cardNumber, amount: 1000 });

      const mockRequest = {
        user: { userId: testUserId, email: testUserEmail },
        body: {
          cardNumber: card.cardNumber,
          amount: 2000, // Balance is only 1000
        },
      } as AuthRequest;

      await creditCardController.payment(mockRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Payment amount exceeds current balance' });
    });
  });

  describe('refund', () => {
    it('should return 200 with updated card after refund', async () => {
      const card = await creditCardService.createCreditCard(testUserId, 5000);
      await creditCardService.charge({ cardNumber: card.cardNumber, amount: 2000 });

      const mockRequest = {
        user: { userId: testUserId, email: testUserEmail },
        body: {
          cardNumber: card.cardNumber,
          amount: 500,
        },
      } as AuthRequest;

      await creditCardController.refund(mockRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          creditCard: expect.objectContaining({
            availableCredit: 3500,
          }),
        })
      );
    });

    it('should accept optional description', async () => {
      const card = await creditCardService.createCreditCard(testUserId, 5000);
      await creditCardService.charge({ cardNumber: card.cardNumber, amount: 2000 });

      const mockRequest = {
        user: { userId: testUserId, email: testUserEmail },
        body: {
          cardNumber: card.cardNumber,
          amount: 100,
          description: 'Return item',
        },
      } as AuthRequest;

      await creditCardController.refund(mockRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
    });

    it('should return 400 for non-positive amount', async () => {
      const card = await creditCardService.createCreditCard(testUserId, 5000);

      const mockRequest = {
        user: { userId: testUserId, email: testUserEmail },
        body: {
          cardNumber: card.cardNumber,
          amount: 0,
        },
      } as AuthRequest;

      await creditCardController.refund(mockRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });

    it('should return 404 when credit card not found', async () => {
      const mockRequest = {
        user: { userId: testUserId, email: testUserEmail },
        body: {
          cardNumber: '0000000000000000',
          amount: 100,
        },
      } as AuthRequest;

      await creditCardController.refund(mockRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Credit card not found' });
    });

    it('should return 403 when credit card belongs to another user', async () => {
      const card = await creditCardService.createCreditCard('other-user', 5000);
      await creditCardService.charge({ cardNumber: card.cardNumber, amount: 1000 });

      const mockRequest = {
        user: { userId: testUserId, email: testUserEmail },
        body: {
          cardNumber: card.cardNumber,
          amount: 100,
        },
      } as AuthRequest;

      await creditCardController.refund(mockRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Forbidden' });
    });

    it('should return 400 when refund would exceed credit limit', async () => {
      const card = await creditCardService.createCreditCard(testUserId, 5000);
      // Card has full credit available, refund would exceed limit

      const mockRequest = {
        user: { userId: testUserId, email: testUserEmail },
        body: {
          cardNumber: card.cardNumber,
          amount: 100,
        },
      } as AuthRequest;

      await creditCardController.refund(mockRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Refund would exceed credit limit' });
    });
  });
});
