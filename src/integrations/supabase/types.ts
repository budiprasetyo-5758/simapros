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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      daily_reports: {
        Row: {
          achievements: string | null
          ai_calculated_progress: number | null
          ai_reasoning: string | null
          attachment_url: string | null
          challenges: string | null
          created_at: string
          description: string
          id: string
          project_id: string
          report_date: string
          reporter_id: string
          task_id: string
          updated_at: string
        }
        Insert: {
          achievements?: string | null
          ai_calculated_progress?: number | null
          ai_reasoning?: string | null
          attachment_url?: string | null
          challenges?: string | null
          created_at?: string
          description: string
          id?: string
          project_id: string
          report_date?: string
          reporter_id: string
          task_id: string
          updated_at?: string
        }
        Update: {
          achievements?: string | null
          ai_calculated_progress?: number | null
          ai_reasoning?: string | null
          attachment_url?: string | null
          challenges?: string | null
          created_at?: string
          description?: string
          id?: string
          project_id?: string
          report_date?: string
          reporter_id?: string
          task_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_reports_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_reports_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "gantt_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      followup_files: {
        Row: {
          created_at: string
          file_category: string
          file_name: string
          file_size: number | null
          file_url: string
          id: string
          meeting_id: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          file_category: string
          file_name: string
          file_size?: number | null
          file_url: string
          id?: string
          meeting_id: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          file_category?: string
          file_name?: string
          file_size?: number | null
          file_url?: string
          id?: string
          meeting_id?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "followup_files_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "followup_meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      followup_meetings: {
        Row: {
          category: string
          created_at: string
          created_by: string
          id: string
          meeting_date: string
          title: string | null
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          created_by: string
          id?: string
          meeting_date: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string
          id?: string
          meeting_date?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      followup_tasks: {
        Row: {
          completed_at: string | null
          created_at: string
          due_date: string
          id: string
          is_completed: boolean
          meeting_id: string
          pic: string
          title: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          due_date: string
          id?: string
          is_completed?: boolean
          meeting_id: string
          pic: string
          title: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          due_date?: string
          id?: string
          is_completed?: boolean
          meeting_id?: string
          pic?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "followup_tasks_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "followup_meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      gantt_task_edit_requests: {
        Row: {
          admin_note: string | null
          created_at: string
          id: string
          is_delete_request: boolean | null
          is_new_task: boolean | null
          project_id: string
          proposed_deliverable_result: string | null
          proposed_description: string | null
          proposed_end_date: string | null
          proposed_monev: string | null
          proposed_name: string | null
          proposed_phase: string | null
          proposed_pic: string | null
          proposed_problem: string | null
          proposed_progress: number | null
          proposed_start_date: string | null
          proposed_status: string | null
          proposed_wbs_number: string | null
          requester_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          task_id: string | null
          updated_at: string
        }
        Insert: {
          admin_note?: string | null
          created_at?: string
          id?: string
          is_delete_request?: boolean | null
          is_new_task?: boolean | null
          project_id: string
          proposed_deliverable_result?: string | null
          proposed_description?: string | null
          proposed_end_date?: string | null
          proposed_monev?: string | null
          proposed_name?: string | null
          proposed_phase?: string | null
          proposed_pic?: string | null
          proposed_problem?: string | null
          proposed_progress?: number | null
          proposed_start_date?: string | null
          proposed_status?: string | null
          proposed_wbs_number?: string | null
          requester_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          task_id?: string | null
          updated_at?: string
        }
        Update: {
          admin_note?: string | null
          created_at?: string
          id?: string
          is_delete_request?: boolean | null
          is_new_task?: boolean | null
          project_id?: string
          proposed_deliverable_result?: string | null
          proposed_description?: string | null
          proposed_end_date?: string | null
          proposed_monev?: string | null
          proposed_name?: string | null
          proposed_phase?: string | null
          proposed_pic?: string | null
          proposed_problem?: string | null
          proposed_progress?: number | null
          proposed_start_date?: string | null
          proposed_status?: string | null
          proposed_wbs_number?: string | null
          requester_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          task_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gantt_task_edit_requests_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gantt_task_edit_requests_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "gantt_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      gantt_tasks: {
        Row: {
          ai_progress: number | null
          ai_progress_reasoning: string | null
          created_at: string
          deliverable_result: string | null
          description: string | null
          end_date: string
          id: string
          monev: string | null
          name: string
          parent_task_id: string | null
          phase: string
          pic: string | null
          problem: string | null
          progress: number | null
          progress_override: number | null
          progress_override_at: string | null
          progress_override_by: string | null
          project_id: string
          start_date: string
          status: string | null
          wbs_number: string | null
        }
        Insert: {
          ai_progress?: number | null
          ai_progress_reasoning?: string | null
          created_at?: string
          deliverable_result?: string | null
          description?: string | null
          end_date: string
          id?: string
          monev?: string | null
          name: string
          parent_task_id?: string | null
          phase?: string
          pic?: string | null
          problem?: string | null
          progress?: number | null
          progress_override?: number | null
          progress_override_at?: string | null
          progress_override_by?: string | null
          project_id: string
          start_date: string
          status?: string | null
          wbs_number?: string | null
        }
        Update: {
          ai_progress?: number | null
          ai_progress_reasoning?: string | null
          created_at?: string
          deliverable_result?: string | null
          description?: string | null
          end_date?: string
          id?: string
          monev?: string | null
          name?: string
          parent_task_id?: string | null
          phase?: string
          pic?: string | null
          problem?: string | null
          progress?: number | null
          progress_override?: number | null
          progress_override_at?: string | null
          progress_override_by?: string | null
          project_id?: string
          start_date?: string
          status?: string | null
          wbs_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gantt_tasks_parent_task_id_fkey"
            columns: ["parent_task_id"]
            isOneToOne: false
            referencedRelation: "gantt_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gantt_tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      master_proyek: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      meeting_todos: {
        Row: {
          completed_at: string | null
          converted_meeting_id: string | null
          created_at: string
          created_by: string
          description: string | null
          id: string
          is_completed: boolean
          project_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          converted_meeting_id?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          is_completed?: boolean
          project_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          converted_meeting_id?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          is_completed?: boolean
          project_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_todos_converted_meeting_id_fkey"
            columns: ["converted_meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_todos_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings: {
        Row: {
          attachment_url: string | null
          created_at: string
          created_by: string
          description: string
          google_calendar_event_id: string | null
          id: string
          meeting_date: string
          meeting_time: string
          project_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          attachment_url?: string | null
          created_at?: string
          created_by: string
          description?: string
          google_calendar_event_id?: string | null
          id?: string
          meeting_date: string
          meeting_time?: string
          project_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          attachment_url?: string | null
          created_at?: string
          created_by?: string
          description?: string
          google_calendar_event_id?: string | null
          id?: string
          meeting_date?: string
          meeting_time?: string
          project_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meetings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          created_at: string
          email_deadline_warning: boolean
          email_edit_request_approved: boolean
          email_edit_request_rejected: boolean
          email_monev_summary: boolean
          email_no_progress_reminder: boolean
          email_pending_reminder: boolean
          email_proposal_approved: boolean
          email_proposal_rejected: boolean
          email_proposal_revision: boolean
          email_task_overdue: boolean
          id: string
          reminder_days_before_deadline: number
          reminder_days_no_progress: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email_deadline_warning?: boolean
          email_edit_request_approved?: boolean
          email_edit_request_rejected?: boolean
          email_monev_summary?: boolean
          email_no_progress_reminder?: boolean
          email_pending_reminder?: boolean
          email_proposal_approved?: boolean
          email_proposal_rejected?: boolean
          email_proposal_revision?: boolean
          email_task_overdue?: boolean
          id?: string
          reminder_days_before_deadline?: number
          reminder_days_no_progress?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email_deadline_warning?: boolean
          email_edit_request_approved?: boolean
          email_edit_request_rejected?: boolean
          email_monev_summary?: boolean
          email_no_progress_reminder?: boolean
          email_pending_reminder?: boolean
          email_proposal_approved?: boolean
          email_proposal_rejected?: boolean
          email_proposal_revision?: boolean
          email_task_overdue?: boolean
          id?: string
          reminder_days_before_deadline?: number
          reminder_days_no_progress?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          message: string
          metadata: Json | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message: string
          metadata?: Json | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message?: string
          metadata?: Json | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      }
      pic_options: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          gmail: string | null
          gmail_verification_code: string | null
          gmail_verification_expires_at: string | null
          gmail_verified: boolean
          id: string
          name: string
          profile_completed: boolean
          unit_kerja_id: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          gmail?: string | null
          gmail_verification_code?: string | null
          gmail_verification_expires_at?: string | null
          gmail_verified?: boolean
          id: string
          name: string
          profile_completed?: boolean
          unit_kerja_id?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          gmail?: string | null
          gmail_verification_code?: string | null
          gmail_verification_expires_at?: string | null
          gmail_verified?: boolean
          id?: string
          name?: string
          profile_completed?: boolean
          unit_kerja_id?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_unit_kerja_id_fkey"
            columns: ["unit_kerja_id"]
            isOneToOne: false
            referencedRelation: "unit_kerja"
            referencedColumns: ["id"]
          },
        ]
      }
      project_assignments: {
        Row: {
          assigned_by: string
          created_at: string
          id: string
          project_id: string
          user_id: string
        }
        Insert: {
          assigned_by: string
          created_at?: string
          id?: string
          project_id: string
          user_id: string
        }
        Update: {
          assigned_by?: string
          created_at?: string
          id?: string
          project_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_assignments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_obstacles: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_resolved: boolean
          note: string
          project_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_resolved?: boolean
          note: string
          project_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_resolved?: boolean
          note?: string
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_obstacles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_obstacles_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          }
        ]
      }
      project_documents: {
        Row: {
          category: string
          created_at: string
          description: string | null
          document_name: string
          document_url: string
          id: string
          project_id: string
          updated_at: string
          uploaded_by: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          document_name: string
          document_url: string
          id?: string
          project_id: string
          updated_at?: string
          uploaded_by: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          document_name?: string
          document_url?: string
          id?: string
          project_id?: string
          updated_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_edit_requests: {
        Row: {
          admin_note: string | null
          created_at: string
          id: string
          project_id: string
          proposed_description: string | null
          proposed_end_date: string | null
          proposed_start_date: string | null
          proposed_title: string | null
          requester_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          admin_note?: string | null
          created_at?: string
          id?: string
          project_id: string
          proposed_description?: string | null
          proposed_end_date?: string | null
          proposed_start_date?: string | null
          proposed_title?: string | null
          requester_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          admin_note?: string | null
          created_at?: string
          id?: string
          project_id?: string
          proposed_description?: string | null
          proposed_end_date?: string | null
          proposed_start_date?: string | null
          proposed_title?: string | null
          requester_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_edit_requests_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_unit_kerja_assignments: {
        Row: {
          assigned_by: string
          created_at: string
          id: string
          project_id: string
          unit_kerja_id: string
        }
        Insert: {
          assigned_by: string
          created_at?: string
          id?: string
          project_id: string
          unit_kerja_id: string
        }
        Update: {
          assigned_by?: string
          created_at?: string
          id?: string
          project_id?: string
          unit_kerja_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_unit_kerja_assignments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_unit_kerja_assignments_unit_kerja_id_fkey"
            columns: ["unit_kerja_id"]
            isOneToOne: false
            referencedRelation: "unit_kerja"
            referencedColumns: ["id"]
          },
        ]
      }
      project_update_logs: {
        Row: {
          approved_by: string
          change_type: string
          changed_by: string
          created_at: string
          id: string
          new_data: Json
          old_data: Json
          project_id: string
          update_request_id: string | null
        }
        Insert: {
          approved_by: string
          change_type: string
          changed_by: string
          created_at?: string
          id?: string
          new_data?: Json
          old_data?: Json
          project_id: string
          update_request_id?: string | null
        }
        Update: {
          approved_by?: string
          change_type?: string
          changed_by?: string
          created_at?: string
          id?: string
          new_data?: Json
          old_data?: Json
          project_id?: string
          update_request_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_update_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_update_logs_update_request_id_fkey"
            columns: ["update_request_id"]
            isOneToOne: false
            referencedRelation: "project_update_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      project_update_requests: {
        Row: {
          admin_note: string | null
          created_at: string
          id: string
          pending_changes: Json
          project_id: string
          request_type: string
          requester_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          admin_note?: string | null
          created_at?: string
          id?: string
          pending_changes?: Json
          project_id: string
          request_type?: string
          requester_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          admin_note?: string | null
          created_at?: string
          id?: string
          pending_changes?: Json
          project_id?: string
          request_type?: string
          requester_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_update_requests_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          admin_note: string | null
          attachment_url: string | null
          created_at: string
          description: string
          end_date: string | null
          google_calendar_event_id: string | null
          id: string
          impact: string | null
          master_proyek_id: string | null
          monev_summary: string | null
          pending_reminder_days: number
          priority: Database["public"]["Enums"]["project_priority"]
          progress_status: string | null
          project_stage: Database["public"]["Enums"]["project_stage"]
          requester_id: string
          requester_name: string
          stage_notes: Json | null
          start_date: string | null
          status: Database["public"]["Enums"]["project_status"]
          title: string
          unit: string
          update_requested: boolean | null
          updated_at: string
          urgency: string | null
          pic: string | null
        }
        Insert: {
          admin_note?: string | null
          attachment_url?: string | null
          created_at?: string
          description: string
          end_date?: string | null
          google_calendar_event_id?: string | null
          id?: string
          impact?: string | null
          master_proyek_id?: string | null
          monev_summary?: string | null
          pending_reminder_days?: number
          priority?: Database["public"]["Enums"]["project_priority"]
          progress_status?: string | null
          project_stage?: Database["public"]["Enums"]["project_stage"]
          requester_id: string
          requester_name: string
          stage_notes?: Json | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          title: string
          unit: string
          update_requested?: boolean | null
          updated_at?: string
          urgency?: string | null
          pic?: string | null
        }
        Update: {
          admin_note?: string | null
          attachment_url?: string | null
          created_at?: string
          description?: string
          end_date?: string | null
          google_calendar_event_id?: string | null
          id?: string
          impact?: string | null
          master_proyek_id?: string | null
          monev_summary?: string | null
          pending_reminder_days?: number
          priority?: Database["public"]["Enums"]["project_priority"]
          progress_status?: string | null
          project_stage?: Database["public"]["Enums"]["project_stage"]
          requester_id?: string
          requester_name?: string
          stage_notes?: Json | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          title?: string
          unit?: string
          update_requested?: boolean | null
          updated_at?: string
          urgency?: string | null
          pic?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_master_proyek_id_fkey"
            columns: ["master_proyek_id"]
            isOneToOne: false
            referencedRelation: "master_proyek"
            referencedColumns: ["id"]
          },
        ]
      }
      unit_kerja: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      unit_kerja_change_requests: {
        Row: {
          admin_note: string | null
          created_at: string
          current_unit_kerja_id: string | null
          id: string
          reason: string | null
          requested_unit_kerja_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          created_at?: string
          current_unit_kerja_id?: string | null
          id?: string
          reason?: string | null
          requested_unit_kerja_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_note?: string | null
          created_at?: string
          current_unit_kerja_id?: string | null
          id?: string
          reason?: string | null
          requested_unit_kerja_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "unit_kerja_change_requests_current_unit_kerja_id_fkey"
            columns: ["current_unit_kerja_id"]
            isOneToOne: false
            referencedRelation: "unit_kerja"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unit_kerja_change_requests_requested_unit_kerja_id_fkey"
            columns: ["requested_unit_kerja_id"]
            isOneToOne: false
            referencedRelation: "unit_kerja"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_assigned_to_project: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      is_project_approved_or_active: {
        Args: { _project_id: string }
        Returns: boolean
      }
      is_project_owner: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user" | "super_admin" | "project_executor"
      calculated_priority: "low" | "medium" | "high" | "critical"
      project_impact: "minimal" | "minor" | "significant" | "severe"
      project_priority: "low" | "medium" | "high" | "urgent"
      project_stage: "planning" | "execution" | "evaluation" | "followup"
      project_status:
        | "pending"
        | "approved"
        | "rejected"
        | "revision"
        | "active"
        | "pending_creation"
      project_urgency: "very_low" | "low" | "medium" | "high"
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
    Enums: {
      app_role: ["admin", "user", "super_admin", "project_executor"],
      calculated_priority: ["low", "medium", "high", "critical"],
      project_impact: ["minimal", "minor", "significant", "severe"],
      project_priority: ["low", "medium", "high", "urgent"],
      project_stage: ["planning", "execution", "evaluation", "followup"],
      project_status: [
        "pending",
        "approved",
        "rejected",
        "revision",
        "active",
        "pending_creation",
      ],
      project_urgency: ["very_low", "low", "medium", "high"],
    },
  },
} as const
