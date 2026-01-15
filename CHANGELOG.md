# Changelog

All notable changes to the BSIM Banking Simulator project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.7.11] - 2026-01-15

### Fixed
- **Escrow Webhook wallet_id Mismatch** - Fixed webhook to return the original `wallet_id` from ContractSim
  - Added `wallet_id` column to `escrow_holds` table to store ContractSim's wallet ID
  - Webhook now returns the stored `wallet_id` instead of BSIM's `account_id`
  - Files modified: `backend/prisma/schema.prisma`, `backend/src/services/EscrowService.ts`, `backend/src/controllers/escrowController.ts`
  - Migration: `20260115_add_escrow_wallet_id`

## [0.7.10] - 2026-01-15

### Fixed
- **ContractSim Webhook Payload Format** - Fixed escrow webhook to match ContractSim's documented spec
  - Changed payload fields from camelCase to snake_case (`event_type`, `escrow_id`, `contract_id`, `user_id`)
  - Added missing `wallet_id` field (mapped from `accountId`)
  - File modified: `backend/src/services/EscrowService.ts`

## [0.7.9] - 2026-01-14

### Added
- **ContractSim Integration Environment Variables** - Added configuration for escrow API authentication
  - `CONTRACTSIM_API_KEY` - API key for ContractSim to authenticate with BSIM's escrow API
  - `CONTRACTSIM_WEBHOOK_URL` - URL for BSIM to notify ContractSim of escrow events
  - `CONTRACTSIM_WEBHOOK_SECRET` - Secret for webhook signature verification
  - File modified: `docker-compose.yml` (backend service environment)

## [0.7.8] - 2026-01-07

### Changed
- **APNS Dev Mode** - Changed `APNS_PRODUCTION` to `false` for dev environment
  - WSIM push notifications in dev now use APNs sandbox environment
  - Updated in `docker-compose.dev.yml` and Buildkite dev pipelines

### Fixed
- **Buildkite Pipeline Build/Push Chaining** - Fixed production pipelines failing silently on build errors
  - Docker build and push commands now chained with `&&` so build failures stop execution before push
  - Previously, if build failed silently, push would still run and fail with "tag does not exist"
  - Fixed across all production pipelines: BSIM, WSIM, TransferSim, SSIM
  - Files modified:
    - `.buildkite/pipeline-prod.yaml` (BSIM)
    - WSIM `.buildkite/pipeline-prod.yaml`
    - TransferSim `.buildkite/pipeline-prod.yaml`
    - SSIM `.buildkite/pipeline-prod.yaml`

### Changed
- **CLAUDE.md Documentation Updates** - Improved EC2 deployment and logging documentation
  - Added TransferSim to ECR repository table
  - New "Viewing Production Logs (EC2 via SSM)" section with SSM commands for retrieving Docker logs
  - New "Buildkite CI/CD Pipelines" section documenting pipeline types and features
  - Container name to service mapping table for log retrieval

## [0.7.7] - 2026-01-06

### Added
- **Dynamic Admin Branding** - Admin interface now displays configurable site name from database
  - Dashboard header shows site name (e.g., "NewBank Admin" instead of hardcoded "BSIM Admin")
  - Login page fetches site name from `/api/settings` endpoint
  - Files modified: `admin/app/(dashboard)/layout.tsx`, `admin/app/login/page.tsx`

### Fixed
- **Logo Upload Not Working** - Fixed nginx missing `/uploads` route for admin interfaces
  - Requests to `/uploads/*` were going to frontend instead of backend
  - Added `/uploads` location blocks to nginx configs for all admin subdomains
  - Files modified: `nginx/nginx.conf`, `nginx/nginx.dev.conf`

- **NewBank Admin Empty Config Tables** - Seeded missing card types and account types
  - NewBank database had empty `credit_card_type_configs` and `account_type_configs` tables
  - Admin console showed no card types or account types despite users having accounts
  - Seeded 5 credit card types (VISA, VISA Debit, Mastercard, Mastercard Debit, AMEX)
  - Seeded 4 account types (Checking, Savings, Money Market, Certificate of Deposit)

## [0.7.6] - 2026-01-06

### Added
- **Buildkite Build Status Badge** - Added build status badge to README
- **Separate Production Pipelines** - Created dedicated `pipeline-prod.yaml` for manual production deployments
  - BSIM, WSIM, SSIM, TransferSim all have separate production pipelines
  - Production pipelines verify ECR images exist before deploying
  - Triggered manually via Buildkite UI/API (not on push)

