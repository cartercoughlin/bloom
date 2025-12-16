-- Add plaid_account_id to transactions for better cleanup
-- This allows us to remove transactions when accounts are disconnected

-- Add the column
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS plaid_account_id TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_transactions_plaid_account_id 
ON transactions (user_id, plaid_account_id);

-- Show summary
SELECT 
  'Migration completed' as status,
  COUNT(*) as total_transactions,
  COUNT(plaid_account_id) as transactions_with_plaid_account_id
FROM transactions;
