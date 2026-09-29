import { useState, useEffect, useMemo } from "react";
import { brtStartOfDay, brtStartOfMonth } from "@/lib/brtDate";
import { TrendingUp, Loader2 } from "lucide-react";
import { useBots } from "@/contexts/BotContext";
import { supabase } from "@/integrations/supabase/client";
import type { DemoConfig } from "@/hooks/useDemoMode";

interface ConversionStats {
  today: number;
  month: number;
  total: number;
}

interface ConversionCardProps {
  refreshKey?: number;
  viewAllBots?: boolean;
  isDemoActive?: boolean;
  demoConfig?: DemoConfig;
}

export function ConversionCard({ refreshKey, viewAllBots, isDemoActive = false, demoConfig }: ConversionCardProps) {
  const { selectedBot, bots } = useBots();
  const [stats, setStats] = useState<ConversionStats>({
    today: 0,
    month: 0,
    total: 0,
  });
  const [loading, setLoading] = useState(true);

  // Stabilize bot IDs
  const botIds = useMemo(() => {
    if (viewAllBots) return bots.map(b => b.id).sort();
    if (selectedBot) return [selectedBot.id];
    return [];
  }, [viewAllBots, bots, selectedBot]);
  const stableBotKey = botIds.join(",");

  useEffect(() => {
    if (isDemoActive && demoConfig) {
      setStats({
        today: demoConfig.conversionToday,
        month: demoConfig.conversionMonth,
        total: demoConfig.conversionTotal,
      });
      setLoading(false);
      return;
    }

    async function fetchStats() {
      if (botIds.length === 0) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const today = brtStartOfDay();
        const monthStart = brtStartOfMonth();

        const useIn = botIds.length > 1;

        const [resToday, resMonth, resAll] = await Promise.all([
          useIn
            ? supabase.from('payment_orders').select('status').in('bot_id', botIds).gte('created_at', today.toISOString())
            : supabase.from('payment_orders').select('status').eq('bot_id', botIds[0]).gte('created_at', today.toISOString()),
          useIn
            ? supabase.from('payment_orders').select('status').in('bot_id', botIds).gte('created_at', monthStart.toISOString())
            : supabase.from('payment_orders').select('status').eq('bot_id', botIds[0]).gte('created_at', monthStart.toISOString()),
          useIn
            ? supabase.from('payment_orders').select('status').in('bot_id', botIds)
            : supabase.from('payment_orders').select('status').eq('bot_id', botIds[0]),
        ]);

        const ordersToday = resToday.data || [];
        const ordersMonth = resMonth.data || [];
        const allOrders = resAll.data || [];

        const paidToday = ordersToday.filter(o => o.status === 'paid').length;
        const paidMonth = ordersMonth.filter(o => o.status === 'paid').length;
        const paidTotal = allOrders.filter(o => o.status === 'paid').length;

        setStats({
          today: ordersToday.length > 0 ? (paidToday / ordersToday.length) * 100 : 0,
          month: ordersMonth.length > 0 ? (paidMonth / ordersMonth.length) * 100 : 0,
          total: allOrders.length > 0 ? (paidTotal / allOrders.length) * 100 : 0,
        });
      } catch (error) {
        console.error('Error fetching conversion stats:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, [stableBotKey, refreshKey, isDemoActive, demoConfig.conversionToday, demoConfig.conversionMonth, demoConfig.conversionTotal]);

  if (loading) {
    return (
      <div className="glass-card p-6 animate-fade-in" style={{ animationDelay: "0.3s" }}>
        <div className="flex items-center gap-2 mb-6">
          <TrendingUp className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold">Taxas de Conversão</h3>
        </div>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  const statsList = [
    { label: "Hoje", value: stats.today },
    { label: "Mês", value: stats.month },
    { label: "Total", value: stats.total },
  ];

  return (
    <div className="glass-card p-6 animate-fade-in" style={{ animationDelay: "0.3s" }}>
      <div className="flex items-center gap-2 mb-6">
        <TrendingUp className="w-5 h-5 text-primary" />
        <h3 className="text-lg font-semibold">Taxas de Conversão</h3>
      </div>

      <div className="space-y-5">
        {statsList.map((stat) => (
          <div key={stat.label} className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{stat.label}</span>
              <span className="font-mono font-semibold text-primary">{stat.value.toFixed(2)}%</span>
            </div>
            <div className="h-2 bg-secondary rounded-full overflow-hidden">
              <div 
                className="h-full rounded-full transition-all duration-500"
                style={{ 
                  width: `${Math.min(stat.value, 100)}%`,
                  background: 'linear-gradient(90deg, hsl(175 84% 50%), hsl(190 90% 40%))'
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
