import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Bell, BellOff, CircleDollarSign, QrCode, UserPlus, AlertTriangle, TimerReset, CheckCheck,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useBots } from "@/contexts/BotContext";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

type Kind = "sale" | "pix" | "lead" | "expiring" | "bot_down";

interface Notification {
  id: string;
  kind: Kind;
  title: string;
  detail: string;
  timestamp: string;
  botName: string;
}

const KIND_META: Record<Kind, { icon: any; label: string; cls: string; rail: string }> = {
  sale: { icon: CircleDollarSign, label: "Venda", cls: "bg-emerald-500/15 text-emerald-400", rail: "bg-emerald-500" },
  pix: { icon: QrCode, label: "PIX", cls: "bg-primary/15 text-primary", rail: "bg-primary" },
  lead: { icon: UserPlus, label: "Lead", cls: "bg-teal-500/15 text-teal-400", rail: "bg-teal-500" },
  expiring: { icon: TimerReset, label: "Vencendo", cls: "bg-amber-500/15 text-amber-400", rail: "bg-amber-500" },
  bot_down: { icon: AlertTriangle, label: "Alerta", cls: "bg-destructive/15 text-destructive", rail: "bg-destructive" },
};

const TABS: { key: "all" | "sales" | "alerts"; label: string }[] = [
  { key: "all", label: "Tudo" },
  { key: "sales", label: "Vendas" },
  { key: "alerts", label: "Alertas" },
];

