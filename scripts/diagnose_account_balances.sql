-- Diagnostic query to check account balances and identify potential issues
-- Run this in Supabase SQL Editor to see account balance details

-- Show all account balances
SELECT
  account_name,
  account_type,
  balance,
  updated_at,
  CASE
    WHEN account_type = 'liability' AND balance > 0 THEN '⚠️ WARNING: Liability has positive balance (should be negative)'
    WHEN account_type = 'liability' AND balance < 0 THEN '✓ OK: Liability is negative'
    WHEN account_type IN ('checking', 'savings') AND balance < 0 THEN '⚠️ WARNING: Asset has negative balance'
    ELSE '✓ OK'
  END as status
FROM account_balances
ORDER BY account_type, account_name;

-- Summary by account type
SELECT
  account_type,
  COUNT(*) as count,
  SUM(balance) as total_balance,
  AVG(balance) as avg_balance,
  MIN(balance) as min_balance,
  MAX(balance) as max_balance
FROM account_balances
GROUP BY account_type
ORDER BY account_type;

-- Calculate net worth correctly
SELECT
  SUM(CASE WHEN balance > 0 THEN balance ELSE 0 END) as total_assets,
  ABS(SUM(CASE WHEN balance < 0 THEN balance ELSE 0 END)) as total_liabilities,
  SUM(balance) as net_worth
FROM account_balances;
