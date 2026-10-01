import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { BotProvider } from "./contexts/BotContext";
import Landing from "./pages/Landing";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import ConfirmEmail from "./pages/ConfirmEmail";
import MyBots from "./pages/MyBots";
import Webhooks from "./pages/Webhooks";
import EditBot from "./pages/EditBot";
import Statistics from "./pages/Statistics";
import Downsell from "./pages/Downsell";
import Upsell from "./pages/Upsell";
import Payments from "./pages/Payments";
import PixStatus from "./pages/PixStatus";
import Mailing from "./pages/Mailing";
import Channels from "./pages/Channels";
import AdminPanel from "./pages/AdminPanel";
import Tracking from "./pages/Tracking";
import AutoApproval from "./pages/AutoApproval";
import Rewards from "./pages/Rewards";
import DemoConfigPage from "./pages/DemoConfig";
import Contingency from "./pages/Contingency";
import ABTesting from "./pages/ABTesting";
import Blacklist from "./pages/Blacklist";
import DuplicateBot from "./pages/DuplicateBot";
import BotBackup from "./pages/BotBackup";
import Renewal from "./pages/Renewal";
import PriceRules from "./pages/PriceRules";
import NotFound from "./pages/NotFound";
import Support from "./pages/Support";
import MyAccount from "./pages/MyAccount";
import Financial from "./pages/Financial";
import Clients from "./pages/Clients";
import ActivityLog from "./pages/ActivityLog";
import CustomLinks from "./pages/CustomLinks";
import CustomLinkEditor from "./pages/CustomLinkEditor";
import LinkRedirect from "./pages/LinkRedirect";
import InitialSetup from "./pages/InitialSetup";
import { AppErrorBoundary } from "./components/AppErrorBoundary";
const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {

  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/auth" element={<Auth />} />
      <Route path="/auth/reset-password" element={<ResetPassword />} />
      <Route path="/auth/confirm-email" element={<ConfirmEmail />} />
      <Route path="/l/:slug" element={<LinkRedirect />} />
      <Route
        path="/configuracoes-iniciais"
        element={
          <ProtectedRoute>
            <InitialSetup />
          </ProtectedRoute>
        }
      />
      <Route
        path="/links-personalizados"
        element={
          <ProtectedRoute>
            <CustomLinks />
          </ProtectedRoute>
        }
      />
      <Route
        path="/links-personalizados/novo"
        element={
          <ProtectedRoute>
            <CustomLinkEditor />
          </ProtectedRoute>
        }
      />
      <Route
        path="/links-personalizados/:id"
        element={
          <ProtectedRoute>
            <CustomLinkEditor />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Index />
          </ProtectedRoute>
        }
      />
      <Route
        path="/criar-bot"
        element={
          <ProtectedRoute>
            <MyBots />
          </ProtectedRoute>
        }
      />
      <Route
        path="/meus-bots"
        element={
          <ProtectedRoute>
            <MyBots />
          </ProtectedRoute>
        }
      />
      <Route
        path="/webhooks"
        element={
          <ProtectedRoute>
            <Webhooks />
          </ProtectedRoute>
        }
      />
      <Route
        path="/editar-bot"
        element={
          <ProtectedRoute>
            <EditBot />
          </ProtectedRoute>
        }
      />
      <Route
        path="/estatisticas"
        element={
          <ProtectedRoute>
            <Statistics />
          </ProtectedRoute>
        }
      />
      <Route
        path="/downsell"
        element={
          <ProtectedRoute>
            <Downsell />
          </ProtectedRoute>
        }
      />
      <Route
        path="/upsell"
        element={
          <ProtectedRoute>
            <Upsell />
          </ProtectedRoute>
        }
      />
      <Route
        path="/teste-ab"
        element={
          <ProtectedRoute>
            <ABTesting />
          </ProtectedRoute>
        }
      />
      <Route
        path="/blacklist"
        element={
          <ProtectedRoute>
            <Blacklist />
          </ProtectedRoute>
        }
      />
      <Route
        path="/duplicar-bot"
        element={
          <ProtectedRoute>
            <DuplicateBot />
          </ProtectedRoute>
        }
      />
      <Route
        path="/backup-bot"
        element={
          <ProtectedRoute>
            <BotBackup />
          </ProtectedRoute>
        }
      />
      <Route
        path="/renovacao"
        element={
          <ProtectedRoute>
            <Renewal />
          </ProtectedRoute>
        }
      />
      <Route
        path="/pagamentos"
        element={
          <ProtectedRoute>
            <Payments />
          </ProtectedRoute>
        }
      />
      <Route
        path="/financeiro"
        element={
          <ProtectedRoute>
            <Financial />
          </ProtectedRoute>
        }
      />
      <Route
        path="/status-pix"
        element={
          <ProtectedRoute>
            <PixStatus />
          </ProtectedRoute>
        }
      />
      <Route path="/widget-ios" element={<Navigate to="/minha-conta" replace />} />
      <Route
        path="/clientes"
        element={
          <ProtectedRoute>
            <Clients />
          </ProtectedRoute>
        }
      />
      <Route
        path="/log-atividade"
        element={
          <ProtectedRoute>
            <ActivityLog />
          </ProtectedRoute>
        }
      />
      <Route
        path="/remarketing"
        element={
          <ProtectedRoute>
            <Mailing />
          </ProtectedRoute>
        }
      />
      <Route path="/mailing" element={<Navigate to="/remarketing" replace />} />
      <Route
        path="/postadores"
        element={
          <ProtectedRoute>
            <Channels />
          </ProtectedRoute>
        }
      />
      <Route path="/canais" element={<Navigate to="/postadores" replace />} />
      <Route
        path="/trackeamento"
        element={
          <ProtectedRoute>
            <Tracking />
          </ProtectedRoute>
        }
      />
      <Route
        path="/aprovacao"
        element={
          <ProtectedRoute>
            <AutoApproval />
          </ProtectedRoute>
        }
      />
      <Route
        path="/meus-premios"
        element={
          <ProtectedRoute>
            <Rewards />
          </ProtectedRoute>
        }
      />
      <Route
        path="/preco-automatico"
        element={
          <ProtectedRoute>
            <PriceRules />
          </ProtectedRoute>
        }
      />
      <Route
        path="/contingencia"
        element={
          <ProtectedRoute>
            <Contingency />
          </ProtectedRoute>
        }
      />
      <Route
        path="/configurar-demo"
        element={
          <ProtectedRoute>
            <DemoConfigPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <AdminPanel />
          </ProtectedRoute>
        }
      />
      <Route
        path="/suporte"
        element={
          <ProtectedRoute>
            <Support />
          </ProtectedRoute>
        }
      />
      <Route
        path="/minha-conta"
        element={
          <ProtectedRoute>
            <MyAccount />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <AppErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <BotProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <AppRoutes />
            </TooltipProvider>
          </BotProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </AppErrorBoundary>
);

export default App;
