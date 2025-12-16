-- Fix account_balances constraint to use plaid_account_id
-- This allows proper upserts during sync

-- Drop old constraint
DROP INDEX IF EXISTS account_balances_user_id_account_name_key;
ALTER TABLE account_balances DROP CONSTRAINT IF EXISTS account_balances_user_id_account_name_key;

-- Ensure the new constraint exists
CREATE UNIQUE INDEX IF NOT EXISTS idx_account_balances_unique_plaid 
ON account_balances (user_id, plaid_account_id) 
WHERE plaid_account_id IS NOT NULL;

-- Show current balances
SELECT * FROM account_balances;
