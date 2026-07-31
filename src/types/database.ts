export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      product_drafts: {
        Row: {
          created_at: string
          data: Json
          id: string
          label: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data: Json
          id?: string
          label?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          label?: string
          updated_at?: string
        }
        Relationships: []
      }
      content_presets: {
        Row: {
          created_at: string
          id: string
          kind: string
          position: number
          value: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          position?: number
          value: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          position?: number
          value?: string
        }
        Relationships: []
      }
      member_profiles: {
        Row: {
          created_at: string
          discount_percent: number
          email: string
          points: number
          tier: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          discount_percent?: number
          email: string
          points?: number
          tier?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          discount_percent?: number
          email?: string
          points?: number
          tier?: string
          updated_at?: string
        }
        Relationships: []
      }
      promotion_redemptions: {
        Row: {
          code: string
          created_at: string
          email: string
          id: string
          order_id: string | null
          order_number: string | null
          promotion_id: string
        }
        Insert: {
          code: string
          created_at?: string
          email: string
          id?: string
          order_id?: string | null
          order_number?: string | null
          promotion_id: string
        }
        Update: {
          code?: string
          created_at?: string
          email?: string
          id?: string
          order_id?: string | null
          order_number?: string | null
          promotion_id?: string
        }
        Relationships: []
      }
      promotions: {
        Row: {
          active: boolean
          code: string | null
          condition_value: number
          created_at: string
          ends_at: string | null
          gift_name: string
          id: string
          name: string
          reward_value: number
          starts_at: string | null
          type: string
          updated_at: string
          usage_limit: string
        }
        Insert: {
          active?: boolean
          code?: string | null
          condition_value?: number
          created_at?: string
          ends_at?: string | null
          gift_name?: string
          id?: string
          name: string
          reward_value?: number
          starts_at?: string | null
          type?: string
          updated_at?: string
          usage_limit?: string
        }
        Update: {
          active?: boolean
          code?: string | null
          condition_value?: number
          created_at?: string
          ends_at?: string | null
          gift_name?: string
          id?: string
          name?: string
          reward_value?: number
          starts_at?: string | null
          type?: string
          updated_at?: string
          usage_limit?: string
        }
        Relationships: []
      }
      product_categories: {
        Row: {
          created_at: string
          id: string
          name: string
          position: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          position?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          position?: number
        }
        Relationships: []
      }
      product_series: {
        Row: {
          category_name: string
          created_at: string
          id: string
          name: string
          position: number
          updated_at: string
        }
        Insert: {
          category_name: string
          created_at?: string
          id?: string
          name: string
          position?: number
          updated_at?: string
        }
        Update: {
          category_name?: string
          created_at?: string
          id?: string
          name?: string
          position?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'product_series_category_name_fkey'
            columns: ['category_name']
            isOneToOne: false
            referencedRelation: 'product_categories'
            referencedColumns: ['name']
          },
        ]
      }
      product_series_products: {
        Row: {
          product_id: string
          series_id: string
        }
        Insert: {
          product_id: string
          series_id: string
        }
        Update: {
          product_id?: string
          series_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'product_series_products_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'products'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'product_series_products_series_id_fkey'
            columns: ['series_id']
            isOneToOne: false
            referencedRelation: 'product_series'
            referencedColumns: ['id']
          },
        ]
      }
      order_items: {
        Row: {
          color: string
          created_at: string
          id: string
          order_id: string
          product_id: string | null
          product_name: string
          quantity: number
          size: string
          sku: string
          unit_price: number
          variant_id: string | null
        }
        Insert: {
          color: string
          created_at?: string
          id?: string
          order_id: string
          product_id?: string | null
          product_name: string
          quantity: number
          size: string
          sku: string
          unit_price: number
          variant_id?: string | null
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          order_id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          size?: string
          sku?: string
          unit_price?: number
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'order_items_order_id_fkey'
            columns: ['order_id']
            isOneToOne: false
            referencedRelation: 'orders'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'order_items_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'products'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'order_items_variant_id_fkey'
            columns: ['variant_id']
            isOneToOne: false
            referencedRelation: 'product_variants'
            referencedColumns: ['id']
          },
        ]
      }
      orders: {
        Row: {
          bundle_discount: number
          coupon_code: string | null
          coupon_discount: number
          created_at: string
          customer_note: string
          merchant_reply: string
          email: string
          id: string
          order_number: string
          payment_method: string
          bank_transfer_last_five: string | null
          bank_transfer_submitted_at: string | null
          recipient_name: string
          recipient_phone: string
          shipping_fee: number
          status: Database['public']['Enums']['order_status']
          store_chain: Database['public']['Enums']['store_chain']
          store_id: string
          store_name: string
          subtotal: number
          total: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          bundle_discount?: number
          coupon_code?: string | null
          coupon_discount?: number
          created_at?: string
          customer_note?: string
          merchant_reply?: string
          email: string
          id?: string
          order_number?: string
          payment_method?: string
          bank_transfer_last_five?: string | null
          bank_transfer_submitted_at?: string | null
          recipient_name: string
          recipient_phone: string
          shipping_fee: number
          status?: Database['public']['Enums']['order_status']
          store_chain: Database['public']['Enums']['store_chain']
          store_id: string
          store_name: string
          subtotal: number
          total: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          bundle_discount?: number
          coupon_code?: string | null
          coupon_discount?: number
          created_at?: string
          customer_note?: string
          merchant_reply?: string
          email?: string
          id?: string
          order_number?: string
          payment_method?: string
          bank_transfer_last_five?: string | null
          bank_transfer_submitted_at?: string | null
          recipient_name?: string
          recipient_phone?: string
          shipping_fee?: number
          status?: Database['public']['Enums']['order_status']
          store_chain?: Database['public']['Enums']['store_chain']
          store_id?: string
          store_name?: string
          subtotal?: number
          total?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'orders_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      payment_attempts: {
        Row: {
          coupon_code: string | null
          created_at: string
          customer_note: string
          bundle_discount: number
          discount: number
          email: string
          id: string
          items: Json
          order_id: string | null
          paid_at: string | null
          payment_access_expires_at: string
          payment_access_token_hash: string | null
          payment_method: string
          provider_reference: string | null
          recipient_name: string
          recipient_phone: string
          review_code: string | null
          review_reason: string | null
          shipping_fee: number
          status: Database['public']['Enums']['payment_attempt_status']
          store_chain: Database['public']['Enums']['store_chain']
          store_id: string
          store_name: string
          subtotal: number
          total: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          coupon_code?: string | null
          created_at?: string
          customer_note?: string
          bundle_discount?: number
          discount?: number
          email: string
          id?: string
          items: Json
          order_id?: string | null
          paid_at?: string | null
          payment_access_expires_at: string
          payment_access_token_hash: string | null
          payment_method?: string
          provider_reference?: string | null
          recipient_name: string
          recipient_phone: string
          review_code?: string | null
          review_reason?: string | null
          shipping_fee: number
          status?: Database['public']['Enums']['payment_attempt_status']
          store_chain: Database['public']['Enums']['store_chain']
          store_id: string
          store_name: string
          subtotal: number
          total: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          coupon_code?: string | null
          created_at?: string
          customer_note?: string
          bundle_discount?: number
          discount?: number
          email?: string
          id?: string
          items?: Json
          order_id?: string | null
          paid_at?: string | null
          payment_access_expires_at?: string
          payment_access_token_hash?: string | null
          payment_method?: string
          provider_reference?: string | null
          recipient_name?: string
          recipient_phone?: string
          review_code?: string | null
          review_reason?: string | null
          shipping_fee?: number
          status?: Database['public']['Enums']['payment_attempt_status']
          store_chain?: Database['public']['Enums']['store_chain']
          store_id?: string
          store_name?: string
          subtotal?: number
          total?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'payment_attempts_order_id_fkey'
            columns: ['order_id']
            isOneToOne: true
            referencedRelation: 'orders'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'payment_attempts_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      product_quantity_prices: {
        Row: {
          bundle_price: number
          created_at: string
          id: string
          product_id: string
          quantity: number
          updated_at: string
        }
        Insert: {
          bundle_price: number
          created_at?: string
          id?: string
          product_id: string
          quantity: number
          updated_at?: string
        }
        Update: {
          bundle_price?: number
          created_at?: string
          id?: string
          product_id?: string
          quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'product_quantity_prices_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'products'
            referencedColumns: ['id']
          },
        ]
      }
      product_images: {
        Row: {
          alt_text: string
          created_at: string
          id: string
          position: number
          product_id: string
          storage_path: string
          updated_at: string
        }
        Insert: {
          alt_text: string
          created_at?: string
          id?: string
          position?: number
          product_id: string
          storage_path: string
          updated_at?: string
        }
        Update: {
          alt_text?: string
          created_at?: string
          id?: string
          position?: number
          product_id?: string
          storage_path?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'product_images_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'products'
            referencedColumns: ['id']
          },
        ]
      }
      product_variants: {
        Row: {
          color: string
          compare_at_price: number | null
          cost: number
          created_at: string
          id: string
          is_active: boolean
          price: number
          product_id: string
          size: string
          sku: string
          stock: number
          updated_at: string
        }
        Insert: {
          color: string
          compare_at_price?: number | null
          cost?: number
          created_at?: string
          id?: string
          is_active?: boolean
          price: number
          product_id: string
          size: string
          sku: string
          stock?: number
          updated_at?: string
        }
        Update: {
          color?: string
          compare_at_price?: number | null
          cost?: number
          created_at?: string
          id?: string
          is_active?: boolean
          price?: number
          product_id?: string
          size?: string
          sku?: string
          stock?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'product_variants_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'products'
            referencedColumns: ['id']
          },
        ]
      }
      products: {
        Row: {
          available_at: string | null
          age_bands: Database['public']['Enums']['age_band'][]
          care_instructions: string
          category: string
          created_at: string
          description: string
          id: string
          is_new: boolean
          is_published: boolean
          material: string
          name: string
          seo_description: string
          seo_title: string
          size_guide: string
          slug: string
          summary: string
          tags: string[]
          updated_at: string
        }
        Insert: {
          available_at?: string | null
          age_bands: Database['public']['Enums']['age_band'][]
          care_instructions?: string
          category: string
          created_at?: string
          description?: string
          id?: string
          is_new?: boolean
          is_published?: boolean
          material?: string
          name: string
          seo_description?: string
          seo_title?: string
          size_guide?: string
          slug: string
          summary?: string
          tags?: string[]
          updated_at?: string
        }
        Update: {
          available_at?: string | null
          age_bands?: Database['public']['Enums']['age_band'][]
          care_instructions?: string
          category?: string
          created_at?: string
          description?: string
          id?: string
          is_new?: boolean
          is_published?: boolean
          material?: string
          name?: string
          seo_description?: string
          seo_title?: string
          size_guide?: string
          slug?: string
          summary?: string
          tags?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          marketing_consent_at: string | null
          phone: string | null
          role: string
          terms_accepted_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          marketing_consent_at?: string | null
          phone?: string | null
          role?: string
          terms_accepted_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          marketing_consent_at?: string | null
          phone?: string | null
          role?: string
          terms_accepted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'profiles_id_fkey'
            columns: ['id']
            isOneToOne: true
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      storefront_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          path: string
          product_name: string | null
          search_query: string | null
          search_result_count: number | null
          session_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          path: string
          product_name?: string | null
          search_query?: string | null
          search_result_count?: number | null
          session_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          path?: string
          product_name?: string | null
          search_query?: string | null
          search_result_count?: number | null
          session_id?: string
        }
        Relationships: []
      }
      store_settings: {
        Row: {
          created_at: string
          id: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      admin_create_product: {
        Args: { p_product: Json; p_variants: Json }
        Returns: string
      }
      admin_insert_product_image: {
        Args: { p_alt_text: string; p_product_id: string; p_storage_path: string }
        Returns: string
      }
      admin_reorder_product_images: {
        Args: { p_image_ids: string[]; p_product_id: string }
        Returns: undefined
      }
      admin_set_product_published: {
        Args: { p_product_id: string; p_published: boolean }
        Returns: undefined
      }
      admin_update_product: {
        Args: { p_product: Json; p_product_id: string; p_variants: Json }
        Returns: undefined
      }
      admin_update_order_status: {
        Args: {
          p_expected_status: Database['public']['Enums']['order_status']
          p_next_status: Database['public']['Enums']['order_status']
          p_order_id: string
          p_updated_at: string
        }
        Returns: undefined
      }
      admin_update_store_settings: {
        Args: {
          p_contact_email: string
          p_free_shipping_threshold: number | null
          p_shipping_fee: number
        }
        Returns: undefined
      }
      complete_test_payment: {
        Args: { payment_attempt_id: string; provider_reference: string }
        Returns: Database['public']['CompositeTypes']['payment_completion_result']
      }
      finalize_manual_order: {
        Args: { payment_attempt_id: string; provider_reference: string }
        Returns: Database['public']['CompositeTypes']['payment_completion_result']
      }
      handle_new_user: { Args: Record<PropertyKey, never>; Returns: unknown }
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean }
      prevent_order_item_mutation: { Args: Record<PropertyKey, never>; Returns: unknown }
      prevent_inactive_variant_sale: { Args: Record<PropertyKey, never>; Returns: unknown }
      protect_member_profile: { Args: Record<PropertyKey, never>; Returns: unknown }
      set_updated_at: { Args: Record<PropertyKey, never>; Returns: unknown }
    }
    Enums: {
      age_band: '0-3' | '3-6' | '6-12'
      order_status: 'pending_payment' | 'paid' | 'preparing' | 'shipped' | 'collected' | 'cancelled'
      payment_attempt_status: 'pending' | 'paid' | 'failed' | 'cancelled' | 'requires_review'
      store_chain: 'seven_eleven' | 'family_mart'
    }
    CompositeTypes: {
      payment_completion_result: {
        status: Database['public']['Enums']['payment_attempt_status']
        order_id: string | null
        order_number: string | null
        review_code: string | null
      }
    }
  }
}

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']

export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']
