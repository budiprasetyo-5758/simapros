// Ekspor "Formulir Evaluasi Prioritas Proyek HTO" (PDF) dari snapshot
// penilaian Tier 2 yang tersimpan pada sebuah proyek.
//
// Layout mengikuti dokumen terkendali FRM-HTO-001 rev 02 (`CONTOH FORM.docx`):
// kop dokumen, bagian I-VI, dan Lampiran A (rubrik + ketentuan + riwayat
// revisi). Nomor registrasi sengaja dikosongkan untuk diisi manual, dan field
// yang tidak punya sumber data di aplikasi ditampilkan "—".
//
// Semua angka dibaca dari snapshot (method_snapshot + kolom beku), bukan
// dihitung ulang dari konstanta metode yang aktif hari ini — konsisten dengan
// prinsip buildPriorityAssessmentView().
//
// Pagination berbasis blok: dokumen dipecah menjadi blok mandiri (judul bagian
// menempel pada isinya), tiap blok diukur tingginya, lalu dipadatkan ke
// halaman. Blok yang tidak muat di sisa halaman pindah utuh ke halaman
// berikutnya; blok yang lebih tinggi dari satu halaman baru dipecah pada batas
// aman (antar baris tabel / antar paragraf). Jumlah halaman di kop dihitung
// dengan mengulang packing sampai nilai stabil.

import { format, parseISO } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import type { Project } from '@/types/project';
import { supabase } from '@/integrations/supabase/client';
import { buildPriorityAssessmentView, toFiniteNumber } from '@/lib/priorityAssessmentView';
import { SOP_CRITERIA, SOP_MANDATORY_QUESTIONS } from '@/lib/sopPriority2026';
import { PRIORITY_CRITERIA, finalDecisionConfig, recommendationConfig } from '@/lib/priorityScoring';
import type { Quadrant } from '@/lib/priorityMatrix';

const FORM_WIDTH = 800;
const MARGIN_MM = 10;
const PAGE_WIDTH_MM = 210;
const PAGE_HEIGHT_MM = 297;
const CONTENT_WIDTH_MM = PAGE_WIDTH_MM - MARGIN_MM * 2;
const CONTENT_HEIGHT_MM = PAGE_HEIGHT_MM - MARGIN_MM * 2;

// Toleransi pembulatan milimeter saat memutuskan sebuah blok "muat" di sisa
// halaman, supaya blok yang pas tidak terdorong ke halaman berikutnya.
const FIT_TOLERANCE_MM = 0.5;

// Metadata template dokumen terkendali FRM-HTO-001 rev 02. Kalau template
// resmi direvisi, nilai-nilai ini yang harus diperbarui.
const FORM_TEMPLATE_NO = 'FRM-HTO-001';
const FORM_ISSUE_DATE = '02 Januari 2026';
const FORM_TEMPLATE_REVISION = '02';
const FORM_EFFECTIVE_DATE = '01 Februari 2026';
const FORM_CLASSIFICATION = 'Internal — Terbatas';

// Istilah kuadran pada dokumen resmi berbeda dari label UI aplikasi
// (big_bet = "Major Project" pada Lampiran A.2).
const QUADRANT_EXPORT_LABELS: Record<Quadrant, string> = {
  quick_win: 'Quick Win',
  big_bet: 'Major Project',
  fill_in: 'Fill-in',
  thankless: 'Thankless Task',
};

const TERBILANG: string[] = [
  'nol', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan',
  'sepuluh', 'sebelas', 'dua belas', 'tiga belas', 'empat belas', 'lima belas',
  'enam belas', 'tujuh belas', 'delapan belas', 'sembilan belas', 'dua puluh',
];