### Changed
- **Pipeline Strategy Update** - Separated dev and prod deployment workflows
  - `pipeline-full.yaml` now only deploys to dev (removed production block/deploy steps)
  - `pipeline-prod.yaml` is the new manual production deployment pipeline
  - This prevents builds from hanging indefinitely waiting for approval

### Fixed
- **Docker Compose Dependency Conflicts** - Added `--no-deps` to dev deployment commands
  - SSIM, WSIM, TransferSim pipelines now use `--no-deps` to avoid recreating shared infrastructure
  - Fixes "container name already in use" errors when bsim-db already exists

## [0.7.5] - 2026-01-05

### Added
- **Buildkite CI/CD Pipelines** - Created CI/CD pipeline configurations for automated builds
  - `pipeline.yaml` - Full pipeline with tests, Docker builds, ECR push, and manual deploy gate
  - `pipeline-build.yaml` - Build-only pipeline (tests + ECR push, no deployment)
  - `pipeline-dev.yaml` - Development pipeline (tests + local docker compose deployment)
  - `pipeline-full.yaml` - Hybrid pipeline (auto dev deploy + manual prod gate)
  - All pipelines use `Buildkite-selfhosted` agent queue
  - Deployment via AWS SSM to EC2 instance
  - Post-deployment health checks and version verification
  - Automated database migrations via `prisma migrate deploy` before service restart
  - Note: Pipeline files are gitignored (`.buildkite/`) as they are managed separately

### Changed
- **Docker Compose Development Configuration** - Updated for TransferSim and APNs integration
  - Added TransferSim P2P network services to dev environment
  - Configured WSIM webhook secrets for TransferSim integration
  - Added APNs production configuration for push notifications
  - Updated volume mounts for APNs certificate

### Fixed
- **OpenBanking AccountController Tests** - Updated tests to match fiUserRef lookup behavior
  - Tests now create user with `fiUserRef` matching the token's `sub` claim
  - Fixed test that clears mock data to re-add the requesting user
  - All 74 OpenBanking tests now pass
- **APNs Key File Permissions** - Fixed push notification failures in production
  - APNs key file had `600` permissions (root only), but container runs as `wsim` user (uid 1001)
  - Fixed with `chmod 644` on the AuthKey.p8 file
  - Affects: WSIM push notifications to enrolled mobile wallets

## [0.7.4] - 2026-01-04

### Fixed
- **issueRefreshToken for wallet flows** - Check for `wallet:enroll` scope to issue refresh tokens
  - Root cause: Even with `offline_access` added to grant, oidc-provider filters it from `code.scopes`
  - The `issueRefreshToken` function couldn't detect `offline_access` was requested
  - Solution: Also check for `wallet:enroll` scope in `issueRefreshToken` since wallet flows always need refresh tokens
  - Files modified: `auth-server/src/config/oidc.ts`

## [0.7.3] - 2026-01-04

### Fixed
- **Wallet enrollment refresh tokens** - Always grant `offline_access` for wallet enrollment flows
  - Root cause: `oidc-provider` filters `offline_access` from `params.scope` and `missingOIDCScope`
  - Wallet enrollments always need refresh tokens to update account data over time
  - Solution: Automatically include `offline_access` in grant for wallet enrollment flows
  - Files modified: `auth-server/src/routes/interaction.ts`

## [0.7.2] - 2026-01-04

### Fixed
- **TypeError in consent flow** - Fixed `missingOIDCScope.has is not a function` error
  - Root cause: `prompt.details.missingOIDCScope` can be an Array, not always a Set
  - Updated code to handle both Set and Array types for compatibility
  - Files modified: `auth-server/src/routes/interaction.ts`

## [0.7.1] - 2026-01-04

### Fixed
- **Refresh Token Not Issued (offline_access scope)** - Fixed auth-server not issuing refresh tokens
  - Root cause: `oidc-provider` requires explicit `issueRefreshToken` configuration to issue refresh tokens
  - Even though `offline_access` was in the URL, the scope was being filtered by oidc-provider
  - Added `issueRefreshToken` function to OIDC configuration that checks for `offline_access` scope
  - Updated interaction handler to detect `offline_access` in `prompt.details.missingOIDCScope`
  - Grant now explicitly includes `offline_access` when requested
  - Files modified:
    - `auth-server/src/config/oidc.ts` - Added `issueRefreshToken` function
    - `auth-server/src/routes/interaction.ts` - Handle `offline_access` scope in consent flow
  - **Affects**: Both BSIM and NewBank auth servers (same codebase)
  - **Testing**: Create new user enrollment to verify refresh token is returned

