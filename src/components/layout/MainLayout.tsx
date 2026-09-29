import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { RevenueBar } from "./RevenueBar";
import { NotificationsDropdown } from "./NotificationsDropdown";
import { RevantSyncBadge } from "./RevantSyncBadge";
import { MaintenanceBanner } from "./MaintenanceBanner";
import { GatewayKeyAlert } from "./GatewayKeyAlert";
import { useIsEmbedded } from "@/contexts/EmbeddedContext";

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const embedded = useIsEmbedded();
  if (embedded) {
    // Render children only — no sidebar/header — when embedded inside the Advanced Tools modal
    return <div className="w-full">{children}</div>;
  }
  return (
    <div className="min-h-screen bg-background">
      <MaintenanceBanner />
      <GatewayKeyAlert />
      <Sidebar />
      <div className="ml-64 min-h-screen">
        {/* Sticky Header */}
        <header className="sticky top-0 z-40 h-14 border-b border-border bg-background/80 backdrop-blur-sm flex items-center justify-end px-8 gap-4">
          <RevantSyncBadge />
          <RevenueBar />
          <NotificationsDropdown />
        </header>
        <main>
          <div className="p-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
