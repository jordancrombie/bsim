# Changelog

All notable changes to the BSIM Banking Simulator project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **WSIM AWS Production Deployment** - Full production deployment of Wallet Simulator to AWS ECS
  - Deployed 3 ECS Fargate services: wsim-backend, wsim-auth-server, wsim-frontend
  - Created `wsim` database in shared RDS PostgreSQL instance
  - ECR repositories for all WSIM Docker images
  - ALB listener rules for `wsim.banksim.ca` and `wsim-auth.banksim.ca` subdomains
  - Route 53 DNS records pointing to shared ALB
  - CloudWatch log groups: `/ecs/bsim-wsim-backend`, `/ecs/bsim-wsim-auth-server`, `/ecs/bsim-wsim-frontend`
  - OAuth client registration: `wsim-wallet` in BSIM, `ssim-merchant` in WSIM
  - Task definitions in `aws/` directory: `wsim-backend-task-definition.json`, `wsim-auth-server-task-definition.json`, `wsim-frontend-task-definition.json`
  - See [docs/AWS_PRODUCTION_MIGRATION_PLAN.md](docs/AWS_PRODUCTION_MIGRATION_PLAN.md) for deployment details

- **WSIM Integration Phase 2** - Complete wallet payment flow with SSIM checkout
  - Docker Compose integration for WSIM services (wsim-backend, wsim-auth-server, wsim-frontend)
  - nginx routing for `wsim-dev.banksim.ca` and `wsim-auth-dev.banksim.ca` subdomains
  - OAuth client seed script (`scripts/seed-oauth-clients.sh`) for WSIM and SSIM clients
  - New Makefile targets: `make db-seed-oauth`, updated `make dev-hosts`
  - JWT wallet payment token support in `SimNetHandler`:
    - Decodes and verifies `wallet_payment_token` JWT tokens
    - Extracts `jti` claim to look up PaymentConsent records
    - Skips merchant ID validation for wallet tokens (cryptographically verified via JWT signature)
  - End-to-end wallet payment flow: SSIM → WSIM → BSIM token → NSIM → BSIM authorize

- **WSIM Integration Phase 1** - Digital wallet enrollment support for BSIM
  - Added `wallet:enroll` OIDC scope to auth-server for wallet providers
  - New `WalletCredential` database model for long-lived wallet API access (90-day expiry)
  - Wallet consent UI (`wallet-consent.ejs`) with multi-card selection
  - New wallet API endpoints in backend:
    - `GET /api/wallet/cards` - Get user's enrolled cards (masked)
    - `POST /api/wallet/tokens` - Generate ephemeral payment tokens
    - `GET /api/wallet/credentials/:id/status` - Check credential validity
    - `POST /api/wallet/credentials/:id/revoke` - Revoke wallet access
  - Token claims: `wallet_credential` and `fi_user_ref` returned in access token
  - See [docs/WSIM_INTEGRATION_PLAN.md](docs/WSIM_INTEGRATION_PLAN.md) for full architecture

- **NSIM Production Deployment** - Full AWS deployment of Payment Network Simulator
  - ECR repository `bsim/payment-network` for NSIM Docker images
  - ECS Fargate service `bsim-payment-network-service` on port 3006
  - ElastiCache Redis cluster (`bsim-redis`, cache.t4g.micro) for BullMQ job queue
  - ALB listener rule for `payment.banksim.ca` subdomain
  - Route 53 DNS record pointing to shared ALB
  - CloudWatch log group `/ecs/bsim-payment-network`
  - Redis security group `bsim-redis-sg` for ECS-only access
  - See [docs/NSIM_PRODUCTION_DEPLOYMENT.md](docs/NSIM_PRODUCTION_DEPLOYMENT.md) for details

- **Payment Network Database Models** - Database support for card payment processing
  - `PaymentConsent` model for user card consent tokens (OAuth card selection)
  - `PaymentAuthorization` model for authorization holds on credit cards
  - `PaymentAuthorizationStatus` enum (PENDING, AUTHORIZED, CAPTURED, VOIDED, etc.)
  - Migration `20251203_add_payment_network_models` applied to production

- **Multi-Repository Ecosystem Documentation** - Comprehensive docs for BSIM/SSIM/NSIM architecture
  - Updated [docs/AWS_DEPLOYMENT.md](docs/AWS_DEPLOYMENT.md) with ecosystem overview and diagrams
  - Updated [docs/AWS_DEPLOYMENT_NOTES.md](docs/AWS_DEPLOYMENT_NOTES.md) with Redis and NSIM details
  - Updated SSIM `AWS_DEPLOYMENT.md` with ecosystem context
  - Clear documentation that BSIM is the "showrunner" for all AWS deployments

