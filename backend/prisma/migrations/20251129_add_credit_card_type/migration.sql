-- CreateEnum
CREATE TYPE "CreditCardType" AS ENUM ('VISA', 'VISA_DEBIT', 'MC', 'MC_DEBIT', 'AMEX');

-- AlterTable: Add card_type column to credit_cards table
ALTER TABLE "credit_cards" ADD COLUMN "card_type" "CreditCardType" NOT NULL DEFAULT 'VISA';