## [0.7.0] - 2026-01-03

### Added
- **Health Check Version Info** - All services now report version in health endpoints
  - Backend `/health` includes version and compatibility matrix (WSIM 0.4.0+, TransferSim 0.2.0+, MWSIM 0.3.0+)
  - Auth-server `/health` includes version and memory stats
  - OpenBanking `/health` includes version

### Fixed
- **WSIM OAuth Client Missing Refresh Token Support** - Fixed token expiry causing `bsim_unauthorized` errors
  - The `wsim-wallet` OAuth client was missing `refresh_token` grant type and `offline_access` scope
  - Without refresh tokens, access tokens expired after 1 hour with no way to renew
  - Fix: Updated OAuth client configuration in database:
    - Added `refresh_token` to `grantTypes`
    - Added `offline_access` to `scope`
  - **Action Required**: Users must log out and re-enroll to get a refresh token
  - **Note**: This is a database configuration change, no code changes required

- **Refresh Token Support (offline_access scope)** - Enable long-lived wallet sessions
  - Added `offline_access` to supported OIDC scopes in auth-server
  - Allows WSIM to request refresh tokens during wallet enrollment
  - Refresh tokens valid for 30 days, access tokens for 1 hour
  - Fixes token expiry issues preventing account fetches after 1 hour
  - File: `auth-server/src/config/oidc.ts`
  - **Note**: WSIM must also request `offline_access` scope during enrollment

- **P2P User ID in OIDC Tokens** - Added `bsim_user_id` claim for P2P transfer compatibility
  - BSIM auth-server now includes `bsim_user_id` (internal user ID) in access tokens during wallet enrollment
  - This is the ID that owns accounts in BSIM, required for TransferSim P2P account validation
  - Previously only `fi_user_ref` (external pseudonymous ID) was included, causing P2P transfers to fail
  - Files modified:
    - `auth-server/src/routes/interaction.ts` - Store `bsimUserId` in grant payload
    - `auth-server/src/config/oidc.ts` - Include `bsim_user_id` in access token claims

- **Same-Bank P2P Transfer Credits Not Applied** - Fixed credits not being applied for transfers within the same bank
  - Root cause: The idempotency check in `POST /api/p2p/transfer/credit` was finding the DEBIT record instead of a CREDIT record
  - Both DEBIT and CREDIT operations use the same TransferSim `transferId` (externalId), but `externalId` had a unique constraint
  - For same-bank transfers (sender and recipient at same BSIM), the credit would return the debit's transactionId without actually crediting the recipient
  - Fix: Changed the unique constraint from `externalId` to compound `(externalId, direction)`
  - Updated both debit and credit endpoints to query by `externalId_direction` compound key
  - Files modified:
    - `backend/prisma/schema.prisma` - Changed P2PTransfer unique constraint
    - `backend/src/controllers/p2pController.ts` - Updated idempotency checks
  - **Migration**: `20260103_p2p_compound_unique` - Run `prisma migrate deploy` before deploying backend

- **P2P Transfer Database Schema** - Added missing `p2p_transfers` table to BSIM database
  - TransferSim P2P debit/credit operations were failing with "table does not exist" error
  - Applied `prisma db push` to create the `P2PTransfer` model table
  - Required for TransferSim to process P2P transfers through BSIM

- **Open Banking API fiUserRef lookup** - Fixed accounts endpoint returning empty results
  - The `/accounts` endpoint was incorrectly using the token's `sub` claim (fiUserRef) as the internal userId
  - Now properly looks up the user by `fiUserRef` first, then queries accounts by internal userId
  - Affects: `GET /accounts`, `GET /accounts/:accountId`, `GET /accounts/:accountId/transactions`
  - File: `openbanking/src/controllers/accountController.ts`

## [0.6.0] - 2025-12-28

### Added
- **Micro Merchant Fee Collection** - P2P fee collection for TransferSim integration
  - Added `FEE` transaction type to TransactionType enum
  - Added `SystemConfig` model for key-value system configuration (fee account ID storage)
  - Extended `POST /api/p2p/transfer/credit` with optional fee parameters:
    - `feeAmount`: Fee amount to collect (must be less than gross amount)
    - `feeAccountId`: UUID of the fee collection account
    - `merchantName`: Optional merchant name for transaction description
  - Atomic transaction ensures merchant net amount and fee account are credited together
  - New endpoints for fee account configuration:
    - `GET /api/p2p/config/fee-account` - Get configured fee account
    - `PUT /api/p2p/config/fee-account` - Configure fee account (requires accountId)
  - Fee transactions create `FEE` type entries with description format: `Micro Merchant Fee: {merchantName} (Transfer: {transferId})`
  - Validation: feeAmount and feeAccountId must both be provided together

