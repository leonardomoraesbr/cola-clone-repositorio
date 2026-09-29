import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Application render failed:", error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
        <section className="w-full max-w-md text-center">
          <AlertTriangle className="w-10 h-10 text-destructive mx-auto mb-4" />
          <h1 className="text-xl font-semibold">Não foi possível abrir esta tela</h1>
          <p className="text-sm text-muted-foreground mt-2 mb-6">
            Seus bots continuam operando. Recarregue para restabelecer o painel.
          </p>
          <Button onClick={() => window.location.reload()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Recarregar painel
          </Button>
        </section>
      </main>
    );
  }
}