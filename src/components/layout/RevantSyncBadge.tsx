import { useRevantDemoSync } from "@/hooks/useRevantDemoSync";
import { useDemoMode } from "@/hooks/useDemoMode";
import { CircleDot, RefreshCw } from "lucide-react";

function formatAgo(iso: string | null) {
  if (!iso) return "—";
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const s = Math.floor(diff / 1000);
  if (s < 60) return `há ${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `há ${m}min`;
  const h = Math.floor(m / 60);
  return `há ${h}h`;
}

export function RevantSyncBadge() {
  const { isDemoActive } = useDemoMode();
  const { status, lastSyncAt } = useRevantDemoSync();
  if (!isDemoActive) return null;
  // Per product decision: never expose negative connection states to the user.
  if (status === "offline" || status === "no-key" || status === "idle") return null;

  let color = "text-muted-foreground";
  let dot = "bg-muted";
  let label = "Aguardando";
  let Icon = CircleDot;

  if (status === "synced") { color = "text-green-400"; dot = "bg-green-400"; label = `Sincronizado · ${formatAgo(lastSyncAt)}`; }
  else if (status === "syncing") { color = "text-yellow-400"; dot = "bg-yellow-400 animate-pulse"; label = "Sincronizando…"; Icon = RefreshCw; }

  return (
    <div className={`flex items-center gap-2 text-xs ${color} glass-card px-3 py-1.5`} title="Status da sincronização com RevantPay (modo demo)">
      <span className={`w-2 h-2 rounded-full ${dot}`} />
      <Icon className="w-3 h-3" />
      <span>{label}</span>
    </div>
  );
}