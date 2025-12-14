<p align="center">
  <img src="docs/images/bsim-logo.png" alt="BSIM Logo" width="400">
</p>

# BSIM - Banking Simulator

A full-stack banking simulator application with passwordless authentication (WebAuthn/passkeys), account management, and transaction processing. Built with TypeScript, Express.js, PostgreSQL, and Next.js.

## Features

- 🔐 **Passwordless Authentication** with WebAuthn/Passkeys (biometric login)
- 🔑 JWT token-based sessions
- 💰 Account creation and management
- 💳 **Credit Card System** with charges, payments, and refunds
- 📊 Transaction tracking (deposits, withdrawals, transfers)
- 🛠️ **Admin Interface** - Separate admin dashboard for user management
- 🏦 **Open Banking Platform** - OAuth 2.0/OIDC for third-party data access (FDX-inspired)
- 💳 **Payment Network Integration** - Card payment processing via NSIM middleware
- 📱 **Digital Wallet Support** - Card enrollment API for wallet providers (WSIM)
- 🗄️ PostgreSQL database with Prisma ORM
- 🐳 **Full Docker containerization** for development and production
- 🚀 **AWS ECS Fargate deployment ready** with ElastiCache Redis
- 🏗️ Clean architecture with repository pattern
- 🔒 HTTPS support with configurable domain names and wildcard subdomains
- 🌐 Dynamic subdomain support (works with any *.domain.com)
- 🎨 **Configurable branding** - Custom logo and site name via admin interface
- 🔄 Database-agnostic design (easy to swap PostgreSQL for MongoDB)

## Quick Start

### Option 1: Docker Compose - Local Development (Recommended)

The fastest way to run the entire stack locally with dev subdomains:

```bash
# Configure local DNS or add to /etc/hosts:
# 127.0.0.1 dev.banksim.ca admin-dev.banksim.ca auth-dev.banksim.ca openbanking-dev.banksim.ca ssim-dev.banksim.ca wsim-dev.banksim.ca wsim-auth-dev.banksim.ca

# Build and start all services with dev configuration
make dev-build

# Or start without rebuilding
make dev-up

# View logs
make dev-logs

# Stop all services
make dev-down

# Show required DNS entries
make dev-hosts
```

Access the application (local development):
- **Frontend**: https://dev.banksim.ca
- **Admin Interface**: https://admin-dev.banksim.ca
- **Authorization Server**: https://auth-dev.banksim.ca
- **Open Banking API**: https://openbanking-dev.banksim.ca
- **Store Simulator**: https://ssim-dev.banksim.ca
- **Wallet Simulator**: https://wsim-dev.banksim.ca
- **Wallet Auth Server**: https://wsim-auth-dev.banksim.ca
- **Database**: localhost:5432

### Option 2: Docker Compose - Production

For production deployment (uses root domain):

```bash
# Start all services with production configuration
docker compose up -d

# View logs
docker compose logs -f

# Stop all services
docker compose down
```

Access the application (production):
- **Frontend (HTTPS)**: https://banksim.ca
- **Admin Interface**: https://admin.banksim.ca
- **Authorization Server**: https://auth.banksim.ca (OIDC Provider)
- **Open Banking API**: https://openbanking.banksim.ca (FDX-style API)
- **Backend API (HTTPS)**: https://banksim.ca/api/health

Note: The application runs with SSL/HTTPS using nginx as a reverse proxy. See [docs/DOCKER_SSL_SETUP.md](docs/DOCKER_SSL_SETUP.md) for details.

### Option 3: Local Development (Without Docker)

#### Prerequisites
- Node.js 18+
- Docker Desktop (for PostgreSQL)

#### 1. Start the Database

```bash
# Start Docker Desktop first, then:
./scripts/db.sh start
```

#### 2. Set Up and Run Backend

```bash
cd backend

# Install dependencies
npm install

# Generate Prisma client and run migrations
npm run prisma:generate
npm run prisma:migrate

# Start the development server
npm run dev
```

The API will be available at `http://localhost:3001`

#### 3. Set Up and Run Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start the development server
npm run dev
```

The frontend will be available at `http://localhost:3000`

### Testing the Application

Visit http://localhost:3000 and try:
1. **Sign Up** - Create an account using passkey/biometric authentication
2. **Create Account** - Set up a banking account
3. **Make Transactions** - Test deposits, withdrawals, and transfers

