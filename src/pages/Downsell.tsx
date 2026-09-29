import { useState, useEffect, useRef } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { TrendingDown, Plus, Trash2, MessageCircle, Clock, Percent, Users, Save, Loader2, Zap, Image as ImageIcon, Video, Music, X, Loader } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useBots } from "@/contexts/BotContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, HeroCard, SectionTitle } from "@/components/ui/stat-kit";

interface DownsellMessage {
  id: string;
  message: string;
  send_time_minutes: number;
  discount_percentage: number;
  target_audience: string;
  is_active: boolean;
  order_index: number;
  media_url: string | null;
  media_type: string | null;
}

const timeOptions = [
  { label: "2 minutos", value: 2 },
  { label: "5 minutos", value: 5 },
  { label: "10 minutos", value: 10 },
  { label: "15 minutos", value: 15 },
  { label: "30 minutos", value: 30 },
  { label: "45 minutos", value: 45 },
  { label: "1 hora", value: 60 },
  { label: "2 horas", value: 120 },
  { label: "3 horas", value: 180 },
  { label: "6 horas", value: 360 },
  { label: "12 horas", value: 720 },
  { label: "24 horas", value: 1440 },
  { label: "Personalizado (min)", value: -1 },
];

const discountOptions = [0, 5, 10, 15, 20, 25, 30, 35, 40, 50, 60, 70];

const audienceOptions = [
  { label: "Pendentes - geraram PIX e não pagaram", value: "pending" },
  { label: "Expirados - assinatura venceu e não renovaram", value: "expired" },
  { label: "Todos os leads que interagiram", value: "all_leads" },
  { label: "Nunca compraram nada", value: "never_bought" },
];

const defaultDownsellMessages = (): DownsellMessage[] => [
  {
    id: 'new_1',
    message: "🎁 ÚLTIMA CHANCE!\n\nConsiga acesso VIP com 15% DE DESCONTO\n\n⏰ Oferta expira em 5 minutos!",
    send_time_minutes: 5,
    discount_percentage: 15,
    target_audience: "all",
    is_active: true,
    order_index: 0,
    media_url: null,
    media_type: null,
  },
  {
    id: 'new_2',
    message: "🔥 OFERTA IMPERDÍVEL!\n\nAcesse o VIP com 25% DE DESCONTO\n\n⏰ Últimos minutos para aproveitar!",
    send_time_minutes: 15,
    discount_percentage: 25,
    target_audience: "all",
    is_active: true,
    order_index: 1,
    media_url: null,
    media_type: null,
  },
];

const mapDownsellMessage = (message: {
  id: string;
  message: string;
  send_time_minutes: number;
  discount_percentage: number;
  target_audience: string | null;
  is_active: boolean | null;
  order_index: number;
  media_url?: string | null;
  media_type?: string | null;
}): DownsellMessage => ({
  id: message.id,
  message: message.message,
  send_time_minutes: message.send_time_minutes,
  discount_percentage: message.discount_percentage,
  target_audience: message.target_audience || 'all',
  is_active: message.is_active ?? true,
  order_index: message.order_index,
  media_url: message.media_url ?? null,
  media_type: message.media_type ?? null,
});

