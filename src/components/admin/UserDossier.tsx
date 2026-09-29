import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatBrtShort } from "@/lib/brtDate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Panel, StatCard, PageHeader } from "@/components/ui/stat-kit";
import {
  ArrowLeft, Bot, Loader2, DollarSign, ShoppingCart, Users, Key, Image as ImageIcon,
  MessageSquare, Layers, Megaphone, Link2, Repeat, ChevronDown, ChevronRight, Search, Crown,
} from "lucide-react";

const brl = (n: number) => `R$ ${Number(n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function Field({ label, value, mono }: { label: string; value: any; mono?: boolean }) {
  const empty = value === null || value === undefined || value === "" ;
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className={`text-xs break-words ${mono ? "font-mono" : ""} ${empty ? "text-muted-foreground/60" : ""}`}>
        {empty ? "—" : typeof value === "boolean" ? (value ? "Sim" : "Não") : String(value)}
      </p>
    </div>
  );
}

function CopyBlock({ label, text, icon: Icon = MessageSquare }: any) {
  if (!text) return null;
  return (
    <div className="rounded-lg border border-border/40 bg-secondary/20 p-3">
      <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground flex items-center gap-1.5 mb-1.5">
        <Icon className="w-3 h-3" /> {label}
      </p>
      <p className="text-xs whitespace-pre-wrap break-words leading-relaxed">{String(text)}</p>
    </div>
  );
}

function Media({ url, type, label }: any) {
  if (!url) return null;
  return (
    <div className="rounded-lg border border-border/40 bg-secondary/20 p-3 space-y-2">
      <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground flex items-center gap-1.5">
        <ImageIcon className="w-3 h-3" /> {label} · {type || "mídia"}
      </p>
      {(type || "").includes("photo") || /\.(png|jpe?g|webp|gif)$/i.test(url) ? (
        <img src={url} alt={label} loading="lazy" className="max-h-40 rounded-md border border-border/40" />
      ) : null}
      <a href={url} target="_blank" rel="noreferrer" className="text-[11px] text-primary hover:underline break-all">{url}</a>
    </div>
  );
}

function Table({ head, rows }: { head: string[]; rows: any[][] }) {
  if (!rows.length) return <p className="text-xs text-muted-foreground">Nenhum registro.</p>;
  return (
    <div className="overflow-x-auto -mx-1 px-1">
      <table className="w-full text-xs min-w-[520px]">
        <thead>
          <tr className="border-b border-border/50">
            {head.map(h => <th key={h} className="text-left py-2 px-2 text-muted-foreground font-medium whitespace-nowrap">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-border/20 hover:bg-secondary/30">
              {r.map((c, j) => <td key={j} className="py-2 px-2 align-top">{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface Props { userId: string; onBack: () => void }

export function UserDossier({ userId, onBack }: Props) {
  const [loading, setLoading] = useState(true);
  const [d, setD] = useState<any>(null);
  const [openBot, setOpenBot] = useState<string | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [userId]);

  async function load() {
    setLoading(true);
    try {
      const [profileRes, botsRes, linksRes, hooksRes, demoRes, groupsRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
        supabase.from("bots").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
        supabase.from("custom_links").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
        supabase.from("notification_webhooks").select("*").eq("user_id", userId),
        supabase.from("demo_settings").select("*").eq("user_id", userId).maybeSingle(),
        supabase.from("contingency_groups").select("*").eq("user_id", userId),
      ]);
      const bots = botsRes.data || [];
      const ids = bots.map(b => b.id);
      const byBot = async (table: any, sel = "*", limit = 500) =>
        ids.length ? ((await supabase.from(table).select(sel).in("bot_id", ids).limit(limit)).data || []) : [];

      const [plans, orders, vips, downsells, upsells, mailings, channels, abtests, tracked, priceRules, blacklist, botUsers, remarketing] =
        await Promise.all([
          byBot("subscription_plans"),
          ids.length ? (await supabase.from("payment_orders").select("*").in("bot_id", ids).order("created_at", { ascending: false }).limit(200)).data || [] : [],
          byBot("vip_members", "*", 500),
          byBot("downsell_messages"),
          byBot("upsell_offers"),
          byBot("mailing_messages"),
          byBot("channel_messages"),
          byBot("ab_tests"),
          byBot("tracked_links"),
          byBot("price_rules"),
          byBot("blacklisted_users"),
          byBot("bot_users", "bot_id, telegram_user_id, has_clicked_button, created_at, last_interaction_at", 5000),
          byBot("remarketing_messages"),
        ]);

      const paid = orders.filter((o: any) => o.status === "paid");
      setD({
        profile: profileRes.data, bots, links: linksRes.data || [], hooks: hooksRes.data || [],
        demo: demoRes.data, groups: groupsRes.data || [],
        plans, orders, vips, downsells, upsells, mailings, channels, abtests, tracked, priceRules, blacklist, botUsers, remarketing,
        revenue: paid.reduce((s: number, o: any) => s + Number(o.amount || 0), 0),
        sales: paid.length,
      });
      setOpenBot(bots[0]?.id ?? null);
    } finally { setLoading(false); }
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!d) return <p className="text-muted-foreground">Usuário não encontrado.</p>;

  const p = d.profile || {};
  const term = q.trim().toLowerCase();
  const matches = (bot: any) => !term || [bot.name, bot.username, bot.initial_message, bot.welcome_card_text, bot.auto_approve_welcome_message, bot.cross_bot_upsell_message, JSON.stringify(bot.initial_buttons || "")]
    .some(v => String(v || "").toLowerCase().includes(term));
  const forBot = (arr: any[], id: string) => arr.filter((x: any) => x.bot_id === id);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Users}
        title={p.full_name || p.email || "Usuário"}
        subtitle={`${p.email || "sem e-mail"} · cadastro ${formatBrtShort(p.created_at)}`}
        action={<Button variant="outline" size="sm" onClick={onBack} className="border-border h-9"><ArrowLeft className="w-4 h-4 mr-1" /> Voltar</Button>}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={DollarSign} label="Faturamento aprovado" value={brl(d.revenue)} subValue={`${d.sales} vendas pagas`} color="bg-emerald-500/10 text-emerald-400" bar="bg-emerald-400" />
        <StatCard icon={Bot} label="Bots criados" value={d.bots.length} subValue={`${d.bots.filter((b: any) => b.health_status === "ok").length} saudáveis`} color="bg-primary/10 text-primary" />
        <StatCard icon={Users} label="Leads (/start)" value={d.botUsers.length} subValue={`${d.botUsers.filter((u: any) => u.has_clicked_button).length} clicaram`} color="bg-sky-500/10 text-sky-400" bar="bg-sky-400" />
        <StatCard icon={Crown} label="VIPs ativos" value={d.vips.filter((v: any) => v.is_active).length} subValue={`${d.vips.length} no total`} color="bg-amber-500/10 text-amber-400" bar="bg-amber-400" />
      </div>

      <Panel icon={Key} title="Perfil e credenciais" subtitle="Dados da conta">
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          <Field label="ID" value={p.id} mono />
          <Field label="E-mail" value={p.email} />
          <Field label="Nome" value={p.full_name} />
          <Field label="Telefone" value={p.phone} />
          <Field label="Cadastro" value={formatBrtShort(p.created_at)} />
          <Field label="Atualizado" value={formatBrtShort(p.updated_at)} />
          <Field label="Chave RevantPay" value={p.revantpay_api_key ? `••••${String(p.revantpay_api_key).slice(-4)}` : "sem chave"} mono />
          <Field label="Status da chave" value={p.revantpay_key_status} />
          <Field label="Chave verificada em" value={p.revantpay_key_checked_at ? formatBrtShort(p.revantpay_key_checked_at) : null} />
          <Field label="Erro da chave" value={p.revantpay_key_error} />
          <Field label="Chave Linkter" value={p.linkter_api_key ? "configurada" : null} />
          <Field label="Widget iOS" value={p.widget_token ? "ativo" : null} />
          <Field label="Conta demo" value={d.demo ? (d.demo.is_active ? "ativa" : "configurada/inativa") : null} />
          <Field label="Grupos de contingência" value={d.groups.length} />
          <Field label="Webhooks/alertas" value={d.hooks.length} />
          <Field label="Links personalizados" value={d.links.length} />
        </div>
      </Panel>

      <Panel
        icon={Bot}
        title={`Bots e conteúdo (${d.bots.length})`}
        subtitle="Inclui bots antigos e todas as copys configuradas"
        action={
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Filtrar por texto do bot" className="pl-9 h-9" />
          </div>
        }
      >
        <div className="space-y-3">
          {d.bots.filter(matches).map((bot: any) => {
            const open = openBot === bot.id;
            const bPlans = forBot(d.plans, bot.id);
            return (
              <div key={bot.id} className="rounded-xl border border-border/40 bg-secondary/10">
                <button onClick={() => setOpenBot(open ? null : bot.id)} className="w-full flex items-center justify-between gap-3 p-4 text-left">
                  <div className="flex items-center gap-3 min-w-0">
                    {open ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />}
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">@{bot.username} <span className="text-muted-foreground font-normal">· {bot.name}</span></p>
                      <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                        criado {formatBrtShort(bot.created_at)} · {bPlans.length} planos · {forBot(d.orders, bot.id).length} pedidos
                      </p>
                    </div>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full shrink-0 ${bot.health_status === "ok" ? "bg-emerald-500/15 text-emerald-400" : "bg-amber-500/15 text-amber-400"}`}>
                    {bot.health_status || "sem check"}
                  </span>
                </button>

                {open && (
                  <div className="px-4 pb-4 space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                      <Field label="ID do bot" value={bot.id} mono />
                      <Field label="Token" value={bot.token ? `••••${String(bot.token).slice(-6)}` : null} mono />
                      <Field label="VIP ID" value={bot.vip_id} mono />
                      <Field label="Registro ID" value={bot.registro_id} mono />
                      <Field label="Link VIP" value={bot.vip_link} />
                      <Field label="Suporte" value={bot.support_contact} />
                      <Field label="Anti-clone" value={!!bot.anti_clone} />
                      <Field label="Canal de notificação" value={bot.notification_channel_id} mono />
                      <Field label="Aprovação automática" value={!!bot.auto_approve_enabled} />
                      <Field label="Canal aprovação" value={bot.auto_approve_channel_id} mono />
                      <Field label="Card de boas-vindas" value={!!bot.welcome_card_enabled} />
                      <Field label="Cross-bot upsell" value={bot.cross_bot_upsell_bot_id} mono />
                      <Field label="Último health check" value={bot.last_health_check ? formatBrtShort(bot.last_health_check) : null} />
                      <Field label="Atualizado" value={formatBrtShort(bot.updated_at)} />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                      <CopyBlock label="Mensagem inicial (/start)" text={bot.initial_message} />
                      <Media url={bot.initial_media_url} type={bot.initial_media_type} label="Mídia inicial" />
                      <CopyBlock label="Texto do card de boas-vindas" text={bot.welcome_card_text} />
                      <CopyBlock label="Mensagem de aprovação automática" text={bot.auto_approve_welcome_message} />
                      <CopyBlock label="Mensagem de cross-bot upsell" text={bot.cross_bot_upsell_message} />
                      {Array.isArray(bot.initial_buttons) && bot.initial_buttons.length > 0 && (
                        <div className="rounded-lg border border-border/40 bg-secondary/20 p-3">
                          <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground mb-2">Botões da mensagem inicial</p>
                          <div className="flex flex-wrap gap-1.5">
                            {bot.initial_buttons.map((b: any, i: number) => (
                              <span key={i} className="text-[11px] bg-primary/10 text-primary px-2 py-1 rounded-md">
                                {b.text || b.label || "botão"} {b.url ? `→ ${b.url}` : ""}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div>
                      <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-2 flex items-center gap-1.5"><Layers className="w-3 h-3" /> Planos e order bump</p>
                      <Table
                        head={["Plano", "Duração", "Preço", "Order bump", "Textos do bump", "Status"]}
                        rows={bPlans.map((pl: any) => [
                          pl.name, pl.duration, brl(pl.price),
                          pl.order_bump_enabled ? `${pl.order_bump_name || "sim"} · ${brl(pl.order_bump_price)}` : "—",
                          <span className="block max-w-[320px] whitespace-pre-wrap text-muted-foreground">
                            {[pl.order_bump_title, pl.order_bump_description, pl.order_bump_yes_button_text, pl.order_bump_no_button_text].filter(Boolean).join(" | ") || "—"}
                          </span>,
                          pl.is_active ? "Ativo" : "Inativo",
                        ])}
                      />
                    </div>

                    {forBot(d.downsells, bot.id).length > 0 && (
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-2">Downsell</p>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                          {forBot(d.downsells, bot.id).map((m: any) => (
                            <CopyBlock key={m.id} label={`${m.send_time_minutes} min · ${m.discount_percentage}% · ${m.target_audience || "todos"}${m.is_active ? "" : " (inativo)"}`} text={m.message} />
                          ))}
                        </div>
                      </div>
                    )}

                    {forBot(d.upsells, bot.id).length > 0 && (
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-2">Upsell</p>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                          {forBot(d.upsells, bot.id).map((u: any) => (
                            <CopyBlock key={u.id} label={`${u.name} · ${brl(u.price)}${u.is_active ? "" : " (inativo)"}`} text={`${u.description ? u.description + "\n\n" : ""}${u.message}`} />
                          ))}
                        </div>
                      </div>
                    )}

                    {forBot(d.mailings, bot.id).length > 0 && (
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-2 flex items-center gap-1.5"><Megaphone className="w-3 h-3" /> Remarketing</p>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                          {forBot(d.mailings, bot.id).map((m: any) => (
                            <CopyBlock key={m.id} label={`${m.target_audience} · ${m.schedule_type} · ${m.sent_count || 0} envios`} text={m.message} />
                          ))}
                        </div>
                      </div>
                    )}

                    {forBot(d.channels, bot.id).length > 0 && (
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-2">Postadores (canais/grupos)</p>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                          {forBot(d.channels, bot.id).map((c: any) => (
                            <CopyBlock key={c.id} label={`${c.channel_name || c.channel_id} · ${c.schedule_type} · ${c.sent_count || 0} envios`} text={c.message} />
                          ))}
                        </div>
                      </div>
                    )}

                    {forBot(d.remarketing, bot.id).length > 0 && (
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-2">Sequência de recuperação</p>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                          {forBot(d.remarketing, bot.id).map((m: any) => (
                            <CopyBlock key={m.id} label={`${m.send_time_minutes} min`} text={m.message} />
                          ))}
                        </div>
                      </div>
                    )}

                    {forBot(d.abtests, bot.id).length > 0 && (
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-2 flex items-center gap-1.5"><Repeat className="w-3 h-3" /> Testes A/B</p>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                          {forBot(d.abtests, bot.id).map((t: any) => (
                            <div key={t.id} className="space-y-2">
                              <CopyBlock label={`${t.name} · variante A${t.is_active ? " (ativo)" : ""}`} text={t.variant_a_message} />
                              <CopyBlock label={`${t.name} · variante B`} text={t.variant_b_message} />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {forBot(d.tracked, bot.id).length > 0 && (
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-2 flex items-center gap-1.5"><Link2 className="w-3 h-3" /> Links de trackeamento</p>
                        <Table
                          head={["Curto", "Destino", "Funil", "Cloaker", "Criado"]}
                          rows={forBot(d.tracked, bot.id).map((l: any) => [
                            <a href={l.short_url} target="_blank" rel="noreferrer" className="text-primary hover:underline break-all">{l.short_url}</a>,
                            <span className="break-all text-muted-foreground">{l.custom_redirect_url || l.destination_url}</span>,
                            l.funnel_type || "—", l.cloaker_enabled ? "sim" : "não", formatBrtShort(l.created_at),
                          ])}
                        />
                      </div>
                    )}

                    {forBot(d.priceRules, bot.id).length > 0 && (
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-2">Regras de preço</p>
                        <Table
                          head={["Tipo", "Regra", "Preço novo", "Ativa"]}
                          rows={forBot(d.priceRules, bot.id).map((r: any) => [r.target_type, r.rule_type, brl(r.new_price), r.is_active ? "sim" : "não"])}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {d.bots.length === 0 && <p className="text-xs text-muted-foreground">Este usuário ainda não criou nenhum bot.</p>}
        </div>
      </Panel>

      <Panel icon={ShoppingCart} title={`Pedidos recentes (${d.orders.length})`} subtitle="Últimos 200 pedidos de todos os bots">
        <Table
          head={["Comprador", "Bot", "Valor", "Status", "Origem", "Criado", "Pago em"]}
          rows={d.orders.slice(0, 60).map((o: any) => [
            <>{o.telegram_first_name || "Sem nome"}{o.telegram_username ? <span className="text-muted-foreground"> @{o.telegram_username}</span> : null}</>,
            <span className="font-mono text-primary">@{d.bots.find((b: any) => b.id === o.bot_id)?.username || "—"}</span>,
            <span className="font-mono">{brl(o.amount)}</span>,
            <span className={o.status === "paid" ? "text-emerald-400" : "text-amber-400"}>{o.status}</span>,
            o.source_type || "direct",
            formatBrtShort(o.created_at),
            formatBrtShort(o.paid_at),
          ])}
        />
      </Panel>

      {d.links.length > 0 && (
        <Panel icon={Link2} title={`Links personalizados (${d.links.length})`} subtitle="Domínios, cloaker e cliques">
          <Table
            head={["Nome", "Slug", "Domínio", "Cloaker", "Cliques", "Último clique"]}
            rows={d.links.map((l: any) => [l.name, l.slug, l.domain, l.cloaker_mode, l.clicks, l.last_click_at ? formatBrtShort(l.last_click_at) : "—"])}
          />
        </Panel>
      )}
    </div>
  );
}