- **Multi-BSIM Payment Routing** - Cross-bank wallet payments via NSIM
  - Added `bsimId` claim to wallet payment token JWT for multi-bank routing
  - NSIM can now route payments to the correct BSIM instance based on card issuer
  - Enables NewBank cards to be used for merchant payments alongside main BSIM cards
  - Each BSIM instance includes its `BSIM_ID` in generated tokens
  - File: `backend/src/routes/walletRoutes.ts` - Added `bsimId: config.wsim.bsimId` to token payload

- **NewBank (Second BSIM Instance)** - Multi-bank development environment
  - Complete second BSIM deployment at `newbank-dev.banksim.ca`
  - Separate frontend, backend, auth-server, and admin services
  - Shares PostgreSQL instance with isolated `newbank` database
  - Nginx configuration for all NewBank subdomains
  - Docker Compose overlay: `docker-compose.newbank.yml`
  - Required hosts entries:
    - `127.0.0.1 newbank-dev.banksim.ca`
    - `127.0.0.1 newbank-auth-dev.banksim.ca`
    - `127.0.0.1 newbank-admin-dev.banksim.ca`

- **P2P Transfer Integration (TransferSim)** - Cross-bank peer-to-peer transfers
  - New P2P API endpoints for TransferSim integration:
    - `POST /api/p2p/transfer/debit` - Debit sender's account
    - `POST /api/p2p/transfer/credit` - Credit recipient's account
    - `POST /api/p2p/user/verify` - Verify user exists by ID
  - API key authentication via `TRANSFERSIM_API_KEY` env var
  - P2PTransfer model for audit/reconciliation
  - Cross-bank transfers tested: BSIM DEV ↔ NewBank

## [0.5.0] - 2025-12-10

### Added
- **Mobile Wallet Payment Flow (iOS Safari & Chrome)** - Complete mobile app checkout experience
  - Full end-to-end mobile wallet payment flow working on iOS Safari and Chrome browsers
  - `POST /api/wallet/request-token` - Generates ephemeral card tokens for mobile payment approval
  - Authenticates using wallet credentials issued during enrollment
  - Validates card is in permitted cards list
  - Creates PaymentConsent record for audit trail
  - 5-minute token expiry for security
  - 17 unit tests added in `backend/src/__tests__/routes/walletRoutes.test.ts`
  - Deployment script: `LOCAL_SCRIPTS/dev_bsim_backend_deploy_code_only.sh`
  - Browser-aware deep links with return URLs for seamless app-to-browser checkout
  - Cross-tab order confirmation support (SSIM v1.13.3)

- **Mobile-Responsive Dashboard Layout** - Complete mobile-first redesign for smartphone users
  - New bottom navigation bar with 5 tabs (Home, Accounts, Cards, Transfer, Wallet)
  - Bottom nav only visible on mobile (`md:hidden`), desktop keeps sidebar
  - Mobile hamburger menu with user info dropdown and logout
  - Dashboard quick action buttons for common tasks (Send, Transfer, Pay)
  - Compact account/card list with chevron indicators
  - Summary cards: 2-column grid on mobile, 4-column on desktop
  - Safe area CSS for iPhone home indicator (`env(safe-area-inset-bottom)`)
  - Active link highlighting with indicator bar
  - Main content padding adjusted to avoid bottom nav overlap
  - New files:
    - `frontend/components/BottomNav.tsx` - Mobile bottom navigation component
  - Modified files:
    - `frontend/app/dashboard/layout.tsx` - Responsive sidebar/bottom nav
    - `frontend/app/dashboard/page.tsx` - Mobile-friendly cards and quick actions
    - `frontend/app/globals.css` - Safe area CSS utilities

