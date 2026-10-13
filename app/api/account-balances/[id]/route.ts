import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { balance } = await request.json()

    const { data: account, error } = await supabase
      .from('account_balances')
      .update({ 
        balance: parseFloat(balance),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Failed to update account' }, { status: 500 })
    }

    return NextResponse.json(account)
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

const MAX_NAME_LENGTH = 60

// Rename an account. { custom_name: string } sets the name shown in the app;
// an empty string or null goes back to the name from the bank.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { custom_name } = await request.json()
    if (custom_name !== null && typeof custom_name !== 'string') {
      return NextResponse.json({ error: 'custom_name must be a string or null' }, { status: 400 })
    }
    const name = typeof custom_name === 'string' ? custom_name.trim() : ''
    if (name.length > MAX_NAME_LENGTH) {
      return NextResponse.json({ error: `Names can be up to ${MAX_NAME_LENGTH} characters` }, { status: 400 })
    }

    const { data: account, error } = await supabase
      .from('account_balances')
      .update({ custom_name: name || null })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      // Column added by migrations/add-account-custom-name.sql
      if (error.code === '42703' || error.code === 'PGRST204' || /custom_name/.test(error.message)) {
        return NextResponse.json(
          { error: 'Renaming needs a database update: run migrations/add-account-custom-name.sql in Supabase' },
          { status: 409 }
        )
      }
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Failed to rename account' }, { status: 500 })
    }

    return NextResponse.json(account)
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { error } = await supabase
      .from('account_balances')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
