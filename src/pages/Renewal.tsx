import { useState, useEffect, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useBots } from "@/contexts/BotContext";
import {
  Bot, Loader2, RotateCcw, Save, Power, CalendarClock, Percent, MessageSquare, Info,
} from "lucide-react";
import { PageHeader, StatCard, Panel } from "@/components/ui/stat-kit";

export default function Renewal() {
  const { selectedBot } = useBots();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [daysBefore, setDaysBefore] = useState(3);
  const [message, setMessage] = useState(
    "🔄 Sua assinatura VIP expira em {dias} dias!\n\nRenove agora para não perder o acesso."
  );
  const [discount, setDiscount] = useState(0);

  const summary = useMemo(() => ({
    status: isActive ? "Ativa" : "Inativa",
    days: `${daysBefore}d`,
    discount: `${discount}%`,
    chars: `${message.trim().length}`,
  }), [isActive, daysBefore, discount, message]);

  useEffect(() => {
    if (selectedBot) fetchSettings();
    else setLoading(false);
  }, [selectedBot]);

  const fetchSettings = async () => {
    if (!selectedBot) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("renewal_settings")
        .select("*")
        .eq("bot_id", selectedBot.id)
        .maybeSingle();
      if (error) throw error;
      if (data) {
        setSettingsId((data as any).id);
        setIsActive((data as any).is_active);
        setDaysBefore((data as any).days_before_expiry);
        setMessage((data as any).message);
        setDiscount((data as any).discount_percentage);
      } else {
        setSettingsId(null);
        setIsActive(false);
        setDaysBefore(3);
        setDiscount(0);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!selectedBot) return;
    setSaving(true);
    try {
      const payload = {
        bot_id: selectedBot.id,
        is_active: isActive,
        days_before_expiry: daysBefore,
        message,
        discount_percentage: discount,
      };

      // Upsert por bot_id (constraint UNIQUE em renewal_settings.bot_id)
      const { data, error } = await supabase
        .from("renewal_settings")
        .upsert(payload as any, { onConflict: "bot_id" })
        .select()
        .single();

      if (error) throw error;

      if (data) setSettingsId((data as any).id);
      toast({ title: "Configuração salva!", description: "Renovação automática atualizada." });
      await fetchSettings();
    } catch (error: any) {
      console.error("[RENEWAL] save error", error);
      toast({ title: "Erro ao salvar", description: error.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (!selectedBot) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
          <Bot className="w-16 h-16 text-muted-foreground mb-4" />
          <h2 className="text-xl font-bold mb-2">Nenhum bot selecionado</h2>
          <p className="text-muted-foreground">Selecione um bot para configurar renovação</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-5xl mx-auto">
        <PageHeader
          icon={RotateCcw}
          title="Renovação Automática"
          subtitle="Lembrete de renovação antes do VIP expirar"
          gradient="from-emerald-500 to-teal-500"
          action={
            <Button onClick={handleSave} disabled={saving || loading} className="btn-gradient border-0 px-6">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              Salvar
            </Button>
          }
        />

        {/* Summary cards */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6">
          <StatCard
            icon={Power} label="Status da automação" value={summary.status}
            subValue={isActive ? "Enviando lembretes" : "Nenhum lembrete será enviado"}
            color={isActive ? "bg-emerald-500/15 text-emerald-400" : "bg-muted text-muted-foreground"}
            bar={isActive ? "bg-emerald-500" : "bg-muted-foreground"} progress={isActive ? 100 : 0}
          />
          <StatCard
            icon={CalendarClock} label="Antecedência" value={summary.days}
            subValue={`${daysBefore} dia${daysBefore > 1 ? "s" : ""} antes do vencimento`}
            color="bg-primary/15 text-primary" bar="bg-primary" progress={(daysBefore / 30) * 100}
          />
          <StatCard
            icon={Percent} label="Desconto de fidelidade" value={summary.discount}
            subValue={discount > 0 ? "Aplicado na renovação" : "Preço normal"}
            color="bg-amber-500/15 text-amber-400" bar="bg-amber-500" progress={(discount / 90) * 100}
          />
          <StatCard
            icon={MessageSquare} label="Mensagem" value={summary.chars}
            subValue="Caracteres configurados"
            color="bg-teal-500/15 text-teal-400" bar="bg-teal-500"
            progress={Math.min(100, (message.trim().length / 400) * 100)}
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-3 items-start">
            <div className="lg:col-span-2 space-y-4">
              <Panel icon={Power} title="Ativação" subtitle="Liga ou desliga o fluxo">
                <div className="flex items-center justify-between gap-4 rounded-xl border border-border/60 bg-secondary/30 p-4">
                  <div>
                    <p className="font-medium text-sm">Ativar Renovação Automática</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Envia o lembrete com link de pagamento antes do vencimento
                    </p>
                  </div>
                  <Switch checked={isActive} onCheckedChange={setIsActive} />
                </div>
              </Panel>

              <Panel icon={CalendarClock} title="Regras de envio" subtitle="Prazo e desconto">
                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium mb-2">Dias antes do vencimento</label>
                    <input
                      type="number" min="1" max="30" value={daysBefore}
                      onChange={e => setDaysBefore(parseInt(e.target.value) || 1)}
                      className="w-full input-dark font-mono"
                    />
                    <p className="text-xs text-muted-foreground mt-1.5">
                      O lembrete será enviado {daysBefore} dia{daysBefore > 1 ? "s" : ""} antes do VIP expirar
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Desconto de fidelidade (%)</label>
                    <input
                      type="number" min="0" max="90" value={discount}
                      onChange={e => setDiscount(parseInt(e.target.value) || 0)}
                      className="w-full input-dark font-mono"
                    />
                    <p className="text-xs text-muted-foreground mt-1.5">
                      {discount > 0 ? `${discount}% de desconto na renovação` : "Sem desconto (preço normal)"}
                    </p>
                  </div>
                </div>
              </Panel>

              <Panel icon={MessageSquare} title="Mensagem de lembrete" subtitle="Texto enviado no privado">
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  rows={6}
                  className="w-full input-dark resize-none"
                />
                <div className="flex flex-wrap gap-2 mt-3">
                  {["{dias}", "{nome}"].map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setMessage((m) => `${m}${tag}`)}
                      className="px-2.5 py-1 rounded-full border border-primary/40 bg-primary/10 text-primary text-xs font-mono hover:bg-primary/20 transition-colors"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
                <div className="flex justify-end mt-5">
                  <Button onClick={handleSave} disabled={saving} className="btn-gradient border-0 px-8">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                    Salvar
                  </Button>
                </div>
              </Panel>
            </div>

            <Panel icon={Info} title="Como funciona" subtitle="Resumo do fluxo">
              <ol className="space-y-3">
                {[
                  "O sistema verifica diariamente os VIPs próximos do vencimento.",
                  `Quando faltam ${daysBefore} dia${daysBefore > 1 ? "s" : ""}, o bot envia o lembrete no privado do membro.`,
                  discount > 0
                    ? `O link de pagamento já vem com ${discount}% de desconto de fidelidade.`
                    : "O link de pagamento é gerado com o preço normal do plano.",
                  "Ao pagar, o acesso VIP é renovado automaticamente.",
                ].map((text, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="w-6 h-6 rounded-lg bg-primary/15 text-primary font-mono text-xs font-bold flex items-center justify-center shrink-0">
                      {i + 1}
                    </span>
                    <p className="text-xs text-muted-foreground leading-relaxed">{text}</p>
                  </li>
                ))}
              </ol>
              <div className="mt-5 pt-4 border-t border-border/50">
                <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-2">Variáveis</p>
                <p className="text-xs text-muted-foreground">
                  <code className="text-primary font-mono">{"{dias}"}</code> dias restantes ·{" "}
                  <code className="text-primary font-mono">{"{nome}"}</code> nome do membro
                </p>
              </div>
            </Panel>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
