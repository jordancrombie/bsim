import { Response, NextFunction } from 'express';
import { NotificationService } from '../services/NotificationService';
import { AuthRequest } from '../middleware/auth';
import { z } from 'zod';

const markReadSchema = z.object({
  notificationId: z.string().uuid(),
});

export class NotificationController {
  constructor(private notificationService: NotificationService) {}

  getNotifications = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
      const notifications = await this.notificationService.getNotifications(req.user.userId, limit);

      res.status(200).json({ notifications });
    } catch (error) {
      next(error);
    }
  };

  getUnreadCount = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const count = await this.notificationService.getUnreadCount(req.user.userId);

      res.status(200).json({ unreadCount: count });
    } catch (error) {
      next(error);
    }
  };

  markAsRead = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { notificationId } = req.params;

      await this.notificationService.markAsRead(notificationId);

      res.status(200).json({ message: 'Notification marked as read' });
    } catch (error) {
      next(error);
    }
  };

  markAllAsRead = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      await this.notificationService.markAllAsRead(req.user.userId);

      res.status(200).json({ message: 'All notifications marked as read' });
    } catch (error) {
      next(error);
    }
  };

  deleteNotification = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { notificationId } = req.params;

      await this.notificationService.deleteNotification(notificationId);

      res.status(200).json({ message: 'Notification deleted' });
    } catch (error) {
      next(error);
    }
  };
}