function terbilang(value: number): string {
  return TERBILANG[value] ?? String(value);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDate(value: string | null | undefined, pattern: string): string {
  if (!value) return '—';
  try {
    return format(parseISO(value), pattern, { locale: localeId });
  } catch {
    return value;
  }
}

function formatNumberID(value: number, digits: number): string {
  return value.toFixed(digits).replace('.', ',');
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'proyek';
}

// Nama analis diambil dari tabel profiles. RLS membatasi pembacaan profil
// orang lain ke admin/super_admin; untuk peran lain hasilnya null dan kolom
// analis ditampilkan "—".
async function resolveAnalystName(assessedBy: string | null | undefined): Promise<string | null> {
  if (!assessedBy) return null;
  const { data } = await supabase
    .from('profiles')
    .select('name')
    .eq('id', assessedBy)
    .maybeSingle();
  return data?.name ?? null;
}

// Kotak centang digambar dengan CSS, bukan glyph ☐/☒ — font rendering
// html2canvas tidak konsisten untuk karakter ballot box. Tanda silang pun
// digambar geometris (dua garis diagonal lewat linear-gradient), bukan glyph
// "×": html2canvas menggambar teks beberapa piksel lebih rendah dari kotak
// elemen, sehingga glyph × jatuh menempel pada garis bawah kotak.
function checkboxCell(checked: boolean): string {
  const cross = checked
    ? '<span style="position:absolute;left:1.5px;top:1.5px;width:8px;height:8px;background:linear-gradient(45deg,transparent 42%,#111827 42%,#111827 58%,transparent 58%),linear-gradient(-45deg,transparent 42%,#111827 42%,#111827 58%,transparent 58%);"></span>'
    : '';
  return `<span style="position:relative;display:inline-block;box-sizing:border-box;width:14px;height:14px;border:1.5px solid #111827;vertical-align:-3px;">${cross}</span>`;
}

function sectionTitle(number: string, text: string): string {
  return `<div style="margin:18px 0 8px;font-size:12.5px;font-weight:700;color:#111827;border-bottom:1.5px solid #111827;padding-bottom:3px;">
    ${escapeHtml(number)}&nbsp;&nbsp;${escapeHtml(text)}
  </div>`;
}

const cell = 'border:1px solid #9ca3af;padding:5px 7px;font-size:11px;vertical-align:top;';
const headerCell = `${cell}background:#e5e7eb;font-weight:700;text-align:center;`;
const labelCell = `${cell}background:#f3f4f6;font-weight:600;width:200px;`;

const KV_TABLE_STYLE = 'width:100%;border-collapse:collapse;';
const FIXED_TABLE_STYLE = 'width:100%;border-collapse:collapse;table-layout:fixed;';

function tableHeader(columns: string[], widths?: string[]): string {
  return `<tr>${columns.map((column, index) => (
    `<td style="${headerCell}${widths?.[index] ? `width:${widths[index]};` : ''}">${escapeHtml(column)}</td>`
  )).join('')}</tr>`;
}

interface CriterionRow {
  code: string;
  name: string;
  weight: number;
  score: number | null;
}

function buildCriterionRows(project: Project, isSopMethod: boolean): CriterionRow[] {
  const definitions = isSopMethod
    ? SOP_CRITERIA.map((c) => ({ key: c.key, code: c.code, name: c.name, weight: c.weight }))
    : PRIORITY_CRITERIA.map((c) => ({ key: c.key, code: c.code, name: c.name, weight: c.weight }));

  const scores = (project.current_priority_assessment?.scores ?? {}) as Record<string, unknown>;
  return definitions.map((definition) => ({
    code: definition.code,
    name: definition.name,
    weight: definition.weight,
    score: toFiniteNumber(scores[definition.key] as number | string | undefined),
  }));
}

// ---------------------------------------------------------------------------
// Blok dokumen
// ---------------------------------------------------------------------------

interface FormBlock {
  // Potongan HTML mandiri (judul bagian + isinya).
  html: string;
  // Selalu mulai di halaman baru (judul Lampiran A).
  forceNewPage?: boolean;
  // Batas pemecahan aman, dipakai HANYA bila blok ini lebih tinggi dari satu
  // halaman penuh.
  splittable?: FormBlock[];
}

function kvRow(label: string, value: string): string {
  return `<tr>
    <td style="${labelCell}">${escapeHtml(label)}</td>
    <td style="${cell}width:12px;">:</td>
    <td style="${cell}font-weight:600;">${escapeHtml(value)}</td>
  </tr>`;
}

function kvRowWrap(label: string, value: string): string {
  return `<tr>
    <td style="${labelCell}">${escapeHtml(label)}</td>
    <td style="${cell}white-space:pre-wrap;word-break:break-word;">${escapeHtml(value)}</td>
  </tr>`;
}

function wrapTable(rowsHtml: string, style: string): string {
  return `<table style="${style}">${rowsHtml}</table>`;
}

// Sel teks bebas panjang dipecah pada baris kosong; label baris hanya
// ditampilkan pada potongan pertama.
function splitParagraphs(value: string): string[] {
  const parts = value.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean);
  return parts.length > 0 ? parts : ['—'];
}

function longTextRowChunks(label: string, value: string): FormBlock[] {
  return splitParagraphs(value).map((paragraph, index) => ({
    html: wrapTable(
      `<tr><td style="${labelCell}">${index === 0 ? escapeHtml(label) : ''}</td><td style="${cell}white-space:pre-wrap;word-break:break-word;">${escapeHtml(paragraph)}</td></tr>`,
      KV_TABLE_STYLE,
    ),
  }));
}

// Blok "judul + tabel". `splittable` menyediakan batas aman: baris header
// selalu menempel pada baris data pertama (tidak pernah yatim di dasar
// halaman), sisa baris masing-masing jadi sub-blok, dan elemen setelah tabel
// (catatan kaki/ketentuan/hasil) menjadi sub-blok sendiri.
function buildTableSectionBlock(parts: {
  titleHtml?: string;
  headHtml?: string;
  rowsHtml: string[];
  tailHtml?: string;
  tableStyle?: string;
}): FormBlock {
  const titleHtml = parts.titleHtml ?? '';
  const headHtml = parts.headHtml ?? '';
  const tailHtml = parts.tailHtml ?? '';
  const tableStyle = parts.tableStyle ?? FIXED_TABLE_STYLE;

  const html = `${titleHtml}${wrapTable(`${headHtml}${parts.rowsHtml.join('')}`, tableStyle)}${tailHtml}`;

  const splittable: FormBlock[] = [];
  if (parts.rowsHtml.length > 0) {
    splittable.push({
      html: `${titleHtml}${wrapTable(`${headHtml}${parts.rowsHtml[0]}`, tableStyle)}`,
    });
    for (let index = 1; index < parts.rowsHtml.length; index += 1) {
      splittable.push({ html: wrapTable(parts.rowsHtml[index], tableStyle) });
    }
  } else {
    splittable.push({ html: `${titleHtml}${wrapTable(headHtml, tableStyle)}` });
  }
  if (tailHtml) {
    splittable.push({ html: tailHtml });
  }

  return { html, splittable };
}

