# Database tests

Hosted development/staging database and Row Level Security tests will live
here. Fixtures must be synthetic, deterministic, and contain no protected word
schedule or real user data.

`001_m2_auth_profiles_settings.sql` verifies the hosted M2 tables, private avatar
bucket, RLS activation, and critical grants after the migration is applied.
