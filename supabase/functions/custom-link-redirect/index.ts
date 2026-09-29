import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const BOT_UA =
  /(bot|crawler|spider|facebookexternalhit|bytespider|tiktok|headless|preview|curl|wget|python|axios|node-fetch|lighthouse|adsbot|semrush|ahrefs)/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    let slug = url.searchParams.get("slug") || "";
    if (!slug && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      slug = body?.slug || "";
    }
    if (!slug) return json({ error: "slug is required" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: link } = await admin
      .from("custom_links")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();

    if (!link) return json({ error: "not_found" }, 404);
    if (!link.is_active) return json({ error: "inactive" }, 410);

    const ua = req.headers.get("user-agent") || "";
    const referer = req.headers.get("referer") || "";
    const country = req.headers.get("x-vercel-ip-country") || req.headers.get("cf-ipcountry") || null;

    const cloakerOn = link.cloaker_mode && link.cloaker_mode !== "off";
    const suspicious = cloakerOn && (BOT_UA.test(ua) || ua.length < 15);

    const destinations = Array.isArray(link.destinations) ? link.destinations : [];
    const active = destinations.filter((d: any) => d?.url);
    if (active.length === 0) return json({ error: "no_destination" }, 409);

    // Weighted round-robin (balanceamento)
    const total = active.reduce((s: number, d: any) => s + (Number(d.weight) || 1), 0);
    let roll = Math.random() * total;
    let chosen = active[0];
    for (const d of active) {
      roll -= Number(d.weight) || 1;
      if (roll <= 0) { chosen = d; break; }
    }

    const destination = suspicious
      ? (link.notes && /^https?:\/\//.test(link.notes) ? link.notes : "https://www.google.com")
      : chosen.url;

    await admin.from("custom_link_clicks").insert({
      link_id: link.id,
      destination,
      user_agent: ua.slice(0, 500),
      referer: referer.slice(0, 500),
      country,
      blocked: !!suspicious,
    });

    if (!suspicious) {
      await admin
        .from("custom_links")
        .update({ clicks: (link.clicks || 0) + 1, last_click_at: new Date().toISOString() })
        .eq("id", link.id);
    }

    return json({
      destination,
      blocked: !!suspicious,
      redirect_page: !!link.redirect_page,
      redirect_page_title: link.redirect_page_title,
      redirect_page_text: link.redirect_page_text,
      name: link.name,
    });
  } catch (e) {
    console.error("custom-link-redirect error:", e);
    return json({ error: (e as Error).message || "internal_error" }, 500);
  }
});