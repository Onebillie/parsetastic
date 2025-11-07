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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      api_test_requests: {
        Row: {
          created_at: string | null
          endpoint: string
          id: string
          method: string
          request_body: Json | null
          response_body: Json | null
          status_code: number | null
        }
        Insert: {
          created_at?: string | null
          endpoint: string
          id?: string
          method: string
          request_body?: Json | null
          response_body?: Json | null
          status_code?: number | null
        }
        Update: {
          created_at?: string | null
          endpoint?: string
          id?: string
          method?: string
          request_body?: Json | null
          response_body?: Json | null
          status_code?: number | null
        }
        Relationships: []
      }
      document_corrections: {
        Row: {
          confidence_before: number | null
          corrected_value: string
          created_at: string | null
          document_id: string
          field_path: string
          id: string
          original_value: string | null
        }
        Insert: {
          confidence_before?: number | null
          corrected_value: string
          created_at?: string | null
          document_id: string
          field_path: string
          id?: string
          original_value?: string | null
        }
        Update: {
          confidence_before?: number | null
          corrected_value?: string
          created_at?: string | null
          document_id?: string
          field_path?: string
          id?: string
          original_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_corrections_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      document_frames: {
        Row: {
          created_at: string | null
          document_id: string
          frame_number: number
          frame_url: string
          id: string
          timestamp_ms: number | null
        }
        Insert: {
          created_at?: string | null
          document_id: string
          frame_number: number
          frame_url: string
          id?: string
          timestamp_ms?: number | null
        }
        Update: {
          created_at?: string | null
          document_id?: string
          frame_number?: number
          frame_url?: string
          id?: string
          timestamp_ms?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "document_frames_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          approved: boolean | null
          approved_at: string | null
          classification_confidence: number | null
          confidence_scores: Json | null
          created_at: string | null
          document_type: string | null
          file_name: string
          file_type: string
          file_url: string
          id: string
          parsed_data: Json | null
          phone_number: string
          requires_review: boolean | null
          status: string
          updated_at: string | null
        }
        Insert: {
          approved?: boolean | null
          approved_at?: string | null
          classification_confidence?: number | null
          confidence_scores?: Json | null
          created_at?: string | null
          document_type?: string | null
          file_name: string
          file_type: string
          file_url: string
          id?: string
          parsed_data?: Json | null
          phone_number: string
          requires_review?: boolean | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          approved?: boolean | null
          approved_at?: string | null
          classification_confidence?: number | null
          confidence_scores?: Json | null
          created_at?: string | null
          document_type?: string | null
          file_name?: string
          file_type?: string
          file_url?: string
          id?: string
          parsed_data?: Json | null
          phone_number?: string
          requires_review?: boolean | null
          status?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      json_schema_versions: {
        Row: {
          created_at: string | null
          created_by: string | null
          field_mappings: Json | null
          id: string
          is_active: boolean | null
          schema_definition: Json
          version: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          field_mappings?: Json | null
          id?: string
          is_active?: boolean | null
          schema_definition: Json
          version: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          field_mappings?: Json | null
          id?: string
          is_active?: boolean | null
          schema_definition?: Json
          version?: string
        }
        Relationships: []
      }
      knowledge_documents: {
        Row: {
          category: string
          created_at: string | null
          file_type: string
          file_url: string
          id: string
          metadata: Json | null
          subcategory: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          category: string
          created_at?: string | null
          file_type: string
          file_url: string
          id?: string
          metadata?: Json | null
          subcategory?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          file_type?: string
          file_url?: string
          id?: string
          metadata?: Json | null
          subcategory?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      supplier_templates: {
        Row: {
          accuracy_stats: Json | null
          created_at: string | null
          document_type: string
          id: string
          last_updated: string | null
          supplier_name: string
          template_data: Json
        }
        Insert: {
          accuracy_stats?: Json | null
          created_at?: string | null
          document_type: string
          id?: string
          last_updated?: string | null
          supplier_name: string
          template_data: Json
        }
        Update: {
          accuracy_stats?: Json | null
          created_at?: string | null
          document_type?: string
          id?: string
          last_updated?: string | null
          supplier_name?: string
          template_data?: Json
        }
        Relationships: []
      }
      training_examples: {
        Row: {
          created_at: string | null
          document_type: string
          example_data: Json
          id: string
          notes: string | null
        }
        Insert: {
          created_at?: string | null
          document_type: string
          example_data: Json
          id?: string
          notes?: string | null
        }
        Update: {
          created_at?: string | null
          document_type?: string
          example_data?: Json
          id?: string
          notes?: string | null
        }
        Relationships: []
      }
      webhooks: {
        Row: {
          active: boolean | null
          created_at: string | null
          event_type: string
          id: string
          secret: string | null
          url: string
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          event_type: string
          id?: string
          secret?: string | null
          url: string
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          event_type?: string
          id?: string
          secret?: string | null
          url?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
