import { useState, useEffect, useRef } from "react";
import { X, Crown, Image, Video, Music, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBots } from "@/contexts/BotContext";
import { useToast } from "@/hooks/use-toast";

interface Plan {
  id?: string;
  name: string;
  duration: string;
  duration_days?: number;
  price: number;
  is_active?: boolean;
  order_bump_enabled?: boolean;
  order_bump_name?: string;
  order_bump_description?: string;
  order_bump_price?: number;
  order_bump_media_url?: string;
  order_bump_media_type?: string;
  button_style?: string | null;
  order_bump_title?: string | null;
  order_bump_yes_button_text?: string | null;
  order_bump_no_button_text?: string | null;
  order_bump_button_price_mode?: string | null;
  order_bump_button_price_custom?: string | null;
}

interface PlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (plan: Plan) => void;
  plan?: Plan | null;
}

const durationOptions = [
  { label: "Diário", value: "diario", days: 1 },
  { label: "Semanal", value: "semanal", days: 7 },
  { label: "Quinzenal", value: "quinzenal", days: 15 },
  { label: "Mensal", value: "mensal", days: 30 },
  { label: "Trimestral", value: "trimestral", days: 90 },
  { label: "Semestral", value: "semestral", days: 180 },
  { label: "Anual", value: "anual", days: 365 },
  { label: "Vitalício", value: "vitalicio", days: null },
];

