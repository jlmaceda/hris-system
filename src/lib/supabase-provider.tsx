import { createContext, useContext, type ReactNode } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";

const SupabaseClientContext = createContext<SupabaseClient | null>(null);

/**
 * Wraps the app so all auth/API usage shares the same `createClient` instance from `supabaseClient.ts`.
 * `AuthProvider` should be nested inside this (it listens to this client's session).
 */
export function SupabaseProvider({ children }: { children: ReactNode }) {
  return <SupabaseClientContext.Provider value={supabase}>{children}</SupabaseClientContext.Provider>;
}

export function useSupabase(): SupabaseClient {
  const client = useContext(SupabaseClientContext);
  if (!client) {
    throw new Error("useSupabase must be used within SupabaseProvider");
  }
  return client;
}
