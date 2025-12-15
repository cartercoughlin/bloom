-- Show ALL accounts with their details to identify the issue

SELECT
  id,
  account_name,
  account_type,
  balance,
  created_at,
  updated_at
FROM account_balances
ORDER BY account_type, balance DESC;

-- Count total accounts
SELECT
  COUNT(*) as total_accounts,
  COUNT(DISTINCT account_name) as unique_account_names
FROM account_balances;

-- Group by exact account name to see if there are exact duplicates
SELECT
  account_name,
  COUNT(*) as count,
  array_agg(balance ORDER BY updated_at DESC) as balances,
  array_agg(updated_at ORDER BY updated_at DESC) as update_times
FROM account_balances
GROUP BY account_name
ORDER BY COUNT(*) DESC, account_name;
