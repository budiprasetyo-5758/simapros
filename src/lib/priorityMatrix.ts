// Priority Matrix based on Urgency × Impact
// Reference: User-provided image matrix
//
// Panduan skor mengikuti Pedoman Tata Kelola Penentuan Prioritas Proyek IT (HTO),
// Bab 4.1: Behaviorally Anchored Rating Scale (BARS). Penilai mencocokkan kondisi
// proyek riil dengan kalimat yang PALING SESUAI, bukan menebak angka — ini yang
// mencegah inflasi skor (pedoman mencatat hampir seluruh program RSB RSCM
// 2025-2029 mendapat skor 4-5 ketika penilai hanya diberi skala angka polos).

import type { ProjectPriority } from '@/types/project';

export type Urgency = 'very_low' | 'low' | 'medium' | 'high';
export type Impact = 'minimal' | 'minor' | 'significant' | 'severe';
export type CalculatedPriority = 'low' | 'medium' | 'high' | 'critical';
export type EffortScore = 1 | 2 | 3 | 4 | 5;
export type Quadrant = 'quick_win' | 'big_bet' | 'fill_in' | 'thankless';

// Matrix values from the reference image
// Rows: Urgency (Very Low, Low, Medium, High)
// Columns: Impact (Minimal, Minor, Significant, Severe)
const priorityMatrix: Record<Urgency, Record<Impact, CalculatedPriority>> = {
  very_low: {
    minimal: 'low',      // Green (empty)
    minor: 'low',        // Green (empty)
    significant: 'low',  // Yellow (3)
    severe: 'medium',    // Yellow (5)
  },
  low: {
    minimal: 'low',      // Green (empty)
    minor: 'low',        // Green (empty)
    significant: 'medium', // Yellow (4)
    severe: 'high',      // Orange (8)
  },
  medium: {
    minimal: 'low',      // Yellow (1)
    minor: 'low',        // Green (empty)
    significant: 'medium', // Yellow (6)
    severe: 'high',      // Orange (9)
  },
  high: {
    minimal: 'medium',   // Yellow (2)
    minor: 'medium',     // Yellow (7)
    significant: 'high', // Orange/Red
    severe: 'critical',  // Red (10)
  },
};

export function calculatePriority(urgency: Urgency, impact: Impact): CalculatedPriority {
  return priorityMatrix[urgency]?.[impact] || 'medium';
}

// Gerbang prioritas: hanya nilai di bawah ini yang langsung diteruskan ke
// Eksekutor. Sisanya dikembalikan ke pengaju untuk konfirmasi jadwal.
// Ubah konstanta ini untuk melonggarkan/memperketat ambang batas.
//
// Sengaja TIDAK memperhitungkan Effort. Effort hanya memengaruhi label kuadran
// dan usulan jadwal — proyek keselamatan pasien dengan effort berat tetap wajib
// dikerjakan ('Big Bet'), bukan dibuang sebagai 'Thankless Task'.
export const FAST_TRACK_PRIORITIES: CalculatedPriority[] = ['critical', 'high'];

export function isFastTrack(priority: CalculatedPriority): boolean {
  return FAST_TRACK_PRIORITIES.includes(priority);
}

// Enum project_priority di database tidak punya 'critical' — nilai tertingginya
// bernama 'urgent'. Pemetaan ini dipakai di setiap tempat yang menulis priority.
export function toDbPriority(priority: CalculatedPriority): ProjectPriority {
  return priority === 'critical' ? 'urgent' : priority;
}

// Jangkar BARS untuk Urgensi diturunkan dari kriteria K5 (Urgensi / Cost of
// Delay) pedoman Bab 4.1. Pedoman memakai 5 level, matriks ini 4, sehingga
// level 4 dan 5 pedoman digabung ke 'high'.
export const urgencyOptions: { value: Urgency; label: string; description: string }[] = [
  {
    value: 'very_low',
    label: 'Sangat Rendah',
    description: 'Tidak ada konsekuensi berarti bila ditunda lebih dari 12 bulan.',
  },
  {
    value: 'low',
    label: 'Rendah',
    description: 'Penundaan menimbulkan ketidaknyamanan kecil, mudah dimitigasi manual.',
  },
  {
    value: 'medium',
    label: 'Sedang',
    description: 'Penundaan 6-12 bulan mulai berdampak pada kualitas layanan/pelaporan.',
  },
  {
    value: 'high',
    label: 'Tinggi',
    description:
      'Penundaan berisiko denda, keluhan pasien meningkat, tenggat regulasi mendekat, atau berdampak langsung pada keselamatan pasien.',
  },
];

