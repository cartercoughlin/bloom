-- Add personal_finance_category column to transactions table
-- This stores Plaid's primary category (e.g., "TRANSFER_IN", "TRANSFER_OUT", "INCOME", "FOOD_AND_DRINK")
-- Used to identify and exclude inter-account transfers from income/expense graphs

BEGIN;

-- Add personal_finance_category column
ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS personal_finance_category TEXT;

-- Create index for filtering transfers in graph queries
CREATE INDEX IF NOT EXISTS idx_transactions_personal_finance_category
ON transactions (user_id, personal_finance_category);

COMMIT;
