import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { createServer } from 'vite';

const vite = await createServer({
  appType: 'custom',
  logLevel: 'silent',
  server: { middlewareMode: true },
});

const sop = await vite.ssrLoadModule('/src/lib/sopPriority2026.ts');
const sopTypes = await vite.ssrLoadModule('/src/types/sopPriority2026.ts');
const assessmentTypes = await vite.ssrLoadModule('/src/types/priorityAssessment.ts');

after(async () => {
  await vite.close();
});

const allGates = (value) => Object.fromEntries(
  assessmentTypes.PRIORITY_GATE_KEYS.map((key) => [key, value]),
);

const noMandatory = () => Object.fromEntries(
  sopTypes.SOP_MANDATORY_KEYS.map((key) => [key, { answer: false, basis: '' }]),
);

const allScores = (score) => Object.fromEntries(
  sopTypes.SOP_CRITERION_KEYS.map((key) => [key, score]),
);

const allJustifications = () => ({
  ...Object.fromEntries(sopTypes.SOP_CRITERION_KEYS.map((key) => [key, `Konteks ${key}`])),
  effort: 'Estimasi effort tervalidasi.',
});

const allEvidence = () => ({
  ...Object.fromEntries(sopTypes.SOP_CRITERION_KEYS.map((key) => [key, `Bukti ${key}`])),
  effort: 'Dependensi terdokumentasi.',
});

// Draf lengkap yang lolos validasi: semua Tahap 1 NO, skor 5 (di bawah ambang
// bukti), effort 3 (di bawah ambang bukti effort), checklist lengkap.
const completeDraft = (overrides = {}) => ({
  mandatory: noMandatory(),
  scores: allScores(5),
  justifications: allJustifications(),
  evidence: {},
  effort: 3,
  gates: allGates(true),
  eligibilityNotes: '',
  probing: { date: '2026-09-01', participants: 'Analis HTO, Kepala Unit', notes: 'Probing dilakukan.' },
  ...overrides,
});

const mandatoryDraft = (key = 'regulasi') => ({
  ...completeDraft(),
  mandatory: {
    ...noMandatory(),
    [key]: { answer: true, basis: 'Permenkes RME, tenggat Desember 2026.' },
  },
  scores: {},
  justifications: {},
  evidence: {},
  effort: undefined,
  probing: { date: '', participants: '', notes: '' },
});

const decision = (overrides = {}) => ({
  priority_note: '',
  proposed_start_date: null,
  proposed_end_date: null,
  final_decision: 'approved',
  final_decision_note: 'Disahkan rapat HTO.',
  override_reason: null,
  ...overrides,
});

test('bobot K1-K5 berjumlah tepat 100% sesuai SOP Bab 6', () => {
  const total = Object.values(sop.SOP_WEIGHTS).reduce((sum, weight) => sum + weight, 0);
  assert.equal(total, 1);
  assert.equal(sop.SOP_WEIGHTS.k3, 0.25);
});

test('setiap kriteria memiliki empat pita rubrik yang menutup skala 1-10 tanpa celah', () => {
  assert.equal(sop.SOP_CRITERIA.length, 5);
  for (const criterion of sop.SOP_CRITERIA) {
    assert.equal(criterion.bands.length, 4, `${criterion.code} harus punya 4 pita`);
    assert.equal(criterion.probingQuestions.length, 2, `${criterion.code} harus punya 2 pertanyaan probing`);

    const covered = criterion.bands.flatMap((band) => band.scores);
    assert.deepEqual(
      [...covered].sort((a, b) => a - b),
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      `${criterion.code} harus menutup seluruh skala 1-10 tepat satu kali`,
    );
  }
});

test('Total Skor Akhir dihitung pada skala 1-10 dan menolak penilaian belum lengkap', () => {
  assert.equal(sop.calculateSopTotalScore({}), null);
  assert.equal(sop.calculateSopTotalScore({ k1: 8, k2: 8, k3: 8, k4: 8 }), null);
  assert.equal(sop.calculateSopTotalScore(allScores(1)), 1);
  assert.equal(sop.calculateSopTotalScore(allScores(10)), 10);
  // 8*0.20 + 7*0.20 + 9*0.25 + 6*0.20 + 10*0.15 = 1.6 + 1.4 + 2.25 + 1.2 + 1.5
  assert.equal(sop.calculateSopTotalScore({ k1: 8, k2: 7, k3: 9, k4: 6, k5: 10 }), 7.95);
});

