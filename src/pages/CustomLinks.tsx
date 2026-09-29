import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { PageHeader, StatCard } from "@/components/ui/stat-kit";
import { DomainsTab } from "@/components/tracking/DomainsTab";
import { LinkMetrics } from "@/components/links/LinkMetrics";
import { cn } from "@/lib/utils";
import {
  Link2, Plus, Globe, Eye, Workflow, Loader2, Trash2, Copy, Pencil,
  ShieldCheck, Power, ExternalLink, BarChart3,
} from "lucide-react";

const MAX_LINKS = 20;

interface Destination { url: string; label: string; weight: number }

interface CustomLink {
  id: string;
  name: string;
  slug: string;
  slug_type: string;
  domain: string;
  destinations: Destination[];
  cloaker_mode: string;
  redirect_page: boolean;
  is_active: boolean;
  clicks: number;
  last_click_at: string | null;
  created_at: string;
}

export default function CustomLinks() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"links" | "metrics" | "domains">("links");
  const [links, setLinks] = useState<CustomLink[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("custom_links")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) console.error(error);
    setLinks(((data as any[]) || []).map((l) => ({ ...l, destinations: (l.destinations as Destination[]) || [] })));
    setLoading(false);
  }

  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [user?.id]);

  const stats = useMemo(() => ({
    total: links.length,
    clicks: links.reduce((s, l) => s + (l.clicks || 0), 0),
    flows: links.reduce((s, l) => s + (l.destinations?.length || 0), 0),
  }), [links]);

  const linkMeta = useMemo(
    () => Object.fromEntries(links.map((l) => [l.id, { name: l.name, domain: l.domain || "riotvips.com" }])),
    [links],
  );

  async function toggleActive(link: CustomLink) {
    const { error } = await supabase.from("custom_links").update({ is_active: !link.is_active }).eq("id", link.id);
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    setLinks((prev) => prev.map((l) => (l.id === link.id ? { ...l, is_active: !l.is_active } : l)));
  }

  async function remove(link: CustomLink) {
    const { error } = await supabase.from("custom_links").delete().eq("id", link.id);
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    setLinks((prev) => prev.filter((l) => l.id !== link.id));
    toast({ title: "Link removido" });
  }

  const publicUrl = (l: CustomLink) => `${window.location.origin}/l/${l.slug}`;

  return (
    <MainLayout>
      <PageHeader
        icon={Link2}
        title="Links Personalizados"
        subtitle="Crie links curtos inteligentes com balanceamento entre bots e rastreio de cliques"
        action={
          <Button
            onClick={() => navigate("/links-personalizados/novo")}
            disabled={links.length >= MAX_LINKS}
            className="bg-gradient-to-r from-primary to-teal-500 text-primary-foreground"
          >
            <Plus className="w-4 h-4 mr-2" /> Novo Link ({links.length}/{MAX_LINKS})
          </Button>
        }
      />

      <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-secondary/40 border border-border/50 mb-6">
        {([["links", "Links", Link2], ["metrics", "Métricas", BarChart3], ["domains", "Domínios", Globe]] as const).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setTab(key as any)}
            className={cn(
              "flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm transition-colors",
              tab === key ? "bg-primary/15 text-primary border border-primary/30" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="w-3.5 h-3.5" /> {label}
          </button>
        ))}
      </div>

      {tab === "domains" ? (
        <DomainsTab />
      ) : tab === "metrics" ? (
        <LinkMetrics linkIds={links.map((l) => l.id)} linkMeta={linkMeta} />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <StatCard icon={Link2} label="Total de links" value={String(stats.total)} subValue={`Limite ${MAX_LINKS}`} color="bg-primary/15 text-primary" progress={(stats.total / MAX_LINKS) * 100} />
            <StatCard icon={Eye} label="Cliques totais" value={String(stats.clicks)} subValue="Todos os links" color="bg-sky-500/15 text-sky-400" bar="bg-sky-400" />
            <StatCard icon={Workflow} label="Destinos vinculados" value={String(stats.flows)} subValue="Bots e URLs" color="bg-violet-500/15 text-violet-400" bar="bg-violet-400" />
          </div>

          <div className="glass-card overflow-hidden">
            {loading ? (
              <div className="flex justify-center py-24"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : links.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center px-6">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/25 flex items-center justify-center mb-4">
                  <Link2 className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-semibold text-lg">Nenhum link criado ainda</h3>
                <p className="text-sm text-muted-foreground max-w-md mt-1">
                  Monte seu primeiro link curto para distribuir tráfego entre bots, proteger campanhas e medir cada clique.
                </p>
                <Button onClick={() => navigate("/links-personalizados/novo")} className="mt-5 bg-gradient-to-r from-primary to-teal-500 text-primary-foreground">
                  <Plus className="w-4 h-4 mr-2" /> Criar primeiro link
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-border/40">
                {links.map((l) => (
                  <div key={l.id} className="flex flex-wrap items-center gap-4 px-5 py-4 hover:bg-secondary/25 transition-colors">
                    <div className={cn("w-1 h-10 rounded-full shrink-0", l.is_active ? "bg-primary" : "bg-muted-foreground/30")} />
                    <div className="flex-1 min-w-[220px]">
                      <p className="font-medium text-sm truncate">{l.name}</p>
                      <p className="font-mono text-xs text-primary/90 truncate">{l.domain}/l/{l.slug}</p>
                    </div>
                    <div className="hidden md:flex flex-col text-right">
                      <span className="font-mono text-sm font-bold">{l.clicks}</span>
                      <span className="text-[10px] text-muted-foreground uppercase tracking-widest">cliques</span>
                    </div>
                    <span className="hidden lg:inline-flex px-2 py-0.5 rounded-full text-[11px] border border-border text-muted-foreground">
                      {l.destinations.length} destino(s)
                    </span>
                    {l.cloaker_mode !== "off" && (
                      <span className="hidden lg:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] border border-primary/30 bg-primary/10 text-primary">
                        <ShieldCheck className="w-3 h-3" /> protegido
                      </span>
                    )}
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="ghost" title="Copiar link" onClick={() => { navigator.clipboard.writeText(publicUrl(l)); toast({ title: "Link copiado!" }); }}>
                        <Copy className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="ghost" title="Abrir" onClick={() => window.open(publicUrl(l), "_blank")}>
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="ghost" title={l.is_active ? "Pausar" : "Ativar"} onClick={() => toggleActive(l)}>
                        <Power className={cn("w-4 h-4", l.is_active ? "text-primary" : "text-muted-foreground")} />
                      </Button>
                      <Button size="sm" variant="ghost" title="Editar" onClick={() => navigate(`/links-personalizados/${l.id}`)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="ghost" title="Excluir" onClick={() => remove(l)} className="hover:text-destructive">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </MainLayout>
  );
}
