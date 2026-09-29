import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBots } from "@/contexts/BotContext";
import { useToast } from "@/hooks/use-toast";
import { MainLayout } from "@/components/layout/MainLayout";
import { PageHeader } from "@/components/ui/stat-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Rocket, KeyRound, Bot, CheckCircle2, Loader2, ArrowRight, ExternalLink,
  PartyPopper, ChevronDown, ChevronRight, Sparkles, HelpCircle, Wallet,
  Smartphone, MessageCircle, Zap, ArrowUpRight,
} from "lucide-react";

const DEFAULT_MESSAGE = `🔥 Bem-vindo(a)!

Aqui dentro você encontra o conteúdo completo, atualizado todos os dias e sem censura.

✅ Acesso imediato após o PIX
✅ Conteúdo novo diariamente
✅ Suporte direto comigo

👇 Escolha sua oferta abaixo e libere seu acesso agora:`;

const DEFAULT_PLANS = [
  { name: "Semanal", duration: "7 dias", duration_days: 7, price: 9.9, sort_order: 0 },
  { name: "Mensal", duration: "30 dias", duration_days: 30, price: 19.9, sort_order: 1 },
  { name: "Vitalício", duration: "Vitalício", duration_days: 0, price: 39.9, sort_order: 2 },
];

type StepId = "key" | "bot";

