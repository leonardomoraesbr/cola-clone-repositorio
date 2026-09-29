
ALTER TABLE public.tracked_links
ADD COLUMN cross_bot_id uuid REFERENCES public.bots(id) ON DELETE SET NULL;
