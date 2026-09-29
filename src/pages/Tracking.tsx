import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { useBots } from "@/contexts/BotContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Crosshair, Key, Link2, Copy, BarChart3, Globe, Smartphone,
  Share2, TrendingDown, Loader2, Check, Unlink, ExternalLink, Users,
  CreditCard, DollarSign, RefreshCw, Eye, Plus, Trash2, ArrowLeft,
  CalendarIcon, Pencil, ChevronDown, Settings, LayoutDashboard, Timer, ShieldOff,
  ArrowRightLeft, Puzzle, Bot, Megaphone,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DomainsTab } from "@/components/tracking/DomainsTab";
import { DetailedStats } from "@/components/tracking/DetailedStats";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { PageHeader, HeroCard, SectionTitle } from "@/components/ui/stat-kit";

interface FunnelStep {
  title: string;
  type: "bot" | "group" | "channel" | "external";
  identifier: string;
}

interface TrackedLink {
  id: string;
  bot_id: string;
  linkter_link_id: string;
  short_url: string;
  destination_url: string;
  created_at: string;
  cross_bot_id?: string | null;
  funnel_type?: string | null;
  custom_redirect_url?: string | null;
  cloaker_enabled?: boolean;
  cloaker_token?: string | null;
  safe_redirect_url?: string | null;
  funnel_steps?: FunnelStep[] | null;
}

const FUNNEL_LABELS: Record<string, { label: string; color: string; Icon: any }> = {
  direct: { label: "Direto", color: "bg-violet-500/20 text-violet-300", Icon: Crosshair },
  group: { label: "Grupo", color: "bg-amber-500/20 text-amber-300", Icon: Users },
  crossbot: { label: "Cross-Bot", color: "bg-cyan-500/20 text-cyan-300", Icon: ArrowRightLeft },
  custom: { label: "Personalizado", color: "bg-pink-500/20 text-pink-300", Icon: Puzzle },
};

const STEP_TYPE_LABELS: Record<string, { label: string; color: string; Icon: any; placeholder: string }> = {
  bot: { label: "Bot", color: "bg-blue-500/20 text-blue-300", Icon: Bot, placeholder: "@username do bot" },
  group: { label: "Grupo", color: "bg-amber-500/20 text-amber-300", Icon: Users, placeholder: "ID do grupo (ex: -100123456) ou link" },
  channel: { label: "Canal", color: "bg-purple-500/20 text-purple-300", Icon: Megaphone, placeholder: "ID do canal ou @username" },
  external: { label: "Link Externo", color: "bg-emerald-500/20 text-emerald-300", Icon: ExternalLink, placeholder: "https://exemplo.com" },
};

interface LinkterStats {
  total_clicks: number;
  unique_visitors: number;
  returning_visitors: number;
  top_countries: { country: string; clicks: number }[];
  top_devices: { device: string; clicks: number }[];
  top_sources: { source: string; clicks: number }[];
  clicks_per_day: { date: string; clicks: number }[];
}

const DOMAINS = [
  { value: "linkterbio.com", label: "linkterbio.com" },
  { value: "linkter.com.br", label: "linkter.com.br" },
  { value: "linkterbio.com.br", label: "linkterbio.com.br" },
];

const PERIODS = [
  { value: "7d", label: "Últimos 7 dias" },
  { value: "30d", label: "Últimos 30 dias" },
  { value: "all", label: "Todo período" },
  { value: "custom", label: "Personalizado" },
];

const ChartTooltip = ({ active, payload, label }: any) => {
  if (active && payload?.length) {
    return (
      <div className="glass-card p-3 border border-violet-500/30">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="font-mono text-lg text-violet-400 font-bold">{payload[0].value} cliques</p>
      </div>
    );
  }
  return null;
};

