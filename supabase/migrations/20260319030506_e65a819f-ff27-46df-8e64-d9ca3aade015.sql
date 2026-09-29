
-- Create demo_settings table
CREATE TABLE public.demo_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT false,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.demo_settings ENABLE ROW LEVEL SECURITY;

-- Users can view their own demo settings
CREATE POLICY "Users can view own demo_settings"
ON public.demo_settings FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Users can update their own demo settings config
CREATE POLICY "Users can update own demo_settings"
ON public.demo_settings FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- Admins can do everything
CREATE POLICY "Admins can manage all demo_settings"
ON public.demo_settings FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Trigger to update updated_at
CREATE TRIGGER update_demo_settings_updated_at
  BEFORE UPDATE ON public.demo_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
