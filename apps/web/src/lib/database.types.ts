export type WrdlTheme = "system" | "light" | "dark";
export type WrdlAudience = "public" | "friends" | "none";
export type DailyPuzzleStatus = "scheduled" | "published" | "voided";
export type DailyAttemptStatus = "in_progress" | "win" | "failed" | "missed" | "voided";
export type SocialRelationship = "self" | "none" | "outgoing" | "incoming" | "friends";
export type PartyPhase = "lobby" | "match_starting" | "active" | "battle_complete";
export type BattlePhase =
  | "round_starting"
  | "round_active"
  | "round_resolving"
  | "between_rounds"
  | "battle_complete"
  | "voided";
export type BattleRoundStatus = "active" | "solved" | "failed";
export type BattleCompletionReason = "score" | "forfeit" | "voided";
export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export type ProfileRow = {
  id: string;
  username: string | null;
  username_key: string | null;
  display_name: string | null;
  bio: string | null;
  avatar_path: string | null;
  level: number;
  experience: number;
  current_streak: number;
  daily_eligibility_date: string;
  username_changed_at: string | null;
  last_online_at: string | null;
  created_at: string;
  updated_at: string;
};

export type UserSettingsRow = {
  user_id: string;
  sound_enabled: boolean;
  theme: WrdlTheme;
  high_contrast_tiles: boolean;
  daily_history_audience: WrdlAudience;
  statistics_audience: WrdlAudience;
  battle_history_audience: WrdlAudience;
  activity_visible: boolean;
  free_play_rare_enabled: boolean;
  preferred_battle_rounds: number;
  preferred_battle_timer_seconds: number;
  created_at: string;
  updated_at: string;
};

export type DailyAttemptRow = {
  id: string;
  user_id: string;
  puzzle_date: string;
  status: DailyAttemptStatus;
  accepted_guess_count: number;
  reward_experience: number;
  streak_after: number | null;
  level_after: number | null;
  experience_after: number | null;
  started_at: string | null;
  completed_at: string | null;
  updated_at: string;
};

export type DailyGuessRow = {
  attempt_id: string;
  guess_number: number;
  command_id: string;
  guess: string;
  pattern: string;
  accepted_at: string;
};

export type DailyStatisticsRow = {
  user_id: string;
  wins: number;
  missed: number;
  failed: number;
  highest_streak: number;
  last_resolved_date: string | null;
  last_win_date: string | null;
  created_at: string;
  updated_at: string;
};

export type FriendRequestRow = {
  id: string;
  requester_id: string;
  recipient_id: string;
  created_at: string;
};

export type FriendshipRow = {
  user_one_id: string;
  user_two_id: string;
  created_at: string;
};

export type FriendAliasRow = {
  owner_id: string;
  friend_id: string;
  alias: string;
  created_at: string;
  updated_at: string;
};

export type BattleInviteBlockRow = {
  blocker_id: string;
  blocked_user_id: string;
  created_at: string;
};

export type FriendlyBattleStatisticsRow = {
  user_id: string;
  two_player_wins: number;
  two_player_losses: number;
  three_player_wins: number;
  three_player_losses: number;
  four_plus_wins: number;
  four_plus_losses: number;
  created_at: string;
  updated_at: string;
};

export type BattleHistorySummaryRow = {
  id: string;
  source_battle_id: string | null;
  completed_at: string;
  rounds_configured: number;
  round_timer_seconds: number;
  player_count: number;
  completion_reason: BattleCompletionReason;
  created_at: string;
};

export type BattleHistoryStandingRow = {
  match_id: string;
  join_order: number;
  player_id: string | null;
  final_rank: number;
  total_points: number;
};

export type PartyRow = {
  id: string;
  host_id: string | null;
  phase: PartyPhase;
  rounds_configured: number;
  round_timer_seconds: number;
  state_version: number;
  next_join_order: number;
  start_deadline: string | null;
  active_battle_id: string | null;
  created_at: string;
  updated_at: string;
};

export type PartyMemberRow = {
  party_id: string;
  user_id: string;
  join_order: number;
  is_ready: boolean;
  returned_to_lobby: boolean;
  joined_at: string;
  last_seen_at: string;
};

export type PartyInvitationRow = {
  id: string;
  party_id: string;
  inviter_id: string;
  recipient_id: string;
  created_at: string;
};

