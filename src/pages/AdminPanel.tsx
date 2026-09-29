import { useState, useEffect, useRef } from "react";
import { brtStartOfDay, brtStartOfMonth, formatBrtDate, formatBrtDateTime, formatBrtShort, formatBrtTime } from "@/lib/brtDate";
import { MainLayout } from "@/components/layout/MainLayout";
import { AdminLayout, type AdminNavItem } from "@/components/layout/AdminLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Megaphone, Settings, Users, Send, Loader2, Link as LinkIcon, ShieldCheck, BarChart3,
  Trash2, DollarSign, TrendingUp, Calendar, ShoppingCart, Eye, Trophy, Bot, ArrowLeft, RefreshCw, UserCheck, Download, Sparkles, Key, RefreshCcw, Save, UserPlus, Activity, Target, Filter, AlertTriangle, Mail, History, Percent, Search as SearchIcon
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { PlatformMetrics } from "@/components/admin/PlatformMetrics";
import { AdminOverview } from "@/components/admin/AdminOverview";
import { PageHeader, Panel, StatCard } from "@/components/ui/stat-kit";
import { UserDossier } from "@/components/admin/UserDossier";
import { GlobalCopySearch } from "@/components/admin/GlobalCopySearch";
import { deriveDemoConfig, parseDemoInteger, parseDemoNumber } from "@/lib/deriveDemoConfig";
import { EmailHistory } from "@/components/admin/EmailHistory";
import { BannerHistory } from "@/components/admin/BannerHistory";
import { UserFeeManager } from "@/components/admin/UserFeeManager";

interface BroadcastHistory {
  broadcast_id: string;
  sent: number;
  created_at: string;
}

type AdminTab =
  | 'dashboard' | 'metrics' | 'search' | 'users' | 'broadcast'
  | 'contacts' | 'pix' | 'sellers' | 'emails' | 'demo' | 'settings';

const ADMIN_NAV: AdminNavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: BarChart3, group: 'Visão geral' },
  { id: 'metrics', label: 'Métricas', icon: Activity, group: 'Visão geral' },
  { id: 'users', label: 'Usuários', icon: UserCheck, group: 'Pessoas' },
  { id: 'contacts', label: 'Compradores & Leads', icon: ShoppingCart, group: 'Pessoas' },
  { id: 'sellers', label: 'Top Vendedores', icon: Trophy, group: 'Pessoas' },
  { id: 'pix', label: 'Diagnóstico PIX', icon: AlertTriangle, group: 'Operação' },
  { id: 'broadcast', label: 'Broadcast Telegram', icon: Megaphone, group: 'Operação' },
  { id: 'emails', label: 'E-mails enviados', icon: Mail, group: 'Operação' },
  { id: 'search', label: 'Busca Global', icon: Filter, group: 'Operação' },
  { id: 'demo', label: 'Contas Demo', icon: Sparkles, group: 'Sistema' },
  { id: 'settings', label: 'Configurações', icon: Settings, group: 'Sistema' },
];

