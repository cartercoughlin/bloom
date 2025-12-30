-- Add rollover/savings goal support to categories
-- Migration: 001_add_rollover_categories.sql

-- Add rollover columns to categories table
ALTER TABLE public.categories
ADD COLUMN IF NOT EXISTS is_rollover BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS target_amount NUMERIC(10, 2);

-- Create category_rollover_balances table to track accumulated balances month-over-month
CREATE TABLE IF NOT EXISTS public.category_rollover_balances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  category_id UUID REFERENCES public.categories(id) ON DELETE CASCADE NOT NULL,
  balance NUMERIC(10, 2) NOT NULL DEFAULT 0,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  year INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, category_id, month, year)
);

-- Enable RLS for rollover balances
ALTER TABLE public.category_rollover_balances ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "rollover_balances_select_own" ON public.category_rollover_balances FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "rollover_balances_insert_own" ON public.category_rollover_balances FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "rollover_balances_update_own" ON public.category_rollover_balances FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "rollover_balances_delete_own" ON public.category_rollover_balances FOR DELETE USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_rollover_balances_user_category ON public.category_rollover_balances(user_id, category_id);
CREATE INDEX IF NOT EXISTS idx_rollover_balances_month_year ON public.category_rollover_balances(month, year);

-- Add comments for documentation
COMMENT ON COLUMN public.categories.is_rollover IS 'Whether this category is a rollover/savings goal (accumulates unused budget)';
COMMENT ON COLUMN public.categories.target_amount IS 'Optional target amount for savings goals';
COMMENT ON TABLE public.category_rollover_balances IS 'Tracks accumulated rollover balances for savings goal categories month-over-month';
