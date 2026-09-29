
-- Registry bot + support toggles on admin_settings
ALTER TABLE public.admin_settings
  ADD COLUMN IF NOT EXISTS registry_bot_token text,
  ADD COLUMN IF NOT EXISTS registry_chat_id text,
  ADD COLUMN IF NOT EXISTS support_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS support_links jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Widget token per user
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS widget_token text UNIQUE;

-- Platform fees ledger (accumulates <R$5 fees until batch charge)
CREATE TABLE IF NOT EXISTS public.platform_fees_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bot_id uuid REFERENCES public.bots(id) ON DELETE SET NULL,
  order_id uuid REFERENCES public.payment_orders(id) ON DELETE SET NULL,
  fee_amount numeric(10,2) NOT NULL,
  status text NOT NULL DEFAULT 'pending', -- pending | charged | failed
  batch_charge_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  charged_at timestamptz
);
GRANT SELECT ON public.platform_fees_ledger TO authenticated;
GRANT ALL ON public.platform_fees_ledger TO service_role;
ALTER TABLE public.platform_fees_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own fee ledger"
  ON public.platform_fees_ledger FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_platform_fees_user_status
  ON public.platform_fees_ledger(user_id, status);
