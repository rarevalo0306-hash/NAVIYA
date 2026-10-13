// Generado a partir del esquema de Supabase (proyecto orbusiness).
// Para regenerarlo: Supabase → generate_typescript_types.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type Table<Row, Insert, Update = Partial<Insert>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type Database = {
  __InternalSupabase: { PostgrestVersion: "14.18" };
  public: {
    Tables: {
      businesses: Table<
        {
          id: string;
          name: string;
          slug: string | null;
          owner_name: string | null;
          industry: string | null;
          zone: string | null;
          hours: string | null;
          lead_sources: string | null;
          visit_before_quote: boolean | null;
          payment_timing: string | null;
          has_recurring_clients: boolean | null;
          quote_requires_approval: boolean;
          business_type: string | null;
          country: string | null;
          currency: string;
          offers_delivery: boolean | null;
          country_code: string | null;
          secondary_currency: string | null;
          phone: string | null;
          address: string | null;
          payment_methods: string[];
          address_form: string | null;
          brand_options: Json;
          brand_kit: Json | null;
          brand_status: string;
          brand_purchased_at: string | null;
          onboarding_step: string;
          status: string;
          nuna_replies: boolean;
          checkout: Json;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          name: string;
          slug?: string | null;
          owner_name?: string | null;
          industry?: string | null;
          zone?: string | null;
          hours?: string | null;
          lead_sources?: string | null;
          visit_before_quote?: boolean | null;
          payment_timing?: string | null;
          has_recurring_clients?: boolean | null;
          quote_requires_approval?: boolean;
          business_type?: string | null;
          country?: string | null;
          currency?: string;
          offers_delivery?: boolean | null;
          country_code?: string | null;
          secondary_currency?: string | null;
          phone?: string | null;
          address?: string | null;
          payment_methods?: string[];
          address_form?: string | null;
          brand_options?: Json;
          brand_kit?: Json | null;
          brand_status?: string;
          brand_purchased_at?: string | null;
          onboarding_step?: string;
          status?: string;
          nuna_replies?: boolean;
          checkout?: Json;
        }
      >;
      memberships: Table<
        { business_id: string; user_id: string; role: string; created_at: string },
        { business_id: string; user_id: string; role?: string }
      >;
      interview_messages: Table<
        {
          id: string;
          business_id: string;
          role: string;
          step_key: string | null;
          content: string;
          created_at: string;
        },
        { business_id: string; role: string; step_key?: string | null; content: string }
      >;
      services: Table<
        {
          id: string;
          business_id: string;
          name: string;
          price: number | null;
          duration_minutes: number | null;
          active: boolean;
          sort: number;
          created_at: string;
          kind: "product" | "service";
          description: string | null;
          category: string | null;
          price_mode: "fixed" | "from" | "quote";
          image_path: string | null;
          image_original_path: string | null;
          variants: Json;
          updated_at: string;
        },
        {
          business_id: string;
          name: string;
          price?: number | null;
          duration_minutes?: number | null;
          active?: boolean;
          sort?: number;
          kind?: "product" | "service";
          description?: string | null;
          category?: string | null;
          price_mode?: "fixed" | "from" | "quote";
          image_path?: string | null;
          image_original_path?: string | null;
          variants?: Json;
          updated_at?: string;
        }
      >;
      brand_assets: Table<
        { id: string; business_id: string; kind: string; storage_path: string; created_at: string },
        { business_id: string; kind: string; storage_path: string }
      >;
      websites: Table<
        {
          business_id: string;
          source: string;
          existing_url: string | null;
          subdomain: string | null;
          custom_domain: string | null;
          content: Json;
          status: string;
          template: string;
          published_at: string | null;
          updated_at: string;
        },
        {
          business_id: string;
          source?: string;
          existing_url?: string | null;
          subdomain?: string | null;
          custom_domain?: string | null;
          content?: Json;
          status?: string;
          template?: string;
          published_at?: string | null;
        }
      >;
      pipeline_stages: Table<
        {
          id: string;
          business_id: string;
          position: number;
          key: string;
          name: string;
          automations: Json;
        },
        {
          business_id: string;
          position: number;
          key: string;
          name: string;
          automations?: Json;
        }
      >;
      contacts: Table<
        {
          id: string;
          business_id: string;
          name: string;
          phone: string | null;
          email: string | null;
          address: string | null;
          stage_id: string | null;
          source_channel: string | null;
          interest: string | null;
          custom_fields: Json;
          created_at: string;
          updated_at: string;
        },
        {
          business_id: string;
          name: string;
          phone?: string | null;
          email?: string | null;
          address?: string | null;
          stage_id?: string | null;
          source_channel?: string | null;
          interest?: string | null;
          custom_fields?: Json;
        }
      >;
      conversations: Table<
        {
          id: string;
          business_id: string;
          contact_id: string | null;
          channel: string;
          status: string;
          last_message_at: string;
          created_at: string;
        },
        { business_id: string; contact_id?: string | null; channel: string; status?: string; last_message_at?: string }
      >;
      messages: Table<
        {
          id: string;
          business_id: string;
          conversation_id: string;
          direction: string;
          author: string;
          channel: string;
          body: string;
          external_id: string | null;
          created_at: string;
        },
        {
          business_id: string;
          conversation_id: string;
          direction: string;
          author: string;
          channel: string;
          body: string;
          external_id?: string | null;
        }
      >;
      audit_log: Table<
        {
          id: number;
          business_id: string;
          actor: string;
          actor_user_id: string | null;
          action: string;
          entity: string | null;
          entity_id: string | null;
          data: Json;
          created_at: string;
        },
        {
          business_id: string;
          actor: string;
          actor_user_id?: string | null;
          action: string;
          entity?: string | null;
          entity_id?: string | null;
          data?: Json;
        }
      >;
      orders: Table<
        {
          id: string;
          business_id: string;
          contact_id: string | null;
          kind: string;
          status: string;
          items: Json;
          total: number | null;
          currency: string;
          note: string | null;
          number: number | null;
          customer_name: string | null;
          customer_phone: string | null;
          customer_email: string | null;
          fulfillment: string | null;
          address: string | null;
          payment_method: string | null;
          subtotal: number | null;
          delivery_fee: number | null;
          created_at: string;
          updated_at: string;
        },
        {
          business_id: string;
          kind: string;
          items: Json;
          currency: string;
          contact_id?: string | null;
          status?: string;
          total?: number | null;
          note?: string | null;
          updated_at?: string;
          number?: number | null;
          customer_name?: string | null;
          customer_phone?: string | null;
          customer_email?: string | null;
          fulfillment?: string | null;
          address?: string | null;
          payment_method?: string | null;
          subtotal?: number | null;
          delivery_fee?: number | null;
        }
      >;
      whatsapp_lines: Table<{ number: string; business_id: string; created_at: string }, { number: string; business_id: string }>;
    };
    Views: { [_ in never]: never };
    Functions: {
      create_business: { Args: { p_name: string }; Returns: string };
      next_quote_number: { Args: { p_business: string }; Returns: number };
      purchase_brand_kit_test: { Args: { p_business: string }; Returns: undefined };
      submit_lead: {
        Args: {
          p_subdomain: string;
          p_name: string;
          p_phone: string;
          p_email: string;
          p_message: string;
        };
        Returns: boolean;
      };
      place_order: {
        Args: {
          p_subdomain: string;
          p_name: string;
          p_phone: string;
          p_email: string;
          p_note: string;
          p_items: Json;
          p_fulfillment: string;
          p_address: string;
          p_payment: string;
        };
        Returns: Json;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
