import { createClient } from "@/lib/supabase/server"

export interface CategoryRule {
  id?: string
  user_id: string
  name: string
  category_id: string
  priority: number
  is_active: boolean

  // Condition fields (optional - at least one required)
  description_pattern?: string | null
  amount_min?: number | null
  amount_max?: number | null
  transaction_type?: 'debit' | 'credit' | null
  bank_pattern?: string | null
  account_pattern?: string | null
  institution_pattern?: string | null

  created_at?: string
  updated_at?: string
}

export interface SmartAssignment {
  transactionId: string
  categoryId: string
  confidence: number
  reason: string
}

export async function createCategoryRule(rule: Omit<CategoryRule, 'id'>): Promise<CategoryRule | null> {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('category_rules')
    .insert(rule)
    .select()
    .single()
  
  if (error) {
    console.error('Error creating rule:', error)
    return null
  }
  
  return data
}

export async function getCategoryRules(userId: string): Promise<CategoryRule[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('category_rules')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('priority', { ascending: false })

  if (error) {
    console.error('Error fetching category rules:', error)
    return []
  }

  return data || []
}

interface Transaction {
  description: string
  amount: number
  transaction_type: 'debit' | 'credit'
  bank?: string
  account?: string
  institution?: string
}

export async function assignCategoryByRules(transaction: Transaction, userId: string): Promise<string | null> {
  const rules = await getCategoryRules(userId)

  for (const rule of rules) {
    if (matchesRule(transaction, rule)) {
      return rule.category_id
    }
  }

  return null
}

function matchesRule(transaction: Transaction, rule: CategoryRule): boolean {
  // Check description pattern
  if (rule.description_pattern) {
    const pattern = new RegExp(rule.description_pattern, 'i')
    if (!pattern.test(transaction.description)) {
      return false
    }
  }

  // Check amount range
  if (rule.amount_min !== null && rule.amount_min !== undefined) {
    if (transaction.amount < rule.amount_min) {
      return false
    }
  }
  if (rule.amount_max !== null && rule.amount_max !== undefined) {
    if (transaction.amount > rule.amount_max) {
      return false
    }
  }

  // Check transaction type
  if (rule.transaction_type) {
    if (transaction.transaction_type !== rule.transaction_type) {
      return false
    }
  }

  // Check bank pattern
  if (rule.bank_pattern && transaction.bank) {
    const pattern = new RegExp(rule.bank_pattern, 'i')
    if (!pattern.test(transaction.bank)) {
      return false
    }
  }

  // Check account pattern
  if (rule.account_pattern && transaction.account) {
    const pattern = new RegExp(rule.account_pattern, 'i')
    if (!pattern.test(transaction.account)) {
      return false
    }
  }

  // Check institution pattern
  if (rule.institution_pattern && transaction.institution) {
    const pattern = new RegExp(rule.institution_pattern, 'i')
    if (!pattern.test(transaction.institution)) {
      return false
    }
  }

  // All specified conditions matched
  return true
}

export async function learnFromAssignment(transactionId: string, categoryId: string, userId: string) {
  const supabase = await createClient()
  
  // Get transaction details
  const { data: transaction } = await supabase
    .from('transactions')
    .select('description')
    .eq('id', transactionId)
    .single()
  
  if (!transaction) return
  
  // Check if similar pattern exists
  const words = transaction.description.toLowerCase().split(' ')
  const significantWords = words.filter(word => word.length > 3)
  
  for (const word of significantWords) {
    // Check if we should create a rule for this pattern
    const { data: similarTransactions } = await supabase
      .from('transactions')
      .select('id')
      .eq('user_id', userId)
      .eq('category_id', categoryId)
      .ilike('description', `%${word}%`)
    
    if (similarTransactions && similarTransactions.length >= 3) {
      // Create or update rule
      await supabase
        .from('category_rules')
        .upsert({
          user_id: userId,
          name: `Auto: ${word}`,
          description_pattern: word,
          category_id: categoryId,
          priority: 1,
          is_active: true
        })
    }
  }
}

export async function suggestCategories(
  transactionId: string | null,
  description: string,
  amount: number,
  userId: string,
  transactionType?: 'debit' | 'credit',
  bank?: string,
  account?: string,
  institution?: string
): Promise<SmartAssignment[]> {
  // If we have a transaction ID, fetch full details from database
  if (transactionId) {
    const supabase = await createClient()
    const { data: tx } = await supabase
      .from('transactions')
      .select('description, amount, transaction_type, bank')
      .eq('id', transactionId)
      .single()

    if (tx) {
      description = tx.description
      amount = tx.amount
      transactionType = tx.transaction_type
      bank = tx.bank || undefined
    }
  }

  // Build transaction object for rule matching
  const transaction: Transaction = {
    description,
    amount,
    transaction_type: transactionType || 'debit',
    bank,
    account,
    institution,
  }

  // Try to assign category using rules
  const categoryId = await assignCategoryByRules(transaction, userId)

  // If a matching rule was found, return it as a suggestion
  if (categoryId) {
    return [{
      transactionId: transactionId || '',
      categoryId,
      confidence: 0.95,
      reason: 'Matched category rule'
    }]
  }

  // No match found - return empty array (transaction stays uncategorized)
  return []
}

function calculateSimilarity(str1: string, str2: string): number {
  const words1 = str1.toLowerCase().split(' ')
  const words2 = str2.toLowerCase().split(' ')
  
  const commonWords = words1.filter(word => 
    word.length > 3 && words2.includes(word)
  )
  
  return commonWords.length / Math.max(words1.length, words2.length)
}
