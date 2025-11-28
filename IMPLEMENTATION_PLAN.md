# BSIM Full Stack Implementation Plan

## Architecture Overview

### Key Principles
1. **Separation of Concerns**: Backend API and Frontend are completely separate
2. **Database Abstraction**: Repository pattern for easy database swapping
3. **API-First**: RESTful API that works for web and future mobile apps
4. **Preserve Business Logic**: Keep existing Account/Transaction domain models

## Project Structure

```
bsim/
├── backend/                    # Express.js API server
│   ├── src/
│   │   ├── config/            # Configuration (DB, JWT, etc.)
│   │   ├── models/            # Domain models (Account, Transaction, User)
│   │   ├── repositories/      # Data access layer (abstraction)
│   │   │   ├── interfaces/    # Repository interfaces
│   │   │   └── postgres/      # PostgreSQL implementations
│   │   ├── services/          # Business logic layer
│   │   ├── controllers/       # HTTP request handlers
│   │   ├── middleware/        # Auth, validation, error handling
│   │   ├── routes/            # API route definitions
│   │   ├── utils/             # Helpers (JWT, password hashing)
│   │   └── server.ts          # Express app setup
│   ├── prisma/                # Prisma ORM schema & migrations
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/                   # Next.js web application
│   ├── src/
│   │   ├── app/               # Next.js 13+ app directory
│   │   │   ├── (auth)/        # Auth pages (login, signup)
│   │   │   ├── dashboard/     # Protected dashboard
│   │   │   └── layout.tsx     # Root layout
│   │   ├── components/        # Reusable UI components
│   │   ├── lib/               # API client, utilities
│   │   ├── hooks/             # Custom React hooks
│   │   └── types/             # TypeScript types
│   ├── public/
│   ├── package.json
│   └── tsconfig.json
│
└── shared/                     # Shared types between frontend/backend
    └── types/
        ├── user.ts
        ├── account.ts
        └── api.ts
```

## Technology Stack

### Backend
- **Framework**: Express.js with TypeScript
- **Database ORM**: Prisma (supports easy DB swapping)
- **Database**: PostgreSQL (initial), designed for easy swap
- **Authentication**: JWT (jsonwebtoken)
- **Password Hashing**: bcrypt
- **Validation**: Zod
- **Environment**: dotenv

### Frontend
- **Framework**: Next.js 14+ (App Router)
- **Styling**: Tailwind CSS
- **HTTP Client**: Axios
- **State Management**: React Context + hooks
- **Forms**: React Hook Form + Zod

## Database Schema (Prisma)

```prisma
model User {
  id        String   @id @default(uuid())
  email     String   @unique
  password  String   // hashed
  firstName String
  lastName  String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  accounts  Account[]
}

model Account {
  id            String        @id @default(uuid())
  accountNumber String        @unique
  balance       Decimal       @default(0)
  userId        String
  user          User          @relation(fields: [userId], references: [id])
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt
  transactions  Transaction[]
}

model Transaction {
  id           String          @id @default(uuid())
  type         TransactionType
  amount       Decimal
  balanceAfter Decimal
  description  String?
  accountId    String
  account      Account         @relation(fields: [accountId], references: [id])
  createdAt    DateTime        @default(now())
}

enum TransactionType {
  DEPOSIT
  WITHDRAWAL
  TRANSFER
}
```

## Repository Pattern (Database Abstraction)

### Interface Layer
```typescript
// backend/src/repositories/interfaces/IUserRepository.ts
export interface IUserRepository {
  create(data: CreateUserDto): Promise<User>;
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
}

// backend/src/repositories/interfaces/IAccountRepository.ts
export interface IAccountRepository {
  create(userId: string, initialBalance: number): Promise<Account>;
  findByAccountNumber(accountNumber: string): Promise<Account | null>;
  findByUserId(userId: string): Promise<Account[]>;
  updateBalance(accountId: string, newBalance: number): Promise<void>;
}

// backend/src/repositories/interfaces/ITransactionRepository.ts
export interface ITransactionRepository {
  create(data: CreateTransactionDto): Promise<Transaction>;
  findByAccountId(accountId: string): Promise<Transaction[]>;
}
```

