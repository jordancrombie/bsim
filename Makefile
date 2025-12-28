.PHONY: help db-start db-stop db-reset db-migrate backend-dev backend-build frontend-dev install dev-up dev-down dev-build dev-logs e2e e2e-headed e2e-ui e2e-install e2e-report e2e-prod

help:
	@echo "BSIM Development Commands"
	@echo ""
	@echo "Docker (Local Dev - dev.banksim.ca):"
	@echo "  make dev-up        - Start all services with dev.banksim.ca domains"
	@echo "  make dev-down      - Stop all dev services"
	@echo "  make dev-build     - Rebuild and start dev services"
	@echo "  make dev-rebuild   - Force rebuild ALL with --no-cache"
	@echo "  make dev-rebuild-frontend - Force rebuild frontend only (fixes API URL)"
	@echo "  make dev-check     - Verify dev environment configuration"
	@echo "  make dev-logs      - View logs from all dev services"
	@echo "  make dev-hosts     - Show /etc/hosts entries needed"
	@echo ""
	@echo "Database:"
	@echo "  make db-start      - Start PostgreSQL container"
	@echo "  make db-stop       - Stop PostgreSQL container"
	@echo "  make db-reset      - Reset database (deletes all data)"
	@echo "  make db-migrate    - Run database migrations"
	@echo "  make db-studio     - Open Prisma Studio"
	@echo "  make db-seed-oauth - Seed OAuth clients (SSIM, WSIM)"
	@echo ""
	@echo "Backend:"
	@echo "  make backend-dev   - Start backend in dev mode"
	@echo "  make backend-build - Build backend for production"
	@echo ""
	@echo "E2E Testing:"
	@echo "  make e2e-install   - Install Playwright and browsers"
	@echo "  make e2e           - Run E2E tests (headless, local dev)"
	@echo "  make e2e-headed    - Run E2E tests with browser visible"
	@echo "  make e2e-ui        - Run E2E tests in Playwright UI mode"
	@echo "  make e2e-report    - Open last test report"
	@echo "  make e2e-prod      - Run E2E tests against production"
	@echo ""
	@echo "Setup:"
	@echo "  make install       - Install all dependencies"
	@echo "  make setup         - Complete setup (db + backend)"

# Database commands
db-start:
	./scripts/db.sh start

db-stop:
	./scripts/db.sh stop

db-reset:
	./scripts/db.sh reset

db-migrate:
	./scripts/db.sh migrate

db-studio:
	./scripts/db.sh studio

db-seed-oauth:
	./scripts/seed-oauth-clients.sh seed-all

# Backend commands
backend-dev:
	cd backend && npm run dev

backend-build:
	cd backend && npm run build

# Setup commands
install:
	cd backend && npm install

setup: db-start
	cd backend && npm install && npm run prisma:generate && npm run prisma:migrate
	@echo ""
	@echo "✅ Setup complete! Run 'make backend-dev' to start the server"

# Docker dev commands (uses *-dev.banksim.ca subdomain pattern)
dev-up:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d

dev-down:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml down

dev-build:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build -d

dev-rebuild:
	@echo "Rebuilding all containers with --no-cache (forces fresh build)..."
	docker compose -f docker-compose.yml -f docker-compose.dev.yml build --no-cache
	docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d

dev-rebuild-frontend:
	@echo "Rebuilding frontend with --no-cache (fixes NEXT_PUBLIC_* vars)..."
	docker compose -f docker-compose.yml -f docker-compose.dev.yml build --no-cache frontend
	docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d frontend

dev-logs:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml logs -f

dev-check:
	@echo "=== Checking Dev Environment Configuration ==="
	@echo ""
	@echo "Backend DOMAIN:"
	@docker exec bsim-backend printenv DOMAIN 2>/dev/null || echo "  Container not running"
	@echo ""
	@echo "Auth ISSUER:"
	@docker exec bsim-auth printenv ISSUER 2>/dev/null || echo "  Container not running"
	@echo ""
	@echo "Frontend API URL (baked at build time):"
	@docker exec bsim-frontend grep -r "banksim.ca/api" .next/server/chunks/ 2>/dev/null | grep -o 'https://[^"]*banksim.ca/api' | head -1 || echo "  Could not detect"
	@echo ""
	@echo "Expected for dev: dev.banksim.ca, auth-dev.banksim.ca, https://dev.banksim.ca/api"
	@echo "If frontend shows 'banksim.ca/api' (no 'dev-'), run: make dev-rebuild-frontend"

dev-hosts:
	@echo ""
	@echo "Add these entries to /etc/hosts or local DNS for development:"
	@echo ""
	@echo "127.0.0.1 dev.banksim.ca"
	@echo "127.0.0.1 admin-dev.banksim.ca"
	@echo "127.0.0.1 auth-dev.banksim.ca"
	@echo "127.0.0.1 openbanking-dev.banksim.ca"
	@echo "127.0.0.1 ssim-dev.banksim.ca"
	@echo "127.0.0.1 payment-dev.banksim.ca"
	@echo "127.0.0.1 wsim-dev.banksim.ca"
	@echo "127.0.0.1 wsim-auth-dev.banksim.ca"
	@echo "127.0.0.1 transfersim-dev.banksim.ca"
	@echo ""
	@echo "All domains use *.banksim.ca wildcard certificate"
	@echo ""

# E2E Testing commands
e2e-install:
	cd e2e && npm install && npm run install-browsers

e2e:
	cd e2e && npm test

e2e-local:
	cd e2e && npm run test:local

e2e-headed:
	cd e2e && npm run test:headed

e2e-ui:
	cd e2e && npm run test:ui

e2e-report:
	cd e2e && npm run report

e2e-dev:
	cd e2e && npm run test:dev

e2e-prod:
	cd e2e && npm run test:prod
