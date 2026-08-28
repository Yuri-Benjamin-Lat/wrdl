import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getPublicEnvironment } from "@/lib/environment";

let browserClient: SupabaseClient | undefined;

export function getSupabaseBrowserClient(): SupabaseClient {
  if (!browserClient) {
    const { supabaseUrl, supabasePublishableKey } = getPublicEnvironment();

    browserClient = createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }

  return browserClient;
}