test('Tahap 1 dengan satu YES menghasilkan mandatory dan melewati skoring', () => {
  const result = sop.calculateSopAssessment(mandatoryDraft());

  assert.equal(result.isMandatory, true);
  assert.equal(result.recommendation, 'mandatory');
  assert.deepEqual(result.mandatoryReasons, ['regulasi']);
  assert.equal(result.totalScore, null);
  assert.equal(result.scorePercent, null);
  assert.equal(result.priorityIndex, null);
  assert.equal(result.quadrant, null);
  assert.equal(result.financialGate, null);
  assert.deepEqual(sop.getSopValidationErrors(mandatoryDraft()), []);
});

test('jawaban YES tanpa dasar tertulis ditolak validasi', () => {
  const draft = mandatoryDraft();
  draft.mandatory.regulasi.basis = '   ';

  const errors = sop.getSopValidationErrors(draft);
  assert.ok(errors.some((error) => error.includes('Dasar tertulis wajib')));
  assert.equal(sop.toSopAssessmentSubmission(draft, decision()), null);
});

test('Tahap 1 yang belum dijawab lengkap menahan rekomendasi', () => {
  const draft = completeDraft();
  draft.mandatory.risiko_kritis = { answer: undefined, basis: '' };

  const result = sop.calculateSopAssessment(draft);
  assert.equal(result.recommendation, null);
  assert.ok(sop.getSopValidationErrors(draft).some((error) => error.includes('Tahap 1 belum lengkap')));
});

test('gate finansial menahan proyek pada K3 <= 3 dan meloloskannya pada K3 >= 4', () => {
  const gated = sop.calculateSopAssessment(completeDraft({
    scores: { ...allScores(10), k3: 3 },
    evidence: allEvidence(),
  }));
  assert.equal(gated.financialGate, 'gated');
  assert.equal(gated.recommendation, 'gated');

  const passed = sop.calculateSopAssessment(completeDraft({
    scores: { ...allScores(1), k3: 4 },
  }));
  assert.equal(passed.financialGate, 'approved');
  assert.equal(passed.recommendation, 'queued');
});

test('gate finansial ditentukan K3 saja, bukan Total Skor', () => {
  // Total Skor sangat tinggi tetapi K3 Red Zone: SOP tetap menahannya.
  const result = sop.calculateSopAssessment(completeDraft({
    scores: { k1: 10, k2: 10, k3: 2, k4: 10, k5: 10 },
    evidence: allEvidence(),
  }));

  assert.equal(result.totalScore, 8);
  assert.equal(result.recommendation, 'gated');
});

test('kalkulator tidak pernah menghasilkan penolakan (SOP 5.3)', () => {
  const outcomes = new Set();
  for (const score of [1, 3, 4, 7, 10]) {
    outcomes.add(sop.calculateSopAssessment(completeDraft({
      scores: allScores(score),
      evidence: allEvidence(),
    })).recommendation);
  }
  outcomes.add(sop.calculateSopAssessment(mandatoryDraft()).recommendation);

  for (const outcome of outcomes) {
    assert.ok(
      ['mandatory', 'queued', 'gated'].includes(outcome),
      `keluaran kalkulator tidak sah: ${outcome}`,
    );
  }
  assert.equal(outcomes.has('no_go'), false);
  assert.equal(outcomes.has('rejected'), false);
});

test('checklist yang belum lengkap menandai needs_probing tanpa mengubah rekomendasi', () => {
  const draft = completeDraft({
    gates: { ...allGates(true), cybersecurity_review: false },
    eligibilityNotes: 'Menunggu hasil review tim keamanan siber.',
  });
  const result = sop.calculateSopAssessment(draft);

  assert.equal(result.eligibilityStatus, 'needs_probing');
  assert.deepEqual(result.incompleteGates, ['cybersecurity_review']);
  // Inilah pembeda pokok dari metode lama: gate gagal TIDAK memaksa NO-GO.
  assert.equal(result.recommendation, 'queued');
  assert.deepEqual(sop.getSopValidationErrors(draft), []);
});

test('checklist belum lengkap tanpa catatan kelayakan ditolak validasi', () => {
  const errors = sop.getSopValidationErrors(completeDraft({ gates: {} }));
  assert.ok(errors.some((error) => error.includes('Catatan kelayakan')));
});

test('bukti wajib mulai skor 7, tidak untuk skor 6', () => {
  assert.deepEqual(sop.getSopValidationErrors(completeDraft({ scores: allScores(6) })), []);

  const errors = sop.getSopValidationErrors(completeDraft({ scores: allScores(7) }));
  assert.ok(errors.some((error) => error.includes('Bukti wajib untuk skor 7-10')));
  assert.equal(sop.SOP_EVIDENCE_MIN_SCORE, 7);
});