- **NSIM Phase 4: Queue System & Reliability** - Complete webhook and queue infrastructure
  - Redis container (`bsim-redis`) for job queue persistence
  - BullMQ-based webhook delivery queue with exponential backoff retry (5 retries)
  - Webhook registration API for merchants (`POST /api/v1/webhooks`)
  - Webhook events: `payment.authorized`, `payment.captured`, `payment.voided`, `payment.refunded`, `payment.declined`, `payment.expired`, `payment.failed`
  - HMAC-SHA256 webhook signature verification
  - Automatic retry for failed BSIM API calls with exponential backoff
  - Authorization expiry scheduler (checks every 60 seconds, auto-voids expired holds)
  - Graceful shutdown handling for all workers
  - Updated SSIM Integration Guide with webhook documentation
  - New NSIM files: `queue/redis.ts`, `queue/webhook-queue.ts`, `queue/expiry-scheduler.ts`, `services/webhook.ts`, `routes/webhook.ts`, `types/webhook.ts`

- **Payment Network HTTP API** - Internal API for NSIM to process payments against BSIM
  - New `/api/payment-network/authorize` endpoint for payment authorization
  - New `/api/payment-network/capture` endpoint for capturing authorized payments
  - New `/api/payment-network/void` endpoint for voiding authorizations
  - New `/api/payment-network/refund` endpoint for refunding captured payments
  - New `/api/payment-network/validate-token` endpoint for card token validation
  - API key authentication via `X-API-Key` header
  - Wires `SimNetHandler` to process payment requests from NSIM

- **Payment Network Plugin Architecture** - Pluggable payment network integration for merchant payments
  - New `IPaymentNetworkHandler` interface for connecting external payment networks
  - `SimNetHandler` implementation for NSIM (Network Simulator) integration
  - `PaymentConsent` model for user card consent tokens
  - `PaymentAuthorization` model for authorization holds on credit cards
  - Nginx routing for `payment.banksim.ca` subdomain (NSIM endpoint)
  - Full payment lifecycle: authorize → capture/void → refund
  - Separate from Open Banking - designed for card-present/card-not-present transactions
  - See [docs/PAYMENT_NETWORK_PLAN.md](docs/PAYMENT_NETWORK_PLAN.md) for architecture details
  - NSIM repository: https://github.com/jordancrombie/nsim

- **OAuth Payment Authorization Flow** - Card selection consent for merchant payments
  - Added `payment:authorize` scope to auth-server
  - New payment consent UI with card selection (payment-consent.ejs)
  - Card token generation and storage in PaymentConsent table
  - Card token (`card_token`) included in JWT access token claims
  - Enables SSIM to initiate card payments via OAuth 2.0 flow

- **Development Environment Tooling** - New Makefile targets and Claude hints for dev/prod configuration
  - Added `make dev-check` to verify dev environment configuration (domain, API URL)
  - Added `make dev-rebuild` to force rebuild all containers with `--no-cache`
  - Added `make dev-rebuild-frontend` to fix stale `NEXT_PUBLIC_*` build-time variables
  - Created `.claude/CLAUDE.md` hints file documenting dev vs prod configuration
  - Documents that `NEXT_PUBLIC_*` vars are baked at build time, not runtime

### Fixed
- **WSIM Production Enrollment Flow** - Fixed complete enrollment flow with multiple issues (December 6, 2025)
  - **Outdated auth-server image**: Deployed image (Dec 3) was missing `wallet:enroll` scope added Dec 4
    - Fix: Rebuilt and redeployed auth-server with latest code
  - **Missing `wallet_credentials` table**: Database schema not synced after adding WalletCredential model
    - Fix: Ran `npx prisma db push` via ECS task to create the table
  - **Missing redirect URI**: OAuth client lacked `/api/enrollment/callback/bsim` redirect URI
    - Fix: Added via Prisma update: `redirectUris.push('https://wsim.banksim.ca/api/enrollment/callback/bsim')`
  - **Client secret mismatch**: BSIM had bcrypt-hashed secret, but oidc-provider requires plaintext
    - Fix: Updated to plaintext secret matching WSIM's BSIM_PROVIDERS config
  - **Outdated backend image**: Deployed image (Dec 3) was missing `/api/wallet/*` routes added Dec 4
    - Fix: Rebuilt and redeployed backend with wallet routes
  - **Wrong BSIM API URL**: WSIM's `BSIM_PROVIDERS.apiUrl` was `https://banksim.ca` but backend is on `api.banksim.ca` subdomain
    - Fix: Updated WSIM task definition to use `https://api.banksim.ca`
  - **Lesson learned**: After adding new features, always rebuild AND redeploy all affected Docker images

