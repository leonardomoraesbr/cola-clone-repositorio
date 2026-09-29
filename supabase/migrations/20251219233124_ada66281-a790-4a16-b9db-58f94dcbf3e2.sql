-- Create table for payment orders
CREATE TABLE public.payment_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bot_id UUID NOT NULL REFERENCES public.bots(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.subscription_plans(id) ON DELETE CASCADE,
  telegram_user_id BIGINT NOT NULL,
  telegram_username TEXT,
  telegram_first_name TEXT,
  amount NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'expired', 'cancelled')),
  external_id TEXT,
  pix_code TEXT,
  pix_qrcode_url TEXT,
  paid_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.payment_orders ENABLE ROW LEVEL SECURITY;

-- Create policy for bot owners to view their orders
CREATE POLICY "Users can view orders of their bots"
ON public.payment_orders FOR SELECT
USING (EXISTS (
  SELECT 1 FROM bots WHERE bots.id = payment_orders.bot_id AND bots.user_id = auth.uid()
));

-- Create policy for service role to insert/update (edge functions)
CREATE POLICY "Service role can manage orders"
ON public.payment_orders FOR ALL
USING (true)
WITH CHECK (true);

-- Create table for VIP members
CREATE TABLE public.vip_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bot_id UUID NOT NULL REFERENCES public.bots(id) ON DELETE CASCADE,
  telegram_user_id BIGINT NOT NULL,
  telegram_username TEXT,
  telegram_first_name TEXT,
  plan_id UUID REFERENCES public.subscription_plans(id) ON DELETE SET NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(bot_id, telegram_user_id)
);

-- Enable RLS
ALTER TABLE public.vip_members ENABLE ROW LEVEL SECURITY;

-- Create policy for bot owners to view their members
CREATE POLICY "Users can view members of their bots"
ON public.vip_members FOR SELECT
USING (EXISTS (
  SELECT 1 FROM bots WHERE bots.id = vip_members.bot_id AND bots.user_id = auth.uid()
));

-- Create policy for service role to manage members
CREATE POLICY "Service role can manage members"
ON public.vip_members FOR ALL
USING (true)
WITH CHECK (true);

-- Create index for faster lookups
CREATE INDEX idx_payment_orders_external_id ON public.payment_orders(external_id);
CREATE INDEX idx_payment_orders_telegram_user ON public.payment_orders(bot_id, telegram_user_id);
CREATE INDEX idx_vip_members_telegram_user ON public.vip_members(bot_id, telegram_user_id);