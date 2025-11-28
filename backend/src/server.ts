import express from 'express';
import https from 'https';
import fs from 'fs';
import path from 'path';
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
import { PasskeyService } from './services/PasskeyService';

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
const passkeyService = new PasskeyService(userRepository, prisma);

// Controllers
const authController = new AuthController(authService, passkeyService);
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
const USE_HTTPS = process.env.USE_HTTPS === 'true';
const DOMAIN = process.env.DOMAIN || 'localhost';

if (USE_HTTPS) {
  // HTTPS server with SSL certificates
  const certPath = path.join(__dirname, '../../certs');
  const httpsOptions = {
    key: fs.readFileSync(path.join(certPath, 'banksim.ca.key')),
    cert: fs.readFileSync(path.join(certPath, 'banksim.ca.crt')),
  };

  https.createServer(httpsOptions, app).listen(PORT, () => {
    console.log(`🔒 BSIM Backend API running with HTTPS`);
    console.log(`   Local:          https://localhost:${PORT}`);
    console.log(`   Network:        https://${DOMAIN}:${PORT}`);
    console.log(`   Environment:    ${config.nodeEnv}`);
    console.log(`   WebAuthn RP ID: ${process.env.RP_ID || DOMAIN}`);
  });
} else {
  // HTTP server (development only)
  app.listen(PORT, () => {
    console.log(`BSIM Backend API running on http://localhost:${PORT}`);
    console.log(`Environment: ${config.nodeEnv}`);
    console.log(`CORS origin: ${config.cors.origin}`);
  });
}

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
