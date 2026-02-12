import { FollowUpStatus, InterestLabel, LeadStage, SiteVisitStatus } from "@/lib/domain";

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      leads: {
        Row: {
          id: string;
          created_at: string;
          updated_at: string;
          call_date: string | null;
          customer_name: string | null;
          phone: string | null;
          goal: string | null;
          preference: string | null;
          visit_time: string | null;
          summary: string | null;
          recording_url: string | null;
          duration: number | null;
          score: number | null;
          interest_label: InterestLabel | null;
          confidence: number | null;
          ai_reason: string | null;
          stage: LeadStage;
          assigned_to: string | null;
          source: string;
          raw_payload: Json | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          updated_at?: string;
          call_date?: string | null;
          customer_name?: string | null;
          phone?: string | null;
          goal?: string | null;
          preference?: string | null;
          visit_time?: string | null;
          summary?: string | null;
          recording_url?: string | null;
          duration?: number | null;
          score?: number | null;
          interest_label?: InterestLabel | null;
          confidence?: number | null;
          ai_reason?: string | null;
          stage?: LeadStage;
          assigned_to?: string | null;
          source?: string;
          raw_payload?: Json | null;
        };
        Update: {
          id?: string;
          created_at?: string;
          updated_at?: string;
          call_date?: string | null;
          customer_name?: string | null;
          phone?: string | null;
          goal?: string | null;
          preference?: string | null;
          visit_time?: string | null;
          summary?: string | null;
          recording_url?: string | null;
          duration?: number | null;
          score?: number | null;
          interest_label?: InterestLabel | null;
          confidence?: number | null;
          ai_reason?: string | null;
          stage?: LeadStage;
          assigned_to?: string | null;
          source?: string;
          raw_payload?: Json | null;
        };
        Relationships: [];
      };
      sales_reps: {
        Row: {
          id: string;
          created_at: string;
          updated_at: string;
          name: string;
          email: string | null;
          phone: string | null;
          is_active: boolean;
          max_open_leads: number;
        };
        Insert: {
          id?: string;
          created_at?: string;
          updated_at?: string;
          name: string;
          email?: string | null;
          phone?: string | null;
          is_active?: boolean;
          max_open_leads?: number;
        };
        Update: {
          id?: string;
          created_at?: string;
          updated_at?: string;
          name?: string;
          email?: string | null;
          phone?: string | null;
          is_active?: boolean;
          max_open_leads?: number;
        };
        Relationships: [];
      };
      site_visits: {
        Row: {
          id: string;
          created_at: string;
          updated_at: string;
          lead_id: string;
          rep_id: string | null;
          scheduled_for: string | null;
          completed_at: string | null;
          status: SiteVisitStatus;
          notes: string | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          updated_at?: string;
          lead_id: string;
          rep_id?: string | null;
          scheduled_for?: string | null;
          completed_at?: string | null;
          status?: SiteVisitStatus;
          notes?: string | null;
        };
        Update: {
          id?: string;
          created_at?: string;
          updated_at?: string;
          lead_id?: string;
          rep_id?: string | null;
          scheduled_for?: string | null;
          completed_at?: string | null;
          status?: SiteVisitStatus;
          notes?: string | null;
        };
        Relationships: [];
      };
      follow_ups: {
        Row: {
          id: string;
          created_at: string;
          updated_at: string;
          lead_id: string;
          rep_id: string | null;
          due_at: string;
          channel: string;
          message: string | null;
          status: FollowUpStatus;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          updated_at?: string;
          lead_id: string;
          rep_id?: string | null;
          due_at: string;
          channel?: string;
          message?: string | null;
          status?: FollowUpStatus;
          completed_at?: string | null;
        };
        Update: {
          id?: string;
          created_at?: string;
          updated_at?: string;
          lead_id?: string;
          rep_id?: string | null;
          due_at?: string;
          channel?: string;
          message?: string | null;
          status?: FollowUpStatus;
          completed_at?: string | null;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      LeadStage: LeadStage;
      InterestLabel: InterestLabel;
      SiteVisitStatus: SiteVisitStatus;
      FollowUpStatus: FollowUpStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};

