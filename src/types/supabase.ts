export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string;
          avatar_url: string | null;
          timezone: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name: string;
          avatar_url?: string | null;
          timezone?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string;
          avatar_url?: string | null;
          timezone?: string;
          updated_at?: string;
        };
      };
      spaces: {
        Row: {
          id: string;
          name: string | null;
          type: string;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name?: string | null;
          type: string;
          created_by: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string | null;
          type?: string;
          created_by?: string;
          created_at?: string;
        };
      };
      space_members: {
        Row: {
          id: string;
          space_id: string;
          user_id: string;
          joined_at: string;
        };
        Insert: {
          id?: string;
          space_id: string;
          user_id: string;
          joined_at?: string;
        };
        Update: {
          id?: string;
          space_id?: string;
          user_id?: string;
          joined_at?: string;
        };
      };
      chat_messages: {
        Row: {
          id: string;
          space_id: string;
          sender_id: string;
          message_text: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          space_id: string;
          sender_id: string;
          message_text: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          space_id?: string;
          sender_id?: string;
          message_text?: string;
          created_at?: string;
        };
      };
      calendar_events: {
        Row: {
          id: string;
          space_id: string | null;
          title: string;
          description: string;
          start_time: string;
          end_time: string;
          is_all_day: boolean;
          metadata: Json;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          space_id?: string | null;
          title: string;
          description?: string;
          start_time: string;
          end_time: string;
          is_all_day?: boolean;
          metadata?: Json;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          space_id?: string | null;
          title?: string;
          description?: string;
          start_time?: string;
          end_time?: string;
          is_all_day?: boolean;
          metadata?: Json;
          created_by?: string | null;
          created_at?: string;
        };
      };
      calendar_event_attendees: {
        Row: {
          id: string;
          event_id: string;
          user_id: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          user_id: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          user_id?: string;
          status?: string;
          updated_at?: string;
        };
      };
      user_model_configs: {
        Row: {
          id: string;
          user_id: string;
          provider: string;
          model_id: string;
          display_name: string | null;
          vault_key_id: string | null;
          is_default: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          provider: string;
          model_id: string;
          display_name?: string | null;
          vault_key_id?: string | null;
          is_default?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          provider?: string;
          model_id?: string;
          display_name?: string | null;
          vault_key_id?: string | null;
          is_default?: boolean;
          created_at?: string;
        };
      };
      audit_log: {
        Row: {
          id: string;
          operation: string;
          table_name: string;
          record_id: string | null;
          user_id: string | null;
          old_data: Json | null;
          new_data: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          operation: string;
          table_name: string;
          record_id?: string | null;
          user_id?: string | null;
          old_data?: Json | null;
          new_data?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          operation?: string;
          table_name?: string;
          record_id?: string | null;
          user_id?: string | null;
          old_data?: Json | null;
          new_data?: Json | null;
          created_at?: string;
        };
      };
    };
    Functions: {
      store_model_key: {
        Args: {
          p_provider: string;
          p_model_id: string;
          p_display_name: string;
          p_api_key: string;
        };
        Returns: string;
      };
      get_decrypted_model_key: {
        Args: {
          p_config_id: string;
        };
        Returns: string;
      };
      delete_model_key: {
        Args: {
          p_config_id: string;
        };
        Returns: void;
      };
    };
  };
}
