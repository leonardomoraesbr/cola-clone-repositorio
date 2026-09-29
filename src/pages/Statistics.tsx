import { useState, useEffect } from "react";
import { brtDayKey, brtStartOfDay, brtStartOfMonth } from "@/lib/brtDate";
import { MainLayout } from "@/components/layout/MainLayout";
import { BarChart3, Clock, DollarSign, Users, TrendingUp, ShoppingCart, CheckCircle, Target, Award, ArrowUpRight, ArrowDownRight, Zap, TrendingDown, Loader2, Eye, EyeOff, RefreshCw, Crown, UserCheck, UserX, Repeat, CreditCard, Mail, Package, ArrowUp } from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
  LineChart, Line, Legend,
} from "recharts";
import { useBots } from "@/contexts/BotContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

type PeriodType = "today" | "week" | "month" | "total";

interface FullStats {
  totalRevenue: number;
  totalSales: number;
  pendingAmount: number;
  pendingSales: number;
  generatedAmount: number;
  generatedSales: number;
  conversionRate: number;
  avgTicket: number;
  activeVips: number;
  expiredVips: number;
  totalUsers: number;
  activeUsers: number;
  neverPaid: number;
  recurringUsers: number;
  pendingUsers: number;
  downsellConversions: number;
  downsellRevenue: number;
  downsellRate: number;
  normalPlanSales: number;
  normalPlanRevenue: number;
  upsellSales: number;
  upsellRevenue: number;
  upgradedUsers: number;
  paymentsCompleted: number;
  paymentsCreated: number;
  abandonmentRate: number;
  churnRate: number;
  // Source type breakdown
  orderBumpSales: number;
  orderBumpRevenue: number;
  mailingSales: number;
  mailingRevenue: number;
  crossBotSales: number;
  crossBotRevenue: number;
  directSales: number;
  directRevenue: number;
}

interface PlanSales {
  name: string;
  sales: number;
  value: number;
}

function getDateRange(period: PeriodType): Date | null {
  switch (period) {
    case "today": return brtStartOfDay();
    case "week": return brtStartOfDay(-7);
    case "month": return brtStartOfMonth();
    default: return null;
  }
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload?.length) {
    return (
      <div className="bg-card/95 backdrop-blur-lg p-4 border border-primary/30 rounded-xl shadow-xl">
        <p className="text-sm text-muted-foreground mb-1">{label}</p>
        <p className="font-mono text-xl text-primary font-bold">{payload[0].value}</p>
      </div>
    );
  }
  return null;
};

const StatCard = ({ icon: Icon, label, value, subValue, color }: any) => (
  <div className="glass-card p-5 hover:border-primary/40 transition-all duration-300">
    <div className="flex items-center gap-2.5 mb-4">
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
        <Icon className="w-3.5 h-3.5" />
      </div>
      <p className="text-xs font-medium leading-tight">{label}</p>
    </div>
    <p className="font-mono text-2xl font-bold tracking-tight">{value}</p>
    <p className="text-[10px] text-muted-foreground uppercase tracking-[0.14em] mt-2">{subValue || "\u00A0"}</p>
    <div className="mt-4 h-1 rounded-full bg-secondary overflow-hidden">
      <div className={`h-full w-full rounded-full opacity-60 ${color.split(" ").find((c: string) => c.startsWith("text-"))?.replace("text-", "bg-") || "bg-primary"}`} />
    </div>
  </div>
);

/** Big hero metric, like the reference dashboard */
const HeroCard = ({ icon: Icon, label, value, footnote, color, valueClass }: any) => (
  <div className="glass-card p-6 hover:border-primary/40 transition-all duration-300">
    <div className="flex items-start justify-between gap-3 mb-6">
      <p className="text-muted-foreground text-[10px] uppercase tracking-[0.18em] font-medium">{label}</p>
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
        <Icon className="w-4 h-4" />
      </div>
    </div>
    <p className={`font-mono text-4xl font-bold tracking-tight ${valueClass || ""}`}>{value}</p>
    {footnote && <p className="text-[10px] text-muted-foreground mt-4 uppercase tracking-[0.14em]">{footnote}</p>}
  </div>
);

/** Panel with icon + title/subtitle header, matching the reference layout */
const Panel = ({ icon: Icon, title, subtitle, action, children, className }: any) => (
  <div className={`glass-card p-5 animate-fade-in ${className || ""}`}>
    <div className="flex items-start justify-between gap-3 mb-5">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-secondary/70 border border-border/50 flex items-center justify-center">
          <Icon className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h3 className="text-sm font-semibold leading-tight">{title}</h3>
          {subtitle && <p className="text-[10px] text-muted-foreground uppercase tracking-[0.16em] mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
    {children}
  </div>
);

const SectionTitle = ({ children }: any) => (
  <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.2em] mb-3">{children}</h3>
);

