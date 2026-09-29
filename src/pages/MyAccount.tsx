import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { User, Mail, Lock, LogOut, Loader2, Save, Smartphone } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { SalesWidgetPanel } from "@/components/widget/SalesWidgetPanel";

export default function MyAccount() {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast({ title: "Senha muito curta", description: "A senha deve ter pelo menos 6 caracteres.", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Senhas não coincidem", description: "Confirme a senha corretamente.", variant: "destructive" });
      return;
    }
    setChangingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Senha atualizada!", description: "Sua senha foi alterada com sucesso." });
      setNewPassword("");
      setConfirmPassword("");
    }
    setChangingPassword(false);
  };

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <MainLayout>
      <div className="max-w-lg mx-auto">
        <div className="text-center mb-8 animate-fade-in">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-teal-500/20 flex items-center justify-center mx-auto mb-4">
            <User className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold mb-1">Minha Conta</h1>
          <p className="text-muted-foreground">Gerencie suas informações e segurança</p>
        </div>

        {/* Account Info */}
        <div className="glass-card p-6 mb-6 animate-fade-in">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Mail className="w-5 h-5 text-primary" />
            Informações
          </h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-border/50">
              <span className="text-sm text-muted-foreground">Email</span>
              <span className="font-medium text-sm">{user?.email}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-border/50">
              <span className="text-sm text-muted-foreground">Nome</span>
              <span className="font-medium text-sm">{user?.user_metadata?.full_name || "Não definido"}</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-muted-foreground">Conta criada em</span>
              <span className="font-medium text-sm">
                {user?.created_at ? new Date(user.created_at).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : "—"}
              </span>
            </div>
          </div>
        </div>

        {/* Change Password */}
        <div className="glass-card p-6 mb-6 animate-fade-in" style={{ animationDelay: "0.1s" }}>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Lock className="w-5 h-5 text-primary" />
            Redefinir Senha
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Nova Senha</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="w-full input-dark"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Confirmar Senha</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repita a nova senha"
                className="w-full input-dark"
              />
            </div>
            <Button
              onClick={handleChangePassword}
              disabled={changingPassword || !newPassword}
              className="w-full btn-gradient border-0"
            >
              {changingPassword ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Alterar Senha
            </Button>
          </div>
        </div>

        {/* Widget iOS */}
        <div className="glass-card p-6 mb-6 animate-fade-in" style={{ animationDelay: "0.15s" }}>
          <h2 className="text-lg font-semibold mb-2 flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-primary" />
            Widget iOS
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Veja o faturamento do dia direto na tela inicial do iPhone.
          </p>
          <Dialog>
            <DialogTrigger asChild>
              <Button className="w-full btn-gradient border-0">
                <Smartphone className="w-4 h-4 mr-2" />
                Configurar Widget iOS
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Painel iOS — Faturamento</DialogTitle>
                <DialogDescription>Acompanhe o caixa do dia direto na tela do iPhone</DialogDescription>
              </DialogHeader>
              <SalesWidgetPanel />
            </DialogContent>
          </Dialog>
        </div>

        {/* Logout */}
        <div className="animate-fade-in" style={{ animationDelay: "0.2s" }}>
          <Button
            onClick={handleLogout}
            variant="outline"
            className="w-full border-destructive/50 text-destructive hover:bg-destructive/10"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sair da Conta
          </Button>
        </div>
      </div>
    </MainLayout>
  );
}
