-- Fix reversed transaction types from old Plaid sync logic
-- This script corrects transactions that were imported before the fix in commit da6c23f0
-- where Plaid amounts were incorrectly mapped (income as debit, expenses as credit)

-- Swap all transaction types: credit <-> debit
UPDATE public.transactions
SET transaction_type = CASE
  WHEN transaction_type = 'credit' THEN 'debit'
  WHEN transaction_type = 'debit' THEN 'credit'
  ELSE transaction_type
END
WHERE transaction_type IN ('credit', 'debit');

-- Verify the update
SELECT
  transaction_type,
  COUNT(*) as count,
  SUM(amount) as total_amount
FROM public.transactions
GROUP BY transaction_type
ORDER BY transaction_type;