## Documentation

- **[QUICKSTART.md](QUICKSTART.md)** - Get started in 5 minutes
- **[docs/BACKEND_SETUP.md](docs/BACKEND_SETUP.md)** - Detailed backend documentation
- **[auth-server/README.md](auth-server/README.md)** - Authorization Server (OIDC) documentation
- **[docs/DOCKER_SSL_SETUP.md](docs/DOCKER_SSL_SETUP.md)** - SSL/HTTPS configuration for local and AWS
- **[docs/AWS_DEPLOYMENT.md](docs/AWS_DEPLOYMENT.md)** - Deploy to AWS ECS Fargate

## Related Repositories

### SSIM - Store Simulator

SSIM is a third-party demo application that demonstrates the BSIM Open Banking integration. It allows users to authenticate via BSIM's OAuth/OIDC provider and access their account data through the Open Banking API.

- **Repository:** https://github.com/jordancrombie/ssim
- **Production URL:** https://ssim.banksim.ca
- **Purpose:** Demo third-party app for testing OAuth flow and Open Banking API

**Note:** SSIM is maintained in a separate repository but deployed as part of the BSIM AWS infrastructure. It shares the same ALB and runs as an ECS Fargate service alongside the BSIM services. See the SSIM repository's `AWS_DEPLOYMENT.md` for deployment details.

### WSIM - Wallet Simulator

WSIM is a digital wallet application that integrates with BSIM for card enrollment and tokenized payments. It demonstrates wallet-based payment flows where users enroll their BSIM cards and use them for contactless payments at merchants.

- **Repository:** https://github.com/jordancrombie/wsim
- **Dev URL:** https://wsim-dev.banksim.ca
- **Production URL:** https://wsim.banksim.ca
- **Auth Server:** https://wsim-auth.banksim.ca (OIDC Provider for wallet authentication)
- **AWS Resources:** ECS Fargate services (3), shared RDS database (wsim schema), CloudWatch logs
- **Features:**
  - Card enrollment via BSIM OAuth flow (`wallet:enroll` scope)
  - Multi-card wallet with user-selected cards
  - Ephemeral payment token generation (JWT with 5-minute TTL)
  - Integration with SSIM for wallet-based checkout
  - Passkey authentication for wallet access
  - **Mobile app payment flow** - mwsim app approval via `POST /api/wallet/request-token`

**Wallet Payment Flow:**
```
┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
│  SSIM   │────>│  WSIM   │────>│  BSIM   │     │  NSIM   │────>│  BSIM   │
│(Merchant)│    │ (Wallet)│     │(Enroll) │     │(Network)│     │(Issuer) │
└─────────┘     └─────────┘     └─────────┘     └─────────┘     └─────────┘
     │               │               │               │               │
     │ 1. Checkout   │               │               │               │
     ├──────────────>│               │               │               │
     │               │ 2. Get Token  │               │               │
     │               ├──────────────>│               │               │
     │               │ 3. JWT Token  │               │               │
     │               │<──────────────│               │               │
     │ 4. Card Token │               │               │               │
     │<──────────────│               │               │               │
     │               │               │ 5. Authorize  │               │
     ├───────────────────────────────────────────────>│               │
     │               │               │               │ 6. Validate   │
     │               │               │               ├──────────────>│
     │               │               │               │ 7. Approved   │
     │               │               │               │<──────────────│
     │ 8. Payment OK │               │               │               │
     │<──────────────────────────────────────────────│               │
```

### NSIM - Payment Network Simulator

NSIM is the payment network middleware that routes card payments between merchants (SSIM) and banks (BSIM). It provides a complete payment processing infrastructure with webhooks, retry logic, and authorization expiry handling.

- **Repository:** https://github.com/jordancrombie/nsim
- **Dev URL:** https://payment-dev.banksim.ca
- **Production URL:** https://payment.banksim.ca
- **AWS Resources:** ECS Fargate service, ElastiCache Redis, CloudWatch logs
- **Features:**
  - Payment authorization, capture, void, and refund
  - Webhook notifications for payment events (`payment.authorized`, `payment.captured`, etc.)
  - Redis-backed job queue (BullMQ) for async webhook delivery
  - Automatic retry with exponential backoff (up to 5 retries)
  - Authorization expiry handling (7-day default, auto-void on expiry)
  - HMAC-SHA256 webhook signature verification
  - **Wallet token support** - JWT wallet payment tokens from WSIM are decoded and validated

