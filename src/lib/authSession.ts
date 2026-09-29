import { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AuthClientWithStorageKey = typeof supabase.auth & {
  storageKey?: string;
};

const getStorageKey = () => (supabase.auth as AuthClientWithStorageKey).storageKey;

export function readStoredSession(): Session | null {
  if (typeof window === "undefined") return null;

  const storageKey = getStorageKey();
  if (!storageKey) return null;

  const rawSession = window.localStorage.getItem(storageKey);
  if (!rawSession) return null;

  try {
    const parsed = JSON.parse(rawSession);

    if (
      parsed &&
      typeof parsed === "object" &&
      "access_token" in parsed &&
      "refresh_token" in parsed
    ) {
      return parsed as Session;
    }
  } catch (error) {
    console.error("Error reading auth session from storage:", error);
  }

  return null;
}

