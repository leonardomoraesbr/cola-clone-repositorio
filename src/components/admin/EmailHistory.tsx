import { useMemo, useState } from "react";
import { Mail, Download, RefreshCw, CheckCircle2, XCircle, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { Panel, StatCard } from "@/components/ui/stat-kit";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatBrtDateTime } from "@/lib/brtDate";

interface Props {
  rows: any[];
  loading: boolean;
  onReload: () => void;
}

export function EmailHistory({ rows, loading, onReload }: Props) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "sent" | "failed">("all");
  const [openBatch, setOpenBatch] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (status !== "all" && r.status !== status) return false;
      if (!q) return true;
      return [r.recipient_email, r.subject, r.message, r.kind].filter(Boolean).join(" ").toLowerCase().includes(q);
    });
  }, [rows, search, status]);

  const batches = useMemo(() => {
    const map = new Map<string, any>();
    for (const r of filtered) {
      const b = map.get(r.batch_id) || {
        batch_id: r.batch_id, subject: r.subject, message: r.message, kind: r.kind,
        created_at: r.created_at, sent: 0, failed: 0, items: [] as any[],
      };
      if (r.status === "sent") b.sent += 1; else b.failed += 1;
      if (new Date(r.created_at) > new Date(b.created_at)) b.created_at = r.created_at;
      b.items.push(r);
      map.set(r.batch_id, b);
    }
    return Array.from(map.values()).sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
  }, [filtered]);

  const totalSent = rows.filter((r) => r.status === "sent").length;
  const totalFailed = rows.length - totalSent;

  const exportCsv = () => {
    const header = ["data", "assunto", "tipo", "destinatario", "status", "erro"];
    const lines = filtered.map((r) =>
      [formatBrtDateTime(r.created_at), r.subject, r.kind, r.recipient_email, r.status, r.error_message || ""]
        .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","),
    );
    const blob = new Blob(["\ufeff" + [header.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `emails-riotvips-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <StatCard icon={Mail} label="E-mails registrados" value={rows.length} color="bg-primary/15 text-primary" />
        <StatCard icon={CheckCircle2} label="Entregues" value={totalSent} color="bg-emerald-500/15 text-emerald-400" bar="bg-emerald-500" />
        <StatCard icon={XCircle} label="Falhas" value={totalFailed} color="bg-red-500/15 text-red-400" bar="bg-red-500" />
        <StatCard icon={Mail} label="Campanhas" value={new Set(rows.map((r) => r.batch_id)).size} color="bg-cyan-500/15 text-cyan-400" />
      </div>

      <Panel
        icon={Mail}
        title="Histórico de e-mails"
        subtitle="Todos os envios feitos pela plataforma (avisos, status e comunicados)"
        action={
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar e-mail ou assunto" className="w-full sm:w-64" />
            <div className="flex gap-1">
              {(["all", "sent", "failed"] as const).map((s) => (
                <Button key={s} size="sm" variant={status === s ? "default" : "outline"} className="border-border text-xs" onClick={() => setStatus(s)}>
                  {s === "all" ? "Todos" : s === "sent" ? "Entregues" : "Falhas"}
                </Button>
              ))}
            </div>
            <Button size="sm" variant="outline" className="border-border" onClick={exportCsv}><Download className="w-4 h-4" /></Button>
            <Button size="sm" variant="outline" className="border-border" onClick={onReload}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            </Button>
          </div>
        }
      >
        {batches.length === 0 ? (
          <p className="py-10 text-center text-muted-foreground text-sm">Nenhum e-mail enviado ainda.</p>
        ) : (
          <div className="space-y-2">
            {batches.map((b) => {
              const open = openBatch === b.batch_id;
              return (
                <div key={b.batch_id} className="rounded-xl border border-border/40 bg-secondary/20">
                  <button onClick={() => setOpenBatch(open ? null : b.batch_id)} className="w-full flex items-center gap-3 p-3 text-left">
                    {open ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{b.subject}</p>
                      <p className="text-xs text-muted-foreground truncate">{formatBrtDateTime(b.created_at)} · {b.kind}</p>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-mono">{b.sent} ok</span>
                    {b.failed > 0 && <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 font-mono">{b.failed} erro</span>}
                  </button>
                  {open && (
                    <div className="border-t border-border/40 p-3 space-y-3">
                      {b.message && (
                        <div className="text-xs text-muted-foreground whitespace-pre-wrap bg-background/50 rounded-lg p-3 border border-border/40">{b.message}</div>
                      )}
                      <div className="overflow-x-auto rounded-lg border border-border/40 max-h-80 overflow-y-auto">
                        <table className="w-full text-xs min-w-[520px]">
                          <thead className="sticky top-0 bg-secondary/60">
                            <tr>
                              <th className="text-left py-2 px-3 text-muted-foreground font-medium">Destinatário</th>
                              <th className="text-left py-2 px-3 text-muted-foreground font-medium">Status</th>
                              <th className="text-left py-2 px-3 text-muted-foreground font-medium">Data</th>
                              <th className="text-left py-2 px-3 text-muted-foreground font-medium">Erro</th>
                            </tr>
                          </thead>
                          <tbody>
                            {b.items.map((r: any) => (
                              <tr key={r.id} className="border-t border-border/20">
                                <td className="py-1.5 px-3 font-mono">{r.recipient_email}</td>
                                <td className="py-1.5 px-3">
                                  <span className={r.status === "sent" ? "text-emerald-400" : "text-red-400"}>
                                    {r.status === "sent" ? "Entregue" : "Falhou"}
                                  </span>
                                </td>
                                <td className="py-1.5 px-3 text-muted-foreground">{formatBrtDateTime(r.created_at)}</td>
                                <td className="py-1.5 px-3 text-muted-foreground truncate max-w-[240px]">{r.error_message || "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </div>
  );
}
