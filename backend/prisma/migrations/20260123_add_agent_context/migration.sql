-- SACP: Add agent context columns to credit_card_transactions
ALTER TABLE "credit_card_transactions" ADD COLUMN IF NOT EXISTS "agent_id" TEXT;
ALTER TABLE "credit_card_transactions" ADD COLUMN IF NOT EXISTS "agent_owner_id" TEXT;
ALTER TABLE "credit_card_transactions" ADD COLUMN IF NOT EXISTS "agent_human_present" BOOLEAN;

-- SACP: Add agent context columns to payment_authorizations
ALTER TABLE "payment_authorizations" ADD COLUMN IF NOT EXISTS "agent_id" TEXT;
ALTER TABLE "payment_authorizations" ADD COLUMN IF NOT EXISTS "agent_owner_id" TEXT;
ALTER TABLE "payment_authorizations" ADD COLUMN IF NOT EXISTS "agent_human_present" BOOLEAN;

-- Index for efficient agent transaction queries
CREATE INDEX IF NOT EXISTS "idx_card_tx_agent" ON "credit_card_transactions"("agent_id");
