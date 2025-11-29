# Changelog

All notable changes to the BSIM Banking Simulator project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Credit Card System** - Full credit card management functionality
  - Create credit cards with customizable credit limits
  - Automatic card number generation (Visa-style 16-digit)
  - Auto-generated CVV and expiry dates (3 years from creation)
  - Credit card transactions: CHARGE, PAYMENT, REFUND
  - Available credit tracking (credit limit minus charges)
  - Transaction history per card
  - Beautiful gradient card UI design in dashboard
- **Admin Interface** - Separate administrative dashboard
  - Standalone Next.js application on admin.banksim.ca subdomain
  - User listing with account/card/passkey counts
  - User detail view with all associated accounts and cards
  - Dashboard with system statistics
  - Runs in its own Docker container for independent deployment
  - Direct database access via Prisma ORM
- Credit card API endpoints:
  - `POST /api/credit-cards` - Create new credit card
  - `GET /api/credit-cards` - List user's credit cards
  - `GET /api/credit-cards/:cardNumber` - Get card details
  - `POST /api/credit-card-transactions/charge` - Charge to card
  - `POST /api/credit-card-transactions/payment` - Make payment
  - `POST /api/credit-card-transactions/refund` - Process refund
  - `GET /api/credit-cards/:cardNumber/transactions` - Transaction history
- WebAuthn/Passkey passwordless authentication system
- Biometric login support (Face ID, Touch ID, Windows Hello)
- Complete passkey registration and authentication flow
- Frontend passkey integration with @simplewebauthn/browser
- Backend passkey verification with @simplewebauthn/server
- Next.js 14 frontend with App Router
- Full Docker containerization for all services
- Multi-stage Docker builds for production optimization
- Docker Compose for local development stack
- nginx reverse proxy for SSL termination
- AWS ECS Fargate deployment documentation
- HTTPS support with configurable domain names
- OpenSSL integration for Prisma in Docker
- Health checks for all Docker containers
- Complete frontend UI with dashboard, accounts, and transactions
- Frontend API client with Axios
- Protected routes with authentication middleware
- Responsive mobile-first design
- Dynamic subdomain support (*.banksim.ca)
- Relative API URLs for cross-subdomain compatibility

### Changed
- Dashboard updated to 4-column layout with credit card summary
- Added "Your Credit Cards" section to main dashboard
- nginx configuration updated with admin subdomain routing
- Docker Compose now includes admin service container
- Migrated from password authentication to WebAuthn/passkeys
- Updated API endpoints to support passkey authentication
- Enhanced security with passwordless biometric authentication
- Improved Docker setup with health checks and non-root users
- Frontend API client now uses relative URLs instead of hardcoded domain
- Backend CORS configured with dynamic subdomain validation

### Fixed
- TypeScript compilation errors in production Docker builds
- Prisma Client type issues with User model
- JWT token type inference issues
- WebAuthn credential type compatibility
- React.Node type error in Next.js layout
- Docker OpenSSL compatibility for Prisma
- SSL certificate chain configuration for nginx
- CORS errors when accessing from different subdomains
- Browser caching issues with stale JavaScript files
- Cross-origin API requests when using subdomain URLs

## [0.1.0] - 2025-11-28

### Added
- Initial project setup
- Basic TypeScript configuration
- Project structure with backend API architecture
- Prisma schema for PostgreSQL
- Complete REST API with 11 endpoints:
  - Authentication: register, login, get current user
  - Accounts: create, list, view, get transactions
  - Transactions: deposit, withdraw, transfer
- Repository interfaces for database abstraction
- Service layer with business logic
- Controller layer for HTTP handling
- JWT authentication middleware
- Error handling middleware
- Database helper scripts
- Comprehensive test suite verification

### Technical Details
- **Backend**: Express.js, TypeScript, Prisma ORM
- **Database**: PostgreSQL 15 (Docker)
- **Authentication**: JWT with bcrypt password hashing
- **Validation**: Zod for request validation
- **Architecture**: Repository pattern with clean separation of concerns
- **Development**: Docker Compose for easy local setup

### Documentation
- README.md with quick start guide
- QUICKSTART.md for 5-minute setup
- BACKEND_SETUP.md with detailed documentation
- IMPLEMENTATION_PLAN.md with architecture overview
- API endpoint documentation
- Database management commands

### Testing
- Verified user registration and authentication
- Verified account creation and management
- Verified banking operations (deposit, withdraw, transfer)
- Verified transaction history tracking
- Verified JWT token authentication
- Verified database migrations

---

## Release Notes

### Version 0.1.0 - Initial Release

This is the first release of BSIM Banking Simulator, featuring a complete backend API with user authentication, account management, and banking operations. The system uses PostgreSQL for data persistence and includes Docker support for easy local development.

**Key Features:**
- 🔐 Secure user authentication with JWT
- 💰 Complete account management
- 📊 Transaction tracking and history
- 🗄️ PostgreSQL database with Prisma ORM
- 🐳 Docker support for development
- 🏗️ Clean architecture with repository pattern

**Getting Started:**
```bash
./scripts/db.sh start
cd backend && npm run dev
```

See [QUICKSTART.md](QUICKSTART.md) for detailed setup instructions.

**Next Steps:**
- Next.js frontend development
- Mobile app support
- Production deployment
