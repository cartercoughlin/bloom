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
    // The code fix was deployed at 2025-12-14 22:39:17 UTC
    // Only swap transactions created AFTER this time (they have correct types but were reversed by blanket swap)
    const CODE_FIX_TIMESTAMP = '2025-12-14T22:39:17+00:00';

    console.log('📊 Analyzing transactions by creation time...\n');

    // Get all transactions
    const { data: allData, error: allError } = await supabase
      .from('transactions')
      .select('transaction_type, created_at');

    if (allError) throw allError;

    const oldTxns = allData.filter(t => new Date(t.created_at) < new Date(CODE_FIX_TIMESTAMP));
    const newTxns = allData.filter(t => new Date(t.created_at) >= new Date(CODE_FIX_TIMESTAMP));

    console.log(`   OLD transactions (before code fix): ${oldTxns.length}`);
    console.log(`   NEW transactions (after code fix): ${newTxns.length}`);
    console.log(`   Code fix timestamp: ${CODE_FIX_TIMESTAMP}\n`);

    // Show breakdown
    console.log('📊 Current state:');
    console.log('   OLD transactions (should be swapped already):');
    console.log(`      Credit: ${oldTxns.filter(t => t.transaction_type === 'credit').length}`);
    console.log(`      Debit: ${oldTxns.filter(t => t.transaction_type === 'debit').length}`);
    console.log('   NEW transactions (need to be swapped back):');
    console.log(`      Credit: ${newTxns.filter(t => t.transaction_type === 'credit').length}`);
    console.log(`      Debit: ${newTxns.filter(t => t.transaction_type === 'debit').length}\n`);

    // Get transactions created AFTER the fix (these need to be swapped back)
    const { data: newCreditTxns, error: newCreditError } = await supabase
      .from('transactions')
      .select('id')
      .eq('transaction_type', 'credit')
      .gte('created_at', CODE_FIX_TIMESTAMP);

    if (newCreditError) throw newCreditError;

    const { data: newDebitTxns, error: newDebitError } = await supabase
      .from('transactions')
      .select('id')
      .eq('transaction_type', 'debit')
      .gte('created_at', CODE_FIX_TIMESTAMP);

    if (newDebitError) throw newDebitError;

    console.log(`🔧 Swapping ${newCreditTxns.length + newDebitTxns.length} NEW transactions back to correct state...\n`);

    // Update new credits to temp
    if (newCreditTxns.length > 0) {
      console.log(`   Updating ${newCreditTxns.length} credit → temp...`);
      const { error: tempError } = await supabase
        .from('transactions')
        .update({ transaction_type: 'temp_swap' })
        .eq('transaction_type', 'credit')
        .gte('created_at', CODE_FIX_TIMESTAMP);

      if (tempError) throw tempError;
    }

    // Update new debits to credit
    if (newDebitTxns.length > 0) {
      console.log(`   Updating ${newDebitTxns.length} debit → credit...`);
      const { error: debitUpdateError } = await supabase
        .from('transactions')
        .update({ transaction_type: 'credit' })
        .eq('transaction_type', 'debit')
        .gte('created_at', CODE_FIX_TIMESTAMP);

      if (debitUpdateError) throw debitUpdateError;
    }

    // Update temp to debit
    if (newCreditTxns.length > 0) {
      console.log(`   Updating ${newCreditTxns.length} temp → debit...`);
      const { error: creditUpdateError } = await supabase
        .from('transactions')
        .update({ transaction_type: 'debit' })
        .eq('transaction_type', 'temp_swap');

      if (creditUpdateError) throw creditUpdateError;
    }

    console.log('\n✅ Fix complete!\n');

    // Verify final state
    const { data: finalData, error: finalError } = await supabase
      .from('transactions')
      .select('transaction_type, created_at');

    if (finalError) throw finalError;

    const finalOld = finalData.filter(t => new Date(t.created_at) < new Date(CODE_FIX_TIMESTAMP));
    const finalNew = finalData.filter(t => new Date(t.created_at) >= new Date(CODE_FIX_TIMESTAMP));

    console.log('📊 Final state:');
    console.log('   OLD transactions (swapped):');
    console.log(`      Credit: ${finalOld.filter(t => t.transaction_type === 'credit').length}`);
    console.log(`      Debit: ${finalOld.filter(t => t.transaction_type === 'debit').length}`);
    console.log('   NEW transactions (correct):');
    console.log(`      Credit: ${finalNew.filter(t => t.transaction_type === 'credit').length}`);
    console.log(`      Debit: ${finalNew.filter(t => t.transaction_type === 'debit').length}\n`);

    console.log('✨ All transaction types are now correct!\n');

  } catch (error) {
    console.error('❌ Error fixing transaction types:', error.message);
    process.exit(1);
  }
}

// Run the fix
fixTransactionTypes();
