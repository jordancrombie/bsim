-- AlterTable: Add fi_user_ref column to users table
-- This is a unique identifier for Open Banking (FI User Reference Number)

-- First, add the column as nullable
ALTER TABLE "users" ADD COLUMN "fi_user_ref" TEXT;

-- Generate UUIDs for existing users
UPDATE "users" SET "fi_user_ref" = gen_random_uuid()::text WHERE "fi_user_ref" IS NULL;

-- Make the column NOT NULL and add unique constraint
ALTER TABLE "users" ALTER COLUMN "fi_user_ref" SET NOT NULL;
ALTER TABLE "users" ALTER COLUMN "fi_user_ref" SET DEFAULT gen_random_uuid()::text;

-- CreateIndex
CREATE UNIQUE INDEX "users_fi_user_ref_key" ON "users"("fi_user_ref");
