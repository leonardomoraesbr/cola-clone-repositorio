
CREATE TABLE public.price_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bot_id UUID NOT NULL REFERENCES public.bots(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL DEFAULT 'plan',
  target_id UUID,
  plan_id UUID REFERENCES public.subscription_plans(id) ON DELETE CASCADE,
  rule_type TEXT NOT NULL DEFAULT 'month_period',
  rule_config JSONB NOT NULL DEFAULT '{}',
  new_price NUMERIC NOT NULL,
  original_price NUMERIC,
  is_active BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.price_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage price_rules of their bots"
  ON public.price_rules
  FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM bots WHERE bots.id = price_rules.bot_id AND bots.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM bots WHERE bots.id = price_rules.bot_id AND bots.user_id = auth.uid()));