### PostgreSQL Implementation
- Use Prisma client to implement these interfaces
- All database-specific code stays in `repositories/postgres/`
- Easy to add `repositories/mongodb/` later

## API Endpoints

### Authentication
- `POST /api/auth/register` - Create new user account
- `POST /api/auth/login` - Login and receive JWT token
- `GET /api/auth/me` - Get current user info (protected)

### Accounts
- `GET /api/accounts` - Get all user's accounts (protected)
- `POST /api/accounts` - Create new bank account (protected)
- `GET /api/accounts/:accountNumber` - Get account details (protected)

### Transactions
- `POST /api/transactions/deposit` - Deposit money (protected)
- `POST /api/transactions/withdraw` - Withdraw money (protected)
- `POST /api/transactions/transfer` - Transfer between accounts (protected)
- `GET /api/accounts/:accountNumber/transactions` - Get transaction history (protected)

## Authentication Flow

### Registration
1. User submits email, password, firstName, lastName
2. Backend validates input
3. Hash password with bcrypt
4. Create user in database
5. Return JWT token + user data

### Login
1. User submits email, password
2. Backend finds user by email
3. Compare password hash
4. Generate JWT token
5. Return JWT token + user data

### Protected Routes
1. Frontend sends JWT in Authorization header
2. Backend middleware validates JWT
3. Attach user info to request
4. Proceed to route handler

## Frontend Pages

### Public Pages
- `/` - Landing page
- `/login` - Login form
- `/signup` - Registration form

### Protected Pages (require authentication)
- `/dashboard` - Main dashboard, account overview
- `/dashboard/accounts` - List of all accounts
- `/dashboard/accounts/[id]` - Account details + transactions
- `/dashboard/transfer` - Transfer money form

## Implementation Phases

### Phase 1: Backend Foundation
1. Set up backend project structure
2. Install dependencies (Express, Prisma, JWT, bcrypt, etc.)
3. Configure Prisma with PostgreSQL
4. Define database schema
5. Run migrations

### Phase 2: Repository Layer
1. Define repository interfaces
2. Implement PostgreSQL repositories using Prisma
3. Create dependency injection setup

### Phase 3: Backend Services & API
1. Migrate existing Account/Transaction models
2. Create AuthService, AccountService, TransactionService
3. Implement JWT utilities
4. Create middleware (auth, error handling)
5. Build controllers and routes
6. Add validation with Zod

### Phase 4: Frontend Foundation
1. Set up Next.js project
2. Install dependencies (Tailwind, Axios, etc.)
3. Configure Tailwind CSS
4. Create API client service
5. Set up authentication context

### Phase 5: Frontend UI
1. Build authentication pages (login, signup)
2. Build dashboard layout
3. Build account components
4. Build transaction forms
5. Build transaction history view

### Phase 6: Integration & Testing
1. Test authentication flow end-to-end
2. Test all banking operations
3. Test error scenarios
4. Add loading states and error handling

## Environment Variables

### Backend (.env)
```
DATABASE_URL="postgresql://user:password@localhost:5432/bsim"
JWT_SECRET="your-secret-key"
JWT_EXPIRES_IN="7d"
PORT=3001
CORS_ORIGIN="http://localhost:3000"
```

### Frontend (.env.local)
```
NEXT_PUBLIC_API_URL="http://localhost:3001/api"
```

## Future Extensibility

### Database Swapping
To swap from PostgreSQL to MongoDB:
1. Create `repositories/mongodb/` folder
2. Implement the same repository interfaces
3. Update dependency injection to use MongoDB repositories
4. No changes needed to services, controllers, or frontend

### Mobile App
The API is already mobile-ready:
1. Create React Native or Flutter app
2. Use same authentication (JWT)
3. Call same API endpoints
4. Reuse business logic validation

## Next Steps

Once this plan is approved, I will:
1. Restructure the project with backend/ and frontend/ folders
2. Preserve existing domain models
3. Implement Phase 1-6 systematically
4. Ensure everything is working end-to-end

---

**Questions or modifications before we proceed?**
