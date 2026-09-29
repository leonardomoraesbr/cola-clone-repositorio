CREATE TABLE public.custom_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  slug_type TEXT NOT NULL DEFAULT 'random',
  domain TEXT NOT NULL DEFAULT 'riotvips.com',
  destinations JSONB NOT NULL DEFAULT '[]'::jsonb,
  cloaker_mode TEXT NOT NULL DEFAULT 'off',
  redirect_page BOOLEAN NOT NULL DEFAULT false,
  redirect_page_title TEXT,
  redirect_page_text TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  clicks INTEGER NOT NULL DEFAULT 0,
  last_click_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.custom_links TO authenticated;
GRANT ALL ON public.custom_links TO service_role;
ALTER TABLE public.custom_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own custom links"
ON public.custom_links FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.custom_link_clicks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  link_id UUID NOT NULL REFERENCES public.custom_links(id) ON DELETE CASCADE,
  destination TEXT,
  user_agent TEXT,
  referer TEXT,
  country TEXT,
  blocked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.custom_link_clicks TO authenticated;
GRANT ALL ON public.custom_link_clicks TO service_role;
ALTER TABLE public.custom_link_clicks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view clicks of their own links"
ON public.custom_link_clicks FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.custom_links cl WHERE cl.id = link_id AND cl.user_id = auth.uid()));

CREATE INDEX idx_custom_links_user ON public.custom_links(user_id);
CREATE INDEX idx_custom_link_clicks_link ON public.custom_link_clicks(link_id, created_at DESC);

CREATE TRIGGER update_custom_links_updated_at
BEFORE UPDATE ON public.custom_links
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();