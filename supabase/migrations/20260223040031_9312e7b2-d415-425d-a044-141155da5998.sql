
-- Add tracked_link_id to bot_users to track which link brought each user
ALTER TABLE public.bot_users ADD COLUMN tracked_link_id uuid REFERENCES public.tracked_links(id) ON DELETE SET NULL;

-- Add tracked_link_id to payment_orders to attribute sales to specific links
ALTER TABLE public.payment_orders ADD COLUMN tracked_link_id uuid REFERENCES public.tracked_links(id) ON DELETE SET NULL;

-- Index for fast funnel queries
CREATE INDEX idx_bot_users_tracked_link ON public.bot_users(tracked_link_id) WHERE tracked_link_id IS NOT NULL;
CREATE INDEX idx_payment_orders_tracked_link ON public.payment_orders(tracked_link_id) WHERE tracked_link_id IS NOT NULL;
