import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Rocket, ArrowRight, X, CheckCircle2, Circle, Loader2 } from "lucide-react";

const DISMISS_KEY = "riot_onboarding_dismissed_v3";
const AUTO_OPEN_KEY = "riot_onboarding_autoopened_v3";

interface Item { label: string; done: boolean }

export function OnboardingGuide({ compact = false }: { compact?: boolean }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Item[]>([]);
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISS_KEY) === "1");

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [profileRes, botsRes] = await Promise.all([
        supabase.from("profiles").select("revantpay_api_key, revantpay_key_status").eq("id", user.id).maybeSingle(),
        supabase.from("bots").select("id, initial_message").eq("user_id", user.id),
      ]);
      const p: any = profileRes.data;
      const bots = botsRes.data || [];
      const botIds = bots.map((b: any) => b.id);

      let hasPlan = false;
      if (botIds.length) {
        const { data } = await supabase.from("subscription_plans").select("id").in("bot_id", botIds).limit(1);
        hasPlan = !!data?.length;
      }

      setItems([
        { label: "Conectar a chave da Revant Pay", done: !!p?.revantpay_api_key && p?.revantpay_key_status !== "invalid" },
        { label: "Conectar seu bot do Telegram", done: bots.length > 0 },
        { label: "Definir a mensagem de /start", done: bots.some((b: any) => !!b.initial_message) },
        { label: "Cadastrar seus planos", done: hasPlan },
      ]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { if (user) load(); }, [user?.id, load]);

  const doneCount = items.filter((i) => i.done).length;
  const complete = items.length > 0 && doneCount === items.length;
  const progress = items.length ? (doneCount / items.length) * 100 : 0;

  useEffect(() => {
    if (loading || complete || dismissed) return;
    if (localStorage.getItem(AUTO_OPEN_KEY) === "1") return;
    localStorage.setItem(AUTO_OPEN_KEY, "1");
    setOpen(true);
  }, [loading, complete, dismissed]);

  if (!user) return null;
  if (loading && !items.length) {
    return (
      <div className="glass-card p-4 mb-6 flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" /> Verificando suas configurações...
      </div>
    );
  }
  if (dismissed || complete) return null;

  const goSetup = () => { setOpen(false); navigate("/configuracoes-iniciais"); };

  return (
    <>
      <div className="glass-card mb-6 p-4 border-primary/30 animate-fade-in">
        <div className="flex flex-wrap items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-teal-500 flex items-center justify-center shrink-0">
            <Rocket className="w-5 h-5 text-primary-foreground" />
          </div>
          <div className="min-w-[180px] flex-1">
            <p className="text-sm font-semibold">Faltam algumas configurações para você começar a vender</p>
            <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground mt-0.5">
              {doneCount} de {items.length} concluídas
            </p>
            <div className="h-1.5 rounded-full bg-secondary overflow-hidden mt-2 max-w-md">
              <div className="h-full rounded-full bg-gradient-to-r from-primary to-teal-400 transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
          <Button size="sm" onClick={goSetup} className="btn-gradient border-0">
            Finalizar configurações <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </Button>
          <button
            onClick={() => { localStorage.setItem(DISMISS_KEY, "1"); setDismissed(true); }}
            className="text-muted-foreground hover:text-foreground" title="Ocultar aviso"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md p-0 overflow-hidden gap-0">
          <div className="p-6 bg-gradient-to-br from-primary/15 via-transparent to-transparent">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-teal-500 flex items-center justify-center mb-4">
              <Rocket className="w-6 h-6 text-primary-foreground" />
            </div>
            <h2 className="text-lg font-semibold">Falta pouco para você vender na Riot Vips</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Ainda faltam algumas configurações essenciais na sua conta. Leva menos de 5 minutos.
            </p>

            <div className="space-y-2 mt-5">
              {items.map((i) => (
                <div key={i.label} className="flex items-center gap-2 text-sm">
                  {i.done
                    ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    : <Circle className="w-4 h-4 text-muted-foreground shrink-0" />}
                  <span className={i.done ? "text-muted-foreground line-through" : ""}>{i.label}</span>
                </div>
              ))}
            </div>

            <div className="flex gap-2 mt-6">
              <Button className="btn-gradient border-0 flex-1" onClick={goSetup}>
                Concluir configurações <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
              <Button variant="ghost" onClick={() => setOpen(false)}>Depois</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
