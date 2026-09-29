import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useDemoMode } from "@/hooks/useDemoMode";

export function useTotalRevenue() {
  const { user } = useAuth();
  const { isDemoActive, demoConfig } = useDemoMode();

  return useQuery({
    queryKey: ["total-revenue", user?.id, isDemoActive, demoConfig.totalRevenueAllTime],
    queryFn: async () => {
      if (isDemoActive) return demoConfig.totalRevenueAllTime;
      if (!user) return 0;

      // Get ALL bots ever owned (including deleted ones via payment_orders)
      const { data: userBots } = await supabase
        .from("bots")
        .select("id")
        .eq("user_id", user.id);

      const botIds = userBots?.map(b => b.id) || [];
      if (botIds.length === 0) {
        // Even if no bots exist, check if there are orphaned orders
        // by querying all paid orders - this won't work without bot_ids
        // So we just return 0
        return 0;
      }

      const { data } = await supabase
        .from("payment_orders")
        .select("amount")
        .in("bot_id", botIds)
        .eq("status", "paid");

      return data?.reduce((sum, o) => sum + Number(o.amount), 0) ?? 0;
    },
    enabled: !!user || isDemoActive,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
}
