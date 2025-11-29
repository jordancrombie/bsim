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
import { PrismaCreditCardRepository } from './repositories/postgres/PrismaCreditCardRepository';
import { PrismaCreditCardTransactionRepository } from './repositories/postgres/PrismaCreditCardTransactionRepository';

// Services
import { AuthService } from './services/AuthService';
import { AccountService } from './services/AccountService';
import { PasskeyService } from './services/PasskeyService';
import { CreditCardService } from './services/CreditCardService';

// Controllers
import { AuthController } from './controllers/authController';
import { AccountController } from './controllers/accountController';
import { CreditCardController } from './controllers/creditCardController';

// Routes
import { createAuthRoutes } from './routes/authRoutes';
import { createAccountRoutes } from './routes/accountRoutes';
import { createTransactionRoutes } from './routes/transactionRoutes';
import { createCreditCardRoutes } from './routes/creditCardRoutes';
import { createCreditCardTransactionRoutes } from './routes/creditCardTransactionRoutes';

const app = express();

// CORS configuration that supports subdomains
const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      return callback(null, true);
    }

    // Get allowed origins from config
    const allowedOrigins = Array.isArray(config.cors.origin) ? config.cors.origin : [config.cors.origin];

    // Check if origin is in allowed list
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // Check if origin matches *.banksim.ca pattern
    const domain = process.env.DOMAIN || 'banksim.ca';
    const subdomainPattern = new RegExp(`^https://[a-zA-Z0-9-]+\\.${domain.replace('.', '\\.')}$`);
    if (subdomainPattern.test(origin)) {
      return callback(null, true);
    }

    // Otherwise, reject
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());

// Initialize dependencies
const prisma = getPrismaClient();

// Repositories
const userRepository = new PrismaUserRepository(prisma);
const accountRepository = new PrismaAccountRepository(prisma);
const transactionRepository = new PrismaTransactionRepository(prisma);
const creditCardRepository = new PrismaCreditCardRepository(prisma);
const creditCardTransactionRepository = new PrismaCreditCardTransactionRepository(prisma);

// Services
const authService = new AuthService(userRepository);
const accountService = new AccountService(accountRepository, transactionRepository);
const passkeyService = new PasskeyService(userRepository, prisma);
const creditCardService = new CreditCardService(creditCardRepository, creditCardTransactionRepository);

// Controllers
const authController = new AuthController(authService, passkeyService);
const accountController = new AccountController(accountService);
const creditCardController = new CreditCardController(creditCardService);

// Routes
app.use('/api/auth', createAuthRoutes(authController));
app.use('/api/accounts', createAccountRoutes(accountController));
app.use('/api/transactions', createTransactionRoutes(accountController));
app.use('/api/credit-cards', createCreditCardRoutes(creditCardController));
app.use('/api/credit-card-transactions', createCreditCardTransactionRoutes(creditCardController));

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
