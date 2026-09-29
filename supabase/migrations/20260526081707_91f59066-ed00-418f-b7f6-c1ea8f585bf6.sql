ALTER TABLE public.demo_settings
  ADD COLUMN IF NOT EXISTS revantpay_demo_key text,
  ADD COLUMN IF NOT EXISTS revantpay_demo_key_name text,
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz;