import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatBrtShort } from "@/lib/brtDate";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/stat-kit";
import { Search, Loader2, Download, Eye, RefreshCw } from "lucide-react";

interface Hit {
  kind: string;
  field: string;
  text: string;
  botId?: string | null;
  botUsername?: string;
  ownerId?: string | null;
  ownerLabel?: string;
  created_at?: string | null;
  extra?: string;
}

const KIND_COLORS: Record<string, string> = {
  "Bot": "bg-primary/10 text-primary",
  "Plano": "bg-emerald-500/10 text-emerald-400",
  "Order bump": "bg-teal-500/10 text-teal-300",
  "Botão": "bg-sky-500/10 text-sky-400",
  "Downsell": "bg-amber-500/10 text-amber-400",
  "Upsell": "bg-fuchsia-500/10 text-fuchsia-400",
  "Remarketing": "bg-violet-500/10 text-violet-400",
  "Postador": "bg-cyan-500/10 text-cyan-400",
  "Teste A/B": "bg-rose-500/10 text-rose-400",
  "Recuperação": "bg-orange-500/10 text-orange-400",
  "Link": "bg-blue-500/10 text-blue-400",
};

function Highlight({ text, term }: { text: string; term: string }) {
  if (!term) return <>{text}</>;
  const i = text.toLowerCase().indexOf(term.toLowerCase());
  if (i < 0) return <>{text}</>;
  const start = Math.max(0, i - 90);
  const slice = text.slice(start, i + term.length + 160);
  const j = slice.toLowerCase().indexOf(term.toLowerCase());
  return (
    <>
      {start > 0 && "…"}
      {slice.slice(0, j)}
      <mark className="bg-primary/25 text-foreground rounded px-0.5">{slice.slice(j, j + term.length)}</mark>
      {slice.slice(j + term.length)}
      {text.length > start + slice.length && "…"}
    </>
  );
}

