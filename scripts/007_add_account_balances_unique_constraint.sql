-- Add unique constraint to account_balances for upsert functionality
ALTER TABLE account_balances ADD CONSTRAINT unique_user_account
  UNIQUE (user_id, account_name);