// Jangkar BARS untuk Impact menggabungkan kriteria K1 (Keselamatan Pasien &
// Risiko Klinis) dan K4 (Dampak Operasional & Efisiensi) pedoman Bab 4.1,
// karena matriks 2 sumbu ini belum memisahkan keduanya. Pemetaan level:
// minimal <- 1, minor <- 2, significant <- 3 dan 4, severe <- 5.
export const impactOptions: { value: Impact; label: string; description: string }[] = [
  {
    value: 'minimal',
    label: 'Minimal',
    description:
      'Tidak terkait keselamatan pasien; murni administratif. Berdampak pada kurang dari 1 unit kecil.',
  },
  {
    value: 'minor',
    label: 'Minor',
    description:
      'Berpotensi mengurangi risiko minor tanpa dampak langsung ke pasien. Mempercepat proses di 1 unit.',
  },
  {
    value: 'significant',
    label: 'Signifikan',
    description:
      'Mengurangi risiko insiden ringan sampai mencegah insiden keselamatan pasien (KTD/KNC) berdampak sedang-mayor. Berdampak lintas-instalasi.',
  },
  {
    value: 'severe',
    label: 'Kritis',
    description:
      'Mencegah kejadian sentinel/katastropik, atau menindaklanjuti temuan kritikal KARS/JCI. Berdampak rumah sakit-wide.',
  },
];

// Jangkar BARS Effort diambil verbatim dari pedoman Bab 4.1.
//
// `label` dipakai di dropdown (memuat angka agar penilai melihat skalanya),
// `name` dipakai saat merangkai teks dasar penilaian supaya tidak muncul dua
// em-dash beruntun.
//
// PENTING - arah skala berkebalikan dari kriteria dampak: skor Effort TINGGI
// berarti SULIT dikerjakan. Pedoman Bab 2 memperingatkan bahwa RSB memakai
// 'Skor Kemudahan Implementasi' (tinggi = mudah), sehingga skor RSB tidak boleh
// disalin langsung ke sini. Salah tanda di sini membalik seluruh peringkat
// tanpa gejala yang terlihat di UI.
export const effortOptions: {
  value: EffortScore;
  label: string;
  name: string;
  description: string;
}[] = [
  {
    value: 1,
    label: '1 — Sangat Mudah',
    name: 'Sangat Mudah',
    description: 'Tim internal HTO, kurang dari 1 bulan, tanpa vendor eksternal.',
  },
  {
    value: 2,
    label: '2 — Mudah',
    name: 'Mudah',
    description: 'Sedikit koordinasi lintas unit, 1-3 bulan.',
  },
  {
    value: 3,
    label: '3 — Sedang',
    name: 'Sedang',
    description: 'Koordinasi lintas unit, 3-6 bulan, mungkin butuh vendor pendukung.',
  },
  {
    value: 4,
    label: '4 — Sulit',
    name: 'Sulit',
    description: 'Banyak ketergantungan sistem, vendor eksternal, 6-12 bulan.',
  },
  {
    value: 5,
    label: '5 — Sangat Sulit',
    name: 'Sangat Sulit',
    description:
      'Infrastruktur baru, vendor pihak ke-3, lebih dari 12 bulan, risiko implementasi tinggi.',
  },
];

// Effort >= nilai ini dianggap 'tinggi' saat menentukan kuadran. Dipisah sebagai
// konstanta agar ambang batas bisa disetel tanpa membongkar logika kuadran.
export const EFFORT_HIGH_THRESHOLD: EffortScore = 4;

// Kuadran Impact-Effort, pedoman Bab 6.2. Sumbu dampak memakai kelas prioritas
// hasil matriks (high/critical = dampak tinggi).
export function calculateQuadrant(
  priority: CalculatedPriority,
  effort: EffortScore
): Quadrant {
  const highImpact = isFastTrack(priority);
  const highEffort = effort >= EFFORT_HIGH_THRESHOLD;

  if (highImpact) return highEffort ? 'big_bet' : 'quick_win';
  return highEffort ? 'thankless' : 'fill_in';
}

export const quadrantConfig: Record<
  Quadrant,
  { label: string; condition: string; recommendation: string; className: string }
