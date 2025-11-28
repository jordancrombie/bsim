.PHONY: help db-start db-stop db-reset db-migrate backend-dev backend-build frontend-dev install

help:
	@echo "BSIM Development Commands"
	@echo ""
	@echo "Database:"
	@echo "  make db-start      - Start PostgreSQL container"
	@echo "  make db-stop       - Stop PostgreSQL container"
	@echo "  make db-reset      - Reset database (deletes all data)"
	@echo "  make db-migrate    - Run database migrations"
	@echo "  make db-studio     - Open Prisma Studio"
	@echo ""
	@echo "Backend:"
	@echo "  make backend-dev   - Start backend in dev mode"
	@echo "  make backend-build - Build backend for production"
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
