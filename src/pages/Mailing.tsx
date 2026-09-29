import { useState, useEffect, useRef } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import {
  Mail, Plus, Trash2, Send, Clock, Image, Video, Loader2, Save,
  Link2, ExternalLink, Users, Calendar, Repeat, Eye, X, ArrowUp, ArrowDown, Megaphone, Pencil, Film
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useBots } from "@/contexts/BotContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface MailingButton {
  id: string;
  type: "plan" | "custom";
  label: string;
  plan_id?: string;
  url?: string;
  custom_price?: number;
  custom_label?: string;
}

interface MailingMessage {
  id: string;
  message: string;
  media_url: string | null;
  media_type: string | null;
  buttons: MailingButton[];
  target_audience: string;
  schedule_type: "now" | "scheduled" | "recurring";
  scheduled_at: string | null;
  recurring_interval_minutes: number | null;
  is_active: boolean;
  status: string;
  sent_count: number;
  created_at: string;
  last_sent_at: string | null;
  revenue_generated: number;
}

interface Plan {
  id: string;
  name: string;
  price: number;
  is_active: boolean;
}

const audienceOptions = [
  { label: "Todos - todos que interagiram com o bot", value: "all" },
  { label: "Apenas /start - deram /start mas não clicaram em nada", value: "start_only" },
  { label: "VIPs - que têm assinatura ativa", value: "vip" },
  { label: "Novos - que nunca compraram nada", value: "new" },
  { label: "Expirados - compraram, mas não renovaram", value: "expired" },
  { label: "Pendentes - geraram pix mas não finalizaram", value: "pending" },
  { label: "Downsell - compraram planos com desconto", value: "downsell" },
  { label: "Recorrentes - compraram mais de uma vez", value: "recurring_buyers" },
];

const recurringOptions = [
  { label: "A cada 30 minutos", value: 30 },
  { label: "A cada 1 hora", value: 60 },
  { label: "A cada 2 horas", value: 120 },
  { label: "A cada 6 horas", value: 360 },
  { label: "A cada 12 horas", value: 720 },
  { label: "A cada 24 horas", value: 1440 },
  { label: "A cada 2 dias", value: 2880 },
  { label: "A cada 7 dias", value: 10080 },
];

