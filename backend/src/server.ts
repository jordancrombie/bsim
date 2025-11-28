import express from 'express';
import cors from 'cors';
import { config } from './config/env';
import { getPrismaClient } from './config/database';
import { errorHandler } from './middleware/errorHandler';

// Repositories
import { PrismaUserRepository } from './repositories/postgres/PrismaUserRepository';
import { PrismaAccountRepository } from './repositories/postgres/PrismaAccountRepository';
import { PrismaTransactionRepository } from './repositories/postgres/PrismaTransactionRepository';

// Services
import { AuthService } from './services/AuthService';
import { AccountService } from './services/AccountService';

// Controllers
import { AuthController } from './controllers/authController';
import { AccountController } from './controllers/accountController';

// Routes
import { createAuthRoutes } from './routes/authRoutes';
import { createAccountRoutes } from './routes/accountRoutes';
import { createTransactionRoutes } from './routes/transactionRoutes';

const app = express();

// Middleware
app.use(cors({ origin: config.cors.origin }));
app.use(express.json());

// Initialize dependencies
const prisma = getPrismaClient();

// Repositories
const userRepository = new PrismaUserRepository(prisma);
const accountRepository = new PrismaAccountRepository(prisma);
const transactionRepository = new PrismaTransactionRepository(prisma);

// Services
const authService = new AuthService(userRepository);
const accountService = new AccountService(accountRepository, transactionRepository);

// Controllers
const authController = new AuthController(authService);
const accountController = new AccountController(accountService);

// Routes
app.use('/api/auth', createAuthRoutes(authController));
app.use('/api/accounts', createAccountRoutes(accountController));
app.use('/api/transactions', createTransactionRoutes(accountController));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handler (must be last)
app.use(errorHandler);

// Start server
const PORT = config.port;
app.listen(PORT, () => {
  console.log(`BSIM Backend API running on port ${PORT}`);
  console.log(`Environment: ${config.nodeEnv}`);
  console.log(`CORS origin: ${config.cors.origin}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  await prisma.$disconnect();
  process.exit(0);
});
