import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { supabase } from "@/integrations/supabase/client";
import { useBots } from "@/contexts/BotContext";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  Activity, RefreshCw, UserPlus, Zap, CheckCircle2, DollarSign, Radio, Clock, Ban, Loader2,
  X, Copy, FileJson,
} from "lucide-react";

type EventType = "start" | "pix" | "paid" | "blocked";

interface LogEvent {
  id: string;
  type: EventType;
  name: string;
  username: string | null;
  detail: string;
  amount?: number;
  time: string;
  source: string;
  raw: Record<string, any>;
}

const TYPE_META: Record<EventType, { label: string; icon: any; dot: string; chip: string }> = {
  start: { label: "Lead entrou", icon: UserPlus, dot: "bg-sky-400", chip: "bg-sky-500/10 text-sky-400 border-sky-500/30" },
  pix: { label: "PIX gerado", icon: Zap, dot: "bg-amber-400", chip: "bg-amber-500/10 text-amber-400 border-amber-500/30" },
  paid: { label: "Pagamento", icon: CheckCircle2, dot: "bg-primary", chip: "bg-primary/10 text-primary border-primary/30" },
  blocked: { label: "Bloqueado", icon: Ban, dot: "bg-destructive", chip: "bg-destructive/10 text-destructive border-destructive/30" },
};

