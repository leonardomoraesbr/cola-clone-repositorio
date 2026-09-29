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

    const { mailing_id, bot_id } = await req.json();

    if (!mailing_id || !bot_id) {
      return new Response(JSON.stringify({ error: 'mailing_id and bot_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: mailing, error: mailingError } = await supabase
      .from('mailing_messages').select('*').eq('id', mailing_id).single();

    if (mailingError || !mailing) {
      return new Response(JSON.stringify({ error: 'Mailing not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: bot, error: botError } = await supabase
      .from('bots').select('*').eq('id', bot_id).single();

    if (botError || !bot) {
      return new Response(JSON.stringify({ error: 'Bot not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await supabase.from('mailing_messages').update({ status: 'sending' }).eq('id', mailing_id);

    const targetUsers = await getTargetUsers(supabase, bot_id, mailing.target_audience);
    console.log(`[MAILING] Found ${targetUsers.length} users for audience: ${mailing.target_audience}`);

    const buttons = (mailing.buttons || []) as any[];
    const inlineKeyboard: any[][] = [];
    for (const btn of buttons) {
      if (btn.type === 'plan' && btn.plan_id) {
        // Telegram hard-caps callback_data at 64 bytes. The old
        // `mailing_plan_{uuid}_{uuid}` form was 86 bytes and Telegram rejected the
        // whole message with BUTTON_DATA_INVALID, so no mailing with plan buttons
        // was ever delivered. Compact form: mp_{plan uuid w/o dashes}_{mailing id prefix} = 44 bytes.
        const compact = `mp_${String(btn.plan_id).replace(/-/g, '')}_${String(mailing_id).replace(/-/g, '').slice(0, 8)}`;
        const callbackData = compact.length <= 64 ? compact : `plan_${btn.plan_id}`;
        inlineKeyboard.push([{ text: btn.label || 'Comprar', callback_data: callbackData }]);
      } else if (btn.type === 'custom' && btn.url) {
        inlineKeyboard.push([{ text: btn.label || 'Link', url: btn.url }]);
      }
    }
    const replyMarkup = inlineKeyboard.length > 0 ? { inline_keyboard: inlineKeyboard } : undefined;

    let sentCount = 0;
    let failCount = 0;
    let unauthorized = false;

    for (const user of targetUsers) {
      try {
        const chatId = user.telegram_user_id;
        let success = false;
        let lastStatus = 0;

        if (mailing.media_url && mailing.media_type) {
          // Handle audio
          if (mailing.media_type === 'audio') {
            const body: any = {
              chat_id: chatId,
              voice: mailing.media_url,
              caption: mailing.message || undefined,
              parse_mode: 'Markdown',
            };
            if (replyMarkup) body.reply_markup = replyMarkup;

            const res = await fetch(`https://api.telegram.org/bot${bot.token}/sendVoice`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
            });
            success = res.ok;
            lastStatus = res.status;
            if (!res.ok) console.error(`[MAILING] Failed voice to ${chatId}:`, await res.text());
          } else {
            const mediaMethod = mailing.media_type === 'video' ? 'sendVideo' : 'sendPhoto';
            const mediaField = mailing.media_type === 'video' ? 'video' : 'photo';

            const body: any = {
              chat_id: chatId,
              [mediaField]: mailing.media_url,
              caption: mailing.message,
              parse_mode: 'Markdown',
            };
            if (replyMarkup) body.reply_markup = replyMarkup;

            const res = await fetch(`https://api.telegram.org/bot${bot.token}/${mediaMethod}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
            });
            success = res.ok;
            lastStatus = res.status;
            if (!res.ok) console.error(`[MAILING] Failed media to ${chatId}:`, await res.text());
          }
        } else {
          const body: any = {
            chat_id: chatId,
            text: mailing.message,
            parse_mode: 'Markdown',
          };
          if (replyMarkup) body.reply_markup = replyMarkup;

          const res = await fetch(`https://api.telegram.org/bot${bot.token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
          success = res.ok;
          lastStatus = res.status;
          if (!res.ok) console.error(`[MAILING] Failed text to ${chatId}:`, await res.text());
        }

        if (success) sentCount++;
        else failCount++;
        if (!success && lastStatus === 401) {
          // Bot token revoked/banned: stop hammering Telegram and disable the campaign.
          unauthorized = true;
          break;
        }

        await new Promise(r => setTimeout(r, 50));
      } catch (err) {
        console.error(`[MAILING] Error:`, err);
        failCount++;
      }
    }

    const updateData: any = {
      status: mailing.schedule_type === 'recurring' ? 'recurring' : 'sent',
      sent_count: (mailing.sent_count || 0) + sentCount,
      last_sent_at: new Date().toISOString(),
    };

    if (mailing.schedule_type === 'recurring' && mailing.recurring_interval_minutes) {
      updateData.next_send_at = new Date(Date.now() + mailing.recurring_interval_minutes * 60 * 1000).toISOString();
    }

    if (unauthorized) {
      updateData.is_active = false;
      updateData.status = 'failed';
      updateData.next_send_at = null;
      console.error(`[MAILING] Bot token unauthorized — mailing ${mailing_id} disabled`);
    }

    await supabase.from('mailing_messages').update(updateData).eq('id', mailing_id);

    // Persist a run log so sellers can audit reach/ROI per campaign.
    try {
      await supabase.from('mailing_send_logs').insert({
        mailing_id,
        bot_id,
        sent_count: sentCount,
        failed_count: failCount,
        skipped_count: Math.max(targetUsers.length - sentCount - failCount, 0),
      });
    } catch (logErr) {
      console.error('[MAILING] failed to write send log', logErr);
    }

    console.log(`[MAILING] Done: ${sentCount} sent, ${failCount} failed`);

    return new Response(JSON.stringify({ sent: sentCount, failed: failCount }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('[MAILING] Error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function getTargetUsers(supabase: any, botId: string, audience: string) {
  const now = new Date().toISOString();

  switch (audience) {
    case 'vip': {
      const { data } = await supabase
        .from('vip_members').select('telegram_user_id')
        .eq('bot_id', botId).eq('is_active', true).gte('expires_at', now);
      return data || [];
    }
    case 'expired': {
      const { data } = await supabase
        .from('vip_members').select('telegram_user_id')
        .eq('bot_id', botId).lt('expires_at', now);
      return data || [];
    }
    case 'new': {
      // Users who interacted but never paid
      const { data: allUsers } = await supabase
        .from('bot_users').select('telegram_user_id').eq('bot_id', botId);
      const { data: paidUsers } = await supabase
        .from('payment_orders').select('telegram_user_id').eq('bot_id', botId).eq('status', 'paid');
      const paidIds = new Set((paidUsers || []).map((u: any) => u.telegram_user_id));
      return (allUsers || []).filter((u: any) => !paidIds.has(u.telegram_user_id));
    }
    case 'start_only': {
      // Users who only did /start and never clicked any button
      const { data } = await supabase
        .from('bot_users').select('telegram_user_id')
        .eq('bot_id', botId).eq('has_clicked_button', false);
      return data || [];
    }
    case 'pending': {
      const { data } = await supabase
        .from('payment_orders').select('telegram_user_id')
        .eq('bot_id', botId).eq('status', 'pending');
      return [...new Map((data || []).map((u: any) => [u.telegram_user_id, u])).values()];
    }
    case 'downsell': {
      const { data } = await supabase
        .from('payment_orders').select('telegram_user_id')
        .eq('bot_id', botId).eq('is_downsell', true).eq('status', 'paid');
      return [...new Map((data || []).map((u: any) => [u.telegram_user_id, u])).values()];
    }
    case 'recurring_buyers': {
      const { data } = await supabase
        .from('payment_orders').select('telegram_user_id')
        .eq('bot_id', botId).eq('status', 'paid');
      const counts: Record<number, number> = {};
      (data || []).forEach((u: any) => { counts[u.telegram_user_id] = (counts[u.telegram_user_id] || 0) + 1; });
      return Object.entries(counts).filter(([_, c]) => c > 1).map(([id]) => ({ telegram_user_id: Number(id) }));
    }
    case 'all':
    default: {
      // All users who interacted with the bot (from bot_users table)
      const { data } = await supabase
        .from('bot_users').select('telegram_user_id').eq('bot_id', botId);
      return data || [];
    }
  }
}
