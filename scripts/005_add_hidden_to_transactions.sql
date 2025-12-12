-- Migration: Add hidden column to transactions table
-- Allows users to hide transactions from their main view (e.g., transfers, reimbursements)

-- Add hidden column to transactions table
alter table public.transactions
add column if not exists hidden boolean not null default false;

-- Create index for better query performance when filtering hidden transactions
create index if not exists transactions_hidden_idx on public.transactions(hidden);

-- Create composite index for common queries (user_id + hidden)
create index if not exists transactions_user_hidden_idx on public.transactions(user_id, hidden);

-- Add comment explaining the column
comment on column public.transactions.hidden is 'When true, transaction is hidden from default views but not deleted';
