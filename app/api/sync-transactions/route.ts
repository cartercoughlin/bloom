import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { readSheet } from '@/lib/google-sheets'

export async function POST() {
  try {
    const supabase = await createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID
    if (!spreadsheetId) {
      return NextResponse.json({ error: 'Spreadsheet ID not configured' }, { status: 500 })
    }

    // Read data from Google Sheets
    const rows = await readSheet(spreadsheetId, 'Sheet1!A:H')
    
    if (!rows || rows.length <= 1) {
      return NextResponse.json({ message: 'No data to sync' })
    }

    // Skip header row
    const dataRows = rows.slice(1)
    
    // Process and insert transactions
    const transactions = dataRows.map(row => ({
      user_id: user.id,
      date: row[0] || '',
      description: row[1] || '',
      amount: parseFloat(row[2]) || 0,
      bank: row[3] || '',
      account: row[4] || '',
      transaction_type: row[5] || '',
      institution: row[6] || '',
      category_id: null,
      hidden: false
    })).filter(t => t.date && t.description && t.amount !== 0)

    // Insert transactions (ignore duplicates)
    const { error } = await supabase
      .from('transactions')
      .upsert(transactions, { 
        onConflict: 'user_id,date,description,amount',
        ignoreDuplicates: true 
      })

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Failed to sync transactions' }, { status: 500 })
    }

    return NextResponse.json({ 
      message: 'Transactions synced successfully',
      count: transactions.length 
    })

  } catch (error) {
    console.error('Sync error:', error)
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 })
  }
}
