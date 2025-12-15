-- Add recurring flag to transactions table for better budget tracking
-- Recurring transactions (rent, utilities, subscriptions) are handled separately
-- from variable spending to provide more accurate budget progress

-- Add recurring column (defaults to false for existing transactions)
ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS recurring BOOLEAN DEFAULT FALSE;

-- Add index for filtering recurring transactions
CREATE INDEX IF NOT EXISTS idx_transactions_recurring
ON public.transactions(recurring);

-- Update description
COMMENT ON COLUMN public.transactions.recurring IS
'Marks transaction as recurring (rent, utilities, subscriptions). Recurring expenses are factored into expected spending differently than variable expenses.';