export default function Tracking() {
  const { selectedBot, bots } = useBots();
  const { user } = useAuth();
  const [apiKey, setApiKey] = useState("");
  const [profileApiKey, setProfileApiKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [trackedLinks, setTrackedLinks] = useState<TrackedLink[]>([]);
  const [creatingLink, setCreatingLink] = useState(false);
  const [domain, setDomain] = useState("linkterbio.com");
  const [apiKeyOpen, setApiKeyOpen] = useState(false);

  // Custom destination for multi-step funnel
  const [customDestination, setCustomDestination] = useState("");
  // Flow type: "direct" | "group" | "crossbot" | "custom"
  const [flowType, setFlowType] = useState<"direct" | "group" | "crossbot" | "custom">("direct");
  const [crossBotId, setCrossBotId] = useState<string>("");
  // Custom funnel steps
  const [customFunnelSteps, setCustomFunnelSteps] = useState<FunnelStep[]>([
    { title: "Etapa 1", type: "bot", identifier: "" },
  ]);
  // New link fields
  const [fallbackUrl, setFallbackUrl] = useState("");
  const [clickLimit, setClickLimit] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  // Main tab
  const [mainTab, setMainTab] = useState("links");

  // View state
  const [view, setView] = useState<"list" | "metrics">("list");
  const [activeLink, setActiveLink] = useState<TrackedLink | null>(null);

  // Stats
  const [stats, setStats] = useState<LinkterStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Period
  const [period, setPeriod] = useState("7d");
  const [customStart, setCustomStart] = useState<Date>();
  const [customEnd, setCustomEnd] = useState<Date>();

  // Editing domain
  const [editingLinkId, setEditingLinkId] = useState<string | null>(null);
  const [editDomain, setEditDomain] = useState("linkterbio.com");
  const [updatingDomain, setUpdatingDomain] = useState(false);

  // Deleting
  const [deletingLinkId, setDeletingLinkId] = useState<string | null>(null);

  const emptyFunnel = {
    clicks: 0, botUsers: 0, pixGenerated: 0, paid: 0,
    directSales: 0, directRevenue: 0,
    orderBumpSales: 0, orderBumpRevenue: 0,
    upsellSales: 0, upsellRevenue: 0,
    downsellSales: 0, downsellRevenue: 0,
    mailingSales: 0, mailingRevenue: 0,
    crossBotSales: 0, crossBotRevenue: 0,
    totalRevenue: 0, avgTicket: 0,
  };

  // Funnel (per link)
  const [funnelData, setFunnelData] = useState(emptyFunnel);

  // Source type breakdown (per link)
  const [sourceBreakdown, setSourceBreakdown] = useState<{source_type: string; count: number; revenue: number}[]>([]);
  const [dailySalesByType, setDailySalesByType] = useState<Record<string, any>[]>([]);

  // Combined funnel (all links)
  const [combinedFunnel, setCombinedFunnel] = useState({ botUsers: 0, pixGenerated: 0, paid: 0, totalRevenue: 0, crossBotSales: 0, crossBotRevenue: 0 });
  const [combinedDailyData, setCombinedDailyData] = useState<{date: string; clicks: number; sales: number}[]>([]);

  const isConnected = !!profileApiKey;

  // Fetch profile API key (account-level, shared across all bots)
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("linkter_api_key")
        .eq("id", user.id)
        .single();
      const key = (data as any)?.linkter_api_key || null;
      setProfileApiKey(key);
      setApiKey(key || "");
      setApiKeyOpen(!key);
    })();
  }, [user]);

  useEffect(() => {
    if (!selectedBot) return;
    loadLinks();
  }, [selectedBot]);

  // Fetch combined funnel when bot or connection changes
  useEffect(() => {
    if (selectedBot && isConnected) fetchCombinedFunnel();
  }, [selectedBot, isConnected]);

  async function loadLinks() {
    if (!selectedBot) return;
    const { data } = await supabase
      .from("tracked_links")
      .select("*")
      .eq("bot_id", selectedBot.id)
      .order("created_at", { ascending: false });
    setTrackedLinks((data || []) as unknown as TrackedLink[]);
  }

  // Load stats only when in metrics view with an active link
  useEffect(() => {
    if (view !== "metrics" || !activeLink || !selectedBot) return;
    fetchStats();
    fetchFunnelData();
  }, [activeLink, period, customStart, customEnd, view]);

  async function fetchStats() {
    if (!activeLink || !selectedBot) return;
    setLoadingStats(true);
    try {
      const body: any = {
        action: "stats",
        bot_id: selectedBot.id,
        link_id: activeLink.linkter_link_id,
      };
      if (period === "7d") body.period = "7d";
      else if (period === "30d") body.period = "30d";
      else if (period === "all") body.period = "all";
      else if (period === "custom" && customStart && customEnd) {
        body.start_date = format(customStart, "yyyy-MM-dd");
        body.end_date = format(customEnd, "yyyy-MM-dd");
      }
      const { data, error } = await supabase.functions.invoke("linkter-api", { body });
      if (error) throw error;
      setStats(data);
    } catch (e: any) {
      console.error("Error fetching stats:", e);
    } finally {
      setLoadingStats(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    await fetchStats();
    await fetchFunnelData();
    setRefreshing(false);
    toast({ title: "Atualizado!", description: "Estatísticas atualizadas." });
  }

  function getDateRange(): { start: string; end: string } | null {
    const now = new Date();
    if (period === '7d') {
      const start = new Date(now);
      start.setDate(start.getDate() - 7);
      return { start: start.toISOString(), end: now.toISOString() };
    }
    if (period === '30d') {
      const start = new Date(now);
      start.setDate(start.getDate() - 30);
      return { start: start.toISOString(), end: now.toISOString() };
    }
    if (period === 'custom' && customStart && customEnd) {
      const end = new Date(customEnd);
      end.setHours(23, 59, 59, 999);
      return { start: customStart.toISOString(), end: end.toISOString() };
    }
    return null; // 'all' - no filter
  }

  async function fetchFunnelData() {
    if (!activeLink || !selectedBot) return;
    const range = getDateRange();

    // Bot users query (no date filter - they are created once)
    const usersQuery = supabase.from("bot_users").select("id", { count: "exact", head: true })
      .eq("bot_id", selectedBot.id).eq("tracked_link_id", activeLink.id);

    // Payment queries with date filter
    let pixQuery = supabase.from("payment_orders").select("id", { count: "exact", head: true })
      .eq("bot_id", selectedBot.id).eq("tracked_link_id", activeLink.id);
    let paidQuery = supabase.from("payment_orders").select("id", { count: "exact", head: true })
      .eq("bot_id", selectedBot.id).eq("tracked_link_id", activeLink.id).eq("status", "paid");
    let sourceQuery = supabase.from("payment_orders").select("source_type, amount")
      .eq("bot_id", selectedBot.id).eq("tracked_link_id", activeLink.id).eq("status", "paid");
    let dailyQuery = supabase.from("payment_orders").select("source_type, created_at")
      .eq("bot_id", selectedBot.id).eq("tracked_link_id", activeLink.id).eq("status", "paid");

    if (range) {
      pixQuery = pixQuery.gte("created_at", range.start).lte("created_at", range.end);
      paidQuery = paidQuery.gte("created_at", range.start).lte("created_at", range.end);
      sourceQuery = sourceQuery.gte("created_at", range.start).lte("created_at", range.end);
      dailyQuery = dailyQuery.gte("created_at", range.start).lte("created_at", range.end);
    }

    const [usersRes, pixRes, paidRes, sourceRes, dailyRes] = await Promise.all([
      usersQuery, pixQuery, paidQuery, sourceQuery, dailyQuery,
    ]);

    // Aggregate source breakdown
    const sourceData = sourceRes.data || [];
    const map: Record<string, { count: number; revenue: number }> = {};
    let totalRevenue = 0;
    sourceData.forEach((o: any) => {
      const st = o.source_type || 'direct';
      if (!map[st]) map[st] = { count: 0, revenue: 0 };
      map[st].count++;
      map[st].revenue += Number(o.amount);
      totalRevenue += Number(o.amount);
    });
    setSourceBreakdown(Object.entries(map).map(([source_type, v]) => ({ source_type, ...v })).sort((a, b) => b.revenue - a.revenue));

    // Build daily sales by type for stacked bar chart
    const dailyMap: Record<string, Record<string, number>> = {};
    (dailyRes.data || []).forEach((o: any) => {
      const day = o.created_at?.substring(0, 10) || 'unknown';
      const st = o.source_type || 'direct';
      if (!dailyMap[day]) dailyMap[day] = {};
      dailyMap[day][st] = (dailyMap[day][st] || 0) + 1;
    });
    const sortedDays = Object.keys(dailyMap).sort();
    setDailySalesByType(sortedDays.map(day => ({
      date: format(new Date(day + 'T12:00:00'), 'dd/MM'),
      direct: dailyMap[day]['direct'] || 0,
      order_bump: dailyMap[day]['order_bump'] || 0,
      upsell: dailyMap[day]['upsell'] || 0,
      downsell: dailyMap[day]['downsell'] || 0,
      mailing: dailyMap[day]['mailing'] || 0,
      cross_bot: dailyMap[day]['cross_bot'] || 0,
    })));

    const paidCount = paidRes.count || 0;
    setFunnelData({
      clicks: stats?.total_clicks || 0,
      botUsers: usersRes.count || 0,
      pixGenerated: pixRes.count || 0,
      paid: paidCount,
      directSales: map['direct']?.count || 0,
      directRevenue: map['direct']?.revenue || 0,
      orderBumpSales: map['order_bump']?.count || 0,
      orderBumpRevenue: map['order_bump']?.revenue || 0,
      upsellSales: map['upsell']?.count || 0,
      upsellRevenue: map['upsell']?.revenue || 0,
      downsellSales: map['downsell']?.count || 0,
      downsellRevenue: map['downsell']?.revenue || 0,
      mailingSales: map['mailing']?.count || 0,
      mailingRevenue: map['mailing']?.revenue || 0,
      crossBotSales: map['cross_bot']?.count || 0,
      crossBotRevenue: map['cross_bot']?.revenue || 0,
      totalRevenue,
      avgTicket: paidCount > 0 ? totalRevenue / paidCount : 0,
    });
  }

  async function fetchCombinedFunnel() {
    if (!selectedBot) return;
    const [usersRes, pixRes, paidRes, salesRes, crossBotRes] = await Promise.all([
      supabase.from("bot_users").select("id", { count: "exact", head: true })
        .eq("bot_id", selectedBot.id).not("tracked_link_id", "is", null),
      supabase.from("payment_orders").select("id", { count: "exact", head: true })
        .eq("bot_id", selectedBot.id).not("tracked_link_id", "is", null),
      supabase.from("payment_orders").select("id, amount", { count: "exact" })
        .eq("bot_id", selectedBot.id).not("tracked_link_id", "is", null).eq("status", "paid"),
      supabase.from("payment_orders").select("created_at, status")
        .eq("bot_id", selectedBot.id).not("tracked_link_id", "is", null)
        .gte("created_at", new Date(Date.now() - 30 * 86400000).toISOString()),
      // Cross-bot upsell sales: orders where original_bot_id = current bot with source_type 'cross_bot'
      supabase.from("payment_orders").select("id, amount")
        .eq("original_bot_id", selectedBot.id).eq("status", "paid").eq("source_type", "cross_bot"),
    ]);

    const paidData = paidRes.data || [];
    const totalRevenue = paidData.reduce((sum: number, o: any) => sum + Number(o.amount || 0), 0);

    const crossBotData = crossBotRes.data || [];
    const crossBotSales = crossBotData.length;
    const crossBotRevenue = crossBotData.reduce((sum: number, o: any) => sum + Number(o.amount || 0), 0);

    // Build daily chart data (last 30 days)
    const dailyMap: Record<string, { clicks: number; sales: number }> = {};
    (salesRes.data || []).forEach((o: any) => {
      const day = o.created_at?.substring(0, 10);
      if (!day) return;
      if (!dailyMap[day]) dailyMap[day] = { clicks: 0, sales: 0 };
      dailyMap[day].clicks++;
      if (o.status === 'paid') dailyMap[day].sales++;
    });
    const sortedDays = Object.keys(dailyMap).sort();
    setCombinedDailyData(sortedDays.map(day => ({
      date: format(new Date(day + 'T12:00:00'), 'dd/MM'),
      clicks: dailyMap[day].clicks,
      sales: dailyMap[day].sales,
    })));

    setCombinedFunnel({
      botUsers: usersRes.count || 0,
      pixGenerated: pixRes.count || 0,
      paid: paidRes.count || 0,
      totalRevenue,
      crossBotSales,
      crossBotRevenue,
    });
  }

  useEffect(() => {
    if (stats) setFunnelData(prev => ({ ...prev, clicks: stats.total_clicks || 0 }));
  }, [stats]);

  async function saveApiKey() {
    if (!user || !apiKey.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ linkter_api_key: apiKey.trim() } as any)
        .eq("id", user.id);
      if (error) throw error;
      setProfileApiKey(apiKey.trim());
      setApiKeyOpen(false);
      toast({ title: "API Key salva!", description: "Linkter conectada à sua conta. Todos os bots usarão esta chave." });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function disconnectApiKey() {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ linkter_api_key: null } as any)
        .eq("id", user.id);
      if (error) throw error;
      setProfileApiKey(null);
      setApiKey("");
      setApiKeyOpen(true);
      toast({ title: "Desconectado", description: "API Key removida da sua conta." });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function createTrackedLink() {
    if (!selectedBot) return;
    setCreatingLink(true);
    try {
      const body: any = {
        action: "create-link",
        bot_id: selectedBot.id,
        domain,
        title: `Riot Vips - ${selectedBot.name}`,
        funnel_type: flowType,
      };
      // For group funnels, pass custom_destination for redirect after bot registration
      if (flowType === "group" && customDestination.trim()) {
        body.custom_destination = customDestination.trim();
      }
      // For crossbot funnels, pass cross_bot_id
      if (flowType === "crossbot" && crossBotId) {
        body.cross_bot_id = crossBotId;
      }
      // For custom funnels, pass funnel_steps
      if (flowType === "custom" && customFunnelSteps.length > 0) {
        const validSteps = customFunnelSteps.filter(s => s.identifier.trim());
        if (validSteps.length === 0) {
          toast({ title: "Erro", description: "Adicione pelo menos uma etapa com identificador válido.", variant: "destructive" });
          setCreatingLink(false);
          return;
        }
        body.funnel_steps = validSteps;
      }
      if (fallbackUrl.trim()) body.fallback_url = fallbackUrl.trim();
      if (clickLimit.trim()) body.click_limit = parseInt(clickLimit);
      if (expiresAt.trim()) body.expires_at = new Date(expiresAt).toISOString();
      const { data, error } = await supabase.functions.invoke("linkter-api", { body });
      if (error) throw error;

      await loadLinks();
      setCustomDestination("");
      setFallbackUrl("");
      setClickLimit("");
      setExpiresAt("");
      setCrossBotId("");
      setCustomFunnelSteps([{ title: "Etapa 1", type: "bot", identifier: "" }]);
      toast({ title: "Link criado!", description: "Link rastreável criado com sucesso." });
    } catch (e: any) {
      toast({ title: "Erro ao criar link", description: e.message, variant: "destructive" });
    } finally {
      setCreatingLink(false);
    }
  }

  async function deleteLink(link: TrackedLink) {
    if (!selectedBot) return;
    setDeletingLinkId(link.linkter_link_id);
    try {
      const { error } = await supabase.functions.invoke("linkter-api", {
        body: { action: "delete-link", bot_id: selectedBot.id, link_id: link.linkter_link_id },
      });
      if (error) throw error;
      await loadLinks();
      if (activeLink?.linkter_link_id === link.linkter_link_id) {
        setActiveLink(null);
        setView("list");
        setStats(null);
        setFunnelData(emptyFunnel);
      }
      toast({ title: "Link excluído!", description: "Link removido da Riot Vips e da Linkter." });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setDeletingLinkId(null);
    }
  }

  async function updateLinkDomain(link: TrackedLink) {
    if (!selectedBot) return;
    setUpdatingDomain(true);
    try {
      const { data, error } = await supabase.functions.invoke("linkter-api", {
        body: {
          action: "update-link",
          bot_id: selectedBot.id,
          link_id: link.linkter_link_id,
          domain: editDomain,
        },
      });
      if (error) throw error;
      await loadLinks();
      setEditingLinkId(null);
      toast({ title: "Domínio atualizado!", description: `Novo domínio: ${editDomain}` });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setUpdatingDomain(false);
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    toast({ title: "Copiado!", description: "Link copiado para a área de transferência." });
  }

  function openMetrics(link: TrackedLink) {
    setActiveLink(link);
    setStats(null);
    setFunnelData(emptyFunnel);
    setView("metrics");
  }

  function backToList() {
    setView("list");
    setActiveLink(null);
    setStats(null);
    setFunnelData(emptyFunnel);
  }

  const funnelSteps = [
    { label: "Cliques no Link", value: funnelData.clicks, icon: Link2, color: "from-violet-500 to-purple-500", revenue: undefined as number | undefined },
    { label: "Entrou no Bot", value: funnelData.botUsers, icon: Users, color: "from-blue-500 to-cyan-500", revenue: undefined as number | undefined },
    { label: "Gerou PIX", value: funnelData.pixGenerated, icon: CreditCard, color: "from-amber-500 to-orange-500", revenue: undefined as number | undefined },
    { label: "Pagou (Total)", value: funnelData.paid, icon: DollarSign, color: "from-emerald-500 to-green-500", revenue: funnelData.totalRevenue },
    { label: "↳ Venda Direta", value: funnelData.directSales, icon: Crosshair, color: "from-emerald-400 to-emerald-600", revenue: funnelData.directRevenue },
    { label: "↳ Order Bump", value: funnelData.orderBumpSales, icon: Plus, color: "from-blue-400 to-blue-600", revenue: funnelData.orderBumpRevenue },
    { label: "↳ Upsell", value: funnelData.upsellSales, icon: TrendingDown, color: "from-violet-400 to-violet-600", revenue: funnelData.upsellRevenue },
    { label: "↳ Downsell", value: funnelData.downsellSales, icon: TrendingDown, color: "from-orange-400 to-orange-600", revenue: funnelData.downsellRevenue },
    { label: "↳ Mailing", value: funnelData.mailingSales, icon: Share2, color: "from-pink-400 to-pink-600", revenue: funnelData.mailingRevenue },
    { label: "↳ Cross-Bot", value: funnelData.crossBotSales, icon: RefreshCw, color: "from-cyan-400 to-cyan-600", revenue: funnelData.crossBotRevenue },
  ];

  if (!selectedBot) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-[60vh] text-muted-foreground">
          Selecione um bot para configurar o trackeamento.
        </div>
      </MainLayout>
    );
  }

  const getDeepLink = (link: TrackedLink) => `https://t.me/${selectedBot.username}?start=link_${link.id}`;

  return (
    <MainLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header - only on list view */}
        {view === "list" && (
          <PageHeader
            icon={Crosshair}
            title="Trackeamento Avançado"
            subtitle={`Integração com Linkter · ${selectedBot.name}`}
            gradient="from-violet-500 to-fuchsia-500"
          />
        )}

        {/* API Key Section - Always show in list view */}
        {view === "list" && isConnected ? (
          <Collapsible open={apiKeyOpen} onOpenChange={setApiKeyOpen}>
            <div className="glass-card animate-fade-in" style={{ animationDelay: "0.05s" }}>
              <CollapsibleTrigger asChild>
                <button className="w-full flex items-center gap-3 p-4 hover:bg-secondary/20 rounded-xl transition-colors">
                  <Settings className="w-5 h-5 text-violet-400" />
                  <span className="text-sm font-medium">Linkter API Key (Conta)</span>
                  <span className="ml-auto flex items-center gap-2">
                    <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full">
                      <Check className="w-3 h-3" /> Conectado
                    </span>
                    <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${apiKeyOpen ? "rotate-180" : ""}`} />
                  </span>
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="px-4 pb-4 pt-0">
                  <p className="text-xs text-muted-foreground mb-3">Esta chave é compartilhada entre todos os seus bots.</p>
                  <div className="flex gap-3">
                    <Input
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="lk_xxxxxxxxxxxxxxxx"
                      type="password"
                      className="font-mono bg-secondary/50 border-violet-500/20 focus:border-violet-500/50"
                    />
                    <Button variant="outline" onClick={disconnectApiKey} disabled={saving} className="border-red-500/30 text-red-400 hover:bg-red-500/10 shrink-0">
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlink className="w-4 h-4 mr-2" />}
                      Desconectar
                    </Button>
                  </div>
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        ) : view === "list" && !isConnected ? (
          <div className="glass-card p-6 animate-fade-in" style={{ animationDelay: "0.05s" }}>
            <div className="flex items-center gap-3 mb-4">
              <Key className="w-5 h-5 text-violet-400" />
              <h2 className="text-lg font-semibold">Configuração da API Key</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Cole sua API Key da Linkter (formato <code className="text-violet-400">lk_xxx</code>).
              Obtenha em <a href="https://linkter.com.br" target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:underline">linkter.com.br</a> → API & Integrações.
              <br /><span className="text-xs">Esta chave será compartilhada entre todos os seus bots.</span>
            </p>
            <div className="flex gap-3">
              <Input
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="lk_xxxxxxxxxxxxxxxx"
                className="font-mono bg-secondary/50 border-violet-500/20 focus:border-violet-500/50"
              />
              <Button onClick={saveApiKey} disabled={saving || !apiKey.trim()} className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 shrink-0">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Conectar"}
              </Button>
            </div>
          </div>
        ) : null}

        {isConnected && view === "list" && (
          <div className="space-y-6">
            {/* ═══ SEÇÃO 1: 3 CARDS + GRÁFICO ═══ */}
            <div className="space-y-4 animate-fade-in" style={{ animationDelay: "0.08s" }}>
              <SectionTitle hint={`Todos os links · ${selectedBot.name}`}>Resumo geral</SectionTitle>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: "Entradas no Bot", value: combinedFunnel.botUsers, icon: Users, color: "bg-blue-500/10 text-blue-400" },
                  { label: "PIX Gerados", value: combinedFunnel.pixGenerated, icon: CreditCard, color: "bg-amber-500/10 text-amber-400" },
                  { label: "Vendas Pagas", value: combinedFunnel.paid, icon: DollarSign, color: "bg-emerald-500/10 text-emerald-400", extra: `R$ ${combinedFunnel.totalRevenue.toFixed(2)}`, valueClass: "text-emerald-400" },
                  { label: "Cross-Bot Upsell", value: combinedFunnel.crossBotSales, icon: RefreshCw, color: "bg-cyan-500/10 text-cyan-400", extra: combinedFunnel.crossBotRevenue > 0 ? `R$ ${combinedFunnel.crossBotRevenue.toFixed(2)}` : undefined },
                ].map((item: any, i) => (
                  <HeroCard
                    key={i}
                    icon={item.icon}
                    label={item.label}
                    value={item.value.toLocaleString()}
                    footnote={item.extra}
                    color={item.color}
                    valueClass={item.valueClass}
                  />
                ))}
              </div>

              {/* Gráfico combinado: PIX gerados + Vendas pagas (últimos 30 dias) */}
              <div className="glass-card p-6">
                <h4 className="text-sm font-semibold mb-4">Atividade dos Últimos 30 Dias</h4>
                <div className="h-[260px]">
                  {combinedDailyData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={combinedDailyData}>
                        <defs>
                          <linearGradient id="colorClicksMain" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(263 70% 58%)" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="hsl(263 70% 58%)" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="colorSalesMain" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(160 60% 45%)" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="hsl(160 60% 45%)" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 30% 18%)" />
                        <XAxis dataKey="date" stroke="hsl(215 20% 55%)" fontSize={12} tickLine={false} />
                        <YAxis stroke="hsl(215 20% 55%)" fontSize={12} tickLine={false} allowDecimals={false} />
                        <Tooltip contentStyle={{ backgroundColor: 'hsl(220 25% 12%)', border: '1px solid hsl(263 50% 40% / 0.3)', borderRadius: '8px', color: 'hsl(215 20% 85%)' }} />
                        <Legend />
                        <Area type="monotone" dataKey="clicks" name="PIX Gerados" stroke="hsl(263 70% 58%)" strokeWidth={2} fillOpacity={1} fill="url(#colorClicksMain)" />
                        <Area type="monotone" dataKey="sales" name="Vendas Pagas" stroke="hsl(160 60% 45%)" strokeWidth={2} fillOpacity={1} fill="url(#colorSalesMain)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-sm text-muted-foreground">Sem atividade nos últimos 30 dias</div>
                  )}
                </div>
              </div>
            </div>

            {/* ═══ SEÇÃO 2: CRIAR LINK RASTREÁVEL ═══ */}
            <div className="glass-card p-6 animate-fade-in" style={{ animationDelay: "0.12s" }}>
              <div className="flex items-center gap-3 mb-4">
                <Plus className="w-5 h-5 text-violet-400" />
                <h2 className="text-lg font-semibold">Criar Link Rastreável</h2>
              </div>

              <div className="space-y-4">
                {/* Flow type selector */}
                <div>
                  <label className="text-xs text-muted-foreground mb-2 block font-medium">Tipo de Funil</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => { setFlowType("direct"); setCustomDestination(""); }}
                      className={cn(
                        "p-3 rounded-xl border text-left transition-all",
                        flowType === "direct"
                          ? "border-violet-500 bg-violet-500/10 shadow-lg shadow-violet-500/10"
                          : "border-border/50 bg-secondary/20 hover:border-violet-500/30"
                      )}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <div className={cn("w-3 h-3 rounded-full border-2", flowType === "direct" ? "border-violet-500 bg-violet-500" : "border-muted-foreground")} />
                        <span className="text-sm font-semibold inline-flex items-center gap-1.5"><Crosshair className="w-3.5 h-3.5" /> Direto</span>
                      </div>
                      <p className="text-xs text-muted-foreground ml-5">Link → Bot → Venda</p>
                      <div className="flex items-center gap-1 mt-2 ml-5">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300">Link</span>
                        <span className="text-muted-foreground text-[10px]">→</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300">Bot</span>
                        <span className="text-muted-foreground text-[10px]">→</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">Venda</span>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFlowType("group")}
                      className={cn(
                        "p-3 rounded-xl border text-left transition-all",
                        flowType === "group"
                          ? "border-violet-500 bg-violet-500/10 shadow-lg shadow-violet-500/10"
                          : "border-border/50 bg-secondary/20 hover:border-violet-500/30"
                      )}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <div className={cn("w-3 h-3 rounded-full border-2", flowType === "group" ? "border-violet-500 bg-violet-500" : "border-muted-foreground")} />
                        <span className="text-sm font-semibold inline-flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> Grupo</span>
                      </div>
                      <p className="text-xs text-muted-foreground ml-5">Link → Bot → Grupo → Bot → Venda</p>
                      <div className="flex items-center gap-1 mt-2 ml-5 flex-wrap">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300">Link</span>
                        <span className="text-muted-foreground text-[10px]">→</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300">Bot</span>
                        <span className="text-muted-foreground text-[10px]">→</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">Grupo</span>
                        <span className="text-muted-foreground text-[10px]">→</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">Venda</span>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => { setFlowType("crossbot"); setCustomDestination(""); }}
                      className={cn(
                        "p-3 rounded-xl border text-left transition-all",
                        flowType === "crossbot"
                          ? "border-violet-500 bg-violet-500/10 shadow-lg shadow-violet-500/10"
                          : "border-border/50 bg-secondary/20 hover:border-violet-500/30"
                      )}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <div className={cn("w-3 h-3 rounded-full border-2", flowType === "crossbot" ? "border-violet-500 bg-violet-500" : "border-muted-foreground")} />
                        <span className="text-sm font-semibold inline-flex items-center gap-1.5"><ArrowRightLeft className="w-3.5 h-3.5" /> Cross-Bot</span>
                      </div>
                      <p className="text-xs text-muted-foreground ml-5">Bot 1 → Venda → Bot 2 → Venda</p>
                      <div className="flex items-center gap-1 mt-2 ml-5 flex-wrap">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300">Bot 1</span>
                        <span className="text-muted-foreground text-[10px]">→</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">Venda</span>
                        <span className="text-muted-foreground text-[10px]">→</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300">Bot 2</span>
                        <span className="text-muted-foreground text-[10px]">→</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">Venda</span>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => { setFlowType("custom"); setCustomDestination(""); setCrossBotId(""); }}
                      className={cn(
                        "p-3 rounded-xl border text-left transition-all",
                        flowType === "custom"
                          ? "border-pink-500 bg-pink-500/10 shadow-lg shadow-pink-500/10"
                          : "border-border/50 bg-secondary/20 hover:border-pink-500/30"
                      )}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <div className={cn("w-3 h-3 rounded-full border-2", flowType === "custom" ? "border-pink-500 bg-pink-500" : "border-muted-foreground")} />
                        <span className="text-sm font-semibold inline-flex items-center gap-1.5"><Puzzle className="w-3.5 h-3.5" /> Personalizado</span>
                      </div>
                      <p className="text-xs text-muted-foreground ml-5">Monte seu próprio funil com etapas customizadas.</p>
                      <div className="flex items-center gap-1 mt-2 ml-5 flex-wrap">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300">Link</span>
                        <span className="text-muted-foreground text-[10px]">→</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300">Bot</span>
                        <span className="text-muted-foreground text-[10px]">→</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-pink-500/20 text-pink-300">...</span>
                        <span className="text-muted-foreground text-[10px]">→</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">Venda</span>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Group flow: custom destination input */}
                {flowType === "group" && (
                  <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 space-y-3">
                    <p className="text-xs text-blue-300">
                      💡 O link rastreável levará o membro ao bot primeiro (para salvar a atribuição), e o bot enviará automaticamente o link do grupo/canal configurado no <strong>VIP Link</strong> do bot.
                      {selectedBot.vip_link 
                        ? <span className="block mt-1 text-emerald-300">✅ VIP Link configurado: <code className="font-mono">{selectedBot.vip_link}</code></span>
                        : <span className="block mt-1 text-red-300">⚠️ VIP Link não configurado. Configure na página de edição do bot.</span>
                      }
                    </p>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Destino customizado (opcional - sobrescreve VIP Link)</label>
                      <Input
                        value={customDestination}
                        onChange={(e) => setCustomDestination(e.target.value)}
                        placeholder={selectedBot.vip_link || "https://t.me/+abc123 (link do grupo/canal)"}
                        className="bg-secondary/50 border-blue-500/20 focus:border-blue-500/50 text-sm"
                      />
                    </div>
                  </div>
                )}

                {/* Cross-bot flow: bot selector */}
                {flowType === "crossbot" && (
                  <div className="p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/20 space-y-3">
                    <p className="text-xs text-cyan-300">
                      🔗 O link leva ao Bot 1. Após a compra, o lead é direcionado ao Bot 2 selecionado abaixo. As vendas do Bot 2 serão rastreadas como upsell deste funil.
                    </p>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Selecione o Bot 2 (destino do upsell)</label>
                      <Select value={crossBotId} onValueChange={setCrossBotId}>
                        <SelectTrigger className="bg-secondary/50 border-cyan-500/20 focus:border-cyan-500/50">
                          <SelectValue placeholder="Selecione o bot de destino" />
                        </SelectTrigger>
                        <SelectContent>
                          {bots.filter(b => b.id !== selectedBot?.id).map(b => (
                            <SelectItem key={b.id} value={b.id}>@{b.username} - {b.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {bots.filter(b => b.id !== selectedBot?.id).length === 0 && (
                        <p className="text-xs text-red-300 mt-1">⚠️ Você precisa ter pelo menos 2 bots criados para usar este tipo de funil.</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Custom funnel builder */}
                {flowType === "custom" && (
                  <div className="p-4 rounded-lg bg-pink-500/10 border border-pink-500/20 space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-pink-300 font-medium">
                        🧩 Monte as etapas do seu funil personalizado. O link e a venda são automáticos.
                      </p>
                    </div>

                    {/* Visual flow preview */}
                    <div className="flex items-center gap-1 flex-wrap p-3 rounded-lg bg-secondary/30">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300 font-medium">Link</span>
                      <span className="text-muted-foreground text-[10px]">→</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-medium">Bot Principal</span>
                      {customFunnelSteps.map((step, i) => {
                        const stepInfo = STEP_TYPE_LABELS[step.type];
                        return (
                          <span key={i} className="contents">
                            <span className="text-muted-foreground text-[10px]">→</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${stepInfo.color} font-medium inline-flex items-center gap-0.5`}>
                              <stepInfo.Icon className="w-2.5 h-2.5" /> {step.title || stepInfo.label}
                            </span>
                          </span>
                        );
                      })}
                      <span className="text-muted-foreground text-[10px]">→</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-medium">Venda</span>
                    </div>

                    {/* Step cards */}
                    <div className="space-y-3">
                      {customFunnelSteps.map((step, index) => (
                        <div key={index} className="p-3 rounded-lg bg-secondary/30 border border-border/30 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-muted-foreground">Etapa {index + 1}</span>
                            {customFunnelSteps.length > 1 && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setCustomFunnelSteps(prev => prev.filter((_, i) => i !== index))}
                                className="h-6 w-6 p-0 text-muted-foreground hover:text-red-400"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <div>
                              <label className="text-[10px] text-muted-foreground mb-0.5 block">Título</label>
                              <Input
                                value={step.title}
                                onChange={(e) => {
                                  const updated = [...customFunnelSteps];
                                  updated[index] = { ...step, title: e.target.value };
                                  setCustomFunnelSteps(updated);
                                }}
                                placeholder="Ex: Grupo de Aquecimento"
                                className="h-8 text-xs bg-secondary/50 border-pink-500/20"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-muted-foreground mb-0.5 block">Tipo</label>
                              <Select
                                value={step.type}
                                onValueChange={(val) => {
                                  const updated = [...customFunnelSteps];
                                  updated[index] = { ...step, type: val as FunnelStep["type"] };
                                  setCustomFunnelSteps(updated);
                                }}
                              >
                                <SelectTrigger className="h-8 text-xs bg-secondary/50 border-pink-500/20">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {Object.entries(STEP_TYPE_LABELS).map(([key, info]) => (
                                    <SelectItem key={key} value={key}><span className="inline-flex items-center gap-1"><info.Icon className="w-3 h-3" /> {info.label}</span></SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <label className="text-[10px] text-muted-foreground mb-0.5 block">Identificador</label>
                              <Input
                                value={step.identifier}
                                onChange={(e) => {
                                  const updated = [...customFunnelSteps];
                                  updated[index] = { ...step, identifier: e.target.value };
                                  setCustomFunnelSteps(updated);
                                }}
                                placeholder={STEP_TYPE_LABELS[step.type]?.placeholder || ""}
                                className="h-8 text-xs bg-secondary/50 border-pink-500/20"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setCustomFunnelSteps(prev => [...prev, { title: `Etapa ${prev.length + 1}`, type: "group", identifier: "" }])}
                      className="w-full border-pink-500/30 text-pink-300 hover:bg-pink-500/10"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar Etapa
                    </Button>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1">
                    <label className="text-xs text-muted-foreground mb-1 block">Domínio</label>
                    <Select value={domain} onValueChange={setDomain}>
                      <SelectTrigger className="bg-secondary/50 border-violet-500/20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DOMAINS.map(d => (
                          <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Advanced options */}
                <Collapsible>
                  <CollapsibleTrigger asChild>
                    <button className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
                      <Settings className="w-3.5 h-3.5" />
                      <span>Opções avançadas</span>
                      <ChevronDown className="w-3 h-3" />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-3 space-y-3">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">URL de Fallback (opcional)</label>
                      <Input
                        value={fallbackUrl}
                        onChange={(e) => setFallbackUrl(e.target.value)}
                        placeholder="https://meusite.com (exibida quando o link expirar)"
                        className="bg-secondary/50 border-violet-500/20 focus:border-violet-500/50 text-sm"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                          <ShieldOff className="w-3 h-3" /> Limite de Cliques (opcional)
                        </label>
                        <Input
                          value={clickLimit}
                          onChange={(e) => setClickLimit(e.target.value.replace(/\D/g, ""))}
                          placeholder="Ex: 1000"
                          type="text"
                          className="bg-secondary/50 border-violet-500/20 focus:border-violet-500/50 text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                          <Timer className="w-3 h-3" /> Data de Expiração (opcional)
                        </label>
                        <Input
                          value={expiresAt}
                          onChange={(e) => setExpiresAt(e.target.value)}
                          type="datetime-local"
                          className="bg-secondary/50 border-violet-500/20 focus:border-violet-500/50 text-sm"
                        />
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                <div className="flex items-center justify-end">
                  <Button onClick={createTrackedLink} disabled={creatingLink} className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700">
                    {creatingLink ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                    Criar Link Rastreável
                  </Button>
                </div>
              </div>
            </div>

            {/* ═══ SEÇÃO 3: LINKS RASTREÁVEIS + DOMÍNIOS ═══ */}
            <Tabs value={mainTab} onValueChange={setMainTab} className="animate-fade-in" style={{ animationDelay: "0.15s" }}>
              <TabsList className="bg-secondary/50 mb-4">
                <TabsTrigger value="links" className="gap-1.5"><Link2 className="w-3.5 h-3.5" /> Links ({trackedLinks.length})</TabsTrigger>
                <TabsTrigger value="domains" className="gap-1.5"><Globe className="w-3.5 h-3.5" /> Domínios</TabsTrigger>
              </TabsList>

              <TabsContent value="links">
                <div className="glass-card p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <Link2 className="w-5 h-5 text-violet-400" />
                    <h2 className="text-lg font-semibold">Links Rastreáveis</h2>
                  </div>

                  {trackedLinks.length > 0 ? (
                    <div className="space-y-3">
                      {trackedLinks.map(link => {
                        const isEditing = editingLinkId === link.linkter_link_id;
                        const isDeleting = deletingLinkId === link.linkter_link_id;
                        const deepLink = getDeepLink(link);
                        const isCustomDest = !link.destination_url.includes(`?start=link_`);
                        return (
                          <div key={link.id} className="p-3 rounded-xl bg-secondary/30 border border-transparent hover:border-violet-500/20 transition-all">
                            <div className="flex items-center gap-3">
                              <ExternalLink className="w-4 h-4 text-violet-400 shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="font-mono text-sm text-violet-300 truncate">{link.short_url}</p>
                                  {(() => {
                                    const ft = (link as any).funnel_type || 'direct';
                                    const info = FUNNEL_LABELS[ft] || FUNNEL_LABELS.direct;
                                    return (
                                      <span className={`text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap ${info.color} inline-flex items-center gap-0.5`}>
                                        <info.Icon className="w-2.5 h-2.5" /> {info.label}
                                      </span>
                                    );
                                  })()}
                                  {(link as any).cross_bot_id && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 whitespace-nowrap flex items-center gap-1">
                                      <ArrowRightLeft className="w-2.5 h-2.5" /> Cross-Bot
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground truncate">→ {link.destination_url}</p>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <Button size="sm" variant="ghost" onClick={() => openMetrics(link)} className="text-muted-foreground hover:text-violet-400" title="Ver métricas">
                                  <Eye className="w-4 h-4" />
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => { setEditingLinkId(link.linkter_link_id); setEditDomain("linkterbio.com"); }} className="text-muted-foreground hover:text-violet-400" title="Editar domínio">
                                  <Pencil className="w-4 h-4" />
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => copyToClipboard(link.short_url)} className="text-muted-foreground hover:text-violet-400" title="Copiar link">
                                  <Copy className="w-4 h-4" />
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => deleteLink(link)} disabled={isDeleting} className="text-muted-foreground hover:text-red-400" title="Excluir link">
                                  {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                </Button>
                              </div>
                            </div>
                            {isEditing && (
                              <div className="flex items-center gap-2 mt-2 ml-7">
                                <Select value={editDomain} onValueChange={setEditDomain}>
                                  <SelectTrigger className="h-8 bg-secondary/50 border-violet-500/20 text-xs w-[180px]">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {DOMAINS.map(d => (
                                      <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Button size="sm" onClick={() => updateLinkDomain(link)} disabled={updatingDomain} className="h-8 bg-gradient-to-r from-violet-600 to-purple-600 text-xs">
                                  {updatingDomain ? <Loader2 className="w-3 h-3 animate-spin" /> : "Salvar"}
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => setEditingLinkId(null)} className="h-8 text-xs">
                                  Cancelar
                                </Button>
                              </div>
                            )}
                            {isCustomDest && (
                              <div className="mt-2 ml-7 p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
                                <p className="text-xs text-blue-300 mb-1">🔗 Deep Link para botões de canal/grupo:</p>
                                <div className="flex items-center gap-2">
                                  <code className="text-xs text-blue-400 font-mono truncate flex-1">{deepLink}</code>
                                  <Button size="sm" variant="ghost" onClick={() => copyToClipboard(deepLink)} className="h-6 px-2 text-blue-400 hover:text-blue-300">
                                    <Copy className="w-3 h-3" />
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Nenhum link rastreável criado ainda. Use a seção acima para criar um.</p>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="domains">
                <DomainsTab />
              </TabsContent>
            </Tabs>
          </div>
        )}

        {/* METRICS VIEW */}
        {isConnected && view === "metrics" && activeLink && (
          <>
            {/* Back + Title + Refresh */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 animate-fade-in" style={{ animationDelay: "0.1s" }}>
              <Button size="sm" variant="ghost" onClick={backToList} className="self-start">
                <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
              </Button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-mono text-sm text-violet-400 truncate">{activeLink.short_url}</p>
                  {(() => {
                    const ft = (activeLink as any).funnel_type || 'direct';
                    const info = FUNNEL_LABELS[ft] || FUNNEL_LABELS.direct;
                    return (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap ${info.color} inline-flex items-center gap-0.5`}>
                        <info.Icon className="w-2.5 h-2.5" /> {info.label}
                      </span>
                    );
                  })()}
                </div>
                <p className="text-xs text-muted-foreground">→ {activeLink.destination_url}</p>
              </div>
              <Button size="sm" variant="outline" onClick={handleRefresh} disabled={refreshing} className="border-violet-500/30 hover:bg-violet-500/10 shrink-0">
                <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
                Atualizar
              </Button>
            </div>

            {/* Cloaker Section */}
            <div className="glass-card p-4 animate-fade-in" style={{ animationDelay: "0.12s" }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <ShieldOff className="w-5 h-5 text-orange-400" />
                  <div>
                    <p className="font-medium text-sm">Cloaker (Proteção Anti-Clone)</p>
                    <p className="text-xs text-muted-foreground">
                      {activeLink.cloaker_enabled
                        ? "Ativo — apenas acessos com parâmetro válido serão redirecionados"
                        : "Desativado — todos os acessos passam normalmente"}
                    </p>
                  </div>
                </div>
                <Switch
                  checked={activeLink.cloaker_enabled || false}
                  onCheckedChange={async (checked) => {
                    const token = checked ? crypto.randomUUID().replace(/-/g, "").substring(0, 16) : null;
                    await supabase
                      .from("tracked_links")
                      .update({ cloaker_enabled: checked, cloaker_token: token } as any)
                      .eq("id", activeLink.id);
                    setActiveLink({ ...activeLink, cloaker_enabled: checked, cloaker_token: token } as any);
                    toast({ title: checked ? "Cloaker ativado!" : "Cloaker desativado" });
                  }}
                />
              </div>
              {activeLink.cloaker_enabled && (
                <div className="mt-4 space-y-3 border-t border-border/30 pt-4">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Parâmetro de URL (adicione no Facebook Ads)</label>
                    <div className="flex items-center gap-2">
                      <code className="text-xs font-mono bg-secondary/50 px-3 py-2 rounded-lg flex-1 text-orange-300">
                        rv_token={activeLink.cloaker_token}
                      </code>
                      <Button size="sm" variant="ghost" onClick={() => {
                        navigator.clipboard.writeText(`rv_token=${activeLink.cloaker_token}`);
                        toast({ title: "Parâmetro copiado!" });
                      }}>
                        <Copy className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">URL segura (redireciona acessos bloqueados)</label>
                    <div className="flex items-center gap-2">
                      <Input
                        value={activeLink.safe_redirect_url || "https://google.com"}
                        onChange={async (e) => {
                          const url = e.target.value;
                          setActiveLink({ ...activeLink, safe_redirect_url: url } as any);
                        }}
                        onBlur={async (e) => {
                          await supabase
                            .from("tracked_links")
                            .update({ safe_redirect_url: e.target.value } as any)
                            .eq("id", activeLink.id);
                        }}
                        placeholder="https://google.com"
                        className="bg-secondary/50 border-orange-500/20 text-sm flex-1"
                      />
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
                    <p className="text-xs text-orange-300">
                      ⚠️ <strong>ATENÇÃO:</strong> Se ativar o Cloaker sem configurar os parâmetros no Facebook Ads, TODOS os acessos serão bloqueados. Use apenas com tráfego pago do Facebook.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Period Filter */}
            <div className="flex flex-wrap items-center gap-3 animate-fade-in" style={{ animationDelay: "0.15s" }}>
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger className="w-[200px] bg-secondary/50 border-violet-500/20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERIODS.map(p => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {period === "custom" && (
                <div className="flex items-center gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-[140px] justify-start text-left font-normal border-violet-500/20", !customStart && "text-muted-foreground")}>
                        <CalendarIcon className="w-4 h-4 mr-2" />
                        {customStart ? format(customStart, "dd/MM/yyyy") : "Início"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={customStart} onSelect={setCustomStart} initialFocus className={cn("p-3 pointer-events-auto")} />
                    </PopoverContent>
                  </Popover>
                  <span className="text-muted-foreground text-sm">até</span>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-[140px] justify-start text-left font-normal border-violet-500/20", !customEnd && "text-muted-foreground")}>
                        <CalendarIcon className="w-4 h-4 mr-2" />
                        {customEnd ? format(customEnd, "dd/MM/yyyy") : "Fim"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={customEnd} onSelect={setCustomEnd} initialFocus className={cn("p-3 pointer-events-auto")} />
                    </PopoverContent>
                  </Popover>
                </div>
              )}
            </div>

            {loadingStats ? (
              <div className="glass-card p-12 flex items-center justify-center animate-fade-in">
                <Loader2 className="w-8 h-8 animate-spin text-violet-400" />
              </div>
            ) : stats ? (
              <>
                {/* ═══ SEÇÃO 1: TRÁFEGO ═══ */}
                <div className="space-y-4 animate-fade-in">
                  <SectionTitle>Tráfego & Cliques</SectionTitle>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                      { label: "Total de Cliques", value: stats.total_clicks, icon: BarChart3, color: "bg-violet-500/10 text-violet-400" },
                      { label: "Visitantes Únicos", value: stats.unique_visitors, icon: Users, color: "bg-blue-500/10 text-blue-400" },
                      { label: "Retornantes", value: stats.returning_visitors, icon: TrendingDown, color: "bg-amber-500/10 text-amber-400" },
                      { label: "Fontes", value: stats.top_sources?.length || 0, icon: Share2, color: "bg-pink-500/10 text-pink-400" },
                    ].map((item, i) => (
                      <HeroCard key={i} icon={item.icon} label={item.label} value={(item.value || 0).toLocaleString()} color={item.color} />
                    ))}
                  </div>
                  {/* Gráfico de Cliques por Dia */}
                  <div className="glass-card p-6">
                    <h4 className="text-sm font-semibold mb-4">Cliques por Dia</h4>
                    <div className="h-[280px]">
                      {stats.clicks_per_day?.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={stats.clicks_per_day}>
                            <defs>
                              <linearGradient id="colorClicks" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="hsl(263 70% 58%)" stopOpacity={0.4} />
                                <stop offset="95%" stopColor="hsl(263 70% 58%)" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 30% 18%)" />
                            <XAxis dataKey="date" stroke="hsl(215 20% 55%)" fontSize={12} tickLine={false} />
                            <YAxis stroke="hsl(215 20% 55%)" fontSize={12} tickLine={false} />
                            <Tooltip content={<ChartTooltip />} />
                            <Area type="monotone" dataKey="clicks" stroke="hsl(263 70% 58%)" strokeWidth={2} fillOpacity={1} fill="url(#colorClicks)" />
                          </AreaChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex items-center justify-center h-full text-sm text-muted-foreground">Sem dados de cliques no período</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* ═══ SEÇÃO 2: VENDAS & RECEITA ═══ */}
                <div className="space-y-4 animate-fade-in">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-emerald-400" /> Vendas & Receita
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="glass-card p-4 border-emerald-500/20">
                      <div className="flex items-center gap-2 mb-2">
                        <DollarSign className="w-4 h-4 text-emerald-400" />
                        <span className="text-xs text-muted-foreground">Receita Total</span>
                      </div>
                      <p className="text-2xl font-bold font-mono text-emerald-400">R$ {funnelData.totalRevenue.toFixed(2)}</p>
                    </div>
                    <div className="glass-card p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <CreditCard className="w-4 h-4 text-amber-400" />
                        <span className="text-xs text-muted-foreground">Ticket Médio</span>
                      </div>
                      <p className="text-2xl font-bold font-mono">R$ {funnelData.avgTicket.toFixed(2)}</p>
                    </div>
                    <div className="glass-card p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Eye className="w-4 h-4 text-blue-400" />
                        <span className="text-xs text-muted-foreground">PIX Gerados</span>
                      </div>
                      <p className="text-2xl font-bold font-mono">{funnelData.pixGenerated}</p>
                    </div>
                    <div className="glass-card p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Crosshair className="w-4 h-4 text-violet-400" />
                        <span className="text-xs text-muted-foreground">Taxa Conversão</span>
                      </div>
                      <p className="text-2xl font-bold font-mono">
                        {funnelData.pixGenerated > 0 ? ((funnelData.paid / funnelData.pixGenerated) * 100).toFixed(1) : '0.0'}%
                      </p>
                    </div>
                  </div>
                  {/* Gráfico de Vendas por Tipo */}
                  <div className="glass-card p-6">
                    <h4 className="text-sm font-semibold mb-4">Evolução de Vendas por Tipo</h4>
                    <div className="h-[280px]">
                      {dailySalesByType.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={dailySalesByType}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 30% 18%)" />
                            <XAxis dataKey="date" stroke="hsl(215 20% 55%)" fontSize={12} tickLine={false} />
                            <YAxis stroke="hsl(215 20% 55%)" fontSize={12} tickLine={false} allowDecimals={false} />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: 'hsl(220 25% 12%)',
                                border: '1px solid hsl(263 50% 40% / 0.3)',
                                borderRadius: '8px',
                                color: 'hsl(215 20% 85%)',
                              }}
                            />
                            <Legend />
                            <Bar dataKey="direct" name="Direta" stackId="a" fill="hsl(160 60% 45%)" radius={[0, 0, 0, 0]} />
                            <Bar dataKey="order_bump" name="Order Bump" stackId="a" fill="hsl(217 70% 55%)" />
                            <Bar dataKey="upsell" name="Upsell" stackId="a" fill="hsl(263 70% 58%)" />
                            <Bar dataKey="downsell" name="Downsell" stackId="a" fill="hsl(25 80% 55%)" />
                            <Bar dataKey="mailing" name="Mailing" stackId="a" fill="hsl(330 65% 55%)" />
                            <Bar dataKey="cross_bot" name="Cross-Bot" stackId="a" fill="hsl(190 70% 50%)" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex items-center justify-center h-full text-sm text-muted-foreground">Sem vendas no período</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* ═══ SEÇÃO 3: VENDAS POR TIPO ═══ */}
                <div className="space-y-4 animate-fade-in">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                    <Crosshair className="w-4 h-4 text-cyan-400" /> Breakdown por Tipo
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { label: "Direta", value: funnelData.directSales, revenue: funnelData.directRevenue, icon: Crosshair, accent: "text-emerald-400 bg-emerald-500/10" },
                      { label: "Order Bump", value: funnelData.orderBumpSales, revenue: funnelData.orderBumpRevenue, icon: Plus, accent: "text-blue-400 bg-blue-500/10" },
                      { label: "Upsell", value: funnelData.upsellSales, revenue: funnelData.upsellRevenue, icon: TrendingDown, accent: "text-violet-400 bg-violet-500/10" },
                      { label: "Downsell", value: funnelData.downsellSales, revenue: funnelData.downsellRevenue, icon: TrendingDown, accent: "text-orange-400 bg-orange-500/10" },
                    ].map((item, i) => (
                      <div key={i} className="glass-card p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${item.accent}`}>
                            <item.icon className="w-3.5 h-3.5" />
                          </div>
                          <span className="text-xs text-muted-foreground">{item.label}</span>
                        </div>
                        <p className="text-xl font-bold font-mono">{item.value}</p>
                        <p className="text-xs text-muted-foreground">R$ {item.revenue.toFixed(2)}</p>
                      </div>
                    ))}
                  </div>
                  {/* Funil de Conversão visual */}
                  <div className="glass-card p-6">
                    <h4 className="text-sm font-semibold mb-4">Funil de Conversão Completo</h4>
                    <div className="space-y-3">
                      {funnelSteps.map((step, i) => {
                        const maxVal = funnelSteps[0].value || 1;
                        const pct = maxVal > 0 ? ((step.value / maxVal) * 100) : 0;
                        const prevValue = i > 0 ? funnelSteps[i - 1].value : null;
                        const conversionRate = prevValue && prevValue > 0 ? ((step.value / prevValue) * 100).toFixed(1) : null;
                        return (
                          <div key={i}>
                            {i > 0 && conversionRate && (
                              <div className="flex items-center gap-2 ml-8 my-1 text-xs text-muted-foreground">
                                <TrendingDown className="w-3 h-3" />
                                <span>{conversionRate}% conversão</span>
                              </div>
                            )}
                            <div className="flex items-center gap-3">
                              <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${step.color} flex items-center justify-center shrink-0`}>
                                <step.icon className="w-4 h-4 text-white" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-center mb-1">
                                  <span className="text-sm font-medium">{step.label}</span>
                                  <div className="flex items-center gap-2">
                                    {step.revenue !== undefined && <span className="text-xs text-muted-foreground">R$ {step.revenue.toFixed(2)}</span>}
                                    <span className="font-mono text-sm font-bold">{step.value.toLocaleString()}</span>
                                  </div>
                                </div>
                                <div className="h-2 rounded-full bg-secondary overflow-hidden">
                                  <div className={`h-full rounded-full bg-gradient-to-r ${step.color} transition-all duration-700`} style={{ width: `${Math.max(pct, 2)}%` }} />
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* ═══ SEÇÃO 3.5: CROSS-BOT UPSELL ═══ */}
                {(funnelData.crossBotSales > 0 || activeLink?.cross_bot_id) && (
                  <div className="space-y-4 animate-fade-in">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 text-cyan-400" /> Cross-Bot Upsell
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div className="glass-card p-4 border-cyan-500/20">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-cyan-400 bg-cyan-500/10">
                            <RefreshCw className="w-3.5 h-3.5" />
                          </div>
                          <span className="text-xs text-muted-foreground">Vendas Cross-Bot</span>
                        </div>
                        <p className="text-xl font-bold font-mono">{funnelData.crossBotSales}</p>
                        <p className="text-xs text-muted-foreground">R$ {funnelData.crossBotRevenue.toFixed(2)}</p>
                      </div>
                      <div className="glass-card p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-emerald-400 bg-emerald-500/10">
                            <DollarSign className="w-3.5 h-3.5" />
                          </div>
                          <span className="text-xs text-muted-foreground">Receita Total (Bot1 + Bot2)</span>
                        </div>
                        <p className="text-xl font-bold font-mono">R$ {(funnelData.totalRevenue + funnelData.crossBotRevenue).toFixed(2)}</p>
                      </div>
                      <div className="glass-card p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-violet-400 bg-violet-500/10">
                            <Crosshair className="w-3.5 h-3.5" />
                          </div>
                          <span className="text-xs text-muted-foreground">Taxa Cross-Bot</span>
                        </div>
                        <p className="text-xl font-bold font-mono">
                          {funnelData.paid > 0 ? ((funnelData.crossBotSales / funnelData.paid) * 100).toFixed(1) : '0.0'}%
                        </p>
                        <p className="text-xs text-muted-foreground">dos compradores do Bot 1</p>
                      </div>
                    </div>
                    {activeLink?.cross_bot_id && (
                      <div className="glass-card p-4">
                        <div className="flex items-center gap-2">
                          <RefreshCw className="w-4 h-4 text-cyan-400" />
                          <span className="text-sm">Bot 2 vinculado: <strong className="text-cyan-400">
                            @{bots.find(b => b.id === activeLink.cross_bot_id)?.username || 'Desconhecido'}
                          </strong></span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ═══ SEÇÃO 4: AUDIÊNCIA & ORIGENS ═══ */}
                <div className="space-y-4 animate-fade-in">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                    <Globe className="w-4 h-4 text-amber-400" /> Audiência & Origens
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { label: "Mailing", value: funnelData.mailingSales, revenue: funnelData.mailingRevenue, icon: Share2, accent: "text-pink-400 bg-pink-500/10" },
                      { label: "Cross-Bot", value: funnelData.crossBotSales, revenue: funnelData.crossBotRevenue, icon: RefreshCw, accent: "text-cyan-400 bg-cyan-500/10" },
                      { label: "Total Vendas", value: funnelData.paid, revenue: funnelData.totalRevenue, icon: DollarSign, accent: "text-emerald-400 bg-emerald-500/10" },
                      { label: "Entrou no Bot", value: funnelData.botUsers, revenue: undefined, icon: Users, accent: "text-blue-400 bg-blue-500/10" },
                    ].map((item, i) => (
                      <div key={i} className="glass-card p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${item.accent}`}>
                            <item.icon className="w-3.5 h-3.5" />
                          </div>
                          <span className="text-xs text-muted-foreground">{item.label}</span>
                        </div>
                        <p className="text-xl font-bold font-mono">{item.value}</p>
                        {item.revenue !== undefined && <p className="text-xs text-muted-foreground">R$ {item.revenue.toFixed(2)}</p>}
                      </div>
                    ))}
                  </div>
                  {/* Top Países, Dispositivos, Fontes */}
                  <div className="grid md:grid-cols-3 gap-4">
                    {[
                      { title: "Top Países", icon: Globe, data: stats.top_countries, labelKey: "country" },
                      { title: "Dispositivos", icon: Smartphone, data: stats.top_devices, labelKey: "device" },
                      { title: "Fontes de Tráfego", icon: Share2, data: stats.top_sources, labelKey: "source" },
                    ].map((section, i) => (
                      <div key={i} className="glass-card p-5">
                        <div className="flex items-center gap-2 mb-4">
                          <section.icon className="w-4 h-4 text-violet-400" />
                          <h4 className="font-semibold text-sm">{section.title}</h4>
                        </div>
                        {section.data?.length ? (
                          <div className="space-y-3">
                            {section.data.slice(0, 5).map((item: any, j: number) => {
                              const max = section.data[0]?.clicks || 1;
                              return (
                                <div key={j}>
                                  <div className="flex justify-between text-sm mb-1">
                                    <span className="text-muted-foreground">{item[section.labelKey]}</span>
                                    <span className="font-mono">{item.clicks}</span>
                                  </div>
                                  <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                                    <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500" style={{ width: `${(item.clicks / max) * 100}%` }} />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">Sem dados ainda</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Detailed Stats (Navegadores, Regiões, Horários, Conexões) */}
                <DetailedStats
                  botId={selectedBot.id}
                  linkId={activeLink.linkter_link_id}
                  startDate={period === "custom" && customStart ? format(customStart, "yyyy-MM-dd") : undefined}
                  endDate={period === "custom" && customEnd ? format(customEnd, "yyyy-MM-dd") : undefined}
                />
              </>
            ) : (
              <div className="glass-card p-8 text-center text-muted-foreground animate-fade-in">
                Não foi possível carregar as estatísticas. Verifique sua API Key.
              </div>
            )}
          </>
        )}
      </div>
    </MainLayout>
  );
}
