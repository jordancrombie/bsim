# BSIM Project TODO

Last Updated: December 4, 2025

## Completed ✅

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

### WSIM Integration Phase 2-4
- [ ] Update Makefile `dev-hosts` target for WSIM subdomains
- [ ] Add WSIM server blocks to nginx.dev.conf
- [ ] Add WSIM services to docker-compose files
- [ ] Register WSIM client in BSIM auth-server
- [ ] Update SSIM environment for WSIM support
- [ ] Update NSIM environment for wallet token routing

### Documentation
- [ ] Create comprehensive API documentation for payment network
- [ ] Document SSIM integration patterns
- [ ] Add sequence diagrams for complete payment flows

## Planned 📋

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

### Current Service Topology (Production)
```
┌─────────────────────────────────────────────────────────────────┐
│                        banksim.ca (ALB)                         │
├─────────────────────────────────────────────────────────────────┤
│  banksim.ca      → BSIM Frontend (User Banking Portal)          │
│  api.banksim.ca  → BSIM Backend (Banking API + Auth Server)     │
│  admin.banksim.ca→ BSIM Admin (Administrative Interface)        │
│  nsim.banksim.ca → NSIM (Payment Network Simulator)             │
│  ssim.banksim.ca → SSIM (Shopping Site Simulator)               │
└─────────────────────────────────────────────────────────────────┘
```

### Payment Flow
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
