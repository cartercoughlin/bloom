-- Tags: track spending for trips, projects or savings goals, independently of
-- budget categories. A transaction keeps its one category for budgeting and
-- can carry any number of tags; tags never affect budget numbers.

BEGIN;

CREATE TABLE IF NOT EXISTS public.tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6366f1',
  -- Optional spending target, e.g. a trip budget or savings goal
  target_amount NUMERIC(12, 2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE (user_id, name)
);

ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tags_select_own" ON public.tags FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "tags_insert_own" ON public.tags FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tags_update_own" ON public.tags FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "tags_delete_own" ON public.tags FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.transaction_tags (
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE CASCADE NOT NULL,
  tag_id UUID REFERENCES public.tags(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  PRIMARY KEY (transaction_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_transaction_tags_user ON public.transaction_tags (user_id);
CREATE INDEX IF NOT EXISTS idx_transaction_tags_tag ON public.transaction_tags (tag_id);

ALTER TABLE public.transaction_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "transaction_tags_select_own" ON public.transaction_tags FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "transaction_tags_insert_own" ON public.transaction_tags FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "transaction_tags_delete_own" ON public.transaction_tags FOR DELETE USING (auth.uid() = user_id);

COMMIT;
