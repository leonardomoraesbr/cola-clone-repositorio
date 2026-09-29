import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download, ChevronLeft, ChevronRight, Search } from "lucide-react";

export interface DrillColumn {
  key: string;
  label: string;
  mono?: boolean;
  align?: "left" | "right";
  render?: (row: any) => React.ReactNode;
  value?: (row: any) => string | number;
}

export interface DrillPayload {
  title: string;
  subtitle?: string;
  columns: DrillColumn[];
  rows: any[];
}

const PAGE_SIZE = 25;

function cellText(col: DrillColumn, row: any): string {
  if (col.value) return String(col.value(row) ?? "");
  const v = row[col.key];
  return v === null || v === undefined ? "" : String(v);
}

export function DrillDownDialog({
  payload,
  onClose,
}: {
  payload: DrillPayload | null;
  onClose: () => void;
}) {
  const [page, setPage] = useState(0);
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    if (!payload) return [];
    if (!q.trim()) return payload.rows;
    const needle = q.toLowerCase();
    return payload.rows.filter(r =>
      payload.columns.some(c => cellText(c, r).toLowerCase().includes(needle))
    );
  }, [payload, q]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const slice = filtered.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);

  function exportCsv() {
    if (!payload) return;
    const head = payload.columns.map(c => `"${c.label}"`).join(",");
    const body = filtered
      .map(r => payload.columns.map(c => `"${cellText(c, r).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([`\uFEFF${head}\n${body}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${payload.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Dialog open={!!payload} onOpenChange={o => { if (!o) { onClose(); setPage(0); setQ(""); } }}>
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-base">{payload?.title}</DialogTitle>
          {payload?.subtitle && (
            <p className="text-[11px] text-muted-foreground">{payload.subtitle}</p>
          )}
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={e => { setQ(e.target.value); setPage(0); }}
              placeholder="Buscar nesta lista..."
              className="h-8 pl-9 text-xs"
            />
          </div>
          <span className="text-[11px] text-muted-foreground font-mono">
            {filtered.length.toLocaleString("pt-BR")} registros
          </span>
          <Button variant="outline" size="sm" className="h-8 border-border" onClick={exportCsv}>
            <Download className="w-3.5 h-3.5 mr-1" /> CSV
          </Button>
        </div>

        <div className="overflow-auto flex-1 rounded-lg border border-border/50">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-card/95 backdrop-blur">
              <tr className="border-b border-border/60">
                {payload?.columns.map(c => (
                  <th key={c.key} className={`py-2 px-3 font-medium text-muted-foreground text-${c.align || "left"} whitespace-nowrap`}>
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {slice.length === 0 && (
                <tr><td className="p-6 text-center text-muted-foreground" colSpan={payload?.columns.length || 1}>Nenhum registro.</td></tr>
              )}
              {slice.map((row, i) => (
                <tr key={row.id || i} className="border-b border-border/30 hover:bg-secondary/30">
                  {payload?.columns.map(c => (
                    <td key={c.key} className={`py-2 px-3 text-${c.align || "left"} ${c.mono ? "font-mono" : ""} whitespace-nowrap`}>
                      {c.render ? c.render(row) : cellText(c, row) || "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-[11px] text-muted-foreground">Página {current + 1} de {pages}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="h-8 border-border" disabled={current === 0} onClick={() => setPage(current - 1)}>
              <ChevronLeft className="w-3.5 h-3.5" />
            </Button>
            <Button variant="outline" size="sm" className="h-8 border-border" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
