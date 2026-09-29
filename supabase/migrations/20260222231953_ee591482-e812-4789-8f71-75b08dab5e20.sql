
-- Add platform_fee column to payment_orders
ALTER TABLE public.payment_orders ADD COLUMN IF NOT EXISTS platform_fee numeric NOT NULL DEFAULT 0;

-- Insert default platform fee setting
INSERT INTO public.admin_settings (key, value) VALUES ('platform_fee', '0.60')
ON CONFLICT (key) DO NOTHING;