- **WSIM OAuth Client Invalid Grant Type** - Fixed enrollment failing with OIDC provider error
  - `wsim-wallet` OAuth client had `grantTypes = ['authorization_code', 'refresh_token']`
  - BSIM's OIDC provider (oidc-provider) only accepts `authorization_code` or `implicit` as valid grant types
  - `refresh_token` is a token type, not a grant type - it was incorrectly included
  - Fix: `UPDATE oauth_clients SET "grantTypes" = ARRAY['authorization_code'] WHERE "clientId" = 'wsim-wallet';`
  - No code changes or redeployments needed - just the database update
  - Added warning to AWS_DEPLOYMENT.md about valid grant types

- **WSIM Frontend Double API Path** - Fixed `/api/api/` URL causing 404 errors on enrollment page
  - Frontend was built with `NEXT_PUBLIC_API_URL=https://wsim.banksim.ca/api` but code adds `/api/` prefix
  - Result: requests went to `https://wsim.banksim.ca/api/api/enrollment/banks` (double `/api/`)
  - Fix: Rebuild with `NEXT_PUBLIC_API_URL=https://wsim.banksim.ca` (no `/api` suffix)
  - **Lesson learned:** When frontend code already includes `/api/` prefix, set `NEXT_PUBLIC_API_URL` to base URL only
  - Added warning to AWS_DEPLOYMENT.md troubleshooting section

- **SSIM v1.8.2 WSIM Wallet Integration** - Deployed SSIM with WSIM wallet payment support (December 6, 2025)
  - Built and pushed SSIM v1.8.2 Docker image with WSIM integration code
  - Updated `ssim-merchant` OAuth client in WSIM database with correct credentials:
    - Redirect URI: `https://ssim.banksim.ca/payment/wallet-callback`
    - Scope: `openid profile payment:authorize`
    - API Key: `wsim_api_e9da3d7ab1a8bfe90f976a7e5f831244`
  - Added WSIM environment variables to SSIM task definition:
    - `WSIM_ENABLED=true`
    - `WSIM_AUTH_URL=https://wsim-auth.banksim.ca`
    - `WSIM_CLIENT_ID=ssim-merchant`
    - `WSIM_CLIENT_SECRET`, `WSIM_API_KEY` (generated secrets)
    - `WSIM_API_URL=https://wsim.banksim.ca/api/merchant`
  - **WSIM auth-server client caching**: Restarted WSIM auth-server after adding OAuth client
    - Unlike BSIM (dynamic lookup), WSIM caches OAuth clients at startup
    - New clients require service restart: `aws ecs update-service --force-new-deployment`
  - **Fixed WSIM_POPUP_URL**: Changed from `https://wsim.banksim.ca/payment/popup` to `https://wsim-auth.banksim.ca`
    - Popup/embed endpoints are on auth-server, not frontend
  - **Fixed WSIM auth-server BACKEND_URL**: Changed from `http://localhost:3003` to `https://wsim.banksim.ca`
    - In ECS Fargate, each service runs in its own container - they can't communicate via localhost
    - Auth-server was failing with `TypeError: fetch failed` when requesting payment tokens
    - Backend is accessible via ALB at `wsim.banksim.ca` (priority 7 rule routes to backend target group)

- **Frontend Dev/Prod Domain Mismatch** - Fixed CORS errors when frontend called wrong API domain
  - Frontend was built with production `NEXT_PUBLIC_API_URL` (banksim.ca) instead of dev (dev.banksim.ca)
  - Root cause: Docker cached build layers ignoring changed build args
  - Solution: Use `make dev-rebuild-frontend` to force `--no-cache` rebuild
  - Added `make dev-check` diagnostic to detect this issue early
- **NSIM Production Payment Flow** - Fixed multiple issues preventing end-to-end payment authorization
  - Added `payment:authorize` scope to auth server's supported scopes list (was causing `invalid_client_metadata` error)
  - Fixed environment variable mismatch: backend expected `BSIM_PAYMENT_API_KEY`, task definition had `PAYMENT_NETWORK_API_KEY`
  - Created and applied `20251203_add_payment_network_models` migration for `payment_consents` and `payment_authorizations` tables
  - Resolved stuck migration `20251201_add_post_logout_redirect_uris` using `prisma migrate resolve --applied`
  - Rebuilt and redeployed auth-server with payment scope support
  - Payment OAuth redirect URI `https://ssim.banksim.ca/payment/callback` already registered in OAuth client

