# BSIM Project TODO

Last Updated: December 29, 2025

## Completed ✅

### Micro Merchant Fee Collection (December 2025)
- [x] Add `FEE` transaction type to TransactionType enum
- [x] Add `SystemConfig` model for key-value configuration
- [x] Extend P2P credit API with fee parameters (`feeAmount`, `feeAccountId`, `merchantName`)
- [x] Implement atomic fee collection (merchant net + fee account credited together)
- [x] Add fee account configuration endpoints (GET/PUT /api/p2p/config/fee-account)
- [x] Create system user and fee account for dev environment
- [x] Configure fee account via API

### NewBank Open Banking Integration (December 2025)
- [x] Add NewBank as OIDC provider for SSIM in dev environment
- [x] Add NewBank as OIDC provider for Regalmoose in dev environment
- [x] Register ssim-client OAuth client in NewBank auth server
- [x] Register regalmoose-client OAuth client in NewBank auth server
- [x] Add redirect URIs for `/auth/callback/newbank` endpoints
- [x] Fix OPENBANKING_AUDIENCE config in NewBank auth server (was missing)
- [x] Fix scope configuration (removed `payment:authorize` from OIDC login flow)

### NSIM Database Persistence (December 2025)
- [x] Add PostgreSQL database support to NSIM (replaces in-memory storage)
- [x] Create `nsim` database in RDS with `nsim_*` prefixed tables
- [x] Add Prisma schema for payment transactions, webhook configs, and delivery history
- [x] Update NSIM Dockerfile with OpenSSL for Prisma compatibility
- [x] Deploy to production with DATABASE_URL environment variable
- [x] Register webhooks for ssim-client and regalmoose-client in production
- [x] Fix webhook signature format (`sha256=<hex>` prefix)
- [x] Fix webhook payload field name (`type` instead of `event`)
- [x] Update docker-compose.yml for local dev with database persistence
- [x] Create `nsim` database locally and sync schema with `prisma db push`
- [x] Register dev webhooks for ssim-client and regalmoose-client

### Mobile Wallet Payment Flow - iOS Safari & Chrome (December 2025)
- [x] Implement `POST /api/wallet/request-token` endpoint for mobile payment flow
- [x] Add wallet credential authentication for the endpoint
- [x] Validate card is in permitted cards list
- [x] Generate ephemeral card tokens (5-minute expiry)
- [x] Create PaymentConsent record for audit trail
- [x] Add 17 unit tests for walletRoutes
- [x] Create deployment script `LOCAL_SCRIPTS/dev_bsim_backend_deploy_code_only.sh`
- [x] Test mobile payment flow end-to-end with WSIM and SSIM
- [x] Add `MWSIM_BROWSER_AWARE` env var for browser-aware deep links
- [x] Deploy SSIM v1.13.3 with cross-tab order confirmation support
- [x] Verify full checkout flow on iOS Safari and Chrome ✅

### Unit Test Coverage Improvements (December 2025)
- [x] Add unit tests for backend wellKnownRoutes.ts (100% coverage)
- [x] Add unit tests for admin webauthn-origins API routes (~86% coverage)
- [x] Add unit tests for backend middleware (auth.ts, errorHandler.ts - 100% coverage)
- [x] Add unit tests for backend route handlers (accountRoutes, authRoutes, creditCardRoutes, etc.)
- [x] Backend test count: 229 → 300 tests, coverage: 48.38% → 55.42%
- [x] Admin test count: 69 → 100 tests, coverage: 24.77% → 34.89%

### WSIM Integration Phase 1 (December 2025)
- [x] Add `wallet:enroll` scope to auth-server OIDC provider
- [x] Create `WalletCredential` database model and migration
- [x] Implement wallet API endpoints (`/api/wallet/*`)
- [x] Create wallet consent UI with multi-card selection
- [x] Generate `wallet_credential` JWT in token response

### NSIM Production Deployment (December 2025)
- [x] Deploy NSIM to AWS ECS Fargate
- [x] Configure ElastiCache Redis for BullMQ job queue
- [x] Set up ALB listener rules for `nsim.banksim.ca`
- [x] Configure Route53 DNS records
- [x] Integrate payment network with BSIM backend

### Payment Network Integration
- [x] Add `payment:authorize` scope to auth server
- [x] Create payment consent and authorization database models
- [x] Implement `/api/payment-network/authorize` endpoint
- [x] Implement `/api/payment-network/capture` endpoint
- [x] Implement `/api/payment-network/void` endpoint
- [x] Configure API key authentication between NSIM and BSIM

