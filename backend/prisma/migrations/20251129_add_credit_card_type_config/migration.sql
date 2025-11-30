-- CreateTable: Configurable Credit Card Types
CREATE TABLE "credit_card_type_configs" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cardNumberPrefix" TEXT NOT NULL,
    "cardNumberLength" INTEGER NOT NULL DEFAULT 16,
    "cvvLength" INTEGER NOT NULL DEFAULT 3,
    "isDebit" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credit_card_type_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "credit_card_type_configs_code_key" ON "credit_card_type_configs"("code");

-- Seed default credit card types
INSERT INTO "credit_card_type_configs" ("id", "code", "name", "cardNumberPrefix", "cardNumberLength", "cvvLength", "isDebit", "isActive", "sortOrder", "createdAt", "updatedAt")
VALUES
    (gen_random_uuid(), 'VISA', 'VISA', '4', 16, 3, false, true, 1, NOW(), NOW()),
    (gen_random_uuid(), 'VISA_DEBIT', 'VISA Debit', '4', 16, 3, true, true, 2, NOW(), NOW()),
    (gen_random_uuid(), 'MC', 'Mastercard', '51,52,53,54,55', 16, 3, false, true, 3, NOW(), NOW()),
    (gen_random_uuid(), 'MC_DEBIT', 'Mastercard Debit', '51,52,53,54,55', 16, 3, true, true, 4, NOW(), NOW()),
    (gen_random_uuid(), 'AMEX', 'American Express', '34,37', 15, 4, false, true, 5, NOW(), NOW());
