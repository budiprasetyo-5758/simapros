// Metode prioritas HTO-T2-1.0 (7 kriteria skala 1-5) — DIPENSIUNKAN sebagai
// metode penilaian sejak SOP/HTO/001/2026 berlaku. Lihat `sopPriority2026.ts`
// untuk metode yang aktif.
//
// Berkas ini tetap ada karena dua alasan:
//
// 1. RENDERER SNAPSHOT LAMA. Keputusan yang sudah diambil dengan metode ini
//    tersimpan permanen dan tidak boleh dihitung ulang. Bobot, jangkar, dan
//    ambang di bawah adalah aturan yang berlaku saat keputusan itu dibuat.
//
// 2. KONSTANTA & REGISTRY BERSAMA. `EFFORT_BARS`, `PRIORITY_GATES`,
//    `recommendationConfig`, dan `finalDecisionConfig` dipakai kedua metode —
//    skala Effort dan daftar gate tidak berubah oleh SOP, dan satu layar bisa
//    menampilkan snapshot dari kedua metode sekaligus.
//
// RPC `record_tier2_priority_assessment` sudah dicabut hak EXECUTE-nya
// (_batch9_sop2026_priority.sql BAGIAN 5), jadi fungsi kalkulasi di sini tidak
// lagi menghasilkan keputusan baru.

import type {
  LegacyPriorityFinalDecision,
  LegacyPriorityRecommendation,
  PriorityAssessmentDraft,
  PriorityAssessmentResult,
  PriorityAssessmentSubmission,
  PriorityCriterionKey,
  PriorityEligibilityPreviewStatus,
  PriorityFinalDecision,
  PriorityGateKey,
  PriorityGates,
  PriorityQuadrant,
  PriorityRecommendation,
  PriorityScore,
  PriorityScores,
} from '@/types/priorityAssessment';
import { PRIORITY_CRITERION_KEYS, PRIORITY_GATE_KEYS } from '@/types/priorityAssessment';

export const PRIORITY_METHOD_VERSION = 'HTO-T2-1.0';

export const PRIORITY_WEIGHTS: Record<PriorityCriterionKey, number> = {
  k1: 0.2,
  k2: 0.2,
  k3: 0.15,
  k4: 0.15,
  k5: 0.1,
  k6: 0.1,
  k7: 0.1,
};

export interface PriorityBarOption {
  score: PriorityScore;
  description: string;
}

export interface PriorityCriterionDefinition {
  key: PriorityCriterionKey;
  code: string;
  name: string;
  weight: number;
  indicator: string;
  evidenceHint: string;
  bars: PriorityBarOption[];
}

