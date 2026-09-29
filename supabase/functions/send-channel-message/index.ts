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

    const { message_id, bot_id } = await req.json();

    if (!message_id || !bot_id) {
      return new Response(JSON.stringify({ error: 'message_id and bot_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: msg, error: msgError } = await supabase
      .from('channel_messages').select('*').eq('id', message_id).single();

    if (msgError || !msg) {
      return new Response(JSON.stringify({ error: 'Message not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: bot } = await supabase
      .from('bots').select('*').eq('id', bot_id).single();

    if (!bot) {
      return new Response(JSON.stringify({ error: 'Bot not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await supabase.from('channel_messages').update({ status: 'sending' }).eq('id', message_id);

    const chatId = msg.channel_id;
    const buttons = (msg.buttons || []) as any[];
    const inlineKeyboard: any[][] = [];
    for (const btn of buttons) {
      if (btn.type === 'custom' && btn.url) {
        inlineKeyboard.push([{ text: btn.label || 'Link', url: btn.url }]);
      }
    }
    const replyMarkup = inlineKeyboard.length > 0 ? { inline_keyboard: inlineKeyboard } : undefined;

    let success = false;

    if (msg.media_url && msg.media_type) {
      if (msg.media_type === 'audio') {
        const body: any = { chat_id: chatId, voice: msg.media_url, caption: msg.message || undefined, parse_mode: 'Markdown' };
        if (replyMarkup) body.reply_markup = replyMarkup;
        const res = await fetch(`https://api.telegram.org/bot${bot.token}/sendVoice`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
        });
        success = res.ok;
        if (!res.ok) console.error('Channel voice failed:', await res.text());
      } else {
        const mediaMethod = msg.media_type === 'video' ? 'sendVideo' : 'sendPhoto';
        const mediaField = msg.media_type === 'video' ? 'video' : 'photo';
        const body: any = { chat_id: chatId, [mediaField]: msg.media_url, caption: msg.message, parse_mode: 'Markdown' };
        if (replyMarkup) body.reply_markup = replyMarkup;
        const res = await fetch(`https://api.telegram.org/bot${bot.token}/${mediaMethod}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
        });
        success = res.ok;
        if (!res.ok) console.error('Channel media failed:', await res.text());
      }
    } else {
      const body: any = { chat_id: chatId, text: msg.message, parse_mode: 'Markdown' };
      if (replyMarkup) body.reply_markup = replyMarkup;
      const res = await fetch(`https://api.telegram.org/bot${bot.token}/sendMessage`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      success = res.ok;
      if (!res.ok) console.error('Channel text failed:', await res.text());
    }

    const updateData: any = {
      status: msg.schedule_type === 'recurring' || msg.schedule_type === 'weekly' ? msg.schedule_type : 'sent',
      sent_count: (msg.sent_count || 0) + (success ? 1 : 0),
      last_sent_at: new Date().toISOString(),
    };

    if (msg.schedule_type === 'recurring' && msg.recurring_interval_minutes) {
      updateData.next_send_at = new Date(Date.now() + msg.recurring_interval_minutes * 60 * 1000).toISOString();
    }

    await supabase.from('channel_messages').update(updateData).eq('id', message_id);

    return new Response(JSON.stringify({ ok: success }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Channel message error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