**End-to-End Payment Flow:**
```
┌─────────┐     ┌──────────┐     ┌─────────────┐     ┌──────────┐
│  SSIM   │────>│   Auth   │────>│    NSIM     │────>│   BSIM   │
│(Merchant)│    │  Server  │     │  (payment.  │     │(Backend) │
│         │<───│(consent) │<────│banksim.ca)  │<────│          │
└─────────┘     └──────────┘     └─────────────┘     └──────────┘
```

1. Customer initiates checkout on SSIM
2. SSIM redirects to BSIM auth server with `payment:authorize` scope
3. Customer selects credit card and consents
4. SSIM receives card token via OAuth callback
5. SSIM calls NSIM `/api/v1/payments/authorize` with card token
6. NSIM calls BSIM `/api/payment-network/authorize` to place hold
7. NSIM sends webhook to SSIM with payment status
8. SSIM captures/voids payment as needed

See [docs/NSIM_PRODUCTION_DEPLOYMENT.md](docs/NSIM_PRODUCTION_DEPLOYMENT.md) for AWS deployment.

## Project Structure

```
bsim/
├── backend/                # Express.js API server
│   ├── src/
│   │   ├── config/        # Configuration
│   │   ├── models/        # Domain models
│   │   ├── repositories/  # Data access layer
│   │   ├── services/      # Business logic
│   │   ├── controllers/   # HTTP handlers
│   │   ├── middleware/    # Auth & error handling
│   │   ├── routes/        # API routes
│   │   └── utils/         # Helper functions
│   └── prisma/            # Database schema
├── frontend/              # Next.js customer-facing app
├── admin/                 # Next.js admin interface (separate container)
│   ├── app/              # Next.js App Router pages
│   │   ├── users/        # User management pages
│   │   └── api/          # Admin API routes
│   ├── lib/              # Prisma client
│   └── prisma/           # Database schema (shared)
├── auth-server/           # OpenID Connect Authorization Server
│   ├── src/
│   │   ├── config/       # OIDC provider configuration
│   │   ├── adapters/     # Prisma adapter for token storage
│   │   ├── routes/       # Interaction routes (login, consent)
│   │   └── views/        # EJS templates for consent UI
│   └── prisma/           # Database schema (shared)
├── openbanking/           # Open Banking API (FDX-inspired)
│   ├── src/
│   │   ├── controllers/  # API controllers
│   │   ├── middleware/   # Token validation
│   │   ├── services/     # Consent verification
│   │   └── routes/       # API routes
│   └── prisma/           # Database schema (shared)
├── shared/                # Shared types
├── scripts/               # Helper scripts
│   └── db.sh             # Database management
├── nginx/                 # nginx reverse proxy config
└── docker-compose.yml     # Full stack orchestration
```

## API Endpoints

### Authentication (WebAuthn/Passkeys)
- `POST /api/passkeys/register-options` - Get passkey registration options
- `POST /api/passkeys/register-verify` - Verify and complete passkey registration
- `POST /api/passkeys/login-options` - Get passkey login options
- `POST /api/passkeys/login-verify` - Verify passkey and get JWT token
- `GET /api/auth/me` - Get current user (protected)

### Accounts
- `GET /api/accounts` - List user's accounts (protected)
- `POST /api/accounts` - Create new account (protected)
- `GET /api/accounts/:accountNumber` - Get account details (protected)
- `GET /api/accounts/:accountNumber/transactions` - Transaction history (protected)

### Transactions
- `POST /api/transactions/deposit` - Deposit money (protected)
- `POST /api/transactions/withdraw` - Withdraw money (protected)
- `POST /api/transactions/transfer` - Transfer money (protected)

**Transfer Request Fields:**
| Field | Type | Description |
|-------|------|-------------|
| `fromAccountNumber` | string | Source account number (required) |
| `toAccountNumber` | string | Destination account number (optional*) |
| `toEmail` | string | Recipient email address (optional*) |
| `amount` | number | Transfer amount (required) |
| `description` | string | Transaction description |

*Either `toAccountNumber` or `toEmail` is required. Using `toEmail` sends funds to the recipient's primary account.

