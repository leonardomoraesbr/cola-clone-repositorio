import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface CustomDomain {
  id: string;
  domain: string;
  is_verified: boolean;
  verification_token?: string;
  dns_verified_at?: string;
  created_at?: string;
}

export function useCustomDomains() {
  const [domains, setDomains] = useState<CustomDomain[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("linkter-api", {
        body: { action: "list-domains" },
      });
      if (error) throw error;
      setDomains((data?.data as CustomDomain[]) || []);
    } catch (e) {
      console.error("Erro ao carregar domínios:", e);
      setDomains([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return { domains, loading, reload: load, verified: domains.filter((d) => d.is_verified) };
}
