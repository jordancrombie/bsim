import { createNotificationRoutes } from '../../routes/notificationRoutes';
import { NotificationController } from '../../controllers/notificationController';

// Mock the auth middleware
jest.mock('../../middleware/auth', () => ({
  authMiddleware: jest.fn((req, res, next) => next()),
}));

describe('notificationRoutes', () => {
  let mockNotificationController: Partial<NotificationController>;

  beforeEach(() => {
    mockNotificationController = {
      getNotifications: jest.fn(),
      getUnreadCount: jest.fn(),
      markAsRead: jest.fn(),
      markAllAsRead: jest.fn(),
      deleteNotification: jest.fn(),
    };
  });

  describe('createNotificationRoutes', () => {
    it('should create a router with all notification routes', () => {
      const router = createNotificationRoutes(mockNotificationController as NotificationController);

      expect(router).toBeDefined();

      // Check that all expected routes are registered
      const routes = router.stack
        .filter((layer: any) => layer.route)
        .map((layer: any) => ({
          path: layer.route.path,
          methods: Object.keys(layer.route.methods),
        }));

      expect(routes).toContainEqual({ path: '/', methods: ['get'] });
      expect(routes).toContainEqual({ path: '/unread-count', methods: ['get'] });
      expect(routes).toContainEqual({ path: '/:notificationId/read', methods: ['patch'] });
      expect(routes).toContainEqual({ path: '/mark-all-read', methods: ['post'] });
      expect(routes).toContainEqual({ path: '/:notificationId', methods: ['delete'] });
    });

    it('should apply auth middleware to all routes', () => {
      const router = createNotificationRoutes(mockNotificationController as NotificationController);

      // The first item in stack should be the auth middleware
      const middlewareLayer = router.stack.find((layer: any) => !layer.route);
      expect(middlewareLayer).toBeDefined();
    });

    it('should register GET / for getNotifications', () => {
      const router = createNotificationRoutes(mockNotificationController as NotificationController);

      const listRoute = router.stack.find(
        (layer: any) => layer.route?.path === '/' && layer.route?.methods?.get
      );
      expect(listRoute).toBeDefined();
    });

    it('should register GET /unread-count for getUnreadCount', () => {
      const router = createNotificationRoutes(mockNotificationController as NotificationController);

      const unreadRoute = router.stack.find(
        (layer: any) => layer.route?.path === '/unread-count' && layer.route?.methods?.get
      );
      expect(unreadRoute).toBeDefined();
    });

    it('should register PATCH /:notificationId/read for markAsRead', () => {
      const router = createNotificationRoutes(mockNotificationController as NotificationController);

      const markReadRoute = router.stack.find(
        (layer: any) => layer.route?.path === '/:notificationId/read' && layer.route?.methods?.patch
      );
      expect(markReadRoute).toBeDefined();
    });

    it('should register POST /mark-all-read for markAllAsRead', () => {
      const router = createNotificationRoutes(mockNotificationController as NotificationController);

      const markAllRoute = router.stack.find(
        (layer: any) => layer.route?.path === '/mark-all-read' && layer.route?.methods?.post
      );
      expect(markAllRoute).toBeDefined();
    });

    it('should register DELETE /:notificationId for deleteNotification', () => {
      const router = createNotificationRoutes(mockNotificationController as NotificationController);

      const deleteRoute = router.stack.find(
        (layer: any) => layer.route?.path === '/:notificationId' && layer.route?.methods?.delete
      );
      expect(deleteRoute).toBeDefined();
    });
  });
});
