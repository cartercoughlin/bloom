-- Migration: Fix account_balances constraint to allow multiple accounts with same name
-- Date: 2025-12-17
-- Issue: Multiple Betterment/Horizon accounts with same generated name fail to insert
--        due to UNIQUE(user_id, account_name) constraint

BEGIN;

-- 1. Drop the old unique constraint on (user_id, account_name)
ALTER TABLE account_balances
DROP CONSTRAINT IF EXISTS account_balances_user_id_account_name_key;

-- 2. Also drop any indexes that might exist
DROP INDEX IF EXISTS account_balances_user_id_account_name_key;
DROP INDEX IF EXISTS account_balances_user_id_account_name_idx;

-- 3. Ensure the partial unique index for Plaid accounts exists
-- This prevents duplicate plaid_account_ids per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_account_balances_unique_plaid
ON account_balances (user_id, plaid_account_id)
WHERE plaid_account_id IS NOT NULL;

-- 4. Create a partial unique index for manual accounts (without plaid_account_id)
-- This ensures manual account names are still unique per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_account_balances_unique_manual
ON account_balances (user_id, account_name)
WHERE plaid_account_id IS NULL;

-- 5. Verify the changes
SELECT
    'Current constraints and indexes:' as info;

SELECT
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'account_balances'
    AND schemaname = 'public'
ORDER BY indexname;

COMMIT;

-- After running this migration:
-- 1. You can have multiple Plaid accounts with the same name (e.g., "INVESTMENT")
--    as long as they have different plaid_account_ids
-- 2. Manual accounts (without plaid_account_id) still require unique names per user
-- 3. Re-sync your Betterment and First Horizon accounts to get all missing accounts
