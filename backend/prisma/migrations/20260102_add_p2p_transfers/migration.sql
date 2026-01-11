-- CreateEnum
CREATE TYPE "P2PDirection" AS ENUM ('DEBIT', 'CREDIT');

-- CreateEnum
CREATE TYPE "P2PStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REVERSED');

-- CreateTable
CREATE TABLE "p2p_transfers" (
    "id" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "direction" "P2PDirection" NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "transactionId" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CAD',
    "status" "P2PStatus" NOT NULL DEFAULT 'PENDING',
    "counterpartyAlias" TEXT,
    "description" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "p2p_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_config" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_config_pkey" PRIMARY KEY ("key")
);

-- CreateIndex (original unique on externalId - will be changed by next migration)
CREATE UNIQUE INDEX "p2p_transfers_externalId_key" ON "p2p_transfers"("externalId");

-- CreateIndex
CREATE INDEX "p2p_transfers_userId_idx" ON "p2p_transfers"("userId");

-- CreateIndex
CREATE INDEX "p2p_transfers_accountId_idx" ON "p2p_transfers"("accountId");

-- CreateIndex
CREATE INDEX "p2p_transfers_status_idx" ON "p2p_transfers"("status");

-- CreateIndex
CREATE INDEX "p2p_transfers_externalId_idx" ON "p2p_transfers"("externalId");
