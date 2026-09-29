CREATE OR REPLACE VIEW public.admin_profile_flags
WITH (security_invoker = true) AS
SELECT
  p.id,
  p.email,
  p.full_name,
  p.created_at,
  p.updated_at,
  (p.revantpay_api_key IS NOT NULL AND length(btrim(p.revantpay_api_key)) > 0) AS has_revantpay_key,
  p.revantpay_key_status,
  p.revantpay_key_checked_at
FROM public.profiles p;

GRANT SELECT ON public.admin_profile_flags TO authenticated;
GRANT SELECT ON public.admin_profile_flags TO service_role;