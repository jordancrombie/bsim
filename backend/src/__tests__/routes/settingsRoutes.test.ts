import { Request, Response, NextFunction } from 'express';
import { createSettingsRoutes } from '../../routes/settingsRoutes';

// Mock PrismaClient
const mockFindUnique = jest.fn();
const mockCreate = jest.fn();

const mockPrisma = {
  siteSettings: {
    findUnique: mockFindUnique,
    create: mockCreate,
  },
} as any;

// Helper function to extract route handler from router
function getSettingsHandler(prisma: any) {
  const router = createSettingsRoutes(prisma);
  const settingsRoute = router.stack.find(
    (layer: any) => layer.route?.path === '/'
  );
  if (!settingsRoute?.route?.stack?.[0]?.handle) {
    throw new Error('Settings route handler not found');
  }
  return settingsRoute.route.stack[0].handle;
}

describe('settingsRoutes', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockJson = jest.fn();
    mockStatus = jest.fn().mockReturnThis();
    mockRequest = {};
    mockResponse = {
      json: mockJson,
      status: mockStatus,
    };
    mockNext = jest.fn();
    jest.clearAllMocks();
  });

  describe('GET /settings', () => {
    it('should return existing settings', async () => {
      const mockSettings = {
        id: 'default',
        siteName: 'BSIM',
        logoUrl: '/logo.png',
      };
      mockFindUnique.mockResolvedValue(mockSettings);

      const handler = getSettingsHandler(mockPrisma);
      await handler(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockFindUnique).toHaveBeenCalledWith({
        where: { id: 'default' },
      });
      expect(mockJson).toHaveBeenCalledWith({
        logoUrl: '/logo.png',
        siteName: 'BSIM',
      });
    });

    it('should create default settings if they do not exist', async () => {
      mockFindUnique.mockResolvedValue(null);
      const defaultSettings = {
        id: 'default',
        siteName: 'BSIM',
        logoUrl: '/logo.png',
      };
      mockCreate.mockResolvedValue(defaultSettings);

      const handler = getSettingsHandler(mockPrisma);
      await handler(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockCreate).toHaveBeenCalledWith({
        data: {
          id: 'default',
          siteName: 'BSIM',
          logoUrl: '/logo.png',
        },
      });
      expect(mockJson).toHaveBeenCalledWith({
        logoUrl: '/logo.png',
        siteName: 'BSIM',
      });
    });

    it('should return 500 on database error', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      mockFindUnique.mockRejectedValue(new Error('Database connection failed'));

      const handler = getSettingsHandler(mockPrisma);
      await handler(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith({ error: 'Failed to fetch site settings' });
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to fetch site settings:',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });

    it('should return custom site name if set', async () => {
      const mockSettings = {
        id: 'default',
        siteName: 'My Custom Bank',
        logoUrl: '/custom-logo.png',
      };
      mockFindUnique.mockResolvedValue(mockSettings);

      const handler = getSettingsHandler(mockPrisma);
      await handler(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockJson).toHaveBeenCalledWith({
        logoUrl: '/custom-logo.png',
        siteName: 'My Custom Bank',
      });
    });
  });

  describe('createSettingsRoutes', () => {
    it('should create a router with settings route', () => {
      const router = createSettingsRoutes(mockPrisma);

      expect(router).toBeDefined();
      const settingsRoute = router.stack.find(
        (layer: any) => layer.route?.path === '/'
      );
      expect(settingsRoute).toBeDefined();
    });

    it('should register GET method for settings route', () => {
      const router = createSettingsRoutes(mockPrisma);
      const settingsRoute = router.stack.find(
        (layer: any) => layer.route?.path === '/'
      );

      expect(settingsRoute?.route?.stack[0]?.method).toBe('get');
    });
  });
});
