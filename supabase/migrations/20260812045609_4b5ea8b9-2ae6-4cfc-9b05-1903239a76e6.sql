ALTER TABLE public.bots
  ADD COLUMN IF NOT EXISTS initial_media_file_id text,
  ADD COLUMN IF NOT EXISTS initial_media_file_key text;