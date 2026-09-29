import { useState } from "react";
import { Archive, Download, Upload, Loader2, FileJson, ShieldCheck, Bot, AlertTriangle } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { PageHeader, Panel, StatCard, SectionTitle } from "@/components/ui/stat-kit";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useBots } from "@/contexts/BotContext";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const BOT_FIELDS = [
  "initial_message", "initial_media_type", "initial_media_url", "initial_buttons",
  "vip_id", "vip_link", "registro_id", "support_contact", "anti_clone",
  "welcome_card_enabled", "welcome_card_text", "auto_approve_enabled",
  "auto_approve_channel_id", "auto_approve_welcome_message", "notification_channel_id",
  "cross_bot_upsell_message",
] as const;

const CHILD_TABLES = [
  { table: "subscription_plans", label: "Planos de assinatura" },
  { table: "downsell_messages", label: "Downsell" },
  { table: "remarketing_messages", label: "Remarketing" },
  { table: "renewal_settings", label: "Renovação automática" },
  { table: "upsell_offers", label: "Ofertas de upsell" },
  { table: "mailing_messages", label: "Campanhas de remarketing" },
  { table: "channel_messages", label: "Postadores" },
  { table: "price_rules", label: "Regras de preço" },
] as const;

const STRIP = ["id", "bot_id", "created_at", "updated_at", "last_sent_at", "next_send_at", "sent_count", "revenue_generated"];

function clean(row: any) {
  const out: any = {};
  for (const [k, v] of Object.entries(row)) if (!STRIP.includes(k)) out[k] = v;
  return out;
}

