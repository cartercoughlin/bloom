-- Complete Database Schema for Bloom Budget
-- This script creates all tables with their final structure
-- Run this on a fresh database instead of the individual migration scripts

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  last_sync_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Create categories table
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#3B82F6',
  icon TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "categories_select_own" ON public.categories FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "categories_insert_own" ON public.categories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "categories_update_own" ON public.categories FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "categories_delete_own" ON public.categories FOR DELETE USING (auth.uid() = user_id);

-- Create transactions table with all current columns
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  plaid_transaction_id TEXT,
  date DATE NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  bank TEXT NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('debit', 'credit')),
  notes TEXT,
  hidden BOOLEAN DEFAULT FALSE,
  recurring BOOLEAN DEFAULT FALSE,
  merchant_name TEXT,
  logo_url TEXT,
  website TEXT,
  category_detailed TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "transactions_select_own" ON public.transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "transactions_insert_own" ON public.transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "transactions_update_own" ON public.transactions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "transactions_delete_own" ON public.transactions FOR DELETE USING (auth.uid() = user_id);

-- Create budgets table
CREATE TABLE IF NOT EXISTS public.budgets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  category_id UUID REFERENCES public.categories(id) ON DELETE CASCADE NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  year INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, category_id, month, year)
);

ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "budgets_select_own" ON public.budgets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "budgets_insert_own" ON public.budgets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "budgets_update_own" ON public.budgets FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "budgets_delete_own" ON public.budgets FOR DELETE USING (auth.uid() = user_id);

-- Create category rules table
CREATE TABLE IF NOT EXISTS public.category_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  category_id UUID REFERENCES public.categories(id) ON DELETE CASCADE NOT NULL,
  priority INTEGER DEFAULT 0,
  description_pattern TEXT,
  amount_min NUMERIC(10, 2),
  amount_max NUMERIC(10, 2),
  transaction_type TEXT CHECK (transaction_type IN ('debit', 'credit')),
  bank_pattern TEXT,
  account_pattern TEXT,
  institution_pattern TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.category_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "category_rules_select_own" ON public.category_rules FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "category_rules_insert_own" ON public.category_rules FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "category_rules_update_own" ON public.category_rules FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "category_rules_delete_own" ON public.category_rules FOR DELETE USING (auth.uid() = user_id);

-- Create account balances table
CREATE TABLE IF NOT EXISTS public.account_balances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  account_name TEXT NOT NULL,
  account_type TEXT NOT NULL CHECK (account_type IN ('checking', 'savings', 'liability')),
  balance NUMERIC(12, 2) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, account_name)
);

ALTER TABLE public.account_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "account_balances_select_own" ON public.account_balances FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "account_balances_insert_own" ON public.account_balances FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "account_balances_update_own" ON public.account_balances FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "account_balances_delete_own" ON public.account_balances FOR DELETE USING (auth.uid() = user_id);

-- Create Plaid items table
CREATE TABLE IF NOT EXISTS public.plaid_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  access_token TEXT NOT NULL,
  item_id TEXT NOT NULL,
  institution_id TEXT,
  institution_name TEXT,
  sync_transactions BOOLEAN DEFAULT TRUE,
  sync_balances BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, item_id)
);

ALTER TABLE public.plaid_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "plaid_items_select_own" ON public.plaid_items FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "plaid_items_insert_own" ON public.plaid_items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "plaid_items_update_own" ON public.plaid_items FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "plaid_items_delete_own" ON public.plaid_items FOR DELETE USING (auth.uid() = user_id);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON public.transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_category_id ON public.transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_plaid_id ON public.transactions(plaid_transaction_id);
CREATE INDEX IF NOT EXISTS idx_categories_user_id ON public.categories(user_id);
CREATE INDEX IF NOT EXISTS idx_budgets_user_id ON public.budgets(user_id);
CREATE INDEX IF NOT EXISTS idx_budgets_month_year ON public.budgets(month, year);
CREATE INDEX IF NOT EXISTS idx_category_rules_user_id ON public.category_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_category_rules_priority ON public.category_rules(priority DESC);
CREATE INDEX IF NOT EXISTS idx_account_balances_user_id ON public.account_balances(user_id);
CREATE INDEX IF NOT EXISTS idx_plaid_items_user_id ON public.plaid_items(user_id);

-- Add comments for documentation
COMMENT ON TABLE public.transactions IS 'User transactions with Plaid integration support';
COMMENT ON COLUMN public.transactions.plaid_transaction_id IS 'Plaid transaction ID that remains consistent between pending and cleared states';
COMMENT ON COLUMN public.transactions.hidden IS 'Hide transaction from main views and budget calculations';
COMMENT ON COLUMN public.transactions.recurring IS 'Mark transaction as recurring for budget planning';
COMMENT ON TABLE public.category_rules IS 'Automated categorization rules with regex pattern matching';
COMMENT ON TABLE public.plaid_items IS 'Plaid connected accounts and sync preferences';
