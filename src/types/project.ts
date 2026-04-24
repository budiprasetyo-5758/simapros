export type ProjectStatus = 'pending' | 'approved' | 'rejected' | 'revision' | 'active' | 'pending_creation';
export type ProjectPriority = 'low' | 'medium' | 'high' | 'urgent';
export type ProjectStage = 'planning' | 'execution' | 'evaluation' | 'followup';
export type ProjectImpact = 'low' | 'medium' | 'high' | 'critical';
export type ProjectProgressStatus = 'in_progress' | 'on_hold' | 'completed';
export type AppRole = 'super_admin' | 'admin' | 'project_executor' | 'user';

export type TaskStatus = 'not_started' | 'in_progress' | 'completed' | 'pending';

export interface GanttTask {
  id: string;
  project_id: string;
  name: string;
  description: string;
  pic: string;
  start_date: string;
  end_date: string;
  progress: number;
  status: TaskStatus;
  wbs_number: string;
  monev: string;
  phase: string;
  parent_task_id?: string | null;
  deliverable_result?: string;
  problem?: string;
}

export interface StageNotes {
  planning: string;
  execution: string;
  evaluation: string;
  followup: string;
}

export interface MasterProyek {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  title: string;
  description: string;
  unit: string;
  requester_id: string;
  requester_name: string;
  status: ProjectStatus;
  priority: ProjectPriority;
  urgency?: string;
  impact?: string;
  admin_note?: string;
  project_stage: ProjectStage;
  stage_notes: StageNotes;
  start_date?: string;
  end_date?: string;
  update_requested: boolean;
  master_proyek_id?: string;
  master_proyek?: MasterProyek;
  attachment_url?: string | null;
  progress_status?: ProjectProgressStatus;
   monev_summary?: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  whatsapp?: string | null;
  gmail?: string | null;
  unit_kerja_id?: string | null;
  profile_completed?: boolean;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
}

export interface ProjectUpdateRequest {
  id: string;
  project_id: string;
  requester_id: string;
  request_type: 'gantt_update' | 'pdca_update' | 'general_update';
  pending_changes: Record<string, unknown>;
  status: 'pending' | 'approved' | 'rejected';
  admin_note?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectUpdateLog {
  id: string;
  project_id: string;
  update_request_id?: string;
  changed_by: string;
  approved_by: string;
  change_type: string;
  old_data: Record<string, unknown>;
  new_data: Record<string, unknown>;
  created_at: string;
}