/** Big percentage card with progress bar, like the reference "Taxa ..." cards */
const RateCard = ({ icon: Icon, label, value, footnote, color, bar }: any) => (
  <div className="glass-card p-5 hover:border-primary/40 transition-all duration-300">
    <div className="flex items-center gap-2.5 mb-4">
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${color}`}>
        <Icon className="w-3.5 h-3.5" />
      </div>
      <p className="text-xs font-medium">{label}</p>
    </div>
    <p className="font-mono text-3xl font-bold tracking-tight">{value.toFixed(1)}%</p>
    {footnote && <p className="text-[10px] text-muted-foreground uppercase tracking-[0.14em] mt-2">{footnote}</p>}
    <div className="mt-4 h-1 rounded-full bg-secondary overflow-hidden">
      <div className={`h-full rounded-full ${bar}`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  </div>
);

/** Colored big-number card (LTV style) */
const BigValueCard = ({ icon: Icon, label, value, footnote, color, bar }: any) => (
  <div className="glass-card p-5 hover:border-primary/40 transition-all duration-300">
    <div className="flex items-center gap-2.5 mb-4">
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${color}`}>
        <Icon className="w-3.5 h-3.5" />
      </div>
      <p className="text-xs font-medium">{label}</p>
    </div>
    <p className="font-mono text-3xl font-bold tracking-tight">{value}</p>
    {footnote && <p className="text-[10px] text-muted-foreground uppercase tracking-[0.14em] mt-2">{footnote}</p>}
    <div className="mt-4 h-1 rounded-full bg-secondary overflow-hidden">
      <div className={`h-full w-full rounded-full ${bar}`} />
    </div>
  </div>
);

