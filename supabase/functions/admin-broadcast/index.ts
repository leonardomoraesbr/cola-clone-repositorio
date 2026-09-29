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

    // Verify admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: corsHeaders });
    }

    const { action, message, link, link_text, broadcast_id: deleteBroadcastId, target_audience } = await req.json();

    // === DELETE ACTION ===
    if (action === 'delete') {
      if (!deleteBroadcastId) {
        return new Response(JSON.stringify({ error: 'broadcast_id required' }), { status: 400, headers: corsHeaders });
      }

      // Get all sent messages for this broadcast
      const { data: sentMsgs } = await supabase
        .from('broadcast_sent_messages')
        .select('bot_id, chat_id, message_id')
        .eq('broadcast_id', deleteBroadcastId);

      if (!sentMsgs || sentMsgs.length === 0) {
        return new Response(JSON.stringify({ deleted: 0, error: 'No messages found' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Group by bot_id to get tokens
      const botIds = [...new Set(sentMsgs.map(m => m.bot_id))];
      const { data: bots } = await supabase.from('bots').select('id, token').in('id', botIds);
      const botTokenMap: Record<string, string> = {};
      bots?.forEach(b => { botTokenMap[b.id] = b.token; });

      let deleted = 0;
      let failed = 0;

      for (const msg of sentMsgs) {
        try {
          const botToken = botTokenMap[msg.bot_id];
          if (!botToken) { failed++; continue; }

          const res = await fetch(`https://api.telegram.org/bot${botToken}/deleteMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: msg.chat_id, message_id: msg.message_id }),
          });
          const result = await res.json();
          if (result.ok) deleted++;
          else failed++;

          await new Promise(r => setTimeout(r, 35));
        } catch {
          failed++;
        }
      }

      // Clean up tracking records
      await supabase.from('broadcast_sent_messages').delete().eq('broadcast_id', deleteBroadcastId);

      return new Response(JSON.stringify({ deleted, failed }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // === SEND ACTION ===
    if (!message) {
      return new Response(JSON.stringify({ error: 'Message is required' }), { status: 400, headers: corsHeaders });
    }

    const broadcastId = `broadcast_${Date.now()}`;

    // Get all bots with tokens
    const { data: bots } = await supabase.from('bots').select('id, token, vip_id');
    if (!bots || bots.length === 0) {
      return new Response(JSON.stringify({ sent: 0, failed: 0, skipped: 0, broadcast_id: broadcastId }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get all paid user IDs (buyers)
    const { data: paidOrders } = await supabase
      .from('payment_orders')
      .select('telegram_user_id')
      .eq('status', 'paid');
    const buyerIds = new Set((paidOrders || []).map(o => o.telegram_user_id));

    let sent = 0;
    let failed = 0;
    let skipped = 0;

    // target_audience: 'all' | 'buyers' | 'non_buyers'
    const audience = target_audience || 'all';

    for (const bot of bots) {
      // Get users for this bot
      const { data: users } = await supabase
        .from('bot_users')
        .select('telegram_user_id')
        .eq('bot_id', bot.id);

      if (!users || users.length === 0) continue;

      // Get group admins to ALWAYS skip
      const adminIds = new Set<number>();
      if (bot.vip_id) {
        try {
          const res = await fetch(`https://api.telegram.org/bot${bot.token}/getChatAdministrators`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: bot.vip_id }),
          });
          const result = await res.json();
          if (result.ok && result.result) {
            result.result.forEach((admin: any) => {
              adminIds.add(admin.user.id);
            });
          }
        } catch (e) {
          console.log(`Could not get admins for group ${bot.vip_id}:`, e);
        }
      }

      for (const u of users) {
        // ALWAYS skip admins of the VIP group
        if (adminIds.has(u.telegram_user_id)) {
          skipped++;
          continue;
        }

        const isBuyer = buyerIds.has(u.telegram_user_id);

        // Apply audience filter
        if (audience === 'buyers' && !isBuyer) { skipped++; continue; }
        if (audience === 'non_buyers' && isBuyer) { skipped++; continue; }

        try {
          const keyboard = link ? {
            inline_keyboard: [[{ text: link_text || '🔥 Ver Oferta', url: link }]]
          } : undefined;

          const res = await fetch(`https://api.telegram.org/bot${bot.token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: u.telegram_user_id,
              text: message,
              parse_mode: 'Markdown',
              reply_markup: keyboard,
            }),
          });

          const result = await res.json();
          if (result.ok) {
            sent++;
            // Track sent message for potential deletion
            await supabase.from('broadcast_sent_messages').insert({
              broadcast_id: broadcastId,
              bot_id: bot.id,
              chat_id: u.telegram_user_id,
              message_id: result.result.message_id,
            });
          } else {
            failed++;
            console.log(`Failed to send to ${u.telegram_user_id}:`, result.description);
          }

          // Rate limit: 30 msgs/sec max for Telegram
          await new Promise(r => setTimeout(r, 50));
        } catch {
          failed++;
        }
      }
    }

    return new Response(JSON.stringify({ sent, failed, skipped, broadcast_id: broadcastId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Broadcast error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
