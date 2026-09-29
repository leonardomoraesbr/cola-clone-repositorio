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

    // Find pending scheduled price changes that are due
    const { data: pendingChanges, error: fetchError } = await supabase
      .from("scheduled_price_changes")
      .select("*")
      .eq("applied", false)
      .lte("scheduled_at", new Date().toISOString());

    if (fetchError) throw fetchError;

    if (!pendingChanges || pendingChanges.length === 0) {
      return new Response(JSON.stringify({ ok: true, applied: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let appliedCount = 0;

    for (const change of pendingChanges) {
      const targetType = change.target_type || "plan";
      let updateError: any = null;

      if (targetType === "plan" && change.plan_id) {
        const { error } = await supabase
          .from("subscription_plans")
          .update({ price: change.new_price })
          .eq("id", change.plan_id);
        updateError = error;
      } else if (targetType === "upsell" && change.target_id) {
        const { error } = await supabase
          .from("upsell_offers")
          .update({ price: change.new_price })
          .eq("id", change.target_id);
        updateError = error;
      } else if (targetType === "order_bump" && change.plan_id) {
        const { error } = await supabase
          .from("subscription_plans")
          .update({ order_bump_price: change.new_price })
          .eq("id", change.plan_id);
        updateError = error;
      }

      if (updateError) {
        console.error(`Failed to update ${targetType}:`, updateError);
        continue;
      }

      // Mark as applied
      const { error: markError } = await supabase
        .from("scheduled_price_changes")
        .update({ applied: true })
        .eq("id", change.id);

      if (markError) {
        console.error(`Failed to mark change ${change.id} as applied:`, markError);
        continue;
      }

      appliedCount++;
    }

    return new Response(JSON.stringify({ ok: true, applied: appliedCount }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error applying scheduled prices:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
