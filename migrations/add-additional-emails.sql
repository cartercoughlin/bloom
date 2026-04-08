-- Migration: Add additional_emails column to email_preferences
-- Allows users to receive the daily digest at multiple email addresses

ALTER TABLE public.email_preferences
ADD COLUMN IF NOT EXISTS additional_emails TEXT[] DEFAULT '{}';
