
-- 1. Remarketing messages table
CREATE TABLE public.remarketing_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bot_id UUID NOT NULL REFERENCES public.bots(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  send_time_minutes INTEGER NOT NULL DEFAULT 30,
  order_index INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.remarketing_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage remarketing of their bots"
  ON public.remarketing_messages FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM bots WHERE bots.id = remarketing_messages.bot_id AND bots.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM bots WHERE bots.id = remarketing_messages.bot_id AND bots.user_id = auth.uid()));

-- 2. Remarketing tracking table (to avoid sending duplicates)
CREATE TABLE public.remarketing_tracking (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.payment_orders(id) ON DELETE CASCADE,
  remarketing_message_id UUID NOT NULL REFERENCES public.remarketing_messages(id) ON DELETE CASCADE,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(order_id, remarketing_message_id)
);

ALTER TABLE public.remarketing_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage remarketing_tracking"
  ON public.remarketing_tracking FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- 3. Cloaker fields on tracked_links
ALTER TABLE public.tracked_links ADD COLUMN IF NOT EXISTS cloaker_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.tracked_links ADD COLUMN IF NOT EXISTS cloaker_token TEXT;
ALTER TABLE public.tracked_links ADD COLUMN IF NOT EXISTS safe_redirect_url TEXT DEFAULT 'https://google.com';

-- 4. Expand scheduled_price_changes for upsell/order_bump
ALTER TABLE public.scheduled_price_changes ADD COLUMN IF NOT EXISTS target_type TEXT NOT NULL DEFAULT 'plan';
ALTER TABLE public.scheduled_price_changes ADD COLUMN IF NOT EXISTS target_id UUID;
-- Make plan_id nullable for non-plan targets
ALTER TABLE public.scheduled_price_changes ALTER COLUMN plan_id DROP NOT NULL;
