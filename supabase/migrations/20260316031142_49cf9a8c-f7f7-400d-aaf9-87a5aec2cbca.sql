ALTER TABLE public.tracked_links
ADD COLUMN custom_redirect_url text,
ADD COLUMN funnel_type text DEFAULT 'direct';