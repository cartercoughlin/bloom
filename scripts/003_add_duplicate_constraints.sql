-- Add constraints to prevent duplicate transactions
-- Run this to add database-level duplicate prevention

-- First, clean up any existing duplicates
WITH duplicate_transactions AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, plaid_transaction_id 
      ORDER BY created_at DESC
    ) as rn
  FROM transactions 
  WHERE plaid_transaction_id IS NOT NULL
)
DELETE FROM transactions 
WHERE id IN (
  SELECT id FROM duplicate_transactions WHERE rn > 1
);

-- Add unique constraint on plaid_transaction_id per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_unique_plaid_id 
ON transactions (user_id, plaid_transaction_id) 
WHERE plaid_transaction_id IS NOT NULL;

-- Add index for faster duplicate checking by fingerprint
CREATE INDEX IF NOT EXISTS idx_transactions_fingerprint 
ON transactions (user_id, date, description, amount, bank);

-- Show summary
SELECT 
  'Constraints added successfully' as status,
  COUNT(*) as total_transactions,
  COUNT(DISTINCT plaid_transaction_id) as unique_plaid_transactions
FROM transactions 
WHERE plaid_transaction_id IS NOT NULL;
