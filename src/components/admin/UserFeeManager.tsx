import { useMemo, useState } from "react";
import { Percent, Save, Loader2, RotateCcw } from "lucide-react";
import { Panel } from "@/components/ui/stat-kit";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface Props {
  profiles: any[];
  globalFee: string;
  saving: string | null;
  onSave: (userId: string, value: string) => void;
}

export function UserFeeManager({ profiles, globalFee, saving, onSave }: Props) {
  const [search, setSearch] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const withOverride = profiles.filter((p) => p.platform_fee_override !== null && p.platform_fee_override !== undefined);
    if (!q) return withOverride;
    return profiles.filter((p) => `${p.email || ""} ${p.full_name || ""}`.toLowerCase().includes(q));
  }, [profiles, search]);

  return (
    <Panel
      icon={Percent}
      title="Taxa por usuário"
      subtitle={`Taxa global atual: R$ ${globalFee || "0.00"} — defina exceções individuais`}
      action={<Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por e-mail ou nome" className="w-full sm:w-64" />}
    >
      {rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {search ? "Nenhum usuário encontrado." : "Nenhuma taxa individual definida. Busque um usuário para criar uma exceção."}
        </p>
      ) : (
        <div className="space-y-2">
          {rows.map((p) => {
            const current = p.platform_fee_override;
            const draft = drafts[p.id] ?? (current !== null && current !== undefined ? String(current) : "");
            return (
              <div key={p.id} className="flex flex-wrap items-center gap-2 p-3 rounded-xl border border-border/40 bg-secondary/20">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{p.email || "Sem e-mail"}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {p.full_name || "—"} ·{" "}
                    {current !== null && current !== undefined
                      ? <span className="text-primary font-mono">taxa individual R$ {Number(current).toFixed(2)}</span>
                      : <span>usando taxa global</span>}
                  </p>
                </div>
                <Input
                  value={draft}
                  onChange={(e) => setDrafts((d) => ({ ...d, [p.id]: e.target.value }))}
                  placeholder={globalFee || "0.60"}
                  inputMode="decimal"
                  className="w-28 h-9 text-xs font-mono"
                />
                <Button size="sm" disabled={saving === p.id} onClick={() => onSave(p.id, draft)} className="btn-gradient border-0">
                  {saving === p.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Save className="w-3 h-3 mr-1" />Salvar</>}
                </Button>
                <Button size="sm" variant="outline" className="border-border" title="Voltar para taxa global"
                  disabled={saving === p.id}
                  onClick={() => { setDrafts((d) => ({ ...d, [p.id]: "" })); onSave(p.id, ""); }}>
                  <RotateCcw className="w-3 h-3" />
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}
