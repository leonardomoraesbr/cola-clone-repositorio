-- Add columns to track platform fee charge status
ALTER TABLE public.payment_orders 
ADD COLUMN IF NOT EXISTS platform_fee_charge_id text,
ADD COLUMN IF NOT EXISTS platform_fee_status text DEFAULT 'pending';