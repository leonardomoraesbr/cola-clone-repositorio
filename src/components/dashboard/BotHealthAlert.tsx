import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

interface Props {
  botId: string;
  botUserId: string;
  vipId?: string | null;
  vipLink?: string | null;
}

/**
 * Surfaces silent revenue-killing misconfigurations (no VIP destination,
 * no payment gateway, no active plan) directly on the dashboard.
 */
export function BotHealthAlert({ botId, botUserId, vipId, vipLink }: Props) {
  const navigate = useNavigate();
  const [issues, setIssues] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      const found: string[] = [];

      if (!vipId && !vipLink) {
        found.push("Nenhum canal/grupo VIP configurado — os leads não recebem acesso após pagar.");
      }

      const [{ data: profile }, { data: gateway }, { count: plansCount }] = await Promise.all([
        supabase.from("profiles").select("revantpay_api_key").eq("id", botUserId).maybeSingle(),
        supabase
          .from("payment_gateways")
          .select("token")
          .eq("bot_id", botId)
          .eq("is_connected", true)
          .maybeSingle(),
        supabase
          .from("subscription_plans")
          .select("id", { count: "exact", head: true })
          .eq("bot_id", botId)
          .eq("is_active", true),
      ]);

      if (!profile?.revantpay_api_key && !gateway?.token) {
        found.push("Nenhuma chave RevantPay conectada — o bot não consegue gerar PIX.");
      }
      if (!plansCount) {
        found.push("Nenhum plano ativo — o bot não tem oferta para vender.");
      }

      if (!cancelled) setIssues(found);
    };

    check();
    return () => {
      cancelled = true;
    };
  }, [botId, botUserId, vipId, vipLink]);

  if (issues.length === 0) return null;

  return (
    <div className="glass-card border border-destructive/40 bg-destructive/10 p-4 mb-8">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-destructive mt-0.5 shrink-0" />
        <div className="flex-1">
          <h3 className="font-semibold text-destructive mb-1">Configuração pendente neste bot</h3>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-4">
            {issues.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
          <div className="flex gap-2 mt-3">
            <Button size="sm" variant="outline" onClick={() => navigate("/editar-bot")}>
              Configurar bot
            </Button>
            <Button size="sm" variant="outline" onClick={() => navigate("/pagamentos")}>
              Pagamentos
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