### Credit Cards
- `POST /api/credit-cards` - Create new credit card (protected)
- `GET /api/credit-cards` - List user's credit cards (protected)
- `GET /api/credit-cards/:cardNumber` - Get card details (protected)
- `GET /api/credit-cards/:cardNumber/transactions` - Card transaction history (protected)
- `POST /api/credit-card-transactions/charge` - Charge to card (protected)
- `POST /api/credit-card-transactions/payment` - Make payment (protected)
- `POST /api/credit-card-transactions/refund` - Process refund (protected)

**Charge Request Fields:**
| Field | Type | Description |
|-------|------|-------------|
| `cardNumber` | string | Credit card number (required) |
| `amount` | number | Charge amount (required) |
| `description` | string | Transaction description |
| `merchantName` | string | Name of the merchant |
| `merchantId` | string | Merchant identifier |
| `mccCode` | string | Merchant Category Code (e.g., "5411" for grocery) |
| `transactionDate` | string | ISO 8601 datetime of transaction |

### Site Settings
- `GET /api/settings` - Get site settings (logo URL, site name)

## Admin Interface

The admin interface runs as a separate Next.js application accessible at `https://admin.banksim.ca`.

### Features
- **Dashboard** - System statistics (users, accounts, credit cards) with clickable cards
- **User Management** - View all registered users
- **User Details** - View user's accounts, credit cards, and passkeys
- **Site Settings** - Configure site logo and name displayed on user login page
- **WebAuthn Origins** - Manage cross-domain passkey authentication (Related Origin Requests)

### Access
```bash
# With DNS configured for admin.banksim.ca:
https://admin.banksim.ca

# Or test locally with curl:
curl --resolve admin.banksim.ca:443:127.0.0.1 https://admin.banksim.ca/
```

The admin interface connects directly to the PostgreSQL database and runs in its own Docker container for independent deployment and scaling.

## Open Banking Platform

BSIM includes a complete Open Banking implementation allowing third-party applications to access customer data with user consent.

### Architecture

- **Authorization Server** (`auth.banksim.ca`) - OpenID Connect provider using oidc-provider
- **Resource Server** (`openbanking.banksim.ca`) - FDX-inspired API for account and transaction data

### OAuth 2.0 Flow

1. Third-party app redirects user to Authorization Server
2. User logs in and sees consent screen with requested scopes
3. User selects which accounts to share
4. Authorization code is returned to third-party app
5. App exchanges code for access token
6. App calls Open Banking API with access token

### Supported Scopes

| Scope | Description |
|-------|-------------|
| `openid` | OpenID Connect authentication |
| `profile` | User profile (name) |
| `email` | User email address |
| `fdx:accountdetailed:read` | Read account details and balances |
| `fdx:transactions:read` | Read transaction history |
| `fdx:customercontact:read` | Read customer contact information |
| `payment:authorize` | Authorize payment with selected credit card (returns card token) |

### Open Banking API Endpoints

- `GET /users/{fi_user_ref}/accounts` - List user's accounts (fi_user_ref must match token sub)
- `GET /customers/current` - Get authenticated user's profile
- `GET /accounts` - List accounts the user consented to share
- `GET /accounts/{accountId}` - Get account details and balance
- `GET /accounts/{accountId}/transactions` - Get transaction history

**Note:** The `fi_user_ref` is the user's external identifier (UUID) returned as the `sub` claim in both ID tokens and access tokens. Third-party apps should use this value when calling user-specific endpoints.

### OIDC Discovery

```bash
# Get OIDC configuration
curl https://auth.banksim.ca/.well-known/openid-configuration

# Get JSON Web Key Set (for token verification)
curl https://auth.banksim.ca/.well-known/jwks.json
```

### Registering OAuth Clients

OAuth clients are stored in the database and loaded dynamically by the authorization server.

#### Option 1: Admin Interface (Recommended)

Navigate to **https://auth.banksim.ca/administration** to:
- View all registered OAuth clients
- Create new clients with auto-generated secrets
- Edit client settings (redirect URIs, scopes, branding)
- Regenerate client secrets
- Enable/disable clients

#### Option 2: Direct Database Insert

```bash
# Generate a secure client secret
openssl rand -hex 32

# Connect to the database
docker exec -it bsim-db psql -U bsim
```

