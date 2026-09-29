import { useState, useEffect, useRef } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import {
  Hash, Plus, Trash2, Send, Clock, Image, Video, Loader2, Save,
  Link2, Calendar, Repeat, X, Mic, Pencil, Radio, Target
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useBots } from "@/contexts/BotContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface ChannelButton {
  id: string;
  type: "custom";
  label: string;
  url: string;
}

interface ChannelMessage {
  id: string;
  channel_id: string;
  channel_name: string;
  message: string;
  media_url: string | null;
  media_type: string | null;
  buttons: ChannelButton[];
  schedule_type: "now" | "scheduled" | "recurring" | "weekly";
  scheduled_at: string | null;
  recurring_interval_minutes: number | null;
  weekdays: number[];
  times: string[];
  is_active: boolean;
  status: string;
  sent_count: number;
  created_at: string;
}

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

export default function Channels() {
  const { selectedBot } = useBots();
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [messages, setMessages] = useState<ChannelMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [uploadingMediaId, setUploadingMediaId] = useState<string | null>(null);
  const [channelTab, setChannelTab] = useState<"all" | "scheduled" | "recurring">("all");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  useEffect(() => {
    if (selectedBot) fetchMessages();
    else setLoading(false);
  }, [selectedBot]);

  const fetchMessages = async () => {
    if (!selectedBot) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("channel_messages")
        .select("*")
        .eq("bot_id", selectedBot.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setMessages(
        (data || []).map((m: any) => ({
          id: m.id,
          channel_id: m.channel_id || "",
          channel_name: m.channel_name || "",
          message: m.message,
          media_url: m.media_url,
          media_type: m.media_type,
          buttons: (m.buttons as ChannelButton[]) || [],
          schedule_type: m.schedule_type || "now",
          scheduled_at: m.scheduled_at,
          recurring_interval_minutes: m.recurring_interval_minutes,
          weekdays: Array.isArray(m.weekdays) ? m.weekdays : [],
          times: Array.isArray(m.times) ? m.times : [],
          is_active: m.is_active ?? true,
          status: m.status || "draft",
          sent_count: m.sent_count || 0,
          created_at: m.created_at,
        }))
      );
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    const newMsg: ChannelMessage = {
      id: `new_${Date.now()}`,
      channel_id: "",
      channel_name: "",
      message: "",
      media_url: null,
      media_type: null,
      buttons: [],
      schedule_type: "now",
      scheduled_at: null,
      recurring_interval_minutes: null,
      weekdays: [],
      times: [],
      is_active: true,
      status: "draft",
      sent_count: 0,
      created_at: new Date().toISOString(),
    };
    setMessages([newMsg, ...messages]);
    setEditingId(newMsg.id);
  };

  const updateMsg = (id: string, field: keyof ChannelMessage, value: any) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, [field]: value } : m)));
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
      toast({ title: "Arquivo inválido", variant: "destructive" });
      return;
    }
    const maxSize = isAudio ? 10 * 1024 * 1024 : 25 * 1024 * 1024;
    if (file.size > maxSize) {
      toast({ title: "Arquivo muito grande", variant: "destructive" });
      return;
    }

    setUploadingMediaId(msgId);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/${selectedBot.id}/channels/${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from("bot-media").upload(fileName, file);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from("bot-media").getPublicUrl(fileName);
      updateMsg(msgId, "media_url", publicUrl);
      updateMsg(msgId, "media_type", isAudio ? "audio" : isVideo ? "video" : "photo");
      toast({ title: "Mídia enviada!" });
    } catch (err) {
      console.error("Upload error:", err);
      toast({ title: "Erro ao enviar", variant: "destructive" });
    } finally {
      setUploadingMediaId(null);
    }
  };

  const handleSave = async (msg: ChannelMessage) => {
    if (!selectedBot || !msg.channel_id.trim()) {
      toast({ title: "Informe o ID do canal/grupo", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        bot_id: selectedBot.id,
        channel_id: msg.channel_id,
        channel_name: msg.channel_name,
        message: msg.message,
        media_url: msg.media_url,
        media_type: msg.media_type,
        buttons: msg.buttons as any,
        schedule_type: msg.schedule_type,
        scheduled_at: msg.schedule_type === "scheduled" ? msg.scheduled_at : null,
        recurring_interval_minutes: msg.schedule_type === "recurring" ? msg.recurring_interval_minutes : null,
        weekdays: msg.schedule_type === "weekly" ? msg.weekdays : null,
        times: msg.schedule_type === "weekly" ? msg.times : null,
        is_active: msg.is_active,
        status: msg.schedule_type === "now" ? "draft" : msg.schedule_type,
        next_send_at: msg.schedule_type === "recurring" ? new Date().toISOString() : msg.schedule_type === "scheduled" ? msg.scheduled_at : null,
      };

      if (msg.id.startsWith("new_")) {
        const { data, error } = await supabase.from("channel_messages").insert(payload).select().single();
        if (error) throw error;
        setMessages((prev) => prev.map((m) => m.id === msg.id ? { ...m, id: data.id, status: data.status } : m));
      } else {
        const { error } = await supabase.from("channel_messages").update(payload).eq("id", msg.id);
        if (error) throw error;
      }
      setEditingId(null);
      toast({ title: "Salvo!" });
      await fetchMessages();
    } catch (err) {
      console.error("Save error:", err);
      toast({ title: "Erro ao salvar", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!id.startsWith("new_")) await supabase.from("channel_messages").delete().eq("id", id);
    setMessages((prev) => prev.filter((m) => m.id !== id));
    toast({ title: "Excluído" });
    setDeleteTarget(null);
  };

  const handleSendNow = async (msg: ChannelMessage) => {
    if (!selectedBot || !msg.message.trim()) {
      toast({ title: "Mensagem vazia", variant: "destructive" });
      return;
    }
    if (msg.id.startsWith("new_")) { await handleSave(msg); return; }
    setSendingId(msg.id);
    try {
      const { data, error } = await supabase.functions.invoke("send-channel-message", {
        body: { message_id: msg.id, bot_id: selectedBot.id },
      });
      if (error) throw error;
      toast({ title: data?.ok ? "Mensagem enviada!" : "Falha ao enviar", variant: data?.ok ? "default" : "destructive" });
      await fetchMessages();
    } catch (err) {
      console.error("Send error:", err);
      toast({ title: "Erro ao enviar", variant: "destructive" });
    } finally {
      setSendingId(null);
    }
  };

  const visibleMessages = messages.filter((m) =>
    channelTab === "all"
      ? true
      : channelTab === "scheduled"
        ? m.schedule_type === "scheduled" || m.schedule_type === "weekly"
        : m.schedule_type === "recurring",
  );

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
            <Hash className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2">Nenhum bot selecionado</h2>
            <p className="text-muted-foreground">Selecione um bot para gerenciar seus postadores</p>
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
        <div className="animate-fade-in mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/25 text-primary text-xs font-medium mb-4">
            <Send className="w-3.5 h-3.5" /> Disparos para postadores
          </div>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-3xl font-bold tracking-tight mb-1">Postadores</h1>
              <p className="text-muted-foreground text-sm">
                Gerencie mensagens agendadas dos seus postadores — bot{" "}
                <span className="text-primary font-medium">@{selectedBot.username}</span>
              </p>
            </div>
            <Button onClick={handleCreate} className="btn-gradient">
              <Plus className="w-4 h-4 mr-2" /> Nova postagem
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6 animate-fade-in">
          {[
            { icon: Send, label: "Ativas", value: messages.filter((m) => m.is_active).length },
            { icon: Clock, label: "Agendadas", value: messages.filter((m) => m.schedule_type !== "now").length },
            { icon: Repeat, label: "Recorrentes", value: messages.filter((m) => m.schedule_type === "recurring" || m.schedule_type === "weekly").length },
            { icon: Hash, label: "Envios", value: messages.reduce((s, m) => s + (m.sent_count || 0), 0) },
          ].map((s) => (
            <div key={s.label} className="glass-card p-5">
              <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4">
                <s.icon className="w-4 h-4" />
              </div>
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1">{s.label}</p>
              <p className="font-mono text-2xl font-bold leading-none">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Filter tabs */}
        <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
          <div className="glass-card p-1 flex gap-1">
            {([
              { key: "all", label: "Todas", icon: Hash },
              { key: "scheduled", label: "Agendadas", icon: Clock },
              { key: "recurring", label: "Recorrentes", icon: Repeat },
            ] as const).map((t) => (
              <button
                key={t.key}
                onClick={() => setChannelTab(t.key)}
                className={`px-4 py-2 rounded-lg text-sm transition-all flex items-center gap-1.5 ${
                  channelTab === t.key
                    ? "bg-primary/15 text-primary border border-primary/30 font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                }`}
              >
                <t.icon className="w-3.5 h-3.5" /> {t.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Exibindo <span className="text-foreground font-semibold">{visibleMessages.length}</span> postagem(ns)
          </p>
        </div>

        {visibleMessages.length === 0 && (
          <div className="glass-card p-16 text-center animate-fade-in">
            <div className="w-14 h-14 rounded-2xl bg-secondary/60 flex items-center justify-center mx-auto mb-4">
              <Send className="w-6 h-6 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-1">Nenhuma postagem ainda</h3>
            <p className="text-sm text-muted-foreground">
              Crie uma postagem agendada para o seu canal ou grupo.
            </p>
          </div>
        )}

        <div className="space-y-5">
          {visibleMessages.map((msg, index) => {
            const isEditing = editingId === msg.id;
            return (
              <div key={msg.id} className="glass-card overflow-hidden animate-fade-in" style={{ animationDelay: `${0.1 + index * 0.05}s` }}>
                <div className="flex items-center justify-between p-5 border-b border-border/30">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <Radio className="w-4 h-4" />
                    </div>
                    <span className="font-semibold">
                      {msg.channel_name || msg.channel_id || "Novo postador"}
                    </span>
                    {getStatusBadge(msg.status)}
                  </div>
                  {!isEditing && (
                    <Button variant="ghost" size="icon" onClick={() => setEditingId(msg.id)} title="Editar">
                      <Pencil className="w-4 h-4" />
                    </Button>
                  )}
                </div>

                {isEditing && (
                  <div className="p-5 space-y-5">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">ID do Canal/Grupo</label>
                        <input
                          type="text"
                          value={msg.channel_id}
                          onChange={(e) => updateMsg(msg.id, "channel_id", e.target.value)}
                          placeholder="-1001234567890"
                          className="w-full bg-secondary/50 border border-border/50 rounded-xl p-3 font-mono focus:border-primary"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">Nome (opcional)</label>
                        <input
                          type="text"
                          value={msg.channel_name}
                          onChange={(e) => updateMsg(msg.id, "channel_name", e.target.value)}
                          placeholder="Meu Canal"
                          className="w-full bg-secondary/50 border border-border/50 rounded-xl p-3 focus:border-primary"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Mensagem</label>
                      <textarea
                        value={msg.message}
                        onChange={(e) => updateMsg(msg.id, "message", e.target.value)}
                        placeholder="Digite sua mensagem..."
                        className="w-full bg-secondary/50 border border-border/50 rounded-xl p-4 min-h-[120px] resize-none focus:border-primary"
                      />
                    </div>

                    {/* Media */}
                    <div>
                      <label className="block text-sm font-medium mb-2">Mídia</label>
                      <input type="file" ref={fileInputRef} onChange={(e) => handleMediaUpload(msg.id, e)}
                        accept="image/png,image/jpeg,image/jpg,video/mp4,audio/ogg" className="hidden" />
                      {msg.media_url ? (
                        <div className="flex items-center gap-3 p-3 bg-secondary/40 rounded-lg border border-border/40 max-w-md">
                          {msg.media_type === "video" ? <Video className="w-5 h-5 text-primary shrink-0" /> :
                            msg.media_type === "audio" ? <Mic className="w-5 h-5 text-primary shrink-0" /> :
                            <Image className="w-5 h-5 text-primary shrink-0" />}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {msg.media_type === "video" ? "Vídeo anexado" : msg.media_type === "audio" ? "Áudio anexado" : "Imagem anexada"}
                            </p>
                            <p className="text-xs text-muted-foreground truncate font-mono">{msg.media_url.split("/").pop()}</p>
                          </div>
                          <Button variant="ghost" size="icon" className="text-destructive shrink-0"
                            onClick={() => { updateMsg(msg.id, "media_url", null); updateMsg(msg.id, "media_type", null); }}>
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <Button variant="outline" className="border-border" onClick={() => fileInputRef.current?.click()} disabled={uploadingMediaId === msg.id}>
                            {uploadingMediaId === msg.id ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enviando...</> : <><Image className="w-4 h-4 mr-2" /> Mídia</>}
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Buttons */}
                    <div>
                      <label className="block text-sm font-medium mb-2">Botões</label>
                      {msg.buttons.map((btn) => (
                        <div key={btn.id} className="flex items-center gap-2 p-3 bg-secondary/30 rounded-lg border border-border/30 mb-2">
                          <input type="text" value={btn.label} onChange={(e) => {
                            const updated = msg.buttons.map(b => b.id === btn.id ? { ...b, label: e.target.value } : b);
                            updateMsg(msg.id, "buttons", updated);
                          }} placeholder="Texto" className="flex-1 bg-secondary/50 border border-border/50 rounded-lg px-3 py-2 text-sm" />
                          <input type="text" value={btn.url} onChange={(e) => {
                            const updated = msg.buttons.map(b => b.id === btn.id ? { ...b, url: e.target.value } : b);
                            updateMsg(msg.id, "buttons", updated);
                          }} placeholder="https://..." className="flex-1 bg-secondary/50 border border-border/50 rounded-lg px-3 py-2 text-sm font-mono" />
                          <Button variant="ghost" size="icon" className="text-destructive" onClick={() => updateMsg(msg.id, "buttons", msg.buttons.filter(b => b.id !== btn.id))}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                      <Button variant="outline" size="sm" onClick={() => updateMsg(msg.id, "buttons", [...msg.buttons, { id: `btn_${Date.now()}`, type: "custom" as const, label: "", url: "https://" }])}>
                        <Plus className="w-3 h-3 mr-1" /> Botão com URL
                      </Button>
                    </div>

                    {/* Schedule */}
                    <div>
                      <label className="block text-sm font-medium mb-2">Tipo de envio</label>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {[
                          { value: "now", label: "Enviar agora", icon: Send },
                          { value: "scheduled", label: "Agendar", icon: Calendar },
                          { value: "recurring", label: "Recorrente", icon: Repeat },
                          { value: "weekly", label: "Dias/Horários", icon: Clock },
                        ].map((opt) => {
                          const Icon = opt.icon;
                          return (
                            <button key={opt.value} onClick={() => updateMsg(msg.id, "schedule_type", opt.value)}
                              className={`flex items-center gap-2 p-3 rounded-lg border transition-all text-sm ${msg.schedule_type === opt.value ? "border-primary bg-primary/10 text-primary" : "border-border/50 bg-secondary/30 text-muted-foreground"}`}>
                              <Icon className="w-4 h-4" /> {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {msg.schedule_type === "scheduled" && (
                      <div>
                        <label className="block text-sm font-medium mb-2">Data e hora</label>
                        <input type="datetime-local" value={msg.scheduled_at?.substring(0, 16) || ""}
                          onChange={(e) => updateMsg(msg.id, "scheduled_at", e.target.value ? new Date(e.target.value).toISOString() : null)}
                          className="w-full bg-secondary/50 border border-border/50 rounded-lg px-4 py-2.5" />
                      </div>
                    )}
                    {msg.schedule_type === "recurring" && (
                      <div>
                        <label className="block text-sm font-medium mb-2">Intervalo</label>
                        <select value={msg.recurring_interval_minutes || 1440}
                          onChange={(e) => updateMsg(msg.id, "recurring_interval_minutes", parseInt(e.target.value))}
                          className="w-full bg-secondary/50 border border-border/50 rounded-lg px-4 py-2.5">
                          {recurringOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </select>
                      </div>
                    )}

                    {msg.schedule_type === "weekly" && (
                      <div className="space-y-3 p-4 rounded-lg bg-secondary/20 border border-border/30">
                        <div>
                          <label className="block text-sm font-medium mb-2">Dias da semana</label>
                          <div className="flex flex-wrap gap-2">
                            {[
                              { v: 0, l: "Dom" }, { v: 1, l: "Seg" }, { v: 2, l: "Ter" },
                              { v: 3, l: "Qua" }, { v: 4, l: "Qui" }, { v: 5, l: "Sex" }, { v: 6, l: "Sáb" },
                            ].map((d) => {
                              const active = msg.weekdays?.includes(d.v);
                              return (
                                <button key={d.v} type="button" onClick={() => {
                                  const cur = msg.weekdays || [];
                                  const next = active ? cur.filter(x => x !== d.v) : [...cur, d.v].sort();
                                  updateMsg(msg.id, "weekdays", next);
                                }} className={`px-3 py-1.5 rounded-lg border text-sm transition-all ${active ? "border-primary bg-primary/10 text-primary" : "border-border/50 bg-secondary/40 text-muted-foreground"}`}>
                                  {d.l}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-2">Horários (formato HH:MM, horário de São Paulo)</label>
                          <div className="space-y-2">
                            {(msg.times || []).map((t, idx) => (
                              <div key={idx} className="flex items-center gap-2">
                                <input type="time" value={t} onChange={(e) => {
                                  const next = [...(msg.times || [])];
                                  next[idx] = e.target.value;
                                  updateMsg(msg.id, "times", next);
                                }} className="bg-secondary/50 border border-border/50 rounded-lg px-3 py-2 text-sm" />
                                <Button variant="ghost" size="icon" className="text-destructive" onClick={() => updateMsg(msg.id, "times", (msg.times || []).filter((_, i) => i !== idx))}>
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            ))}
                            <Button variant="outline" size="sm" onClick={() => updateMsg(msg.id, "times", [...(msg.times || []), "09:00"])}>
                              <Plus className="w-3 h-3 mr-1" /> Adicionar horário
                            </Button>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">A mensagem será enviada automaticamente nos dias e horários selecionados.</p>
                      </div>
                    )}

                    <div className="flex items-center gap-3 pt-3 border-t border-border/30">
                      <Button onClick={() => handleSave(msg)} disabled={saving} className="bg-gradient-to-r from-primary to-cyan-500">
                        {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Salvando...</> : <><Save className="w-4 h-4 mr-2" /> Salvar</>}
                      </Button>
                      {msg.schedule_type === "now" && !msg.id.startsWith("new_") && (
                        <Button onClick={() => handleSendNow(msg)} disabled={sendingId === msg.id} className="bg-gradient-to-r from-teal-500 to-emerald-500">
                          {sendingId === msg.id ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enviando...</> : <><Send className="w-4 h-4 mr-2" /> Enviar</>}
                        </Button>
                      )}
                      <Button variant="ghost" onClick={() => setEditingId(null)}>Cancelar</Button>
                    </div>
                  </div>
                )}

                {!isEditing && (
                  <div className="p-5 flex flex-col xl:flex-row xl:items-center gap-4">
                    <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
                      <span className="inline-flex items-center gap-1.5 text-xs bg-secondary/60 border border-border/40 px-2.5 py-1 rounded-full">
                        <Target className="w-3 h-3 text-primary" /> {msg.channel_name || msg.channel_id || "—"}
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-xs bg-secondary/60 border border-border/40 px-2.5 py-1 rounded-full">
                        {msg.schedule_type === "now" && <><Send className="w-3 h-3 text-primary" /> Envio manual</>}
                        {msg.schedule_type === "scheduled" && <><Calendar className="w-3 h-3 text-primary" /> Agendado</>}
                        {msg.schedule_type === "recurring" && <><Repeat className="w-3 h-3 text-primary" /> Recorrente</>}
                        {msg.schedule_type === "weekly" && <><Clock className="w-3 h-3 text-primary" /> Dias/Horários</>}
                      </span>
                      {msg.schedule_type === "scheduled" && msg.scheduled_at && (
                        <span className="inline-flex items-center gap-1.5 text-xs bg-secondary/60 border border-border/40 px-2.5 py-1 rounded-full">
                          <Calendar className="w-3 h-3 text-primary" /> {new Date(msg.scheduled_at).toLocaleString("pt-BR")}
                        </span>
                      )}
                      {msg.sent_count > 0 && (
                        <span className="inline-flex items-center gap-1.5 text-xs bg-secondary/60 border border-border/40 px-2.5 py-1 rounded-full">
                          {msg.sent_count} envio(s)
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground px-2.5 py-1">
                        Mensagem configurada
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 pt-3 border-t border-border/30 xl:pt-0 xl:border-t-0 xl:border-l xl:border-border/30 xl:pl-4">
                      {!msg.id.startsWith("new_") && (
                        <Button
                          onClick={() => handleSendNow(msg)}
                          disabled={sendingId === msg.id}
                          size="sm"
                          className="btn-gradient"
                        >
                          {sendingId === msg.id ? (
                            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                          ) : (
                            <Send className="w-4 h-4 mr-1" />
                          )}
                          Enviar
                        </Button>
                      )}
                      <Button variant="outline" size="sm" onClick={() => setEditingId(msg.id)}>
                        <Pencil className="w-4 h-4 mr-1" /> Editar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => setDeleteTarget(msg.id)}
                      >
                        <Trash2 className="w-4 h-4 mr-1" /> Excluir
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir postagem?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação não pode ser desfeita. A postagem será removida permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && handleDelete(deleteTarget)}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