export default function Mailing() {
  const { selectedBot } = useBots();
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [messages, setMessages] = useState<MailingMessage[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [uploadingMediaId, setUploadingMediaId] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState<string | null>(null);
  const [mailingTab, setMailingTab] = useState<'messages' | 'logs'>('messages');
  const [sendLogs, setSendLogs] = useState<any[]>([]);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  useEffect(() => {
    if (selectedBot) {
      fetchMessages();
      fetchPlans();
      fetchSendLogs();
    } else {
      setLoading(false);
    }
  }, [selectedBot]);

  const fetchMessages = async () => {
    if (!selectedBot) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("mailing_messages")
        .select("*")
        .eq("bot_id", selectedBot.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setMessages(
        (data || []).map((m: any) => ({
          id: m.id,
          message: m.message,
          media_url: m.media_url,
          media_type: m.media_type,
          buttons: (m.buttons as MailingButton[]) || [],
          target_audience: m.target_audience || "all",
          schedule_type: m.schedule_type || "now",
          scheduled_at: m.scheduled_at,
          recurring_interval_minutes: m.recurring_interval_minutes,
          is_active: m.is_active ?? true,
          status: m.status || "draft",
          sent_count: m.sent_count || 0,
          created_at: m.created_at,
          last_sent_at: m.last_sent_at || null,
          revenue_generated: m.revenue_generated || 0,
        }))
      );
    } catch (error) {
      console.error("Error fetching mailing:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPlans = async () => {
    if (!selectedBot) return;
    try {
      const { data } = await supabase
        .from("subscription_plans")
        .select("id, name, price, is_active")
        .eq("bot_id", selectedBot.id)
        .eq("is_active", true)
        .order("created_at");
      setPlans(data || []);
    } catch (err) {
      console.error("Error fetching plans:", err);
    }
  };

  const fetchSendLogs = async () => {
    if (!selectedBot) return;
    try {
      const { data } = await supabase
        .from("mailing_send_logs")
        .select("*, mailing_messages(message)")
        .eq("bot_id", selectedBot.id)
        .order("sent_at", { ascending: false })
        .limit(50);
      setSendLogs(data || []);
    } catch (err) {
      console.error("Error fetching logs:", err);
    }
  };

  const handleCreate = () => {
    const newMsg: MailingMessage = {
      id: `new_${Date.now()}`,
      message: "",
      media_url: null,
      media_type: null,
      buttons: [],
      target_audience: "all",
      schedule_type: "now",
      scheduled_at: null,
      recurring_interval_minutes: null,
      is_active: true,
      status: "draft",
      sent_count: 0,
      created_at: new Date().toISOString(),
      last_sent_at: null,
      revenue_generated: 0,
    };
    setMessages([newMsg, ...messages]);
    setEditingId(newMsg.id);
  };

  const updateMsg = (id: string, field: keyof MailingMessage, value: any) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, [field]: value } : m))
    );
  };

  const handleMediaUpload = async (msgId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !selectedBot) return;
    if (/\.(avif|heic|heif|tiff)$/i.test(file.name)) {
      toast({ title: 'Formato não suportado', description: 'O Telegram não aceita AVIF/HEIC/TIFF. Use JPG, PNG ou MP4.', variant: 'destructive' });
      e.target.value = '';
      return;
    }

    const isVideo = file.type.startsWith("video/");
    const isImage = file.type.startsWith("image/");
    const isAudio = file.type.startsWith("audio/") || file.name.endsWith('.ogg');
    if (!isVideo && !isImage && !isAudio) {
      toast({ title: "Arquivo inválido", description: "Envie imagens (PNG, JPEG, JPG), vídeos (MP4) ou áudio (OGG).", variant: "destructive" });
      return;
    }
    const maxSize = isAudio ? 10 * 1024 * 1024 : 25 * 1024 * 1024;
    if (file.size > maxSize) {
      toast({ title: "Arquivo muito grande", description: isAudio ? "O tamanho máximo para áudio é 10MB." : "O tamanho máximo é 25MB.", variant: "destructive" });
      return;
    }

    setUploadingMediaId(msgId);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/${selectedBot.id}/mailing/${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from("bot-media").upload(fileName, file);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from("bot-media").getPublicUrl(fileName);
      updateMsg(msgId, "media_url", publicUrl);
      updateMsg(msgId, "media_type", isAudio ? "audio" : isVideo ? "video" : "photo");
      toast({ title: "Mídia enviada!" });
    } catch (err) {
      console.error("Upload error:", err);
      toast({ title: "Erro ao enviar mídia", variant: "destructive" });
    } finally {
      setUploadingMediaId(null);
    }
  };

  const handleAddButton = (msgId: string, type: "plan" | "custom") => {
    const msg = messages.find((m) => m.id === msgId);
    if (!msg) return;
    const newBtn: MailingButton = {
      id: `btn_${Date.now()}`,
      type,
      label: type === "plan" ? (plans[0]?.name || "Plano") : "Botão personalizado",
      plan_id: type === "plan" ? plans[0]?.id : undefined,
      url: type === "custom" ? "https://" : undefined,
    };
    updateMsg(msgId, "buttons", [...msg.buttons, newBtn]);
  };

  const handleUpdateButton = (msgId: string, btnId: string, field: keyof MailingButton, value: string) => {
    const msg = messages.find((m) => m.id === msgId);
    if (!msg) return;
    const updatedButtons = msg.buttons.map((b) => {
      if (b.id !== btnId) return b;
      if (field === "custom_price") {
        const num = parseFloat(value);
        return { ...b, custom_price: isNaN(num) ? undefined : num };
      }
      return { ...b, [field]: value };
    });
    // If changing plan_id, also update label
    if (field === "plan_id") {
      const plan = plans.find((p) => p.id === value);
      if (plan) {
        const idx = updatedButtons.findIndex((b) => b.id === btnId);
        if (idx >= 0) updatedButtons[idx].label = `${plan.name} - R$ ${Number(plan.price).toFixed(2)}`;
      }
    }
    updateMsg(msgId, "buttons", updatedButtons);
  };

  const handleRemoveButton = (msgId: string, btnId: string) => {
    const msg = messages.find((m) => m.id === msgId);
    if (!msg) return;
    updateMsg(msgId, "buttons", msg.buttons.filter((b) => b.id !== btnId));
  };

  const handleSave = async (msg: MailingMessage) => {
    if (!selectedBot) return;
    setSaving(true);
    try {
      const payload = {
        bot_id: selectedBot.id,
        message: msg.message,
        media_url: msg.media_url,
        media_type: msg.media_type,
        buttons: msg.buttons as any,
        target_audience: msg.target_audience,
        schedule_type: msg.schedule_type,
        scheduled_at: msg.schedule_type === "scheduled" ? msg.scheduled_at : null,
        recurring_interval_minutes: msg.schedule_type === "recurring" ? msg.recurring_interval_minutes : null,
        is_active: msg.is_active,
        status: msg.schedule_type === "now" ? "draft" : msg.schedule_type === "scheduled" ? "scheduled" : "recurring",
        next_send_at: msg.schedule_type === "recurring" ? new Date().toISOString() : msg.schedule_type === "scheduled" ? msg.scheduled_at : null,
      };

      if (msg.id.startsWith("new_")) {
        const { data, error } = await supabase
          .from("mailing_messages")
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === msg.id
              ? { ...m, id: data.id, status: data.status, created_at: data.created_at }
              : m
          )
        );
      } else {
        const { error } = await supabase
          .from("mailing_messages")
          .update(payload)
          .eq("id", msg.id);
        if (error) throw error;
      }

      setEditingId(null);
      toast({ title: "Campanha salva!" });
      await fetchMessages();
    } catch (err) {
      console.error("Save error:", err);
      toast({ title: "Erro ao salvar", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!id.startsWith("new_")) {
      await supabase.from("mailing_messages").delete().eq("id", id);
    }
    setMessages((prev) => prev.filter((m) => m.id !== id));
    toast({ title: "Campanha excluída" });
  };

  const confirmDelete = async () => {
    if (!deleteTargetId) return;
    await handleDelete(deleteTargetId);
    setDeleteTargetId(null);
  };

  const handleSendNow = async (msg: MailingMessage) => {
    if (!selectedBot || !msg.message.trim()) {
      toast({ title: "Mensagem vazia", variant: "destructive" });
      return;
    }

    setSendingId(msg.id);
    let realId = msg.id;
    // Persist first if it's an unsaved draft
    if (msg.id.startsWith("new_")) {
      try {
        const payload = {
          bot_id: selectedBot.id,
          message: msg.message,
          media_url: msg.media_url,
          media_type: msg.media_type,
          buttons: msg.buttons as any,
          target_audience: msg.target_audience,
          schedule_type: "now",
          is_active: true,
          status: "draft",
        };
        const { data, error } = await supabase
          .from("mailing_messages")
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        realId = data.id;
      } catch (err) {
        console.error("Save-before-send error:", err);
        toast({ title: "Erro ao salvar antes de enviar", variant: "destructive" });
        setSendingId(null);
        return;
      }
    }
    try {
      const { data, error } = await supabase.functions.invoke("send-mailing", {
        body: { mailing_id: realId, bot_id: selectedBot.id },
      });
      if (error) throw error;
      toast({ title: "Campanha enviada!", description: `${data?.sent || 0} mensagens enviadas.` });
      await fetchMessages();
    } catch (err) {
      console.error("Send error:", err);
      toast({ title: "Erro ao enviar", variant: "destructive" });
    } finally {
      setSendingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, { label: string; className: string }> = {
      draft: { label: "Rascunho", className: "bg-muted text-muted-foreground" },
      scheduled: { label: "Agendado", className: "bg-amber-500/20 text-amber-400" },
      sending: { label: "Enviando...", className: "bg-blue-500/20 text-blue-400" },
      sent: { label: "Enviado", className: "bg-green-500/20 text-green-400" },
      recurring: { label: "Recorrente", className: "bg-purple-500/20 text-purple-400" },
    };
    const s = map[status] || map.draft;
    return <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${s.className}`}>{s.label}</span>;
  };

  if (!selectedBot) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-center glass-card p-12">
            <Megaphone className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2">Nenhum bot selecionado</h2>
            <p className="text-muted-foreground">Selecione um bot para criar campanhas de remarketing</p>
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
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap mb-6 animate-fade-in">
          <div className="flex items-center gap-3">
            <Megaphone className="w-8 h-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Remarketing</h1>
              <p className="text-muted-foreground text-sm">
                Crie campanhas de recuperação de vendas e reengaje seus leads — bot{" "}
                <span className="text-primary font-medium">@{selectedBot.username}</span>
              </p>
            </div>
          </div>
          <Button onClick={handleCreate} className="btn-gradient">
            <Plus className="w-4 h-4 mr-2" />
            Nova Campanha
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6 animate-fade-in">
          {[
            { icon: Megaphone, label: "Total de Campanhas", value: String(messages.length) },
            { icon: Repeat, label: "Campanhas Ativas", value: String(messages.filter((m) => m.is_active).length) },
            { icon: Send, label: "Mensagens Enviadas", value: String(messages.reduce((s, m) => s + (m.sent_count || 0), 0)) },
            {
              icon: Users,
              label: "Receita Gerada",
              value: `R$ ${messages
                .reduce((s, m) => s + Number(m.revenue_generated || 0), 0)
                .toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
              highlight: true,
            },
          ].map((s: any) => (
            <div key={s.label} className="glass-card p-5">
              <div className="flex items-start justify-between mb-3">
                <p className="text-sm text-muted-foreground">{s.label}</p>
                <s.icon className="w-4 h-4 text-primary" />
              </div>
              <p className={`font-mono text-2xl font-bold leading-none ${s.highlight ? "text-primary" : ""}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 glass-card p-1 w-fit animate-fade-in" style={{ animationDelay: "0.03s" }}>
          <button onClick={() => setMailingTab('messages')}
            className={`px-4 py-2 rounded-lg text-sm transition-all ${mailingTab === 'messages' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-secondary'}`}>
            <Megaphone className="w-4 h-4 inline mr-1" /> Campanhas
          </button>
          <button onClick={() => setMailingTab('logs')}
            className={`px-4 py-2 rounded-lg text-sm transition-all ${mailingTab === 'logs' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-secondary'}`}>
            <Clock className="w-4 h-4 inline mr-1" /> Histórico de Envios
          </button>
        </div>

        {mailingTab === 'logs' && (
          <div className="space-y-4 animate-fade-in">
            <h3 className="text-lg font-semibold">Histórico de Envios</h3>
            {sendLogs.length === 0 ? (
              <div className="glass-card p-12 text-center"><Clock className="w-12 h-12 mx-auto mb-3 text-muted-foreground" /><p className="text-muted-foreground">Nenhum envio registrado</p></div>
            ) : (
              <div className="space-y-3">
                {sendLogs.map((log: any) => (
                  <div key={log.id} className="glass-card p-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium line-clamp-1">{log.mailing_messages?.message?.substring(0, 60) || 'Mensagem'}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(log.sent_at).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })} às {new Date(log.sent_at).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <div className="flex gap-3 text-xs">
                      <span className="bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded">✅ {log.sent_count}</span>
                      {log.failed_count > 0 && <span className="bg-red-500/20 text-red-400 px-2 py-1 rounded">❌ {log.failed_count}</span>}
                      {log.skipped_count > 0 && <span className="bg-amber-500/20 text-amber-400 px-2 py-1 rounded">⏭️ {log.skipped_count}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {mailingTab === 'messages' && <>
        {/* Info */}
        <div className="glass-card p-5 mb-6 border-l-4 border-primary animate-fade-in" style={{ animationDelay: "0.05s" }}>
          <div className="flex items-start gap-3">
            <Megaphone className="w-5 h-5 text-primary mt-0.5" />
            <div>
              <p className="font-medium text-primary mb-1">Como funciona o Remarketing?</p>
              <p className="text-sm text-muted-foreground">
                Crie mensagens com mídia e botões de compra para enviar aos seus usuários. 
                Você pode enviar agora, agendar para uma data ou configurar envio recorrente.
              </p>
            </div>
          </div>
        </div>

        {/* Messages List */}
        <div className="space-y-5">
          {messages.map((msg, index) => {
            const isEditing = editingId === msg.id;

            return (
              <div
                key={msg.id}
                className="glass-card overflow-hidden animate-fade-in hover:border-primary/30 transition-all duration-300"
                style={{ animationDelay: `${0.1 + index * 0.05}s` }}
              >
                {/* Card Header */}
                <div className="flex items-center justify-between gap-3 p-5 border-b border-border/30 flex-wrap">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <Mail className="w-5 h-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <span className="font-semibold block truncate max-w-[280px]">
                        {msg.message.substring(0, 40) || "Nova mensagem"}{msg.message.length > 40 ? "..." : ""}
                      </span>
                      {msg.sent_count > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {msg.sent_count} envios
                          {msg.last_sent_at && <> • {new Date(msg.last_sent_at).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })} {new Date(msg.last_sent_at).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })}</>}
                          {msg.revenue_generated > 0 && <> • <span className="text-emerald-400">R$ {Number(msg.revenue_generated).toFixed(2)}</span></>}
                        </span>
                      )}
                    </div>
                  </div>
                  {getStatusBadge(msg.status)}
                </div>

                {isEditing && (
                  <div className="p-5 space-y-5">
                    {/* Message Text */}
                    <div>
                      <label className="block text-sm font-medium mb-2">Mensagem</label>
                      <textarea
                        value={msg.message}
                        onChange={(e) => updateMsg(msg.id, "message", e.target.value)}
                        placeholder="Digite sua mensagem..."
                        className="w-full bg-secondary/50 border border-border/50 rounded-xl p-4 min-h-[140px] resize-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all"
                      />
                      <p className="text-xs text-muted-foreground mt-1 text-right">
                        {msg.message.length}/4096
                      </p>
                    </div>

                    {/* Media */}
                    <div>
                      <label className="block text-sm font-medium mb-2">Mídia (Imagem/Vídeo)</label>
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={(e) => handleMediaUpload(msg.id, e)}
                        accept="image/png,image/jpeg,image/jpg,video/mp4,audio/ogg,audio/mpeg"
                        className="hidden"
                      />
                      {msg.media_url ? (
                        <div className="relative inline-block">
                          {msg.media_type === "video" ? (
                            <video src={msg.media_url} className="max-w-xs h-40 object-cover rounded-lg border border-border" controls />
                          ) : (
                            <img src={msg.media_url} alt="Preview" className="max-w-xs h-40 object-cover rounded-lg border border-border" />
                          )}
                          <Button
                            variant="destructive"
                            size="icon"
                            className="absolute -top-2 -right-2 w-6 h-6"
                            onClick={() => {
                              updateMsg(msg.id, "media_url", null);
                              updateMsg(msg.id, "media_type", null);
                            }}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            className="border-border"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploadingMediaId === msg.id}
                          >
                            {uploadingMediaId === msg.id ? (
                              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enviando...</>
                            ) : (
                              <><Image className="w-4 h-4 mr-2" /> Imagem</>
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            className="border-border"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploadingMediaId === msg.id}
                          >
                            <Video className="w-4 h-4 mr-2" /> Vídeo
                          </Button>
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground mt-2">
                        PNG, JPEG, JPG, MP4 (máx 25MB) ou OGG áudio (máx 10MB)
                      </p>
                    </div>

                    {/* Buttons */}
                    <div>
                      <label className="block text-sm font-medium mb-2">Botões</label>
                      <div className="space-y-3">
                        {msg.buttons.map((btn, btnIdx) => (
                          <div key={btn.id} className="flex items-center gap-2 p-3 bg-secondary/30 rounded-lg border border-border/30">
                            {btn.type === "plan" ? (
                              <>
                                <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-2">
                                  <select
                                    value={btn.plan_id || ""}
                                    onChange={(e) => handleUpdateButton(msg.id, btn.id, "plan_id", e.target.value)}
                                    className="bg-secondary/50 border border-border/50 rounded-lg px-3 py-2 text-sm focus:border-primary"
                                  >
                                    <option value="">Selecione um plano</option>
                                    {plans.map((p) => (
                                      <option key={p.id} value={p.id}>
                                        {p.name} - R$ {Number(p.price).toFixed(2)}
                                      </option>
                                    ))}
                                  </select>
                                  <input
                                    type="text"
                                    value={btn.custom_label || ""}
                                    onChange={(e) => handleUpdateButton(msg.id, btn.id, "custom_label" as any, e.target.value)}
                                    placeholder="Texto do botão (opcional)"
                                    className="bg-secondary/50 border border-border/50 rounded-lg px-3 py-2 text-sm focus:border-primary"
                                  />
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={btn.custom_price ?? ""}
                                    onChange={(e) => handleUpdateButton(msg.id, btn.id, "custom_price" as any, e.target.value)}
                                    placeholder="Preço (R$) - opcional"
                                    className="bg-secondary/50 border border-border/50 rounded-lg px-3 py-2 text-sm font-mono focus:border-primary"
                                  />
                                </div>
                              </>
                            ) : (
                              <>
                                <input
                                  type="text"
                                  value={btn.label}
                                  onChange={(e) => handleUpdateButton(msg.id, btn.id, "label", e.target.value)}
                                  placeholder="Texto do botão"
                                  className="flex-1 bg-secondary/50 border border-border/50 rounded-lg px-3 py-2 text-sm focus:border-primary"
                                />
                                <input
                                  type="text"
                                  value={btn.url || ""}
                                  onChange={(e) => handleUpdateButton(msg.id, btn.id, "url", e.target.value)}
                                  placeholder="https://..."
                                  className="flex-1 bg-secondary/50 border border-border/50 rounded-lg px-3 py-2 text-sm font-mono focus:border-primary"
                                />
                              </>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:bg-destructive/10 shrink-0"
                              onClick={() => handleRemoveButton(msg.id, btn.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2 mt-3">
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-border"
                          onClick={() => handleAddButton(msg.id, "plan")}
                        >
                          <Plus className="w-3 h-3 mr-1" /> Plano de Assinatura
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-border"
                          onClick={() => handleAddButton(msg.id, "custom")}
                        >
                          <Link2 className="w-3 h-3 mr-1" /> Botão Personalizado
                        </Button>
                      </div>
                    </div>

                    {/* Target Audience */}
                    <div>
                      <label className="flex items-center gap-2 text-sm font-medium mb-2">
                        <Users className="w-4 h-4" /> Selecione o grupo de usuários
                      </label>
                      <select
                        value={msg.target_audience}
                        onChange={(e) => updateMsg(msg.id, "target_audience", e.target.value)}
                        className="w-full bg-secondary/50 border border-border/50 rounded-lg px-4 py-2.5 focus:border-primary focus:ring-1 focus:ring-primary/50"
                      >
                        {audienceOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Schedule Type */}
                    <div>
                      <label className="flex items-center gap-2 text-sm font-medium mb-2">
                        <Clock className="w-4 h-4" /> Tipo de envio
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { value: "now", label: "Enviar agora", icon: Send },
                          { value: "scheduled", label: "Agendar", icon: Calendar },
                          { value: "recurring", label: "Recorrente", icon: Repeat },
                        ].map((opt) => {
                          const Icon = opt.icon;
                          return (
                            <button
                              key={opt.value}
                              onClick={() => updateMsg(msg.id, "schedule_type", opt.value)}
                              className={`flex items-center gap-2 p-3 rounded-lg border transition-all text-sm ${
                                msg.schedule_type === opt.value
                                  ? "border-primary bg-primary/10 text-primary"
                                  : "border-border/50 bg-secondary/30 text-muted-foreground hover:border-primary/30"
                              }`}
                            >
                              <Icon className="w-4 h-4" />
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Scheduled At */}
                    {msg.schedule_type === "scheduled" && (
                      <div>
                        <label className="block text-sm font-medium mb-2">Data e hora do envio</label>
                        <input
                          type="datetime-local"
                          value={msg.scheduled_at?.substring(0, 16) || ""}
                          onChange={(e) => updateMsg(msg.id, "scheduled_at", e.target.value ? new Date(e.target.value).toISOString() : null)}
                          className="w-full bg-secondary/50 border border-border/50 rounded-lg px-4 py-2.5 focus:border-primary"
                        />
                      </div>
                    )}

                    {/* Recurring Interval */}
                    {msg.schedule_type === "recurring" && (
                      <div>
                        <label className="block text-sm font-medium mb-2">Intervalo de envio</label>
                        <select
                          value={msg.recurring_interval_minutes || 1440}
                          onChange={(e) => updateMsg(msg.id, "recurring_interval_minutes", parseInt(e.target.value))}
                          className="w-full bg-secondary/50 border border-border/50 rounded-lg px-4 py-2.5 focus:border-primary"
                        >
                          {recurringOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex items-center gap-3 pt-3 border-t border-border/30">
                      <Button
                        onClick={() => handleSave(msg)}
                        disabled={saving}
                        className="bg-gradient-to-r from-primary to-cyan-500 hover:opacity-90"
                      >
                        {saving ? (
                          <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Salvando...</>
                        ) : (
                          <><Save className="w-4 h-4 mr-2" /> Salvar</>
                        )}
                      </Button>

                      {msg.schedule_type === "now" && !msg.id.startsWith("new_") && (
                        <Button
                          onClick={() => handleSendNow(msg)}
                          disabled={sendingId === msg.id}
                          className="bg-gradient-to-r from-blue-500 to-indigo-500 hover:opacity-90"
                        >
                          {sendingId === msg.id ? (
                            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enviando...</>
                          ) : (
                            <><Send className="w-4 h-4 mr-2" /> Enviar Agora</>
                          )}
                        </Button>
                      )}

                      <Button
                        variant="ghost"
                        onClick={() => setEditingId(null)}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                )}

                {/* Collapsed view */}
                {!isEditing && (
                  <div className="p-5 flex flex-col xl:flex-row xl:items-center gap-4">
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                      {msg.media_url && (
                        <div className="shrink-0">
                          {msg.media_type === "video" ? (
                            <video src={msg.media_url} className="w-20 h-20 object-cover rounded-lg border border-border" />
                          ) : (
                            <img src={msg.media_url} alt="" className="w-20 h-20 object-cover rounded-lg border border-border" />
                          )}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                          {msg.message || "Sem conteúdo"}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <span className="text-xs bg-secondary px-2 py-1 rounded-full flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {audienceOptions.find((a) => a.value === msg.target_audience)?.label.split(" - ")[0] || msg.target_audience}
                          </span>
                          {msg.buttons.length > 0 && (
                            <span className="text-xs bg-secondary px-2 py-1 rounded-full">
                              {msg.buttons.length} botão(ões)
                            </span>
                          )}
                          {msg.media_url && (
                            <span className="text-xs bg-secondary px-2 py-1 rounded-full flex items-center gap-1">
                              {msg.media_type === "video" ? <Film className="w-3 h-3" /> : <Image className="w-3 h-3" />}
                              Mídia
                            </span>
                          )}
                          {msg.schedule_type === "recurring" && (
                            <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-1 rounded-full flex items-center gap-1">
                              <Repeat className="w-3 h-3" />
                              {recurringOptions.find((r) => r.value === msg.recurring_interval_minutes)?.label || "Recorrente"}
                            </span>
                          )}
                          {msg.schedule_type === "scheduled" && msg.scheduled_at && (
                            <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-1 rounded-full flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(msg.scheduled_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Action row */}
                    <div className="flex items-center gap-2 shrink-0 pt-3 border-t border-border/30 xl:pt-0 xl:border-t-0 xl:border-l xl:border-border/30 xl:pl-4">
                      <Button
                        onClick={() => handleSendNow(msg)}
                        disabled={sendingId === msg.id || msg.id.startsWith("new_")}
                        size="sm"
                        className="btn-gradient flex-1 xl:flex-none"
                      >
                        {sendingId === msg.id ? (
                          <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Enviando...</>
                        ) : (
                          <><Send className="w-4 h-4 mr-1.5" /> Enviar</>
                        )}
                      </Button>
                      <Button variant="outline" size="sm" className="flex-1 xl:flex-none" onClick={() => setEditingId(msg.id)}>
                        <Pencil className="w-4 h-4 mr-1.5" /> Editar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="flex-1 xl:flex-none text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => setDeleteTargetId(msg.id)}
                      >
                        <Trash2 className="w-4 h-4 mr-1.5" /> Excluir
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {mailingTab === 'messages' && messages.length === 0 && (
          <div className="glass-card p-12 text-center animate-fade-in" style={{ animationDelay: "0.1s" }}>
            <Megaphone className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">Nenhuma campanha criada</h3>
            <p className="text-muted-foreground mb-6">Crie sua primeira campanha de remarketing para recuperar vendas e reengajar seus leads.</p>
            <Button onClick={handleCreate} className="btn-gradient">
              <Plus className="w-4 h-4 mr-2" /> Criar Primeira Campanha
            </Button>
          </div>
        )}
        </>}
      </div>

      <AlertDialog open={!!deleteTargetId} onOpenChange={(open) => !open && setDeleteTargetId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir campanha?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação não pode ser desfeita. A campanha será removida permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={confirmDelete}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