export const PRIORITY_CRITERIA: PriorityCriterionDefinition[] = [
  {
    key: 'k1',
    code: 'K1',
    name: 'Keselamatan Pasien & Risiko Klinis',
    weight: PRIORITY_WEIGHTS.k1,
    indicator: 'Pengurangan risiko medical error atau insiden keselamatan pasien.',
    evidenceHint: 'Contoh: risk register, laporan insiden, rekomendasi komite mutu, atau temuan KARS/JCI.',
    bars: [
      { score: 1, description: 'Tidak terkait keselamatan pasien; murni administratif.' },
      { score: 2, description: 'Berpotensi mengurangi risiko minor, tidak berdampak langsung ke pasien.' },
      { score: 3, description: 'Mendukung proses klinis rutin; mengurangi risiko insiden ringan.' },
      { score: 4, description: 'Mencegah insiden keselamatan pasien (KTD/KNC) berdampak sedang-mayor.' },
      { score: 5, description: 'Mencegah kejadian sentinel/katastropik, atau menindaklanjuti temuan kritikal KARS/JCI.' },
    ],
  },
  {
    key: 'k2',
    code: 'K2',
    name: 'Kepatuhan Regulasi & Mandat',
    weight: PRIORITY_WEIGHTS.k2,
    indicator: 'Kewajiban SATUSEHAT, RME, BPJS, akreditasi KARS/JCI, dan tenggatnya.',
    evidenceHint: 'Cantumkan regulasi/mandat, pasal atau surat terkait, tenggat, dan konsekuensinya.',
    bars: [
      { score: 1, description: 'Tidak terkait regulasi atau mandat apa pun.' },
      { score: 2, description: 'Mendukung kepatuhan internal (SOP RS), bukan mandat eksternal.' },
      { score: 3, description: 'Mendukung salah satu standar akreditasi KARS non-kritikal.' },
      { score: 4, description: 'Bagian dari mandat regulasi nasional bertenggat longgar (>12 bulan).' },
      { score: 5, description: 'Mandat nasional bertenggat dekat (<6 bulan) dengan konsekuensi sanksi/administratif.' },
    ],
  },
  {
    key: 'k3',
    code: 'K3',
    name: 'Keselarasan Strategis',
    weight: PRIORITY_WEIGHTS.k3,
    indicator: 'Keterkaitan dengan RSB atau roadmap transformasi digital Kemenkes.',
    evidenceHint: 'Cantumkan kode Program/Inisiatif RSB atau dokumen roadmap yang menjadi dasar.',
    bars: [
      { score: 1, description: 'Tidak selaras dengan RSB/Renstra atau roadmap digital Kemenkes.' },
      { score: 2, description: 'Mendukung operasional rutin 1 unit, tidak tercantum di RSB.' },
      { score: 3, description: 'Terkait salah satu Program RSB, namun bukan prioritas utama.' },
      { score: 4, description: 'Turunan langsung dari Inisiatif RSB berjalan dan memiliki kode Program terkait.' },
      { score: 5, description: 'Inisiatif utama/flagship RSB, atau bagian transformasi digital nasional Kemenkes.' },
    ],
  },
  {
    key: 'k4',
    code: 'K4',
    name: 'Dampak Operasional & Efisiensi',
    weight: PRIORITY_WEIGHTS.k4,
    indicator: 'Jumlah pengguna/unit terdampak dan potensi penghematan waktu atau proses.',
    evidenceHint: 'Contoh: baseline waktu proses, volume transaksi, jumlah pengguna/unit, atau analisis proses.',
    bars: [
      { score: 1, description: 'Berdampak pada kurang dari 1 unit kecil, tanpa perubahan proses kerja signifikan.' },
      { score: 2, description: 'Mempercepat proses di 1 unit dengan penghematan waktu minor.' },
      { score: 3, description: 'Berdampak pada beberapa unit terkait; penghematan waktu/proses cukup terasa.' },
      { score: 4, description: 'Berdampak lintas-instalasi/mayoritas layanan dan mengubah cara kerja signifikan.' },
      { score: 5, description: 'Berdampak ke seluruh rumah sakit; transformasi proses end-to-end.' },
    ],
  },
  {
    key: 'k5',
    code: 'K5',
    name: 'Urgensi / Cost of Delay',
    weight: PRIORITY_WEIGHTS.k5,
    indicator: 'Konsekuensi apabila proyek ditunda selama 6-12 bulan.',
    evidenceHint: 'Cantumkan tenggat, tren keluhan/insiden, potensi sanksi, atau dampak penundaan yang terukur.',
    bars: [
      { score: 1, description: 'Tidak ada konsekuensi berarti bila ditunda lebih dari 12 bulan.' },
      { score: 2, description: 'Penundaan menimbulkan ketidaknyamanan kecil dan mudah dimitigasi manual.' },
      { score: 3, description: 'Penundaan 6-12 bulan mulai berdampak pada kualitas layanan/pelaporan.' },
      { score: 4, description: 'Penundaan berisiko denda, keluhan pasien meningkat, atau tenggat regulasi mendekat.' },
      { score: 5, description: 'Penundaan segera berisiko pada keselamatan pasien, sanksi, atau kehilangan pendapatan.' },
    ],
  },
  {
    key: 'k6',
    code: 'K6',
    name: 'Dampak Finansial (ROI / Cost Avoidance)',
    weight: PRIORITY_WEIGHTS.k6,
    indicator: 'Pendapatan, penghematan biaya, atau penghindaran denda/klaim tertunda.',
    evidenceHint: 'Lampirkan perhitungan CBA/ROI, nilai klaim, biaya saat ini, atau asumsi finansial yang digunakan.',
    bars: [
      { score: 1, description: 'Tidak ada dampak finansial terukur; murni cost center.' },
      { score: 2, description: 'Penghematan/pendapatan kecil dengan ROI lebih dari 3 tahun.' },
      { score: 3, description: 'Penghematan setara 1-2 FTE atau ROI 1-3 tahun.' },
      { score: 4, description: 'Mencegah revenue leakage moderat, atau ROI kurang dari 1 tahun.' },
      { score: 5, description: 'Penghematan signifikan atau mencegah kerugian besar, denda, atau klaim BPJS ditolak.' },
    ],
  },
  {
    key: 'k7',
    code: 'K7',
    name: 'Interoperabilitas & Arsitektur',
    weight: PRIORITY_WEIGHTS.k7,
    indicator: 'Keselarasan dengan arsitektur SIMRS dan integrasi sistem yang ada.',
    evidenceHint: 'Contoh: diagram arsitektur, daftar integrasi/API, standar HL7/FHIR, atau review arsitek.',
    bars: [
      { score: 1, description: 'Sistem berdiri sendiri (silo) dan tidak terhubung ke SIMRS.' },
      { score: 2, description: 'Integrasi terbatas dan membutuhkan workaround manual/entri ganda.' },
      { score: 3, description: 'Terintegrasi dengan 1-2 sistem existing melalui API/standar umum.' },
      { score: 4, description: 'Terintegrasi penuh dengan SIMRS dan mendukung HL7/FHIR atau SATUSEHAT.' },
      { score: 5, description: 'Menjadi tulang punggung/platform integrasi bagi sistem-sistem lain.' },
    ],
  },
];

