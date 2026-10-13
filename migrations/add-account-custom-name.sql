-- Add custom_name column to account_balances
-- Lets users rename individual accounts (e.g. several Plaid accounts all
-- named "INVESTMENTS"). Sync keeps updating account_name from Plaid and never
-- touches custom_name; the app shows custom_name when it's set.

BEGIN;

ALTER TABLE account_balances
ADD COLUMN IF NOT EXISTS custom_name TEXT;

COMMIT;
