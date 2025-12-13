import { Request, Response, NextFunction } from 'express';
import { createWellKnownRoutes } from '../../routes/wellKnownRoutes';

// Mock PrismaClient
const mockFindMany = jest.fn();

const mockPrisma = {
  webAuthnRelatedOrigin: {
    findMany: mockFindMany,
  },
} as any;

// Helper function to extract route handler from router
function getWebAuthnHandler(prisma: any) {
  const router = createWellKnownRoutes(prisma);
  const webauthnRoute = router.stack.find(
    (layer: any) => layer.route?.path === '/webauthn'
  );
  if (!webauthnRoute?.route?.stack?.[0]?.handle) {
    throw new Error('WebAuthn route handler not found');
  }
  return webauthnRoute.route.stack[0].handle;
}

describe('wellKnownRoutes', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockJson: jest.Mock;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockJson = jest.fn();
    mockRequest = {};
    mockResponse = {
      json: mockJson,
    };
    mockNext = jest.fn();
    jest.clearAllMocks();
  });

  describe('GET /.well-known/webauthn', () => {
    it('should return origins in WebAuthn Related Origins format', async () => {
      const mockOrigins = [
        { origin: 'https://banksim.ca' },
        { origin: 'https://store.regalmoose.ca' },
      ];
      mockFindMany.mockResolvedValue(mockOrigins);

      const handler = getWebAuthnHandler(mockPrisma);
      await handler(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockJson).toHaveBeenCalledWith({
        origins: ['https://banksim.ca', 'https://store.regalmoose.ca'],
      });
    });

    it('should filter by isActive: true', async () => {
      mockFindMany.mockResolvedValue([]);

      const handler = getWebAuthnHandler(mockPrisma);
      await handler(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockFindMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
        select: { origin: true },
      });
    });

    it('should order by sortOrder ascending', async () => {
      const mockOrigins = [
        { origin: 'https://first.com' },
        { origin: 'https://second.com' },
        { origin: 'https://third.com' },
      ];
      mockFindMany.mockResolvedValue(mockOrigins);

      const handler = getWebAuthnHandler(mockPrisma);
      await handler(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockJson).toHaveBeenCalledWith({
        origins: ['https://first.com', 'https://second.com', 'https://third.com'],
      });
      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { sortOrder: 'asc' },
        })
      );
    });

    it('should return empty origins array when no origins exist', async () => {
      mockFindMany.mockResolvedValue([]);

      const handler = getWebAuthnHandler(mockPrisma);
      await handler(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockJson).toHaveBeenCalledWith({ origins: [] });
    });

    it('should return empty origins array on database error', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      mockFindMany.mockRejectedValue(new Error('Database connection failed'));

      const handler = getWebAuthnHandler(mockPrisma);
      await handler(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockJson).toHaveBeenCalledWith({ origins: [] });
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to fetch WebAuthn related origins:',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });

    it('should only select the origin field', async () => {
      mockFindMany.mockResolvedValue([{ origin: 'https://example.com' }]);

      const handler = getWebAuthnHandler(mockPrisma);
      await handler(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          select: { origin: true },
        })
      );
    });

    it('should handle single origin correctly', async () => {
      mockFindMany.mockResolvedValue([{ origin: 'https://only-one.com' }]);

      const handler = getWebAuthnHandler(mockPrisma);
      await handler(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockJson).toHaveBeenCalledWith({
        origins: ['https://only-one.com'],
      });
    });

    it('should handle many origins correctly', async () => {
      const manyOrigins = Array.from({ length: 100 }, (_, i) => ({
        origin: `https://origin${i}.com`,
      }));
      mockFindMany.mockResolvedValue(manyOrigins);

      const handler = getWebAuthnHandler(mockPrisma);
      await handler(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockJson).toHaveBeenCalledWith({
        origins: expect.arrayContaining([
          'https://origin0.com',
          'https://origin99.com',
        ]),
      });
      const callArgs = mockJson.mock.calls[0][0];
      expect(callArgs.origins).toHaveLength(100);
    });
  });

  describe('createWellKnownRoutes', () => {
    it('should create a router with webauthn route', () => {
      const router = createWellKnownRoutes(mockPrisma);

      expect(router).toBeDefined();
      const webauthnRoute = router.stack.find(
        (layer: any) => layer.route?.path === '/webauthn'
      );
      expect(webauthnRoute).toBeDefined();
    });

    it('should register GET method for webauthn route', () => {
      const router = createWellKnownRoutes(mockPrisma);
      const webauthnRoute = router.stack.find(
        (layer: any) => layer.route?.path === '/webauthn'
      );

      // Check that the route has a GET handler
      expect(webauthnRoute?.route?.stack[0]?.method).toBe('get');
    });
  });
});
