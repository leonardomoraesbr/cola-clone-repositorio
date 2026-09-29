import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

/** Início do dia em Brasília, retornado em ISO UTC */
function brtStartOfDay(daysAgo = 0): string {
  const now = new Date();
  const brt = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  brt.setUTCHours(0, 0, 0, 0);
  brt.setUTCDate(brt.getUTCDate() - daysAgo);
  return new Date(brt.getTime() + 3 * 60 * 60 * 1000).toISOString();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token")?.trim();
    if (!token || token.length < 32) return json({ error: "Token inválido" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, full_name")
      .eq("widget_token", token)
      .maybeSingle();

    if (!profile) return json({ error: "Token inválido ou revogado" }, 401);

    const { data: bots } = await supabase.from("bots").select("id, name").eq("user_id", profile.id);
    const botIds = (bots || []).map((b) => b.id);

    // Modo demo — mantém coerência com a dashboard
    const { data: demo } = await supabase
      .from("demo_settings")
      .select("is_active, config")
      .eq("user_id", profile.id)
      .maybeSingle();

    if (demo?.is_active && demo.config) {
      const c = demo.config as Record<string, number>;
      return json({
        ok: true,
        brand: "RIOT VIPS",
        today_revenue: Number(c.salesToday ?? 0),
        today_count: Number(c.salesTodayCount ?? 0),
        revenue_7d: Number(c.sales7d ?? 0),
        revenue_30d: Number(c.salesMonth ?? 0),
        leads: Number(c.totalUsers ?? 0),
        updated_at: new Date().toISOString(),
      });
    }

    if (botIds.length === 0) {
      return json({
        ok: true, brand: "RIOT VIPS",
        today_revenue: 0, today_count: 0, revenue_7d: 0, revenue_30d: 0, leads: 0,
        updated_at: new Date().toISOString(),
      });
    }

    const since30 = brtStartOfDay(29);
    const today = brtStartOfDay(0);
    const since7 = brtStartOfDay(6);

    const [{ data: orders }, { count: leads }] = await Promise.all([
      supabase
        .from("payment_orders")
        .select("amount, paid_at")
        .in("bot_id", botIds)
        .eq("status", "paid")
        .gte("paid_at", since30),
      supabase
        .from("bot_users")
        .select("id", { count: "exact", head: true })
        .in("bot_id", botIds),
    ]);

    let todayRevenue = 0, todayCount = 0, rev7 = 0, rev30 = 0;
    for (const o of orders || []) {
      const amount = Number(o.amount) || 0;
      rev30 += amount;
      if (o.paid_at && o.paid_at >= since7) rev7 += amount;
      if (o.paid_at && o.paid_at >= today) { todayRevenue += amount; todayCount += 1; }
    }

    return json({
      ok: true,
      brand: "RIOT VIPS",
      today_revenue: Number(todayRevenue.toFixed(2)),
      today_count: todayCount,
      revenue_7d: Number(rev7.toFixed(2)),
      revenue_30d: Number(rev30.toFixed(2)),
      leads: leads || 0,
      updated_at: new Date().toISOString(),
    });
  } catch (e) {
    console.error("sales-widget error", e);
    return json({ error: "Erro interno" }, 500);
  }
});
