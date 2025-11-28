# BSIM Frontend

Next.js 14 frontend for the BSIM Banking Simulator.

## Setup

```bash
cd frontend
npm install
npm run dev
```

The frontend will run on `http://localhost:3000`

## Project Structure

```
frontend/
├── app/                    # Next.js 14 App Router
│   ├── page.tsx           # Landing page
│   ├── layout.tsx         # Root layout
│   ├── globals.css        # Global styles
│   ├── login/             # Login page (TODO)
│   ├── signup/            # Signup page (TODO)
│   └── dashboard/         # Dashboard pages (TODO)
├── components/            # Reusable components (TODO)
├── lib/                   # Utilities and API client (TODO)
├── types/                 # TypeScript type definitions (TODO)
└── public/                # Static assets

## Next Steps

To complete the frontend, you need to create:

### 1. API Client (`lib/api.ts`)
```typescript
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export const api = axios.create({
  baseURL: API_URL,
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auth API
export const authAPI = {
  register: (data: RegisterData) => api.post('/auth/register', data),
  login: (data: LoginData) => api.post('/auth/login', data),
  me: () => api.get('/auth/me'),
};

// Accounts API
export const accountsAPI = {
  list: () => api.get('/accounts'),
  create: (data: { initialBalance: number }) => api.post('/accounts', data),
  get: (accountNumber: string) => api.get(`/accounts/${accountNumber}`),
  getTransactions: (accountNumber: string) =>
    api.get(`/accounts/${accountNumber}/transactions`),
};

// Transactions API
export const transactionsAPI = {
  deposit: (data: DepositData) => api.post('/transactions/deposit', data),
  withdraw: (data: WithdrawData) => api.post('/transactions/withdraw', data),
  transfer: (data: TransferData) => api.post('/transactions/transfer', data),
};
```

### 2. Authentication Context (`lib/auth-context.tsx`)
Create a React Context to manage authentication state across the app.

### 3. Login Page (`app/login/page.tsx`)
Form with email/password that calls the `/api/auth/login` endpoint.

### 4. Signup Page (`app/signup/page.tsx`)
Registration form that calls `/api/auth/register`.

### 5. Dashboard Layout (`app/dashboard/layout.tsx`)
Protected route layout with navigation sidebar.

### 6. Dashboard Pages
- `app/dashboard/page.tsx` - Overview/home
- `app/dashboard/accounts/page.tsx` - List accounts
- `app/dashboard/accounts/[id]/page.tsx` - Account details
- `app/dashboard/transfer/page.tsx` - Transfer form

### 7. Components
- `components/AccountCard.tsx` - Display account info
- `components/TransactionList.tsx` - Show transaction history
- `components/DepositForm.tsx` - Deposit money form
- `components/WithdrawForm.tsx` - Withdraw money form
- `components/TransferForm.tsx` - Transfer form

## Environment Variables

Copy `.env.local`:
```
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

## API Integration

The backend API is running at `http://localhost:3001/api` with the following endpoints:

### Authentication
- `POST /auth/register` - Register new user
- `POST /auth/login` - Login (returns JWT token)
- `GET /auth/me` - Get current user (requires token)

### Accounts
- `GET /accounts` - List user's accounts
- `POST /accounts` - Create account
- `GET /accounts/:accountNumber` - Get account details
- `GET /accounts/:accountNumber/transactions` - Transaction history

### Transactions
- `POST /transactions/deposit` - Deposit money
- `POST /transactions/withdraw` - Withdraw money
- `POST /transactions/transfer` - Transfer between accounts

## Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Tech Stack

- Next.js 14 (App Router)
- React 18
- TypeScript
- Tailwind CSS
- Axios for API calls

## Current Status

✅ Project setup complete
✅ Tailwind CSS configured
✅ Landing page created
⏳ Authentication pages (TODO)
⏳ Dashboard (TODO)
⏳ API client (TODO)
⏳ Components (TODO)

## Quick Reference

The frontend is set up as a foundation. To continue development:

1. Install dependencies: `npm install`
2. Create the API client in `lib/api.ts`
3. Build authentication pages
4. Create the dashboard
5. Add banking operation forms

See the backend API documentation in `/backend/BACKEND_SETUP.md` for API details.
