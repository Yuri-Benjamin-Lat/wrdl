# Database migrations

Versioned SQL migrations for the hosted WRDL development/staging project live
here. Apply them with the Windows-native Supabase CLI after explicitly linking
an authorized hosted project. WRDL does not run a local Supabase stack.

The first application migration, `20260829010000_m2_auth_profiles_settings.sql`,
establishes the M2 identity, profile, settings, username, avatar-storage, RLS,
and account-deletion foundation.

The two M2 migrations were applied to the hosted development project through
the dashboard on 2026-08-29 because the local CLI does not yet have an account
access token. Before the first future `supabase db push`, link the same project
and mark versions `20260829010000` and `20260829011000` as applied with the CLI
migration-repair command so these non-idempotent migrations are not replayed.
