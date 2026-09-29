CREATE TABLE public.telegram_payment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id uuid NOT NULL REFERENCES public.bots(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.payment_orders(id) ON DELETE SET NULL,
  plan_id uuid,
  telegram_user_id bigint NOT NULL,
  event_type text NOT NULL,
  source_type text,
  external_status integer,
  success boolean,
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.telegram_payment_events TO authenticated;
GRANT INSERT, SELECT, UPDATE, DELETE ON public.telegram_payment_events TO service_role;

ALTER TABLE public.telegram_payment_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_telegram_payment_events_bot_created ON public.telegram_payment_events (bot_id, created_at DESC);
CREATE INDEX idx_telegram_payment_events_order_created ON public.telegram_payment_events (order_id, created_at DESC);
CREATE INDEX idx_telegram_payment_events_user_created ON public.telegram_payment_events (telegram_user_id, created_at DESC);
CREATE INDEX idx_telegram_payment_events_type_created ON public.telegram_payment_events (event_type, created_at DESC);

CREATE POLICY "Bot owners can view their payment events"
ON public.telegram_payment_events
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.bots b
    WHERE b.id = telegram_payment_events.bot_id
      AND b.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Service role can manage payment events"
ON public.telegram_payment_events
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);