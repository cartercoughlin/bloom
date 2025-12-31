#!/usr/bin/env node

/**
 * Direct test of categorization logic
 * This simulates the categorization algorithm with sample data
 */

// Simulate the calculateSimilarity function
function calculateSimilarity(str1, str2) {
  const words1 = str1.toLowerCase().split(' ')
  const words2 = str2.toLowerCase().split(' ')

  const commonWords = words1.filter(word =>
    word.length > 3 && words2.includes(word)
  )

  return commonWords.length / Math.max(words1.length, words2.length)
}

// Simulate the categorization algorithm
function testCategorization(uncategorizedTx, previouslyCategoriziedTxs) {
  console.log('\n' + '='.repeat(80))
  console.log(`Testing: "${uncategorizedTx.description}"`)
  console.log(`Amount: $${uncategorizedTx.amount}`)
  console.log('='.repeat(80))

  // Step 1: Check if there are any categorized transactions to learn from
  if (!previouslyCategoriziedTxs || previouslyCategoriziedTxs.length === 0) {
    console.log('\n❌ No categorized transactions to learn from')
    console.log('Result: Transaction remains UNCATEGORIZED')
    return []
  }

  console.log(`\nAnalyzing against ${previouslyCategoriziedTxs.length} previously categorized transactions...`)

  // Step 2: Calculate similarity scores
  const scoredMatches = []

  for (const tx of previouslyCategoriziedTxs) {
    const similarity = calculateSimilarity(uncategorizedTx.description, tx.description)

    if (similarity > 0.3) {
      scoredMatches.push({
        categoryId: tx.category_id,
        categoryName: tx.category_name,
        similarity,
        matchedDescription: tx.description
      })
    }
  }

  if (scoredMatches.length === 0) {
    console.log('\n❌ No similar transactions found (all below 30% similarity threshold)')
    console.log('Result: Transaction remains UNCATEGORIZED')
    return []
  }

  console.log(`\n✅ Found ${scoredMatches.length} similar transaction(s):\n`)

  // Sort and show matches
  scoredMatches.sort((a, b) => b.similarity - a.similarity)
  scoredMatches.slice(0, 5).forEach((match, i) => {
    console.log(`  ${i + 1}. "${match.matchedDescription}"`)
    console.log(`     Category: ${match.categoryName}`)
    console.log(`     Similarity: ${(match.similarity * 100).toFixed(1)}%\n`)
  })

  // Step 3: Group by category
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

  // Step 4: Calculate confidence and rank
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

  console.log('─'.repeat(80))
  console.log('\n🎯 TOP SUGGESTIONS:\n')

  suggestions.forEach((s, i) => {
    console.log(`  ${i + 1}. ${s.categoryName}`)
    console.log(`     Confidence: ${(s.confidence * 100).toFixed(1)}%`)
    console.log(`     Reason: ${s.reason}\n`)
  })

  return suggestions
}

// Example: Simulate testing with sample data
console.log('🧪 CATEGORIZATION LOGIC TEST')
console.log('Testing categorization for December 18th transactions\n')

// Example previously categorized transactions (simulating user's transaction history)
const previouslyCategoriziedTxs = [
  { description: 'AMAZON.COM*ABC123', amount: 29.99, category_id: 'cat-shopping', category_name: 'Shopping' },
  { description: 'AMAZON.COM*DEF456', amount: 45.50, category_id: 'cat-shopping', category_name: 'Shopping' },
  { description: 'AMAZON PRIME VIDEO', amount: 14.99, category_id: 'cat-entertainment', category_name: 'Entertainment' },
  { description: 'STARBUCKS #1234', amount: 5.75, category_id: 'cat-coffee', category_name: 'Coffee & Dining' },
  { description: 'STARBUCKS #5678', amount: 6.20, category_id: 'cat-coffee', category_name: 'Coffee & Dining' },
  { description: 'STARBUCKS STORE 9012', amount: 4.95, category_id: 'cat-coffee', category_name: 'Coffee & Dining' },
  { description: 'WHOLE FOODS MARKET', amount: 67.43, category_id: 'cat-groceries', category_name: 'Groceries' },
  { description: 'WHOLE FOODS #789', amount: 52.10, category_id: 'cat-groceries', category_name: 'Groceries' },
]

// Test case 1: Transaction similar to multiple previous transactions
const test1 = {
  description: 'STARBUCKS COFFEE #3456',
  amount: 5.47
}

testCategorization(test1, previouslyCategoriziedTxs)

// Test case 2: Transaction with partial similarity
const test2 = {
  description: 'AMAZON MARKETPLACE ORDER',
  amount: 35.00
}

testCategorization(test2, previouslyCategoriziedTxs)

// Test case 3: No similar transactions
const test3 = {
  description: 'RANDOM MERCHANT XYZ',
  amount: 100.00
}

testCategorization(test3, previouslyCategoriziedTxs)

// Test case 4: No categorized transaction history
const test4 = {
  description: 'ANY MERCHANT',
  amount: 50.00
}

console.log('\n' + '='.repeat(80))
console.log('Test Case: New user with no transaction history')
testCategorization(test4, [])

console.log('\n' + '='.repeat(80))
console.log('\n✨ Summary:')
console.log('- Transactions auto-categorize when similar transactions exist')
console.log('- Confidence increases with more matching transactions')
console.log('- Transactions remain uncategorized when no match is found')
console.log('- All suggestions are user-specific (filtered by user_id in database)')
console.log('\nTo test with REAL data from cocoughlin@me.com:')
console.log('1. Start dev server and log in')
console.log('2. Visit /api/test-categorization?date=2024-12-18')
console.log('   (or ?date=2025-12-18 if transactions are from 2025)\n')
