-- ============================================================
-- Gerbang Prioritas Proyek (Priority Gate)
--
-- Menjadikan hasil matriks Urgensi x Impact sebagai penentu alur:
--   Critical / High -> langsung ke Eksekutor (status 'approved')
--   Medium / Low    -> dikembalikan ke pengaju (status 'deprioritized')
--                      pengaju memilih: terima jadwal baru, atau tarik pengajuan
--
-- Jalankan script ini di Supabase SQL Editor.
--
-- PENTING: BAGIAN 1 harus dijalankan dan di-COMMIT LEBIH DULU,
-- terpisah dari bagian lainnya. PostgreSQL tidak mengizinkan nilai
-- enum baru dipakai dalam transaksi yang sama dengan ALTER TYPE.
-- Jalankan BAGIAN 1, tunggu sampai sukses, baru blok/jalankan sisanya.
-- ============================================================


-- ============================================================
-- BAGIAN 1 - NILAI ENUM BARU  (jalankan sendiri, lalu commit)
-- ============================================================

-- 'deprioritized' : dinilai prioritas rendah, menunggu keputusan pengaju
-- 'withdrawn'     : pengaju menarik pengajuannya sendiri (beda dari 'rejected',
--                   yang berarti HTO menolak). Dipisah agar statistik bersih.
ALTER TYPE public.project_status ADD VALUE IF NOT EXISTS 'deprioritized';
ALTER TYPE public.project_status ADD VALUE IF NOT EXISTS 'withdrawn';
