import { useState, useEffect, useCallback, useRef } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { SalesChart } from "@/components/dashboard/SalesChart";
import { UsersCard } from "@/components/dashboard/UsersCard";
import { ConversionCard } from "@/components/dashboard/ConversionCard";
import { BotHealthAlert } from "@/components/dashboard/BotHealthAlert";
import { OnboardingGuide } from "@/components/onboarding/OnboardingGuide";
import { DollarSign, ShoppingCart, Ticket, Bot, Plus, Loader2, RefreshCw, TrendingUp, Eye, EyeOff } from "lucide-react";
import { useBots } from "@/contexts/BotContext";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useDemoMode } from "@/hooks/useDemoMode";
import { brtStartOfDay, brtStartOfMonth } from "@/lib/brtDate";

interface DashboardStats {
  salesToday: number;
  revenueToday: number;
  salesMonth: number;
  revenueMonth: number;
  avgTicket: number;
  conversionRate: number;
  totalRevenueAllTime: number;
  totalSalesAllTime: number;
}

export default function Dashboard() {
  const { selectedBot, bots, loading: botsLoading } = useBots();
  const navigate = useNavigate();
  const { isDemoActive, demoConfig } = useDemoMode();
  const [stats, setStats] = useState<DashboardStats>({
    salesToday: 0,
    revenueToday: 0,
    salesMonth: 0,
    revenueMonth: 0,
    avgTicket: 0,
    conversionRate: 0,
    totalRevenueAllTime: 0,
    totalSalesAllTime: 0,
  });
  const [loading, setLoading] = useState(true);
  const [viewAllBots, setViewAllBots] = useState(false);
  const requestIdRef = useRef(0);

  const fetchStats = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    if (isDemoActive) {
      setStats({
        salesToday: demoConfig.salesToday,
        revenueToday: demoConfig.revenueToday,
        salesMonth: demoConfig.salesMonth,
        revenueMonth: demoConfig.revenueMonth,
        avgTicket: demoConfig.avgTicket,
        conversionRate: demoConfig.conversionRate,
        totalRevenueAllTime: demoConfig.totalRevenueAllTime,
        totalSalesAllTime: demoConfig.totalSalesAllTime,
      });
      setLoading(false);
      return;
    }

    const botIds = viewAllBots ? bots.map(b => b.id) : (selectedBot ? [selectedBot.id] : []);
    if (botIds.length === 0) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const today = brtStartOfDay();
      const monthStart = brtStartOfMonth();

      let ordersQuery = supabase.from('payment_orders').select('amount, status, created_at');

      if (!viewAllBots && selectedBot) {
        ordersQuery = ordersQuery.eq('bot_id', selectedBot.id);
      } else if (viewAllBots) {
        ordersQuery = ordersQuery.in('bot_id', botIds);
      }

      const { data: allOrders, error } = await ordersQuery.abortSignal(AbortSignal.timeout(8_000));
      if (error) throw error;
      if (requestId !== requestIdRef.current) return;
      const ordersToday = allOrders?.filter(o => new Date(o.created_at) >= today) ?? [];
      const ordersMonth = allOrders?.filter(o => new Date(o.created_at) >= monthStart) ?? [];

      const paidToday = ordersToday?.filter(o => o.status === 'paid') || [];
      const paidMonth = ordersMonth?.filter(o => o.status === 'paid') || [];
      const paidAll = allOrders?.filter(o => o.status === 'paid') || [];
      const salesMonth = paidMonth.length;
      const revenueMonth = paidMonth.reduce((sum, o) => sum + Number(o.amount), 0);
      const totalOrdersMonth = ordersMonth?.length || 0;

      setStats({
        salesToday: paidToday.length,
        revenueToday: paidToday.reduce((sum, o) => sum + Number(o.amount), 0),
        salesMonth,
        revenueMonth,
        avgTicket: salesMonth > 0 ? revenueMonth / salesMonth : 0,
        conversionRate: totalOrdersMonth > 0 ? (salesMonth / totalOrdersMonth) * 100 : 0,
        totalRevenueAllTime: paidAll.reduce((sum, o) => sum + Number(o.amount), 0),
        totalSalesAllTime: paidAll.length,
      });
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [bots, demoConfig, isDemoActive, selectedBot, viewAllBots]);

  useEffect(() => {
    if (!botsLoading && (isDemoActive || selectedBot || (viewAllBots && bots.length > 0))) {
      void fetchStats();
    } else if (!botsLoading) {
      setLoading(false);
    }
  }, [botsLoading, fetchStats, isDemoActive, selectedBot, viewAllBots, bots.length]);

  if (botsLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </MainLayout>
    );
  }

  if (!selectedBot || bots.length === 0) {
    return (
      <MainLayout>
        <OnboardingGuide />
        <div className="flex flex-col items-center justify-center min-h-[40vh] text-center">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-teal-500/20 flex items-center justify-center mb-6 animate-float">
            <Bot className="w-10 h-10 text-primary" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Bem-vindo ao Riot Vips!</h2>
          <p className="text-muted-foreground mb-8 max-w-md">
            Conecte seu primeiro bot do Telegram para começar a gerenciar assinaturas e acompanhar suas métricas.
          </p>
          <Button onClick={() => navigate("/criar-bot")} className="btn-gradient px-8 py-6 text-lg">
            <Plus className="w-5 h-5 mr-2" />
            Criar Meu Primeiro Bot
          </Button>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <OnboardingGuide compact />
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-1">Dashboard</h1>
            <p className="text-muted-foreground">
              {viewAllBots ? (
                <>Visualizando métricas de: <span className="text-primary">Todos os bots</span></>
              ) : (
                <>Visualizando métricas de: <span className="text-primary">@{selectedBot.username}</span></>
              )}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 glass-card px-3 py-2">
              {viewAllBots ? <Eye className="w-4 h-4 text-primary" /> : <EyeOff className="w-4 h-4 text-muted-foreground" />}
              <span className="text-sm text-muted-foreground">Todos os bots</span>
              <Switch checked={viewAllBots} onCheckedChange={setViewAllBots} />
            </div>
            <Button variant="outline" size="sm" onClick={fetchStats} disabled={loading} className="border-border hover:bg-secondary">
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <RefreshCw className="w-4 h-4 mr-1" />}
              Atualizar
            </Button>
          </div>
        </div>
      </div>

      {!isDemoActive && !viewAllBots && selectedBot && (
        <BotHealthAlert
          botId={selectedBot.id}
          botUserId={(selectedBot as any).user_id}
          vipId={(selectedBot as any).vip_id}
          vipLink={(selectedBot as any).vip_link}
        />
      )}

      {/* Top Stats */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="glass-card p-6 flex items-center justify-center h-32">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatsCard title="Vendas Hoje" value={`R$ ${stats.revenueToday.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} subtitle={`${stats.salesToday} venda${stats.salesToday !== 1 ? 's' : ''}`} icon={ShoppingCart} variant="primary" />
          <StatsCard title="Vendas Mês" value={`R$ ${stats.revenueMonth.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} subtitle={`${stats.salesMonth} venda${stats.salesMonth !== 1 ? 's' : ''}`} icon={DollarSign} variant="primary" />
          <StatsCard title="Ticket Médio" value={`R$ ${stats.avgTicket.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} icon={Ticket} variant="default" />
          <StatsCard title="Taxa de Conversão" value={`${stats.conversionRate.toFixed(1)}%`} icon={TrendingUp} variant="accent" />
        </div>
      )}

      {/* Chart */}
      <div className="mb-8">
        <SalesChart viewAllBots={viewAllBots} isDemoActive={isDemoActive} demoChartData={demoConfig.chartData} demoChartData30d={demoConfig.chartData30d} />
      </div>

      {/* Bottom Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <UsersCard refreshKey={stats.salesToday + stats.salesMonth} viewAllBots={viewAllBots} isDemoActive={isDemoActive} demoConfig={demoConfig} />
        <ConversionCard refreshKey={stats.salesToday + stats.salesMonth} viewAllBots={viewAllBots} isDemoActive={isDemoActive} demoConfig={demoConfig} />

        {/* Bot Info Card */}
        <div className="glass-card p-6 animate-fade-in" style={{ animationDelay: "0.4s" }}>
          <div className="flex items-center gap-2 mb-6">
            <Bot className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-semibold">Sobre o Bot</h3>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between py-2 border-b border-border/50">
              <span className="text-sm text-muted-foreground">Nome</span>
              <span className="font-medium">{selectedBot.name}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-border/50">
              <span className="text-sm text-muted-foreground">Username</span>
              <span className="font-mono text-primary">@{selectedBot.username}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-border/50">
              <span className="text-sm text-muted-foreground">Anti-Clone</span>
              <span className={selectedBot.anti_clone ? "text-green-400" : "text-muted-foreground"}>
                {selectedBot.anti_clone ? "Ativo" : "Inativo"}
              </span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-muted-foreground">Status</span>
              <span className="text-green-400 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                Online
              </span>
            </div>
          </div>
          <Button variant="outline" className="w-full mt-4 border-border hover:bg-secondary" onClick={() => navigate("/editar-bot")}>
            Configurar Bot
          </Button>
        </div>
      </div>
    </MainLayout>
  );
}
