import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const BASE = "https://atnxzbiowkgyvqqjaaed.supabase.co/functions/v1/demo-api";

export type RevantSyncStatus = "idle" | "syncing" | "synced" | "offline" | "no-key";

/**
 * Polls RevantPay Demo API every 60s as a safety net.
 * When summary counters diverge from local demo_settings.config, triggers a full sync
 * via the `sync-revantpay-demo` edge function. Webhook is the primary channel.
 */
export function useRevantDemoSync() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [status, setStatus] = useState<RevantSyncStatus>("idle");
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const failCountRef = useRef(0);
  const inFlightRef = useRef(false);

  useEffect(() => {
    if (!user) return;
    const userId = user.id;
    let cancelled = false;

    async function tick() {
      if (inFlightRef.current || cancelled) return;
      inFlightRef.current = true;
      try {
        const { data: demo } = await supabase
          .from("demo_settings")
          .select("revantpay_demo_key, last_synced_at, config")
          .eq("user_id", userId)
          .eq("is_active", true)
          .maybeSingle();

        if (!demo?.revantpay_demo_key) { setStatus("no-key"); return; }

        // Health check (no auth required)
        const health = await fetch(`${BASE}/health`).then((r) => r.ok).catch(() => false);
        if (!health) {
          failCountRef.current++;
          if (failCountRef.current >= 3) setStatus("offline");
          return;
        }
        failCountRef.current = 0;

        // Compare summary counters with what we have locally
        const summaryResp = await fetch(`${BASE}/summary`, {
          headers: { "x-demo-api-key": demo.revantpay_demo_key },
        }).catch(() => null);

        if (summaryResp?.status === 401) {
          // Key revoked on RevantPay side — clear locally so UI stops retrying
          await supabase
            .from("demo_settings")
            .update({ revantpay_demo_key: null })
            .eq("user_id", userId);
          setStatus("no-key");
          return;
        }
        const summary = summaryResp && summaryResp.ok ? await summaryResp.json().catch(() => null) : null;
        if (!summary) { setStatus("offline"); return; }

        const local = (demo.config as any) || {};
        if (local.demoSource === "manual_admin" || local.demoSource === "manual_user") {
          setStatus("synced");
          setLastSyncAt(new Date().toISOString());
          return;
        }
        const remoteSales = Number(summary.sales_count) || 0;
        const remoteRevenue = Number(summary.sales_revenue) || 0;
        const localSales = Number(local.totalSalesAllTime) || 0;
        const localRevenue = Number(local.totalRevenueAllTime) || 0;
        const diverges =
          remoteSales !== localSales ||
          Math.round(remoteRevenue * 100) !== Math.round(localRevenue * 100);

        if (diverges) {
          setStatus("syncing");
          await supabase.functions.invoke("sync-revantpay-demo", {
            body: { user_id: userId },
          });
          qc.invalidateQueries({ queryKey: ["demo-mode", userId] });
        }
        setStatus("synced");
        setLastSyncAt(new Date().toISOString());
      } catch {
        setStatus("offline");
      } finally {
        inFlightRef.current = false;
      }
    }

    tick();
    const interval = setInterval(() => {
      if (document.visibilityState === "visible" && failCountRef.current < 3) void tick();
    }, 5 * 60_000);

    // Realtime: when demo_settings changes (webhook landed), refresh
    const channel = supabase
      .channel(`demo-sync-${userId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "demo_settings", filter: `user_id=eq.${userId}` },
        () => {
          setLastSyncAt(new Date().toISOString());
          setStatus("synced");
          qc.invalidateQueries({ queryKey: ["demo-mode", userId] });
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [user, qc]);

  return { status, lastSyncAt };
}