
CREATE TABLE IF NOT EXISTS public.balance_mirror (
  revant_user_id uuid PRIMARY KEY,
  riot_user_id uuid,
  available numeric DEFAULT 0,
  pending numeric DEFAULT 0,
  blocked numeric DEFAULT 0,
  total numeric DEFAULT 0,
  last_update timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.balance_mirror TO authenticated;
GRANT ALL ON public.balance_mirror TO service_role;
ALTER TABLE public.balance_mirror ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read balance_mirror" ON public.balance_mirror FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Owner reads own balance" ON public.balance_mirror FOR SELECT TO authenticated USING (auth.uid() = riot_user_id);

CREATE TABLE IF NOT EXISTS public.sales_mirror (
  revant_id uuid PRIMARY KEY,
  revant_user_id uuid NOT NULL,
  riot_user_id uuid,
  customer_name text,
  customer_email text,
  amount numeric,
  method text,
  status text,
  created_at timestamptz
);
CREATE INDEX IF NOT EXISTS sales_mirror_user_created_idx ON public.sales_mirror (revant_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS sales_mirror_riot_user_idx ON public.sales_mirror (riot_user_id);
GRANT SELECT ON public.sales_mirror TO authenticated;
GRANT ALL ON public.sales_mirror TO service_role;
ALTER TABLE public.sales_mirror ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read sales_mirror" ON public.sales_mirror FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Owner reads own sales" ON public.sales_mirror FOR SELECT TO authenticated USING (auth.uid() = riot_user_id);

CREATE TABLE IF NOT EXISTS public.transactions_mirror (
  revant_id uuid PRIMARY KEY,
  revant_user_id uuid NOT NULL,
  riot_user_id uuid,
  customer_name text,
  customer_email text,
  amount numeric,
  method text,
  status text,
  created_at timestamptz
);
CREATE INDEX IF NOT EXISTS transactions_mirror_user_created_idx ON public.transactions_mirror (revant_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS transactions_mirror_riot_user_idx ON public.transactions_mirror (riot_user_id);
GRANT SELECT ON public.transactions_mirror TO authenticated;
GRANT ALL ON public.transactions_mirror TO service_role;
ALTER TABLE public.transactions_mirror ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read transactions_mirror" ON public.transactions_mirror FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Owner reads own transactions" ON public.transactions_mirror FOR SELECT TO authenticated USING (auth.uid() = riot_user_id);

CREATE TABLE IF NOT EXISTS public.revant_webhook_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  timestamp timestamptz,
  event text,
  payload jsonb,
  received_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, timestamp, event)
);
GRANT SELECT ON public.revant_webhook_log TO authenticated;
GRANT ALL ON public.revant_webhook_log TO service_role;
ALTER TABLE public.revant_webhook_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read revant_webhook_log" ON public.revant_webhook_log FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
