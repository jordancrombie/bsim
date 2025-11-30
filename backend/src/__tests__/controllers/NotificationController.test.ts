import { Response, NextFunction } from 'express';
import { NotificationController } from '../../controllers/notificationController';
import { NotificationService } from '../../services/NotificationService';
import { MockNotificationRepository } from '../mocks/MockNotificationRepository';
import { AuthRequest } from '../../middleware/auth';
import { NotificationType } from '../../repositories/interfaces/INotificationRepository';

describe('NotificationController', () => {
  let notificationController: NotificationController;
  let notificationService: NotificationService;
  let mockNotificationRepository: MockNotificationRepository;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  const testUserId = 'user-123';
  const testUserEmail = 'test@example.com';

  beforeEach(() => {
    mockNotificationRepository = new MockNotificationRepository();
    notificationService = new NotificationService(mockNotificationRepository);
    notificationController = new NotificationController(notificationService);

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
  });

  afterEach(() => {
    mockNotificationRepository.clear();
    jest.clearAllMocks();
  });

  describe('getNotifications', () => {
    it('should return 200 with notifications for authenticated user', async () => {
      // Create some notifications
      await notificationService.createNotification(testUserId, NotificationType.SYSTEM, 'Title 1', 'Message 1');
      await notificationService.createNotification(testUserId, NotificationType.SYSTEM, 'Title 2', 'Message 2');

      const mockRequest = {
        user: { userId: testUserId, email: testUserEmail },
        query: {},
      } as AuthRequest;

      await notificationController.getNotifications(mockRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          notifications: expect.arrayContaining([
            expect.objectContaining({ title: 'Title 1' }),
            expect.objectContaining({ title: 'Title 2' }),
          ]),
        })
      );
    });

    it('should return 401 when user is not authenticated', async () => {
      const mockRequest = {
        user: undefined,
        query: {},
      } as AuthRequest;

      await notificationController.getNotifications(mockRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    });

    it('should respect limit query parameter', async () => {
      // Create 10 notifications
      for (let i = 0; i < 10; i++) {
        await notificationService.createNotification(testUserId, NotificationType.SYSTEM, `Title ${i}`, 'Message');
      }

      const mockRequest = {
        user: { userId: testUserId, email: testUserEmail },
        query: { limit: '5' },
      } as unknown as AuthRequest;

      await notificationController.getNotifications(mockRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      const jsonCall = (mockResponse.json as jest.Mock).mock.calls[0][0];
      expect(jsonCall.notifications.length).toBe(5);
    });

    it('should return empty array when user has no notifications', async () => {
      const mockRequest = {
        user: { userId: testUserId, email: testUserEmail },
        query: {},
      } as AuthRequest;

      await notificationController.getNotifications(mockRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({ notifications: [] });
    });

    it('should only return notifications for the authenticated user', async () => {
      await notificationService.createNotification(testUserId, NotificationType.SYSTEM, 'My notification', 'Message');
      await notificationService.createNotification('other-user', NotificationType.SYSTEM, 'Other notification', 'Message');

      const mockRequest = {
        user: { userId: testUserId, email: testUserEmail },
        query: {},
      } as AuthRequest;

      await notificationController.getNotifications(mockRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      const jsonCall = (mockResponse.json as jest.Mock).mock.calls[0][0];
      expect(jsonCall.notifications.length).toBe(1);
      expect(jsonCall.notifications[0].title).toBe('My notification');
    });
  });

  describe('getUnreadCount', () => {
    it('should return 200 with unread count for authenticated user', async () => {
      await notificationService.createNotification(testUserId, NotificationType.SYSTEM, 'Title 1', 'Message');
      await notificationService.createNotification(testUserId, NotificationType.SYSTEM, 'Title 2', 'Message');
      const notification3 = await notificationService.createNotification(
        testUserId,
        NotificationType.SYSTEM,
        'Title 3',
        'Message'
      );
      await notificationService.markAsRead(notification3.id);

      const mockRequest = {
        user: { userId: testUserId, email: testUserEmail },
      } as AuthRequest;

      await notificationController.getUnreadCount(mockRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({ unreadCount: 2 });
    });

    it('should return 401 when user is not authenticated', async () => {
      const mockRequest = {
        user: undefined,
      } as AuthRequest;

      await notificationController.getUnreadCount(mockRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    });

    it('should return 0 when user has no unread notifications', async () => {
      const mockRequest = {
        user: { userId: testUserId, email: testUserEmail },
      } as AuthRequest;

      await notificationController.getUnreadCount(mockRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({ unreadCount: 0 });
    });
  });

  describe('markAsRead', () => {
    it('should return 200 when notification is marked as read', async () => {
      const notification = await notificationService.createNotification(
        testUserId,
        NotificationType.SYSTEM,
        'Title',
        'Message'
      );

      const mockRequest = {
        user: { userId: testUserId, email: testUserEmail },
        params: { notificationId: notification.id },
      } as unknown as AuthRequest;

      await notificationController.markAsRead(mockRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({ message: 'Notification marked as read' });

      // Verify the notification is actually marked as read
      const unreadCount = await notificationService.getUnreadCount(testUserId);
      expect(unreadCount).toBe(0);
    });

    it('should return 401 when user is not authenticated', async () => {
      const mockRequest = {
        user: undefined,
        params: { notificationId: 'some-id' },
      } as unknown as AuthRequest;

      await notificationController.markAsRead(mockRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    });
  });

  describe('markAllAsRead', () => {
    it('should return 200 when all notifications are marked as read', async () => {
      await notificationService.createNotification(testUserId, NotificationType.SYSTEM, 'Title 1', 'Message');
      await notificationService.createNotification(testUserId, NotificationType.SYSTEM, 'Title 2', 'Message');
      await notificationService.createNotification(testUserId, NotificationType.SYSTEM, 'Title 3', 'Message');

      const mockRequest = {
        user: { userId: testUserId, email: testUserEmail },
      } as AuthRequest;

      await notificationController.markAllAsRead(mockRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({ message: 'All notifications marked as read' });

      // Verify all notifications are marked as read
      const unreadCount = await notificationService.getUnreadCount(testUserId);
      expect(unreadCount).toBe(0);
    });

    it('should return 401 when user is not authenticated', async () => {
      const mockRequest = {
        user: undefined,
      } as AuthRequest;

      await notificationController.markAllAsRead(mockRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    });

    it('should only mark notifications for the authenticated user as read', async () => {
      await notificationService.createNotification(testUserId, NotificationType.SYSTEM, 'My notification', 'Message');
      await notificationService.createNotification('other-user', NotificationType.SYSTEM, 'Other notification', 'Message');

      const mockRequest = {
        user: { userId: testUserId, email: testUserEmail },
      } as AuthRequest;

      await notificationController.markAllAsRead(mockRequest, mockResponse as Response, mockNext);

      // My notifications should be read
      const myUnreadCount = await notificationService.getUnreadCount(testUserId);
      expect(myUnreadCount).toBe(0);

      // Other user's notifications should still be unread
      const otherUnreadCount = await notificationService.getUnreadCount('other-user');
      expect(otherUnreadCount).toBe(1);
    });
  });

  describe('deleteNotification', () => {
    it('should return 200 when notification is deleted', async () => {
      const notification = await notificationService.createNotification(
        testUserId,
        NotificationType.SYSTEM,
        'Title',
        'Message'
      );

      const mockRequest = {
        user: { userId: testUserId, email: testUserEmail },
        params: { notificationId: notification.id },
      } as unknown as AuthRequest;

      await notificationController.deleteNotification(mockRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({ message: 'Notification deleted' });

      // Verify the notification is deleted
      const notifications = await notificationService.getNotifications(testUserId);
      expect(notifications.length).toBe(0);
    });

    it('should return 401 when user is not authenticated', async () => {
      const mockRequest = {
        user: undefined,
        params: { notificationId: 'some-id' },
      } as unknown as AuthRequest;

      await notificationController.deleteNotification(mockRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    });

    it('should only delete the specified notification', async () => {
      const notification1 = await notificationService.createNotification(
        testUserId,
        NotificationType.SYSTEM,
        'Title 1',
        'Message'
      );
      await notificationService.createNotification(testUserId, NotificationType.SYSTEM, 'Title 2', 'Message');

      const mockRequest = {
        user: { userId: testUserId, email: testUserEmail },
        params: { notificationId: notification1.id },
      } as unknown as AuthRequest;

      await notificationController.deleteNotification(mockRequest, mockResponse as Response, mockNext);

      // Verify only one notification remains
      const notifications = await notificationService.getNotifications(testUserId);
      expect(notifications.length).toBe(1);
      expect(notifications[0].title).toBe('Title 2');
    });
  });
});
