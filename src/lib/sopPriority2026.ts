// Metode prioritas SOP/HTO/001/2026 rev 02 — HTO-SOP-2026.1
//
// Sumber angka dan seluruh kalimat rubrik di berkas ini adalah SOP Filtrasi,
// Panduan Probing, dan Penilaian Prioritas Proyek Transformasi & IT (Bab 6-8).
// Jangan mengarang jangkar baru: penilai mencocokkan kondisi proyek dengan
// kalimat yang PALING SESUAI, dan kalimat itu harus bisa ditelusuri ke SOP.
//
// Tiga hal yang membedakan metode ini dari HTO-T2-1.0 dan mudah salah dipahami:
//
// 1. TIDAK ADA AMBANG GO/DEFER/NO-GO. SOP hanya menetapkan tiga keluaran
//    kalkulator: mandatory, queued, gated. Penolakan formal selalu keputusan
//    manusia — SOP 5.3 melarang HTO menolak langsung usulan yang belum jelas.
//
// 2. URUTAN ANTREAN MEMAKAI TOTAL SKOR, BUKAN Priority Index. Effort tetap
//    direkam untuk kuadran dan perencanaan kapasitas, tetapi proyek berdampak
//    besar dengan effort berat TIDAK boleh turun peringkat karenanya.
//
// 3. DELAPAN GATE BUKAN VETO. Pada metode lama satu gate gagal memaksa NO-GO.
//    Di sini gate yang belum lengkap hanya menandai kebutuhan klarifikasi.

import { EFFORT_BARS, PRIORITY_GATES } from '@/lib/priorityScoring';
import { EFFORT_HIGH_THRESHOLD } from '@/lib/priorityMatrix';
import type { EffortScore, Quadrant } from '@/lib/priorityMatrix';
import { PRIORITY_GATE_KEYS } from '@/types/priorityAssessment';
import type { PriorityFinalDecision, PriorityGateKey } from '@/types/priorityAssessment';
import {
  SOP_CRITERION_KEYS,
  SOP_FINANCIAL_CRITERION,
  SOP_FINANCIAL_GATE_MAX,
  SOP_MANDATORY_KEYS,
} from '@/types/sopPriority2026';
import type {
  SopAssessmentDraft,
  SopAssessmentResult,
  SopAssessmentSubmission,
  SopCriterionKey,
  SopEligibilityStatus,
  SopFinancialGateStatus,
  SopMandatoryAnswers,
  SopMandatoryKey,
  SopRecommendation,
  SopScore,
  SopScoreDraft,
} from '@/types/sopPriority2026';

export { EFFORT_BARS, PRIORITY_GATES };

export const SOP_METHOD_VERSION = 'HTO-SOP-2026.1';
export const SOP_SOURCE_REFERENCE = 'SOP/HTO/001/2026 rev 02';
export const SOP_SCALE_MIN = 1;
export const SOP_SCALE_MAX = 10;

// Bukti wajib mulai skor 7 (Green/Gold Zone pada rubrik SOP). Setara aturan
// metode lama "wajib untuk 4-5 dari skala 5".
export const SOP_EVIDENCE_MIN_SCORE = 7;

// Padanan ambang 3,5 dari 5 pada metode lama. Hanya memengaruhi label kuadran,
// tidak pernah menjadi dasar penolakan.
export const SOP_HIGH_IMPACT_MIN = 7;

export const SOP_WEIGHTS: Record<SopCriterionKey, number> = {
  k1: 0.20,
  k2: 0.20,
  k3: 0.25,
  k4: 0.20,
  k5: 0.15,
};

export interface SopMandatoryQuestion {
  key: SopMandatoryKey;
  number: number;
  question: string;
  basisHint: string;
}

