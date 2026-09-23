import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { createServer } from 'vite';

const vite = await createServer({
  appType: 'custom',
  logLevel: 'silent',
  server: { middlewareMode: true },
});

const scoring = await vite.ssrLoadModule('/src/lib/priorityScoring.ts');
const assessmentTypes = await vite.ssrLoadModule('/src/types/priorityAssessment.ts');

after(async () => {
  await vite.close();
});

const allScores = (score) => Object.fromEntries(
  assessmentTypes.PRIORITY_CRITERION_KEYS.map((key) => [key, score]),
);

const allGates = (value) => Object.fromEntries(
  assessmentTypes.PRIORITY_GATE_KEYS.map((key) => [key, value]),
);

const allJustifications = () => ({
  ...Object.fromEntries(
    assessmentTypes.PRIORITY_CRITERION_KEYS.map((key) => [key, `Konteks ${key}`]),
  ),
  effort: 'Estimasi effort tervalidasi.',
});

const completeDraft = (overrides = {}) => ({
  scores: allScores(3),
  justifications: allJustifications(),
  evidence: {},
  effort: 3,
  gates: allGates(true),
  eligibilityNotes: '',
  ...overrides,
});

test('bobot K1-K7 berjumlah tepat 100%', () => {
  const total = Object.values(scoring.PRIORITY_WEIGHTS).reduce((sum, weight) => sum + weight, 0);
  assert.equal(total, 1);
});

test('skor dampak tertimbang menghitung K1-K7 dan menolak input belum lengkap', () => {
  assert.equal(scoring.calculateWeightedScore({}), null);
  assert.equal(scoring.calculateWeightedScore(allScores(1)), 1);
  assert.equal(scoring.calculateWeightedScore(allScores(5)), 5);
  assert.equal(scoring.calculateWeightedScore({
    k1: 5,
    k2: 4,
    k3: 3,
    k4: 2,
    k5: 1,
    k6: 5,
    k7: 4,
  }), 3.55);
});

test('ambang rekomendasi menggunakan skor dampak, bukan Priority Index', () => {
  assert.equal(scoring.getRecommendation(3.5, 'eligible'), 'go');
  assert.equal(scoring.getRecommendation(3.499, 'eligible'), 'conditional_go');
  assert.equal(scoring.getRecommendation(3, 'eligible'), 'conditional_go');
  assert.equal(scoring.getRecommendation(2.999, 'eligible'), 'defer');
  assert.equal(scoring.getRecommendation(2.5, 'eligible'), 'defer');
  assert.equal(scoring.getRecommendation(2.499, 'eligible'), 'no_go');
  assert.equal(scoring.getRecommendation(5, 'ineligible'), 'no_go');
  assert.equal(scoring.getRecommendation(5, 'pending'), null);
});

test('effort tinggi menurunkan Priority Index tetapi tidak menggagalkan proyek berdampak tinggi', () => {
  const easy = scoring.calculatePriorityAssessment(completeDraft({
    scores: allScores(5),
    effort: 1,
  }));
  const hard = scoring.calculatePriorityAssessment(completeDraft({
    scores: allScores(5),
    effort: 5,
    evidence: {
      ...Object.fromEntries(assessmentTypes.PRIORITY_CRITERION_KEYS.map((key) => [key, `Bukti ${key}`])),
      effort: 'Daftar dependensi dan estimasi vendor.',
    },
  }));

  assert.equal(easy.weightedScore, 5);
  assert.equal(easy.priorityIndex, 5);
  assert.equal(easy.recommendation, 'go');
  assert.equal(easy.quadrant, 'quick_win');

  assert.equal(hard.weightedScore, 5);
  assert.equal(hard.priorityIndex, 1);
  assert.equal(hard.recommendation, 'go');
  assert.equal(hard.quadrant, 'big_bet');
});

