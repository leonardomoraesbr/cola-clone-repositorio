import { History, Mail, CheckCircle2 } from "lucide-react";
import { Panel } from "@/components/ui/stat-kit";
import { formatBrtDateTime } from "@/lib/brtDate";

function durationLabel(start: string, end: string | null) {
  const a = new Date(start).getTime();
  const b = end ? new Date(end).getTime() : Date.now();
  const mins = Math.max(0, Math.round((b - a) / 60000));
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h < 24) return `${h}h${m ? ` ${m}min` : ""}`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
}

export function BannerHistory({ rows }: { rows: any[] }) {
  return (
    <Panel icon={History} title="Histórico de avisos" subtitle="Todas as mensagens do banner, com início, fim e duração">
      {rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Nenhum aviso registrado ainda.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => {
            const active = !r.ended_at;
            return (
              <div key={r.id} className={`rounded-xl border p-3 ${active ? "border-red-500/40 bg-red-500/5" : "border-border/40 bg-secondary/20"}`}>
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-semibold ${active ? "bg-red-500/15 text-red-400" : "bg-muted text-muted-foreground"}`}>
                    {active ? "Em exibição" : "Encerrado"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatBrtDateTime(r.started_at)} → {r.ended_at ? formatBrtDateTime(r.ended_at) : "agora"}
                  </span>
                  <span className="text-xs font-mono text-primary">{durationLabel(r.started_at, r.ended_at)}</span>
                  {r.notified_at ? (
                    <span className="text-xs flex items-center gap-1 text-emerald-400">
                      <Mail className="w-3 h-3" /> {r.notified_count} e-mails · {formatBrtDateTime(r.notified_at)}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground flex items-center gap-1"><Mail className="w-3 h-3" /> sem notificação</span>
                  )}
                </div>
                <p className="text-sm whitespace-pre-wrap">{r.message}</p>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}
