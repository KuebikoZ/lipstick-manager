import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { SupabaseEnv } from "@/lib/config/env";

export function createSupabaseAdminClient(env: SupabaseEnv): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}
