import { useState, useEffect, useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useBots } from "@/contexts/BotContext";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { brtDayKey, brtStartOfDay } from "@/lib/brtDate";

interface ChartData {
  date: string;
  value: number;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="glass-card p-3 border border-primary/30">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="font-mono text-lg text-primary font-bold">
          R$ {payload[0].value.toFixed(2)}
        </p>
      </div>
    );
  }
  return null;
};

interface SalesChartProps {
  viewAllBots?: boolean;
  isDemoActive?: boolean;
  demoChartData?: { date: string; value: number }[];
  demoChartData30d?: { date: string; value: number }[];
}

export function SalesChart({ viewAllBots = false, isDemoActive = false, demoChartData = [], demoChartData30d = [] }: SalesChartProps) {
  const [period, setPeriod] = useState<"7d" | "30d">("7d");
  const { selectedBot, bots } = useBots();
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [loading, setLoading] = useState(true);

  // Stabilize bot IDs
  const botIds = useMemo(() => {
    if (viewAllBots) return bots.map(b => b.id).sort();
    if (selectedBot) return [selectedBot.id];
    return [];
  }, [viewAllBots, bots, selectedBot]);
  const stableBotKey = botIds.join(",");
  const stableDemoChartKey = JSON.stringify(demoChartData) + JSON.stringify(demoChartData30d);

  useEffect(() => {
    if (isDemoActive && (demoChartData.length > 0 || demoChartData30d.length > 0)) {
      const source = period === "30d" && demoChartData30d.length > 0 ? demoChartData30d : demoChartData;
      setChartData(source);
      setLoading(false);
      return;
    }

    async function fetchData() {
      if (botIds.length === 0) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const days = period === "7d" ? 7 : 30;
        const startDate = brtStartOfDay(-(days - 1));

        // Atribuímos a venda ao dia em que ela foi feita (created_at),
        // e não ao momento da confirmação, que pode cair na madrugada seguinte.
        let query = supabase
          .from('payment_orders')
          .select('amount, created_at')
          .eq('status', 'paid')
          .gte('created_at', startDate.toISOString());

        if (botIds.length > 1) {
          query = query.in('bot_id', botIds);
        } else {
          query = query.eq('bot_id', botIds[0]);
        }

        const { data: orders } = await query;

        const groupedData: { [key: string]: number } = {};
        
        for (let i = 0; i < days; i++) {
          const dateKey = brtDayKey(brtStartOfDay(-(days - 1 - i)));
          if (dateKey) groupedData[dateKey] = 0;
        }

        orders?.forEach((order) => {
          if (order.created_at) {
            const dateKey = brtDayKey(order.created_at);
            if (dateKey) groupedData[dateKey] = (groupedData[dateKey] || 0) + Number(order.amount);
          }
        });

        const formattedData = Object.entries(groupedData).map(([date, value]) => ({
          date,
          value,
        }));

        setChartData(formattedData);
      } catch (error) {
        console.error('Error fetching sales data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stableBotKey, period, isDemoActive, stableDemoChartKey]);

  return (
    <div className="glass-card p-6 animate-fade-in" style={{ animationDelay: "0.1s" }}>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold">Histórico de Vendas</h3>
        <div className="flex rounded-lg bg-secondary p-1">
          <button
            onClick={() => setPeriod("7d")}
            className={`px-4 py-1.5 text-sm rounded-md transition-all ${
              period === "7d"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            7D
          </button>
          <button
            onClick={() => setPeriod("30d")}
            className={`px-4 py-1.5 text-sm rounded-md transition-all ${
              period === "30d"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            30D
          </button>
        </div>
      </div>

      <div className="h-[300px]">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
      ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(175 84% 50%)" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="hsl(175 84% 50%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 30% 18%)" />
              <XAxis
                dataKey="date"
                stroke="hsl(215 20% 55%)"
                fontSize={12}
                tickLine={false}
              />
              <YAxis
                stroke="hsl(215 20% 55%)"
                fontSize={12}
                tickLine={false}
                tickFormatter={(value) => `R$${value}`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="value"
                stroke="hsl(175 84% 50%)"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorValue)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