export function GlobalCopySearch({ onOpenUser }: { onOpenUser: (userId: string) => void }) {
  const [term, setTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [kindFilter, setKindFilter] = useState<string>("all");
  const [data, setData] = useState<Hit[]>([]);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const [botsRes, profilesRes, plansRes, downRes, upRes, mailRes, chanRes, abRes, remRes, trackedRes, customRes] = await Promise.all([
        supabase.from("bots").select("id, user_id, name, username, initial_message, welcome_card_text, auto_approve_welcome_message, cross_bot_upsell_message, initial_buttons, support_contact, vip_link, created_at"),
        supabase.from("profiles").select("id, email, full_name"),
        supabase.from("subscription_plans").select("*"),
        supabase.from("downsell_messages").select("*"),
        supabase.from("upsell_offers").select("*"),
        supabase.from("mailing_messages").select("*"),
        supabase.from("channel_messages").select("*"),
        supabase.from("ab_tests").select("*"),
        supabase.from("remarketing_messages").select("*"),
        supabase.from("tracked_links").select("id, bot_id, short_url, destination_url, custom_redirect_url, created_at"),
        supabase.from("custom_links").select("id, user_id, name, slug, domain, redirect_page_title, redirect_page_text, notes, created_at"),
      ]);

      const bots = botsRes.data || [];
      const owners: Record<string, string> = {};
      (profilesRes.data || []).forEach((p: any) => { owners[p.id] = p.full_name || p.email || p.id; });
      const botMap: Record<string, any> = {};
      bots.forEach(b => { botMap[b.id] = b; });

      const hits: Hit[] = [];
      const push = (kind: string, field: string, text: any, botId?: string | null, created_at?: string | null, extra?: string, ownerIdDirect?: string) => {
        const value = typeof text === "string" ? text : text ? JSON.stringify(text) : "";
        if (!value.trim()) return;
        const bot = botId ? botMap[botId] : null;
        const ownerId = ownerIdDirect || bot?.user_id || null;
        hits.push({
          kind, field, text: value, botId, botUsername: bot ? `@${bot.username}` : undefined,
          ownerId, ownerLabel: ownerId ? owners[ownerId] : undefined, created_at, extra,
        });
      };

      bots.forEach(b => {
        push("Bot", "Nome do bot", b.name, b.id, b.created_at);
        push("Bot", "Username", `@${b.username}`, b.id, b.created_at);
        push("Bot", "Mensagem inicial", b.initial_message, b.id, b.created_at);
        push("Bot", "Card de boas-vindas", b.welcome_card_text, b.id, b.created_at);
        push("Bot", "Aprovação automática", b.auto_approve_welcome_message, b.id, b.created_at);
        push("Bot", "Cross-bot upsell", b.cross_bot_upsell_message, b.id, b.created_at);
        push("Bot", "Suporte / link VIP", [b.support_contact, b.vip_link].filter(Boolean).join(" · "), b.id, b.created_at);
        (Array.isArray(b.initial_buttons) ? b.initial_buttons : []).forEach((btn: any) => {
          push("Botão", "Botão inicial", `${btn?.text || btn?.label || ""}${btn?.url ? ` → ${btn.url}` : ""}`, b.id, b.created_at);
        });
      });

      (plansRes.data || []).forEach((p: any) => {
        push("Plano", "Nome do plano", p.name, p.bot_id, p.created_at, `R$ ${Number(p.price).toFixed(2)}`);
        push("Order bump", "Título/nome", [p.order_bump_name, p.order_bump_title].filter(Boolean).join(" · "), p.bot_id, p.created_at);
        push("Order bump", "Descrição", p.order_bump_description, p.bot_id, p.created_at);
        push("Order bump", "Botões", [p.order_bump_yes_button_text, p.order_bump_no_button_text, p.order_bump_button_price_custom].filter(Boolean).join(" | "), p.bot_id, p.created_at);
      });
      (downRes.data || []).forEach((m: any) => push("Downsell", `${m.send_time_minutes} min · ${m.discount_percentage}%`, m.message, m.bot_id, m.created_at));
      (upRes.data || []).forEach((u: any) => {
        push("Upsell", u.name, u.message, u.bot_id, u.created_at, `R$ ${Number(u.price).toFixed(2)}`);
        push("Upsell", `${u.name} · descrição`, u.description, u.bot_id, u.created_at);
      });
      (mailRes.data || []).forEach((m: any) => push("Remarketing", `${m.target_audience} · ${m.schedule_type}`, m.message, m.bot_id, m.created_at));
      (chanRes.data || []).forEach((c: any) => push("Postador", c.channel_name || c.channel_id, c.message, c.bot_id, c.created_at));
      (abRes.data || []).forEach((t: any) => {
        push("Teste A/B", `${t.name} · variante A`, t.variant_a_message, t.bot_id, t.created_at);
        push("Teste A/B", `${t.name} · variante B`, t.variant_b_message, t.bot_id, t.created_at);
      });
      (remRes.data || []).forEach((m: any) => push("Recuperação", `${m.send_time_minutes} min`, m.message, m.bot_id, m.created_at));
      (trackedRes.data || []).forEach((l: any) => push("Link", "Link trackeado", [l.short_url, l.custom_redirect_url || l.destination_url].filter(Boolean).join(" → "), l.bot_id, l.created_at));
      (customRes.data || []).forEach((l: any) => {
        push("Link", `Link personalizado · ${l.slug}`, [l.name, l.domain, l.redirect_page_title, l.redirect_page_text, l.notes].filter(Boolean).join(" · "), null, l.created_at, undefined, l.user_id);
      });

      setData(hits);
    } finally { setLoading(false); }
  }

  const kinds = useMemo(() => Array.from(new Set(data.map(h => h.kind))).sort(), [data]);

  const results = useMemo(() => {
    const q = term.trim().toLowerCase();
    if (!q) return [];
    return data
      .filter(h => (kindFilter === "all" || h.kind === kindFilter))
      .filter(h => h.text.toLowerCase().includes(q) || (h.botUsername || "").toLowerCase().includes(q) || (h.ownerLabel || "").toLowerCase().includes(q))
      .slice(0, 400);
  }, [data, term, kindFilter]);

  function exportCsv() {
    const rows = results.map(r => [r.kind, r.field, r.botUsername || "", r.ownerLabel || "", r.text.replace(/\s+/g, " "), r.created_at ? formatBrtShort(r.created_at) : ""]);
    const csv = [["Tipo", "Campo", "Bot", "Vendedor", "Texto", "Criado"].join(","), ...rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(","))].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a"); a.href = url; a.download = `busca-copys.csv`; a.click(); URL.revokeObjectURL(url);
  }

  return (
    <Panel
      icon={Search}
      title="Busca global de copys"
      subtitle={loading ? "Indexando conteúdo…" : `${data.length.toLocaleString("pt-BR")} textos indexados`}
      action={
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="border-border h-9" onClick={load} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Reindexar
          </Button>
          <Button variant="outline" size="sm" className="border-border h-9" onClick={exportCsv} disabled={!results.length}>
            <Download className="w-4 h-4 mr-1" /> CSV
          </Button>
        </div>
      }
    >
      <div className="flex flex-col md:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <Input value={term} onChange={e => setTerm(e.target.value)} placeholder="Digite uma frase, palavra, @bot ou nome do vendedor" className="pl-9" />
        </div>
        <select value={kindFilter} onChange={e => setKindFilter(e.target.value)} className="h-10 rounded-md bg-secondary/30 border border-border px-3 text-sm w-full md:w-52">
          <option value="all">Todos os tipos</option>
          {kinds.map(k => <option key={k} value={k}>{k}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : !term.trim() ? (
        <p className="text-xs text-muted-foreground">Busque qualquer frase usada nos bots: mensagens de /start, botões, planos, order bump, downsell, upsell, remarketing, postadores, testes A/B e links.</p>
      ) : results.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhuma copy encontrada para “{term}”.</p>
      ) : (
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{results.length} resultado(s){results.length === 400 ? " (limitado)" : ""}</p>
          {results.map((r, i) => (
            <div key={i} className="rounded-lg border border-border/40 bg-secondary/15 p-3 hover:border-primary/30 transition-colors">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${KIND_COLORS[r.kind] || "bg-secondary text-muted-foreground"}`}>{r.kind}</span>
                <span className="text-[10px] text-muted-foreground">{r.field}</span>
                {r.botUsername && <span className="text-[10px] font-mono text-primary">{r.botUsername}</span>}
                {r.extra && <span className="text-[10px] text-emerald-400 font-mono">{r.extra}</span>}
                {r.created_at && <span className="text-[10px] text-muted-foreground">{formatBrtShort(r.created_at)}</span>}
                <span className="flex-1" />
                {r.ownerId && (
                  <Button variant="ghost" size="sm" className="h-7 text-[11px]" onClick={() => onOpenUser(r.ownerId!)}>
                    <Eye className="w-3 h-3 mr-1" /> {r.ownerLabel}
                  </Button>
                )}
              </div>
              <p className="text-xs whitespace-pre-wrap break-words leading-relaxed"><Highlight text={r.text} term={term.trim()} /></p>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
