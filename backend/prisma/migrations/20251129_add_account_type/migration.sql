-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('CHECKING', 'SAVINGS', 'MONEY_MARKET', 'CERTIFICATE_OF_DEPOSIT');

-- AlterTable: Add account_type column to accounts table
ALTER TABLE "accounts" ADD COLUMN "account_type" "AccountType" NOT NULL DEFAULT 'CHECKING';
