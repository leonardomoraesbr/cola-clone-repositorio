import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { useBots } from "@/contexts/BotContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { PageHeader, StatCard, Panel } from "@/components/ui/stat-kit";
import { Bot, Loader2, Save, ShieldCheck, UserCheck, Plus, Hash, MessageSquare, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function AutoApproval() {
  const { selectedBot, refreshBots } = useBots();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [autoApproveEnabled, setAutoApproveEnabled] = useState(false);
  const [autoApproveChannelId, setAutoApproveChannelId] = useState("");
  const [autoApproveWelcomeMessage, setAutoApproveWelcomeMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (selectedBot) {
      setAutoApproveEnabled(selectedBot.auto_approve_enabled || false);
      setAutoApproveChannelId(selectedBot.auto_approve_channel_id || "");
      setAutoApproveWelcomeMessage(selectedBot.auto_approve_welcome_message || "");
    }
  }, [selectedBot]);

  const handleSave = async () => {
    if (!selectedBot) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("bots")
        .update({
          auto_approve_enabled: autoApproveEnabled,
          auto_approve_channel_id: autoApproveChannelId || null,
          auto_approve_welcome_message: autoApproveWelcomeMessage || null,
        } as any)
        .eq("id", selectedBot.id);

      if (error) throw error;
      await refreshBots();
      toast({ title: "Salvo!", description: "Configurações de aprovação automática atualizadas." });
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  if (!selectedBot) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
          <Bot className="w-16 h-16 text-muted-foreground mb-4" />
          <h2 className="text-xl font-bold mb-2">Nenhum bot selecionado</h2>
          <p className="text-muted-foreground mb-6">Crie um bot para configurar a aprovação automática</p>
          <Button onClick={() => navigate("/criar-bot")} className="btn-gradient">
            <Plus className="w-4 h-4 mr-2" /> Criar Bot
          </Button>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-2xl mx-auto">
        <PageHeader
          icon={UserCheck}
          title="Aprovação Automática"
          subtitle="Aprove membros automaticamente em grupos/canais"
        />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <StatCard
            icon={ShieldCheck}
            label="Status da automação"
            value={autoApproveEnabled ? "Ativo" : "Inativo"}
            color={autoApproveEnabled ? "bg-green-500/20 text-green-400" : "bg-secondary text-muted-foreground"}
            bar={autoApproveEnabled ? "bg-green-400" : "bg-muted-foreground"}
            progress={autoApproveEnabled ? 100 : 0}
          />
          <StatCard
            icon={Hash}
            label="Canal configurado"
            value={autoApproveChannelId ? "Sim" : "Não"}
            subValue={autoApproveChannelId || "Nenhum ID definido"}
            color={autoApproveChannelId ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground"}
            bar={autoApproveChannelId ? "bg-primary" : "bg-muted-foreground"}
            progress={autoApproveChannelId ? 100 : 0}
          />
          <StatCard
            icon={MessageSquare}
            label="Mensagem de boas-vindas"
            value={autoApproveWelcomeMessage ? "Configurada" : "Não definida"}
            color={autoApproveWelcomeMessage ? "bg-teal-500/20 text-teal-400" : "bg-secondary text-muted-foreground"}
            bar={autoApproveWelcomeMessage ? "bg-teal-400" : "bg-muted-foreground"}
            progress={autoApproveWelcomeMessage ? 100 : 0}
          />
        </div>

        <Panel
          icon={ShieldCheck}
          title="Aprovação Automática de Membros"
          subtitle="Configuração"
          action={<Switch checked={autoApproveEnabled} onCheckedChange={setAutoApproveEnabled} />}
          className="mb-6"
        >
          <p className="text-sm text-muted-foreground mb-4">
            Quando ativado, o bot aprovará automaticamente a entrada de novos membros no grupo/canal configurado.
          </p>
          {autoApproveEnabled && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">ID do Grupo/Canal</label>
                <input
                  type="text"
                  value={autoApproveChannelId}
                  onChange={(e) => setAutoApproveChannelId(e.target.value)}
                  placeholder="-1001234567890"
                  className="w-full input-dark font-mono"
                />
                <div className="mt-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm flex gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-amber-400 font-medium">Importante:</p>
                    <p className="text-muted-foreground mt-1">
                      Antes de preencher o campo do <strong>ID</strong>, certifique-se de que o seu bot{" "}
                      <strong>@{selectedBot.username}</strong> já foi adicionado como administrador no canal/grupo com todas as permissões!
                    </p>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Mensagem de Boas-Vindas (opcional)</label>
                <textarea
                  value={autoApproveWelcomeMessage}
                  onChange={(e) => setAutoApproveWelcomeMessage(e.target.value)}
                  placeholder="Olá, bem-vindo(a) ao canal!"
                  className="w-full input-dark min-h-[100px] resize-none"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Esta mensagem será enviada no privado do membro quando ele for aprovado automaticamente.
                </p>
              </div>
            </div>
          )}
        </Panel>

        <div className="flex justify-end animate-fade-in">
          <Button onClick={handleSave} disabled={isSaving} className="btn-gradient px-8">
            {isSaving ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Salvando...</>
            ) : (
              <><Save className="w-4 h-4 mr-2" /> Salvar Configurações</>
            )}
          </Button>
        </div>
      </div>
    </MainLayout>
  );
}
