import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

export function createSettingsRoutes(prisma: PrismaClient): Router {
  const router = Router();

  // Get site settings (public endpoint)
  router.get('/', async (req: Request, res: Response) => {
    try {
      let settings = await prisma.siteSettings.findUnique({
        where: { id: 'default' },
      });

      // Create default settings if they don't exist
      if (!settings) {
        settings = await prisma.siteSettings.create({
          data: {
            id: 'default',
            siteName: 'BSIM',
            logoUrl: '/logo.png',
          },
        });
      }

      res.json({
        logoUrl: settings.logoUrl,
        siteName: settings.siteName,
      });
    } catch (error) {
      console.error('Failed to fetch site settings:', error);
      res.status(500).json({ error: 'Failed to fetch site settings' });
    }
  });

  return router;
}
