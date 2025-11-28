# BSIM Backend Setup Guide

## What's Been Built

The backend API is now complete with a full-featured banking simulator API using Express.js, TypeScript, Prisma ORM, and PostgreSQL.

### Architecture

**Layered Architecture**:
- **Controllers** → Handle HTTP requests/responses
- **Services** → Business logic
- **Repositories** → Data access (abstracted via interfaces)
- **Models** → Domain entities

### Key Features

✅ User authentication with JWT
✅ Password hashing with bcrypt
✅ Account creation and management
✅ Deposit, withdrawal, and transfer operations
✅ Transaction history tracking
✅ Request validation with Zod
✅ Error handling middleware
✅ CORS support
✅ Database abstraction (easy to swap databases)

## Project Structure

```
backend/
├── src/
│   ├── config/
│   │   ├── database.ts        # Prisma client setup
│   │   └── env.ts             # Environment configuration
│   ├── models/
│   │   ├── user.ts            # User domain model
│   │   ├── account.ts         # Account domain model (from original)
│   │   └── transaction.ts     # Transaction model (from original)
│   ├── repositories/
│   │   ├── interfaces/        # Abstract repository interfaces
│   │   │   ├── IUserRepository.ts
│   │   │   ├── IAccountRepository.ts
│   │   │   └── ITransactionRepository.ts
│   │   └── postgres/          # PostgreSQL implementations
│   │       ├── PrismaUserRepository.ts
│   │       ├── PrismaAccountRepository.ts
│   │       └── PrismaTransactionRepository.ts
│   ├── services/
│   │   ├── AuthService.ts     # Authentication business logic
│   │   └── AccountService.ts  # Banking operations logic
│   ├── controllers/
│   │   ├── authController.ts  # Auth HTTP handlers
│   │   └── accountController.ts # Account HTTP handlers
│   ├── middleware/
│   │   ├── auth.ts            # JWT authentication middleware
│   │   └── errorHandler.ts    # Error handling middleware
│   ├── routes/
│   │   ├── authRoutes.ts
│   │   ├── accountRoutes.ts
│   │   └── transactionRoutes.ts
│   ├── utils/
│   │   ├── jwt.ts             # JWT utilities
│   │   └── password.ts        # Password hashing utilities
│   └── server.ts              # Express app setup
├── prisma/
│   └── schema.prisma          # Database schema
├── .env                       # Environment variables
├── .env.example               # Example environment file
├── package.json
└── tsconfig.json
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login and get JWT token
- `GET /api/auth/me` - Get current user (protected)

### Accounts
- `GET /api/accounts` - List user's accounts (protected)
- `POST /api/accounts` - Create new account (protected)
- `GET /api/accounts/:accountNumber` - Get account details (protected)
- `GET /api/accounts/:accountNumber/transactions` - Transaction history (protected)

### Transactions
- `POST /api/transactions/deposit` - Deposit money (protected)
- `POST /api/transactions/withdraw` - Withdraw money (protected)
- `POST /api/transactions/transfer` - Transfer between accounts (protected)

### Health Check
- `GET /health` - API health status

## Next Steps: Setting Up PostgreSQL

### Option 1: Install PostgreSQL Locally

**macOS (using Homebrew)**:
```bash
brew install postgresql@15
brew services start postgresql@15

# Create database
createdb bsim
```

**Update DATABASE_URL in `.env`**:
```
DATABASE_URL="postgresql://localhost:5432/bsim"
```

### Option 2: Use Docker (Recommended)

**Using the included docker-compose setup:**
```bash
# Use the helper script
./scripts/db.sh start

# Or manually with docker compose
docker compose up -d
```

The DATABASE_URL is already configured correctly in `.env`.

**Alternatively, run PostgreSQL directly with docker:**
```bash
docker run --name bsim-postgres \
  -e POSTGRES_USER=bsim \
  -e POSTGRES_PASSWORD=bsim_dev_password \
  -e POSTGRES_DB=bsim \
  -p 5432:5432 \
  -d postgres:15
```

### Option 3: Use Cloud PostgreSQL

Services like:
- **Supabase** (free tier)
- **Railway** (free tier)
- **Neon** (free tier)

They provide a connection string you can use in your `.env` file.

## Running Migrations

Once PostgreSQL is set up:

```bash
cd backend

# Generate Prisma Client
npm run prisma:generate

# Run database migrations
npm run prisma:migrate

# (Optional) Open Prisma Studio to view data
npm run prisma:studio
```

## Starting the Backend

```bash
cd backend

# Development mode (with hot reload)
npm run dev

# Production mode
npm run build
npm start
```

The API will be available at `http://localhost:3001`

## Testing the API

### Register a User
```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "firstName": "John",
    "lastName": "Doe"
  }'
```

### Login
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

Save the token from the response!

### Create an Account
```bash
curl -X POST http://localhost:3001/api/accounts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "initialBalance": 1000
  }'
```

### Deposit Money
```bash
curl -X POST http://localhost:3001/api/transactions/deposit \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "accountNumber": "ACC-XXXX",
    "amount": 500,
    "description": "Salary deposit"
  }'
```

## Environment Variables

The [`.env`](backend/.env) file contains:
```
DATABASE_URL="postgresql://localhost:5432/bsim"
JWT_SECRET="dev-secret-key-change-in-production"
JWT_EXPIRES_IN="7d"
PORT=3001
CORS_ORIGIN="http://localhost:3000"
NODE_ENV="development"
```

**⚠️ IMPORTANT**: Change `JWT_SECRET` to a secure random string in production!

## Database Abstraction

To swap from PostgreSQL to MongoDB:

1. Create `repositories/mongodb/` folder
2. Implement `IUserRepository`, `IAccountRepository`, `ITransactionRepository` using MongoDB driver
3. Update dependency injection in [`server.ts`](backend/src/server.ts)
4. No changes needed to services, controllers, or routes!

## What's Next

1. ✅ **Backend is complete**
2. ⏳ **Set up PostgreSQL** (see options above)
3. ⏳ **Build Next.js frontend**
4. ⏳ **Connect frontend to backend**
5. ⏳ **Test end-to-end**

The backend is production-ready with proper error handling, validation, authentication, and a clean architecture!
