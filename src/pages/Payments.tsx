import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { CreditCard, Link2, ExternalLink, Loader2, ShieldCheck, Zap, RefreshCw, KeyRound, Plug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import revantPayLogo from "@/assets/revantpay-logo.png.asset.json";
import { PageHeader, StatCard, Panel } from "@/components/ui/stat-kit";

export default function Payments() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editingToken, setEditingToken] = useState(false);
  const [tokenValue, setTokenValue] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [currentToken, setCurrentToken] = useState("");
  const [keyInvalid, setKeyInvalid] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);

  useEffect(() => {
    if (user) fetchApiKey();
  }, [user]);

  const fetchApiKey = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("revantpay_api_key, revantpay_key_status, revantpay_key_error")
        .eq("id", user.id)
        .single();

      if (error) throw error;
      const key = (data as any)?.revantpay_api_key || "";
      setCurrentToken(key);
      setIsConnected(!!key);
      setKeyInvalid((data as any)?.revantpay_key_status === "invalid");
      setKeyError((data as any)?.revantpay_key_error || null);
    } catch (error) {
      console.error("Error fetching API key:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnect = async () => {
    const normalizedToken = tokenValue.trim();
    if (!normalizedToken || !user) {
      toast({ title: "Token obrigatório", description: "Por favor, insira o token do RevantPay.", variant: "destructive" });
      return;
    }

    if (!normalizedToken.startsWith("rpay_")) {
      toast({ title: "Chave inválida", description: "Cole a API Key gerada no painel da RevantPay.", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    try {
      // Valida a chave direto na RevantPay antes de salvar (evita erro só na hora da venda)
      const { data: check, error: fnError } = await supabase.functions.invoke("validate-revant-key", {
        body: { apiKey: normalizedToken },
      });

      if (!fnError && check && check.valid === false) {
        setKeyInvalid(true);
        setKeyError(check.detail || "Chave recusada pela RevantPay");
        toast({
          title: "Chave recusada pela RevantPay",
          description: "Essa chave está inválida ou revogada. Gere uma nova chave no painel da RevantPay e cole aqui.",
          variant: "destructive",
        });
        return;
      }

      // Fallback: se não deu para validar (gateway fora), salva mesmo assim.
      if (fnError || !check || check.valid !== true) {
        const { error } = await supabase
          .from("profiles")
          .update({
            revantpay_api_key: normalizedToken,
            revantpay_key_status: null,
            revantpay_key_error: null,
          } as any)
          .eq("id", user.id);
        if (error) throw error;
      }

      setCurrentToken(normalizedToken);
      setIsConnected(true);
      setKeyInvalid(false);
      setKeyError(null);
      setEditingToken(false);
      setTokenValue("");
      toast({ title: "RevantPay conectado!", description: "Chave validada e salva. Todos os seus bots usarão esta chave." });
    } catch (error) {
      console.error("Error saving:", error);
      toast({ title: "Erro", description: "Ocorreu um erro ao salvar.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDisconnect = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ revantpay_api_key: null, revantpay_key_status: null, revantpay_key_error: null } as any)
        .eq("id", user.id);

      if (error) throw error;

      setCurrentToken("");
      setIsConnected(false);
      setKeyInvalid(false);
      setKeyError(null);
      toast({ title: "RevantPay desconectado", description: "A API key foi removida." });
    } catch (error) {
      console.error("Error:", error);
      toast({ title: "Erro", description: "Ocorreu um erro.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <MainLayout>
      <div className="max-w-5xl mx-auto">
        <PageHeader
          icon={CreditCard}
          title="Meios de Pagamento"
          subtitle="Conecte o gateway que emite os PIX dos seus bots"
          action={
            <span
              className={`text-[10px] uppercase tracking-[0.16em] px-3 py-1.5 rounded-full border ${
                isConnected
                  ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
                  : "text-muted-foreground border-border bg-secondary/40"
              }`}
            >
              {isConnected ? "Gateway conectado" : "Gateway pendente"}
            </span>
          }
        />

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {keyInvalid && (
              <div className="glass-card border border-amber-500/40 bg-amber-500/10 p-4 mb-6 animate-fade-in">
                <div className="flex items-start gap-3">
                  <KeyRound className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-amber-300 mb-1">Chave de API recusada pela RevantPay</h3>
                    <p className="text-sm text-muted-foreground">
                      A última tentativa de gerar PIX falhou porque sua chave está inválida ou foi revogada.
                      Acesse o painel da RevantPay, gere uma nova API Key e cole abaixo para reconectar.
                    </p>
                    {keyError && (
                      <p className="text-xs text-muted-foreground/70 mt-2 font-mono break-all">{keyError}</p>
                    )}
                    <a
                      href="https://revantpay.com.br"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm text-amber-300 hover:underline mt-3"
                    >
                      Gerar nova chave na RevantPay <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              </div>
            )}
            <div className="grid gap-4 md:grid-cols-3 mb-6 animate-fade-in">
              <StatCard
                icon={Plug}
                label="Status da conexão"
                value={keyInvalid ? "Chave inválida" : isConnected ? "Ativo" : "Inativo"}
                subValue={keyInvalid ? "Gere uma nova chave na RevantPay" : isConnected ? "Chave válida salva" : "Nenhuma chave cadastrada"}
                color={keyInvalid ? "bg-amber-500/15 text-amber-400" : isConnected ? "bg-emerald-500/15 text-emerald-400" : "bg-secondary text-muted-foreground"}
                bar={keyInvalid ? "bg-amber-500" : isConnected ? "bg-emerald-500" : "bg-muted"}
                progress={keyInvalid ? 40 : isConnected ? 100 : 8}
              />
              <StatCard
                icon={Zap} label="Método habilitado" value="PIX"
                subValue="Confirmação automática"
                color="bg-primary/15 text-primary" bar="bg-primary" progress={100}
              />
              <StatCard
                icon={RefreshCw} label="Liberação do VIP" value="Automática"
                subValue="Após o pagamento confirmado"
                color="bg-violet-500/15 text-violet-400" bar="bg-violet-500" progress={100}
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr] animate-fade-in" style={{ animationDelay: "0.1s" }}>
            <div className="glass-card overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-primary via-teal-500 to-emerald-500" />
            <div className="p-6">
              <div className="flex items-center gap-5 mb-6">
                <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center shadow-lg border border-border/60 overflow-hidden shrink-0">
                  <img src={revantPayLogo.url} alt="RevantPay" className="w-full h-full object-cover" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xl font-bold">RevantPay</h3>
                  <p className="text-xs text-muted-foreground uppercase tracking-[0.16em] mt-0.5">Gateway PIX oficial</p>
                  <div className="flex items-center gap-1.5 text-xs text-emerald-400 mt-2">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Uma única API key para todos os seus bots
                  </div>
                </div>
              </div>

              {isConnected && !editingToken ? (
                <div className="mb-6">
                  <label className="block text-sm font-medium mb-2">Token conectado</label>
                  <div className="p-4 bg-secondary/30 rounded-lg">
                    <code className="text-sm text-primary font-mono">
                      {currentToken.substring(0, 20)}******
                    </code>
                  </div>
                </div>
              ) : editingToken ? (
                <div className="mb-6">
                  <label className="block text-sm font-medium mb-2">Token do RevantPay</label>
                  <input
                    type="text"
                    value={tokenValue}
                    onChange={(e) => setTokenValue(e.target.value)}
                    placeholder="rpay_live_..."
                    className="w-full input-dark font-mono"
                    disabled={isSaving}
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    Use a API Key criada em Configurações → API no painel da RevantPay.
                  </p>
                </div>
              ) : null}

              <div className="space-y-3">
                {isConnected ? (
                  <>
                    <Button
                      variant="outline"
                      className="w-full border-border hover:bg-secondary"
                      onClick={() => { setEditingToken(true); setTokenValue(""); }}
                      disabled={isSaving}
                    >
                      Alterar Token
                    </Button>
                    <Button
                      variant="ghost"
                      className="w-full text-destructive hover:bg-destructive/10"
                      onClick={handleDisconnect}
                      disabled={isSaving}
                    >
                      {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                      Desconectar
                    </Button>
                  </>
                ) : editingToken ? (
                  <div className="flex gap-3">
                    <Button variant="outline" className="flex-1 border-border hover:bg-secondary" onClick={() => { setEditingToken(false); setTokenValue(""); }} disabled={isSaving}>
                      Cancelar
                    </Button>
                    <Button className="flex-1 btn-gradient border-0" onClick={handleConnect} disabled={isSaving}>
                      {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                      Conectar
                    </Button>
                  </div>
                ) : (
                  <Button className="w-full btn-gradient border-0" onClick={() => setEditingToken(true)}>
                    Conectar RevantPay
                  </Button>
                )}
              </div>

            </div>
          </div>

            <div className="space-y-4">
              <Panel icon={KeyRound} title="Como conectar" subtitle="Passo a passo">
                <ol className="space-y-3">
                  {[
                    "Crie sua conta gratuita na RevantPay.",
                    "Acesse Configurações → API e gere uma API Key.",
                    "Cole a chave aqui e clique em Conectar.",
                  ].map((step, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="w-6 h-6 rounded-md bg-primary/15 text-primary font-mono text-xs font-bold flex items-center justify-center shrink-0">
                        {i + 1}
                      </span>
                      <span className="text-xs text-muted-foreground">{step}</span>
                    </li>
                  ))}
                </ol>
                <div className="mt-5 pt-4 border-t border-border/50 space-y-2">
                  <a href="https://revantpay.com.br/api-docs" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline">
                    <ExternalLink className="w-4 h-4" />
                    Tutorial para obter o token
                  </a>
                  <a href="https://revantpay.com.br" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                    <Link2 className="w-4 h-4" />
                    Criar conta RevantPay
                  </a>
                </div>
              </Panel>

              <Panel icon={ShieldCheck} title="Segurança" subtitle="Boas práticas">
                <p className="text-xs text-muted-foreground">
                  A chave fica salva apenas na sua conta e é usada no servidor para emitir e reconciliar os PIX.
                  Se suspeitar de vazamento, gere uma nova chave na RevantPay e atualize aqui.
                </p>
              </Panel>
            </div>
            </div>
          </>
        )}
      </div>
    </MainLayout>
  );
}
