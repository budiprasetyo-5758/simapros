// Pembaca snapshot penilaian prioritas untuk keperluan TAMPILAN.
//
// Satu layar bisa menampilkan snapshot dari dua metode sekaligus: HTO-T2-1.0
// (7 kriteria, skala 1-5) dan HTO-SOP-2026.1 (5 kriteria, skala 1-10, proyek
// mandatory tanpa skor sama sekali). Tanpa lapisan ini, setiap layar harus
// mengulang logika yang sama dan satu saja yang lupa akan menampilkan
// "8.35 / 5.00" atau meledak pada `null.toFixed()`.
//
// ATURAN POKOK: skala maksimum dibaca dari `method_snapshot` milik baris itu
// sendiri, bukan dari konstanta frontend. Snapshot adalah sumber kebenaran
// tentang aturan yang berlaku saat keputusan dibuat; konstanta frontend
// mencerminkan aturan yang berlaku HARI INI. Mencampur keduanya membuat angka
// keputusan lama berubah arti secara senyap saat metode diperbarui.

import type {
  PriorityFinalDecision,
  PriorityQuadrant,
  PriorityRecommendation,
} from '@/types/priorityAssessment';

export const LEGACY_METHOD_VERSION = 'HTO-T2-1.0';
export const SOP_2026_METHOD_VERSION = 'HTO-SOP-2026.1';

const LEGACY_SCALE_MAX = 5;
const LEGACY_CRITERION_KEYS = ['k1', 'k2', 'k3', 'k4', 'k5', 'k6', 'k7'];

// Supabase mengembalikan kolom numeric sebagai string. Angka yang tidak bisa
// dibaca menjadi null, bukan NaN, supaya kegagalan tampil sebagai "-" alih-alih
// menyebar sebagai NaN ke seluruh kartu.
export function toFiniteNumber(value?: number | string | null): number | null {
  const numberValue = typeof value === 'string' ? Number(value) : value;
  return typeof numberValue === 'number' && Number.isFinite(numberValue) ? numberValue : null;
}

export interface PriorityAssessmentSnapshotLike {
  method_version?: string | null;
  method_snapshot?: unknown;
  is_mandatory?: boolean | null;
  impact_score?: number | string | null;
  score_percent?: number | string | null;
  priority_index?: number | string | null;
  priority_quadrant?: PriorityQuadrant | null;
  quadrant?: PriorityQuadrant | null;
  effort?: number | string | null;
  eligibility_status?: string | null;
  financial_gate_status?: string | null;
  calculated_recommendation?: PriorityRecommendation | null;
  recommendation?: PriorityRecommendation | null;
  final_decision?: PriorityFinalDecision | null;
  scores?: Record<string, unknown> | null;
  revision_no?: number | null;
}

export interface PriorityAssessmentView {
  methodVersion: string;
  isSopMethod: boolean;
  isMandatory: boolean;
  scaleMax: number;
  criterionKeys: string[];
  /** Label kolom skor; berbeda antar metode. */
  scoreLabel: string;
  /** "7.95 / 10.00", "3.55 / 5.00", atau "Priority 0" untuk proyek mandatory. */
  scoreText: string;
  scorePercent: number | null;
  priorityIndexText: string;
  effortText: string;
  quadrant: PriorityQuadrant | null;
  eligibilityLabel: string;
  financialGateLabel: string | null;
  recommendation: PriorityRecommendation | null;
  finalDecision: PriorityFinalDecision | null;
  /** Skor per kriteria, sudah diurutkan sesuai kriteria metodenya. */
  criterionScores: { key: string; score: number | null }[];
}

const eligibilityLabels: Record<string, string> = {
  eligible: 'Layak',
  ineligible: 'Tidak Layak',
  needs_probing: 'Perlu Klarifikasi',
};

const financialGateLabels: Record<string, string> = {
  approved: 'Lolos',
  gated: 'Ter-gate',
};

function readMethodSnapshot(snapshot: unknown): Record<string, unknown> | null {
  return snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot)
    ? (snapshot as Record<string, unknown>)
    : null;
}

export function buildPriorityAssessmentView(
  assessment: PriorityAssessmentSnapshotLike,
): PriorityAssessmentView {
  const methodVersion = assessment.method_version || LEGACY_METHOD_VERSION;
  const isSopMethod = methodVersion === SOP_2026_METHOD_VERSION;
  const snapshot = readMethodSnapshot(assessment.method_snapshot);

  const scaleMax = toFiniteNumber(snapshot?.scale_max as number | undefined)
    ?? (isSopMethod ? 10 : LEGACY_SCALE_MAX);

  const snapshotCriteria = readMethodSnapshot(snapshot?.criteria);
  const criterionKeys = snapshotCriteria
    ? Object.keys(snapshotCriteria)
    : isSopMethod
      ? ['k1', 'k2', 'k3', 'k4', 'k5']
      : LEGACY_CRITERION_KEYS;

  const impactScore = toFiniteNumber(assessment.impact_score);
  const priorityIndex = toFiniteNumber(assessment.priority_index);
  const effort = toFiniteNumber(assessment.effort);
  const isMandatory = Boolean(assessment.is_mandatory) || (isSopMethod && impactScore === null);

  const scorePercent = toFiniteNumber(assessment.score_percent)
    // Baris lama yang belum sempat di-backfill tetap bisa diperingkat.
    ?? (impactScore === null ? null : (impactScore / scaleMax) * 100);

  const rawScores = assessment.scores && typeof assessment.scores === 'object'
    ? (assessment.scores as Record<string, unknown>)
    : {};

  return {
    methodVersion,
    isSopMethod,
    isMandatory,
    scaleMax,
    criterionKeys,
    scoreLabel: isSopMethod ? 'Total Skor Akhir' : 'Skor Dampak Tertimbang',
    scoreText: isMandatory
      ? 'Priority 0'
      : impactScore === null
        ? '-'
        : `${impactScore.toFixed(2)} / ${scaleMax.toFixed(2)}`,
    scorePercent,
    priorityIndexText: priorityIndex === null ? '-' : priorityIndex.toFixed(3),
    effortText: effort === null ? '-' : `${effort} / 5`,
    quadrant: assessment.priority_quadrant ?? assessment.quadrant ?? null,
    eligibilityLabel: assessment.eligibility_status
      ? eligibilityLabels[assessment.eligibility_status] ?? assessment.eligibility_status
      : '-',
    financialGateLabel: assessment.financial_gate_status
      ? financialGateLabels[assessment.financial_gate_status] ?? assessment.financial_gate_status
      : null,
    recommendation: assessment.calculated_recommendation ?? assessment.recommendation ?? null,
    finalDecision: assessment.final_decision ?? null,
    criterionScores: criterionKeys.map((key) => ({
      key,
      score: toFiniteNumber(rawScores[key] as number | string | undefined),
    })),
  };
}