- **ECS Private Subnet Networking** - Fixed NSIM service failing to start
  - Private subnets lacked NAT gateway, preventing ECR image pulls
  - Changed to public subnets with `assignPublicIp=ENABLED`
  - Service now reaches steady state and passes health checks

- **E2E Test Race Condition Fix** - Resolved email collision issues when running tests in parallel
  - Changed email generation to use `crypto.randomUUID()` for cryptographically secure uniqueness
  - Updated Playwright config to use `fullyParallel: false` to prevent multiple workers from running tests within the same file concurrently
  - Added global setup to clean up leftover test users before tests run
  - Tests now pass consistently without needing retries for email collision errors

- **Credit Card Cancel Test Timing Fix** - Fixed flaky test that counted cards before API data loaded
  - Added `waitForLoadState('networkidle')` before counting credit cards
  - Ensures cards are loaded from API before initial count is taken
  - All 102 chromium tests now pass consistently across multiple runs

### Added
- **Admin Portal E2E Tests** - Comprehensive end-to-end testing for admin portal functionality
  - Created `e2e/tests/admin/portal.spec.ts` with 14 comprehensive tests:
    - Dashboard statistics display after login
    - Users management: list view and user details (CIF, accounts, cards, passkeys)
    - Admins management: list view and admin details
    - Card Types management: list view, add modal, edit modal, full CRUD cycle
    - Account Types management: list view, add modal, edit modal, full CRUD cycle
    - Navigation between admin portal sections via sidebar
  - CRUD tests create inactive records with unique timestamps and verify cleanup
  - Tests run in serial mode to maintain authenticated session
  - All tests pass on both local (localhost) and production (banksim.ca)

- **Production Database Migration Documentation** - Added comprehensive guide for running database migrations in AWS production
  - Documented why `npx prisma` fails in standalone Next.js containers (downloads incompatible Prisma 7.x)
  - Added recommended approach: run raw SQL via PrismaClient in ECS one-time tasks
  - Included common pitfalls: private subnets, exit codes 127/P1012, wrong Prisma versions
  - Added example task definitions and commands for both admin (standalone) and backend (full) services

- **Admin Passkey E2E Tests** - Full end-to-end testing for admin passkey authentication
  - Created `e2e/tests/admin/passkey.spec.ts` with 7 comprehensive tests:
    - Admin invite signup with passkey registration
    - Admin passkey login after registration
    - Passkey button visibility on login page
    - Invalid invite code rejection
    - Missing fields validation
    - Dashboard access after login
    - Unauthenticated redirect to login
  - Created `e2e/helpers/admin.helpers.ts` with test admin management utilities
  - Added `admin-dev.banksim.ca` to passkey expected origins for local/dev testing
  - Updated nginx to route `admin-dev.banksim.ca` and `auth-dev.banksim.ca` subdomains locally

- **Admin E2E Test Support** - Test endpoints for admin passkey testing without Super Admin credentials
  - Created `/api/test/admin-invites` endpoint for E2E tests to create admin invites
  - Created `/api/test/admins` endpoint for E2E tests to clean up test admins
  - Protected by `X-Test-Admin-Key` header (separate from cleanup key)
  - Only allows `@testadmin.banksim.ca` emails (test admin domain)
  - Only allows ADMIN role (never SUPER_ADMIN) for security
  - Test invites expire in 5 minutes
  - Added `TEST_ADMIN_KEY` environment variable to docker-compose.yml
  - Updated global teardown to clean up test admins after E2E runs
  - Created `e2e/docs/ADMIN_E2E_TESTING_PLAN.md` with full implementation plan

- **E2E Test User Cleanup** - Automatic cleanup of test users after E2E test runs
  - Created `/api/test-cleanup/users` endpoint protected by `X-Test-Cleanup-Key` header
  - Deletes only users with `@testuser.banksim.ca` email domain (E2E test users)
  - Added Playwright global teardown (`e2e/global-teardown.ts`) to cleanup after tests
  - Added `TEST_CLEANUP_KEY` environment variable to docker-compose.yml
  - Added `cleanup-test-users` and `count-test-users` commands to `scripts/aws-admin.sh`
  - Supports both dev environment (via API) and production (via ECS one-time task)