export default function AdminPanel() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  // Broadcast state
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [broadcastLink, setBroadcastLink] = useState("");
  const [broadcastLinkText, setBroadcastLinkText] = useState("🔥 Ver Oferta");
  const [broadcastAudience, setBroadcastAudience] = useState<'all' | 'buyers' | 'non_buyers'>('all');
  const [sending, setSending] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState<{ sent: number; failed: number; skipped: number; broadcast_id: string } | null>(null);
  const [broadcastHistory, setBroadcastHistory] = useState<BroadcastHistory[]>([]);
  const [deletingBroadcast, setDeletingBroadcast] = useState<string | null>(null);

  // Registry channel state
  const [registryChannelId, setRegistryChannelId] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);

  // Platform fee & RevantPay config
  const [platformFee, setPlatformFee] = useState("0.60");
  const [platformRevantPayKey, setPlatformRevantPayKey] = useState("");
  const [savingFeeConfig, setSavingFeeConfig] = useState(false);
  
  // Social links
  const [supportInstagram, setSupportInstagram] = useState("");
  const [supportTelegram, setSupportTelegram] = useState("");
  const [supportDiscord, setSupportDiscord] = useState("");
  const [savingSocial, setSavingSocial] = useState(false);

  // Stats
  const [totalLeads, setTotalLeads] = useState(0);
  const [totalBots, setTotalBots] = useState(0);
  const [totalSales, setTotalSales] = useState(0);
  const [revenueToday, setRevenueToday] = useState(0);
  const [revenueMonth, setRevenueMonth] = useState(0);
  const [revenueTotal, setRevenueTotal] = useState(0);
  const [salesToday, setSalesToday] = useState(0);
  const [salesMonth, setSalesMonth] = useState(0);
  const [registeredUsers, setRegisteredUsers] = useState(0);

  // Signup metrics
  const [signupsToday, setSignupsToday] = useState(0);
  const [signupsWeek, setSignupsWeek] = useState(0);
  const [signupsMonth, setSignupsMonth] = useState(0);

  // Funnel metrics
  const [totalOrders, setTotalOrders] = useState(0); // paid + pending
  const [pendingOrdersCount, setPendingOrdersCount] = useState(0);
  const [activeVipsCount, setActiveVipsCount] = useState(0);
  const [leadsToday, setLeadsToday] = useState(0);
  const [leadsMonth, setLeadsMonth] = useState(0);

  // Detailed users list
  const [detailedUsers, setDetailedUsers] = useState<any[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [userFilter, setUserFilter] = useState<'all' | 'sellers' | 'nosale' | 'nobot'>('all');
  const [buyerSearch, setBuyerSearch] = useState("");
  const [leadSearch, setLeadSearch] = useState("");
  const [sellerSearch, setSellerSearch] = useState("");
  const [demoSearch, setDemoSearch] = useState("");
  const [demoOnlyActive, setDemoOnlyActive] = useState(false);

  // Fee stats
  const [feesTotal, setFeesTotal] = useState(0);
  const [feesToday, setFeesToday] = useState(0);
  const [feesMonth, setFeesMonth] = useState(0);
  const [feesTotalCount, setFeesTotalCount] = useState(0);

  // Data
  const [recentBuyers, setRecentBuyers] = useState<any[]>([]);
  const [recentLeads, setRecentLeads] = useState<any[]>([]);
  const [topSellers, setTopSellers] = useState<any[]>([]);
  const [allBots, setAllBots] = useState<any[]>([]);
  const [sellerProfiles, setSellerProfiles] = useState<any[]>([]);
  const [pixDiagnostics, setPixDiagnostics] = useState<any[]>([]);
  const [pixEventStats, setPixEventStats] = useState({ total: 0, pixCreated: 0, textSent: 0, qrSent: 0, failures: 0, withoutAudit: 0 });
  const [pixSearch, setPixSearch] = useState("");
  const [pixBotFilter, setPixBotFilter] = useState<string>("all");
  const [pixSelectedLead, setPixSelectedLead] = useState<string | null>(null);

  // User detail view
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [userDetail, setUserDetail] = useState<any>(null);
  const [loadingUser, setLoadingUser] = useState(false);

  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const loadedTabs = useRef(new Set<AdminTab>());
  const [contactsView, setContactsView] = useState<'buyers' | 'leads'>('buyers');

  // Email history
  const [emailLog, setEmailLog] = useState<any[]>([]);
  const [loadingEmails, setLoadingEmails] = useState(false);
  const [emailSearch, setEmailSearch] = useState("");
  const [emailStatusFilter, setEmailStatusFilter] = useState<'all' | 'sent' | 'failed'>('all');
  const [expandedBatch, setExpandedBatch] = useState<string | null>(null);

  // Banner history
  const [bannerHistory, setBannerHistory] = useState<any[]>([]);

  // Per-user platform fee
  const [feeSearch, setFeeSearch] = useState("");
  const [feeDrafts, setFeeDrafts] = useState<Record<string, string>>({});
  const [savingUserFee, setSavingUserFee] = useState<string | null>(null);
  const [feeProfiles, setFeeProfiles] = useState<any[]>([]);

  const navigateTab = (tab: string) => {
    if (tab === 'buyers') { setContactsView('buyers'); setActiveTab('contacts'); return; }
    if (tab === 'leads') { setContactsView('leads'); setActiveTab('contacts'); return; }
    setActiveTab(tab as AdminTab);
  };

  // Demo accounts state
  const [allProfiles, setAllProfiles] = useState<any[]>([]);
  const [demoSettings, setDemoSettings] = useState<any[]>([]);
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [togglingDemo, setTogglingDemo] = useState<string | null>(null);
  const [demoKeyDrafts, setDemoKeyDrafts] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [syncingDemo, setSyncingDemo] = useState<string | null>(null);
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});
  const [webhookSecretDrafts, setWebhookSecretDrafts] = useState<Record<string, string>>({});
  const [savingSecret, setSavingSecret] = useState<string | null>(null);
  const [generatingDemo, setGeneratingDemo] = useState<string | null>(null);
  const [genCount, setGenCount] = useState<Record<string, string>>({});
  const [genTicket, setGenTicket] = useState<Record<string, string>>({});

  // Configuração rápida (auto-fill) por usuário no admin
  const [quickSaldo, setQuickSaldo] = useState<Record<string, string>>({});
  const [quickTicket, setQuickTicket] = useState<Record<string, string>>({});
  const [quickUsers, setQuickUsers] = useState<Record<string, string>>({});
  // Overrides opcionais (o que o admin digita aqui SEMPRE bate no dashboard)
  const [quickRevToday, setQuickRevToday] = useState<Record<string, string>>({});
  const [quickRevMonth, setQuickRevMonth] = useState<Record<string, string>>({});
  const [quickUsersToday, setQuickUsersToday] = useState<Record<string, string>>({});
  const [applyingQuick, setApplyingQuick] = useState<string | null>(null);

  // Maintenance banner
  const [bannerEnabled, setBannerEnabled] = useState(false);
  const [bannerMessage, setBannerMessage] = useState("Estamos com manutenção no PIX. Assim que voltar, você será notificado no e-mail!");
  const [savingBanner, setSavingBanner] = useState(false);
  const [notifyingEmail, setNotifyingEmail] = useState(false);

  const applyQuickConfig = async (userId: string) => {
    setApplyingQuick(userId);
    try {
      const saldo = parseDemoNumber(quickSaldo[userId]);
      const ticket = parseDemoNumber(quickTicket[userId]);
      const users = parseDemoInteger(quickUsers[userId]);
      if (saldo <= 0 || ticket <= 0) {
        toast({ title: 'Preencha saldo e ticket', description: 'Saldo total e ticket médio são obrigatórios.', variant: 'destructive' });
        return;
      }
      const overrides: any = {};
      const rt = parseDemoNumber(quickRevToday[userId]);
      const rm = parseDemoNumber(quickRevMonth[userId]);
      const ut = parseDemoInteger(quickUsersToday[userId]);
      if (quickRevToday[userId]?.trim()) overrides.revenueToday = rt;
      if (quickRevMonth[userId]?.trim()) overrides.revenueMonth = rm;
      if (quickUsersToday[userId]?.trim()) overrides.usersToday = ut;
      // Derivar sales a partir do ticket quando override de receita for dado
      if (overrides.revenueToday !== undefined) overrides.salesToday = Math.max(0, Math.round(overrides.revenueToday / Math.max(ticket, 0.01)));
      if (overrides.revenueMonth !== undefined) overrides.salesMonth = Math.max(0, Math.round(overrides.revenueMonth / Math.max(ticket, 0.01)));
      const config = deriveDemoConfig(saldo, ticket, users, overrides);
      const existing = demoSettings.find(d => d.user_id === userId);
      if (existing) {
        const { error } = await supabase
          .from('demo_settings')
          .update({ is_active: true, config: config as any, updated_at: new Date().toISOString() })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('demo_settings')
          .insert({ user_id: userId, is_active: true, config: config as any });
        if (error) throw error;
      }
      toast({ title: 'Demo aplicado!', description: 'Métricas preenchidas automaticamente e demo ativado.' });
      await loadDemoAccounts();
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally {
      setApplyingQuick(null);
    }
  };

  async function saveBanner() {
    setSavingBanner(true);
    try {
      const value = JSON.stringify({ enabled: bannerEnabled, message: bannerMessage.trim() });
      const { error } = await supabase
        .from('admin_settings')
        .upsert({ key: 'maintenance_banner', value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
      if (error) throw error;
      // Registra histórico: encerra a mensagem anterior e abre a nova
      const msg = bannerMessage.trim();
      const { data: current } = await supabase
        .from('maintenance_banner_history')
        .select('id, message')
        .is('ended_at', null)
        .order('started_at', { ascending: false })
        .limit(1);
      const open = current?.[0];
      if (open && (open.message !== msg || !bannerEnabled)) {
        await supabase.from('maintenance_banner_history')
          .update({ ended_at: new Date().toISOString() })
          .eq('id', open.id);
      }
      if (bannerEnabled && (!open || open.message !== msg)) {
        await supabase.from('maintenance_banner_history')
          .insert({ message: msg, enabled: true, created_by: user?.id ?? null });
      }
      await loadBannerHistory();
      toast({ title: 'Salvo!', description: bannerEnabled ? 'Banner ativado.' : 'Banner desativado.' });
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally {
      setSavingBanner(false);
    }
  }

  async function notifyByEmail() {
    if (!bannerMessage.trim()) {
      toast({ title: 'Mensagem vazia', description: 'Escreva a mensagem antes de notificar.', variant: 'destructive' });
      return;
    }
    setNotifyingEmail(true);
    try {
      const { data, error } = await supabase.functions.invoke('notify-users-email', {
        body: { subject: 'Aviso Riot Vips', message: bannerMessage.trim() },
      });
      if (error) throw error;
      toast({ title: 'Notificações enviadas!', description: `Enviados: ${data?.sent ?? 0} · Falhas: ${data?.failed ?? 0}` });
      await Promise.all([loadEmailLog(), loadBannerHistory()]);
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally {
      setNotifyingEmail(false);
    }
  }

  async function loadEmailLog() {
    setLoadingEmails(true);
    try {
      const { data } = await supabase
        .from('email_broadcast_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(3000);
      setEmailLog(data || []);
    } finally {
      setLoadingEmails(false);
    }
  }

  async function loadBannerHistory() {
    const { data } = await supabase
      .from('maintenance_banner_history')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(50);
    setBannerHistory(data || []);
  }

  async function loadFeeProfiles() {
    const { data } = await supabase
      .from('profiles')
      .select('id, email, full_name, platform_fee_override')
      .order('created_at', { ascending: false });
    setFeeProfiles(data || []);
  }

  async function saveUserFee(userId: string, raw: string) {
    setSavingUserFee(userId);
    try {
      const trimmed = (raw ?? '').trim().replace(',', '.');
      const value = trimmed === '' ? null : Number(trimmed);
      if (value !== null && (!isFinite(value) || value < 0)) {
        toast({ title: 'Valor inválido', description: 'Informe um número maior ou igual a zero.', variant: 'destructive' });
        return;
      }
      const { error } = await supabase.from('profiles').update({ platform_fee_override: value }).eq('id', userId);
      if (error) throw error;
      toast({ title: 'Taxa atualizada!', description: value === null ? 'Usuário voltou para a taxa global.' : `Taxa individual: R$ ${value.toFixed(2)}` });
      await loadFeeProfiles();
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally {
      setSavingUserFee(null);
    }
  }

  const WEBHOOK_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/revant-webhook`;

  useEffect(() => {
    checkAdmin();
  }, [user]);

  async function checkAdmin() {
    if (!user) return;
    const { data } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' });
    setIsAdmin(!!data);
    setLoading(false);
  }

  useEffect(() => {
    if (!isAdmin || loadedTabs.current.has(activeTab)) return;
    loadedTabs.current.add(activeTab);
    void loadActiveTab(activeTab).catch((error) => {
      loadedTabs.current.delete(activeTab);
      console.error(`Error loading admin tab ${activeTab}:`, error);
    });
  }, [activeTab, isAdmin]);

  async function loadActiveTab(tab: AdminTab) {
    const loaders: Partial<Record<AdminTab, () => Promise<unknown>>> = {
      users: loadDetailedUsers,
      contacts: () => Promise.all([loadBuyers(), loadLeads()]),
      pix: loadPaymentDiagnostics,
      broadcast: loadBroadcastHistory,
      sellers: loadTopSellers,
      emails: loadEmailLog,
      demo: loadDemoAccounts,
      settings: () => Promise.all([loadSettings(), loadBannerHistory(), loadFeeProfiles()]),
    };
    await loaders[tab]?.();
  }

  async function refreshActiveTab() {
    loadedTabs.current.delete(activeTab);
    await loadActiveTab(activeTab);
    loadedTabs.current.add(activeTab);
  }

  async function loadSettings() {
    const [registryRes, feeRes, revantKeyRes, igRes, tgRes, dcRes, bannerRes] = await Promise.all([
      supabase.from('admin_settings').select('*').eq('key', 'registry_channel_id').maybeSingle(),
      supabase.from('admin_settings').select('*').eq('key', 'platform_fee').maybeSingle(),
      supabase.from('admin_settings').select('*').eq('key', 'platform_revantpay_key').maybeSingle(),
      supabase.from('admin_settings').select('*').eq('key', 'support_instagram').maybeSingle(),
      supabase.from('admin_settings').select('*').eq('key', 'support_telegram').maybeSingle(),
      supabase.from('admin_settings').select('*').eq('key', 'support_discord').maybeSingle(),
      supabase.from('admin_settings').select('*').eq('key', 'maintenance_banner').maybeSingle(),
    ]);
    if (registryRes.data) setRegistryChannelId(registryRes.data.value);
    if (feeRes.data) setPlatformFee(feeRes.data.value);
    if (revantKeyRes.data) setPlatformRevantPayKey(revantKeyRes.data.value);
    if (igRes.data) setSupportInstagram(igRes.data.value);
    if (tgRes.data) setSupportTelegram(tgRes.data.value);
    if (dcRes.data) setSupportDiscord(dcRes.data.value);
    if (bannerRes.data?.value) {
      try {
        const parsed = typeof bannerRes.data.value === 'string' ? JSON.parse(bannerRes.data.value) : bannerRes.data.value;
        setBannerEnabled(!!parsed.enabled);
        if (parsed.message) setBannerMessage(parsed.message);
      } catch { /* ignore */ }
    }
  }

  async function loadStats() {
    const today = brtStartOfDay();
    const monthStart = brtStartOfMonth();
    const weekStart = brtStartOfDay(-7);

    const [leadsRes, botsRes, allPaidRes, todayPaidRes, monthPaidRes, profilesRes, profilesListRes,
      signupsTodayRes, signupsWeekRes, signupsMonthRes,
      pendingRes, allOrdersRes, vipsRes, leadsTodayRes, leadsMonthRes,
    ] = await Promise.all([
      supabase.from('bot_users').select('id', { count: 'exact', head: true }),
      supabase.from('bots').select('id, username, name, vip_link, user_id', { count: 'exact' }),
      supabase.from('payment_orders').select('amount, platform_fee').eq('status', 'paid'),
      supabase.from('payment_orders').select('amount, platform_fee').eq('status', 'paid').gte('created_at', today.toISOString()),
      supabase.from('payment_orders').select('amount, platform_fee').eq('status', 'paid').gte('created_at', monthStart.toISOString()),
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase.from('profiles').select('id, email, full_name'),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', today.toISOString()),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', weekStart.toISOString()),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', monthStart.toISOString()),
      supabase.from('payment_orders').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('payment_orders').select('id', { count: 'exact', head: true }),
      supabase.from('vip_members').select('id', { count: 'exact', head: true }).eq('is_active', true).gte('expires_at', new Date().toISOString()),
      supabase.from('bot_users').select('id', { count: 'exact', head: true }).gte('created_at', today.toISOString()),
      supabase.from('bot_users').select('id', { count: 'exact', head: true }).gte('created_at', monthStart.toISOString()),
    ]);

    setTotalLeads(leadsRes.count || 0);
    setTotalBots(botsRes.count || 0);
    setAllBots(botsRes.data || []);
    setTotalSales(allPaidRes.data?.length || 0);
    setRevenueTotal(allPaidRes.data?.reduce((s, o) => s + Number(o.amount), 0) || 0);
    setRevenueToday(todayPaidRes.data?.reduce((s, o) => s + Number(o.amount), 0) || 0);
    setSalesToday(todayPaidRes.data?.length || 0);
    setRevenueMonth(monthPaidRes.data?.reduce((s, o) => s + Number(o.amount), 0) || 0);
    setSalesMonth(monthPaidRes.data?.length || 0);
    setRegisteredUsers(profilesRes.count || 0);
    setSellerProfiles(profilesListRes.data || []);
    setSignupsToday(signupsTodayRes.count || 0);
    setSignupsWeek(signupsWeekRes.count || 0);
    setSignupsMonth(signupsMonthRes.count || 0);
    setPendingOrdersCount(pendingRes.count || 0);
    setTotalOrders(allOrdersRes.count || 0);
    setActiveVipsCount(vipsRes.count || 0);
    setLeadsToday(leadsTodayRes.count || 0);
    setLeadsMonth(leadsMonthRes.count || 0);

    // Fee stats
    setFeesTotal(allPaidRes.data?.reduce((s, o) => s + Number(o.platform_fee || 0), 0) || 0);
    setFeesTotalCount(allPaidRes.data?.length || 0);
    setFeesToday(todayPaidRes.data?.reduce((s, o) => s + Number(o.platform_fee || 0), 0) || 0);
    setFeesMonth(monthPaidRes.data?.reduce((s, o) => s + Number(o.platform_fee || 0), 0) || 0);
  }

  async function loadDetailedUsers() {
    const [profilesRes, botsRes, ordersRes] = await Promise.all([
      supabase.from('profiles').select('id, email, full_name, created_at, avatar_url').order('created_at', { ascending: false }),
      supabase.from('bots').select('id, user_id, username, created_at'),
      supabase.from('payment_orders').select('bot_id, amount, status, created_at, paid_at'),
    ]);
    const profiles = profilesRes.data || [];
    const bots = botsRes.data || [];
    const orders = ordersRes.data || [];

    const botByUser: Record<string, any[]> = {};
    const botOwner: Record<string, string> = {};
    bots.forEach(b => {
      botOwner[b.id] = b.user_id;
      (botByUser[b.user_id] ||= []).push(b);
    });

    const stats: Record<string, { revenue: number; sales: number; pending: number; lastSale?: string }> = {};
    orders.forEach(o => {
      const uid = botOwner[o.bot_id];
      if (!uid) return;
      const s = (stats[uid] ||= { revenue: 0, sales: 0, pending: 0 });
      if (o.status === 'paid') {
        s.revenue += Number(o.amount);
        s.sales++;
        // Data comercial da venda = created_at (quando o pedido foi gerado)
        if (o.created_at && (!s.lastSale || o.created_at > s.lastSale)) s.lastSale = o.created_at;
      } else if (o.status === 'pending') {
        s.pending++;
      }
    });

    const detailed = profiles.map((p: any) => {
      const userBots = botByUser[p.id] || [];
      const s = stats[p.id] || { revenue: 0, sales: 0, pending: 0 };
      return {
        ...p,
        botCount: userBots.length,
        botUsernames: userBots.map(b => b.username),
        revenue: s.revenue,
        sales: s.sales,
        pending: s.pending,
        lastSale: s.lastSale,
        hasSold: s.sales > 0,
      };
    });
    setDetailedUsers(detailed);
  }

  async function loadBuyers() {
    const { data } = await supabase
      .from('payment_orders')
      .select('id, telegram_username, telegram_first_name, telegram_user_id, amount, status, created_at, paid_at, bot_id')
      .eq('status', 'paid')
      .order('created_at', { ascending: false })
      .limit(50);
    setRecentBuyers(data || []);
  }

  async function loadLeads() {
    const { data } = await supabase
      .from('payment_orders')
      .select('id, telegram_username, telegram_first_name, telegram_user_id, amount, status, created_at, bot_id')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(50);
    setRecentLeads(data || []);
  }

  async function loadPaymentDiagnostics() {
    const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const ordersRes = await supabase
      .from('payment_orders')
      .select('id, bot_id, plan_id, telegram_user_id, telegram_username, telegram_first_name, amount, status, source_type, pix_code, pix_qrcode_url, created_at, paid_at, subscription_plans(name), bots(username)')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(80);

    const orders = ordersRes.data || [];
    const orderIds = orders.map((order: any) => order.id);
    const orderIdBatches = Array.from(
      { length: Math.ceil(orderIds.length / 20) },
      (_, index) => orderIds.slice(index * 20, index * 20 + 20),
    );
    const eventResponses = await Promise.all(orderIdBatches.map((batch) =>
      (supabase as any)
        .from('telegram_payment_events')
        .select('*')
        .in('order_id', batch)
        .order('created_at', { ascending: false })
        .limit(1000)
    ));
    const events = eventResponses.flatMap((response: any) => response.data || []);
    const eventsByOrder: Record<string, any[]> = {};
    for (const event of events) {
      if (!event.order_id) continue;
      (eventsByOrder[event.order_id] ||= []).push(event);
    }

    const rows = orders.map((order: any) => {
      const orderEvents = eventsByOrder[order.id] || [];
      const hasText = orderEvents.some((event: any) => event.event_type === 'pix_text_sent' && event.success === true);
      const hasQr = orderEvents.some((event: any) => event.event_type === 'pix_qr_sent' && event.success === true);
      const isTransientReconcile = (event: any) => event.event_type?.startsWith('reconcile_') && Number(event.metadata?.status || 0) >= 500;
      const failure = orderEvents.find((event: any) => event.success === false && !isTransientReconcile(event));
      const reconcileWarning = orderEvents.find((event: any) => isTransientReconcile(event));
      const lastEvent = orderEvents[0];
      const textFailed = orderEvents.some((e: any) => e.event_type === 'pix_text_sent' && e.success === false);
      const qrFailed = orderEvents.some((e: any) => e.event_type === 'pix_qr_sent' && e.success === false);
      const hasAudit = orderEvents.length > 0;
      const isPaid = order.status === 'paid';
      const textState: 'sent' | 'failed' | 'no' | 'inferred' | 'unknown' =
        hasText ? 'sent' : textFailed ? 'failed' : isPaid ? 'inferred' : hasAudit ? 'no' : 'unknown';
      const qrState: 'sent' | 'failed' | 'no' | 'inferred' | 'unknown' =
        hasQr ? 'sent' : qrFailed ? 'failed' : isPaid ? 'inferred' : hasAudit ? 'no' : 'unknown';
      return {
        ...order,
        auditEvents: orderEvents,
        hasPix: Boolean(order.pix_code || order.pix_qrcode_url),
        hasText,
        hasQr,
        textState,
        qrState,
        hasAudit,
        failure,
        reconcileWarning,
        lastEvent,
      };
    });

    setPixDiagnostics(rows);
    setPixEventStats({
      total: rows.length,
      pixCreated: rows.filter(row => row.hasPix).length,
      textSent: rows.filter(row => row.hasText).length,
      qrSent: rows.filter(row => row.hasQr).length,
      failures: events.filter((event: any) => event.success === false).length,
      withoutAudit: rows.filter(row => !row.hasAudit).length,
    });
  }

  async function loadTopSellers() {
    // Get all paid orders grouped by bot owner
    const { data: paidOrders } = await supabase
      .from('payment_orders')
      .select('bot_id, amount')
      .eq('status', 'paid');

    const { data: bots } = await supabase.from('bots').select('id, username, name, vip_link, user_id');
    const { data: profiles } = await supabase.from('profiles').select('id, email, full_name');

    if (!paidOrders || !bots) return;

    const botMap = new Map(bots.map(b => [b.id, b]));
    const profileMap = new Map((profiles || []).map(p => [p.id, p]));

    // Group revenue by user_id (bot owner)
    const sellerRevenue: Record<string, { revenue: number; sales: number; bots: any[] }> = {};
    for (const order of paidOrders) {
      const bot = botMap.get(order.bot_id);
      if (!bot) continue;
      if (!sellerRevenue[bot.user_id]) {
        sellerRevenue[bot.user_id] = { revenue: 0, sales: 0, bots: [] };
      }
      sellerRevenue[bot.user_id].revenue += Number(order.amount);
      sellerRevenue[bot.user_id].sales++;
      if (!sellerRevenue[bot.user_id].bots.find((b: any) => b.id === bot.id)) {
        sellerRevenue[bot.user_id].bots.push(bot);
      }
    }

    const sorted = Object.entries(sellerRevenue)
      .map(([userId, data]) => ({
        userId,
        profile: profileMap.get(userId),
        ...data,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 20);

    setTopSellers(sorted);
  }

  async function loadBroadcastHistory() {
    const { data } = await supabase
      .from('broadcast_sent_messages')
      .select('broadcast_id, created_at')
      .order('created_at', { ascending: false });

    if (data) {
      const grouped: Record<string, { count: number; created_at: string }> = {};
      data.forEach(m => {
        if (!grouped[m.broadcast_id]) grouped[m.broadcast_id] = { count: 0, created_at: m.created_at };
        grouped[m.broadcast_id].count++;
      });
      setBroadcastHistory(Object.entries(grouped).map(([id, v]) => ({
        broadcast_id: id, sent: v.count, created_at: v.created_at,
      })));
    }
  }

  function loadUserDetail(userId: string) {
    setSelectedUserId(userId);
  }

  async function saveFeeConfig() {
    setSavingFeeConfig(true);
    try {
      const updates = [
        supabase.from('admin_settings').upsert({ key: 'platform_fee', value: platformFee, updated_at: new Date().toISOString() }, { onConflict: 'key' }),
      ];
      if (platformRevantPayKey.trim()) {
        updates.push(
          supabase.from('admin_settings').upsert({ key: 'platform_revantpay_key', value: platformRevantPayKey.trim(), updated_at: new Date().toISOString() }, { onConflict: 'key' })
        );
      }
      await Promise.all(updates);
      toast({ title: "Salvo!", description: "Configurações de taxa atualizadas." });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSavingFeeConfig(false);
    }
  }

  async function saveSocialLinks() {
    setSavingSocial(true);
    try {
      await Promise.all([
        supabase.from('admin_settings').upsert({ key: 'support_instagram', value: supportInstagram.trim(), updated_at: new Date().toISOString() }, { onConflict: 'key' }),
        supabase.from('admin_settings').upsert({ key: 'support_telegram', value: supportTelegram.trim(), updated_at: new Date().toISOString() }, { onConflict: 'key' }),
        supabase.from('admin_settings').upsert({ key: 'support_discord', value: supportDiscord.trim(), updated_at: new Date().toISOString() }, { onConflict: 'key' }),
      ]);
      toast({ title: "Salvo!", description: "Links de suporte atualizados." });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSavingSocial(false);
    }
  }

  async function saveSettings() {
    setSavingSettings(true);
    const { error } = await supabase
      .from('admin_settings')
      .upsert({ key: 'registry_channel_id', value: registryChannelId, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    toast({
      title: error ? "Erro" : "Salvo!",
      description: error ? error.message : "Canal de registro atualizado.",
      variant: error ? "destructive" : "default",
    });
    setSavingSettings(false);
  }

  async function sendBroadcast() {
    if (!broadcastMessage.trim()) {
      toast({ title: "Erro", description: "Digite uma mensagem.", variant: "destructive" });
      return;
    }
    setSending(true);
    setBroadcastResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('admin-broadcast', {
        body: { action: 'send', message: broadcastMessage, link: broadcastLink || undefined, link_text: broadcastLinkText || undefined, target_audience: broadcastAudience },
      });
      if (error) throw error;
      setBroadcastResult({ sent: data.sent || 0, failed: data.failed || 0, skipped: data.skipped || 0, broadcast_id: data.broadcast_id });
      toast({ title: "Broadcast enviado!", description: `Enviado: ${data.sent} | Pulados: ${data.skipped} | Falhas: ${data.failed}` });
      loadBroadcastHistory();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
    setSending(false);
  }

  async function deleteBroadcastMessages(broadcastId: string) {
    if (!confirm("Tem certeza? As mensagens enviadas serão deletadas dos chats dos usuários.")) return;
    setDeletingBroadcast(broadcastId);
    try {
      const { data, error } = await supabase.functions.invoke('admin-broadcast', {
        body: { action: 'delete', broadcast_id: broadcastId },
      });
      if (error) throw error;
      toast({ title: "Mensagens deletadas!", description: `Deletadas: ${data.deleted} | Falhas: ${data.failed}` });
      loadBroadcastHistory();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
    setDeletingBroadcast(null);
  }

  const getBotName = (botId: string) => {
    const bot = allBots.find(b => b.id === botId);
    return bot ? `@${bot.username}` : botId.slice(0, 8);
  };

  /** Vendedor responsável pela venda = dono do bot que a gerou. */
  const getSeller = (botId: string) => {
    const bot = allBots.find(b => b.id === botId);
    const profile = bot ? sellerProfiles.find(p => p.id === bot.user_id) : null;
    return {
      userId: bot?.user_id || null,
      name: profile?.full_name || profile?.email || (bot ? 'Vendedor sem perfil' : 'Bot removido'),
      email: profile?.email || '',
      username: bot?.username ? `@${bot.username}` : '',
    };
  };

  const SellerCell = ({ botId }: { botId: string }) => {
    const seller = getSeller(botId);
    return (
      <td className="py-2 px-3">
        <p className="font-medium truncate max-w-[180px]">{seller.name}</p>
        <p className="text-xs text-primary font-mono">{seller.username || getBotName(botId)}</p>
      </td>
    );
  };

  function exportToCSV(data: any[], filename: string, type: 'buyers' | 'leads') {
    const headers = type === 'buyers'
      ? ['Telegram ID', 'Username', 'Nome', 'Valor', 'Bot', 'Vendedor', 'Email do vendedor', 'Status', 'Data da venda', 'Pago em']
      : ['Telegram ID', 'Username', 'Nome', 'Valor', 'Bot', 'Vendedor', 'Email do vendedor', 'Status', 'Data da venda'];
    const rows = data.map(item => {
      const seller = getSeller(item.bot_id);
      const base = [
        item.telegram_user_id,
        item.telegram_username || '',
        item.telegram_first_name || '',
        Number(item.amount).toFixed(2),
        getBotName(item.bot_id),
        seller.name,
        seller.email,
        item.status === 'paid' ? 'Pago' : 'Pendente',
        formatBrtDateTime(item.created_at),
      ];
      return type === 'buyers' ? [...base, item.paid_at ? formatBrtDateTime(item.paid_at) : ''] : base;
    });
    const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${filename}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return <MainLayout><div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div></MainLayout>;
  }

  if (!isAdmin) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
          <ShieldCheck className="w-16 h-16 text-destructive mb-4" />
          <h2 className="text-2xl font-bold mb-2">Acesso Negado</h2>
          <p className="text-muted-foreground">Você não tem permissão de administrador.</p>
        </div>
      </MainLayout>
    );
  }

  // User Detail View
  if (selectedUserId) {
    return (
      <AdminLayout
        items={ADMIN_NAV}
        activeId={activeTab}
        onSelect={(id) => { setSelectedUserId(null); setUserDetail(null); navigateTab(id); }}
        title="Dossiê do usuário"
        subtitle="Perfil completo, bots e configurações"
      >
        <UserDossier userId={selectedUserId} onBack={() => { setSelectedUserId(null); setUserDetail(null); }} />
      </AdminLayout>
    );
  }

  async function loadDemoAccounts() {
    setLoadingDemo(true);
    try {
      const [profilesRes, demoRes] = await Promise.all([
        supabase.from('profiles').select('id, email, full_name'),
        supabase.from('demo_settings').select('*'),
      ]);
      setAllProfiles(profilesRes.data || []);
      setDemoSettings(demoRes.data || []);
      const drafts: Record<string, string> = {};
      (demoRes.data || []).forEach((d: any) => {
        if (d.revantpay_demo_key) drafts[d.user_id] = d.revantpay_demo_key;
      });
      setDemoKeyDrafts(drafts);
      const secretDrafts: Record<string, string> = {};
      (demoRes.data || []).forEach((d: any) => {
        if (d.webhook_secret) secretDrafts[d.user_id] = d.webhook_secret;
      });
      setWebhookSecretDrafts(secretDrafts);
      // Prefill quick config inputs
      const qs: Record<string, string> = {};
      const qt: Record<string, string> = {};
      const qu: Record<string, string> = {};
      (demoRes.data || []).forEach((d: any) => {
        const c = d.config || {};
        if (c.totalRevenueAllTime) qs[d.user_id] = String(c.totalRevenueAllTime);
        if (c.avgTicket) qt[d.user_id] = String(c.avgTicket);
        if (c.totalUsers) qu[d.user_id] = String(c.totalUsers);
      });
      setQuickSaldo(qs);
      setQuickTicket(qt);
      setQuickUsers(qu);
    } catch (err) {
      console.error('Error loading demo accounts:', err);
    } finally {
      setLoadingDemo(false);
    }
  }

  async function saveDemoKey(userId: string) {
    setSavingKey(userId);
    try {
      const key = (demoKeyDrafts[userId] || '').trim();
      const existing = demoSettings.find(d => d.user_id === userId);
      if (existing) {
        const { error } = await supabase
          .from('demo_settings')
          .update({ revantpay_demo_key: key || null })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('demo_settings')
          .insert({ user_id: userId, is_active: false, config: {}, revantpay_demo_key: key || null });
        if (error) throw error;
      }
      await loadDemoAccounts();
      toast({ title: "Chave salva!" });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSavingKey(null);
    }
  }

  async function syncDemo(userId: string) {
    setSyncingDemo(userId);
    try {
      const { data, error } = await supabase.functions.invoke('sync-revantpay-demo', {
        body: { user_id: userId },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      await loadDemoAccounts();
      toast({ title: "Sincronizado!", description: "Dados da RevantPay importados com sucesso." });
    } catch (err: any) {
      toast({ title: "Erro ao sincronizar", description: err.message, variant: "destructive" });
    } finally {
      setSyncingDemo(null);
    }
  }

  async function saveWebhookSecret(userId: string) {
    setSavingSecret(userId);
    try {
      const secret = (webhookSecretDrafts[userId] || '').trim();
      const existing = demoSettings.find(d => d.user_id === userId);
      if (existing) {
        const { error } = await supabase
          .from('demo_settings')
          .update({ webhook_secret: secret || null })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('demo_settings')
          .insert({ user_id: userId, is_active: false, config: {}, webhook_secret: secret || null });
        if (error) throw error;
      }
      await loadDemoAccounts();
      toast({ title: "Secret salvo!" });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSavingSecret(null);
    }
  }

  async function generateDemo(userId: string) {
    setGeneratingDemo(userId);
    try {
      const count = Number(genCount[userId]) || 50;
      const ticket = Number(genTicket[userId]) || 24.9;
      const { data, error } = await supabase.functions.invoke('sync-revantpay-demo', {
        body: { user_id: userId, action: 'generate', count, average_ticket: ticket },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      await loadDemoAccounts();
      toast({ title: "Transações geradas!", description: `${count} vendas fictícias criadas e sincronizadas.` });
    } catch (err: any) {
      toast({ title: "Erro ao gerar", description: err.message, variant: "destructive" });
    } finally {
      setGeneratingDemo(null);
    }
  }

  async function toggleDemo(userId: string, currentlyActive: boolean) {
    setTogglingDemo(userId);
    try {
      const existing = demoSettings.find(d => d.user_id === userId);
      if (existing) {
        await supabase.from('demo_settings').update({ is_active: !currentlyActive }).eq('id', existing.id);
      } else {
        await supabase.from('demo_settings').insert({ user_id: userId, is_active: true, config: {} });
      }
      await loadDemoAccounts();
      toast({ title: !currentlyActive ? "Demo ativado!" : "Demo desativado!" });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setTogglingDemo(null);
    }
  }

  const currentNav = ADMIN_NAV.find((n) => n.id === activeTab);

  return (
    <AdminLayout
      items={ADMIN_NAV}
      activeId={activeTab}
      onSelect={navigateTab}
      onRefresh={refreshActiveTab}
      title={currentNav?.label || 'Painel Administrativo'}
      subtitle="Plataforma Riot Vips"
    >

      {activeTab === 'metrics' && <PlatformMetrics />}

      {activeTab === 'search' && <GlobalCopySearch onOpenUser={(id) => loadUserDetail(id)} />}

      {/* Dashboard Tab */}
      {activeTab === 'dashboard' && <AdminOverview onNavigate={navigateTab} />}

      {/* Users Tab */}
      {activeTab === 'users' && (
        <Panel
          icon={UserCheck}
          title={`Usuários cadastrados (${detailedUsers.length})`}
          subtitle="Aquisição · ativação · faturamento por conta"
          action={
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
              <div className="relative">
                <Filter className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                <Input value={userSearch} onChange={(e) => setUserSearch(e.target.value)} placeholder="Buscar email/nome/@bot" className="pl-9 w-full sm:w-64" />
              </div>
              <Button variant="outline" size="sm" onClick={() => {
                const rows = detailedUsers.map(u => [u.email || '', u.full_name || '', formatBrtShort(u.created_at), u.botCount, (u.botUsernames||[]).join('|'), u.sales, u.pending, Number(u.revenue).toFixed(2), u.lastSale ? formatBrtShort(u.lastSale) : '']);
                const csv = [['Email','Nome','Cadastro','Bots','Usernames','Vendas','Pendentes','Faturamento','Última venda'].join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a'); a.href = url; a.download = 'usuarios.csv'; a.click(); URL.revokeObjectURL(url);
              }} className="border-border">
                <Download className="w-4 h-4 mr-1" /> CSV
              </Button>
            </div>
          }
        >
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-4">
            {([
              { id: 'all' as const, label: 'Total', value: detailedUsers.length, cls: '' },
              { id: 'nobot' as const, label: 'Com bot criado', value: detailedUsers.filter(u => u.botCount > 0).length, cls: 'text-primary' },
              { id: 'sellers' as const, label: 'Já venderam', value: detailedUsers.filter(u => u.hasSold).length, cls: 'text-emerald-400' },
              { id: 'nosale' as const, label: 'Sem venda', value: detailedUsers.filter(u => !u.hasSold).length, cls: 'text-amber-400' },
            ]).map(c => (
              <button key={c.id} onClick={() => setUserFilter(userFilter === c.id ? 'all' : c.id)}
                className={`p-3 rounded-xl border text-left transition-all ${userFilter === c.id ? 'border-primary/50 bg-primary/10' : 'border-border/30 bg-secondary/30 hover:border-primary/30'}`}>
                <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{c.label}</p>
                <p className={`text-xl font-bold font-mono mt-1 ${c.cls}`}>{c.value}</p>
              </button>
            ))}
          </div>
          <div className="overflow-x-auto rounded-xl border border-border/40">
              <table className="w-full text-sm min-w-[900px]">
                <thead>
                  <tr className="border-b border-border/50 bg-secondary/40">
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">Usuário</th>
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">Cadastro</th>
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">Bots</th>
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">Vendas</th>
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">Pendentes</th>
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">Faturamento</th>
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">Última venda</th>
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {detailedUsers.filter(u => {
                    if (userFilter === 'sellers' && !u.hasSold) return false;
                    if (userFilter === 'nosale' && u.hasSold) return false;
                    if (userFilter === 'nobot' && !(u.botCount > 0)) return false;
                    if (!userSearch.trim()) return true;
                    const q = userSearch.toLowerCase();
                    return (u.email || '').toLowerCase().includes(q)
                      || (u.full_name || '').toLowerCase().includes(q)
                      || (u.botUsernames || []).some((b: string) => b.toLowerCase().includes(q));
                  }).map(u => (
                    <tr key={u.id} className="border-b border-border/20 hover:bg-secondary/30 transition-colors">
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-2">
                          <span className={`w-1.5 h-1.5 rounded-full ${u.hasSold ? 'bg-emerald-400' : u.botCount > 0 ? 'bg-amber-400' : 'bg-muted-foreground/40'}`} />
                          <p className="font-medium">{u.full_name || 'Sem nome'}</p>
                        </div>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </td>
                      <td className="py-2 px-3 text-muted-foreground text-xs">{formatBrtShort(u.created_at)}</td>
                      <td className="py-2 px-3">
                        <span className="font-mono">{u.botCount}</span>
                        {u.botUsernames?.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {u.botUsernames.slice(0, 3).map((n: string) => (
                              <span key={n} className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">@{n}</span>
                            ))}
                            {u.botUsernames.length > 3 && <span className="text-[10px] text-muted-foreground">+{u.botUsernames.length - 3}</span>}
                          </div>
                        )}
                      </td>
                      <td className="py-2 px-3 font-mono">{u.sales}</td>
                      <td className="py-2 px-3 font-mono text-amber-400">{u.pending}</td>
                      <td className="py-2 px-3 font-mono text-emerald-400">R$ {Number(u.revenue).toFixed(2)}</td>
                      <td className="py-2 px-3 text-muted-foreground text-xs">{u.lastSale ? formatBrtShort(u.lastSale) : '—'}</td>
                      <td className="py-2 px-3">
                        <Button variant="ghost" size="sm" onClick={() => loadUserDetail(u.id)}>
                          <Eye className="w-3 h-3 mr-1" /> Ver
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
          </div>
        </Panel>
      )}

      {/* Broadcast Tab */}
      {activeTab === 'broadcast' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="glass-card border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Megaphone className="w-5 h-5 text-primary" />Broadcast Global</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-sm space-y-1">
                <p className="font-medium text-blue-400">📋 Regras do disparo:</p>
                <p className="text-muted-foreground">• Admins de grupo <strong>NUNCA recebem</strong></p>
                <p className="text-muted-foreground">• Apenas membros comuns recebem</p>
                <p className="text-muted-foreground">• Segmente por audiência abaixo</p>
                <p className="text-muted-foreground">• Após enviar, você pode <strong>deletar</strong> as mensagens</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Segmentação</label>
                <div className="flex gap-2 flex-wrap">
                  {([
                    { value: 'all' as const, label: '👥 Todos', desc: 'Todos os membros' },
                    { value: 'buyers' as const, label: '💰 Compradores', desc: 'Só quem já comprou' },
                    { value: 'non_buyers' as const, label: '🎯 Não compraram', desc: 'Só quem ainda não comprou' },
                  ]).map(opt => (
                    <button key={opt.value} onClick={() => setBroadcastAudience(opt.value)}
                      className={`flex-1 min-w-[120px] p-3 rounded-xl border text-left text-sm transition-all ${broadcastAudience === opt.value ? 'border-primary bg-primary/10 text-foreground' : 'border-border/50 bg-secondary/30 text-muted-foreground hover:border-border'}`}>
                      <span className="font-medium block">{opt.label}</span>
                      <span className="text-xs opacity-70">{opt.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Mensagem</label>
                <textarea value={broadcastMessage} onChange={(e) => setBroadcastMessage(e.target.value)}
                  placeholder="Ex: 🔥 Oferta exclusiva!..." className="w-full bg-secondary/50 border border-border/50 rounded-xl p-4 min-h-[120px] resize-y focus:border-primary focus:ring-1 focus:ring-primary/50" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Link (opcional)</label>
                <input value={broadcastLink} onChange={(e) => setBroadcastLink(e.target.value)}
                  placeholder="https://t.me/seugrupo" className="w-full bg-secondary/50 border border-border/50 rounded-xl p-3 focus:border-primary" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Texto do botão</label>
                <input value={broadcastLinkText} onChange={(e) => setBroadcastLinkText(e.target.value)}
                  placeholder="🔥 Ver Oferta" className="w-full bg-secondary/50 border border-border/50 rounded-xl p-3 focus:border-primary" />
              </div>
              {broadcastResult && (
                <div className="p-3 rounded-lg bg-secondary/50 text-sm">
                  ✅ Enviados: <strong>{broadcastResult.sent}</strong> | ⏭️ Pulados: <strong>{broadcastResult.skipped}</strong> | ❌ Falhas: <strong>{broadcastResult.failed}</strong>
                </div>
              )}
              {broadcastMessage.trim() && (
                <div className="p-4 rounded-xl border border-border/40 bg-secondary/20">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-2">Prévia no Telegram</p>
                  <div className="rounded-xl bg-background/70 border border-border/40 p-3">
                    <p className="text-sm whitespace-pre-wrap break-words">{broadcastMessage}</p>
                    {broadcastLink && (
                      <div className="mt-3 rounded-lg bg-primary/15 text-primary text-xs text-center py-2 font-medium">
                        {broadcastLinkText || 'Ver oferta'}
                      </div>
                    )}
                  </div>
                </div>
              )}
              <Button onClick={sendBroadcast} disabled={sending} className="btn-gradient w-full border-0">
                {sending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                {sending ? "Enviando..." : "Enviar Broadcast"}
              </Button>
            </CardContent>
          </Card>

          {/* Broadcast History */}
          <Card className="glass-card border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Trash2 className="w-5 h-5 text-destructive" />Histórico / Apagar Rastros</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">Clique para remover mensagens dos chats.</p>
              {broadcastHistory.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Nenhum broadcast enviado</p>
              ) : (
                <div className="space-y-3">
                  {broadcastHistory.map(b => (
                    <div key={b.broadcast_id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border/30">
                      <div>
                        <p className="text-sm font-medium">{b.sent} mensagens</p>
                        <p className="text-xs text-muted-foreground">
                          {formatBrtShort(b.created_at)}
                        </p>
                      </div>
                      <Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/10"
                        disabled={deletingBroadcast === b.broadcast_id}
                        onClick={() => deleteBroadcastMessages(b.broadcast_id)}>
                        {deletingBroadcast === b.broadcast_id ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Trash2 className="w-3 h-3 mr-1" />}
                        Deletar
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Buyers Tab */}
      {activeTab === 'contacts' && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <button
            onClick={() => setContactsView('buyers')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm transition-all border ${contactsView === 'buyers' ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400' : 'border-border/40 bg-secondary/30 text-muted-foreground hover:text-foreground'}`}
          >
            <ShoppingCart className="w-4 h-4" /> Compradores
            <span className="font-mono text-xs">{recentBuyers.length}</span>
          </button>
          <button
            onClick={() => setContactsView('leads')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm transition-all border ${contactsView === 'leads' ? 'border-amber-500/50 bg-amber-500/10 text-amber-400' : 'border-border/40 bg-secondary/30 text-muted-foreground hover:text-foreground'}`}
          >
            <Users className="w-4 h-4" /> Leads pendentes
            <span className="font-mono text-xs">{recentLeads.length}</span>
          </button>
        </div>
      )}

      {activeTab === 'contacts' && contactsView === 'buyers' && (() => {
        const q = buyerSearch.trim().toLowerCase();
        const rows = recentBuyers.filter((l: any) => !q || [l.telegram_first_name, l.telegram_username, String(l.telegram_user_id ?? ''), getBotName(l.bot_id)].filter(Boolean).join(' ').toLowerCase().includes(q));
        const total = rows.reduce((s: number, l: any) => s + Number(l.amount || 0), 0);
        const ticket = rows.length ? total / rows.length : 0;
        return (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <StatCard icon={ShoppingCart} label="Compradores listados" value={rows.length} color="bg-emerald-500/15 text-emerald-400" bar="bg-emerald-500" />
            <StatCard icon={DollarSign} label="Faturamento listado" value={`R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} color="bg-primary/15 text-primary" />
            <StatCard icon={TrendingUp} label="Ticket médio" value={`R$ ${ticket.toFixed(2)}`} color="bg-cyan-500/15 text-cyan-400" bar="bg-cyan-500" />
          </div>
          <Panel
            icon={ShoppingCart}
            title="Compradores"
            subtitle="Pedidos pagos mais recentes"
            action={
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                <Input value={buyerSearch} onChange={(e) => setBuyerSearch(e.target.value)} placeholder="Buscar lead ou bot" className="w-full sm:w-60" />
                <Button variant="outline" size="sm" onClick={() => exportToCSV(recentBuyers, 'compradores', 'buyers')} className="border-border">
                  <Download className="w-4 h-4 mr-1" /> CSV
                </Button>
              </div>
            }
          >
            <div className="overflow-x-auto rounded-xl border border-border/40">
              <table className="w-full text-sm min-w-[820px]">
                <thead>
                  <tr className="border-b border-border/50 bg-secondary/40">
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">Comprador</th>
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">Bot</th>
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">Vendedor</th>
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">Valor</th>
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">Data da venda</th>
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">Pago em</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(lead => (
                    <tr key={lead.id} className="border-b border-border/20 hover:bg-secondary/30 transition-colors">
                      <td className="py-2 px-3">
                        <span className="font-medium">{lead.telegram_first_name || 'Sem nome'}</span>
                        {lead.telegram_username && <span className="text-muted-foreground ml-1">@{lead.telegram_username}</span>}
                      </td>
                      <td className="py-2 px-3 text-primary font-mono text-xs">{getBotName(lead.bot_id)}</td>
                      <SellerCell botId={lead.bot_id} />
                      <td className="py-2 px-3 font-mono text-emerald-400">R$ {Number(lead.amount).toFixed(2)}</td>
                      <td className="py-2 px-3 text-muted-foreground">{formatBrtShort(lead.created_at)}</td>
                      <td className="py-2 px-3 text-muted-foreground">{formatBrtShort(lead.paid_at)}</td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr><td colSpan={6} className="py-10 text-center text-muted-foreground">Nenhum comprador encontrado.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
        );
      })()}

      {/* Leads */}
      {activeTab === 'contacts' && contactsView === 'leads' && (() => {
        const q = leadSearch.trim().toLowerCase();
        const rows = recentLeads.filter((l: any) => !q || [l.telegram_first_name, l.telegram_username, String(l.telegram_user_id ?? ''), getBotName(l.bot_id)].filter(Boolean).join(' ').toLowerCase().includes(q));
        const potential = rows.reduce((s: number, l: any) => s + Number(l.amount || 0), 0);
        return (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <StatCard icon={Users} label="Leads pendentes" value={rows.length} color="bg-amber-500/15 text-amber-400" bar="bg-amber-500" />
            <StatCard icon={DollarSign} label="Valor em aberto" value={`R$ ${potential.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} color="bg-primary/15 text-primary" />
            <StatCard icon={Target} label="Recuperáveis por downsell" value={rows.length} subValue="PIX gerado sem pagamento" color="bg-cyan-500/15 text-cyan-400" bar="bg-cyan-500" />
          </div>
          <Panel
            icon={Users}
            title="Leads pendentes"
            subtitle="Geraram PIX mas ainda não pagaram"
            action={
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                <Input value={leadSearch} onChange={(e) => setLeadSearch(e.target.value)} placeholder="Buscar lead ou bot" className="w-full sm:w-60" />
                <Button variant="outline" size="sm" onClick={() => exportToCSV(recentLeads, 'leads-pendentes', 'leads')} className="border-border">
                  <Download className="w-4 h-4 mr-1" /> CSV
                </Button>
              </div>
            }
          >
            <div className="overflow-x-auto rounded-xl border border-border/40">
              <table className="w-full text-sm min-w-[760px]">
                <thead>
                  <tr className="border-b border-border/50 bg-secondary/40">
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">Usuário</th>
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">Bot</th>
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">Vendedor</th>
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">Valor</th>
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">Data da venda</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(lead => (
                    <tr key={lead.id} className="border-b border-border/20 hover:bg-secondary/30 transition-colors">
                      <td className="py-2 px-3">
                        <span className="font-medium">{lead.telegram_first_name || 'Sem nome'}</span>
                        {lead.telegram_username && <span className="text-muted-foreground ml-1">@{lead.telegram_username}</span>}
                      </td>
                      <td className="py-2 px-3 text-primary font-mono text-xs">{getBotName(lead.bot_id)}</td>
                      <SellerCell botId={lead.bot_id} />
                      <td className="py-2 px-3 font-mono">R$ {Number(lead.amount).toFixed(2)}</td>
                      <td className="py-2 px-3 text-muted-foreground">{formatBrtShort(lead.created_at)}</td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr><td colSpan={5} className="py-10 text-center text-muted-foreground">Nenhum lead pendente encontrado.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
        );
      })()}

      {/* PIX Diagnostics Tab */}
      {activeTab === 'pix' && (
        (() => {
        const pixBots = Array.from(
          new Map(
            pixDiagnostics.map((row: any) => [row.bot_id, row.bots?.username || getBotName(row.bot_id).replace('@', '')])
          ).entries()
        );
        const term = pixSearch.trim().toLowerCase();
        const filteredPix = pixDiagnostics.filter((row: any) => {
          if (pixBotFilter !== 'all' && row.bot_id !== pixBotFilter) return false;
          if (!term) return true;
          const haystack = [
            row.telegram_first_name,
            row.telegram_username,
            String(row.telegram_user_id ?? ''),
            row.bots?.username,
            row.id,
            row.subscription_plans?.name,
          ].filter(Boolean).join(' ').toLowerCase();
          return haystack.includes(term);
        });
        const selectedRows = pixSelectedLead
          ? pixDiagnostics.filter((row: any) => `${row.bot_id}:${row.telegram_user_id}` === pixSelectedLead)
          : [];
        const selectedEvents = selectedRows
          .flatMap((row: any) => (row.auditEvents || []).map((e: any) => ({ ...e, _order: row })))
          .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        const selectedHead = selectedRows[0];
        const stateBadge = (state: string) => {
          const map: Record<string, { label: string; cls: string }> = {
            sent: { label: 'Sim', cls: 'bg-emerald-500/20 text-emerald-400' },
            inferred: { label: 'Sim (pago)', cls: 'bg-emerald-500/10 text-emerald-300' },
            failed: { label: 'Não (erro)', cls: 'bg-red-500/20 text-red-400' },
            no: { label: 'Não', cls: 'bg-red-500/10 text-red-300' },
            unknown: { label: 'Sem dados', cls: 'bg-secondary text-muted-foreground' },
          };
          const item = map[state] || map.unknown;
          return <span className={`px-2 py-0.5 rounded-full text-xs ${item.cls}`}>{item.label}</span>;
        };
        const stateText = (state: string) =>
          state === 'sent' ? 'Sim' : state === 'inferred' ? 'Sim (inferido: pedido pago)' : state === 'failed' ? 'Não (erro registrado)' : state === 'no' ? 'Não' : 'Sem dados de auditoria';
        const exportPixCsv = () => {
          const rows = selectedRows.length ? selectedRows : filteredPix;
          if (!rows.length) {
            toast({ title: 'Nada para exportar', description: 'Ajuste os filtros e tente novamente.', variant: 'destructive' });
            return;
          }
          const header = ['Pedido', 'Data da venda', 'Lead', 'Username', 'Telegram ID', 'Bot', 'Vendedor', 'Email do vendedor', 'Plano/Oferta', 'Origem', 'Valor (R$)', 'PIX gerado', 'Codigo PIX entregue', 'QR entregue', 'Status', 'Pago em', 'Ultimo evento', 'Erro', 'Aviso reconciliacao', 'Linha do tempo'];
          const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
          const lines = rows.map((row: any) => {
            const seller = getSeller(row.bot_id);
            return [
            row.id,
            formatBrtDateTime(row.created_at),
            row.telegram_first_name || '',
            row.telegram_username ? `@${row.telegram_username}` : '',
            row.telegram_user_id,
            `@${row.bots?.username || getBotName(row.bot_id).replace('@', '')}`,
            seller.name,
            seller.email,
            row.subscription_plans?.name || 'Oferta',
            row.source_type || 'direct',
            Number(row.amount).toFixed(2).replace('.', ','),
            row.hasPix ? 'Sim' : 'Não',
            stateText(row.textState),
            stateText(row.qrState),
            row.status === 'paid' ? 'Pago' : 'Pendente',
            row.paid_at ? formatBrtDateTime(row.paid_at) : '',
            row.lastEvent?.event_type || (row.hasAudit ? 'auditado' : 'sem auditoria'),
            row.failure?.error_message || '',
            row.reconcileWarning ? `Instabilidade temporária ao consultar pagamento (${row.reconcileWarning.metadata?.status || 'sem status'})` : '',
            (row.auditEvents || [])
              .slice()
              .reverse()
              .map((e: any) => `${formatBrtTime(e.created_at)} ${e.event_type}${e.success === false ? ' (falhou)' : ''}`)
              .join(' | '),
            ].map(esc).join(';');
          });
          const csv = '\uFEFF' + [header.map(esc).join(';'), ...lines].join('\n');
          const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          const scope = selectedRows.length
            ? `lead-${selectedHead?.telegram_user_id}`
            : pixBotFilter !== 'all'
              ? `bot-${(pixBots.find(([id]) => id === pixBotFilter)?.[1]) || pixBotFilter}`
              : 'geral';
          a.href = url;
          a.download = `diagnostico-pix-${scope}-${new Date().toISOString().slice(0, 10)}.csv`;
          a.click();
          URL.revokeObjectURL(url);
          toast({ title: 'Planilha gerada', description: `${rows.length} pedido(s) exportado(s).` });
        };
        return (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            <Card className="glass-card border-border/50">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1">Pedidos 48h</p>
                <p className="text-2xl font-bold font-mono">{pixEventStats.total}</p>
              </CardContent>
            </Card>
            <Card className="glass-card border-border/50 border-l-4 border-l-emerald-500">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1">PIX Criado</p>
                <p className="text-2xl font-bold font-mono text-emerald-400">{pixEventStats.pixCreated}</p>
              </CardContent>
            </Card>
            <Card className="glass-card border-border/50 border-l-4 border-l-primary">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1">Código Enviado</p>
                <p className="text-2xl font-bold font-mono text-primary">{pixEventStats.textSent}</p>
              </CardContent>
            </Card>
            <Card className="glass-card border-border/50 border-l-4 border-l-cyan-500">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1">QR Enviado</p>
                <p className="text-2xl font-bold font-mono text-cyan-400">{pixEventStats.qrSent}</p>
              </CardContent>
            </Card>
            <Card className="glass-card border-border/50 border-l-4 border-l-red-500">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1">Falhas Auditadas</p>
                <p className="text-2xl font-bold font-mono text-red-400">{pixEventStats.failures}</p>
              </CardContent>
            </Card>
            <Card className="glass-card border-border/50 border-l-4 border-l-amber-500">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1">Sem Auditoria</p>
                <p className="text-2xl font-bold font-mono text-amber-400">{pixEventStats.withoutAudit}</p>
              </CardContent>
            </Card>
          </div>

          <Card className="glass-card border-border/50">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-primary" />
                  Diagnóstico de PIX no Telegram
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Mostra se o pedido gerou PIX, se o código/QR foram entregues e qual foi o último erro auditado.
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={exportPixCsv} className="border-border">
                  <Download className="w-4 h-4 mr-1" /> Exportar planilha
                </Button>
                <Button variant="outline" size="sm" onClick={loadPaymentDiagnostics} className="border-border">
                  <RefreshCw className="w-4 h-4 mr-1" /> Atualizar
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-4 rounded-lg border border-border/50 bg-secondary/20 p-4 text-xs text-muted-foreground space-y-1">
                <p className="text-sm text-foreground font-medium">Como funciona</p>
                <p>1. Cada pedido dos últimos 48h aparece na tabela abaixo, com o bot, o lead e a oferta.</p>
                <p>2. <span className="text-foreground">PIX</span> = a cobrança foi criada na RevantPay e o código ficou salvo no banco. <span className="text-foreground">Código</span> e <span className="text-foreground">QR</span> = o Telegram confirmou a entrega da mensagem ao lead.</p>
                <p>3. Use a busca (nome, @username, ID do Telegram ou ID do pedido) e o filtro de bot para isolar um usuário específico; clique na linha para abrir a linha do tempo auditada.</p>
                <p>4. "Exportar planilha" gera um CSV do que está filtrado — se houver um lead aberto, exporta somente esse lead.</p>
                <p>5. "Sem dados" significa pedido anterior à auditoria (ou antes do primeiro evento); "Sim (pago)" é entrega confirmada indiretamente porque o lead pagou aquele PIX.</p>
              </div>
              <div className="flex flex-col md:flex-row gap-3 mb-4">
                <Input
                  value={pixSearch}
                  onChange={(e) => setPixSearch(e.target.value)}
                  placeholder="Buscar lead por nome, @username, ID do Telegram ou ID do pedido"
                  className="bg-secondary/30 border-border"
                />
                <select
                  value={pixBotFilter}
                  onChange={(e) => setPixBotFilter(e.target.value)}
                  className="h-10 rounded-md bg-secondary/30 border border-border px-3 text-sm min-w-[200px]"
                >
                  <option value="all">Todos os bots</option>
                  {pixBots.map(([id, username]) => (
                    <option key={id} value={id}>@{username}</option>
                  ))}
                </select>
              </div>

              {selectedHead && (
                <div className="mb-4 rounded-xl border border-primary/30 bg-primary/5 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold">
                        {selectedHead.telegram_first_name || 'Sem nome'}{' '}
                        <span className="text-muted-foreground text-sm font-normal">
                          {selectedHead.telegram_username ? `@${selectedHead.telegram_username}` : ''} · ID {selectedHead.telegram_user_id}
                        </span>
                      </p>
                      <p className="text-xs text-primary font-mono mt-1">
                        Bot @{selectedHead.bots?.username || getBotName(selectedHead.bot_id).replace('@', '')} · {selectedRows.length} pedido(s) em 48h
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Vendedor: <span className="text-foreground font-medium">{getSeller(selectedHead.bot_id).name}</span>
                        {getSeller(selectedHead.bot_id).email && ` · ${getSeller(selectedHead.bot_id).email}`}
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setPixSelectedLead(null)}>Fechar</Button>
                  </div>

                  <div className="mt-3 space-y-3">
                    {selectedRows.map((order: any) => (
                      <div key={order.id} className="rounded-lg bg-secondary/30 border border-border/40 p-3">
                        <p className="text-sm font-medium">
                          {order.subscription_plans?.name || 'Oferta'} · R$ {Number(order.amount).toFixed(2)} · {order.status === 'paid' ? 'Pago' : 'Pendente'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          PIX: {order.hasPix ? 'criado' : 'não criado'} · Código: {stateText(order.textState)} · QR: {stateText(order.qrState)} · Origem: {order.source_type || 'direct'}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Venda: {formatBrtShort(order.created_at)}{order.paid_at ? ` · Pago em: ${formatBrtShort(order.paid_at)}` : ''}
                        </p>
                      </div>
                    ))}
                  </div>

                  <p className="text-xs text-muted-foreground mt-4 mb-2 uppercase tracking-wide">Linha do tempo auditada</p>
                  {selectedEvents.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Nenhum evento auditado para este lead ainda.</p>
                  ) : (
                    <div className="space-y-2 max-h-72 overflow-y-auto">
                      {selectedEvents.map((event: any) => {
                        const transientReconcile = event.event_type?.startsWith('reconcile_') && Number(event.metadata?.status || 0) >= 500;
                        return (
                          <div key={event.id} className="flex items-start gap-3 text-xs">
                            <span className={`mt-1 w-2 h-2 rounded-full shrink-0 ${transientReconcile ? 'bg-amber-400' : event.success === false ? 'bg-red-400' : event.success === true ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                            <div className="min-w-0">
                              <p className="font-mono">
                                {event.event_type}
                                {transientReconcile && (
                                  <span className="ml-2 text-[10px] uppercase tracking-wide text-amber-400">consulta instável, PIX já gerado</span>
                                )}
                                {event.metadata?.backfilled && (
                                  <span className="ml-2 text-[10px] uppercase tracking-wide text-muted-foreground">reconstruído</span>
                                )}
                              </p>
                              {event.error_message && (
                                <p className={`${transientReconcile ? 'text-amber-400' : 'text-red-400'} break-words`}>
                                  {transientReconcile ? 'A consulta automática de status retornou instabilidade temporária da RevantPay. O PIX já havia sido gerado.' : event.error_message}
                                </p>
                              )}
                              <p className="text-muted-foreground">
                                {formatBrtShort(event.created_at)} {formatBrtTime(event.created_at)}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/50">
                      <th className="text-left py-2 px-3 text-muted-foreground font-medium">Lead</th>
                      <th className="text-left py-2 px-3 text-muted-foreground font-medium">Bot</th>
                      <th className="text-left py-2 px-3 text-muted-foreground font-medium">Vendedor</th>
                      <th className="text-left py-2 px-3 text-muted-foreground font-medium">Plano/Origem</th>
                      <th className="text-left py-2 px-3 text-muted-foreground font-medium">Valor</th>
                      <th className="text-left py-2 px-3 text-muted-foreground font-medium">PIX</th>
                      <th className="text-left py-2 px-3 text-muted-foreground font-medium">Código</th>
                      <th className="text-left py-2 px-3 text-muted-foreground font-medium">QR</th>
                      <th className="text-left py-2 px-3 text-muted-foreground font-medium">Status</th>
                      <th className="text-left py-2 px-3 text-muted-foreground font-medium">Último evento</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPix.map((row) => {
                      const statusClass = row.status === 'paid'
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : row.failure
                          ? 'bg-red-500/20 text-red-400'
                          : row.reconcileWarning
                            ? 'bg-amber-500/20 text-amber-400'
                          : 'bg-amber-500/20 text-amber-400';
                      const badge = (ok: boolean, label: string) => (
                        <span className={`px-2 py-0.5 rounded-full text-xs ${ok ? 'bg-emerald-500/20 text-emerald-400' : 'bg-secondary text-muted-foreground'}`}>{label}</span>
                      );
                      return (
                        <tr
                          key={row.id}
                          onClick={() => setPixSelectedLead(`${row.bot_id}:${row.telegram_user_id}`)}
                          className="border-b border-border/30 hover:bg-secondary/30 align-top cursor-pointer"
                        >
                          <td className="py-2 px-3">
                            <p className="font-medium">{row.telegram_first_name || 'Sem nome'}</p>
                            <p className="text-xs text-muted-foreground">{row.telegram_username ? `@${row.telegram_username}` : row.telegram_user_id}</p>
                          </td>
                          <td className="py-2 px-3 text-primary font-mono text-xs">@{row.bots?.username || getBotName(row.bot_id).replace('@', '')}</td>
                          <SellerCell botId={row.bot_id} />
                          <td className="py-2 px-3">
                            <p className="font-medium">{row.subscription_plans?.name || 'Oferta'}</p>
                            <p className="text-xs text-muted-foreground">{row.source_type || 'direct'}</p>
                          </td>
                          <td className="py-2 px-3 font-mono">R$ {Number(row.amount).toFixed(2)}</td>
                          <td className="py-2 px-3">{badge(row.hasPix, row.hasPix ? 'Sim' : 'Não')}</td>
                          <td className="py-2 px-3">{stateBadge(row.textState)}</td>
                          <td className="py-2 px-3">{stateBadge(row.qrState)}</td>
                          <td className="py-2 px-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs ${statusClass}`}>{row.status === 'paid' ? 'Pago' : row.failure ? 'Erro' : row.reconcileWarning ? 'PIX gerado' : 'Pendente'}</span>
                          </td>
                          <td className="py-2 px-3 max-w-[280px]">
                            <p className="font-mono text-xs">{row.lastEvent?.event_type || (row.hasAudit ? 'auditado' : 'sem auditoria')}</p>
                            {row.failure?.error_message && <p className="text-xs text-red-400 break-words mt-1">{row.failure.error_message}</p>}
                            {!row.failure && row.reconcileWarning && <p className="text-xs text-amber-400 break-words mt-1">Consulta de status instável; não impede o PIX já gerado.</p>}
                            <p className="text-xs text-muted-foreground mt-1">Venda: {formatBrtShort(row.created_at)}</p>
                            {row.paid_at && <p className="text-xs text-muted-foreground">Pago em: {formatBrtShort(row.paid_at)}</p>}
                          </td>
                        </tr>
                      );
                    })}
                    {filteredPix.length === 0 && (
                      <tr>
                        <td colSpan={10} className="py-10 text-center text-muted-foreground">Nenhum pedido recente encontrado.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
        );
        })()
      )}

      {/* Top Sellers Tab */}
      {activeTab === 'sellers' && (() => {
        const q = sellerSearch.trim().toLowerCase();
        const list = topSellers.filter((s: any) => !q
          || (s.profile?.full_name || '').toLowerCase().includes(q)
          || (s.profile?.email || '').toLowerCase().includes(q)
          || (s.bots || []).some((b: any) => (b.username || '').toLowerCase().includes(q)));
        const totalRev = topSellers.reduce((acc: number, s: any) => acc + Number(s.revenue || 0), 0);
        const top = topSellers[0];
        const share = totalRev > 0 && top ? (Number(top.revenue) / totalRev) * 100 : 0;
        const max = Math.max(1, ...topSellers.map((s: any) => Number(s.revenue || 0)));
        return (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <StatCard icon={Trophy} label="Vendedores com venda" value={topSellers.length} color="bg-amber-500/15 text-amber-400" bar="bg-amber-500" />
            <StatCard icon={DollarSign} label="Faturamento somado" value={`R$ ${totalRev.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} color="bg-emerald-500/15 text-emerald-400" bar="bg-emerald-500" />
            <StatCard icon={Target} label="Concentração do #1" value={`${share.toFixed(1)}%`} subValue={top?.profile?.email || '—'} color="bg-primary/15 text-primary" progress={share} />
          </div>
          <Panel
            icon={Trophy}
            title="Top vendedores"
            subtitle="Ranking por faturamento pago"
            action={<Input value={sellerSearch} onChange={(e) => setSellerSearch(e.target.value)} placeholder="Buscar vendedor ou @bot" className="w-full sm:w-64" />}
          >
              {list.length === 0 ? (
                <p className="text-center text-muted-foreground py-10">Nenhuma venda registrada</p>
              ) : (
                <div className="space-y-3">
                  {list.map((seller, i) => (
                    <div key={seller.userId} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-secondary/30 border border-border/30 hover:border-primary/30 transition-all">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${i === 0 ? 'bg-amber-500/20 text-amber-400' : i === 1 ? 'bg-gray-400/20 text-gray-300' : i === 2 ? 'bg-orange-500/20 text-orange-400' : 'bg-secondary text-muted-foreground'}`}>
                          #{i + 1}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium">{seller.profile?.full_name || seller.profile?.email || 'Usuário'}</p>
                          {seller.profile?.email && <p className="text-xs text-muted-foreground truncate">{seller.profile.email}</p>}
                          <div className="flex flex-wrap gap-1 mt-1">
                            {seller.bots.map((bot: any) => (
                              <span key={bot.id} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                                @{bot.username}
                              </span>
                            ))}
                          </div>
                          <div className="h-1 rounded-full bg-secondary overflow-hidden mt-2 max-w-[220px]">
                            <div className="h-full rounded-full bg-gradient-to-r from-primary to-teal-400" style={{ width: `${(Number(seller.revenue) / max) * 100}%` }} />
                          </div>
                        </div>
                      </div>
                      <div className="sm:text-right">
                        <p className="text-lg font-bold font-mono text-emerald-400">R$ {seller.revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                        <p className="text-xs text-muted-foreground">
                          {seller.sales} vendas · ticket R$ {(Number(seller.revenue) / Math.max(1, seller.sales)).toFixed(2)}
                        </p>
                        <Button variant="ghost" size="sm" className="mt-1 text-xs" onClick={() => loadUserDetail(seller.userId)}>
                          <Eye className="w-3 h-3 mr-1" /> Ver detalhes
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
          </Panel>
        </div>
        );
      })()}

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
          {/* Maintenance Banner */}
          <Card className="glass-card border-red-500/40 xl:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                Banner de Aviso (Manutenção)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Quando ativado, aparece uma barra vermelha no topo de todas as páginas dos usuários logados.
              </p>
              <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/40">
                <div>
                  <p className="text-sm font-medium">Banner ativo</p>
                  <p className="text-xs text-muted-foreground">Exibe/oculta imediatamente para todos.</p>
                </div>
                <Switch checked={bannerEnabled} onCheckedChange={setBannerEnabled} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Mensagem exibida</label>
                <Textarea
                  value={bannerMessage}
                  onChange={(e) => setBannerMessage(e.target.value)}
                  rows={3}
                  placeholder="Estamos com manutenção no PIX. Assim que voltar, você será notificado no e-mail!"
                  className="bg-secondary/50 border-border/50"
                />
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button onClick={saveBanner} disabled={savingBanner} className="btn-gradient flex-1 border-0">
                  {savingBanner ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                  Salvar Banner
                </Button>
                <Button onClick={notifyByEmail} disabled={notifyingEmail} variant="outline" className="flex-1 border-red-500/50 text-red-400 hover:bg-red-500/10">
                  {notifyingEmail ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Mail className="w-4 h-4 mr-2" />}
                  Notificar por E-mail
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                O botão "Notificar por E-mail" envia a mensagem acima para o e-mail de todos os usuários cadastrados na Riot Vips.
              </p>
            </CardContent>
          </Card>

          {/* Registry Channel */}
          <Card className="glass-card border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Settings className="w-5 h-5 text-primary" />Canal de Registro Geral</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">Configure o ID do canal/grupo onde todas as vendas da plataforma serão notificadas.</p>
              <div>
                <label className="block text-sm font-medium mb-2">ID do Canal/Grupo</label>
                <input value={registryChannelId} onChange={(e) => setRegistryChannelId(e.target.value)}
                  placeholder="Ex: -1001234567890" className="w-full bg-secondary/50 border border-border/50 rounded-xl p-3 focus:border-primary" />
              </div>
              <Button onClick={saveSettings} disabled={savingSettings} className="btn-gradient w-full border-0">
                {savingSettings ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <LinkIcon className="w-4 h-4 mr-2" />}
                Salvar Configuração
              </Button>
            </CardContent>
          </Card>

          {/* Platform Fee & RevantPay Config */}
          <Card className="glass-card border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><DollarSign className="w-5 h-5 text-emerald-400" />Taxa da Plataforma</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Configure a taxa cobrada pela Riot Vips em cada venda. O valor é descontado do vendedor (o comprador paga apenas o preço do plano).
              </p>
              <div>
                <label className="block text-sm font-medium mb-2">Valor da Taxa (R$)</label>
                <input value={platformFee} onChange={(e) => setPlatformFee(e.target.value)}
                  type="number" step="0.01" min="0" placeholder="0.60"
                  className="w-full bg-secondary/50 border border-border/50 rounded-xl p-3 focus:border-primary font-mono" />
                <p className="text-xs text-muted-foreground mt-1">Este valor será registrado em cada venda para controle.</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">API Key RevantPay (Conta da Plataforma)</label>
                <input value={platformRevantPayKey} onChange={(e) => setPlatformRevantPayKey(e.target.value)}
                  type="password" placeholder="rp_xxxxxxxxxxxxxxxx"
                  className="w-full bg-secondary/50 border border-border/50 rounded-xl p-3 focus:border-primary font-mono" />
                <p className="text-xs text-muted-foreground mt-1">
                  API Key da conta RevantPay da Riot Vips para futuro recebimento automático das taxas.
                </p>
              </div>
              <Button onClick={saveFeeConfig} disabled={savingFeeConfig} className="btn-gradient w-full border-0">
                {savingFeeConfig ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <DollarSign className="w-4 h-4 mr-2" />}
                Salvar Configurações de Taxa
              </Button>
            </CardContent>
          </Card>

          {/* Social Links */}
          <Card className="glass-card border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><LinkIcon className="w-5 h-5 text-primary" />Links de Suporte</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">Configure os links das redes sociais exibidos na página de Suporte.</p>
              <div>
                <label className="block text-sm font-medium mb-2">Instagram</label>
                <input value={supportInstagram} onChange={(e) => setSupportInstagram(e.target.value)}
                  placeholder="https://instagram.com/riotvips" className="w-full bg-secondary/50 border border-border/50 rounded-xl p-3 focus:border-primary" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Telegram</label>
                <input value={supportTelegram} onChange={(e) => setSupportTelegram(e.target.value)}
                  placeholder="https://t.me/riotvips" className="w-full bg-secondary/50 border border-border/50 rounded-xl p-3 focus:border-primary" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Discord</label>
                <input value={supportDiscord} onChange={(e) => setSupportDiscord(e.target.value)}
                  placeholder="https://discord.gg/riotvips" className="w-full bg-secondary/50 border border-border/50 rounded-xl p-3 focus:border-primary" />
              </div>
              <Button onClick={saveSocialLinks} disabled={savingSocial} className="btn-gradient w-full border-0">
                {savingSocial ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <LinkIcon className="w-4 h-4 mr-2" />}
                Salvar Links de Suporte
              </Button>
            </CardContent>
          </Card>

          {/* Taxa por usuário */}
          <div className="xl:col-span-2">
            <UserFeeManager
              profiles={feeProfiles}
              globalFee={platformFee}
              saving={savingUserFee}
              onSave={saveUserFee}
            />
          </div>

          {/* Histórico de banners */}
          <div className="xl:col-span-2">
            <BannerHistory rows={bannerHistory} />
          </div>
        </div>
      )}

      {/* Emails Tab */}
      {activeTab === 'emails' && (
        <EmailHistory rows={emailLog} loading={loadingEmails} onReload={loadEmailLog} />
      )}

      {/* Demo Tab */}
      {activeTab === 'demo' && (
        <div className="space-y-6">
          <Card className="glass-card border-border/50">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                Contas Demo ({allProfiles.length})
              </CardTitle>
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                <Input value={demoSearch} onChange={(e) => setDemoSearch(e.target.value)} placeholder="Buscar por email ou nome" className="w-full sm:w-64" />
                <Button variant={demoOnlyActive ? 'default' : 'outline'} size="sm" onClick={() => setDemoOnlyActive(v => !v)} className="border-border whitespace-nowrap">
                  {demoOnlyActive ? 'Só demos ativos' : 'Todos'}
                </Button>
                <Button variant="outline" size="sm" onClick={loadDemoAccounts} className="border-border">
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Ative o modo demo para usuários específicos. Quando ativo, o usuário pode personalizar todas as métricas do dashboard com dados simulados.
              </p>
              {loadingDemo ? (
                <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
              ) : (demoSearch.trim().length < 2 && !demoOnlyActive) ? (
                <div className="py-10 text-center space-y-2">
                  <SearchIcon className="w-6 h-6 mx-auto text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Busque por <strong className="text-foreground">e-mail</strong> ou <strong className="text-foreground">nome</strong> para localizar o usuário e configurar a conta demo.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Ou clique em <strong className="text-foreground">Todos</strong> para listar somente os demos já ativos.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {allProfiles.filter(profile => {
                    const demo = demoSettings.find(d => d.user_id === profile.id);
                    if (demoOnlyActive && !demo?.is_active) return false;
                    const q = demoSearch.trim().toLowerCase();
                    if (!q) return true;
                    return (profile.email || '').toLowerCase().includes(q) || (profile.full_name || '').toLowerCase().includes(q);
                  }).map(profile => {
                    const demo = demoSettings.find(d => d.user_id === profile.id);
                    const isActive = demo?.is_active || false;
                    const hasKey = !!demo?.revantpay_demo_key;
                    const lastSync = demo?.last_synced_at
                      ? formatBrtDateTime(demo.last_synced_at)
                      : 'nunca';
                    return (
                      <div key={profile.id} className="p-3 bg-secondary/30 rounded-lg space-y-3">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div>
                            <span className="font-medium">{profile.email || 'Sem email'}</span>
                            {profile.full_name && <span className="text-muted-foreground text-sm ml-2">{profile.full_name}</span>}
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${isActive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-muted text-muted-foreground'}`}>
                              {isActive ? 'Demo Ativo' : 'Inativo'}
                            </span>
                            <Button
                              variant={isActive ? "destructive" : "default"}
                              size="sm"
                              disabled={togglingDemo === profile.id}
                              onClick={() => toggleDemo(profile.id, isActive)}
                            >
                              {togglingDemo === profile.id ? <Loader2 className="w-3 h-3 animate-spin" /> : isActive ? 'Desativar' : 'Ativar'}
                            </Button>
                          </div>
                        </div>

                        {/* Configuração Rápida (auto-fill) */}
                        <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 space-y-3">
                          <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                            <Sparkles className="w-3 h-3" />
                            Configuração Rápida — preenche todos os cards da dashboard automaticamente
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                            <div>
                              <label className="text-[10px] text-muted-foreground uppercase">Saldo total (R$)</label>
                              <Input type="text" inputMode="decimal" placeholder="50000"
                                value={quickSaldo[profile.id] || ''}
                                onChange={(e) => setQuickSaldo(p => ({ ...p, [profile.id]: e.target.value }))}
                                className="h-9 text-xs" />
                            </div>
                            <div>
                              <label className="text-[10px] text-muted-foreground uppercase">Ticket médio (R$)</label>
                              <Input type="text" inputMode="decimal" placeholder="24.90"
                                value={quickTicket[profile.id] || ''}
                                onChange={(e) => setQuickTicket(p => ({ ...p, [profile.id]: e.target.value }))}
                                className="h-9 text-xs" />
                            </div>
                            <div>
                              <label className="text-[10px] text-muted-foreground uppercase">Total usuários</label>
                              <Input type="text" inputMode="numeric" placeholder="2500"
                                value={quickUsers[profile.id] || ''}
                                onChange={(e) => setQuickUsers(p => ({ ...p, [profile.id]: e.target.value }))}
                                className="h-9 text-xs" />
                            </div>
                            <div className="flex items-end">
                              <Button
                                size="sm"
                                className="w-full btn-gradient"
                                disabled={applyingQuick === profile.id}
                                onClick={() => applyQuickConfig(profile.id)}
                              >
                                {applyingQuick === profile.id
                                  ? <Loader2 className="w-3 h-3 animate-spin" />
                                  : <><Sparkles className="w-3 h-3 mr-1" />Aplicar & Ativar</>}
                              </Button>
                            </div>
                          </div>
                          {/* Overrides opcionais - o que o admin digita aqui bate 1:1 no dashboard */}
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-2 border-t border-primary/10">
                            <div>
                              <label className="text-[10px] text-muted-foreground uppercase">Vendas hoje (R$) — opcional</label>
                              <Input type="text" inputMode="decimal" placeholder="auto"
                                value={quickRevToday[profile.id] || ''}
                                onChange={(e) => setQuickRevToday(p => ({ ...p, [profile.id]: e.target.value }))}
                                className="h-8 text-xs" />
                            </div>
                            <div>
                              <label className="text-[10px] text-muted-foreground uppercase">Vendas mês (R$) — opcional</label>
                              <Input type="text" inputMode="decimal" placeholder="auto"
                                value={quickRevMonth[profile.id] || ''}
                                onChange={(e) => setQuickRevMonth(p => ({ ...p, [profile.id]: e.target.value }))}
                                className="h-8 text-xs" />
                            </div>
                            <div>
                              <label className="text-[10px] text-muted-foreground uppercase">Usuários hoje — opcional</label>
                              <Input type="text" inputMode="numeric" placeholder="auto"
                                value={quickUsersToday[profile.id] || ''}
                                onChange={(e) => setQuickUsersToday(p => ({ ...p, [profile.id]: e.target.value }))}
                                className="h-8 text-xs" />
                            </div>
                          </div>
                          {(() => {
                            const s = parseDemoNumber(quickSaldo[profile.id]);
                            const t = parseDemoNumber(quickTicket[profile.id]);
                            const u = parseDemoInteger(quickUsers[profile.id]);
                            if (s <= 0 || t <= 0) return null;
                            const ov: any = {};
                            const rt = parseDemoNumber(quickRevToday[profile.id]);
                            const rm = parseDemoNumber(quickRevMonth[profile.id]);
                            const ut = parseDemoInteger(quickUsersToday[profile.id]);
                            if (quickRevToday[profile.id]?.trim()) { ov.revenueToday = rt; ov.salesToday = Math.round(rt / Math.max(t, 0.01)); }
                            if (quickRevMonth[profile.id]?.trim()) { ov.revenueMonth = rm; ov.salesMonth = Math.round(rm / Math.max(t, 0.01)); }
                            if (quickUsersToday[profile.id]?.trim()) ov.usersToday = ut;
                            const p = deriveDemoConfig(s, t, u, ov);
                            const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
                            return (
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px] pt-1">
                                <div className="p-2 rounded bg-secondary/40"><span className="text-muted-foreground">Vendas hoje:</span> <span className="font-mono">{p.salesToday} · {fmt(p.revenueToday)}</span></div>
                                <div className="p-2 rounded bg-secondary/40"><span className="text-muted-foreground">Vendas mês:</span> <span className="font-mono">{p.salesMonth} · {fmt(p.revenueMonth)}</span></div>
                                <div className="p-2 rounded bg-secondary/40"><span className="text-muted-foreground">VIPs ativos:</span> <span className="font-mono">{p.activeVips}</span></div>
                                <div className="p-2 rounded bg-secondary/40"><span className="text-muted-foreground">Bloqueados:</span> <span className="font-mono">{p.blockedUsers}</span></div>
                                <div className="p-2 rounded bg-secondary/40"><span className="text-muted-foreground">Usuários hoje/mês:</span> <span className="font-mono">{p.usersToday}/{p.usersMonth}</span></div>
                                <div className="p-2 rounded bg-secondary/40"><span className="text-muted-foreground">Conv. hoje:</span> <span className="font-mono">{p.conversionToday}%</span></div>
                                <div className="p-2 rounded bg-secondary/40"><span className="text-muted-foreground">Conv. mês:</span> <span className="font-mono">{p.conversionMonth}%</span></div>
                                <div className="p-2 rounded bg-secondary/40"><span className="text-muted-foreground">Conv. total:</span> <span className="font-mono">{p.conversionTotal}%</span></div>
                              </div>
                            );
                          })()}
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Key className="w-3 h-3" /> Chave Demo RevantPay
                          </div>
                          <Input
                            type={showKey[profile.id] ? "text" : "password"}
                            value={demoKeyDrafts[profile.id] || ''}
                            onChange={(e) => setDemoKeyDrafts(prev => ({ ...prev, [profile.id]: e.target.value }))}
                            placeholder="rpay_demo_..."
                            className="flex-1 min-w-[220px] h-9 text-xs font-mono"
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowKey(prev => ({ ...prev, [profile.id]: !prev[profile.id] }))}
                          >
                            <Eye className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={savingKey === profile.id}
                            onClick={() => saveDemoKey(profile.id)}
                          >
                            {savingKey === profile.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Save className="w-3 h-3 mr-1" />Salvar</>}
                          </Button>
                          <Button
                            variant="default"
                            size="sm"
                            disabled={!hasKey || syncingDemo === profile.id}
                            onClick={() => syncDemo(profile.id)}
                            title={hasKey ? "Puxar dados da RevantPay agora" : "Salve uma chave primeiro"}
                          >
                            {syncingDemo === profile.id
                              ? <Loader2 className="w-3 h-3 animate-spin" />
                              : <><RefreshCcw className="w-3 h-3 mr-1" />Sincronizar</>}
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">Última sincronização: {lastSync}</p>

                        {/* Generate fake transactions */}
                        <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-border/30">
                          <div className="text-xs text-muted-foreground">Gerar vendas fictícias:</div>
                          <Input
                            type="number"
                            min={1}
                            max={500}
                            placeholder="50"
                            value={genCount[profile.id] || ''}
                            onChange={(e) => setGenCount(prev => ({ ...prev, [profile.id]: e.target.value }))}
                            className="w-20 h-9 text-xs"
                          />
                          <span className="text-xs text-muted-foreground">vendas, ticket</span>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="24.90"
                            value={genTicket[profile.id] || ''}
                            onChange={(e) => setGenTicket(prev => ({ ...prev, [profile.id]: e.target.value }))}
                            className="w-24 h-9 text-xs"
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={!hasKey || generatingDemo === profile.id}
                            onClick={() => generateDemo(profile.id)}
                          >
                            {generatingDemo === profile.id
                              ? <Loader2 className="w-3 h-3 animate-spin" />
                              : <><Sparkles className="w-3 h-3 mr-1" />Gerar</>}
                          </Button>
                        </div>

                        {/* Webhook secret */}
                        <div className="space-y-2 pt-2 border-t border-border/30">
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <ShieldCheck className="w-3 h-3" /> Webhook Secret (HMAC)
                            </div>
                            <Input
                              type="password"
                              value={webhookSecretDrafts[profile.id] || ''}
                              onChange={(e) => setWebhookSecretDrafts(prev => ({ ...prev, [profile.id]: e.target.value }))}
                              placeholder="cole o webhook_secret da RevantPay"
                              className="flex-1 min-w-[220px] h-9 text-xs font-mono"
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={savingSecret === profile.id}
                              onClick={() => saveWebhookSecret(profile.id)}
                            >
                              {savingSecret === profile.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Save className="w-3 h-3 mr-1" />Salvar</>}
                            </Button>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs text-muted-foreground">Webhook URL para colar na RevantPay:</span>
                            <code className="text-xs bg-background/60 px-2 py-1 rounded font-mono break-all flex-1">{WEBHOOK_URL}</code>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => { navigator.clipboard.writeText(WEBHOOK_URL); toast({ title: "URL copiada!" }); }}
                            >
                              Copiar
                            </Button>
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-1">
                            HMAC secret = a própria <strong>Chave Demo RevantPay</strong> acima (não precisa configurar separado).
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  {allProfiles.length === 0 && <p className="text-muted-foreground text-center py-4">Nenhum usuário cadastrado.</p>}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </AdminLayout>
  );
}