export type BattleRow = {
  id: string;
  party_id: string;
  phase: BattlePhase;
  state_version: number;
  player_count: number;
  rounds_configured: number;
  round_timer_seconds: number;
  target_points: number;
  current_round: number;
  is_sudden_death: boolean;
  sudden_death_round: number;
  next_sudden_death: boolean;
  phase_deadline: string | null;
  players_ready_at: string | null;
  round_started_at: string | null;
  round_deadline: string | null;
  preservation_deadline: string | null;
  winner_id: string | null;
  completion_reason: BattleCompletionReason | null;
  completed_at: string | null;
  history_committed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type BattleMemberRow = {
  battle_id: string;
  user_id: string;
  join_order: number;
  total_points: number;
  last_round_points: number;
  round_status: BattleRoundStatus;
  accepted_guess_count: number;
  completion_centiseconds: number | null;
  is_connected: boolean;
  connection_id: string | null;
  last_heartbeat_at: string;
  disconnected_at: string | null;
  reconnect_deadline: string | null;
  arrived_at: string | null;
  round_rank: number | null;
  became_host_at: string | null;
  continued_at: string | null;
  final_rank: number | null;
  created_at: string;
  updated_at: string;
};

export type BattleGuessRow = {
  battle_id: string;
  round_number: number;
  user_id: string;
  guess_number: number;
  command_id: string;
  guess: string;
  pattern: string;
  accepted_at: string;
  elapsed_centiseconds: number;
};

type Relationship<T> = {
  Row: T;
  Insert: Partial<T>;
  Update: Partial<T>;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      profiles: Relationship<ProfileRow>;
      user_settings: Relationship<UserSettingsRow>;
      daily_attempts: Relationship<DailyAttemptRow>;
      daily_guesses: Relationship<DailyGuessRow>;
      daily_statistics: Relationship<DailyStatisticsRow>;
      friend_requests: Relationship<FriendRequestRow>;
      friendships: Relationship<FriendshipRow>;
      friend_aliases: Relationship<FriendAliasRow>;
      battle_invite_blocks: Relationship<BattleInviteBlockRow>;
      friendly_battle_statistics: Relationship<FriendlyBattleStatisticsRow>;
      battle_history_summaries: Relationship<BattleHistorySummaryRow>;
      battle_history_standings: Relationship<BattleHistoryStandingRow>;
      parties: Relationship<PartyRow>;
      party_members: Relationship<PartyMemberRow>;
      party_invitations: Relationship<PartyInvitationRow>;
      battles: Relationship<BattleRow>;
      battle_members: Relationship<BattleMemberRow>;
      battle_guesses: Relationship<BattleGuessRow>;
    };
    Views: Record<never, never>;
    Functions: {
      username_is_available: {
        Args: { candidate: string };
        Returns: boolean;
      };
      complete_my_profile: {
        Args: { candidate: string };
        Returns: ProfileRow;
      };
      change_my_username: {
        Args: { candidate: string };
        Returns: ProfileRow;
      };
      update_my_profile: {
        Args: { new_display_name: string; new_bio: string };
        Returns: ProfileRow;
      };
      set_my_avatar: {
        Args: { new_avatar_path: string | null };
        Returns: ProfileRow;
      };
      delete_my_account: {
        Args: Record<never, never>;
        Returns: undefined;
      };
      get_my_profile: {
        Args: Record<never, never>;
        Returns: ProfileRow;
      };
      get_visible_profile: {
        Args: { target_username: string };
        Returns: Array<{
          id: string;
          username: string;
          display_name: string | null;
          bio: string | null;
          avatar_path: string | null;
          level: number;
          experience: number;
          current_streak: number;
          last_online_at: string | null;
        }>;
      };
      touch_my_activity: {
        Args: Record<never, never>;
        Returns: string;
      };
      search_players: {
        Args: { search_text: string; result_limit?: number };
        Returns: Json;
      };
      get_my_friends: {
        Args: {
          sort_order?: string;
          filter_text?: string;
          result_offset?: number;
          result_limit?: number;
        };
        Returns: Json;
      };
      get_my_incoming_friend_requests: {
        Args: Record<never, never>;
        Returns: Json;
      };
      get_my_pending_friend_request_count: {
        Args: Record<never, never>;
        Returns: number;
      };
      send_friend_request: {
        Args: { target_username: string };
        Returns: string;
      };
      cancel_friend_request: {
        Args: { target_user: string };
        Returns: undefined;
      };
      respond_to_friend_request: {
        Args: { request_id: string; accept_request: boolean };
        Returns: string;
      };
      remove_friend: {
        Args: { target_user: string };
        Returns: undefined;
      };
      set_friend_alias: {
        Args: { target_user: string; new_alias: string };
        Returns: string;
      };
      set_battle_invite_block: {
        Args: { target_user: string; blocked: boolean };
        Returns: boolean;
      };
      get_player_profile: {
        Args: { target_username: string };
        Returns: Json;
      };
      get_player_daily_history: {
        Args: { target_username: string };
        Returns: Json;
      };
      get_player_battle_history: {
        Args: { target_username: string };
        Returns: Json;
      };
      get_streak_leaderboard: {
        Args: { leaderboard_scope?: string };
        Returns: Json;
      };
      create_party: {
        Args: { requested_rounds?: number | null; requested_timer_seconds?: number | null };
        Returns: Json;
      };
      get_my_party: {
        Args: Record<never, never>;
        Returns: Json;
      };
      update_party_settings: {
        Args: { new_rounds: number; new_timer_seconds: number };
        Returns: Json;
      };
      set_party_ready: {
        Args: { new_ready: boolean };
        Returns: Json;
      };
      recover_my_party_start: {
        Args: Record<never, never>;
        Returns: Json;
      };
      transfer_party_host: {
        Args: { new_host_id: string };
        Returns: Json;
      };
      remove_party_member: {
        Args: { target_user_id: string };
        Returns: Json;
      };
      leave_party: {
        Args: Record<never, never>;
        Returns: undefined;
      };
      get_party_invite_candidates: {
        Args: { filter_text?: string };
        Returns: Json;
      };
      send_party_invitation: {
        Args: { target_username: string };
        Returns: Json;
      };
      get_my_party_invitations: {
        Args: Record<never, never>;
        Returns: Json;
      };
      respond_to_party_invitation: {
        Args: { invitation_id: string; accept_invitation: boolean };
        Returns: Json;
      };
      get_my_battle: {
        Args: Record<never, never>;
        Returns: Json;
      };
      claim_my_battle_connection: {
        Args: { new_connection_id: string };
        Returns: Json;
      };
      open_my_battle_connection: {
        Args: { new_connection_id: string };
        Returns: Json;
      };
      heartbeat_my_battle: {
        Args: { active_connection_id: string };
        Returns: Json;
      };
      disconnect_my_battle: {
        Args: { active_connection_id: string };
        Returns: undefined;
      };
      disconnect_my_battle_for_sign_out: { Args: never; Returns: undefined };
      advance_my_battle: {
        Args: Record<never, never>;
        Returns: Json;
      };
      submit_my_battle_guess: {
        Args: { command_id: string; active_connection_id: string; submitted_guess: string };
        Returns: Json;
      };
      continue_from_battle: {
        Args: Record<never, never>;
        Returns: Json;
      };
      mute_party_inviter: {
        Args: { inviter_user_id: string };
        Returns: string;
      };
      schedule_daily_puzzle: {
        Args: {
          scheduled_date: string;
          scheduled_number: number;
          scheduled_answer: string;
        };
        Returns: undefined;
      };
      void_daily_puzzle: {
        Args: { target_date: string; reason: string };
        Returns: undefined;
      };
      get_my_daily_snapshot: {
        Args: Record<never, never>;
        Returns: Json;
      };
      get_my_daily_history: {
        Args: Record<never, never>;
        Returns: Json;
      };
      submit_my_daily_guess: {
        Args: { command_id: string; submitted_guess: string };
        Returns: Json;
      };
    };
    Enums: {
      wrdl_theme: WrdlTheme;
      wrdl_audience: WrdlAudience;
      daily_puzzle_status: DailyPuzzleStatus;
      daily_attempt_status: DailyAttemptStatus;
      party_phase: PartyPhase;
      battle_phase: BattlePhase;
      battle_round_status: BattleRoundStatus;
      battle_completion_reason: BattleCompletionReason;
    };
    CompositeTypes: Record<never, never>;
  };
};
