// Tipe metode prioritas SOP/HTO/001/2026 rev 02 (HTO-SOP-2026.1).
//
// Dipisah dari `priorityAssessment.ts` karena skala dan himpunan kriterianya
// berbeda: 5 kriteria skala 1-10, bukan 7 kriteria skala 1-5. Tipe yang dipakai
// bersama kedua metode (keputusan final, gate, kuadran) tetap tinggal di
// `priorityAssessment.ts` dan hanya diperluas nilainya di sana.

import type { EffortScore, Quadrant } from '@/lib/priorityMatrix';
import type { PriorityGateKey, PriorityGates, PriorityFinalDecision } from '@/types/priorityAssessment';

export const SOP_CRITERION_KEYS = ['k1', 'k2', 'k3', 'k4', 'k5'] as const;
export type SopCriterionKey = (typeof SOP_CRITERION_KEYS)[number];

// Kriteria pemegang gate finansial (SOP 5.2). Dijadikan konstanta agar aturan
// gate tidak tersebar sebagai string 'k3' di banyak tempat.
export const SOP_FINANCIAL_CRITERION: SopCriterionKey = 'k3';
export const SOP_FINANCIAL_GATE_MAX = 3;

export const SOP_MANDATORY_KEYS = ['regulasi', 'akreditasi_bpjs', 'risiko_kritis'] as const;
export type SopMandatoryKey = (typeof SOP_MANDATORY_KEYS)[number];

export type SopScore = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
export type SopScores = Record<SopCriterionKey, SopScore>;
export type SopScoreDraft = Partial<SopScores>;

export type SopNarrativeKey = SopCriterionKey | 'effort';
export type SopNarratives = Partial<Record<SopNarrativeKey, string>>;
export type SopEvidence = SopNarratives & { proposal_attachment_url?: string };

// `answer` boleh undefined selama pengisian: SOP menuntut jawaban eksplisit,
// jadi tidak ada nilai awal yang bisa lolos tanpa disentuh penilai.
export interface SopMandatoryAnswerDraft {
  answer?: boolean;
  basis: string;
}
export type SopMandatoryDraft = Record<SopMandatoryKey, SopMandatoryAnswerDraft>;
export type SopMandatoryAnswers = Record<SopMandatoryKey, { answer: boolean; basis: string }>;

export interface SopProbingSession {
  date: string;
  participants: string;
  notes: string;
}

export type SopFinancialGateStatus = 'approved' | 'gated';
export type SopEligibilityStatus = 'eligible' | 'needs_probing';

// Keluaran kalkulator SOP. Sengaja hanya tiga: SOP tidak menetapkan ambang
// GO/Defer/No-Go, dan penolakan formal selalu keputusan manusia (SOP 5.3).
export type SopRecommendation = 'mandatory' | 'queued' | 'gated';

export interface SopAssessmentDraft {
  mandatory: SopMandatoryDraft;
  scores: SopScoreDraft;
  justifications: SopNarratives;
  evidence: SopEvidence;
  effort?: EffortScore;
  gates: Partial<PriorityGates>;
  eligibilityNotes: string;
  probing: SopProbingSession;
}

export interface SopAssessmentResult {
  isMandatory: boolean;
  mandatoryReasons: SopMandatoryKey[];
  mandatoryAnswered: number;
  totalScore: number | null;
  scorePercent: number | null;
  priorityIndex: number | null;
  quadrant: Quadrant | null;
  financialGate: SopFinancialGateStatus | null;
  eligibilityStatus: SopEligibilityStatus;
  incompleteGates: PriorityGateKey[];
  recommendation: SopRecommendation | null;
  completedCriteria: number;
  assessedGates: number;
}

export interface SopAssessmentSubmission {
  mandatory_answers: SopMandatoryAnswers;
  scores: SopScoreDraft;
  justifications: SopNarratives;
  evidence: SopEvidence;
  effort: EffortScore | null;
  gates: Partial<PriorityGates>;
  probing_session: SopProbingSession;
  eligibility_notes: string;
  priority_note: string;
  proposed_start_date: string | null;
  proposed_end_date: string | null;
  final_decision: PriorityFinalDecision;
  final_decision_note: string;
  override_reason: string | null;
}

export interface SopAssessmentDecisionPayload {
  assessment: SopAssessmentSubmission;
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
