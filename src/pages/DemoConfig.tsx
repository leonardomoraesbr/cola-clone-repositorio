import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useDemoMode, type DemoConfig as DemoConfigType } from "@/hooks/useDemoMode";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Save, Loader2, BarChart3, Users, TrendingUp, DollarSign, Plus, Trash2, Wand2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Switch } from "@/components/ui/switch";
import { deriveDemoConfig as deriveConfig, parseDemoInteger, parseDemoNumber } from "@/lib/deriveDemoConfig";

export default function DemoConfig() {
  const { user } = useAuth();
  const { isDemoActive, demoConfig, isLoading } = useDemoMode();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<DemoConfigType>(demoConfig);
  const [autoMode, setAutoMode] = useState(true);
  const [autoInputs, setAutoInputs] = useState({
    totalRevenueAllTime: demoConfig.totalRevenueAllTime || 0,
    avgTicket: demoConfig.avgTicket || 0,
    totalUsers: demoConfig.totalUsers || 0,
  });

  useEffect(() => {
    if (!isLoading) {
      setConfig(demoConfig);
      setAutoInputs({
        totalRevenueAllTime: demoConfig.totalRevenueAllTime || 0,
        avgTicket: demoConfig.avgTicket || 0,
        totalUsers: demoConfig.totalUsers || 0,
      });
    }
  }, [isLoading]);

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  if (!isDemoActive) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
          <BarChart3 className="w-16 h-16 text-muted-foreground mb-4" />
          <h2 className="text-2xl font-bold mb-2">Modo Demo Inativo</h2>
          <p className="text-muted-foreground">O modo demo não está ativo para sua conta.</p>
        </div>
      </MainLayout>
    );
  }

  const updateField = (key: keyof DemoConfigType, value: number) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const addChartDay = () => {
    const today = new Date();
    today.setDate(today.getDate() - config.chartData.length);
    const dateStr = today.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: "2-digit", month: "2-digit" });
    setConfig(prev => ({
      ...prev,
      chartData: [...prev.chartData, { date: dateStr, value: 0 }],
    }));
  };

  const updateChartDay = (index: number, field: "date" | "value", val: string) => {
    setConfig(prev => {
      const newData = [...prev.chartData];
      if (field === "value") {
        newData[index] = { ...newData[index], value: parseFloat(val) || 0 };
      } else {
        newData[index] = { ...newData[index], date: val };
      }
      return { ...prev, chartData: newData };
    });
  };

  const removeChartDay = (index: number) => {
    setConfig(prev => ({
      ...prev,
      chartData: prev.chartData.filter((_, i) => i !== index),
    }));
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const finalConfig = autoMode
        ? deriveConfig(autoInputs.totalRevenueAllTime, autoInputs.avgTicket, autoInputs.totalUsers)
        : config;
      const { error } = await supabase
        .from("demo_settings")
        .update({ config: finalConfig as any, updated_at: new Date().toISOString() })
        .eq("user_id", user.id);
      if (error) throw error;
      if (autoMode) setConfig(finalConfig);
      queryClient.invalidateQueries({ queryKey: ["demo-mode"] });
      queryClient.invalidateQueries({ queryKey: ["total-revenue"] });
      toast({ title: "Salvo!", description: "Configurações demo atualizadas." });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const Field = ({ label, field, prefix }: { label: string; field: keyof DemoConfigType; prefix?: string }) => (
    <div className="space-y-1">
      <label className="text-sm text-muted-foreground">{label}</label>
      <div className="relative">
        {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{prefix}</span>}
        <Input
          type="number"
          step="0.01"
          value={config[field] as number}
          onChange={(e) => updateField(field, parseFloat(e.target.value) || 0)}
          className={prefix ? "pl-10" : ""}
        />
      </div>
    </div>
  );

  return (
    <MainLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1 flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-primary" />
          Configurar Modo Demo
        </h1>
        <p className="text-muted-foreground">Personalize todas as métricas do dashboard com dados simulados.</p>
      </div>

      <div className="space-y-6">
        {/* Modo Automático */}
        <Card className="glass-card border-primary/40">
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <Wand2 className="w-5 h-5 text-primary" />
                Modo Automático
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {autoMode ? "Derivar tudo dos 3 pilares" : "Edição manual"}
                </span>
                <Switch checked={autoMode} onCheckedChange={setAutoMode} />
              </div>
            </CardTitle>
          </CardHeader>
          {autoMode && (
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Ajuste apenas <b>saldo total</b>, <b>ticket médio</b> e <b>total de usuários</b>. Vendas hoje/mês, ticket, conversões, VIPs, gráfico e barra de faturamento são calculados automaticamente e ficam consistentes.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-sm text-muted-foreground">Saldo total (all-time)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
                    <Input type="text" inputMode="decimal" value={autoInputs.totalRevenueAllTime}
                      onChange={(e) => setAutoInputs(p => ({ ...p, totalRevenueAllTime: parseDemoNumber(e.target.value) }))}
                      className="pl-10" />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-sm text-muted-foreground">Ticket médio</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
                    <Input type="text" inputMode="decimal" value={autoInputs.avgTicket}
                      onChange={(e) => setAutoInputs(p => ({ ...p, avgTicket: parseDemoNumber(e.target.value) }))}
                      className="pl-10" />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-sm text-muted-foreground">Total de usuários</label>
                  <Input type="text" inputMode="numeric" value={autoInputs.totalUsers}
                    onChange={(e) => setAutoInputs(p => ({ ...p, totalUsers: parseDemoInteger(e.target.value) }))} />
                </div>
              </div>
              {(() => {
                const preview = deriveConfig(autoInputs.totalRevenueAllTime, autoInputs.avgTicket, autoInputs.totalUsers);
                const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
                return (
                  <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div className="p-3 rounded-lg bg-secondary/40"><div className="text-muted-foreground text-xs">Vendas hoje</div><div className="font-mono">{preview.salesToday} · {fmt(preview.revenueToday)}</div></div>
                    <div className="p-3 rounded-lg bg-secondary/40"><div className="text-muted-foreground text-xs">Vendas mês</div><div className="font-mono">{preview.salesMonth} · {fmt(preview.revenueMonth)}</div></div>
                    <div className="p-3 rounded-lg bg-secondary/40"><div className="text-muted-foreground text-xs">Total vendas</div><div className="font-mono">{preview.totalSalesAllTime}</div></div>
                    <div className="p-3 rounded-lg bg-secondary/40"><div className="text-muted-foreground text-xs">VIPs ativos</div><div className="font-mono">{preview.activeVips}</div></div>
                    <div className="p-3 rounded-lg bg-secondary/40"><div className="text-muted-foreground text-xs">Bloqueados</div><div className="font-mono">{preview.blockedUsers}</div></div>
                    <div className="p-3 rounded-lg bg-secondary/40"><div className="text-muted-foreground text-xs">Usuários hoje / mês</div><div className="font-mono">{preview.usersToday} / {preview.usersMonth}</div></div>
                    <div className="p-3 rounded-lg bg-secondary/40"><div className="text-muted-foreground text-xs">Conv. hoje</div><div className="font-mono">{preview.conversionToday}%</div></div>
                    <div className="p-3 rounded-lg bg-secondary/40"><div className="text-muted-foreground text-xs">Conv. mês</div><div className="font-mono">{preview.conversionMonth}%</div></div>
                    <div className="p-3 rounded-lg bg-secondary/40"><div className="text-muted-foreground text-xs">Conv. total</div><div className="font-mono">{preview.conversionTotal}%</div></div>
                  </div>
                );
              })()}
            </CardContent>
          )}
        </Card>

        {!autoMode && (<>
        {/* Stats Cards */}
        <Card className="glass-card border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-primary" />
              Cards de Estatísticas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Field label="Vendas Hoje" field="salesToday" />
              <Field label="Receita Hoje" field="revenueToday" prefix="R$" />
              <Field label="Vendas Mês" field="salesMonth" />
              <Field label="Receita Mês" field="revenueMonth" prefix="R$" />
              <Field label="Ticket Médio" field="avgTicket" prefix="R$" />
              <Field label="Taxa de Conversão (%)" field="conversionRate" />
            </div>
          </CardContent>
        </Card>

        {/* Revenue Bar */}
        <Card className="glass-card border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Barra de Faturamento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Faturamento Total (All-time)" field="totalRevenueAllTime" prefix="R$" />
              <Field label="Total de Vendas (All-time)" field="totalSalesAllTime" />
            </div>
          </CardContent>
        </Card>

        {/* Users Card */}
        <Card className="glass-card border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Card de Usuários
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Field label="Usuários Hoje" field="usersToday" />
              <Field label="Usuários Mês" field="usersMonth" />
              <Field label="Total de Usuários" field="totalUsers" />
              <Field label="VIPs Ativos" field="activeVips" />
            </div>
          </CardContent>
        </Card>

        {/* Conversion Card */}
        <Card className="glass-card border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Taxas de Conversão
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Conversão Hoje (%)" field="conversionToday" />
              <Field label="Conversão Mês (%)" field="conversionMonth" />
              <Field label="Conversão Total (%)" field="conversionTotal" />
            </div>
          </CardContent>
        </Card>

        {/* Sales Chart */}
        <Card className="glass-card border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              Gráfico de Vendas
              <Button variant="outline" size="sm" onClick={addChartDay} className="ml-auto">
                <Plus className="w-4 h-4 mr-1" /> Adicionar Dia
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {config.chartData.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-4">
                Nenhum dado no gráfico. Clique em "Adicionar Dia" para começar.
              </p>
            ) : (
              <div className="space-y-2">
                {config.chartData.map((day, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Input
                      value={day.date}
                      onChange={(e) => updateChartDay(i, "date", e.target.value)}
                      placeholder="dd/mm"
                      className="w-28"
                    />
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
                      <Input
                        type="number"
                        step="0.01"
                        value={day.value}
                        onChange={(e) => updateChartDay(i, "value", e.target.value)}
                        className="pl-10"
                      />
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => removeChartDay(i)} className="text-destructive hover:text-destructive">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        </>)}

        {/* Save */}
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving} className="btn-gradient px-8">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            Salvar Configurações
          </Button>
        </div>
      </div>
    </MainLayout>
  );
}
