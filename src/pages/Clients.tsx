import { useCallback, useEffect, useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { supabase } from "@/integrations/supabase/client";
import { useBots } from "@/contexts/BotContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { brtStartOfDay } from "@/lib/brtDate";
import {
  Users, Search, Crown, Ban, Loader2, RefreshCw, Settings2, CheckCircle2, Clock,
  MessageSquare, CreditCard, Calendar, Hash,
} from "lucide-react";

type Segment = "all" | "vip" | "active" | "blocked";
type Range = "today" | "7d" | "30d" | "all";

interface Lead {
  id: string;
  bot_id: string;
  telegram_user_id: number;
  name: string;
  username: string | null;
  created_at: string;
  last_interaction_at: string;
  has_clicked_button: boolean;
}

interface OrderRow {
  id: string;
  bot_id: string;
  telegram_user_id: number;
  amount: number;
  status: string;
  created_at: string;
  paid_at: string | null;
  source_type: string | null;
}

interface VipRow {
  bot_id: string;
  telegram_user_id: number;
  expires_at: string;
  is_active: boolean | null;
}

const brl = (v: number) =>
  `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtDate = (s: string) =>
  new Date(s).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });

function rangeStart(r: Range): Date | null {
  if (r === "today") return brtStartOfDay();
  if (r === "7d") return brtStartOfDay(-7);
  if (r === "30d") return brtStartOfDay(-30);
  return null;
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-3.5 py-1.5 rounded-full text-xs font-medium border transition-colors whitespace-nowrap",
        active
          ? "border-primary/40 bg-primary/10 text-primary"
          : "border-border bg-secondary/40 text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

export default function Clients() {
  const { bots, selectedBot, loading: botsLoading } = useBots();
  const [tab, setTab] = useState<"leads" | "subscription">("leads");
  const [segment, setSegment] = useState<Segment>("all");
  const [range, setRange] = useState<Range>("all");
  const [botFilter, setBotFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [vips, setVips] = useState<VipRow[]>([]);
  const [blocked, setBlocked] = useState<Set<string>>(new Set());
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const botIds = useMemo(() => bots.map((b) => b.id), [bots]);
  const botNames = useMemo(
    () => Object.fromEntries(bots.map((b) => [b.id, b.username])) as Record<string, string>,
    [bots],
  );

  useEffect(() => {
    if (selectedBot && botFilter === "all" && bots.length > 1) return;
  }, [selectedBot, botFilter, bots.length]);

  const fetchData = useCallback(async () => {
    const ids = botFilter === "all" ? botIds : [botFilter];
    if (ids.length === 0) { setLeads([]); setOrders([]); setVips([]); setLoading(false); return; }
    setLoading(true);
    try {
      const start = rangeStart(range);
      let leadQuery = supabase
        .from("bot_users")
        .select("id, bot_id, telegram_user_id, telegram_first_name, telegram_username, created_at, last_interaction_at, has_clicked_button")
        .in("bot_id", ids)
        .order("last_interaction_at", { ascending: false })
        .limit(500);
      if (start) leadQuery = leadQuery.gte("created_at", start.toISOString());

      const [{ data: users }, { data: ordersData }, { data: vipData }, { data: blockedData }] = await Promise.all([
        leadQuery,
        supabase
          .from("payment_orders")
          .select("id, bot_id, telegram_user_id, amount, status, created_at, paid_at, source_type")
          .in("bot_id", ids)
          .order("created_at", { ascending: false })
          .limit(1000),
        supabase.from("vip_members").select("bot_id, telegram_user_id, expires_at, is_active").in("bot_id", ids).limit(1000),
        supabase.from("blacklisted_users").select("bot_id, telegram_user_id").in("bot_id", ids).limit(1000),
      ]);

      setLeads(
        (users ?? []).map((u: any) => ({
          id: u.id,
          bot_id: u.bot_id,
          telegram_user_id: u.telegram_user_id,
          name: u.telegram_first_name || u.telegram_username || "Lead",
          username: u.telegram_username,
          created_at: u.created_at,
          last_interaction_at: u.last_interaction_at,
          has_clicked_button: u.has_clicked_button,
        })),
      );
      setOrders((ordersData as OrderRow[]) ?? []);
      setVips((vipData as VipRow[]) ?? []);
      setBlocked(new Set((blockedData ?? []).map((b: any) => `${b.bot_id}:${b.telegram_user_id}`)));
    } catch (err) {
      console.error("Error loading clients:", err);
    } finally {
      setLoading(false);
    }
  }, [botIds, botFilter, range]);

  useEffect(() => {
    if (!botsLoading) void fetchData();
  }, [botsLoading, fetchData]);

  const vipMap = useMemo(() => {
    const m = new Map<string, VipRow>();
    vips.forEach((v) => m.set(`${v.bot_id}:${v.telegram_user_id}`, v));
    return m;
  }, [vips]);

  const ordersMap = useMemo(() => {
    const m = new Map<string, OrderRow[]>();
    orders.forEach((o) => {
      const k = `${o.bot_id}:${o.telegram_user_id}`;
      const arr = m.get(k) ?? [];
      arr.push(o);
      m.set(k, arr);
    });
    return m;
  }, [orders]);

  const enriched = useMemo(() => {
    return leads.map((l) => {
      const key = `${l.bot_id}:${l.telegram_user_id}`;
      const vip = vipMap.get(key);
      const userOrders = ordersMap.get(key) ?? [];
      const paid = userOrders.filter((o) => o.status === "paid");
      return {
        ...l,
        key,
        vip,
        isVip: !!vip,
        isActiveVip: !!vip && vip.is_active !== false && new Date(vip.expires_at) > new Date(),
        isBlocked: blocked.has(key),
        orders: userOrders,
        paidCount: paid.length,
        spent: paid.reduce((s, o) => s + Number(o.amount), 0),
      };
    });
  }, [leads, vipMap, ordersMap, blocked]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return enriched.filter((c) => {
      if (tab === "subscription" && !c.isVip) return false;
      if (segment === "vip" && !c.isVip) return false;
      if (segment === "active" && !c.isActiveVip) return false;
      if (segment === "blocked" && !c.isBlocked) return false;
      if (!term) return true;
      return (
        c.name.toLowerCase().includes(term) ||
        (c.username ?? "").toLowerCase().includes(term) ||
        String(c.telegram_user_id).includes(term)
      );
    });
  }, [enriched, segment, search, tab]);

  const selected = filtered.find((c) => c.key === selectedKey) ?? null;

  return (
    <MainLayout>
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
        <div>
          <h1 className="text-3xl font-bold leading-tight">Clientes</h1>
          <p className="text-sm text-muted-foreground">
            {filtered.length} {tab === "subscription" ? "assinantes" : "leads"} · selecione um pra ver detalhes
          </p>
        </div>
        <div className="flex items-center gap-1 p-1 rounded-xl border border-border bg-secondary/40">
          <button
            onClick={() => setTab("leads")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
              tab === "leads" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Users className="w-4 h-4" /> Leads
          </button>
          <button
            onClick={() => setTab("subscription")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
              tab === "subscription" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Settings2 className="w-4 h-4" /> Assinatura
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, username, telegram id..."
            className="pl-9 bg-secondary/40 border-border"
          />
        </div>
        <Button variant="outline" size="sm" onClick={() => fetchData()} disabled={loading} className="h-10">
          {loading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1" />}
          Atualizar
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <Chip active={segment === "all"} onClick={() => setSegment("all")}>Todos</Chip>
        <Chip active={segment === "vip"} onClick={() => setSegment("vip")}>VIP</Chip>
        <Chip active={segment === "active"} onClick={() => setSegment("active")}>Ativos</Chip>
        <Chip active={segment === "blocked"} onClick={() => setSegment("blocked")}>Bloqueados</Chip>
        <span className="w-px h-5 bg-border mx-1" />
        <select
          value={botFilter}
          onChange={(e) => setBotFilter(e.target.value)}
          className="input-dark text-xs py-1.5 rounded-full"
        >
          <option value="all">Todos os bots</option>
          {bots.map((b) => (
            <option key={b.id} value={b.id}>@{b.username}</option>
          ))}
        </select>
        <span className="w-px h-5 bg-border mx-1" />
        <Chip active={range === "today"} onClick={() => setRange("today")}>Hoje</Chip>
        <Chip active={range === "7d"} onClick={() => setRange("7d")}>7 dias</Chip>
        <Chip active={range === "30d"} onClick={() => setRange("30d")}>30 dias</Chip>
        <Chip active={range === "all"} onClick={() => setRange("all")}>Tudo</Chip>
      </div>

      {/* Split view */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] gap-5">
        {/* List */}
        <div className="glass-card overflow-hidden min-h-[520px] flex flex-col">
          {loading && leads.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
              <div className="w-14 h-14 rounded-2xl bg-secondary/60 flex items-center justify-center mb-4">
                <Users className="w-6 h-6 text-muted-foreground" />
              </div>
              <h3 className="font-semibold mb-1">Nenhum cliente encontrado</h3>
              <p className="text-sm text-muted-foreground max-w-xs">
                Ajuste os filtros ou aguarde novos leads chegarem nos seus bots.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/40 overflow-y-auto max-h-[620px]">
              {filtered.map((c) => (
                <button
                  key={c.key}
                  onClick={() => setSelectedKey(c.key)}
                  className={cn(
                    "w-full text-left flex items-center gap-3 px-4 py-3 transition-colors",
                    selectedKey === c.key ? "bg-primary/10" : "hover:bg-secondary/40",
                  )}
                >
                  <div className="w-9 h-9 rounded-full bg-secondary/70 border border-border/50 flex items-center justify-center text-sm font-semibold shrink-0">
                    {c.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{c.name}</p>
                    <p className="text-xs text-muted-foreground font-mono truncate">
                      {c.username ? `@${c.username}` : c.telegram_user_id}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {c.isBlocked && <Ban className="w-3.5 h-3.5 text-destructive" />}
                    {c.isActiveVip && <Crown className="w-3.5 h-3.5 text-primary" />}
                    {c.spent > 0 && (
                      <span className="font-mono text-xs text-primary">{brl(c.spent)}</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Detail */}
        <div className="glass-card min-h-[520px] flex flex-col">
          {!selected ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
              <div className="w-16 h-16 rounded-2xl bg-secondary/60 flex items-center justify-center mb-4">
                <Users className="w-7 h-7 text-muted-foreground" />
              </div>
              <h3 className="font-semibold mb-1">Selecione um cliente</h3>
              <p className="text-sm text-muted-foreground max-w-xs">
                Clique num lead da lista pra ver detalhes completos, histórico e tracking.
              </p>
            </div>
          ) : (
            <div className="p-6 overflow-y-auto max-h-[620px]">
              <div className="flex items-center gap-4 pb-5 border-b border-border/50">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/25 to-teal-500/20 flex items-center justify-center text-xl font-bold">
                  {selected.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h2 className="text-xl font-bold truncate">{selected.name}</h2>
                  <p className="text-sm text-muted-foreground font-mono truncate">
                    {selected.username ? `@${selected.username}` : `ID ${selected.telegram_user_id}`}
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    {selected.isActiveVip && (
                      <span className="px-2 py-0.5 rounded-full text-[11px] border border-primary/30 bg-primary/10 text-primary">VIP ativo</span>
                    )}
                    {selected.isVip && !selected.isActiveVip && (
                      <span className="px-2 py-0.5 rounded-full text-[11px] border border-border bg-secondary text-muted-foreground">VIP expirado</span>
                    )}
                    {selected.isBlocked && (
                      <span className="px-2 py-0.5 rounded-full text-[11px] border border-destructive/30 bg-destructive/10 text-destructive">Bloqueado</span>
                    )}
                    <span className="px-2 py-0.5 rounded-full text-[11px] border border-border bg-secondary text-muted-foreground">
                      @{botNames[selected.bot_id] ?? "bot"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-5">
                <div className="rounded-xl border border-border/50 bg-secondary/30 p-3">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Gasto</p>
                  <p className="font-mono text-lg font-bold text-primary">{brl(selected.spent)}</p>
                </div>
                <div className="rounded-xl border border-border/50 bg-secondary/30 p-3">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Compras</p>
                  <p className="font-mono text-lg font-bold">{selected.paidCount}</p>
                </div>
                <div className="rounded-xl border border-border/50 bg-secondary/30 p-3">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">PIX gerados</p>
                  <p className="font-mono text-lg font-bold">{selected.orders.length}</p>
                </div>
                <div className="rounded-xl border border-border/50 bg-secondary/30 p-3">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Clicou botão</p>
                  <p className="font-mono text-lg font-bold">{selected.has_clicked_button ? "Sim" : "Não"}</p>
                </div>
              </div>

              <div className="space-y-2 pb-5 border-b border-border/50 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-2"><MessageSquare className="w-4 h-4" /> Primeiro contato</span>
                  <span className="font-mono">{fmtDate(selected.created_at)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-2"><Clock className="w-4 h-4" /> Última interação</span>
                  <span className="font-mono">{fmtDate(selected.last_interaction_at)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-2"><Hash className="w-4 h-4" /> Telegram ID</span>
                  <span className="font-mono">{selected.telegram_user_id}</span>
                </div>
                {selected.vip && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-2"><Calendar className="w-4 h-4" /> VIP expira em</span>
                    <span className="font-mono">{fmtDate(selected.vip.expires_at)}</span>
                  </div>
                )}
              </div>

              <div className="pt-5">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-primary" /> Histórico de transações
                </h3>
                {selected.orders.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma transação registrada.</p>
                ) : (
                  <div className="space-y-2">
                    {selected.orders.map((o) => (
                      <div key={o.id} className="flex items-center gap-3 rounded-xl border border-border/50 bg-secondary/30 px-3 py-2.5">
                        {o.status === "paid" ? (
                          <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                        ) : (
                          <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-mono">{brl(Number(o.amount))}</p>
                          <p className="text-xs text-muted-foreground">
                            {fmtDate(o.paid_at || o.created_at)} · {o.source_type ?? "direto"}
                          </p>
                        </div>
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded-full text-[11px] border",
                            o.status === "paid"
                              ? "border-primary/30 bg-primary/10 text-primary"
                              : "border-border bg-secondary text-muted-foreground",
                          )}
                        >
                          {o.status === "paid" ? "Pago" : o.status === "pending" ? "Pendente" : o.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}