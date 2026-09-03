-- M3 correction: Free Play now mirrors Wordle's two-list architecture.
-- Common is always enabled; Rare is the only optional account preference.

alter table public.user_settings
  drop column if exists free_play_uncommon_enabled;
