
-- Order Bump fields on subscription_plans
ALTER TABLE public.subscription_plans
ADD COLUMN order_bump_enabled boolean DEFAULT false,
ADD COLUMN order_bump_name text,
ADD COLUMN order_bump_price numeric;

-- Upsell offers table
CREATE TABLE public.upsell_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id uuid NOT NULL REFERENCES public.bots(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  price numeric NOT NULL,
  media_url text,
  media_type text,
  message text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.upsell_offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view upsell offers of their bots"
ON public.upsell_offers FOR SELECT
USING (EXISTS (SELECT 1 FROM bots WHERE bots.id = upsell_offers.bot_id AND bots.user_id = auth.uid()));

CREATE POLICY "Users can insert upsell offers for their bots"
ON public.upsell_offers FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM bots WHERE bots.id = upsell_offers.bot_id AND bots.user_id = auth.uid()));

CREATE POLICY "Users can update upsell offers of their bots"
ON public.upsell_offers FOR UPDATE
USING (EXISTS (SELECT 1 FROM bots WHERE bots.id = upsell_offers.bot_id AND bots.user_id = auth.uid()));

CREATE POLICY "Users can delete upsell offers of their bots"
ON public.upsell_offers FOR DELETE
USING (EXISTS (SELECT 1 FROM bots WHERE bots.id = upsell_offers.bot_id AND bots.user_id = auth.uid()));

CREATE TRIGGER update_upsell_offers_updated_at
BEFORE UPDATE ON public.upsell_offers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Mailing send logs table
CREATE TABLE public.mailing_send_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mailing_id uuid NOT NULL REFERENCES public.mailing_messages(id) ON DELETE CASCADE,
  bot_id uuid NOT NULL REFERENCES public.bots(id) ON DELETE CASCADE,
  sent_count integer DEFAULT 0,
  failed_count integer DEFAULT 0,
  skipped_count integer DEFAULT 0,
  sent_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.mailing_send_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view mailing logs of their bots"
ON public.mailing_send_logs FOR SELECT
USING (EXISTS (SELECT 1 FROM bots WHERE bots.id = mailing_send_logs.bot_id AND bots.user_id = auth.uid()));

CREATE POLICY "Service role can manage mailing logs"
ON public.mailing_send_logs FOR ALL
USING (true) WITH CHECK (true);
