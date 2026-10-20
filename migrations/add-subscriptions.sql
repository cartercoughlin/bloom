-- Subscriptions: decisions about recurring charges the app detects from
-- transaction history (lib/subscriptions.ts). Detection runs on read, so
-- this table only records what the user decided about each one: track it,
-- mark it cancelled, or dismiss it as not a subscription. Charges are
-- matched by merchant, and by amount when a merchant bills several plans.

BEGIN;

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  merchant_key TEXT NOT NULL,
  -- Custom display name; null shows the merchant name from transactions
  name TEXT,
  status TEXT NOT NULL CHECK (status IN ('tracked', 'cancelled', 'ignored')),
  -- Typical charge when the decision was made, to tell plans apart
  amount NUMERIC(12, 2) NOT NULL,
  cadence TEXT NOT NULL CHECK (cadence IN ('weekly', 'biweekly', 'monthly', 'quarterly', 'semiannual', 'annual')),
  -- Charges after this date are flagged on cancelled subscriptions
  cancelled_at DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON public.subscriptions (user_id, merchant_key);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subscriptions_select_own" ON public.subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "subscriptions_insert_own" ON public.subscriptions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "subscriptions_update_own" ON public.subscriptions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "subscriptions_delete_own" ON public.subscriptions FOR DELETE USING (auth.uid() = user_id);

COMMIT;
