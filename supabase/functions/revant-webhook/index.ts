import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-revant-demo-event, x-revant-timestamp, x-revant-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function hmacHex(secret: string, msg: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEq(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response("method not allowed", { status: 405, headers: corsHeaders });
  }

  const raw = await req.text();
  const sigHeader = (req.headers.get("X-Revant-Signature") || req.headers.get("x-revant-signature") || "").replace(/^sha256=/, "");
  const event = req.headers.get("X-Revant-Demo-Event") || req.headers.get("x-revant-demo-event") || "unknown";

  let payload: any;
  try { payload = JSON.parse(raw); } catch {
    return new Response(JSON.stringify({ error: "invalid json" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  const userId: string | undefined = payload?.user_id;
  const timestamp: string | undefined = payload?.timestamp;
  const data = payload?.data ?? {};
  if (!userId) {
    return new Response(JSON.stringify({ error: "user_id missing" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Locate Riot user by matching HMAC against each demo key on file.
  // Per spec: x-demo-api-key (rpay_demo_...) is also the HMAC secret.
  const { data: rows, error: rowsErr } = await admin
    .from("demo_settings")
    .select("id, user_id, revantpay_demo_key, config")
    .not("revantpay_demo_key", "is", null);
  if (rowsErr) {
    return new Response(JSON.stringify({ error: rowsErr.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  let target: any = null;
  for (const r of rows ?? []) {
    if (!r.revantpay_demo_key) continue;
    const expected = await hmacHex(r.revantpay_demo_key, raw);
    if (timingSafeEq(sigHeader, expected)) { target = r; break; }
  }
  if (!target) {
    return new Response("invalid signature", { status: 401, headers: corsHeaders });
  }

  // Idempotency
  if (timestamp) {
    const { data: dup } = await admin
      .from("revant_webhook_log")
      .select("id")
      .eq("user_id", userId)
      .eq("timestamp", timestamp)
      .eq("event", event)
      .maybeSingle();
    if (dup) {
      return new Response(JSON.stringify({ ok: true, dedup: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  }

  const riotUserId: string = target.user_id;

  try {
    if (event === "demo_deactivated") {
      await admin.from("balance_mirror").delete().eq("revant_user_id", userId);
      await admin.from("sales_mirror").delete().eq("revant_user_id", userId);
      await admin.from("transactions_mirror").delete().eq("revant_user_id", userId);
      // Also clear config so dashboards zero out
      await admin.from("demo_settings").update({
        config: {},
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", target.id);
    } else {
      if (data.balance) {
        await admin.from("balance_mirror").upsert({
          revant_user_id: userId,
          riot_user_id: riotUserId,
          available: Number(data.balance.available) || 0,
          pending: Number(data.balance.pending) || 0,
          blocked: Number(data.balance.blocked) || 0,
          total: Number(data.balance.total) || 0,
          last_update: data.balance.last_update ?? new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: "revant_user_id" });
      }
      if (Array.isArray(data.sales)) {
        await admin.from("sales_mirror").delete().eq("revant_user_id", userId);
        if (data.sales.length) {
          await admin.from("sales_mirror").insert(
            data.sales.map((s: any) => ({
              revant_id: s.id,
              revant_user_id: userId,
              riot_user_id: riotUserId,
              customer_name: s.customer_name ?? null,
              customer_email: s.customer_email ?? null,
              amount: Number(s.amount) || 0,
              method: s.method ?? null,
              status: s.status ?? null,
              created_at: s.created_at ?? null,
            })),
          );
        }
      }
      if (Array.isArray(data.transactions)) {
        await admin.from("transactions_mirror").delete().eq("revant_user_id", userId);
        if (data.transactions.length) {
          await admin.from("transactions_mirror").insert(
            data.transactions.map((t: any) => ({
              revant_id: t.id,
              revant_user_id: userId,
              riot_user_id: riotUserId,
              customer_name: t.customer_name ?? null,
              customer_email: t.customer_email ?? null,
              amount: Number(t.amount) || 0,
              method: t.method ?? null,
              status: t.status ?? null,
              created_at: t.created_at ?? null,
            })),
          );
        }
      }

      // Mirror into demo_settings.config so existing dashboards (useDemoMode) update.
      const sales: any[] = Array.isArray(data.sales) ? data.sales : [];
      const paid = sales.filter((s) => !s.status || s.status === "paid" || s.status === "approved");
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      let salesToday = 0, revenueToday = 0, salesMonth = 0, revenueMonth = 0;
      const byDay: Record<string, number> = {};
      for (const t of paid) {
        const ts = new Date(t.created_at || now).getTime();
        const amt = Number(t.amount) || 0;
        if (ts >= startOfToday) { salesToday++; revenueToday += amt; }
        if (ts >= startOfMonth) { salesMonth++; revenueMonth += amt; }
        const d = new Date(ts);
        const k = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
        byDay[k] = (byDay[k] || 0) + amt;
      }
      const chartData: { date: string; value: number }[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now); d.setDate(d.getDate() - i);
        const k = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
        chartData.push({ date: k, value: Math.round((byDay[k] || 0) * 100) / 100 });
      }
      const cfg = data.config || {};
      const totalSales = Number(data.sales_count ?? data.transactions_count) || paid.length;
      const totalRevenue = paid.reduce((s, t) => s + (Number(t.amount) || 0), 0);
      const avgTicket = totalSales > 0 ? totalRevenue / totalSales : Number(cfg.ticket_medio) || 0;
      const conversionRate = Number(cfg.conversion_rate) || 0;

      const built = {
        salesToday, revenueToday: Math.round(revenueToday * 100) / 100,
        salesMonth, revenueMonth: Math.round(revenueMonth * 100) / 100,
        avgTicket: Math.round(avgTicket * 100) / 100,
        conversionRate,
        totalRevenueAllTime: Math.round(totalRevenue * 100) / 100,
        totalSalesAllTime: totalSales,
        usersToday: 0, usersMonth: 0,
        totalUsers: 0, activeVips: 0,
        conversionToday: conversionRate,
        conversionMonth: conversionRate,
        conversionTotal: conversionRate,
        chartData,
        raw: {
          balance: data.balance,
          source: "webhook",
          last_event: event,
          last_event_at: timestamp || new Date().toISOString(),
          synced_at: new Date().toISOString(),
        },
      };
      await admin.from("demo_settings").update({
        config: built,
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", target.id);
    }

    await admin.from("revant_webhook_log").insert({
      user_id: userId,
      timestamp: timestamp || new Date().toISOString(),
      event,
      payload,
    });

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("revant-webhook error:", msg);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});