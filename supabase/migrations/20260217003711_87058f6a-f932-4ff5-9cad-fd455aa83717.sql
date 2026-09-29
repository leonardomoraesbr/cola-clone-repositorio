
-- Add is_downsell column to payment_orders
ALTER TABLE public.payment_orders ADD COLUMN is_downsell boolean NOT NULL DEFAULT false;

-- Add unique constraint to vip_members to prevent duplicates
ALTER TABLE public.vip_members ADD CONSTRAINT vip_members_bot_user_unique UNIQUE (bot_id, telegram_user_id);
