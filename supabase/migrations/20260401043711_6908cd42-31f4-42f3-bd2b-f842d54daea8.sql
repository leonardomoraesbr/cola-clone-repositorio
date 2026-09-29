
-- Blacklisted users table
CREATE TABLE public.blacklisted_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bot_id UUID NOT NULL REFERENCES public.bots(id) ON DELETE CASCADE,
  telegram_user_id BIGINT NOT NULL,
  telegram_username TEXT,
  telegram_first_name TEXT,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(bot_id, telegram_user_id)
);

ALTER TABLE public.blacklisted_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage blacklist of their bots" ON public.blacklisted_users
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM bots WHERE bots.id = blacklisted_users.bot_id AND bots.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM bots WHERE bots.id = blacklisted_users.bot_id AND bots.user_id = auth.uid()));

-- A/B Tests table
CREATE TABLE public.ab_tests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bot_id UUID NOT NULL REFERENCES public.bots(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Teste A/B',
  variant_a_message TEXT NOT NULL,
  variant_a_media_url TEXT,
  variant_a_media_type TEXT,
  variant_b_message TEXT NOT NULL,
  variant_b_media_url TEXT,
  variant_b_media_type TEXT,
  is_active BOOLEAN NOT NULL DEFAULT false,
  winner TEXT,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  ended_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.ab_tests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage ab_tests of their bots" ON public.ab_tests
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM bots WHERE bots.id = ab_tests.bot_id AND bots.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM bots WHERE bots.id = ab_tests.bot_id AND bots.user_id = auth.uid()));

-- A/B Test events tracking
CREATE TABLE public.ab_test_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ab_test_id UUID NOT NULL REFERENCES public.ab_tests(id) ON DELETE CASCADE,
  variant TEXT NOT NULL, -- 'a' or 'b'
  telegram_user_id BIGINT NOT NULL,
  event_type TEXT NOT NULL, -- 'start', 'click', 'payment'
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.ab_test_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view ab_test_events of their bots" ON public.ab_test_events
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM ab_tests JOIN bots ON bots.id = ab_tests.bot_id WHERE ab_tests.id = ab_test_events.ab_test_id AND bots.user_id = auth.uid()));

CREATE POLICY "Service role can manage ab_test_events" ON public.ab_test_events
  FOR ALL TO public
  USING (true) WITH CHECK (true);

-- Renewal settings table
CREATE TABLE public.renewal_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bot_id UUID NOT NULL REFERENCES public.bots(id) ON DELETE CASCADE,
  days_before_expiry INTEGER NOT NULL DEFAULT 3,
  message TEXT NOT NULL DEFAULT '🔄 Sua assinatura VIP expira em {dias} dias!\n\nRenove agora para não perder o acesso.',
  discount_percentage INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(bot_id)
);

ALTER TABLE public.renewal_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage renewal_settings of their bots" ON public.renewal_settings
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM bots WHERE bots.id = renewal_settings.bot_id AND bots.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM bots WHERE bots.id = renewal_settings.bot_id AND bots.user_id = auth.uid()));

-- Renewal tracking to avoid duplicate reminders
CREATE TABLE public.renewal_tracking (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vip_member_id UUID NOT NULL REFERENCES public.vip_members(id) ON DELETE CASCADE,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(vip_member_id)
);

ALTER TABLE public.renewal_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage renewal_tracking" ON public.renewal_tracking
  FOR ALL TO public
  USING (true) WITH CHECK (true);
