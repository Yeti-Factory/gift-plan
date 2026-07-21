export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      app_admins: {
        Row: {
          created_at: string;
          role: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          role?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          role?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      app_settings: {
        Row: {
          id: boolean;
          maintenance_message: string;
          maintenance_mode: boolean;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          id?: boolean;
          maintenance_message?: string;
          maintenance_mode?: boolean;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          id?: boolean;
          maintenance_message?: string;
          maintenance_mode?: boolean;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      circle_activity: {
        Row: {
          action: string;
          actor_id: string | null;
          actor_name: string | null;
          circle_id: string;
          created_at: string;
          id: string;
          target_id: string | null;
          target_name: string | null;
        };
        Insert: {
          action: string;
          actor_id?: string | null;
          actor_name?: string | null;
          circle_id: string;
          created_at?: string;
          id?: string;
          target_id?: string | null;
          target_name?: string | null;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          actor_name?: string | null;
          circle_id?: string;
          created_at?: string;
          id?: string;
          target_id?: string | null;
          target_name?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "circle_activity_circle_id_fkey";
            columns: ["circle_id"];
            isOneToOne: false;
            referencedRelation: "circles";
            referencedColumns: ["id"];
          },
        ];
      };
      circle_bans: {
        Row: {
          banned_at: string;
          banned_by: string | null;
          circle_id: string;
          user_id: string;
        };
        Insert: {
          banned_at?: string;
          banned_by?: string | null;
          circle_id: string;
          user_id: string;
        };
        Update: {
          banned_at?: string;
          banned_by?: string | null;
          circle_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "circle_bans_circle_id_fkey";
            columns: ["circle_id"];
            isOneToOne: false;
            referencedRelation: "circles";
            referencedColumns: ["id"];
          },
        ];
      };
      circle_members: {
        Row: {
          circle_id: string;
          joined_at: string;
          role: Database["public"]["Enums"]["circle_role"];
          user_id: string;
        };
        Insert: {
          circle_id: string;
          joined_at?: string;
          role?: Database["public"]["Enums"]["circle_role"];
          user_id: string;
        };
        Update: {
          circle_id?: string;
          joined_at?: string;
          role?: Database["public"]["Enums"]["circle_role"];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "circle_members_circle_id_fkey";
            columns: ["circle_id"];
            isOneToOne: false;
            referencedRelation: "circles";
            referencedColumns: ["id"];
          },
        ];
      };
      circles: {
        Row: {
          created_at: string;
          created_by: string;
          id: string;
          invite_code: string;
          invite_code_created_at: string;
          invite_code_expires_at: string;
          invite_code_revoked_at: string | null;
          name: string;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          id?: string;
          invite_code: string;
          invite_code_created_at?: string;
          invite_code_expires_at?: string;
          invite_code_revoked_at?: string | null;
          name: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          id?: string;
          invite_code?: string;
          invite_code_created_at?: string;
          invite_code_expires_at?: string;
          invite_code_revoked_at?: string | null;
          name?: string;
        };
        Relationships: [];
      };
      gifts: {
        Row: {
          category: Database["public"]["Enums"]["gift_category"];
          created_at: string;
          currency: string;
          description: string | null;
          id: string;
          image_path: string | null;
          image_url: string | null;
          list_id: string;
          owner_id: string;
          price: number | null;
          priority: Database["public"]["Enums"]["gift_priority"];
          title: string;
          url: string | null;
        };
        Insert: {
          category?: Database["public"]["Enums"]["gift_category"];
          created_at?: string;
          currency?: string;
          description?: string | null;
          id?: string;
          image_path?: string | null;
          image_url?: string | null;
          list_id: string;
          owner_id: string;
          price?: number | null;
          priority?: Database["public"]["Enums"]["gift_priority"];
          title: string;
          url?: string | null;
        };
        Update: {
          category?: Database["public"]["Enums"]["gift_category"];
          created_at?: string;
          currency?: string;
          description?: string | null;
          id?: string;
          image_path?: string | null;
          image_url?: string | null;
          list_id?: string;
          owner_id?: string;
          price?: number | null;
          priority?: Database["public"]["Enums"]["gift_priority"];
          title?: string;
          url?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "gifts_list_id_fkey";
            columns: ["list_id"];
            isOneToOne: false;
            referencedRelation: "lists";
            referencedColumns: ["id"];
          },
        ];
      };
      join_attempts: {
        Row: {
          attempted_at: string;
          user_id: string;
        };
        Insert: {
          attempted_at?: string;
          user_id: string;
        };
        Update: {
          attempted_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      list_circle_access: {
        Row: {
          circle_id: string;
          created_at: string;
          list_id: string;
        };
        Insert: {
          circle_id: string;
          created_at?: string;
          list_id: string;
        };
        Update: {
          circle_id?: string;
          created_at?: string;
          list_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "list_circle_access_circle_id_fkey";
            columns: ["circle_id"];
            isOneToOne: false;
            referencedRelation: "circles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "list_circle_access_list_id_fkey";
            columns: ["list_id"];
            isOneToOne: false;
            referencedRelation: "lists";
            referencedColumns: ["id"];
          },
        ];
      };
      lists: {
        Row: {
          circle_id: string | null;
          created_at: string;
          event_date: string | null;
          id: string;
          occasion: string | null;
          owner_id: string;
          title: string;
          visibility: Database["public"]["Enums"]["list_visibility"];
        };
        Insert: {
          circle_id?: string | null;
          created_at?: string;
          event_date?: string | null;
          id?: string;
          occasion?: string | null;
          owner_id: string;
          title: string;
          visibility?: Database["public"]["Enums"]["list_visibility"];
        };
        Update: {
          circle_id?: string | null;
          created_at?: string;
          event_date?: string | null;
          id?: string;
          occasion?: string | null;
          owner_id?: string;
          title?: string;
          visibility?: Database["public"]["Enums"]["list_visibility"];
        };
        Relationships: [
          {
            foreignKeyName: "lists_circle_id_fkey";
            columns: ["circle_id"];
            isOneToOne: false;
            referencedRelation: "circles";
            referencedColumns: ["id"];
          },
        ];
      };
      profile_share_link_lists: {
        Row: {
          list_id: string;
          share_link_id: string;
        };
        Insert: {
          list_id: string;
          share_link_id: string;
        };
        Update: {
          list_id?: string;
          share_link_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profile_share_link_lists_list_id_fkey";
            columns: ["list_id"];
            isOneToOne: false;
            referencedRelation: "lists";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "profile_share_link_lists_share_link_id_fkey";
            columns: ["share_link_id"];
            isOneToOne: false;
            referencedRelation: "profile_share_links";
            referencedColumns: ["id"];
          },
        ];
      };
      profile_access_requests: {
        Row: {
          created_at: string;
          id: string;
          owner_id: string;
          requester_id: string;
          responded_at: string | null;
          status: Database["public"]["Enums"]["profile_access_status"];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          owner_id: string;
          requester_id: string;
          responded_at?: string | null;
          status?: Database["public"]["Enums"]["profile_access_status"];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          owner_id?: string;
          requester_id?: string;
          responded_at?: string | null;
          status?: Database["public"]["Enums"]["profile_access_status"];
          updated_at?: string;
        };
        Relationships: [];
      };
      profile_share_links: {
        Row: {
          created_at: string;
          expires_at: string | null;
          id: string;
          label: string | null;
          owner_id: string;
          revoked_at: string | null;
          token: string;
        };
        Insert: {
          created_at?: string;
          expires_at?: string | null;
          id?: string;
          label?: string | null;
          owner_id: string;
          revoked_at?: string | null;
          token?: string;
        };
        Update: {
          created_at?: string;
          expires_at?: string | null;
          id?: string;
          label?: string | null;
          owner_id?: string;
          revoked_at?: string | null;
          token?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          avatar_path: string | null;
          avatar_url: string | null;
          bio: string | null;
          created_at: string;
          display_name: string | null;
          email_searchable: boolean;
          id: string;
          onboarding_completed_at: string | null;
          onboarding_version: number;
          username: string;
          visibility: Database["public"]["Enums"]["profile_visibility"];
        };
        Insert: {
          avatar_path?: string | null;
          avatar_url?: string | null;
          bio?: string | null;
          created_at?: string;
          display_name?: string | null;
          email_searchable?: boolean;
          id: string;
          onboarding_completed_at?: string | null;
          onboarding_version?: number;
          username: string;
          visibility?: Database["public"]["Enums"]["profile_visibility"];
        };
        Update: {
          avatar_path?: string | null;
          avatar_url?: string | null;
          bio?: string | null;
          created_at?: string;
          display_name?: string | null;
          email_searchable?: boolean;
          id?: string;
          onboarding_completed_at?: string | null;
          onboarding_version?: number;
          username?: string;
          visibility?: Database["public"]["Enums"]["profile_visibility"];
        };
        Relationships: [];
      };
      reservations: {
        Row: {
          buyer_id: string;
          created_at: string;
          gift_id: string;
          id: string;
          status: Database["public"]["Enums"]["reservation_status"];
        };
        Insert: {
          buyer_id: string;
          created_at?: string;
          gift_id: string;
          id?: string;
          status?: Database["public"]["Enums"]["reservation_status"];
        };
        Update: {
          buyer_id?: string;
          created_at?: string;
          gift_id?: string;
          id?: string;
          status?: Database["public"]["Enums"]["reservation_status"];
        };
        Relationships: [
          {
            foreignKeyName: "reservations_gift_id_fkey";
            columns: ["gift_id"];
            isOneToOne: true;
            referencedRelation: "gifts";
            referencedColumns: ["id"];
          },
        ];
      };
      storage_deletions_queue: {
        Row: {
          attempt_count: number;
          bucket: string;
          enqueued_at: string;
          id: string;
          last_error: string | null;
          next_attempt_at: string;
          object_path: string;
          processed_at: string | null;
          reason: string | null;
        };
        Insert: {
          attempt_count?: number;
          bucket: string;
          enqueued_at?: string;
          id?: string;
          last_error?: string | null;
          next_attempt_at?: string;
          object_path: string;
          processed_at?: string | null;
          reason?: string | null;
        };
        Update: {
          attempt_count?: number;
          bucket?: string;
          enqueued_at?: string;
          id?: string;
          last_error?: string | null;
          next_attempt_at?: string;
          object_path?: string;
          processed_at?: string | null;
          reason?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      _display_name: { Args: { _user_id: string }; Returns: string };
      create_circle: {
        Args: { _name: string };
        Returns: {
          created_at: string;
          created_by: string;
          id: string;
          invite_code: string;
          invite_code_created_at: string;
          invite_code_expires_at: string;
          invite_code_revoked_at: string | null;
          name: string;
        };
        SetofOptions: {
          from: "*";
          to: "circles";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      create_profile_share_link: {
        Args: { _expires_at?: string; _label?: string; _list_ids: string[] };
        Returns: Json;
      };
      cancel_profile_access: { Args: { _profile_id: string }; Returns: boolean };
      gen_invite_code: { Args: never; Returns: string };
      get_app_status: { Args: never; Returns: Json };
      get_invite_code: { Args: { _circle_id: string }; Returns: string };
      get_pending_profile_access_count: { Args: never; Returns: number };
      get_profile_page: {
        Args: { _share_token?: string; _username: string };
        Returns: Json;
      };
      get_public_list_page: {
        Args: { _list_id: string; _share_token?: string };
        Returns: Json;
      };
      gift_circle_id: { Args: { _gift_id: string }; Returns: string };
      gift_owner_id: { Args: { _gift_id: string }; Returns: string };
      is_circle_admin: {
        Args: { _circle_id: string; _user_id: string };
        Returns: boolean;
      };
      is_circle_member: {
        Args: { _circle_id: string; _user_id: string };
        Returns: boolean;
      };
      is_superadmin: { Args: never; Returns: boolean };
      join_circle: {
        Args: { _code: string };
        Returns: {
          created_at: string;
          created_by: string;
          id: string;
          invite_code: string;
          invite_code_created_at: string;
          invite_code_expires_at: string;
          invite_code_revoked_at: string | null;
          name: string;
        };
        SetofOptions: {
          from: "*";
          to: "circles";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      join_circle_by_code: { Args: { _code: string }; Returns: string };
      join_circle_v2: { Args: { _code: string }; Returns: Json };
      leave_circle: { Args: { _circle_id: string }; Returns: Json };
      list_is_visible: {
        Args: { _list_id: string; _token?: string; _viewer_id?: string };
        Returns: boolean;
      };
      list_profile_access_inbox: { Args: never; Returns: Json };
      list_profile_directory: {
        Args: { _limit?: number; _offset?: number; _query?: string };
        Returns: Json;
      };
      list_profile_share_links: { Args: never; Returns: Json };
      profile_is_visible: {
        Args: { _owner_id: string; _token?: string; _viewer_id?: string };
        Returns: boolean;
      };
      profile_share_is_valid: {
        Args: { _list_id?: string; _owner_id: string; _token: string };
        Returns: boolean;
      };
      regenerate_invite_code: { Args: { _circle_id: string }; Returns: string };
      remove_member: {
        Args: { _circle_id: string; _user_id: string };
        Returns: undefined;
      };
      revoke_profile_share_link: {
        Args: { _share_id: string };
        Returns: undefined;
      };
      request_profile_access: { Args: { _profile_id: string }; Returns: Json };
      respond_profile_access: {
        Args: { _accept: boolean; _request_id: string };
        Returns: Json;
      };
      revoke_profile_access: { Args: { _requester_id: string }; Returns: boolean };
      search_public_profiles: { Args: { _query: string }; Returns: Json };
      set_gift_reservation: {
        Args: { _action: string; _gift_id: string; _share_token?: string };
        Returns: Json;
      };
      set_maintenance_mode: {
        Args: { _enabled: boolean; _message?: string };
        Returns: Json;
      };
      set_member_role: {
        Args: { _circle_id: string; _role: string; _user_id: string };
        Returns: undefined;
      };
      shares_circle_with: { Args: { _other: string }; Returns: boolean };
      update_list_access: {
        Args: {
          _circle_ids?: string[];
          _list_id: string;
          _visibility: Database["public"]["Enums"]["list_visibility"];
        };
        Returns: undefined;
      };
    };
    Enums: {
      circle_role: "admin" | "member";
      gift_category:
        | "culture"
        | "tech_geek"
        | "informatique"
        | "beaute_bien_etre"
        | "mode"
        | "sport"
        | "maison_deco"
        | "jeux_loisirs"
        | "gastronomie"
        | "voyages_experiences"
        | "enfants"
        | "autre";
      gift_priority: "indispensable" | "j_adorerais" | "me_plairait";
      list_visibility: "public" | "circles";
      profile_access_status: "pending" | "accepted" | "declined";
      profile_visibility: "public" | "private";
      reservation_status: "reserved" | "purchased";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      circle_role: ["admin", "member"],
      gift_category: [
        "culture",
        "tech_geek",
        "informatique",
        "beaute_bien_etre",
        "mode",
        "sport",
        "maison_deco",
        "jeux_loisirs",
        "gastronomie",
        "voyages_experiences",
        "enfants",
        "autre",
      ],
      gift_priority: ["indispensable", "j_adorerais", "me_plairait"],
      list_visibility: ["public", "circles"],
      profile_access_status: ["pending", "accepted", "declined"],
      profile_visibility: ["public", "private"],
      reservation_status: ["reserved", "purchased"],
    },
  },
} as const;
