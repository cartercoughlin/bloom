-- Cleanup query for duplicate transactions created before pending→posted fix
-- This identifies and removes duplicates while preserving:
--   1. Transactions with categories (user has categorized them)
--   2. The oldest transaction if multiple have categories or none have categories

-- STEP 1: Review duplicates before deletion
-- Run this first to see what will be deleted
WITH normalized_transactions AS (
  SELECT
    id,
    user_id,
    plaid_transaction_id,
    date,
    description,
    amount,
    bank,
    category_id,
    created_at,
    -- Extract first 3 words as merchant identifier
    LOWER(TRIM(
      SPLIT_PART(
        REGEXP_REPLACE(LOWER(TRIM(description)), '[^\w\s]', '', 'g'),
        ' ', 1
      ) || ' ' ||
      SPLIT_PART(
        REGEXP_REPLACE(LOWER(TRIM(description)), '[^\w\s]', '', 'g'),
        ' ', 2
      ) || ' ' ||
      SPLIT_PART(
        REGEXP_REPLACE(LOWER(TRIM(description)), '[^\w\s]', '', 'g'),
        ' ', 3
      )
    )) as merchant_prefix,
    LOWER(TRIM(bank)) as normalized_bank
  FROM transactions
),
duplicate_groups AS (
  SELECT
    date,
    merchant_prefix,
    amount,
    normalized_bank,
    COUNT(*) as duplicate_count,
    -- Aggregate all transaction IDs in this group
    ARRAY_AGG(id ORDER BY
      -- Prioritize: categorized transactions first, then oldest
      CASE WHEN category_id IS NOT NULL THEN 0 ELSE 1 END,
      created_at ASC,
      id ASC
    ) as transaction_ids,
    ARRAY_AGG(description ORDER BY
      CASE WHEN category_id IS NOT NULL THEN 0 ELSE 1 END,
      created_at ASC,
      id ASC
    ) as descriptions,
    ARRAY_AGG(COALESCE(category_id::text, 'NULL') ORDER BY
      CASE WHEN category_id IS NOT NULL THEN 0 ELSE 1 END,
      created_at ASC,
      id ASC
    ) as category_ids,
    ARRAY_AGG(plaid_transaction_id ORDER BY
      CASE WHEN category_id IS NOT NULL THEN 0 ELSE 1 END,
      created_at ASC,
      id ASC
    ) as plaid_ids
  FROM normalized_transactions
  WHERE merchant_prefix != ''  -- Exclude empty merchant prefixes
  GROUP BY date, merchant_prefix, amount, normalized_bank
  HAVING COUNT(*) > 1  -- Only groups with duplicates
)
SELECT
  date,
  amount,
  normalized_bank as bank,
  duplicate_count,
  descriptions[1] as keep_description,
  category_ids[1] as keep_category,
  plaid_ids[1] as keep_plaid_id,
  -- Show duplicates to be deleted (all except first)
  descriptions[2:] as delete_descriptions,
  category_ids[2:] as delete_categories,
  plaid_ids[2:] as delete_plaid_ids,
  transaction_ids[2:] as transaction_ids_to_delete
FROM duplicate_groups
ORDER BY date DESC, duplicate_count DESC;


-- STEP 2: Delete duplicates (run this after reviewing above results)
-- UNCOMMENT THE LINES BELOW TO ACTUALLY DELETE DUPLICATES

/*
WITH normalized_transactions AS (
  SELECT
    id,
    user_id,
    plaid_transaction_id,
    date,
    description,
    amount,
    bank,
    category_id,
    created_at,
    -- Extract first 3 words as merchant identifier
    LOWER(TRIM(
      SPLIT_PART(
        REGEXP_REPLACE(LOWER(TRIM(description)), '[^\w\s]', '', 'g'),
        ' ', 1
      ) || ' ' ||
      SPLIT_PART(
        REGEXP_REPLACE(LOWER(TRIM(description)), '[^\w\s]', '', 'g'),
        ' ', 2
      ) || ' ' ||
      SPLIT_PART(
        REGEXP_REPLACE(LOWER(TRIM(description)), '[^\w\s]', '', 'g'),
        ' ', 3
      )
    )) as merchant_prefix,
    LOWER(TRIM(bank)) as normalized_bank
  FROM transactions
),
duplicate_groups AS (
  SELECT
    date,
    merchant_prefix,
    amount,
    normalized_bank,
    -- Keep first transaction (prioritizing categorized, then oldest)
    (ARRAY_AGG(id ORDER BY
      CASE WHEN category_id IS NOT NULL THEN 0 ELSE 1 END,
      created_at ASC,
      id ASC
    ))[1] as id_to_keep,
    -- All IDs except the first one (these will be deleted)
    (ARRAY_AGG(id ORDER BY
      CASE WHEN category_id IS NOT NULL THEN 0 ELSE 1 END,
      created_at ASC,
      id ASC
    ))[2:] as ids_to_delete
  FROM normalized_transactions
  WHERE merchant_prefix != ''
  GROUP BY date, merchant_prefix, amount, normalized_bank
  HAVING COUNT(*) > 1
)
DELETE FROM transactions
WHERE id IN (
  SELECT UNNEST(ids_to_delete)
  FROM duplicate_groups
);

-- Show summary of deletions
SELECT
  'Duplicates deleted' as status,
  COUNT(*) as deleted_count
FROM duplicate_groups
WHERE ARRAY_LENGTH(ids_to_delete, 1) > 0;
*/
