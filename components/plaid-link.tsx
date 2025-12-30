'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

interface PlaidLinkProps {
  onSuccess?: () => void
}

declare global {
  interface Window {
    Plaid: {
      create: (config: any) => {
        open: () => void
        exit: () => void
      }
    }
  }
}

export function PlaidLink({ onSuccess }: PlaidLinkProps) {
  const [loading, setLoading] = useState(false)
  const [plaidLoaded, setPlaidLoaded] = useState(false)

  useEffect(() => {
    // Load Plaid Link script
    const script = document.createElement('script')
    script.src = 'https://cdn.plaid.com/link/v2/stable/link-initialize.js'
    script.onload = () => setPlaidLoaded(true)
    document.head.appendChild(script)

    return () => {
      if (document.head.contains(script)) {
        document.head.removeChild(script)
      }
    }
  }, [])

  const createLinkToken = async () => {
    try {
      setLoading(true)
      
      const response = await fetch('/api/plaid/link-token', {
        method: 'POST',
      })

      if (!response.ok) {
        throw new Error('Failed to create link token')
      }

      const data = await response.json()
      
      // Open Plaid Link once token is ready
      if (plaidLoaded && window.Plaid) {
        openPlaidLink(data.link_token)
      }
    } catch (error) {
      console.error('Error creating link token:', error)
      toast.error('Failed to initialize account connection')
      setLoading(false)
    }
  }

  const openPlaidLink = (token: string) => {
    if (!window.Plaid) {
      toast.error('Plaid not loaded')
      setLoading(false)
      return
    }

    const handler = window.Plaid.create({
      token,
      onSuccess: async (public_token: string) => {
        try {
          const response = await fetch('/api/plaid/exchange-token', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ public_token }),
          })

          if (!response.ok) {
            throw new Error('Failed to connect account')
          }

          toast.success('Account connected successfully!')
          onSuccess?.()
        } catch (error) {
          console.error('Error connecting account:', error)
          toast.error('Failed to connect account')
        } finally {
          setLoading(false)
        }
      },
      onExit: (err: any) => {
        if (err) {
          console.error('Plaid Link error:', err)
          toast.error('Failed to connect account')
        }
        setLoading(false)
      },
    })

    handler.open()
  }

  return (
    <Button
      onClick={createLinkToken}
      disabled={loading || !plaidLoaded}
      className="w-full sm:w-auto"
    >
      {loading ? 'Connecting...' : 'Connect Bank Account'}
    </Button>
  )
}
