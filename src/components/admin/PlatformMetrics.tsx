import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { brtDayKey, brtStartOfDay, brtStartOfMonth, formatBrtShort } from "@/lib/brtDate";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DrillDownDialog, DrillPayload } from "@/components/admin/DrillDown";
import {
  Users, UserPlus, Bot, Activity, Link2, ShoppingCart, CheckCircle2, DollarSign,
  Percent, Trophy, Repeat, Loader2, ArrowUpRight, ArrowDownRight, Zap, AlertTriangle, Info,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

type PeriodKey = "today" | "yesterday" | "7d" | "14d" | "30d" | "week" | "month" | "last_month" | "custom";

const PERIODS: { id: PeriodKey; label: string }[] = [
  { id: "today", label: "Hoje" },
  { id: "yesterday", label: "Ontem" },
  { id: "7d", label: "7 dias" },
  { id: "14d", label: "14 dias" },
  { id: "30d", label: "30 dias" },
  { id: "week", label: "Esta semana" },
  { id: "month", label: "Este mês" },
  { id: "last_month", label: "Mês anterior" },
  { id: "custom", label: "Personalizado" },
];

interface Range { start: Date; end: Date }

function startOfBrtWeek(): Date {
  // Semana comercial começa na segunda-feira (BRT)
  const midnightBrt = brtStartOfDay();
  const back = (midnightBrt.getUTCDay() + 6) % 7;
  return brtStartOfDay(-back);
}

function resolveRange(period: PeriodKey, customStart: string, customEnd: string): Range {
  const now = new Date();
  switch (period) {
    case "today": return { start: brtStartOfDay(), end: now };
    case "yesterday": return { start: brtStartOfDay(-1), end: brtStartOfDay() };
    case "7d": return { start: brtStartOfDay(-6), end: now };
    case "14d": return { start: brtStartOfDay(-13), end: now };
    case "30d": return { start: brtStartOfDay(-29), end: now };
    case "week": return { start: startOfBrtWeek(), end: now };
    case "month": return { start: brtStartOfMonth(), end: now };
    case "last_month": {
      const thisMonth = brtStartOfMonth();
      const prev = brtStartOfMonth(new Date(thisMonth.getTime() - 86400000));
      return { start: prev, end: thisMonth };
    }
    case "custom": {
      const start = customStart ? new Date(`${customStart}T00:00:00-03:00`) : brtStartOfDay(-29);
      const end = customEnd ? new Date(`${customEnd}T23:59:59-03:00`) : now;
      return { start, end };
    }
  }
}

function previousRange(range: Range): Range {
  const span = range.end.getTime() - range.start.getTime();
  return { start: new Date(range.start.getTime() - span), end: new Date(range.start.getTime()) };
}

const inRange = (value: string | null | undefined, r: Range) => {
  if (!value) return false;
  const t = new Date(value).getTime();
  return t >= r.start.getTime() && t <= r.end.getTime();
};

const brl = (n: number) => `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct = (n: number) => `${n.toFixed(1)}%`;

function Delta({ current, previous, suffix }: { current: number; previous: number; suffix?: string }) {
  if (previous === 0 && current === 0) return <p className="text-[10px] text-muted-foreground mt-1">Sem dados no período anterior</p>;
  if (previous === 0) return <p className="text-[10px] text-emerald-400 mt-1">Novo · anterior 0{suffix || ""}</p>;
  const change = ((current - previous) / previous) * 100;
  const up = change >= 0;
  return (
    <p className={`text-[10px] mt-1 flex items-center gap-1 ${up ? "text-emerald-400" : "text-rose-400"}`}>
      {up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
      {up ? "+" : ""}{change.toFixed(1)}% vs anterior ({previous.toLocaleString("pt-BR")}{suffix || ""})
    </p>
  );
}

function Kpi({ icon: Icon, label, value, hint, current, previous, color = "text-primary", suffix, onDrill }: any) {
  return (
    <Card
      className={`glass-card border-border/50 ${onDrill ? "cursor-pointer hover:border-primary/50 transition-colors" : ""}`}
      onClick={onDrill}
    >
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
          <div className={`w-8 h-8 rounded-lg bg-secondary/60 flex items-center justify-center ${color}`}><Icon className="w-4 h-4" /></div>
        </div>
        <p className="font-mono text-2xl font-bold tracking-tight">{value}</p>
        {hint && <p className="text-[10px] text-muted-foreground mt-1">{hint}</p>}
        {typeof current === "number" && typeof previous === "number" && <Delta current={current} previous={previous} suffix={suffix} />}
        {onDrill && <p className="text-[10px] text-primary/80 mt-2">Ver detalhes →</p>}
      </CardContent>
    </Card>
  );
}

function Section({ title, subtitle, children }: any) {
  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        {subtitle && <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

interface Raw {
  profiles: any[];
  bots: any[];
  orders: any[];
  botUsers: any[];
  events: any[];
  vips: any[];
}

const CHART_METRICS = [
  { id: "users", label: "Novos usuários", color: "#38bdf8" },
  { id: "bots", label: "Bots criados", color: "#a78bfa" },
  { id: "orders", label: "Pedidos", color: "#fbbf24" },
  { id: "sales", label: "Vendas", color: "#34d399" },
  { id: "gmv", label: "GMV (R$)", color: "#f472b6" },
  { id: "leads", label: "Leads (/start)", color: "#60a5fa" },
] as const;

export function PlatformMetrics() {
  const [period, setPeriod] = useState<PeriodKey>("30d");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [loading, setLoading] = useState(true);
  const [raw, setRaw] = useState<Raw>({ profiles: [], bots: [], orders: [], botUsers: [], events: [], vips: [] });
  const [chartMetrics, setChartMetrics] = useState<string[]>(["users", "orders", "sales"]);
  const [drill, setDrill] = useState<DrillPayload | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const [p, b, o, bu, ev, v] = await Promise.all([
        supabase.from("admin_profile_flags").select("id, email, full_name, created_at, has_revantpay_key, revantpay_key_status, revantpay_key_checked_at"),
        supabase.from("bots").select("id, user_id, name, username, created_at, updated_at, health_status"),
        supabase.from("payment_orders").select("id, bot_id, plan_id, telegram_user_id, telegram_username, amount, status, created_at, paid_at, expires_at, source_type"),
        supabase.from("bot_users").select("id, bot_id, telegram_user_id, telegram_username, created_at, last_interaction_at, has_clicked_button"),
        supabase.from("telegram_payment_events").select("id, event_type, success, error_message, created_at, bot_id, telegram_user_id, order_id"),
        supabase.from("vip_members").select("id, bot_id, created_at, expires_at, is_active"),
      ]);
      setRaw({
        profiles: p.data || [], bots: b.data || [], orders: o.data || [],
        botUsers: bu.data || [], events: ev.data || [], vips: v.data || [],
      });
    } finally {
      setLoading(false);
    }
  }

  const range = useMemo(() => resolveRange(period, customStart, customEnd), [period, customStart, customEnd]);
  const prev = useMemo(() => previousRange(range), [range]);

  const botOwner = useMemo(() => {
    const map: Record<string, string> = {};
    raw.bots.forEach(b => { map[b.id] = b.user_id; });
    return map;
  }, [raw.bots]);

  const metrics = useMemo(() => {
    const compute = (r: Range) => {
      const newUsers = raw.profiles.filter(p => inRange(p.created_at, r)).length;
      const newBots = raw.bots.filter(b => inRange(b.created_at, r)).length;
      const orders = raw.orders.filter(o => inRange(o.created_at, r));
      const paid = orders.filter(o => o.status === "paid");
      const gmvTotal = orders.reduce((s, o) => s + Number(o.amount || 0), 0);
      const gmvPaid = paid.reduce((s, o) => s + Number(o.amount || 0), 0);
      const gmvPending = orders.filter(o => o.status === "pending").reduce((s, o) => s + Number(o.amount || 0), 0);
      const gmvExpired = orders.filter(o => o.status === "expired").reduce((s, o) => s + Number(o.amount || 0), 0);
      const gmvRefunded = orders.filter(o => o.status === "refunded").reduce((s, o) => s + Number(o.amount || 0), 0);

      // Bots ativos: bot com pedido, lead novo ou interação de lead dentro do período
      const activeBotIds = new Set<string>();
      orders.forEach(o => o.bot_id && activeBotIds.add(o.bot_id));
      raw.botUsers.forEach(u => {
        if (inRange(u.created_at, r) || inRange(u.last_interaction_at, r)) activeBotIds.add(u.bot_id);
      });
      raw.events.forEach(e => { if (inRange(e.created_at, r) && e.bot_id) activeBotIds.add(e.bot_id); });

      // Usuários ativos: dono de bot ativo, quem criou/editou bot ou se cadastrou no período
      const activeUsers = new Set<string>();
      activeBotIds.forEach(id => { const u = botOwner[id]; if (u) activeUsers.add(u); });
      raw.bots.forEach(b => { if (inRange(b.created_at, r) || inRange(b.updated_at, r)) activeUsers.add(b.user_id); });

      // Vendedores ativos: pelo menos um pedido gerado no período
      const sellersWithOrders = new Set<string>();
      const sellersWithSales = new Set<string>();
      orders.forEach(o => { const u = botOwner[o.bot_id]; if (u) sellersWithOrders.add(u); });
      paid.forEach(o => { const u = botOwner[o.bot_id]; if (u) sellersWithSales.add(u); });

      // Vendedores recorrentes: venderam no período E em algum período anterior
      const soldBefore = new Set<string>();
      raw.orders.forEach(o => {
        if (o.status !== "paid") return;
        if (new Date(o.created_at).getTime() < r.start.getTime()) {
          const u = botOwner[o.bot_id];
          if (u) soldBefore.add(u);
        }
      });
      const recurringSellers = [...sellersWithSales].filter(u => soldBefore.has(u)).length;

      const leads = raw.botUsers.filter(u => inRange(u.created_at, r)).length;

      // PIX (eventos auditados)
      const ev = raw.events.filter(e => inRange(e.created_at, r));
      const pixRequested = ev.filter(e => e.event_type === "payment_started").length;
      const pixGenerated = ev.filter(e => e.event_type === "pix_generated").length;
      const pixFailed = ev.filter(e => e.event_type === "revantpay_failed" || e.event_type === "minimum_amount_failed").length;
      const pixQrSent = ev.filter(e => e.event_type === "pix_qr_sent").length;
      const pixTextSent = ev.filter(e => e.event_type === "pix_text_sent").length;
      const pixPaid = ev.filter(e => e.event_type === "payment_confirmed" || e.event_type === "reconciled_paid").length;

      // Conexões Revant ativas / novas (checked_at = validação da chave)
      const revantConnected = raw.profiles.filter(p => p.has_revantpay_key).length;
      const revantValid = raw.profiles.filter(p => p.revantpay_key_status === "valid").length;
      const revantInvalid = raw.profiles.filter(p => p.revantpay_key_status === "invalid").length;
      const revantNew = raw.profiles.filter(p => p.has_revantpay_key && inRange(p.revantpay_key_checked_at, r)).length;

      return {
        newUsers, newBots, orders: orders.length, sales: paid.length,
        gmvTotal, gmvPaid, gmvPending, gmvExpired, gmvRefunded,
        conversion: orders.length ? (paid.length / orders.length) * 100 : 0,
        activeBots: activeBotIds.size, activeUsers: activeUsers.size,
        activeSellers: sellersWithOrders.size, sellingSellers: sellersWithSales.size,
        recurringSellers, leads,
        pixRequested, pixGenerated, pixFailed, pixQrSent, pixTextSent, pixPaid,
        pixSuccess: pixRequested ? (pixGenerated / pixRequested) * 100 : 0,
        pixConversion: pixGenerated ? (pixPaid / pixGenerated) * 100 : 0,
        revantConnected, revantValid, revantInvalid, revantNew,
        avgTicket: paid.length ? gmvPaid / paid.length : 0,
      };
    };
    return { cur: compute(range), old: compute(prev) };
  }, [raw, range, prev, botOwner]);

  // Série diária do período
  const chartData = useMemo(() => {
    const days: { key: string; start: number; end: number }[] = [];
    const dayMs = 86400000;
    const startDay = brtStartOfDay(0, range.start).getTime();
    const endDay = brtStartOfDay(0, range.end).getTime();
    for (let t = startDay; t <= endDay; t += dayMs) {
      days.push({ key: brtDayKey(new Date(t)) || "", start: t, end: t + dayMs });
    }
    return days.map(d => {
      const within = (v: string | null) => { if (!v) return false; const t = new Date(v).getTime(); return t >= d.start && t < d.end; };
      const dayOrders = raw.orders.filter(o => within(o.created_at));
      const dayPaid = dayOrders.filter(o => o.status === "paid");
      return {
        day: d.key,
        users: raw.profiles.filter(p => within(p.created_at)).length,
        bots: raw.bots.filter(b => within(b.created_at)).length,
        orders: dayOrders.length,
        sales: dayPaid.length,
        gmv: Number(dayPaid.reduce((s, o) => s + Number(o.amount || 0), 0).toFixed(2)),
        leads: raw.botUsers.filter(u => within(u.created_at)).length,
      };
    });
  }, [raw, range]);

  // Funil de ativação (lifetime, sobre todos os usuários cadastrados)
  const funnel = useMemo(() => {
    const usersWithBot = new Set(raw.bots.map(b => b.user_id));
    const usersRevant = new Set(raw.profiles.filter(p => p.has_revantpay_key).map(p => p.id));
    const ordersByUser: Record<string, any[]> = {};
    raw.orders.forEach(o => {
      const u = botOwner[o.bot_id];
      if (!u) return;
      (ordersByUser[u] ||= []).push(o);
    });
    const usersOrder = new Set(Object.keys(ordersByUser));
    const usersFirstSale = new Set(Object.entries(ordersByUser).filter(([, os]) => os.some(o => o.status === "paid")).map(([u]) => u));
    const usersSecondSale = new Set(Object.entries(ordersByUser).filter(([, os]) => os.filter(o => o.status === "paid").length >= 2).map(([u]) => u));
    const usersRecurring = new Set(Object.entries(ordersByUser).filter(([, os]) => {
      const paidDays = new Set(os.filter(o => o.status === "paid").map(o => brtDayKey(o.created_at)));
      return paidDays.size >= 2;
    }).map(([u]) => u));

    const total = raw.profiles.length;
    const stages = [
      { label: "Criou conta", value: total },
      { label: "Criou primeiro bot", value: usersWithBot.size },
      { label: "Conectou Revant Pay", value: usersRevant.size },
      { label: "Gerou primeiro pedido/PIX", value: usersOrder.size },
      { label: "Primeira venda aprovada", value: usersFirstSale.size },
      { label: "Segunda venda", value: usersSecondSale.size },
      { label: "Vendedor recorrente", value: usersRecurring.size },
    ];

    // Tempo médio entre cadastro e cada etapa (dias)
    const signupAt: Record<string, string> = {};
    raw.profiles.forEach(p => { signupAt[p.id] = p.created_at; });
    const firstBotAt: Record<string, string> = {};
    raw.bots.forEach(b => { if (!firstBotAt[b.user_id] || b.created_at < firstBotAt[b.user_id]) firstBotAt[b.user_id] = b.created_at; });
    const firstOrderAt: Record<string, string> = {};
    const firstSaleAt: Record<string, string> = {};
    Object.entries(ordersByUser).forEach(([u, os]) => {
      os.forEach(o => {
        if (!firstOrderAt[u] || o.created_at < firstOrderAt[u]) firstOrderAt[u] = o.created_at;
        if (o.status === "paid" && (!firstSaleAt[u] || o.created_at < firstSaleAt[u])) firstSaleAt[u] = o.created_at;
      });
    });
    const avgDays = (map: Record<string, string>) => {
      const diffs = Object.entries(map)
        .filter(([u]) => signupAt[u])
        .map(([u, at]) => (new Date(at).getTime() - new Date(signupAt[u]).getTime()) / 86400000)
        .filter(d => d >= 0);
      if (!diffs.length) return null;
      return diffs.reduce((s, d) => s + d, 0) / diffs.length;
    };

    return {
      stages,
      timings: {
        bot: avgDays(firstBotAt),
        order: avgDays(firstOrderAt),
        sale: avgDays(firstSaleAt),
      },
      activation: total ? (usersWithBot.size / total) * 100 : 0,
    };
  }, [raw, botOwner]);

  // Rankings do período
  const rankings = useMemo(() => {
    const orders = raw.orders.filter(o => inRange(o.created_at, range));
    const byUser: Record<string, any> = {};
    const byBot: Record<string, any> = {};
    orders.forEach(o => {
      const uid = botOwner[o.bot_id];
      if (uid) {
        const s = (byUser[uid] ||= { orders: 0, sales: 0, gmv: 0 });
        s.orders++;
        if (o.status === "paid") { s.sales++; s.gmv += Number(o.amount || 0); }
      }
      const bs = (byBot[o.bot_id] ||= { orders: 0, sales: 0, gmv: 0 });
      bs.orders++;
      if (o.status === "paid") { bs.sales++; bs.gmv += Number(o.amount || 0); }
    });
    const profileById: Record<string, any> = {};
    raw.profiles.forEach(p => { profileById[p.id] = p; });
    const botById: Record<string, any> = {};
    raw.bots.forEach(b => { botById[b.id] = b; });
    const botCount: Record<string, number> = {};
    raw.bots.forEach(b => { botCount[b.user_id] = (botCount[b.user_id] || 0) + 1; });

    const sellers = Object.entries(byUser).map(([id, s]: any) => ({
      id,
      name: profileById[id]?.full_name || profileById[id]?.email || "—",
      email: profileById[id]?.email,
      bots: botCount[id] || 0,
      ...s,
      conversion: s.orders ? (s.sales / s.orders) * 100 : 0,
      ticket: s.sales ? s.gmv / s.sales : 0,
    })).sort((a, b) => b.gmv - a.gmv || b.sales - a.sales).slice(0, 10);

    const bots = Object.entries(byBot).map(([id, s]: any) => ({
      id,
      name: botById[id]?.username ? `@${botById[id].username}` : (botById[id]?.name || "—"),
      health: botById[id]?.health_status,
      ...s,
      conversion: s.orders ? (s.sales / s.orders) * 100 : 0,
    })).sort((a, b) => b.gmv - a.gmv || b.sales - a.sales).slice(0, 10);

    return { sellers, bots };
  }, [raw, range, botOwner]);

  const botDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    raw.bots.forEach(b => { counts[b.user_id] = (counts[b.user_id] || 0) + 1; });
    const buckets = { one: 0, two: 0, three: 0, four: 0 };
    Object.values(counts).forEach(c => {
      if (c === 1) buckets.one++;
      else if (c === 2) buckets.two++;
      else if (c === 3) buckets.three++;
      else buckets.four++;
    });
    return buckets;
  }, [raw.bots]);

  // ---------- Trilha do PIX ----------
  const pixTrail = useMemo(() => {
    const orders = raw.orders.filter(x => inRange(x.created_at, range));
    const paid = orders.filter(x => x.status === "paid");
    const expired = orders.filter(x => x.status === "expired");
    const refunded = orders.filter(x => x.status === "refunded");
    const pending = orders.filter(x => x.status === "pending");

    const minutes = (a: string, b: string) => (new Date(b).getTime() - new Date(a).getTime()) / 60000;
    const avg = (arr: number[]) => (arr.length ? arr.reduce((s, n) => s + n, 0) / arr.length : null);

    const timeToPay = avg(paid.filter(x => x.paid_at).map(x => minutes(x.created_at, x.paid_at)).filter(n => n >= 0));
    const timeToExpire = avg(expired.filter(x => x.expires_at).map(x => minutes(x.created_at, x.expires_at)).filter(n => n >= 0));

    // tempo médio do evento payment_started até pix_generated (por bot/dia aproximado)
    const ev = raw.events.filter(e => inRange(e.created_at, range));
    const startedByLead: Record<string, string> = {};
    const genDelays: number[] = [];
    ev.slice().sort((a, b) => a.created_at.localeCompare(b.created_at)).forEach(e => {
      const k = `${e.bot_id}:${(e as any).telegram_user_id ?? ""}`;
      if (e.event_type === "payment_started") startedByLead[k] = e.created_at;
      if (e.event_type === "pix_generated" && startedByLead[k]) {
        genDelays.push(minutes(startedByLead[k], e.created_at));
        delete startedByLead[k];
      }
    });

    // por vendedor (conta Revant)
    const bySeller: Record<string, any> = {};
    orders.forEach(x => {
      const uid = botOwner[x.bot_id];
      if (!uid) return;
      const s = (bySeller[uid] ||= { generated: 0, paid: 0, expired: 0, refunded: 0, pending: 0, gmv: 0, payTimes: [] as number[] });
      s.generated++;
      if (x.status === "paid") { s.paid++; s.gmv += Number(x.amount || 0); if (x.paid_at) s.payTimes.push(minutes(x.created_at, x.paid_at)); }
      if (x.status === "expired") s.expired++;
      if (x.status === "refunded") s.refunded++;
      if (x.status === "pending") s.pending++;
    });
    const profileById: Record<string, any> = {};
    raw.profiles.forEach(p => { profileById[p.id] = p; });
    const sellers = Object.entries(bySeller).map(([id, s]: any) => ({
      id,
      seller: profileById[id]?.full_name || profileById[id]?.email || id.slice(0, 8),
      email: profileById[id]?.email || "—",
      revant: profileById[id]?.revantpay_key_status || (profileById[id]?.has_revantpay_key ? "conectada" : "sem chave"),
      generated: s.generated, paid: s.paid, expired: s.expired, refunded: s.refunded, pending: s.pending,
      gmv: s.gmv,
      rate: s.generated ? (s.paid / s.generated) * 100 : 0,
      avgPay: s.payTimes.length ? s.payTimes.reduce((a: number, b: number) => a + b, 0) / s.payTimes.length : null,
    })).sort((a, b) => b.generated - a.generated);

    return {
      orders, paid, expired, refunded, pending, sellers,
      timeToPay, timeToExpire,
      timeToGenerate: avg(genDelays),
    };
  }, [raw, range, botOwner]);

  // ---------- Funil /start → ativação ----------
  const leadFunnel = useMemo(() => {
    const leads = raw.botUsers.filter(u => inRange(u.created_at, range));
    const clicked = leads.filter(u => u.has_clicked_button);
    const ordersInRange = raw.orders.filter(x => inRange(x.created_at, range));
    const leadKeys = new Set(leads.map(u => `${u.bot_id}:${u.telegram_user_id}`));
    const ordered = ordersInRange.filter(x => leadKeys.has(`${x.bot_id}:${x.telegram_user_id}`));
    const paidOrders = ordered.filter(x => x.status === "paid");
    const uniq = (arr: any[]) => new Set(arr.map(x => `${x.bot_id}:${x.telegram_user_id}`)).size;
    return {
      stages: [
        { label: "/start no bot (leads)", value: leads.length },
        { label: "Interagiu (clicou em botão)", value: clicked.length },
        { label: "Gerou PIX", value: uniq(ordered) },
        { label: "Pagou", value: uniq(paidOrders) },
      ],
      leads, clicked, ordered, paidOrders,
    };
  }, [raw, range]);

  // ---------- Drill-down ----------
  const nameOfUser = (id?: string) => {
    const p = raw.profiles.find(x => x.id === id);
    return p?.full_name || p?.email || (id ? id.slice(0, 8) : "—");
  };
  const nameOfBot = (id?: string) => {
    const b = raw.bots.find(x => x.id === id);
    return b?.username ? `@${b.username}` : (b?.name || (id ? id.slice(0, 8) : "—"));
  };
  const dt = (v: any) => formatBrtShort(v);

  const orderColumns = [
    { key: "id", label: "ID do pedido", mono: true, value: (r: any) => r.id },
    { key: "created_at", label: "Criado em", mono: true, value: (r: any) => dt(r.created_at) },
    { key: "paid_at", label: "Pago em", mono: true, value: (r: any) => (r.paid_at ? dt(r.paid_at) : "—") },
    { key: "status", label: "Status", value: (r: any) => r.status },
    { key: "amount", label: "Valor", align: "right" as const, mono: true, value: (r: any) => brl(Number(r.amount || 0)) },
    { key: "bot", label: "Bot", value: (r: any) => nameOfBot(r.bot_id) },
    { key: "seller", label: "Vendedor", value: (r: any) => nameOfUser(botOwner[r.bot_id]) },
    { key: "source_type", label: "Origem", value: (r: any) => r.source_type || "direto" },
  ];
  const profileColumns = [
    { key: "id", label: "ID do usuário", mono: true, value: (r: any) => r.id },
    { key: "email", label: "E-mail", value: (r: any) => r.email || "—" },
    { key: "full_name", label: "Nome", value: (r: any) => r.full_name || "—" },
    { key: "created_at", label: "Cadastro", mono: true, value: (r: any) => dt(r.created_at) },
    { key: "revant", label: "Revant Pay", value: (r: any) => (r.has_revantpay_key ? (r.revantpay_key_status || "conectada") : "sem chave") },
    { key: "checked", label: "Chave validada em", mono: true, value: (r: any) => (r.revantpay_key_checked_at ? dt(r.revantpay_key_checked_at) : "—") },
  ];
  const botColumns = [
    { key: "id", label: "ID do bot", mono: true, value: (r: any) => r.id },
    { key: "name", label: "Nome", value: (r: any) => r.name },
    { key: "username", label: "Username", value: (r: any) => (r.username ? `@${r.username}` : "—") },
    { key: "owner", label: "Dono", value: (r: any) => nameOfUser(r.user_id) },
    { key: "created_at", label: "Criado em", mono: true, value: (r: any) => dt(r.created_at) },
    { key: "health_status", label: "Saúde", value: (r: any) => r.health_status || "—" },
  ];
  const leadColumns = [
    { key: "id", label: "Lead", mono: true, value: (r: any) => String(r.telegram_user_id ?? "—") },
    { key: "bot", label: "Bot", value: (r: any) => nameOfBot(r.bot_id) },
    { key: "created_at", label: "/start em", mono: true, value: (r: any) => dt(r.created_at) },
    { key: "last_interaction_at", label: "Última interação", mono: true, value: (r: any) => dt(r.last_interaction_at) },
    { key: "clicked", label: "Clicou em botão", value: (r: any) => (r.has_clicked_button ? "sim" : "não") },
  ];
  const eventColumns = [
    { key: "event_type", label: "Evento", value: (r: any) => r.event_type },
    { key: "created_at", label: "Data e hora", mono: true, value: (r: any) => dt(r.created_at) },
    { key: "bot", label: "Bot", value: (r: any) => nameOfBot(r.bot_id) },
    { key: "seller", label: "Vendedor", value: (r: any) => nameOfUser(botOwner[r.bot_id]) },
    { key: "success", label: "Sucesso", value: (r: any) => (r.success === null || r.success === undefined ? "—" : r.success ? "sim" : "não") },
  ];
  const periodLabel = `${formatBrtShort(range.start)} → ${formatBrtShort(range.end)} (BRT)`;
  const openDrill = (title: string, columns: any[], rows: any[], subtitle?: string) =>
    setDrill({ title, subtitle: subtitle || periodLabel, columns, rows });

  const ordersInRange = raw.orders.filter(x => inRange(x.created_at, range));
  const eventsInRange = raw.events.filter(e => inRange(e.created_at, range));

  const c = metrics.cur, o = metrics.old;

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-8">
      {/* Filtros de período */}
      <div className="glass-card p-3 flex flex-wrap items-center gap-2">
        {PERIODS.map(p => (
          <button key={p.id} onClick={() => setPeriod(p.id)}
            className={`px-3 py-1.5 rounded-lg text-xs transition-all ${period === p.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary"}`}>
            {p.label}
          </button>
        ))}
        {period === "custom" && (
          <div className="flex items-center gap-2 ml-2">
            <Input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="h-8 w-[150px] text-xs" />
            <span className="text-xs text-muted-foreground">até</span>
            <Input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="h-8 w-[150px] text-xs" />
          </div>
        )}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground">{formatBrtShort(range.start)} → {formatBrtShort(range.end)} (BRT)</span>
          <Button variant="outline" size="sm" onClick={load} className="h-8 border-border">Atualizar</Button>
        </div>
      </div>

      {/* Prioridade 1 */}
      <Section title="Principais métricas" subtitle="comparado com o período anterior equivalente">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Kpi icon={UserPlus} label="Novos usuários" value={c.newUsers} current={c.newUsers} previous={o.newUsers} color="text-sky-400" hint="cadastros em profiles"
            onDrill={() => openDrill("Novos usuários", profileColumns, raw.profiles.filter(p => inRange(p.created_at, range)))} />
          <Kpi icon={Users} label="Usuários ativos" value={c.activeUsers} current={c.activeUsers} previous={o.activeUsers} color="text-cyan-400" hint="criou/editou bot ou teve atividade no bot" />
          <Kpi icon={Bot} label="Novos bots" value={c.newBots} current={c.newBots} previous={o.newBots} color="text-violet-400" hint="bots criados no período"
            onDrill={() => openDrill("Bots criados no período", botColumns, raw.bots.filter(b => inRange(b.created_at, range)))} />
          <Kpi icon={Activity} label="Bots ativos" value={c.activeBots} current={c.activeBots} previous={o.activeBots} color="text-emerald-400" hint="com pedido, lead ou evento" />
          <Kpi icon={Link2} label="Conectados à Revant" value={c.revantConnected} color="text-teal-400" hint={`${c.revantValid} validadas · ${c.revantInvalid} inválidas (snapshot atual)`}
            onDrill={() => openDrill("Usuários conectados à Revant Pay", profileColumns, raw.profiles.filter(p => p.has_revantpay_key), "snapshot atual")} />
          <Kpi icon={Zap} label="Novas conexões Revant" value={c.revantNew} current={c.revantNew} previous={o.revantNew} color="text-amber-400" hint="chaves validadas no período"
            onDrill={() => openDrill("Conexões Revant validadas no período", profileColumns, raw.profiles.filter(p => p.has_revantpay_key && inRange(p.revantpay_key_checked_at, range)))} />
          <Kpi icon={ShoppingCart} label="Pedidos gerados" value={c.orders} current={c.orders} previous={o.orders} color="text-amber-400" hint="payment_orders criados"
            onDrill={() => openDrill("Pedidos gerados", orderColumns, ordersInRange)} />
          <Kpi icon={CheckCircle2} label="Vendas aprovadas" value={c.sales} current={c.sales} previous={o.sales} color="text-emerald-400" hint="pedidos com status pago"
            onDrill={() => openDrill("Vendas aprovadas", orderColumns, ordersInRange.filter(x => x.status === "paid"))} />
          <Kpi icon={DollarSign} label="GMV aprovado" value={brl(c.gmvPaid)} current={c.gmvPaid} previous={o.gmvPaid} color="text-emerald-400" hint={`total gerado ${brl(c.gmvTotal)}`}
            onDrill={() => openDrill("Pedidos que compõem o GMV aprovado", orderColumns, ordersInRange.filter(x => x.status === "paid"))} />
          <Kpi icon={Percent} label="Conversão de pagamento" value={pct(c.conversion)} current={c.conversion} previous={o.conversion} color="text-sky-400" hint="pagos ÷ pedidos" />
          <Kpi icon={Trophy} label="Vendedores ativos" value={c.activeSellers} current={c.activeSellers} previous={o.activeSellers} color="text-yellow-400" hint={`${c.sellingSellers} com venda aprovada`} />
          <Kpi icon={Repeat} label="Vendedores recorrentes" value={c.recurringSellers} current={c.recurringSellers} previous={o.recurringSellers} color="text-fuchsia-400" hint="venderam antes e voltaram a vender" />
        </div>
      </Section>

      {/* GMV detalhado */}
      <Section title="GMV por status" subtitle="valores dos pedidos criados no período">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <Kpi icon={DollarSign} label="GMV total" value={brl(c.gmvTotal)} color="text-sky-400"
            onDrill={() => openDrill("Todos os pedidos do período", orderColumns, ordersInRange)} />
          <Kpi icon={CheckCircle2} label="GMV aprovado" value={brl(c.gmvPaid)} color="text-emerald-400"
            onDrill={() => openDrill("Pedidos pagos", orderColumns, ordersInRange.filter(x => x.status === "paid"))} />
          <Kpi icon={Loader2} label="GMV pendente" value={brl(c.gmvPending)} color="text-amber-400"
            onDrill={() => openDrill("Pedidos pendentes", orderColumns, ordersInRange.filter(x => x.status === "pending"))} />
          <Kpi icon={AlertTriangle} label="GMV expirado" value={brl(c.gmvExpired)} color="text-rose-400"
            onDrill={() => openDrill("Pedidos expirados", orderColumns, ordersInRange.filter(x => x.status === "expired"))} />
          <Kpi icon={Repeat} label="GMV reembolsado" value={raw.orders.some(x => x.status === "refunded") ? brl(c.gmvRefunded) : "N/D"} color="text-muted-foreground" hint={raw.orders.some(x => x.status === "refunded") ? undefined : "sem reembolsos registrados"}
            onDrill={() => openDrill("Pedidos reembolsados", orderColumns, ordersInRange.filter(x => x.status === "refunded"))} />
        </div>
      </Section>

      {/* Gráfico de crescimento */}
      <Section title="Crescimento diário" subtitle="selecione as métricas do gráfico">
        <Card className="glass-card border-border/50">
          <CardContent className="p-5">
            <div className="flex flex-wrap gap-2 mb-4">
              {CHART_METRICS.map(m => {
                const on = chartMetrics.includes(m.id);
                return (
                  <button key={m.id}
                    onClick={() => setChartMetrics(prevSel => on ? prevSel.filter(x => x !== m.id) : [...prevSel, m.id])}
                    className={`px-3 py-1 rounded-lg text-[11px] border transition-all ${on ? "border-primary/50 bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:text-foreground"}`}>
                    <span className="inline-block w-2 h-2 rounded-full mr-2" style={{ background: m.color }} />
                    {m.label}
                  </button>
                );
              })}
            </div>
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    {CHART_METRICS.map(m => (
                      <linearGradient key={m.id} id={`g-${m.id}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={m.color} stopOpacity={0.35} />
                        <stop offset="95%" stopColor={m.color} stopOpacity={0} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={10} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {CHART_METRICS.filter(m => chartMetrics.includes(m.id)).map(m => (
                    <Area key={m.id} type="monotone" dataKey={m.id} name={m.label} stroke={m.color} fill={`url(#g-${m.id})`} strokeWidth={2} />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </Section>

      {/* Funil de ativação */}
      <Section title="Funil de ativação da plataforma" subtitle="base total de usuários (lifetime)">
        <Card className="glass-card border-border/50">
          <CardContent className="p-5 space-y-3">
            {funnel.stages.map((s, i) => {
              const first = funnel.stages[0].value || 1;
              const prevStage = i > 0 ? funnel.stages[i - 1].value : null;
              const stepConv = prevStage ? (prevStage ? (s.value / prevStage) * 100 : 0) : 100;
              return (
                <div key={s.label}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-muted-foreground">{s.label}</span>
                    <span className="font-mono">
                      {s.value}
                      {prevStage !== null && <span className={`ml-2 ${stepConv >= 50 ? "text-emerald-400" : "text-amber-400"}`}>{pct(stepConv)}</span>}
                      <span className="ml-2 text-muted-foreground">{pct((s.value / first) * 100)} do total</span>
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-secondary overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-primary to-teal-400" style={{ width: `${Math.min(100, (s.value / first) * 100)}%` }} />
                  </div>
                  {prevStage !== null && prevStage > s.value && (
                    <p className="text-[10px] text-rose-400 mt-1">Abandono nesta etapa: {prevStage - s.value} usuários ({pct(100 - stepConv)})</p>
                  )}
                </div>
              );
            })}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-border/50">
              <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Activation rate</p><p className="font-mono text-lg">{pct(funnel.activation)}</p><p className="text-[10px] text-muted-foreground">criou ao menos 1 bot</p></div>
              <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Tempo até 1º bot</p><p className="font-mono text-lg">{funnel.timings.bot !== null ? `${funnel.timings.bot.toFixed(1)}d` : "N/D"}</p></div>
              <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Tempo até 1º pedido</p><p className="font-mono text-lg">{funnel.timings.order !== null ? `${funnel.timings.order.toFixed(1)}d` : "N/D"}</p></div>
              <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Tempo até 1ª venda</p><p className="font-mono text-lg">{funnel.timings.sale !== null ? `${funnel.timings.sale.toFixed(1)}d` : "N/D"}</p></div>
            </div>
          </CardContent>
        </Card>
      </Section>

      {/* Funil /start → ativação */}
      <Section title="Funil do lead: /start até o pagamento" subtitle="leads que deram /start dentro do período">
        <Card className="glass-card border-border/50">
          <CardContent className="p-5 space-y-3">
            {leadFunnel.stages.map((s, i) => {
              const first = leadFunnel.stages[0].value || 1;
              const prevStage = i > 0 ? leadFunnel.stages[i - 1].value : null;
              const stepConv = prevStage ? (s.value / prevStage) * 100 : 100;
              const rows = i === 0 ? leadFunnel.leads : i === 1 ? leadFunnel.clicked : i === 2 ? leadFunnel.ordered : leadFunnel.paidOrders;
              const cols = i <= 1 ? leadColumns : orderColumns;
              return (
                <button key={s.label} className="w-full text-left" onClick={() => openDrill(s.label, cols, rows)}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-muted-foreground">{s.label}</span>
                    <span className="font-mono">
                      {s.value.toLocaleString("pt-BR")}
                      {prevStage !== null && <span className={`ml-2 ${stepConv >= 30 ? "text-emerald-400" : "text-amber-400"}`}>{pct(stepConv)}</span>}
                      <span className="ml-2 text-muted-foreground">{pct((s.value / first) * 100)} dos /start</span>
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-secondary overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-sky-400 to-emerald-400" style={{ width: `${Math.min(100, (s.value / first) * 100)}%` }} />
                  </div>
                </button>
              );
            })}
            <p className="text-[10px] text-muted-foreground pt-2 border-t border-border/50">Clique em qualquer etapa para ver a lista detalhada com IDs, datas e horários.</p>
          </CardContent>
        </Card>
      </Section>

      {/* Trilha do PIX */}
      <Section title="Trilha do PIX" subtitle="ciclo de vida das cobranças criadas no período">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <Kpi icon={Zap} label="PIX gerados" value={pixTrail.orders.length} color="text-sky-400" hint={pixTrail.timeToGenerate !== null ? `${pixTrail.timeToGenerate.toFixed(1)} min do clique à geração` : "tempo de geração N/D"}
            onDrill={() => openDrill("PIX gerados", orderColumns, pixTrail.orders)} />
          <Kpi icon={CheckCircle2} label="PIX pagos" value={pixTrail.paid.length} color="text-emerald-400" hint={pixTrail.timeToPay !== null ? `${pixTrail.timeToPay.toFixed(1)} min médios até o pagamento` : "tempo médio N/D"}
            onDrill={() => openDrill("PIX pagos", orderColumns, pixTrail.paid)} />
          <Kpi icon={Loader2} label="PIX aguardando" value={pixTrail.pending.length} color="text-amber-400"
            onDrill={() => openDrill("PIX aguardando pagamento", orderColumns, pixTrail.pending)} />
          <Kpi icon={AlertTriangle} label="PIX expirados" value={pixTrail.expired.length} color="text-rose-400" hint={pixTrail.timeToExpire !== null ? `janela média de ${(pixTrail.timeToExpire).toFixed(0)} min` : undefined}
            onDrill={() => openDrill("PIX expirados", orderColumns, pixTrail.expired)} />
          <Kpi icon={Repeat} label="PIX reembolsados" value={pixTrail.refunded.length} color="text-fuchsia-400"
            onDrill={() => openDrill("PIX reembolsados", orderColumns, pixTrail.refunded)} />
        </div>
        <Card className="glass-card border-border/50">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/60 text-muted-foreground">
                    <th className="text-left py-2 px-3 font-medium">Vendedor (conta Revant)</th>
                    <th className="text-left py-2 px-3 font-medium">Chave</th>
                    <th className="text-right py-2 px-3 font-medium">Gerados</th>
                    <th className="text-right py-2 px-3 font-medium">Pagos</th>
                    <th className="text-right py-2 px-3 font-medium">Expirados</th>
                    <th className="text-right py-2 px-3 font-medium">Reemb.</th>
                    <th className="text-right py-2 px-3 font-medium">Conversão</th>
                    <th className="text-right py-2 px-3 font-medium">Tempo médio</th>
                    <th className="text-right py-2 px-3 font-medium">GMV</th>
                  </tr>
                </thead>
                <tbody>
                  {pixTrail.sellers.length === 0 && <tr><td colSpan={9} className="p-5 text-muted-foreground">Sem cobranças no período.</td></tr>}
                  {pixTrail.sellers.slice(0, 25).map(s => (
                    <tr key={s.id} className="border-b border-border/30 hover:bg-secondary/30 cursor-pointer"
                      onClick={() => openDrill(`PIX de ${s.seller}`, orderColumns, pixTrail.orders.filter(x => botOwner[x.bot_id] === s.id))}>
                      <td className="py-2 px-3"><span className="block truncate max-w-[220px]">{s.seller}</span><span className="text-[10px] text-muted-foreground">{s.email}</span></td>
                      <td className="py-2 px-3">{s.revant}</td>
                      <td className="py-2 px-3 text-right font-mono">{s.generated}</td>
                      <td className="py-2 px-3 text-right font-mono text-emerald-400">{s.paid}</td>
                      <td className="py-2 px-3 text-right font-mono text-rose-400">{s.expired}</td>
                      <td className="py-2 px-3 text-right font-mono">{s.refunded}</td>
                      <td className="py-2 px-3 text-right font-mono">{pct(s.rate)}</td>
                      <td className="py-2 px-3 text-right font-mono">{s.avgPay !== null ? `${s.avgPay.toFixed(1)} min` : "N/D"}</td>
                      <td className="py-2 px-3 text-right font-mono text-emerald-400">{brl(s.gmv)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </Section>

      {/* PIX */}
      <Section title="Funil do PIX" subtitle="eventos auditados em telegram_payment_events">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Kpi icon={Zap} label="PIX solicitados" value={c.pixRequested} current={c.pixRequested} previous={o.pixRequested} color="text-sky-400"
            onDrill={() => openDrill("Eventos: PIX solicitados", eventColumns, eventsInRange.filter(e => e.event_type === "payment_started"))} />
          <Kpi icon={CheckCircle2} label="PIX gerados" value={c.pixGenerated} current={c.pixGenerated} previous={o.pixGenerated} color="text-emerald-400"
            onDrill={() => openDrill("Eventos: PIX gerados", eventColumns, eventsInRange.filter(e => e.event_type === "pix_generated"))} />
          <Kpi icon={AlertTriangle} label="Falhas na geração" value={c.pixFailed} current={c.pixFailed} previous={o.pixFailed} color="text-rose-400"
            onDrill={() => openDrill("Eventos: falhas na geração de PIX", [...eventColumns, { key: "error_message", label: "Erro", value: (r: any) => r.error_message || "—" }], eventsInRange.filter(e => e.event_type === "revantpay_failed" || e.event_type === "minimum_amount_failed"))} />
          <Kpi icon={Percent} label="Taxa de sucesso" value={c.pixRequested ? pct(c.pixSuccess) : "N/D"} color="text-teal-400" hint="gerados ÷ solicitados" />
          <Kpi icon={ShoppingCart} label="QR Codes entregues" value={c.pixQrSent} color="text-violet-400" hint={`${c.pixTextSent} códigos copia e cola`}
            onDrill={() => openDrill("Eventos: QR Codes entregues", eventColumns, eventsInRange.filter(e => e.event_type === "pix_qr_sent"))} />
          <Kpi icon={DollarSign} label="PIX pagos" value={c.pixPaid} current={c.pixPaid} previous={o.pixPaid} color="text-emerald-400" hint="confirmados por webhook ou reconciliação"
            onDrill={() => openDrill("Eventos: pagamentos confirmados", eventColumns, eventsInRange.filter(e => e.event_type === "payment_confirmed" || e.event_type === "reconciled_paid"))} />
          <Kpi icon={Percent} label="PIX gerado → pago" value={c.pixGenerated ? pct(c.pixConversion) : "N/D"} color="text-sky-400" />
          <Kpi icon={DollarSign} label="Ticket médio" value={c.sales ? brl(c.avgTicket) : "N/D"} color="text-amber-400" />
        </div>
      </Section>

      {/* Bots */}
      <Section title="Bots" subtitle="snapshot atual da plataforma">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Kpi icon={Bot} label="Total de bots" value={raw.bots.length} color="text-violet-400" />
          <Kpi icon={Activity} label="Saudáveis" value={raw.bots.filter(b => b.health_status === "active").length} color="text-emerald-400" />
          <Kpi icon={AlertTriangle} label="Banidos / com erro" value={raw.bots.filter(b => b.health_status && b.health_status !== "active").length} color="text-rose-400" />
          <Kpi icon={Users} label="Média por vendedor" value={(raw.bots.length / Math.max(1, new Set(raw.bots.map(b => b.user_id)).size)).toFixed(1)} color="text-sky-400" />
        </div>
        <Card className="glass-card border-border/50">
          <CardContent className="p-5 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">1 bot</p><p className="font-mono text-lg">{botDistribution.one}</p></div>
            <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">2 bots</p><p className="font-mono text-lg">{botDistribution.two}</p></div>
            <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">3 bots</p><p className="font-mono text-lg">{botDistribution.three}</p></div>
            <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">4+ bots</p><p className="font-mono text-lg">{botDistribution.four}</p></div>
          </CardContent>
        </Card>
      </Section>

      {/* Rankings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Section title="Top vendedores do período" subtitle="ordenado por GMV aprovado">
          <Card className="glass-card border-border/50">
            <CardContent className="p-0 divide-y divide-border/50">
              {rankings.sellers.length === 0 && <p className="p-5 text-xs text-muted-foreground">Sem pedidos no período.</p>}
              {rankings.sellers.map((s, i) => (
                <div key={s.id} className="p-4 flex items-center gap-3">
                  <span className="w-6 text-xs font-mono text-muted-foreground">#{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm truncate">{s.name}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{s.bots} bots · {s.orders} pedidos · conv. {pct(s.conversion)}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-sm text-emerald-400">{brl(s.gmv)}</p>
                    <p className="text-[10px] text-muted-foreground">{s.sales} vendas · tkt {brl(s.ticket)}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </Section>

        <Section title="Top bots do período" subtitle="ordenado por GMV aprovado">
          <Card className="glass-card border-border/50">
            <CardContent className="p-0 divide-y divide-border/50">
              {rankings.bots.length === 0 && <p className="p-5 text-xs text-muted-foreground">Sem pedidos no período.</p>}
              {rankings.bots.map((b, i) => (
                <div key={b.id} className="p-4 flex items-center gap-3">
                  <span className="w-6 text-xs font-mono text-muted-foreground">#{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm truncate">{b.name}</p>
                    <p className="text-[10px] text-muted-foreground">{b.orders} pedidos · conv. {pct(b.conversion)} · {b.health || "—"}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-sm text-emerald-400">{brl(b.gmv)}</p>
                    <p className="text-[10px] text-muted-foreground">{b.sales} vendas</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </Section>
      </div>

      {/* Resumo executivo */}
      <Section title="Resumo executivo" subtitle="leitura rápida do período selecionado">
        <Card className="glass-card border-border/50">
          <CardContent className="p-5 grid grid-cols-1 md:grid-cols-4 gap-6 text-xs">
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-wider text-primary mb-2">Crescimento</p>
              <p>Usuários: <span className="font-mono">{c.newUsers}</span></p>
              <p>Bots: <span className="font-mono">{c.newBots}</span></p>
              <p>Vendedores ativos: <span className="font-mono">{c.activeSellers}</span></p>
              <p>Recorrentes: <span className="font-mono">{c.recurringSellers}</span></p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-wider text-primary mb-2">Operação</p>
              <p>Pedidos: <span className="font-mono">{c.orders}</span></p>
              <p>Vendas: <span className="font-mono">{c.sales}</span></p>
              <p>Conversão: <span className="font-mono">{pct(c.conversion)}</span></p>
              <p>GMV: <span className="font-mono">{brl(c.gmvPaid)}</span></p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-wider text-primary mb-2">Revant</p>
              <p>Conexões: <span className="font-mono">{c.revantConnected}</span></p>
              <p>PIX gerados: <span className="font-mono">{c.pixGenerated}</span></p>
              <p>PIX pagos: <span className="font-mono">{c.pixPaid}</span></p>
              <p>Sucesso: <span className="font-mono">{c.pixRequested ? pct(c.pixSuccess) : "N/D"}</span></p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-wider text-primary mb-2">Saúde</p>
              <p>Bots ativos: <span className={raw.bots.filter(b => b.health_status === "active").length ? "text-emerald-400" : "text-rose-400"}>{raw.bots.filter(b => b.health_status === "active").length}/{raw.bots.length}</span></p>
              <p>Chaves inválidas: <span className={c.revantInvalid ? "text-amber-400" : "text-emerald-400"}>{c.revantInvalid}</span></p>
              <p>Falhas PIX: <span className={c.pixFailed ? "text-rose-400" : "text-emerald-400"}>{c.pixFailed}</span></p>
              <p>Pedidos pendentes: <span className="font-mono">{raw.orders.filter(x => x.status === "pending").length}</span></p>
            </div>
          </CardContent>
        </Card>
      </Section>

      <DrillDownDialog payload={drill} onClose={() => setDrill(null)} />

      <p className="text-[10px] text-muted-foreground flex items-start gap-2">
        <Info className="w-3 h-3 mt-0.5 shrink-0" />
        Todas as métricas usam o fuso de Brasília e dados reais das tabelas da plataforma (profiles, bots, payment_orders, bot_users, telegram_payment_events). Métricas sem dados suficientes aparecem como “N/D” — nada é estimado.
      </p>
    </div>
  );
}
