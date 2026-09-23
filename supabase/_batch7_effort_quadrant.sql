-- ============================================================
-- Effort / Kompleksitas, Kuadran Impact-Effort, dan Dasar Penilaian BARS
--
-- Menyelaraskan penilaian prioritas dengan Pedoman Tata Kelola Penentuan
-- Prioritas Proyek IT (HTO):
--   Bab 4.1 -> panduan skor berjenjang (BARS) + skala Effort 1-5
--   Bab 6.2 -> kuadran Quick Win / Big Bet / Fill-in / Thankless Task
--   Bab 5 tahap 7 -> seluruh unit pengaju diberi tahu alasan penilaian
--
-- Jalankan script ini di Supabase SQL Editor.
--
-- Tidak ada nilai enum baru di sini, sehingga seluruh script boleh dijalankan
-- dalam satu kali eksekusi (berbeda dari _batch6_priority_gate.sql).
-- ============================================================


-- ============================================================
-- BAGIAN 1 - KOLOM BARU PADA projects
-- ============================================================

ALTER TABLE public.projects
  -- Effort/kompleksitas 1-5. ARAH SKALA BERKEBALIKAN dari kriteria dampak:
  -- skor tinggi = SULIT dikerjakan. Pedoman Bab 2 memperingatkan bahwa RSB
  -- memakai 'Skor Kemudahan Implementasi' (tinggi = mudah), jadi skor RSB
  -- TIDAK boleh disalin langsung ke kolom ini.
  ADD COLUMN IF NOT EXISTS effort             smallint,
  -- Kuadran hasil silang dampak x effort. Dibekukan bersama keputusan supaya
  -- perubahan ambang batas di masa depan tidak mengubah label proyek lama.
  ADD COLUMN IF NOT EXISTS priority_quadrant  text,
  -- Urgensi menurut pengaju saat intake. Hanya usulan; nilai resmi ada di
  -- kolom `urgency` dan hanya boleh ditetapkan HTO saat evaluasi. Dipisah
  -- supaya klaim pengaju tidak lagi otomatis menjadi separuh penentu hasil.
  ADD COLUMN IF NOT EXISTS urgency_claimed    text,
  -- Dasar penilaian, dirangkai otomatis dari kalimat jangkar BARS yang dipilih
  -- penilai.
  ADD COLUMN IF NOT EXISTS priority_rationale text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'projects_effort_check'
  ) THEN
    ALTER TABLE public.projects
      ADD CONSTRAINT projects_effort_check
      CHECK (effort IS NULL OR effort BETWEEN 1 AND 5);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'projects_priority_quadrant_check'
  ) THEN
    ALTER TABLE public.projects
      ADD CONSTRAINT projects_priority_quadrant_check
      CHECK (priority_quadrant IS NULL
             OR priority_quadrant IN ('quick_win', 'big_bet', 'fill_in', 'thankless'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'projects_urgency_claimed_check'
  ) THEN
    ALTER TABLE public.projects
      ADD CONSTRAINT projects_urgency_claimed_check
      CHECK (urgency_claimed IS NULL
             OR urgency_claimed IN ('very_low', 'low', 'medium', 'high'));
  END IF;
END $$;

COMMENT ON COLUMN public.projects.effort IS
  'Effort/kompleksitas 1-5. ARAH BERKEBALIKAN: 5 = paling sulit. Jangan disalin dari Skor Kemudahan Implementasi RSB';
COMMENT ON COLUMN public.projects.priority_quadrant IS
  'quick_win/big_bet/fill_in/thankless - dibekukan saat keputusan dibuat';
COMMENT ON COLUMN public.projects.urgency_claimed IS
  'Urgensi menurut pengaju saat intake. USULAN saja - nilai resmi ada di kolom urgency (ditetapkan HTO)';
COMMENT ON COLUMN public.projects.priority_rationale IS
  'TEKS YANG DIBEKUKAN, bukan turunan yang boleh dihitung ulang saat render. '
  'Dirangkai dari kalimat jangkar BARS terpilih pada saat keputusan dibuat. '
  'Pedoman Bab 9 mengizinkan revisi kalimat jangkar tiap 12 bulan - kalau nilai ini '
  'dihitung ulang saat dibaca, revisi tersebut akan mengubah alasan tertulis '
  'keputusan lama secara senyap. Jangan ganti dengan computed value.';


-- ============================================================
-- BAGIAN 2 - BACKFILL DATA LAMA
-- ============================================================

-- Urgensi pada baris lama seluruhnya berasal dari deklarasi pengaju di form
-- intake, jadi disalin ke kolom klaim. Kolom `urgency` dibiarkan apa adanya
-- supaya keputusan yang sudah diambil tidak berubah.
UPDATE public.projects
SET urgency_claimed = urgency
WHERE urgency_claimed IS NULL
  AND urgency IS NOT NULL;

-- Higienis data: 'medium' bukan nilai Impact yang sah (nilai yang sah adalah
-- minimal/minor/significant/severe). Nilai ini warisan DEFAULT 'medium' pada
-- migrasi awal, jadi tidak pernah mencerminkan penilaian sesungguhnya.
--
-- Aman dikosongkan karena _batch6_priority_gate.sql sudah membekukan
-- is_priority = true untuk proyek approved/active - sejarah keputusan ada di
-- kolom beku itu, bukan di sumbu mentahnya. UI menampilkan 'Belum dinilai'
-- untuk NULL.
UPDATE public.projects
SET impact = NULL
WHERE impact NOT IN ('minimal', 'minor', 'significant', 'severe');

-- priority_rationale SENGAJA dibiarkan NULL untuk proyek lama. Mengarang dasar
-- penilaian retroaktif justru merusak nilai jejak auditnya; UI menampilkan
-- 'Dinilai sebelum panduan BARS berlaku'.


-- ============================================================
-- CATATAN RLS - tidak ada policy baru yang diperlukan
-- ============================================================
--
-- Penulisan kolom-kolom di atas dilakukan HTO lewat policy
-- "Super admins can update all projects" (combined_migration.sql:796)
-- yang sudah mencakup seluruh kolom pada tabel projects.
--
-- urgency_claimed ditulis pengaju pada saat INSERT, tercakup policy insert
-- proyek yang sudah ada. Pengaju tidak pernah menulis `urgency`, `effort`,
-- `priority_quadrant`, maupun `priority_rationale`.
