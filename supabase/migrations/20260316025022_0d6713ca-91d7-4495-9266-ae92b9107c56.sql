
ALTER TABLE public.bot_users
ADD COLUMN cross_upsell_from_order_id uuid REFERENCES public.payment_orders(id) ON DELETE SET NULL;
