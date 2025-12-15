#!/usr/bin/env node

/**
 * Fix reversed transaction types in Supabase database
 *
 * This script swaps credit/debit transaction types for transactions
 * that were imported with the old (incorrect) Plaid sync logic.
 *
 * Usage:
 *   NEXT_PUBLIC_SUPABASE_URL=xxx SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/fix-transactions.mjs
 *
 * Or set the environment variables in your shell first.
 */

import { createClient } from '@supabase/supabase-js';

// Get Supabase credentials from environment
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: Missing Supabase credentials\n');
  console.error('Usage:');
  console.error('  NEXT_PUBLIC_SUPABASE_URL=xxx SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/fix-transactions.mjs\n');
  console.error('Or export them first:');
  console.error('  export NEXT_PUBLIC_SUPABASE_URL=your_url');
  console.error('  export SUPABASE_SERVICE_ROLE_KEY=your_key');
  console.error('  node scripts/fix-transactions.mjs\n');
  process.exit(1);
}

console.log('🔄 Connecting to Supabase...');
console.log(`📍 URL: ${supabaseUrl}\n`);

// Create Supabase client with service role key for admin access
const supabase = createClient(supabaseUrl, supabaseKey);

async function fixTransactionTypes() {
  try {
    // First, get a count of current transaction types
    console.log('📊 Current transaction type counts:');
    const { data: beforeData, error: beforeError } = await supabase
      .from('transactions')
      .select('transaction_type, amount');

    if (beforeError) {
      throw beforeError;
    }

    const beforeCounts = {
      credit: beforeData.filter(t => t.transaction_type === 'credit').length,
      debit: beforeData.filter(t => t.transaction_type === 'debit').length,
    };

    console.log(`   Credit (income): ${beforeCounts.credit}`);
    console.log(`   Debit (expense): ${beforeCounts.debit}\n`);

    // Execute the swap using RPC function (we'll need to create this)
    // Since Supabase doesn't allow direct UPDATE via REST API easily,
    // we'll do it in batches using the client

    console.log('🔧 Swapping transaction types...');

    // Get all credit transactions
    const { data: creditTxns, error: creditError } = await supabase
      .from('transactions')
      .select('id')
      .eq('transaction_type', 'credit');

    if (creditError) throw creditError;

    // Get all debit transactions
    const { data: debitTxns, error: debitError } = await supabase
      .from('transactions')
      .select('id')
      .eq('transaction_type', 'debit');

    if (debitError) throw debitError;

    // Update credits to a temporary value first
    console.log(`   Updating ${creditTxns.length} credit → temp...`);
    const { error: tempError } = await supabase
      .from('transactions')
      .update({ transaction_type: 'temp_swap' })
      .eq('transaction_type', 'credit');

    if (tempError) throw tempError;

    // Update debits to credit
    console.log(`   Updating ${debitTxns.length} debit → credit...`);
    const { error: debitUpdateError } = await supabase
      .from('transactions')
      .update({ transaction_type: 'credit' })
      .eq('transaction_type', 'debit');

    if (debitUpdateError) throw debitUpdateError;

    // Update temp to debit
    console.log(`   Updating ${creditTxns.length} temp → debit...`);
    const { error: creditUpdateError } = await supabase
      .from('transactions')
      .update({ transaction_type: 'debit' })
      .eq('transaction_type', 'temp_swap');

    if (creditUpdateError) throw creditUpdateError;

    // Verify the swap
    console.log('\n✅ Swap complete!\n');
    console.log('📊 New transaction type counts:');

    const { data: afterData, error: afterError } = await supabase
      .from('transactions')
      .select('transaction_type, amount');

    if (afterError) throw afterError;

    const afterCounts = {
      credit: afterData.filter(t => t.transaction_type === 'credit').length,
      debit: afterData.filter(t => t.transaction_type === 'debit').length,
    };

    console.log(`   Credit (income): ${afterCounts.credit} (was ${beforeCounts.credit})`);
    console.log(`   Debit (expense): ${afterCounts.debit} (was ${beforeCounts.debit})\n`);

    console.log('✨ Transaction types have been corrected!\n');

  } catch (error) {
    console.error('❌ Error fixing transaction types:', error.message);
    process.exit(1);
  }
}

// Run the fix
fixTransactionTypes();
