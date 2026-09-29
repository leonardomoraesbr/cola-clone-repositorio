import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('[DOWNSELL] Starting...');

    // Only get pending orders from the last 24 hours (no point sending downsell for old orders)
    const maxAge = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: pendingOrders, error: ordersError } = await supabase
      .from('payment_orders')
      .select(`*, bots!inner(id, token, username, vip_link, subscription_plans(*))`)
      .eq('status', 'pending')
      .gte('created_at', maxAge);

    if (ordersError) {
      console.error('[DOWNSELL] Error:', ordersError);
      throw ordersError;
    }

    console.log(`[DOWNSELL] ${pendingOrders?.length || 0} recent pending orders`);

    // Deduplicate: only process the LATEST pending order per user per bot
    const userBotMap = new Map<string, any>();
    for (const order of (pendingOrders || [])) {
      const key = `${order.bot_id}_${order.telegram_user_id}`;
      const existing = userBotMap.get(key);
      if (!existing || new Date(order.created_at) > new Date(existing.created_at)) {
        userBotMap.set(key, order);
      }
    }

    const uniqueOrders = Array.from(userBotMap.values());
    console.log(`[DOWNSELL] ${uniqueOrders.length} unique user-bot pairs`);

    let sentCount = 0;
    let skipped = 0;

    for (const order of uniqueOrders) {
      const botToken = order.bots?.token;
      if (!botToken) { skipped++; continue; }

      // Skip if user already paid for this bot (any order)
      const { data: paidOrder } = await supabase
        .from('payment_orders').select('id')
        .eq('telegram_user_id', order.telegram_user_id)
        .eq('bot_id', order.bot_id).eq('status', 'paid')
        .limit(1).maybeSingle();

      if (paidOrder) { skipped++; continue; }

      // Get active downsell messages for this bot (segmento "pending" ou "all_leads")
      const { data: downsellMessages } = await supabase
        .from('downsell_messages').select('*')
        .eq('bot_id', order.bot_id).eq('is_active', true)
        .in('target_audience', ['pending', 'all_leads', 'all'])
        .order('send_time_minutes', { ascending: true });

      if (!downsellMessages?.length) { skipped++; continue; }

      const minutesSinceOrder = Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000);

      // Get last sent downsell time for this order
      const { data: lastSent } = await supabase
        .from('downsell_tracking')
        .select('sent_at, downsell_message_id')
        .eq('order_id', order.id)
        .order('sent_at', { ascending: false });

      const sentMsgIds = new Set((lastSent || []).map(s => s.downsell_message_id));
      const lastSentTime = lastSent?.[0]?.sent_at ? new Date(lastSent[0].sent_at).getTime() : null;

      for (const msg of downsellMessages) {
        // Skip already sent messages
        if (sentMsgIds.has(msg.id)) continue;

        // For the first downsell: wait send_time_minutes after order creation
        // For subsequent downsells: wait send_time_minutes after the LAST downsell was sent
        const referenceTime = lastSentTime || new Date(order.created_at).getTime();
        const minutesSinceReference = Math.floor((Date.now() - referenceTime) / 60000);

        if (minutesSinceReference < msg.send_time_minutes) break;

        // Calculate discounted price
        const originalPrice = Number(order.amount);
        const discountPct = Number(msg.discount_percentage) || 0;
        const discountedPrice = originalPrice * (1 - discountPct / 100);
        const hasDiscount = discountPct > 0;

        let messageText = msg.message
          .replace('{nome}', order.telegram_first_name || 'Amigo')
          .replace('{desconto}', hasDiscount ? `${discountPct}%` : '')
          .replace('{preco_original}', `R$ ${originalPrice.toFixed(2)}`)
          .replace('{preco_desconto}', `R$ ${discountedPrice.toFixed(2)}`);

        const keyboard = {
          inline_keyboard: [[{
            text: hasDiscount
              ? `🔥 Comprar com ${discountPct}% OFF - R$ ${discountedPrice.toFixed(2)}`
              : `🛒 Comprar agora - R$ ${originalPrice.toFixed(2)}`,
            callback_data: `downsell_${order.plan_id}_${discountPct}`
          }]]
        };

        try {
          let response: Response;
          if (msg.media_url && msg.media_type) {
            const methodMap: Record<string, { method: string; field: string; captionSupported: boolean }> = {
              photo: { method: 'sendPhoto', field: 'photo', captionSupported: true },
              video: { method: 'sendVideo', field: 'video', captionSupported: true },
              audio: { method: 'sendAudio', field: 'audio', captionSupported: true },
              voice: { method: 'sendVoice', field: 'voice', captionSupported: true },
            };
            const cfg = methodMap[msg.media_type] || methodMap.photo;
            const body: Record<string, unknown> = {
              chat_id: order.telegram_user_id,
              [cfg.field]: msg.media_url,
              reply_markup: keyboard,
            };
            if (cfg.captionSupported) {
              body.caption = messageText;
              body.parse_mode = 'Markdown';
            }
            response = await fetch(`https://api.telegram.org/bot${botToken}/${cfg.method}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
            });
            // If media send fails, fall back to text so the campaign still ships.
            if (!response.ok) {
              const errBody = await response.text();
              console.error(`[DOWNSELL] media send failed (${response.status}): ${errBody} — falling back to text`);
              response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  chat_id: order.telegram_user_id,
                  text: messageText,
                  parse_mode: 'Markdown',
                  reply_markup: keyboard,
                }),
              });
            }
          } else {
            response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: order.telegram_user_id,
                text: messageText,
                parse_mode: 'Markdown',
                reply_markup: keyboard,
              }),
            });
          }

          if (response.ok) {
            await supabase.from('downsell_tracking').insert({
              order_id: order.id,
              downsell_message_id: msg.id,
            });
            sentCount++;
            console.log(`[DOWNSELL] ✅ Sent msg ${msg.id} to user ${order.telegram_user_id}`);
          } else {
            const errText = await response.text();
            console.error(`[DOWNSELL] ❌ Telegram error: ${errText}`);
          }
        } catch (err) {
          console.error(`[DOWNSELL] ❌ Error:`, err);
        }

        break; // One message per user per run
      }
    }

    const summary = { ok: true, totalPending: pendingOrders?.length || 0, uniqueUsers: uniqueOrders.length, sent: sentCount, skipped };
    console.log(`[DOWNSELL] Done:`, JSON.stringify(summary));

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('[DOWNSELL] Fatal:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
