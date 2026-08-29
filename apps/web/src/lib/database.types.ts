export type WrdlTheme = "system" | "light" | "dark";
export type WrdlAudience = "public" | "friends" | "none";

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
  created_at: string;
  updated_at: string;
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
    };
    Enums: {
      wrdl_theme: WrdlTheme;
      wrdl_audience: WrdlAudience;
    };
    CompositeTypes: Record<never, never>;
  };
};