const brl = (v: number) =>
  `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const SEEN_KEY = "notifications_last_seen";

export function NotificationsDropdown() {
  const { bots } = useBots();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"all" | "sales" | "alerts">("all");
  const [lastSeen, setLastSeen] = useState<number>(() => {
    const raw = Number(localStorage.getItem(SEEN_KEY) || 0);
    return Number.isFinite(raw) ? raw : 0;
  });

  const botIds = useMemo(() => bots.map((b) => b.id).sort(), [bots]);
  const stableBotKey = botIds.join(",");

  const fetchNotifications = useCallback(async () => {
    if (botIds.length === 0) {
      setNotifications([]);
      return;
    }
    const botMap = Object.fromEntries(bots.map((b) => [b.id, b.name || b.username]));
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const soon = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    const items: Notification[] = [];

    const [orders, leads, vips] = await Promise.all([
      supabase
        .from("payment_orders")
        .select("id, amount, status, paid_at, created_at, telegram_first_name, telegram_username, bot_id")
        .in("bot_id", botIds)
        .in("status", ["paid", "pending"])
        .order("created_at", { ascending: false })
        .limit(40),
      supabase
        .from("bot_users")
        .select("id, telegram_first_name, telegram_username, created_at, bot_id")
        .in("bot_id", botIds)
        .gte("created_at", since24h)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("vip_members")
        .select("id, telegram_first_name, telegram_username, expires_at, bot_id")
        .in("bot_id", botIds)
        .eq("is_active", true)
        .not("expires_at", "is", null)
        .lte("expires_at", soon)
        .order("expires_at", { ascending: true })
        .limit(10),
    ]);

    for (const o of orders.data ?? []) {
      const who = o.telegram_first_name || o.telegram_username || "Usuário";
      const bot = botMap[o.bot_id] || "Bot";
      if (o.status === "paid") {
        items.push({
          id: `sale-${o.id}`,
          kind: "sale",
          title: `Venda confirmada · ${brl(Number(o.amount))}`,
          detail: `${who} finalizou o pagamento`,
          timestamp: o.paid_at || o.created_at,
          botName: bot,
        });
      } else if (o.created_at >= since24h) {
        items.push({
          id: `pix-${o.id}`,
          kind: "pix",
          title: `PIX gerado · ${brl(Number(o.amount))}`,
          detail: `${who} ainda não pagou`,
          timestamp: o.created_at,
          botName: bot,
        });
      }
    }

    for (const l of leads.data ?? []) {
      items.push({
        id: `lead-${l.id}`,
        kind: "lead",
        title: "Novo lead no bot",
        detail: `${l.telegram_first_name || l.telegram_username || "Usuário"} iniciou uma conversa`,
        timestamp: l.created_at,
        botName: botMap[l.bot_id] || "Bot",
      });
    }

    for (const v of vips.data ?? []) {
      items.push({
        id: `exp-${v.id}`,
        kind: "expiring",
        title: "VIP perto de expirar",
        detail: `${v.telegram_first_name || v.telegram_username || "Membro"} vence em breve`,
        timestamp: v.expires_at as string,
        botName: botMap[v.bot_id] || "Bot",
      });
    }

    for (const b of bots) {
      if (b.health_status === "banned") {
        items.push({
          id: `down-${b.id}`,
          kind: "bot_down",
          title: "Bot fora do ar",
          detail: `@${b.username} não está respondendo no Telegram`,
          timestamp: (b as any).last_health_check || new Date().toISOString(),
          botName: b.name || b.username,
        });
      }
    }

    items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    setNotifications(items.slice(0, 40));
  }, [stableBotKey, bots]);

  useEffect(() => {
    void fetchNotifications();
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void fetchNotifications();
    }, 5 * 60_000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  useEffect(() => {
    if (open) void fetchNotifications();
  }, [open, fetchNotifications]);

  const filtered = useMemo(() => {
    if (tab === "sales") return notifications.filter((n) => n.kind === "sale" || n.kind === "pix");
    if (tab === "alerts") return notifications.filter((n) => n.kind === "bot_down" || n.kind === "expiring");
    return notifications;
  }, [notifications, tab]);

  const isUnread = useCallback(
    (n: Notification) => new Date(n.timestamp).getTime() > lastSeen,
    [lastSeen],
  );
  const unreadCount = notifications.filter(isUnread).length;
  const criticalCount = notifications.filter((n) => n.kind === "bot_down").length;

  const markAllRead = () => {
    const now = Date.now();
    localStorage.setItem(SEEN_KEY, String(now));
    setLastSeen(now);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="relative p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <>
              <span
                className={cn(
                  "absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full text-[10px] font-bold flex items-center justify-center",
                  criticalCount > 0
                    ? "bg-destructive text-destructive-foreground"
                    : "bg-primary text-primary-foreground",
                )}
              >
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-primary/50 animate-ping" />
            </>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-96 p-0 bg-card border-border overflow-hidden">
        <div className="p-3 border-b border-border flex items-start justify-between gap-2">
          <div>
            <h4 className="font-semibold text-sm">Notificações</h4>
            <p className="text-[11px] text-muted-foreground">
              {unreadCount > 0 ? `${unreadCount} não lida${unreadCount > 1 ? "s" : ""}` : "Tudo em dia"}
            </p>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="inline-flex items-center gap-1.5 text-[11px] text-primary hover:underline shrink-0 mt-0.5"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              Marcar como lidas
            </button>
          )}
        </div>

        <div className="flex gap-1 px-3 py-2 border-b border-border/60">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors",
                tab === t.key
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/60",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="max-h-96 overflow-y-auto scroll-slim">
          {filtered.length === 0 ? (
            <div className="p-8 flex flex-col items-center text-center">
              <BellOff className="w-8 h-8 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">Nenhuma notificação por aqui</p>
              <p className="text-[11px] text-muted-foreground/70 mt-1">
                Vendas, PIX gerados, novos leads e alertas aparecem aqui
              </p>
            </div>
          ) : (
            filtered.map((n) => {
              const meta = KIND_META[n.kind];
              const Icon = meta.icon;
              const unread = isUnread(n);
              return (
                <div
                  key={n.id}
                  className={cn(
                    "relative px-3 py-2.5 border-b border-border/50 hover:bg-secondary/50 transition-colors",
                    unread && "bg-secondary/25",
                  )}
                >
                  <span className={cn("absolute left-0 top-0 bottom-0 w-0.5", unread ? meta.rail : "bg-transparent")} />
                  <div className="flex items-start gap-2.5">
                    <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5", meta.cls)}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{n.title}</p>
                        {unread && <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />}
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate mt-0.5">{n.detail}</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full", meta.cls)}>{meta.label}</span>
                        <span className="text-[11px] text-muted-foreground truncate">@{n.botName}</span>
                        <span className="text-[11px] text-muted-foreground">·</span>
                        <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                          {n.timestamp
                            ? formatDistanceToNow(new Date(n.timestamp), { addSuffix: true, locale: ptBR })
                            : ""}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
