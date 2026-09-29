import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const REVANTPAY_DEMO_BASE = "https://atnxzbiowkgyvqqjaaed.supabase.co/functions/v1/demo-api";

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function rpayGet(path: string, key: string) {
  const resp = await fetch(`${REVANTPAY_DEMO_BASE}${path}`, {
    headers: { "x-demo-api-key": key },
  });
  if (!resp.ok) {
    const txt = await resp.text();
    if (resp.status === 401) {
      const err: any = new Error(`RevantPay demo key revoked: ${txt}`);
      err.code = "REVOKED";
      throw err;
    }
    throw new Error(`RevantPay ${path} ${resp.status}: ${txt}`);
  }
  return await resp.json();
}

function buildDemoConfig(summary: any, balance: any, transactions: any[], rawConfig: any) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  const paid = transactions.filter((t) => !t.status || t.status === "paid" || t.status === "approved");
  let salesToday = 0, revenueToday = 0, salesMonth = 0, revenueMonth = 0;
  const byDay: Record<string, number> = {};

  for (const t of paid) {
    const ts = new Date(t.created_at || t.datetime || now).getTime();
    const amt = Number(t.amount) || 0;
    if (ts >= startOfToday) { salesToday++; revenueToday += amt; }
    if (ts >= startOfMonth) { salesMonth++; revenueMonth += amt; }
    const d = new Date(ts);
    const key = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
    byDay[key] = (byDay[key] || 0) + amt;
  }

  // Last 7 days chart (oldest -> newest)
  const chartData: { date: string; value: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
    chartData.push({ date: key, value: Math.round((byDay[key] || 0) * 100) / 100 });
  }

  const totalSales = Number(summary?.sales_count) || paid.length;
  const totalRevenue = Number(summary?.sales_revenue) || paid.reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const avgTicket = totalSales > 0 ? totalRevenue / totalSales : Number(rawConfig?.ticket_medio) || 0;
  const conversionRate = Number(rawConfig?.conversion_rate) || 0;

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
    totalUsers: Number(summary?.users_count) || 0,
    activeVips: Number(summary?.vips_count) || 0,
    conversionToday: conversionRate,
    conversionMonth: conversionRate,
    conversionTotal: conversionRate,
    chartData,
    // Raw payloads for future panels:
    raw: {
      balance,
      summary,
      transactions_count: transactions.length,
      synced_at: new Date().toISOString(),
    },
  };
}

