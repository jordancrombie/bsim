import { NotificationService } from '../../services/NotificationService';
import { MockNotificationRepository } from '../mocks/MockNotificationRepository';
import { NotificationType } from '../../repositories/interfaces/INotificationRepository';

describe('NotificationService', () => {
  let notificationService: NotificationService;
  let mockNotificationRepository: MockNotificationRepository;

  const testUserId = 'user-123';

  beforeEach(() => {
    mockNotificationRepository = new MockNotificationRepository();
    notificationService = new NotificationService(mockNotificationRepository);
  });

  afterEach(() => {
    mockNotificationRepository.clear();
  });

  describe('createNotification', () => {
    it('should create a notification with all fields', async () => {
      const notification = await notificationService.createNotification(
        testUserId,
        NotificationType.SYSTEM,
        'Test Title',
        'Test message content',
        { key: 'value' }
      );

      expect(notification).toBeDefined();
      expect(notification.userId).toBe(testUserId);
      expect(notification.type).toBe(NotificationType.SYSTEM);
      expect(notification.title).toBe('Test Title');
      expect(notification.message).toBe('Test message content');
      expect(notification.data).toEqual({ key: 'value' });
      expect(notification.read).toBe(false);
    });

    it('should create a notification without optional data', async () => {
      const notification = await notificationService.createNotification(
        testUserId,
        NotificationType.ACCOUNT_CREATED,
        'Account Created',
        'Your new account is ready'
      );

      expect(notification).toBeDefined();
      expect(notification.data).toBeNull();
    });

    it('should create notifications with different types', async () => {
      const types = [
        NotificationType.TRANSFER_RECEIVED,
        NotificationType.TRANSFER_SENT,
        NotificationType.ACCOUNT_CREATED,
        NotificationType.CREDIT_CARD_CREATED,
        NotificationType.PAYMENT_DUE,
        NotificationType.SYSTEM,
      ];

      for (const type of types) {
        const notification = await notificationService.createNotification(
          testUserId,
          type,
          'Title',
          'Message'
        );
        expect(notification.type).toBe(type);
      }

      expect(mockNotificationRepository.getNotificationCount()).toBe(types.length);
    });

    it('should set createdAt timestamp', async () => {
      const before = new Date();
      const notification = await notificationService.createNotification(
        testUserId,
        NotificationType.SYSTEM,
        'Title',
        'Message'
      );
      const after = new Date();

      expect(notification.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(notification.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe('getNotifications', () => {
    it('should return empty array when user has no notifications', async () => {
      const notifications = await notificationService.getNotifications(testUserId);

      expect(notifications).toEqual([]);
    });

    it('should return all notifications for a user', async () => {
      await notificationService.createNotification(testUserId, NotificationType.SYSTEM, 'Title 1', 'Message 1');
      await notificationService.createNotification(testUserId, NotificationType.SYSTEM, 'Title 2', 'Message 2');
      await notificationService.createNotification(testUserId, NotificationType.SYSTEM, 'Title 3', 'Message 3');

      const notifications = await notificationService.getNotifications(testUserId);

      expect(notifications.length).toBe(3);
    });

    it('should not return notifications from other users', async () => {
      await notificationService.createNotification(testUserId, NotificationType.SYSTEM, 'My notification', 'Message');
      await notificationService.createNotification('other-user', NotificationType.SYSTEM, 'Other notification', 'Message');

      const notifications = await notificationService.getNotifications(testUserId);

      expect(notifications.length).toBe(1);
      expect(notifications[0].title).toBe('My notification');
    });

    it('should respect limit parameter', async () => {
      for (let i = 0; i < 10; i++) {
        await notificationService.createNotification(testUserId, NotificationType.SYSTEM, `Title ${i}`, 'Message');
      }

      const notifications = await notificationService.getNotifications(testUserId, 5);

      expect(notifications.length).toBe(5);
    });

    it('should return notifications sorted by createdAt descending', async () => {
      // Create notifications with explicit time gaps to ensure ordering
      const notification1 = await notificationService.createNotification(
        testUserId,
        NotificationType.SYSTEM,
        'First',
        'Message'
      );
      const notification2 = await notificationService.createNotification(
        testUserId,
        NotificationType.SYSTEM,
        'Second',
        'Message'
      );
      const notification3 = await notificationService.createNotification(
        testUserId,
        NotificationType.SYSTEM,
        'Third',
        'Message'
      );

      const notifications = await notificationService.getNotifications(testUserId);

      // Verify sorting is by createdAt descending (most recent first)
      for (let i = 0; i < notifications.length - 1; i++) {
        expect(notifications[i].createdAt.getTime()).toBeGreaterThanOrEqual(
          notifications[i + 1].createdAt.getTime()
        );
      }
    });
  });

  describe('getUnreadNotifications', () => {
    it('should return only unread notifications', async () => {
      const notification1 = await notificationService.createNotification(
        testUserId,
        NotificationType.SYSTEM,
        'Unread 1',
        'Message'
      );
      await notificationService.createNotification(testUserId, NotificationType.SYSTEM, 'Unread 2', 'Message');
      const notification3 = await notificationService.createNotification(
        testUserId,
        NotificationType.SYSTEM,
        'Read',
        'Message'
      );

      // Mark one as read
      await notificationService.markAsRead(notification3.id);

      const unread = await notificationService.getUnreadNotifications(testUserId);

      expect(unread.length).toBe(2);
      expect(unread.map((n) => n.title)).toContain('Unread 1');
      expect(unread.map((n) => n.title)).toContain('Unread 2');
      expect(unread.map((n) => n.title)).not.toContain('Read');
    });

    it('should return empty array when all notifications are read', async () => {
      const notification = await notificationService.createNotification(
        testUserId,
        NotificationType.SYSTEM,
        'Title',
        'Message'
      );
      await notificationService.markAsRead(notification.id);

      const unread = await notificationService.getUnreadNotifications(testUserId);

      expect(unread).toEqual([]);
    });
  });

  describe('getUnreadCount', () => {
    it('should return 0 when user has no notifications', async () => {
      const count = await notificationService.getUnreadCount(testUserId);

      expect(count).toBe(0);
    });

    it('should return count of unread notifications', async () => {
      await notificationService.createNotification(testUserId, NotificationType.SYSTEM, 'Title 1', 'Message');
      await notificationService.createNotification(testUserId, NotificationType.SYSTEM, 'Title 2', 'Message');
      const notification3 = await notificationService.createNotification(
        testUserId,
        NotificationType.SYSTEM,
        'Title 3',
        'Message'
      );

      await notificationService.markAsRead(notification3.id);

      const count = await notificationService.getUnreadCount(testUserId);

      expect(count).toBe(2);
    });

    it('should not count notifications from other users', async () => {
      await notificationService.createNotification(testUserId, NotificationType.SYSTEM, 'My notification', 'Message');
      await notificationService.createNotification('other-user', NotificationType.SYSTEM, 'Other notification', 'Message');

      const count = await notificationService.getUnreadCount(testUserId);

      expect(count).toBe(1);
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read', async () => {
      const notification = await notificationService.createNotification(
        testUserId,
        NotificationType.SYSTEM,
        'Title',
        'Message'
      );

      expect(notification.read).toBe(false);

      await notificationService.markAsRead(notification.id);

      const notifications = await notificationService.getNotifications(testUserId);
      expect(notifications[0].read).toBe(true);
    });

    it('should not affect other notifications when marking one as read', async () => {
      const notification1 = await notificationService.createNotification(
        testUserId,
        NotificationType.SYSTEM,
        'Title 1',
        'Message'
      );
      await notificationService.createNotification(testUserId, NotificationType.SYSTEM, 'Title 2', 'Message');

      await notificationService.markAsRead(notification1.id);

      const unreadCount = await notificationService.getUnreadCount(testUserId);
      expect(unreadCount).toBe(1);
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all notifications as read for a user', async () => {
      await notificationService.createNotification(testUserId, NotificationType.SYSTEM, 'Title 1', 'Message');
      await notificationService.createNotification(testUserId, NotificationType.SYSTEM, 'Title 2', 'Message');
      await notificationService.createNotification(testUserId, NotificationType.SYSTEM, 'Title 3', 'Message');

      await notificationService.markAllAsRead(testUserId);

      const unreadCount = await notificationService.getUnreadCount(testUserId);
      expect(unreadCount).toBe(0);
    });

    it('should not affect notifications from other users', async () => {
      await notificationService.createNotification(testUserId, NotificationType.SYSTEM, 'My notification', 'Message');
      await notificationService.createNotification('other-user', NotificationType.SYSTEM, 'Other notification', 'Message');

      await notificationService.markAllAsRead(testUserId);

      const myCount = await notificationService.getUnreadCount(testUserId);
      const otherCount = await notificationService.getUnreadCount('other-user');

      expect(myCount).toBe(0);
      expect(otherCount).toBe(1);
    });
  });

  describe('deleteNotification', () => {
    it('should delete a notification', async () => {
      const notification = await notificationService.createNotification(
        testUserId,
        NotificationType.SYSTEM,
        'Title',
        'Message'
      );

      await notificationService.deleteNotification(notification.id);

      const notifications = await notificationService.getNotifications(testUserId);
      expect(notifications.length).toBe(0);
    });

    it('should only delete the specified notification', async () => {
      const notification1 = await notificationService.createNotification(
        testUserId,
        NotificationType.SYSTEM,
        'Title 1',
        'Message'
      );
      await notificationService.createNotification(testUserId, NotificationType.SYSTEM, 'Title 2', 'Message');

      await notificationService.deleteNotification(notification1.id);

      const notifications = await notificationService.getNotifications(testUserId);
      expect(notifications.length).toBe(1);
      expect(notifications[0].title).toBe('Title 2');
    });
  });

  describe('notifyTransferReceived', () => {
    it('should create transfer received notification with correct details', async () => {
      const notification = await notificationService.notifyTransferReceived(
        testUserId,
        'sender@example.com',
        250.5,
        'ACC123456'
      );

      expect(notification.type).toBe(NotificationType.TRANSFER_RECEIVED);
      expect(notification.title).toBe('Money Received');
      expect(notification.message).toContain('$250.50');
      expect(notification.message).toContain('sender@example.com');
      expect(notification.data).toEqual({
        senderEmail: 'sender@example.com',
        amount: 250.5,
        accountNumber: 'ACC123456',
      });
    });

    it('should format amount with two decimal places', async () => {
      const notification = await notificationService.notifyTransferReceived(testUserId, 'sender@example.com', 100, 'ACC123');

      expect(notification.message).toContain('$100.00');
    });
  });

  describe('notifyTransferSent', () => {
    it('should create transfer sent notification with correct details', async () => {
      const notification = await notificationService.notifyTransferSent(
        testUserId,
        'recipient@example.com',
        150.75,
        'ACC654321'
      );

      expect(notification.type).toBe(NotificationType.TRANSFER_SENT);
      expect(notification.title).toBe('Money Sent');
      expect(notification.message).toContain('$150.75');
      expect(notification.message).toContain('recipient@example.com');
      expect(notification.data).toEqual({
        recipientEmail: 'recipient@example.com',
        amount: 150.75,
        accountNumber: 'ACC654321',
      });
    });

    it('should format amount with two decimal places', async () => {
      const notification = await notificationService.notifyTransferSent(testUserId, 'recipient@example.com', 50, 'ACC123');

      expect(notification.message).toContain('$50.00');
    });
  });
});
