-- CreateEnum
CREATE TYPE "PaymentAuthorizationStatus" AS ENUM ('PENDING', 'AUTHORIZED', 'CAPTURED', 'PARTIALLY_CAPTURED', 'VOIDED', 'DECLINED', 'EXPIRED');

-- CreateTable
CREATE TABLE "payment_consents" (
    "id" TEXT NOT NULL,
    "cardToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "creditCardId" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "merchantName" TEXT NOT NULL,
    "maxAmount" DECIMAL(15,2),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_authorizations" (
    "id" TEXT NOT NULL,
    "authorizationCode" TEXT NOT NULL,
    "consentId" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CAD',
    "merchantId" TEXT NOT NULL,
    "merchantName" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "status" "PaymentAuthorizationStatus" NOT NULL DEFAULT 'PENDING',
    "capturedAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "declineReason" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_authorizations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payment_consents_cardToken_key" ON "payment_consents"("cardToken");

-- CreateIndex
CREATE INDEX "payment_consents_userId_idx" ON "payment_consents"("userId");

-- CreateIndex
CREATE INDEX "payment_consents_creditCardId_idx" ON "payment_consents"("creditCardId");

-- CreateIndex
CREATE INDEX "payment_consents_merchantId_idx" ON "payment_consents"("merchantId");

-- CreateIndex
CREATE UNIQUE INDEX "payment_authorizations_authorizationCode_key" ON "payment_authorizations"("authorizationCode");

-- CreateIndex
CREATE INDEX "payment_authorizations_consentId_idx" ON "payment_authorizations"("consentId");

-- CreateIndex
CREATE INDEX "payment_authorizations_status_idx" ON "payment_authorizations"("status");

-- CreateIndex
CREATE INDEX "payment_authorizations_expiresAt_idx" ON "payment_authorizations"("expiresAt");

-- AddForeignKey
ALTER TABLE "payment_authorizations" ADD CONSTRAINT "payment_authorizations_consentId_fkey" FOREIGN KEY ("consentId") REFERENCES "payment_consents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
