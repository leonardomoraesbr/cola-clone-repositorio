import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { firePushcut } from "../_shared/pushcut.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TELEGRAM_TIMEOUT_MS = 5_000;
const HEALTH_CONCURRENCY = 10;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch all bots
    const { data: bots, error: botsError } = await supabase
      .from("bots")
      .select("id, token, name, username, user_id, health_status, notification_channel_id");

    if (botsError) throw botsError;
    if (!bots || bots.length === 0) {
      return new Response(JSON.stringify({ ok: true, checked: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let checked = 0;
    let bannedDetected = 0;

    // Group bots by user for notification purposes
    const userBots: Record<string, typeof bots> = {};
    for (const bot of bots) {
      if (!userBots[bot.user_id]) userBots[bot.user_id] = [];
      userBots[bot.user_id].push(bot);
    }

    const statuses: Array<{ bot: typeof bots[number]; newStatus: string; reachable: boolean }> = [];
    const queue = [...bots];

    await Promise.all(Array.from({ length: Math.min(HEALTH_CONCURRENCY, queue.length) }, async () => {
      while (queue.length > 0) {
        const bot = queue.shift();
        if (!bot) break;
        try {
          const response = await fetch(`https://api.telegram.org/bot${bot.token}/getMe`, {
            signal: AbortSignal.timeout(TELEGRAM_TIMEOUT_MS),
          });
          const data = await response.json().catch(() => null);
          statuses.push({ bot, newStatus: data?.ok ? "active" : "banned", reachable: true });
        } catch (err) {
          console.warn(`Transient health check failure for bot ${bot.id}:`, err);
          statuses.push({ bot, newStatus: "unknown", reachable: false });
        }
      }
    }));

    for (const { bot, newStatus, reachable } of statuses) {
      try {
        const previousStatus = bot.health_status;

        // Avoid a write every two minutes for healthy bots. Persist transitions and
        // refresh the heartbeat periodically without generating continuous DB churn.
        const shouldPersist = previousStatus !== newStatus || !reachable;
        if (shouldPersist) {
          await supabase
            .from("bots")
            .update({ health_status: newStatus, last_health_check: new Date().toISOString() })
            .eq("id", bot.id);
        }

        // If bot just went down, send notification
        if (previousStatus === "active" && newStatus === "banned") {
          bannedDetected++;

          await firePushcut(supabase, {
            event: 'bot_down',
            userId: bot.user_id,
            title: 'Bot caiu ou está instável',
            text: `O bot @${bot.username} (${bot.name}) não está respondendo no Telegram.`,
            meta: { bot_id: bot.id, username: bot.username },
          });
          
          // Find notification channel from this user's bots
          const notifChannelId = userBots[bot.user_id]?.find(b => b.notification_channel_id)?.notification_channel_id;
          
          if (notifChannelId) {
            // Find another active bot from the same user to send the notification
            const activeSenderBot = userBots[bot.user_id]?.find(
              b => b.id !== bot.id && b.health_status === "active"
            );

            if (activeSenderBot) {
              const message = `⚠️ *ALERTA DE BAN*\n\nO bot @${bot.username} (${bot.name}) foi detectado como *banido/inativo*.\n\n⏰ Detectado em: ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`;

              await fetch(`https://api.telegram.org/bot${activeSenderBot.token}/sendMessage`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  chat_id: notifChannelId,
                  text: message,
                  parse_mode: "Markdown",
                }),
              });
            }
          }

          // Also update contingency groups - deactivate this bot
          await supabase
            .from("contingency_group_bots")
            .update({ is_active: false })
            .eq("bot_id", bot.id);
        }

        // If bot came back online, reactivate in contingency groups
        if (previousStatus === "banned" && newStatus === "active") {
          await supabase
            .from("contingency_group_bots")
            .update({ is_active: true })
            .eq("bot_id", bot.id);

          // Send recovery notification
          const notifChannelId = userBots[bot.user_id]?.find(b => b.notification_channel_id)?.notification_channel_id;
          if (notifChannelId) {
            const activeSenderBot = userBots[bot.user_id]?.find(
              b => b.health_status === "active"
            );
            if (activeSenderBot) {
              await fetch(`https://api.telegram.org/bot${activeSenderBot.token}/sendMessage`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  chat_id: notifChannelId,
                  text: `✅ *BOT RECUPERADO*\n\nO bot @${bot.username} (${bot.name}) voltou ao ar!`,
                  parse_mode: "Markdown",
                }),
              });
            }
          }
        }

        checked++;
      } catch (err) {
        console.error(`Error processing health state for bot ${bot.id}:`, err);
        checked++;
      }
    }

    return new Response(
      JSON.stringify({ ok: true, checked, bannedDetected }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in health check:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
