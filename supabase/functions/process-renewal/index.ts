import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get all active renewal settings
    const { data: settings, error: settingsError } = await supabase
      .from("renewal_settings")
      .select("*, bots(token)")
      .eq("is_active", true);

    if (settingsError) throw settingsError;
    if (!settings || settings.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let totalSent = 0;

    for (const setting of settings) {
      const bot = (setting as any).bots;
      if (!bot?.token) continue;

      // Find VIP members expiring within X days
      const expiryThreshold = new Date();
      expiryThreshold.setDate(expiryThreshold.getDate() + setting.days_before_expiry);

      const now = new Date();

      const { data: expiringMembers, error: membersError } = await supabase
        .from("vip_members")
        .select("id, telegram_user_id, telegram_first_name, expires_at, plan_id")
        .eq("bot_id", setting.bot_id)
        .eq("is_active", true)
        .gte("expires_at", now.toISOString())
        .lte("expires_at", expiryThreshold.toISOString());

      if (membersError || !expiringMembers) continue;

      for (const member of expiringMembers) {
        // Check if already sent
        const { data: existing } = await supabase
          .from("renewal_tracking")
          .select("id")
          .eq("vip_member_id", member.id)
          .maybeSingle();

        if (existing) continue;

        const daysLeft = Math.ceil(
          (new Date(member.expires_at).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );

        let text = setting.message
          .replace("{dias}", String(daysLeft))
          .replace("{nome}", member.telegram_first_name || "");

        if (setting.discount_percentage > 0) {
          text += `\n\n🎁 Desconto especial de ${setting.discount_percentage}% para renovação!`;
        }

        try {
          const response = await fetch(
            `https://api.telegram.org/bot${bot.token}/sendMessage`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: member.telegram_user_id,
                text,
                parse_mode: "Markdown",
              }),
            }
          );

          if (response.ok) {
            await supabase.from("renewal_tracking").insert({
              vip_member_id: member.id,
            });
            totalSent++;
          }
        } catch (err) {
          console.error(`Error sending renewal to ${member.telegram_user_id}:`, err);
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, sent: totalSent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in renewal:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
