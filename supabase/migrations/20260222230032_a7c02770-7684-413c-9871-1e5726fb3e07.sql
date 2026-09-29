
-- Add order bump media fields to subscription_plans
ALTER TABLE public.subscription_plans 
ADD COLUMN IF NOT EXISTS order_bump_media_url text,
ADD COLUMN IF NOT EXISTS order_bump_media_type text;
