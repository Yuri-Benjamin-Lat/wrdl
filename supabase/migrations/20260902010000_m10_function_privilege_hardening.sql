-- Supabase grants function execution to browser roles through database-level
-- defaults. Establish WRDL's explicit least-privilege RPC surface instead of
-- relying on a revoke from PUBLIC alone.

revoke execute on all functions in schema public from public, anon, authenticated;
revoke execute on all functions in schema private from public, anon, authenticated;

alter default privileges in schema public
  revoke execute on functions from public, anon, authenticated;
alter default privileges in schema private
  revoke execute on functions from public, anon, authenticated;

grant execute on function public.advance_my_battle() to authenticated;
grant execute on function public.cancel_friend_request(uuid) to authenticated;
grant execute on function public.change_my_username(text) to authenticated;
grant execute on function public.claim_my_battle_connection(uuid) to authenticated;
grant execute on function public.complete_my_profile(text) to authenticated;
grant execute on function public.continue_from_battle() to authenticated;
grant execute on function public.create_party(integer, integer) to authenticated;
grant execute on function public.delete_my_account() to authenticated;
grant execute on function public.disconnect_my_battle(uuid) to authenticated;
grant execute on function public.disconnect_my_battle_for_sign_out() to authenticated;
grant execute on function public.get_my_battle() to authenticated;
grant execute on function public.get_my_daily_history() to authenticated;
grant execute on function public.get_my_daily_snapshot() to authenticated;
grant execute on function public.get_my_friends(text, text, integer, integer) to authenticated;
grant execute on function public.get_my_incoming_friend_requests() to authenticated;
grant execute on function public.get_my_party() to authenticated;
grant execute on function public.get_my_party_invitations() to authenticated;
grant execute on function public.get_my_pending_friend_request_count() to authenticated;
grant execute on function public.get_my_profile() to authenticated;
grant execute on function public.get_party_invite_candidates(text) to authenticated;
grant execute on function public.get_player_battle_history(text) to authenticated;
grant execute on function public.get_player_daily_history(text) to authenticated;
grant execute on function public.get_player_profile(text) to authenticated;
grant execute on function public.get_streak_leaderboard(text) to authenticated;
grant execute on function public.get_visible_profile(text) to authenticated;
grant execute on function public.heartbeat_my_battle(uuid) to authenticated;
grant execute on function public.leave_party() to authenticated;
grant execute on function public.mute_party_inviter(uuid) to authenticated;
grant execute on function public.open_my_battle_connection(uuid) to authenticated;
grant execute on function public.recover_my_party_start() to authenticated;
grant execute on function public.remove_friend(uuid) to authenticated;
grant execute on function public.remove_party_member(uuid) to authenticated;
grant execute on function public.respond_to_friend_request(uuid, boolean) to authenticated;
grant execute on function public.respond_to_party_invitation(uuid, boolean) to authenticated;
grant execute on function public.search_players(text, integer) to authenticated;
grant execute on function public.send_friend_request(text) to authenticated;
grant execute on function public.send_party_invitation(text) to authenticated;
grant execute on function public.set_battle_invite_block(uuid, boolean) to authenticated;
grant execute on function public.set_friend_alias(uuid, text) to authenticated;
grant execute on function public.set_my_avatar(text) to authenticated;
grant execute on function public.set_party_ready(boolean) to authenticated;
grant execute on function public.submit_my_battle_guess(uuid, uuid, text) to authenticated;
grant execute on function public.submit_my_daily_guess(uuid, text) to authenticated;
grant execute on function public.touch_my_activity() to authenticated;
grant execute on function public.transfer_party_host(uuid) to authenticated;
grant execute on function public.update_my_profile(text, text) to authenticated;
grant execute on function public.update_party_settings(integer, integer) to authenticated;
grant execute on function public.username_is_available(text) to authenticated;

grant execute on function public.schedule_daily_puzzle(date, bigint, text) to service_role;
grant execute on function public.void_daily_puzzle(date, text) to service_role;
