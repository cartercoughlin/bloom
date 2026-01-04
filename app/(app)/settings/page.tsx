'use client'

import { EmailPreferences } from "@/components/email-preferences"

export default function SettingsPage() {
  return (
    <div className="container mx-auto p-3 md:p-6 max-w-4xl pb-20 md:pb-6">
      <div className="mb-6 md:mb-8">
        <h1 className="text-xl md:text-3xl font-bold mb-1 md:mb-2 text-green-600">Settings</h1>
        <p className="text-muted-foreground text-xs md:text-sm">
          Manage your account preferences and notifications
        </p>
      </div>

      <div className="space-y-6">
        <EmailPreferences />
      </div>
    </div>
  )
}
