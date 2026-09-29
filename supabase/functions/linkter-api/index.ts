import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LINKTER_API =
  "https://srldeuwnxzpxhlypxyoq.supabase.co/functions/v1/public-api";

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function getAuthContext(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error } = await supabase.auth.getClaims(token);
  if (error || !claimsData?.claims) return null;

  const userId = claimsData.claims.sub;
  const adminClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  return { userId, adminClient };
}

async function getApiKey(adminClient: any, userId: string): Promise<string | null> {
  const { data: profile } = await adminClient
    .from("profiles")
    .select("linkter_api_key")
    .eq("id", userId)
    .single();
  return profile?.linkter_api_key || null;
}

async function verifyBotOwnership(adminClient: any, botId: string, userId: string) {
  const { data: bot, error } = await adminClient
    .from("bots")
    .select("id, username")
    .eq("id", botId)
    .eq("user_id", userId)
    .single();
  if (error || !bot) return null;
  return bot;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ctx = await getAuthContext(req);
    if (!ctx) return jsonResponse({ error: "Unauthorized" }, 401);
    const { userId, adminClient } = ctx;

    const body = await req.json();
    const { action, bot_id, link_id } = body;

    // Domain management actions don't need bot_id
    if (action === "list-domains" || action === "add-domain" || action === "domain-details" || action === "delete-domain") {
      const apiKey = await getApiKey(adminClient, userId);
      if (!apiKey) return jsonResponse({ error: "Linkter API Key not configured." }, 400);

      if (action === "list-domains") {
        const res = await fetch(`${LINKTER_API}/domains`, {
          headers: { "X-API-Key": apiKey },
        });
        return jsonResponse(await res.json(), res.status);
      }

      if (action === "add-domain") {
        const res = await fetch(`${LINKTER_API}/domains`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
          body: JSON.stringify({ domain: body.domain }),
        });
        return jsonResponse(await res.json(), res.status);
      }

      if (action === "domain-details") {
        const res = await fetch(`${LINKTER_API}/domains/${body.domain_id}`, {
          headers: { "X-API-Key": apiKey },
        });
        return jsonResponse(await res.json(), res.status);
      }

      if (action === "delete-domain") {
        const res = await fetch(`${LINKTER_API}/domains/${body.domain_id}`, {
          method: "DELETE",
          headers: { "X-API-Key": apiKey },
        });
        const text = await res.text();
        try { return jsonResponse(JSON.parse(text), res.status); } catch { return jsonResponse({ message: "Domain deleted" }, res.status); }
      }
    }

    // Global stats action
    if (action === "global-stats") {
      const apiKey = await getApiKey(adminClient, userId);
      if (!apiKey) return jsonResponse({ error: "Linkter API Key not configured." }, 400);

      let url = `${LINKTER_API}/stats`;
      const params = new URLSearchParams();
      if (body.start_date) params.set("start_date", body.start_date);
      if (body.end_date) params.set("end_date", body.end_date);
      const qs = params.toString();
      if (qs) url += `?${qs}`;

      const res = await fetch(url, { headers: { "X-API-Key": apiKey } });
      return jsonResponse(await res.json(), res.status);
    }

    // All other actions require bot_id
    if (!bot_id) return jsonResponse({ error: "bot_id is required" }, 400);

    const bot = await verifyBotOwnership(adminClient, bot_id, userId);
    if (!bot) return jsonResponse({ error: "Bot not found or unauthorized" }, 404);

    const apiKey = await getApiKey(adminClient, userId);
    if (!apiKey) return jsonResponse({ error: "Linkter API Key not configured. Configure in Trackeamento." }, 400);

    if (action === "create-link") {
      const title = body.title || `Riot Vips - ${bot.username}`;
      const domain = body.domain || "linkterbio.com";
      const funnelType = body.funnel_type || "direct";
      const crossBotId = body.cross_bot_id || null;

      const insertData: Record<string, any> = {
        bot_id: bot.id,
        linkter_link_id: "pending",
        short_url: "pending",
        destination_url: `https://t.me/${bot.username}`,
        funnel_type: funnelType,
      };
      if (crossBotId) insertData.cross_bot_id = crossBotId;
      // For group funnels, save custom_destination as custom_redirect_url
      if (funnelType === "group" && body.custom_destination) {
        insertData.custom_redirect_url = body.custom_destination.trim();
      }
      // For custom funnels, save funnel_steps
      if (funnelType === "custom" && body.funnel_steps) {
        insertData.funnel_steps = body.funnel_steps;
      }

      const { data: trackedLink, error: tlError } = await adminClient
        .from("tracked_links")
        .insert(insertData)
        .select()
        .single();

      if (tlError || !trackedLink) {
        return jsonResponse({ error: "Failed to create tracked link record" }, 500);
      }

      // ALWAYS route through bot first for attribution
      const destination = `https://t.me/${bot.username}?start=link_${trackedLink.id}`;

      const createBody: Record<string, any> = {
        destination_url: destination,
        title,
        domain,
        tags: ["riot-vips", "bot"],
        utm_source: "riot-vips",
        utm_medium: "telegram-bot",
        utm_campaign: bot.username.toLowerCase(),
      };
      if (body.fallback_url) createBody.fallback_url = body.fallback_url;
      if (body.click_limit) createBody.click_limit = body.click_limit;
      if (body.expires_at) createBody.expires_at = body.expires_at;

      const res = await fetch(`${LINKTER_API}/links`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
        body: JSON.stringify(createBody),
      });

      const data = await res.json();
      if (!res.ok) {
        await adminClient.from("tracked_links").delete().eq("id", trackedLink.id);
        return jsonResponse({ error: data }, res.status);
      }

      await adminClient
        .from("tracked_links")
        .update({
          linkter_link_id: data.id,
          short_url: data.short_url,
          destination_url: destination,
        })
        .eq("id", trackedLink.id);

      return jsonResponse(data);
    }

    if (action === "stats") {
      if (!link_id) return jsonResponse({ error: "link_id is required" }, 400);

      let url = `${LINKTER_API}/links/${link_id}/stats`;
      const params = new URLSearchParams();
      if (body.period) params.set("period", body.period);
      if (body.start_date) params.set("start_date", body.start_date);
      if (body.end_date) params.set("end_date", body.end_date);
      const qs = params.toString();
      if (qs) url += `?${qs}`;

      const res = await fetch(url, { headers: { "X-API-Key": apiKey } });
      return jsonResponse(await res.json(), res.status);
    }

    // Detailed stats endpoints
    if (action === "stats-browsers" || action === "stats-regions" || action === "stats-hours" || action === "stats-connections") {
      if (!link_id) return jsonResponse({ error: "link_id is required" }, 400);

      const subpath = action.replace("stats-", "");
      let url = `${LINKTER_API}/links/${link_id}/stats/${subpath}`;
      const params = new URLSearchParams();
      if (body.start_date) params.set("start_date", body.start_date);
      if (body.end_date) params.set("end_date", body.end_date);
      const qs = params.toString();
      if (qs) url += `?${qs}`;

      const res = await fetch(url, { headers: { "X-API-Key": apiKey } });
      return jsonResponse(await res.json(), res.status);
    }

    if (action === "update-link") {
      if (!link_id) return jsonResponse({ error: "link_id is required" }, 400);

      const updateBody: Record<string, any> = {};
      if (body.domain) updateBody.domain = body.domain;
      if (body.destination_url) updateBody.destination_url = body.destination_url;
      if (body.title) updateBody.title = body.title;
      if (body.is_active !== undefined) updateBody.is_active = body.is_active;
      if (body.notes !== undefined) updateBody.notes = body.notes;
      if (body.fallback_url !== undefined) updateBody.fallback_url = body.fallback_url;
      if (body.click_limit !== undefined) updateBody.click_limit = body.click_limit;
      if (body.expires_at !== undefined) updateBody.expires_at = body.expires_at;

      const res = await fetch(`${LINKTER_API}/links/${link_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
        body: JSON.stringify(updateBody),
      });

      const data = await res.json();
      if (!res.ok) return jsonResponse({ error: data }, res.status);

      if (data.short_url) {
        await adminClient
          .from("tracked_links")
          .update({ short_url: data.short_url })
          .eq("linkter_link_id", link_id)
          .eq("bot_id", bot.id);
      }

      return jsonResponse(data);
    }

    if (action === "delete-link") {
      if (!link_id) return jsonResponse({ error: "link_id is required" }, 400);

      // Use ?hard=true for permanent deletion
      try {
        const res = await fetch(`${LINKTER_API}/links/${link_id}?hard=true`, {
          method: "DELETE",
          headers: { "X-API-Key": apiKey, "Content-Type": "application/json" },
        });
        const responseText = await res.text();
        console.log("Linkter DELETE response:", res.status, responseText);
        if (!res.ok && res.status !== 404) {
          console.warn("Linkter API delete returned non-ok status:", res.status);
        }
      } catch (linkterError) {
        console.error("Error calling Linkter DELETE API:", linkterError);
      }

      await adminClient
        .from("tracked_links")
        .delete()
        .eq("linkter_link_id", link_id)
        .eq("bot_id", bot.id);

      return jsonResponse({ success: true });
    }

    return jsonResponse(
      { error: "Invalid action. Use 'create-link', 'stats', 'stats-browsers', 'stats-regions', 'stats-hours', 'stats-connections', 'global-stats', 'update-link', 'delete-link', 'list-domains', 'add-domain', 'domain-details', or 'delete-domain'" },
      400
    );
  } catch (error) {
    console.error("Linkter API error:", error);
    return jsonResponse({ error: error.message || "Internal server error" }, 500);
  }
});
