import { useEffect, useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import {
  Webhook, Zap, Settings, Package, Smartphone, Info, AlertTriangle,
  CreditCard, Bot, CheckCircle2, Loader2, Trash2, ChevronDown, Radio, BellRing,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, StatCard } from "@/components/ui/stat-kit";
import { cn } from "@/lib/utils";

type HookRow = {
  id: string;
  event_type: string;
  url: string;
  is_active: boolean;
  last_triggered_at: string | null;
  trigger_count: number;
};

const EVENTS = [
  {
    key: "pix_error", icon: CreditCard, group: "Risco", tone: "danger",
    title: "PIX não foi gerado",
    description: "O lead pediu o pagamento e o gateway devolveu erro. Você fica sabendo na hora, antes do lead desistir.",
  },
  {
    key: "gateway_unstable", icon: AlertTriangle, group: "Risco", tone: "danger",
    title: "Gateway oscilando",
    description: "Mais de 50% de falhas em 5+ tentativas nos últimos 10 minutos. Sinal para trocar de chave antes de perder faturamento.",
  },
  {
    key: "bot_start_error", icon: Bot, group: "Operação", tone: "warn",
    title: "Falha no /start",
    description: "Algum lead abriu o bot e não recebeu a oferta inicial.",
  },
  {
    key: "bot_down", icon: Radio, group: "Operação", tone: "warn",
    title: "Robô fora do ar",
    description: "O Telegram parou de responder pelo seu token — banimento, queda ou token trocado.",
  },
  {
    key: "transaction_created", icon: Zap, group: "Vendas", tone: "info",
    title: "PIX na mão do lead",
    description: "Cobrança criada e entregue no chat. Bom para acompanhar o volume em tempo real.",
  },
  {
    key: "transaction_paid", icon: CheckCircle2, group: "Vendas", tone: "success",
    title: "Dinheiro caiu",
    description: "Pagamento confirmado e acesso VIP liberado automaticamente.",
  },
] as const;

const TONES: Record<string, { chip: string; dot: string }> = {
  danger: { chip: "bg-rose-500/15 text-rose-400 border-rose-500/25", dot: "bg-rose-400" },
  warn: { chip: "bg-amber-500/15 text-amber-400 border-amber-500/25", dot: "bg-amber-400" },
  info: { chip: "bg-primary/15 text-primary border-primary/25", dot: "bg-primary" },
  success: { chip: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25", dot: "bg-emerald-400" },
};

const GROUPS = ["Risco", "Operação", "Vendas"] as const;

const STEPS = [
  { n: 1, title: "Instale o app de push", text: "Baixe o PushCut (iOS) ou qualquer app que aceite webhook e crie uma notificação nova." },
  { n: 2, title: "Pegue o endereço", text: "Abra a notificação criada, toque no webhook e copie o link https gerado." },
  { n: 3, title: "Ligue o alerta aqui", text: "Escolha o evento abaixo, cole o link, dispare um teste e salve." },
];

export default function Webhooks() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [hooks, setHooks] = useState<HookRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [openGuide, setOpenGuide] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [urlValue, setUrlValue] = useState("");

  const byEvent = useMemo(
    () => Object.fromEntries(hooks.map((h) => [h.event_type, h])) as Record<string, HookRow | undefined>,
    [hooks]
  );

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("notification_webhooks")
      .select("id, event_type, url, is_active, last_triggered_at, trigger_count")
      .eq("user_id", user.id);
    if (error) console.error(error);
    setHooks((data as HookRow[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user]);

  const currentEvent = EVENTS.find((e) => e.key === editing);

  const openEditor = (key: string) => {
    setEditing(key);
    setUrlValue(byEvent[key]?.url || "");
  };

  const saveHook = async () => {
    if (!user || !editing) return;
    const url = urlValue.trim();
    if (!/^https:\/\/.+/i.test(url)) {
      toast({ title: "URL inválida", description: "Cole a URL https gerada pelo PushCut.", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("notification_webhooks")
      .upsert({ user_id: user.id, event_type: editing, url, is_active: true }, { onConflict: "user_id,event_type" });
    setSaving(false);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Webhook configurado", description: "As notificações desse evento estão ativas." });
    setEditing(null);
    load();
  };

  const removeHook = async (id: string) => {
    await supabase.from("notification_webhooks").delete().eq("id", id);
    toast({ title: "Webhook removido" });
    setEditing(null);
    load();
  };

  const toggleHook = async (hook: HookRow, next: boolean) => {
    setHooks((prev) => prev.map((h) => (h.id === hook.id ? { ...h, is_active: next } : h)));
    await supabase.from("notification_webhooks").update({ is_active: next }).eq("id", hook.id);
  };

  const testHook = async () => {
    const url = urlValue.trim();
    if (!/^https:\/\/.+/i.test(url)) {
      toast({ title: "URL inválida", description: "Cole a URL antes de testar.", variant: "destructive" });
      return;
    }
    try {
      await fetch(url, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Riot Vips", text: `Teste de alerta: ${currentEvent?.title}` }),
      });
      toast({ title: "Disparo de teste enviado", description: "Confira a notificação no seu celular." });
    } catch {
      toast({ title: "Não foi possível testar", description: "Verifique a URL do PushCut.", variant: "destructive" });
    }
  };

  const activeCount = hooks.filter((h) => h.is_active).length;
  const totalTriggers = hooks.reduce((s, h) => s + (h.trigger_count || 0), 0);

  return (
    <MainLayout>
      <div className="max-w-6xl mx-auto">
        <PageHeader
          icon={BellRing}
          title="Central de Alertas"
          subtitle="Sua operação avisando você no celular, no segundo em que algo acontece"
          action={
            <span className="text-[10px] uppercase tracking-[0.16em] px-3 py-1.5 rounded-full border border-border bg-secondary/40 text-muted-foreground">
              {activeCount}/{EVENTS.length} alertas ligados
            </span>
          }
        />

        <div className="grid gap-4 md:grid-cols-3 mb-6">
          <StatCard icon={Zap} label="Alertas ligados" value={`${activeCount}`} subValue="Monitorando agora"
            color="bg-emerald-500/15 text-emerald-400" bar="bg-emerald-500" progress={(activeCount / EVENTS.length) * 100} />
          <StatCard icon={Settings} label="Endereços salvos" value={`${hooks.length}`} subValue="Com link cadastrado"
            color="bg-primary/15 text-primary" bar="bg-primary" progress={(hooks.length / EVENTS.length) * 100} />
          <StatCard icon={Package} label="Disparos totais" value={`${totalTriggers}`} subValue="Notificações enviadas"
            color="bg-violet-500/15 text-violet-400" bar="bg-violet-500" progress={totalTriggers > 0 ? 100 : 6} />
        </div>

        {/* Guide */}
        <div className="glass-card overflow-hidden mb-6 animate-fade-in">
          <button
            onClick={() => setOpenGuide((v) => !v)}
            className="w-full flex items-center gap-4 p-5 text-left"
          >
            <div className="w-11 h-11 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
              <Smartphone className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-bold">Ligue o celular na sua operação em 3 passos</h2>
              <p className="text-xs text-muted-foreground">
                A Riot Vips avisa qualquer app de push por webhook — recomendamos o{" "}
                <span className="text-primary font-medium">PushCut</span>.
              </p>
            </div>
            <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", openGuide && "rotate-180")} />
          </button>

          {openGuide && (
            <div className="px-5 pb-5">
              <div className="grid gap-3 md:grid-cols-3">
                {STEPS.map((s) => (
                  <div key={s.n} className="relative p-4 rounded-xl bg-secondary/30 border border-border/40">
                    <span className="absolute -top-2 -left-2 w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-teal-500 text-primary-foreground font-mono text-xs font-bold flex items-center justify-center">
                      {s.n}
                    </span>
                    <p className="text-sm font-semibold mb-1">{s.title}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{s.text}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex gap-3 p-3 rounded-lg bg-secondary/40 border border-border/50">
                <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground">
                  Cada evento usa um link próprio: crie uma notificação separada no app para não misturar os avisos.{" "}
                  <a href="https://www.pushcut.io" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    Abrir site do PushCut
                  </a>
                </p>
              </div>
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-7 h-7 animate-spin text-primary" /></div>
        ) : (
          <div className="space-y-7 animate-fade-in">
            {GROUPS.map((group) => (
              <section key={group}>
                <div className="flex items-center gap-3 mb-3">
                  <h2 className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground font-semibold">{group}</h2>
                  <div className="h-px flex-1 bg-border/60" />
                </div>

                <div className="space-y-3">
                  {EVENTS.filter((e) => e.group === group).map((ev) => {
                    const hook = byEvent[ev.key];
                    const Icon = ev.icon;
                    const tone = TONES[ev.tone];
                    const live = !!hook?.is_active;
                    return (
                      <div
                        key={ev.key}
                        className={cn(
                          "glass-card relative overflow-hidden p-5 pl-6 flex flex-col md:flex-row md:items-center gap-4 transition-all duration-300",
                          live ? "border-primary/30" : "hover:border-border"
                        )}
                      >
                        <span className={cn("absolute left-0 top-0 bottom-0 w-1", live ? tone.dot : "bg-border")} />

                        <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border", tone.chip)}>
                          <Icon className="w-5 h-5" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold">{ev.title}</h3>
                            <span
                              className={cn(
                                "text-[9px] uppercase tracking-[0.16em] px-2 py-0.5 rounded-full border",
                                live ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" : "text-muted-foreground border-border bg-secondary/40"
                              )}
                            >
                              {live ? "Ao vivo" : hook ? "Pausado" : "Desligado"}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 max-w-2xl">{ev.description}</p>
                          {hook && (
                            <p className="text-[10px] font-mono text-muted-foreground/80 mt-2 truncate">
                              {hook.url}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-4 md:pl-4 md:border-l border-border/50">
                          <div className="text-right hidden sm:block">
                            <p className="text-lg font-mono font-bold leading-none">{hook?.trigger_count ?? 0}</p>
                            <p className="text-[9px] uppercase tracking-[0.16em] text-muted-foreground mt-1">
                              {hook?.last_triggered_at
                                ? new Date(hook.last_triggered_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
                                : "sem disparos"}
                            </p>
                          </div>
                          {hook && <Switch checked={hook.is_active} onCheckedChange={(v) => toggleHook(hook, v)} />}
                          <Button
                            size="sm"
                            variant={hook ? "outline" : "default"}
                            className={cn(hook ? "border-border hover:bg-secondary" : "btn-gradient border-0")}
                            onClick={() => openEditor(ev.key)}
                          >
                            <Settings className="w-4 h-4 mr-2" />
                            {hook ? "Ajustar" : "Ligar alerta"}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{currentEvent?.title}</DialogTitle>
            <DialogDescription>{currentEvent?.description}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Link de notificação (webhook)</label>
              <input
                type="url"
                value={urlValue}
                onChange={(e) => setUrlValue(e.target.value)}
                placeholder="https://api.pushcut.io/.../notifications/..."
                className="w-full input-dark font-mono text-xs"
              />
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 border-border hover:bg-secondary" onClick={testHook}>
                Disparar teste
              </Button>
              <Button className="flex-1 btn-gradient border-0" onClick={saveHook} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Salvar
              </Button>
            </div>

            {editing && byEvent[editing] && (
              <Button
                variant="ghost"
                className="w-full text-destructive hover:bg-destructive/10"
                onClick={() => removeHook(byEvent[editing]!.id)}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Desligar e apagar link
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
