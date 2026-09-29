import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface BannerConfig {
  enabled: boolean;
  message: string;
}

export function MaintenanceBanner() {
  const [config, setConfig] = useState<BannerConfig | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      const { data } = await supabase
        .from("admin_settings")
        .select("value")
        .eq("key", "maintenance_banner")
        .maybeSingle();
      if (!mounted || !data?.value) return;
      try {
        const parsed: BannerConfig = typeof data.value === "string" ? JSON.parse(data.value) : (data.value as any);
        setConfig(parsed);
      } catch {
        setConfig(null);
      }
    }
    load();

    const channel = supabase
      .channel("maintenance-banner")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "admin_settings", filter: "key=eq.maintenance_banner" },
        () => load(),
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  if (!config?.enabled || !config.message) return null;

  return (
    <div className="sticky top-0 z-50 w-full bg-gradient-to-r from-red-700 via-red-600 to-red-700 text-white shadow-lg border-b border-red-800/60">
      <div className="px-6 py-2.5 flex items-center justify-center gap-3 text-sm font-medium">
        <AlertTriangle className="w-4 h-4 flex-shrink-0 animate-pulse" />
        <span className="text-center">{config.message}</span>
      </div>
    </div>
  );
}