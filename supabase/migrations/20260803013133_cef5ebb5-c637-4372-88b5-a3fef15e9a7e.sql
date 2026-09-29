ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS revantpay_key_status text,
  ADD COLUMN IF NOT EXISTS revantpay_key_error text,
  ADD COLUMN IF NOT EXISTS revantpay_key_checked_at timestamptz;