```sql
INSERT INTO oauth_clients (
  id, "clientId", "clientSecret", "clientName",
  "redirectUris", "grantTypes", "responseTypes", scope,
  "isActive", "createdAt", "updatedAt"
) VALUES (
  gen_random_uuid(),
  'your-client-id',
  'your-generated-secret',  -- plaintext (not bcrypt hashed)
  'Your App Name',
  ARRAY['https://yourapp.com/callback', 'http://localhost:3000/callback'],
  ARRAY['authorization_code'],  -- NOT 'refresh_token'! See warning below
  ARRAY['code'],
  'openid profile email fdx:accountdetailed:read fdx:transactions:read offline_access',
  true,
  NOW(), NOW()
);
```

**Important Notes:**
- Client secrets are stored in **plaintext** (oidc-provider performs direct string comparison)
- Include both production and development redirect URIs
- The `grantTypes` and `responseTypes` arrays are required for proper OAuth flow
- Set `isActive` to `true` to enable the client

> **⚠️ Warning: Valid Grant Types**
>
> Only use valid OAuth 2.0 grant types in `grantTypes`:
> - `authorization_code` - Standard authorization code flow
> - `implicit` - Implicit flow (not recommended)
> - `client_credentials` - Server-to-server
>
> **Do NOT include `refresh_token`** - it's a token type, not a grant type!
> To enable refresh tokens, use `authorization_code` grant and include `offline_access` in the scope.

**Registered Clients:**
| Client ID | Application | Description |
|-----------|-------------|-------------|
| `ssim-client` | SSIM Store Simulator | Demo third-party app for testing OAuth flow |

## Testing

The backend includes a comprehensive unit test suite using Jest.

### Running Tests

```bash
# Backend tests (229 tests)
cd backend
npm test

# Open Banking tests (74 tests)
cd openbanking
npm test

# Auth Server tests (62 tests)
cd auth-server
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

### Test Coverage

The test suite covers:

**Authentication (AuthService & AuthController)**
- User registration with validation
- Login with email/password
- JWT token generation and verification
- Password hashing
- Get current user

**Account Management (AccountService)**
- Account creation with initial balance
- Deposit and withdrawal operations
- Transfer between accounts
- Transaction history
- Balance validation and error handling

**Credit Card System (CreditCardService)**
- Credit card creation with card types (Visa, Mastercard, AMEX)
- Card number generation with correct prefixes
- Charge operations with merchant details
- Payment processing
- Refund handling
- Credit limit validation

**Notification System (NotificationService & NotificationController)**
- Notification CRUD operations
- Unread count and mark as read
- Mark all as read
- Transfer received/sent notifications
- Authentication and authorization checks

**Account Controller (AccountController)**
- Account creation with initial balance
- Get accounts and account details
- Deposit and withdrawal operations
- Transfer by account number or email
- Ownership validation (403 Forbidden)
- Transaction history

**Credit Card Controller (CreditCardController)**
- Credit card creation with card types
- Get cards and card details
- Charge, payment, and refund operations
- Ownership validation (403 Forbidden)
- Transaction history with merchant details

**Passkey/WebAuthn (PasskeyService)**
- Registration options generation
- Registration verification and passkey storage
- Authentication options generation
- Authentication verification
- Passkey CRUD operations (list, delete)
- Challenge management

**Open Banking Module** (74 tests)
- ConsentService: consent management, account filtering, scope verification
- tokenValidator middleware: JWT validation, scope checking, JWKS integration
- AccountController: FDX-style account listing, details, transactions
- CustomerController: scope-based profile data (profile, email, contact info)
- UserController: fi_user_ref based account lookup

**Auth Server** (62 tests)
- PrismaAdapter: OIDC token storage, upsert, find, consume, destroy, revoke
- verifyUserPassword: credential validation, password verification
- Admin routes: OAuth client CRUD, secret generation, client management
- Interaction routes: login flow, consent flow, abort handling

### Test Architecture

Tests use mock repositories that store data in memory, allowing fast isolated tests without database dependencies:

```
src/__tests__/
├── setup.ts                    # Test environment configuration
├── mocks/
│   ├── MockUserRepository.ts
│   ├── MockAccountRepository.ts
│   ├── MockTransactionRepository.ts
│   ├── MockCreditCardRepository.ts
│   ├── MockCreditCardTransactionRepository.ts
│   └── MockNotificationRepository.ts
├── services/
│   ├── AuthService.test.ts
│   ├── AccountService.test.ts
│   ├── CreditCardService.test.ts
│   ├── NotificationService.test.ts
│   └── PasskeyService.test.ts
└── controllers/
    ├── AuthController.test.ts
    ├── AccountController.test.ts
    ├── CreditCardController.test.ts
    └── NotificationController.test.ts
