import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { config } from './config/env';
import { getPrismaClient, disconnectPrisma } from './config/database';
import { createOidcProvider } from './config/oidc';
import { createInteractionRoutes } from './routes/interaction';

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
});

// Interaction routes (login/consent UI)
app.use('/interaction', createInteractionRoutes(oidc, prisma));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
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
app.listen(PORT, () => {
  console.log(`BSIM Authorization Server running on port ${PORT}`);
  console.log(`Environment: ${config.nodeEnv}`);
  console.log(`Issuer: ${config.oidc.issuer}`);
  console.log(`Discovery: ${config.oidc.issuer}/.well-known/openid-configuration`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await disconnectPrisma();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  await disconnectPrisma();
  process.exit(0);
});
