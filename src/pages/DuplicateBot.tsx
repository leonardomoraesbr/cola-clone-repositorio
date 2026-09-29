import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, Copy, Loader2, Bot, Layers, Zap, CheckCircle2, KeyRound } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { PageHeader, Panel, StatCard, SectionTitle } from "@/components/ui/stat-kit";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBots } from "@/contexts/BotContext";

export default function DuplicateBot() {
  const { bots } = useBots();
  return (
    <MainLayout>
      <PageHeader
        icon={Copy}
        title="Duplicar Bot"
        subtitle="Clone um bot existente com todas as configurações em segundos"
        gradient="from-primary to-sky-500"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon={Bot} label="Bots na conta" value={bots.length} subValue="Disponíveis para clonar" color="bg-secondary text-primary" />
        <StatCard icon={Layers} label="Blocos copiados" value={5} subValue="Config, planos, automações" color="bg-secondary text-sky-400" />
        <StatCard icon={Zap} label="Tempo médio" value="~10s" subValue="Para clonar tudo" color="bg-secondary text-amber-400" />
        <StatCard icon={KeyRound} label="Requisito" value="Token" subValue="Obtido no @BotFather" color="bg-secondary text-emerald-400" />
      </div>

      <div className="grid lg:grid-cols-[1.4fr_1fr] gap-4 items-start">
        <Panel icon={Copy} title="Nova cópia" subtitle="Origem e token de destino">
          <DuplicateBotForm />
        </Panel>
        <Panel icon={CheckCircle2} title="O que será duplicado" subtitle="Conteúdo do clone">
          <div className="space-y-2">
            {[
              "Configurações do bot (mensagem, mídia, IDs)",
              "Planos de assinatura e order bump",
              "Mensagens de downsell",
              "Mensagens de remarketing",
              "Configurações de renovação",
            ].map((item) => (
              <div key={item} className="flex items-center gap-2 text-xs text-muted-foreground bg-secondary/40 border border-border/50 rounded-lg px-3 py-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" /> {item}
              </div>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground mt-4">
            Vendas, clientes e histórico do bot de origem não são copiados — o clone começa zerado.
          </p>
        </Panel>
      </div>
    </MainLayout>
  );
}

function DuplicateBotForm({ onClose }: { onClose?: () => void }) {
  const { bots, refreshBots, setSelectedBot } = useBots();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [token, setToken] = useState("");
  const [sourceBotId, setSourceBotId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  // Sincroniza a seleção quando os bots carregam ou mudam
  useEffect(() => {
    if (!sourceBotId && bots.length > 0) {
      setSourceBotId(bots[0].id);
    }
  }, [bots, sourceBotId]);

  const handleDuplicate = async () => {
    if (!token.trim()) {
      toast({ title: "Token obrigatório", description: "Insira o token do novo bot.", variant: "destructive" });
      return;
    }
    if (!sourceBotId) {
      toast({ title: "Selecione um bot", description: "Escolha o bot de origem para duplicar.", variant: "destructive" });
      return;
    }
    if (!user) return;

    setIsLoading(true);
    try {
      // Validate token
      const telegramRes = await fetch(`https://api.telegram.org/bot${token.trim()}/getMe`);
      const telegramData = await telegramRes.json();
      if (!telegramData.ok) throw new Error("Token inválido ou bot não encontrado no Telegram");

      const botUsername = telegramData.result.username;
      const botName = telegramData.result.first_name;

      // Check if already exists
      const { data: existing } = await supabase.from("bots").select("id").eq("token", token.trim()).maybeSingle();
      if (existing) {
        toast({ title: "Bot já cadastrado", description: "Este bot já está registrado.", variant: "destructive" });
        setIsLoading(false);
        return;
      }

      // Get source bot
      const sourceBot = bots.find(b => b.id === sourceBotId);
      if (!sourceBot) throw new Error("Bot de origem não encontrado");

      // Create new bot with source config
      const { data: newBot, error: createError } = await supabase
        .from("bots")
        .insert({
          user_id: user.id,
          token: token.trim(),
          username: botUsername,
          name: botName,
          initial_message: sourceBot.initial_message,
          initial_media_type: sourceBot.initial_media_type,
          initial_media_url: sourceBot.initial_media_url,
          initial_buttons: sourceBot.initial_buttons,
          vip_id: sourceBot.vip_id,
          vip_link: sourceBot.vip_link,
          registro_id: sourceBot.registro_id,
          support_contact: sourceBot.support_contact,
          anti_clone: sourceBot.anti_clone,
          welcome_card_enabled: sourceBot.welcome_card_enabled,
          welcome_card_text: sourceBot.welcome_card_text,
          auto_approve_enabled: sourceBot.auto_approve_enabled,
          auto_approve_channel_id: sourceBot.auto_approve_channel_id,
          auto_approve_welcome_message: sourceBot.auto_approve_welcome_message,
          notification_channel_id: sourceBot.notification_channel_id,
        })
        .select()
        .single();

      if (createError) throw createError;

      // Duplicate subscription plans
      const { data: sourcePlans } = await supabase.from("subscription_plans").select("*").eq("bot_id", sourceBotId);
      if (sourcePlans && sourcePlans.length > 0) {
        const planInserts = sourcePlans.map((p: any) => ({
          bot_id: newBot.id,
          name: p.name,
          duration: p.duration,
          duration_days: p.duration_days,
          price: p.price,
          bonus: p.bonus,
          is_active: p.is_active,
          button_style: p.button_style,
          order_bump_enabled: p.order_bump_enabled,
          order_bump_name: p.order_bump_name,
          order_bump_description: p.order_bump_description,
          order_bump_price: p.order_bump_price,
          order_bump_media_url: p.order_bump_media_url,
          order_bump_media_type: p.order_bump_media_type,
          order_bump_title: p.order_bump_title,
          order_bump_yes_button_text: p.order_bump_yes_button_text,
          order_bump_no_button_text: p.order_bump_no_button_text,
          order_bump_button_price_mode: p.order_bump_button_price_mode,
          order_bump_button_price_custom: p.order_bump_button_price_custom,
          sort_order: p.sort_order,
        }));
        await supabase.from("subscription_plans").insert(planInserts);
      }

      // Duplicate downsell messages
      const { data: sourceDownsell } = await supabase.from("downsell_messages").select("*").eq("bot_id", sourceBotId);
      if (sourceDownsell && sourceDownsell.length > 0) {
        const dsInserts = sourceDownsell.map(d => ({
          bot_id: newBot.id,
          message: d.message,
          send_time_minutes: d.send_time_minutes,
          discount_percentage: d.discount_percentage,
          order_index: d.order_index,
          is_active: d.is_active,
          target_audience: d.target_audience,
        }));
        await supabase.from("downsell_messages").insert(dsInserts);
      }

      // Duplicate remarketing messages
      const { data: sourceRemarketing } = await supabase.from("remarketing_messages").select("*").eq("bot_id", sourceBotId);
      if (sourceRemarketing && sourceRemarketing.length > 0) {
        const rmInserts = sourceRemarketing.map(r => ({
          bot_id: newBot.id,
          message: r.message,
          send_time_minutes: r.send_time_minutes,
          order_index: r.order_index,
          is_active: r.is_active,
        }));
        await supabase.from("remarketing_messages").insert(rmInserts);
      }

      // Duplicate renewal settings
      const { data: sourceRenewal } = await supabase.from("renewal_settings").select("*").eq("bot_id", sourceBotId).maybeSingle();
      if (sourceRenewal) {
        await supabase.from("renewal_settings").insert({
          bot_id: newBot.id,
          is_active: sourceRenewal.is_active,
          days_before_expiry: sourceRenewal.days_before_expiry,
          discount_percentage: sourceRenewal.discount_percentage,
          message: sourceRenewal.message,
        });
      }

      await refreshBots();
      setSelectedBot(newBot);
      toast({ title: "Bot duplicado com sucesso!", description: `@${botUsername} foi criado com todas as configurações de @${sourceBot.username}.` });
      onClose?.();
      navigate("/editar-bot");
    } catch (error: any) {
      console.error("Error duplicating bot:", error);
      toast({ title: "Erro ao duplicar", description: error.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <SectionTitle>Bot de origem</SectionTitle>
        <div className="relative">
          <select
            value={sourceBotId}
            onChange={(e) => setSourceBotId(e.target.value)}
            className="w-full input-dark text-sm pr-8 appearance-none cursor-pointer"
          >
            {bots.map((bot) => (
              <option key={bot.id} value={bot.id}>@{bot.username}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        </div>
        <p className="text-xs text-muted-foreground mt-1">Selecione o bot que deseja duplicar</p>
      </div>

      <div>
        <SectionTitle>Token do novo bot</SectionTitle>
        <input
          type="text"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="123456789:ABCDefGHIJKlmNOPQrstUVWxyZ"
          className="w-full input-dark font-mono text-sm"
          disabled={isLoading}
        />
        <p className="text-xs text-muted-foreground mt-1">Cole o token obtido do @BotFather</p>
      </div>

      <div className="pt-1">
        <Button onClick={handleDuplicate} disabled={isLoading || !token.trim()} className="w-full btn-gradient border-0">
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Duplicando...
            </>
          ) : (
            <>
              <Copy className="w-4 h-4 mr-2" />
              Duplicar Bot
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

