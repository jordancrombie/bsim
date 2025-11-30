import { PrismaClient, Prisma } from '@prisma/client';
import {
  INotificationRepository,
  CreateNotificationDto,
  NotificationData,
  NotificationType,
} from '../interfaces/INotificationRepository';

export class PrismaNotificationRepository implements INotificationRepository {
  constructor(private prisma: PrismaClient) {}

  async create(data: CreateNotificationDto): Promise<NotificationData> {
    const notification = await this.prisma.notification.create({
      data: {
        userId: data.userId,
        type: data.type,
        title: data.title,
        message: data.message,
        data: data.data as Prisma.InputJsonValue | undefined,
      },
    });

    return {
      id: notification.id,
      userId: notification.userId,
      type: notification.type as NotificationType,
      title: notification.title,
      message: notification.message,
      data: notification.data as Record<string, unknown> | null,
      read: notification.read,
      createdAt: notification.createdAt,
    };
  }

  async findByUserId(userId: string, limit: number = 50): Promise<NotificationData[]> {
    const notifications = await this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return notifications.map((n) => ({
      id: n.id,
      userId: n.userId,
      type: n.type as NotificationType,
      title: n.title,
      message: n.message,
      data: n.data as Record<string, unknown> | null,
      read: n.read,
      createdAt: n.createdAt,
    }));
  }

  async findUnreadByUserId(userId: string): Promise<NotificationData[]> {
    const notifications = await this.prisma.notification.findMany({
      where: { userId, read: false },
      orderBy: { createdAt: 'desc' },
    });

    return notifications.map((n) => ({
      id: n.id,
      userId: n.userId,
      type: n.type as NotificationType,
      title: n.title,
      message: n.message,
      data: n.data as Record<string, unknown> | null,
      read: n.read,
      createdAt: n.createdAt,
    }));
  }

  async countUnreadByUserId(userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: { userId, read: false },
    });
  }

  async markAsRead(id: string): Promise<void> {
    await this.prisma.notification.update({
      where: { id },
      data: { read: true },
    });
  }

  async markAllAsReadByUserId(userId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
  }

  async deleteById(id: string): Promise<void> {
    await this.prisma.notification.delete({
      where: { id },
    });
  }
}