const brl = (v: number) =>
  `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}min atrás`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h atrás`;
  return `${Math.floor(hrs / 24)}d atrás`;
}

function StatCard({ label, value, icon: Icon, accent }: { label: string; value: string; icon: any; accent: string }) {
  return (
    <div className="glass-card p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-muted-foreground">{label}</p>
        <Icon className={cn("w-4 h-4 shrink-0", accent)} />
      </div>
      <p className="font-mono text-2xl font-bold mt-3 leading-none">{value}</p>
    </div>
  );
}

export default function ActivityLog() {
  const { selectedBot, bots, loading: botsLoading } = useBots();
  const [events, setEvents] = useState<LogEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [filter, setFilter] = useState<"all" | EventType>("all");
  const [detail, setDetail] = useState<LogEvent | null>(null);
  const mounted = useRef(true);

  const botIds = useMemo(
    () => (selectedBot ? [selectedBot.id] : bots.map((b) => b.id)),
    [selectedBot, bots],
  );

  const fetchEvents = useCallback(async () => {
    if (botIds.length === 0) { setEvents([]); setLoading(false); return; }
    const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    try {
      const [{ data: users }, { data: orders }, { data: blocked }] = await Promise.all([
        supabase
          .from("bot_users")
          .select("*")
          .in("bot_id", botIds)
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(150),
        supabase
          .from("payment_orders")
          .select("*")
          .in("bot_id", botIds)
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(150),
        supabase
          .from("blacklisted_users")
          .select("*")
          .in("bot_id", botIds)
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(50),
      ]);

      const all: LogEvent[] = [];
      users?.forEach((u) =>
        all.push({
          id: `u-${u.id}`,
          type: "start",
          name: u.telegram_first_name || u.telegram_username || "Lead",
          username: u.telegram_username,
          detail: "iniciou a conversa com o bot",
          time: u.created_at,
          source: "bot_users",
          raw: u as any,
        }),
      );
      orders?.forEach((o) => {
        const paid = o.status === "paid";
        all.push({
          id: `o-${o.id}`,
          type: paid ? "paid" : "pix",
          name: o.telegram_first_name || o.telegram_username || "Lead",
          username: o.telegram_username,
          detail: paid ? "pagou o PIX" : "gerou um PIX",
          amount: Number(o.amount),
          time: (paid ? o.paid_at : o.created_at) || o.created_at,
          source: "payment_orders",
          raw: o as any,
        });
      });
      blocked?.forEach((b) =>
        all.push({
          id: `b-${b.id}`,
          type: "blocked",
          name: b.telegram_first_name || b.telegram_username || "Lead",
          username: b.telegram_username,
          detail: "foi bloqueado",
          time: b.created_at,
          source: "blacklisted_users",
          raw: b as any,
        }),
      );

      all.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
      if (!mounted.current) return;
      setEvents(all.slice(0, 200));
      setLastUpdate(new Date());
    } catch (err) {
      console.error("Error loading activity log:", err);
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [botIds]);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    if (botsLoading) return;
    setLoading(true);
    void fetchEvents();
    const t = setInterval(() => { void fetchEvents(); }, 15000);
    return () => clearInterval(t);
  }, [botsLoading, fetchEvents]);

  const stats = useMemo(() => {
    const paid = events.filter((e) => e.type === "paid");
    return {
      leads: events.filter((e) => e.type === "start").length,
      pix: events.filter((e) => e.type === "pix").length,
      paid: paid.length,
      revenue: paid.reduce((s, e) => s + (e.amount ?? 0), 0),
    };
  }, [events]);

  const visible = filter === "all" ? events : events.filter((e) => e.type === filter);

  return (
    <MainLayout>
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Activity className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold leading-tight">Log de Atividade</h1>
            <p className="text-sm text-muted-foreground">
              Ações dos leads em tempo real — últimas 48h
              {selectedBot ? ` · @${selectedBot.username}` : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-medium">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            LIVE · 15s
          </span>
          <Button variant="outline" size="sm" onClick={() => fetchEvents()} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1" />}
            Atualizar
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Leads entraram" value={String(stats.leads)} icon={UserPlus} accent="text-sky-400" />
        <StatCard label="PIX gerados" value={String(stats.pix)} icon={Zap} accent="text-amber-400" />
        <StatCard label="Pagamentos" value={String(stats.paid)} icon={CheckCircle2} accent="text-primary" />
        <StatCard label="Receita" value={brl(stats.revenue)} icon={DollarSign} accent="text-primary" />
      </div>

      {/* Feed */}
      <div className="glass-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-border/50">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-primary" />
            <h2 className="font-semibold">Feed de eventos</h2>
            <span className="text-sm text-muted-foreground">({visible.length})</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              {([
                ["all", "Tudo"],
                ["start", "Leads"],
                ["pix", "PIX"],
                ["paid", "Pagos"],
                ["blocked", "Bloqueios"],
              ] as const).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setFilter(key as any)}
                  className={cn(
                    "px-3 py-1 rounded-full text-xs border transition-colors",
                    filter === key
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground hover:bg-secondary",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
              <Clock className="w-3.5 h-3.5" />
              {lastUpdate.toLocaleTimeString("pt-BR")}
            </span>
          </div>
        </div>

        {loading && events.length === 0 ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <Activity className="w-12 h-12 text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground">Nenhuma atividade nas últimas 48h</p>
          </div>
        ) : (
          <div className="divide-y divide-border/40 max-h-[600px] overflow-y-auto">
            {visible.map((e) => {
              const meta = TYPE_META[e.type];
              const Icon = meta.icon;
              return (
                <div
                  key={e.id}
                  onClick={() => setDetail(e)}
                  className="flex items-center gap-4 px-5 py-3.5 hover:bg-secondary/30 transition-colors cursor-pointer"
                >
                  <div className="relative shrink-0">
                    <div className="w-9 h-9 rounded-xl bg-secondary/60 border border-border/50 flex items-center justify-center">
                      <Icon className="w-4 h-4 text-foreground/80" />
                    </div>
                    <span className={cn("absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full", meta.dot)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">
                      <span className="font-medium">{e.name}</span>{" "}
                      <span className="text-muted-foreground">{e.detail}</span>
                      {e.amount !== undefined && (
                        <span className="font-mono text-foreground"> · {brl(e.amount)}</span>
                      )}
                    </p>
                    {e.username && (
                      <p className="text-xs text-muted-foreground font-mono truncate">@{e.username}</p>
                    )}
                  </div>
                  <span className={cn("hidden sm:inline-flex px-2 py-0.5 rounded-full text-[11px] border", meta.chip)}>
                    {meta.label}
                  </span>
                  <span className="text-xs text-muted-foreground whitespace-nowrap w-20 text-right">
                    {timeAgo(e.time)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <EventDetailDialog event={detail} onClose={() => setDetail(null)} />
    </MainLayout>
  );
}

function humanKey(k: string) {
  return k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatValue(v: any) {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Sim" : "Não";
  if (typeof v === "object") return JSON.stringify(v);
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v)) {
    return new Date(v).toLocaleString("pt-BR");
  }
  return String(v);
}

function EventDetailDialog({ event, onClose }: { event: LogEvent | null; onClose: () => void }) {
  if (!event) return null;
  const meta = TYPE_META[event.type];
  const Icon = meta.icon;
  const entries = Object.entries(event.raw || {}).filter(([k]) => k !== "id");

  return (
    <Dialog open={!!event} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto scroll-slim p-0">
        <div className="flex items-start gap-3 px-6 py-4 border-b border-border/50 sticky top-0 bg-background/95 backdrop-blur z-10">
          <div className="w-10 h-10 rounded-xl bg-secondary/70 border border-border/50 flex items-center justify-center shrink-0">
            <Icon className="w-4 h-4 text-foreground/80" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-bold leading-tight truncate">{event.name}</h2>
            <p className="text-xs text-muted-foreground">
              {meta.label} · {new Date(event.time).toLocaleString("pt-BR")}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}><X className="w-4 h-4" /></Button>
        </div>

        <div className="p-6 space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="glass-card p-3">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Tipo</p>
              <p className="text-sm font-medium mt-1">{meta.label}</p>
            </div>
            <div className="glass-card p-3">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Usuário</p>
              <p className="text-sm font-mono mt-1 truncate">{event.username ? `@${event.username}` : "—"}</p>
            </div>
            <div className="glass-card p-3">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Valor</p>
              <p className="text-sm font-mono mt-1">{event.amount !== undefined ? brl(event.amount) : "—"}</p>
            </div>
            <div className="glass-card p-3">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Origem</p>
              <p className="text-sm font-mono mt-1 truncate">{event.source}</p>
            </div>
          </div>

          <div className="glass-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border/50">
              <h3 className="text-sm font-semibold">Informações completas</h3>
            </div>
            <div className="divide-y divide-border/30 max-h-[280px] overflow-y-auto scroll-slim">
              {entries.map(([k, v]) => (
                <div key={k} className="flex gap-4 px-4 py-2.5">
                  <span className="text-xs text-muted-foreground w-48 shrink-0">{humanKey(k)}</span>
                  <span className="text-xs font-mono break-all flex-1">{formatValue(v)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border/50">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <FileJson className="w-4 h-4 text-primary" /> Payload bruto
              </h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigator.clipboard.writeText(JSON.stringify(event.raw, null, 2))}
              >
                <Copy className="w-3.5 h-3.5 mr-1.5" /> Copiar JSON
              </Button>
            </div>
            <pre className="text-[11px] font-mono p-4 overflow-auto max-h-[280px] scroll-slim text-muted-foreground">
{JSON.stringify(event.raw, null, 2)}
            </pre>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}