# BSIM - Banking Simulator

A full-stack banking simulator application with user authentication, account management, and transaction processing. Built with TypeScript, Express.js, PostgreSQL, and Next.js (frontend coming soon).

## Features

- 🔐 User authentication with JWT
- 💰 Account creation and management
- 📊 Transaction tracking (deposits, withdrawals, transfers)
- 🗄️ PostgreSQL database with Prisma ORM
- 🐳 Docker support for easy development
- 🏗️ Clean architecture with repository pattern
- 🔄 Database-agnostic design (easy to swap PostgreSQL for MongoDB)

## Quick Start

### Prerequisites

- Node.js 18+
- Docker Desktop (for PostgreSQL)

### 1. Start the Database

```bash
# Start Docker Desktop first, then:
./scripts/db.sh start
```

This starts a PostgreSQL container ready for development.

### 2. Set Up and Run Backend

```bash
cd backend

# Install dependencies
npm install

# Generate Prisma client and run migrations
npm run prisma:generate
npm run prisma:migrate

# Start the development server
npm run dev
```

The API will be available at `http://localhost:3001`

### 3. Test the API

```bash
# Check health
curl http://localhost:3001/health

# Register a user
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "firstName": "John",
    "lastName": "Doe"
  }'
```

## Documentation

- **[QUICKSTART.md](QUICKSTART.md)** - Get started in 5 minutes
- **[BACKEND_SETUP.md](BACKEND_SETUP.md)** - Detailed backend documentation
- **[IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md)** - Full architecture overview

## Project Structure

```
bsim/
├── backend/                # Express.js API server
│   ├── src/
│   │   ├── config/        # Configuration
│   │   ├── models/        # Domain models
│   │   ├── repositories/  # Data access layer
│   │   ├── services/      # Business logic
│   │   ├── controllers/   # HTTP handlers
│   │   ├── middleware/    # Auth & error handling
│   │   ├── routes/        # API routes
│   │   └── utils/         # Helper functions
│   └── prisma/            # Database schema
├── frontend/              # Next.js app (coming soon)
├── shared/                # Shared types
├── scripts/               # Helper scripts
│   └── db.sh             # Database management
└── docker-compose.yml     # PostgreSQL container
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login and get JWT token
- `GET /api/auth/me` - Get current user (protected)

### Accounts
- `GET /api/accounts` - List user's accounts (protected)
- `POST /api/accounts` - Create new account (protected)
- `GET /api/accounts/:accountNumber` - Get account details (protected)
- `GET /api/accounts/:accountNumber/transactions` - Transaction history (protected)

### Transactions
- `POST /api/transactions/deposit` - Deposit money (protected)
- `POST /api/transactions/withdraw` - Withdraw money (protected)
- `POST /api/transactions/transfer` - Transfer between accounts (protected)

## Development

### Database Management

```bash
# Start database
./scripts/db.sh start

# Stop database
./scripts/db.sh stop

# View database in GUI
./scripts/db.sh studio

# Run migrations
./scripts/db.sh migrate

# Reset database (deletes all data)
./scripts/db.sh reset

# View logs
./scripts/db.sh logs
```

### Running the Backend

```bash
cd backend

# Development mode (with hot reload)
npm run dev

# Build for production
npm run build

# Run production build
npm start
```

## Architecture

### Repository Pattern

The application uses the repository pattern for database abstraction:

```
Controllers → Services → Repositories → Database
```

**Benefits:**
- Easy to swap databases (PostgreSQL ↔ MongoDB)
- Clean separation of concerns
- Testable business logic
- No database-specific code in services

### Tech Stack

**Backend:**
- Express.js - Web framework
- TypeScript - Type safety
- Prisma ORM - Database toolkit
- PostgreSQL - Database
- JWT - Authentication
- bcrypt - Password hashing
- Zod - Validation

**Frontend (Coming Soon):**
- Next.js 14
- React
- Tailwind CSS
- Axios

## Environment Variables

Backend ([backend/.env](backend/.env)):
```env
DATABASE_URL="postgresql://bsim:bsim_dev_password@localhost:5432/bsim"
JWT_SECRET="dev-secret-key-change-in-production"
JWT_EXPIRES_IN="7d"
PORT=3001
CORS_ORIGIN="http://localhost:3000"
NODE_ENV="development"
```

⚠️ **Important:** Change `JWT_SECRET` to a secure random string in production!

## Next Steps

- [x] Backend API implementation
- [x] Docker setup for PostgreSQL
- [ ] Next.js frontend
- [ ] Mobile app support
- [ ] Production deployment

## License

MIT

## Repository

https://github.com/jordancrombie/bsim

---

Built with ❤️ using TypeScript and modern web technologies.
