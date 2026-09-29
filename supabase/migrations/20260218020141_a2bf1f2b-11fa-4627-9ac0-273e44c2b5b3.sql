
-- Table to track all bot users (solves mailing targeting and /start-only users)
CREATE TABLE public.bot_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bot_id UUID NOT NULL REFERENCES public.bots(id) ON DELETE CASCADE,
  telegram_user_id BIGINT NOT NULL,
  telegram_username TEXT,
  telegram_first_name TEXT,
  has_clicked_button BOOLEAN NOT NULL DEFAULT false,
  last_interaction_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(bot_id, telegram_user_id)
);

ALTER TABLE public.bot_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage bot_users" ON public.bot_users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Users can view bot_users of their bots" ON public.bot_users FOR SELECT USING (
  EXISTS (SELECT 1 FROM bots WHERE bots.id = bot_users.bot_id AND bots.user_id = auth.uid())
);

-- Table to track downsell sends (prevents duplicates via unique constraint)
CREATE TABLE public.downsell_tracking (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.payment_orders(id) ON DELETE CASCADE,
  downsell_message_id UUID NOT NULL REFERENCES public.downsell_messages(id) ON DELETE CASCADE,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(order_id, downsell_message_id)
);

ALTER TABLE public.downsell_tracking ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role can manage downsell_tracking" ON public.downsell_tracking FOR ALL USING (true) WITH CHECK (true);

-- Table for channel/group scheduled messages
CREATE TABLE public.channel_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bot_id UUID NOT NULL REFERENCES public.bots(id) ON DELETE CASCADE,
  channel_id TEXT NOT NULL,
  channel_name TEXT,
  message TEXT NOT NULL,
  media_url TEXT,
  media_type TEXT,
  buttons JSONB DEFAULT '[]'::jsonb,
  schedule_type TEXT NOT NULL DEFAULT 'now',
  scheduled_at TIMESTAMP WITH TIME ZONE,
  recurring_interval_minutes INTEGER,
  next_send_at TIMESTAMP WITH TIME ZONE,
  last_sent_at TIMESTAMP WITH TIME ZONE,
  sent_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.channel_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage channel_messages of their bots" ON public.channel_messages FOR ALL USING (
  EXISTS (SELECT 1 FROM bots WHERE bots.id = channel_messages.bot_id AND bots.user_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM bots WHERE bots.id = channel_messages.bot_id AND bots.user_id = auth.uid())
);

-- Add welcome_card fields to bots table
ALTER TABLE public.bots ADD COLUMN IF NOT EXISTS welcome_card_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.bots ADD COLUMN IF NOT EXISTS welcome_card_text TEXT;
