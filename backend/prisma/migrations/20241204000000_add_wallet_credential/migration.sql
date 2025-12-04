-- CreateTable
CREATE TABLE "wallet_credentials" (
    "id" TEXT NOT NULL,
    "credentialToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "walletName" TEXT NOT NULL,
    "permittedCards" TEXT[],
    "scopes" TEXT[],
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wallet_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "wallet_credentials_credentialToken_key" ON "wallet_credentials"("credentialToken");

-- CreateIndex
CREATE INDEX "wallet_credentials_userId_idx" ON "wallet_credentials"("userId");

-- CreateIndex
CREATE INDEX "wallet_credentials_walletId_idx" ON "wallet_credentials"("walletId");

-- CreateIndex
CREATE INDEX "wallet_credentials_credentialToken_idx" ON "wallet_credentials"("credentialToken");

-- AddForeignKey
ALTER TABLE "wallet_credentials" ADD CONSTRAINT "wallet_credentials_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
