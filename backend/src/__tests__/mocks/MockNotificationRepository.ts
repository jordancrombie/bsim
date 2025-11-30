import {
  INotificationRepository,
  CreateNotificationDto,
  NotificationData,
  NotificationType,
} from '../../repositories/interfaces/INotificationRepository';

/**
 * Mock notification repository for testing
 * Stores notifications in memory and provides all INotificationRepository methods
 */
export class MockNotificationRepository implements INotificationRepository {
  private notifications: Map<string, NotificationData> = new Map();
  private userNotificationsIndex: Map<string, string[]> = new Map(); // userId -> notificationIds[]

  constructor(initialNotifications: Array<NotificationData> = []) {
    for (const notification of initialNotifications) {
      this.notifications.set(notification.id, notification);

      const userNotifications = this.userNotificationsIndex.get(notification.userId) || [];
      userNotifications.push(notification.id);
      this.userNotificationsIndex.set(notification.userId, userNotifications);
    }
  }

  async create(data: CreateNotificationDto): Promise<NotificationData> {
    const id = `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();

    const notification: NotificationData = {
      id,
      userId: data.userId,
      type: data.type,
      title: data.title,
      message: data.message,
      data: data.data || null,
      read: false,
      createdAt: now,
    };

    this.notifications.set(id, notification);

    const userNotifications = this.userNotificationsIndex.get(data.userId) || [];
    userNotifications.push(id);
    this.userNotificationsIndex.set(data.userId, userNotifications);

    return notification;
  }

  async findByUserId(userId: string, limit: number = 50): Promise<NotificationData[]> {
    const notificationIds = this.userNotificationsIndex.get(userId) || [];
    const notifications = notificationIds
      .map((id) => this.notifications.get(id))
      .filter((n): n is NotificationData => n !== undefined)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return notifications.slice(0, limit);
  }

  async findUnreadByUserId(userId: string): Promise<NotificationData[]> {
    const notificationIds = this.userNotificationsIndex.get(userId) || [];
    return notificationIds
      .map((id) => this.notifications.get(id))
      .filter((n): n is NotificationData => n !== undefined && !n.read)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async countUnreadByUserId(userId: string): Promise<number> {
    const unread = await this.findUnreadByUserId(userId);
    return unread.length;
  }

  async markAsRead(id: string): Promise<void> {
    const notification = this.notifications.get(id);
    if (notification) {
      notification.read = true;
      this.notifications.set(id, notification);
    }
  }

  async markAllAsReadByUserId(userId: string): Promise<void> {
    const notificationIds = this.userNotificationsIndex.get(userId) || [];
    for (const id of notificationIds) {
      const notification = this.notifications.get(id);
      if (notification && !notification.read) {
        notification.read = true;
        this.notifications.set(id, notification);
      }
    }
  }

  async deleteById(id: string): Promise<void> {
    const notification = this.notifications.get(id);
    if (notification) {
      this.notifications.delete(id);

      const userNotifications = this.userNotificationsIndex.get(notification.userId) || [];
      const index = userNotifications.indexOf(id);
      if (index > -1) {
        userNotifications.splice(index, 1);
        this.userNotificationsIndex.set(notification.userId, userNotifications);
      }
    }
  }

  // Helper methods for testing
  clear(): void {
    this.notifications.clear();
    this.userNotificationsIndex.clear();
  }

  getNotificationCount(): number {
    return this.notifications.size;
  }

  getAllNotifications(): Array<NotificationData> {
    return Array.from(this.notifications.values());
  }
}
