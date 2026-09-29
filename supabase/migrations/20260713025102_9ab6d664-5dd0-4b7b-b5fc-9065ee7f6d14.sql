ALTER TABLE public.bot_users
ADD COLUMN IF NOT EXISTS customer_name text,
ADD COLUMN IF NOT EXISTS customer_cpf text,
ADD COLUMN IF NOT EXISTS pending_payment_context jsonb;

ALTER TABLE public.payment_orders
ADD COLUMN IF NOT EXISTS customer_name text,
ADD COLUMN IF NOT EXISTS customer_email text,
ADD COLUMN IF NOT EXISTS customer_cpf text;

CREATE INDEX IF NOT EXISTS idx_bot_users_pending_payment
ON public.bot_users (bot_id, telegram_user_id)
WHERE pending_payment_context IS NOT NULL;