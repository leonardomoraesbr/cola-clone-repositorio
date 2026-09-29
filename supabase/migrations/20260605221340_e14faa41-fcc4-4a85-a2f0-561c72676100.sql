
-- Restrict bot-media SELECT (listing) to owner; public URLs still serve via public bucket flag
DROP POLICY IF EXISTS "Bot media is publicly accessible" ON storage.objects;
CREATE POLICY "Users can list their own bot media"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'bot-media'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

-- Add UPDATE policy for bot-media
CREATE POLICY "Users can update their own bot media"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'bot-media'
  AND (auth.uid())::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'bot-media'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

-- Allow users to insert their own demo_settings row
CREATE POLICY "Users can insert own demo_settings"
ON public.demo_settings FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Revoke public EXECUTE on internal trigger functions (not meant to be RPC-callable)
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
-- has_role remains executable by authenticated (used in RLS policies and app code)
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
