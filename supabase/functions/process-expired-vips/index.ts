import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const nowIso = new Date().toISOString();
    const { data: expired, error } = await supabase
      .from('vip_members')
      .select('id, bot_id, telegram_user_id, expires_at, bots!inner(token, vip_id)')
      .eq('is_active', true)
      .lt('expires_at', nowIso)
      .limit(500);

    if (error) throw error;

    let deactivated = 0;
    let kicked = 0;

    for (const member of expired || []) {
      const { error: updErr } = await supabase
        .from('vip_members')
        .update({ is_active: false })
        .eq('id', member.id);
      if (updErr) {
        console.error('[EXPIRED-VIPS] update failed', member.id, updErr.message);
        continue;
      }
      deactivated++;

      // Best effort: remove the lead from the VIP channel/group so access really ends.
      const token = (member as any).bots?.token;
      const chatId = (member as any).bots?.vip_id;
      if (token && chatId) {
        try {
          const res = await fetch(`https://api.telegram.org/bot${token}/banChatMember`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              user_id: member.telegram_user_id,
              until_date: Math.floor(Date.now() / 1000) + 60, // ban 60s == kick, lead can rejoin after re-purchase
            }),
          });
          if (res.ok) kicked++;
          else console.error('[EXPIRED-VIPS] kick failed', member.telegram_user_id, await res.text());
        } catch (err) {
          console.error('[EXPIRED-VIPS] kick error', err);
        }
      }
    }

    console.log(`[EXPIRED-VIPS] deactivated=${deactivated} kicked=${kicked}`);

    // Housekeeping: PIX charges that were never paid stay "pending" forever and skew
    // conversion metrics. Only expire well past the due date so late payments still
    // reconcile (the webhook marks paid regardless of the current status).
    const staleCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: staleOrders, error: staleErr } = await supabase
      .from('payment_orders')
      .update({ status: 'expired' })
      .eq('status', 'pending')
      .lt('expires_at', staleCutoff)
      .select('id');
    if (staleErr) console.error('[EXPIRED-VIPS] expire orders failed', staleErr.message);
    const expiredOrders = staleOrders?.length || 0;
    console.log(`[EXPIRED-VIPS] expiredOrders=${expiredOrders}`);

    return new Response(JSON.stringify({ ok: true, deactivated, kicked, expiredOrders }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[EXPIRED-VIPS] error', err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