- **Unit Test Coverage Improvements** - Significant test suite expansion for better code quality
  - Added 102 new unit tests across backend and admin modules
  - **Backend**: 229 → 300 tests (+71), coverage improved 48.38% → 55.42%
  - **Admin**: 69 → 100 tests (+31), coverage improved 24.77% → 34.89%
  - New test files:
    - `backend/src/__tests__/routes/wellKnownRoutes.test.ts` (10 tests) - 100% coverage
    - `backend/src/__tests__/routes/settingsRoutes.test.ts` (6 tests) - 100% coverage
    - `backend/src/__tests__/routes/accountRoutes.test.ts` (6 tests) - 100% coverage
    - `backend/src/__tests__/routes/authRoutes.test.ts` (7 tests) - 100% coverage
    - `backend/src/__tests__/routes/creditCardRoutes.test.ts` (6 tests) - 100% coverage
    - `backend/src/__tests__/routes/creditCardTransactionRoutes.test.ts` (5 tests) - 100% coverage
    - `backend/src/__tests__/routes/notificationRoutes.test.ts` (7 tests) - 100% coverage
    - `backend/src/__tests__/routes/transactionRoutes.test.ts` (5 tests) - 100% coverage
    - `backend/src/__tests__/middleware/auth.test.ts` (8 tests) - 100% coverage
    - `backend/src/__tests__/middleware/errorHandler.test.ts` (11 tests) - 100% coverage
    - `admin/__tests__/api/webauthn-origins.test.ts` (31 tests) - ~86% coverage
  - Updated `admin/__tests__/mocks/mockPrisma.ts` with WebAuthnRelatedOrigin support
  - Routes folder coverage: 2.82% → 23.58% (+21%)
  - Middleware folder coverage: 0% → 100%

- **WebAuthn Related Origins Management** - Admin-configurable cross-domain passkey authentication
  - New `/.well-known/webauthn` endpoint served from BSIM root domain
  - Returns list of origins allowed for WebAuthn Related Origin Requests (ROR)
  - Enables passkeys registered on `banksim.ca` to work on merchant domains like `store.regalmoose.ca`
  - Admin UI at `/webauthn-origins` for managing allowed origins
  - CRUD operations: add, edit, toggle active/inactive, delete origins
  - HTTPS-only validation for security
  - Database model: `WebAuthnRelatedOrigin` with origin, description, isActive, sortOrder
  - New files:
    - `backend/src/routes/wellKnownRoutes.ts` - Public endpoint handler
    - `admin/app/api/webauthn-origins/route.ts` - List/create API
    - `admin/app/api/webauthn-origins/[id]/route.ts` - CRUD API
    - `admin/app/(dashboard)/webauthn-origins/page.tsx` - Admin UI
  - Initial origins seeded: `https://banksim.ca`, `https://store.regalmoose.ca`
  - AWS ALB rule added for `/.well-known/*` path routing to backend

### Fixed
- **Next.js Image Optimization Cache** - Fixed permission denied errors in production
  - Added `.next/cache/images` directory with proper `nextjs:nodejs` ownership in Dockerfile
  - Image optimization now caches processed images correctly
  - Response times improved from ~2+ seconds to ~80ms for cached images

## [0.4.0] - 2025-12-06

### Added
- **WSIM Embedded Enrollment** - In-bank wallet enrollment for WSIM Wallet
  - Users can enroll credit cards in WSIM Wallet directly from BSIM dashboard
  - New Wallet Pay page at `/dashboard/wallet-pay`
  - Popup-based enrollment flow with postMessage communication
  - Backend endpoints: `/api/wsim/enrollment-data`, `/api/wsim/enrollment-status`, `/api/wsim/config`, `/api/wsim/enrollment-complete`
  - Card token JWT authentication for server-to-server card fetching
  - HMAC-SHA256 signed payloads for secure enrollment data exchange

- **Server-Side SSO for WSIM Wallet** - True single sign-on across devices/browsers
  - "Open WSIM Wallet" button automatically logs users into WSIM
  - New `GET /api/wsim/sso-url` endpoint generates short-lived (5 min) SSO tokens
  - Server-to-server SSO via WSIM's `POST /api/partner/sso-token` API
  - Works on any browser/device as long as user is logged into BSIM
  - No localStorage dependency - fully server-side token generation

- **Regal Moose Production Deployment** - Second SSIM multi-tenant instance on AWS
  - Deployed `store.regalmoose.ca` as separate ECS service sharing SSIM database
  - ACM wildcard certificate `*.regalmoose.ca` added to ALB listener
  - Route 53 DNS record pointing to shared ALB
  - CloudWatch log group `/ecs/bsim-regalmoose`
  - ECS task definition `bsim-regalmoose` with store-specific environment variables
  - OAuth client registrations in BSIM auth and WSIM auth

