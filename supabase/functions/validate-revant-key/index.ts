import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BASE = (Deno.env.get("REVANTPAY_BASE_URL") ||
  "https://atnxzbiowkgyvqqjaaed.supabase.co/functions/v1/public-api").replace(/\/$/, "");

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const jwt = authHeader.replace("Bearer ", "");
    const { data: userData } = await supabase.auth.getUser(jwt);
    const user = userData?.user;
    if (!user) return json({ error: "unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const key = String(body?.apiKey || "").trim();
    if (!key) return json({ error: "apiKey obrigatório" }, 400);

    // Probe a read endpoint: 401/403 = key rejected, anything else = key accepted.
    let status = 0;
    let raw = "";
    try {
      const resp = await fetch(`${BASE}/balance`, {
        headers: { "x-api-key": key, "Content-Type": "application/json" },
      });
      status = resp.status;
      raw = (await resp.text()).slice(0, 300);
    } catch (e) {
      return json({ valid: null, reason: "gateway_unreachable", detail: String(e) });
    }

    const invalid = status === 401 || status === 403 ||
      /invalid|revogad|unauthor|api[_ -]?key/i.test(raw);

    if (invalid) {
      await supabase.from("profiles").update({
        revantpay_key_status: "invalid",
        revantpay_key_error: raw || `HTTP ${status}`,
        revantpay_key_checked_at: new Date().toISOString(),
      }).eq("id", user.id);
      return json({ valid: false, status, detail: raw });
    }

    await supabase.from("profiles").update({
      revantpay_api_key: key,
      revantpay_key_status: "valid",
      revantpay_key_error: null,
      revantpay_key_checked_at: new Date().toISOString(),
    }).eq("id", user.id);

    return json({ valid: true, status });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