test('gate gagal memaksa status ineligible dan merekam gate yang gagal', () => {
  const gates = allGates(true);
  gates.cybersecurity_review = false;

  const result = scoring.calculatePriorityAssessment(completeDraft({
    scores: allScores(5),
    gates,
    eligibilityNotes: 'Kontrol keamanan minimum belum disetujui.',
  }));

  assert.equal(result.eligibilityStatus, 'ineligible');
  assert.equal(result.recommendation, 'no_go');
  assert.deepEqual(result.failedGates, ['cybersecurity_review']);
});

test('validasi mewajibkan konteks, bukti skor tinggi, bukti effort tinggi, dan catatan gate gagal', () => {
  assert.deepEqual(scoring.getPriorityAssessmentValidationErrors(completeDraft()), []);

  const scores = allScores(3);
  scores.k1 = 4;
  const gates = allGates(true);
  gates.architecture_review = false;

  const errors = scoring.getPriorityAssessmentValidationErrors(completeDraft({
    scores,
    effort: 4,
    gates,
    eligibilityNotes: '',
  }));

  assert.ok(errors.some((error) => error.includes('K1')));
  assert.ok(errors.some((error) => error.includes('Effort 4-5')));
  assert.ok(errors.some((error) => error.includes('Catatan kelayakan')));
});

test('submission hanya dibentuk setelah assessment lengkap dan valid', () => {
  const decision = {
    priority_note: 'Masuk roadmap setelah dependensi dipenuhi.',
    proposed_start_date: '2026-09-01',
    proposed_end_date: '2026-12-01',
    final_decision: 'conditional',
    final_decision_note: 'Disahkan dengan syarat integrasi.',
    override_reason: null,
  };

  assert.equal(scoring.toPriorityAssessmentSubmission(scoring.createEmptyPriorityAssessmentDraft(), decision), null);

  const submission = scoring.toPriorityAssessmentSubmission(completeDraft(), decision);
  assert.ok(submission);
  assert.equal(submission.final_decision, 'conditional');
  assert.equal(submission.scores.k7, 3);
  assert.equal(submission.effort, 3);
});

test('pemetaan rekomendasi ke keputusan formal tetap eksplisit', () => {
  assert.equal(scoring.mapRecommendationToFinalDecision('go'), 'approved');
  assert.equal(scoring.mapRecommendationToFinalDecision('conditional_go'), 'conditional');
  assert.equal(scoring.mapRecommendationToFinalDecision('defer'), 'deferred');
  assert.equal(scoring.mapRecommendationToFinalDecision('no_go'), 'rejected');
});

test('override keputusan wajib memiliki alasan', () => {
  const submission = scoring.toPriorityAssessmentSubmission(completeDraft(), {
    priority_note: '',
    proposed_start_date: null,
    proposed_end_date: null,
    final_decision: 'approved',
    final_decision_note: 'Komite memutuskan eksekusi langsung.',
    override_reason: null,
  });

  assert.equal(submission, null);
});

test('keputusan deferred wajib memiliki konteks dan jadwal lengkap', () => {
  const withoutSchedule = scoring.toPriorityAssessmentSubmission(completeDraft(), {
    priority_note: '',
    proposed_start_date: null,
    proposed_end_date: null,
    final_decision: 'deferred',
    final_decision_note: 'Ditinjau pada periode berikutnya.',
    override_reason: 'Kapasitas eksekusi periode berjalan telah penuh.',
  });

  const withSchedule = scoring.toPriorityAssessmentSubmission(completeDraft(), {
    priority_note: 'Masuk roadmap kuartal berikutnya.',
    proposed_start_date: '2026-10-01',
    proposed_end_date: '2027-01-31',
    final_decision: 'deferred',
    final_decision_note: 'Ditinjau pada periode berikutnya.',
    override_reason: 'Kapasitas eksekusi periode berjalan telah penuh.',
  });

  assert.equal(withoutSchedule, null);
  assert.ok(withSchedule);
});
