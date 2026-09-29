import { useState, useEffect, useRef } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useBots } from "@/contexts/BotContext";
import { useAuth } from "@/contexts/AuthContext";
import { Bot, Loader2, FlaskConical, Trophy, Plus, Image as ImageIcon, X, Upload, DollarSign, Package, Activity, MousePointerClick, Award } from "lucide-react";
import { PageHeader, StatCard, Panel } from "@/components/ui/stat-kit";

interface ABTest {
  id?: string;
  bot_id: string;
  name: string;
  variant_a_message: string;
  variant_a_media_url: string | null;
  variant_a_media_type: string | null;
  variant_a_plan_id: string | null;
  variant_a_bump_plan_id: string | null;
  variant_a_price_override: number | null;
  variant_b_message: string;
  variant_b_media_url: string | null;
  variant_b_media_type: string | null;
  variant_b_plan_id: string | null;
  variant_b_bump_plan_id: string | null;
  variant_b_price_override: number | null;
  is_active: boolean;
  winner: string | null;
  started_at: string | null;
  ended_at: string | null;
}

interface Plan { id: string; name: string; price: number; order_bump_enabled?: boolean | null; order_bump_name?: string | null; order_bump_price?: number | null; }

interface TestStats {
  variant: string;
  starts: number;
  clicks: number;
  payments: number;
}

const emptyTest = (): ABTest => ({
  bot_id: "",
  name: "Teste A/B",
  variant_a_message: "",
  variant_a_media_url: null,
  variant_a_media_type: null,
  variant_a_plan_id: null,
  variant_a_bump_plan_id: null,
  variant_a_price_override: null,
  variant_b_message: "",
  variant_b_media_url: null,
  variant_b_media_type: null,
  variant_b_plan_id: null,
  variant_b_bump_plan_id: null,
  variant_b_price_override: null,
  is_active: false,
  winner: null,
  started_at: null,
  ended_at: null,
});

