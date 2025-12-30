-- Check if the account is actually stored
SELECT
  id,
  item_id,
  institution_name,
  account_name,
  sync_transactions,
  sync_balances,
  created_at
FROM plaid_items
ORDER BY created_at DESC
LIMIT 5;

-- Check for any account balances
SELECT
  account_name,
  balance,
  plaid_account_id,
  created_at,
  updated_at
FROM account_balances
WHERE plaid_account_id IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;

-- Check for any transactions
SELECT
  COUNT(*) as transaction_count,
  plaid_account_id,
  MIN(date) as earliest_date,
  MAX(date) as latest_date
FROM transactions
WHERE plaid_transaction_id IS NOT NULL
GROUP BY plaid_account_id;