function buildKopBlock(pageCountText: string): FormBlock {
  const valueCell = `${cell}font-weight:600;`;
  const row = (label: string, value: string) => `<tr>
    <td style="${labelCell}">${escapeHtml(label)}</td>
    <td style="${cell}width:12px;">:</td>
    <td style="${valueCell}">${value}</td>
  </tr>`;

  return {
    html: `
      <div style="text-align:center;margin-bottom:10px;">
        <div style="font-size:15px;font-weight:700;letter-spacing:0.3px;">FORMULIR EVALUASI PRIORITAS PROYEK HTO</div>
      </div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:4px;">
        ${row('Nomor Formulir', `${escapeHtml(FORM_TEMPLATE_NO)}&nbsp;&nbsp;<span style="display:inline-block;width:250px;border-bottom:1px dotted #6b7280;">&nbsp;</span>`)}
        ${row('TANGGAL TERBIT', escapeHtml(FORM_ISSUE_DATE))}
        ${row('NO. REVISI', escapeHtml(FORM_TEMPLATE_REVISION))}
        ${row('TANGGAL BERLAKU', escapeHtml(FORM_EFFECTIVE_DATE))}
        ${row('KLASIFIKASI', escapeHtml(FORM_CLASSIFICATION))}
        ${row('JUMLAH HALAMAN', escapeHtml(pageCountText))}
      </table>
    `,
  };
}

function buildIdentityBlocks(project: Project, analystName: string | null): FormBlock[] {
  const assessment = project.current_priority_assessment!;
  return [buildTableSectionBlock({
    titleHtml: sectionTitle('I.', 'Identitas Usulan Proyek'),
    rowsHtml: [
      kvRow('Nama Proyek', project.title),
      kvRow('Tanggal Pengajuan', formatDate(project.created_at, 'd MMMM yyyy')),
      kvRow('Unit Pemohon', project.unit),
      kvRow('Tanggal Penilaian', formatDate(assessment.assessed_at, 'd MMMM yyyy')),
      kvRow('Nama Pengaju', project.requester_name),
      kvRow('Penanggung Jawab (PIC)', project.pic || '—'),
      kvRow('Analis HTO', analystName ?? '—'),
    ],
    tableStyle: KV_TABLE_STYLE,
  })];
}

const MANDATORY_CONDITION_TEXT = 'Ketentuan: apabila sekurang-kurangnya satu butir dijawab Ya, usulan ditetapkan sebagai kategori MANDATORI (Prioritas 0 — Jalur Cepat) dan Tahap 2 tidak diberlakukan. Apabila seluruh butir dijawab Tidak, penilaian dilanjutkan ke Tahap 2.';

function buildStage1Blocks(project: Project, isSopMethod: boolean): FormBlock[] {
  const assessment = project.current_priority_assessment!;
  const title = sectionTitle('II.', 'Tahap 1 Filtrasi Mandatori');

  if (!isSopMethod) {
    return [{
      html: `${title}<p style="font-size:11px;margin:4px 0;">Snapshot ini dinilai dengan metode <strong>${escapeHtml(assessment.method_version)}</strong> sebelum SOP 2026 berlaku; Tahap 1 tidak diberlakukan pada metode tersebut.</p>`,
    }];
  }

  const answers = assessment.mandatory_answers ?? {};
  const rows = SOP_MANDATORY_QUESTIONS.map((question) => {
    const answer = answers[question.key];
    const yes = answer?.answer === true;
    const no = answer?.answer === false;
    return `<tr>
      <td style="${cell}">${question.number}.&nbsp; ${escapeHtml(question.question)}</td>
      <td style="${cell}width:60px;text-align:center;">${checkboxCell(yes)}</td>
      <td style="${cell}width:60px;text-align:center;">${checkboxCell(no)}</td>
    </tr>`;
  });

  const yesBasisLines = SOP_MANDATORY_QUESTIONS
    .filter((question) => answers[question.key]?.answer === true)
    .map((question) => {
      const basis = (answers[question.key]?.basis ?? '').trim();
      return basis
        ? `<div style="font-size:11px;margin:3px 0 3px 14px;">— <em>Dasar ${question.number}: ${escapeHtml(basis)}</em></div>`
        : '';
    })
    .filter(Boolean)
    .join('');

  const hasAnyYes = SOP_MANDATORY_QUESTIONS.some((q) => answers[q.key]?.answer === true);
  const allAnsweredNo = SOP_MANDATORY_QUESTIONS.every((q) => answers[q.key]?.answer === false);
  const outcome = hasAnyYes
    ? 'Hasil Tahap 1: sekurang-kurangnya satu butir dijawab Ya — usulan ditetapkan MANDATORI (Prioritas 0 — Jalur Cepat); Tahap 2 tidak diberlakukan.'
    : allAnsweredNo
      ? 'Hasil Tahap 1: seluruh butir dijawab Tidak, penilaian dilanjutkan ke Tahap 2.'
      : 'Hasil Tahap 1: jawaban belum lengkap.';

  const tableBlock = buildTableSectionBlock({
    titleHtml: title,
    headHtml: tableHeader(['BUTIR PEMERIKSAAN', 'YA', 'TIDAK'], ['', '60px', '60px']),
    rowsHtml: rows,
    tableStyle: FIXED_TABLE_STYLE,
  });

  const extras: FormBlock[] = [];
  if (yesBasisLines) {
    extras.push({ html: yesBasisLines });
  }
  extras.push({ html: `<p style="font-size:11px;margin:8px 0 0;">${escapeHtml(MANDATORY_CONDITION_TEXT)}</p>` });
  extras.push({ html: `<p style="font-size:11px;font-weight:600;margin:6px 0 0;">${escapeHtml(outcome)}</p>` });

  return [{
    html: `${tableBlock.html}${extras.map((extra) => extra.html).join('')}`,
    splittable: [...(tableBlock.splittable ?? []), ...extras],
  }];
}

