-- Add enable_rollover column to budgets table
-- This allows users to toggle rollover on/off per budget
ALTER TABLE public.budgets
ADD COLUMN IF NOT EXISTS enable_rollover BOOLEAN DEFAULT true;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_budgets_enable_rollover ON public.budgets(enable_rollover);
