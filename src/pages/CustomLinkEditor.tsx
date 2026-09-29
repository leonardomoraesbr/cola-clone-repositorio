import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBots } from "@/contexts/BotContext";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/components/ui/stat-kit";
import { useCustomDomains } from "@/hooks/useCustomDomains";
import { cn } from "@/lib/utils";
import {
  Link2, Plus, Loader2, X, Shuffle, Pencil, ShieldCheck, Shield, ShieldAlert,
  Sparkles, Check, ArrowLeft, Globe, Lock,
} from "lucide-react";

export const DEFAULT_DOMAIN = "riotvips.com";

interface Destination { url: string; label: string; weight: number }

const CLOAKERS = [
  { id: "off", title: "Desligado", desc: "Tráfego direto para o fluxo, sem nenhum filtro.", icon: Shield, tone: "text-muted-foreground" },
  { id: "basic", title: "Escudo Padrão", desc: "Bloqueia crawlers, bots e user-agents suspeitos.", icon: ShieldCheck, tone: "text-primary" },
  { id: "hard", title: "Escudo Máximo", desc: "Filtro agressivo para campanhas pagas sensíveis.", icon: ShieldAlert, tone: "text-amber-400" },
];

const randomSlug = () => Math.random().toString(36).slice(2, 8);
const normalizeSlug = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");

