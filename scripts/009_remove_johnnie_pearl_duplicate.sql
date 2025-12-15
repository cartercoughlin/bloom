-- Remove duplicate JOHNNIE PEARL JEWELRY transaction (keep the newer one)
WITH johnnie_duplicates AS (
  SELECT 
    id,
    description,
    amount,
    date,
    created_at,
    ROW_NUMBER() OVER (
      ORDER BY created_at DESC, id DESC
    ) as row_num
  FROM transactions 
  WHERE LOWER(description) LIKE '%johnnie%pearl%'
     OR LOWER(merchant_name) LIKE '%johnnie%pearl%'
)

-- Delete the older duplicate (keep row_num = 1)
DELETE FROM transactions 
WHERE id IN (
  SELECT id FROM johnnie_duplicates WHERE row_num > 1
);

-- Show what remains
SELECT 
  'Cleanup completed' as status,
  description,
  amount,
  date,
  created_at
FROM transactions 
WHERE LOWER(description) LIKE '%johnnie%pearl%'
   OR LOWER(merchant_name) LIKE '%johnnie%pearl%';