export default function InitialSetup() {
  const { user } = useAuth();
  const { refreshBots, setSelectedBot } = useBots();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<StepId | null>("key");

  const [apiKey, setApiKey] = useState("");
  const [keyDone, setKeyDone] = useState(false);
  const [token, setToken] = useState("");
  const [botId, setBotId] = useState<string | null>(null);
  const [botUsername, setBotUsername] = useState<string | null>(null);
  const [contentReady, setContentReady] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [profileRes, botsRes] = await Promise.all([
        supabase.from("profiles").select("revantpay_api_key, revantpay_key_status").eq("id", user.id).maybeSingle(),
        supabase.from("bots").select("id, username, initial_message").eq("user_id", user.id).order("created_at", { ascending: true }),
      ]);
      const p: any = profileRes.data;
      const hasKey = !!p?.revantpay_api_key && p?.revantpay_key_status !== "invalid";
      setKeyDone(hasKey);

      const first: any = botsRes.data?.[0];
      if (first) {
        setBotId(first.id);
        setBotUsername(first.username);
        const { data: plans } = await supabase.from("subscription_plans").select("id").eq("bot_id", first.id).limit(1);
        setContentReady(!!first.initial_message && !!plans?.length);
        setOpen(hasKey ? null : "key");
      } else {
        setOpen(hasKey ? "bot" : "key");
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const saveKey = async () => {
    const clean = apiKey.trim();
    if (clean.length < 10) {
      toast({ title: "Chave inválida", description: "Cole a chave de API gerada na Revant Pay.", variant: "destructive" });
      return;
    }
    setBusy(true);
    const { data: check, error: fnError } = await supabase.functions.invoke("validate-revant-key", {
      body: { apiKey: clean },
    });
    if (!fnError && check?.valid === false) {
      setBusy(false);
      toast({
        title: "Chave recusada pela Revant Pay",
        description: "Gere uma nova chave de API no painel da Revant Pay e cole aqui.",
        variant: "destructive",
      });
      return;
    }
    let error: any = null;
    if (fnError || check?.valid !== true) {
      const res = await supabase
        .from("profiles")
        .update({ revantpay_api_key: clean, revantpay_key_status: null, revantpay_key_error: null } as any)
        .eq("id", user!.id);
      error = res.error;
    }
    setBusy(false);
    if (error) {
      toast({ title: "Erro ao salvar chave", description: error.message, variant: "destructive" });
      return;
    }
    setKeyDone(true);
    setApiKey("");
    setOpen(botId ? null : "bot");
    toast({ title: "Chave conectada!", description: "Seus PIX serão gerados pela Revant Pay." });
  };

  /** Cria conteúdo padrão (mensagem de /start genérica + planos, incluindo o de R$ 9,90) */
  const applyDefaults = async (id: string) => {
    try {
      await supabase.from("bots").update({ initial_message: DEFAULT_MESSAGE }).eq("id", id);
      const { data: plans } = await supabase.from("subscription_plans").select("id").eq("bot_id", id).limit(1);
      if (!plans?.length) {
        await supabase.from("subscription_plans").insert(
          DEFAULT_PLANS.map((p) => ({ ...p, bot_id: id, is_active: true })),
        );
      }
      setContentReady(true);
    } catch {
      /* silencioso — o vendedor pode ajustar depois em Meus Bots / Pagamentos */
    }
  };

  const saveBot = async () => {
    const clean = token.trim();
    if (!clean || clean.split(":").length !== 2) {
      toast({ title: "Token inválido", description: "Cole o token completo do @BotFather.", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`https://api.telegram.org/bot${clean}/getMe`);
      const data = await res.json();
      if (!data.ok) throw new Error("Token inválido ou bot não encontrado no Telegram");

      const { data: existing } = await supabase.from("bots").select("id").eq("token", clean).maybeSingle();
      if (existing) throw new Error("Este bot já está cadastrado no sistema.");

      const { data: newBot, error } = await supabase
        .from("bots")
        .insert({ user_id: user!.id, token: clean, username: data.result.username, name: data.result.first_name })
        .select()
        .single();
      if (error) throw error;

      await supabase.functions.invoke("setup-webhook", { body: { botId: newBot.id } }).catch(() => null);
      await applyDefaults(newBot.id);
      await refreshBots();
      setSelectedBot(newBot as any);
      setBotId(newBot.id);
      setBotUsername(newBot.username);
      setToken("");
      setOpen(null);
      toast({ title: "Bot conectado!", description: `@${newBot.username} já tem mensagem de /start e planos prontos.` });
    } catch (e: any) {
      toast({ title: "Erro ao conectar bot", description: e.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const steps: { id: StepId; title: string; sub: string; icon: any; done: boolean }[] = [
    { id: "key", title: "Conectar Revant Pay", sub: "Receba pagamentos via PIX automaticamente", icon: Wallet, done: keyDone },
    { id: "bot", title: "Conectar bot do Telegram", sub: "O @BotFather cria o robô que vende para você", icon: Bot, done: !!botId },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const progress = (doneCount / steps.length) * 100;
  const allDone = doneCount === steps.length;

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto">
        <PageHeader
          icon={Rocket}
          title="Configurações iniciais"
          subtitle="Deixe seu robô de vendas pronto em poucos minutos."
          action={
            <Button variant="outline" className="border-border" onClick={() => navigate("/dashboard")}>
              Ir para o dashboard <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          }
        />

        {/* Introdução amigável */}
        <div className="glass-card p-6 mb-8 border-primary/20">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-teal-500 flex items-center justify-center shrink-0">
              <Sparkles className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h2 className="text-lg font-semibold mb-2">Como funciona?</h2>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
                A Riot Vips transforma um bot do Telegram em um vendedor automático. Para isso, precisamos de duas conexões: a
                <span className="text-foreground font-medium"> Revant Pay</span> (onde seu dinheiro cai) e o
                <span className="text-foreground font-medium"> Telegram</span> (onde seu cliente conversa). Conclua os dois passos abaixo e seu bot já poderá receber PIX e liberar acessos sozinho.
              </p>
            </div>
          </div>
        </div>

        {/* Progresso */}
        <div className="glass-card p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium">Progresso da configuração</p>
              <span className="text-[10px] text-muted-foreground">({doneCount} de {steps.length} passos)</span>
            </div>
            <p className="font-mono text-sm">{doneCount}/{steps.length}</p>
          </div>
          <div className="h-2 rounded-full bg-secondary overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-primary to-teal-400 transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>

        {/* Passos em acordeão */}
        <div className="space-y-4">
          {steps.map((s, i) => {
            const Icon = s.icon;
            const expanded = open === s.id;
            return (
              <div key={s.id} className={`glass-card overflow-hidden transition-all ${expanded ? "border-primary/50" : ""}`}>
                <button
                  onClick={() => setOpen(expanded ? null : s.id)}
                  className="w-full flex items-center gap-4 p-5 text-left hover:bg-secondary/30 transition-colors"
                >
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-secondary text-muted-foreground font-semibold">
                    {s.done ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <span className="text-sm">{i + 1}</span>}
                  </div>
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${s.done ? "bg-emerald-500/15 text-emerald-400" : "bg-primary/10 text-primary"}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-semibold truncate">{s.title}</p>
                    <p className="text-sm text-muted-foreground truncate">{s.sub}</p>
                  </div>
                  {s.done && <span className="text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 font-semibold">Concluído</span>}
                  {expanded ? <ChevronDown className="w-5 h-5 text-muted-foreground" /> : <ChevronRight className="w-5 h-5 text-muted-foreground" />}
                </button>

                {expanded && (
                  <div className="px-5 pb-6 pt-2 border-t border-border/40 space-y-5">
                    {s.id === "key" && (
                      <div className="space-y-5">
                        <div className="bg-secondary/30 rounded-xl p-4">
                          <p className="text-sm font-medium mb-2 flex items-center gap-2">
                            <HelpCircle className="w-4 h-4 text-primary" /> Por que preciso da Revant Pay?
                          </p>
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            A Revant Pay é a plataforma de pagamentos que gera o QR Code PIX para seu cliente. Quando alguém enviar /start no seu bot e escolher um plano, a Riot Vips cria automaticamente uma cobrança PIX usando sua chave API. O dinheiro cai direto na sua conta Revant Pay.
                          </p>
                        </div>

                        <div className="space-y-3">
                          <p className="text-sm font-medium">Siga os passos abaixo:</p>
                          <ol className="text-sm text-muted-foreground space-y-2.5 list-decimal list-inside leading-relaxed">
                            <li>
                              Acesse a <a href="https://revantpay.com.br" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline font-medium">Revant Pay <ExternalLink className="w-3 h-3" /></a> e crie sua conta gratuita.
                            </li>
                            <li>Complete a verificação de identidade (KYC) — é obrigatório para receber pagamentos.</li>
                            <li>No painel, vá em <strong className="text-foreground">API / Chaves</strong> e clique em <strong className="text-foreground">Gerar chave de API</strong>.</li>
                            <li>Copie a chave que começa com <code className="text-primary font-mono">rvp_live_...</code> e cole no campo abaixo.</li>
                            <li>Clique em <strong className="text-foreground">Salvar chave</strong>. Pronto, a conexão está feita.</li>
                          </ol>
                        </div>

                        {keyDone ? (
                          <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 flex items-center gap-3 text-sm">
                            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                            <div>
                              <p className="font-medium text-emerald-400">Chave conectada</p>
                              <p className="text-muted-foreground">Seus PIX serão gerados pela Revant Pay.</p>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <div>
                              <Label className="text-sm mb-1.5 block">Chave de API da Revant Pay</Label>
                              <Input value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="rvp_live_..." className="font-mono" />
                              <p className="text-xs text-muted-foreground mt-1.5">A chave fica criptografada em nosso banco e nunca é compartilhada.</p>
                            </div>
                            <Button onClick={saveKey} disabled={busy} className="btn-gradient border-0">
                              {busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <KeyRound className="w-4 h-4 mr-2" />} Salvar chave
                            </Button>
                          </div>
                        )}
                      </div>
                    )}

                    {s.id === "bot" && (
                      <div className="space-y-5">
                        <div className="bg-secondary/30 rounded-xl p-4">
                          <p className="text-sm font-medium mb-2 flex items-center gap-2">
                            <HelpCircle className="w-4 h-4 text-primary" /> O que é o bot do Telegram?
                          </p>
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            O bot é um perfil automático dentro do Telegram. Ele responderá seus leads, enviará os planos, gerará o PIX e liberará o acesso ao grupo/canal sem você precisar fazer nada manualmente. Você só precisa criar o bot no Telegram e nos passar o token de acesso.
                          </p>
                        </div>

                        <div className="space-y-3">
                          <p className="text-sm font-medium">Como criar o bot:</p>
                          <ol className="text-sm text-muted-foreground space-y-2.5 list-decimal list-inside leading-relaxed">
                            <li>Abra o Telegram e procure pelo contato <strong className="text-foreground">@BotFather</strong> (o "pai" dos bots).</li>
                            <li>Envie <code className="text-primary font-mono">/newbot</code> e escolha um nome e um usuário terminado em <code className="font-mono">bot</code> (ex: <code className="font-mono">MeuVendedorBot</code>).</li>
                            <li>Assim que criar, o @BotFather vai te enviar um token parecido com <code className="font-mono text-primary">123456789:AAE...</code></li>
                            <li>Cole esse token no campo abaixo e clique em <strong className="text-foreground">Conectar bot</strong>.</li>
                          </ol>
                        </div>

                        {botId ? (
                          <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 flex items-center gap-3 text-sm">
                            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                            <div>
                              <p className="font-medium text-emerald-400">Bot @{botUsername} conectado</p>
                              <p className="text-muted-foreground">Seu robô de vendas está online e pronto para conversar.</p>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <div>
                              <Label className="text-sm mb-1.5 block">Token do bot (do @BotFather)</Label>
                              <Input value={token} onChange={(e) => setToken(e.target.value)} placeholder="123456789:AAE..." className="font-mono" />
                              <p className="text-xs text-muted-foreground mt-1.5">O token é como uma senha do bot. Guarde-o em local seguro.</p>
                            </div>
                            <Button onClick={saveBot} disabled={busy} className="btn-gradient border-0">
                              {busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Smartphone className="w-4 h-4 mr-2" />} Conectar bot
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* O que acontece automaticamente */}
        <div className="glass-card p-6 mt-6 flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
            <Zap className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <p className="text-base font-semibold mb-1">Depois de conectar, tudo fica pronto automaticamente</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Ao conectar o bot, criamos automaticamente uma mensagem de ofertas genérica e 3 planos de preço
              (<span className="font-mono text-primary">R$ 9,90</span> · R$ 19,90 · R$ 39,90). Você pode editar a mensagem e os preços depois, mas já dá para começar a vender.
            </p>
            <div className="flex flex-wrap gap-3 mt-4">
              <Button size="sm" variant="outline" className="border-border" onClick={() => navigate("/editar-bot")}>
                <MessageCircle className="w-3.5 h-3.5 mr-1.5" /> Editar mensagem
              </Button>
              <Button size="sm" variant="outline" className="border-border" onClick={() => navigate("/pagamentos")}>
                <Wallet className="w-3.5 h-3.5 mr-1.5" /> Ajustar preços
              </Button>
              <Button size="sm" variant="outline" className="border-border" onClick={() => navigate("/meus-bots")}>
                <Bot className="w-3.5 h-3.5 mr-1.5" /> Meus bots
              </Button>
            </div>
          </div>
        </div>

        {allDone && (
          <div className="mt-6 p-5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 flex items-start gap-4">
            <PartyPopper className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-base font-semibold text-emerald-400 mb-1">Tudo pronto! 🎉</p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Seu bot já pode receber PIX e liberar acessos automaticamente. Envie o link do bot para seus leads ou comece a divulgar seu canal de vendas.
              </p>
              <div className="flex flex-wrap gap-3 mt-4">
                <Button size="sm" onClick={() => navigate("/dashboard")} className="btn-gradient border-0">
                  Ver dashboard <ArrowUpRight className="w-3.5 h-3.5 ml-1.5" />
                </Button>
                <Button size="sm" variant="outline" className="border-border" onClick={() => navigate("/tracking")}>
                  Criar link de divulgação
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