### Open Banking Platform
- [x] Implement OAuth 2.0 Authorization Server with PKCE
- [x] Add OpenID Connect support with ID tokens
- [x] Create `/api/open-banking/accounts` endpoint
- [x] Add Resource Indicators (RFC 8707) for JWT access tokens
- [x] Implement FI User Reference field for TPP user mapping
- [x] Add user accounts endpoint (`/api/open-banking/userinfo/accounts`)
- [x] Add `post_logout_redirect_uris` support

### Admin Interface
- [x] OAuth client management CRUD interface
- [x] User management with FI reference support
- [x] Account and credit card type configuration

### Production Fixes Applied
- [x] Fix environment variable name (`BSIM_PAYMENT_API_KEY`)
- [x] Apply payment network database migrations
- [x] Rebuild auth server with `payment:authorize` scope
- [x] Configure Docker builds for `linux/amd64` platform

## In Progress 🔄

### WSIM Integration Phase 2 (December 2025) ✅
- [x] Update Makefile `dev-hosts` target for WSIM subdomains
- [x] Add WSIM server blocks to nginx.dev.conf
- [x] Add WSIM services to docker-compose files (wsim-backend, wsim-auth-server, wsim-frontend)
- [x] Add WSIM dev overrides to docker-compose.dev.yml
- [x] Create OAuth client seed script (`scripts/seed-oauth-clients.sh`)
- [x] Register WSIM client in BSIM auth-server (run `make db-seed-oauth`)
- [x] Add JWT wallet payment token decoding in SimNetHandler
- [x] Skip merchant ID validation for cryptographically-verified wallet tokens
- [x] Test WSIM wallet payment flow end-to-end ✅

### WSIM AWS Production Deployment ✅ (December 2025)
- [x] Production deployment of WSIM services to AWS ECS (3 Fargate services)
- [x] Create `wsim` database in shared RDS PostgreSQL instance
- [x] Configure ECR repositories for WSIM Docker images
- [x] Set up ALB listener rules for `wsim.banksim.ca` and `wsim-auth.banksim.ca`
- [x] Configure Route53 DNS records
- [x] Register OAuth clients (`wsim-wallet` in BSIM, `ssim-merchant` in WSIM)
- [x] Configure BSIM_PROVIDERS for bank enrollment
- [x] Fix double `/api/api/` URL issue in frontend (rebuild with correct NEXT_PUBLIC_API_URL)
- [x] Fix OAuth client invalid grantTypes (remove `refresh_token`, keep only `authorization_code`)
- [x] Verify enrollment page shows banks correctly

### WSIM Production Enrollment Fixes (December 6, 2025) ✅
- [x] Rebuild and redeploy auth-server with `wallet:enroll` scope (image was outdated)
- [x] Run `prisma db push` to create `wallet_credentials` table in production
- [x] Add missing redirect URI (`/api/enrollment/callback/bsim`) to OAuth client
- [x] Fix client secret (bcrypt → plaintext for oidc-provider compatibility)
- [x] Rebuild and redeploy backend with `/api/wallet/*` routes (image was outdated)
- [x] Update WSIM `BSIM_PROVIDERS.apiUrl` from `banksim.ca` to `api.banksim.ca`

### WSIM Integration Phase 4 (Future)
- [ ] Add WSIM monitoring and CloudWatch alarms
- [ ] Set up auto-scaling for WSIM services

### Documentation
- [ ] Create comprehensive API documentation for payment network
- [ ] Document SSIM integration patterns
- [ ] Add sequence diagrams for complete payment flows

## Planned 📋

### Open Banking Service Improvements (Future)
- [ ] **Add health/cache-clear endpoint to openbanking service**
  - Add `POST /health/clear-cache` endpoint to clear JWKS cache on demand
  - Useful when auth-server is restarted/rebuilt and JWKS may be stale
  - Alternative: Configure shorter JWKS cache TTL (currently uses library defaults)

### Open Banking API Cleanup (Future)
- [ ] **Deprecate legacy `/users/:fiUserRef/accounts` endpoint** - Non-FDX-compliant endpoint
  - Proposal document: `transferSim/LOCAL_DEPLOYMENT_PLANS/BSIM_OPENBANKING_DEPRECATION_PROPOSAL.md`
  - Verify SSIM has migrated to FDX-compliant `GET /accounts` endpoint
  - Verify Regalmoose has migrated (if applicable)
  - Add deprecation warning header to legacy endpoint
  - Remove `userController.ts` and `userRoutes.ts` after clients migrate

