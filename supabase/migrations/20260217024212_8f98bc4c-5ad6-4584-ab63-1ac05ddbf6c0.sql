
-- Table for mailing messages
CREATE TABLE public.mailing_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bot_id UUID NOT NULL REFERENCES public.bots(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  media_url TEXT,
  media_type TEXT CHECK (media_type IN ('photo', 'video')),
  buttons JSONB DEFAULT '[]'::jsonb,
  target_audience TEXT NOT NULL DEFAULT 'all',
  schedule_type TEXT NOT NULL DEFAULT 'now' CHECK (schedule_type IN ('now', 'scheduled', 'recurring')),
  scheduled_at TIMESTAMPTZ,
  recurring_interval_minutes INTEGER,
  last_sent_at TIMESTAMPTZ,
  next_send_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  sent_count INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'recurring')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.mailing_messages ENABLE ROW LEVEL SECURITY;

-- Policies - users can manage mailing through their bots
CREATE POLICY "Users can view mailing messages for their bots"
  ON public.mailing_messages FOR SELECT
  USING (bot_id IN (SELECT id FROM public.bots WHERE user_id = auth.uid()));

CREATE POLICY "Users can create mailing messages for their bots"
  ON public.mailing_messages FOR INSERT
  WITH CHECK (bot_id IN (SELECT id FROM public.bots WHERE user_id = auth.uid()));

CREATE POLICY "Users can update mailing messages for their bots"
  ON public.mailing_messages FOR UPDATE
  USING (bot_id IN (SELECT id FROM public.bots WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete mailing messages for their bots"
  ON public.mailing_messages FOR DELETE
  USING (bot_id IN (SELECT id FROM public.bots WHERE user_id = auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_mailing_messages_updated_at
  BEFORE UPDATE ON public.mailing_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
