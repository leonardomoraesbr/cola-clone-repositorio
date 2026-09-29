import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { brtDayKey, brtStartOfDay, brtStartOfMonth, formatBrtShort } from "@/lib/brtDate";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { HeroCard, StatCard, Panel } from "@/components/ui/stat-kit";
import { DrillDownDialog, DrillPayload } from "@/components/admin/DrillDown";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  DollarSign, Users, Bot, ShoppingCart, TrendingUp, AlertTriangle, Loader2, RefreshCw,
  Activity, Megaphone, Download, HeartPulse, Zap, UserPlus, Trophy, Key,
} from "lucide-react";

const brl = (n: number) => `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct = (n: number) => `${n.toFixed(1)}%`;

interface Props {
  onNavigate?: (tab: any) => void;
}

export function AdminOverview({ onNavigate }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<string | null>(null);
  const [drill, setDrill] = useState<DrillPayload | null>(null);
  const [data, setData] = useState<any>({ profiles: [], bots: [], orders: [], leads: [], vips: [], fees: [] });

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const [p, b, o, l, v, f] = await Promise.all([
        supabase.from("admin_profile_flags").select("id, email, full_name, created_at, has_revantpay_key, revantpay_key_status, revantpay_key_checked_at"),
        supabase.from("bots").select("id, user_id, name, username, created_at, health_status, last_health_check"),
        supabase.from("payment_orders").select("id, bot_id, telegram_user_id, amount, status, created_at, paid_at, expires_at"),
        supabase.from("bot_users").select("id, bot_id, telegram_user_id, created_at, last_interaction_at, has_clicked_button"),
        supabase.from("vip_members").select("id, bot_id, expires_at, is_active, created_at"),
        supabase.from("platform_fees_ledger").select("id, user_id, fee_amount, status, created_at"),
      ]);
      setData({ profiles: p.data || [], bots: b.data || [], orders: o.data || [], leads: l.data || [], vips: v.data || [], fees: f.data || [] });
    } finally {
      setLoading(false);
    }
  }

  const owner = useMemo(() => {
    const m: Record<string, string> = {};
    data.bots.forEach((b: any) => { m[b.id] = b.user_id; });
    return m;
  }, [data.bots]);

  const nameOfUser = (id?: string) => {
    const p = data.profiles.find((x: any) => x.id === id);
    return p?.full_name || p?.email || (id ? id.slice(0, 8) : "—");
  };
  const nameOfBot = (id?: string) => {
    const b = data.bots.find((x: any) => x.id === id);
    return b?.username ? `@${b.username}` : (b?.name || "—");
  };

  const m = useMemo(() => {
    const today = brtStartOfDay().getTime();
    const month = brtStartOfMonth().getTime();
    const paid = data.orders.filter((o: any) => o.status === "paid");
    const sum = (arr: any[]) => arr.reduce((s, o) => s + Number(o.amount || 0), 0);
    const paidToday = paid.filter((o: any) => new Date(o.paid_at || o.created_at).getTime() >= today);
    const paidMonth = paid.filter((o: any) => new Date(o.paid_at || o.created_at).getTime() >= month);
    const sellers = new Set(paid.map((o: any) => owner[o.bot_id]).filter(Boolean));
    return {
      revenueTotal: sum(paid), revenueToday: sum(paidToday), revenueMonth: sum(paidMonth),
      sales: paid.length, salesToday: paidToday.length, salesMonth: paidMonth.length,
      orders: data.orders.length,
      pending: data.orders.filter((o: any) => o.status === "pending"),
      conversion: data.orders.length ? (paid.length / data.orders.length) * 100 : 0,
      ticket: paid.length ? sum(paid) / paid.length : 0,
      users: data.profiles.length,
      signupsToday: data.profiles.filter((p: any) => new Date(p.created_at).getTime() >= today),
      leads: data.leads.length,
      leadsToday: data.leads.filter((l: any) => new Date(l.created_at).getTime() >= today),
      bots: data.bots.length,
      activeVips: data.vips.filter((v: any) => v.is_active && new Date(v.expires_at).getTime() > Date.now()).length,
      sellersCount: sellers.size,
      feesTotal: data.fees.reduce((s: number, f: any) => s + Number(f.fee_amount || 0), 0),
      recentSales: [...paid].sort((a, b) => String(b.paid_at || b.created_at).localeCompare(String(a.paid_at || a.created_at))).slice(0, 12),
    };
  }, [data, owner]);

  const chart = useMemo(() => {
    const days: any[] = [];
    for (let i = 13; i >= 0; i--) {
      const start = brtStartOfDay(-i).getTime();
      const end = start + 86400000;
      const within = (v: any) => { const t = new Date(v).getTime(); return t >= start && t < end; };
      const dayPaid = data.orders.filter((o: any) => o.status === "paid" && within(o.paid_at || o.created_at));
      days.push({
        day: brtDayKey(new Date(start)),
        gmv: Number(dayPaid.reduce((s: number, o: any) => s + Number(o.amount || 0), 0).toFixed(2)),
        vendas: dayPaid.length,
        leads: data.leads.filter((l: any) => within(l.created_at)).length,
        cadastros: data.profiles.filter((p: any) => within(p.created_at)).length,
      });
    }
    return days;
  }, [data]);

  const alerts = useMemo(() => {
    const dayAgo = Date.now() - 86400000;
    const weekAgo = Date.now() - 7 * 86400000;
    const usersWithBot = new Set(data.bots.map((b: any) => b.user_id));
    const soldRecently = new Set(
      data.orders.filter((o: any) => o.status === "paid" && new Date(o.paid_at || o.created_at).getTime() >= weekAgo)
        .map((o: any) => owner[o.bot_id]).filter(Boolean)
    );
    const everSold = new Set(data.orders.filter((o: any) => o.status === "paid").map((o: any) => owner[o.bot_id]).filter(Boolean));
    return {
      invalidKeys: data.profiles.filter((p: any) => p.has_revantpay_key && p.revantpay_key_status === "invalid"),
      noKey: data.profiles.filter((p: any) => !p.has_revantpay_key),
      unhealthyBots: data.bots.filter((b: any) => b.health_status && b.health_status !== "active"),
      stalePending: data.orders.filter((o: any) => o.status === "pending" && new Date(o.created_at).getTime() < dayAgo),
      usersWithoutBot: data.profiles.filter((p: any) => !usersWithBot.has(p.id)),
      churnSellers: [...everSold].filter(id => !soldRecently.has(id)).map(id => data.profiles.find((p: any) => p.id === id)).filter(Boolean),
    };
  }, [data, owner]);

  const orderCols = [
    { key: "id", label: "ID do pedido", mono: true, value: (r: any) => r.id },
    { key: "created_at", label: "Criado em", mono: true, value: (r: any) => formatBrtShort(r.created_at) },
    { key: "paid_at", label: "Pago em", mono: true, value: (r: any) => (r.paid_at ? formatBrtShort(r.paid_at) : "—") },
    { key: "status", label: "Status", value: (r: any) => r.status },
    { key: "amount", label: "Valor", align: "right" as const, mono: true, value: (r: any) => brl(Number(r.amount || 0)) },
    { key: "bot", label: "Bot", value: (r: any) => nameOfBot(r.bot_id) },
    { key: "seller", label: "Vendedor", value: (r: any) => nameOfUser(owner[r.bot_id]) },
  ];
  const userCols = [
    { key: "id", label: "ID", mono: true, value: (r: any) => r.id },
    { key: "email", label: "E-mail", value: (r: any) => r.email || "—" },
    { key: "full_name", label: "Nome", value: (r: any) => r.full_name || "—" },
    { key: "created_at", label: "Cadastro", mono: true, value: (r: any) => formatBrtShort(r.created_at) },
    { key: "revant", label: "Revant Pay", value: (r: any) => (r.has_revantpay_key ? (r.revantpay_key_status || "conectada") : "sem chave") },
    { key: "checked", label: "Validada em", mono: true, value: (r: any) => (r.revantpay_key_checked_at ? formatBrtShort(r.revantpay_key_checked_at) : "—") },
  ];
  const botCols = [
    { key: "id", label: "ID do bot", mono: true, value: (r: any) => r.id },
    { key: "name", label: "Nome", value: (r: any) => r.name },
    { key: "username", label: "Username", value: (r: any) => (r.username ? `@${r.username}` : "—") },
    { key: "owner", label: "Dono", value: (r: any) => nameOfUser(r.user_id) },
    { key: "health_status", label: "Saúde", value: (r: any) => r.health_status || "—" },
    { key: "last_health_check", label: "Último check", mono: true, value: (r: any) => formatBrtShort(r.last_health_check) },
    { key: "created_at", label: "Criado em", mono: true, value: (r: any) => formatBrtShort(r.created_at) },
  ];
  const open = (title: string, columns: any[], rows: any[], subtitle?: string) => setDrill({ title, subtitle, columns, rows });

  async function runAction(id: string, fn: string, body: any, okMsg: string) {
    setRunning(id);
    try {
      const { data: res, error } = await supabase.functions.invoke(fn, { body });
      if (error) throw error;
      toast({ title: okMsg, description: res ? JSON.stringify(res).slice(0, 180) : undefined });
      await load();
    } catch (e: any) {
      toast({ title: "Falha na ação", description: e.message, variant: "destructive" });
    } finally {
      setRunning(null);
    }
  }

  function exportUsers() {
    const head = ["id", "email", "nome", "cadastro", "revant"];
    const rows = data.profiles.map((p: any) => [p.id, p.email || "", p.full_name || "", formatBrtShort(p.created_at), p.has_revantpay_key ? (p.revantpay_key_status || "conectada") : "sem chave"]);
    const csv = [head, ...rows].map(r => r.map((v: any) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url; a.download = "usuarios-riot-vips.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  const alertItems = [
    { key: "invalid", label: "Chaves Revant inválidas", value: alerts.invalidKeys.length, tone: "text-rose-400", cols: userCols, rows: alerts.invalidKeys, hint: "vendedores sem conseguir gerar PIX" },
    { key: "unhealthy", label: "Bots com erro/banidos", value: alerts.unhealthyBots.length, tone: "text-rose-400", cols: botCols, rows: alerts.unhealthyBots, hint: "sem responder ao getMe" },
    { key: "stale", label: "PIX pendentes > 24h", value: alerts.stalePending.length, tone: "text-amber-400", cols: orderCols, rows: alerts.stalePending, hint: "candidatos a reconciliação" },
    { key: "nobot", label: "Usuários sem nenhum bot", value: alerts.usersWithoutBot.length, tone: "text-amber-400", cols: userCols, rows: alerts.usersWithoutBot, hint: "alvo de onboarding" },
    { key: "nokey", label: "Sem chave Revant", value: alerts.noKey.length, tone: "text-amber-400", cols: userCols, rows: alerts.noKey, hint: "não conseguem vender" },
    { key: "churn", label: "Vendedores sem venda há 7 dias", value: alerts.churnSellers.length, tone: "text-fuchsia-400", cols: userCols, rows: alerts.churnSellers, hint: "risco de churn" },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Visão geral da plataforma · fuso de Brasília</p>
        <Button variant="outline" size="sm" className="h-8 border-border" onClick={load}>
          <RefreshCw className="w-3.5 h-3.5 mr-1" /> Atualizar
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <HeroCard icon={DollarSign} label="GMV total aprovado" value={brl(m.revenueTotal)} footnote={`${m.sales} vendas · ticket ${brl(m.ticket)}`} color="bg-emerald-500/10 text-emerald-400" valueClass="text-emerald-400" />
        <HeroCard icon={TrendingUp} label="GMV no mês" value={brl(m.revenueMonth)} footnote={`${m.salesMonth} vendas no mês`} color="bg-primary/10 text-primary" />
        <HeroCard icon={Zap} label="GMV hoje" value={brl(m.revenueToday)} footnote={`${m.salesToday} vendas hoje`} color="bg-violet-500/10 text-violet-400" />
        <HeroCard icon={Trophy} label="Taxas da plataforma" value={brl(m.feesTotal)} footnote={`${data.fees.length} lançamentos`} color="bg-amber-500/10 text-amber-400" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div onClick={() => open("Usuários cadastrados", userCols, data.profiles)} className="cursor-pointer">
          <StatCard icon={Users} label="Usuários cadastrados" value={m.users} subValue={`+${m.signupsToday.length} hoje`} color="bg-blue-500/10 text-blue-400" bar="bg-blue-400" />
        </div>
        <div onClick={() => open("Bots da plataforma", botCols, data.bots)} className="cursor-pointer">
          <StatCard icon={Bot} label="Bots na plataforma" value={m.bots} subValue={`${m.sellersCount} vendedores com venda`} color="bg-violet-500/10 text-violet-400" bar="bg-violet-400" />
        </div>
        <div onClick={() => open("Pedidos gerados", orderCols, data.orders)} className="cursor-pointer">
          <StatCard icon={ShoppingCart} label="Pedidos gerados" value={m.orders} subValue={`conversão ${pct(m.conversion)}`} color="bg-amber-500/10 text-amber-400" bar="bg-amber-400" progress={m.conversion} />
        </div>
        <div className="cursor-default">
          <StatCard icon={Activity} label="VIPs ativos" value={m.activeVips} subValue={`${m.leads.toLocaleString("pt-BR")} leads · +${m.leadsToday.length} hoje`} color="bg-emerald-500/10 text-emerald-400" bar="bg-emerald-400" />
        </div>
      </div>

      <Panel icon={TrendingUp} title="Últimos 14 dias" subtitle="GMV, vendas, leads e cadastros">
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chart}>
              <defs>
                <linearGradient id="ov-gmv" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#34d399" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
              <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={10} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="gmv" name="GMV (R$)" stroke="#34d399" fill="url(#ov-gmv)" strokeWidth={2} />
              <Area type="monotone" dataKey="vendas" name="Vendas" stroke="#38bdf8" fill="transparent" strokeWidth={2} />
              <Area type="monotone" dataKey="leads" name="Leads" stroke="#a78bfa" fill="transparent" strokeWidth={2} />
              <Area type="monotone" dataKey="cadastros" name="Cadastros" stroke="#fbbf24" fill="transparent" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Panel icon={AlertTriangle} title="Central de alertas" subtitle="clique para ver a lista e exportar">
          <div className="space-y-2">
            {alertItems.map(a => (
              <button key={a.key} onClick={() => open(a.label, a.cols, a.rows)}
                className="w-full flex items-center justify-between gap-3 p-3 rounded-lg border border-border/50 hover:border-primary/40 hover:bg-secondary/30 transition-all text-left">
                <div>
                  <p className="text-xs font-medium">{a.label}</p>
                  <p className="text-[10px] text-muted-foreground">{a.hint}</p>
                </div>
                <span className={`font-mono text-lg ${a.value ? a.tone : "text-muted-foreground"}`}>{a.value}</span>
              </button>
            ))}
          </div>
        </Panel>

        <Panel icon={Zap} title="Ações rápidas do admin" subtitle="decisões em massa e manutenção">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Button variant="outline" className="border-border justify-start h-auto py-3" disabled={running === "pix"}
              onClick={() => runAction("pix", "check-pending-payments", {}, "Reconciliação disparada")}>
              {running === "pix" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2 text-primary" />}
              <span className="text-left"><span className="block text-xs font-medium">Reconciliar PIX pendentes</span><span className="block text-[10px] text-muted-foreground">consulta a Revant e libera acessos</span></span>
            </Button>
            <Button variant="outline" className="border-border justify-start h-auto py-3" disabled={running === "health"}
              onClick={() => runAction("health", "bot-health-check", {}, "Checagem de bots disparada")}>
              {running === "health" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <HeartPulse className="w-4 h-4 mr-2 text-emerald-400" />}
              <span className="text-left"><span className="block text-xs font-medium">Verificar saúde dos bots</span><span className="block text-[10px] text-muted-foreground">getMe em todos os bots ativos</span></span>
            </Button>
            <Button variant="outline" className="border-border justify-start h-auto py-3" onClick={exportUsers}>
              <Download className="w-4 h-4 mr-2 text-sky-400" />
              <span className="text-left"><span className="block text-xs font-medium">Exportar base de usuários</span><span className="block text-[10px] text-muted-foreground">CSV com status Revant</span></span>
            </Button>
            <Button variant="outline" className="border-border justify-start h-auto py-3" onClick={() => onNavigate?.("broadcast")}>
              <Megaphone className="w-4 h-4 mr-2 text-amber-400" />
              <span className="text-left"><span className="block text-xs font-medium">Comunicar a base</span><span className="block text-[10px] text-muted-foreground">broadcast e e-mail em massa</span></span>
            </Button>
            <Button variant="outline" className="border-border justify-start h-auto py-3" onClick={() => onNavigate?.("users")}>
              <UserPlus className="w-4 h-4 mr-2 text-blue-400" />
              <span className="text-left"><span className="block text-xs font-medium">Gerenciar usuários</span><span className="block text-[10px] text-muted-foreground">ações individuais por vendedor</span></span>
            </Button>
            <Button variant="outline" className="border-border justify-start h-auto py-3" onClick={() => open("Usuários com chave Revant inválida", userCols, alerts.invalidKeys)}>
              <Key className="w-4 h-4 mr-2 text-rose-400" />
              <span className="text-left"><span className="block text-xs font-medium">Auditar chaves Revant</span><span className="block text-[10px] text-muted-foreground">quem precisa reconectar</span></span>
            </Button>
          </div>
        </Panel>
      </div>

      <Panel icon={ShoppingCart} title="Últimas vendas da plataforma" subtitle="data e horário de Brasília"
        action={<Button variant="outline" size="sm" className="h-8 border-border" onClick={() => open("Todas as vendas aprovadas", orderCols, data.orders.filter((o: any) => o.status === "paid"))}>Ver todas</Button>}>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border/60 text-muted-foreground">
                <th className="text-left py-2 px-3 font-medium">Pedido</th>
                <th className="text-left py-2 px-3 font-medium">Bot</th>
                <th className="text-left py-2 px-3 font-medium">Vendedor</th>
                <th className="text-right py-2 px-3 font-medium">Valor</th>
                <th className="text-left py-2 px-3 font-medium">Criado em</th>
                <th className="text-left py-2 px-3 font-medium">Pago em</th>
              </tr>
            </thead>
            <tbody>
              {m.recentSales.length === 0 && <tr><td colSpan={6} className="p-5 text-muted-foreground">Nenhuma venda registrada.</td></tr>}
              {m.recentSales.map((o: any) => (
                <tr key={o.id} className="border-b border-border/30 hover:bg-secondary/30">
                  <td className="py-2 px-3 font-mono text-[10px]">{o.id.slice(0, 8)}</td>
                  <td className="py-2 px-3">{nameOfBot(o.bot_id)}</td>
                  <td className="py-2 px-3 truncate max-w-[180px]">{nameOfUser(owner[o.bot_id])}</td>
                  <td className="py-2 px-3 text-right font-mono text-emerald-400">{brl(Number(o.amount || 0))}</td>
                  <td className="py-2 px-3 font-mono text-muted-foreground">{formatBrtShort(o.created_at)}</td>
                  <td className="py-2 px-3 font-mono text-muted-foreground">{formatBrtShort(o.paid_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <DrillDownDialog payload={drill} onClose={() => setDrill(null)} />
    </div>
  );
}
