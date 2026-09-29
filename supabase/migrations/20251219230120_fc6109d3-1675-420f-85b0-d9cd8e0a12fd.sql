-- Create profiles table for user data
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = id);

-- Trigger to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (new.id, new.email, new.raw_user_meta_data ->> 'full_name');
  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create bots table
CREATE TABLE public.bots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  username TEXT NOT NULL,
  token TEXT NOT NULL,
  initial_message TEXT,
  vip_id TEXT,
  registro_id TEXT,
  vip_link TEXT,
  support_contact TEXT,
  anti_clone BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.bots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own bots"
ON public.bots FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own bots"
ON public.bots FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own bots"
ON public.bots FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own bots"
ON public.bots FOR DELETE
USING (auth.uid() = user_id);

-- Create subscription plans table
CREATE TABLE public.subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID NOT NULL REFERENCES public.bots(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  duration TEXT NOT NULL,
  duration_days INTEGER,
  price DECIMAL(10,2) NOT NULL,
  bonus TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view plans of their bots"
ON public.subscription_plans FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.bots
    WHERE bots.id = subscription_plans.bot_id
    AND bots.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert plans for their bots"
ON public.subscription_plans FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.bots
    WHERE bots.id = subscription_plans.bot_id
    AND bots.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update plans of their bots"
ON public.subscription_plans FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.bots
    WHERE bots.id = subscription_plans.bot_id
    AND bots.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete plans of their bots"
ON public.subscription_plans FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.bots
    WHERE bots.id = subscription_plans.bot_id
    AND bots.user_id = auth.uid()
  )
);

-- Create downsell messages table
CREATE TABLE public.downsell_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID NOT NULL REFERENCES public.bots(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  send_time_minutes INTEGER NOT NULL DEFAULT 5,
  discount_percentage INTEGER NOT NULL DEFAULT 10,
  target_audience TEXT DEFAULT 'all',
  is_active BOOLEAN DEFAULT true,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.downsell_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view downsell of their bots"
ON public.downsell_messages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.bots
    WHERE bots.id = downsell_messages.bot_id
    AND bots.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert downsell for their bots"
ON public.downsell_messages FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.bots
    WHERE bots.id = downsell_messages.bot_id
    AND bots.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update downsell of their bots"
ON public.downsell_messages FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.bots
    WHERE bots.id = downsell_messages.bot_id
    AND bots.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete downsell of their bots"
ON public.downsell_messages FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.bots
    WHERE bots.id = downsell_messages.bot_id
    AND bots.user_id = auth.uid()
  )
);

-- Create payment gateways table
CREATE TABLE public.payment_gateways (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID NOT NULL REFERENCES public.bots(id) ON DELETE CASCADE,
  gateway_name TEXT NOT NULL,
  token TEXT,
  is_connected BOOLEAN DEFAULT false,
  methods TEXT[] DEFAULT ARRAY['pix'],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_gateways ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view gateways of their bots"
ON public.payment_gateways FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.bots
    WHERE bots.id = payment_gateways.bot_id
    AND bots.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert gateways for their bots"
ON public.payment_gateways FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.bots
    WHERE bots.id = payment_gateways.bot_id
    AND bots.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update gateways of their bots"
ON public.payment_gateways FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.bots
    WHERE bots.id = payment_gateways.bot_id
    AND bots.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete gateways of their bots"
ON public.payment_gateways FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.bots
    WHERE bots.id = payment_gateways.bot_id
    AND bots.user_id = auth.uid()
  )
);

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_bots_updated_at
  BEFORE UPDATE ON public.bots
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();