export default function Downsell() {
  const [isActive, setIsActive] = useState(false);
  const [messages, setMessages] = useState<DownsellMessage[]>([]);
  const [customTimeIds, setCustomTimeIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingActive, setUpdatingActive] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const { toast } = useToast();
  const { selectedBot } = useBots();
  const { user } = useAuth();
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    async function fetchMessages() {
      if (!selectedBot) {
        setMessages([]);
        setIsActive(false);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('downsell_messages')
          .select('*')
          .eq('bot_id', selectedBot.id)
          .order('order_index', { ascending: true });

        if (error) throw error;

        if (data && data.length > 0) {
          setMessages(data.map(mapDownsellMessage));
          setIsActive(data.some(m => m.is_active));
        } else {
          setMessages(defaultDownsellMessages());
          setIsActive(false);
        }
      } catch (error) {
        console.error('Error fetching downsell messages:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchMessages();
  }, [selectedBot]);

  const persistMessages = async (nextActive: boolean, sourceMessages: DownsellMessage[]) => {
    if (!selectedBot) {
      throw new Error("Selecione um bot antes de salvar o downsell.");
    }

    const valid = sourceMessages.filter(m => m.message.trim().length > 0);
    if (valid.length === 0) {
      throw new Error("Escreva pelo menos uma mensagem de downsell antes de salvar.");
    }

    const { data: existing, error: fetchErr } = await supabase
      .from('downsell_messages')
      .select('id')
      .eq('bot_id', selectedBot.id);
    if (fetchErr) throw fetchErr;

    const keepIds = new Set(valid.filter(m => !m.id.startsWith('new_')).map(m => m.id));
    const toDelete = (existing || []).map(r => r.id).filter(id => !keepIds.has(id));

    const toPayload = (m: DownsellMessage, orderIndex: number) => ({
      bot_id: selectedBot.id,
      message: m.message,
      send_time_minutes: m.send_time_minutes,
      discount_percentage: m.discount_percentage,
      target_audience: m.target_audience,
      is_active: nextActive,
      order_index: orderIndex,
      media_url: m.media_url,
      media_type: m.media_type,
    });

    const updates = valid.flatMap((m, idx) => (
      m.id.startsWith('new_') ? [] : [{ id: m.id, ...toPayload(m, idx) }]
    ));

    const inserts = valid.flatMap((m, idx) => (
      m.id.startsWith('new_') ? [toPayload(m, idx)] : []
    ));

    if (updates.length > 0) {
      const { error: upErr } = await supabase
        .from('downsell_messages')
        .upsert(updates, { onConflict: 'id' });
      if (upErr) throw upErr;
    }

    if (inserts.length > 0) {
      const { error: insErr } = await supabase.from('downsell_messages').insert(inserts);
      if (insErr) throw insErr;
    }

    if (toDelete.length > 0) {
      const { error: delErr } = await supabase.from('downsell_messages').delete().in('id', toDelete);
      if (delErr) throw delErr;
    }

    const { data: refreshed, error: refreshErr } = await supabase
      .from('downsell_messages')
      .select('*')
      .eq('bot_id', selectedBot.id)
      .order('order_index', { ascending: true });
    if (refreshErr) throw refreshErr;

    const refreshedMessages = (refreshed || []).map(mapDownsellMessage);
    setMessages(refreshedMessages);
    setIsActive(refreshedMessages.some(m => m.is_active));
  };

  const handleAddMessage = () => {
    const newMessage: DownsellMessage = {
      id: `new_${Date.now()}`,
      message: "",
      send_time_minutes: 5,
      discount_percentage: 10,
      target_audience: "all",
      is_active: true,
      order_index: messages.length,
      media_url: null,
      media_type: null,
    };
    setMessages([...messages, newMessage]);
  };

  const handleUpdateMessage = (id: string, field: keyof DownsellMessage, value: any) => {
    setMessages(
      messages.map((msg) =>
        msg.id === id ? { ...msg, [field]: value } : msg
      )
    );
  };

  const handleMediaUpload = async (msgId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (/\.(avif|heic|heif|tiff)$/i.test(file.name)) {
      toast({ title: 'Formato não suportado', description: 'O Telegram não aceita AVIF/HEIC/TIFF. Use JPG, PNG ou MP4.', variant: 'destructive' });
      e.target.value = '';
      return;
    }
    if (!user || !selectedBot) {
      toast({ title: "Selecione um bot antes de enviar mídia", variant: "destructive" });
      return;
    }
    const isVideo = file.type.startsWith("video/");
    const isImage = file.type.startsWith("image/");
    const isAudio = file.type.startsWith("audio/");
    if (!isVideo && !isImage && !isAudio) {
      toast({ title: "Arquivo inválido", description: "Envie uma imagem, vídeo ou áudio.", variant: "destructive" });
      return;
    }
    const maxBytes = isVideo ? 50 * 1024 * 1024 : 25 * 1024 * 1024;
    if (file.size > maxBytes) {
      const limitMb = isVideo ? 50 : 25;
      toast({
        title: `Arquivo muito grande (máx ${limitMb}MB)`,
        description: `Seu arquivo tem ${(file.size / 1024 / 1024).toFixed(1)}MB.`,
        variant: "destructive",
      });
      return;
    }
    setUploadingId(msgId);
    try {
      const ext = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
      const path = `${user.id}/${selectedBot.id}/downsell/${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("bot-media")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from("bot-media").getPublicUrl(path);
      const mediaType = isVideo ? "video" : isAudio ? "audio" : "photo";
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId ? { ...m, media_url: publicUrl, media_type: mediaType } : m,
        ),
      );
      toast({ title: "Mídia adicionada", description: "Salve para aplicar as mudanças." });
    } catch (err: any) {
      console.error("[Downsell] upload error:", err);
      toast({
        title: "Erro ao enviar mídia",
        description: err?.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setUploadingId(null);
      if (e.target) e.target.value = "";
    }
  };

  const handleDeleteMessage = async (id: string) => {
    // If it's a saved message (not starting with new_), delete from DB
    if (!id.startsWith('new_')) {
      try {
        await supabase.from('downsell_messages').delete().eq('id', id);
      } catch (error) {
        console.error('Error deleting message:', error);
      }
    }
    
    setMessages(messages.filter((msg) => msg.id !== id));
    toast({
      title: "Mensagem removida",
      description: "A mensagem de downsell foi excluída.",
    });
  };

  const handleActiveChange = async (checked: boolean) => {
    if (!selectedBot || saving || updatingActive) return;

    const previousActive = isActive;
    const previousMessages = messages;
    const messagesToPersist = messages.length > 0 ? messages : defaultDownsellMessages();

    setIsActive(checked);
    setMessages(messagesToPersist.map(msg => ({ ...msg, is_active: checked })));
    setUpdatingActive(true);

    try {
      await persistMessages(checked, messagesToPersist);
      toast({
        title: checked ? "Downsell ativado" : "Downsell desativado",
        description: checked
          ? "As mensagens automáticas foram ativadas e continuam ativas após recarregar."
          : "As mensagens automáticas foram pausadas.",
      });
    } catch (error) {
      setIsActive(previousActive);
      setMessages(previousMessages);
      console.error('Error updating downsell active state:', error);
      toast({
        title: "Erro ao atualizar downsell",
        description: error instanceof Error ? error.message : "Não foi possível salvar o status do downsell.",
        variant: "destructive",
      });
    } finally {
      setUpdatingActive(false);
    }
  };

  const handleSave = async () => {
    if (!selectedBot) return;

    setSaving(true);
    try {
      await persistMessages(isActive, messages);

      toast({
        title: "Configurações salvas!",
        description: "As mensagens de downsell foram atualizadas com sucesso.",
      });
    } catch (error) {
      console.error('Error saving downsell messages:', error);
      toast({
        title: "Erro ao salvar",
        description: error instanceof Error ? error.message : "Não foi possível salvar as configurações.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (!selectedBot) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-center glass-card p-12">
            <TrendingDown className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2">Nenhum bot selecionado</h2>
            <p className="text-muted-foreground">Selecione um bot para configurar o downsell</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-5xl mx-auto">
        <PageHeader
          icon={TrendingDown}
          title="Downsell"
          subtitle={`Recuperação de carrinho · @${selectedBot.username}`}
          gradient="from-orange-500 to-amber-500"
        />

        <SectionTitle hint="Mensagens automáticas para quem não concluiu a compra, com descontos progressivos conforme o tempo configurado.">
          Visão geral
        </SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <HeroCard icon={MessageCircle} label="Mensagens" value={messages.length} color="bg-orange-500/10 text-orange-400" />
          <HeroCard
            icon={Percent}
            label="Maior desconto"
            value={`${messages.reduce((m, x) => Math.max(m, x.discount_percentage), 0)}%`}
            color="bg-amber-500/10 text-amber-400"
          />
          <HeroCard
            icon={Clock}
            label="Primeiro envio"
            value={messages.length ? `${Math.min(...messages.map(m => m.send_time_minutes))} min` : "—"}
            color="bg-primary/10 text-primary"
            valueClass="text-primary"
          />
        </div>

        {/* Toggle */}
        <div className="glass-card p-6 mb-6 animate-fade-in" style={{ animationDelay: "0.15s" }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${
                isActive ? 'bg-emerald-500/20' : 'bg-secondary'
              }`}>
                <Zap className={`w-6 h-6 ${isActive ? 'text-emerald-400' : 'text-muted-foreground'}`} />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Downsell {isActive ? 'Ativo' : 'Inativo'}</h2>
                <p className="text-sm text-muted-foreground">
                  {isActive ? 'Ofertas sendo enviadas automaticamente' : 'Ative para enviar ofertas automáticas'}
                </p>
              </div>
            </div>
            <Switch 
              checked={isActive} 
              onCheckedChange={handleActiveChange}
              disabled={saving || updatingActive}
              className="data-[state=checked]:bg-emerald-500"
            />
          </div>
        </div>

        {/* Messages */}
        <div className="space-y-5">
          {messages.map((msg, index) => (
            <div
              key={msg.id}
              className="glass-card p-6 animate-fade-in hover:border-primary/30 transition-all duration-300"
              style={{ animationDelay: `${0.2 + index * 0.05}s` }}
            >
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                    <MessageCircle className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Mensagem {index + 1}</h3>
                    <p className="text-xs text-muted-foreground">
                      Enviada após {timeOptions.find(t => t.value === msg.send_time_minutes)?.label}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:bg-destructive/10"
                  onClick={() => handleDeleteMessage(msg.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>

              {/* Message Content */}
              <div className="mb-5">
                <textarea
                  value={msg.message}
                  onChange={(e) => handleUpdateMessage(msg.id, "message", e.target.value)}
                  placeholder="Digite a mensagem de oferta..."
                  className="w-full bg-secondary/50 border border-border/50 rounded-xl p-4 min-h-[120px] resize-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all"
                />
                <p className="text-xs text-muted-foreground mt-2 text-right">
                  {msg.message.length}/4096 caracteres
                </p>
              </div>

              {/* Options Grid */}
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium mb-2 text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    Tempo de Envio
                  </label>
                  <select
                    value={
                      customTimeIds.has(msg.id) || !timeOptions.slice(0, -1).some(t => t.value === msg.send_time_minutes)
                        ? -1
                        : msg.send_time_minutes
                    }
                    onChange={(e) => {
                      const v = parseInt(e.target.value);
                      if (v === -1) {
                        setCustomTimeIds(prev => new Set(prev).add(msg.id));
                      } else {
                        setCustomTimeIds(prev => {
                          const n = new Set(prev);
                          n.delete(msg.id);
                          return n;
                        });
                        handleUpdateMessage(msg.id, "send_time_minutes", v);
                      }
                    }}
                    className="w-full bg-secondary/50 border border-border/50 rounded-lg px-4 py-2.5 focus:border-primary focus:ring-1 focus:ring-primary/50"
                  >
                    {timeOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  {(customTimeIds.has(msg.id) || !timeOptions.slice(0, -1).some(t => t.value === msg.send_time_minutes)) && (
                    <input
                      type="number"
                      min={1}
                      value={msg.send_time_minutes || ''}
                      onChange={(e) => handleUpdateMessage(msg.id, "send_time_minutes", Math.max(1, parseInt(e.target.value) || 1))}
                      placeholder="minutos"
                      className="w-full mt-2 bg-secondary/50 border border-border/50 rounded-lg px-3 py-2 text-sm"
                    />
                  )}
                </div>

                <div>
                  <label className="flex items-center gap-2 text-sm font-medium mb-2 text-muted-foreground">
                    <Percent className="w-4 h-4" />
                    Desconto
                  </label>
                  <select
                    value={msg.discount_percentage}
                    onChange={(e) => handleUpdateMessage(msg.id, "discount_percentage", parseInt(e.target.value))}
                    className="w-full bg-secondary/50 border border-border/50 rounded-lg px-4 py-2.5 focus:border-primary focus:ring-1 focus:ring-primary/50"
                  >
                    {discountOptions.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt === 0 ? "Sem desconto" : `${opt}% de desconto`}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="flex items-center gap-2 text-sm font-medium mb-2 text-muted-foreground">
                    <Users className="w-4 h-4" />
                    Destinatários
                  </label>
                  <select
                    value={msg.target_audience}
                    onChange={(e) => handleUpdateMessage(msg.id, "target_audience", e.target.value)}
                    className="w-full bg-secondary/50 border border-border/50 rounded-lg px-4 py-2.5 focus:border-primary focus:ring-1 focus:ring-primary/50"
                  >
                    {audienceOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Media */}
              <div className="mt-5">
                <label className="flex items-center gap-2 text-sm font-medium mb-2 text-muted-foreground">
                  <ImageIcon className="w-4 h-4" />
                  Mídia (opcional) — imagem, vídeo ou áudio
                </label>
                <input
                  type="file"
                  ref={(el) => { fileInputs.current[msg.id] = el; }}
                  onChange={(e) => handleMediaUpload(msg.id, e)}
                  accept="image/*,video/*,audio/*"
                  className="hidden"
                />
                {msg.media_url ? (
                  <div className="flex items-center gap-2 bg-secondary/40 border border-border/50 rounded-lg px-3 py-2 max-w-md">
                    {msg.media_type === "video" ? (
                      <ImageIcon className="w-4 h-4 text-primary shrink-0" />
                    ) : msg.media_type === "audio" ? (
                      <Music className="w-4 h-4 text-primary shrink-0" />
                    ) : (
                      <ImageIcon className="w-4 h-4 text-primary shrink-0" />
                    )}
                    <span className="text-sm text-foreground truncate flex-1">
                      Mídia anexada ({msg.media_type === "video" ? "vídeo" : msg.media_type === "audio" ? "áudio" : "imagem"})
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-7 h-7 shrink-0"
                      onClick={() => {
                        handleUpdateMessage(msg.id, "media_url", null);
                        handleUpdateMessage(msg.id, "media_type", null);
                      }}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      variant="outline"
                      onClick={() => fileInputs.current[msg.id]?.click()}
                      disabled={uploadingId === msg.id}
                    >
                      {uploadingId === msg.id ? (
                        <><Loader className="w-4 h-4 mr-2 animate-spin" />Enviando...</>
                      ) : (
                        <><ImageIcon className="w-4 h-4 mr-2" />Adicionar mídia</>
                      )}
                    </Button>
                    <span className="text-xs text-muted-foreground self-center">
                      Imagem, vídeo (máx 25MB) ou áudio
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Add Button */}
        <Button
          onClick={handleAddMessage}
          variant="outline"
          className="w-full mt-6 border-dashed border-2 border-border hover:border-primary hover:bg-primary/5 h-16 text-muted-foreground hover:text-primary transition-all duration-300 animate-fade-in"
          style={{ animationDelay: "0.4s" }}
        >
          <Plus className="w-5 h-5 mr-2" />
          Adicionar Nova Mensagem
        </Button>

        {/* Save Button */}
        <div className="flex justify-end mt-8 animate-fade-in" style={{ animationDelay: "0.5s" }}>
          <Button 
            onClick={handleSave} 
            className="bg-gradient-to-r from-primary to-cyan-500 hover:opacity-90 px-8 h-12 text-base font-semibold shadow-lg shadow-primary/20"
            disabled={saving}
          >
            {saving ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="w-5 h-5 mr-2" />
                Salvar Configurações
              </>
            )}
          </Button>
        </div>
      </div>
    </MainLayout>
  );
}