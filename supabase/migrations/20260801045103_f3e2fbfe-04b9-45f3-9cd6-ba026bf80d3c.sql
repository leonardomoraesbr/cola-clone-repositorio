CREATE INDEX IF NOT EXISTS idx_payment_orders_bot_created ON public.payment_orders (bot_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_orders_status_created ON public.payment_orders (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_orders_paid_at ON public.payment_orders (paid_at DESC) WHERE status = 'paid';
CREATE INDEX IF NOT EXISTS idx_vip_members_bot_active ON public.vip_members (bot_id, is_active, expires_at);
CREATE INDEX IF NOT EXISTS idx_bot_users_bot_created ON public.bot_users (bot_id, created_at DESC);