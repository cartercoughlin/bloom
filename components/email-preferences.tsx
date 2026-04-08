"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, Mail, Send, Plus, X } from "lucide-react"
import { toast } from "sonner"

export function EmailPreferences() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)
  const [dailyDigestEnabled, setDailyDigestEnabled] = useState(false)
  const [additionalEmails, setAdditionalEmails] = useState<string[]>([])
  const [newEmail, setNewEmail] = useState("")
  const [addingEmail, setAddingEmail] = useState(false)

  useEffect(() => {
    loadPreferences()
  }, [])

  const loadPreferences = async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) return

      let { data: prefs, error } = await supabase
        .from('email_preferences')
        .select('daily_digest_enabled, additional_emails')
        .eq('user_id', user.id)
        .single()

      if (error && error.code === 'PGRST116') {
        const { data: newPrefs } = await supabase
          .from('email_preferences')
          .insert({ user_id: user.id, daily_digest_enabled: false, additional_emails: [] })
          .select('daily_digest_enabled, additional_emails')
          .single()

        prefs = newPrefs
      }

      if (prefs) {
        setDailyDigestEnabled(prefs.daily_digest_enabled)
        setAdditionalEmails(prefs.additional_emails || [])
      }
    } catch (error) {
      console.error('Error loading email preferences:', error)
      toast.error('Failed to load email preferences')
    } finally {
      setLoading(false)
    }
  }

  const savePreferences = async (enabled: boolean) => {
    setSaving(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) throw new Error('Not authenticated')

      const { error } = await supabase
        .from('email_preferences')
        .update({ daily_digest_enabled: enabled })
        .eq('user_id', user.id)

      if (error) throw error

      setDailyDigestEnabled(enabled)
      toast.success(enabled ? 'Daily digest enabled!' : 'Daily digest disabled')
    } catch (error) {
      console.error('Error saving preferences:', error)
      toast.error('Failed to save preferences')
      setDailyDigestEnabled(!enabled)
    } finally {
      setSaving(false)
    }
  }

  const addEmail = async () => {
    const email = newEmail.trim().toLowerCase()
    if (!email) return

    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('Please enter a valid email address')
      return
    }

    if (additionalEmails.includes(email)) {
      toast.error('This email is already added')
      return
    }

    setAddingEmail(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const updated = [...additionalEmails, email]

      const { error } = await supabase
        .from('email_preferences')
        .update({ additional_emails: updated })
        .eq('user_id', user.id)

      if (error) throw error

      setAdditionalEmails(updated)
      setNewEmail("")
      toast.success(`Added ${email}`)
    } catch (error) {
      console.error('Error adding email:', error)
      toast.error('Failed to add email')
    } finally {
      setAddingEmail(false)
    }
  }

  const removeEmail = async (email: string) => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const updated = additionalEmails.filter(e => e !== email)

      const { error } = await supabase
        .from('email_preferences')
        .update({ additional_emails: updated })
        .eq('user_id', user.id)

      if (error) throw error

      setAdditionalEmails(updated)
      toast.success(`Removed ${email}`)
    } catch (error) {
      console.error('Error removing email:', error)
      toast.error('Failed to remove email')
    }
  }

  const sendTestEmail = async () => {
    setSending(true)
    try {
      const response = await fetch('/api/send-digest', {
        method: 'POST'
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to send test email')
      }

      if (result.success) {
        toast.success('Test email sent! Check your inbox.')
      } else {
        toast.error(result.message || 'Could not send test email')
      }
    } catch (error) {
      console.error('Error sending test email:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to send test email')
    } finally {
      setSending(false)
    }
  }

  const previewDigest = () => {
    window.open('/api/send-digest', '_blank')
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Preferences
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Email Preferences
        </CardTitle>
        <CardDescription>
          Manage your email notification settings
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between space-x-4">
          <div className="flex-1 space-y-1">
            <Label htmlFor="daily-digest" className="text-base">Daily Budget Digest</Label>
            <p className="text-sm text-muted-foreground">
              Receive a daily email with your budget progress, recent transactions, and category breakdown at noon
            </p>
          </div>
          <Switch
            id="daily-digest"
            checked={dailyDigestEnabled}
            onCheckedChange={savePreferences}
            disabled={saving}
          />
        </div>

        {dailyDigestEnabled && (
          <>
            {/* Additional Emails */}
            <div className="pt-4 border-t space-y-3">
              <div>
                <Label className="text-sm font-medium">Additional Email Addresses</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  The digest is sent to your account email. Add more addresses to send it to others too.
                </p>
              </div>

              {additionalEmails.length > 0 && (
                <div className="space-y-2">
                  {additionalEmails.map((email) => (
                    <div key={email} className="flex items-center gap-2 text-sm">
                      <span className="flex-1 truncate text-muted-foreground">{email}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() => removeEmail(email)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  addEmail()
                }}
              >
                <Input
                  type="email"
                  placeholder="email@example.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="h-9 text-sm"
                />
                <Button
                  type="submit"
                  variant="outline"
                  size="sm"
                  disabled={addingEmail || !newEmail.trim()}
                  className="h-9"
                >
                  {addingEmail ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                </Button>
              </form>
            </div>

            {/* Test Controls */}
            <div className="flex flex-col gap-2 pt-4 border-t">
              <p className="text-sm text-muted-foreground mb-2">
                Test your daily digest email:
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={previewDigest}
                  className="flex-1"
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Preview
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={sendTestEmail}
                  disabled={sending}
                  className="flex-1"
                >
                  {sending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Send Test
                    </>
                  )}
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
