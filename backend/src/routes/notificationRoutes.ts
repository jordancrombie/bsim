import { Router } from 'express';
import { NotificationController } from '../controllers/notificationController';
import { authMiddleware } from '../middleware/auth';

export const createNotificationRoutes = (notificationController: NotificationController): Router => {
  const router = Router();

  // All routes require authentication
  router.use(authMiddleware);

  // Get all notifications for the current user
  router.get('/', notificationController.getNotifications);

  // Get unread count
  router.get('/unread-count', notificationController.getUnreadCount);

  // Mark a specific notification as read
  router.patch('/:notificationId/read', notificationController.markAsRead);

  // Mark all notifications as read
  router.post('/mark-all-read', notificationController.markAllAsRead);

  // Delete a notification
  router.delete('/:notificationId', notificationController.deleteNotification);

  return router;
};
