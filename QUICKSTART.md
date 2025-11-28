# BSIM Quick Start Guide

Get the BSIM backend up and running in 5 minutes!

## Prerequisites

- Node.js 18+ installed
- Docker installed ([Get Docker](https://docs.docker.com/get-docker/))

## Quick Setup

### 1. Start PostgreSQL Container

```bash
# Option A: Using the helper script (recommended)
./scripts/db.sh start

# Option B: Using docker compose directly
docker compose up -d
```

This starts a PostgreSQL 15 container with:
- **Database**: `bsim`
- **User**: `bsim`
- **Password**: `bsim_dev_password`
- **Port**: `5432`

### 2. Set Up Backend

```bash
cd backend

# Install dependencies (if not already done)
npm install

# Generate Prisma client
npm run prisma:generate

# Run database migrations
npm run prisma:migrate

# Start the backend server
npm run dev
```

The API will be running at `http://localhost:3001`

### 3. Test the API

**Check health:**
```bash
curl http://localhost:3001/health
```

**Register a user:**
```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "firstName": "John",
    "lastName": "Doe"
  }'
```

Save the `token` from the response!

**Create an account:**
```bash
curl -X POST http://localhost:3001/api/accounts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "initialBalance": 1000
  }'
```

**Get your accounts:**
```bash
curl http://localhost:3001/api/accounts \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## Database Management Commands

```bash
# Start database
./scripts/db.sh start

# Stop database
./scripts/db.sh stop

# View logs
./scripts/db.sh logs

# Run migrations
./scripts/db.sh migrate

# Open Prisma Studio (GUI for database)
./scripts/db.sh studio

# Connect to PostgreSQL CLI
./scripts/db.sh psql

# Reset database (deletes all data!)
./scripts/db.sh reset

# Check status
./scripts/db.sh status
```

## Development Workflow

### Starting Fresh Each Day

```bash
# 1. Start database
./scripts/db.sh start

# 2. Start backend
cd backend
npm run dev
```

### Viewing Data

**Option 1: Prisma Studio (GUI)**
```bash
./scripts/db.sh studio
# Opens at http://localhost:5555
```

**Option 2: PostgreSQL CLI**
```bash
./scripts/db.sh psql

# Then run SQL commands:
SELECT * FROM users;
SELECT * FROM accounts;
SELECT * FROM transactions;
```

### Resetting Everything

```bash
# Complete reset (deletes all data)
./scripts/db.sh reset
```

## Project Structure

```
bsim/
├── docker-compose.yml         # PostgreSQL container config
├── scripts/
│   └── db.sh                  # Database helper script
└── backend/
    ├── src/                   # Backend source code
    ├── prisma/
    │   └── schema.prisma      # Database schema
    ├── .env                   # Environment variables
    └── package.json
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login and get JWT token
- `GET /api/auth/me` - Get current user info

### Accounts
- `GET /api/accounts` - List user's accounts
- `POST /api/accounts` - Create new account
- `GET /api/accounts/:accountNumber` - Get account details
- `GET /api/accounts/:accountNumber/transactions` - Transaction history

### Transactions
- `POST /api/transactions/deposit` - Deposit money
- `POST /api/transactions/withdraw` - Withdraw money
- `POST /api/transactions/transfer` - Transfer between accounts

### System
- `GET /health` - Health check

## Common Issues

### Port 5432 already in use
If you have PostgreSQL running locally:
```bash
# Stop local PostgreSQL
brew services stop postgresql

# Or change the port in docker-compose.yml
ports:
  - "5433:5432"  # Use 5433 instead
```

Then update `.env`:
```
DATABASE_URL="postgresql://bsim:bsim_dev_password@localhost:5433/bsim"
```

### Prisma Client not generated
```bash
cd backend
npm run prisma:generate
```

### Migrations out of sync
```bash
./scripts/db.sh reset
```

## Next Steps

- [Backend Setup Guide](BACKEND_SETUP.md) - Detailed backend documentation
- [Implementation Plan](IMPLEMENTATION_PLAN.md) - Full architecture overview
- Build the Next.js frontend
- Deploy to production

## Stopping Everything

```bash
# Stop backend (Ctrl+C in terminal)

# Stop database
./scripts/db.sh stop
```

## Environment Variables

The backend uses these environment variables ([backend/.env](backend/.env)):

```env
DATABASE_URL="postgresql://bsim:bsim_dev_password@localhost:5432/bsim"
JWT_SECRET="dev-secret-key-change-in-production"
JWT_EXPIRES_IN="7d"
PORT=3001
CORS_ORIGIN="http://localhost:3000"
NODE_ENV="development"
```

⚠️ **Never commit `.env` to git!** It's already in `.gitignore`.

---

**Ready to test?** Run `./scripts/db.sh start` and `cd backend && npm run dev`!
