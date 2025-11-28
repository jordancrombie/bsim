# BSIM - Banking Simulator

A TypeScript-based banking simulator for learning and testing banking operations.

## Features

- Account creation and management
- Deposit and withdrawal operations
- Account-to-account transfers
- Transaction history tracking
- Balance inquiries

## Project Structure

```
bsim/
├── src/
│   ├── index.ts              # Main entry point
│   ├── simulator.ts          # Core simulator logic
│   └── models/
│       ├── account.ts        # Account model
│       └── transaction.ts    # Transaction model
├── dist/                     # Compiled JavaScript (generated)
├── package.json
├── tsconfig.json
└── README.md
```

## Installation

```bash
npm install
```

## Usage

### Development Mode

Run the simulator in development mode with ts-node:

```bash
npm run dev
```

### Build and Run

Build the TypeScript code and run the compiled JavaScript:

```bash
npm run build
npm start
```

## API Examples

```typescript
import { BankingSimulator } from './simulator';

// Create simulator instance
const simulator = new BankingSimulator();

// Create accounts
const account1 = simulator.createAccount('ACC001', 1000);
const account2 = simulator.createAccount('ACC002', 500);

// Deposit money
account1.deposit(200, 'Salary deposit');

// Withdraw money
account1.withdraw(50, 'ATM withdrawal');

// Transfer between accounts
account1.transfer(account2, 100, 'Payment');

// Check balance
console.log(account1.getBalance());

// View transaction history
console.log(account1.getTransactions());
```

## Development

This project uses:
- TypeScript for type-safe development
- Node.js runtime
- ES2020 target

## License

MIT
