'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { CreditCard, Plus, Trash2, RefreshCw } from 'lucide-react'
import { PlaidLink } from './plaid-link'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { PrivateAmount } from './private-amount'

interface ConnectedAccount {
  id: string
  item_id: string
  account_name: string | null
  institution_name: string | null
  sync_transactions: boolean
  sync_balances: boolean
  created_at: string
  updated_at: string
  total_balance: number
  account_count: number
  last_balance_update: string | null
}

export function ConnectedAccounts() {
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshingBalances, setRefreshingBalances] = useState(false)

  const loadAccounts = async () => {
    try {
      // Use the API endpoint to fetch accounts with balance info
      const response = await fetch('/api/connected-accounts')
      if (!response.ok) {
        throw new Error('Failed to fetch connected accounts')
      }
      const data = await response.json()
      setAccounts(data || [])
    } catch (error) {
      console.error('Error loading accounts:', error)
    } finally {
      setLoading(false)
    }
  }

  const updateSyncPreference = async (id: string, field: 'sync_transactions' | 'sync_balances', value: boolean, accountName: string) => {
    // If turning off, show confirmation and delete existing data
    if (!value) {
      const dataType = field === 'sync_transactions' ? 'transactions' : 'account balances'
      const confirmed = window.confirm(
        `This will remove all existing ${dataType} from ${accountName}. Are you sure you want to continue?`
      )
      
      if (!confirmed) return
      
      try {
        const supabase = createClient()
        
        // Get the item_id for this plaid item
        const { data: item } = await supabase
          .from('plaid_items')
          .select('item_id')
          .eq('id', id)
          .single()

        if (!item) {
          throw new Error('Account not found')
        }
        
        if (field === 'sync_transactions') {
          // First, let's see what bank names exist
          const { data: existingTransactions } = await supabase
            .from('transactions')
            .select('bank, description')
            .limit(10)
          
          console.log('Existing transactions:', existingTransactions)
          console.log('Looking for bank name:', accountName)
          
          // Delete transactions by matching bank name (contains account name)
          const { data: deletedTransactions, error: deleteError } = await supabase
            .from('transactions')
            .delete()
            .ilike('bank', `%${accountName}%`)
            .select()
            
          console.log('Deleted transactions:', deletedTransactions)
          console.log('Delete error:', deleteError)
        } else {
          // First, let's see what account names exist
          const { data: existingBalances } = await supabase
            .from('account_balances')
            .select('account_name')
          
          console.log('Existing balances:', existingBalances)
          console.log('Looking for account name:', accountName)
          
          // Delete account balances by matching account name
          const { data: deletedBalances, error: deleteError } = await supabase
            .from('account_balances')
            .delete()
            .ilike('account_name', `%${accountName}%`)
            .select()
            
          console.log('Deleted balances:', deletedBalances)
          console.log('Delete error:', deleteError)
        }
        
        // Update the preference
        const { error } = await supabase
          .from('plaid_items')
          .update({ [field]: value })
          .eq('id', id)

        if (error) throw error
        
        toast.success(`${field === 'sync_transactions' ? 'Transaction' : 'Balance'} sync disabled and existing data removed`)
        loadAccounts()
      } catch (error) {
        console.error('Error updating sync preference:', error)
        toast.error('Failed to update sync preference')
      }
      return
    }

    // For enabling, just update the preference
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('plaid_items')
        .update({ [field]: value })
        .eq('id', id)

      if (error) throw error
      
      loadAccounts()
    } catch (error) {
      console.error('Error updating sync preference:', error)
      toast.error('Failed to update sync preference')
    }
  }

  const removeAccount = async (id: string, accountName: string) => {
    try {
      const supabase = createClient()
      
      // Get the item_id before deleting
      const { data: item } = await supabase
        .from('plaid_items')
        .select('item_id')
        .eq('id', id)
        .single()

      if (!item) {
        throw new Error('Account not found')
      }

      // Delete related data first
      await Promise.all([
        // Delete transactions from this account
        supabase
          .from('transactions')
          .delete()
          .eq('bank', accountName),
        
        // Delete account balances
        supabase
          .from('account_balances')
          .delete()
          .like('account_name', `%${accountName}%`)
      ])

      // Delete the plaid item
      const { error } = await supabase
        .from('plaid_items')
        .delete()
        .eq('id', id)

      if (error) throw error
      
      toast.success('Account and all related data removed')
      loadAccounts()
    } catch (error) {
      console.error('Error removing account:', error)
      toast.error('Failed to remove account')
    }
  }

  const refreshBalances = async () => {
    setRefreshingBalances(true)
    try {
      const response = await fetch('/api/sync-balances', {
        method: 'POST',
      })

      if (!response.ok) {
        throw new Error('Failed to refresh balances')
      }

      const result = await response.json()

      if (result.success) {
        toast.success(`Successfully refreshed ${result.syncedAccounts} account${result.syncedAccounts !== 1 ? 's' : ''}`)
        // Reload accounts to show updated balances
        loadAccounts()
      } else {
        throw new Error(result.message || 'Failed to refresh balances')
      }
    } catch (error) {
      console.error('Error refreshing balances:', error)
      toast.error('Failed to refresh balances')
    } finally {
      setRefreshingBalances(false)
    }
  }

  useEffect(() => {
    loadAccounts()
  }, [])

  const handlePlaidSuccess = () => {
    toast.success('Account connected successfully!')
    loadAccounts()
  }

  if (loading) {
    return <div>Loading accounts...</div>
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Connected Accounts
        </CardTitle>
        <CardDescription>
          Manage your connected bank accounts
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {accounts.length === 0 ? (
          <p className="text-muted-foreground text-sm">No accounts connected yet.</p>
        ) : (
          <div className="space-y-2">
            {accounts.map((account) => (
              <div key={account.id} className="p-4 border rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="font-medium">{account.institution_name || account.account_name || 'Bank Account'}</p>
                    <p className="text-sm text-muted-foreground">
                      Connected {new Date(account.created_at).toLocaleDateString()}
                    </p>
                    <div className="flex gap-4 mt-1 text-sm">
                      <p className="text-muted-foreground">
                        Last sync: {new Date(account.updated_at).toLocaleString()}
                      </p>
                      {account.account_count > 0 && (
                        <p className="font-medium text-green-600">
                          Total: <PrivateAmount amount={account.total_balance} className="inline" /> ({account.account_count} account{account.account_count !== 1 ? 's' : ''})
                        </p>
                      )}
                    </div>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove Account</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete this account connection and all associated transactions and balances. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction 
                          onClick={() => removeAccount(account.id, account.institution_name || account.account_name || 'Bank Account')}
                          variant="destructive"
                        >
                          Delete Account
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
                
                <div className="flex gap-6 text-sm">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id={`transactions-${account.id}`}
                      checked={account.sync_transactions}
                      onCheckedChange={(checked) => updateSyncPreference(
                        account.id, 
                        'sync_transactions', 
                        checked, 
                        account.institution_name || account.account_name || 'Bank Account'
                      )}
                    />
                    <Label htmlFor={`transactions-${account.id}`}>Sync Transactions</Label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Switch
                      id={`balances-${account.id}`}
                      checked={account.sync_balances}
                      onCheckedChange={(checked) => updateSyncPreference(
                        account.id, 
                        'sync_balances', 
                        checked,
                        account.institution_name || account.account_name || 'Bank Account'
                      )}
                    />
                    <Label htmlFor={`balances-${account.id}`}>Sync Balances</Label>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="pt-4 border-t">
          <div className="flex flex-col sm:flex-row gap-2">
            <PlaidLink onSuccess={handlePlaidSuccess} />
            <Button
              onClick={refreshBalances}
              disabled={refreshingBalances || accounts.length === 0}
              variant="outline"
              className="w-full sm:w-auto"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshingBalances ? 'animate-spin' : ''}`} />
              {refreshingBalances ? 'Refreshing...' : 'Refresh Balances'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
