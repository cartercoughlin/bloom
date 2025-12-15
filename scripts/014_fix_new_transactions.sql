-- Fix: Swap back transactions that were created AFTER the code fix
-- These transactions had correct types but got reversed by the blanket swap
--
-- The code fix was deployed at: 2025-12-14 22:39:17 UTC
-- Transactions created after this time have correct types and need to be swapped back

BEGIN;

-- Show current state before fix
SELECT
  'BEFORE FIX' as status,
  transaction_type,
  COUNT(*) as count,
  MIN(date) as earliest_date,
  MAX(date) as latest_date,
  MIN(created_at) as earliest_created,
  MAX(created_at) as latest_created
FROM public.transactions
GROUP BY transaction_type
ORDER BY transaction_type;

-- Swap ONLY transactions created after the code fix (these are currently wrong)
UPDATE public.transactions
SET transaction_type = CASE
  WHEN transaction_type = 'credit' THEN 'debit'
  WHEN transaction_type = 'debit' THEN 'credit'
  ELSE transaction_type
END
WHERE transaction_type IN ('credit', 'debit')
  AND created_at >= '2025-12-14 22:39:17+00';

-- Show results after fix
SELECT
  'AFTER FIX' as status,
  transaction_type,
  COUNT(*) as count,
  MIN(date) as earliest_date,
  MAX(date) as latest_date,
  MIN(created_at) as earliest_created,
  MAX(created_at) as latest_created
FROM public.transactions
GROUP BY transaction_type
ORDER BY transaction_type;

-- Show breakdown by created_at to verify
SELECT
  CASE
    WHEN created_at < '2025-12-14 22:39:17+00' THEN 'OLD (before fix)'
    ELSE 'NEW (after fix)'
  END as batch,
  transaction_type,
  COUNT(*) as count
FROM public.transactions
WHERE transaction_type IN ('credit', 'debit')
GROUP BY
  CASE
    WHEN created_at < '2025-12-14 22:39:17+00' THEN 'OLD (before fix)'
    ELSE 'NEW (after fix)'
  END,
  transaction_type
ORDER BY batch, transaction_type;

COMMIT;
