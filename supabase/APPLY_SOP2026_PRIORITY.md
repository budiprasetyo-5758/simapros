# Penerapan Metode Prioritas SOP/HTO/001/2026 (HTO-SOP-2026.1)

Frontend mengharapkan skema dan RPC batch 9 sudah aktif. Terapkan melalui Supabase
SQL Editor pada project yang tertaut di `config.toml`.

## Urutan wajib

Batch 9 mengasumsikan batch 6-8 sudah terpasang (lihat `APPLY_TIER2_PRIORITY.md`).
Pada database yang belum pernah menjalankannya, kerjakan dulu urutan itu sampai
selesai, baru lanjut ke sini.

1. Jalankan seluruh `_batch9_sop2026_priority.sql` dalam satu eksekusi.

Tidak ada `ALTER TYPE ... ADD VALUE` di batch ini, sehingga seluruh script boleh
berada dalam satu transaksi.

## Yang berubah pada data lama

- Snapshot `HTO-T2-1.0` **tidak dihitung ulang**. `impact_score`,
  `calculated_recommendation`, dan `final_decision`-nya tidak disentuh.
- Satu-satunya kolom turunan yang di-backfill adalah `score_percent`
  (`impact_score / 5 * 100`), supaya baris lama tetap bisa diurutkan bersama
  baris baru tanpa membandingkan skala 1-5 dengan skala 1-10 seolah setara.
- `record_tier2_priority_assessment` dicabut hak EXECUTE-nya. Fungsinya tetap ada
  sebagai rujukan, tapi tidak bisa lagi dipanggil dari klien.

## Perbedaan aturan dibanding metode lama

| | HTO-T2-1.0 | HTO-SOP-2026.1 |
|---|---|---|
| Kriteria | K1-K7, skala 1-5 | K1-K5, skala 1-10 |
| Bobot | 20/20/15/15/10/10/10 | 20/20/25/20/15 |
| Bukti wajib mulai skor | 4 | 7 |
| Gerbang keras | 8 eligibility gate (veto) | Tahap 1 mandatory + gate finansial K3 |
| 8 gate | Gagal = NO-GO | Checklist non-veto; belum lengkap = `needs_probing` |
| Keluaran kalkulator | go / conditional_go / defer / no_go | mandatory / queued / gated |
| Urutan antrean | Priority Index (skor / effort) | `score_percent` (Total Skor) |
| Penilaian ulang | Ditolak | Diizinkan (revisi baru) |

Metode baru **tidak menciptakan ambang** GO/Defer/No-Go. SOP tidak menetapkannya,
dan `APPLY_TIER2_PRIORITY.md` sendiri mencatat bahwa ambang metode lama belum
diratifikasi dalam SK. Penolakan formal selalu merupakan keputusan manusia dengan
`override_reason` wajib — sejalan dengan SOP 5.3 yang melarang HTO menolak
langsung usulan yang belum jelas.

## Smoke test setelah migrasi

- **Mandatory:** jawab YES pada salah satu pertanyaan Tahap 1 beserta dasarnya →
  tersimpan `is_mandatory = true`, `impact_score`/`priority_index`/`score_percent`
  NULL, rekomendasi `mandatory`, `projects.priority = 'urgent'`.
- **Mandatory tanpa dasar:** jawab YES tanpa mengisi `basis` → harus ditolak.
- **Mandatory dengan skor:** kirim `scores` tidak kosong bersama jawaban YES →
  harus ditolak (snapshot tidak boleh menyimpan angka yang tidak dipakai).
- **Ter-gate:** semua Tahap 1 NO, K3 = 3 → `financial_gate_status = 'gated'`,
  rekomendasi `gated`, `projects.status` kembali `pending`, `is_priority = false`.
- **Lolos gate:** K3 = 4 → `financial_gate_status = 'approved'`, rekomendasi
  `queued`, `projects.status = 'approved'`.
- **Diskresi Direksi:** dari kondisi ter-gate kirim `_final_decision = 'approved'`
  tanpa `_override_reason` → harus ditolak; dengan alasan → tersimpan.
- **Bukti:** skor 7 tanpa evidence → ditolak; skor 6 tanpa evidence → diterima.
- **Skala:** kirim skor 0 atau 11 → ditolak.
- **Checklist non-veto:** kosongkan beberapa gate → `eligibility_status` menjadi
  `needs_probing` dan `eligibility_notes` wajib, tetapi
  `calculated_recommendation` **tidak** berubah menjadi penolakan.
- **Penilaian ulang:** nilai ulang proyek yang sudah punya
  `current_priority_assessment_id` → `revision_no` bertambah, snapshot lama tetap
  ada, pointer proyek pindah ke revisi terbaru.
- **Proyek berjalan:** nilai ulang proyek berstatus `active` dengan hasil
  ter-gate → `projects.status` tetap `active` (gate tercatat di snapshot, proyek
  tidak ditarik keluar dari eksekusi).
- **Status terkunci:** coba nilai proyek berstatus `withdrawn` atau `rejected` →
  harus ditolak.
- **Immutability:** coba UPDATE atau DELETE baris
  `project_priority_assessments` → tetap ditolak trigger batch 8.
- **RPC lama:** panggil `record_tier2_priority_assessment` lewat REST sebagai
  super_admin → harus ditolak karena hak EXECUTE sudah dicabut.
- **Status langsung:** coba UPDATE `projects.status` lewat REST → tetap ditolak.

## Catatan tata kelola

Effort, kuadran Quick Win/Big Bet, dan `score_percent` **tidak diatur SOP**.
Ketiganya dipertahankan sebagai alat bantu perencanaan kapasitas internal HTO
dan tidak boleh dijadikan dasar formal penolakan sampai diatur dalam revisi SOP
berikutnya. Urutan resmi Master Queue adalah Total Skor Akhir; Effort hanya
memengaruhi label kuadran dan usulan jadwal.

Ritme mingguan SOP Bab 9 (probing Senin-Rabu, rapat skoring Kamis, publikasi
Master Queue Jumat) dijalankan manual oleh HTO di luar SIMAPROS. Sistem tidak
memiliki objek siklus, penguncian, maupun publikasi terjadwal — konsekuensinya
SIMAPROS menyimpan riwayat per proyek (rantai `revision_no`), bukan foto antrean
pada suatu Jumat tertentu.
