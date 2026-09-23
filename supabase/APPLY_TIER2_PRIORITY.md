# Penerapan Kalkulator Prioritas Tier 2

Frontend mengharapkan skema dan RPC pada batch 6-8 sudah aktif. Terapkan melalui Supabase SQL Editor pada project yang tertaut di `config.toml`.

## Urutan wajib

1. Buka `_batch6_priority_gate.sql`, jalankan hanya **BAGIAN 1 - NILAI ENUM BARU**, lalu pastikan transaksi selesai/commit.
2. Jalankan sisa `_batch6_priority_gate.sql` mulai **BAGIAN 2** sampai akhir.
3. Jalankan seluruh `_batch7_effort_quadrant.sql`.
4. Jalankan seluruh `_batch8_tier2_priority_assessment.sql`.

Bagian enum batch 6 harus terpisah karena PostgreSQL tidak mengizinkan nilai enum baru dipakai dalam transaksi yang sama dengan `ALTER TYPE ... ADD VALUE`.

## Smoke test setelah migrasi

- Buat usulan dari form user dan form Super Admin; keduanya harus berstatus `pending`.
- Evaluasi K1-K7, Effort, dan seluruh gate sampai snapshot Tier 2 tersimpan.
- Pastikan evidence wajib untuk skor 4-5 dan Effort 4-5.
- Uji rekomendasi GO, Conditional GO, Defer, dan No-Go.
- Uji keputusan formal yang berbeda dari rekomendasi; alasan override harus wajib.
- Uji keputusan deferred; konteks dan jadwal usulan harus wajib.
- Sebagai pengaju, terima jadwal deferred lalu pastikan status operasional menjadi `approved` dan snapshot keputusan awal tetap tampil sebagai riwayat.
- Sebagai pengaju, coba UPDATE langsung `projects.status` lewat REST/API; perubahan harus ditolak.
- Pastikan proyek yang memiliki `current_priority_assessment_id` tidak pernah ditampilkan sebagai "prioritas lama" ketika relasi snapshot gagal dimuat.

## Catatan tata kelola

Ambang GO/Conditional/Defer/No-Go, veto eligibility gate, dan ambang kuadran merupakan aturan metode `HTO-T2-1.0`. Karena draft pedoman sumber belum menetapkan angka tersebut secara eksplisit, aturan ini perlu diratifikasi dalam SK/pedoman final sebelum dipakai sebagai dasar penolakan formal.

Reassessment berkala belum tersedia. Snapshot pertama immutable dan RPC saat ini sengaja menolak penilaian kedua sampai alur revision/reassessment formal dibuat.
