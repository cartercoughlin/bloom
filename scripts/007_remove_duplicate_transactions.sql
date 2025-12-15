-- Remove duplicate transactions (keep the most recent one)
-- This handles duplicates created from pending->cleared transaction syncs
-- Accounts for date changes and case differences between pending and cleared states

-- First, show what will be removed
WITH similar_transactions AS (
  SELECT 
    t1.id as id1,
    t2.id as id2,
    t1.created_at as created1,
    t2.created_at as created2
  FROM transactions t1
  JOIN transactions t2 ON (
    t1.user_id = t2.user_id
    AND t1.id < t2.id -- Only compare each pair once
    AND (
      -- Same description (case-insensitive) and similar amount within 3 days
      (
        LOWER(t1.description) = LOWER(t2.description)
        AND ABS(t1.amount - t2.amount) <= 5.00
        AND ABS(t1.date::date - t2.date::date) <= 3
      )
      OR
      -- Same merchant name (case-insensitive) and similar amount within 3 days
      (
        t1.merchant_name IS NOT NULL 
        AND t2.merchant_name IS NOT NULL
        AND LOWER(t1.merchant_name) = LOWER(t2.merchant_name)
        AND ABS(t1.amount - t2.amount) <= 5.00
        AND ABS(t1.date::date - t2.date::date) <= 3
      )
    )
  )
  WHERE t1.created_at >= NOW() - INTERVAL '30 days'
    AND t2.created_at >= NOW() - INTERVAL '30 days'
),
duplicates_to_remove AS (
  SELECT 
    CASE 
      WHEN created1 < created2 THEN id1  -- Remove older transaction
      ELSE id2
    END as duplicate_id
  FROM similar_transactions
)

-- Delete the older duplicates and show count
DELETE FROM transactions 
WHERE id IN (SELECT duplicate_id FROM duplicates_to_remove);

-- Show final summary
SELECT 
  'Cleanup completed' as status,
  COUNT(*) as remaining_recent_transactions
FROM transactions 
WHERE created_at >= NOW() - INTERVAL '30 days';