- **WSIM Admin Interface Deployment** - Admin portal for WSIM auth-server
  - Passkey-based admin authentication (same pattern as BSIM admin)
  - Admin invite system for adding new administrators
  - Admin management pages at `https://wsim-auth.banksim.ca/administration`
  - Database tables: `admin_users`, `admin_passkeys`, `admin_invites`
  - Environment variables: `AUTH_ADMIN_JWT_SECRET`, `AUTH_SERVER_URL`

### Changed
- **Homepage Logo Branding** - Replaced "BSIM" text with logo image on home page
  - Added `bsim-logo.png` to frontend public assets
  - Updated home page to display logo instead of text heading
  - Kept "The Banking Simulator" subtitle
  - Added SimToolBox ecosystem footer with links to GitHub repositories

- **Documentation Cleanup for Public Sharing** - Generalized docs for open source release
  - Replaced all `banksim.ca` domain references with `yourbanksimdomain.com` placeholder in public docs
  - Kept project component names (BSIM, SSIM, NSIM, WSIM) intact as they are project aliases
  - Moved implementation-specific docs to `LOCAL_DEPLOYMENT_PLANS/` (gitignored)
  - Public docs remaining in `docs/`

### Fixed
- **Shared Database Schema Sync** - Synced OpenBanking Prisma schema with backend/auth-server
  - Added missing models: `AdminInvite`, `PaymentConsent`, `PaymentAuthorization`, `WalletCredential`
  - Added `binaryTargets` for Alpine Linux compatibility
  - Prevents accidental table drops when services share the same database
  - Updated dangerous ECS migration tasks to remove `--accept-data-loss` flag

- **Test User Cleanup** - Deleted 478 `@testuser.banksim.ca` test users from production BSIM database

- **WSIM AWS Production Deployment** - Full production deployment of Wallet Simulator to AWS ECS
  - Deployed 3 ECS Fargate services: wsim-backend, wsim-auth-server, wsim-frontend
  - Created `wsim` database in shared RDS PostgreSQL instance
  - ECR repositories for all WSIM Docker images
  - ALB listener rules for `wsim.banksim.ca` and `wsim-auth.banksim.ca` subdomains

- **WSIM Production Enrollment Flow** - Fixed complete enrollment flow with multiple issues (December 6, 2025)
  - **Outdated auth-server image**: Deployed image (Dec 3) was missing `wallet:enroll` scope added Dec 4
  - **Missing `wallet_credentials` table**: Database schema not synced after adding WalletCredential model
  - **Missing redirect URI**: OAuth client lacked `/api/enrollment/callback/bsim` redirect URI
  - **Client secret mismatch**: BSIM had bcrypt-hashed secret, but oidc-provider requires plaintext
  - **Outdated backend image**: Deployed image (Dec 3) was missing `/api/wallet/*` routes added Dec 4
  - **Wrong BSIM API URL**: WSIM's `BSIM_PROVIDERS.apiUrl` was `https://banksim.ca` but backend is on `api.banksim.ca` subdomain

- **WSIM OAuth Client Invalid Grant Type** - Fixed enrollment failing with OIDC provider error
  - `wsim-wallet` OAuth client had `grantTypes = ['authorization_code', 'refresh_token']`
  - BSIM's OIDC provider only accepts `authorization_code` or `implicit` as valid grant types

- **SSIM v1.8.2 WSIM Wallet Integration** - Deployed SSIM with WSIM wallet payment support

## [0.3.0] - 2025-12-03

### Added
- **NSIM Production Deployment** - Full AWS deployment of Payment Network Simulator
  - ECR repository `bsim/payment-network` for NSIM Docker images
  - ECS Fargate service `bsim-payment-network-service` on port 3006
  - ElastiCache Redis cluster (`bsim-redis`, cache.t4g.micro) for BullMQ job queue
  - ALB listener rule for `payment.banksim.ca` subdomain
  - Route 53 DNS record pointing to shared ALB
  - CloudWatch log group `/ecs/bsim-payment-network`
  - Redis security group `bsim-redis-sg` for ECS-only access

- **WSIM Integration Phase 2** - Complete wallet payment flow with SSIM checkout
  - Docker Compose integration for WSIM services
  - nginx routing for `wsim-dev.banksim.ca` and `wsim-auth-dev.banksim.ca` subdomains
  - OAuth client seed script for WSIM and SSIM clients
  - JWT wallet payment token support in `SimNetHandler`
  - End-to-end wallet payment flow: SSIM → WSIM → BSIM token → NSIM → BSIM authorize

