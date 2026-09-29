import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, BarChart3, MousePointerClick, Globe, Bot as BotIcon, ShieldAlert } from "lucide-react";
import { StatCard } from "@/components/ui/stat-kit";
import { cn } from "@/lib/utils";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar, Cell,
} from "recharts";

interface Props { linkIds: string[]; linkMeta: Record<string, { name: string; domain: string }> }

const RANGES = [7, 14, 30] as const;
const COLORS = ["hsl(var(--primary))", "#38bdf8", "#a78bfa", "#f59e0b", "#34d399", "#f472b6"];

const label = (url: string) => {
  const m = url.match(/t\.me\/([A-Za-z0-9_+]+)/);
  if (m) return "@" + m[1];
  try { return new URL(url).hostname; } catch { return url.slice(0, 24); }
};

export function LinkMetrics({ linkIds, linkMeta }: Props) {
  const [days, setDays] = useState<number>(7);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (linkIds.length === 0) { setRows([]); setLoading(false); return; }
      setLoading(true);
      const since = new Date(Date.now() - days * 86400000).toISOString();
      const { data } = await supabase
        .from("custom_link_clicks")
        .select("link_id, destination, blocked, created_at")
        .in("link_id", linkIds)
        .gte("created_at", since)
        .order("created_at", { ascending: true });
      setRows(data || []);
      setLoading(false);
    })();
  }, [linkIds.join(","), days]);

  const { perDay, perBot, perDomain, totals } = useMemo(() => {
    const dayMap = new Map<string, { cliques: number; bloqueados: number }>();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      dayMap.set(d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" }), { cliques: 0, bloqueados: 0 });
    }
    const botMap = new Map<string, number>();
    const domMap = new Map<string, number>();
    let blocked = 0;

    for (const r of rows) {
      const key = new Date(r.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
      const slot = dayMap.get(key);
      if (slot) { r.blocked ? slot.bloqueados++ : slot.cliques++; }
      if (r.blocked) { blocked++; continue; }
      if (r.destination) botMap.set(label(r.destination), (botMap.get(label(r.destination)) || 0) + 1);
      const dom = linkMeta[r.link_id]?.domain || "riotvips.com";
      domMap.set(dom, (domMap.get(dom) || 0) + 1);
    }

    const sorted = (m: Map<string, number>) =>
      [...m.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8);

    return {
      perDay: [...dayMap.entries()].map(([name, v]) => ({ name, ...v })),
      perBot: sorted(botMap),
      perDomain: sorted(domMap),
      totals: { all: rows.length, blocked, valid: rows.length - blocked },
    };
  }, [rows, days, linkMeta]);

  const tooltip = {
    contentStyle: {
      background: "hsl(var(--card))",
      border: "1px solid hsl(var(--border))",
      borderRadius: 12,
      fontSize: 12,
    },
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-wrap items-center gap-2">
        <BarChart3 className="w-4 h-4 text-primary" />
        <p className="text-sm font-medium flex-1">Desempenho dos links</p>
        <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-secondary/40 border border-border/50">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setDays(r)}
              className={cn("px-3 py-1 rounded-md text-xs transition-colors",
                days === r ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground")}
            >
              {r}d
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={MousePointerClick} label="Cliques válidos" value={String(totals.valid)} subValue={`Últimos ${days} dias`} color="bg-primary/15 text-primary" />
        <StatCard icon={ShieldAlert} label="Bloqueados pelo escudo" value={String(totals.blocked)} subValue="Crawlers e espiões" color="bg-amber-500/15 text-amber-400" bar="bg-amber-400" />
        <StatCard icon={Globe} label="Domínios ativos" value={String(perDomain.length)} subValue="Com tráfego no período" color="bg-violet-500/15 text-violet-400" bar="bg-violet-400" />
      </div>

      {loading ? (
        <div className="glass-card flex justify-center py-24"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : (
        <>
          <div className="glass-card p-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">Cliques por dia</p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={perDay}>
                  <defs>
                    <linearGradient id="clkGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip {...tooltip} />
                  <Area type="monotone" dataKey="cliques" stroke="hsl(var(--primary))" fill="url(#clkGrad)" strokeWidth={2} />
                  <Area type="monotone" dataKey="bloqueados" stroke="#f59e0b" fill="transparent" strokeWidth={1.5} strokeDasharray="4 4" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {[
              { title: "Cliques por bot / destino", data: perBot, icon: BotIcon, empty: "Sem cliques em destinos ainda." },
              { title: "Cliques por domínio", data: perDomain, icon: Globe, empty: "Sem cliques por domínio ainda." },
            ].map((block) => (
              <div key={block.title} className="glass-card p-5">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
                  <block.icon className="w-3.5 h-3.5" /> {block.title}
                </p>
                {block.data.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-16 text-center">{block.empty}</p>
                ) : (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={block.data} layout="vertical" margin={{ left: 12 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.25} horizontal={false} />
                        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                        <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                        <Tooltip {...tooltip} cursor={{ fill: "hsl(var(--secondary))", opacity: 0.3 }} />
                        <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={16}>
                          {block.data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
