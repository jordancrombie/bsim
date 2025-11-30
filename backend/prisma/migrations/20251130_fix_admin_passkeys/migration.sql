-- Add missing columns to admin_passkeys table
ALTER TABLE "admin_passkeys" ADD COLUMN IF NOT EXISTS "deviceType" TEXT NOT NULL DEFAULT 'singleDevice';
ALTER TABLE "admin_passkeys" ADD COLUMN IF NOT EXISTS "backedUp" BOOLEAN NOT NULL DEFAULT false;
