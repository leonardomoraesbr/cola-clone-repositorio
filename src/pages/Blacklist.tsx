import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useBots } from "@/contexts/BotContext";
import { Bot, Loader2, ShieldBan, Plus, Trash2, Search } from "lucide-react";
import { PageHeader, StatCard, Panel } from "@/components/ui/stat-kit";

interface BlacklistedUser {
  id: string;
  bot_id: string;
  telegram_user_id: number;
  telegram_username: string | null;
  telegram_first_name: string | null;
  reason: string | null;
  created_at: string;
}

export default function Blacklist() {
  const { selectedBot } = useBots();
  const { toast } = useToast();
  const [users, setUsers] = useState<BlacklistedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newUserId, setNewUserId] = useState("");
  const [newReason, setNewReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (selectedBot) fetchBlacklist();
    else setLoading(false);
  }, [selectedBot]);

  const fetchBlacklist = async () => {
    if (!selectedBot) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("blacklisted_users")
        .select("*")
        .eq("bot_id", selectedBot.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setUsers((data as any) || []);
    } catch (error) {
      console.error("Error fetching blacklist:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!selectedBot || !newUserId.trim()) {
      toast({ title: "Informe o ID do Telegram", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const telegramId = parseInt(newUserId);
      if (isNaN(telegramId)) throw new Error("ID inválido");

      // Try to find username from bot_users
      const { data: botUser } = await supabase
        .from("bot_users")
        .select("telegram_username, telegram_first_name")
        .eq("bot_id", selectedBot.id)
        .eq("telegram_user_id", telegramId)
        .maybeSingle();

      const { error } = await supabase.from("blacklisted_users").insert({
        bot_id: selectedBot.id,
        telegram_user_id: telegramId,
        telegram_username: botUser?.telegram_username || null,
        telegram_first_name: botUser?.telegram_first_name || null,
        reason: newReason || null,
      } as any);

      if (error) {
        if (error.code === "23505") {
          toast({ title: "Usuário já está na blacklist", variant: "destructive" });
        } else throw error;
      } else {
        toast({ title: "Usuário bloqueado!" });
        setNewUserId("");
        setNewReason("");
        setShowAdd(false);
        await fetchBlacklist();
      }
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (id: string) => {
    try {
      await supabase.from("blacklisted_users").delete().eq("id", id);
      toast({ title: "Usuário desbloqueado" });
      setUsers(prev => prev.filter(u => u.id !== id));
    } catch (error) {
      toast({ title: "Erro ao remover", variant: "destructive" });
    }
  };

  const filtered = users.filter(u =>
    !search ||
    u.telegram_user_id.toString().includes(search) ||
    u.telegram_username?.toLowerCase().includes(search.toLowerCase()) ||
    u.telegram_first_name?.toLowerCase().includes(search.toLowerCase())
  );

  if (!selectedBot) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
          <Bot className="w-16 h-16 text-muted-foreground mb-4" />
          <h2 className="text-xl font-bold mb-2">Nenhum bot selecionado</h2>
          <p className="text-muted-foreground">Selecione um bot para gerenciar a blacklist</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto">
        <PageHeader
          icon={ShieldBan}
          title="Blacklist"
          subtitle="Bloqueie usuários indesejados do seu bot"
          gradient="from-red-500 to-rose-600"
          action={
            <Button onClick={() => setShowAdd(!showAdd)} className="btn-gradient">
              <Plus className="w-4 h-4 mr-2" />
              Bloquear
            </Button>
          }
        />

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <StatCard
            icon={ShieldBan}
            label="Bloqueados"
            value={users.length}
            subValue="Total no bot"
            color="bg-destructive/20 text-destructive"
            bar="bg-destructive"
            progress={users.length ? 100 : 0}
          />
          <StatCard
            icon={Plus}
            label="Últimos 7 dias"
            value={users.filter(u => Date.now() - new Date(u.created_at).getTime() < 7 * 864e5).length}
            subValue="Novos bloqueios"
            color="bg-amber-500/20 text-amber-400"
            bar="bg-amber-500"
          />
          <StatCard
            icon={Search}
            label="Com motivo"
            value={users.filter(u => !!u.reason).length}
            subValue="Registro documentado"
            color="bg-primary/20 text-primary"
            progress={users.length ? (users.filter(u => !!u.reason).length / users.length) * 100 : 0}
          />
        </div>

        <div className="space-y-6">
        <div className="glass-card p-4 animate-fade-in border-l-2 border-destructive">
          <p className="text-sm text-muted-foreground">
            Usuários bloqueados não receberão mensagens do bot e seus comandos serão ignorados.
          </p>
        </div>

        {/* Add Form */}
        {showAdd && (
          <Panel icon={ShieldBan} title="Bloquear Usuário" subtitle="Informe os dados">
            <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">ID do Telegram</label>
              <input
                type="number"
                value={newUserId}
                onChange={e => setNewUserId(e.target.value)}
                className="w-full input-dark font-mono"
                placeholder="Ex: 123456789"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Motivo (opcional)</label>
              <input
                value={newReason}
                onChange={e => setNewReason(e.target.value)}
                className="w-full input-dark"
                placeholder="Ex: Golpista, abuso de PIX..."
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAdd(false)}>Cancelar</Button>
              <Button onClick={handleAdd} disabled={saving} className="bg-destructive hover:bg-destructive/90">
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ShieldBan className="w-4 h-4 mr-2" />}
                Bloquear
              </Button>
            </div>
            </div>
          </Panel>
        )}

        {/* Search */}
        {users.length > 0 && (
          <div className="relative animate-fade-in">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full input-dark pl-10"
              placeholder="Buscar por ID, username ou nome..."
            />
          </div>
        )}

        {/* List */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="glass-card p-12 text-center animate-fade-in">
            <ShieldBan className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              {users.length === 0 ? "Nenhum usuário bloqueado" : "Nenhum resultado encontrado"}
            </h3>
            <p className="text-muted-foreground">
              {users.length === 0 ? "A blacklist está vazia." : "Tente outro termo de busca."}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(user => (
              <div key={user.id} className="glass-card p-4 flex items-center justify-between gap-3 animate-fade-in hover:border-destructive/40 transition-all">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-destructive/15 border border-destructive/20 flex items-center justify-center shrink-0">
                    <ShieldBan className="w-5 h-5 text-destructive" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium truncate">
                      {user.telegram_first_name || user.telegram_username || `ID: ${user.telegram_user_id}`}
                      {user.telegram_username && (
                        <span className="text-muted-foreground text-sm ml-2">@{user.telegram_username}</span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground font-mono truncate">
                      ID: {user.telegram_user_id}
                      {user.reason && <span className="ml-2">• {user.reason}</span>}
                    </p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => handleRemove(user.id)} className="shrink-0 text-muted-foreground hover:text-green-400">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
        </div>
      </div>
    </MainLayout>
  );
}
