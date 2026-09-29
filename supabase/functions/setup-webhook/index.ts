import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const COMMANDS = [
  { command: 'start', description: '🚀 Ver ofertas e planos' },
  { command: 'planos', description: '💎 Ver todos os planos disponíveis' },
  { command: 'pix', description: '📲 Reenviar meu código PIX' },
  { command: 'vip', description: '✅ Consultar meu acesso VIP' },
  { command: 'suporte', description: '💬 Falar com o suporte' },
  { command: 'ajuda', description: 'ℹ️ Como funciona' },
];

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { botToken, action } = await req.json();

    const supabaseUrlEnv = Deno.env.get('SUPABASE_URL')!;

    // Audit (and optionally repair) the webhook registration of every bot.
    // Never returns tokens — only the bot identity and Telegram's delivery health.
    if (action === 'audit_all' || action === 'repair_all') {
      const supabase = createClient(supabaseUrlEnv, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      const { data: bots } = await supabase
        .from('bots')
        .select('id, username, token, health_status')
        .neq('health_status', 'banned');

      const results = await Promise.all((bots || []).map(async (bot: any) => {
        const expected = `${supabaseUrlEnv}/functions/v1/telegram-webhook?token=${bot.token}`;
        try {
          const info = await fetch(`https://api.telegram.org/bot${bot.token}/getWebhookInfo`)
            .then((r) => r.json());
          const result = info?.result || {};
          const registered = result.url === expected;
          let repaired = false;
          if (!registered && action === 'repair_all') {
            const set = await fetch(`https://api.telegram.org/bot${bot.token}/setWebhook`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ url: expected, allowed_updates: ['message', 'callback_query'] }),
            }).then((r) => r.json()).catch(() => null);
            repaired = Boolean(set?.ok);
            if (repaired) {
              await fetch(`https://api.telegram.org/bot${bot.token}/setMyCommands`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ commands: COMMANDS }),
              }).catch(() => null);
            }
          }
          return {
            bot_id: bot.id,
            username: bot.username,
            token_ok: info?.ok !== false,
            registered,
            repaired,
            pending_update_count: result.pending_update_count ?? null,
            last_error_message: result.last_error_message ?? null,
            last_error_date: result.last_error_date ?? null,
          };
        } catch (err) {
          return {
            bot_id: bot.id,
            username: bot.username,
            token_ok: false,
            registered: false,
            repaired: false,
            error: err instanceof Error ? err.message : String(err),
          };
        }
      }));

      const summary = {
        total: results.length,
        registered: results.filter((r: any) => r.registered).length,
        repaired: results.filter((r: any) => r.repaired).length,
        invalid_token: results.filter((r: any) => !r.token_ok).length,
        with_errors: results.filter((r: any) => r.last_error_message).length,
        backlogged: results.filter((r: any) => (r.pending_update_count || 0) > 5).length,
      };
      return new Response(JSON.stringify({ summary, results }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    if (!botToken) {
      return new Response(JSON.stringify({ error: 'Bot token is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = supabaseUrlEnv;
    const webhookUrl = `${supabaseUrl}/functions/v1/telegram-webhook?token=${botToken}`;

    if (action === 'delete') {
      // Delete webhook
      const response = await fetch(`https://api.telegram.org/bot${botToken}/deleteWebhook`, {
        method: 'POST',
      });
      const result = await response.json();
      console.log('Delete webhook result:', result);
      
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Set webhook
    const response = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: webhookUrl,
        allowed_updates: ['message', 'callback_query'],
      }),
    });

    const result = await response.json();
    console.log('Set webhook result:', result);

    // Register the /start command menu so leads always see the available actions
    await fetch(`https://api.telegram.org/bot${botToken}/setMyCommands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commands: COMMANDS }),
    }).catch((e) => console.error('setMyCommands failed', e));

    // Get webhook info
    const infoResponse = await fetch(`https://api.telegram.org/bot${botToken}/getWebhookInfo`);
    const info = await infoResponse.json();
    console.log('Webhook info:', info);

    return new Response(JSON.stringify({ 
      ...result, 
      webhook_info: info.result 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Error setting up webhook:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
