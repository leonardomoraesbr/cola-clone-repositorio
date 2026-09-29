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

    const { data: rules, error: fetchError } = await supabase
      .from("price_rules")
      .select("*")
      .eq("is_active", true);

    if (fetchError) throw fetchError;
    if (!rules || rules.length === 0) {
      return new Response(JSON.stringify({ ok: true, applied: 0, reverted: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date();
    const dayOfMonth = now.getUTCDate();
    const dayOfWeek = now.getUTCDay(); // 0=Sun
    const hourUTC = now.getUTCHours();
    // Brasília = UTC-3
    const hourBR = (hourUTC - 3 + 24) % 24;

    let appliedCount = 0;
    let revertedCount = 0;

    for (const rule of rules) {
      const config = rule.rule_config;
      let shouldApply = false;

      if (rule.rule_type === "month_period") {
        const start = config.start_day;
        const end = config.end_day;
        if (start <= end) {
          shouldApply = dayOfMonth >= start && dayOfMonth <= end;
        } else {
          shouldApply = dayOfMonth >= start || dayOfMonth <= end;
        }
      } else if (rule.rule_type === "day_of_week") {
        shouldApply = (config.days || []).includes(dayOfWeek);
      } else if (rule.rule_type === "time_range") {
        const hStart = config.hour_start;
        const hEnd = config.hour_end;
        if (hStart <= hEnd) {
          shouldApply = hourBR >= hStart && hourBR < hEnd;
        } else {
          // Wraps midnight (e.g., 22 to 6)
          shouldApply = hourBR >= hStart || hourBR < hEnd;
        }
      }

      const targetType = rule.target_type;
      const newPrice = rule.new_price;
      const originalPrice = rule.original_price;

      const applyPrice = async (price: number) => {
        if (targetType === "plan" && rule.plan_id) {
          return await supabase.from("subscription_plans").update({ price }).eq("id", rule.plan_id);
        } else if (targetType === "upsell" && rule.target_id) {
          return await supabase.from("upsell_offers").update({ price }).eq("id", rule.target_id);
        } else if (targetType === "order_bump" && rule.plan_id) {
          return await supabase.from("subscription_plans").update({ order_bump_price: price }).eq("id", rule.plan_id);
        } else if (targetType === "downsell" && rule.target_id) {
          return await supabase.from("downsell_messages").update({ discount_percentage: price }).eq("id", rule.target_id);
        }
        return { error: null };
      };

      if (shouldApply) {
        const { error } = await applyPrice(newPrice);
        if (!error) appliedCount++;
        else console.error(`Error applying rule ${rule.id}:`, error);
      } else if (originalPrice != null) {
        const { error } = await applyPrice(originalPrice);
        if (!error) revertedCount++;
        else console.error(`Error reverting rule ${rule.id}:`, error);
      }
    }

    return new Response(JSON.stringify({ ok: true, applied: appliedCount, reverted: revertedCount }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error applying price rules:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
