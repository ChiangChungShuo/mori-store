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
      order_items: {
        Row: {
          color: string
          created_at: string
          id: string
          order_id: string
          product_id: string
          product_name: string
          quantity: number
          size: string
          sku: string
          unit_price: number
          variant_id: string
        }
        Insert: {
          color: string
          created_at?: string
          id?: string
          order_id: string
          product_id: string
          product_name: string
          quantity: number
          size: string
          sku: string
          unit_price: number
          variant_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          order_id?: string
          product_id?: string
          product_name?: string
          quantity?: number
          size?: string
          sku?: string
          unit_price?: number
          variant_id?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          created_at: string
          email: string
          id: string
          order_number: string
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
          created_at?: string
          email: string
          id?: string
          order_number?: string
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
          created_at?: string
          email?: string
          id?: string
          order_number?: string
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
        Relationships: []
      }
      payment_attempts: {
        Row: {
          created_at: string
          email: string
          id: string
          items: Json
          order_id: string | null
          paid_at: string | null
          provider_reference: string | null
          recipient_name: string
          recipient_phone: string
          shipping_fee: number
          store_chain: Database['public']['Enums']['store_chain']
          store_id: string
          store_name: string
          subtotal: number
          total: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          items: Json
          order_id?: string | null
          paid_at?: string | null
          provider_reference?: string | null
          recipient_name: string
          recipient_phone: string
          shipping_fee: number
          store_chain: Database['public']['Enums']['store_chain']
          store_id: string
          store_name: string
          subtotal: number
          total: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          items?: Json
          order_id?: string | null
          paid_at?: string | null
          provider_reference?: string | null
          recipient_name?: string
          recipient_phone?: string
          shipping_fee?: number
          store_chain?: Database['public']['Enums']['store_chain']
          store_id?: string
          store_name?: string
          subtotal?: number
          total?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
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
        Relationships: []
      }
      product_variants: {
        Row: {
          color: string
          compare_at_price: number | null
          created_at: string
          id: string
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
          created_at?: string
          id?: string
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
          created_at?: string
          id?: string
          price?: number
          product_id?: string
          size?: string
          sku?: string
          stock?: number
          updated_at?: string
        }
        Relationships: []
      }
      products: {
        Row: {
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
          size_guide: string
          slug: string
          updated_at: string
        }
        Insert: {
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
          size_guide?: string
          slug: string
          updated_at?: string
        }
        Update: {
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
          size_guide?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          role: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          role?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          role?: string
          updated_at?: string
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
      complete_test_payment: {
        Args: { payment_attempt_id: string; provider_reference: string }
        Returns: Database['public']['Tables']['orders']['Row']
      }
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean }
      prevent_order_item_mutation: { Args: Record<PropertyKey, never>; Returns: unknown }
      set_updated_at: { Args: Record<PropertyKey, never>; Returns: unknown }
    }
    Enums: {
      age_band: '0-2' | '3-5' | '6-9' | '10-12'
      order_status: 'pending_payment' | 'paid' | 'preparing' | 'shipped' | 'collected' | 'cancelled'
      store_chain: 'seven_eleven' | 'family_mart'
    }
    CompositeTypes: Record<string, never>
  }
}

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']

export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']