### Micro Merchant Fee Enhancements (Future)
- [ ] Per-BSIM admin pricing configuration (allow each bank to set its own fee structure)
- [ ] Prepaid transaction bundles (e.g., 25 transactions @ $0.20 = $5.00)
- [ ] Fee reconciliation reporting endpoint
- [ ] Fee collection analytics dashboard

### Payment Processing Enhancements
- [ ] Add payment history tracking per user
- [ ] Implement recurring payment consent management
- [ ] Add webhook notifications for payment events
- [ ] Create payment analytics dashboard

### Security Enhancements
- [ ] Implement rate limiting on payment endpoints
- [ ] Add fraud detection scoring
- [ ] Enhanced audit logging for payment transactions
- [ ] PCI-DSS compliance documentation

### Multi-Repository Ecosystem
- [ ] Unified deployment scripts across BSIM/NSIM/SSIM
- [ ] Shared TypeScript type definitions package
- [ ] Cross-repository integration testing suite
- [ ] Centralized logging and monitoring

### Developer Experience
- [ ] Local development docker-compose with all services
- [ ] Mock payment network for testing
- [ ] Postman/Bruno collection for API testing
- [ ] CI/CD pipeline improvements

## Architecture Notes

### Current Service Topology (Production) ✅ All Deployed
```
┌─────────────────────────────────────────────────────────────────┐
│                        banksim.ca (ALB)                         │
├─────────────────────────────────────────────────────────────────┤
│  banksim.ca           → BSIM Frontend (User Banking Portal)     │
│  auth.banksim.ca      → BSIM Auth Server (OIDC Provider)        │
│  admin.banksim.ca     → BSIM Admin (Administrative Interface)   │
│  payment.banksim.ca   → NSIM (Payment Network Simulator)        │
│  ssim.banksim.ca      → SSIM (Shopping Site Simulator)          │
│  wsim.banksim.ca      → WSIM Frontend (Wallet UI)               │
│  wsim-auth.banksim.ca → WSIM Auth (Wallet OIDC Provider)        │
│  (internal)           → WSIM Backend (Wallet API on port 3007)  │
└─────────────────────────────────────────────────────────────────┘
```

### Direct Payment Flow (SSIM → NSIM → BSIM)
```
SSIM (Merchant) → NSIM (Network) → BSIM (Issuer)
     │                  │                │
     │ 1. Checkout      │                │
     ├─────────────────→│                │
     │                  │ 2. Auth Request│
     │                  ├───────────────→│
     │                  │                │ 3. User Consent
     │                  │                │    (OAuth + payment:authorize)
     │                  │ 4. Auth Response│
     │                  │←───────────────┤
     │ 5. Payment Result│                │
     │←─────────────────┤                │
```

### Wallet Payment Flow (SSIM → WSIM → BSIM → NSIM → BSIM)
```
SSIM (Merchant) → WSIM (Wallet) → BSIM (Token) → NSIM → BSIM (Issuer)
     │                  │               │           │          │
     │ 1. Wallet Pay    │               │           │          │
     ├─────────────────→│               │           │          │
     │                  │ 2. Get Token  │           │          │
     │                  ├──────────────→│           │          │
     │                  │ 3. JWT Token  │           │          │
     │                  │←──────────────│           │          │
     │ 4. Card Token    │               │           │          │
     │←─────────────────│               │           │          │
     │                           5. Authorize       │          │
     ├─────────────────────────────────────────────→│          │
     │                                              │ 6. Decode│
     │                                              │    JWT   │
     │                                              ├─────────→│
     │                                              │ 7. OK    │
     │                                              │←─────────│
     │ 8. Payment Result                            │          │
     │←─────────────────────────────────────────────│          │
```

## Quick Reference

### Deployment Commands
```bash
# Deploy all BSIM services
./deploy-bsim.sh

# Run database migrations in production
aws ecs run-task --cluster bsim-cluster \
  --task-definition bsim-run-migration \
  --network-configuration "..."

# Force service redeploy
aws ecs update-service --cluster bsim-cluster \
  --service <service-name> --force-new-deployment
```

### Environment Variables
| Service | Key Variable | Purpose |
|---------|--------------|---------|
| Backend | `BSIM_PAYMENT_API_KEY` | API key for NSIM authentication |
| Backend | `DATABASE_URL` | PostgreSQL connection string |
| Auth | `JWT_SIGNING_KEY` | Key for signing access tokens |
| NSIM | `REDIS_URL` | ElastiCache Redis connection |
