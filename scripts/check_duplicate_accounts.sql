-- Check for duplicate or inflated account balances

-- 1. Show all accounts with details
SELECT
  account_name,
  account_type,
  balance,
  updated_at,
  created_at
FROM account_balances
ORDER BY account_name, created_at;

-- 2. Check for duplicate account names
SELECT
  account_name,
  COUNT(*) as count,
  SUM(balance) as total_balance
FROM account_balances
GROUP BY account_name
HAVING COUNT(*) > 1;

-- 3. Check if any accounts have been updated multiple times (shouldn't happen with upsert)
SELECT
  account_name,
  account_type,
  balance,
  updated_at,
  ROW_NUMBER() OVER (PARTITION BY account_name ORDER BY updated_at DESC) as version
FROM account_balances
ORDER BY account_name, updated_at DESC;

-- 4. Show individual account contributions to totals
SELECT
  account_name,
  account_type,
  balance,
  CASE
    WHEN balance > 0 THEN 'ASSET'
    WHEN balance < 0 THEN 'LIABILITY'
    ELSE 'ZERO'
  END as classification
FROM account_balances
ORDER BY balance DESC;
