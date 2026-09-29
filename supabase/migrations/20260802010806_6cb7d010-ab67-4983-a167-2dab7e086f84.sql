CREATE TABLE public.notification_webhooks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  url TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_triggered_at TIMESTAMPTZ,
  trigger_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, event_type)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_webhooks TO authenticated;
GRANT ALL ON public.notification_webhooks TO service_role;

ALTER TABLE public.notification_webhooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own notification webhooks"
ON public.notification_webhooks FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_notification_webhooks_updated_at
BEFORE UPDATE ON public.notification_webhooks
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();