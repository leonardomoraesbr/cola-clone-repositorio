import { useState, useEffect, useMemo } from "react";
import { brtStartOfDay, brtStartOfMonth } from "@/lib/brtDate";
import { Users, UserCheck, Crown, Loader2, Ban } from "lucide-react";
import { useBots } from "@/contexts/BotContext";
import { supabase } from "@/integrations/supabase/client";
import type { DemoConfig } from "@/hooks/useDemoMode";

interface UserStats {
  uniqueUsersToday: number;
  uniqueUsersMonth: number;
  activeVips: number;
  totalOrders: number;
  blockedUsers: number;
}

interface UsersCardProps {
  refreshKey?: number;
  viewAllBots?: boolean;
  isDemoActive?: boolean;
  demoConfig?: DemoConfig;
}

export function UsersCard({ refreshKey, viewAllBots, isDemoActive = false, demoConfig }: UsersCardProps) {
  const { selectedBot, bots } = useBots();
  const [stats, setStats] = useState<UserStats>({
    uniqueUsersToday: 0,
    uniqueUsersMonth: 0,
    activeVips: 0,
    totalOrders: 0,
    blockedUsers: 0,
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
        uniqueUsersToday: demoConfig.usersToday,
        uniqueUsersMonth: demoConfig.usersMonth,
        activeVips: demoConfig.activeVips,
        totalOrders: demoConfig.totalUsers,
        blockedUsers: demoConfig.blockedUsers,
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

        const [resToday, resMonth, resAll, resVips, resBlocked] = await Promise.all([
          useIn
            ? supabase.from('bot_users').select('id', { count: 'exact' }).in('bot_id', botIds).gte('last_interaction_at', today.toISOString())
            : supabase.from('bot_users').select('id', { count: 'exact' }).eq('bot_id', botIds[0]).gte('last_interaction_at', today.toISOString()),
          useIn
            ? supabase.from('bot_users').select('id', { count: 'exact' }).in('bot_id', botIds).gte('last_interaction_at', monthStart.toISOString())
            : supabase.from('bot_users').select('id', { count: 'exact' }).eq('bot_id', botIds[0]).gte('last_interaction_at', monthStart.toISOString()),
          useIn
            ? supabase.from('bot_users').select('id', { count: 'exact' }).in('bot_id', botIds)
            : supabase.from('bot_users').select('id', { count: 'exact' }).eq('bot_id', botIds[0]),
          useIn
            ? supabase.from('vip_members').select('id', { count: 'exact' }).in('bot_id', botIds).eq('is_active', true).gte('expires_at', new Date().toISOString())
            : supabase.from('vip_members').select('id', { count: 'exact' }).eq('bot_id', botIds[0]).eq('is_active', true).gte('expires_at', new Date().toISOString()),
          useIn
            ? supabase.from('blacklisted_users').select('id', { count: 'exact' }).in('bot_id', botIds)
            : supabase.from('blacklisted_users').select('id', { count: 'exact' }).eq('bot_id', botIds[0]),
        ]);

        setStats({
          uniqueUsersToday: resToday.count || 0,
          uniqueUsersMonth: resMonth.count || 0,
          activeVips: resVips.count || 0,
          totalOrders: resAll.count || 0,
          blockedUsers: resBlocked.count || 0,
        });
      } catch (error) {
        console.error('Error fetching user stats:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, [stableBotKey, refreshKey, isDemoActive, demoConfig.usersToday, demoConfig.usersMonth, demoConfig.activeVips, demoConfig.totalUsers, demoConfig.blockedUsers]);

  if (loading) {
    return (
      <div className="glass-card p-6 animate-fade-in" style={{ animationDelay: "0.2s" }}>
        <div className="flex items-center gap-2 mb-6">
          <Users className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold">Usuários</h3>
        </div>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  const statsList = [
    { label: "Usuários Hoje", value: stats.uniqueUsersToday, icon: Users },
    { label: "Usuários Mês", value: stats.uniqueUsersMonth, icon: Users },
    { label: "Total Usuários", value: stats.totalOrders, icon: UserCheck },
    { label: "VIPs Ativos", value: stats.activeVips, icon: Crown },
    { label: "Bloqueados", value: stats.blockedUsers, icon: Ban },
  ];

  return (
    <div className="glass-card p-6 animate-fade-in" style={{ animationDelay: "0.2s" }}>
      <div className="flex items-center gap-2 mb-6">
        <Users className="w-5 h-5 text-primary" />
        <h3 className="text-lg font-semibold">Usuários</h3>
      </div>

      <div className="space-y-4">
        {statsList.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Icon className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">{stat.label}</span>
              </div>
              <span className="font-mono font-semibold">{stat.value.toLocaleString('pt-BR')}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
