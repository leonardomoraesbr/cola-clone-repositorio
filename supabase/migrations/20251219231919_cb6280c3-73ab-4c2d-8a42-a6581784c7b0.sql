-- Add media_url column to bots table for initial message media
ALTER TABLE public.bots ADD COLUMN IF NOT EXISTS initial_media_url TEXT;
ALTER TABLE public.bots ADD COLUMN IF NOT EXISTS initial_media_type TEXT CHECK (initial_media_type IN ('photo', 'video', NULL));

-- Create storage bucket for bot media
INSERT INTO storage.buckets (id, name, public)
VALUES ('bot-media', 'bot-media', true)
ON CONFLICT (id) DO NOTHING;

-- Create policy for authenticated users to upload media
CREATE POLICY "Users can upload their own bot media"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'bot-media' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Create policy for public read access
CREATE POLICY "Bot media is publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'bot-media');

-- Create policy for users to delete their own media
CREATE POLICY "Users can delete their own bot media"
ON storage.objects FOR DELETE
USING (bucket_id = 'bot-media' AND auth.uid()::text = (storage.foldername(name))[1]);