// Tahap 1 SOP 5.1 / Formulir Evaluasi. Satu YES = MANDATORY (Priority 0).
//
// `basisHint` bukan hiasan: dasar tertulis WAJIB untuk setiap YES. Tanpa itu
// Tahap 1 menjadi pintu belakang — cukup centang satu YES dan proyek apa pun
// naik ke puncak antrean tanpa pernah melewati skoring.
export const SOP_MANDATORY_QUESTIONS: SopMandatoryQuestion[] = [
  {
    key: 'regulasi',
    number: 1,
    question: 'Apakah diwajibkan Regulasi (Kemenkes/Kemenkeu/UU PDP)?',
    basisHint: 'Cantumkan nama regulasi, nomor/pasal, dan tenggat kepatuhannya.',
  },
  {
    key: 'akreditasi_bpjs',
    number: 2,
    question: 'Apakah berdampak pada Akreditasi JCI / Lisensi RS / BPJS?',
    basisHint: 'Cantumkan standar/elemen penilaian, temuan surveior, atau aturan klaim yang terkait.',
  },
  {
    key: 'risiko_kritis',
    number: 3,
    question: 'Apakah mencegah Risiko Kritis (Patient Safety / Downtime)?',
    basisHint: 'Cantumkan nomor laporan insiden, entri risk register, atau catatan downtime yang mendasari.',
  },
];

export interface SopBand {
  label: string;
  zone?: string;
  min: SopScore;
  max: SopScore;
  scores: SopScore[];
  description: string;
}

export interface SopCriterionDefinition {
  key: SopCriterionKey;
  code: string;
  name: string;
  weight: number;
  indicator: string;
  evidenceHint: string;
  probingQuestions: string[];
  bands: SopBand[];
  isFinancialGate?: boolean;
}