function buildStage2Blocks(project: Project, isSopMethod: boolean, isMandatory: boolean): FormBlock[] {
  const assessment = project.current_priority_assessment!;
  const view = buildPriorityAssessmentView(assessment);
  const title = sectionTitle('III.', 'Tahap 2 — Penilaian Pembobotan Kriteria');

  if (isMandatory) {
    return [{
      html: `${title}<p style="font-size:11px;margin:4px 0;">Tahap 2 tidak diberlakukan — usulan ditetapkan MANDATORI (Prioritas 0 — Jalur Cepat).</p>`,
    }];
  }

  const criteriaRows = buildCriterionRows(project, isSopMethod);
  const weightTotal = criteriaRows.reduce((sum, row) => sum + row.weight, 0);
  const totalScore = toFiniteNumber(assessment.impact_score);
  const scorePercent = toFiniteNumber(assessment.score_percent);

  const totalText = totalScore === null
    ? '—'
    : `${formatNumberID(totalScore, 2)} / ${formatNumberID(view.scaleMax, 2)}${scorePercent === null ? '' : ` (${formatNumberID(scorePercent, 2)}%)`}`;

  const rows = criteriaRows.map((row) => {
    const weighted = row.score === null ? null : row.score * row.weight;
    return `<tr>
      <td style="${cell}"><strong>${escapeHtml(row.code)}.</strong> ${escapeHtml(row.name)}</td>
      <td style="${cell}text-align:center;">${row.score === null ? '—' : row.score}</td>
      <td style="${cell}text-align:center;">${formatNumberID(row.weight, 2)}</td>
      <td style="${cell}text-align:center;">${weighted === null ? '—' : formatNumberID(weighted, 2)}</td>
    </tr>`;
  });
  rows.push(`<tr style="background:#f3f4f6;">
    <td style="${cell}font-weight:700;">TOTAL SKOR AKHIR PRIORITAS</td>
    <td style="${cell}text-align:center;">—</td>
    <td style="${cell}text-align:center;">${formatNumberID(weightTotal, 2)}</td>
    <td style="${cell}text-align:center;font-weight:700;">${totalText}</td>
  </tr>`);

  return [buildTableSectionBlock({
    titleHtml: title,
    headHtml: tableHeader(['KRITERIA EVALUASI', `SKOR (1–${view.scaleMax})`, 'BOBOT', 'SKOR TERTIMBANG'], ['', '90px', '70px', '120px']),
    rowsHtml: rows,
    tailHtml: '<p style="font-size:10.5px;color:#4b5563;margin:6px 0 0;">Rumus: Skor Tertimbang = Skor × Bobot; Total Skor Akhir = Σ Skor Tertimbang. Rincian rubrik penilaian tiap kriteria tercantum pada Lampiran A.</p>',
    tableStyle: FIXED_TABLE_STYLE,
  })];
}

function buildFinancialBlocks(project: Project, isSopMethod: boolean, isMandatory: boolean): FormBlock[] {
  const assessment = project.current_priority_assessment!;
  const title = sectionTitle('IV.', 'Status Kelayakan Finansial');

  if (!isSopMethod || isMandatory) {
    return [{
      html: `${title}<p style="font-size:11px;margin:4px 0;">Tidak berlaku — ${isMandatory ? 'proyek mandatori melewati skoring Tahap 2' : 'metode penilaian snapshot tidak memakai gate finansial SOP 2026'}.</p>`,
    }];
  }

  const approved = assessment.financial_gate_status === 'approved';
  const gated = assessment.financial_gate_status === 'gated';

  const approvedLine = `<div style="margin:4px 0;">${checkboxCell(approved)} <strong>DISETUJUI</strong> — Skor K3 &gt; 3; usulan memenuhi syarat untuk masuk Master Queue.</div>`;
  const gatedLine = `<div style="margin:4px 0;">${checkboxCell(gated)} <strong>TERTAHAN</strong> — Skor K3 ≤ 3; memerlukan justifikasi ulang atau diskresi Direksi.</div>`;

  return [{
    html: `${title}<div style="font-size:11.5px;margin:6px 0;">${approvedLine}${gatedLine}</div>`,
    splittable: [
      { html: `${title}<div style="font-size:11.5px;margin:6px 0;">${approvedLine}</div>` },
      { html: `<div style="font-size:11.5px;margin:4px 0;">${gatedLine}</div>` },
    ],
  }];
}

