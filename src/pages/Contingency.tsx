import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBots } from "@/contexts/BotContext";
import {
  Shield,
  Plus,
  Trash2,
  Copy,
  Loader2,
  Bot,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Bell,
  RefreshCw,
} from "lucide-react";
import { PageHeader, StatCard, Panel } from "@/components/ui/stat-kit";

interface ContingencyGroup {
  id: string;
  name: string;
  link_slug: string;
  strategy: string;
  is_active: boolean;
  created_at: string;
}

interface GroupBot {
  id: string;
  bot_id: string;
  is_active: boolean;
  priority: number;
  bot_name?: string;
  bot_username?: string;
  health_status?: string;
}

export default function Contingency() {
  const { user } = useAuth();
  const { bots } = useBots();
  const { toast } = useToast();
  const [groups, setGroups] = useState<ContingencyGroup[]>([]);
  const [groupBots, setGroupBots] = useState<Record<string, GroupBot[]>>({});
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupStrategy, setNewGroupStrategy] = useState("round-robin");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [notificationChannelId, setNotificationChannelId] = useState("");
  const [savingNotif, setSavingNotif] = useState(false);

  useEffect(() => {
    if (user) {
      fetchGroups();
      loadNotificationChannel();
    }
  }, [user]);

  const loadNotificationChannel = async () => {
    if (!bots.length) return;
    const bot = bots.find(b => b.notification_channel_id);
    if (bot) {
      setNotificationChannelId(bot.notification_channel_id || "");
    }
  };

  const fetchGroups = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("contingency_groups")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setGroups((data as any) || []);

      // Fetch bots for each group
      if (data && data.length > 0) {
        const groupIds = data.map((g: any) => g.id);
        const { data: gbData, error: gbError } = await supabase
          .from("contingency_group_bots")
          .select("*")
          .in("group_id", groupIds);

        if (!gbError && gbData) {
          const mapped: Record<string, GroupBot[]> = {};
          for (const gb of gbData as any[]) {
            const bot = bots.find(b => b.id === gb.bot_id);
            const entry: GroupBot = {
              ...gb,
              bot_name: bot?.name,
              bot_username: bot?.username,
              health_status: bot?.health_status || "unknown",
            };
            if (!mapped[gb.group_id]) mapped[gb.group_id] = [];
            mapped[gb.group_id].push(entry);
          }
          setGroupBots(mapped);
        }
      }
    } catch (error) {
      console.error("Error fetching groups:", error);
    } finally {
      setLoading(false);
    }
  };

  const generateSlug = () => {
    return Math.random().toString(36).substring(2, 10);
  };

  const handleCreateGroup = async () => {
    if (!user || !newGroupName.trim()) return;
    setCreating(true);
    try {
      const { error } = await supabase.from("contingency_groups").insert({
        user_id: user.id,
        name: newGroupName,
        link_slug: generateSlug(),
        strategy: newGroupStrategy,
      } as any);

      if (error) throw error;
      toast({ title: "Grupo criado!" });
      setNewGroupName("");
      setShowCreateForm(false);
      await fetchGroups();
    } catch (error: any) {
      toast({ title: "Erro ao criar grupo", description: error.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    if (!confirm("Tem certeza que deseja excluir este grupo?")) return;
    try {
      const { error } = await supabase.from("contingency_groups").delete().eq("id", groupId);
      if (error) throw error;
      toast({ title: "Grupo excluído" });
      await fetchGroups();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  };

  const handleAddBotToGroup = async (groupId: string, botId: string) => {
    try {
      const currentBots = groupBots[groupId] || [];
      const { error } = await supabase.from("contingency_group_bots").insert({
        group_id: groupId,
        bot_id: botId,
        priority: currentBots.length,
      } as any);

      if (error) throw error;
      toast({ title: "Bot adicionado ao grupo" });
      await fetchGroups();
    } catch (error: any) {
      if (error.message?.includes("duplicate")) {
        toast({ title: "Bot já está no grupo", variant: "destructive" });
      } else {
        toast({ title: "Erro", description: error.message, variant: "destructive" });
      }
    }
  };

  const handleRemoveBotFromGroup = async (gbId: string) => {
    try {
      const { error } = await supabase.from("contingency_group_bots").delete().eq("id", gbId);
      if (error) throw error;
      toast({ title: "Bot removido do grupo" });
      await fetchGroups();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  };

  const handleToggleGroup = async (groupId: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from("contingency_groups")
        .update({ is_active: isActive } as any)
        .eq("id", groupId);
      if (error) throw error;
      setGroups(prev => prev.map(g => g.id === groupId ? { ...g, is_active: isActive } : g));
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  };

  const copyLink = (slug: string) => {
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const url = `https://${projectId}.supabase.co/functions/v1/contingency-redirect?slug=${slug}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Link copiado!" });
  };

  const handleSaveNotificationChannel = async () => {
    if (!bots.length) return;
    setSavingNotif(true);
    try {
      // Save notification channel to all user's bots
      for (const bot of bots) {
        await supabase
          .from("bots")
          .update({ notification_channel_id: notificationChannelId || null } as any)
          .eq("id", bot.id);
      }
      toast({ title: "Canal de notificações salvo!" });
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setSavingNotif(false);
    }
  };

  const getHealthIcon = (status?: string) => {
    switch (status) {
      case "active":
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case "banned":
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <HelpCircle className="w-4 h-4 text-yellow-500" />;
    }
  };

  const getHealthLabel = (status?: string) => {
    switch (status) {
      case "active": return "Ativo";
      case "banned": return "Banido";
      default: return "Desconhecido";
    }
  };

  return (
    <MainLayout>
      <div className="max-w-5xl mx-auto">
        <PageHeader
          icon={Shield}
          title="Contingência"
          subtitle="Failover automático e monitoramento de bots"
          gradient="from-orange-500 to-red-500"
          action={
            <Button onClick={() => setShowCreateForm(!showCreateForm)} className="btn-gradient">
              <Plus className="w-4 h-4 mr-2" />
              Novo Grupo
            </Button>
          }
        />

        {/* Summary */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard
            icon={Shield}
            label="Grupos"
            value={groups.length}
            subValue={groups.filter(g => g.is_active).length + " ativos"}
            color="bg-primary/20 text-primary"
            progress={groups.length ? 100 : 0}
          />
          <StatCard
            icon={Bot}
            label="Bots monitorados"
            value={bots.length}
            subValue="Na conta"
            color="bg-blue-500/20 text-blue-400"
            bar="bg-blue-500"
          />
          <StatCard
            icon={CheckCircle2}
            label="Saudáveis"
            value={bots.filter(b => b.health_status === "active").length}
            subValue="Respondendo"
            color="bg-emerald-500/20 text-emerald-400"
            bar="bg-emerald-500"
            progress={bots.length ? (bots.filter(b => b.health_status === "active").length / bots.length) * 100 : 0}
          />
          <StatCard
            icon={AlertTriangle}
            label="Banidos"
            value={bots.filter(b => b.health_status === "banned").length}
            subValue="Requer troca"
            color="bg-destructive/20 text-destructive"
            bar="bg-destructive"
            progress={bots.length ? (bots.filter(b => b.health_status === "banned").length / bots.length) * 100 : 0}
          />
        </div>

        <div className="space-y-6">
        {/* Notification Settings */}
        <Panel icon={Bell} title="Notificações de Ban" subtitle="Alertas no Telegram">
          <p className="text-sm text-muted-foreground mb-4">
            Configure um canal/grupo do Telegram para receber alertas quando um bot for banido. Adicione todos os seus bots ao canal com permissão de enviar mensagens.
          </p>
          <div className="flex flex-wrap gap-3">
            <input
              type="text"
              value={notificationChannelId}
              onChange={e => setNotificationChannelId(e.target.value)}
              placeholder="ID do canal/grupo (ex: -1001234567890)"
              className="flex-1 min-w-[220px] input-dark"
            />
            <Button onClick={handleSaveNotificationChannel} disabled={savingNotif} className="btn-gradient">
              {savingNotif ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar"}
            </Button>
          </div>
        </Panel>

        {/* Bot Health Overview */}
        <Panel
          icon={Bot}
          title="Saúde dos Bots"
          subtitle="Status em tempo real"
          action={
            <Button variant="outline" size="sm" onClick={fetchGroups} className="border-border">
              <RefreshCw className="w-4 h-4 mr-1" />
              Atualizar
            </Button>
          }
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {bots.map(bot => (
              <div key={bot.id} className="flex items-center gap-3 p-3 rounded-xl bg-secondary/30 border border-border/50 hover:border-primary/30 transition-colors">
                {getHealthIcon(bot.health_status)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">@{bot.username}</p>
                  <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{getHealthLabel(bot.health_status)}</p>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        {/* Create Group Form */}
        {showCreateForm && (
          <Panel icon={Plus} title="Novo Grupo de Contingência" subtitle="Distribuição de tráfego">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Nome do Grupo</label>
                <input
                  type="text"
                  value={newGroupName}
                  onChange={e => setNewGroupName(e.target.value)}
                  placeholder="Ex: Grupo Principal"
                  className="w-full input-dark"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Estratégia de Distribuição</label>
                <select
                  value={newGroupStrategy}
                  onChange={e => setNewGroupStrategy(e.target.value)}
                  className="w-full input-dark"
                >
                  <option value="round-robin">Round Robin (alternado)</option>
                  <option value="random">Aleatório</option>
                </select>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setShowCreateForm(false)} className="border-border">
                  Cancelar
                </Button>
                <Button onClick={handleCreateGroup} disabled={creating || !newGroupName.trim()} className="btn-gradient">
                  {creating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Criar Grupo
                </Button>
              </div>
            </div>
          </Panel>
        )}

        {/* Groups List */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : groups.length === 0 ? (
          <div className="glass-card p-12 text-center animate-fade-in">
            <Shield className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhum grupo de contingência</h3>
            <p className="text-muted-foreground mb-4">
              Crie um grupo para distribuir tráfego entre múltiplos bots com failover automático.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {groups.map(group => {
              const botsInGroup = groupBots[group.id] || [];
              const botsNotInGroup = bots.filter(b => !botsInGroup.find(gb => gb.bot_id === b.id));

              return (
                <div key={group.id} className="glass-card p-6 animate-fade-in hover:border-primary/30 transition-all">
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-4 border-b border-border/30">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-orange-500/15 border border-orange-500/20 flex items-center justify-center shrink-0">
                        <Shield className="w-4 h-4 text-orange-400" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold truncate">{group.name}</h3>
                        <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                          {group.strategy === "round-robin" ? "Round Robin" : "Aleatório"} · {botsInGroup.length} bot(s)
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={group.is_active}
                        onCheckedChange={(checked) => handleToggleGroup(group.id, checked)}
                      />
                      <Button variant="outline" size="sm" onClick={() => copyLink(group.link_slug)} className="border-border">
                        <Copy className="w-4 h-4 mr-1" />
                        Copiar Link
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="border-destructive/50 text-destructive hover:bg-destructive/10"
                        onClick={() => handleDeleteGroup(group.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Bots in group */}
                  <div className="space-y-2 mb-4">
                    {botsInGroup.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-3 text-center border border-dashed border-border rounded-lg">
                        Nenhum bot adicionado. Adicione bots abaixo.
                      </p>
                    ) : (
                      botsInGroup.map((gb, i) => (
                        <div
                          key={gb.id}
                          className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border/50"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-muted-foreground font-mono">#{i + 1}</span>
                            {getHealthIcon(gb.health_status)}
                            <div>
                              <span className="font-medium text-sm">@{gb.bot_username || "?"}</span>
                              <span className="text-xs text-muted-foreground ml-2">{getHealthLabel(gb.health_status)}</span>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:bg-destructive/10"
                            onClick={() => handleRemoveBotFromGroup(gb.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Add bot to group */}
                  {botsNotInGroup.length > 0 && (
                    <div className="flex items-center gap-2">
                      <select
                        id={`add-bot-${group.id}`}
                        className="flex-1 input-dark text-sm"
                        defaultValue=""
                      >
                        <option value="" disabled>Adicionar bot...</option>
                        {botsNotInGroup.map(b => (
                          <option key={b.id} value={b.id}>@{b.username}</option>
                        ))}
                      </select>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-border"
                        onClick={() => {
                          const select = document.getElementById(`add-bot-${group.id}`) as HTMLSelectElement;
                          if (select?.value) {
                            handleAddBotToGroup(group.id, select.value);
                            select.value = "";
                          }
                        }}
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        </div>
      </div>
    </MainLayout>
  );
}
