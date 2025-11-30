import {
  INotificationRepository,
  NotificationData,
  NotificationType,
} from '../repositories/interfaces/INotificationRepository';

export class NotificationService {
  constructor(private notificationRepository: INotificationRepository) {}

  async createNotification(
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
    data?: Record<string, unknown>
  ): Promise<NotificationData> {
    return this.notificationRepository.create({
      userId,
      type,
      title,
      message,
      data,
    });
  }

  async getNotifications(userId: string, limit?: number): Promise<NotificationData[]> {
    return this.notificationRepository.findByUserId(userId, limit);
  }

  async getUnreadNotifications(userId: string): Promise<NotificationData[]> {
    return this.notificationRepository.findUnreadByUserId(userId);
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.notificationRepository.countUnreadByUserId(userId);
  }

  async markAsRead(notificationId: string): Promise<void> {
    return this.notificationRepository.markAsRead(notificationId);
  }

  async markAllAsRead(userId: string): Promise<void> {
    return this.notificationRepository.markAllAsReadByUserId(userId);
  }

  async deleteNotification(notificationId: string): Promise<void> {
    return this.notificationRepository.deleteById(notificationId);
  }

  // Helper method for transfer received notifications
  async notifyTransferReceived(
    recipientUserId: string,
    senderEmail: string,
    amount: number,
    accountNumber: string
  ): Promise<NotificationData> {
    return this.createNotification(
      recipientUserId,
      NotificationType.TRANSFER_RECEIVED,
      'Money Received',
      `You received $${amount.toFixed(2)} from ${senderEmail}`,
      {
        senderEmail,
        amount,
        accountNumber,
      }
    );
  }

  // Helper method for transfer sent notifications
  async notifyTransferSent(
    senderUserId: string,
    recipientEmail: string,
    amount: number,
    accountNumber: string
  ): Promise<NotificationData> {
    return this.createNotification(
      senderUserId,
      NotificationType.TRANSFER_SENT,
      'Money Sent',
      `You sent $${amount.toFixed(2)} to ${recipientEmail}`,
      {
        recipientEmail,
        amount,
        accountNumber,
      }
    );
  }
}
