import { useEffect, useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { supabase } from "@/integrations/supabase/client";
import { useBots } from "@/contexts/BotContext";
import { brtStartOfDay, brtStartOfMonth } from "@/lib/brtDate";
import {
  CreditCard, CheckCircle2, Clock, Target, Receipt, Wallet, TrendingUp, Loader2, RefreshCw,
  ChevronLeft, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Period = "today" | "yesterday" | "week" | "month" | "all";

const PERIODS: { key: Period; label: string }[] = [
  { key: "today", label: "Hoje" },
  { key: "yesterday", label: "Ontem" },
  { key: "week", label: "Semana" },
  { key: "month", label: "Mês" },
  { key: "all", label: "Todo Período" },
];

interface OrderRow {
  id: string;
  amount: number;
  status: string;
  created_at: string;
  paid_at: string | null;
  telegram_user_id: number;
  telegram_username: string | null;
  telegram_first_name: string | null;
  source_type: string | null;
  is_downsell: boolean;
  bot_id: string;
}

const FLOW_LABELS: Record<string, string> = {
  direct: "Direto",
  downsell: "Downsell",
  upsell: "Upsell",
  order_bump: "Order Bump",
  mailing: "Mailing",
  cross_bot: "Cross-Bot",
  renewal: "Renovação",
};

const STATUS_META: Record<string, { label: string; cls: string }> = {
  paid: { label: "Pago", cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" },
  pending: { label: "Pendente", cls: "bg-amber-500/10 text-amber-400 border-amber-500/30" },
  expired: { label: "Expirado", cls: "bg-muted text-muted-foreground border-border" },
  refunded: { label: "Reembolsado", cls: "bg-destructive/10 text-destructive border-destructive/30" },
  cancelled: { label: "Cancelado", cls: "bg-destructive/10 text-destructive border-destructive/30" },
};

const brl = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function rangeStart(period: Period): Date | null {
  switch (period) {
    case "today": return brtStartOfDay();
    case "yesterday": return brtStartOfDay(-1);
    case "week": return brtStartOfDay(-7);
    case "month": return brtStartOfMonth();
    default: return null;
  }
}

function MetricCard({
  icon: Icon, label, value, sub, accent,
}: { icon: any; label: string; value: string; sub?: string; accent: string }) {
  return (
    <div className="glass-card p-5">
      <div className="flex items-start gap-3">
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", accent)}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1">{label}</p>
          <p className="font-mono text-2xl font-bold leading-none">{value}</p>
          {sub && <p className="text-xs text-muted-foreground mt-1.5">{sub}</p>}
        </div>
      </div>
    </div>
  );
}

export default function Financial() {
  const { bots, selectedBot, loading: botsLoading } = useBots();
  const [period, setPeriod] = useState<Period>("today");
  const [botFilter, setBotFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);

  const botIds = useMemo(() => bots.map((b) => b.id), [bots]);
  const botNames = useMemo(
    () => Object.fromEntries(bots.map((b) => [b.id, b.username])) as Record<string, string>,
    [bots],
  );

  const fetchOrders = async () => {
    if (botIds.length === 0) { setOrders([]); setLoading(false); return; }
    setLoading(true);
    try {
      let q = supabase
        .from("payment_orders")
        .select("id, amount, status, created_at, paid_at, telegram_user_id, telegram_username, telegram_first_name, source_type, is_downsell, bot_id")
        .in("bot_id", botFilter === "all" ? botIds : [botFilter])
        .order("created_at", { ascending: false })
        .limit(500);

      const start = rangeStart(period);
      if (start) q = q.gte("created_at", start.toISOString());
      if (period === "yesterday") q = q.lt("created_at", brtStartOfDay().toISOString());

      const { data } = await q;
      setOrders((data as OrderRow[]) ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!botsLoading) fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [botsLoading, period, botFilter, botIds.join(",")]);

  const stats = useMemo(() => {
    const paid = orders.filter((o) => o.status === "paid");
    const pending = orders.filter((o) => o.status === "pending");
    const expired = orders.filter((o) => o.status === "expired");
    const refunded = orders.filter((o) => o.status === "refunded");
    const sum = (rows: OrderRow[]) => rows.reduce((s, o) => s + Number(o.amount), 0);
    const paidAmount = sum(paid);
    return {
      generated: orders.length,
      generatedAmount: sum(orders),
      paid: paid.length,
      paidAmount,
      pending: pending.length,
      pendingAmount: sum(pending),
      expired: expired.length,
      refunded: refunded.length,
      conversion: orders.length ? (paid.length / orders.length) * 100 : 0,
      avgTicket: paid.length ? paidAmount / paid.length : 0,
      uniqueLeads: new Set(orders.map((o) => o.telegram_user_id)).size,
    };
  }, [orders]);

  const flowOf = (o: OrderRow) => o.source_type || (o.is_downsell ? "downsell" : "direct");

  const filtered = useMemo(
    () => orders.filter((o) => statusFilter === "all" || o.status === statusFilter),
    [orders, statusFilter],
  );

  const [page, setPage] = useState(1);
  const pageSize = 20;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  useEffect(() => { setPage(1); }, [statusFilter, period, botFilter, pageSize]);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [totalPages, page]);
  const paged = useMemo(
    () => filtered.slice((page - 1) * pageSize, page * pageSize),
    [filtered, page, pageSize],
  );

  const selectCls = "input-dark text-sm py-2 pr-8 cursor-pointer";

  return (
    <MainLayout>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold mb-1">Financeiro</h1>
          <p className="text-muted-foreground text-sm">Gerencie suas receitas e transações</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchOrders} disabled={loading} className="border-border hover:bg-secondary">
          {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <RefreshCw className="w-4 h-4 mr-1" />}
          Atualizar
        </Button>
      </div>

      {/* Period tabs */}
      <div className="glass-card p-1.5 mb-6 flex flex-wrap gap-1">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={cn(
              "px-4 py-2 rounded-lg text-sm transition-all",
              period === p.key
                ? "bg-primary/15 text-primary border border-primary/30 font-medium"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/60",
            )}
          >
            {p.label}
          </button>
        ))}
        {bots.length > 1 && (
          <select value={botFilter} onChange={(e) => setBotFilter(e.target.value)} className={cn(selectCls, "ml-auto")}>
            <option value="all">Todos os bots</option>
            {bots.map((b) => (
              <option key={b.id} value={b.id}>@{b.username}</option>
            ))}
          </select>
        )}
      </div>

      {/* Top metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-4">
        <MetricCard
          icon={CreditCard} label="PIX Gerados" accent="bg-primary/10 text-primary"
          value={String(stats.generated)} sub={brl(stats.generatedAmount)}
        />
        <MetricCard
          icon={CheckCircle2} label="PIX Pagos" accent="bg-emerald-500/10 text-emerald-400"
          value={String(stats.paid)} sub={brl(stats.paidAmount)}
        />
        <MetricCard
          icon={Clock} label="Pendentes" accent="bg-amber-500/10 text-amber-400"
          value={String(stats.pending)} sub={brl(stats.pendingAmount)}
        />
        <div className="glass-card p-5 border-primary/30">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Target className="w-4 h-4" />
            </div>
            <h3 className="font-semibold">Taxa de Conversão PIX</h3>
          </div>
          <p className="font-mono text-3xl font-bold text-primary">{stats.conversion.toFixed(1)}%</p>
          <p className="text-xs text-muted-foreground mt-1">
            {stats.paid} pagos de {stats.generated} PIX
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Transactions */}
        <div className="glass-card p-5 xl:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Receipt className="w-4 h-4" />
            </div>
            <h3 className="font-semibold">Transações Recentes</h3>
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={selectCls}>
              <option value="all">Todos Status</option>
              <option value="paid">Pago</option>
              <option value="pending">Pendente</option>
              <option value="expired">Expirado</option>
              <option value="refunded">Reembolsado</option>
            </select>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Receipt className="w-10 h-10 text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground">Nenhuma transação encontrada</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                As transações do período selecionado aparecerão aqui
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                    <th className="py-2 pr-3 font-medium">Cliente</th>
                    <th className="py-2 pr-3 font-medium">Bot</th>
                    <th className="py-2 pr-3 font-medium">Fluxo</th>
                    <th className="py-2 pr-3 font-medium">Status</th>
                    <th className="py-2 pr-3 font-medium text-right">Valor</th>
                    <th className="py-2 font-medium text-right">Data</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((o) => {
                    const st = STATUS_META[o.status] ?? { label: o.status, cls: "bg-muted text-muted-foreground border-border" };
                    return (
                      <tr key={o.id} className="border-b border-border/40 hover:bg-secondary/30">
                        <td className="py-2.5 pr-3">
                          <span className="block truncate max-w-[160px]">
                            {o.telegram_first_name || o.telegram_username || `#${o.telegram_user_id}`}
                          </span>
                        </td>
                        <td className="py-2.5 pr-3 text-muted-foreground">@{botNames[o.bot_id] ?? "—"}</td>
                        <td className="py-2.5 pr-3 text-muted-foreground">{FLOW_LABELS[flowOf(o)] ?? flowOf(o)}</td>
                        <td className="py-2.5 pr-3">
                          <span className={cn("px-2 py-0.5 rounded-full border text-xs", st.cls)}>{st.label}</span>
                        </td>
                        <td className="py-2.5 pr-3 text-right font-mono">{brl(Number(o.amount))}</td>
                        <td className="py-2.5 text-right text-muted-foreground whitespace-nowrap">
                          {new Date(o.paid_at ?? o.created_at).toLocaleString("pt-BR", {
                            timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
                          })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {!loading && filtered.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-4 border-t border-border/50">
              <p className="text-xs text-muted-foreground">
                Mostrando <span className="font-mono text-foreground">{(page - 1) * pageSize + 1}</span>–
                <span className="font-mono text-foreground">{Math.min(page * pageSize, filtered.length)}</span> de{" "}
                <span className="font-mono text-foreground">{filtered.length}</span> transações
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline" size="sm" className="h-8 px-2"
                  disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                {Array.from({ length: totalPages })
                  .map((_, i) => i + 1)
                  .filter((n) => n === 1 || n === totalPages || Math.abs(n - page) <= 1)
                  .reduce<(number | "gap")[]>((acc, n) => {
                    const last = acc[acc.length - 1];
                    if (typeof last === "number" && n - last > 1) acc.push("gap");
                    acc.push(n);
                    return acc;
                  }, [])
                  .map((n, i) =>
                    n === "gap" ? (
                      <span key={`gap-${i}`} className="px-1 text-xs text-muted-foreground">…</span>
                    ) : (
                      <button
                        key={n}
                        onClick={() => setPage(n)}
                        className={cn(
                          "h-8 min-w-8 px-2 rounded-md text-xs font-mono border transition-colors",
                          n === page
                            ? "bg-primary/15 text-primary border-primary/40"
                            : "border-border text-muted-foreground hover:text-foreground hover:bg-secondary/60",
                        )}
                      >
                        {n}
                      </button>
                    ),
                  )}
                <Button
                  variant="outline" size="sm" className="h-8 px-2"
                  disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Side panels */}
        <div className="space-y-4">
          <div className="glass-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <Wallet className="w-4 h-4" />
              </div>
              <h3 className="font-semibold">Métodos de Pagamento</h3>
            </div>
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-muted-foreground">PIX</span>
              <span className="font-mono">{brl(stats.paidAmount)}</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-gradient-to-r from-primary to-teal-500 rounded-full" style={{ width: stats.paidAmount > 0 ? "100%" : "0%" }} />
            </div>
          </div>

          <div className="glass-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <TrendingUp className="w-4 h-4" />
              </div>
              <h3 className="font-semibold">Resumo do Período</h3>
            </div>
            <div className="space-y-3 text-sm">
              {[
                ["Ticket Médio", brl(stats.avgTicket)],
                ["Expirados", String(stats.expired)],
                ["Reembolsos", String(stats.refunded)],
                ["Leads Únicos", String(stats.uniqueLeads)],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-mono">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}