
-- Allow authenticated users to read maintenance_banner setting too
DROP POLICY IF EXISTS "Authenticated can read support settings" ON public.admin_settings;
CREATE POLICY "Authenticated can read public settings"
ON public.admin_settings
FOR SELECT
TO authenticated
USING (key = ANY (ARRAY['support_instagram','support_telegram','support_discord','maintenance_banner']));

-- Seed default maintenance banner (disabled by default)
INSERT INTO public.admin_settings (key, value)
VALUES ('maintenance_banner', '{"enabled":false,"message":"Estamos com manutenção no PIX. Assim que voltar, você será notificado no e-mail!"}')
ON CONFLICT (key) DO NOTHING;
