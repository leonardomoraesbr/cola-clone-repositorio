import { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthContext";
import { Tables } from "@/integrations/supabase/types";

type Bot = Tables<"bots">;

interface BotContextType {
  bots: Bot[];
  selectedBot: Bot | null;
  setSelectedBot: (bot: Bot | null) => void;
  loading: boolean;
  refreshBots: () => Promise<void>;
}

const BotContext = createContext<BotContextType | undefined>(undefined);
const BOT_LOAD_TIMEOUT_MS = 8_500;

export function BotProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [bots, setBots] = useState<Bot[]>([]);
  const [selectedBot, setSelectedBot] = useState<Bot | null>(null);
  const [loading, setLoading] = useState(true);
  const selectedBotRef = useRef<Bot | null>(null);
  const prevBotIdsRef = useRef<string>("");
  const requestRef = useRef<Promise<void> | null>(null);

  // Keep ref in sync
  useEffect(() => {
    selectedBotRef.current = selectedBot;
  }, [selectedBot]);

  const fetchBots = useCallback(async () => {
    if (authLoading) {
      return;
    }

    if (!user) {
      setBots([]);
      setSelectedBot(null);
      setLoading(false);
      return;
    }

    if (requestRef.current) return requestRef.current;

    const request = (async () => {
    try {
      const { data, error } = await supabase
        .from("bots")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .abortSignal(AbortSignal.timeout(8_000));

      if (error) throw error;

      const newBots = data || [];
      
      // Only update bots state if the data actually changed (compare IDs)
      const newBotIds = newBots.map(b => b.id).sort().join(",");
      if (newBotIds !== prevBotIdsRef.current) {
        prevBotIdsRef.current = newBotIds;
        setBots(newBots);
      } else {
        // Update bots data in place (fields may have changed) but keep same reference if IDs match
        setBots(prev => {
          const prevJson = JSON.stringify(prev);
          const newJson = JSON.stringify(newBots);
          return prevJson === newJson ? prev : newBots;
        });
      }
      
      // Auto-select first bot if none selected
      if (newBots.length > 0 && !selectedBotRef.current) {
        setSelectedBot(newBots[0]);
      } else if (newBots.length === 0) {
        setSelectedBot(null);
      } else if (selectedBotRef.current) {
        // Update selected bot data if it still exists
        const currentSelectedBot = selectedBotRef.current;
        const updated = newBots.find(b => b.id === currentSelectedBot.id);
        if (updated) {
          const currentJson = JSON.stringify(selectedBotRef.current);
          const updatedJson = JSON.stringify(updated);
          if (currentJson !== updatedJson) {
            setSelectedBot(updated);
          }
        } else {
          setSelectedBot(newBots[0] || null);
        }
      }
    } catch (error) {
      console.error("Error fetching bots:", error);
    } finally {
      setLoading(false);
      requestRef.current = null;
    }
    })();

    requestRef.current = request;
    return request;
  }, [authLoading, user?.id]);

  useEffect(() => {
    if (authLoading) {
      setLoading(true);
      return;
    }

    // A network/auth outage must never leave every protected screen blocked.
    const loadingGuard = window.setTimeout(() => {
      setLoading(false);
    }, BOT_LOAD_TIMEOUT_MS);
    void fetchBots();
    return () => window.clearTimeout(loadingGuard);
  }, [authLoading, fetchBots]);

  const refreshBots = useCallback(async () => {
    await fetchBots();
  }, [fetchBots]);

  return (
    <BotContext.Provider value={{ bots, selectedBot, setSelectedBot, loading, refreshBots }}>
      {children}
    </BotContext.Provider>
  );
}

export function useBots() {
  const context = useContext(BotContext);
  if (context === undefined) {
    throw new Error("useBots must be used within a BotProvider");
  }
  return context;
}