export default function CustomLinkEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { bots } = useBots();
  const { domains, loading: domainsLoading } = useCustomDomains();

  const [loading, setLoading] = useState(!!id);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [slugType, setSlugType] = useState<"random" | "custom">("random");
  const [slug, setSlug] = useState(randomSlug());
  const [domain, setDomain] = useState(DEFAULT_DOMAIN);
  const [cloaker, setCloaker] = useState("off");
  const [redirectPage, setRedirectPage] = useState(false);
  const [pageTitle, setPageTitle] = useState("");
  const [pageText, setPageText] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [extraUrl, setExtraUrl] = useState("");
  const [extras, setExtras] = useState<Destination[]>([]);

  useEffect(() => {
    if (!id || !user) return;
    (async () => {
      const { data } = await supabase.from("custom_links").select("*").eq("id", id).maybeSingle();
      if (data) {
        const dests = ((data.destinations as any) || []) as Destination[];
        setName(data.name);
        setSlugType(data.slug_type === "custom" ? "custom" : "random");
        setSlug(data.slug);
        setDomain(data.domain || DEFAULT_DOMAIN);
        setCloaker(data.cloaker_mode);
        setRedirectPage(data.redirect_page);
        setPageTitle(data.redirect_page_title || "");
        setPageText(data.redirect_page_text || "");
        setSelected(bots.filter((b: any) => dests.some((d) => d.url.includes(b.username))).map((b: any) => b.id));
        setExtras(dests.filter((d) => !d.url.includes("t.me/")));
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user?.id, bots.length]);

  const destinations: Destination[] = useMemo(() => [
    ...bots.filter((b: any) => selected.includes(b.id)).map((b: any) => ({
      url: `https://t.me/${b.username}`, label: `@${b.username}`, weight: 1,
    })),
    ...extras,
  ], [bots, selected, extras]);

  async function save() {
    if (!name.trim()) return toast({ title: "Dê um nome ao link", variant: "destructive" });
    if (destinations.length === 0) return toast({ title: "Escolha ao menos um destino", variant: "destructive" });
    const finalSlug = slugType === "custom" ? normalizeSlug(slug) : slug || randomSlug();
    if (!finalSlug) return toast({ title: "Slug inválido", variant: "destructive" });
    const chosen = domains.find((d) => d.domain === domain);
    if (chosen && !chosen.is_verified) {
      return toast({ title: "Domínio não verificado", description: "Valide o DNS na aba Domínios antes de usar.", variant: "destructive" });
    }

    setSaving(true);
    const payload = {
      user_id: user?.id,
      name: name.trim(),
      slug: finalSlug,
      slug_type: slugType,
      domain,
      destinations: destinations as any,
      cloaker_mode: cloaker,
      redirect_page: redirectPage,
      redirect_page_title: redirectPage ? pageTitle || null : null,
      redirect_page_text: redirectPage ? pageText || null : null,
    };
    const { error } = id
      ? await supabase.from("custom_links").update(payload).eq("id", id)
      : await supabase.from("custom_links").insert(payload);
    setSaving(false);
    if (error) {
      return toast({
        title: "Erro ao salvar",
        description: error.message.includes("duplicate") ? "Esse slug já está em uso." : error.message,
        variant: "destructive",
      });
    }
    toast({ title: id ? "Link atualizado!" : "Link criado!" });
    navigate("/links-personalizados");
  }

  if (loading) {
    return (
      <MainLayout>
        <div className="flex justify-center py-32"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <Button variant="ghost" size="sm" onClick={() => navigate("/links-personalizados")} className="mb-3 -ml-2 text-muted-foreground">
        <ArrowLeft className="w-4 h-4 mr-2" /> Voltar para os links
      </Button>

      <PageHeader
        icon={Link2}
        title={id ? "Editar link personalizado" : "Novo link personalizado"}
        subtitle="Distribuição inteligente entre seus bots, proteção contra espiões e métrica de cliques"
      />

      <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-6">
        <div className="space-y-5">
          <div className="glass-card p-5">
            <label className="text-xs font-medium mb-2 block">Nome do link *</label>
            <Input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="Ex: Campanha Black Friday" />
            <p className="text-[11px] text-muted-foreground mt-1">Nome interno para você identificar ({name.length}/40)</p>
          </div>

          <div className="glass-card p-5 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Endereço curto</p>
            <div className="grid sm:grid-cols-2 gap-3">
              {([["random", "Automático", "A Riot gera o código (ex: k3f9za)"], ["custom", "Personalizado", "Você escolhe (ex: black-friday)"]] as const).map(([key, title, desc]) => (
                <button
                  key={key}
                  onClick={() => { setSlugType(key as any); if (key === "random") setSlug(randomSlug()); }}
                  className={cn("text-left p-3 rounded-lg border transition-colors",
                    slugType === key ? "border-primary/50 bg-primary/10" : "border-border hover:bg-secondary/40")}
                >
                  <p className="text-sm font-medium flex items-center gap-2">
                    {key === "random" ? <Shuffle className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />} {title}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{desc}</p>
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-muted-foreground shrink-0">{domain}/l/</span>
              <Input value={slug} disabled={slugType === "random"} onChange={(e) => setSlug(e.target.value)} className="font-mono" placeholder="meu-link" />
              {slugType === "random" && (
                <Button variant="outline" size="sm" onClick={() => setSlug(randomSlug())}><Shuffle className="w-3.5 h-3.5" /></Button>
              )}
            </div>
          </div>

          <div className="glass-card p-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Domínio do link</p>
            <div className="space-y-2">
              <button
                onClick={() => setDomain(DEFAULT_DOMAIN)}
                className={cn("w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-colors",
                  domain === DEFAULT_DOMAIN ? "border-primary/50 bg-primary/10" : "border-border hover:bg-secondary/40")}
              >
                <Globe className="w-4 h-4 text-primary" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-mono">{DEFAULT_DOMAIN}</p>
                  <p className="text-[11px] text-muted-foreground">Domínio padrão da Riot Vips</p>
                </div>
                <span className="text-[11px] text-emerald-400 flex items-center gap-1"><Check className="w-3 h-3" /> pronto</span>
              </button>

              {domainsLoading && <p className="text-xs text-muted-foreground">Carregando domínios...</p>}
              {domains.map((d) => {
                const locked = !d.is_verified;
                return (
                  <button
                    key={d.id}
                    disabled={locked}
                    onClick={() => setDomain(d.domain)}
                    className={cn("w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-colors",
                      locked ? "border-border/50 opacity-60 cursor-not-allowed" :
                      domain === d.domain ? "border-primary/50 bg-primary/10" : "border-border hover:bg-secondary/40")}
                  >
                    {locked ? <Lock className="w-4 h-4 text-amber-400" /> : <Globe className="w-4 h-4 text-primary" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-mono truncate">{d.domain}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {locked ? "Bloqueado — verifique o DNS na aba Domínios" : "Domínio próprio verificado"}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="glass-card p-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Destinos (balanceamento)</p>
            <div className="space-y-2">
              {bots.length === 0 && <p className="text-xs text-muted-foreground">Nenhum bot conectado ainda.</p>}
              {bots.map((b: any) => {
                const on = selected.includes(b.id);
                return (
                  <button
                    key={b.id}
                    onClick={() => setSelected((p) => (on ? p.filter((i) => i !== b.id) : [...p, b.id]))}
                    className={cn("w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-colors",
                      on ? "border-primary/50 bg-primary/10" : "border-border hover:bg-secondary/40")}
                  >
                    <div className={cn("w-5 h-5 rounded-md border flex items-center justify-center", on ? "bg-primary border-primary" : "border-border")}>
                      {on && <Check className="w-3 h-3 text-primary-foreground" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm truncate">{b.name || b.username}</p>
                      <p className="font-mono text-[11px] text-muted-foreground truncate">t.me/{b.username}</p>
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2 mt-3">
              <Input value={extraUrl} onChange={(e) => setExtraUrl(e.target.value)} placeholder="https://t.me/+convite ou outra URL" />
              <Button
                variant="outline"
                onClick={() => {
                  if (!/^https?:\/\//.test(extraUrl.trim())) return toast({ title: "URL inválida", variant: "destructive" });
                  setExtras((p) => [...p, { url: extraUrl.trim(), label: extraUrl.trim(), weight: 1 }]);
                  setExtraUrl("");
                }}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            {extras.map((d, i) => (
              <div key={i} className="flex items-center gap-2 mt-2 text-xs font-mono text-muted-foreground">
                <span className="truncate flex-1">{d.url}</span>
                <button onClick={() => setExtras((p) => p.filter((_, idx) => idx !== i))}><X className="w-3.5 h-3.5" /></button>
              </div>
            ))}
          </div>

          <div className="glass-card p-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Proteção contra espiões</p>
            <div className="grid sm:grid-cols-3 gap-3">
              {CLOAKERS.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCloaker(c.id)}
                  className={cn("text-left p-3 rounded-lg border transition-colors",
                    cloaker === c.id ? "border-primary/50 bg-primary/10" : "border-border hover:bg-secondary/40")}
                >
                  <p className="text-sm font-medium flex items-center gap-2"><c.icon className={cn("w-3.5 h-3.5", c.tone)} /> {c.title}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">{c.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="glass-card p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" /> Página de aquecimento</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Mostra uma tela rápida antes de mandar o lead pro Telegram.</p>
              </div>
              <Switch checked={redirectPage} onCheckedChange={setRedirectPage} />
            </div>
            {redirectPage && (
              <div className="mt-3 space-y-2">
                <Input value={pageTitle} onChange={(e) => setPageTitle(e.target.value)} placeholder="Título (ex: Preparando seu acesso...)" />
                <Textarea value={pageText} onChange={(e) => setPageText(e.target.value)} placeholder="Texto de apoio exibido durante o redirecionamento" rows={2} />
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="glass-card p-5 border-primary/25 bg-primary/5">
            <p className="text-sm font-semibold flex items-center gap-2"><Link2 className="w-4 h-4 text-primary" /> Como funciona</p>
            <p className="text-xs text-muted-foreground mt-2">
              Um único link curto que rotaciona automaticamente entre os bots escolhidos, filtra tráfego suspeito e registra cada clique com origem.
            </p>
          </div>
          <div className="glass-card p-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Prévia</p>
            <p className="font-mono text-xs text-primary break-all">
              https://{domain}/l/{slugType === "custom" ? normalizeSlug(slug) || "seu-slug" : slug}
            </p>
            <p className="text-[11px] text-muted-foreground mt-2">{destinations.length} destino(s) vinculado(s)</p>
          </div>
          <Button onClick={save} disabled={saving} className="w-full bg-gradient-to-r from-primary to-teal-500 text-primary-foreground">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
            {id ? "Salvar alterações" : "Criar link"}
          </Button>
        </div>
      </div>
    </MainLayout>
  );
}
