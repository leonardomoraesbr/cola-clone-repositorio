import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { readStoredSession } from "@/lib/authSession";

const AUTH_BOOT_TIMEOUT_MS = 8_000;

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName: string, phone: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  requestPasswordReset: (email: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    let subscription: { unsubscribe: () => void } | undefined;
    const storedSession = readStoredSession();

    const applySession = (currentSession: Session | null) => {
      if (!isMounted) return;
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      setLoading(false);
    };

    const initializeAuth = async () => {
      const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
        applySession(nextSession);
      });
      subscription = data.subscription;

      // Do not hold the entire application behind a remote token refresh.
      // The SDK will validate/refresh this session in the background.
      if (storedSession) applySession(storedSession);

      try {
        const result = await Promise.race([
          supabase.auth.getSession(),
          new Promise<never>((_, reject) =>
            window.setTimeout(() => reject(new Error("auth_boot_timeout")), AUTH_BOOT_TIMEOUT_MS),
          ),
        ]);
        if (result.data.session || !storedSession) applySession(result.data.session);
      } catch (error) {
        // Keep a locally persisted session visible during a temporary backend outage.
        // The SDK remains responsible for refreshing and validating it once connectivity returns.
        console.warn("Authentication initialization delayed:", error);
        applySession(storedSession);
      }
    };

    void initializeAuth();

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  const signUp = async (email: string, password: string, fullName: string, phone: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
          phone,
        },
      },
    });

    if (!error) {
      // Fire-and-forget admin notification email
      supabase.functions
        .invoke("notify-new-signup", {
          body: {
            email,
            full_name: fullName,
            phone,
            user_id: data?.user?.id ?? "",
          },
        })
        .catch((e) => console.warn("notify-new-signup failed", e));
    }

    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const requestPasswordReset = async (email: string) => {
    const redirectTo = new URL("/auth/reset-password", window.location.origin).toString();
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, requestPasswordReset, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