async function writeMirrors(admin: any, revantUserId: string, riotUserId: string, balance: any, sales: any[], transactions: any[]) {
  if (balance) {
    await admin.from("balance_mirror").upsert({
      revant_user_id: revantUserId,
      riot_user_id: riotUserId,
      available: Number(balance.available) || 0,
      pending: Number(balance.pending) || 0,
      blocked: Number(balance.blocked) || 0,
      total: Number(balance.total) || 0,
      last_update: balance.last_update ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: "revant_user_id" });
  }
  if (Array.isArray(sales)) {
    await admin.from("sales_mirror").delete().eq("revant_user_id", revantUserId);
    if (sales.length) {
      await admin.from("sales_mirror").insert(sales.map((s: any) => ({
        revant_id: s.id,
        revant_user_id: revantUserId,
        riot_user_id: riotUserId,
        customer_name: s.customer_name ?? null,
        customer_email: s.customer_email ?? null,
        amount: Number(s.amount) || 0,
        method: s.method ?? null,
        status: s.status ?? null,
        created_at: s.created_at ?? null,
      })));
    }
  }
  if (Array.isArray(transactions)) {
    await admin.from("transactions_mirror").delete().eq("revant_user_id", revantUserId);
    if (transactions.length) {
      await admin.from("transactions_mirror").insert(transactions.map((t: any) => ({
        revant_id: t.id,
        revant_user_id: revantUserId,
        riot_user_id: riotUserId,
        customer_name: t.customer_name ?? null,
        customer_email: t.customer_email ?? null,
        amount: Number(t.amount) || 0,
        method: t.method ?? null,
        status: t.status ?? null,
        created_at: t.created_at ?? null,
      })));
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claims?.claims?.sub) return json({ error: "Unauthorized" }, 401);

    const callerId = claims.claims.sub as string;
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: isAdmin } = await admin.rpc("has_role", {
      _user_id: callerId,
      _role: "admin",
    });
    if (!isAdmin) return json({ error: "Forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const targetUserId: string | undefined = body.user_id;
    const action: string = body.action || "sync";
    if (!targetUserId) return json({ error: "user_id is required" }, 400);

    const { data: demo, error: demoErr } = await admin
      .from("demo_settings")
      .select("*")
      .eq("user_id", targetUserId)
      .maybeSingle();
    if (demoErr) throw demoErr;
    if (!demo?.revantpay_demo_key) {
      return json({ error: "Chave Demo da RevantPay não configurada para este usuário." }, 400);
    }

    const key = demo.revantpay_demo_key as string;

    // Action: generate fake transactions (credits balance on RevantPay side)
    if (action === "generate") {
      const count = Math.max(1, Math.min(500, Number(body.count) || 50));
      const averageTicket = Number(body.average_ticket) || 24.9;
      const gen = await fetch(`${REVANTPAY_DEMO_BASE}/generate-transactions`, {
        method: "POST",
        headers: { "x-demo-api-key": key, "Content-Type": "application/json" },
        body: JSON.stringify({ count, average_ticket: averageTicket }),
      });
      if (!gen.ok) {
        const txt = await gen.text();
        return json({ error: `generate-transactions ${gen.status}: ${txt}` }, 502);
      }
      const genJson = await gen.json();
      // Fall through to sync after generating
      const [summary, balanceR, txR, salesR, configR] = await Promise.all([
        rpayGet("/summary", key),
        rpayGet("/balance", key),
        rpayGet("/transactions?limit=500", key),
        rpayGet("/sales?limit=500", key).catch(() => ({ sales: [] })),
        rpayGet("/config", key).catch(() => ({ config: {} })),
      ]);
      const built = buildDemoConfig(summary, balanceR?.balance, txR?.transactions ?? [], configR?.config);
      await writeMirrors(admin, targetUserId, targetUserId, balanceR?.balance, salesR?.sales ?? [], txR?.transactions ?? []);
      await admin.from("demo_settings").update({
        config: built,
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", demo.id);
      return json({ success: true, generated: genJson, synced_at: new Date().toISOString() });
    }

    // Default: full sync
    const [summary, balanceR, txR, salesR, configR] = await Promise.all([
      rpayGet("/summary", key),
      rpayGet("/balance", key),
      rpayGet("/transactions?limit=500", key),
      rpayGet("/sales?limit=500", key).catch(() => ({ sales: [] })),
      rpayGet("/config", key).catch(() => ({ config: {} })),
    ]);

    const built = buildDemoConfig(summary, balanceR?.balance, txR?.transactions ?? [], configR?.config);
    await writeMirrors(admin, targetUserId, targetUserId, balanceR?.balance, salesR?.sales ?? [], txR?.transactions ?? []);

    const { error: updErr } = await admin
      .from("demo_settings")
      .update({
        config: built,
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", demo.id);
    if (updErr) throw updErr;

    return json({ success: true, synced_at: new Date().toISOString(), summary });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if ((e as any)?.code === "REVOKED") {
      try {
        const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
        const body = await req.clone().json().catch(() => ({}));
        if (body?.user_id) {
          await admin.from("demo_settings")
            .update({ revantpay_demo_key: null, updated_at: new Date().toISOString() })
            .eq("user_id", body.user_id);
        }
      } catch (_) { /* ignore */ }
      return json({ error: "Chave Demo da RevantPay foi revogada. Gere uma nova chave no painel da RevantPay e cadastre novamente." }, 400);
    }
    console.error("sync-revantpay-demo error:", msg);
    return json({ error: msg }, 500);
  }
});