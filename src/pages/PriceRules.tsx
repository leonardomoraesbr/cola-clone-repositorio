import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { useBots } from "@/contexts/BotContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { PageHeader, StatCard, Panel } from "@/components/ui/stat-kit";
import {
  Plus,
  Trash2,
  CalendarDays,
  CalendarClock,
  Power,
  PowerOff,
  Tag,
  Clock,
  ArrowRight,
  DollarSign,
  Percent,
  Timer,
  RefreshCw,
  ListChecks,
  PlayCircle,
} from "lucide-react";

interface PriceRule {
  id: string;
  bot_id: string;
  target_type: string;
  target_id: string | null;
  plan_id: string | null;
  rule_type: string;
  rule_config: any;
  new_price: number;
  original_price: number | null;
  is_active: boolean;
  priority: number;
  created_at: string;
}

interface Plan {
  id: string;
  name: string;
  price: number;
  order_bump_enabled: boolean;
  order_bump_name: string | null;
  order_bump_price: number | null;
}

interface UpsellOffer {
  id: string;
  name: string;
  price: number;
}

interface DownsellMessage {
  id: string;
  message: string;
  discount_percentage: number;
  order_index: number;
}

const DAY_NAMES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const TARGET_TYPE_OPTIONS = [
  { value: "plan", label: "Plano", Icon: Tag },
  { value: "upsell", label: "Upsell", Icon: Tag },
  { value: "order_bump", label: "Order Bump", Icon: Tag },
  { value: "downsell", label: "Downsell", Icon: Percent },
];

const RULE_TYPE_OPTIONS = [
  { value: "month_period", label: "Período do Mês", Icon: CalendarDays },
  { value: "day_of_week", label: "Dia da Semana", Icon: Clock },
  { value: "time_range", label: "Horário", Icon: Timer },
];

