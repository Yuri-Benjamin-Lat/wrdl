-- A friend alias is the viewer's private replacement display name everywhere.
-- Wrap the established ranking/history contracts so their core behavior stays
-- unchanged while only auth.uid()'s aliases are applied to returned names.

alter function public.get_streak_leaderboard(text) set schema private;
alter function private.get_streak_leaderboard(text) rename to get_streak_leaderboard_base;
revoke all on function private.get_streak_leaderboard_base(text) from public, anon, authenticated;

create function public.get_streak_leaderboard(leaderboard_scope text default 'global')
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  viewer_id uuid := auth.uid();
  payload jsonb;
  aliased_items jsonb;
begin
  if viewer_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  payload := private.get_streak_leaderboard_base(leaderboard_scope);

  select coalesce(jsonb_agg(
    entry.item || jsonb_build_object(
      'displayName', coalesce(friend_alias.alias, entry.item ->> 'displayName')
    ) order by entry.ordinality
  ), '[]'::jsonb)
  into aliased_items
  from jsonb_array_elements(payload -> 'items') with ordinality as entry(item, ordinality)
  left join public.friend_aliases as friend_alias
    on friend_alias.owner_id = viewer_id
    and friend_alias.friend_id = (entry.item ->> 'id')::uuid;

  return jsonb_set(payload, '{items}', aliased_items);
end;
$$;

alter function public.get_player_battle_history(text) set schema private;
alter function private.get_player_battle_history(text) rename to get_player_battle_history_base;
revoke all on function private.get_player_battle_history_base(text)
  from public, anon, authenticated;

create function public.get_player_battle_history(target_username text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  viewer_id uuid := auth.uid();
  payload jsonb;
  aliased_standings jsonb;
  match_index integer;
begin
  if viewer_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  payload := private.get_player_battle_history_base(target_username);
  if payload is null or jsonb_array_length(payload -> 'matches') = 0 then
    return payload;
  end if;

  for match_index in 0..jsonb_array_length(payload -> 'matches') - 1 loop
    select coalesce(jsonb_agg(
      entry.standing || jsonb_build_object(
        'displayName', coalesce(friend_alias.alias, entry.standing ->> 'displayName')
      ) order by entry.ordinality
    ), '[]'::jsonb)
    into aliased_standings
    from jsonb_array_elements(
      payload #> array['matches', match_index::text, 'standings']
    ) with ordinality as entry(standing, ordinality)
    left join public.friend_aliases as friend_alias
      on friend_alias.owner_id = viewer_id
      and friend_alias.friend_id = (entry.standing ->> 'playerId')::uuid;

    payload := jsonb_set(
      payload,
      array['matches', match_index::text, 'standings'],
      aliased_standings
    );
  end loop;

  return payload;
end;
$$;

revoke all on function public.get_streak_leaderboard(text) from public;
revoke all on function public.get_player_battle_history(text) from public;
grant execute on function public.get_streak_leaderboard(text) to authenticated;
grant execute on function public.get_player_battle_history(text) to authenticated;
