import { useState, useEffect, useRef } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Rocket, Plus, Trash2, Loader2, Save, Image, Video, X, Pencil, Calendar, Send, Film } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useBots } from "@/contexts/BotContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { SchedulePriceModal } from "@/components/modals/SchedulePriceModal";
import { PageHeader, HeroCard, SectionTitle } from "@/components/ui/stat-kit";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface UpsellOffer {
  id: string;
  name: string;
  description: string;
  price: number;
  media_url: string | null;
  media_type: string | null;
  message: string;
  is_active: boolean;
}

export default function Upsell() {
  const { selectedBot } = useBots();
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [offers, setOffers] = useState<UpsellOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [schedulePriceOffer, setSchedulePriceOffer] = useState<UpsellOffer | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);

  useEffect(() => {
    if (selectedBot) fetchOffers();
    else setLoading(false);
  }, [selectedBot]);

  const fetchOffers = async () => {
    if (!selectedBot) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("upsell_offers")
        .select("*")
        .eq("bot_id", selectedBot.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setOffers((data || []).map((o: any) => ({
        id: o.id,
        name: o.name,
        description: o.description || "",
        price: Number(o.price),
        media_url: o.media_url,
        media_type: o.media_type,
        message: o.message,
        is_active: o.is_active ?? true,
      })));
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    const newOffer: UpsellOffer = {
      id: `new_${Date.now()}`,
      name: "",
      description: "",
      price: 0,
      media_url: null,
      media_type: null,
      message: "",
      is_active: true,
    };
    setOffers([newOffer, ...offers]);
    setEditingId(newOffer.id);
  };

  const updateOffer = (id: string, field: keyof UpsellOffer, value: any) => {
    setOffers(prev => prev.map(o => o.id === id ? { ...o, [field]: value } : o));
  };

  const handleMediaUpload = async (offerId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !selectedBot) return;
    if (/\.(avif|heic|heif|tiff)$/i.test(file.name)) {
      toast({ title: 'Formato não suportado', description: 'O Telegram não aceita AVIF/HEIC/TIFF. Use JPG, PNG ou MP4.', variant: 'destructive' });
      e.target.value = '';
      return;
    }
    const isVideo = file.type.startsWith("video/");
    const isImage = file.type.startsWith("image/");
    if (!isVideo && !isImage) {
      toast({ title: "Arquivo inválido", variant: "destructive" });
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      toast({ title: "Arquivo muito grande (máx 25MB)", variant: "destructive" });
      return;
    }
    setUploadingId(offerId);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/${selectedBot.id}/upsell/${Date.now()}.${fileExt}`;
      const { error } = await supabase.storage.from("bot-media").upload(fileName, file);
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from("bot-media").getPublicUrl(fileName);
      updateOffer(offerId, "media_url", publicUrl);
      updateOffer(offerId, "media_type", isVideo ? "video" : "photo");
    } catch (err) {
      toast({ title: "Erro ao enviar mídia", variant: "destructive" });
    } finally {
      setUploadingId(null);
    }
  };

  const handleSave = async (offer: UpsellOffer) => {
    if (!selectedBot || !offer.name.trim() || !offer.message.trim()) {
      toast({ title: "Preencha nome e mensagem", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        bot_id: selectedBot.id,
        name: offer.name,
        description: offer.description,
        price: offer.price,
        media_url: offer.media_url,
        media_type: offer.media_type,
        message: offer.message,
        is_active: offer.is_active,
      };
      if (offer.id.startsWith("new_")) {
        const { data, error } = await supabase.from("upsell_offers").insert(payload).select().single();
        if (error) throw error;
        setOffers(prev => prev.map(o => o.id === offer.id ? { ...o, id: data.id } : o));
      } else {
        const { error } = await supabase.from("upsell_offers").update(payload).eq("id", offer.id);
        if (error) throw error;
      }
      setEditingId(null);
      toast({ title: "Oferta salva!" });
      await fetchOffers();
    } catch (err) {
      toast({ title: "Erro ao salvar", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!id.startsWith("new_")) {
      await supabase.from("upsell_offers").delete().eq("id", id);
    }
    setOffers(prev => prev.filter(o => o.id !== id));
    toast({ title: "Oferta excluída" });
  };

  const confirmDelete = async () => {
    if (!deleteTargetId) return;
    await handleDelete(deleteTargetId);
    setDeleteTargetId(null);
  };

  const handleTestSend = async (offer: UpsellOffer) => {
    if (!offer.message.trim()) {
      toast({ title: "Preencha a mensagem antes de ativar", variant: "destructive" });
      return;
    }
    setSendingId(offer.id);
    try {
      if (!offer.is_active) {
        await handleSave({ ...offer, is_active: true });
        toast({ title: "Oferta ativada!", description: "Ela será enviada automaticamente após a próxima compra." });
      } else {
        toast({ title: "Oferta já está ativa", description: "Ela é enviada automaticamente após a compra." });
      }
    } finally {
      setSendingId(null);
    }
  };

  if (!selectedBot) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-center glass-card p-12">
            <Rocket className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2">Nenhum bot selecionado</h2>
            <p className="text-muted-foreground">Selecione um bot para configurar o upsell</p>
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
          icon={Rocket}
          title="Upsell"
          subtitle={`Ofertas pós-compra · @${selectedBot.username}`}
          gradient="from-emerald-500 to-teal-500"
          action={
            <Button onClick={handleCreate} className="btn-gradient border-0">
              <Plus className="w-4 h-4 mr-2" />
              Nova Oferta
            </Button>
          }
        />

        <SectionTitle hint="Após a primeira compra, uma oferta adicional é enviada automaticamente para aumentar o ticket médio.">
          Visão geral
        </SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <HeroCard icon={Rocket} label="Ofertas criadas" value={offers.length} color="bg-emerald-500/10 text-emerald-400" />
          <HeroCard
            icon={Rocket}
            label="Ofertas ativas"
            value={offers.filter(o => o.is_active).length}
            color="bg-primary/10 text-primary"
            valueClass="text-primary"
          />
          <HeroCard
            icon={Rocket}
            label="Ticket médio"
            value={`R$ ${(offers.length ? offers.reduce((s, o) => s + o.price, 0) / offers.length : 0).toFixed(2)}`}
            color="bg-amber-500/10 text-amber-400"
          />
        </div>

        {/* Offers */}
        <div className="space-y-5">
          {offers.map((offer, index) => {
            const isEditing = editingId === offer.id;
            return (
              <div key={offer.id} className="glass-card overflow-hidden animate-fade-in hover:border-primary/30 transition-all" style={{ animationDelay: `${0.1 + index * 0.05}s` }}>
                <div className="flex items-center justify-between gap-3 p-5 border-b border-border/30 flex-wrap">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                      <Rocket className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div className="min-w-0">
                      <span className="font-semibold block truncate max-w-[220px]">{offer.name || "Nova oferta"}</span>
                      <span className="text-sm font-mono text-primary">R$ {offer.price.toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!isEditing && (
                      <Button variant="ghost" size="sm" title="Agendar preço" onClick={() => setSchedulePriceOffer(offer)}>
                        <Calendar className="w-4 h-4" />
                      </Button>
                    )}
                    {offer.is_active ? (
                      <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-400">Ativo</span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground">Inativo</span>
                    )}
                  </div>
                </div>

                {isEditing && (
                  <div className="p-5 space-y-5">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">Nome da Oferta</label>
                        <input value={offer.name} onChange={e => updateOffer(offer.id, "name", e.target.value)}
                          placeholder="Ex: Pack Premium" className="w-full bg-secondary/50 border border-border/50 rounded-xl p-3 focus:border-primary" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">Preço (R$)</label>
                        <input type="number" step="0.01" min="0" value={offer.price} onChange={e => updateOffer(offer.id, "price", parseFloat(e.target.value) || 0)}
                          className="w-full bg-secondary/50 border border-border/50 rounded-xl p-3 font-mono focus:border-primary" />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Descrição (opcional)</label>
                      <input value={offer.description} onChange={e => updateOffer(offer.id, "description", e.target.value)}
                        placeholder="Breve descrição da oferta" className="w-full bg-secondary/50 border border-border/50 rounded-xl p-3 focus:border-primary" />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Mensagem de Upsell</label>
                      <textarea value={offer.message} onChange={e => updateOffer(offer.id, "message", e.target.value)}
                        placeholder="Mensagem que será enviada após a compra..." className="w-full bg-secondary/50 border border-border/50 rounded-xl p-4 min-h-[120px] resize-none focus:border-primary" />
                    </div>

                    {/* Media */}
                    <div>
                      <label className="block text-sm font-medium mb-2">Mídia (opcional)</label>
                      <input type="file" ref={fileInputRef} onChange={e => handleMediaUpload(offer.id, e)} accept="image/*,video/*" className="hidden" />
                      {offer.media_url ? (
                        <div className="relative inline-block">
                          {offer.media_type === "video" ? (
                            <video src={offer.media_url} className="max-w-xs h-40 object-cover rounded-lg border border-border" controls />
                          ) : (
                            <img src={offer.media_url} alt="" className="max-w-xs h-40 object-cover rounded-lg border border-border" />
                          )}
                          <Button variant="destructive" size="icon" className="absolute -top-2 -right-2 w-6 h-6"
                            onClick={() => { updateOffer(offer.id, "media_url", null); updateOffer(offer.id, "media_type", null); }}>
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ) : (
                        <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploadingId === offer.id}>
                          {uploadingId === offer.id ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Enviando...</> : <><Image className="w-4 h-4 mr-2" />Adicionar mídia</>}
                        </Button>
                      )}
                    </div>

                    <div className="flex items-center justify-between py-3 border-t border-border/30">
                      <div className="flex items-center gap-3">
                        <Switch checked={offer.is_active} onCheckedChange={v => updateOffer(offer.id, "is_active", v)} />
                        <span className="text-sm">{offer.is_active ? "Ativo" : "Inativo"}</span>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="ghost" onClick={() => setEditingId(null)}>Cancelar</Button>
                        <Button onClick={() => handleSave(offer)} disabled={saving} className="btn-gradient border-0">
                          {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Salvando...</> : <><Save className="w-4 h-4 mr-2" />Salvar</>}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {!isEditing && (
                  <div className="p-5 flex flex-col xl:flex-row xl:items-center gap-4">
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                      {offer.media_url && (
                        <div className="shrink-0">
                          {offer.media_type === "video" ? (
                            <video src={offer.media_url} className="w-20 h-20 object-cover rounded-lg border border-border" />
                          ) : (
                            <img src={offer.media_url} alt="" className="w-20 h-20 object-cover rounded-lg border border-border" />
                          )}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{offer.message || "Sem mensagem"}</p>
                        <div className="flex flex-wrap gap-2">
                          {offer.description && (
                            <span className="text-xs bg-secondary px-2 py-1 rounded-full">{offer.description}</span>
                          )}
                          {offer.media_url && (
                            <span className="text-xs bg-secondary px-2 py-1 rounded-full flex items-center gap-1">
                              {offer.media_type === "video" ? <Film className="w-3 h-3" /> : <Image className="w-3 h-3" />}
                              Mídia
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 pt-3 border-t border-border/30 xl:pt-0 xl:border-t-0 xl:border-l xl:border-border/30 xl:pl-4">
                      <Button
                        onClick={() => handleTestSend(offer)}
                        disabled={sendingId === offer.id || offer.id.startsWith("new_")}
                        size="sm"
                        className="btn-gradient flex-1 xl:flex-none"
                      >
                        {sendingId === offer.id ? (
                          <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Enviando...</>
                        ) : (
                          <><Send className="w-4 h-4 mr-1.5" /> Enviar</>
                        )}
                      </Button>
                      <Button variant="outline" size="sm" className="flex-1 xl:flex-none" onClick={() => setEditingId(offer.id)}>
                        <Pencil className="w-4 h-4 mr-1.5" /> Editar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="flex-1 xl:flex-none text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => setDeleteTargetId(offer.id)}
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

        {offers.length === 0 && (
          <div className="glass-card p-12 text-center animate-fade-in">
            <Rocket className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">Nenhuma oferta de upsell</h3>
            <p className="text-muted-foreground mb-6">Crie sua primeira oferta de upsell pós-compra</p>
            <Button onClick={handleCreate} className="btn-gradient">
              <Plus className="w-4 h-4 mr-2" /> Criar Oferta
            </Button>
          </div>
        )}
      </div>

      {schedulePriceOffer && selectedBot && (
        <SchedulePriceModal
          isOpen={!!schedulePriceOffer}
          onClose={() => setSchedulePriceOffer(null)}
          targetId={schedulePriceOffer.id}
          targetType="upsell"
          targetName={schedulePriceOffer.name}
          currentPrice={schedulePriceOffer.price}
          botId={selectedBot.id}
          onSaved={fetchOffers}
        />
      )}

      <AlertDialog open={!!deleteTargetId} onOpenChange={(open) => !open && setDeleteTargetId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir oferta de upsell?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação não pode ser desfeita. A oferta será removida permanentemente.
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
