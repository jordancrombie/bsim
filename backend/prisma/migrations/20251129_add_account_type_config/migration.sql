-- CreateTable
CREATE TABLE "account_type_configs" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_type_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "account_type_configs_code_key" ON "account_type_configs"("code");

-- Seed default account types
INSERT INTO "account_type_configs" ("id", "code", "name", "description", "isActive", "sortOrder", "createdAt", "updatedAt")
VALUES
    (gen_random_uuid(), 'CHECKING', 'Checking Account', 'Standard checking account for daily transactions', true, 0, NOW(), NOW()),
    (gen_random_uuid(), 'SAVINGS', 'Savings Account', 'Interest-bearing savings account', true, 1, NOW(), NOW()),
    (gen_random_uuid(), 'MONEY_MARKET', 'Money Market Account', 'Higher interest with limited transactions', true, 2, NOW(), NOW()),
    (gen_random_uuid(), 'CERTIFICATE_OF_DEPOSIT', 'Certificate of Deposit', 'Fixed-term deposit with guaranteed interest rate', true, 3, NOW(), NOW());
