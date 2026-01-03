-- AlterTable: Change P2PTransfer unique constraint from externalId to (externalId, direction)
-- This allows same-bank P2P transfers to have both DEBIT and CREDIT records with the same externalId

-- Drop the existing unique constraint on externalId
DROP INDEX IF EXISTS "p2p_transfers_externalId_key";

-- Add compound unique constraint on (externalId, direction)
CREATE UNIQUE INDEX "p2p_transfers_externalId_direction_key" ON "p2p_transfers"("externalId", "direction");
