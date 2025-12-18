'use client'

import { usePrivacy } from '@/contexts/privacy-context'
import { cn } from '@/lib/utils'

interface PrivateAmountProps {
  amount: number
  className?: string
  prefix?: string
  showSign?: boolean
  type?: 'credit' | 'debit'
}

export function PrivateAmount({ amount, className, prefix = '$', showSign = false, type }: PrivateAmountProps) {
  const { privacyMode } = usePrivacy()

  const formattedAmount = amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })

  let displayValue: string

  if (type) {
    // For transactions: credit is income (+), debit is expense (-)
    const sign = type === 'credit' ? '+' : '-'
    displayValue = `${sign}${prefix}${formattedAmount}`
  } else if (showSign) {
    const sign = amount >= 0 ? '+' : '-'
    displayValue = `${sign}${prefix}${Math.abs(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  } else {
    displayValue = `${prefix}${formattedAmount}`
  }

  return (
    <span className={cn(className, privacyMode && 'blur-sm select-none')}>
      {displayValue}
    </span>
  )
}