export default function ABTesting() {
  const { selectedBot } = useBots();
  const { user } = useAuth();
  const { toast } = useToast();
  const [tests, setTests] = useState<ABTest[]>([]);
  const [testStats, setTestStats] = useState<Record<string, TestStats[]>>({});
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<"a" | "b" | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newTest, setNewTest] = useState<ABTest>(emptyTest());

  useEffect(() => {
    if (selectedBot) {
      setNewTest(prev => ({ ...prev, bot_id: selectedBot.id }));
      fetchTests();
      fetchPlans();
    } else setLoading(false);
  }, [selectedBot]);

  const fetchPlans = async () => {
    if (!selectedBot) return;
    const { data } = await supabase
      .from("subscription_plans")
      .select("id, name, price, order_bump_enabled, order_bump_name, order_bump_price")
      .eq("bot_id", selectedBot.id)
      .order("sort_order", { ascending: true });
    setPlans((data as any) || []);
  };

  const uploadMedia = async (variant: "a" | "b", e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !selectedBot) return;
    const isVideo = file.type.startsWith("video/");
    const isImage = file.type.startsWith("image/");
    const isAudio = file.type.startsWith("audio/");
    if (!isVideo && !isImage && !isAudio) {
      toast({ title: "Envie imagem, vídeo ou áudio", variant: "destructive" });
      return;
    }
    const maxBytes = isVideo ? 50 * 1024 * 1024 : 25 * 1024 * 1024;
    if (file.size > maxBytes) {
      toast({ title: `Arquivo muito grande (máx ${isVideo ? 50 : 25}MB)`, variant: "destructive" });
      return;
    }
    setUploading(variant);
    try {
      const ext = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
      const path = `${user.id}/${selectedBot.id}/abtest/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("bot-media").upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from("bot-media").getPublicUrl(path);
      const mediaType = isVideo ? "video" : isAudio ? "audio" : "photo";
      setNewTest(p => ({
        ...p,
        [`variant_${variant}_media_url`]: publicUrl,
        [`variant_${variant}_media_type`]: mediaType,
      } as any));
      toast({ title: "Mídia anexada" });
    } catch (err: any) {
      toast({ title: "Erro no upload", description: err?.message, variant: "destructive" });
    } finally {
      setUploading(null);
      if (e.target) e.target.value = "";
    }
  };

  const fetchTests = async () => {
    if (!selectedBot) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("ab_tests")
        .select("*")
        .eq("bot_id", selectedBot.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setTests((data as any) || []);

      // Fetch stats for each test
      if (data && data.length > 0) {
        const statsMap: Record<string, TestStats[]> = {};
        for (const test of data) {
          const { data: events } = await supabase
            .from("ab_test_events")
            .select("variant, event_type")
            .eq("ab_test_id", test.id);

          const aStats: TestStats = { variant: "a", starts: 0, clicks: 0, payments: 0 };
          const bStats: TestStats = { variant: "b", starts: 0, clicks: 0, payments: 0 };

          (events || []).forEach((e: any) => {
            const s = e.variant === "a" ? aStats : bStats;
            if (e.event_type === "start") s.starts++;
            if (e.event_type === "click") s.clicks++;
            if (e.event_type === "payment") s.payments++;
          });

          statsMap[test.id] = [aStats, bStats];
        }
        setTestStats(statsMap);
      }
    } catch (error) {
      console.error("Error fetching tests:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!selectedBot || !newTest.variant_a_message || !newTest.variant_b_message) {
      toast({ title: "Preencha as duas variantes", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("ab_tests").insert({
        bot_id: selectedBot.id,
        name: newTest.name,
        variant_a_message: newTest.variant_a_message,
        variant_a_media_url: newTest.variant_a_media_url,
        variant_a_media_type: newTest.variant_a_media_type,
        variant_a_plan_id: newTest.variant_a_plan_id,
        variant_a_bump_plan_id: newTest.variant_a_bump_plan_id,
        variant_a_price_override: newTest.variant_a_price_override,
        variant_b_message: newTest.variant_b_message,
        variant_b_media_url: newTest.variant_b_media_url,
        variant_b_media_type: newTest.variant_b_media_type,
        variant_b_plan_id: newTest.variant_b_plan_id,
        variant_b_bump_plan_id: newTest.variant_b_bump_plan_id,
        variant_b_price_override: newTest.variant_b_price_override,
        is_active: false,
      } as any);
      if (error) throw error;
      toast({ title: "Teste criado!" });
      setShowCreate(false);
      setNewTest({ ...emptyTest(), bot_id: selectedBot.id });
      await fetchTests();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const toggleTest = async (test: ABTest) => {
    try {
      // Deactivate all other tests first
      if (!test.is_active) {
        await supabase.from("ab_tests").update({ is_active: false } as any).eq("bot_id", selectedBot!.id);
      }
      await supabase.from("ab_tests").update({
        is_active: !test.is_active,
        started_at: !test.is_active ? new Date().toISOString() : test.started_at,
        ended_at: test.is_active ? new Date().toISOString() : null,
      } as any).eq("id", test.id!);
      await fetchTests();
    } catch (error) {
      console.error(error);
    }
  };

  const selectWinner = async (testId: string, winner: string) => {
    try {
      await supabase.from("ab_tests").update({
        winner, is_active: false, ended_at: new Date().toISOString(),
      } as any).eq("id", testId);
      toast({ title: `Variante ${winner.toUpperCase()} selecionada como vencedora!` });
      await fetchTests();
    } catch (error) {
      console.error(error);
    }
  };

  const deleteTest = async (testId: string) => {
    try {
      await supabase.from("ab_tests").delete().eq("id", testId);
      toast({ title: "Teste removido" });
      await fetchTests();
    } catch (error) {
      console.error(error);
    }
  };

  if (!selectedBot) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
          <Bot className="w-16 h-16 text-muted-foreground mb-4" />
          <h2 className="text-xl font-bold mb-2">Nenhum bot selecionado</h2>
          <p className="text-muted-foreground">Selecione um bot para criar testes A/B</p>
        </div>
      </MainLayout>
    );
  }

  const activeTestsCount = tests.filter(t => t.is_active).length;
  const totalVariants = tests.length * 2;
  const totals = tests.reduce(
    (acc, t) => {
      const s = testStats[t.id!] || [];
      s.forEach(v => {
        acc.clicks += v.clicks;
        acc.payments += v.payments;
      });
      return acc;
    },
    { clicks: 0, payments: 0 }
  );

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <PageHeader
          icon={FlaskConical}
          title="Teste A/B"
          subtitle="Compare mensagens e descubra qual converte mais"
          gradient="from-violet-500 to-fuchsia-500"
          action={
            <Button onClick={() => setShowCreate(!showCreate)} className="btn-gradient">
              <Plus className="w-4 h-4 mr-2" />
              Novo Teste
            </Button>
          }
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={FlaskConical}
            label="Testes ativos"
            value={activeTestsCount}
            subValue={`${tests.length} total`}
            color="bg-primary/20 text-primary"
            bar="bg-primary"
            progress={tests.length > 0 ? (activeTestsCount / tests.length) * 100 : 0}
          />
          <StatCard
            icon={Activity}
            label="Variantes"
            value={totalVariants}
            subValue="A e B por teste"
            color="bg-violet-500/20 text-violet-400"
            bar="bg-violet-400"
            progress={totalVariants > 0 ? 100 : 0}
          />
          <StatCard
            icon={MousePointerClick}
            label="Cliques totais"
            value={totals.clicks}
            color="bg-amber-500/20 text-amber-400"
            bar="bg-amber-400"
            progress={totals.clicks > 0 ? 100 : 0}
          />
          <StatCard
            icon={Award}
            label="Conversões"
            value={totals.payments}
            color="bg-green-500/20 text-green-400"
            bar="bg-green-400"
            progress={totals.payments > 0 ? 100 : 0}
          />
        </div>

        {/* Info */}
        <div className="glass-card p-4 animate-fade-in border-l-4 border-primary">
          <p className="text-sm text-muted-foreground">
            Crie 2 versões da mensagem inicial e o sistema divide o tráfego 50/50. Acompanhe qual versão tem mais cliques e pagamentos.
          </p>
        </div>

        {/* Create Form */}
        {showCreate && (
          <div className="glass-card p-6 animate-fade-in space-y-4">
            <h3 className="font-semibold">Criar Novo Teste</h3>
            <div>
              <label className="block text-sm font-medium mb-2">Nome do Teste</label>
              <input
                value={newTest.name}
                onChange={e => setNewTest(p => ({ ...p, name: e.target.value }))}
                className="w-full input-dark"
                placeholder="Ex: Copy A vs B, Preço 47 vs 67..."
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(["a", "b"] as const).map((v) => {
                const colorClass = v === "a" ? "text-blue-400 border-blue-500/30 bg-blue-500/5" : "text-orange-400 border-orange-500/30 bg-orange-500/5";
                const label = v.toUpperCase();
                const msg = v === "a" ? newTest.variant_a_message : newTest.variant_b_message;
                const mediaUrl = v === "a" ? newTest.variant_a_media_url : newTest.variant_b_media_url;
                const mediaType = v === "a" ? newTest.variant_a_media_type : newTest.variant_b_media_type;
                const planId = v === "a" ? newTest.variant_a_plan_id : newTest.variant_b_plan_id;
                const bumpId = v === "a" ? newTest.variant_a_bump_plan_id : newTest.variant_b_bump_plan_id;
                const price = v === "a" ? newTest.variant_a_price_override : newTest.variant_b_price_override;
                const setField = (field: string, value: any) =>
                  setNewTest(p => ({ ...p, [`variant_${v}_${field}`]: value } as any));
                return (
                  <div key={v} className={`p-4 rounded-xl border ${colorClass} space-y-3`}>
                    <p className={`text-sm font-semibold ${v === "a" ? "text-blue-400" : "text-orange-400"}`}>Variante {label}</p>

                    <div>
                      <label className="block text-xs font-medium mb-1 text-muted-foreground">Mensagem inicial</label>
                      <textarea
                        value={msg}
                        onChange={e => setField("message", e.target.value)}
                        rows={4}
                        className="w-full input-dark resize-none text-sm"
                        placeholder={`Mensagem versão ${label}...`}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium mb-1 text-muted-foreground flex items-center gap-1">
                        <ImageIcon className="w-3 h-3" /> Mídia (foto, vídeo ou áudio)
                      </label>
                      {mediaUrl ? (
                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary/50 border border-border/50 text-xs">
                          <span className="flex-1 truncate">📎 Mídia anexada ({mediaType})</span>
                          <button onClick={() => { setField("media_url", null); setField("media_type", null); }} className="text-destructive hover:text-destructive/80">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <label className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-dashed border-border/50 hover:border-primary/50 cursor-pointer text-xs text-muted-foreground">
                          {uploading === v ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                          <span>{uploading === v ? "Enviando..." : "Enviar mídia"}</span>
                          <input type="file" accept="image/*,video/*,audio/*" className="hidden" onChange={(e) => uploadMedia(v, e)} disabled={uploading === v} />
                        </label>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-medium mb-1 text-muted-foreground flex items-center gap-1">
                        <Package className="w-3 h-3" /> Plano exibido (opcional)
                      </label>
                      <select
                        value={planId || ""}
                        onChange={e => setField("plan_id", e.target.value || null)}
                        className="w-full input-dark text-sm"
                      >
                        <option value="">Todos os planos ativos</option>
                        {plans.map(p => (
                          <option key={p.id} value={p.id}>{p.name} — R$ {Number(p.price).toFixed(2)}</option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-medium mb-1 text-muted-foreground flex items-center gap-1">
                          <DollarSign className="w-3 h-3" /> Preço override
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={price ?? ""}
                          onChange={e => setField("price_override", e.target.value === "" ? null : parseFloat(e.target.value))}
                          className="w-full input-dark text-sm"
                          placeholder="Ex: 47.00"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1 text-muted-foreground flex items-center gap-1">
                          <Package className="w-3 h-3" /> Order Bump
                        </label>
                        <select
                          value={bumpId || ""}
                          onChange={e => setField("bump_plan_id", e.target.value || null)}
                          className="w-full input-dark text-sm"
                        >
                          <option value="">Padrão do plano</option>
                          {plans.filter(p => p.order_bump_enabled).map(p => (
                            <option key={p.id} value={p.id}>{p.order_bump_name || p.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
              <Button onClick={handleCreate} disabled={saving} className="btn-gradient">
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Criar Teste
              </Button>
            </div>
          </div>
        )}

        {/* Tests List */}
        <Panel icon={FlaskConical} title="Testes Configurados" subtitle={`${tests.length} teste(s)`}>
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : tests.length === 0 ? (
          <div className="glass-card p-12 text-center animate-fade-in">
            <FlaskConical className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhum teste criado</h3>
            <p className="text-muted-foreground">Crie um teste A/B para otimizar suas conversões.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {tests.map((test) => {
              const stats = testStats[test.id!] || [
                { variant: "a", starts: 0, clicks: 0, payments: 0 },
                { variant: "b", starts: 0, clicks: 0, payments: 0 },
              ];
              const aStats = stats[0];
              const bStats = stats[1];

              return (
                <div key={test.id} className="glass-card p-5 animate-fade-in space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold">{test.name}</h3>
                      {test.winner && (
                        <span className="text-xs px-2 py-1 rounded-full bg-green-500/20 text-green-400 flex items-center gap-1">
                          <Trophy className="w-3 h-3" />
                          Vencedor: {test.winner.toUpperCase()}
                        </span>
                      )}
                      {test.is_active && (
                        <span className="text-xs px-2 py-1 rounded-full bg-primary/20 text-primary animate-pulse">
                          Ativo
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <Switch checked={test.is_active} onCheckedChange={() => toggleTest(test)} />
                      <Button variant="ghost" size="sm" className="text-destructive" onClick={() => deleteTest(test.id!)}>
                        Remover
                      </Button>
                    </div>
                  </div>

                  {/* Stats comparison */}
                  <div className="grid grid-cols-2 gap-4">
                    {[{ label: "A", stats: aStats, color: "blue" }, { label: "B", stats: bStats, color: "orange" }].map(({ label, stats: s, color }) => (
                      <div key={label} className={`p-4 rounded-lg border border-${color}-500/30 bg-${color}-500/5`}>
                        <p className={`text-sm font-semibold text-${color}-400 mb-3`}>Variante {label}</p>
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div>
                            <p className="text-lg font-bold font-mono">{s.starts}</p>
                            <p className="text-xs text-muted-foreground">Inícios</p>
                          </div>
                          <div>
                            <p className="text-lg font-bold font-mono">{s.clicks}</p>
                            <p className="text-xs text-muted-foreground">Cliques</p>
                          </div>
                          <div>
                            <p className="text-lg font-bold font-mono">{s.payments}</p>
                            <p className="text-xs text-muted-foreground">Pagamentos</p>
                          </div>
                        </div>
                        <div className="mt-2 text-center">
                          <p className="text-xs text-muted-foreground">
                            Taxa: {s.starts > 0 ? ((s.payments / s.starts) * 100).toFixed(1) : "0"}%
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Select winner */}
                  {!test.winner && (aStats.starts > 0 || bStats.starts > 0) && (
                    <div className="flex items-center gap-2 justify-center pt-2">
                      <span className="text-sm text-muted-foreground">Selecionar vencedor:</span>
                      <Button size="sm" variant="outline" className="border-blue-500/50 text-blue-400" onClick={() => selectWinner(test.id!, "a")}>
                        <Trophy className="w-3 h-3 mr-1" /> Variante A
                      </Button>
                      <Button size="sm" variant="outline" className="border-orange-500/50 text-orange-400" onClick={() => selectWinner(test.id!, "b")}>
                        <Trophy className="w-3 h-3 mr-1" /> Variante B
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        </Panel>
      </div>
    </MainLayout>
  );
}