function buildProbingBlocks(project: Project): FormBlock[] {
  const probing = project.current_priority_assessment?.probing_session ?? {};
  const title = sectionTitle('V.', 'Catatan Hasil Sesi Evaluasi Analis HTO');

  const simpleRows = [
    kvRowWrap('Tanggal Sesi Pendalaman', probing.date || '—'),
    kvRowWrap('Peserta', probing.participants || '—'),
  ];
  const notesLabel = 'Ringkasan Hasil';
  const notesValue = probing.notes || '—';
  const followUpRow = kvRowWrap('Tindak Lanjut yang Disepakati', '—');

  const html = `${title}${wrapTable(
    `${simpleRows.join('')}${kvRowWrap(notesLabel, notesValue)}${followUpRow}`,
    KV_TABLE_STYLE,
  )}`;

  const splittable: FormBlock[] = [
    { html: `${title}${wrapTable(simpleRows.join(''), KV_TABLE_STYLE)}` },
    ...longTextRowChunks(notesLabel, notesValue),
    { html: wrapTable(followUpRow, KV_TABLE_STYLE) },
  ];

  return [{ html, splittable }];
}

function buildOutcomeBlocks(project: Project): FormBlock[] {
  const assessment = project.current_priority_assessment!;
  const view = buildPriorityAssessmentView(assessment);

  const totalScore = toFiniteNumber(assessment.impact_score);
  const scorePercent = toFiniteNumber(assessment.score_percent);
  const effort = toFiniteNumber(assessment.effort);
  const priorityIndex = toFiniteNumber(assessment.priority_index);

  const totalMain = view.isMandatory
    ? 'Priority 0'
    : totalScore === null
      ? '—'
      : formatNumberID(totalScore, 2);
  const totalSub = view.isMandatory
    ? 'Mandatori — tanpa skoring'
    : scorePercent === null
      ? ''
      : `dari ${formatNumberID(view.scaleMax, 2)} (${formatNumberID(scorePercent, 2)}%)`;

  const effortMain = effort === null ? '—' : `${effort} / 5`;
  const effortSub = view.quadrant ? `Kuadran ${QUADRANT_EXPORT_LABELS[view.quadrant]}` : '';

  const indexMain = priorityIndex === null ? '—' : formatNumberID(priorityIndex, 3);
  const indexSub = 'Total Skor ÷ Upaya';

  const finalDecisionLabel = view.finalDecision ? finalDecisionConfig[view.finalDecision].label : '—';
  const decisionBadge = view.finalDecision
    ? finalDecisionConfig[view.finalDecision].label.split('(')[0].trim().toUpperCase()
    : '—';

  const recommendationLabel = view.recommendation ? recommendationConfig[view.recommendation].label : '—';
  const acceptedDeferred = Boolean(
    assessment.final_decision === 'deferred' && project.requester_decision === 'accepted',
  );

  const card = (cardTitle: string, main: string, sub: string) => `<td style="${cell}text-align:center;padding:6px;">
    <div style="font-size:10px;font-weight:700;text-transform:uppercase;">${escapeHtml(cardTitle)}</div>
    <div style="font-size:14px;font-weight:700;margin-top:3px;">${escapeHtml(main)}</div>
    ${sub ? `<div style="font-size:10px;color:#4b5563;margin-top:2px;">${escapeHtml(sub)}</div>` : ''}
  </td>`;

  const title = sectionTitle('VI.', 'Hasil Penilaian dan Keputusan');
  const cardsTable = `<table style="${FIXED_TABLE_STYLE}"><tr>
    ${card('TOTAL SKOR', totalMain, totalSub)}
    ${card('TINGKAT UPAYA', effortMain, effortSub)}
    ${card('INDEKS PRIORITAS', indexMain, indexSub)}
    ${card('KEPUTUSAN FORMAL', decisionBadge, '')}
  </tr></table>`;

  const recommendationRow = kvRowWrap('Rekomendasi Kalkulator', recommendationLabel);
  const decisionRow = kvRowWrap(
    'Keputusan Formal',
    acceptedDeferred ? `${finalDecisionLabel} — jadwal tindak lanjut diterima pengaju` : finalDecisionLabel,
  );
  const basisLabel = 'Dasar Pertimbangan';
  const basisValue = (assessment.final_decision_note || '').trim() || '—';
  const targetRow = kvRowWrap('Target Peninjauan Ulang', '—');

  const detailsTable = wrapTable(
    `${recommendationRow}${decisionRow}${kvRowWrap(basisLabel, basisValue)}${targetRow}`,
    `${KV_TABLE_STYLE}margin-top:6px;`,
  );

  const splittable: FormBlock[] = [
    { html: `${title}${cardsTable}` },
    { html: wrapTable(recommendationRow, KV_TABLE_STYLE) },
    { html: wrapTable(decisionRow, KV_TABLE_STYLE) },
    ...longTextRowChunks(basisLabel, basisValue),
    { html: wrapTable(targetRow, KV_TABLE_STYLE) },
  ];

  return [{ html: `${title}${cardsTable}${detailsTable}`, splittable }];
}

function buildFooterHtml(generatedAt: string): string {
  return `<p style="font-size:10px;color:#4b5563;margin-top:16px;border-top:1px solid #9ca3af;padding-top:6px;">
    Dihasilkan secara otomatis oleh SIMAPROS pada ${escapeHtml(generatedAt)}. Angka pada formulir ini merupakan
    snapshot keputusan dan tidak dihitung ulang dari kolom prioritas operasional. Dokumen sah tanpa tanda tangan
    basah apabila diterbitkan melalui SIMAPROS.
  </p>`;
}

