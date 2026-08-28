const SUPABASE_HOST_SUFFIX = ".supabase.co";
const PUBLISHABLE_KEY_PREFIX = "sb_publishable_";

export type PublicEnvironment = Readonly<{
  supabaseUrl: string;
  supabasePublishableKey: string;
}>;

export function validatePublicEnvironment(values: {
  supabaseUrl?: string;
  supabasePublishableKey?: string;
}): PublicEnvironment {
  const supabaseUrl = values.supabaseUrl?.trim();
  const supabasePublishableKey = values.supabasePublishableKey?.trim();

  if (!supabaseUrl) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is required.");
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(supabaseUrl);
  } catch {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL must be a valid URL.");
  }

  if (parsedUrl.protocol !== "https:" || !parsedUrl.hostname.endsWith(SUPABASE_HOST_SUFFIX)) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL must use HTTPS and a hosted supabase.co project.");
  }

  if (!supabasePublishableKey?.startsWith(PUBLISHABLE_KEY_PREFIX)) {
    throw new Error("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must be a Supabase publishable key.");
  }

  return { supabaseUrl, supabasePublishableKey };
}

export function getPublicEnvironment(): PublicEnvironment {
  return validatePublicEnvironment({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabasePublishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
}
