export const PRIORITY_CRITERION_KEYS = ['k1', 'k2', 'k3', 'k4', 'k5', 'k6', 'k7'] as const;
export type PriorityCriterionKey = (typeof PRIORITY_CRITERION_KEYS)[number];

export const PRIORITY_GATE_KEYS = [
  'proposal_complete',
  'regulatory_review',
  'patient_safety_review',
  'cybersecurity_review',
  'privacy_data_review',
  'architecture_review',
  'duplication_review',
  'sponsor_funding_confirmed',
] as const;
export type PriorityGateKey = (typeof PRIORITY_GATE_KEYS)[number];

export type PriorityScore = 1 | 2 | 3 | 4 | 5;
export type PriorityScores = Record<PriorityCriterionKey, PriorityScore>;
export type PriorityScoreDraft = Partial<PriorityScores>;

export type PriorityNarrativeKey = PriorityCriterionKey | 'effort';
export type PriorityNarratives = Partial<Record<PriorityNarrativeKey, string>>;
export type PriorityEvidence = PriorityNarratives & { proposal_attachment_url?: string };

export type PriorityGates = Record<PriorityGateKey, boolean>;
export type PriorityGateDraft = Partial<PriorityGates>;

export type PriorityEligibilityStatus = 'eligible' | 'ineligible' | 'needs_probing';
export type PriorityEligibilityPreviewStatus = PriorityEligibilityStatus | 'pending';

// Keluaran kalkulator metode lama HTO-T2-1.0. Dipisah dari union lebar di
// bawahnya supaya fungsi metode lama tidak diam-diam menerima nilai SOP.
export type LegacyPriorityRecommendation = 'go' | 'conditional_go' | 'defer' | 'no_go';
export type LegacyPriorityFinalDecision = 'approved' | 'conditional' | 'deferred' | 'rejected';

// Union lebar untuk RENDER: satu layar bisa menampilkan snapshot metode lama
// maupun SOP 2026, jadi registry label/warna harus mengenal keduanya.
export type PriorityRecommendation = LegacyPriorityRecommendation | 'mandatory' | 'queued' | 'gated';
export type PriorityFinalDecision = LegacyPriorityFinalDecision | 'gated';
export type PriorityQuadrant = 'quick_win' | 'big_bet' | 'fill_in' | 'thankless';

export interface PriorityAssessmentDraft {
  scores: PriorityScoreDraft;
  justifications: PriorityNarratives;
  evidence: PriorityEvidence;
  effort?: PriorityScore;
  gates: PriorityGateDraft;
  eligibilityNotes: string;
}

export interface PriorityAssessmentResult {
  weightedScore: number | null;
  priorityIndex: number | null;
  recommendation: LegacyPriorityRecommendation | null;
  eligibilityStatus: PriorityEligibilityPreviewStatus;
  quadrant: PriorityQuadrant | null;
  completedCriteria: number;
  assessedGates: number;
  failedGates: PriorityGateKey[];
}

export interface PriorityAssessmentSubmission {
  scores: PriorityScores;
  justifications: PriorityNarratives;
  evidence: PriorityEvidence;
  effort: PriorityScore;
  gates: PriorityGates;
  eligibility_notes: string;
  priority_note: string;
  proposed_start_date: string | null;
  proposed_end_date: string | null;
  final_decision: LegacyPriorityFinalDecision;
  final_decision_note: string;
  override_reason: string | null;
}

export interface PriorityAssessmentDecisionPayload {
  assessment: PriorityAssessmentSubmission;
  editedData: {
    title: string;
    description: string;
    unit: string;
    start_date: string;
    end_date: string;
    pic: string;
  };
  technicalNotes: string;
}
