/**
 * Budget Digest Email Template
 *
 * Generates HTML email with budget progress, recent transactions, and breakdown
 */

interface DigestData {
  userName: string
  date: string
  budgetProgress: {
    totalBudget: number
    totalSpent: number
    totalRemaining: number
    percentageUsed: number
    isOverBudget: boolean
  }
  categoryBreakdown: Array<{
    categoryName: string
    categoryIcon: string
    categoryColor: string
    budgetAmount: number
    spent: number
    remaining: number
    percentageUsed: number
    rollover?: number
  }>
  recentTransactions: Array<{
    date: string
    description: string
    amount: number
    categoryName: string
    categoryIcon: string
    type: 'debit' | 'credit'
  }>
  daysRemainingInMonth: number
}

export function generateBudgetDigestHTML(data: DigestData): string {
  const {
    userName,
    date,
    budgetProgress,
    categoryBreakdown,
    recentTransactions,
    daysRemainingInMonth
  } = data

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount)
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    })
  }

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Daily Budget Digest</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background-color: #f5f5f5;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
    }
    .header {
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      padding: 32px 24px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      color: #ffffff;
      font-size: 28px;
      font-weight: 700;
    }
    .header p {
      margin: 8px 0 0 0;
      color: #d1fae5;
      font-size: 14px;
    }
    .content {
      padding: 24px;
    }
    .greeting {
      font-size: 16px;
      color: #374151;
      margin-bottom: 24px;
    }
    .budget-overview {
      background-color: ${budgetProgress.isOverBudget ? '#fef2f2' : '#f0fdf4'};
      border-left: 4px solid ${budgetProgress.isOverBudget ? '#ef4444' : '#10b981'};
      padding: 20px;
      margin-bottom: 24px;
      border-radius: 8px;
    }
    .budget-overview h2 {
      margin: 0 0 16px 0;
      font-size: 18px;
      color: #111827;
    }
    .budget-stats {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 16px;
      margin-bottom: 16px;
    }
    .stat {
      text-align: center;
    }
    .stat-label {
      font-size: 12px;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }
    .stat-value {
      font-size: 16px;
      font-weight: 700;
      color: #111827;
    }
    .progress-bar {
      height: 8px;
      background-color: #e5e7eb;
      border-radius: 4px;
      overflow: hidden;
      margin-top: 8px;
    }
    .progress-fill {
      height: 100%;
      background-color: ${budgetProgress.isOverBudget ? '#ef4444' : '#10b981'};
      width: ${Math.min(budgetProgress.percentageUsed, 100)}%;
      transition: width 0.3s ease;
    }
    .section {
      margin-bottom: 32px;
    }
    .section-title {
      font-size: 18px;
      font-weight: 700;
      color: #111827;
      margin-bottom: 16px;
      padding-bottom: 8px;
      border-bottom: 2px solid #e5e7eb;
    }
    .category-item {
      display: flex;
      align-items: center;
      padding: 12px;
      margin-bottom: 8px;
      background-color: #f9fafb;
      border-radius: 8px;
    }
    .category-icon {
      width: 40px;
      height: 40px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      margin-right: 12px;
    }
    .category-details {
      flex: 1;
    }
    .category-name {
      font-size: 14px;
      font-weight: 600;
      color: #111827;
      margin-bottom: 4px;
    }
    .category-progress {
      font-size: 12px;
      color: #6b7280;
    }
    .category-amount {
      text-align: right;
      font-weight: 600;
    }
    .transaction-item {
      display: flex;
      align-items: center;
      padding: 12px;
      border-bottom: 1px solid #e5e7eb;
    }
    .transaction-icon {
      width: 32px;
      height: 32px;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      margin-right: 12px;
      background-color: #f3f4f6;
    }
    .transaction-details {
      flex: 1;
    }
    .transaction-name {
      font-size: 14px;
      font-weight: 500;
      color: #111827;
      margin-bottom: 2px;
    }
    .transaction-meta {
      font-size: 12px;
      color: #6b7280;
    }
    .transaction-amount {
      text-align: right;
      font-weight: 600;
    }
    .amount-debit {
      color: #ef4444;
    }
    .amount-credit {
      color: #10b981;
    }
    .footer {
      background-color: #f9fafb;
      padding: 24px;
      text-align: center;
      border-top: 1px solid #e5e7eb;
    }
    .footer p {
      margin: 0;
      font-size: 12px;
      color: #6b7280;
    }
    .footer a {
      color: #10b981;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>💰 Budget Digest</h1>
      <p>${date}</p>
    </div>

    <div class="content">
      <div class="greeting">
        Good morning${userName ? `, ${userName}` : ''}! 👋
      </div>

      <!-- Budget Overview -->
      <div class="budget-overview">
        <h2>📊 Budget Overview</h2>
        <div class="budget-stats">
          <div class="stat">
            <div class="stat-label">Budget</div>
            <div class="stat-value">${formatCurrency(budgetProgress.totalBudget)}</div>
          </div>
          <div class="stat">
            <div class="stat-label">Spent</div>
            <div class="stat-value">${formatCurrency(budgetProgress.totalSpent)}</div>
          </div>
          <div class="stat">
            <div class="stat-label">Remaining</div>
            <div class="stat-value" style="color: ${budgetProgress.isOverBudget ? '#ef4444' : '#10b981'}">
              ${formatCurrency(Math.abs(budgetProgress.totalRemaining))}
            </div>
          </div>
        </div>
        <div class="progress-bar">
          <div class="progress-fill"></div>
        </div>
        <p style="margin: 12px 0 0 0; font-size: 14px; color: #6b7280;">
          ${budgetProgress.isOverBudget
            ? `⚠️ You're ${formatCurrency(Math.abs(budgetProgress.totalRemaining))} over budget`
            : `✅ You have ${daysRemainingInMonth} days left in the month`
          }
        </p>

        <!-- Pacing Metrics -->
        <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
          <div style="font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 8px;">📈 Pacing</div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 13px;">
            <div>
              <span style="color: #6b7280;">Month Progress:</span>
              <strong style="color: #111827; margin-left: 4px;">${Math.round(budgetProgress.percentageThroughMonth)}%</strong>
            </div>
            <div>
              <span style="color: #6b7280;">Budget Used:</span>
              <strong style="color: ${budgetProgress.isPacingOver ? '#ef4444' : '#10b981'}; margin-left: 4px;">
                ${Math.round(budgetProgress.percentageUsed)}%
              </strong>
            </div>
            <div style="grid-column: 1 / -1;">
              <span style="color: #6b7280;">Expected vs Actual:</span>
              <strong style="color: #111827; margin-left: 4px;">
                ${formatCurrency(budgetProgress.expectedSpending)} / ${formatCurrency(budgetProgress.totalSpent)}
              </strong>
              ${budgetProgress.isPacingOver
                ? `<span style="color: #ef4444; margin-left: 4px;">(+${formatCurrency(budgetProgress.pacingDifference)} over pace)</span>`
                : `<span style="color: #10b981; margin-left: 4px;">(${formatCurrency(Math.abs(budgetProgress.pacingDifference))} under pace)</span>`
              }
            </div>
          </div>
        </div>
      </div>

      <!-- Category Breakdown -->
      <div class="section">
        <h3 class="section-title">📁 Category Breakdown</h3>
        ${categoryBreakdown.map(category => `
          <div class="category-item">
            <div class="category-icon" style="background-color: ${category.categoryColor}20; color: ${category.categoryColor};">
              ${category.categoryIcon}
            </div>
            <div class="category-details">
              <div class="category-name">${category.categoryName}</div>
              <div class="category-progress">
                ${formatCurrency(category.spent)} / ${formatCurrency(category.budgetAmount)}
                ${category.rollover ? ` (${category.rollover >= 0 ? '+' : ''}${formatCurrency(category.rollover)} rollover)` : ''}
              </div>
            </div>
            <div class="category-amount" style="color: ${category.remaining >= 0 ? '#10b981' : '#ef4444'};">
              ${category.remaining >= 0 ? '' : '-'}${formatCurrency(Math.abs(category.remaining))}
            </div>
          </div>
        `).join('')}
      </div>

      <!-- Recent Transactions -->
      <div class="section">
        <h3 class="section-title">🧾 Recent Transactions (Last 24h)</h3>
        ${recentTransactions.length > 0 ? `
          ${recentTransactions.map(tx => `
            <div class="transaction-item">
              <div class="transaction-icon">
                ${tx.categoryIcon}
              </div>
              <div class="transaction-details">
                <div class="transaction-name">${tx.description}</div>
                <div class="transaction-meta">${tx.categoryName} • ${formatDate(tx.date)}</div>
              </div>
              <div class="transaction-amount ${tx.type === 'debit' ? 'amount-debit' : 'amount-credit'}">
                ${tx.type === 'credit' ? '+' : '-'}${formatCurrency(tx.amount)}
              </div>
            </div>
          `).join('')}
        ` : `
          <p style="text-align: center; color: #6b7280; padding: 24px;">
            No transactions in the last 24 hours
          </p>
        `}
      </div>
    </div>

    <div class="footer">
      <p>
        You're receiving this email because you enabled daily budget digests.<br>
        <a href="{{unsubscribe_url}}">Manage email preferences</a>
      </p>
    </div>
  </div>
</body>
</html>
  `.trim()
}
