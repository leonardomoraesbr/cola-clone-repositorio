CREATE POLICY "Authenticated can read support settings"
ON public.admin_settings
FOR SELECT
TO authenticated
USING (key IN ('support_instagram', 'support_telegram', 'support_discord'));