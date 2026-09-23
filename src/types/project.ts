import type { Urgency, Impact, EffortScore, Quadrant } from '@/lib/priorityMatrix';
import type {
  PriorityEligibilityStatus,
  PriorityFinalDecision,
  PriorityGates,
  PriorityEvidence,
  PriorityNarratives,
  PriorityQuadrant,
  PriorityRecommendation,
} from '@/types/priorityAssessment';
import type { SopMandatoryKey, SopProbingSession } from '@/types/sopPriority2026';

export type ProjectStatus = 'pending' | 'approved' | 'rejected' | 'revision' | 'active' | 'pending_creation' | 'deprioritized' | 'withdrawn';
export type ProjectPriority = 'low' | 'medium' | 'high' | 'urgent';
export type ProjectStage = 'planning' | 'execution' | 'evaluation' | 'followup';
export type ProjectImpact = 'low' | 'medium' | 'high' | 'critical';
export type ProjectProgressStatus = 'in_progress' | 'on_hold' | 'completed';
export type AppRole = 'super_admin' | 'admin' | 'project_executor' | 'user';

export type TaskStatus = 'not_started' | 'in_progress' | 'completed' | 'pending';

export type RequesterDecision = 'accepted' | 'withdrawn';

export interface ProjectPriorityAssessment {
  id: string;
  project_id: string;
  revision_no: number;
  method_version: string;
  method_snapshot: unknown;
  // Bentuk `scores` bergantung method_version: k1-k7 skala 1-5 pada
  // HTO-T2-1.0, k1-k5 skala 1-10 pada HTO-SOP-2026.1, dan objek kosong pada
  // proyek mandatory yang melewati skoring. Jangan mengetatkan tipe ini ke satu
  // metode — pakai buildPriorityAssessmentView() untuk membacanya.
  scores: Record<string, number>;
  justifications: PriorityNarratives;
  evidence: PriorityEvidence;
  effort: number | null;
  gates: Partial<PriorityGates>;
  eligibility_notes: string | null;
  intake_snapshot: unknown;
  governance_snapshot: unknown;
  // NULL untuk proyek mandatory (Priority 0): SOP melewati skoring sepenuhnya,
  // jadi tidak ada angka yang boleh ditampilkan sebagai peringkatnya.
  impact_score: number | null;
  score_percent: number | null;
  priority_index: number | null;
  priority_quadrant: PriorityQuadrant | null;
  eligibility_status: PriorityEligibilityStatus;
  calculated_recommendation: PriorityRecommendation;
  recommendation_reasons: string[];
  // Hasil Tahap 1 SOP. Selalu false pada snapshot HTO-T2-1.0.
  is_mandatory: boolean;
  mandatory_answers: Partial<Record<SopMandatoryKey, { answer: boolean; basis: string }>>;
  financial_gate_status: 'approved' | 'gated' | null;
  probing_session: Partial<SopProbingSession>;
  final_decision: PriorityFinalDecision;
  final_decision_note: string;
  override_reason: string | null;
  priority_note: string | null;
  technical_notes?: string | null;
  proposed_start_date: string | null;
  proposed_end_date: string | null;
  assessed_by: string;
  assessed_at: string;
  decided_by: string;
  decided_at: string;
  created_at: string;
}

export interface ProjectObstacle {
  id: string;
  project_id: string;
  note: string;
  is_resolved: boolean;
  created_at: string;
  created_by?: string | null;
  updated_at: string;
}

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
  // Diisi oleh useGanttTasks saat memetakan baris DB (useProjects.tsx:435) dan
  // dibaca SpreadsheetGantt untuk mengurutkan task tanpa wbs_number.
  created_at?: string;
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
  urgency?: Urgency;
  impact?: Impact;
  // Urgensi yang dideklarasikan pengaju saat intake. Hanya usulan — nilai resmi
  // ada di `urgency` dan ditetapkan HTO saat evaluasi.
  urgency_claimed?: Urgency | null;
  // Effort/kompleksitas (1-5). Arah skala berkebalikan dari kriteria dampak:
  // skor tinggi = SULIT dikerjakan.
  effort?: EffortScore | null;
  priority_quadrant?: Quadrant | null;
  // Gerbang prioritas: dibekukan saat keputusan dibuat, bukan dihitung saat dibaca
  is_priority?: boolean | null;
  // Dasar penilaian turunan jangkar BARS. Dibekukan sebagai teks agar revisi
  // kalimat jangkar di kemudian hari tidak mengubah alasan keputusan lama.
  priority_rationale?: string | null;
  // Konteks spesifik proyek yang ditulis HTO untuk unit pengaju. Berbeda peran
  // dari priority_rationale di atas.
  priority_note?: string | null;
  priority_set_by?: string | null;
  priority_set_at?: string | null;
  current_priority_assessment_id?: string | null;
  current_priority_assessment?: ProjectPriorityAssessment | null;
  // Tanggal tindak lanjut HTO untuk proyek yang diputuskan Ditunda; disalin ke
  // start_date/end_date saat pengaju menerima
  proposed_start_date?: string | null;
  proposed_end_date?: string | null;
  requester_decision?: RequesterDecision | null;
  requester_decision_at?: string | null;
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
  pic?: string | null;
  project_obstacles?: ProjectObstacle[];
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
