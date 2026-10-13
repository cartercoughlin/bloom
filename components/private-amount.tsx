'use client'

import { usePrivacy } from '@/contexts/privacy-context'
import { cn } from '@/lib/utils'

interface PrivateAmountProps {
  amount: number
  className?: string
  prefix?: string
  showSign?: boolean
  type?: 'credit' | 'debit'
  decimals?: number
}

export function PrivateAmount({ amount, className, prefix = '$', showSign = false, type, decimals = 2 }: PrivateAmountProps) {
  const { privacyMode } = usePrivacy()

  const format = (value: number) => value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  })
  const formattedAmount = format(amount)

  let displayValue: string

  if (type) {
    // For transactions: credit is income (+), debit is expense (-)
    const sign = type === 'credit' ? '+' : '-'
    displayValue = `${sign}${prefix}${formattedAmount}`
  } else if (showSign) {
    const sign = amount >= 0 ? '+' : '-'
    displayValue = `${sign}${prefix}${format(Math.abs(amount))}`
  } else {
    displayValue = `${prefix}${formattedAmount}`
  }

  return (
    <span className={cn(className, privacyMode && 'blur-sm select-none')}>
      {displayValue}
    </span>
  )
}
