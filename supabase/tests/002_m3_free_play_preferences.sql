do $$
begin
  assert not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'user_settings'
      and column_name = 'free_play_uncommon_enabled'
  ), 'legacy Uncommon preference still exists';

  assert exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'user_settings'
      and column_name = 'free_play_rare_enabled'
      and is_nullable = 'NO'
      and column_default = 'false'
  ), 'free_play_rare_enabled is missing or has the wrong default';

  assert has_column_privilege(
    'authenticated',
    'public.user_settings',
    'free_play_rare_enabled',
    'UPDATE'
  ), 'authenticated users cannot update their Rare preference';
end
$$;
