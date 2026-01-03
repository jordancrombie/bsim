import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { config } from './config/env';
import { getPrismaClient, disconnectPrisma } from './config/database';
import { createOidcProvider } from './config/oidc';
import { createInteractionRoutes } from './routes/interaction';
import { createAdminRoutes } from './routes/admin';
import { createAdminAuthRoutes } from './routes/adminAuth';
import { createAdminAuthMiddleware } from './middleware/adminAuth';

// Memory monitoring interval (5 minutes)
const MEMORY_LOG_INTERVAL = 5 * 60 * 1000;
// Token cleanup interval (1 hour)
const TOKEN_CLEANUP_INTERVAL = 60 * 60 * 1000;

function formatBytes(bytes: number): string {
  return `${Math.round(bytes / 1024 / 1024)}MB`;
}

function logMemoryUsage(): void {
  const usage = process.memoryUsage();
  console.log(`[Memory] Heap: ${formatBytes(usage.heapUsed)}/${formatBytes(usage.heapTotal)} | RSS: ${formatBytes(usage.rss)} | External: ${formatBytes(usage.external)}`);
}

const app = express();

// Trust proxy (behind nginx)
app.set('trust proxy', true);

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// CORS configuration
const allowedOrigins = config.cors.origin.split(',');
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Static files
app.use('/public', express.static(path.join(__dirname, '../public')));

// Initialize Prisma
const prisma = getPrismaClient();

// Cleanup expired OIDC tokens from database
async function cleanupExpiredTokens(): Promise<void> {
  try {
    const result = await prisma.oidcPayload.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });
    if (result.count > 0) {
      console.log(`[Cleanup] Deleted ${result.count} expired OIDC tokens`);
    }
  } catch (err) {
    console.error('[Cleanup] Error cleaning up expired tokens:', err);
  }
}

// Create OIDC provider
const oidc = createOidcProvider(prisma);

// OIDC provider error listener
oidc.on('server_error', (ctx, err) => {
  console.error('[OIDC Server Error]:', err);
});

oidc.on('grant.error', (ctx, err) => {
  console.error('[OIDC Grant Error]:', err);
});

oidc.on('authorization.error', (ctx, err) => {
  console.error('[OIDC Authorization Error]:', err);
  console.error('[OIDC Authorization Error] Request redirect_uri:', ctx.oidc?.params?.redirect_uri);
});

// Interaction routes (login/consent UI)
app.use('/interaction', createInteractionRoutes(oidc, prisma));

// Admin authentication routes (login/logout - public)
app.use('/administration', createAdminAuthRoutes(prisma));

// Admin routes (OAuth client management - protected)
const requireAdminAuth = createAdminAuthMiddleware(prisma);
app.use('/administration', requireAdminAuth, createAdminRoutes(prisma));

// Health check with memory stats and version info
// eslint-disable-next-line @typescript-eslint/no-var-requires
const packageJson = require('../package.json');

app.get('/health', (req, res) => {
  const mem = process.memoryUsage();
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'bsim-auth-server',
    version: packageJson.version,
    memory: {
      heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
      heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
      rssMB: Math.round(mem.rss / 1024 / 1024),
    },
  });
});

// OIDC provider routes
app.use(oidc.callback());

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: config.nodeEnv === 'development' ? err.message : undefined,
  });
});

// Start server
const PORT = config.port;
let memoryInterval: NodeJS.Timeout;
let cleanupInterval: NodeJS.Timeout;

app.listen(PORT, () => {
  console.log(`BSIM Authorization Server running on port ${PORT}`);
  console.log(`Environment: ${config.nodeEnv}`);
  console.log(`Issuer: ${config.oidc.issuer}`);
  console.log(`Discovery: ${config.oidc.issuer}/.well-known/openid-configuration`);

  // Log initial memory usage
  logMemoryUsage();

  // Schedule periodic memory logging
  memoryInterval = setInterval(logMemoryUsage, MEMORY_LOG_INTERVAL);

  // Schedule periodic token cleanup
  cleanupInterval = setInterval(cleanupExpiredTokens, TOKEN_CLEANUP_INTERVAL);

  // Run initial cleanup
  cleanupExpiredTokens();
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  clearInterval(memoryInterval);
  clearInterval(cleanupInterval);
  await disconnectPrisma();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  clearInterval(memoryInterval);
  clearInterval(cleanupInterval);
  await disconnectPrisma();
  process.exit(0);
});