// Rubrik SOP memberi PITA (1-3 / 4-6 / 7-8 / 9-10), bukan angka tunggal.
// Pemilihan karena itu dua langkah: pilih kalimat pita dulu, baru nilai persis
// di dalamnya. Sepuluh tombol angka polos akan mengundang tebakan — persis yang
// diperingatkan catatan BARS di priorityMatrix.ts.
export const SOP_CRITERIA: SopCriterionDefinition[] = [
  {
    key: 'k1',
    code: 'K1',
    name: 'Kesesuaian Strategis & Inovasi',
    weight: SOP_WEIGHTS.k1,
    indicator: 'Keselarasan dengan Renstra RS, KPI Direktur Utama, dan competitive advantage RS.',
    evidenceHint: 'Cantumkan pilar Renstra/kode program, KPI Dirut terkait, atau hasil benchmark kompetitor.',
    probingQuestions: [
      'Pilar Renstra atau KPI Direktur mana yang didukung oleh proyek ini?',
      'Apakah fitur ini sudah dimiliki oleh RS pesaing, atau membuat RS kita menjadi pelopor?',
    ],
    bands: [
      {
        label: '1–3', min: 1, max: 3, scores: [1, 2, 3],
        description: 'Usulan hanya untuk kenyamanan internal 1 sub-unit; tidak ada kaitan dengan KPI Dirut atau Renstra.',
      },
      {
        label: '4–6', min: 4, max: 6, scores: [4, 5, 6],
        description: 'Membantu pencapaian KPI tingkat departemen; menyamai standar operasional RS kompetitor.',
      },
      {
        label: '7–8', min: 7, max: 8, scores: [7, 8],
        description: 'Berdampak langsung pada 1–2 KPI Dirut; memberikan fitur layanan unggulan dibanding kompetitor lokal.',
      },
      {
        label: '9–10', min: 9, max: 10, scores: [9, 10],
        description: 'Menjadi penopang utama Pilar Strategis RS & KPI Utama Dirut; terobosan inovasi baru (Pioneering/USP RS).',
      },
    ],
  },
  {
    key: 'k2',
    code: 'K2',
    name: 'Keselamatan Pasien, Mutu & PX/UX',
    weight: SOP_WEIGHTS.k2,
    indicator: 'Pengurangan kerentanan medis (JCI IPSG) dan pemangkasan hambatan alur nakes/pasien.',
    evidenceHint: 'Cantumkan laporan insiden, temuan IPSG, baseline waktu antrean, atau jumlah formulir yang dipangkas.',
    probingQuestions: [
      'Apakah ketiadaan sistem ini berpotensi menimbulkan kesalahan medis (medical error) atau komplain pasien?',
      'Berapa banyak langkah manual / formulir kertas yang bisa dipangkas untuk dokter, perawat, atau staf?',
    ],
    bands: [
      {
        label: '1–3', min: 1, max: 3, scores: [1, 2, 3],
        description: 'Tidak berdampak pada alur klinis maupun pengalaman pasien; perbaikan tampilan/kosmetik administrasi.',
      },
      {
        label: '4–6', min: 4, max: 6, scores: [4, 5, 6],
        description: 'Memperbaiki efisiensi alur kerja 1 unit internal tanpa dampak langsung ke pasien/nakes utama.',
      },
      {
        label: '7–8', min: 7, max: 8, scores: [7, 8],
        description: 'Secara langsung memotong durasi antrean pasien >30% ATAU memangkas beban input manual nakes.',
      },
      {
        label: '9–10', min: 9, max: 10, scores: [9, 10],
        description: 'Berdampak kritikal mencegah Sentinel Event / IPSG JCI DAN menghapuskan burnout administrasi nakes secara masif.',
      },
    ],
  },
  {
    key: 'k3',
    code: 'K3',
    name: 'Kelayakan Finansial & VOI',
    weight: SOP_WEIGHTS.k3,
    indicator: 'ROI kuantitatif, cost saving, potensi revenue, atau penghematan man-hours (FTE).',
    evidenceHint: 'Lampirkan perhitungan payback period, konversi jam kerja ke rupiah, nilai klaim, atau asumsi finansial.',
    isFinancialGate: true,
    probingQuestions: [
      'Berapa jam kerja staf per hari yang terbuang untuk proses manual ini jika dikonversi ke rupiah?',
      'Apakah proyek ini menambah pendapatan langsung, atau mencegah potensi klaim BPJS/piutang tertahan?',
    ],
    bands: [
      {
        label: '1–3', zone: 'Red Zone', min: 1, max: 3, scores: [1, 2, 3],
        description: 'Payback Period >3 tahun; efisiensi jam kerja <50 jam/bulan; tidak ada dampak revenue/saving.',
      },
      {
        label: '4–6', zone: 'Yellow Zone', min: 4, max: 6, scores: [4, 5, 6],
        description: 'Payback Period 1,5–3 tahun; efisiensi jam kerja 50–200 jam/bulan; cost saving skala kecil.',
      },
      {
        label: '7–8', zone: 'Green Zone', min: 7, max: 8, scores: [7, 8],
        description: 'Payback Period 6–18 bulan; efisiensi jam kerja 200–500 jam/bulan (setara 1–2 FTE); mencegah potensi kerugian finansial.',
      },
      {
        label: '9–10', zone: 'Gold Zone', min: 9, max: 10, scores: [9, 10],
        description: 'Payback Period <6 bulan; ROI >50%; efisiensi jam kerja >500 jam/bulan (> Rp 100 Juta/tahun).',
      },
    ],
  },
  {
    key: 'k4',
    code: 'K4',
    name: 'Arsitektur Teknis & Keamanan Data PDP',
    weight: SOP_WEIGHTS.k4,
    indicator: 'Kompleksitas ketergantungan sistem, kepatuhan UU PDP, dan mitigasi risiko siber.',
    evidenceHint: 'Cantumkan diagram arsitektur, daftar integrasi/API, klasifikasi data, atau hasil review keamanan.',
    probingQuestions: [
      'Apakah proyek ini menjadi syarat utama agar aplikasi/sistem lain di RS bisa berjalan?',
      'Apakah sistem ini mengolah data medis sensitif yang wajib dienkripsi sesuai UU PDP?',
    ],
    bands: [
      {
        label: '1–3', min: 1, max: 3, scores: [1, 2, 3],
        description: 'Sistem berdiri sendiri (standalone), menambah beban maintenance IT, belum ada standar keamanan data.',
      },
      {
        label: '4–6', min: 4, max: 6, scores: [4, 5, 6],
        description: 'Membutuhkan integrasi ringan dengan 1–2 sistem internal; dampak keamanan siber rendah.',
      },
      {
        label: '7–8', min: 7, max: 8, scores: [7, 8],
        description: 'Menjadi prasyarat (prerequisite) bagi 1–2 proyek strategis lain; memenuhi standar kontrol akses RME.',
      },
      {
        label: '9–10', min: 9, max: 10, scores: [9, 10],
        description: 'Proyek Core Enabler (fondasi utama portofolio IT RS); menutup celah kerentanan kritis siber & patuh penuh UU PDP.',
      },
    ],
  },
  {
    key: 'k5',
    code: 'K5',
    name: 'Urgensi Waktu & Quick Win',
    weight: SOP_WEIGHTS.k5,
    indicator: 'Kecepatan penyerahan hasil (value delivery) dan pembebasan blocker proyek lain.',
    evidenceHint: 'Cantumkan estimasi waktu ke deliverable pertama, tenggat khusus, atau proyek yang menunggu.',
    probingQuestions: [
      'Berapa lama waktu yang dibutuhkan sampai manfaat pertama (first deliverable) dapat dirasakan pengguna?',
      'Apakah ada tenggat waktu khusus (deadline) yang jika terlewati akan membatalkan manfaat proyek?',
    ],
    bands: [
      {
        label: '1–3', min: 1, max: 3, scores: [1, 2, 3],
        description: 'Waktu implementasi >12 bulan; dampak baru terasa dalam jangka panjang.',
      },
      {
        label: '4–6', min: 4, max: 6, scores: [4, 5, 6],
        description: 'Waktu implementasi 6–12 bulan; dampak terasa bertahap.',
      },
      {
        label: '7–8', min: 7, max: 8, scores: [7, 8],
        description: 'Waktu implementasi 3–6 bulan; memberikan perbaikan langsung yang terukur.',
      },
      {
        label: '9–10', min: 9, max: 10, scores: [9, 10],
        description: 'Quick Win (<3 bulan); memberikan perbaikan instan dan menyelesaikan keluhan kritis pengguna.',
      },
    ],
  },
];

