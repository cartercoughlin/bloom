-- Remove generic placeholder accounts that have been replaced with actual account names

BEGIN;

-- Show what we're about to delete
SELECT
  account_name,
  account_type,
  balance,
  'WILL BE DELETED' as action
FROM account_balances
WHERE account_name IN ('CREDIT CARD', 'INVESTMENT', 'Checking', 'Savings')
  AND balance IN (
    -- Only delete if there's a matching balance (indicating it's a duplicate)
    SELECT balance
    FROM account_balances
    WHERE account_name NOT IN ('CREDIT CARD', 'INVESTMENT', 'Checking', 'Savings')
  )
ORDER BY account_name;

-- Delete the generic accounts
DELETE FROM account_balances
WHERE account_name IN ('CREDIT CARD', 'INVESTMENT');

-- Also delete generic Checking/Savings if they have 0 or minimal balances (likely duplicates)
DELETE FROM account_balances
WHERE account_name IN ('Checking', 'Savings')
  AND ABS(balance) < 100;  -- Only delete if near-zero balance

-- Show remaining accounts
SELECT
  account_name,
  account_type,
  balance,
  'KEPT' as action
FROM account_balances
ORDER BY account_type, balance DESC;

-- Show new totals
SELECT
  SUM(CASE WHEN balance > 0 THEN balance ELSE 0 END) as total_assets,
  ABS(SUM(CASE WHEN balance < 0 THEN balance ELSE 0 END)) as total_liabilities,
  SUM(balance) as net_worth
FROM account_balances;

COMMIT;
