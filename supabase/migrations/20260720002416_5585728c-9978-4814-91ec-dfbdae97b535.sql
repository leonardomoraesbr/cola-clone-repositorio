CREATE TABLE IF NOT EXISTS public.sales_widget_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  token_hash text NOT NULL UNIQUE,
  token_prefix text NOT NULL,
  label text NOT NULL DEFAULT 'Widget principal',
  is_active boolean NOT NULL DEFAULT true,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_widget_tokens TO authenticated;
GRANT ALL ON public.sales_widget_tokens TO service_role;

ALTER TABLE public.sales_widget_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own widget tokens" ON public.sales_widget_tokens;
CREATE POLICY "Users can manage own widget tokens"
ON public.sales_widget_tokens
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_sales_widget_tokens_updated_at
BEFORE UPDATE ON public.sales_widget_tokens
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();