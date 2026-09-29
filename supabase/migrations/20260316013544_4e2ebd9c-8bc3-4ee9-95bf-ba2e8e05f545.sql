ALTER TABLE public.payment_orders 
ADD COLUMN IF NOT EXISTS source_type text DEFAULT 'direct',
ADD COLUMN IF NOT EXISTS original_bot_id uuid,
ADD COLUMN IF NOT EXISTS original_tracked_link_id uuid;