export const EFFORT_BARS: PriorityBarOption[] = [
  { score: 1, description: 'Sangat mudah — tim internal HTO, <1 bulan, tanpa vendor eksternal.' },
  { score: 2, description: 'Mudah — sedikit koordinasi lintas unit, 1-3 bulan.' },
  { score: 3, description: 'Sedang — koordinasi lintas unit, 3-6 bulan, mungkin butuh vendor pendukung.' },
  { score: 4, description: 'Sulit — banyak ketergantungan sistem, vendor eksternal, 6-12 bulan.' },
  { score: 5, description: 'Sangat sulit — infrastruktur baru, vendor pihak ketiga, >12 bulan, risiko tinggi.' },
];

export interface PriorityGateDefinition {
  key: PriorityGateKey;
  label: string;
  description: string;
}

export const PRIORITY_GATES: PriorityGateDefinition[] = [
  { key: 'proposal_complete', label: 'Kelengkapan Proposal', description: 'Ruang lingkup, tujuan, unit terdampak, business owner, dan PIC telah jelas.' },
  { key: 'regulatory_review', label: 'Review Regulasi', description: 'Klaim regulasi dan tenggat telah diverifikasi, atau dinyatakan tidak relevan.' },
  { key: 'patient_safety_review', label: 'Review Keselamatan Pasien', description: 'Risiko klinis dan mitigasinya telah ditelaah pihak yang berwenang.' },
  { key: 'cybersecurity_review', label: 'Review Keamanan Siber', description: 'Risiko keamanan, akses, vendor, dan kontrol minimum telah ditelaah.' },
  { key: 'privacy_data_review', label: 'Review Privasi & Data', description: 'Klasifikasi data, dasar pemrosesan, akses, retensi, dan privasi telah ditelaah.' },
  { key: 'architecture_review', label: 'Review Arsitektur', description: 'Kesesuaian dengan SIMRS, integrasi, standar, dan arah arsitektur telah diperiksa.' },
  { key: 'duplication_review', label: 'Pemeriksaan Duplikasi', description: 'Tidak menduplikasi sistem/proyek aktif, atau konsolidasi telah direncanakan.' },
  { key: 'sponsor_funding_confirmed', label: 'Sponsor & Pendanaan', description: 'Sponsor, business owner, sumber anggaran, dan komitmen unit telah dikonfirmasi.' },
];

