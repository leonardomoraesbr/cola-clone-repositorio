import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Link2, AlertTriangle } from "lucide-react";

export default function LinkRedirect() {
  const { slug } = useParams();
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("custom-link-redirect", {
          body: { slug },
        });
        if (cancelled) return;
        if (error || !data?.destination) {
          setError("Este link não está disponível.");
          return;
        }
        setInfo(data);
        const delay = data.redirect_page ? 2200 : 0;
        setTimeout(() => window.location.replace(data.destination), delay);
      } catch {
        if (!cancelled) setError("Não foi possível abrir este link.");
      }
    })();
    return () => { cancelled = true; };
  }, [slug]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center">
      {error ? (
        <>
          <AlertTriangle className="w-10 h-10 text-destructive mb-4" />
          <h1 className="text-xl font-bold">Link indisponível</h1>
          <p className="text-sm text-muted-foreground mt-2">{error}</p>
        </>
      ) : (
        <>
          <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/25 flex items-center justify-center mb-5">
            <Link2 className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-xl font-bold">{info?.redirect_page_title || "Abrindo seu acesso..."}</h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-md">
            {info?.redirect_page_text || "Estamos te levando para o destino seguro. Aguarde um instante."}
          </p>
          <Loader2 className="w-5 h-5 animate-spin text-primary mt-6" />
        </>
      )}
    </div>
  );
}