- **Admin Invite System** - Invitation-based admin signup for adding new administrators
  - Super Admins can create invite codes with optional email restrictions
  - Configurable roles (Admin or Super Admin) and expiration periods (1-30 days)
  - New `/invite` page for invited admins to register with passkey authentication
  - Invite management UI at `/admins/invites` with create, copy link, and revoke actions
  - Invite codes use format XXXX-XXXX-XXXX for easy sharing
  - Tracks invite usage, expiration, and revocation status
  - Database model: `AdminInvite` with relations to creator and user

- **Passkey E2E Tests** - Comprehensive WebAuthn/passkey authentication testing
  - Uses Chrome DevTools Protocol (CDP) to create virtual authenticator (Chromium only)
  - Tests passkey registration after signup, login with passkey, skip passkey flow
  - Created `e2e/helpers/webauthn.helpers.ts` with virtual authenticator utilities
  - Created `e2e/tests/auth/passkey.spec.ts` with 5 passkey-specific tests
  - Added `e2e/docs/WEBAUTHN_TESTING_PLAN.md` documenting the testing approach

### Security
- **Next.js CVE-2025-29927 Middleware Bypass** - Updated Next.js to 16.0.6
  - Frontend and Admin upgraded from 14.2.18 to 16.0.6
  - Fixes critical authorization bypass vulnerability (CVSS 9.1)
  - Attackers could bypass middleware-based auth via `x-middleware-subrequest` header
  - BSIM was not directly exploitable (no middleware auth) but upgraded as best practice

### Fixed
- **Admin Detail Pages Not Loading** - Fixed "View Details" error on admin and user pages
  - Next.js 16 changed `params` prop to be async (Promise) that must be awaited
  - Updated `/admins/[id]` and `/users/[id]` pages to properly await params
  - Both admin and user detail pages now load correctly

- **E2E OIDC Tests Environment Mismatch** - Fixed tests failing when run against production
  - SSIM URL was hardcoded to `ssim-dev.banksim.ca`, causing tests to create users on production BSIM but authenticate via dev SSIM/auth-server
  - Added `getSsimUrl()` function to derive SSIM URL from `BASE_URL`:
    - Production (`BASE_URL=https://banksim.ca`) → `https://ssim.banksim.ca`
    - Dev (default) → `https://ssim-dev.banksim.ca`
  - All 76 E2E tests now pass against production
  - CI/CD-ready: tests work correctly in any environment with proper `BASE_URL`

- **Passkey Registration BigInt Serialization** - Fixed "Failed to verify passkey registration" error in production
  - The passkey `counter` field (BigInt) was causing JSON serialization to fail when returning the response
  - Passkeys were being saved correctly but the API response threw an error, confusing users
  - Now returns only safe, serializable fields (id, createdAt, deviceType, backedUp) in the response

- **Frontend API URL for AWS Production** - Fixed 404 errors on signup/login API calls in production
  - Frontend was always using relative `/api` path in the browser, ignoring `NEXT_PUBLIC_API_URL`
  - In AWS, the backend is on `api.banksim.ca` while frontend is on `banksim.ca`
  - Updated `frontend/lib/api.ts` to properly use `NEXT_PUBLIC_API_URL` when set (baked in at build time)
  - Frontend now correctly calls `https://api.banksim.ca/api` in production

- **Signup Auto-Generate Preserves User Input** - Fixed auto-generate overwriting user-provided data
  - Auto-generate test data button was overwriting email and other step 1 fields
  - Now preserves firstName, lastName, email, password if already filled in
  - Only generates values for empty fields, always fills step 2 customer info fields

- **Password Manager Credential Detection** - Fixed password manager saving phone number as username
  - Added proper `autocomplete` attributes to all signup form fields
  - Added hidden email/password fields in step 2 form for credential association
  - Browser password managers now correctly identify email as the username

- **Cross-Subdomain Passkey Authentication** - Fixed passkeys not working across subdomains
  - Passkeys registered on `admin.banksim.ca` were not usable on `auth.banksim.ca`
  - Auth server had `RP_ID=auth.banksim.ca` instead of the parent domain `banksim.ca`
  - All services (admin, auth-server) now use `RP_ID=banksim.ca` for cross-subdomain passkey sharing
  - Updated docker-compose.yml and AWS deployment documentation
  - Also fixed for local dev: `admin-dev.banksim.ca` passkeys now work on `auth-dev.banksim.ca`

