export enum NotificationType {
  TRANSFER_RECEIVED = 'TRANSFER_RECEIVED',
  TRANSFER_SENT = 'TRANSFER_SENT',
  ACCOUNT_CREATED = 'ACCOUNT_CREATED',
  CREDIT_CARD_CREATED = 'CREDIT_CARD_CREATED',
  PAYMENT_DUE = 'PAYMENT_DUE',
  SYSTEM = 'SYSTEM',
}

export interface CreateNotificationDto {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, unknown>;
}

export interface NotificationData {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, unknown> | null;
  read: boolean;
  createdAt: Date;
}

export interface INotificationRepository {
  create(data: CreateNotificationDto): Promise<NotificationData>;
  findByUserId(userId: string, limit?: number): Promise<NotificationData[]>;
  findUnreadByUserId(userId: string): Promise<NotificationData[]>;
  countUnreadByUserId(userId: string): Promise<number>;
  markAsRead(id: string): Promise<void>;
  markAllAsReadByUserId(userId: string): Promise<void>;
  deleteById(id: string): Promise<void>;
}
