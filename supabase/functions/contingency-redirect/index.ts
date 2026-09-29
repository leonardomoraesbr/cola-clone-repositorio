import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const slug = url.searchParams.get("slug");

  if (!slug) {
    return new Response("Missing slug", { status: 400 });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Find the group
    const { data: group, error: groupError } = await supabase
      .from("contingency_groups")
      .select("*")
      .eq("link_slug", slug)
      .eq("is_active", true)
      .single();

    if (groupError || !group) {
      return new Response("Group not found", { status: 404 });
    }

    // Get active bots in this group
    const { data: groupBots, error: botsError } = await supabase
      .from("contingency_group_bots")
      .select("bot_id, priority, bots(username, health_status)")
      .eq("group_id", group.id)
      .eq("is_active", true)
      .order("priority", { ascending: true });

    if (botsError || !groupBots || groupBots.length === 0) {
      return new Response("No active bots in this group", { status: 503 });
    }

    // Filter only healthy bots
    const healthyBots = groupBots.filter(
      (gb: any) => gb.bots?.health_status === "active" || gb.bots?.health_status === "unknown"
    );

    if (healthyBots.length === 0) {
      return new Response("All bots are currently down", { status: 503 });
    }

    let selectedBot: any;

    if (group.strategy === "round-robin") {
      // Simple round-robin based on current second
      const index = Math.floor(Date.now() / 1000) % healthyBots.length;
      selectedBot = healthyBots[index];
    } else {
      // Random
      const index = Math.floor(Math.random() * healthyBots.length);
      selectedBot = healthyBots[index];
    }

    const botUsername = (selectedBot as any).bots?.username;
    if (!botUsername) {
      return new Response("Bot not found", { status: 500 });
    }

    // Redirect to the bot's Telegram link
    const redirectUrl = `https://t.me/${botUsername}`;

    return new Response(null, {
      status: 302,
      headers: {
        Location: redirectUrl,
      },
    });
  } catch (error) {
    console.error("Error in contingency redirect:", error);
    return new Response("Internal error", { status: 500 });
  }
});
