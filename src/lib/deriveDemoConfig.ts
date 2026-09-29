import type { DemoConfig } from "@/hooks/useDemoMode";

export function parseDemoNumber(value: string | number | null | undefined): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const raw = String(value ?? "").trim().replace(/\s/g, "");
  if (!raw) return 0;

  const hasComma = raw.includes(",");
  const hasDot = raw.includes(".");

  if (hasComma && hasDot) {
    const decimalSep = raw.lastIndexOf(",") > raw.lastIndexOf(".") ? "," : ".";
    const thousandSep = decimalSep === "," ? "." : ",";
    const normalized = raw
      .replace(new RegExp(`\\${thousandSep}`, "g"), "")
      .replace(decimalSep, ".")
      .replace(/[^0-9.-]/g, "");
    return Number(normalized) || 0;
  }

  const separator = hasComma ? "," : hasDot ? "." : null;
  if (!separator) return Number(raw.replace(/[^0-9-]/g, "")) || 0;

  const parts = raw.split(separator);
  const whole = parts.slice(0, -1).join("").replace(/[^0-9-]/g, "");
  const fraction = (parts[parts.length - 1] || "").replace(/\D/g, "");

  if (fraction.length === 3 && parts.length === 2) {
    return Number(`${whole}${fraction}`.replace(/[^0-9-]/g, "")) || 0;
  }

  if (fraction.length > 2) {
    const digits = `${whole}${fraction}`.replace(/[^0-9-]/g, "");
    const sign = digits.startsWith("-") ? "-" : "";
    const unsigned = digits.replace("-", "");
    if (unsigned.length <= 2) return Number(`${sign}0.${unsigned.padStart(2, "0")}`) || 0;
    return Number(`${sign}${unsigned.slice(0, -2)}.${unsigned.slice(-2)}`) || 0;
  }

  return Number(`${whole || "0"}.${fraction.padEnd(0, "0")}`) || 0;
}

export function parseDemoInteger(value: string | number | null | undefined): number {
  if (typeof value === "number") return Math.max(0, Math.round(value));
  const raw = String(value ?? "").trim();
  if (!raw) return 0;
  return Math.max(0, Number(raw.replace(/\D/g, "")) || 0);
}

/**
 * Deriva TODAS as métricas do dashboard demo a partir dos 3 pilares:
 * saldo total, ticket médio e total de usuários. Garante consistência
 * entre RevenueBar, cards, gráfico, usuários e conversões.
 */
export interface DemoOverrides {
  revenueToday?: number;
  revenueMonth?: number;
  salesToday?: number;
  salesMonth?: number;
  usersToday?: number;
  usersMonth?: number;
  activeVips?: number;
  blockedUsers?: number;
}

export function deriveDemoConfig(
  totalRevenueAllTime: number,
  avgTicket: number,
  totalUsers: number,
  overrides: DemoOverrides = {},
  todayShare = 0.04,
  monthShare = 0.35,
  vipShare = 0.6,
): DemoConfig {
  const safeRevenue = Math.max(0, Number(totalRevenueAllTime) || 0);
  const safeTicket = Math.max(0.01, Number(avgTicket) || 0.01);
  const safeUsers = Math.max(0, Math.round(Number(totalUsers) || 0));
  const totalSalesAllTime = Math.max(0, Math.round(safeRevenue / safeTicket));
  const pick = (val: number | undefined, fallback: number) =>
    val !== undefined && Number.isFinite(val) && val >= 0 ? val : fallback;
  const revenueMonth = pick(overrides.revenueMonth, +(safeRevenue * monthShare).toFixed(2));
  const salesMonth = pick(overrides.salesMonth, Math.max(0, Math.round(revenueMonth / safeTicket)));
  const revenueToday = pick(overrides.revenueToday, +(revenueMonth * todayShare).toFixed(2));
  const salesToday = pick(overrides.salesToday, Math.max(0, Math.round(revenueToday / safeTicket)));
  const usersMonth = pick(overrides.usersMonth, Math.round(safeUsers * monthShare));
  const usersToday = pick(overrides.usersToday, Math.round(usersMonth * todayShare));
  const activeVips = pick(overrides.activeVips, Math.round(totalSalesAllTime * vipShare));
  const blockedUsers = pick(overrides.blockedUsers, Math.round(safeUsers * 0.015));
  const conversionTotal = safeUsers > 0 ? +((totalSalesAllTime / safeUsers) * 100).toFixed(2) : 0;
  const conversionMonth = usersMonth > 0 ? +((salesMonth / usersMonth) * 100).toFixed(2) : 0;
  const conversionToday = usersToday > 0 ? +((salesToday / usersToday) * 100).toFixed(2) : 0;
  const last7Total = revenueMonth * (7 / 30);
  const weights7 = [0.10, 0.11, 0.13, 0.15, 0.15, 0.17, 0.19];
  const chartData = weights7.map((w, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return {
      date: d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: "2-digit", month: "2-digit" }),
      value: +(last7Total * w).toFixed(2),
    };
  });
  // 30-day chart: distribute revenueMonth with a slight upward trend
  const chartData30d = Array.from({ length: 30 }, (_, i) => {
    const trend = 0.6 + (i / 29) * 0.8; // 0.6 -> 1.4
    return { weight: trend, i };
  });
  const sumW30 = chartData30d.reduce((s, x) => s + x.weight, 0);
  const chart30 = chartData30d.map(({ weight, i }) => {
    const d = new Date();
    d.setDate(d.getDate() - (29 - i));
    return {
      date: d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: "2-digit", month: "2-digit" }),
      value: +(revenueMonth * (weight / sumW30)).toFixed(2),
    };
  });
  return {
    salesToday, revenueToday, salesMonth, revenueMonth,
    avgTicket: safeTicket, conversionRate: conversionMonth,
    totalRevenueAllTime: safeRevenue, totalSalesAllTime,
    usersToday, usersMonth, totalUsers: safeUsers, activeVips, blockedUsers,
    conversionToday, conversionMonth, conversionTotal,
    chartData,
    chartData30d: chart30,
    demoSource: "manual_admin",
  };
}

export function repairLegacyDemoConfig(config: DemoConfig): DemoConfig {
  const looksLikeCommaMoneyBug =
    config.totalRevenueAllTime > 0 &&
    config.avgTicket > 0 &&
    config.totalRevenueAllTime < config.avgTicket &&
    config.totalUsers >= 100;

  if (!looksLikeCommaMoneyBug) return config;

  return {
    ...deriveDemoConfig(config.totalRevenueAllTime * 1000, config.avgTicket, config.totalUsers),
    demoSource: config.demoSource || "manual_admin",
  };
}