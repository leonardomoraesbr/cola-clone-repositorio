import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const COMMANDS = [
  { command: "start", description: "🚀 Ver ofertas e planos" },
  { command: "planos", description: "💎 Ver todos os planos disponíveis" },
  { command: "pix", description: "📲 Reenviar meu código PIX" },
  { command: "vip", description: "✅ Consultar meu acesso VIP" },
  { command: "suporte", description: "💬 Falar com o suporte" },
  { command: "ajuda", description: "ℹ️ Como funciona" },
];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    if (!jwt) return json({ error: "unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) return json({ error: "server_configuration_error" }, 500);

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { data: authData, error: authError } = await admin.auth.getUser(jwt);
    const user = authData?.user;
    if (authError || !user) return json({ error: "unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const botId = typeof body?.botId === "string" ? body.botId : "";
    const legacyBotToken = typeof body?.botToken === "string" ? body.botToken : "";
    const action = typeof body?.action === "string" ? body.action : "set";
    if (!["status", "set", "delete", "audit_all", "repair_all"].includes(action)) {
      return json({ error: "ação inválida" }, 400);
    }

    if (action === "audit_all" || action === "repair_all") {
      const { data: isAdmin, error: roleError } = await admin.rpc("has_role", {
        _user_id: user.id,
        _role: "admin",
      });
      if (roleError || !isAdmin) return json({ error: "forbidden" }, 403);

      const { data: bots, error: botsError } = await admin
        .from("bots")
        .select("id, username, token, health_status")
        .neq("health_status", "banned");
      if (botsError) return json({ error: "Não foi possível listar os bots." }, 500);

      const results = await Promise.all((bots || []).map(async (bot: any) => {
        const expected = `${supabaseUrl.replace(/\/$/, "")}/functions/v1/telegram-webhook?token=${bot.token}`;
        try {
          const info = await fetch(`https://api.telegram.org/bot${bot.token}/getWebhookInfo`).then((r) => r.json());
          const result = info?.result || {};
          const registered = result.url === expected;
          let repaired = false;
          if (!registered && action === "repair_all") {
            const set = await fetch(`https://api.telegram.org/bot${bot.token}/setWebhook`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ url: expected, allowed_updates: ["message", "callback_query"] }),
            }).then((r) => r.json()).catch(() => null);
            repaired = Boolean(set?.ok);
            if (repaired) {
              await fetch(`https://api.telegram.org/bot${bot.token}/setMyCommands`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
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
        } catch {
          return { bot_id: bot.id, username: bot.username, token_ok: false, registered: false, repaired: false };
        }
      }));

      return json({
        summary: {
          total: results.length,
          registered: results.filter((r: any) => r.registered).length,
          repaired: results.filter((r: any) => r.repaired).length,
          invalid_token: results.filter((r: any) => !r.token_ok).length,
          with_errors: results.filter((r: any) => r.last_error_message).length,
          backlogged: results.filter((r: any) => (r.pending_update_count || 0) > 5).length,
        },
        results,
      });
    }

    if (!botId && !legacyBotToken) return json({ error: "botId obrigatório" }, 400);

    // Resolve the bot only within the authenticated seller's account. Never accept bot tokens from the client.
    let botQuery = admin.from("bots").select("id, token").eq("user_id", user.id);
    botQuery = botId ? botQuery.eq("id", botId) : botQuery.eq("token", legacyBotToken);
    const { data: bot, error: botError } = await botQuery.maybeSingle();
    if (botError) return json({ error: "Não foi possível carregar o bot." }, 500);
    if (!bot?.token) return json({ error: "Bot não encontrado nesta conta." }, 404);

    const { data: tokenMatches, error: tokenMatchesError } = await admin
      .from("bots")
      .select("id")
      .eq("token", bot.token)
      .limit(2);
    if (tokenMatchesError) return json({ error: "Não foi possível validar o cadastro do bot." }, 500);
    if ((tokenMatches?.length || 0) > 1) {
      return json({
        ok: false,
        conflict: true,
        status_available: true,
        webhook_active: false,
        error: "Este token está cadastrado em mais de uma conta. Um único cadastro deve ser mantido para o bot.",
      });
    }

    const expectedUrl = `${supabaseUrl.replace(/\/$/, "")}/functions/v1/telegram-webhook?token=${bot.token}`;
    const telegramApi = `https://api.telegram.org/bot${bot.token}`;

    if (action === "delete") {
      const response = await fetch(`${telegramApi}/deleteWebhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ drop_pending_updates: false }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.ok) return json({ ok: false, error: "Telegram não aceitou a remoção do webhook." });
      return json({ ok: true, webhook_active: false });
    }

    const getWebhookInfo = async () => {
      try {
        const response = await fetch(`${telegramApi}/getWebhookInfo`, { signal: AbortSignal.timeout(8000) });
        const result = await response.json().catch(() => null);
        if (!response.ok) {
          return { available: false, result: null, reason: response.status === 429 ? "telegram_rate_limited" : response.status === 401 ? "telegram_token_rejected" : `telegram_http_${response.status}` };
        }
        if (!result?.ok) {
          const errorCode = Number(result?.error_code);
          return { available: false, result: null, reason: errorCode === 429 ? "telegram_rate_limited" : errorCode === 401 ? "telegram_token_rejected" : "telegram_rejected_request" };
        }
        return { available: true, result: result.result, reason: null };
      } catch (error) {
        const reason = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")
          ? "telegram_timeout"
          : "telegram_network_error";
        return { available: false, result: null, reason };
      }
    };

    const existingInfo = await getWebhookInfo();
    if (action === "status") {
      if (!existingInfo.available) {
        return json({ ok: true, status_available: false, webhook_active: null, status_error_code: existingInfo.reason });
      }
      return json({
        ok: true,
        status_available: true,
        webhook_active: existingInfo.result?.url === expectedUrl,
        webhook_configured_elsewhere: Boolean(existingInfo.result?.url && existingInfo.result.url !== expectedUrl),
        pending_update_count: existingInfo.result?.pending_update_count ?? 0,
        last_error_date: existingInfo.result?.last_error_date ?? null,
      });
    }

    if (action === "set") {
      if (existingInfo.result?.url !== expectedUrl) {
        let response: Response;
        let result: any;
        try {
          response = await fetch(`${telegramApi}/setWebhook`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: expectedUrl, allowed_updates: ["message", "callback_query"] }),
            signal: AbortSignal.timeout(10000),
          });
          result = await response.json().catch(() => null);
        } catch {
          return json({ ok: false, status_available: false, webhook_active: null, error: "Não foi possível falar com o Telegram agora. Tente novamente." });
        }
        if (!response.ok || !result?.ok) {
          const error = Number(result?.error_code || response.status) === 429
            ? "O Telegram limitou temporariamente as configurações. Aguarde alguns minutos e tente novamente."
            : "Telegram não aceitou a configuração do webhook. Confira se o token do bot continua válido.";
          return json({ ok: false, status_available: true, webhook_active: false, error });
        }

        await fetch(`${telegramApi}/setMyCommands`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ commands: COMMANDS }),
        }).catch(() => null);
      }
    }

    // Verify server-side; an unavailable status is not the same as an inactive webhook.
    const info = action === "set" ? await getWebhookInfo() : existingInfo;
    if (!info.available) {
      return json({ ok: false, status_available: false, webhook_active: null, status_error_code: info.reason, error: "A configuração foi enviada, mas não foi possível confirmar o estado com o Telegram agora." });
    }

    const webhookActive = info.result?.url === expectedUrl;
    return json({
      ok: true,
      status_available: true,
      webhook_active: webhookActive,
      webhook_configured_elsewhere: Boolean(info.result?.url && !webhookActive),
      pending_update_count: info.result?.pending_update_count ?? 0,
      last_error_date: info.result?.last_error_date ?? null,
    });
  } catch (error) {
    console.error("setup-webhook failed", error instanceof Error ? error.message : "unknown error");
    return json({ error: "Falha ao consultar ou configurar o webhook." }, 500);
  }
});
