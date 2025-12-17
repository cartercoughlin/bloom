-- Add deleted column to transactions table for soft deletion
-- This prevents re-importing transactions that users have already deleted

BEGIN;

-- Add deleted column (defaults to false)
ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS deleted BOOLEAN DEFAULT false;

-- Create index on deleted column for faster queries
CREATE INDEX IF NOT EXISTS idx_transactions_deleted
ON transactions (user_id, deleted)
WHERE deleted = false;

-- Create index for Plaid sync lookups (including deleted status)
CREATE INDEX IF NOT EXISTS idx_transactions_plaid_deleted
ON transactions (user_id, plaid_transaction_id, deleted);

COMMIT;
