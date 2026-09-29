import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Bot, Edit3, Trash2, Plus, Share2, Image, Video, Loader2, Save, Zap, X, Link, Calendar, Search, Music, GripVertical, Settings, ShieldCheck, KeyRound, CreditCard, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useBots } from "@/contexts/BotContext";
import { useAuth } from "@/contexts/AuthContext";
import { PlanModal } from "@/components/modals/PlanModal";
import { SchedulePriceModal } from "@/components/modals/SchedulePriceModal";
import { Tables } from "@/integrations/supabase/types";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { PageHeader, Panel, StatCard } from "@/components/ui/stat-kit";

type Plan = Tables<"subscription_plans">;

export default function EditBot() {
  const { selectedBot, refreshBots } = useBots();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSettingUpWebhook, setIsSettingUpWebhook] = useState(false);
  const [webhookActive, setWebhookActive] = useState(false);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [schedulePricePlan, setSchedulePricePlan] = useState<Plan | null>(null);

  // Form state
  const [antiClone, setAntiClone] = useState(false);
  const [initialMessage, setInitialMessage] = useState("");
  const [vipId, setVipId] = useState("");
  const [vipLink, setVipLink] = useState("");
  const [registroId, setRegistroId] = useState("");
  const [supportContact, setSupportContact] = useState("");
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<string | null>(null);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [welcomeCardEnabled, setWelcomeCardEnabled] = useState(false);
  const [welcomeCardText, setWelcomeCardText] = useState("");
  const [initialButtons, setInitialButtons] = useState<Array<{ text: string; url: string; style?: string }>>([]);

  useEffect(() => {
    if (selectedBot) {
      setAntiClone(selectedBot.anti_clone || false);
      setInitialMessage(selectedBot.initial_message || "");
      setVipId(selectedBot.vip_id || "");
      setVipLink(selectedBot.vip_link || "");
      setRegistroId(selectedBot.registro_id || "");
      setSupportContact(selectedBot.support_contact || "");
      setMediaUrl(selectedBot.initial_media_url || null);
      setMediaType(selectedBot.initial_media_type || null);
      setWelcomeCardEnabled(selectedBot.welcome_card_enabled || false);
      setWelcomeCardText(selectedBot.welcome_card_text || "");
      setInitialButtons((selectedBot.initial_buttons as Array<{ text: string; url: string; style?: string }>) || []);
      setInitialButtons((selectedBot.initial_buttons as Array<{ text: string; url: string; style?: string }>) || []);
      fetchPlans();
      checkWebhookStatus();
    }
  }, [selectedBot]);

  const checkWebhookStatus = async () => {
    if (!selectedBot) return;
    try {
      const response = await fetch(`https://api.telegram.org/bot${selectedBot.token}/getWebhookInfo`);
      const data = await response.json();
      setWebhookActive(data.result?.url?.includes('telegram-webhook'));
    } catch (error) {
      console.error('Error checking webhook:', error);
    }
  };

  const fetchPlans = async () => {
    if (!selectedBot) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("subscription_plans")
        .select("*")
        .eq("bot_id", selectedBot.id)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });

      if (error) throw error;
      setPlans(data || []);
    } catch (error) {
      console.error("Error fetching plans:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetupWebhook = async () => {
    if (!selectedBot) return;

    setIsSettingUpWebhook(true);
    try {
      const { data, error } = await supabase.functions.invoke('setup-webhook', {
        body: { botToken: selectedBot.token, action: 'set' }
      });

      if (error) throw error;

      if (data.ok) {
        setWebhookActive(true);
        toast({
          title: "Webhook ativado!",
          description: "Seu bot agora responde ao /start automaticamente.",
        });
      } else {
        throw new Error(data.description || 'Failed to set webhook');
      }
    } catch (error) {
      console.error("Error setting up webhook:", error);
      toast({
        title: "Erro ao ativar webhook",
        description: "Tente novamente mais tarde.",
        variant: "destructive",
      });
    } finally {
      setIsSettingUpWebhook(false);
    }
  };

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (/\.(avif|heic|heif|tiff)$/i.test(file.name)) {
      toast({ title: 'Formato não suportado', description: 'O Telegram não aceita AVIF/HEIC/TIFF. Use JPG, PNG ou MP4.', variant: 'destructive' });
      e.target.value = '';
      return;
    }

    const isVideo = file.type.startsWith('video/');
    const isImage = file.type.startsWith('image/');
    const isAudio = file.type.startsWith('audio/') || file.name.endsWith('.ogg') || file.name.endsWith('.mp3');
    
    if (!isVideo && !isImage && !isAudio) {
      toast({
        title: "Arquivo inválido",
        description: "Envie apenas imagens, vídeos ou áudios.",
        variant: "destructive",
      });
      return;
    }

    // Check file size (max 20MB)
    if (file.size > 20 * 1024 * 1024) {
      toast({
        title: "Arquivo muito grande",
        description: "O tamanho máximo é 20MB.",
        variant: "destructive",
      });
      return;
    }

    setIsUploadingMedia(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${selectedBot?.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('bot-media')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('bot-media')
        .getPublicUrl(fileName);

      setMediaUrl(publicUrl);
      setMediaType(isVideo ? 'video' : isAudio ? 'audio' : 'photo');

      toast({
        title: "Mídia enviada",
        description: "A mídia foi carregada com sucesso.",
      });
    } catch (error) {
      console.error("Error uploading media:", error);
      toast({
        title: "Erro ao enviar",
        description: "Ocorreu um erro ao enviar a mídia.",
        variant: "destructive",
      });
    } finally {
      setIsUploadingMedia(false);
    }
  };

  const handleRemoveMedia = () => {
    setMediaUrl(null);
    setMediaType(null);
  };

  const handleSave = async () => {
    if (!selectedBot) return;

    if (!vipId.trim()) {
      toast({ title: "ID VIP obrigatório", description: "Preencha o ID do canal/grupo VIP.", variant: "destructive" });
      return;
    }
    if (!registroId.trim()) {
      toast({ title: "ID Registro obrigatório", description: "Preencha o ID de notificações de vendas.", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("bots")
        .update({
          anti_clone: antiClone,
          initial_message: initialMessage,
          vip_id: vipId,
          registro_id: registroId,
          support_contact: supportContact,
          vip_link: vipLink || null,
          initial_media_url: mediaUrl,
          initial_media_type: mediaType,
          welcome_card_enabled: welcomeCardEnabled,
          welcome_card_text: welcomeCardText,
          initial_buttons: initialButtons.filter(b => b.text.trim() && b.url.trim()),
        } as any)
        .eq("id", selectedBot.id);

      if (error) throw error;

      await refreshBots();

      toast({
        title: "Configurações salvas",
        description: "As alterações foram aplicadas com sucesso.",
      });
    } catch (error) {
      console.error("Error saving:", error);
      toast({
        title: "Erro ao salvar",
        description: "Ocorreu um erro ao salvar as configurações.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSavePlan = async (planData: any) => {
    if (!selectedBot) return;

    try {
      if (planData.id) {
        const { error } = await supabase
          .from("subscription_plans")
          .update({
            name: planData.name,
            duration: planData.duration,
            duration_days: planData.duration_days,
            price: planData.price,
            is_active: planData.is_active,
            order_bump_enabled: planData.order_bump_enabled,
            order_bump_name: planData.order_bump_name,
            order_bump_description: planData.order_bump_description,
            order_bump_price: planData.order_bump_price,
            order_bump_media_url: planData.order_bump_media_url,
            order_bump_media_type: planData.order_bump_media_type,
            button_style: planData.button_style || null,
            order_bump_title: planData.order_bump_title ?? null,
            order_bump_yes_button_text: planData.order_bump_yes_button_text ?? null,
            order_bump_no_button_text: planData.order_bump_no_button_text ?? null,
            order_bump_button_price_mode: planData.order_bump_button_price_mode ?? 'auto',
            order_bump_button_price_custom: planData.order_bump_button_price_custom ?? null,
          } as any)
          .eq("id", planData.id);

        if (error) throw error;

        toast({
          title: "Plano atualizado",
          description: "O plano foi atualizado com sucesso.",
        });
      } else {
        const maxSort = plans.reduce((m, p: any) => Math.max(m, p.sort_order ?? 0), 0);
        const { error } = await supabase.from("subscription_plans").insert({
          bot_id: selectedBot.id,
          name: planData.name,
          duration: planData.duration,
          duration_days: planData.duration_days,
          price: planData.price,
          is_active: planData.is_active,
          order_bump_enabled: planData.order_bump_enabled,
          order_bump_name: planData.order_bump_name,
          order_bump_description: planData.order_bump_description,
          order_bump_price: planData.order_bump_price,
          order_bump_media_url: planData.order_bump_media_url,
          order_bump_media_type: planData.order_bump_media_type,
          button_style: planData.button_style || null,
          order_bump_title: planData.order_bump_title ?? null,
          order_bump_yes_button_text: planData.order_bump_yes_button_text ?? null,
          order_bump_no_button_text: planData.order_bump_no_button_text ?? null,
          order_bump_button_price_mode: planData.order_bump_button_price_mode ?? 'auto',
          order_bump_button_price_custom: planData.order_bump_button_price_custom ?? null,
          sort_order: maxSort + 1,
        } as any);

        if (error) throw error;

        toast({
          title: "Plano criado",
          description: "O novo plano foi adicionado com sucesso.",
        });
      }

      await fetchPlans();
    } catch (error) {
      console.error("Error saving plan:", error);
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao salvar o plano.",
        variant: "destructive",
      });
    }
  };

  const handleDeletePlan = async (planId: string) => {
    try {
      const { error } = await supabase
        .from("subscription_plans")
        .delete()
        .eq("id", planId);

      if (error) throw error;

      setPlans(plans.filter((p) => p.id !== planId));
      toast({
        title: "Plano removido",
        description: "O plano foi excluído com sucesso.",
      });
    } catch (error) {
      console.error("Error deleting plan:", error);
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao excluir o plano.",
        variant: "destructive",
      });
    }
  };

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handlePlanDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = plans.findIndex((p) => p.id === active.id);
    const newIndex = plans.findIndex((p) => p.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(plans, oldIndex, newIndex);
    // Optimistic update with new sort_order values
    const withSort = reordered.map((p, i) => ({ ...p, sort_order: i + 1 }));
    setPlans(withSort as Plan[]);
    try {
      await Promise.all(
        withSort.map((p, i) =>
          supabase.from("subscription_plans").update({ sort_order: i + 1 } as any).eq("id", p.id)
        )
      );
    } catch (err) {
      console.error("Error reordering plans:", err);
      toast({ title: "Erro ao reordenar", variant: "destructive" });
      fetchPlans();
    }
  };

  const handleDeleteBot = async () => {
    if (!selectedBot) return;

    if (!confirm(`Tem certeza que deseja excluir o bot @${selectedBot.username}? Esta ação não pode ser desfeita.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from("bots")
        .delete()
        .eq("id", selectedBot.id);

      if (error) throw error;

      toast({
        title: "Bot excluído",
        description: "O bot foi removido com sucesso.",
      });

      await refreshBots();
      navigate("/dashboard");
    } catch (error) {
      console.error("Error deleting bot:", error);
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao excluir o bot.",
        variant: "destructive",
      });
    }
  };

  if (!selectedBot) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
          <Bot className="w-16 h-16 text-muted-foreground mb-4" />
          <h2 className="text-xl font-bold mb-2">Nenhum bot selecionado</h2>
          <p className="text-muted-foreground mb-6">
            Crie um bot para começar a gerenciar suas assinaturas
          </p>
          <Button onClick={() => navigate("/criar-bot")} className="btn-gradient">
            <Plus className="w-4 h-4 mr-2" />
            Criar Bot
          </Button>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto">
        <PageHeader
          icon={Bot}
          title="Editar Bot"
          subtitle={`@${selectedBot.username} · ${selectedBot.name}`}
          action={
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="border-border hover:bg-secondary"
                onClick={() => window.open(`https://t.me/${selectedBot.username}`, "_blank")}
              >
                <Share2 className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="border-destructive/50 text-destructive hover:bg-destructive/10"
                onClick={handleDeleteBot}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          }
        />

        {/* Summary status cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard
            icon={Zap}
            label="Status"
            value={webhookActive ? "Ativo" : "Inativo"}
            subValue={webhookActive ? "Respondendo" : "Configure o webhook"}
            color={webhookActive ? "bg-green-500/20 text-green-500" : "bg-yellow-500/20 text-yellow-500"}
            bar={webhookActive ? "bg-green-500" : "bg-yellow-500"}
            progress={webhookActive ? 100 : 30}
          />
          <StatCard
            icon={Bot}
            label="Username"
            value={`@${selectedBot.username}`}
            subValue="Identificação"
            color="bg-primary/20 text-primary"
          />
          <StatCard
            icon={CreditCard}
            label="Planos"
            value={plans.length}
            subValue={plans.length > 0 ? "Configurados" : "Nenhum plano"}
            color="bg-primary/20 text-primary"
            bar={plans.length > 0 ? "bg-primary" : "bg-muted"}
            progress={plans.length > 0 ? 100 : 0}
          />
          <StatCard
            icon={KeyRound}
            label="Entrega VIP"
            value={vipLink.trim() ? "Configurada" : "Pendente"}
            subValue={vipLink.trim() ? "Link definido" : "Falta o link"}
            color={vipLink.trim() ? "bg-green-500/20 text-green-500" : "bg-destructive/20 text-destructive"}
            bar={vipLink.trim() ? "bg-green-500" : "bg-destructive"}
            progress={vipLink.trim() ? 100 : 20}
          />
        </div>

        {/* Webhook Status Card */}
        <Panel
          icon={Zap}
          title="Status do Bot"
          subtitle={webhookActive ? "Ativo" : "Verificação de webhook"}
          className="mb-6"
          action={
            <Button
              onClick={handleSetupWebhook}
              disabled={isSettingUpWebhook}
              className={webhookActive ? "bg-green-600 hover:bg-green-700" : "btn-gradient"}
            >
              {isSettingUpWebhook ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Ativando...
                </>
              ) : webhookActive ? (
                <>
                  <Zap className="w-4 h-4 mr-2" />
                  Reativar
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 mr-2" />
                  Ativar Bot
                </>
              )}
            </Button>
          }
        >
          <p className="text-sm text-muted-foreground">
            {webhookActive ? 'Bot ativo e respondendo mensagens.' : 'Webhook não configurado. Ative para que o bot responda ao /start automaticamente.'}
          </p>
        </Panel>

        {/* Bot Configuration */}
        <Panel icon={Settings} title="Configurações do Bot" subtitle="Mensagem inicial e mídia" className="mb-6">
          <div className="space-y-6">
            {/* Anti-Clone Toggle */}
            <div className="flex items-center justify-between py-3 border-b border-border/50">
              <div>
                <p className="font-medium">Proteção Anti-Clonagem</p>
                <p className="text-sm text-muted-foreground">
                  Impede que seu bot seja copiado
                </p>
              </div>
              <Switch checked={antiClone} onCheckedChange={setAntiClone} />
            </div>

            {/* Username */}
            <div>
              <label className="block text-sm font-medium mb-2">Username</label>
              <input
                type="text"
                value={`@${selectedBot.username}`}
                readOnly
                className="w-full input-dark text-muted-foreground"
              />
            </div>

            {/* Token */}
            <div>
              <label className="block text-sm font-medium mb-2">Token</label>
              <input
                type="text"
                value={selectedBot.token.substring(0, 30) + "******"}
                readOnly
                className="w-full input-dark font-mono text-sm text-muted-foreground"
              />
            </div>

            {/* Media Upload */}
            <div className="rounded-xl border border-border/50 bg-secondary/20 p-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-primary/15 border border-primary/20 flex items-center justify-center">
                    <Image className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium leading-tight">Mídia Inicial</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-[0.16em]">Foto · Vídeo · Áudio</p>
                  </div>
                </div>
                <span className={`text-[10px] px-2 py-1 rounded-full border ${mediaUrl ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : "bg-secondary text-muted-foreground border-border/50"}`}>
                  {mediaUrl ? "Configurada" : "Nenhuma"}
                </span>
              </div>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleMediaUpload}
                accept="image/*,video/*,audio/*,.ogg,.mp3"
                className="hidden"
              />

              {mediaUrl ? (
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-card/60 border border-border/60 min-w-0">
                    {mediaType === 'video' ? <Video className="w-4 h-4 text-primary" /> : mediaType === 'audio' ? <Music className="w-4 h-4 text-primary" /> : <Image className="w-4 h-4 text-primary" />}
                    <span className="text-sm truncate">{mediaType === 'video' ? 'Vídeo' : mediaType === 'audio' ? 'Áudio' : 'Imagem'} configurada</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingMedia}
                    className="border-border"
                  >
                    Trocar
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleRemoveMedia}
                  >
                    <X className="w-4 h-4 mr-1" />
                    Remover
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { icon: Image, label: "Imagem", hint: "JPG · PNG" },
                    { icon: Video, label: "Vídeo", hint: "MP4" },
                    { icon: Music, label: "Áudio", hint: "MP3 · OGG" },
                  ].map((opt) => (
                    <button
                      key={opt.label}
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploadingMedia}
                      className="group flex flex-col items-center justify-center gap-1.5 rounded-lg border border-border/50 bg-card/40 py-4 transition-all hover:border-primary/50 hover:bg-primary/5 disabled:opacity-50"
                    >
                      {isUploadingMedia ? (
                        <Loader2 className="w-5 h-5 animate-spin text-primary" />
                      ) : (
                        <opt.icon className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                      )}
                      <span className="text-xs font-medium">{opt.label}</span>
                      <span className="text-[10px] text-muted-foreground">{opt.hint}</span>
                    </button>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-3">
                Acompanha a mensagem inicial · máximo de 20MB
              </p>
            </div>

            {/* Initial Message */}
            <div>
              <label className="block text-sm font-medium mb-2">Mensagem Inicial</label>
              <textarea
                value={initialMessage}
                onChange={(e) => setInitialMessage(e.target.value)}
                placeholder="Digite a mensagem de boas-vindas do seu bot..."
                className="w-full input-dark min-h-[260px] resize-none"
              />
              <div className="flex justify-between mt-2">
                <p className="text-xs text-muted-foreground">
                  Variáveis: <code className="text-primary">{"{profile_name}"}</code>,{" "}
                  <code className="text-primary">{"{country}"}</code>
                </p>
                <p className="text-xs text-muted-foreground">
                  {initialMessage.length}/4096
                </p>
              </div>
            </div>
          </div>
        </Panel>

        {/* Deliverable / VIP Link - prominent */}
        <Panel
          icon={KeyRound}
          title="Entrega (Acesso VIP)"
          subtitle="Link enviado após o pagamento"
          className={`mb-6 ${vipLink.trim() ? "border-primary/30" : "border-destructive/30"}`}
          action={
            <div
              className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
                vipLink.trim()
                  ? "bg-green-500/15 text-green-500"
                  : "bg-destructive/15 text-destructive"
              }`}
            >
              {vipLink.trim() ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Configurada
                </>
              ) : (
                <>
                  <AlertCircle className="w-3.5 h-3.5" />
                  Pendente
                </>
              )}
            </div>
          }
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Link de convite do Telegram</label>
              <input
                type="text"
                value={vipLink}
                onChange={(e) => setVipLink(e.target.value)}
                placeholder="https://t.me/+AbCdEfGhIjK ou https://t.me/joinchat/..."
                className="w-full input-dark font-mono"
              />
              <p className="text-xs text-muted-foreground mt-2">
                Cole aqui o link de convite completo do grupo/canal VIP. Ele será enviado automaticamente
                ao cliente assim que o pagamento for confirmado.
              </p>
            </div>
          </div>
        </Panel>

        {/* VIP IDs */}
        <Panel icon={ShieldCheck} title="IDs de Configuração" subtitle="Canais e notificações" className="mb-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium mb-2">ID VIP <span className="text-destructive">*</span></label>
              <input
                type="text"
                value={vipId}
                onChange={(e) => setVipId(e.target.value)}
                placeholder="-1003171601776"
                className="w-full input-dark font-mono"
                required
              />
              <div className="flex items-center gap-2 mt-2">
                <p className="text-xs text-muted-foreground flex-1">
                  ID do canal/grupo VIP (obrigatório)
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs border-border"
                  disabled={!vipId.trim() || !selectedBot?.token}
                  onClick={async () => {
                    try {
                      const res = await fetch(`https://api.telegram.org/bot${selectedBot?.token}/getChat`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ chat_id: vipId.trim() }),
                      });
                      const data = await res.json();
                      if (data.ok) {
                        toast({ title: "✅ VIP encontrado!", description: `${data.result.type}: ${data.result.title || data.result.username || vipId}` });
                      } else {
                        toast({ title: "❌ VIP não encontrado", description: data.description || "Verifique o ID e se o bot é admin do grupo/canal.", variant: "destructive" });
                      }
                    } catch {
                      toast({ title: "Erro ao testar", description: "Falha na conexão.", variant: "destructive" });
                    }
                  }}
                >
                  <Search className="w-3 h-3 mr-1" />
                  Testar
                </Button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">ID Registro <span className="text-destructive">*</span></label>
              <input
                type="text"
                value={registroId}
                onChange={(e) => setRegistroId(e.target.value)}
                placeholder="-1002457158346"
                className="w-full input-dark font-mono"
                required
              />
              <div className="flex items-center gap-2 mt-2">
                <p className="text-xs text-muted-foreground flex-1">
                  ID para notificações de vendas (obrigatório)
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs border-border"
                  disabled={!registroId.trim() || !selectedBot?.token}
                  onClick={async () => {
                    try {
                      const res = await fetch(`https://api.telegram.org/bot${selectedBot?.token}/getChat`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ chat_id: registroId.trim() }),
                      });
                      const data = await res.json();
                      if (data.ok) {
                        toast({ title: "✅ Registro encontrado!", description: `${data.result.type}: ${data.result.title || data.result.username || registroId}` });
                      } else {
                        toast({ title: "❌ Registro não encontrado", description: data.description || "Verifique o ID e se o bot é admin do grupo/canal.", variant: "destructive" });
                      }
                    } catch {
                      toast({ title: "Erro ao testar", description: "Falha na conexão.", variant: "destructive" });
                    }
                  }}
                >
                  <Search className="w-3 h-3 mr-1" />
                  Testar
                </Button>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <label className="block text-sm font-medium mb-2">Suporte (opcional)</label>
            <input
              type="text"
              value={supportContact}
              onChange={(e) => setSupportContact(e.target.value)}
              placeholder="@seu_suporte ou link"
              className="w-full input-dark"
            />
          </div>
        </Panel>


        {/* Subscription Plans */}
        <Panel
          icon={CreditCard}
          title="Planos de Assinatura"
          subtitle={`${plans.length} plano(s) configurado(s)`}
          className="mb-6"
          action={
            <Button
              variant="outline"
              size="sm"
              className="border-border hover:bg-secondary"
              onClick={() => {
                setEditingPlan(null);
                setShowPlanModal(true);
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Adicionar
            </Button>
          }
        >
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : plans.length > 0 ? (
            <div className="space-y-2">
              <div className="grid grid-cols-[auto,1fr,auto,auto,auto] gap-3 px-3 pb-2 border-b border-border/50 text-xs font-medium text-muted-foreground">
                <span className="w-5" />
                <span>Nome</span>
                <span>Duração</span>
                <span className="text-right">Valor</span>
                <span className="text-right pr-1">Ações</span>
              </div>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handlePlanDragEnd}>
                <SortableContext items={plans.map((p) => p.id)} strategy={verticalListSortingStrategy}>
                  {plans.map((plan) => (
                    <SortablePlanRow
                      key={plan.id}
                      plan={plan}
                      onEdit={() => { setEditingPlan(plan); setShowPlanModal(true); }}
                      onDelete={() => handleDeletePlan(plan.id)}
                      onSchedule={() => setSchedulePricePlan(plan)}
                    />
                  ))}
                </SortableContext>
              </DndContext>
              <p className="text-xs text-muted-foreground pt-2">
                Arraste pelo ícone <GripVertical className="w-3 h-3 inline" /> para reordenar os planos.
              </p>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p>Nenhum plano cadastrado</p>
              <p className="text-sm">Adicione planos para seus assinantes</p>
            </div>
          )}
        </Panel>

        {/* URL Buttons */}
        <Panel
          icon={Link}
          title="Botões de URL"
          subtitle="Adicione links externos na mensagem inicial"
          className="mb-6"
          action={
            <Button
              variant="outline"
              size="sm"
              className="border-border hover:bg-secondary"
              onClick={() => setInitialButtons([...initialButtons, { text: "", url: "" }])}
            >
              <Plus className="w-4 h-4 mr-2" />
              Adicionar
            </Button>
          }
        >
          {initialButtons.length > 0 ? (
            <div className="space-y-3">
              {initialButtons.map((btn, index) => (
                <div key={index} className="flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-secondary/20">
                  <div className="flex-1 space-y-2">
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="text"
                        value={btn.text}
                        onChange={(e) => {
                          const updated = [...initialButtons];
                          updated[index] = { ...updated[index], text: e.target.value };
                          setInitialButtons(updated);
                        }}
                        placeholder="Texto do botão"
                        className="w-full input-dark text-sm"
                      />
                      <input
                        type="url"
                        value={btn.url}
                        onChange={(e) => {
                          const updated = [...initialButtons];
                          updated[index] = { ...updated[index], url: e.target.value };
                          setInitialButtons(updated);
                        }}
                        placeholder="https://exemplo.com"
                        className="w-full input-dark text-sm font-mono"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground shrink-0">Cor:</span>
                      {[
                        { value: undefined, label: "Padrão", cls: "bg-muted" },
                        { value: "primary", label: "Azul", cls: "bg-blue-500" },
                        { value: "success", label: "Verde", cls: "bg-green-500" },
                        { value: "danger", label: "Vermelho", cls: "bg-red-500" },
                      ].map((opt) => (
                        <button
                          key={opt.label}
                          type="button"
                          onClick={() => {
                            const updated = [...initialButtons];
                            updated[index] = { ...updated[index], style: opt.value };
                            setInitialButtons(updated);
                          }}
                          className={`w-6 h-6 rounded-md ${opt.cls} border-2 transition-all ${
                            (btn.style || undefined) === opt.value
                              ? "border-primary ring-1 ring-primary"
                              : "border-transparent"
                          }`}
                          title={opt.label}
                        />
                      ))}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:bg-destructive/10 shrink-0"
                    onClick={() => setInitialButtons(initialButtons.filter((_, i) => i !== index))}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">
                Os botões de URL aparecerão abaixo dos botões de plano na mensagem inicial do bot.
              </p>
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground">
              <p>Nenhum botão de URL</p>
              <p className="text-sm">Adicione botões com links para a mensagem inicial</p>
            </div>
          )}
        </Panel>

        {/* Save Button */}
        <div className="flex justify-end animate-fade-in" style={{ animationDelay: "0.4s" }}>
          <Button onClick={handleSave} disabled={isSaving} className="btn-gradient px-8">
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Salvar Alterações
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Plan Modal */}
      <PlanModal
        isOpen={showPlanModal}
        onClose={() => {
          setShowPlanModal(false);
          setEditingPlan(null);
        }}
        onSave={handleSavePlan}
        plan={editingPlan}
      />

      {/* Schedule Price Modal */}
      {schedulePricePlan && selectedBot && (
        <SchedulePriceModal
          isOpen={!!schedulePricePlan}
          onClose={() => setSchedulePricePlan(null)}
          planId={schedulePricePlan.id}
          targetType="plan"
          targetName={schedulePricePlan.name}
          currentPrice={Number(schedulePricePlan.price)}
          botId={selectedBot.id}
          onSaved={fetchPlans}
        />
      )}
    </MainLayout>
  );
}

