import { BankingSimulator } from './simulator';

/**
 * Main entry point for the banking simulator
 */
function main() {
  console.log('Welcome to BSIM - Banking Simulator');

  const simulator = new BankingSimulator();
  simulator.start();
}

main();
