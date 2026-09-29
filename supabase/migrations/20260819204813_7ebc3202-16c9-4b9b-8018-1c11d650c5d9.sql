CREATE TABLE public.email_broadcast_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_id uuid NOT NULL,
  kind text NOT NULL DEFAULT 'aviso',
  subject text NOT NULL,
  message text,
  recipient_email text NOT NULL,
  status text NOT NULL DEFAULT 'sent',
  error_message text,
  sent_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT SELECT ON public.email_broadcast_log TO authenticated;
GRANT ALL ON public.email_broadcast_log TO service_role;
ALTER TABLE public.email_broadcast_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view email log" ON public.email_broadcast_log
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX idx_email_broadcast_log_batch ON public.email_broadcast_log(batch_id);
CREATE INDEX idx_email_broadcast_log_created ON public.email_broadcast_log(created_at DESC);

CREATE TABLE public.maintenance_banner_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  ended_at timestamp with time zone,
  notified_at timestamp with time zone,
  notified_count integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.maintenance_banner_history TO authenticated;
GRANT ALL ON public.maintenance_banner_history TO service_role;
ALTER TABLE public.maintenance_banner_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage banner history" ON public.maintenance_banner_history
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER update_maintenance_banner_history_updated_at
  BEFORE UPDATE ON public.maintenance_banner_history
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS platform_fee_override numeric;