- **WSIM Integration Phase 1** - Digital wallet enrollment support for BSIM
  - Added `wallet:enroll` OIDC scope to auth-server for wallet providers
  - New `WalletCredential` database model for long-lived wallet API access (90-day expiry)
  - Wallet consent UI (`wallet-consent.ejs`) with multi-card selection
  - New wallet API endpoints in backend

- **Payment Network Database Models** - Database support for card payment processing
  - `PaymentConsent` model for user card consent tokens
  - `PaymentAuthorization` model for authorization holds on credit cards
  - `PaymentAuthorizationStatus` enum

- **NSIM Phase 4: Queue System & Reliability** - Complete webhook and queue infrastructure
  - Redis container for job queue persistence
  - BullMQ-based webhook delivery queue with exponential backoff retry
  - Webhook registration API for merchants
  - Authorization expiry scheduler

- **Payment Network HTTP API** - Internal API for NSIM to process payments against BSIM
  - `/api/payment-network/authorize`, `/capture`, `/void`, `/refund`, `/validate-token` endpoints
  - API key authentication via `X-API-Key` header

- **Payment Network Plugin Architecture** - Pluggable payment network integration
  - `IPaymentNetworkHandler` interface
  - `SimNetHandler` implementation for NSIM integration
  - Full payment lifecycle: authorize → capture/void → refund

- **OAuth Payment Authorization Flow** - Card selection consent for merchant payments
  - Added `payment:authorize` scope to auth-server
  - New payment consent UI with card selection
  - Card token generation and storage

- **Development Environment Tooling** - New Makefile targets for dev/prod configuration
  - `make dev-check`, `make dev-rebuild`, `make dev-rebuild-frontend`
  - `.claude/CLAUDE.md` hints file documenting dev vs prod configuration

### Fixed
- **Frontend Dev/Prod Domain Mismatch** - Fixed CORS errors when frontend called wrong API domain
- **NSIM Production Payment Flow** - Fixed multiple issues preventing end-to-end payment authorization
- **ECS Private Subnet Networking** - Fixed NSIM service failing to start
- **E2E Test Race Condition Fix** - Resolved email collision issues
- **Credit Card Cancel Test Timing Fix** - Fixed flaky test

## [0.2.0] - 2025-11-29

### Added
- **Credit Card System** - Full credit card management functionality
  - Create credit cards with customizable credit limits
  - Automatic card number generation (Visa-style 16-digit)
  - Auto-generated CVV and expiry dates
  - Credit card transactions: CHARGE, PAYMENT, REFUND
  - Available credit tracking
  - Beautiful gradient card UI design

- **Admin Interface** - Separate administrative dashboard
  - Standalone Next.js application on admin.banksim.ca subdomain
  - User listing with account/card/passkey counts
  - User detail view with all associated accounts and cards
  - Dashboard with system statistics

- **Admin Portal E2E Tests** - Comprehensive end-to-end testing (14 tests)
- **Admin Passkey E2E Tests** - Full WebAuthn testing (7 tests)
- **Passkey E2E Tests** - Comprehensive passkey authentication testing (5 tests)
- **E2E Test User Cleanup** - Automatic cleanup of test users

- **Open Banking Platform** - Third-party data access via OAuth 2.0/OIDC
  - Authorization Server at `auth.banksim.ca` with oidc-provider
  - Open Banking API at `openbanking.banksim.ca` with FDX-inspired endpoints
  - OAuth 2.0 Authorization Code flow with PKCE
  - FDX-inspired scopes: `fdx:accountdetailed:read`, `fdx:transactions:read`, `fdx:customercontact:read`
  - JWT token validation with JWKS support

- **Notification System** - Real-time notification center
  - Notification bell icon with unread count badge
  - Auto-generated notifications for transfers
  - 30-second polling for updates

- **Email-Based Money Transfers** - Send money to users by email address
- **Credit Card Detail Page** - View individual credit card details and transactions
- **Account Detail Page** - View individual account details and transactions
- **OAuth Client Administration Interface** - Web UI for managing OAuth clients
- **Configurable Site Branding** - Admin-managed logo and site name
- **S3 Storage Support** - Production-ready file storage

### Changed
- **Account Type Support** - New `AccountType` enum: CHECKING, SAVINGS, MONEY_MARKET, CERTIFICATE_OF_DEPOSIT
- **Credit Card Type Support** - New `CreditCardType` enum: VISA, VISA_DEBIT, MC, MC_DEBIT, AMEX
- **Credit Card Type Administration** - Admin interface for managing card types
- **Account Type Administration** - Admin interface for managing account types