export default function BotBackup() {
  const { bots, selectedBot, refreshBots } = useBots();
  const { toast } = useToast();
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [payload, setPayload] = useState<any | null>(null);
  const [fileName, setFileName] = useState("");
  const [targetBotId, setTargetBotId] = useState<string>(selectedBot?.id || "");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleExport = async () => {
    if (!selectedBot) return;
    setExporting(true);
    try {
      const bot: any = {};
      for (const f of BOT_FIELDS) bot[f] = (selectedBot as any)[f] ?? null;

      const data: Record<string, any[]> = {};
      for (const { table } of CHILD_TABLES) {
        const { data: rows } = await supabase.from(table as any).select("*").eq("bot_id", selectedBot.id);
        data[table] = (rows || []).map(clean);
      }

      const backup = {
        format: "riotvips.bot-backup",
        version: 1,
        exported_at: new Date().toISOString(),
        source_bot: { name: selectedBot.name, username: selectedBot.username },
        bot,
        data,
      };

      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `riotvips-backup-${selectedBot.username}-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Backup exportado", description: `Configuração de @${selectedBot.username} salva em arquivo.` });
    } catch (e: any) {
      toast({ title: "Erro ao exportar", description: e.message, variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const handleFile = async (file: File) => {
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      if (json?.format !== "riotvips.bot-backup") throw new Error("Arquivo não é um backup válido da Riot Vips.");
      setPayload(json);
      setFileName(file.name);
      toast({ title: "Backup carregado", description: `Origem: @${json.source_bot?.username || "desconhecido"}` });
    } catch (e: any) {
      setPayload(null);
      setFileName("");
      toast({ title: "Arquivo inválido", description: e.message, variant: "destructive" });
    }
  };

  const runImport = async () => {
    if (!payload || !targetBotId) return;
    setImporting(true);
    try {
      const botUpdate: any = {};
      for (const f of BOT_FIELDS) if (f in (payload.bot || {})) botUpdate[f] = payload.bot[f];
      const { error: upErr } = await supabase.from("bots").update(botUpdate).eq("id", targetBotId);
      if (upErr) throw upErr;

      for (const { table } of CHILD_TABLES) {
        const rows = payload.data?.[table];
        if (!Array.isArray(rows)) continue;
        await supabase.from(table as any).delete().eq("bot_id", targetBotId);
        if (rows.length) {
          const inserts = rows.map((r: any) => ({ ...clean(r), bot_id: targetBotId }));
          const { error } = await supabase.from(table as any).insert(inserts);
          if (error) throw new Error(`${table}: ${error.message}`);
        }
      }

      await refreshBots();
      toast({ title: "Backup restaurado", description: "Todas as configurações foram aplicadas ao bot escolhido." });
      setPayload(null);
      setFileName("");
    } catch (e: any) {
      toast({ title: "Erro ao restaurar", description: e.message, variant: "destructive" });
    } finally {
      setImporting(false);
      setConfirmOpen(false);
    }
  };

  const targetBot = bots.find((b) => b.id === targetBotId);

  return (
    <MainLayout>
      <PageHeader
        icon={Archive}
        title="Backup & Restauração"
        subtitle="Exporte e importe toda a configuração de um bot"
        gradient="from-primary to-indigo-500"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon={Bot} label="Bots na conta" value={bots.length} subValue="Disponíveis" color="bg-secondary text-primary" />
        <StatCard icon={FileJson} label="Itens no backup" value={CHILD_TABLES.length + 1} subValue="Blocos de config" color="bg-secondary text-sky-400" />
        <StatCard icon={ShieldCheck} label="Bot atual" value={selectedBot ? `@${selectedBot.username}` : "—"} subValue="Origem da exportação" color="bg-secondary text-emerald-400" />
        <StatCard icon={Upload} label="Arquivo carregado" value={payload ? "Sim" : "Não"} subValue={fileName || "Nenhum"} color="bg-secondary text-amber-400" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Panel icon={Download} title="Exportar configuração" subtitle="Gera um arquivo .json">
          <p className="text-sm text-muted-foreground mb-4">
            Salva mensagem inicial, mídia, botões, entrega VIP, planos, downsell, remarketing, upsell,
            postadores e regras de preço do bot selecionado.
          </p>
          <SectionTitle>Incluído no arquivo</SectionTitle>
          <div className="grid sm:grid-cols-2 gap-2 mb-5">
            {[{ label: "Configuração do bot" }, ...CHILD_TABLES].map((t) => (
              <div key={t.label} className="flex items-center gap-2 text-xs text-muted-foreground bg-secondary/40 border border-border/50 rounded-lg px-3 py-2">
                <ShieldCheck className="w-3.5 h-3.5 text-primary shrink-0" /> {t.label}
              </div>
            ))}
          </div>
          <Button onClick={handleExport} disabled={!selectedBot || exporting} className="w-full btn-gradient border-0">
            {exporting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Gerando...</> : <><Download className="w-4 h-4 mr-2" /> Exportar backup</>}
          </Button>
        </Panel>

        <Panel icon={Upload} title="Restaurar backup" subtitle="Aplica em um bot existente">
          <label className="block border border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:border-primary/50 transition-colors mb-4">
            <input
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.currentTarget.value = ""; }}
            />
            <FileJson className="w-6 h-6 text-primary mx-auto mb-2" />
            <p className="text-sm font-medium">{fileName || "Escolher arquivo .json"}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {payload ? `Origem: @${payload.source_bot?.username}` : "Clique para selecionar o backup"}
            </p>
          </label>

          <SectionTitle>Bot de destino</SectionTitle>
          <select
            value={targetBotId}
            onChange={(e) => setTargetBotId(e.target.value)}
            className="w-full input-dark text-sm mb-4 cursor-pointer"
          >
            <option value="">Selecione um bot</option>
            {bots.map((b) => <option key={b.id} value={b.id}>@{b.username}</option>)}
          </select>

          <div className="flex items-start gap-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 mb-4">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>A restauração substitui planos, automações e postadores atuais do bot de destino. O token e o histórico de vendas não são alterados.</span>
          </div>

          <Button
            onClick={() => setConfirmOpen(true)}
            disabled={!payload || !targetBotId || importing}
            className="w-full btn-gradient border-0"
          >
            {importing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Restaurando...</> : <><Upload className="w-4 h-4 mr-2" /> Restaurar no bot</>}
          </Button>
        </Panel>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restaurar backup?</AlertDialogTitle>
            <AlertDialogDescription>
              As configurações atuais de {targetBot ? `@${targetBot.username}` : "do bot"} serão substituídas
              pelo conteúdo do arquivo. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={runImport}>Restaurar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
