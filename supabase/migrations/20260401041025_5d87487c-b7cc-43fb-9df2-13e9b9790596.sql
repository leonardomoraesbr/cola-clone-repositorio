
-- 1. Scheduled Price Changes table
CREATE TABLE public.scheduled_price_changes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id UUID NOT NULL REFERENCES public.subscription_plans(id) ON DELETE CASCADE,
  bot_id UUID NOT NULL REFERENCES public.bots(id) ON DELETE CASCADE,
  new_price NUMERIC NOT NULL,
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  applied BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.scheduled_price_changes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage scheduled prices of their bots"
  ON public.scheduled_price_changes FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM bots WHERE bots.id = scheduled_price_changes.bot_id AND bots.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM bots WHERE bots.id = scheduled_price_changes.bot_id AND bots.user_id = auth.uid()));

-- 2. Add health columns to bots table
ALTER TABLE public.bots ADD COLUMN IF NOT EXISTS health_status TEXT DEFAULT 'unknown';
ALTER TABLE public.bots ADD COLUMN IF NOT EXISTS last_health_check TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.bots ADD COLUMN IF NOT EXISTS notification_channel_id TEXT;

-- 3. Contingency Groups
CREATE TABLE public.contingency_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  link_slug TEXT NOT NULL UNIQUE,
  strategy TEXT NOT NULL DEFAULT 'round-robin',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.contingency_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own contingency groups"
  ON public.contingency_groups FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.contingency_group_bots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.contingency_groups(id) ON DELETE CASCADE,
  bot_id UUID NOT NULL REFERENCES public.bots(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(group_id, bot_id)
);

ALTER TABLE public.contingency_group_bots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage contingency group bots"
  ON public.contingency_group_bots FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM contingency_groups WHERE contingency_groups.id = contingency_group_bots.group_id AND contingency_groups.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM contingency_groups WHERE contingency_groups.id = contingency_group_bots.group_id AND contingency_groups.user_id = auth.uid()));
