import { MainLayout } from "@/components/layout/MainLayout";
import { Trophy, CheckCircle2, Lock } from "lucide-react";
import { useTotalRevenue } from "@/hooks/useTotalRevenue";

const MILESTONES = [
  { min: 0, max: 10_000, reward: "Badge Bronze — Membro Riot Vips" },
  { min: 10_000, max: 50_000, reward: "Badge Prata — Acesso a suporte prioritário" },
  { min: 50_000, max: 100_000, reward: "Badge Ouro — Destaque na comunidade" },
  { min: 100_000, max: 500_000, reward: "Badge Diamante — Mentoria exclusiva" },
  { min: 500_000, max: 1_000_000, reward: "Badge Elite — Consultoria estratégica" },
  { min: 1_000_000, max: 5_000_000, reward: "Badge Lenda — Parceria oficial Riot Vips" },
  { min: 5_000_000, max: 10_000_000, reward: "Badge Titan — Benefícios vitalícios" },
];

function fmt(v: number): string {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(v % 1_000_000 === 0 ? 0 : 1)}MM`;
  if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(0)}k`;
  return `R$ ${v}`;
}

export default function Rewards() {
  const { data: revenue = 0 } = useTotalRevenue();

  return (
    <MainLayout>
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <Trophy className="w-7 h-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Meus Prêmios</h1>
            <p className="text-muted-foreground text-sm">
              Faturamento total: <span className="text-primary font-semibold">R$ {revenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {MILESTONES.map((m, i) => {
          const unlocked = revenue >= m.max;
          const current = !unlocked && revenue >= m.min;
          const progress = current ? ((revenue - m.min) / (m.max - m.min)) * 100 : unlocked ? 100 : 0;

          return (
            <div
              key={i}
              className={`glass-card p-5 border-l-4 transition-all ${
                unlocked
                  ? "border-l-primary opacity-100"
                  : current
                  ? "border-l-primary/60 opacity-100"
                  : "border-l-muted opacity-60"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  {unlocked ? (
                    <CheckCircle2 className="w-5 h-5 text-primary" />
                  ) : (
                    <Lock className="w-5 h-5 text-muted-foreground" />
                  )}
                  <div>
                    <p className="font-semibold text-sm">
                      {fmt(m.min)} → {fmt(m.max)}
                    </p>
                    <p className="text-xs text-muted-foreground">{m.reward}</p>
                  </div>
                </div>
                {unlocked && (
                  <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded-full">
                    Desbloqueado ✓
                  </span>
                )}
              </div>
              {(current || unlocked) && (
                <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-2">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </MainLayout>
  );
}
