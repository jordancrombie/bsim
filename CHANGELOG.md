# Changelog

All notable changes to the BSIM Banking Simulator project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- WebAuthn/Passkey passwordless authentication system
- Biometric login support (Face ID, Touch ID, Windows Hello)
- Complete passkey registration and authentication flow
- Frontend passkey integration with @simplewebauthn/browser
- Backend passkey verification with @simplewebauthn/server
- Next.js 14 frontend with App Router
- Full Docker containerization for all services
- Multi-stage Docker builds for production optimization
- Docker Compose for local development stack
- AWS ECS Fargate deployment documentation
- HTTPS support with configurable domain names
- OpenSSL integration for Prisma in Docker
- Health checks for all Docker containers
- Complete frontend UI with dashboard, accounts, and transactions
- Frontend API client with Axios
- Protected routes with authentication middleware
- Responsive mobile-first design

### Changed
- Migrated from password authentication to WebAuthn/passkeys
- Updated API endpoints to support passkey authentication
- Enhanced security with passwordless biometric authentication
- Improved Docker setup with health checks and non-root users

### Fixed
- TypeScript compilation errors in production Docker builds
- Prisma Client type issues with User model
- JWT token type inference issues
- WebAuthn credential type compatibility
- React.Node type error in Next.js layout
- Docker OpenSSL compatibility for Prisma

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
