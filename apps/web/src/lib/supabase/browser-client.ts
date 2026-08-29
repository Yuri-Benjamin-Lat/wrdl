import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";
import { getPublicEnvironment } from "@/lib/environment";

let browserClient: SupabaseClient<Database> | undefined;

export function getSupabaseBrowserClient(): SupabaseClient<Database> {
  if (!browserClient) {
    const { supabaseUrl, supabasePublishableKey } = getPublicEnvironment();

    browserClient = createBrowserClient<Database>(supabaseUrl, supabasePublishableKey);
  }

  return browserClient;
}
