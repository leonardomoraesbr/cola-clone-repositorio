import { useState } from "react";
import { X, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface SchedulePriceModalProps {
  isOpen: boolean;
  onClose: () => void;
  planId?: string;
  targetId?: string;
  targetType: "plan" | "upsell" | "order_bump";
  targetName: string;
  currentPrice: number;
  botId: string;
  onSaved: () => void;
}

export function SchedulePriceModal({
  isOpen,
  onClose,
  planId,
  targetId,
  targetType,
  targetName,
  currentPrice,
  botId,
  onSaved,
}: SchedulePriceModalProps) {
  const [newPrice, setNewPrice] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  if (!isOpen) return null;

  const typeLabels: Record<string, string> = {
    plan: "Plano",
    upsell: "Upsell",
    order_bump: "Order Bump",
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPrice || !scheduledDate || !scheduledTime) return;

    setSaving(true);
    try {
      const scheduledAt = new Date(`${scheduledDate}T${scheduledTime}:00`).toISOString();

      const insertData: any = {
        bot_id: botId,
        new_price: parseFloat(newPrice),
        scheduled_at: scheduledAt,
        target_type: targetType,
      };

      if (targetType === "plan" || targetType === "order_bump") {
        insertData.plan_id = planId;
      }
      if (targetType === "upsell") {
        insertData.target_id = targetId;
      }

      const { error } = await supabase.from("scheduled_price_changes").insert(insertData);

      if (error) throw error;

      toast({ title: "Agendamento criado!", description: `O preço será alterado para R$${newPrice} na data programada.` });
      onSaved();
      onClose();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md mx-4 glass-card p-6 animate-scale-in">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Agendar Preço</h2>
              <p className="text-sm text-muted-foreground">{typeLabels[targetType]}: {targetName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-secondary rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Preço atual</label>
            <div className="input-dark text-muted-foreground font-mono">
              R$ {currentPrice.toFixed(2)}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Novo preço (R$)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={newPrice}
              onChange={e => setNewPrice(e.target.value)}
              placeholder="0.00"
              className="w-full input-dark font-mono"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Data</label>
              <input
                type="date"
                value={scheduledDate}
                onChange={e => setScheduledDate(e.target.value)}
                className="w-full input-dark"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Hora</label>
              <input
                type="time"
                value={scheduledTime}
                onChange={e => setScheduledTime(e.target.value)}
                className="w-full input-dark"
                required
              />
            </div>
          </div>

          <div className="flex gap-4 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1 border-border hover:bg-secondary">
              Cancelar
            </Button>
            <Button type="submit" disabled={saving} className="flex-1 btn-gradient border-0">
              {saving ? "Salvando..." : "Agendar"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
