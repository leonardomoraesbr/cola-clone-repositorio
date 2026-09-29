
-- Add auto-approval fields to bots table
ALTER TABLE public.bots ADD COLUMN IF NOT EXISTS auto_approve_enabled boolean DEFAULT false;
ALTER TABLE public.bots ADD COLUMN IF NOT EXISTS auto_approve_channel_id text;
ALTER TABLE public.bots ADD COLUMN IF NOT EXISTS auto_approve_welcome_message text;
