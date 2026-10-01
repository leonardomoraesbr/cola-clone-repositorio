import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

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
      <form onSubmit={submit} className="w-full max-w-md space-y-5 rounded-2xl border border-border/60 bg-card p-8">
        <div>
          <h1 className="text-2xl font-bold">Criar nova senha</h1>
          <p className="mt-2 text-sm text-muted-foreground">Escolha uma senha nova para acessar sua conta.</p>
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
          {loading ? "Salvando..." : "Redefinir senha"}
        </Button>
      </form>
    </main>
  );
}
