# Daily Budget Digest Email Setup

This guide will help you set up the daily budget digest email feature that sends you a beautiful email each morning with your budget progress, recent transactions, and category breakdown.

## Features

✅ Daily email at 8:00 AM with:
- Budget overview (total budget, spent, remaining)
- Category-by-category breakdown with rollover
- Recent transactions from the last 24 hours
- Days remaining in the month
- Visual progress bars and color-coded alerts

✅ User preferences:
- Opt-in/opt-out control
- Preview digest before sending
- Send test email

## Prerequisites

1. **Resend Account** (Email Service)
2. **Supabase** (Already configured)
3. **Vercel** (For cron jobs)

## Step 1: Set Up Resend

Resend is a modern email API that's free for up to 3,000 emails/month.

1. **Create Account**: Go to [resend.com](https://resend.com) and sign up
2. **Verify Domain** (Recommended for production):
   - Go to "Domains" in Resend dashboard
   - Add your domain (e.g., `yourdomain.com`)
   - Follow DNS setup instructions
   - Wait for verification (usually < 10 minutes)

3. **Get API Key**:
   - Go to "API Keys" in Resend dashboard
   - Click "Create API Key"
   - Copy the key

4. **Add Environment Variables**:

Add these to your `.env.local` file and Vercel environment variables:

```bash
# Resend API Key
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxx

# Email "From" address (must be verified domain)
EMAIL_FROM="Budget Digest <digest@yourdomain.com>"

# Optional: Cron secret for security
CRON_SECRET=your-random-secret-string
```

## Step 2: Apply Database Migration

Run this SQL in your Supabase SQL Editor:

```sql
-- Add email_preferences table
CREATE TABLE IF NOT EXISTS public.email_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  daily_digest_enabled BOOLEAN DEFAULT false,
  digest_time TIME DEFAULT '08:00:00',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.email_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "email_preferences_select_own" ON public.email_preferences
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "email_preferences_insert_own" ON public.email_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "email_preferences_update_own" ON public.email_preferences
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "email_preferences_delete_own" ON public.email_preferences
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_email_preferences_user_id ON public.email_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_email_preferences_daily_digest ON public.email_preferences(daily_digest_enabled) WHERE daily_digest_enabled = true;

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_email_preferences_updated_at
  BEFORE UPDATE ON public.email_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Insert default preferences for existing users
INSERT INTO public.email_preferences (user_id, daily_digest_enabled)
SELECT id, false
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.email_preferences)
ON CONFLICT (user_id) DO NOTHING;
```

## Step 3: Deploy to Vercel

The cron job is already configured in `vercel.json` to run daily at 8:00 AM:

```json
{
  "path": "/api/cron/daily-digest",
  "schedule": "0 8 * * *"
}
```

1. **Push code to GitHub**:
```bash
git add .
git commit -m "feat: Add daily budget digest email feature"
git push
```

2. **Deploy to Vercel**:
```bash
vercel --prod
```

3. **Add environment variables** in Vercel dashboard:
   - Go to Project Settings → Environment Variables
   - Add `RESEND_API_KEY`
   - Add `EMAIL_FROM`
   - Add `CRON_SECRET` (optional but recommended)
   - Redeploy

## Step 4: Enable Daily Digest for Your Account

1. Navigate to your app's settings page (you'll need to add the EmailPreferences component)
2. Toggle "Daily Budget Digest" to ON
3. Click "Preview" to see what the email looks like
4. Click "Send Test" to send yourself a test email

### Adding EmailPreferences Component

Add to your settings page:

```tsx
import { EmailPreferences } from "@/components/email-preferences"

export default function SettingsPage() {
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Settings</h1>
      <EmailPreferences />
    </div>
  )
}
```

## Testing

### Test Locally

1. **Preview the digest** (no email sent):
```bash
# Visit in browser while logged in:
http://localhost:3000/api/send-digest
```

2. **Send test email**:
```bash
curl -X POST http://localhost:3000/api/send-digest \
  -H "Cookie: your-auth-cookie"
```

Or use the "Send Test" button in the Email Preferences UI.

### Test Cron Job

The cron job only works in production (Vercel). To test:

1. **Deploy to Vercel**
2. **Manually trigger** the cron:
```bash
curl https://your-app.vercel.app/api/cron/daily-digest \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

3. **Check logs** in Vercel dashboard

## Customization

### Change Email Time

Edit `vercel.json`:

```json
{
  "path": "/api/cron/daily-digest",
  "schedule": "0 7 * * *"  // 7 AM instead of 8 AM
}
```

Cron format: `minute hour day month dayofweek`

### Customize Email Template

Edit `lib/email/budget-digest-template.ts` to modify:
- Colors
- Layout
- Content
- Styling

### Customize Email From Address

Must be a verified domain in Resend:

```bash
EMAIL_FROM="Your Name <noreply@yourdomain.com>"
```

## Troubleshooting

### Emails not sending

1. **Check Resend API Key**: Make sure it's correctly set in Vercel environment variables
2. **Verify domain**: If using custom domain, ensure it's verified in Resend
3. **Check logs**: Look at Vercel function logs for errors
4. **Test manually**: Use the "Send Test" button in Email Preferences

### Emails going to spam

1. **Verify domain** in Resend (adds SPF/DKIM records)
2. **Use authenticated domain** in `EMAIL_FROM`
3. **Add unsubscribe link** (already included in template)
4. **Warm up** your domain by sending gradually increasing volumes

### Cron job not running

1. **Check Vercel deployment**: Ensure latest code is deployed
2. **Verify cron schedule**: Must be valid cron syntax
3. **Check timezone**: Vercel cron runs in UTC
4. **View cron logs**: Vercel dashboard → Project → Cron Jobs

### No digest data

Users need:
- At least one budget set up for current month
- Budgets that aren't savings goals (is_rollover = false)

## Architecture

```
┌─────────────────┐
│  Vercel Cron    │ Daily at 8 AM UTC
│  Scheduler      │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────┐
│ /api/cron/daily-digest          │
│ - Fetches all users with digest │
│   enabled                        │
│ - Generates digest data          │
│ - Sends via Resend API           │
└─────────────────────────────────┘
         │
         ├─────────► Supabase (fetch budgets, transactions)
         │
         └─────────► Resend API (send emails)
```

## Costs

- **Resend**: Free tier includes 3,000 emails/month, $20/month for 50,000
- **Vercel Cron**: Included in all plans
- **Supabase**: No additional cost (using existing queries)

## Support

If you encounter issues:

1. Check this guide's troubleshooting section
2. Review Vercel function logs
3. Check Resend dashboard for delivery status
4. Verify environment variables are set correctly

## Future Enhancements

Possible additions:
- Weekly digest option
- Customizable digest time per user
- Choose which categories to include
- PDF attachment with detailed report
- Spending alerts (when over budget)
