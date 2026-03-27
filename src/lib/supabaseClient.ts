import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL ?? "").trim();
const supabaseAnonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY ?? "").trim();

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    "[Supabase] Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env (Vite only exposes variables prefixed with VITE_). Without the anon key, requests return 400 \"No API key found in request\"."
  );
}

console.log("SUPABASE URL:", supabaseUrl || "(missing)");

/**
 * Single shared Supabase browser client. Import this module only — do not call `createClient` elsewhere.
 * Session is persisted in `localStorage` and refreshed automatically after login.
 */
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
    flowType: "pkce",
  },
});
