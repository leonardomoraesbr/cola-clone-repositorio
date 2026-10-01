import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

type RecoveryStatus = "checking" | "ready" | "invalid";

function getRecoveryError() {
  const params = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const message = params.get("error_description") || hashParams.get("error_description");
  return message;
}

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<RecoveryStatus>("checking");
  const [linkError, setLinkError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    let active = true;
    let timeout: number | undefined;
    const currentUrl = new URL(window.location.href);
    const hashParams = new URLSearchParams(currentUrl.hash.replace(/^#/, ""));
    const hasRecoveryRedirect =
      currentUrl.searchParams.has("code") ||
      currentUrl.searchParams.get("type") === "recovery" ||
      hashParams.get("type") === "recovery";
    const authError = getRecoveryError();

    const markReady = () => {
      if (!active) return;
      setStatus("ready");
      // Remove one-time authorization material from the address bar after the SDK
      // has established the recovery session.
      window.history.replaceState(window.history.state, "", currentUrl.pathname);
      if (timeout) window.clearTimeout(timeout);
    };

    if (authError) {
      setLinkError(authError);
      setStatus("invalid");
      return () => { active = false; };
    }

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (
        session &&
        (event === "PASSWORD_RECOVERY" || (hasRecoveryRedirect && event === "SIGNED_IN"))
      ) {
        markReady();
      }
    });

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) {
        setLinkError("Não foi possível validar o link agora. Peça um novo e tente novamente.");
        setStatus("invalid");
      } else if (data.session && hasRecoveryRedirect) {
        markReady();
      } else if (!hasRecoveryRedirect) {
        setLinkError("Abra esta página pelo link enviado ao seu e-mail de recuperação.");
        setStatus("invalid");
      }
    });

    if (hasRecoveryRedirect) {
      timeout = window.setTimeout(() => {
        if (!active) return;
        setLinkError("O link é inválido ou expirou. Solicite uma nova recuperação de senha.");
        setStatus("invalid");
      }, 12_000);
    }

    return () => {
      active = false;
      if (timeout) window.clearTimeout(timeout);
      authListener.subscription.unsubscribe();
    };
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      toast({ title: "Senha inválida", description: "Use pelo menos 8 caracteres, incluindo letras e números.", variant: "destructive" });
      return;
    }
    if (password !== confirmPassword) {
      toast({ title: "As senhas não coincidem", description: "Digite a mesma senha nos dois campos.", variant: "destructive" });
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast({ title: "Não foi possível redefinir a senha", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Senha atualizada", description: "Sua senha foi redefinida com sucesso." });
    navigate("/dashboard", { replace: true });
  };

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-6">
      {status === "checking" ? (
        <div className="w-full max-w-md space-y-4 rounded-2xl border border-border/60 bg-card p-8 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Validando seu link de recuperação…</p>
        </div>
      ) : status === "invalid" ? (
        <section className="w-full max-w-md space-y-5 rounded-2xl border border-border/60 bg-card p-8 text-center">
          <div>
            <h1 className="text-2xl font-bold">Link inválido ou expirado</h1>
            <p className="mt-2 text-sm text-muted-foreground">{linkError || "Solicite um novo link de recuperação."}</p>
          </div>
          <Button asChild className="w-full btn-gradient border-0">
            <Link to="/auth">Voltar para o login</Link>
          </Button>
        </section>
      ) : (
        <form onSubmit={submit} className="w-full max-w-md space-y-5 rounded-2xl border border-border/60 bg-card p-8">
          <div>
            <h1 className="text-2xl font-bold">Criar nova senha</h1>
            <p className="mt-2 text-sm text-muted-foreground">Escolha uma senha nova para acessar sua conta Riot VIPS.</p>
          </div>
          <label className="block text-sm font-medium">
            Nova senha
            <span className="relative mt-2 block">
              <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <input type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="input-dark w-full pl-12" />
            </span>
          </label>
          <label className="block text-sm font-medium">
            Confirmar nova senha
            <span className="relative mt-2 block">
              <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <input type="password" autoComplete="new-password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="input-dark w-full pl-12" />
            </span>
          </label>
          <Button type="submit" disabled={loading} className="w-full btn-gradient border-0">
            {loading ? "Salvando…" : "Redefinir senha"}
          </Button>
        </form>
      )}
    </main>
  );
}