function buildMainBlocks(
  project: Project,
  analystName: string | null,
  generatedAt: string,
  pageCountText: string,
): FormBlock[] {
  const assessment = project.current_priority_assessment!;
  const view = buildPriorityAssessmentView(assessment);

  return [
    buildKopBlock(pageCountText),
    ...buildIdentityBlocks(project, analystName),
    ...buildStage1Blocks(project, view.isSopMethod),
    ...buildStage2Blocks(project, view.isSopMethod, view.isMandatory),
    ...buildFinancialBlocks(project, view.isSopMethod, view.isMandatory),
    ...buildProbingBlocks(project),
    ...buildOutcomeBlocks(project),
    { html: buildFooterHtml(generatedAt) },
  ];
}

function buildAnnexBlocks(): FormBlock[] {
  const blocks: FormBlock[] = [];

  blocks.push({
    html: `<div style="text-align:center;margin-bottom:12px;border-bottom:2px solid #111827;padding-bottom:8px;">
      <div style="font-size:14px;font-weight:700;">LAMPIRAN A — RUBRIK PENILAIAN DAN KETENTUAN PELAKSANAAN</div>
    </div>`,
    forceNewPage: true,
  });

  const bandRows = [
    ['9 – 10', 'Sangat Tinggi', 'Dampak sangat signifikan, terukur, dan didukung bukti atau data yang lengkap.'],
    ['7 – 8', 'Tinggi', 'Dampak signifikan dengan sebagian bukti pendukung tersedia.'],
    ['5 – 6', 'Sedang', 'Dampak cukup, masih memerlukan validasi lanjutan.'],
    ['3 – 4', 'Rendah', 'Dampak terbatas atau bukti pendukung minim.'],
    ['1 – 2', 'Sangat Rendah', 'Dampak tidak signifikan atau tidak dapat diverifikasi.'],
  ].map((cells) => `<tr>
    <td style="${cell}text-align:center;width:90px;">${escapeHtml(cells[0])}</td>
    <td style="${cell}width:120px;">${escapeHtml(cells[1])}</td>
    <td style="${cell}">${escapeHtml(cells[2])}</td>
  </tr>`);

  blocks.push(buildTableSectionBlock({
    titleHtml: '<div style="font-size:12px;font-weight:700;margin:10px 0 6px;">A.1&nbsp; Rubrik Skala Skor Kriteria</div>',
    headHtml: tableHeader(['RENTANG SKOR', 'KUALIFIKASI', 'PEDOMAN PENETAPAN']),
    rowsHtml: bandRows,
    tableStyle: FIXED_TABLE_STYLE,
  }));

  const quadrantRows = [
    ['Quick Win', 'Skor tinggi · Upaya rendah', 'Dieksekusi paling awal pada antrean.'],
    ['Major Project', 'Skor tinggi · Upaya tinggi', 'Memerlukan perencanaan sumber daya dan persetujuan Direksi.'],
    ['Fill-in', 'Skor sedang · Upaya sedang atau rendah', 'Dijadwalkan sebagai pengisi kapasitas antrean.'],
    ['Thankless Task', 'Skor rendah · Upaya tinggi', 'Ditunda atau ditolak, kecuali terdapat kewajiban regulasi.'],
  ].map((cells) => `<tr>
    <td style="${cell}font-weight:600;width:130px;">${escapeHtml(cells[0])}</td>
    <td style="${cell}width:200px;">${escapeHtml(cells[1])}</td>
    <td style="${cell}">${escapeHtml(cells[2])}</td>
  </tr>`);

  blocks.push(buildTableSectionBlock({
    titleHtml: '<div style="font-size:12px;font-weight:700;margin:14px 0 6px;">A.2&nbsp; Klasifikasi Tingkat Upaya dan Kuadran Prioritas</div>',
    headHtml: tableHeader(['KUADRAN', 'KOMBINASI', 'PERLAKUAN TINDAK LANJUT']),
    rowsHtml: quadrantRows,
    tailHtml: '<p style="font-size:11px;margin:6px 0 0;">Indeks Prioritas = Total Skor Akhir ÷ Tingkat Upaya. Semakin tinggi nilai indeks, semakin awal posisi usulan dalam Master Queue. Contoh: 6,80 ÷ 3 = 2,267.</p>',
    tableStyle: FIXED_TABLE_STYLE,
  }));

  const provisions = [
    'Formulir ini diisi oleh Analis HTO berdasarkan permintaan unit pengaju dan hasil sesi pendalaman (probing).',
    'Seluruh skor wajib disertai dasar pertimbangan yang dapat ditelusuri pada berkas usulan.',
    'Formulir dinyatakan sah setelah memperoleh pengesahan pada Bagian VII.',
    'Perubahan atas skor atau keputusan setelah pengesahan wajib dituangkan dalam revisi formulir baru dengan nomor registrasi yang sama dan nomor revisi bertambah.',
    'Dokumen ini bersifat internal dan terbatas; penggandaan atau penyebarluasan kepada pihak di luar rumah sakit memerlukan izin tertulis Kepala HTO.',
    'Masa retensi dokumen: 5 (lima) tahun sejak tanggal pengesahan.',
  ];
  const provisionItemHtml = (index: number, text: string) => `<div style="font-size:11px;margin:4px 0;">${index + 1}.&nbsp; ${escapeHtml(text)}</div>`;
  const provisionsTitle = '<div style="font-size:12px;font-weight:700;margin:14px 0 6px;">A.3&nbsp; Ketentuan Umum</div>';

  blocks.push({
    html: `${provisionsTitle}${provisions.map((text, index) => provisionItemHtml(index, text)).join('')}`,
    splittable: [
      { html: `${provisionsTitle}${provisionItemHtml(0, provisions[0])}` },
      ...provisions.slice(1).map((text, index) => ({ html: provisionItemHtml(index + 1, text) })),
    ],
  });

  const revisionRows = [
    ['00', '02 Januari 2026', 'Penerbitan awal formulir.', 'Kepala HTO'],
    ['01', '15 Januari 2026', 'Penambahan Tahap 1 — Filtrasi Mandatori.', 'Kepala HTO'],
    ['02', '01 Februari 2026', 'Penyesuaian bobot kriteria K3 dan penambahan Gatekeeper Check.', 'Kepala HTO'],
  ].map((cells) => `<tr>
    <td style="${cell}text-align:center;width:60px;">${escapeHtml(cells[0])}</td>
    <td style="${cell}width:120px;">${escapeHtml(cells[1])}</td>
    <td style="${cell}">${escapeHtml(cells[2])}</td>
    <td style="${cell}width:110px;">${escapeHtml(cells[3])}</td>
  </tr>`);

  blocks.push(buildTableSectionBlock({
    titleHtml: '<div style="font-size:12px;font-weight:700;margin:14px 0 6px;">A.4&nbsp; Riwayat Revisi Dokumen</div>',
    headHtml: tableHeader(['REVISI', 'TANGGAL BERLAKU', 'URAIAN PERUBAHAN', 'DISAHKAN OLEH']),
    rowsHtml: revisionRows,
    tableStyle: FIXED_TABLE_STYLE,
  }));

  blocks.push({
    html: `<p style="font-size:10.5px;color:#4b5563;margin-top:14px;border-top:1px solid #9ca3af;padding-top:6px;">
      Lampiran ini merupakan bagian tidak terpisahkan dari Formulir Evaluasi Prioritas Proyek HTO Nomor
      <span style="display:inline-block;width:230px;border-bottom:1px dotted #6b7280;">&nbsp;</span>.
    </p>`,
  });

  return blocks;
}

