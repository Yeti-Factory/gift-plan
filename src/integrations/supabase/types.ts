export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
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
      lists: {
        Row: {
          circle_id: string;
          created_at: string;
          event_date: string | null;
          id: string;
          occasion: string | null;
          owner_id: string;
          title: string;
        };
        Insert: {
          circle_id: string;
          created_at?: string;
          event_date?: string | null;
          id?: string;
          occasion?: string | null;
          owner_id: string;
          title: string;
        };
        Update: {
          circle_id?: string;
          created_at?: string;
          event_date?: string | null;
          id?: string;
          occasion?: string | null;
          owner_id?: string;
          title?: string;
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
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          display_name: string | null;
          id: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          display_name?: string | null;
          id: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          display_name?: string | null;
          id?: string;
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
          bucket: string;
          enqueued_at: string;
          id: string;
          object_path: string;
          processed_at: string | null;
          reason: string | null;
        };
        Insert: {
          bucket: string;
          enqueued_at?: string;
          id?: string;
          object_path: string;
          processed_at?: string | null;
          reason?: string | null;
        };
        Update: {
          bucket?: string;
          enqueued_at?: string;
          id?: string;
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
      gen_invite_code: { Args: never; Returns: string };
      get_invite_code: { Args: { _circle_id: string }; Returns: string };
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
      leave_circle: { Args: { _circle_id: string }; Returns: Json };
      regenerate_invite_code: { Args: { _circle_id: string }; Returns: string };
      remove_member: {
        Args: { _circle_id: string; _user_id: string };
        Returns: undefined;
      };
      set_member_role: {
        Args: { _circle_id: string; _role: string; _user_id: string };
        Returns: undefined;
      };
      shares_circle_with: { Args: { _other: string }; Returns: boolean };
    };
    Enums: {
      circle_role: "admin" | "member";
      gift_priority: "indispensable" | "j_adorerais" | "me_plairait";
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
      gift_priority: ["indispensable", "j_adorerais", "me_plairait"],
      reservation_status: ["reserved", "purchased"],
    },
  },
} as const;