function SortablePlanRow({
  plan,
  onEdit,
  onDelete,
  onSchedule,
}: {
  plan: Plan;
  onEdit: () => void;
  onDelete: () => void;
  onSchedule: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: plan.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="grid grid-cols-[auto,1fr,auto,auto,auto] items-center gap-3 px-3 py-3 rounded-lg border border-border/30 bg-secondary/20 hover:bg-secondary/40 transition-colors"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing touch-none text-muted-foreground hover:text-foreground"
        title="Arraste para reordenar"
      >
        <GripVertical className="w-4 h-4" />
      </button>
      <div className="flex items-center gap-2 min-w-0">
        {plan.button_style && (
          <span
            className={`w-3 h-3 rounded-full shrink-0 ${
              plan.button_style === "primary"
                ? "bg-blue-500"
                : plan.button_style === "success"
                ? "bg-green-500"
                : plan.button_style === "danger"
                ? "bg-red-500"
                : ""
            }`}
          />
        )}
        <span className="font-medium truncate">{plan.name}</span>
      </div>
      <span className="text-sm text-muted-foreground capitalize">{plan.duration}</span>
      <span className="font-mono text-primary text-right">R$ {Number(plan.price).toFixed(2)}</span>
      <div className="flex items-center justify-end">
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-primary"
          title="Agendar preço"
          onClick={onSchedule}
        >
          <Calendar className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-foreground"
          onClick={onEdit}
        >
          <Edit3 className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="text-destructive hover:bg-destructive/10"
          onClick={onDelete}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