// ---------------------------------------------------------------------------
// Rendering & packing
// ---------------------------------------------------------------------------

async function renderBlockCanvas(
  html: string,
  html2canvas: typeof import('html2canvas').default,
): Promise<HTMLCanvasElement> {
  const container = document.createElement('div');
  // Lebar konten sama seperti dokumen lama (800px di dalam padding 40px).
  // Padding atas dihilangkan supaya blok tidak membawa spasi mati, sedangkan
  // padding bawah 12px WAJIB ada: html2canvas menggambar baris teks terakhir
  // beberapa piksel lebih rendah dari kotak elemen, sehingga tanpa cadangan
  // bawah baris terakhir blok terpotong dan tampak tertutup latar putih blok
  // berikutnya.
  container.style.cssText = `
    position: absolute; left: -9999px; top: 0; width: ${FORM_WIDTH}px;
    padding: 0 40px 12px; overflow: hidden; background: #ffffff; color: #111827;
    font-family: 'Segoe UI', Calibri, Tahoma, Geneva, Verdana, sans-serif;
  `;
  container.innerHTML = html;
  document.body.appendChild(container);

  try {
    await new Promise((resolve) => setTimeout(resolve, 20));
    return await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: FORM_WIDTH + 80,
      windowHeight: container.scrollHeight,
    });
  } finally {
    document.body.removeChild(container);
  }
}

function imageHeightMm(canvas: HTMLCanvasElement): number {
  return (canvas.height * CONTENT_WIDTH_MM) / canvas.width;
}

interface MeasuredAtom {
  canvas: HTMLCanvasElement;
  heightMm: number;
  forceNewPage?: boolean;
}

interface RenderedBlock {
  canvas: HTMLCanvasElement;
  heightMm: number;
}

// Fallback terakhir untuk blok yang masih lebih tinggi dari satu halaman
// (mis. satu paragraf sangat panjang): potong canvas tepat di batas halaman.
function sliceCanvasIntoPages(canvas: HTMLCanvasElement): MeasuredAtom[] {
  const pxPerMm = canvas.width / CONTENT_WIDTH_MM;
  const pageHeightPx = Math.max(1, Math.floor((CONTENT_HEIGHT_MM - FIT_TOLERANCE_MM) * pxPerMm));
  const atoms: MeasuredAtom[] = [];

  for (let offset = 0; offset < canvas.height; offset += pageHeightPx) {
    const chunkHeight = Math.min(pageHeightPx, canvas.height - offset);
    const chunk = document.createElement('canvas');
    chunk.width = canvas.width;
    chunk.height = chunkHeight;
    const context = chunk.getContext('2d');
    if (context) {
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, chunk.width, chunk.height);
      context.drawImage(canvas, 0, offset, canvas.width, chunkHeight, 0, 0, canvas.width, chunkHeight);
    }
    atoms.push({ canvas: chunk, heightMm: (chunkHeight * CONTENT_WIDTH_MM) / canvas.width });
  }

  return atoms;
}

