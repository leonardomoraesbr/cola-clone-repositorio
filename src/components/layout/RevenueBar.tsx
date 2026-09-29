import { useNavigate } from "react-router-dom";
import { useTotalRevenue } from "@/hooks/useTotalRevenue";

const MILESTONES = [
  { min: 0, max: 10_000 },
  { min: 10_000, max: 50_000 },
  { min: 50_000, max: 100_000 },
  { min: 100_000, max: 500_000 },
  { min: 500_000, max: 1_000_000 },
  { min: 1_000_000, max: 5_000_000 },
  { min: 5_000_000, max: 10_000_000 },
];

function fmt(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(v % 1_000_000 === 0 ? 0 : 1)}MM`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(v % 1_000 === 0 ? 0 : 0)}k`;
  return v.toString();
}

function fmtValue(v: number): string {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}MM`;
  if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(1)}k`;
  return `R$ ${v.toFixed(0)}`;
}

export function RevenueBar() {
  const navigate = useNavigate();
  const { data: revenue = 0 } = useTotalRevenue();

  const milestone = MILESTONES.find((m) => revenue < m.max) ?? MILESTONES[MILESTONES.length - 1];
  const progress = Math.min(((revenue - milestone.min) / (milestone.max - milestone.min)) * 100, 100);
  const label = `${fmt(milestone.min)} → ${fmt(milestone.max)}`;

  return (
    <button
      onClick={() => navigate("/meus-premios")}
      className="flex items-center gap-2 hover:opacity-80 cursor-pointer transition-opacity"
      title="Ver meus prêmios"
    >
      <span className="text-xs font-medium text-foreground hidden sm:inline">{label}</span>
      <span className="text-xs font-medium text-primary">{fmtValue(revenue)}</span>
      <div className="w-20 sm:w-40 h-1.5 sm:h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-foreground rounded-full transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
    </button>
  );
}
