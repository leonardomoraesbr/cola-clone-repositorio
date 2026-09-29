import { useCallback, useEffect, useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { useBots } from "@/contexts/BotContext";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Panel, SectionTitle } from "@/components/ui/stat-kit";
import {
  Activity, RefreshCw, Globe, CheckCircle2, AlertTriangle, XCircle,
  TrendingUp, Zap, ArrowRight, Clock,
} from "lucide-react";

type Health = "operational" | "unstable" | "down";

interface GatewayHealth {
  botId: string;
  botName: string;
  attempts: number;
  generated: number;
  failures: number;
  paid: number;
  successRate: number;
  lastFailure: string | null;
  lastFailureMsg: string | null;
  lastGeneratedAt: string | null;
  health: Health;
}

const HEALTH_META: Record<Health, { label: string; icon: any; text: string; chip: string; dot: string }> = {
  operational: { label: "Operacional", icon: CheckCircle2, text: "text-emerald-400", chip: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", dot: "bg-emerald-400" },
  unstable: { label: "Instável", icon: AlertTriangle, text: "text-amber-400", chip: "bg-amber-500/10 text-amber-400 border-amber-500/20", dot: "bg-amber-400" },
  down: { label: "Fora do ar", icon: XCircle, text: "text-destructive", chip: "bg-destructive/10 text-destructive border-destructive/20", dot: "bg-destructive" },
};

/** Eventos que indicam falha real na EMISSÃO do PIX (não falta de pagamento do lead) */
const FAILURE_EVENTS = new Set([
  "revantpay_failed",
  "pix_generation_failed",
  "pix_failed",
  "minimum_amount_failed",
  "gateway_error",
]);
const GENERATED_EVENTS = new Set(["pix_generated", "revantpay_success"]);

/**
 * Saúde = taxa de sucesso na GERAÇÃO do PIX.
 * Lead que gera PIX e não paga NÃO é falha de gateway.
 */
function classify(attempts: number, generated: number, failures: number): Health {
  if (attempts === 0 && failures === 0) return "operational";
  const total = generated + failures;
  if (total === 0) return "operational";
  const rate = generated / total;
  if (failures === 0) return "operational";
  if (rate >= 0.95) return "operational";
  if (rate >= 0.6) return "unstable";
  return "down";
}

export default function PixStatus() {
  const { bots } = useBots();
  const [rows, setRows] = useState<GatewayHealth[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    if (bots.length === 0) {
      setRows([]);
      setLoading(false);
      setUpdatedAt(new Date());
      return;
    }
    setLoading(true);
    try {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const botIds = bots.map(b => b.id);

      const [{ data: events, error: evErr }, { data: orders, error: ordErr }] = await Promise.all([
        supabase
          .from("telegram_payment_events")
          .select("bot_id, event_type, success, error_message, created_at")
          .in("bot_id", botIds)
          .gte("created_at", since),
        supabase
          .from("payment_orders")
          .select("bot_id, status, paid_at, created_at")
          .in("bot_id", botIds)
          .gte("created_at", since),
      ]);
      if (evErr) throw evErr;
      if (ordErr) throw ordErr;

      const map = new Map<string, GatewayHealth>();
      for (const bot of bots) {
        map.set(bot.id, {
          botId: bot.id,
          botName: bot.username ? `@${bot.username}` : bot.name,
          attempts: 0, generated: 0, failures: 0, paid: 0,
          successRate: 100, lastFailure: null, lastFailureMsg: null,
          lastGeneratedAt: null, health: "operational",
        });
      }

      for (const ev of events || []) {
        const row = map.get(ev.bot_id as string);
        if (!row) continue;
        const type = ev.event_type as string;
        if (type === "payment_started") row.attempts += 1;
        if (GENERATED_EVENTS.has(type) && type === "pix_generated") {
          row.generated += 1;
          if (!row.lastGeneratedAt || ev.created_at > row.lastGeneratedAt) row.lastGeneratedAt = ev.created_at as string;
        }
        if (FAILURE_EVENTS.has(type) && ev.success === false) {
          row.failures += 1;
          if (!row.lastFailure || ev.created_at > row.lastFailure) {
            row.lastFailure = ev.created_at as string;
            let msg = (ev.error_message as string) || "Falha ao gerar PIX";
            try { const parsed = JSON.parse(msg); msg = parsed?.error || msg; } catch { /* texto puro */ }
            row.lastFailureMsg = msg.slice(0, 220);
          }
        }
      }

      for (const order of orders || []) {
        const row = map.get(order.bot_id as string);
        if (!row) continue;
        if (order.status === "paid" || order.paid_at) row.paid += 1;
      }

      const list = Array.from(map.values())
        .map(r => {
          const total = r.generated + r.failures;
          return {
            ...r,
            successRate: total > 0 ? (r.generated / total) * 100 : 100,
            health: classify(r.attempts, r.generated, r.failures),
          };
        })
        .filter(r => r.attempts > 0 || r.generated > 0 || r.failures > 0);

      setRows(list);
      setUpdatedAt(new Date());
    } catch (e) {
      console.error("Erro ao carregar status PIX:", e);
    } finally {
      setLoading(false);
    }
  }, [bots]);

  useEffect(() => {
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [load]);

  const summary = useMemo(() => {
    const generated = rows.reduce((s, r) => s + r.generated, 0);
    const failures = rows.reduce((s, r) => s + r.failures, 0);
    const paid = rows.reduce((s, r) => s + r.paid, 0);
    const total = generated + failures;
    return {
      operational: rows.filter(r => r.health === "operational").length,
      unstable: rows.filter(r => r.health === "unstable").length,
      down: rows.filter(r => r.health === "down").length,
      generated,
      failures,
      paid,
      successRate: total > 0 ? (generated / total) * 100 : 100,
    };
  }, [rows]);

  const overall = useMemo(() => {
    if (rows.length === 0) {
      return {
        headline: "Sem movimento por enquanto",
        detail: "Nenhuma cobrança foi solicitada nas últimas 24 horas. Assim que um lead iniciar um pagamento, o desempenho aparece aqui.",
        text: "text-foreground", dot: "bg-muted-foreground", bar: "bg-muted-foreground",
      };
    }
    if (summary.down > 0 || summary.successRate < 60) {
      return {
        headline: "Emissão comprometida",
        detail: "Um ou mais bots não estão conseguindo emitir cobranças. Revise a chave da RevantPay do bot afetado — a mensagem exata do erro está listada abaixo.",
        text: "text-destructive", dot: "bg-destructive", bar: "bg-destructive",
      };
    }
    if (summary.unstable > 0 || summary.failures > 0) {
      return {
        headline: "Oscilações pontuais",
        detail: "A maior parte das cobranças saiu normalmente, mas houve tentativas com erro. Confira o detalhe por bot para saber se foi algo isolado.",
        text: "text-amber-400", dot: "bg-amber-400", bar: "bg-amber-400",
      };
    }
    return {
      headline: "Tudo saindo normalmente",
      detail: "Todas as cobranças solicitadas nas últimas 24 horas foram emitidas com QR Code e copia-e-cola sem nenhum erro de gateway.",
      text: "text-emerald-400", dot: "bg-emerald-400", bar: "bg-emerald-400",
    };
  }, [rows.length, summary]);

  return (
    <MainLayout>
      <div className="max-w-6xl mx-auto">
        <PageHeader
          icon={Activity}
          title="Monitor de Emissão PIX"
          subtitle="Acompanhe em tempo real se os seus bots estão conseguindo emitir cobranças"
          gradient="from-emerald-500 to-teal-500"
          action={
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
          }
        />

        {/* Painel principal: veredito único + leitura rápida */}
        <div className="glass-card overflow-hidden mb-4 animate-fade-in">
          <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_1fr]">
            <div className="p-6 border-b lg:border-b-0 lg:border-r border-border/40">
              <div className="flex items-center gap-2 mb-4">
                <span className={`w-2 h-2 rounded-full ${overall.dot} animate-pulse`} />
                <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-medium">
                  Leitura das últimas 24 horas
                </p>
              </div>
              <h2 className={`text-3xl font-bold leading-tight ${overall.text}`}>{overall.headline}</h2>
              <p className="text-sm text-muted-foreground mt-2 max-w-md">{overall.detail}</p>

              <div className="mt-5 h-1.5 rounded-full bg-secondary overflow-hidden max-w-md">
                <div
                  className={`h-full rounded-full ${overall.bar}`}
                  style={{ width: `${Math.min(100, Math.max(3, summary.successRate))}%` }}
                />
              </div>
              <p className="text-[11px] text-muted-foreground mt-2 font-mono">
                {summary.successRate.toFixed(1)}% de aproveitamento na emissão
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2">
              {[
                { icon: Zap, label: "Cobranças emitidas", value: summary.generated, cls: "text-foreground" },
                { icon: AlertTriangle, label: "Tentativas com erro", value: summary.failures, cls: summary.failures > 0 ? "text-destructive" : "text-muted-foreground" },
                { icon: TrendingUp, label: "Pagas no período", value: summary.paid, cls: "text-emerald-400" },
                { icon: CheckCircle2, label: "Bots sem incidente", value: summary.operational, cls: "text-emerald-400" },
              ].map((s) => (
                <div key={s.label} className="p-5 border-b border-r border-border/30 last:border-r-0">
                  <s.icon className="w-4 h-4 text-muted-foreground mb-3" />
                  <p className={`font-mono text-2xl font-bold ${s.cls}`}>{s.value}</p>
                  <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground mt-1">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Referência externa discreta */}
        <div className="flex flex-wrap items-center gap-3 mb-8 text-xs text-muted-foreground">
          <Globe className="w-3.5 h-3.5" />
          <span>
            Suspeita de instabilidade fora da Riot? Compare com os relatos do PIX no Brasil.
          </span>
          <a
            href="https://downdetector.com.br/fora-do-ar/pix/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-primary hover:underline font-medium"
          >
            Consultar relatos <ArrowRight className="w-3 h-3" />
          </a>
        </div>

        <SectionTitle hint="Contabilizamos apenas a emissão da cobrança: lead que gera PIX e não paga nunca conta como erro">
          Desempenho bot a bot
        </SectionTitle>

        {rows.length === 0 ? (
          <div className="glass-card p-12 text-center animate-fade-in">
            <Zap className="w-10 h-10 mx-auto mb-4 text-muted-foreground" />
            <h3 className="font-semibold mb-1">Nenhuma transação nas últimas 24h</h3>
            <p className="text-sm text-muted-foreground">Quando seus bots começarem a gerar PIX, o status aparece aqui.</p>
          </div>
        ) : (
          <Panel icon={Activity} title="Gateways por bot" subtitle="Últimas 24 horas">
            <div className="space-y-3">
              {rows.map((row) => {
                const meta = HEALTH_META[row.health];
                const Icon = meta.icon;
                return (
                  <div key={row.botId} className="p-4 rounded-xl bg-secondary/30 border border-border/40 hover:border-primary/30 transition-all">
                    <div className="flex flex-wrap items-center gap-4">
                      <span className={`w-2 h-2 rounded-full ${meta.dot} animate-pulse`} />
                      <div className="flex-1 min-w-[160px]">
                        <p className="font-medium text-sm">{row.botName}</p>
                        <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground mt-0.5">RevantPay · PIX</p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-lg font-bold">{row.generated}</p>
                        <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Gerados</p>
                      </div>
                      <div className="text-right">
                        <p className={`font-mono text-lg font-bold ${row.failures > 0 ? "text-destructive" : "text-muted-foreground"}`}>{row.failures}</p>
                        <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Falhas</p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-lg font-bold text-emerald-400">{row.paid}</p>
                        <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Pagos</p>
                      </div>
                      <div className="text-right w-20">
                        <p className="font-mono text-lg font-bold">{row.successRate.toFixed(0)}%</p>
                        <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Emissão</p>
                      </div>
                      <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${meta.chip}`}>
                        <Icon className="w-3.5 h-3.5" /> {meta.label}
                      </span>
                    </div>
                    <div className="mt-3 h-1 rounded-full bg-secondary overflow-hidden">
                      <div
                        className={`h-full rounded-full ${row.health === "operational" ? "bg-emerald-400" : row.health === "unstable" ? "bg-amber-400" : "bg-destructive"}`}
                        style={{ width: `${Math.min(100, Math.max(3, row.successRate))}%` }}
                      />
                    </div>
                    {row.lastFailureMsg ? (
                      <p className="text-[11px] text-destructive mt-2 flex items-start gap-1.5">
                        <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                        <span>
                          Última falha{" "}
                          {row.lastFailure &&
                            new Date(row.lastFailure).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                          : {row.lastFailureMsg}
                        </span>
                      </p>
                    ) : row.lastGeneratedAt ? (
                      <p className="text-[11px] text-muted-foreground mt-2 flex items-center gap-1.5">
                        <Clock className="w-3 h-3" /> Último PIX emitido com sucesso às{" "}
                        {new Date(row.lastGeneratedAt).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </Panel>
        )}

        <p className="text-center text-[11px] text-muted-foreground mt-6">
          Dados privados da sua conta · Atualização a cada 30s
          {updatedAt ? ` · Última: ${updatedAt.toLocaleTimeString("pt-BR")}` : ""}
        </p>
      </div>
    </MainLayout>
  );
}
