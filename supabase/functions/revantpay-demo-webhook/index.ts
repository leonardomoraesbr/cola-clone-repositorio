import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-revant-demo-event, x-revant-demo-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function hmacHex(secret: string, body: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function buildFromWebhook(data: any) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  const txs: any[] = Array.isArray(data?.transactions) ? data.transactions : Array.isArray(data?.sales) ? data.sales : [];
  const paid = txs.filter((t) => !t.status || t.status === "paid");

  let salesToday = 0, revenueToday = 0, salesMonth = 0, revenueMonth = 0;
  const byDay: Record<string, number> = {};
  for (const t of paid) {
    const ts = new Date(t.datetime || t.created_at || t.date || now).getTime();
    const amt = Number(t.amount) || 0;
    if (ts >= startOfToday) { salesToday++; revenueToday += amt; }
    if (ts >= startOfMonth) { salesMonth++; revenueMonth += amt; }
    const d = new Date(ts);
    const key = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
    byDay[key] = (byDay[key] || 0) + amt;
  }
  const chartData: { date: string; value: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
    chartData.push({ date: key, value: Math.round((byDay[key] || 0) * 100) / 100 });
  }

  const totalSales = Number(data?.sales_count ?? data?.transactions_count) || paid.length;
  const totalRevenue = paid.reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const cfg = data?.config || {};
  const avgTicket = totalSales > 0 ? totalRevenue / totalSales : Number(cfg.ticket_medio) || 0;
  const conversionRate = Number(cfg.conversion_rate) || 0;

  return {
    salesToday,
    revenueToday: Math.round(revenueToday * 100) / 100,
    salesMonth,
    revenueMonth: Math.round(revenueMonth * 100) / 100,
    avgTicket: Math.round(avgTicket * 100) / 100,
    conversionRate,
    totalRevenueAllTime: Math.round(totalRevenue * 100) / 100,
    totalSalesAllTime: totalSales,
    usersToday: 0,
    usersMonth: 0,
    totalUsers: 0,
    activeVips: 0,
    conversionToday: conversionRate,
    conversionMonth: conversionRate,
    conversionTotal: conversionRate,
    chartData,
    raw: {
      balance: data?.balance,
      synced_at: new Date().toISOString(),
      source: "webhook",
    },
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const raw = await req.text();
    const signature = req.headers.get("X-Revant-Demo-Signature") || req.headers.get("x-revant-demo-signature") || "";
    const event = req.headers.get("X-Revant-Demo-Event") || req.headers.get("x-revant-demo-event") || "";

    let payload: any;
    try { payload = JSON.parse(raw); } catch { return json({ error: "Invalid JSON" }, 400); }
    const userId: string | undefined = payload?.user_id;
    if (!userId) return json({ error: "user_id missing in payload" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Locate target by webhook payload user_id, matched against demo settings.
    // The demo user_id is the seller's id on RevantPay side; we map via a config field
    // `raw.revantpay_user_id` (set during sync) OR fall back to any demo_settings row
    // whose stored revantpay_demo_key was used. To keep it simple, the integrator
    // configures `revantpay_user_id` in demo_settings.config or we match by webhook_secret.
    const { data: rows, error: rowsErr } = await admin
      .from("demo_settings")
      .select("*")
      .not("webhook_secret", "is", null);
    if (rowsErr) throw rowsErr;

    // Try to find the row whose webhook_secret validates the signature.
    let target: any = null;
    for (const r of rows ?? []) {
      if (!r.webhook_secret) continue;
      const expected = await hmacHex(r.webhook_secret, raw);
      if (expected === signature) { target = r; break; }
    }
    if (!target) return json({ error: "Invalid signature or no matching account" }, 401);

    const built = buildFromWebhook(payload?.data || {});
    // Preserve previous raw + record event metadata
    const currentConfig = (target.config as Record<string, unknown>) ?? {};
    const merged = {
      ...currentConfig,
      ...built,
      raw: {
        ...(currentConfig as any)?.raw,
        ...built.raw,
        last_event: event,
        last_event_at: payload?.timestamp || new Date().toISOString(),
        last_event_user_id: userId,
      },
    };

    await admin.from("demo_settings").update({
      config: merged,
      last_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", target.id);

    return json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("revantpay-demo-webhook error:", msg);
    return json({ error: msg }, 500);
  }
});