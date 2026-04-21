export type Database = {
  public: {
    Tables: {
      clearance_stock_items: {
        Row: {
          id: string;
          title: string;
          subtitle: string;
          description: string;
          price_label: string;
          quantity: number | null;
          product_slug: string | null;
          image_url: string | null;
          sort_order: number;
          is_published: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          subtitle?: string;
          description?: string;
          price_label?: string;
          quantity?: number | null;
          product_slug?: string | null;
          image_url?: string | null;
          sort_order?: number;
          is_published?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          subtitle?: string;
          description?: string;
          price_label?: string;
          quantity?: number | null;
          product_slug?: string | null;
          image_url?: string | null;
          sort_order?: number;
          is_published?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      admin_access_users: {
        Row: {
          id: string;
          identifier: string;
          role: string;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          identifier: string;
          role?: string;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          identifier?: string;
          role?: string;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      accounting_expenses: {
        Row: {
          id: string;
          expense_date: string;
          category: string;
          description: string;
          amount_cents: number;
          currency: string;
          vendor: string;
          notes: string;
          receipt_storage_path: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          expense_date: string;
          category?: string;
          description: string;
          amount_cents: number;
          currency?: string;
          vendor?: string;
          notes?: string;
          receipt_storage_path?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          expense_date?: string;
          category?: string;
          description?: string;
          amount_cents?: number;
          currency?: string;
          vendor?: string;
          notes?: string;
          receipt_storage_path?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      accounting_refunds: {
        Row: {
          id: string;
          issue_date: string;
          order_id: string;
          description: string;
          amount_cents: number;
          currency: string;
          date_refunded: string | null;
          xero_updated: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          issue_date: string;
          order_id?: string;
          description: string;
          amount_cents: number;
          currency?: string;
          date_refunded?: string | null;
          xero_updated?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          issue_date?: string;
          order_id?: string;
          description?: string;
          amount_cents?: number;
          currency?: string;
          date_refunded?: string | null;
          xero_updated?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      customer_profiles: {
        Row: {
          id: string;
          customer_name: string;
          organisation: string;
          contact_number: string;
          email_address: string;
          login_password: string | null;
          delivery_address: string;
          billing_address: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          customer_name: string;
          organisation: string;
          contact_number: string;
          email_address: string;
          login_password?: string | null;
          delivery_address: string;
          billing_address: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          customer_name?: string;
          organisation?: string;
          contact_number?: string;
          email_address?: string;
          login_password?: string | null;
          delivery_address?: string;
          billing_address?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      products: {
        Row: {
          id: string;
          name: string;
          slug: string | null;
          category: string | null;
          description: string | null;
          base_price: number | null;
          weight_kg: number | null;
          stock_quantity: number;
          image_urls: string[] | null;
          available_colors: string[] | null;
          available_sizes: string[] | null;
          supplier_name: string;
          is_active: boolean;
          sort_order: number | null;
          storefront_hidden: boolean;
          storefront_hidden_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug?: string | null;
          category?: string | null;
          description?: string | null;
          base_price?: number | null;
          weight_kg?: number | null;
          stock_quantity?: number;
          image_urls?: string[] | null;
          available_colors?: string[] | null;
          available_sizes?: string[] | null;
          supplier_name?: string;
          is_active?: boolean;
          sort_order?: number | null;
          storefront_hidden?: boolean;
          storefront_hidden_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string | null;
          category?: string | null;
          description?: string | null;
          base_price?: number | null;
          weight_kg?: number | null;
          stock_quantity?: number;
          image_urls?: string[] | null;
          available_colors?: string[] | null;
          available_sizes?: string[] | null;
          supplier_name?: string;
          is_active?: boolean;
          sort_order?: number | null;
          storefront_hidden?: boolean;
          storefront_hidden_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      embroidery_positions: {
        Row: {
          id: string;
          name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      quote_requests: {
        Row: {
          id: string;
          company_name: string;
          contact_name: string;
          email: string;
          phone: string | null;
          product_id: string | null;
          embroidery_position_id: string | null;
          embroidery_position_ids: string[] | null;
          printing_position_id: string | null;
          printing_position_ids: string[] | null;
          service_type: string | null;
          placement_labels: string[] | null;
          product_color: string | null;
          logo_file_url: string | null;
          quantity: number | null;
          notes: string | null;
          created_at: string;
          pipeline_stage: string;
          customer_profile_id: string | null;
          internal_notes: string | null;
          next_follow_up_at: string | null;
          last_contacted_at: string | null;
          lead_source: string;
          automation_paused: boolean;
          quote_email_product_id: string | null;
          quote_email_product_name: string | null;
          quote_email_products: unknown;
          quote_email_total_cents: number | null;
          quote_email_lead_time: string | null;
          quote_email_delivery_address_1: string | null;
          quote_email_delivery_address_2: string | null;
          quote_email_delivery_suburb: string | null;
          quote_email_delivery_state: string | null;
          quote_email_delivery_country: string | null;
          quote_mockup_image_urls: string[] | null;
          quote_email_embroidery_service: string | null;
          quote_email_print_service: string | null;
          quote_portal_token: string | null;
          quote_customer_accepted_at: string | null;
          quote_customer_accept_payload: unknown | null;
          quote_customer_accept_comment: string | null;
        };
        Insert: {
          id?: string;
          company_name: string;
          contact_name: string;
          email: string;
          phone?: string | null;
          product_id?: string | null;
          embroidery_position_id?: string | null;
          embroidery_position_ids?: string[] | null;
          printing_position_id?: string | null;
          printing_position_ids?: string[] | null;
          service_type?: string | null;
          placement_labels?: string[] | null;
          product_color?: string | null;
          logo_file_url?: string | null;
          quantity?: number | null;
          notes?: string | null;
          created_at?: string;
          pipeline_stage?: string;
          customer_profile_id?: string | null;
          internal_notes?: string | null;
          next_follow_up_at?: string | null;
          last_contacted_at?: string | null;
          lead_source?: string;
          automation_paused?: boolean;
          quote_email_product_id?: string | null;
          quote_email_product_name?: string | null;
          quote_email_products?: unknown;
          quote_email_total_cents?: number | null;
          quote_email_lead_time?: string | null;
          quote_email_delivery_address_1?: string | null;
          quote_email_delivery_address_2?: string | null;
          quote_email_delivery_suburb?: string | null;
          quote_email_delivery_state?: string | null;
          quote_email_delivery_country?: string | null;
          quote_mockup_image_urls?: string[] | null;
          quote_email_embroidery_service?: string | null;
          quote_email_print_service?: string | null;
          quote_portal_token?: string | null;
          quote_customer_accepted_at?: string | null;
          quote_customer_accept_payload?: unknown | null;
          quote_customer_accept_comment?: string | null;
        };
        Update: {
          id?: string;
          company_name?: string;
          contact_name?: string;
          email?: string;
          phone?: string | null;
          product_id?: string | null;
          embroidery_position_id?: string | null;
          embroidery_position_ids?: string[] | null;
          printing_position_id?: string | null;
          printing_position_ids?: string[] | null;
          service_type?: string | null;
          placement_labels?: string[] | null;
          product_color?: string | null;
          logo_file_url?: string | null;
          quantity?: number | null;
          notes?: string | null;
          created_at?: string;
          pipeline_stage?: string;
          customer_profile_id?: string | null;
          internal_notes?: string | null;
          next_follow_up_at?: string | null;
          last_contacted_at?: string | null;
          lead_source?: string;
          automation_paused?: boolean;
          quote_email_product_id?: string | null;
          quote_email_product_name?: string | null;
          quote_email_products?: unknown;
          quote_email_total_cents?: number | null;
          quote_email_lead_time?: string | null;
          quote_email_delivery_address_1?: string | null;
          quote_email_delivery_address_2?: string | null;
          quote_email_delivery_suburb?: string | null;
          quote_email_delivery_state?: string | null;
          quote_email_delivery_country?: string | null;
          quote_mockup_image_urls?: string[] | null;
          quote_email_embroidery_service?: string | null;
          quote_email_print_service?: string | null;
          quote_portal_token?: string | null;
          quote_customer_accepted_at?: string | null;
          quote_customer_accept_payload?: unknown | null;
          quote_customer_accept_comment?: string | null;
        };
        Relationships: [];
      };
      supplier_order_lines: {
        Row: {
          id: string;
          supplier: string;
          customer_order_id: string;
          product_id: string;
          colour: string;
          size: string;
          quantity: number;
          ordered_date: string | null;
          received_date: string | null;
          notes: string;
          unit_price_cents: number;
          list_date: string;
          sheet_row_ok: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          supplier?: string;
          customer_order_id?: string;
          product_id?: string;
          colour?: string;
          size?: string;
          quantity?: number;
          ordered_date?: string | null;
          received_date?: string | null;
          notes?: string;
          unit_price_cents?: number;
          list_date?: string;
          sheet_row_ok?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          supplier?: string;
          customer_order_id?: string;
          product_id?: string;
          colour?: string;
          size?: string;
          quantity?: number;
          ordered_date?: string | null;
          received_date?: string | null;
          notes?: string;
          unit_price_cents?: number;
          list_date?: string;
          sheet_row_ok?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      supplier_daily_sheets: {
        Row: {
          list_date: string;
          ready_for_processing: boolean;
          updated_at: string;
        };
        Insert: {
          list_date: string;
          ready_for_processing?: boolean;
          updated_at?: string;
        };
        Update: {
          list_date?: string;
          ready_for_processing?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      click_up_sheet_list: {
        Row: {
          list_date: string;
          created_at: string;
        };
        Insert: {
          list_date: string;
          created_at?: string;
        };
        Update: {
          list_date?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      click_up_sheet_images: {
        Row: {
          id: string;
          list_date: string;
          customer_order_id: string;
          storage_path: string;
          sort_order: number;
          created_at: string;
          is_mockup: boolean;
          mockup_decorate_methods: string | null;
          mockup_memo: string | null;
        };
        Insert: {
          id?: string;
          list_date: string;
          customer_order_id?: string;
          storage_path: string;
          sort_order?: number;
          created_at?: string;
          is_mockup?: boolean;
          mockup_decorate_methods?: string | null;
          mockup_memo?: string | null;
        };
        Update: {
          id?: string;
          list_date?: string;
          customer_order_id?: string;
          storage_path?: string;
          sort_order?: number;
          created_at?: string;
          is_mockup?: boolean;
          mockup_decorate_methods?: string | null;
          mockup_memo?: string | null;
        };
        Relationships: [];
      };
      click_up_production_queue: {
        Row: {
          id: string;
          store_order_id: string;
          list_date: string;
          moved_at: string;
        };
        Insert: {
          id?: string;
          store_order_id: string;
          list_date?: string;
          moved_at?: string;
        };
        Update: {
          id?: string;
          store_order_id?: string;
          list_date?: string;
          moved_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "click_up_production_queue_store_order_id_fkey";
            columns: ["store_order_id"];
            referencedRelation: "store_orders";
            referencedColumns: ["id"];
          },
        ];
      };
      production_order_assets: {
        Row: {
          id: string;
          order_id: string;
          kind: string;
          label: string;
          storage_bucket: string;
          storage_path: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          kind: string;
          label: string;
          storage_bucket?: string;
          storage_path: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          kind?: string;
          label?: string;
          storage_bucket?: string;
          storage_path?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "production_order_assets_order_id_fkey";
            columns: ["order_id"];
            referencedRelation: "store_orders";
            referencedColumns: ["id"];
          },
        ];
      };
      click_up_qc_queue: {
        Row: {
          id: string;
          store_order_id: string;
          list_date: string;
          moved_at: string;
        };
        Insert: {
          id?: string;
          store_order_id: string;
          list_date?: string;
          moved_at?: string;
        };
        Update: {
          id?: string;
          store_order_id?: string;
          list_date?: string;
          moved_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "click_up_qc_queue_store_order_id_fkey";
            columns: ["store_order_id"];
            referencedRelation: "store_orders";
            referencedColumns: ["id"];
          },
        ];
      };
      click_up_dispatch_queue: {
        Row: {
          id: string;
          store_order_id: string;
          list_date: string;
          moved_at: string;
        };
        Insert: {
          id?: string;
          store_order_id: string;
          list_date?: string;
          moved_at?: string;
        };
        Update: {
          id?: string;
          store_order_id?: string;
          list_date?: string;
          moved_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "click_up_dispatch_queue_store_order_id_fkey";
            columns: ["store_order_id"];
            referencedRelation: "store_orders";
            referencedColumns: ["id"];
          },
        ];
      };
      click_up_complete_orders_queue: {
        Row: {
          id: string;
          store_order_id: string;
          list_date: string;
          completed_at: string;
        };
        Insert: {
          id?: string;
          store_order_id: string;
          list_date?: string;
          completed_at?: string;
        };
        Update: {
          id?: string;
          store_order_id?: string;
          list_date?: string;
          completed_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "click_up_complete_orders_queue_store_order_id_fkey";
            columns: ["store_order_id"];
            referencedRelation: "store_orders";
            referencedColumns: ["id"];
          },
        ];
      };
      supplier_receipt_checks: {
        Row: {
          line_key: string;
          received: boolean;
          received_at: string | null;
          updated_at: string;
        };
        Insert: {
          line_key: string;
          received?: boolean;
          received_at?: string | null;
          updated_at?: string;
        };
        Update: {
          line_key?: string;
          received?: boolean;
          received_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      crm_activities: {
        Row: {
          id: string;
          quote_request_id: string;
          kind: string;
          body: string;
          metadata: Record<string, unknown> | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          quote_request_id: string;
          kind: string;
          body: string;
          metadata?: Record<string, unknown> | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          quote_request_id?: string;
          kind?: string;
          body?: string;
          metadata?: Record<string, unknown> | null;
          created_at?: string;
        };
        Relationships: [];
      };
      crm_notification_log: {
        Row: {
          id: string;
          quote_request_id: string;
          channel: string;
          template_key: string;
          status: string;
          error: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          quote_request_id: string;
          channel: string;
          template_key: string;
          status: string;
          error?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          quote_request_id?: string;
          channel?: string;
          template_key?: string;
          status?: string;
          error?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      store_orders: {
        Row: {
          id: string;
          order_number: string;
          order_scan_code: string;
          tracking_token: string;
          status: string;
          customer_email: string;
          customer_name: string;
          delivery_address: string;
          delivery_fee_cents: number;
          subtotal_cents: number;
          total_cents: number;
          currency: string;
          carrier: string;
          tracking_number: string | null;
          shipped_at: string | null;
          created_at: string;
          invoice_reference: string | null;
        };
        Insert: {
          id?: string;
          order_number: string;
          order_scan_code?: string;
          tracking_token?: string;
          status?: string;
          customer_email: string;
          customer_name: string;
          delivery_address: string;
          delivery_fee_cents?: number;
          subtotal_cents: number;
          total_cents: number;
          currency?: string;
          carrier?: string;
          tracking_number?: string | null;
          shipped_at?: string | null;
          created_at?: string;
          invoice_reference?: string | null;
        };
        Update: {
          id?: string;
          order_number?: string;
          order_scan_code?: string;
          tracking_token?: string;
          status?: string;
          customer_email?: string;
          customer_name?: string;
          delivery_address?: string;
          delivery_fee_cents?: number;
          subtotal_cents?: number;
          total_cents?: number;
          currency?: string;
          carrier?: string;
          tracking_number?: string | null;
          shipped_at?: string | null;
          created_at?: string;
          invoice_reference?: string | null;
        };
        Relationships: [];
      };
      store_order_items: {
        Row: {
          id: string;
          order_id: string;
          product_id: string;
          product_name: string;
          quantity: number;
          unit_price_cents: number;
          line_total_cents: number;
          service_type: string | null;
          color: string | null;
          size: string | null;
          placements: unknown;
          notes: string | null;
          sort_order: number;
        };
        Insert: {
          id?: string;
          order_id: string;
          product_id?: string;
          product_name: string;
          quantity: number;
          unit_price_cents: number;
          line_total_cents: number;
          service_type?: string | null;
          color?: string | null;
          size?: string | null;
          placements?: unknown;
          notes?: string | null;
          sort_order?: number;
        };
        Update: {
          id?: string;
          order_id?: string;
          product_id?: string;
          product_name?: string;
          quantity?: number;
          unit_price_cents?: number;
          line_total_cents?: number;
          service_type?: string | null;
          color?: string | null;
          size?: string | null;
          placements?: unknown;
          notes?: string | null;
          sort_order?: number;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      move_store_order_from_delivery_to_complete: {
        Args: { p_delivery_queue_id: string };
        Returns: undefined;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
