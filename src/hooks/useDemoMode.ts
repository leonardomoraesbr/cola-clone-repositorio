import { useMemo } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { repairLegacyDemoConfig } from "@/lib/deriveDemoConfig";

export interface DemoConfig {
  salesToday: number;
  revenueToday: number;
  salesMonth: number;
  revenueMonth: number;
  avgTicket: number;
  conversionRate: number;
  totalRevenueAllTime: number;
  totalSalesAllTime: number;
  usersToday: number;
  usersMonth: number;
  totalUsers: number;
  activeVips: number;
  blockedUsers: number;
  conversionToday: number;
  conversionMonth: number;
  conversionTotal: number;
  chartData: { date: string; value: number }[];
  chartData30d?: { date: string; value: number }[];
  demoSource?: "manual_admin" | "manual_user" | "revantpay_api";
}

const defaultConfig: DemoConfig = {
  salesToday: 0,
  revenueToday: 0,
  salesMonth: 0,
  revenueMonth: 0,
  avgTicket: 0,
  conversionRate: 0,
  totalRevenueAllTime: 0,
  totalSalesAllTime: 0,
  usersToday: 0,
  usersMonth: 0,
  totalUsers: 0,
  activeVips: 0,
  blockedUsers: 0,
  conversionToday: 0,
  conversionMonth: 0,
  conversionTotal: 0,
  chartData: [],
};

export function useDemoMode() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["demo-mode", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("demo_settings")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    placeholderData: keepPreviousData,
  });

  const isDemoActive = !!data?.is_active;

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`demo-settings-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "demo_settings", filter: `user_id=eq.${user.id}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["demo-mode", user.id] });
          queryClient.invalidateQueries({ queryKey: ["total-revenue", user.id] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);
  
  // Stabilize demoConfig with useMemo to prevent infinite re-renders
  const configJson = data?.config ? JSON.stringify(data.config) : "";
  const demoConfig: DemoConfig = useMemo(() => {
    if (!isDemoActive || !configJson) return defaultConfig;
    try {
      return repairLegacyDemoConfig({ ...defaultConfig, ...JSON.parse(configJson) });
    } catch {
      return defaultConfig;
    }
  }, [isDemoActive, configJson]);

  return { isDemoActive, demoConfig, isLoading };
}