```

## Development

### Database Management

```bash
# Start database
./scripts/db.sh start

# Stop database
./scripts/db.sh stop

# View database in GUI
./scripts/db.sh studio

# Run migrations
./scripts/db.sh migrate

# Reset database (deletes all data)
./scripts/db.sh reset

# View logs
./scripts/db.sh logs
```

### Running the Backend

```bash
cd backend

# Development mode (with hot reload)
npm run dev

# Build for production
npm run build

# Run production build
npm start
```

## Architecture

### Repository Pattern

The application uses the repository pattern for database abstraction:

```
Controllers → Services → Repositories → Database
```

**Benefits:**
- Easy to swap databases (PostgreSQL ↔ MongoDB)
- Clean separation of concerns
- Testable business logic
- No database-specific code in services

### Tech Stack

**Backend:**
- Express.js - Web framework
- TypeScript - Type safety
- Prisma ORM - Database toolkit
- PostgreSQL - Database
- JWT - Authentication
- bcrypt - Password hashing
- Zod - Validation

**Frontend:**
- Next.js 14 (App Router)
- React 18
- TypeScript
- Tailwind CSS
- WebAuthn/Passkeys API
- Axios for API calls

## Environment Variables

Backend ([backend/.env](backend/.env)):
```env
DATABASE_URL="postgresql://bsim:bsim_dev_password@localhost:5432/bsim"
JWT_SECRET="dev-secret-key-change-in-production"
JWT_EXPIRES_IN="7d"
PORT=3001
CORS_ORIGIN="http://localhost:3000"
NODE_ENV="development"
```

⚠️ **Important:** Change `JWT_SECRET` to a secure random string in production!

### S3 Storage (Production)

For production deployments, configure S3 for file storage instead of local filesystem:

```env
# Storage configuration
STORAGE_TYPE=s3
S3_BUCKET=your-bucket-name
S3_REGION=us-east-1
S3_ACCESS_KEY_ID=your-access-key
S3_SECRET_ACCESS_KEY=your-secret-key

# Optional: CloudFront CDN URL for faster delivery
CLOUDFRONT_URL=https://d123456.cloudfront.net

# Optional: S3-compatible endpoint (MinIO, DigitalOcean Spaces, etc.)
S3_ENDPOINT=https://your-endpoint.com
```

When `STORAGE_TYPE` is not set or set to `local`, files are stored in the container's `/app/uploads` directory (shared via Docker volume).

## Deployment

See [docs/AWS_DEPLOYMENT.md](docs/AWS_DEPLOYMENT.md) for complete instructions on deploying to AWS ECS Fargate.

## Roadmap

- [x] Backend API implementation
- [x] PostgreSQL database with Prisma ORM
- [x] WebAuthn/Passkey authentication
- [x] Next.js frontend
- [x] Full Docker containerization
- [x] AWS deployment documentation
- [x] Credit card system
- [x] Admin interface
- [x] Configurable branding (logo and site name)
- [x] S3 storage support for production deployments
- [x] Open Banking platform (OAuth 2.0/OIDC, FDX-inspired API)
- [x] OAuth client administration interface
- [x] OIDC auto-discovery (`.well-known/openid-configuration`)
- [x] Unit test suite (Jest) - 462 tests across backend, open banking, auth-server, and admin
- [x] Session management (view/revoke active OAuth sessions)
- [x] E2E test suite (Playwright) - 76 tests for auth, banking, transfers, and OIDC flows (CI/CD-ready)
- [x] Payment network integration (NSIM) with OAuth card consent flow
- [x] NSIM production deployment (ECS Fargate + ElastiCache Redis)
- [x] Webhook system for payment notifications
- [x] Admin E2E tests (14 tests for dashboard, users, admins, card types, account types)
- [x] WSIM wallet integration (card enrollment, JWT payment tokens, wallet checkout flow)
- [ ] CI/CD pipeline setup
- [ ] Mobile app support
- [ ] Client credentials grant for server-to-server
- [ ] Additional banking features (loans, investments, etc.)

## License

MIT

## Repository

https://github.com/jordancrombie/bsim

---

Built with ❤️ using TypeScript and modern web technologies.
