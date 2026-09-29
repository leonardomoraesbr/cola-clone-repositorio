import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import {
  Bot, ExternalLink, AlertCircle, Loader2, CheckCircle2, CircleSlash,
  Plus, Settings2, Copy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBots } from "@/contexts/BotContext";
import { PageHeader, StatCard } from "@/components/ui/stat-kit";

const MAX_BOTS = 50;

export default function MyBots() {
  const [token, setToken] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const { bots, refreshBots, setSelectedBot } = useBots();
  const navigate = useNavigate();

  const activeBots = bots.filter((b) => (b.health_status ?? "active") !== "banned");
  const inactiveBots = bots.filter((b) => b.health_status === "banned");

  const handleCreateBot = async () => {
    const clean = token.trim();
    if (!clean || clean.split(":").length !== 2) {
      toast({ title: "Token inválido", description: "Cole o token completo recebido do @BotFather.", variant: "destructive" });
      return;
    }
    if (!user) {
      toast({ title: "Erro de autenticação", description: "Faça login novamente.", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const telegramResponse = await fetch(`https://api.telegram.org/bot${clean}/getMe`);
      const telegramData = await telegramResponse.json();
      if (!telegramData.ok) throw new Error("Token inválido ou bot não encontrado no Telegram");

      const botUsername = telegramData.result.username;
      const botName = telegramData.result.first_name;

      const { data: existingBot } = await supabase
        .from("bots").select("id").eq("token", clean).maybeSingle();
      if (existingBot) {
        toast({ title: "Bot já cadastrado", description: "Este bot já está registrado no sistema.", variant: "destructive" });
        setIsLoading(false);
        return;
      }

      const { data: newBot, error } = await supabase
        .from("bots")
        .insert({ user_id: user.id, token: clean, username: botUsername, name: botName })
        .select()
        .single();
      if (error) throw error;

      toast({ title: "Bot conectado!", description: `@${botUsername} está pronto para configuração.` });
      await refreshBots();
      setSelectedBot(newBot);
      setToken("");
      setOpen(false);
      navigate("/editar-bot");
    } catch (error: any) {
      console.error("Error creating bot:", error);
      toast({ title: "Erro ao conectar bot", description: error.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <MainLayout>
      <div className="max-w-6xl mx-auto">
        <PageHeader
          icon={Bot}
          title="Meus Bots"
          subtitle="Gerencie seus bots do Telegram"
          action={
            <Button className="btn-gradient border-0" onClick={() => setOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Conectar Bot ({bots.length}/{MAX_BOTS})
            </Button>
          }
        />

        <div className="grid gap-4 md:grid-cols-3 mb-6">
          <StatCard
            icon={Bot} label="Total de Bots" value={`${bots.length}`}
            subValue={`Limite de ${MAX_BOTS}`} color="bg-primary/15 text-primary"
            bar="bg-primary" progress={(bots.length / MAX_BOTS) * 100}
          />
          <StatCard
            icon={CheckCircle2} label="Bots Ativos" value={`${activeBots.length}`}
            subValue="Respondendo no Telegram" color="bg-emerald-500/15 text-emerald-400"
            bar="bg-emerald-500" progress={bots.length ? (activeBots.length / bots.length) * 100 : 0}
          />
          <StatCard
            icon={CircleSlash} label="Bots Inativos" value={`${inactiveBots.length}`}
            subValue="Banidos ou sem resposta" color="bg-destructive/15 text-destructive"
            bar="bg-destructive" progress={bots.length ? (inactiveBots.length / bots.length) * 100 : 0}
          />
        </div>

        {bots.length === 0 ? (
          <div className="glass-card p-14 flex flex-col items-center text-center animate-fade-in">
            <div className="w-16 h-16 rounded-2xl bg-secondary/60 border border-border/50 flex items-center justify-center mb-5">
              <Bot className="w-8 h-8 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-bold mb-2">Nenhum bot configurado</h2>
            <p className="text-sm text-muted-foreground max-w-md mb-6">
              Conecte seu primeiro bot do Telegram para começar a automatizar suas vendas e capturar leads.
            </p>
            <Button className="btn-gradient border-0" onClick={() => setOpen(true)}>
              <Bot className="w-4 h-4 mr-2" />
              Conectar Bot do Telegram
            </Button>
          </div>
        ) : (
          <div className="space-y-3 animate-fade-in">
            {bots.map((bot) => {
              const down = bot.health_status === "banned";
              return (
                <div
                  key={bot.id}
                  className="glass-card p-4 flex flex-wrap items-center gap-4 hover:border-primary/40 transition-all duration-300"
                >
                  <div className={`w-1 self-stretch min-h-10 rounded-full shrink-0 ${down ? "bg-destructive" : "bg-gradient-to-b from-primary to-teal-500"}`} />
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-teal-500 flex items-center justify-center shrink-0">
                    <Bot className="w-5 h-5 text-primary-foreground" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold truncate">{bot.name}</p>
                      <span className={`text-[10px] uppercase tracking-[0.14em] px-2 py-0.5 rounded-full border shrink-0 ${
                        down
                          ? "text-destructive border-destructive/30 bg-destructive/10"
                          : "text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
                      }`}>
                        {down ? "Inativo" : "Ativo"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground font-mono truncate">@{bot.username}</p>
                  </div>

                  <div className="flex items-center gap-2 ml-auto">
                    <Button
                      variant="outline" size="sm"
                      className="border-border hover:bg-secondary"
                      onClick={() => { setSelectedBot(bot); navigate("/editar-bot"); }}
                    >
                      <Settings2 className="w-3.5 h-3.5 mr-2" />
                      Editar
                    </Button>
                    <Button
                      variant="ghost" size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(`https://t.me/${bot.username}`);
                        toast({ title: "Link copiado", description: `https://t.me/${bot.username}` });
                      }}
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                    <a
                      href={`https://t.me/${bot.username}`} target="_blank" rel="noopener noreferrer"
                      className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Conectar bot do Telegram</DialogTitle>
            <DialogDescription>
              O token é validado direto na API do Telegram antes de ser salvo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Tutorial */}
            <div className="rounded-xl border border-border/60 bg-secondary/30 p-4">
              <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground mb-3">
                Como obter o token
              </h3>
              <div className="space-y-3">
                {[
                  { step: 1, title: "Inicie o BotFather", description: "Abra o Telegram, procure @BotFather e clique em Iniciar." },
                  { step: 2, title: "Crie seu bot", description: "Envie /newbot e defina nome e username do seu robô." },
                  { step: 3, title: "Copie o token", description: "O BotFather enviará o token. Cole no campo abaixo." },
                ].map((item) => (
                  <div key={item.step} className="flex gap-3">
                    <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                      <span className="font-mono font-bold text-primary text-xs">{item.step}</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium leading-tight">{item.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                    </div>
                  </div>
                ))}
              </div>
              <a
                href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-xs text-primary hover:underline mt-3"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Abrir @BotFather no Telegram
              </a>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Token do Bot</label>
              <input
                type="text"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="123456789:ABCDefGHIJKlmNOPQrstUVWxyZ"
                className="w-full input-dark font-mono text-sm"
                disabled={isLoading}
              />
            </div>

            <div className="flex gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/25">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                Mantenha seu token em segurança e não compartilhe com terceiros.
              </p>
            </div>

            <Button onClick={handleCreateBot} disabled={isLoading} className="w-full btn-gradient border-0">
              {isLoading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Verificando...</>
              ) : "Conectar Bot"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