export const sopFinancialGateConfig: Record<
  SopFinancialGateStatus,
  { label: string; description: string; className: string }
> = {
  approved: {
    label: 'APPROVED — Lolos Gate Finansial',
    description: `Skor ${SOP_FINANCIAL_CRITERION.toUpperCase()} > ${SOP_FINANCIAL_GATE_MAX}. Proyek masuk Master Queue dan diurutkan menurut Total Skor Akhir.`,
    className: 'border-success/30 bg-success/10 text-success',
  },
  gated: {
    label: 'GATED — Perlu Justifikasi Ulang',
    description: `Skor ${SOP_FINANCIAL_CRITERION.toUpperCase()} ≤ ${SOP_FINANCIAL_GATE_MAX} (Red Zone). Status Under Review/Pending sampai ada justifikasi ulang atau diskresi Direksi.`,
    className: 'border-destructive/30 bg-destructive/10 text-destructive',
  },
};

export function createEmptySopAssessmentDraft(): SopAssessmentDraft {
  return {
    mandatory: {
      regulasi: { answer: undefined, basis: '' },
      akreditasi_bpjs: { answer: undefined, basis: '' },
      risiko_kritis: { answer: undefined, basis: '' },
    },
    scores: {},
    justifications: {},
    evidence: {},
    effort: undefined,
    gates: {},
    eligibilityNotes: '',
    probing: { date: '', participants: '', notes: '' },
  };
}

