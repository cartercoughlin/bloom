-- Fix duplicate accounts by keeping only the most recent version of each account

BEGIN;

-- Show what we're about to delete (duplicates, keeping most recent)
SELECT
  ab1.id,
  ab1.account_name,
  ab1.account_type,
  ab1.balance,
  ab1.updated_at,
  'WILL BE DELETED' as action
FROM account_balances ab1
WHERE EXISTS (
  SELECT 1
  FROM account_balances ab2
  WHERE ab2.account_name = ab1.account_name
    AND ab2.user_id = ab1.user_id
    AND ab2.updated_at > ab1.updated_at
)
ORDER BY account_name, updated_at;

-- Delete duplicates, keeping only the most recent version of each account
DELETE FROM account_balances
WHERE id IN (
  SELECT ab1.id
  FROM account_balances ab1
  WHERE EXISTS (
    SELECT 1
    FROM account_balances ab2
    WHERE ab2.account_name = ab1.account_name
      AND ab2.user_id = ab1.user_id
      AND ab2.updated_at > ab1.updated_at
  )
);

-- Show remaining accounts after cleanup
SELECT
  account_name,
  account_type,
  balance,
  updated_at,
  'KEPT' as action
FROM account_balances
ORDER BY account_name;

-- Show new totals
SELECT
  SUM(CASE WHEN balance > 0 THEN balance ELSE 0 END) as total_assets,
  ABS(SUM(CASE WHEN balance < 0 THEN balance ELSE 0 END)) as total_liabilities,
  SUM(balance) as net_worth
FROM account_balances;

COMMIT;