export default function PriceRules() {
  const { selectedBot } = useBots();
  const { toast } = useToast();
  const [rules, setRules] = useState<PriceRule[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [upsells, setUpsells] = useState<UpsellOffer[]>([]);
  const [downsells, setDownsells] = useState<DownsellMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [targetType, setTargetType] = useState("plan");
  const [selectedTarget, setSelectedTarget] = useState("");
  const [ruleType, setRuleType] = useState("month_period");
  const [monthStart, setMonthStart] = useState("1");
  const [monthEnd, setMonthEnd] = useState("15");
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [hourStart, setHourStart] = useState("18");
  const [hourEnd, setHourEnd] = useState("23");
  const [newPrice, setNewPrice] = useState("");
  const [saving, setSaving] = useState(false);
  const [forceRunning, setForceRunning] = useState(false);

  useEffect(() => {
    if (selectedBot) fetchAll();
  }, [selectedBot]);

  const fetchAll = async () => {
    if (!selectedBot) return;
    setLoading(true);
    const [rulesRes, plansRes, upsellsRes, downsellsRes] = await Promise.all([
      supabase.from("price_rules").select("*").eq("bot_id", selectedBot.id).order("created_at", { ascending: false }),
      supabase.from("subscription_plans").select("*").eq("bot_id", selectedBot.id),
      supabase.from("upsell_offers").select("*").eq("bot_id", selectedBot.id),
      supabase.from("downsell_messages").select("*").eq("bot_id", selectedBot.id).order("order_index"),
    ]);
    setRules((rulesRes.data as any[]) || []);
    setPlans(plansRes.data || []);
    setUpsells(upsellsRes.data || []);
    setDownsells(downsellsRes.data || []);
    setLoading(false);
  };

  const getTargetOptions = () => {
    if (targetType === "plan") return plans.map(p => ({ id: p.id, label: `${p.name} (R$${p.price})` }));
    if (targetType === "upsell") return upsells.map(u => ({ id: u.id, label: `${u.name} (R$${u.price})` }));
    if (targetType === "order_bump") return plans.filter(p => p.order_bump_enabled).map(p => ({ id: p.id, label: `${p.order_bump_name || p.name} (R$${p.order_bump_price || 0})` }));
    if (targetType === "downsell") return downsells.map(d => ({ id: d.id, label: `Downsell #${d.order_index + 1} (${d.discount_percentage}%)` }));
    return [];
  };

  const getTargetName = (rule: PriceRule) => {
    if (rule.target_type === "plan" || rule.target_type === "order_bump") {
      const plan = plans.find(p => p.id === rule.plan_id);
      if (rule.target_type === "order_bump") return plan?.order_bump_name || plan?.name || "—";
      return plan?.name || "—";
    }
    if (rule.target_type === "upsell") {
      return upsells.find(u => u.id === rule.target_id)?.name || "—";
    }
    if (rule.target_type === "downsell") {
      const d = downsells.find(dd => dd.id === rule.target_id);
      return d ? `Downsell #${d.order_index + 1}` : "—";
    }
    return "—";
  };

  const toggleDay = (day: number) => {
    setSelectedDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBot || !selectedTarget || !newPrice) return;

    if (ruleType === "day_of_week" && selectedDays.length === 0) {
      toast({ title: "Selecione pelo menos um dia", variant: "destructive" });
      return;
    }

    setSaving(true);

    let ruleConfig: any;
    if (ruleType === "month_period") {
      ruleConfig = { start_day: parseInt(monthStart), end_day: parseInt(monthEnd) };
    } else if (ruleType === "day_of_week") {
      ruleConfig = { days: selectedDays.sort() };
    } else {
      ruleConfig = { hour_start: parseInt(hourStart), hour_end: parseInt(hourEnd) };
    }

    // Get original price
    let originalPrice = 0;
    if (targetType === "plan") {
      originalPrice = plans.find(p => p.id === selectedTarget)?.price || 0;
    } else if (targetType === "upsell") {
      originalPrice = upsells.find(u => u.id === selectedTarget)?.price || 0;
    } else if (targetType === "order_bump") {
      originalPrice = plans.find(p => p.id === selectedTarget)?.order_bump_price || 0;
    } else if (targetType === "downsell") {
      originalPrice = downsells.find(d => d.id === selectedTarget)?.discount_percentage || 0;
    }

    const insertData: any = {
      bot_id: selectedBot.id,
      target_type: targetType,
      rule_type: ruleType,
      rule_config: ruleConfig,
      new_price: parseFloat(newPrice),
      original_price: originalPrice,
      is_active: true,
    };

    if (targetType === "plan" || targetType === "order_bump") {
      insertData.plan_id = selectedTarget;
    } else {
      insertData.target_id = selectedTarget;
    }

    const { error } = await supabase.from("price_rules").insert(insertData);

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Regra criada!", description: "A regra de preço automático foi salva." });
      setShowForm(false);
      resetForm();
      fetchAll();
    }
    setSaving(false);
  };

  const resetForm = () => {
    setTargetType("plan");
    setSelectedTarget("");
    setRuleType("month_period");
    setMonthStart("1");
    setMonthEnd("15");
    setSelectedDays([]);
    setHourStart("18");
    setHourEnd("23");
    setNewPrice("");
  };

  const toggleRule = async (rule: PriceRule) => {
    const newActive = !rule.is_active;
    const { error } = await supabase.from("price_rules").update({ is_active: newActive }).eq("id", rule.id);
    if (error) {
      toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
      return;
    }

    // If deactivating, revert to original price immediately
    if (!newActive && rule.original_price != null) {
      const tt = rule.target_type;
      if (tt === "plan" && rule.plan_id) {
        await supabase.from("subscription_plans").update({ price: rule.original_price }).eq("id", rule.plan_id);
      } else if (tt === "upsell" && rule.target_id) {
        await supabase.from("upsell_offers").update({ price: rule.original_price }).eq("id", rule.target_id);
      } else if (tt === "order_bump" && rule.plan_id) {
        await supabase.from("subscription_plans").update({ order_bump_price: rule.original_price }).eq("id", rule.plan_id);
      } else if (tt === "downsell" && rule.target_id) {
        await supabase.from("downsell_messages").update({ discount_percentage: rule.original_price }).eq("id", rule.target_id);
      }
      toast({ title: "Regra desativada", description: "Preço revertido ao valor original." });
    } else if (newActive) {
      toast({ title: "Regra ativada", description: "Será aplicada na próxima verificação (até 1 min)." });
    }

    fetchAll();
  };

  const forceApplyRules = async () => {
    setForceRunning(true);
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await supabase.functions.invoke("apply-price-rules");
      if (res.error) throw res.error;
      toast({ title: "Regras processadas!", description: `Aplicadas: ${res.data?.applied || 0} | Revertidas: ${res.data?.reverted || 0}` });
      fetchAll();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
    setForceRunning(false);
  };

  const deleteRule = async (id: string) => {
    const rule = rules.find(r => r.id === id);
    // Revert price before deleting
    if (rule && rule.original_price != null) {
      const tt = rule.target_type;
      if (tt === "plan" && rule.plan_id) {
        await supabase.from("subscription_plans").update({ price: rule.original_price }).eq("id", rule.plan_id);
      } else if (tt === "upsell" && rule.target_id) {
        await supabase.from("upsell_offers").update({ price: rule.original_price }).eq("id", rule.target_id);
      } else if (tt === "order_bump" && rule.plan_id) {
        await supabase.from("subscription_plans").update({ order_bump_price: rule.original_price }).eq("id", rule.plan_id);
      } else if (tt === "downsell" && rule.target_id) {
        await supabase.from("downsell_messages").update({ discount_percentage: rule.original_price }).eq("id", rule.target_id);
      }
    }

    const { error } = await supabase.from("price_rules").delete().eq("id", id);
    if (!error) {
      toast({ title: "Regra removida", description: "Preço revertido ao valor original." });
      fetchAll();
    }
  };

  const formatRuleDescription = (rule: PriceRule) => {
    const config = rule.rule_config;
    if (rule.rule_type === "month_period") {
      return `Dia ${config.start_day} ao ${config.end_day} do mês`;
    }
    if (rule.rule_type === "day_of_week") {
      return (config.days || []).map((d: number) => DAY_NAMES[d]).join(", ");
    }
    if (rule.rule_type === "time_range") {
      return `${String(config.hour_start).padStart(2, "0")}:00 às ${String(config.hour_end).padStart(2, "0")}:00`;
    }
    return "—";
  };

  const getRuleIcon = (ruleType: string) => {
    if (ruleType === "month_period") return <CalendarDays className="w-5 h-5 text-blue-400" />;
    if (ruleType === "day_of_week") return <Clock className="w-5 h-5 text-purple-400" />;
    return <Timer className="w-5 h-5 text-amber-400" />;
  };

  const getRuleIconBg = (ruleType: string) => {
    if (ruleType === "month_period") return "bg-blue-500/20";
    if (ruleType === "day_of_week") return "bg-purple-500/20";
    return "bg-amber-500/20";
  };

  const isDowsell = (rule: PriceRule) => rule.target_type === "downsell";

  const activeRulesCount = rules.filter(r => r.is_active).length;
  const affectedPlanIds = new Set(rules.filter(r => r.plan_id).map(r => r.plan_id));
  const nextRule = rules.find(r => r.is_active);
  const nextRuleLabel = nextRule ? formatRuleDescription(nextRule) : "Nenhuma";

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          icon={CalendarClock}
          title="Preço Automático"
          subtitle="Configure alterações automáticas de preço por período, dia da semana ou horário"
          action={
            <div className="flex gap-2">
              {selectedBot && rules.length > 0 && (
                <Button
                  variant="outline"
                  onClick={forceApplyRules}
                  disabled={forceRunning}
                  className="border-border"
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${forceRunning ? "animate-spin" : ""}`} />
                  {forceRunning ? "Processando..." : "Aplicar Agora"}
                </Button>
              )}
              <Button onClick={() => setShowForm(!showForm)} className="btn-gradient border-0">
                <Plus className="w-4 h-4 mr-2" />
                Nova Regra
              </Button>
            </div>
          }
        />

        {selectedBot && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              icon={ListChecks}
              label="Total de regras"
              value={rules.length}
              color="bg-primary/20 text-primary"
              bar="bg-primary"
              progress={rules.length > 0 ? 100 : 0}
            />
            <StatCard
              icon={Power}
              label="Regras ativas"
              value={activeRulesCount}
              subValue={`${rules.length - activeRulesCount} inativas`}
              color="bg-green-500/20 text-green-400"
              bar="bg-green-400"
              progress={rules.length > 0 ? (activeRulesCount / rules.length) * 100 : 0}
            />
            <StatCard
              icon={PlayCircle}
              label="Próxima execução"
              value={nextRule ? "Em andamento" : "—"}
              subValue={nextRuleLabel}
              color="bg-amber-500/20 text-amber-400"
              bar="bg-amber-400"
              progress={nextRule ? 100 : 0}
            />
            <StatCard
              icon={Tag}
              label="Planos afetados"
              value={affectedPlanIds.size}
              color="bg-teal-500/20 text-teal-400"
              bar="bg-teal-400"
              progress={affectedPlanIds.size > 0 ? 100 : 0}
            />
          </div>
        )}

        {!selectedBot && (
          <div className="glass-card p-8 text-center text-muted-foreground">
            Selecione um bot para gerenciar regras de preço
          </div>
        )}

        {selectedBot && showForm && (
          <form onSubmit={handleSubmit} className="glass-card p-6 space-y-5 animate-scale-in">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <CalendarClock className="w-5 h-5 text-primary" />
              Criar Regra de Preço
            </h3>

            {/* Target type */}
            <div>
              <label className="block text-sm font-medium mb-2">Tipo do alvo</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {TARGET_TYPE_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => { setTargetType(opt.value); setSelectedTarget(""); }}
                    className={`p-3 rounded-xl text-sm font-medium transition-all flex items-center gap-2 justify-center ${
                      targetType === opt.value
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary/50 hover:bg-secondary text-muted-foreground"
                    }`}
                  >
                    <opt.Icon className="w-4 h-4" />
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Target select */}
            <div>
              <label className="block text-sm font-medium mb-2">
                {targetType === "downsell" ? "Mensagem de Downsell" : "Selecionar item"}
              </label>
              <select
                value={selectedTarget}
                onChange={e => setSelectedTarget(e.target.value)}
                className="w-full input-dark"
                required
              >
                <option value="">Selecione...</option>
                {getTargetOptions().map(opt => (
                  <option key={opt.id} value={opt.id}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* Rule type */}
            <div>
              <label className="block text-sm font-medium mb-2">Tipo da regra</label>
              <div className="grid grid-cols-3 gap-2">
                {RULE_TYPE_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setRuleType(opt.value)}
                    className={`p-3 rounded-xl text-sm font-medium transition-all flex items-center gap-2 justify-center ${
                      ruleType === opt.value
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary/50 hover:bg-secondary text-muted-foreground"
                    }`}
                  >
                    <opt.Icon className="w-4 h-4" />
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Config by rule type */}
            {ruleType === "month_period" && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Dia inicial</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={monthStart}
                    onChange={e => setMonthStart(e.target.value)}
                    className="w-full input-dark"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Dia final</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={monthEnd}
                    onChange={e => setMonthEnd(e.target.value)}
                    className="w-full input-dark"
                    required
                  />
                </div>
              </div>
            )}

            {ruleType === "day_of_week" && (
              <div>
                <label className="block text-sm font-medium mb-2">Dias ativos</label>
                <div className="flex gap-2">
                  {DAY_NAMES.map((name, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => toggleDay(idx)}
                      className={`w-11 h-11 rounded-xl text-xs font-bold transition-all ${
                        selectedDays.includes(idx)
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary/50 hover:bg-secondary text-muted-foreground"
                      }`}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {ruleType === "time_range" && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Hora início</label>
                  <select
                    value={hourStart}
                    onChange={e => setHourStart(e.target.value)}
                    className="w-full input-dark"
                    required
                  >
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={i}>{String(i).padStart(2, "0")}:00</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Hora fim</label>
                  <select
                    value={hourEnd}
                    onChange={e => setHourEnd(e.target.value)}
                    className="w-full input-dark"
                    required
                  >
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={i}>{String(i).padStart(2, "0")}:00</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* New price */}
            <div>
              <label className="block text-sm font-medium mb-2">
                {targetType === "downsell" ? "Novo desconto (%)" : "Novo preço (R$)"}
              </label>
              <input
                type="number"
                step={targetType === "downsell" ? "1" : "0.01"}
                min="0"
                value={newPrice}
                onChange={e => setNewPrice(e.target.value)}
                placeholder={targetType === "downsell" ? "15" : "0.00"}
                className="w-full input-dark font-mono"
                required
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => { setShowForm(false); resetForm(); }} className="flex-1 border-border">
                Cancelar
              </Button>
              <Button type="submit" disabled={saving} className="flex-1 btn-gradient border-0">
                {saving ? "Salvando..." : "Criar Regra"}
              </Button>
            </div>
          </form>
        )}

        {/* Rules list */}
        {selectedBot && !loading && rules.length === 0 && !showForm && (
          <div className="glass-card p-8 text-center text-muted-foreground">
            Nenhuma regra criada. Clique em "Nova Regra" para começar.
          </div>
        )}

        {selectedBot && rules.length > 0 && (
          <Panel icon={ListChecks} title="Regras Configuradas" subtitle={`${rules.length} regra(s)`}>
          <div className="space-y-3">
            {rules.map(rule => (
              <div key={rule.id} className={`glass-card p-4 flex items-center gap-4 transition-all hover:border-primary/40 ${!rule.is_active ? "opacity-50" : ""}`}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${getRuleIconBg(rule.rule_type)}`}>
                  {getRuleIcon(rule.rule_type)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide ${rule.is_active ? "bg-green-500/20 text-green-400" : "bg-secondary text-muted-foreground"}`}>
                      {rule.is_active ? "Ativa" : "Inativa"}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary font-medium uppercase">
                      {TARGET_TYPE_OPTIONS.find(t => t.value === rule.target_type)?.label}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground font-medium">
                      {RULE_TYPE_OPTIONS.find(r => r.value === rule.rule_type)?.label}
                    </span>
                    <span className="font-semibold text-sm truncate">{getTargetName(rule)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                    <span>{formatRuleDescription(rule)}</span>
                    <ArrowRight className="w-3 h-3" />
                    <span className="text-foreground font-mono font-semibold">
                      {isDowsell(rule) ? `${rule.new_price}%` : `R$${rule.new_price.toFixed(2)}`}
                    </span>
                    {rule.original_price != null && (
                      <span className="text-muted-foreground">
                        (original: {isDowsell(rule) ? `${rule.original_price}%` : `R$${rule.original_price.toFixed(2)}`})
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => toggleRule(rule)}
                    className={`p-2 rounded-lg transition-colors ${rule.is_active ? "text-green-400 hover:bg-green-500/20" : "text-muted-foreground hover:bg-secondary"}`}
                    title={rule.is_active ? "Desativar (reverte preço)" : "Ativar"}
                  >
                    {rule.is_active ? <Power className="w-4 h-4" /> : <PowerOff className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => deleteRule(rule.id)}
                    className="p-2 rounded-lg text-red-400 hover:bg-red-500/20 transition-colors"
                    title="Remover (reverte preço)"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          </Panel>
        )}

        {/* Info card */}
        <div className="glass-card p-4 border border-primary/20">
          <h4 className="font-semibold text-sm flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 text-primary" />
            Como funciona
          </h4>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>• <strong>Período do Mês:</strong> O preço muda entre os dias configurados (ex: dia 1 a 15 = R$67)</li>
            <li>• <strong>Dia da Semana:</strong> O preço muda nos dias selecionados (ex: Sex-Dom = R$47)</li>
            <li>• <strong>Horário:</strong> O preço muda em horários específicos (ex: 18h às 23h = R$37)</li>
            <li>• Fora do período/dias/horário configurados, o preço volta ao original automaticamente</li>
            <li>• Ao desativar ou excluir uma regra, o preço é revertido imediatamente</li>
            <li>• Use o botão "Aplicar Agora" para forçar a verificação sem esperar o ciclo automático</li>
          </ul>
        </div>
      </div>
    </MainLayout>
  );
}
