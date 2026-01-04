"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Loader2, Mail, Send } from "lucide-react"
import { toast } from "sonner"

export function EmailPreferences() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)
  const [dailyDigestEnabled, setDailyDigestEnabled] = useState(false)
  const [canSendTestEmail, setCanSendTestEmail] = useState(false)

  useEffect(() => {
    loadPreferences()
  }, [])

  const loadPreferences = async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) return

      // Check if user is authorized to send test emails
      setCanSendTestEmail(user.email === 'cocoughlin@me.com')

      // Try to get existing preferences
      let { data: prefs, error } = await supabase
        .from('email_preferences')
        .select('daily_digest_enabled')
        .eq('user_id', user.id)
        .single()

      // If no preferences exist, create default ones
      if (error && error.code === 'PGRST116') {
        const { data: newPrefs } = await supabase
          .from('email_preferences')
          .insert({ user_id: user.id, daily_digest_enabled: false })
          .select('daily_digest_enabled')
          .single()

        prefs = newPrefs
      }

      if (prefs) {
        setDailyDigestEnabled(prefs.daily_digest_enabled)
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
      // Revert the switch
      setDailyDigestEnabled(!enabled)
    } finally {
      setSaving(false)
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
              Receive a daily email with your budget progress, recent transactions, and category breakdown at 8:00 AM
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
          <div className="flex flex-col gap-2 pt-4 border-t">
            <p className="text-sm text-muted-foreground mb-2">
              {canSendTestEmail ? 'Test your daily digest email:' : 'Preview your daily digest:'}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={previewDigest}
                className={canSendTestEmail ? "flex-1" : "w-full"}
              >
                <Mail className="h-4 w-4 mr-2" />
                Preview
              </Button>
              {canSendTestEmail && (
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
              )}
            </div>
            {!canSendTestEmail && (
              <p className="text-xs text-muted-foreground mt-2">
                Once enabled, you'll receive your daily digest automatically at 8:00 AM each day. Use Preview to see what it will look like.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
