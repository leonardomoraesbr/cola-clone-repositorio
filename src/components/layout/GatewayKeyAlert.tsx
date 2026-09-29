import { useEffect, useState } from "react";
import { KeyRound, ExternalLink } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

/**
 * Global warning shown when the seller's RevantPay API key was rejected by the
 * gateway (revoked / invalid). Flagged by the telegram-webhook edge function.
 */
export function GatewayKeyAlert() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [invalid, setInvalid] = useState(false);
  const [reason, setReason] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let mounted = true;

    const load = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("revantpay_key_status, revantpay_key_error")
        .eq("id", user.id)
        .maybeSingle();
      if (!mounted) return;
      const row = data as any;
      setInvalid(row?.revantpay_key_status === "invalid");
      setReason(row?.revantpay_key_error || null);
    };

    load();

    const channel = supabase
      .channel(`gateway-key-${user.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${user.id}` },
        () => load(),
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [user]);

  if (!invalid) return null;

  return (
    <div className="sticky top-0 z-50 w-full bg-gradient-to-r from-amber-700 via-amber-600 to-amber-700 text-white shadow-lg border-b border-amber-800/60">
      <div className="px-6 py-2.5 flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-sm font-medium">
        <KeyRound className="w-4 h-4 flex-shrink-0" />
        <span className="text-center">
          Sua chave de API da RevantPay foi recusada — seus bots não estão conseguindo gerar PIX.
          Gere uma nova chave na RevantPay e reconecte em Pagamentos.
        </span>
        {reason && <span className="text-white/70 text-xs">({reason.slice(0, 90)})</span>}
        <div className="flex items-center gap-2">
          {location.pathname !== "/pagamentos" && (
            <Button
              size="sm"
              variant="secondary"
              className="h-7 text-xs"
              onClick={() => navigate("/pagamentos")}
            >
              Reconectar chave
            </Button>
          )}
          <a
            href="https://revantpay.com.br"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs underline underline-offset-2 text-white/90 hover:text-white"
          >
            Gerar nova chave <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  );
}
