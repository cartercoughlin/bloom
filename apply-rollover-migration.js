#!/usr/bin/env node

/**
 * Apply Budget Rollover Toggle Migration
 *
 * This script adds the enable_rollover column to the budgets table
 * Run this once to enable the per-budget rollover toggle feature
 */

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')

async function applyMigration() {
  console.log('📦 Applying budget rollover migration...\n')

  // Load environment variables
  require('dotenv').config({ path: '.env.local' })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Error: Missing Supabase credentials')
    console.error('   Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  try {
    // Read migration file
    const migrationSQL = fs.readFileSync('./migrations/add-budget-rollover-toggle.sql', 'utf8')

    console.log('📝 Migration SQL:')
    console.log(migrationSQL)
    console.log()

    // Execute migration
    console.log('⚙️  Executing migration...')

    // Split by semicolons and execute each statement
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('--'))

    for (const statement of statements) {
      if (statement) {
        const { error } = await supabase.rpc('exec_sql', { sql: statement })
        if (error) {
          // If exec_sql doesn't exist, try direct execution
          console.log('   Attempting direct execution...')
          throw error
        }
      }
    }

    console.log('✅ Migration applied successfully!')
    console.log()
    console.log('📊 Verifying column exists...')

    // Verify by trying to select the column
    const { data, error } = await supabase
      .from('budgets')
      .select('id, enable_rollover')
      .limit(1)

    if (error) {
      console.error('❌ Verification failed:', error.message)
      console.log()
      console.log('⚠️  Please apply the migration manually using Supabase dashboard or CLI:')
      console.log('   1. Go to your Supabase project dashboard')
      console.log('   2. Navigate to SQL Editor')
      console.log('   3. Run the SQL from: migrations/add-budget-rollover-toggle.sql')
      process.exit(1)
    }

    console.log('✅ Column verified! enable_rollover is now available')
    console.log()
    console.log('🎉 All done! The per-budget rollover toggle feature is now active.')
    console.log()

  } catch (error) {
    console.error('❌ Migration failed:', error.message)
    console.log()
    console.log('📋 Please apply the migration manually:')
    console.log()
    console.log('Option 1: Supabase Dashboard')
    console.log('  1. Go to https://app.supabase.com')
    console.log('  2. Open your project')
    console.log('  3. Go to SQL Editor')
    console.log('  4. Paste and run the following SQL:')
    console.log()
    console.log('  ALTER TABLE public.budgets')
    console.log('  ADD COLUMN IF NOT EXISTS enable_rollover BOOLEAN DEFAULT true;')
    console.log()
    console.log('  CREATE INDEX IF NOT EXISTS idx_budgets_enable_rollover ON public.budgets(enable_rollover);')
    console.log()
    console.log('Option 2: Supabase CLI')
    console.log('  supabase db push --file migrations/add-budget-rollover-toggle.sql')
    console.log()
    process.exit(1)
  }
}

applyMigration().catch(error => {
  console.error('💥 Fatal error:', error)
  process.exit(1)
})
