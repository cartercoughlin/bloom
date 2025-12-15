-- Add plaid_transaction_id column to properly track transactions between pending/cleared states
ALTER TABLE transactions 
ADD COLUMN plaid_transaction_id TEXT;

-- Create index for faster lookups
CREATE INDEX idx_transactions_plaid_id ON transactions(plaid_transaction_id);

-- Add comment
COMMENT ON COLUMN transactions.plaid_transaction_id IS 'Plaid transaction ID that remains consistent between pending and cleared states';