- **OIDC Resource Indicator Crash** - Fixed server error when third-party apps request authorization
  - `getResourceServerInfo` was returning `undefined` for unknown/mismatched resources
  - Caused `TypeError: Cannot read properties of undefined (reading 'audience')` crash
  - Now always returns valid resource server config for any resource indicator
  - Added debug logging to track resource indicator requests

- **Production Database Missing Tables/Columns** - Fixed 500 errors on `/api/settings` endpoint
  - `site_settings` table was missing from production database (model existed in schema but no migration)
  - `postLogoutRedirectUris` column was missing from `oauth_clients` table (needed for OIDC logout)
  - Created and applied migrations via ECS Fargate tasks to sync production DB with Prisma schema
  - Added migration files: `20251201_add_site_settings/`, `20251201_add_post_logout_redirect_uris/`

### Changed
- **AWS Deployment Documentation** - Updated for SSIM service and build architecture
  - Added SSIM (Store Simulator) to architecture diagram and services table
  - Added note about SSIM being from separate repository (https://github.com/jordancrombie/ssim)
  - Added `--platform linux/amd64` to Docker build commands for Apple Silicon compatibility
  - Added architecture note: AWS/ECS requires amd64, local dev uses native (ARM64 on Apple Silicon)
  - **Added critical warning about Next.js build arguments** - frontend/admin require `--build-arg` flags
    - `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_DOMAIN`, `NEXT_PUBLIC_BACKEND_PORT` must be passed at build time
    - These are baked into the JS bundle; forgetting them causes 404 errors in production
    - Updated both initial build section and "Updating the Application" section with examples

### Added
- **Comprehensive E2E Test Suite** - Full Playwright end-to-end test coverage (76 tests)
  - **Auth Tests** (17 tests):
    - Login flow: valid credentials, invalid email, incorrect password, empty fields
    - Signup flow: full flow, minimal fields, validation, duplicate email detection
    - Dashboard: navigation, session persistence, logout, protected routes
  - **Banking Tests** (28 tests):
    - Account management: create all account types (checking, savings, money market, CD)
    - Account operations: deposits, withdrawals, balance verification
    - Credit card management: create all card types (Visa, Mastercard, AMEX, debit variants)
    - Credit card transactions: payments, card details display
  - **Inter-Customer Transfer Tests** (8 tests):
    - Transfer money between users via email address
    - Verify transfer on both sender and recipient sides
    - Error handling: invalid recipient, insufficient funds, no account
  - **Open Banking OIDC Flow Tests** (9 tests) - Requires [SSIM](https://github.com/jordancrombie/ssim):
    - Complete OAuth 2.0/OIDC authorization code flow
    - User authentication on BSIM auth server
    - Consent page with account selection
    - Profile data display after authorization
    - KENOK Open Banking account fetch via API
    - Authorization denial and invalid credentials handling
    - RP-initiated logout through auth server
  - **Test Architecture**:
    - Tests are atomic and self-contained (create own users via beforeAll hooks)
    - Serial execution for dependent tests within suites
    - Parallel execution across workers for independent suites
    - Support for local (`https://localhost`), dev, and production environments
  - Commands: `make e2e`, `make e2e-headed`, `make e2e-ui`, `npm run test:local`

- **Local Dev Admin Management Script** - New script for managing admin users locally
  - `./scripts/dev-admin.sh reset-admin` - Delete all admin users (triggers first-user setup)
  - `./scripts/dev-admin.sh delete-passkeys` - Delete all admin passkeys (keeps users)
  - `./scripts/dev-admin.sh list-admins` - List all admin users with passkey counts
  - Supports `-y/--yes` flag to skip confirmation prompts

- **AWS Admin Management Script** - New script for managing admin users in AWS production
  - `./scripts/aws-admin.sh reset-admin` - Delete all admin users (triggers first-user setup)
  - `./scripts/aws-admin.sh delete-passkeys` - Delete all admin passkeys (keeps users)
  - `./scripts/aws-admin.sh list-admins` - List all admin users with passkey counts
  - Runs one-off ECS Fargate tasks to execute database operations securely

- **Local Development Domain Configuration** - Separate dev subdomain pattern for local development
  - New `*-dev.banksim.ca` subdomain pattern for local development (compatible with `*.banksim.ca` wildcard cert)
  - Production uses: `banksim.ca`, `admin.banksim.ca`, `auth.banksim.ca`, `openbanking.banksim.ca`, `ssim.banksim.ca`
  - Local dev uses: `dev.banksim.ca`, `admin-dev.banksim.ca`, `auth-dev.banksim.ca`, `openbanking-dev.banksim.ca`, `ssim-dev.banksim.ca`
  - New `docker-compose.dev.yml` override file for local development configuration
  - New `nginx/nginx.dev.conf` with dev subdomain routing
  - Makefile targets: `make dev-up`, `make dev-down`, `make dev-build`, `make dev-logs`, `make dev-hosts`
  - Auth server now uses configurable `OPENBANKING_AUDIENCE` env var for resource indicator
  - All hardcoded domain references replaced with environment variable configuration
- **Unit Test Suite** - Comprehensive Jest test coverage for all modules (462 tests total)
  - Jest test framework with ts-jest for TypeScript support
  - Mock repositories for isolated testing without database dependencies
  - **Backend Tests** (229 tests):
    - **AuthService tests** (12 tests): registration, login, JWT tokens, password hashing
    - **AuthController tests** (15 tests): HTTP handlers, validation, error responses
    - **AccountService tests** (42 tests): account creation, deposits, withdrawals, transfers, email-based transfers, notification integration
    - **AccountController tests** (31 tests): HTTP handlers, authentication, ownership validation, transfers
    - **CreditCardService tests** (33 tests): card creation, charges, payments, refunds
    - **CreditCardController tests** (34 tests): HTTP handlers, authentication, ownership validation, transactions
    - **NotificationService tests** (24 tests): CRUD operations, unread count, mark as read, transfer notifications
    - **NotificationController tests** (16 tests): HTTP handlers, authentication, query parameters
    - **PasskeyService tests** (21 tests): registration options, verification, authentication, passkey management
  - **Open Banking Tests** (74 tests):
    - **ConsentService tests** (16 tests): consent management, account filtering, scope verification, expiration handling
    - **tokenValidator middleware tests** (15 tests): JWT validation, scope checking, JWKS integration, error handling
    - **AccountController tests** (22 tests): FDX-style account listing, details, transactions, pagination
    - **CustomerController tests** (11 tests): scope-based profile data (profile, email, contact info)
    - **UserController tests** (10 tests): fi_user_ref based account lookup, authorization checks
  - **Auth Server Tests** (90 tests):
    - **PrismaAdapter tests** (24 tests): OIDC token storage, upsert, find by ID/userCode/uid, consume, destroy, revoke by grantId
    - **verifyUserPassword tests** (7 tests): credential validation, password verification, user lookup
    - **Admin routes tests** (23 tests): OAuth client CRUD, secret generation, duplicate handling, session management
    - **Interaction routes tests** (15 tests): login flow, consent flow, abort handling, account selection
    - **Admin Auth middleware tests** (11 tests): JWT token creation/verification, auth middleware, cookie management
    - **Admin Auth routes tests** (10 tests): login page, passkey authentication options, logout handlers
  - **Admin Module Tests** (69 tests):
    - **Auth library tests** (10 tests): JWT token creation, verification, session management
    - **Passkey library tests** (17 tests): registration options, registration verification, authentication options, authentication verification
    - **Credit Card Types API tests** (20 tests): CRUD operations, authentication, validation, duplicate handling
    - **Account Types API tests** (16 tests): CRUD operations, authentication, validation, duplicate handling
    - **Users API tests** (6 tests): user listing, ordering, count aggregation
  - Test commands: `npm test`, `npm run test:watch`, `npm run test:coverage`
  - Mock implementations: MockUserRepository, MockAccountRepository, MockTransactionRepository, MockCreditCardRepository, MockCreditCardTransactionRepository, MockNotificationRepository, MockPrismaClient (openbanking, auth-server, admin)
- **Account Type Support** - Proper account categorization in database
  - New `AccountType` enum: CHECKING, SAVINGS, MONEY_MARKET, CERTIFICATE_OF_DEPOSIT
  - `accountType` field on Account model (defaults to CHECKING)
  - Open Banking API endpoints now return stored account type instead of hardcoded value
  - Database migration: `20251129_add_account_type`
- **Credit Card Type Support** - Card network/product categorization
  - New `CreditCardType` enum: VISA, VISA_DEBIT, MC, MC_DEBIT, AMEX
  - `cardType` field on CreditCard model (defaults to VISA)
  - Card type selector in Create Credit Card modal
  - Card type-specific card number prefixes (4 for Visa, 51-55 for MC, 34/37 for AMEX)
  - AMEX cards use 4-digit CVV, others use 3-digit
  - Visual card type display on credit card list with type-specific gradients
  - Database migration: `20251129_add_credit_card_type`
- **Credit Card Holder Name Default** - Auto-populate from user account
  - Card holder name defaults to user's first and last name when not specified
  - Eliminates generic "Card Holder" placeholder text
- **Credit Card Type Administration** - Admin interface for managing card types
  - New `CreditCardTypeConfig` database model for configurable card types
  - Admin UI page at `/card-types` for listing and managing card types
  - CRUD operations: create, edit, delete, toggle active/inactive
  - Configurable properties: code, display name, card number prefix(es), card length, CVV length, debit flag, sort order
  - Default card types seeded: VISA, VISA Debit, Mastercard, Mastercard Debit, American Express
  - API routes: `GET/POST /api/credit-card-types`, `GET/PUT/DELETE /api/credit-card-types/[id]`
  - Database migration: `20251129_add_credit_card_type_config`
- **Account Type Administration** - Admin interface for managing account types
  - New `AccountTypeConfig` database model for configurable account types
  - Admin UI page at `/account-types` for listing and managing account types
  - CRUD operations: create, edit, delete, toggle active/inactive
  - Configurable properties: code, display name, description, sort order
  - Default account types seeded: Checking Account, Savings Account, Money Market Account, Certificate of Deposit
  - API routes: `GET/POST /api/account-types`, `GET/PUT/DELETE /api/account-types/[id]`
  - Database migration: `20251129_add_account_type_config`
- **Credit Card Detail Page** - View individual credit card details and transactions
  - New page at `/dashboard/credit-cards/[cardNumber]` with card visualization
  - Balance overview showing current balance, available credit, and credit limit
  - Credit utilization bar with color-coded status (green/yellow/red)
  - Full transaction history with merchant details
- **Account Detail Page** - View individual account details and transactions
  - New page at `/dashboard/accounts/[accountNumber]` with account overview
  - Account header showing account number, type badge, and current balance
  - Deposit and Withdraw functionality with modal dialogs
  - Full transaction history with type indicators (deposit/withdrawal/transfer)
  - Color-coded transaction amounts (green for credits, red for debits)
- **Notification System** - Real-time notification center for user activity
  - Notification bell icon in dashboard header with unread count badge
  - Dropdown notification panel with full notification history
  - Notification types: TRANSFER_RECEIVED, TRANSFER_SENT, ACCOUNT_CREATED, CREDIT_CARD_CREATED, PAYMENT_DUE, SYSTEM
  - Auto-generated notifications when sending or receiving transfers
  - Mark individual notifications as read or mark all as read
  - 30-second polling for new notification updates
  - Visual indicators for unread notifications (blue dot, highlighted background)
  - Time-ago formatting (e.g., "5m ago", "2h ago")
  - Database migration: `20251130_add_notifications`
  - Backend: NotificationService, NotificationController, PrismaNotificationRepository
  - API endpoints: GET /api/notifications, GET /api/notifications/unread-count, PATCH /api/notifications/:id/read, PATCH /api/notifications/read-all, DELETE /api/notifications/:id
- **Email-Based Money Transfers** - Send money to users by email address
  - New transfer page at `/dashboard/transfer` for sending money to other users
  - Transfer by recipient email instead of account number
  - Backend validates recipient exists and has at least one account
  - Funds are deposited to recipient's primary (first) account
  - Transfer API now accepts `toEmail` as alternative to `toAccountNumber`
  - Response includes recipient email and account number for confirmation
  - Added Credit Cards link to dashboard sidebar navigation
- **Enhanced Credit Card Transactions** - Merchant and transaction details
  - New fields: `merchantName`, `merchantId`, `mccCode`, `transactionDate`
  - MCC (Merchant Category Code) display with category descriptions
  - Transaction date separate from record creation timestamp
  - Charge API now accepts merchant details for realistic transaction simulation
  - Database migration: `20251129_enhance_credit_card_transactions`
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
  - **Passkey authentication** - Same AdminUser/AdminPasskey-based auth as admin.banksim.ca
  - Login page with WebAuthn/passkey support
  - JWT session management with secure cookies
  - **Session Management** - View and revoke active OAuth/OIDC sessions
    - Sessions tab showing all active consents with user/client details
    - Dashboard stats: active sessions, unique users, active token counts
    - Revoke individual sessions (deletes all associated OIDC tokens)
    - Revoke all sessions for a specific user
    - Navigation tabs between Clients and Sessions views
  - Logout functionality
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
