-- Migration: Create balance_snapshots table for historical net worth tracking
-- Each time account balances are synced, a snapshot is stored so we can
-- chart net worth over time using real data.

CREATE TABLE IF NOT EXISTS public.balance_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  snapshot_date DATE NOT NULL,
  account_name TEXT NOT NULL,
  account_type TEXT NOT NULL,
  balance NUMERIC(12, 2) NOT NULL,
  plaid_account_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- One snapshot per account per day
CREATE UNIQUE INDEX IF NOT EXISTS idx_balance_snapshots_unique
ON public.balance_snapshots (user_id, snapshot_date, COALESCE(plaid_account_id, account_name));

CREATE INDEX IF NOT EXISTS idx_balance_snapshots_user_date
ON public.balance_snapshots (user_id, snapshot_date);

ALTER TABLE public.balance_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "balance_snapshots_select_own" ON public.balance_snapshots FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "balance_snapshots_insert_own" ON public.balance_snapshots FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "balance_snapshots_delete_own" ON public.balance_snapshots FOR DELETE USING (auth.uid() = user_id);
