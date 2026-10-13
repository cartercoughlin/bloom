-- Add plaid_details column to transactions table
-- Stores extra per-transaction data from Plaid that the app shows on each row:
-- pending status, payment channel, location, authorized date/time,
-- detailed personal finance category, counterparties, check number, etc.
-- JSONB so new Plaid fields can be added without further migrations.
-- Existing transactions from the last 30 days are backfilled on the next sync.

BEGIN;

ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS plaid_details JSONB;

COMMIT;
