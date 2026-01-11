-- CreateEnum
CREATE TYPE "EscrowStatus" AS ENUM ('PENDING', 'HELD', 'RELEASED', 'RETURNED', 'EXPIRED');

-- AlterEnum (add new transaction types)
ALTER TYPE "TransactionType" ADD VALUE 'ESCROW_HOLD';
ALTER TYPE "TransactionType" ADD VALUE 'ESCROW_RELEASE';
ALTER TYPE "TransactionType" ADD VALUE 'ESCROW_RETURN';

-- CreateTable
CREATE TABLE "escrow_holds" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "contract_service" TEXT NOT NULL DEFAULT 'contractsim',
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CAD',
    "status" "EscrowStatus" NOT NULL DEFAULT 'HELD',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "held_at" TIMESTAMP(3),
    "released_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3) NOT NULL,
    "release_type" TEXT,
    "transfer_reference" TEXT,
    "description" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "escrow_holds_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "escrow_holds_userId_idx" ON "escrow_holds"("userId");

-- CreateIndex
CREATE INDEX "escrow_holds_accountId_idx" ON "escrow_holds"("accountId");

-- CreateIndex
CREATE INDEX "escrow_holds_contract_id_idx" ON "escrow_holds"("contract_id");

-- CreateIndex
CREATE INDEX "escrow_holds_status_idx" ON "escrow_holds"("status");

-- CreateIndex
CREATE INDEX "escrow_holds_expires_at_idx" ON "escrow_holds"("expires_at");

-- CreateIndex (compound unique)
CREATE UNIQUE INDEX "escrow_holds_contract_id_userId_key" ON "escrow_holds"("contract_id", "userId");

-- AddForeignKey
ALTER TABLE "escrow_holds" ADD CONSTRAINT "escrow_holds_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
