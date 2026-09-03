do $$
begin
  assert exists (
    select 1 from information_schema.schemata where schema_name = 'private'
  ), 'private schema is missing';

  assert not has_schema_privilege('authenticated', 'private', 'USAGE'),
    'authenticated users can access the protected schema';

  assert exists (
    select 1
    from information_schema.tables
    where table_schema = 'private' and table_name = 'daily_words'
  ), 'protected Daily word table is missing';

  assert exists (
    select 1
    from information_schema.tables
    where table_schema = 'private' and table_name = 'daily_puzzles'
  ), 'protected Daily puzzle table is missing';

  assert not has_table_privilege('authenticated', 'private.daily_words', 'SELECT'),
    'authenticated users can read the protected word catalog';

  assert not has_table_privilege('authenticated', 'private.daily_puzzles', 'SELECT'),
    'authenticated users can read protected puzzle answers';

  assert not has_table_privilege('authenticated', 'public.daily_attempts', 'SELECT'),
    'authenticated users can bypass the Daily snapshot function';

  assert not has_table_privilege('authenticated', 'public.daily_guesses', 'SELECT'),
    'authenticated users can bypass protected Daily guess reads';

  assert not has_table_privilege('authenticated', 'public.daily_statistics', 'SELECT'),
    'authenticated users can directly inspect Daily aggregates';

  assert (
    select relrowsecurity
    from pg_class
    where oid = 'public.daily_attempts'::regclass
  ), 'daily_attempts RLS is disabled';

  assert (
    select relrowsecurity
    from pg_class
    where oid = 'public.daily_guesses'::regclass
  ), 'daily_guesses RLS is disabled';

  assert (
    select relrowsecurity
    from pg_class
    where oid = 'public.daily_statistics'::regclass
  ), 'daily_statistics RLS is disabled';

  assert has_function_privilege(
    'authenticated',
    'public.get_my_daily_snapshot()',
    'EXECUTE'
  ), 'authenticated players cannot load their answer-free Daily snapshot';

  assert has_function_privilege(
    'authenticated',
    'public.submit_my_daily_guess(uuid,text)',
    'EXECUTE'
  ), 'authenticated players cannot submit a Daily guess';

  assert has_function_privilege(
    'authenticated',
    'public.get_my_daily_history()',
    'EXECUTE'
  ), 'authenticated players cannot load their answer-free Daily history';

  assert exists (
    select 1
    from pg_enum as enum_value
    join pg_type as enum_type on enum_type.oid = enum_value.enumtypid
    where enum_type.typname = 'daily_attempt_status'
      and enum_value.enumlabel = 'missed'
  ), 'Daily Missed outcome is missing';

  assert exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'daily_statistics'
      and column_name = 'missed'
  ), 'Daily missed lifetime total is missing';

  assert exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'daily_statistics'
      and column_name = 'highest_streak'
  ), 'Daily highest streak lifetime total is missing';

  assert not has_function_privilege(
    'authenticated',
    'private.evaluate_daily_guess(text,text)',
    'EXECUTE'
  ), 'authenticated users can call the protected answer evaluator';

  assert not has_function_privilege(
    'authenticated',
    'public.schedule_daily_puzzle(date,bigint,text)',
    'EXECUTE'
  ), 'authenticated users can schedule Daily puzzles';

  assert not has_function_privilege(
    'authenticated',
    'public.void_daily_puzzle(date,text)',
    'EXECUTE'
  ), 'authenticated users can void Daily puzzles';
end
$$;