export default function Statistics() {
  const [period, setPeriod] = useState<PeriodType>("total");
  const { selectedBot, bots } = useBots();
  const [viewAllBots, setViewAllBots] = useState(false);
  const [stats, setStats] = useState<FullStats>({
    totalRevenue: 0, totalSales: 0, pendingAmount: 0, pendingSales: 0,
    generatedAmount: 0, generatedSales: 0, conversionRate: 0, avgTicket: 0,
    activeVips: 0, expiredVips: 0, totalUsers: 0, activeUsers: 0,
    neverPaid: 0, recurringUsers: 0, pendingUsers: 0,
    downsellConversions: 0, downsellRevenue: 0, downsellRate: 0,
    normalPlanSales: 0, normalPlanRevenue: 0,
    upsellSales: 0, upsellRevenue: 0, upgradedUsers: 0,
    paymentsCompleted: 0, paymentsCreated: 0,
    abandonmentRate: 0, churnRate: 0,
    orderBumpSales: 0, orderBumpRevenue: 0,
    mailingSales: 0, mailingRevenue: 0,
    crossBotSales: 0, crossBotRevenue: 0,
    directSales: 0, directRevenue: 0,
  });
  const [topPlans, setTopPlans] = useState<PlanSales[]>([]);
  const [hourlyData, setHourlyData] = useState<{hour: string; vendas: number}[]>([]);
  const [loading, setLoading] = useState(true);
  const [timelineRange, setTimelineRange] = useState<"7d" | "30d" | "90d">("30d");
  const [timelineData, setTimelineData] = useState<{date: string; starts: number; pix: number; pending: number; paid: number; revenue: number}[]>([]);

  const fetchTimeline = async () => {
    const botIds = viewAllBots ? bots.map(b => b.id) : (selectedBot ? [selectedBot.id] : []);
    if (botIds.length === 0) return;
    try {
      const days = timelineRange === "7d" ? 7 : timelineRange === "30d" ? 30 : 90;
      const start = brtStartOfDay(-(days - 1));
      const filterBots = (q: any): any => botIds.length > 1 ? q.in('bot_id', botIds) : q.eq('bot_id', botIds[0]);

      const [{ data: users }, { data: orders }] = await Promise.all([
        filterBots(supabase.from('bot_users').select('created_at')).gte('created_at', start.toISOString()),
        filterBots(supabase.from('payment_orders').select('created_at, paid_at, status, amount')).gte('created_at', start.toISOString()),
      ]);

      const bucket: Record<string, {starts: number; pix: number; pending: number; paid: number; revenue: number}> = {};
      for (let i = 0; i < days; i++) {
        const k = brtDayKey(brtStartOfDay(-(days - 1 - i)));
        if (k) bucket[k] = { starts: 0, pix: 0, pending: 0, paid: 0, revenue: 0 };
      }
      const key = (d: string | null) => brtDayKey(d);

      (users || []).forEach((u: any) => { const k = key(u.created_at); if (k && bucket[k]) bucket[k].starts++; });
      (orders || []).forEach((o: any) => {
        const k = key(o.created_at);
        if (k && bucket[k]) {
          bucket[k].pix++;
          if (o.status === 'pending') bucket[k].pending++;
        }
        if (o.status === 'paid') {
          const pk = key(o.created_at);
          if (pk && bucket[pk]) { bucket[pk].paid++; bucket[pk].revenue += Number(o.amount || 0); }
        }
      });
      setTimelineData(Object.entries(bucket).map(([date, v]) => ({ date, ...v })));
    } catch (e) {
      console.error('timeline fetch error', e);
    }
  };

  const fetchStats = async () => {
    const botIds = viewAllBots ? bots.map(b => b.id) : (selectedBot ? [selectedBot.id] : []);
    if (botIds.length === 0) return;
    
    setLoading(true);
    try {
      const startDate = getDateRange(period);

      // Build queries
      let paidQ = supabase.from('payment_orders').select('amount, plan_id, paid_at, is_downsell, telegram_user_id, created_at, source_type').eq('status', 'paid');
      let pendQ = supabase.from('payment_orders').select('amount, telegram_user_id').eq('status', 'pending');
      let allQ = supabase.from('payment_orders').select('amount, status, telegram_user_id, is_downsell, created_at, paid_at');

      if (viewAllBots) {
        paidQ = paidQ.in('bot_id', botIds);
        pendQ = pendQ.in('bot_id', botIds);
        allQ = allQ.in('bot_id', botIds);
      } else if (selectedBot) {
        paidQ = paidQ.eq('bot_id', selectedBot.id);
        pendQ = pendQ.eq('bot_id', selectedBot.id);
        allQ = allQ.eq('bot_id', selectedBot.id);
      }

      if (startDate) {
        paidQ = paidQ.gte('created_at', startDate.toISOString());
        pendQ = pendQ.gte('created_at', startDate.toISOString());
        allQ = allQ.gte('created_at', startDate.toISOString());
      }

      // Fetch VIPs
      let vipQ = supabase.from('vip_members').select('id, is_active, expires_at');
      let botUsersQ = supabase.from('bot_users').select('id, telegram_user_id');
      if (viewAllBots) {
        vipQ = vipQ.in('bot_id', botIds);
        botUsersQ = botUsersQ.in('bot_id', botIds);
      } else if (selectedBot) {
        vipQ = vipQ.eq('bot_id', selectedBot.id);
        botUsersQ = botUsersQ.eq('bot_id', selectedBot.id);
      }

      let plansQ = supabase.from('subscription_plans').select('id, name, price');
      if (viewAllBots) {
        plansQ = plansQ.in('bot_id', botIds);
      } else if (selectedBot) {
        plansQ = plansQ.eq('bot_id', selectedBot.id);
      }

      const [{ data: paidOrders }, { data: pendingOrders }, { data: allOrders }, { data: vips }, { data: botUsers }, { data: plans }] = await Promise.all([
        paidQ, pendQ, allQ, vipQ, botUsersQ, plansQ,
      ]);

      const totalRevenue = paidOrders?.reduce((s, o) => s + Number(o.amount), 0) || 0;
      const totalSales = paidOrders?.length || 0;
      const pendingAmount = pendingOrders?.reduce((s, o) => s + Number(o.amount), 0) || 0;
      const pendingSales = pendingOrders?.length || 0;
      const allOrdersCount = allOrders?.length || 0;
      const avgTicket = totalSales > 0 ? totalRevenue / totalSales : 0;
      const conversionRate = allOrdersCount > 0 ? (totalSales / allOrdersCount) * 100 : 0;

      // Downsell
      const downsellOrders = paidOrders?.filter(o => o.is_downsell) || [];
      const downsellConversions = downsellOrders.length;
      const downsellRevenue = downsellOrders.reduce((s, o) => s + Number(o.amount), 0);
      const normalOrders = paidOrders?.filter(o => !o.is_downsell) || [];

      // VIPs
      const now = new Date().toISOString();
      const activeVips = vips?.filter(v => v.is_active && v.expires_at > now).length || 0;
      const expiredVips = vips?.filter(v => !v.is_active || v.expires_at <= now).length || 0;

      // Users
      const totalUsers = botUsers?.length || 0;
      const paidUserIds = new Set(paidOrders?.map(o => o.telegram_user_id) || []);
      const pendingUserIds = new Set(pendingOrders?.map(o => o.telegram_user_id) || []);
      const allBotUserIds = new Set(botUsers?.map(u => u.telegram_user_id) || []);
      const neverPaid = [...allBotUserIds].filter(id => !paidUserIds.has(id) && !pendingUserIds.has(id)).length;
      const pendingUsers = [...pendingUserIds].filter(id => !paidUserIds.has(id)).length;

      // Recurring users (bought more than once)
      const userPurchases: Record<number, typeof paidOrders> = {};
      paidOrders?.forEach(o => {
        if (!userPurchases[o.telegram_user_id]) userPurchases[o.telegram_user_id] = [];
        userPurchases[o.telegram_user_id]!.push(o);
      });
      const recurringUsers = Object.values(userPurchases).filter(orders => orders!.length > 1).length;
      const singlePurchaseUsers = Object.values(userPurchases).filter(orders => orders!.length === 1).length;
      const churnRate = paidUserIds.size > 0 ? (singlePurchaseUsers / paidUserIds.size) * 100 : 0;

      // Source type breakdown from actual source_type column
      const sourceTypeMap: Record<string, { sales: number; revenue: number }> = {};
      paidOrders?.forEach(o => {
        const st = (o as any).source_type || 'direct';
        if (!sourceTypeMap[st]) sourceTypeMap[st] = { sales: 0, revenue: 0 };
        sourceTypeMap[st].sales++;
        sourceTypeMap[st].revenue += Number(o.amount);
      });

      const upsellSales = sourceTypeMap['upsell']?.sales || 0;
      const upsellRevenue = sourceTypeMap['upsell']?.revenue || 0;
      const orderBumpSales = sourceTypeMap['order_bump']?.sales || 0;
      const orderBumpRevenue = sourceTypeMap['order_bump']?.revenue || 0;
      const mailingSales = sourceTypeMap['mailing']?.sales || 0;
      const mailingRevenue = sourceTypeMap['mailing']?.revenue || 0;
      const crossBotSales = sourceTypeMap['cross_bot']?.sales || 0;
      const crossBotRevenue = sourceTypeMap['cross_bot']?.revenue || 0;
      const directSales = sourceTypeMap['direct']?.sales || 0;
      const directRevenue = sourceTypeMap['direct']?.revenue || 0;

      // Upgrades: users whose latest plan price > first plan price
      let upgradedUsers = 0;
      Object.values(userPurchases).forEach(orders => {
        const nonDownsell = orders!.filter(o => !o.is_downsell).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        if (nonDownsell.length >= 2) {
          const firstPlan = plans?.find(p => p.id === nonDownsell[0].plan_id);
          const lastPlan = plans?.find(p => p.id === nonDownsell[nonDownsell.length - 1].plan_id);
          if (firstPlan && lastPlan && lastPlan.price > firstPlan.price) {
            upgradedUsers++;
          }
        }
      });

      // Abandonment
      const totalPending = allOrders?.filter(o => o.status === 'pending').length || 0;
      const abandonmentRate = allOrdersCount > 0 ? (totalPending / allOrdersCount) * 100 : 0;

      setStats({
        totalRevenue, totalSales, pendingAmount, pendingSales,
        generatedAmount: totalRevenue + pendingAmount,
        generatedSales: totalSales + pendingSales,
        conversionRate, avgTicket,
        activeVips, expiredVips, totalUsers,
        activeUsers: paidUserIds.size,
        neverPaid, recurringUsers, pendingUsers,
        downsellConversions, downsellRevenue,
        downsellRate: totalSales > 0 ? (downsellConversions / totalSales) * 100 : 0,
        normalPlanSales: normalOrders.length,
        normalPlanRevenue: normalOrders.reduce((s, o) => s + Number(o.amount), 0),
        upsellSales, upsellRevenue, upgradedUsers,
        paymentsCompleted: totalSales,
        paymentsCreated: allOrdersCount,
        abandonmentRate, churnRate,
        orderBumpSales, orderBumpRevenue,
        mailingSales, mailingRevenue,
        crossBotSales, crossBotRevenue,
        directSales, directRevenue,
      });

      // Top plans
      const planSalesMap: Record<string, { sales: number; value: number; name: string }> = {};
      paidOrders?.forEach(order => {
        const plan = plans?.find(p => p.id === order.plan_id);
        if (plan) {
          if (!planSalesMap[plan.id]) planSalesMap[plan.id] = { sales: 0, value: 0, name: plan.name };
          planSalesMap[plan.id].sales++;
          planSalesMap[plan.id].value += Number(order.amount);
        }
      });
      setTopPlans(Object.values(planSalesMap).sort((a, b) => b.value - a.value).slice(0, 3));

      // Hourly
      const hourlyMap: Record<string, number> = {};
      for (let i = 0; i < 24; i += 4) hourlyMap[`${String(i).padStart(2,'0')}h`] = 0;
      paidOrders?.forEach(o => {
        if (o.paid_at) {
          const bucket = Math.floor(new Date(o.paid_at).getHours() / 4) * 4;
          hourlyMap[`${String(bucket).padStart(2,'0')}h`]++;
        }
      });
      setHourlyData(Object.entries(hourlyMap).map(([hour, vendas]) => ({ hour, vendas })));
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedBot || (viewAllBots && bots.length > 0)) {
      fetchStats();
      fetchTimeline();
    }
  }, [selectedBot, period, viewAllBots]);

  useEffect(() => {
    if (selectedBot || (viewAllBots && bots.length > 0)) fetchTimeline();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timelineRange]);

  const performanceData = [
    { name: "Direta", value: stats.directSales, color: "hsl(160, 84%, 45%)" },
    { name: "Order Bump", value: stats.orderBumpSales, color: "hsl(200, 80%, 55%)" },
    { name: "Upsell", value: stats.upsellSales, color: "hsl(280, 70%, 60%)" },
    { name: "Downsell", value: stats.downsellConversions, color: "hsl(35, 90%, 55%)" },
    { name: "Mailing", value: stats.mailingSales, color: "hsl(320, 70%, 55%)" },
    { name: "Cross-Bot", value: stats.crossBotSales, color: "hsl(180, 60%, 50%)" },
    { name: "Pendente", value: stats.pendingSales, color: "hsl(260, 80%, 60%)" },
  ].filter(d => d.value > 0);

  const periodLabels: Record<PeriodType, string> = { today: "Hoje", week: "Esta Semana", month: "Este Mês", total: "Período Total" };

  if (!selectedBot && !viewAllBots) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-center glass-card p-12">
            <BarChart3 className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2">Nenhum bot selecionado</h2>
            <p className="text-muted-foreground">Selecione um bot para ver as estatísticas</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 animate-fade-in">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Estatísticas</h1>
            <p className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] mt-1">
              Métricas e relatórios · {viewAllBots ? <span className="text-primary">Todos os bots</span> : <span className="text-primary">@{selectedBot?.username}</span>}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 md:gap-3 w-full md:w-auto">
            <div className="flex items-center gap-2 glass-card px-3 py-2 shrink-0">
              {viewAllBots ? <Eye className="w-4 h-4 text-primary" /> : <EyeOff className="w-4 h-4 text-muted-foreground" />}
              <span className="text-sm text-muted-foreground whitespace-nowrap">Todos os bots</span>
              <Switch checked={viewAllBots} onCheckedChange={setViewAllBots} />
            </div>
            <Button variant="outline" size="sm" onClick={fetchStats} disabled={loading} className="border-border shrink-0 h-[42px]">
              <RefreshCw className="w-4 h-4 mr-1" /> Atualizar
            </Button>
            <div className="glass-card p-1 grid grid-cols-4 gap-1 w-full md:w-auto md:flex md:items-center">
              {(["today", "week", "month", "total"] as PeriodType[]).map((p) => (
                <button key={p} onClick={() => setPeriod(p)}
                  className={`px-2 md:px-3 py-1.5 text-xs md:text-sm rounded-lg transition-all whitespace-nowrap ${period === p ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary"}`}>
                  {periodLabels[p]}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-[40vh]"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>
        ) : (
          <>
            {/* Hero metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <HeroCard icon={Users} label="Usuários" value={stats.totalUsers.toLocaleString('pt-BR')} footnote={`${stats.activeUsers} compradores`} color="bg-secondary text-primary" />
              <HeroCard icon={CreditCard} label="PIX Gerados" value={stats.paymentsCreated.toLocaleString('pt-BR')} footnote={`${stats.conversionRate.toFixed(1)}% de conversão`} color="bg-secondary text-sky-400" />
              <HeroCard icon={DollarSign} label="Receita Gerada" value={`R$ ${stats.generatedAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} footnote={`Ticket médio R$ ${stats.avgTicket.toFixed(2)}`} color="bg-secondary text-amber-400" />
              <HeroCard icon={CheckCircle} label="Receita Confirmada" value={`R$ ${stats.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} footnote={`${stats.totalSales} vendas aprovadas`} valueClass="text-emerald-400" color="bg-secondary text-emerald-400" />
            </div>

            {/* Charts Row */}
            <div className="grid lg:grid-cols-2 gap-4">
              <Panel
                icon={Clock}
                title="Vendas por Horário"
                subtitle="Performance temporal"
                action={
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground">
                    <div className="w-2.5 h-2.5 rounded-full bg-primary" /> Vendas
                  </div>
                }
              >
                <div className="h-[280px]">
                  {hourlyData.every(d => d.vendas === 0) ? (
                    <div className="flex items-center justify-center h-full text-muted-foreground">Nenhuma venda no período</div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={hourlyData}>
                        <defs>
                          <linearGradient id="colorVendas" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(175, 84%, 50%)" stopOpacity={0.4}/>
                            <stop offset="95%" stopColor="hsl(175, 84%, 50%)" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 30%, 18%)" vertical={false} />
                        <XAxis dataKey="hour" stroke="hsl(215, 20%, 55%)" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis stroke="hsl(215, 20%, 55%)" fontSize={12} tickLine={false} axisLine={false} />
                        <Tooltip content={<CustomTooltip />} />
                        <Area type="monotone" dataKey="vendas" stroke="hsl(175, 84%, 50%)" strokeWidth={3} fill="url(#colorVendas)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
                  {[
                    { label: "Melhor hora", value: (hourlyData.slice().sort((a, b) => b.vendas - a.vendas)[0]?.vendas ? `${hourlyData.slice().sort((a, b) => b.vendas - a.vendas)[0].hour} (${hourlyData.slice().sort((a, b) => b.vendas - a.vendas)[0].vendas})` : "—") },
                    { label: "Pagos", value: stats.totalSales.toString() },
                    { label: "Gerados", value: stats.paymentsCreated.toString() },
                    { label: "Conversão", value: `${stats.conversionRate.toFixed(1)}%` },
                  ].map((s) => (
                    <div key={s.label} className="rounded-lg border border-border/40 bg-secondary/30 px-3 py-2.5">
                      <p className="text-[9px] text-muted-foreground uppercase tracking-[0.16em]">{s.label}</p>
                      <p className="font-mono text-base font-bold mt-0.5">{s.value}</p>
                    </div>
                  ))}
                </div>
              </Panel>

              <Panel icon={Target} title="Distribuição de Vendas" subtitle="Por origem">
                <div className="h-[280px] flex items-center">
                  {performanceData.length === 0 ? (
                    <div className="flex items-center justify-center w-full h-full text-muted-foreground">Nenhuma venda no período</div>
                  ) : (
                    <>
                      <ResponsiveContainer width="60%" height="100%">
                        <PieChart>
                          <Pie data={performanceData} cx="50%" cy="50%" innerRadius={70} outerRadius={100} paddingAngle={4} dataKey="value" stroke="none">
                            {performanceData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="flex-1 space-y-3">
                        {performanceData.map((item) => (
                          <div key={item.name} className="flex items-center gap-3">
                            <span className="w-4 h-4 rounded-full" style={{ backgroundColor: item.color }} />
                            <div className="flex-1">
                              <p className="text-sm font-medium">{item.name}</p>
                              <p className="text-xs text-muted-foreground">{item.value} vendas</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </Panel>
            </div>

            {/* Historical Timeline */}
            <Panel
              icon={BarChart3}
              title="Histórico Diário"
              subtitle="Starts · PIX · Pendentes · Aprovados"
              action={
                <div className="glass-card px-1 py-1 flex items-center gap-1">
                  {(["7d", "30d", "90d"] as const).map((r) => (
                    <button key={r} onClick={() => setTimelineRange(r)}
                      className={`px-3 py-1.5 text-[11px] rounded-lg transition-all ${timelineRange === r ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary"}`}>
                      {r === "7d" ? "7 dias" : r === "30d" ? "30 dias" : "90 dias"}
                    </button>
                  ))}
                </div>
              }
            >
              <div className="h-[340px]">
                {timelineData.length === 0 || timelineData.every(d => d.starts === 0 && d.pix === 0 && d.paid === 0) ? (
                  <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                    Nenhum dado no período selecionado
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={timelineData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 30%, 18%)" vertical={false} />
                      <XAxis dataKey="date" stroke="hsl(215, 20%, 55%)" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis stroke="hsl(215, 20%, 55%)" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{ background: 'hsl(220 30% 10% / 0.95)', border: '1px solid hsl(175 84% 50% / 0.3)', borderRadius: 12 }}
                        labelStyle={{ color: 'hsl(215 20% 75%)' }}
                      />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Line type="monotone" dataKey="starts" name="/start" stroke="hsl(200 80% 55%)" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="pix" name="PIX gerados" stroke="hsl(35 90% 55%)" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="pending" name="Pendentes" stroke="hsl(280 70% 60%)" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="paid" name="Aprovados" stroke="hsl(160 84% 45%)" strokeWidth={2.5} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
              {timelineData.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-6 pt-6 border-t border-border/40">
                  {[
                    { label: "/start", value: timelineData.reduce((s, d) => s + d.starts, 0), color: "text-sky-400" },
                    { label: "PIX gerados", value: timelineData.reduce((s, d) => s + d.pix, 0), color: "text-amber-400" },
                    { label: "Pendentes", value: timelineData.reduce((s, d) => s + d.pending, 0), color: "text-violet-400" },
                    { label: "Aprovados", value: timelineData.reduce((s, d) => s + d.paid, 0), color: "text-emerald-400" },
                    { label: "Receita", value: `R$ ${timelineData.reduce((s, d) => s + d.revenue, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, color: "text-primary" },
                  ].map(item => (
                    <div key={item.label} className="text-center">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-[0.16em]">{item.label}</p>
                      <p className={`font-mono font-bold text-lg ${item.color}`}>{item.value}</p>
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            {/* Funnel */}
            <Panel icon={Target} title="Funil de Conversão" subtitle="Jornada do usuário até a compra">
              {(() => {
                const starts = stats.totalUsers;
                const pix = stats.paymentsCreated;
                const paid = stats.totalSales;
                const pct = (a: number, b: number) => (b > 0 ? (a / b) * 100 : 0);
                const steps = [
                  { label: "/start", value: starts, width: 100, color: "from-sky-500/70 to-sky-400/40" },
                  { label: "PIX gerado", value: pix, width: Math.max(8, pct(pix, starts)), color: "from-amber-500/70 to-amber-400/40" },
                  { label: "Pago", value: paid, width: Math.max(6, pct(paid, starts)), color: "from-emerald-500/70 to-emerald-400/40" },
                ];
                return (
                  <>
                    <div className="space-y-3">
                      {steps.map((s) => (
                        <div key={s.label}>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{s.label}</span>
                            <span className="font-mono text-sm font-bold">{s.value.toLocaleString('pt-BR')}</span>
                          </div>
                          <div className="h-8 rounded-lg bg-secondary/40 overflow-hidden">
                            <div className={`h-full rounded-lg bg-gradient-to-r ${s.color}`} style={{ width: `${s.width}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-3 gap-3 mt-5 pt-5 border-t border-border/40 text-center">
                      {[
                        { label: "Start → PIX", value: pct(pix, starts) },
                        { label: "PIX → Pago", value: pct(paid, pix) },
                        { label: "Start → Pago", value: pct(paid, starts) },
                      ].map((s) => (
                        <div key={s.label}>
                          <p className="text-[9px] text-muted-foreground uppercase tracking-[0.16em]">{s.label}</p>
                          <p className="font-mono text-lg font-bold text-primary">{s.value.toFixed(1)}%</p>
                        </div>
                      ))}
                    </div>
                  </>
                );
              })()}
            </Panel>

            {/* Rates */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <RateCard icon={Target} label="Taxa Conversão" value={stats.conversionRate} footnote={`${stats.totalSales} de ${stats.paymentsCreated} PIX`} color="bg-emerald-500/10 text-emerald-400" bar="bg-emerald-400" />
              <RateCard icon={TrendingDown} label="Taxa Downsell" value={stats.downsellRate} footnote={`${stats.downsellConversions} recuperados`} color="bg-orange-500/10 text-orange-400" bar="bg-orange-400" />
              <RateCard icon={UserX} label="Taxa Churn" value={stats.churnRate} footnote="Comprou 1x e parou" color="bg-red-500/10 text-red-400" bar="bg-red-400" />
              <RateCard icon={ArrowDownRight} label="Taxa Abandono" value={stats.abandonmentRate} footnote="Desistência de PIX" color="bg-rose-500/10 text-rose-400" bar="bg-rose-400" />
            </div>

            {/* Highlight values */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <BigValueCard icon={Zap} label="Ticket Médio" value={`R$ ${stats.avgTicket.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} footnote="Valor médio por venda aprovada" color="bg-emerald-500/10 text-emerald-400" bar="bg-emerald-400" />
              <BigValueCard icon={Crown} label="VIPs Ativos" value={stats.activeVips.toLocaleString('pt-BR')} footnote={`${stats.expiredVips} expirados`} color="bg-violet-500/10 text-violet-400" bar="bg-violet-400" />
              <BigValueCard icon={Clock} label="Valor Pendente" value={`R$ ${stats.pendingAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} footnote={`${stats.pendingSales} cobranças abertas`} color="bg-amber-500/10 text-amber-400" bar="bg-amber-400" />
            </div>

            {/* Revenue Section */}
            <div>
              <SectionTitle>Receita</SectionTitle>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard icon={DollarSign} label="Receita Total" value={`R$ ${stats.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} color="bg-emerald-500/10 text-emerald-400" />
                <StatCard icon={CheckCircle} label="Vendas Processadas" value={stats.totalSales.toString()} color="bg-primary/10 text-primary" />
                <StatCard icon={TrendingUp} label="Valor Gerado" value={`R$ ${stats.generatedAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} color="bg-blue-500/10 text-blue-400" />
                <StatCard icon={ShoppingCart} label="Vendas Geradas" value={stats.generatedSales.toString()} color="bg-blue-500/10 text-blue-400" />
              </div>
            </div>

            {/* Users Section */}
            <div>
              <SectionTitle>Usuários</SectionTitle>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                <StatCard icon={Users} label="Usuários Totais" value={stats.totalUsers.toString()} color="bg-primary/10 text-primary" />
                <StatCard icon={UserCheck} label="Compradores" value={stats.activeUsers.toString()} color="bg-emerald-500/10 text-emerald-400" />
                <StatCard icon={Crown} label="VIPs Ativos" value={stats.activeVips.toString()} color="bg-amber-500/10 text-amber-400" />
                <StatCard icon={UserX} label="Nunca Pagaram" value={stats.neverPaid.toString()} color="bg-gray-500/10 text-gray-400" />
                <StatCard icon={Repeat} label="Recorrentes" value={stats.recurringUsers.toString()} color="bg-violet-500/10 text-violet-400" />
                <StatCard icon={ArrowUp} label="Upgrades" value={stats.upgradedUsers.toString()} subValue="Plano maior" color="bg-indigo-500/10 text-indigo-400" />
              </div>
            </div>

            {/* Sales by Source Type */}
            <div>
              <SectionTitle>Vendas por Tipo</SectionTitle>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <StatCard icon={Target} label="Venda Direta" value={stats.directSales.toString()} subValue={`R$ ${stats.directRevenue.toFixed(2)}`} color="bg-emerald-500/10 text-emerald-400" />
                <StatCard icon={Package} label="Order Bump" value={stats.orderBumpSales.toString()} subValue={`R$ ${stats.orderBumpRevenue.toFixed(2)}`} color="bg-blue-500/10 text-blue-400" />
                <StatCard icon={ArrowUpRight} label="Upsell" value={stats.upsellSales.toString()} subValue={`R$ ${stats.upsellRevenue.toFixed(2)}`} color="bg-violet-500/10 text-violet-400" />
                <StatCard icon={ArrowDownRight} label="Downsell" value={stats.downsellConversions.toString()} subValue={`R$ ${stats.downsellRevenue.toFixed(2)}`} color="bg-orange-500/10 text-orange-400" />
                <StatCard icon={Mail} label="Mailing" value={stats.mailingSales.toString()} subValue={`R$ ${stats.mailingRevenue.toFixed(2)}`} color="bg-pink-500/10 text-pink-400" />
                <StatCard icon={Repeat} label="Cross-Bot" value={stats.crossBotSales.toString()} subValue={`R$ ${stats.crossBotRevenue.toFixed(2)}`} color="bg-cyan-500/10 text-cyan-400" />
              </div>
            </div>

            {/* Payments Section */}
            <div>
              <SectionTitle>Pagamentos</SectionTitle>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard icon={CheckCircle} label="Pgtos Concluídos" value={stats.paymentsCompleted.toString()} color="bg-emerald-500/10 text-emerald-400" />
                <StatCard icon={CreditCard} label="Pgtos Criados (PIX)" value={stats.paymentsCreated.toString()} color="bg-blue-500/10 text-blue-400" />
                <StatCard icon={Clock} label="Pendentes" value={stats.pendingUsers.toString()} color="bg-amber-500/10 text-amber-400" />
                <StatCard icon={ShoppingCart} label="Planos Normais" value={stats.normalPlanSales.toString()} color="bg-primary/10 text-primary" />
              </div>
            </div>

            {/* Top Plans */}
            <Panel icon={Award} title="Planos Mais Vendidos" subtitle="Top 3 por receita">
              {topPlans.length === 0 ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground">
                  <div className="text-center">
                    <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>Nenhuma venda no período</p>
                  </div>
                </div>
              ) : (
                <div className="grid md:grid-cols-3 gap-4">
                  {topPlans.map((plan, index) => (
                    <div key={plan.name} className={`relative p-5 rounded-xl border transition-all duration-300 hover:scale-105 ${
                      index === 0 ? 'bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/30' :
                      index === 1 ? 'bg-gradient-to-br from-slate-400/10 to-slate-500/5 border-slate-400/30' :
                      'bg-gradient-to-br from-orange-700/10 to-orange-800/5 border-orange-700/30'
                    }`}>
                      <div className="flex items-center gap-3 mb-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                          index === 0 ? 'bg-amber-500/20 text-amber-400' : index === 1 ? 'bg-slate-400/20 text-slate-300' : 'bg-orange-700/20 text-orange-500'
                        }`}>{index + 1}º</div>
                        <div>
                          <p className="font-semibold">{plan.name}</p>
                          <p className="text-sm text-muted-foreground">{plan.sales} vendas</p>
                        </div>
                      </div>
                      <p className="font-mono text-2xl font-bold text-primary">R$ {plan.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </>
        )}
      </div>
    </MainLayout>
  );
}