test('catatan probing wajib untuk penilaian Tahap 2, tidak untuk mandatory', () => {
  const errors = sop.getSopValidationErrors(completeDraft({
    probing: { date: '', participants: '', notes: '' },
  }));
  assert.ok(errors.some((error) => error.includes('Catatan hasil probing')));

  const mandatory = mandatoryDraft();
  assert.equal(mandatory.probing.notes, '');
  assert.deepEqual(sop.getSopValidationErrors(mandatory), []);
});

test('effort menggeser kuadran dan Priority Index tetapi tidak menggeser Total Skor', () => {
  const easy = sop.calculateSopAssessment(completeDraft({
    scores: allScores(8), evidence: allEvidence(), effort: 2,
  }));
  const hard = sop.calculateSopAssessment(completeDraft({
    scores: allScores(8), evidence: allEvidence(), effort: 5,
  }));

  assert.equal(easy.totalScore, hard.totalScore);
  assert.equal(easy.scorePercent, hard.scorePercent);
  assert.equal(easy.quadrant, 'quick_win');
  assert.equal(hard.quadrant, 'big_bet');
  assert.ok(easy.priorityIndex > hard.priorityIndex);
});

test('pemetaan rekomendasi SOP ke keputusan formal tetap eksplisit', () => {
  assert.equal(sop.mapSopRecommendationToFinalDecision('mandatory'), 'approved');
  assert.equal(sop.mapSopRecommendationToFinalDecision('queued'), 'approved');
  assert.equal(sop.mapSopRecommendationToFinalDecision('gated'), 'gated');
});

test('submission hanya dibentuk setelah penilaian lengkap dan valid', () => {
  assert.equal(
    sop.toSopAssessmentSubmission(sop.createEmptySopAssessmentDraft(), decision()),
    null,
  );

  const submission = sop.toSopAssessmentSubmission(completeDraft(), decision());
  assert.ok(submission);
  assert.equal(submission.final_decision, 'approved');
  assert.equal(submission.scores.k3, 5);
  assert.equal(submission.effort, 3);
  assert.equal(submission.mandatory_answers.regulasi.answer, false);
  assert.equal(submission.probing_session.notes, 'Probing dilakukan.');
});

test('submission mandatory tidak membawa skor apa pun', () => {
  const submission = sop.toSopAssessmentSubmission(mandatoryDraft(), decision());

  assert.ok(submission);
  assert.deepEqual(submission.scores, {});
  assert.deepEqual(submission.justifications, {});
  assert.equal(submission.mandatory_answers.regulasi.answer, true);
  assert.equal(submission.mandatory_answers.regulasi.basis, 'Permenkes RME, tenggat Desember 2026.');
});

test('keputusan yang berbeda dari rekomendasi wajib memiliki alasan override', () => {
  // Proyek ter-gate yang tetap disetujui = diskresi Direksi (SOP 5.2).
  const gatedDraft = completeDraft({ scores: { ...allScores(5), k3: 2 } });

  assert.equal(
    sop.toSopAssessmentSubmission(gatedDraft, decision({ final_decision: 'approved' })),
    null,
  );

  const withReason = sop.toSopAssessmentSubmission(gatedDraft, decision({
    final_decision: 'approved',
    override_reason: 'Diskresi Direksi: proyek menopang tenggat akreditasi.',
  }));
  assert.ok(withReason);
  assert.equal(withReason.final_decision, 'approved');
});

test('keputusan ditunda wajib memiliki konteks dan jadwal lengkap', () => {
  const draft = completeDraft();

  assert.equal(
    sop.toSopAssessmentSubmission(draft, decision({
      final_decision: 'deferred',
      override_reason: 'Kapasitas tim penuh pada periode berjalan.',
    })),
    null,
  );

  const complete = sop.toSopAssessmentSubmission(draft, decision({
    final_decision: 'deferred',
    override_reason: 'Kapasitas tim penuh pada periode berjalan.',
    priority_note: 'Dijadwalkan ulang setelah integrasi SIMRS fase 1.',
    proposed_start_date: '2027-01-05',
    proposed_end_date: '2027-06-30',
  }));
  assert.ok(complete);
});

test('dasar penilaian membekukan kalimat rubrik terpilih, bukan angkanya saja', () => {
  const rationale = sop.buildSopAssessmentRationale(completeDraft({
    scores: { ...allScores(5), k3: 9 },
    evidence: allEvidence(),
  }));

  assert.ok(rationale.includes('Gold Zone'));
  assert.ok(rationale.includes('K3 Kelayakan Finansial & VOI (25%): 9/10'));
  assert.ok(rationale.includes('Total Skor Akhir'));

  const mandatoryRationale = sop.buildSopAssessmentRationale(mandatoryDraft());
  assert.ok(mandatoryRationale.includes('MANDATORY'));
  assert.ok(mandatoryRationale.includes('Permenkes RME'));
});
