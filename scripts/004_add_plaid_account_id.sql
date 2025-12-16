-- Add plaid_account_id to account_balances for better tracking
-- This allows us to remove accounts that are no longer connected

-- Add the column
ALTER TABLE account_balances 
ADD COLUMN IF NOT EXISTS plaid_account_id TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_account_balances_plaid_id 
ON account_balances (user_id, plaid_account_id);

-- Update the unique constraint to use plaid_account_id instead of account_name
-- First drop the old constraint if it exists
DROP INDEX IF EXISTS account_balances_user_id_account_name_key;

-- Add new unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS idx_account_balances_unique_plaid 
ON account_balances (user_id, plaid_account_id) 
WHERE plaid_account_id IS NOT NULL;

-- Show summary
SELECT 
  'Migration completed' as status,
  COUNT(*) as total_accounts,
  COUNT(plaid_account_id) as accounts_with_plaid_id
FROM account_balances;
