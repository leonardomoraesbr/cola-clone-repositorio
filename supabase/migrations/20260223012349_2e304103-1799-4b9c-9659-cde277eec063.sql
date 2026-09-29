
-- Add linkter_api_key column to bots table
ALTER TABLE public.bots ADD COLUMN linkter_api_key text;

-- Create tracked_links table
CREATE TABLE public.tracked_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID NOT NULL REFERENCES public.bots(id) ON DELETE CASCADE,
  linkter_link_id TEXT NOT NULL,
  short_url TEXT NOT NULL,
  destination_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tracked_links ENABLE ROW LEVEL SECURITY;

-- RLS policies - users can only access links of their own bots
CREATE POLICY "Users can view tracked links of their bots"
ON public.tracked_links FOR SELECT
USING (EXISTS (SELECT 1 FROM bots WHERE bots.id = tracked_links.bot_id AND bots.user_id = auth.uid()));

CREATE POLICY "Users can insert tracked links for their bots"
ON public.tracked_links FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM bots WHERE bots.id = tracked_links.bot_id AND bots.user_id = auth.uid()));

CREATE POLICY "Users can delete tracked links of their bots"
ON public.tracked_links FOR DELETE
USING (EXISTS (SELECT 1 FROM bots WHERE bots.id = tracked_links.bot_id AND bots.user_id = auth.uid()));

-- Service role can manage all tracked links
CREATE POLICY "Service role can manage tracked_links"
ON public.tracked_links FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
