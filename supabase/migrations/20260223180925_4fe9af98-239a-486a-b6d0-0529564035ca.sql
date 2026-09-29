
-- Add linkter_api_key to profiles (shared across all user's bots)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS linkter_api_key text;
