#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing environment variables!')
  console.error('Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  console.error('\nUsage:')
  console.error('  NEXT_PUBLIC_SUPABASE_URL=<url> SUPABASE_SERVICE_ROLE_KEY=<key> node scripts/test-real-data.mjs')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// Similarity function (same as in category-rules.ts)
function calculateSimilarity(str1, str2) {
  const words1 = str1.toLowerCase().split(' ')
  const words2 = str2.toLowerCase().split(' ')

  const commonWords = words1.filter(word =>
    word.length > 3 && words2.includes(word)
  )

  return commonWords.length / Math.max(words1.length, words2.length)
}

async function testRealData() {
  console.log('🔍 Fetching user: cocoughlin@me.com\n')

  // Get user ID
  const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers()

  if (usersError) {
    console.error('Error fetching users:', usersError.message)
    return
  }

  const user = users?.find(u => u.email === 'cocoughlin@me.com')

  if (!user) {
    console.error('❌ User not found: cocoughlin@me.com')
    return
  }

  console.log(`✅ Found user: ${user.email} (ID: ${user.id})\n`)

  // Try both 2024 and 2025
  for (const year of ['2024', '2025']) {
    const date = `${year}-12-18`
    console.log(`\n${'='.repeat(80)}`)
    console.log(`Checking for uncategorized transactions on ${date}`)
    console.log('='.repeat(80))

    // Get uncategorized transactions from Dec 18
    const { data: uncategorizedTxs, error: txError } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user.id)
      .is('category_id', null)
      .gte('date', date)
      .lte('date', date)

    if (txError) {
      console.error('Error fetching transactions:', txError.message)
      continue
    }

    if (!uncategorizedTxs || uncategorizedTxs.length === 0) {
      console.log(`\n❌ No uncategorized transactions found for ${date}`)
      continue
    }

    console.log(`\n✅ Found ${uncategorizedTxs.length} uncategorized transaction(s)\n`)

    // Get user's categorized transactions
    const { data: categorizedTxs } = await supabase
      .from('transactions')
      .select('id, description, category_id, categories(name)')
      .eq('user_id', user.id)
      .not('category_id', 'is', null)
      .order('date', { ascending: false })
      .limit(500)

    console.log(`User has ${categorizedTxs?.length || 0} categorized transactions in history\n`)

    // Test each uncategorized transaction
    for (const tx of uncategorizedTxs) {
      console.log('─'.repeat(80))
      console.log(`\nTransaction: "${tx.description}"`)
      console.log(`Amount: $${tx.amount}`)
      console.log(`Type: ${tx.transaction_type}`)
      console.log(`Bank: ${tx.bank}`)
      console.log(`\nSearching for similar transactions...\n`)

      if (!categorizedTxs || categorizedTxs.length === 0) {
        console.log('❌ No categorized transactions to learn from')
        console.log('Result: Remains UNCATEGORIZED')
        continue
      }

      // Calculate similarities
      const scoredMatches = []

      for (const catTx of categorizedTxs) {
        const similarity = calculateSimilarity(tx.description, catTx.description)

        if (similarity > 0.3) {
          scoredMatches.push({
            categoryId: catTx.category_id,
            categoryName: catTx.categories?.name || 'Unknown',
            similarity,
            matchedDescription: catTx.description
          })
        }
      }

      if (scoredMatches.length === 0) {
        console.log('❌ No similar transactions found (all below 30% similarity)')
        console.log('Result: Remains UNCATEGORIZED')
        continue
      }

      // Sort and show matches
      scoredMatches.sort((a, b) => b.similarity - a.similarity)
      console.log(`✅ Found ${scoredMatches.length} similar transaction(s):\n`)

      scoredMatches.slice(0, 5).forEach((match, i) => {
        console.log(`  ${i + 1}. "${match.matchedDescription}"`)
        console.log(`     Category: ${match.categoryName}`)
        console.log(`     Similarity: ${(match.similarity * 100).toFixed(1)}%\n`)
      })

      // Group by category
      const categoryScores = new Map()

      for (const match of scoredMatches) {
        const existing = categoryScores.get(match.categoryId)
        if (existing) {
          existing.count++
          existing.totalSimilarity += match.similarity
        } else {
          categoryScores.set(match.categoryId, {
            categoryName: match.categoryName,
            count: 1,
            totalSimilarity: match.similarity,
            bestMatch: match.matchedDescription
          })
        }
      }

      // Calculate confidence
      const suggestions = Array.from(categoryScores.entries())
        .map(([categoryId, score]) => {
          const avgSimilarity = score.totalSimilarity / score.count
          const confidence = Math.min(0.9, avgSimilarity * (1 + Math.log(score.count) * 0.1))

          return {
            categoryId,
            categoryName: score.categoryName,
            confidence,
            reason: score.count > 1
              ? `${score.count} similar transactions (e.g., "${score.bestMatch}")`
              : `Similar to "${score.bestMatch}"`
          }
        })
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 3)

      console.log('🎯 TOP SUGGESTIONS:\n')

      suggestions.forEach((s, i) => {
        console.log(`  ${i + 1}. ${s.categoryName}`)
        console.log(`     Confidence: ${(s.confidence * 100).toFixed(1)}%`)
        console.log(`     Reason: ${s.reason}\n`)
      })
    }
  }

  console.log('\n' + '='.repeat(80))
  console.log('✅ Test complete')
}

testRealData().catch(console.error)
