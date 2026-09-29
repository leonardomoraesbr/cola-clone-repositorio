import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCustomDomains, CustomDomain } from "@/hooks/useCustomDomains";
import {
  Globe, Plus, Trash2, Loader2, Check, Clock, AlertTriangle, RefreshCw, Copy, ChevronDown, ShieldCheck,
} from "lucide-react";

const TARGET_HOST = "riotvips.com";
const TARGET_IP = "185.158.133.1";

function dnsRecords(d: CustomDomain) {
  return [
    { type: "A", name: "@", value: TARGET_IP, note: "Aponta o domínio raiz para a Riot Vips" },
    { type: "CNAME", name: "www", value: TARGET_HOST, note: "Faz o www funcionar junto" },
    { type: "TXT", name: "_riot", value: d.verification_token || "aguardando token", note: "Prova que o domínio é seu" },
  ];
}

function CopyBtn({ text }: { text: string }) {
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); toast({ title: "Copiado!" }); }}
      className="text-muted-foreground hover:text-primary transition-colors shrink-0"
      title="Copiar"
    >
      <Copy className="w-3.5 h-3.5" />
    </button>
  );
}

export function DomainsTab() {
  const { domains, loading, reload } = useCustomDomains();
  const [newDomain, setNewDomain] = useState("");
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [local, setLocal] = useState<Record<string, Partial<CustomDomain>>>({});

  const list = domains.map((d) => ({ ...d, ...(local[d.id] || {}) }));
  const verifiedCount = list.filter((d) => d.is_verified).length;

  async function addDomain() {
    const clean = newDomain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    if (!clean || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(clean)) {
      return toast({ title: "Domínio inválido", description: "Use o formato meudominio.com", variant: "destructive" });
    }
    setAdding(true);
    try {
      const { data, error } = await supabase.functions.invoke("linkter-api", {
        body: { action: "add-domain", domain: clean },
      });
      if (error) throw error;
      if (data?.error) throw new Error(typeof data.error === "string" ? data.error : JSON.stringify(data.error));
      setNewDomain("");
      await reload();
      toast({ title: "Domínio adicionado", description: "Configure os registros DNS abaixo e clique em Verificar." });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setAdding(false);
    }
  }

  async function checkDomain(id: string) {
    setCheckingId(id);
    try {
      const { data, error } = await supabase.functions.invoke("linkter-api", {
        body: { action: "domain-details", domain_id: id },
      });
      if (error) throw error;
      setLocal((p) => ({ ...p, [id]: { ...(p[id] || {}), ...(data || {}) } }));
      toast(
        data?.is_verified
          ? { title: "Domínio verificado!", description: "Já pode usar em links personalizados." }
          : { title: "Ainda não propagou", description: "O DNS pode levar até 24h. Confira os registros e tente de novo." },
      );
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setCheckingId(null);
    }
  }

  async function deleteDomain(id: string) {
    setDeletingId(id);
    try {
      const { error } = await supabase.functions.invoke("linkter-api", { body: { action: "delete-domain", domain_id: id } });
      if (error) throw error;
      await reload();
      toast({ title: "Domínio removido" });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="glass-card p-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
            <Globe className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-[200px]">
            <h2 className="font-semibold">Domínios próprios</h2>
            <p className="text-xs text-muted-foreground">
              {verifiedCount} de {list.length} verificado(s) — só domínios verificados ficam liberados para os links.
            </p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Input
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addDomain()}
              placeholder="meudominio.com"
              className="sm:w-56"
            />
            <Button onClick={addDomain} disabled={adding} className="bg-gradient-to-r from-primary to-teal-500 text-primary-foreground shrink-0">
              {adding ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />} Adicionar
            </Button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="glass-card flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : list.length === 0 ? (
        <div className="glass-card flex flex-col items-center py-16 text-center px-6">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/25 flex items-center justify-center mb-4">
            <Globe className="w-6 h-6 text-primary" />
          </div>
          <h3 className="font-semibold">Nenhum domínio conectado</h3>
          <p className="text-sm text-muted-foreground max-w-md mt-1">
            Adicione um domínio seu para os links curtos saírem com a sua marca. Enquanto não for verificado, ele fica bloqueado.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((d) => {
            const open = expanded === d.id;
            return (
              <div key={d.id} className={cn("glass-card overflow-hidden border", d.is_verified ? "border-emerald-500/25" : "border-amber-500/25")}>
                <div className="flex flex-wrap items-center gap-3 p-4">
                  <div className={cn("w-1 h-9 rounded-full", d.is_verified ? "bg-emerald-400" : "bg-amber-400")} />
                  <div className="flex-1 min-w-[180px]">
                    <p className="font-mono text-sm">{d.domain}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {d.is_verified ? "Liberado para uso em links" : "Bloqueado até a verificação do DNS"}
                    </p>
                  </div>
                  {d.is_verified ? (
                    <span className="flex items-center gap-1 text-xs text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full">
                      <ShieldCheck className="w-3.5 h-3.5" /> Verificado
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full">
                      <Clock className="w-3.5 h-3.5" /> Aguardando DNS
                    </span>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => setExpanded(open ? null : d.id)}>
                    <ChevronDown className={cn("w-4 h-4 transition-transform", open && "rotate-180")} />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => checkDomain(d.id)} disabled={checkingId === d.id}>
                    {checkingId === d.id ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
                    Verificar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => deleteDomain(d.id)} disabled={deletingId === d.id} className="hover:text-destructive">
                    {deletingId === d.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  </Button>
                </div>

                {open && (
                  <div className="border-t border-border/50 p-4 space-y-3 bg-secondary/20">
                    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Registros DNS necessários</p>
                    <div className="space-y-2">
                      {dnsRecords(d).map((r) => (
                        <div key={r.type + r.name} className="rounded-lg border border-border/60 bg-background/40 p-3">
                          <div className="flex flex-wrap items-center gap-3 font-mono text-xs">
                            <span className="px-2 py-0.5 rounded bg-primary/15 text-primary">{r.type}</span>
                            <span className="text-muted-foreground">nome:</span>
                            <span>{r.name}</span>
                            <CopyBtn text={r.name} />
                            <span className="text-muted-foreground">valor:</span>
                            <span className="truncate max-w-[280px]">{r.value}</span>
                            <CopyBtn text={r.value} />
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-1">{r.note}</p>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 p-3">
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-300">
                        Depois de salvar os registros no seu provedor, clique em <b>Verificar</b>. A propagação costuma levar de 10 minutos a 24 horas.
                        O domínio só aparece na criação de links depois de verificado.
                      </p>
                    </div>
                    {d.is_verified && (
                      <p className="text-xs text-emerald-400 flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5" /> Tudo certo — este domínio já pode ser selecionado nos links personalizados.
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
