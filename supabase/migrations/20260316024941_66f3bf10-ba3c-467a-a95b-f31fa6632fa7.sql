
ALTER TABLE public.bots
ADD COLUMN cross_bot_upsell_bot_id uuid REFERENCES public.bots(id) ON DELETE SET NULL,
ADD COLUMN cross_bot_upsell_message text;
