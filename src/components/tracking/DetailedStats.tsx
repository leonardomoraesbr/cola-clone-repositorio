import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Monitor, MapPin, Clock, Wifi } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from "recharts";

interface DetailedStatsProps {
  botId: string;
  linkId: string;
  startDate?: string;
  endDate?: string;
}

const COLORS = ["hsl(var(--primary))", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#06b6d4", "#f43f5e", "#6366f1"];

function EmptyChart({ type, label }: { type: "bar" | "pie" | "area"; label: string }) {
  const emptyBar = Array.from({ length: 7 }, (_, i) => ({ name: `—`, value: 0 }));
  const emptyPie = [{ name: "Sem dados", value: 1 }];

  return (
    <div className="relative">
      <div className="absolute inset-0 flex items-center justify-center z-10">
        <p className="text-sm text-muted-foreground bg-background/80 px-3 py-1.5 rounded-lg border border-border/50">
          Nenhum dado de {label} disponível
        </p>
      </div>
      <div className="opacity-20">
        {type === "bar" && (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={emptyBar}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
              <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
              <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
        {type === "pie" && (
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={emptyPie} cx="50%" cy="50%" outerRadius={70} dataKey="value" stroke="none">
                <Cell fill="hsl(var(--muted))" />
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        )}
        {type === "area" && (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={emptyBar}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
              <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
              <Area type="monotone" dataKey="value" fill="hsl(var(--primary))" stroke="hsl(var(--primary))" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function StatBar({ label, value, max }: { label: string; value: number; max: number }) {
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono">{value}</span>
      </div>
      <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
        <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500" style={{ width: `${max > 0 ? (value / max) * 100 : 0}%` }} />
      </div>
    </div>
  );
}

export function DetailedStats({ botId, linkId, startDate, endDate }: DetailedStatsProps) {
  const [tab, setTab] = useState("browsers");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, [tab, linkId, startDate, endDate]);

  async function fetchData() {
    setLoading(true);
    try {
      const actionMap: Record<string, string> = {
        browsers: "stats-browsers",
        regions: "stats-regions",
        hours: "stats-hours",
        connections: "stats-connections",
      };
      const body: any = {
        action: actionMap[tab],
        bot_id: botId,
        link_id: linkId,
      };
      if (startDate) body.start_date = startDate;
      if (endDate) body.end_date = endDate;

      const { data: result, error } = await supabase.functions.invoke("linkter-api", { body });
      if (error) throw error;
      setData(result);
    } catch (e) {
      console.error("Error fetching detailed stats:", e);
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  function renderBrowsers() {
    const browsers = data?.browsers || [];
    if (!browsers.length) return <EmptyChart type="bar" label="navegadores" />;
    const chartData = browsers.slice(0, 10).map((b: any) => ({ name: b.browser, clicks: b.clicks }));
    return (
      <div className="space-y-4">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
            <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
            <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
            <Bar dataKey="clicks" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Cliques" />
          </BarChart>
        </ResponsiveContainer>
        <div className="space-y-2">
          {chartData.map((b: any, i: number) => (
            <StatBar key={i} label={b.name} value={b.clicks} max={chartData[0]?.clicks || 1} />
          ))}
        </div>
      </div>
    );
  }

  function renderRegions() {
    const regions = data?.regions || [];
    const states = data?.states || [];
    if (!regions.length && !states.length) return <EmptyChart type="pie" label="regiões" />;

    const pieData = (regions.length ? regions : states).slice(0, 8).map((r: any) => ({
      name: r.region || r.state,
      value: r.clicks,
    }));

    return (
      <div className="space-y-6">
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie data={pieData} cx="50%" cy="50%" outerRadius={80} dataKey="value" nameKey="name" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
              {pieData.map((_: any, i: number) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
        {regions.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-3">Regiões</h4>
            <div className="space-y-2">
              {regions.slice(0, 8).map((r: any, i: number) => (
                <StatBar key={i} label={r.region} value={r.clicks} max={regions[0]?.clicks || 1} />
              ))}
            </div>
          </div>
        )}
        {states.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-3">Estados</h4>
            <div className="space-y-2">
              {states.slice(0, 10).map((s: any, i: number) => (
                <StatBar key={i} label={s.state} value={s.clicks} max={states[0]?.clicks || 1} />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  function renderHours() {
    const byHour = data?.by_hour || [];
    const byWeekday = data?.by_weekday || [];
    if (!byHour.length && !byWeekday.length) return <EmptyChart type="area" label="horários" />;

    const hourChart = byHour.map((h: any) => ({ name: h.hour, clicks: h.clicks }));
    const weekdayChart = byWeekday.map((d: any) => ({ name: d.day, clicks: d.clicks }));

    return (
      <div className="space-y-6">
        {weekdayChart.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-3">Dia da Semana</h4>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={weekdayChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="clicks" fill="#ec4899" radius={[4, 4, 0, 0]} name="Cliques" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        {hourChart.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-3">Horário</h4>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={hourChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                <Area type="monotone" dataKey="clicks" fill="#8b5cf6" fillOpacity={0.3} stroke="#8b5cf6" name="Cliques" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    );
  }

  function renderConnections() {
    const isps = data?.isps || [];
    const connectionTypes = data?.connection_types || [];
    if (!isps.length && !connectionTypes.length) return <EmptyChart type="bar" label="conexões" />;

    const typeChart = connectionTypes.map((c: any) => ({ name: c.type, clicks: c.clicks }));
    const ispChart = isps.slice(0, 8).map((isp: any) => ({ name: isp.isp, clicks: isp.clicks }));

    return (
      <div className="space-y-6">
        {typeChart.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-3">Tipo de Conexão</h4>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={typeChart} cx="50%" cy="50%" outerRadius={65} dataKey="clicks" nameKey="name" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                  {typeChart.map((_: any, i: number) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
        {ispChart.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-3">ISPs</h4>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={ispChart} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} width={100} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="clicks" fill="#06b6d4" radius={[0, 4, 4, 0]} name="Cliques" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="glass-card p-6 animate-fade-in">
      <h3 className="text-lg font-semibold mb-4">Estatísticas Detalhadas</h3>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-secondary/50 mb-4">
          <TabsTrigger value="browsers" className="gap-1.5 text-xs"><Monitor className="w-3.5 h-3.5" /> Navegadores</TabsTrigger>
          <TabsTrigger value="regions" className="gap-1.5 text-xs"><MapPin className="w-3.5 h-3.5" /> Regiões</TabsTrigger>
          <TabsTrigger value="hours" className="gap-1.5 text-xs"><Clock className="w-3.5 h-3.5" /> Horários</TabsTrigger>
          <TabsTrigger value="connections" className="gap-1.5 text-xs"><Wifi className="w-3.5 h-3.5" /> Conexões</TabsTrigger>
        </TabsList>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-violet-400" />
          </div>
        ) : (
          <>
            <TabsContent value="browsers">{renderBrowsers()}</TabsContent>
            <TabsContent value="regions">{renderRegions()}</TabsContent>
            <TabsContent value="hours">{renderHours()}</TabsContent>
            <TabsContent value="connections">{renderConnections()}</TabsContent>
          </>
        )}
      </Tabs>
    </div>
  );
}