export function PlanModal({ isOpen, onClose, onSave, plan }: PlanModalProps) {
  const [name, setName] = useState("");
  const [duration, setDuration] = useState("mensal");
  const [price, setPrice] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [orderBumpEnabled, setOrderBumpEnabled] = useState(false);
  const [orderBumpName, setOrderBumpName] = useState("");
  const [orderBumpDescription, setOrderBumpDescription] = useState("");
  const [orderBumpPrice, setOrderBumpPrice] = useState("");
  const [orderBumpMediaUrl, setOrderBumpMediaUrl] = useState<string | null>(null);
  const [orderBumpMediaType, setOrderBumpMediaType] = useState<string | null>(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [buttonStyle, setButtonStyle] = useState<string | null>(null);
  const [orderBumpTitle, setOrderBumpTitle] = useState("");
  const [orderBumpYesBtn, setOrderBumpYesBtn] = useState("");
  const [orderBumpNoBtn, setOrderBumpNoBtn] = useState("");
  const [orderBumpPriceMode, setOrderBumpPriceMode] = useState<"auto" | "hidden" | "custom">("auto");
  const [orderBumpPriceCustom, setOrderBumpPriceCustom] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const { selectedBot } = useBots();
  const { toast } = useToast();

  useEffect(() => {
    if (plan) {
      setName(plan.name);
      setDuration(plan.duration);
      setPrice(plan.price.toString());
      setIsActive(plan.is_active ?? true);
      setOrderBumpEnabled(plan.order_bump_enabled ?? false);
      setOrderBumpName(plan.order_bump_name || "");
      setOrderBumpDescription(plan.order_bump_description || "");
      setOrderBumpPrice(plan.order_bump_price?.toString() || "");
      setOrderBumpMediaUrl(plan.order_bump_media_url || null);
      setOrderBumpMediaType(plan.order_bump_media_type || null);
      setButtonStyle(plan.button_style || null);
      setOrderBumpTitle(plan.order_bump_title || "");
      setOrderBumpYesBtn(plan.order_bump_yes_button_text || "");
      setOrderBumpNoBtn(plan.order_bump_no_button_text || "");
      setOrderBumpPriceMode((plan.order_bump_button_price_mode as any) || "auto");
      setOrderBumpPriceCustom(plan.order_bump_button_price_custom || "");
    } else {
      setName("");
      setDuration("mensal");
      setPrice("");
      setIsActive(true);
      setOrderBumpEnabled(false);
      setOrderBumpName("");
      setOrderBumpDescription("");
      setOrderBumpPrice("");
      setOrderBumpMediaUrl(null);
      setOrderBumpMediaType(null);
      setButtonStyle(null);
      setOrderBumpTitle("");
      setOrderBumpYesBtn("");
      setOrderBumpNoBtn("");
      setOrderBumpPriceMode("auto");
      setOrderBumpPriceCustom("");
    }
  }, [plan, isOpen]);

  if (!isOpen) return null;

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !selectedBot) return;

    const isVideo = file.type.startsWith("video/");
    const isImage = file.type.startsWith("image/");
    const isAudio = file.type.startsWith("audio/") || file.name.endsWith('.ogg');

    if (!isVideo && !isImage && !isAudio) {
      toast({ title: "Arquivo inválido", description: "Envie imagem, vídeo ou áudio.", variant: "destructive" });
      return;
    }
    if (/\.(avif|heic|heif|tiff)$/i.test(file.name)) {
      toast({
        title: "Formato não suportado pelo Telegram",
        description: "Converta a imagem para JPG ou PNG antes de enviar.",
        variant: "destructive",
      });
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast({ title: "Arquivo muito grande", description: "Máximo 20MB.", variant: "destructive" });
      return;
    }

    setUploadingMedia(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/${selectedBot.id}/order-bump/${Date.now()}.${fileExt}`;
      const { error } = await supabase.storage.from("bot-media").upload(fileName, file);
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from("bot-media").getPublicUrl(fileName);
      setOrderBumpMediaUrl(publicUrl);
      setOrderBumpMediaType(isAudio ? "audio" : isVideo ? "video" : "photo");
      toast({ title: "Mídia enviada!" });
    } catch (err) {
      console.error(err);
      toast({ title: "Erro ao enviar mídia", variant: "destructive" });
    } finally {
      setUploadingMedia(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const selectedDuration = durationOptions.find((d) => d.value === duration);
    
    onSave({
      id: plan?.id,
      name,
      duration,
      duration_days: selectedDuration?.days ?? undefined,
      price: parseFloat(price),
      is_active: isActive,
      order_bump_enabled: orderBumpEnabled,
      order_bump_name: orderBumpName || undefined,
      order_bump_description: orderBumpDescription || undefined,
      order_bump_price: orderBumpPrice ? parseFloat(orderBumpPrice) : undefined,
      order_bump_media_url: orderBumpMediaUrl || undefined,
      order_bump_media_type: orderBumpMediaType || undefined,
      button_style: buttonStyle || undefined,
      order_bump_title: orderBumpTitle || null,
      order_bump_yes_button_text: orderBumpYesBtn || null,
      order_bump_no_button_text: orderBumpNoBtn || null,
      order_bump_button_price_mode: orderBumpPriceMode,
      order_bump_button_price_custom: orderBumpPriceMode === "custom" ? (orderBumpPriceCustom || null) : null,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg mx-4 glass-card p-6 animate-scale-in max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
              <Crown className="w-5 h-5 text-primary" />
            </div>
            <h2 className="text-xl font-bold">{plan ? "Editar Plano" : "Novo Plano"}</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-secondary rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium mb-2">Nome do Plano</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Plano Premium" className="w-full input-dark" required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Duração</label>
              <select value={duration} onChange={(e) => setDuration(e.target.value)} className="w-full input-dark">
                {durationOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Valor (R$)</label>
              <input type="number" step="0.01" min="0" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" className="w-full input-dark font-mono" required />
            </div>
          </div>

          <div className="flex items-center justify-between py-3 border-t border-border/50">
            <div>
              <p className="font-medium">Plano ativo</p>
              <p className="text-sm text-muted-foreground">Disponível para novos assinantes</p>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>

          {/* Button Style */}
          <div className="border-t border-border/50 pt-4">
            <label className="block text-sm font-medium mb-2">Cor do Botão no Telegram</label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { value: null, label: "Padrão", color: "bg-muted" },
                { value: "primary", label: "Azul", color: "bg-blue-500" },
                { value: "success", label: "Verde", color: "bg-green-500" },
                { value: "danger", label: "Vermelho", color: "bg-red-500" },
              ].map((opt) => (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => setButtonStyle(opt.value)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border transition-all ${
                    buttonStyle === opt.value
                      ? "border-primary bg-primary/10 ring-1 ring-primary"
                      : "border-border/50 hover:border-border"
                  }`}
                >
                  <div className={`w-full h-8 rounded-md ${opt.color} flex items-center justify-center`}>
                    <span className="text-white text-xs font-medium">📦 Plano</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{opt.label}</span>
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Requer Telegram atualizado (Bot API 9.4+). Clientes antigos verão a cor padrão.
            </p>
          </div>

          {/* Order Bump */}
          <div className="border-t border-border/50 pt-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Order Bump</p>
                <p className="text-sm text-muted-foreground">Oferta adicional no checkout</p>
              </div>
              <Switch checked={orderBumpEnabled} onCheckedChange={setOrderBumpEnabled} />
            </div>
            {orderBumpEnabled && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Nome do bump</label>
                    <input type="text" value={orderBumpName} onChange={(e) => setOrderBumpName(e.target.value)} placeholder="Ex: Acesso Extra" className="w-full input-dark" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Valor (R$)</label>
                    <input type="number" step="0.01" min="0" value={orderBumpPrice} onChange={(e) => setOrderBumpPrice(e.target.value)} placeholder="0.00" className="w-full input-dark font-mono" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Descrição do bump</label>
                  <textarea
                    value={orderBumpDescription}
                    onChange={(e) => setOrderBumpDescription(e.target.value)}
                    placeholder="Texto que aparecerá na oferta do order bump (suporta Markdown)"
                    className="w-full input-dark min-h-[80px] resize-none"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Mensagem mostrada ao usuário ao oferecer o bump.</p>
                </div>

                {/* Order Bump Media */}
                <div>
                  <label className="block text-sm font-medium mb-2">Mídia do Order Bump</label>
                  <input type="file" ref={fileInputRef} onChange={handleMediaUpload} accept="image/*,video/*,audio/*,.ogg" className="hidden" />
                  
                  {orderBumpMediaUrl ? (
                    <div className="relative inline-block">
                      {orderBumpMediaType === 'video' ? (
                        <video src={orderBumpMediaUrl} className="max-w-full h-32 object-cover rounded-lg border border-border" controls />
                      ) : orderBumpMediaType === 'audio' ? (
                        <audio src={orderBumpMediaUrl} controls className="w-full" />
                      ) : (
                        <img src={orderBumpMediaUrl} alt="Preview" className="max-w-full h-32 object-cover rounded-lg border border-border" />
                      )}
                      <Button variant="destructive" size="icon" className="absolute -top-2 -right-2 w-6 h-6"
                        onClick={() => { setOrderBumpMediaUrl(null); setOrderBumpMediaType(null); }}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploadingMedia} className="border-border">
                        {uploadingMedia ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Image className="w-4 h-4 mr-1" />}
                        Imagem
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploadingMedia} className="border-border">
                        <Video className="w-4 h-4 mr-1" /> Vídeo
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploadingMedia} className="border-border">
                        <Music className="w-4 h-4 mr-1" /> Áudio
                      </Button>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">Imagem, vídeo ou áudio para o order bump (máx. 20MB)</p>
                </div>

                {/* Customização da mensagem e botões */}
                <div className="border-t border-border/30 pt-4 space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Título da oferta (opcional)</label>
                    <input
                      type="text"
                      value={orderBumpTitle}
                      onChange={(e) => setOrderBumpTitle(e.target.value)}
                      placeholder="Ex: 🎁 Oferta Especial!"
                      className="w-full input-dark"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Cabeçalho exibido acima da mensagem. Deixe vazio para usar o padrão.</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Texto do botão "Sim"</label>
                      <input
                        type="text"
                        value={orderBumpYesBtn}
                        onChange={(e) => setOrderBumpYesBtn(e.target.value)}
                        placeholder="✅ Sim, quero!"
                        className="w-full input-dark"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Texto do botão "Não"</label>
                      <input
                        type="text"
                        value={orderBumpNoBtn}
                        onChange={(e) => setOrderBumpNoBtn(e.target.value)}
                        placeholder="❌ Não, apenas o plano"
                        className="w-full input-dark"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Preço nos botões</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { value: "auto" as const, label: "Mostrar preço" },
                        { value: "hidden" as const, label: "Sem preço" },
                        { value: "custom" as const, label: "Personalizado" },
                      ].map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setOrderBumpPriceMode(opt.value)}
                          className={`p-2 rounded-lg border text-sm transition-all ${
                            orderBumpPriceMode === opt.value
                              ? "border-primary bg-primary/10 ring-1 ring-primary"
                              : "border-border/50 hover:border-border"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    {orderBumpPriceMode === "custom" && (
                      <input
                        type="text"
                        value={orderBumpPriceCustom}
                        onChange={(e) => setOrderBumpPriceCustom(e.target.value)}
                        placeholder="Ex: (apenas R$ 9,90 hoje)"
                        className="w-full input-dark mt-2"
                      />
                    )}
                    <p className="text-xs text-muted-foreground mt-2">
                      Controle como o preço aparece nos botões "Sim" e "Não" no Telegram.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-4 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1 border-border hover:bg-secondary">Cancelar</Button>
            <Button type="submit" className="flex-1 btn-gradient border-0">{plan ? "Salvar" : "Criar Plano"}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
