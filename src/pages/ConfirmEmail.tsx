import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

type ConfirmationStatus = "checking" | "invalid";

export default function ConfirmEmail() {
  const [status, setStatus] = useState<ConfirmationStatus>("checking");
  const [message, setMessage] = useState("Validando a confirmação do seu e-mail…");
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    let completed = false;
    const timeout = { id: undefined as number | undefined };
    const currentUrl = new URL(window.location.href);
    const params = new URLSearchParams(currentUrl.search);
    const hashParams = new URLSearchParams(currentUrl.hash.replace(/^#/, ""));
    const authError = params.has("error") || hashParams.has("error");
    const hasAuthCallback =
      params.has("code") ||
      params.has("token_hash") ||
      hashParams.has("access_token") ||
      hashParams.get("type") === "signup" ||
      hashParams.has("token_hash");

    const fail = (text: string) => {
      if (!active || completed) return;
      setMessage(text);
      setStatus("invalid");
      if (timeout.id) window.clearTimeout(timeout.id);
    };

    const finish = (user: { email_confirmed_at?: string | null } | null) => {
      if (!active || completed || !user?.email_confirmed_at) return;
      completed = true;
      if (timeout.id) window.clearTimeout(timeout.id);
      window.history.replaceState(window.history.state, "", currentUrl.pathname);
      navigate("/configuracoes-iniciais", { replace: true });
    };

    if (authError) {
      fail("O link de confirmação é inválido ou expirou. Solicite um novo e-mail de confirmação.");
      return () => { active = false; };
    }
    if (!hasAuthCallback) {
      fail("Abra esta página pelo link de confirmação enviado ao seu e-mail.");
      return () => { active = false; };
    }

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      finish(session?.user ?? null);
    });

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) {
        fail("Não foi possível validar a confirmação. Tente abrir novamente o link mais recente.");
      } else {
        finish(data.session?.user ?? null);
      }
    });

    timeout.id = window.setTimeout(() => {
      fail("Não foi possível confirmar a conta. Solicite o reenvio do e-mail e use o link mais recente.");
    }, 15_000);

    return () => {
      active = false;
      if (timeout.id) window.clearTimeout(timeout.id);
      authListener.subscription.unsubscribe();
    };
  }, [navigate]);

  if (status === "checking") {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-4 rounded-2xl border border-border/60 bg-card p-8 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <h1 className="text-xl font-bold">Confirmando seu e-mail</h1>
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-6">
      <section className="w-full max-w-md space-y-5 rounded-2xl border border-border/60 bg-card p-8 text-center">
        <div>
          <h1 className="text-2xl font-bold">Não foi possível confirmar</h1>
          <p className="mt-2 text-sm text-muted-foreground">{message}</p>
        </div>
        <Button asChild className="w-full btn-gradient border-0">
          <Link to="/auth">Voltar para o acesso</Link>
        </Button>
      </section>
    </main>
  );
}
