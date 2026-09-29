
-- Fix: payment_orders - drop public ALL, recreate for service_role
DROP POLICY IF EXISTS "Service role can manage orders" ON public.payment_orders;
CREATE POLICY "Service role can manage orders"
ON public.payment_orders FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Fix: vip_members
DROP POLICY IF EXISTS "Service role can manage members" ON public.vip_members;
CREATE POLICY "Service role can manage members"
ON public.vip_members FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Fix: bot_users
DROP POLICY IF EXISTS "Service role can manage bot_users" ON public.bot_users;
CREATE POLICY "Service role can manage bot_users"
ON public.bot_users FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Fix: broadcast_sent_messages
DROP POLICY IF EXISTS "Service role can manage broadcast_sent_messages" ON public.broadcast_sent_messages;
CREATE POLICY "Service role can manage broadcast_sent_messages"
ON public.broadcast_sent_messages FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Fix: downsell_tracking
DROP POLICY IF EXISTS "Service role can manage downsell_tracking" ON public.downsell_tracking;
CREATE POLICY "Service role can manage downsell_tracking"
ON public.downsell_tracking FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Fix: remarketing_tracking
DROP POLICY IF EXISTS "Service role can manage remarketing_tracking" ON public.remarketing_tracking;
CREATE POLICY "Service role can manage remarketing_tracking"
ON public.remarketing_tracking FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Fix: renewal_tracking
DROP POLICY IF EXISTS "Service role can manage renewal_tracking" ON public.renewal_tracking;
CREATE POLICY "Service role can manage renewal_tracking"
ON public.renewal_tracking FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Fix: mailing_send_logs
DROP POLICY IF EXISTS "Service role can manage mailing logs" ON public.mailing_send_logs;
CREATE POLICY "Service role can manage mailing logs"
ON public.mailing_send_logs FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Fix: ab_test_events
DROP POLICY IF EXISTS "Service role can manage ab_test_events" ON public.ab_test_events;
CREATE POLICY "Service role can manage ab_test_events"
ON public.ab_test_events FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