// Registry tampilan untuk KEDUA metode. Empat nilai pertama milik HTO-T2-1.0,
// tiga terakhir milik HTO-SOP-2026.1. Karena bertipe Record atas union penuh,
// TypeScript akan menolak kompilasi bila suatu keluaran kalkulator belum punya
// label — jaring pengaman utama saat menambah nilai baru.
export const recommendationConfig: Record<PriorityRecommendation, { label: string; description: string; className: string }> = {
  go: {
    label: 'GO — Kandidat Prioritas Tinggi',
    description: 'Dampak tinggi. Ajukan untuk pengesahan Steering Committee dan penjadwalan eksekusi.',
    className: 'border-success/30 bg-success/10 text-success',
  },
  conditional_go: {
    label: 'CONDITIONAL GO — Layak Bersyarat',
    description: 'Layak dilanjutkan setelah syarat, validasi, atau dependensi yang ditetapkan dipenuhi.',
    className: 'border-primary/30 bg-primary/10 text-primary',
  },
  defer: {
    label: 'DEFER — Belum Diprioritaskan',
    description: 'Tunda pada periode berjalan, perbaiki proposal atau tempatkan pada roadmap berikutnya.',
    className: 'border-warning/30 bg-warning/10 text-warning',
  },
  no_go: {
    label: 'NO-GO — Tidak Direkomendasikan',
    description: 'Tidak direkomendasikan saat ini. Penolakan formal tetap merupakan keputusan Steering Committee.',
    className: 'border-destructive/30 bg-destructive/10 text-destructive',
  },
  mandatory: {
    label: 'MANDATORY — Priority 0 (Fast Track)',
    description: 'Lolos Tahap 1 SOP: kewajiban regulasi, akreditasi/BPJS, atau pencegahan risiko kritis. Menempati puncak Master Queue tanpa skoring.',
    className: 'border-destructive/30 bg-destructive/10 text-destructive',
  },
  queued: {
    label: 'MASTER QUEUE',
    description: 'Lolos gate finansial. Diurutkan bersama proyek lain menurut Total Skor Akhir.',
    className: 'border-success/30 bg-success/10 text-success',
  },
  gated: {
    label: 'GATED — Under Review / Pending',
    description: 'Skor K3 ≤ 3. Menunggu justifikasi ulang atau diskresi Direksi; belum masuk urutan Master Queue.',
    className: 'border-warning/30 bg-warning/10 text-warning',
  },
};

export const finalDecisionConfig: Record<PriorityFinalDecision, { label: string; description: string }> = {
  approved: { label: 'Disetujui', description: 'Masuk portofolio dan penjadwalan eksekusi.' },
  conditional: { label: 'Disetujui Bersyarat', description: 'Masuk portofolio setelah seluruh syarat dipenuhi.' },
  deferred: { label: 'Ditunda', description: 'Belum masuk periode berjalan; dapat ditinjau kembali.' },
  rejected: { label: 'Ditolak', description: 'Ditutup berdasarkan keputusan formal Steering Committee.' },
  gated: { label: 'Ter-gate (Under Review)', description: 'Ditahan gate finansial; menunggu justifikasi ulang atau diskresi Direksi.' },
};

