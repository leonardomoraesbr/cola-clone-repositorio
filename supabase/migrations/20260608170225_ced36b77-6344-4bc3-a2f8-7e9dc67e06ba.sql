
-- Add sort_order to enable manual reordering of subscription plans
ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

-- Backfill sort_order based on created_at so existing plans keep their current visible order
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY bot_id ORDER BY created_at ASC) AS rn
  FROM public.subscription_plans
)
UPDATE public.subscription_plans p
SET sort_order = ranked.rn
FROM ranked
WHERE p.id = ranked.id;

CREATE INDEX IF NOT EXISTS subscription_plans_bot_sort_idx
  ON public.subscription_plans (bot_id, sort_order);

-- Full customization fields for the order bump offer
ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS order_bump_title text,
  ADD COLUMN IF NOT EXISTS order_bump_yes_button_text text,
  ADD COLUMN IF NOT EXISTS order_bump_no_button_text text,
  ADD COLUMN IF NOT EXISTS order_bump_button_price_mode text NOT NULL DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS order_bump_button_price_custom text;

-- Allowed values: 'auto' (show real price), 'hidden' (no price), 'custom' (use custom text)
ALTER TABLE public.subscription_plans
  DROP CONSTRAINT IF EXISTS subscription_plans_orderbump_price_mode_chk;
ALTER TABLE public.subscription_plans
  ADD CONSTRAINT subscription_plans_orderbump_price_mode_chk
  CHECK (order_bump_button_price_mode IN ('auto','hidden','custom'));