### Security
- **Next.js CVE-2025-29927 Middleware Bypass** - Updated Next.js to 16.0.6

### Fixed
- **Admin Detail Pages Not Loading** - Fixed Next.js 16 async params
- **E2E OIDC Tests Environment Mismatch** - Fixed tests failing against production
- **Passkey Registration BigInt Serialization** - Fixed JSON serialization error
- **Frontend API URL for AWS Production** - Fixed 404 errors on signup/login
- **Cross-Subdomain Passkey Authentication** - Fixed passkeys not working across subdomains
- **OIDC Resource Indicator Crash** - Fixed server error for third-party apps
- **Production Database Missing Tables/Columns** - Fixed 500 errors on `/api/settings`

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
- WebAuthn/Passkey passwordless authentication system
- Biometric login support (Face ID, Touch ID, Windows Hello)
- Next.js 14 frontend with App Router
- Full Docker containerization for all services
- Multi-stage Docker builds for production optimization
- Docker Compose for local development stack
- nginx reverse proxy for SSL termination
- AWS ECS Fargate deployment documentation
- HTTPS support with configurable domain names
- Complete frontend UI with dashboard, accounts, and transactions
- Responsive mobile-first design
- Dynamic subdomain support (*.banksim.ca)

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

---

## Release Notes

### Version 0.7.1 - Refresh Token Fix

This patch release fixes a critical issue where refresh tokens were not being issued during wallet enrollment.

**Key Fix:**
- Auth-server now correctly issues refresh tokens when `offline_access` scope is requested
- Added explicit `issueRefreshToken` configuration for oidc-provider
- Users must re-enroll to obtain a refresh token

### Version 0.7.0 - Health Check Versioning & P2P Fixes

This release adds comprehensive version reporting to all BSIM services and fixes critical P2P transfer issues.

**Key Features:**
- All services now report version in `/health` endpoint
- Backend includes compatibility matrix for ecosystem services
- Fixed same-bank P2P transfer credits not being applied
- Added `bsim_user_id` claim to OIDC tokens for P2P compatibility
- Fixed Open Banking API fiUserRef lookup

### Version 0.6.0 - P2P Transfers & Multi-Bank Support

This release introduces peer-to-peer transfer support via TransferSim and multi-bank infrastructure.

**Key Features:**
- P2P transfer endpoints for TransferSim integration
- Micro merchant fee collection system
- NewBank second BSIM instance for multi-bank testing
- Multi-BSIM payment routing via NSIM

### Version 0.5.0 - Mobile Wallet & Test Coverage

This release focuses on mobile experience and test coverage improvements.

**Key Features:**
- Mobile wallet payment flow for iOS Safari & Chrome
- Mobile-responsive dashboard with bottom navigation
- WebAuthn Related Origins for cross-domain passkeys
- 102 new unit tests across backend and admin

### Version 0.4.0 - WSIM Integration & Production Deployment

This release integrates WSIM (Wallet Simulator) for digital wallet functionality.

**Key Features:**
- WSIM embedded enrollment from BSIM dashboard
- Server-side SSO for seamless wallet access
- Regal Moose second SSIM store deployed
- WSIM admin interface deployed

### Version 0.3.0 - Payment Network & Wallet Integration

This release introduces the payment network infrastructure and wallet integration.

**Key Features:**
- NSIM (Payment Network Simulator) production deployment
- WSIM wallet enrollment and payment flow
- Payment authorization with card selection
- Redis-backed webhook queue system

### Version 0.2.0 - Credit Cards, Admin & Open Banking

This release adds credit card functionality, admin interface, and Open Banking APIs.

**Key Features:**
- Full credit card management with transactions
- Admin dashboard for user/client management
- Open Banking OAuth 2.0/OIDC platform
- Notification system with real-time updates
- Comprehensive E2E test suite (76 tests)

### Version 0.1.0 - Initial Release

This is the first release of BSIM Banking Simulator, featuring a complete backend API with user authentication, account management, and banking operations.

**Key Features:**
- Secure user authentication with JWT and WebAuthn/Passkeys
- Complete account management
- Transaction tracking and history
- PostgreSQL database with Prisma ORM
- Docker support for development
- Clean architecture with repository pattern

**Getting Started:**
```bash
./scripts/db.sh start
cd backend && npm run dev
```

See [QUICKSTART.md](QUICKSTART.md) for detailed setup instructions.