export function createEmptyPriorityAssessmentDraft(): PriorityAssessmentDraft {
  return {
    scores: {},
    justifications: {},
    evidence: {},
    effort: undefined,
    gates: {},
    eligibilityNotes: '',
  };
}

function round(value: number, precision: number): number {
  const factor = 10 ** precision;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function calculateWeightedScore(scores: Partial<PriorityScores>): number | null {
  if (!PRIORITY_CRITERION_KEYS.every((key) => scores[key] !== undefined)) return null;
  const total = PRIORITY_CRITERION_KEYS.reduce(
    (sum, key) => sum + (scores[key] as PriorityScore) * PRIORITY_WEIGHTS[key],
    0,
  );
  return round(total, 2);
}

export function getEligibilityStatus(gates: Partial<PriorityGates>): PriorityEligibilityPreviewStatus {
  if (PRIORITY_GATE_KEYS.some((key) => gates[key] === false)) return 'ineligible';
  if (PRIORITY_GATE_KEYS.every((key) => gates[key] === true)) return 'eligible';
  return 'pending';
}

export function getRecommendation(weightedScore: number, eligibility: PriorityEligibilityPreviewStatus): LegacyPriorityRecommendation | null {
  if (eligibility === 'ineligible') return 'no_go';
  if (eligibility !== 'eligible') return null;
  if (weightedScore >= 3.5) return 'go';
  if (weightedScore >= 3) return 'conditional_go';
  if (weightedScore >= 2.5) return 'defer';
  return 'no_go';
}

export function calculatePriorityQuadrant(weightedScore: number, effort: PriorityScore): PriorityQuadrant {
  const highImpact = weightedScore >= 3.5;
  const highEffort = effort >= 4;
  if (highImpact) return highEffort ? 'big_bet' : 'quick_win';
  return highEffort ? 'thankless' : 'fill_in';
}

export function calculatePriorityAssessment(draft: PriorityAssessmentDraft): PriorityAssessmentResult {
  const weightedScore = calculateWeightedScore(draft.scores);
  const eligibilityStatus = getEligibilityStatus(draft.gates);
  const failedGates = PRIORITY_GATE_KEYS.filter((key) => draft.gates[key] === false);
  const priorityIndex = weightedScore !== null && draft.effort
    ? round(weightedScore / draft.effort, 3)
    : null;

  return {
    weightedScore,
    priorityIndex,
    recommendation: weightedScore === null ? (eligibilityStatus === 'ineligible' ? 'no_go' : null) : getRecommendation(weightedScore, eligibilityStatus),
    eligibilityStatus,
    quadrant: weightedScore !== null && draft.effort
      ? calculatePriorityQuadrant(weightedScore, draft.effort)
      : null,
    completedCriteria: PRIORITY_CRITERION_KEYS.filter((key) => draft.scores[key] !== undefined).length,
    assessedGates: PRIORITY_GATE_KEYS.filter((key) => draft.gates[key] !== undefined).length,
    failedGates,
  };
}

export function mapRecommendationToFinalDecision(
  recommendation: LegacyPriorityRecommendation,
): LegacyPriorityFinalDecision {
  const mapping: Record<LegacyPriorityRecommendation, LegacyPriorityFinalDecision> = {
    go: 'approved',
    conditional_go: 'conditional',
    defer: 'deferred',
    no_go: 'rejected',
  };
  return mapping[recommendation];
}

export function getPriorityAssessmentValidationErrors(draft: PriorityAssessmentDraft): string[] {
  const errors: string[] = [];
  const missingCriteria = PRIORITY_CRITERIA.filter(({ key }) => draft.scores[key] === undefined);
  if (missingCriteria.length) errors.push(`${missingCriteria.length} kriteria dampak belum dinilai.`);

  const missingJustifications = PRIORITY_CRITERIA.filter(
    ({ key }) => draft.scores[key] !== undefined && !draft.justifications[key]?.trim(),
  );
  if (missingJustifications.length) errors.push(`Konteks penilaian wajib diisi untuk ${missingJustifications.map((item) => item.code).join(', ')}.`);

  const missingEvidence = PRIORITY_CRITERIA.filter(
    ({ key }) => (draft.scores[key] ?? 0) >= 4 && !draft.evidence[key]?.trim(),
  );
  if (missingEvidence.length) errors.push(`Bukti wajib untuk skor 4-5 pada ${missingEvidence.map((item) => item.code).join(', ')}.`);

  if (!draft.effort) errors.push('Effort/kompleksitas belum dinilai.');
  if (draft.effort && !draft.justifications.effort?.trim()) errors.push('Dasar penilaian Effort wajib diisi.');
  if ((draft.effort ?? 0) >= 4 && !draft.evidence.effort?.trim()) errors.push('Bukti/dependensi wajib untuk Effort 4-5.');

  const missingGates = PRIORITY_GATES.filter(({ key }) => draft.gates[key] === undefined);
  if (missingGates.length) errors.push(`${missingGates.length} gate kelayakan belum diperiksa.`);
  if (PRIORITY_GATE_KEYS.some((key) => draft.gates[key] === false) && !draft.eligibilityNotes.trim()) {
    errors.push('Catatan kelayakan wajib diisi karena terdapat gate yang tidak lulus.');
  }
  return errors;
}

export function toPriorityAssessmentSubmission(
  draft: PriorityAssessmentDraft,
  decision: Omit<PriorityAssessmentSubmission, 'scores' | 'justifications' | 'evidence' | 'effort' | 'gates' | 'eligibility_notes'>,
): PriorityAssessmentSubmission | null {
  if (getPriorityAssessmentValidationErrors(draft).length) return null;
  if (!decision.final_decision_note.trim()) return null;

  const result = calculatePriorityAssessment(draft);
  if (!result.recommendation) return null;
  const recommendedDecision = mapRecommendationToFinalDecision(result.recommendation);
  if (decision.final_decision !== recommendedDecision && !decision.override_reason?.trim()) return null;
  if (
    decision.final_decision === 'deferred' &&
    (!decision.priority_note.trim() || !decision.proposed_start_date || !decision.proposed_end_date)
  ) return null;

  return {
    scores: draft.scores as PriorityScores,
    justifications: draft.justifications,
    evidence: draft.evidence,
    effort: draft.effort as PriorityScore,
    gates: draft.gates as PriorityGates,
    eligibility_notes: draft.eligibilityNotes.trim(),
    ...decision,
    final_decision_note: decision.final_decision_note.trim(),
    priority_note: decision.priority_note.trim(),
    override_reason: decision.override_reason?.trim() || null,
  };
}

export function buildPriorityAssessmentRationale(draft: PriorityAssessmentDraft): string {
  const result = calculatePriorityAssessment(draft);
  const scoreLines = PRIORITY_CRITERIA.flatMap((criterion) => {
    const score = draft.scores[criterion.key];
    if (!score) return [];
    const anchor = criterion.bars.find((option) => option.score === score)?.description ?? '';
    return `${criterion.code} ${criterion.name} (${Math.round(criterion.weight * 100)}%): ${score}/5 — ${anchor}`;
  });
  const effortAnchor = EFFORT_BARS.find((option) => option.score === draft.effort)?.description;
  const resultLine = result.weightedScore !== null
    ? `Hasil: skor dampak ${result.weightedScore.toFixed(2)}/5.00; Effort ${draft.effort ?? '-'}; Priority Index ${result.priorityIndex?.toFixed(3) ?? '-'}; rekomendasi ${result.recommendation ? recommendationConfig[result.recommendation].label : 'belum lengkap'}.`
    : 'Hasil: penilaian belum lengkap.';
  return [...scoreLines, effortAnchor ? `Effort: ${draft.effort}/5 — ${effortAnchor}` : '', resultLine]
    .filter(Boolean)
    .join('\n');
}
