export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ab_test_events: {
        Row: {
          ab_test_id: string
          created_at: string
          event_type: string
          id: string
          telegram_user_id: number
          variant: string
        }
        Insert: {
          ab_test_id: string
          created_at?: string
          event_type: string
          id?: string
          telegram_user_id: number
          variant: string
        }
        Update: {
          ab_test_id?: string
          created_at?: string
          event_type?: string
          id?: string
          telegram_user_id?: number
          variant?: string
        }
        Relationships: [
          {
            foreignKeyName: "ab_test_events_ab_test_id_fkey"
            columns: ["ab_test_id"]
            isOneToOne: false
            referencedRelation: "ab_tests"
            referencedColumns: ["id"]
          },
        ]
      }
      ab_tests: {
        Row: {
          bot_id: string
          created_at: string
          ended_at: string | null
          id: string
          is_active: boolean
          name: string
          started_at: string | null
          variant_a_bump_plan_id: string | null
          variant_a_media_type: string | null
          variant_a_media_url: string | null
          variant_a_message: string
          variant_a_plan_id: string | null
          variant_a_price_override: number | null
          variant_b_bump_plan_id: string | null
          variant_b_media_type: string | null
          variant_b_media_url: string | null
          variant_b_message: string
          variant_b_plan_id: string | null
          variant_b_price_override: number | null
          winner: string | null
        }
        Insert: {
          bot_id: string
          created_at?: string
          ended_at?: string | null
          id?: string
          is_active?: boolean
          name?: string
          started_at?: string | null
          variant_a_bump_plan_id?: string | null
          variant_a_media_type?: string | null
          variant_a_media_url?: string | null
          variant_a_message: string
          variant_a_plan_id?: string | null
          variant_a_price_override?: number | null
          variant_b_bump_plan_id?: string | null
          variant_b_media_type?: string | null
          variant_b_media_url?: string | null
          variant_b_message: string
          variant_b_plan_id?: string | null
          variant_b_price_override?: number | null
          winner?: string | null
        }
        Update: {
          bot_id?: string
          created_at?: string
          ended_at?: string | null
          id?: string
          is_active?: boolean
          name?: string
          started_at?: string | null
          variant_a_bump_plan_id?: string | null
          variant_a_media_type?: string | null
          variant_a_media_url?: string | null
          variant_a_message?: string
          variant_a_plan_id?: string | null
          variant_a_price_override?: number | null
          variant_b_bump_plan_id?: string | null
          variant_b_media_type?: string | null
          variant_b_media_url?: string | null
          variant_b_message?: string
          variant_b_plan_id?: string | null
          variant_b_price_override?: number | null
          winner?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ab_tests_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "bots"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_settings: {
        Row: {
          id: string
          key: string
          registry_bot_token: string | null
          registry_chat_id: string | null
          support_enabled: boolean
          support_links: Json
          updated_at: string
          value: string
        }
        Insert: {
          id?: string
          key: string
          registry_bot_token?: string | null
          registry_chat_id?: string | null
          support_enabled?: boolean
          support_links?: Json
          updated_at?: string
          value: string
        }
        Update: {
          id?: string
          key?: string
          registry_bot_token?: string | null
          registry_chat_id?: string | null
          support_enabled?: boolean
          support_links?: Json
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      balance_mirror: {
        Row: {
          available: number | null
          blocked: number | null
          last_update: string | null
          pending: number | null
          revant_user_id: string
          riot_user_id: string | null
          total: number | null
          updated_at: string
        }
        Insert: {
          available?: number | null
          blocked?: number | null
          last_update?: string | null
          pending?: number | null
          revant_user_id: string
          riot_user_id?: string | null
          total?: number | null
          updated_at?: string
        }
        Update: {
          available?: number | null
          blocked?: number | null
          last_update?: string | null
          pending?: number | null
          revant_user_id?: string
          riot_user_id?: string | null
          total?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      blacklisted_users: {
        Row: {
          bot_id: string
          created_at: string
          id: string
          reason: string | null
          telegram_first_name: string | null
          telegram_user_id: number
          telegram_username: string | null
        }
        Insert: {
          bot_id: string
          created_at?: string
          id?: string
          reason?: string | null
          telegram_first_name?: string | null
          telegram_user_id: number
          telegram_username?: string | null
        }
        Update: {
          bot_id?: string
          created_at?: string
          id?: string
          reason?: string | null
          telegram_first_name?: string | null
          telegram_user_id?: number
          telegram_username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "blacklisted_users_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "bots"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_users: {
        Row: {
          bot_id: string
          created_at: string
          cross_upsell_from_order_id: string | null
          customer_cpf: string | null
          customer_name: string | null
          has_clicked_button: boolean
          id: string
          last_interaction_at: string
          pending_payment_context: Json | null
          telegram_first_name: string | null
          telegram_user_id: number
          telegram_username: string | null
          tracked_link_id: string | null
        }
        Insert: {
          bot_id: string
          created_at?: string
          cross_upsell_from_order_id?: string | null
          customer_cpf?: string | null
          customer_name?: string | null
          has_clicked_button?: boolean
          id?: string
          last_interaction_at?: string
          pending_payment_context?: Json | null
          telegram_first_name?: string | null
          telegram_user_id: number
          telegram_username?: string | null
          tracked_link_id?: string | null
        }
        Update: {
          bot_id?: string
          created_at?: string
          cross_upsell_from_order_id?: string | null
          customer_cpf?: string | null
          customer_name?: string | null
          has_clicked_button?: boolean
          id?: string
          last_interaction_at?: string
          pending_payment_context?: Json | null
          telegram_first_name?: string | null
          telegram_user_id?: number
          telegram_username?: string | null
          tracked_link_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bot_users_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "bots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bot_users_cross_upsell_from_order_id_fkey"
            columns: ["cross_upsell_from_order_id"]
            isOneToOne: false
            referencedRelation: "payment_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bot_users_tracked_link_id_fkey"
            columns: ["tracked_link_id"]
            isOneToOne: false
            referencedRelation: "tracked_links"
            referencedColumns: ["id"]
          },
        ]
      }
      bots: {
        Row: {
          anti_clone: boolean | null
          auto_approve_channel_id: string | null
          auto_approve_enabled: boolean | null
          auto_approve_welcome_message: string | null
          created_at: string
          cross_bot_upsell_bot_id: string | null
          cross_bot_upsell_message: string | null
          health_status: string | null
          id: string
          initial_buttons: Json | null
          initial_media_file_id: string | null
          initial_media_file_key: string | null
          initial_media_type: string | null
          initial_media_url: string | null
          initial_message: string | null
          last_health_check: string | null
          linkter_api_key: string | null
          name: string
          notification_channel_id: string | null
          registro_id: string | null
          support_contact: string | null
          token: string
          updated_at: string
          user_id: string
          username: string
          vip_id: string | null
          vip_link: string | null
          welcome_card_enabled: boolean | null
          welcome_card_text: string | null
        }
        Insert: {
          anti_clone?: boolean | null
          auto_approve_channel_id?: string | null
          auto_approve_enabled?: boolean | null
          auto_approve_welcome_message?: string | null
          created_at?: string
          cross_bot_upsell_bot_id?: string | null
          cross_bot_upsell_message?: string | null
          health_status?: string | null
          id?: string
          initial_buttons?: Json | null
          initial_media_file_id?: string | null
          initial_media_file_key?: string | null
          initial_media_type?: string | null
          initial_media_url?: string | null
          initial_message?: string | null
          last_health_check?: string | null
          linkter_api_key?: string | null
          name: string
          notification_channel_id?: string | null
          registro_id?: string | null
          support_contact?: string | null
          token: string
          updated_at?: string
          user_id: string
          username: string
          vip_id?: string | null
          vip_link?: string | null
          welcome_card_enabled?: boolean | null
          welcome_card_text?: string | null
        }
        Update: {
          anti_clone?: boolean | null
          auto_approve_channel_id?: string | null
          auto_approve_enabled?: boolean | null
          auto_approve_welcome_message?: string | null
          created_at?: string
          cross_bot_upsell_bot_id?: string | null
          cross_bot_upsell_message?: string | null
          health_status?: string | null
          id?: string
          initial_buttons?: Json | null
          initial_media_file_id?: string | null
          initial_media_file_key?: string | null
          initial_media_type?: string | null
          initial_media_url?: string | null
          initial_message?: string | null
          last_health_check?: string | null
          linkter_api_key?: string | null
          name?: string
          notification_channel_id?: string | null
          registro_id?: string | null
          support_contact?: string | null
          token?: string
          updated_at?: string
          user_id?: string
          username?: string
          vip_id?: string | null
          vip_link?: string | null
          welcome_card_enabled?: boolean | null
          welcome_card_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bots_cross_bot_upsell_bot_id_fkey"
            columns: ["cross_bot_upsell_bot_id"]
            isOneToOne: false
            referencedRelation: "bots"
            referencedColumns: ["id"]
          },
        ]
      }
      broadcast_sent_messages: {
        Row: {
          bot_id: string
          broadcast_id: string
          chat_id: number
          created_at: string
          id: string
          message_id: number
        }
        Insert: {
          bot_id: string
          broadcast_id: string
          chat_id: number
          created_at?: string
          id?: string
          message_id: number
        }
        Update: {
          bot_id?: string
          broadcast_id?: string
          chat_id?: number
          created_at?: string
          id?: string
          message_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "broadcast_sent_messages_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "bots"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_messages: {
        Row: {
          bot_id: string
          buttons: Json | null
          channel_id: string
          channel_name: string | null
          created_at: string
          id: string
          is_active: boolean | null
          last_sent_at: string | null
          media_type: string | null
          media_url: string | null
          message: string
          next_send_at: string | null
          recurring_interval_minutes: number | null
          schedule_type: string
          scheduled_at: string | null
          sent_count: number | null
          status: string
          times: string[] | null
          updated_at: string
          weekdays: number[] | null
        }
        Insert: {
          bot_id: string
          buttons?: Json | null
          channel_id: string
          channel_name?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          last_sent_at?: string | null
          media_type?: string | null
          media_url?: string | null
          message: string
          next_send_at?: string | null
          recurring_interval_minutes?: number | null
          schedule_type?: string
          scheduled_at?: string | null
          sent_count?: number | null
          status?: string
          times?: string[] | null
          updated_at?: string
          weekdays?: number[] | null
        }
        Update: {
          bot_id?: string
          buttons?: Json | null
          channel_id?: string
          channel_name?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          last_sent_at?: string | null
          media_type?: string | null
          media_url?: string | null
          message?: string
          next_send_at?: string | null
          recurring_interval_minutes?: number | null
          schedule_type?: string
          scheduled_at?: string | null
          sent_count?: number | null
          status?: string
          times?: string[] | null
          updated_at?: string
          weekdays?: number[] | null
        }
        Relationships: [
          {
            foreignKeyName: "channel_messages_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "bots"
            referencedColumns: ["id"]
          },
        ]
      }
      contingency_group_bots: {
        Row: {
          bot_id: string
          created_at: string
          group_id: string
          id: string
          is_active: boolean
          priority: number
        }
        Insert: {
          bot_id: string
          created_at?: string
          group_id: string
          id?: string
          is_active?: boolean
          priority?: number
        }
        Update: {
          bot_id?: string
          created_at?: string
          group_id?: string
          id?: string
          is_active?: boolean
          priority?: number
        }
        Relationships: [
          {
            foreignKeyName: "contingency_group_bots_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "bots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contingency_group_bots_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "contingency_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      contingency_groups: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          link_slug: string
          name: string
          strategy: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          link_slug: string
          name: string
          strategy?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          link_slug?: string
          name?: string
          strategy?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      custom_link_clicks: {
        Row: {
          blocked: boolean
          country: string | null
          created_at: string
          destination: string | null
          id: string
          link_id: string
          referer: string | null
          user_agent: string | null
        }
        Insert: {
          blocked?: boolean
          country?: string | null
          created_at?: string
          destination?: string | null
          id?: string
          link_id: string
          referer?: string | null
          user_agent?: string | null
        }
        Update: {
          blocked?: boolean
          country?: string | null
          created_at?: string
          destination?: string | null
          id?: string
          link_id?: string
          referer?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "custom_link_clicks_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "custom_links"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_links: {
        Row: {
          clicks: number
          cloaker_mode: string
          created_at: string
          destinations: Json
          domain: string
          id: string
          is_active: boolean
          last_click_at: string | null
          name: string
          notes: string | null
          redirect_page: boolean
          redirect_page_text: string | null
          redirect_page_title: string | null
          slug: string
          slug_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          clicks?: number
          cloaker_mode?: string
          created_at?: string
          destinations?: Json
          domain?: string
          id?: string
          is_active?: boolean
          last_click_at?: string | null
          name: string
          notes?: string | null
          redirect_page?: boolean
          redirect_page_text?: string | null
          redirect_page_title?: string | null
          slug: string
          slug_type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          clicks?: number
          cloaker_mode?: string
          created_at?: string
          destinations?: Json
          domain?: string
          id?: string
          is_active?: boolean
          last_click_at?: string | null
          name?: string
          notes?: string | null
          redirect_page?: boolean
          redirect_page_text?: string | null
          redirect_page_title?: string | null
          slug?: string
          slug_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      demo_settings: {
        Row: {
          config: Json
          created_at: string
          id: string
          is_active: boolean
          last_synced_at: string | null
          revantpay_demo_key: string | null
          revantpay_demo_key_name: string | null
          updated_at: string
          user_id: string
          webhook_secret: string | null
        }
        Insert: {
          config?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          last_synced_at?: string | null
          revantpay_demo_key?: string | null
          revantpay_demo_key_name?: string | null
          updated_at?: string
          user_id: string
          webhook_secret?: string | null
        }
        Update: {
          config?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          last_synced_at?: string | null
          revantpay_demo_key?: string | null
          revantpay_demo_key_name?: string | null
          updated_at?: string
          user_id?: string
          webhook_secret?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "demo_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "admin_profile_flags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demo_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      downsell_messages: {
        Row: {
          bot_id: string
          created_at: string
          discount_percentage: number
          id: string
          is_active: boolean | null
          media_type: string | null
          media_url: string | null
          message: string
          order_index: number
          send_time_minutes: number
          target_audience: string | null
        }
        Insert: {
          bot_id: string
          created_at?: string
          discount_percentage?: number
          id?: string
          is_active?: boolean | null
          media_type?: string | null
          media_url?: string | null
          message: string
          order_index?: number
          send_time_minutes?: number
          target_audience?: string | null
        }
        Update: {
          bot_id?: string
          created_at?: string
          discount_percentage?: number
          id?: string
          is_active?: boolean | null
          media_type?: string | null
          media_url?: string | null
          message?: string
          order_index?: number
          send_time_minutes?: number
          target_audience?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "downsell_messages_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "bots"
            referencedColumns: ["id"]
          },
        ]
      }
      downsell_tracking: {
        Row: {
          downsell_message_id: string
          id: string
          order_id: string
          sent_at: string
        }
        Insert: {
          downsell_message_id: string
          id?: string
          order_id: string
          sent_at?: string
        }
        Update: {
          downsell_message_id?: string
          id?: string
          order_id?: string
          sent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "downsell_tracking_downsell_message_id_fkey"
            columns: ["downsell_message_id"]
            isOneToOne: false
            referencedRelation: "downsell_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "downsell_tracking_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "payment_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      email_broadcast_log: {
        Row: {
          batch_id: string
          created_at: string
          error_message: string | null
          id: string
          kind: string
          message: string | null
          recipient_email: string
          sent_by: string | null
          status: string
          subject: string
        }
        Insert: {
          batch_id: string
          created_at?: string
          error_message?: string | null
          id?: string
          kind?: string
          message?: string | null
          recipient_email: string
          sent_by?: string | null
          status?: string
          subject: string
        }
        Update: {
          batch_id?: string
          created_at?: string
          error_message?: string | null
          id?: string
          kind?: string
          message?: string | null
          recipient_email?: string
          sent_by?: string | null
          status?: string
          subject?: string
        }
        Relationships: []
      }
      mailing_messages: {
        Row: {
          bot_id: string
          buttons: Json | null
          created_at: string
          id: string
          is_active: boolean | null
          last_sent_at: string | null
          media_type: string | null
          media_url: string | null
          message: string
          next_send_at: string | null
          recurring_interval_minutes: number | null
          revenue_generated: number | null
          schedule_type: string
          scheduled_at: string | null
          sent_count: number | null
          status: string
          target_audience: string
          updated_at: string
        }
        Insert: {
          bot_id: string
          buttons?: Json | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          last_sent_at?: string | null
          media_type?: string | null
          media_url?: string | null
          message: string
          next_send_at?: string | null
          recurring_interval_minutes?: number | null
          revenue_generated?: number | null
          schedule_type?: string
          scheduled_at?: string | null
          sent_count?: number | null
          status?: string
          target_audience?: string
          updated_at?: string
        }
        Update: {
          bot_id?: string
          buttons?: Json | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          last_sent_at?: string | null
          media_type?: string | null
          media_url?: string | null
          message?: string
          next_send_at?: string | null
          recurring_interval_minutes?: number | null
          revenue_generated?: number | null
          schedule_type?: string
          scheduled_at?: string | null
          sent_count?: number | null
          status?: string
          target_audience?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mailing_messages_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "bots"
            referencedColumns: ["id"]
          },
        ]
      }
      mailing_send_logs: {
        Row: {
          bot_id: string
          failed_count: number | null
          id: string
          mailing_id: string
          sent_at: string
          sent_count: number | null
          skipped_count: number | null
        }
        Insert: {
          bot_id: string
          failed_count?: number | null
          id?: string
          mailing_id: string
          sent_at?: string
          sent_count?: number | null
          skipped_count?: number | null
        }
        Update: {
          bot_id?: string
          failed_count?: number | null
          id?: string
          mailing_id?: string
          sent_at?: string
          sent_count?: number | null
          skipped_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "mailing_send_logs_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "bots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mailing_send_logs_mailing_id_fkey"
            columns: ["mailing_id"]
            isOneToOne: false
            referencedRelation: "mailing_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_banner_history: {
        Row: {
          created_at: string
          created_by: string | null
          enabled: boolean
          ended_at: string | null
          id: string
          message: string
          notified_at: string | null
          notified_count: number
          started_at: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          ended_at?: string | null
          id?: string
          message: string
          notified_at?: string | null
          notified_count?: number
          started_at?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          ended_at?: string | null
          id?: string
          message?: string
          notified_at?: string | null
          notified_count?: number
          started_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      notification_webhooks: {
        Row: {
          created_at: string
          event_type: string
          id: string
          is_active: boolean
          last_triggered_at: string | null
          trigger_count: number
          updated_at: string
          url: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          is_active?: boolean
          last_triggered_at?: string | null
          trigger_count?: number
          updated_at?: string
          url: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          is_active?: boolean
          last_triggered_at?: string | null
          trigger_count?: number
          updated_at?: string
          url?: string
          user_id?: string
        }
        Relationships: []
      }
      payment_gateways: {
        Row: {
          bot_id: string
          created_at: string
          gateway_name: string
          id: string
          is_connected: boolean | null
          methods: string[] | null
          token: string | null
        }
        Insert: {
          bot_id: string
          created_at?: string
          gateway_name: string
          id?: string
          is_connected?: boolean | null
          methods?: string[] | null
          token?: string | null
        }
        Update: {
          bot_id?: string
          created_at?: string
          gateway_name?: string
          id?: string
          is_connected?: boolean | null
          methods?: string[] | null
          token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_gateways_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "bots"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_orders: {
        Row: {
          amount: number
          bot_id: string
          created_at: string
          customer_cpf: string | null
          customer_email: string | null
          customer_name: string | null
          expires_at: string | null
          external_id: string | null
          id: string
          is_downsell: boolean
          last_checked_at: string | null
          original_bot_id: string | null
          original_tracked_link_id: string | null
          paid_at: string | null
          pix_code: string | null
          pix_qrcode_url: string | null
          plan_id: string | null
          platform_fee: number
          platform_fee_charge_id: string | null
          platform_fee_status: string | null
          source_type: string | null
          status: string
          telegram_first_name: string | null
          telegram_user_id: number
          telegram_username: string | null
          tracked_link_id: string | null
          upsell_offer_id: string | null
        }
        Insert: {
          amount: number
          bot_id: string
          created_at?: string
          customer_cpf?: string | null
          customer_email?: string | null
          customer_name?: string | null
          expires_at?: string | null
          external_id?: string | null
          id?: string
          is_downsell?: boolean
          last_checked_at?: string | null
          original_bot_id?: string | null
          original_tracked_link_id?: string | null
          paid_at?: string | null
          pix_code?: string | null
          pix_qrcode_url?: string | null
          plan_id?: string | null
          platform_fee?: number
          platform_fee_charge_id?: string | null
          platform_fee_status?: string | null
          source_type?: string | null
          status?: string
          telegram_first_name?: string | null
          telegram_user_id: number
          telegram_username?: string | null
          tracked_link_id?: string | null
          upsell_offer_id?: string | null
        }
        Update: {
          amount?: number
          bot_id?: string
          created_at?: string
          customer_cpf?: string | null
          customer_email?: string | null
          customer_name?: string | null
          expires_at?: string | null
          external_id?: string | null
          id?: string
          is_downsell?: boolean
          last_checked_at?: string | null
          original_bot_id?: string | null
          original_tracked_link_id?: string | null
          paid_at?: string | null
          pix_code?: string | null
          pix_qrcode_url?: string | null
          plan_id?: string | null
          platform_fee?: number
          platform_fee_charge_id?: string | null
          platform_fee_status?: string | null
          source_type?: string | null
          status?: string
          telegram_first_name?: string | null
          telegram_user_id?: number
          telegram_username?: string | null
          tracked_link_id?: string | null
          upsell_offer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_orders_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "bots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_orders_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_orders_tracked_link_id_fkey"
            columns: ["tracked_link_id"]
            isOneToOne: false
            referencedRelation: "tracked_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_orders_upsell_offer_id_fkey"
            columns: ["upsell_offer_id"]
            isOneToOne: false
            referencedRelation: "upsell_offers"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_fees_ledger: {
        Row: {
          batch_charge_id: string | null
          bot_id: string | null
          charged_at: string | null
          created_at: string
          fee_amount: number
          id: string
          order_id: string | null
          status: string
          user_id: string
        }
        Insert: {
          batch_charge_id?: string | null
          bot_id?: string | null
          charged_at?: string | null
          created_at?: string
          fee_amount: number
          id?: string
          order_id?: string | null
          status?: string
          user_id: string
        }
        Update: {
          batch_charge_id?: string | null
          bot_id?: string | null
          charged_at?: string | null
          created_at?: string
          fee_amount?: number
          id?: string
          order_id?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_fees_ledger_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "bots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_fees_ledger_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "payment_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      price_rules: {
        Row: {
          bot_id: string
          created_at: string
          id: string
          is_active: boolean
          new_price: number
          original_price: number | null
          plan_id: string | null
          priority: number
          rule_config: Json
          rule_type: string
          target_id: string | null
          target_type: string
          updated_at: string
        }
        Insert: {
          bot_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          new_price: number
          original_price?: number | null
          plan_id?: string | null
          priority?: number
          rule_config?: Json
          rule_type?: string
          target_id?: string | null
          target_type?: string
          updated_at?: string
        }
        Update: {
          bot_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          new_price?: number
          original_price?: number | null
          plan_id?: string | null
          priority?: number
          rule_config?: Json
          rule_type?: string
          target_id?: string | null
          target_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_rules_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "bots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_rules_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          linkter_api_key: string | null
          phone: string | null
          platform_fee_override: number | null
          revantpay_api_key: string | null
          revantpay_key_checked_at: string | null
          revantpay_key_error: string | null
          revantpay_key_status: string | null
          updated_at: string
          widget_token: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          linkter_api_key?: string | null
          phone?: string | null
          platform_fee_override?: number | null
          revantpay_api_key?: string | null
          revantpay_key_checked_at?: string | null
          revantpay_key_error?: string | null
          revantpay_key_status?: string | null
          updated_at?: string
          widget_token?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          linkter_api_key?: string | null
          phone?: string | null
          platform_fee_override?: number | null
          revantpay_api_key?: string | null
          revantpay_key_checked_at?: string | null
          revantpay_key_error?: string | null
          revantpay_key_status?: string | null
          updated_at?: string
          widget_token?: string | null
        }
        Relationships: []
      }
      remarketing_messages: {
        Row: {
          bot_id: string
          created_at: string
          id: string
          is_active: boolean
          message: string
          order_index: number
          send_time_minutes: number
        }
        Insert: {
          bot_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          message: string
          order_index?: number
          send_time_minutes?: number
        }
        Update: {
          bot_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          message?: string
          order_index?: number
          send_time_minutes?: number
        }
        Relationships: [
          {
            foreignKeyName: "remarketing_messages_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "bots"
            referencedColumns: ["id"]
          },
        ]
      }
      remarketing_tracking: {
        Row: {
          id: string
          order_id: string
          remarketing_message_id: string
          sent_at: string
        }
        Insert: {
          id?: string
          order_id: string
          remarketing_message_id: string
          sent_at?: string
        }
        Update: {
          id?: string
          order_id?: string
          remarketing_message_id?: string
          sent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "remarketing_tracking_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "payment_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remarketing_tracking_remarketing_message_id_fkey"
            columns: ["remarketing_message_id"]
            isOneToOne: false
            referencedRelation: "remarketing_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      renewal_settings: {
        Row: {
          bot_id: string
          created_at: string
          days_before_expiry: number
          discount_percentage: number
          id: string
          is_active: boolean
          message: string
        }
        Insert: {
          bot_id: string
          created_at?: string
          days_before_expiry?: number
          discount_percentage?: number
          id?: string
          is_active?: boolean
          message?: string
        }
        Update: {
          bot_id?: string
          created_at?: string
          days_before_expiry?: number
          discount_percentage?: number
          id?: string
          is_active?: boolean
          message?: string
        }
        Relationships: [
          {
            foreignKeyName: "renewal_settings_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: true
            referencedRelation: "bots"
            referencedColumns: ["id"]
          },
        ]
      }
      renewal_tracking: {
        Row: {
          id: string
          sent_at: string
          vip_member_id: string
        }
        Insert: {
          id?: string
          sent_at?: string
          vip_member_id: string
        }
        Update: {
          id?: string
          sent_at?: string
          vip_member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "renewal_tracking_vip_member_id_fkey"
            columns: ["vip_member_id"]
            isOneToOne: true
            referencedRelation: "vip_members"
            referencedColumns: ["id"]
          },
        ]
      }
      revant_webhook_log: {
        Row: {
          event: string | null
          id: string
          payload: Json | null
          received_at: string
          timestamp: string | null
          user_id: string | null
        }
        Insert: {
          event?: string | null
          id?: string
          payload?: Json | null
          received_at?: string
          timestamp?: string | null
          user_id?: string | null
        }
        Update: {
          event?: string | null
          id?: string
          payload?: Json | null
          received_at?: string
          timestamp?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      sales_mirror: {
        Row: {
          amount: number | null
          created_at: string | null
          customer_email: string | null
          customer_name: string | null
          method: string | null
          revant_id: string
          revant_user_id: string
          riot_user_id: string | null
          status: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string | null
          customer_email?: string | null
          customer_name?: string | null
          method?: string | null
          revant_id: string
          revant_user_id: string
          riot_user_id?: string | null
          status?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string | null
          customer_email?: string | null
          customer_name?: string | null
          method?: string | null
          revant_id?: string
          revant_user_id?: string
          riot_user_id?: string | null
          status?: string | null
        }
        Relationships: []
      }
      sales_widget_tokens: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          label: string
          last_used_at: string | null
          revoked_at: string | null
          token_hash: string
          token_prefix: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          last_used_at?: string | null
          revoked_at?: string | null
          token_hash: string
          token_prefix: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          last_used_at?: string | null
          revoked_at?: string | null
          token_hash?: string
          token_prefix?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      scheduled_price_changes: {
        Row: {
          applied: boolean
          bot_id: string
          created_at: string
          id: string
          new_price: number
          plan_id: string | null
          scheduled_at: string
          target_id: string | null
          target_type: string
        }
        Insert: {
          applied?: boolean
          bot_id: string
          created_at?: string
          id?: string
          new_price: number
          plan_id?: string | null
          scheduled_at: string
          target_id?: string | null
          target_type?: string
        }
        Update: {
          applied?: boolean
          bot_id?: string
          created_at?: string
          id?: string
          new_price?: number
          plan_id?: string | null
          scheduled_at?: string
          target_id?: string | null
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_price_changes_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "bots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_price_changes_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          bonus: string | null
          bot_id: string
          button_style: string | null
          created_at: string
          duration: string
          duration_days: number | null
          id: string
          is_active: boolean | null
          name: string
          order_bump_button_price_custom: string | null
          order_bump_button_price_mode: string
          order_bump_description: string | null
          order_bump_enabled: boolean | null
          order_bump_media_type: string | null
          order_bump_media_url: string | null
          order_bump_name: string | null
          order_bump_no_button_text: string | null
          order_bump_price: number | null
          order_bump_title: string | null
          order_bump_yes_button_text: string | null
          price: number
          sort_order: number
        }
        Insert: {
          bonus?: string | null
          bot_id: string
          button_style?: string | null
          created_at?: string
          duration: string
          duration_days?: number | null
          id?: string
          is_active?: boolean | null
          name: string
          order_bump_button_price_custom?: string | null
          order_bump_button_price_mode?: string
          order_bump_description?: string | null
          order_bump_enabled?: boolean | null
          order_bump_media_type?: string | null
          order_bump_media_url?: string | null
          order_bump_name?: string | null
          order_bump_no_button_text?: string | null
          order_bump_price?: number | null
          order_bump_title?: string | null
          order_bump_yes_button_text?: string | null
          price: number
          sort_order?: number
        }
        Update: {
          bonus?: string | null
          bot_id?: string
          button_style?: string | null
          created_at?: string
          duration?: string
          duration_days?: number | null
          id?: string
          is_active?: boolean | null
          name?: string
          order_bump_button_price_custom?: string | null
          order_bump_button_price_mode?: string
          order_bump_description?: string | null
          order_bump_enabled?: boolean | null
          order_bump_media_type?: string | null
          order_bump_media_url?: string | null
          order_bump_name?: string | null
          order_bump_no_button_text?: string | null
          order_bump_price?: number | null
          order_bump_title?: string | null
          order_bump_yes_button_text?: string | null
          price?: number
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "subscription_plans_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "bots"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_payment_events: {
        Row: {
          bot_id: string
          created_at: string
          error_message: string | null
          event_type: string
          external_status: number | null
          id: string
          metadata: Json
          order_id: string | null
          plan_id: string | null
          source_type: string | null
          success: boolean | null
          telegram_user_id: number
        }
        Insert: {
          bot_id: string
          created_at?: string
          error_message?: string | null
          event_type: string
          external_status?: number | null
          id?: string
          metadata?: Json
          order_id?: string | null
          plan_id?: string | null
          source_type?: string | null
          success?: boolean | null
          telegram_user_id: number
        }
        Update: {
          bot_id?: string
          created_at?: string
          error_message?: string | null
          event_type?: string
          external_status?: number | null
          id?: string
          metadata?: Json
          order_id?: string | null
          plan_id?: string | null
          source_type?: string | null
          success?: boolean | null
          telegram_user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "telegram_payment_events_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "bots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "telegram_payment_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "payment_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      tracked_links: {
        Row: {
          bot_id: string
          cloaker_enabled: boolean | null
          cloaker_token: string | null
          created_at: string
          cross_bot_id: string | null
          custom_redirect_url: string | null
          destination_url: string
          funnel_steps: Json | null
          funnel_type: string | null
          id: string
          linkter_link_id: string
          safe_redirect_url: string | null
          short_url: string
        }
        Insert: {
          bot_id: string
          cloaker_enabled?: boolean | null
          cloaker_token?: string | null
          created_at?: string
          cross_bot_id?: string | null
          custom_redirect_url?: string | null
          destination_url: string
          funnel_steps?: Json | null
          funnel_type?: string | null
          id?: string
          linkter_link_id: string
          safe_redirect_url?: string | null
          short_url: string
        }
        Update: {
          bot_id?: string
          cloaker_enabled?: boolean | null
          cloaker_token?: string | null
          created_at?: string
          cross_bot_id?: string | null
          custom_redirect_url?: string | null
          destination_url?: string
          funnel_steps?: Json | null
          funnel_type?: string | null
          id?: string
          linkter_link_id?: string
          safe_redirect_url?: string | null
          short_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "tracked_links_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "bots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tracked_links_cross_bot_id_fkey"
            columns: ["cross_bot_id"]
            isOneToOne: false
            referencedRelation: "bots"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions_mirror: {
        Row: {
          amount: number | null
          created_at: string | null
          customer_email: string | null
          customer_name: string | null
          method: string | null
          revant_id: string
          revant_user_id: string
          riot_user_id: string | null
          status: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string | null
          customer_email?: string | null
          customer_name?: string | null
          method?: string | null
          revant_id: string
          revant_user_id: string
          riot_user_id?: string | null
          status?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string | null
          customer_email?: string | null
          customer_name?: string | null
          method?: string | null
          revant_id?: string
          revant_user_id?: string
          riot_user_id?: string | null
          status?: string | null
        }
        Relationships: []
      }
      upsell_offers: {
        Row: {
          bot_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          media_type: string | null
          media_url: string | null
          message: string
          name: string
          price: number
          updated_at: string
        }
        Insert: {
          bot_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          media_type?: string | null
          media_url?: string | null
          message: string
          name: string
          price: number
          updated_at?: string
        }
        Update: {
          bot_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          media_type?: string | null
          media_url?: string | null
          message?: string
          name?: string
          price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "upsell_offers_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "bots"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vip_members: {
        Row: {
          bot_id: string
          created_at: string
          expires_at: string
          id: string
          is_active: boolean | null
          plan_id: string | null
          telegram_first_name: string | null
          telegram_user_id: number
          telegram_username: string | null
          updated_at: string
        }
        Insert: {
          bot_id: string
          created_at?: string
          expires_at: string
          id?: string
          is_active?: boolean | null
          plan_id?: string | null
          telegram_first_name?: string | null
          telegram_user_id: number
          telegram_username?: string | null
          updated_at?: string
        }
        Update: {
          bot_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          is_active?: boolean | null
          plan_id?: string | null
          telegram_first_name?: string | null
          telegram_user_id?: number
          telegram_username?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vip_members_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "bots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vip_members_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      admin_profile_flags: {
        Row: {
          created_at: string | null
          email: string | null
          full_name: string | null
          has_revantpay_key: boolean | null
          id: string | null
          revantpay_key_checked_at: string | null
          revantpay_key_status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          has_revantpay_key?: never
          id?: string | null
          revantpay_key_checked_at?: string | null
          revantpay_key_status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          has_revantpay_key?: never
          id?: string | null
          revantpay_key_checked_at?: string | null
          revantpay_key_status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
