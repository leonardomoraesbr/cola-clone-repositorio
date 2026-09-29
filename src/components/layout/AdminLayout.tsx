import { ReactNode, useState } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ShieldCheck, RefreshCw, ArrowLeft, Menu as MenuIcon, X } from "lucide-react";

export type AdminNavItem = { id: string; label: string; icon: any; group: string };

interface AdminLayoutProps {
  items: AdminNavItem[];
  activeId: string;
  onSelect: (id: string) => void;
  onRefresh?: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
}

export function AdminLayout({ items, activeId, onSelect, onRefresh, title, subtitle, children }: AdminLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const groups = Array.from(new Set(items.map((i) => i.group)));

  const Nav = (
    <div className="flex flex-col h-full">
      <div className="p-5 border-b border-sidebar-border">
        <Link to="/dashboard" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold leading-tight">Riot Admin</p>
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Painel interno</p>
          </div>
        </Link>
      </div>

      <nav className="flex-1 min-h-0 overflow-y-auto scroll-slim py-3 px-3 space-y-4">
        {groups.map((group) => (
          <div key={group}>
            <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{group}</p>
            <div className="space-y-0.5">
              {items.filter((i) => i.group === group).map((item) => {
                const Icon = item.icon;
                const active = item.id === activeId;
                return (
                  <button
                    key={item.id}
                    onClick={() => { onSelect(item.id); setMobileOpen(false); }}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors text-left",
                      active
                        ? "bg-primary/15 text-primary font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary/60",
                    )}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-3 border-t border-sidebar-border">
        <Link to="/dashboard">
          <Button variant="outline" size="sm" className="w-full border-border text-xs">
            <ArrowLeft className="w-3.5 h-3.5 mr-1.5" /> Voltar ao painel do vendedor
          </Button>
        </Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed left-0 top-0 h-screen w-60 bg-sidebar border-r border-sidebar-border z-50">
        {Nav}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          <div className="fixed inset-0 bg-black/60 z-50 lg:hidden" onClick={() => setMobileOpen(false)} />
          <aside className="fixed left-0 top-0 h-screen w-64 bg-sidebar border-r border-sidebar-border z-50 lg:hidden">
            {Nav}
          </aside>
        </>
      )}

      <div className="lg:ml-60 min-h-screen">
        <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-sm">
          <div className="h-14 flex items-center gap-3 px-4 sm:px-6">
            <button className="lg:hidden p-2 -ml-2 text-muted-foreground" onClick={() => setMobileOpen((v) => !v)}>
              {mobileOpen ? <X className="w-5 h-5" /> : <MenuIcon className="w-5 h-5" />}
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="text-sm font-semibold truncate">{title}</h1>
              {subtitle && <p className="text-[11px] text-muted-foreground truncate">{subtitle}</p>}
            </div>
            <span className="hidden sm:inline-flex text-[10px] uppercase tracking-[0.16em] px-2 py-1 rounded-full bg-red-500/15 text-red-400 font-semibold">
              Admin
            </span>
            {onRefresh && (
              <Button variant="outline" size="sm" onClick={onRefresh} className="border-border h-8">
                <RefreshCw className="w-3.5 h-3.5 sm:mr-1" />
                <span className="hidden sm:inline">Atualizar</span>
              </Button>
            )}
          </div>
        </header>
        <main className="p-4 sm:p-6 max-w-[1600px]">{children}</main>
      </div>
    </div>
  );
}