function round(value: number, precision: number): number {
  const factor = 10 ** precision;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function calculateSopTotalScore(scores: SopScoreDraft): number | null {
  if (!SOP_CRITERION_KEYS.every((key) => scores[key] !== undefined)) return null;
  const total = SOP_CRITERION_KEYS.reduce(
    (sum, key) => sum + (scores[key] as SopScore) * SOP_WEIGHTS[key],
    0,
  );
  return round(total, 2);
}

export function calculateSopQuadrant(totalScore: number, effort: EffortScore): Quadrant {
  const highImpact = totalScore >= SOP_HIGH_IMPACT_MIN;
  const highEffort = effort >= EFFORT_HIGH_THRESHOLD;
  if (highImpact) return highEffort ? 'big_bet' : 'quick_win';
  return highEffort ? 'thankless' : 'fill_in';
}

export function getSopFinancialGate(scores: SopScoreDraft): SopFinancialGateStatus | null {
  const k3 = scores[SOP_FINANCIAL_CRITERION];
  if (k3 === undefined) return null;
  return k3 <= SOP_FINANCIAL_GATE_MAX ? 'gated' : 'approved';
}

export function calculateSopAssessment(draft: SopAssessmentDraft): SopAssessmentResult {
  const mandatoryReasons = SOP_MANDATORY_KEYS.filter((key) => draft.mandatory[key].answer === true);
  const mandatoryAnswered = SOP_MANDATORY_KEYS.filter(
    (key) => draft.mandatory[key].answer !== undefined,
  ).length;
  const isMandatory = mandatoryReasons.length > 0;

  const incompleteGates = PRIORITY_GATE_KEYS.filter((key) => draft.gates[key] !== true);
  const eligibilityStatus: SopEligibilityStatus = incompleteGates.length ? 'needs_probing' : 'eligible';
  const assessedGates = PRIORITY_GATE_KEYS.filter((key) => draft.gates[key] !== undefined).length;
  const completedCriteria = SOP_CRITERION_KEYS.filter((key) => draft.scores[key] !== undefined).length;

  // Proyek mandatory melewati Tahap 2 sepenuhnya (SOP 5.1). Tidak ada skor yang
  // dihitung, sehingga tidak ada pula angka yang bisa disalahartikan sebagai
  // dasar peringkatnya.
  if (isMandatory) {
    return {
      isMandatory: true,
      mandatoryReasons,
      mandatoryAnswered,
      totalScore: null,
      scorePercent: null,
      priorityIndex: null,
      quadrant: null,
      financialGate: null,
      eligibilityStatus,
      incompleteGates,
      recommendation: 'mandatory',
      completedCriteria,
      assessedGates,
    };
  }

  const totalScore = calculateSopTotalScore(draft.scores);
  const financialGate = getSopFinancialGate(draft.scores);
  const allMandatoryAnswered = mandatoryAnswered === SOP_MANDATORY_KEYS.length;

  return {
    isMandatory: false,
    mandatoryReasons,
    mandatoryAnswered,
    totalScore,
    scorePercent: totalScore === null ? null : round((totalScore / SOP_SCALE_MAX) * 100, 2),
    priorityIndex: totalScore !== null && draft.effort ? round(totalScore / draft.effort, 3) : null,
    quadrant: totalScore !== null && draft.effort ? calculateSopQuadrant(totalScore, draft.effort) : null,
    financialGate,
    eligibilityStatus,
    incompleteGates,
    recommendation:
      allMandatoryAnswered && totalScore !== null && financialGate
        ? (financialGate === 'gated' ? 'gated' : 'queued')
        : null,
    completedCriteria,
    assessedGates,
  };
}

export function mapSopRecommendationToFinalDecision(
  recommendation: SopRecommendation,
): PriorityFinalDecision {
  const mapping: Record<SopRecommendation, PriorityFinalDecision> = {
    mandatory: 'approved',
    queued: 'approved',
    gated: 'gated',
  };
  return mapping[recommendation];
}

export function getSopValidationErrors(draft: SopAssessmentDraft): string[] {
  const errors: string[] = [];
  const result = calculateSopAssessment(draft);

  // ---- Tahap 1 -----------------------------------------------------------
  const unanswered = SOP_MANDATORY_QUESTIONS.filter(
    ({ key }) => draft.mandatory[key].answer === undefined,
  );
  if (unanswered.length) {
    errors.push(`Tahap 1 belum lengkap: ${unanswered.length} pertanyaan mandatory belum dijawab.`);
  }

  const missingBasis = SOP_MANDATORY_QUESTIONS.filter(
    ({ key }) => draft.mandatory[key].answer === true && !draft.mandatory[key].basis.trim(),
  );
  if (missingBasis.length) {
    errors.push(
      `Dasar tertulis wajib untuk jawaban YES pada pertanyaan ${missingBasis.map((item) => item.number).join(', ')}.`,
    );
  }

  // ---- Tahap 2 (dilewati untuk proyek mandatory) --------------------------
  if (!result.isMandatory) {
    const missingCriteria = SOP_CRITERIA.filter(({ key }) => draft.scores[key] === undefined);
    if (missingCriteria.length) errors.push(`${missingCriteria.length} kriteria belum dinilai.`);

    const missingJustifications = SOP_CRITERIA.filter(
      ({ key }) => draft.scores[key] !== undefined && !draft.justifications[key]?.trim(),
    );
    if (missingJustifications.length) {
      errors.push(
        `Konteks penilaian wajib diisi untuk ${missingJustifications.map((item) => item.code).join(', ')}.`,
      );
    }

    const missingEvidence = SOP_CRITERIA.filter(
      ({ key }) => (draft.scores[key] ?? 0) >= SOP_EVIDENCE_MIN_SCORE && !draft.evidence[key]?.trim(),
    );
    if (missingEvidence.length) {
      errors.push(
        `Bukti wajib untuk skor ${SOP_EVIDENCE_MIN_SCORE}-${SOP_SCALE_MAX} pada ${missingEvidence.map((item) => item.code).join(', ')}.`,
      );
    }

    if (!draft.effort) errors.push('Effort/kompleksitas belum dinilai.');
    if (draft.effort && !draft.justifications.effort?.trim()) {
      errors.push('Dasar penilaian Effort wajib diisi.');
    }
    if ((draft.effort ?? 0) >= EFFORT_HIGH_THRESHOLD && !draft.evidence.effort?.trim()) {
      errors.push(`Bukti/dependensi wajib untuk Effort ${EFFORT_HIGH_THRESHOLD}-5.`);
    }

    // SOP 5.3 mewajibkan Probing Session sebelum usulan dinilai, bukan menolak
    // usulan yang belum jelas. Catatannya adalah bukti sesi itu benar terjadi.
    if (!draft.probing.notes.trim()) {
      errors.push('Catatan hasil probing wajib diisi sebelum penilaian dapat disimpan.');
    }
  }

  // ---- Checklist kelengkapan (tidak menggugurkan) -------------------------
  if (result.incompleteGates.length && !draft.eligibilityNotes.trim()) {
    errors.push('Catatan kelayakan wajib diisi karena ada butir checklist yang belum lengkap.');
  }

  return errors;
}

export function toSopAssessmentSubmission(
  draft: SopAssessmentDraft,
  decision: Omit<
    SopAssessmentSubmission,
    | 'mandatory_answers'
    | 'scores'
    | 'justifications'
    | 'evidence'
    | 'effort'
    | 'gates'
    | 'probing_session'
    | 'eligibility_notes'
  >,
): SopAssessmentSubmission | null {
  if (getSopValidationErrors(draft).length) return null;
  if (!decision.final_decision_note.trim()) return null;

  const result = calculateSopAssessment(draft);
  if (!result.recommendation) return null;

  const recommendedDecision = mapSopRecommendationToFinalDecision(result.recommendation);
  if (decision.final_decision !== recommendedDecision && !decision.override_reason?.trim()) return null;
  if (
    decision.final_decision === 'deferred' &&
    (!decision.priority_note.trim() || !decision.proposed_start_date || !decision.proposed_end_date)
  ) {
    return null;
  }

  const mandatoryAnswers = SOP_MANDATORY_KEYS.reduce((acc, key) => {
    acc[key] = {
      answer: draft.mandatory[key].answer as boolean,
      basis: draft.mandatory[key].basis.trim(),
    };
    return acc;
  }, {} as SopMandatoryAnswers);

  return {
    mandatory_answers: mandatoryAnswers,
    // Proyek mandatory tidak diskor; mengirim skor kosong menjaga snapshot
    // bebas dari angka yang tidak pernah dipakai menghitung apa pun.
    scores: result.isMandatory ? {} : draft.scores,
    justifications: result.isMandatory ? {} : draft.justifications,
    evidence: result.isMandatory ? {} : draft.evidence,
    effort: result.isMandatory ? (draft.effort ?? null) : (draft.effort as EffortScore),
    gates: draft.gates,
    probing_session: {
      date: draft.probing.date.trim(),
      participants: draft.probing.participants.trim(),
      notes: draft.probing.notes.trim(),
    },
    eligibility_notes: draft.eligibilityNotes.trim(),
    ...decision,
    final_decision_note: decision.final_decision_note.trim(),
    priority_note: decision.priority_note.trim(),
    override_reason: decision.override_reason?.trim() || null,
  };
}

// Dasar penilaian yang DIBEKUKAN sebagai teks saat keputusan dibuat. Kalimat
// jangkar boleh direvisi di kemudian hari; kalau teks ini dihitung ulang saat
// render, revisi itu akan mengubah alasan tertulis keputusan lama secara senyap.
export function buildSopAssessmentRationale(draft: SopAssessmentDraft): string {
  const result = calculateSopAssessment(draft);

  if (result.isMandatory) {
    const reasons = SOP_MANDATORY_QUESTIONS.filter(({ key }) => draft.mandatory[key].answer === true)
      .map(({ number, question, key }) => `${number}. ${question} — YES. Dasar: ${draft.mandatory[key].basis.trim()}`);
    return [
      `Tahap 1 (${SOP_SOURCE_REFERENCE}): MANDATORY — Priority 0 / Fast Track.`,
      ...reasons,
      'Skoring Tahap 2 dilewati sesuai SOP 5.1.',
    ].join('\n');
  }

  const scoreLines = SOP_CRITERIA.flatMap((criterion) => {
    const score = draft.scores[criterion.key];
    if (!score) return [];
    const band = criterion.bands.find((item) => score >= item.min && score <= item.max);
    const zone = band?.zone ? ` [${band.zone}]` : '';
    return `${criterion.code} ${criterion.name} (${Math.round(criterion.weight * 100)}%): ${score}/${SOP_SCALE_MAX}${zone} — ${band?.description ?? ''}`;
  });

  const effortAnchor = EFFORT_BARS.find((option) => option.score === draft.effort)?.description;
  const resultLine = result.totalScore !== null
    ? `Hasil: Total Skor Akhir ${result.totalScore.toFixed(2)}/${SOP_SCALE_MAX.toFixed(2)}; Effort ${draft.effort ?? '-'}; Gate finansial ${result.financialGate ?? '-'}; Checklist ${result.eligibilityStatus}; Rekomendasi ${result.recommendation ?? 'belum lengkap'}.`
    : 'Hasil: penilaian belum lengkap.';

  return [
    ...scoreLines,
    effortAnchor ? `Effort: ${draft.effort}/5 — ${effortAnchor}` : '',
    resultLine,
  ].filter(Boolean).join('\n');
}

export type { PriorityGateKey };
