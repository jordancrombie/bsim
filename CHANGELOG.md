# Changelog

All notable changes to the BSIM Banking Simulator project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Account Type Support** - Proper account categorization in database
  - New `AccountType` enum: CHECKING, SAVINGS, MONEY_MARKET, CERTIFICATE_OF_DEPOSIT
  - `accountType` field on Account model (defaults to CHECKING)
  - Open Banking API endpoints now return stored account type instead of hardcoded value
  - Database migration: `20251129_add_account_type`
- **Credit Card Type Support** - Card network/product categorization
  - New `CreditCardType` enum: VISA, VISA_DEBIT, MC, MC_DEBIT, AMEX
  - `cardType` field on CreditCard model (defaults to VISA)
  - Database migration: `20251129_add_credit_card_type`
- **Open Banking API Specification** - OpenAPI YAML for user accounts endpoint
  - `openbanking/api/users-accounts.yaml` - Full OpenAPI 3.0.3 spec
  - Documents `/users/{fi_user_ref}/accounts` endpoint
  - Includes request/response schemas, error responses, and security requirements
- **Resource Indicators for JWT Access Tokens** - OAuth 2.0 RFC 8707 support
  - Authorization server now properly issues JWT access tokens when `resource` parameter is provided
  - `getResourceServerInfo` validates and returns JWT configuration for `https://openbanking.banksim.ca`
  - `useGrantedResource` enabled to preserve resource indicator through token exchange
  - Access tokens include proper `aud` (audience) claim for resource server validation
  - Enables third-party apps like SSIM to obtain JWT tokens for Open Banking API access
- **Open Banking User Accounts Endpoint** - New endpoint for third-party access
  - `GET /users/{fi_user_ref}/accounts` - List user's accounts by fi_user_ref
  - Token subject validation ensures fi_user_ref matches JWT sub claim
  - Returns FDX-compliant account data structure
- **FI User Reference Number** - Unique identifier for Open Banking integrations
  - New `fi_user_ref` field on User model (UUID, auto-generated)
  - Database migration to add field and populate existing users
  - Stable identifier separate from internal user ID for third-party access
- **Dynamic nginx DNS Resolution** - Eliminates stale IP caching after container restarts
  - Uses Docker's internal DNS resolver (127.0.0.11) with 10-second TTL
  - Variable-based proxy_pass for runtime resolution
  - No more manual nginx restarts needed after rebuilding containers
- **OAuth Client Administration Interface** - Web UI for managing OAuth clients
  - List all registered OAuth clients at `https://auth.banksim.ca/administration`
  - Create new clients with auto-generated secure secrets
  - Edit client settings (redirect URIs, scopes, branding)
  - Regenerate client secrets with warning confirmation
  - Enable/disable clients without deletion
  - Delete clients with confirmation dialog
  - Professional admin UI with consistent styling
- **SSIM nginx Proxy Configuration** - Added `ssim.banksim.ca` subdomain routing
  - Routes to SSIM running on host machine (localhost:3005)
  - Uses same wildcard SSL certificate as other services
  - Full WebSocket support for Next.js hot reload
- **Authorization Server Documentation** - Comprehensive auth-server README
  - OIDC endpoint reference and configuration guide
  - OAuth client registration instructions (admin UI and SQL)
  - Integration guide with code examples for third-party apps
  - Troubleshooting section for common issues
  - Token lifetimes and security considerations
- **Open Banking Platform** - Third-party data access via OAuth 2.0/OIDC
  - Authorization Server at `auth.banksim.ca` with oidc-provider
  - Open Banking API at `openbanking.banksim.ca` with FDX-inspired endpoints
  - OAuth 2.0 Authorization Code flow with PKCE for third-party applications
  - Consent screen for users to approve data access requests
  - FDX-inspired scopes: `fdx:accountdetailed:read`, `fdx:transactions:read`, `fdx:customercontact:read`
  - JWT token validation with JWKS support (RS256 signing)
  - Account selection during consent flow
  - OAuth client management (registration stored in database)
  - Dynamic client lookup from database with proper Client instantiation
  - OIDC discovery endpoint (`/.well-known/openid-configuration`)
  - New Prisma models: OAuthClient, Consent, OidcPayload
  - Two new Docker containers: auth-server (port 3003) and openbanking (port 3004)
- **SSIM Integration** - Stock Simulator OAuth client registered
  - SSIM can authenticate users via BSIM's authorization server
  - Full OAuth 2.0 Authorization Code flow with PKCE support
  - Redirect URIs configured for both production and local development
- Open Banking API endpoints:
  - `GET /customers/current` - Get authenticated user's profile
  - `GET /accounts` - List consented accounts
  - `GET /accounts/{accountId}` - Account details
  - `GET /accounts/{accountId}/transactions` - Transaction history
- Authorization Server endpoints:
  - `GET /.well-known/openid-configuration` - OIDC discovery
  - `GET /.well-known/jwks.json` - JSON Web Key Set
  - `GET /auth` - Authorization endpoint
  - `POST /token` - Token endpoint
  - `GET /me` - UserInfo endpoint
  - `GET /interaction/:uid` - Consent UI
- **Configurable Site Branding** - Admin-managed logo and site name
  - Logo displayed on user login page
  - Logo upload via admin settings page with drag-and-drop support
  - Configurable site name shown throughout user-facing pages
  - Settings stored in database via SiteSettings model
  - Shared Docker volume for uploads between admin and backend containers
  - `GET /api/settings` endpoint for frontend to fetch branding
- **S3 Storage Support** - Production-ready file storage
  - Amazon S3 integration for logo and file uploads
  - Automatic fallback to local filesystem when S3 not configured
  - CloudFront CDN URL support for fast global delivery
  - S3-compatible endpoint support (MinIO, DigitalOcean Spaces, etc.)
  - Storage type indicator in admin settings page
  - Environment variable configuration for easy deployment
- **Clickable Dashboard Cards** - Admin dashboard stat cards now link to relevant pages
  - Total Users card links to /users
  - Total Admins card links to /admins
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
- **Authorization Server Subject Identifier** - Consistent fiUserRef across all tokens
  - Access tokens now use `fiUserRef` as the `sub` claim (previously used internal ID)
  - ID tokens and access tokens are now consistent for third-party API calls
  - Login flow updated to use fiUserRef as accountId throughout OIDC flows
  - Consent flow updated to handle fiUserRef-based session lookups
- nginx configuration updated with auth.banksim.ca and openbanking.banksim.ca routing
- Docker Compose now includes auth-server and openbanking services
- Admin dashboard cards now clickable with hover effects
- Login page dynamically loads logo and site name from settings API
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
- **Token Subject Mismatch** - Fixed "Token subject does not match requested user" error
  - Access token `sub` claim now matches ID token `sub` claim (both use fiUserRef)
  - Third-party apps can now successfully call `/users/{fi_user_ref}/accounts`
- Docker volume permissions for logo uploads in admin container
- Next.js Image component issues with dynamic sources (switched to standard img tags)
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
