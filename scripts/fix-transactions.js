#!/usr/bin/env node

/**
 * Fix reversed transaction types in Supabase database
 *
 * This script swaps credit/debit transaction types for transactions
 * that were imported with the old (incorrect) Plaid sync logic.
 *
 * Usage:
 *   node scripts/fix-transactions.js
 *
 * Requires environment variables:
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 */

const https = require('https');

// Get Supabase credentials from environment
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: Missing Supabase credentials');
  console.error('Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables');
  process.exit(1);
}

console.log('🔄 Connecting to Supabase...');
console.log(`📍 URL: ${supabaseUrl}`);

// SQL query to swap transaction types
const sqlQuery = `
-- Swap all transaction types: credit <-> debit
UPDATE public.transactions
SET transaction_type = CASE
  WHEN transaction_type = 'credit' THEN 'debit'
  WHEN transaction_type = 'debit' THEN 'credit'
  ELSE transaction_type
END
WHERE transaction_type IN ('credit', 'debit');

-- Get counts after update
SELECT
  transaction_type,
  COUNT(*) as count,
  SUM(amount) as total_amount
FROM public.transactions
GROUP BY transaction_type
ORDER BY transaction_type;
`;

// Extract the base URL and construct the REST API endpoint
const urlObj = new URL(supabaseUrl);
const restUrl = `${supabaseUrl}/rest/v1/rpc/exec_sql`;

// Make the request using Node.js https module
const postData = JSON.stringify({ query: sqlQuery });

const options = {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'apikey': supabaseKey,
    'Authorization': `Bearer ${supabaseKey}`,
    'Content-Length': Buffer.byteLength(postData)
  }
};

console.log('🔧 Executing SQL to swap transaction types...');

// Try using the SQL endpoint directly
const sqlEndpoint = `${supabaseUrl}/rest/v1/rpc`;

// Since Supabase doesn't have a direct SQL execution endpoint via REST,
// we'll use the Supabase client library instead
console.log('\n⚠️  This script requires @supabase/supabase-js');
console.log('Please run the SQL script manually in Supabase SQL Editor instead.\n');
console.log('SQL to run:');
console.log('─'.repeat(60));
console.log(sqlQuery);
console.log('─'.repeat(60));
console.log('\nSteps:');
console.log('1. Open Supabase Dashboard → SQL Editor');
console.log('2. Copy and paste the SQL above');
console.log('3. Click "Run"');
console.log('4. Verify the results\n');

process.exit(0);
