-- M3: account-synced Free Play word-pool preferences. Round answers, guesses,
-- results, and history remain browser-memory-only and are never stored here.

alter table public.user_settings
  add column free_play_uncommon_enabled boolean not null default false,
  add column free_play_rare_enabled boolean not null default false;

grant update (
  free_play_uncommon_enabled,
  free_play_rare_enabled
) on public.user_settings to authenticated;