async function measureBlocks(
  blocks: FormBlock[],
  html2canvas: typeof import('html2canvas').default,
  cache: Map<string, RenderedBlock>,
): Promise<MeasuredAtom[]> {
  const atoms: MeasuredAtom[] = [];

  const render = async (html: string): Promise<RenderedBlock> => {
    const cached = cache.get(html);
    if (cached) return cached;
    const canvas = await renderBlockCanvas(html, html2canvas);
    const entry = { canvas, heightMm: imageHeightMm(canvas) };
    cache.set(html, entry);
    return entry;
  };

  const walk = async (block: FormBlock, isTopLevel: boolean): Promise<void> => {
    const { canvas, heightMm } = await render(block.html);
    const fits = heightMm <= CONTENT_HEIGHT_MM + FIT_TOLERANCE_MM;

    if (fits) {
      atoms.push({
        canvas,
        heightMm,
        forceNewPage: isTopLevel ? block.forceNewPage : undefined,
      });
      return;
    }

    if (block.splittable && block.splittable.length > 0) {
      for (const sub of block.splittable) {
        await walk(sub, false);
      }
      return;
    }

    atoms.push(...sliceCanvasIntoPages(canvas));
  };

  for (const block of blocks) {
    await walk(block, true);
  }

  return atoms;
}

interface PackedAtom {
  canvas: HTMLCanvasElement;
  heightMm: number;
  yMm: number;
}

interface PackedPage {
  atoms: PackedAtom[];
}

function packAtoms(atoms: MeasuredAtom[]): PackedPage[] {
  const pages: PackedPage[] = [{ atoms: [] }];

  for (const atom of atoms) {
    if (atom.forceNewPage && pages[pages.length - 1].atoms.length > 0) {
      pages.push({ atoms: [] });
    }

    const page = pages[pages.length - 1];
    const usedMm = page.atoms.reduce((sum, placed) => sum + placed.heightMm, 0);

    if (usedMm + atom.heightMm > CONTENT_HEIGHT_MM + FIT_TOLERANCE_MM && page.atoms.length > 0) {
      pages.push({ atoms: [{ canvas: atom.canvas, heightMm: atom.heightMm, yMm: 0 }] });
      continue;
    }

    page.atoms.push({ canvas: atom.canvas, heightMm: atom.heightMm, yMm: usedMm });
  }

  return pages;
}

export async function exportPriorityAssessmentFormPdf(project: Project): Promise<void> {
  const assessment = project.current_priority_assessment;
  if (!assessment) {
    throw new Error('Proyek ini belum memiliki snapshot penilaian Tier 2.');
  }

  const [{ default: jsPDF }, { default: html2canvas }, analystName] = await Promise.all([
    import('jspdf'),
    import('html2canvas'),
    resolveAnalystName(assessment.assessed_by),
  ]);

  const generatedAt = `${format(new Date(), "d MMMM yyyy 'pukul' HH.mm", { locale: localeId })} WIB`;

  const annexBlocks = buildAnnexBlocks();
  const renderCache = new Map<string, RenderedBlock>();

  // Ukur + packing berulang sampai teks jumlah halaman di kop stabil, karena
  // teks itu sendiri memengaruhi tinggi blok kop dan bisa mengubah total.
  let pageCountText = '—';
  let packed: PackedPage[] = [];
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const blocks = [
      ...buildMainBlocks(project, analystName, generatedAt, pageCountText),
      ...annexBlocks,
    ];
    const atoms = await measureBlocks(blocks, html2canvas, renderCache);
    packed = packAtoms(atoms);

    const nextText = `${packed.length} (${terbilang(packed.length)}) halaman`;
    if (nextText === pageCountText) break;
    pageCountText = nextText;
  }

  const pdf = new jsPDF('p', 'mm', 'a4');
  packed.forEach((page, pageIndex) => {
    if (pageIndex > 0) pdf.addPage();
    for (const placed of page.atoms) {
      const image = placed.canvas.toDataURL('image/png');
      pdf.addImage(
        image,
        'PNG',
        MARGIN_MM,
        MARGIN_MM + placed.yMm,
        CONTENT_WIDTH_MM,
        placed.heightMm,
        undefined,
        'FAST',
      );
    }
  });

  const pageCount = pdf.getNumberOfPages();
  if (import.meta.env.DEV && pageCount !== packed.length) {
    console.warn(
      `[exportPriorityAssessmentFormPdf] jumlah halaman tidak sinkron: packing=${packed.length}, pdf=${pageCount}`,
    );
  }

  for (let i = 1; i <= pageCount; i += 1) {
    pdf.setPage(i);
    pdf.setFontSize(9);
    pdf.setTextColor(75, 85, 99);
    pdf.text(`Halaman ${i} dari ${pageCount}`, PAGE_WIDTH_MM / 2, PAGE_HEIGHT_MM - 5, { align: 'center' });
  }

  const filename = `formulir-evaluasi-prioritas-${slugify(project.title)}-rev${assessment.revision_no}.pdf`;
  pdf.save(filename);
}
