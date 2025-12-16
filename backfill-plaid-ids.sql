-- Backfill missing Plaid transaction IDs
-- This will help identify which transactions are missing Plaid IDs

-- Show transactions without Plaid IDs from last 30 days
SELECT 
  COUNT(*) as transactions_without_plaid_id,
  MIN(date) as earliest_date,
  MAX(date) as latest_date
FROM transactions 
WHERE plaid_transaction_id IS NULL 
  AND date >= CURRENT_DATE - INTERVAL '30 days';

-- Show sample transactions without Plaid IDs
SELECT 
  id, date, description, amount, bank, created_at
FROM transactions 
WHERE plaid_transaction_id IS NULL 
  AND date >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY created_at DESC 
LIMIT 10;
