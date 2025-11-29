import express from 'express';
import cors from 'cors';
import { config } from './config/env';
import { getPrismaClient, disconnectPrisma } from './config/database';
import { CustomerController } from './controllers/customerController';
import { AccountController } from './controllers/accountController';
import { createCustomerRoutes } from './routes/customerRoutes';
import { createAccountRoutes } from './routes/accountRoutes';

const app = express();

// Trust proxy (behind nginx)
app.set('trust proxy', true);

// CORS configuration
app.use(cors({
  origin: config.cors.origin === '*' ? '*' : config.cors.origin.split(','),
  credentials: true,
}));

// Middleware
app.use(express.json());

// Initialize Prisma
const prisma = getPrismaClient();

// Controllers
const customerController = new CustomerController(prisma);
const accountController = new AccountController(prisma);

// Routes
app.use('/customers', createCustomerRoutes(customerController));
app.use('/accounts', createAccountRoutes(accountController));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API info endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'BSIM Open Banking API',
    version: '0.1.0',
    standard: 'FDX-inspired',
    endpoints: {
      customers: '/customers/current',
      accounts: '/accounts',
      accountDetails: '/accounts/{accountId}',
      transactions: '/accounts/{accountId}/transactions',
    },
    authorization: {
      type: 'OAuth 2.0 / OpenID Connect',
      issuer: config.auth.issuer,
      tokenEndpoint: `${config.auth.issuer}/token`,
      authorizationEndpoint: `${config.auth.issuer}/auth`,
    },
  });
});

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'server_error',
    error_description: config.nodeEnv === 'development' ? err.message : 'Internal server error',
  });
});

// Start server
const PORT = config.port;
app.listen(PORT, () => {
  console.log(`BSIM Open Banking API running on port ${PORT}`);
  console.log(`Environment: ${config.nodeEnv}`);
  console.log(`Auth Server Issuer: ${config.auth.issuer}`);
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
