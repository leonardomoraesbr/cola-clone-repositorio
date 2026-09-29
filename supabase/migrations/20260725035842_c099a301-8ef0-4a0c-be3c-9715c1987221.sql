ALTER TABLE public.downsell_messages
  ADD COLUMN IF NOT EXISTS media_url text,
  ADD COLUMN IF NOT EXISTS media_type text;

ALTER TABLE public.downsell_messages
  DROP CONSTRAINT IF EXISTS downsell_messages_discount_percentage_check;

ALTER TABLE public.downsell_messages
  ADD CONSTRAINT downsell_messages_discount_percentage_check
  CHECK (discount_percentage >= 0 AND discount_percentage <= 100);