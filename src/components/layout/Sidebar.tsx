import { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, BarChart3, Plus, Settings, TrendingDown, CreditCard,
  Bot, ChevronDown, Send, Rocket, Crosshair, UserCheck, Shield, Users,
  FlaskConical, ShieldBan, RotateCcw, CalendarClock, Copy, Archive,
  Headphones, User, Wallet, Megaphone, Activity, Webhook,
  Zap, Plug, SlidersHorizontal, Menu as MenuIcon, Gauge, Trophy, Smartphone, ScrollText, Link2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useBots } from "@/contexts/BotContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { SalesWidgetPanel } from "@/components/widget/SalesWidgetPanel";

type NavItem = { icon: any; label: string; path: string };
type NavSection = { id: string; label: string; icon: any; accent: string; items: NavItem[] };

const sections: NavSection[] = [
  {
    id: "menu",
    label: "Painel",
    icon: MenuIcon,
    accent: "text-foreground",
    items: [
      { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
      { icon: BarChart3, label: "Estatísticas", path: "/estatisticas" },
      { icon: Wallet, label: "Financeiro", path: "/financeiro" },
      { icon: ScrollText, label: "Log de Atividade", path: "/log-atividade" },
      { icon: Users, label: "Clientes", path: "/clientes" },
      { icon: Gauge, label: "Status PIX", path: "/status-pix" },
      { icon: Trophy, label: "Meus Prêmios", path: "/meus-premios" },
    ],
  },
  {
    id: "automacoes",
    label: "Fluxos Automáticos",
    icon: Zap,
    accent: "text-foreground",
    items: [
      { icon: Megaphone, label: "Remarketing", path: "/remarketing" },
      { icon: TrendingDown, label: "Downsell", path: "/downsell" },
      { icon: Rocket, label: "Upsell", path: "/upsell" },
      { icon: RotateCcw, label: "Renovação Auto", path: "/renovacao" },
      { icon: UserCheck, label: "Aprovação Auto", path: "/aprovacao" },
      { icon: CalendarClock, label: "Preço Automático", path: "/preco-automatico" },
      { icon: FlaskConical, label: "Teste A/B", path: "/teste-ab" },
    ],
  },
  {
    id: "integracoes",
    label: "Conexões",
    icon: Plug,
    accent: "text-foreground",
    items: [
      { icon: CreditCard, label: "Pagamentos", path: "/pagamentos" },
      { icon: Webhook, label: "Central de Alertas", path: "/webhooks" },
      { icon: Crosshair, label: "Trackeamento", path: "/trackeamento" },
      { icon: Link2, label: "Links Personalizados", path: "/links-personalizados" },
      { icon: Send, label: "Postadores", path: "/postadores" },
    ],
  },
  {
    id: "configuracoes",
    label: "Ajustes",
    icon: SlidersHorizontal,
    accent: "text-foreground",
    items: [
      { icon: Plus, label: "Meus Bots", path: "/meus-bots" },
      { icon: Settings, label: "Editar Bot", path: "/editar-bot" },
      { icon: Copy, label: "Duplicar Bot", path: "/duplicar-bot" },
      { icon: Archive, label: "Backup & Restauração", path: "/backup-bot" },
      { icon: ShieldBan, label: "Blacklist", path: "/blacklist" },
      { icon: Shield, label: "Contingência", path: "/contingencia" },
    ],
  },
];

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { bots, selectedBot, setSelectedBot } = useBots();
  const navRef = useRef<HTMLElement | null>(null);
  const [widgetOpen, setWidgetOpen] = useState(false);

  const activeSectionId =
    sections.find((s) => s.items.some((i) => i.path === location.pathname))?.id ?? "menu";
  const [openSections, setOpenSections] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("sidebar_open_sections");
      if (saved) return JSON.parse(saved);
    } catch {}
    return ["menu", "automacoes"];
  });

  useEffect(() => {
    try {
      localStorage.setItem("sidebar_open_sections", JSON.stringify(openSections));
    } catch {}
  }, [openSections]);

  useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    const saved = Number(sessionStorage.getItem("sidebar_scroll") || 0);
    if (saved) el.scrollTop = saved;
    const onScroll = () => sessionStorage.setItem("sidebar_scroll", String(el.scrollTop));
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const toggleSection = (id: string) =>
    setOpenSections((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));

  const handleBotChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === "new") {
      navigate("/criar-bot");
    } else {
      const bot = bots.find((b) => b.id === value);
      if (bot) setSelectedBot(bot);
    }
  };

  return (
    <>
      <aside className="fixed left-0 top-0 h-screen w-64 bg-sidebar border-r border-sidebar-border flex flex-col z-50">
        {/* Logo */}
        <div className="p-6 border-b border-sidebar-border">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-teal-500 flex items-center justify-center">
              <Bot className="w-6 h-6 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold gradient-text">Riot Vips</span>
          </Link>
        </div>

        {/* Bot Selector */}
        <div className="p-4 border-b border-sidebar-border">
          {bots.length > 0 ? (
            <div className="relative">
              <select
                value={selectedBot?.id || ""}
                onChange={handleBotChange}
                className="w-full input-dark text-sm pr-8 appearance-none cursor-pointer"
              >
                {bots.map((bot) => (
                  <option key={bot.id} value={bot.id}>{bot.username}</option>
                ))}
                <option value="new">+ Criar novo bot</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            </div>
          ) : (
            <button
              onClick={() => navigate("/criar-bot")}
              className="w-full input-dark text-sm text-left text-muted-foreground hover:text-foreground transition-colors"
            >
              + Criar primeiro bot
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav ref={navRef as any} className="min-h-0 overflow-y-auto scroll-slim py-3 px-3 space-y-1">
          {sections.map((section) => {
            const SectionIcon = section.icon;
            const isOpen = openSections.includes(section.id);
            const hasActive = section.items.some((i) => i.path === location.pathname);

            return (
              <div key={section.id}>
                <button
                  onClick={() => toggleSection(section.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left",
                    hasActive ? "text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                  )}
                >
                  <SectionIcon className={cn("w-4 h-4 shrink-0", section.accent)} />
                  <span className="flex-1 text-xs font-semibold uppercase tracking-wider">
                    {section.label}
                  </span>
                  <ChevronDown
                    className={cn("w-4 h-4 transition-transform duration-200", isOpen && "rotate-180")}
                  />
                </button>

                {isOpen && (
                  <div className="ml-[19px] pl-3 border-l border-sidebar-border space-y-0.5 py-1">
                    {section.items.map((item) => {
                      const Icon = item.icon;
                      const isActive = location.pathname === item.path;
                      const className = cn(
                        "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all",
                        isActive
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                      );

                      return (
                        <Link key={`${section.id}-${item.path}`} to={item.path} className={className}>
                          <Icon className="w-4 h-4 shrink-0" />
                          <span>{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="flex-1" />

        {/* iOS Widget promo */}
        <div className="px-3 pb-3 pt-3 border-t border-sidebar-border">
          <button
            type="button"
            onClick={() => setWidgetOpen(true)}
            className="w-full text-left block rounded-2xl p-4 bg-gradient-to-br from-primary/25 to-primary/5 border border-primary/40 shadow-[0_0_24px_-6px_hsl(var(--primary)/0.6)] hover:shadow-[0_0_32px_-4px_hsl(var(--primary)/0.8)] transition-shadow"
          >
            <Smartphone className="w-5 h-5 text-primary mb-2" />
            <p className="text-sm font-semibold text-foreground leading-tight">Widget iOS</p>
            <p className="text-xs text-muted-foreground mt-1 leading-snug">
              Acompanhe suas vendas na tela do iPhone.
            </p>
            <span className="mt-2 inline-block text-xs font-medium text-primary">Ativar agora →</span>
          </button>
        </div>

        {/* Support & Account */}
        <div className="px-3 pb-3 space-y-0.5">
          <Link
            to="/suporte"
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all",
              location.pathname === "/suporte"
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
            )}
          >
            <Headphones className="w-4 h-4" />
            <span>Suporte</span>
          </Link>
          <Link
            to="/minha-conta"
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all",
              location.pathname === "/minha-conta"
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
            )}
          >
            <User className="w-4 h-4" />
            <span>Minha Conta</span>
          </Link>
        </div>
      </aside>

      <Dialog open={widgetOpen} onOpenChange={setWidgetOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Painel iOS — Faturamento</DialogTitle>
            <DialogDescription>Acompanhe o caixa do dia direto na tela do iPhone</DialogDescription>
          </DialogHeader>
          <SalesWidgetPanel />
        </DialogContent>
      </Dialog>
    </>
  );
}
