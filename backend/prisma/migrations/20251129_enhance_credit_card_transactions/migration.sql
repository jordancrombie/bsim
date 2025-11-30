-- AlterTable: Add merchant details and transaction date to credit_card_transactions
ALTER TABLE "credit_card_transactions" ADD COLUMN "merchantName" TEXT;
ALTER TABLE "credit_card_transactions" ADD COLUMN "merchantId" TEXT;
ALTER TABLE "credit_card_transactions" ADD COLUMN "mccCode" TEXT;
ALTER TABLE "credit_card_transactions" ADD COLUMN "transaction_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
