-- Add wallet_id column to escrow_holds table
-- This stores the external wallet ID from ContractSim for webhook callbacks

ALTER TABLE "escrow_holds" ADD COLUMN "wallet_id" TEXT;
