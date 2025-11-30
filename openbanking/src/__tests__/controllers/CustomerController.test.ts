import { Request, Response } from 'express';
import { CustomerController } from '../../controllers/customerController';
import { createMockPrismaClient, MockPrismaClient } from '../mocks/mockPrisma';
import { PrismaClient } from '@prisma/client';

describe('CustomerController', () => {
  let customerController: CustomerController;
  let mockPrisma: MockPrismaClient;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  const testUserId = 'user-123';

  beforeEach(() => {
    mockPrisma = createMockPrismaClient();
    customerController = new CustomerController(mockPrisma as unknown as PrismaClient);

    mockRequest = {
      token: {
        sub: testUserId,
        scope: 'openid profile email',
        scopes: ['openid', 'profile', 'email'],
        aud: 'https://openbanking.banksim.ca',
        iss: 'https://auth.banksim.ca',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      },
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  afterEach(() => {
    mockPrisma._clear();
  });

  describe('getCurrentCustomer', () => {
    it('should return 401 when no token sub is present', async () => {
      mockRequest.token = undefined;

      await customerController.getCurrentCustomer(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'unauthorized',
        error_description: 'Invalid token',
      });
    });

    it('should return 404 when user does not exist', async () => {
      await customerController.getCurrentCustomer(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'not_found',
        error_description: 'Customer not found',
      });
    });

    it('should return only customerId when no scopes are present', async () => {
      mockPrisma._addUser({
        id: testUserId,
        fiUserRef: 'fi-user-ref-123',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '555-1234',
        address: '123 Main St',
        city: 'Toronto',
        state: 'ON',
        postalCode: 'M5V 1A1',
        country: 'Canada',
        dateOfBirth: new Date('1990-01-15'),
      });

      mockRequest.token!.scopes = [];

      await customerController.getCurrentCustomer(mockRequest as Request, mockResponse as Response);

      const response = (mockResponse.json as jest.Mock).mock.calls[0][0];
      expect(response.customer).toEqual({ customerId: testUserId });
    });

    it('should include name and DOB when profile scope is present', async () => {
      mockPrisma._addUser({
        id: testUserId,
        fiUserRef: 'fi-user-ref-123',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '555-1234',
        address: '123 Main St',
        city: 'Toronto',
        state: 'ON',
        postalCode: 'M5V 1A1',
        country: 'Canada',
        dateOfBirth: new Date('1990-01-15'),
      });

      mockRequest.token!.scopes = ['profile'];

      await customerController.getCurrentCustomer(mockRequest as Request, mockResponse as Response);

      const response = (mockResponse.json as jest.Mock).mock.calls[0][0];
      expect(response.customer).toMatchObject({
        customerId: testUserId,
        name: {
          first: 'John',
          last: 'Doe',
          full: 'John Doe',
        },
        dateOfBirth: '1990-01-15',
      });
      expect(response.customer.email).toBeUndefined();
    });

    it('should include email when email scope is present', async () => {
      mockPrisma._addUser({
        id: testUserId,
        fiUserRef: 'fi-user-ref-123',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: null,
        address: null,
        city: null,
        state: null,
        postalCode: null,
        country: null,
        dateOfBirth: null,
      });

      mockRequest.token!.scopes = ['email'];

      await customerController.getCurrentCustomer(mockRequest as Request, mockResponse as Response);

      const response = (mockResponse.json as jest.Mock).mock.calls[0][0];
      expect(response.customer).toMatchObject({
        customerId: testUserId,
        email: 'john@example.com',
      });
      expect(response.customer.name).toBeUndefined();
    });

    it('should include contact info when fdx:customercontact:read scope is present', async () => {
      mockPrisma._addUser({
        id: testUserId,
        fiUserRef: 'fi-user-ref-123',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '555-1234',
        address: '123 Main St',
        city: 'Toronto',
        state: 'ON',
        postalCode: 'M5V 1A1',
        country: 'Canada',
        dateOfBirth: null,
      });

      mockRequest.token!.scopes = ['fdx:customercontact:read'];

      await customerController.getCurrentCustomer(mockRequest as Request, mockResponse as Response);

      const response = (mockResponse.json as jest.Mock).mock.calls[0][0];
      expect(response.customer).toMatchObject({
        customerId: testUserId,
        phone: '555-1234',
        addresses: [
          {
            type: 'HOME',
            line1: '123 Main St',
            city: 'Toronto',
            state: 'ON',
            postalCode: 'M5V 1A1',
            country: 'Canada',
          },
        ],
      });
    });

    it('should combine multiple scopes correctly', async () => {
      mockPrisma._addUser({
        id: testUserId,
        fiUserRef: 'fi-user-ref-123',
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@example.com',
        phone: '555-9876',
        address: '456 Oak Ave',
        city: 'Vancouver',
        state: 'BC',
        postalCode: 'V6B 2M8',
        country: 'Canada',
        dateOfBirth: new Date('1985-06-20'),
      });

      mockRequest.token!.scopes = ['profile', 'email', 'fdx:customercontact:read'];

      await customerController.getCurrentCustomer(mockRequest as Request, mockResponse as Response);

      const response = (mockResponse.json as jest.Mock).mock.calls[0][0];
      expect(response.customer).toMatchObject({
        customerId: testUserId,
        name: {
          first: 'Jane',
          last: 'Smith',
          full: 'Jane Smith',
        },
        dateOfBirth: '1985-06-20',
        email: 'jane@example.com',
        phone: '555-9876',
        addresses: [
          {
            type: 'HOME',
            line1: '456 Oak Ave',
            city: 'Vancouver',
            state: 'BC',
            postalCode: 'V6B 2M8',
            country: 'Canada',
          },
        ],
      });
    });

    it('should not include phone when phone is null', async () => {
      mockPrisma._addUser({
        id: testUserId,
        fiUserRef: 'fi-user-ref-123',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: null,
        address: '123 Main St',
        city: 'Toronto',
        state: 'ON',
        postalCode: 'M5V 1A1',
        country: 'Canada',
        dateOfBirth: null,
      });

      mockRequest.token!.scopes = ['fdx:customercontact:read'];

      await customerController.getCurrentCustomer(mockRequest as Request, mockResponse as Response);

      const response = (mockResponse.json as jest.Mock).mock.calls[0][0];
      expect(response.customer.phone).toBeUndefined();
      expect(response.customer.addresses).toBeDefined();
    });

    it('should not include addresses when address is null', async () => {
      mockPrisma._addUser({
        id: testUserId,
        fiUserRef: 'fi-user-ref-123',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '555-1234',
        address: null,
        city: null,
        state: null,
        postalCode: null,
        country: null,
        dateOfBirth: null,
      });

      mockRequest.token!.scopes = ['fdx:customercontact:read'];

      await customerController.getCurrentCustomer(mockRequest as Request, mockResponse as Response);

      const response = (mockResponse.json as jest.Mock).mock.calls[0][0];
      expect(response.customer.phone).toBe('555-1234');
      expect(response.customer.addresses).toBeUndefined();
    });

    it('should not include dateOfBirth when null', async () => {
      mockPrisma._addUser({
        id: testUserId,
        fiUserRef: 'fi-user-ref-123',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: null,
        address: null,
        city: null,
        state: null,
        postalCode: null,
        country: null,
        dateOfBirth: null,
      });

      mockRequest.token!.scopes = ['profile'];

      await customerController.getCurrentCustomer(mockRequest as Request, mockResponse as Response);

      const response = (mockResponse.json as jest.Mock).mock.calls[0][0];
      expect(response.customer.name).toBeDefined();
      expect(response.customer.dateOfBirth).toBeUndefined();
    });

    it('should handle openid scope without including extra data', async () => {
      mockPrisma._addUser({
        id: testUserId,
        fiUserRef: 'fi-user-ref-123',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '555-1234',
        address: '123 Main St',
        city: 'Toronto',
        state: 'ON',
        postalCode: 'M5V 1A1',
        country: 'Canada',
        dateOfBirth: new Date('1990-01-15'),
      });

      mockRequest.token!.scopes = ['openid'];

      await customerController.getCurrentCustomer(mockRequest as Request, mockResponse as Response);

      const response = (mockResponse.json as jest.Mock).mock.calls[0][0];
      expect(response.customer).toEqual({ customerId: testUserId });
    });
  });
});
