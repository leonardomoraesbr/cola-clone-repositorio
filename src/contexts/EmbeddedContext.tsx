import { createContext, useContext, ReactNode } from "react";

const EmbeddedContext = createContext(false);

export function EmbeddedProvider({ children }: { children: ReactNode }) {
  return <EmbeddedContext.Provider value={true}>{children}</EmbeddedContext.Provider>;
}

export function useIsEmbedded() {
  return useContext(EmbeddedContext);
}