> = {
  quick_win: {
    label: 'Quick Win',
    condition: 'Dampak tinggi, effort rendah',
    recommendation: 'Prioritaskan untuk segera dikerjakan.',
    className: 'bg-success/10 text-success border-success/20',
  },
  big_bet: {
    label: 'Big Bet',
    condition: 'Dampak tinggi, effort tinggi',
    recommendation:
      'Masuk roadmap jangka menengah, perlu perencanaan matang & alokasi sumber daya khusus.',
    className: 'bg-primary/10 text-primary border-primary/20',
  },
  fill_in: {
    label: 'Fill-in',
    condition: 'Dampak rendah, effort rendah',
    recommendation: 'Kerjakan bila kapasitas tersedia (pengisi sela).',
    className: 'bg-warning/10 text-warning border-warning/20',
  },
  thankless: {
    label: 'Thankless Task',
    condition: 'Dampak rendah, effort tinggi',
    recommendation: 'Pertimbangkan untuk ditunda atau ditolak.',
    className: 'bg-destructive/10 text-destructive border-destructive/20',
  },
};

// Perkiraan durasi pengerjaan per level Effort, diturunkan dari rentang waktu
// pada jangkar BARS Effort di atas. Dipakai untuk mengisi usulan tanggal selesai
// saat deprioritisasi, supaya jadwal yang ditawarkan ke pengaju punya dasar.
const EFFORT_DURATION_DAYS: Record<EffortScore, number> = {
  1: 30,   // < 1 bulan
  2: 90,   // 1-3 bulan
  3: 180,  // 3-6 bulan
  4: 365,  // 6-12 bulan
  5: 540,  // > 12 bulan
};

export function suggestedDurationDays(effort: EffortScore): number {
  return EFFORT_DURATION_DAYS[effort];
}

export const priorityConfig: Record<CalculatedPriority, { label: string; className: string; color: string }> = {
  low: {
    label: 'Low',
    className: 'bg-success/10 text-success border-success/20',
    color: 'bg-success',
  },
  medium: {
    label: 'Medium',
    className: 'bg-warning/10 text-warning border-warning/20',
    color: 'bg-warning',
  },
  high: {
    label: 'High',
    className: 'bg-chart-4/10 text-chart-4 border-chart-4/20',
    color: 'bg-chart-4',
  },
  critical: {
    label: 'Critical',
    className: 'bg-destructive/10 text-destructive border-destructive/20',
    color: 'bg-destructive',
  },
};

// Merangkai jangkar BARS yang dipilih penilai menjadi teks justifikasi.
//
// Karena jangkar BARS sudah berbentuk kalimat, jangkar terpilih secara harfiah
// ADALAH dasar penilaiannya — tidak ada teks baru yang perlu dikarang.
//
// Hasil fungsi ini DIBEKUKAN sebagai teks ke kolom projects.priority_rationale
// saat keputusan dibuat, bukan dihitung ulang saat render. Pedoman Bab 9
// mengizinkan Steering Committee merevisi kalimat jangkar tiap 12 bulan; kalau
// dihitung ulang, revisi itu akan mengubah alasan tertulis keputusan lama secara
// senyap.
//
// Ini adalah DASAR penilaian, bukan KONTEKS proyek. Penjelasan spesifik untuk
// unit pengaju ("menunggu integrasi SIMRS fase 1 selesai") tetap ditulis manual
// oleh HTO ke kolom priority_note.
export function buildPriorityRationale(input: {
  urgency: Urgency;
  impact: Impact;
  effort: EffortScore;
}): string {
  const urgencyOpt = urgencyOptions.find(o => o.value === input.urgency);
  const impactOpt = impactOptions.find(o => o.value === input.impact);
  const effortOpt = effortOptions.find(o => o.value === input.effort);

  if (!urgencyOpt || !impactOpt || !effortOpt) return '';

  const priority = calculatePriority(input.urgency, input.impact);
  const quadrant = quadrantConfig[calculateQuadrant(priority, input.effort)];

  return [
    `Urgensi ${urgencyOpt.label} — ${urgencyOpt.description}`,
    `Impact ${impactOpt.label} — ${impactOpt.description}`,
    `Effort ${effortOpt.value} (${effortOpt.name}) — ${effortOpt.description}`,
    `Hasil: prioritas ${priorityConfig[priority].label}, kuadran ${quadrant.label} (${quadrant.condition}) — ${quadrant.recommendation}`,
  ].join('\n');
}
