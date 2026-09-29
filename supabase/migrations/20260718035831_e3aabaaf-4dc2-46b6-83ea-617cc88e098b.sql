
-- 1) channel_messages: suporte agendamento semanal (dias da semana + horários)
ALTER TABLE public.channel_messages 
  DROP CONSTRAINT IF EXISTS channel_messages_schedule_type_check;
ALTER TABLE public.channel_messages 
  ADD COLUMN IF NOT EXISTS weekdays integer[],
  ADD COLUMN IF NOT EXISTS times text[];

-- 2) mailing_messages: permitir mídia de áudio + remover check antigo
ALTER TABLE public.mailing_messages 
  DROP CONSTRAINT IF EXISTS mailing_messages_media_type_check;

-- 3) ab_tests: adicionar campos avançados por variante
ALTER TABLE public.ab_tests
  ADD COLUMN IF NOT EXISTS variant_a_plan_id uuid,
  ADD COLUMN IF NOT EXISTS variant_b_plan_id uuid,
  ADD COLUMN IF NOT EXISTS variant_a_bump_plan_id uuid,
  ADD COLUMN IF NOT EXISTS variant_b_bump_plan_id uuid,
  ADD COLUMN IF NOT EXISTS variant_a_price_override numeric,
  ADD COLUMN IF NOT EXISTS variant_b_price_override numeric;

-- 4) Registrar novos crons para mailing e canais agendados
SELECT cron.schedule(
  'process-scheduled-mailings',
  '* * * * *',
  $$
  SELECT net.http_post(
    url:='https://gvtcqjcounhufbsrcnja.supabase.co/functions/v1/process-scheduled-mailings',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd2dGNxamNvdW5odWZic3JjbmphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYxNzMxMzIsImV4cCI6MjA4MTc0OTEzMn0.vEv2WWFSUwlNrmGW5b3sXk3cQAu-upRLYFUljyZHFPA"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);

SELECT cron.schedule(
  'process-scheduled-channels',
  '* * * * *',
  $$
  SELECT net.http_post(
    url:='https://gvtcqjcounhufbsrcnja.supabase.co/functions/v1/process-scheduled-channels',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd2dGNxamNvdW5odWZic3JjbmphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYxNzMxMzIsImV4cCI6MjA4MTc0OTEzMn0.vEv2WWFSUwlNrmGW5b3sXk3cQAu-upRLYFUljyZHFPA"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);
