-- Fix duplicate transactions issue
-- Run this in your Supabase SQL editor

-- Step 1: Remove duplicates by Plaid transaction ID
WITH duplicate_plaid_transactions AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, plaid_transaction_id 
      ORDER BY created_at DESC
    ) as rn
  FROM transactions 
  WHERE plaid_transaction_id IS NOT NULL
)
DELETE FROM transactions 
WHERE id IN (
  SELECT id FROM duplicate_plaid_transactions WHERE rn > 1
);

-- Step 2: Remove similar transactions (same description, amount, date within 1 day)
WITH similar_transactions AS (
  SELECT 
    t1.id as id1,
    t2.id as id2,
    t1.created_at as created1,
    t2.created_at as created2
  FROM transactions t1
  JOIN transactions t2 ON (
    t1.user_id = t2.user_id
    AND t1.id < t2.id
    AND LOWER(t1.description) = LOWER(t2.description)
    AND ABS(t1.amount - t2.amount) <= 0.01
    AND ABS(t1.date::date - t2.date::date) <= 1
    AND t1.bank = t2.bank
  )
  WHERE t1.created_at >= NOW() - INTERVAL '60 days'
),
duplicates_to_remove AS (
  SELECT 
    CASE 
      WHEN created1 < created2 THEN id2  -- Remove newer duplicate
      ELSE id1
    END as duplicate_id
  FROM similar_transactions
)
DELETE FROM transactions 
WHERE id IN (SELECT duplicate_id FROM duplicates_to_remove);

-- Step 3: Add unique constraint to prevent future duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_unique_plaid_id 
ON transactions (user_id, plaid_transaction_id) 
WHERE plaid_transaction_id IS NOT NULL;

-- Step 4: Add index for faster duplicate checking
CREATE INDEX IF NOT EXISTS idx_transactions_fingerprint 
ON transactions (user_id, date, description, amount, bank);

-- Show cleanup results
SELECT 
  'Duplicate cleanup completed' as status,
  COUNT(*) as remaining_transactions,
  COUNT(DISTINCT plaid_transaction_id) as unique_plaid_transactions,
  COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') as recent_transactions
FROM transactions;
