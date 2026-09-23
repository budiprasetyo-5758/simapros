
-- ============================================================
-- BAGIAN 2 - KOLOM BARU PADA projects
-- ============================================================

ALTER TABLE public.projects
  -- Dibekukan saat keputusan dibuat, bukan dihitung ulang saat dibaca,
  -- supaya perubahan ambang batas di masa depan tidak mengubah proyek lama.
  ADD COLUMN IF NOT EXISTS is_priority           boolean,
  -- Justifikasi HTO atas penilaian prioritas. Wajib diisi saat deprioritisasi.
  ADD COLUMN IF NOT EXISTS priority_note         text,
  ADD COLUMN IF NOT EXISTS priority_set_by       uuid,
  ADD COLUMN IF NOT EXISTS priority_set_at       timestamptz,
  -- Tanggal target yang diusulkan HTO. Disimpan terpisah dari start_date/end_date
  -- supaya pengaju bisa membandingkan tanggal yang ia minta dengan usulan HTO.
  -- Disalin ke start_date/end_date saat pengaju menerima.
  ADD COLUMN IF NOT EXISTS proposed_start_date   date,
  ADD COLUMN IF NOT EXISTS proposed_end_date     date,
  ADD COLUMN IF NOT EXISTS requester_decision    text,
  ADD COLUMN IF NOT EXISTS requester_decision_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'projects_requester_decision_check'
  ) THEN
    ALTER TABLE public.projects
      ADD CONSTRAINT projects_requester_decision_check
      CHECK (requester_decision IN ('accepted', 'withdrawn'));
  END IF;
END $$;

COMMENT ON COLUMN public.projects.is_priority IS
  'true = lolos jalur cepat (Critical/High), false = masuk antrean non-prioritas, NULL = belum dinilai';
COMMENT ON COLUMN public.projects.priority_note IS
  'Justifikasi HTO atas penilaian prioritas, ditampilkan ke pengaju';
COMMENT ON COLUMN public.projects.proposed_start_date IS
  'Tanggal mulai yang diusulkan HTO untuk proyek non-prioritas';
COMMENT ON COLUMN public.projects.proposed_end_date IS
  'Tanggal selesai yang diusulkan HTO untuk proyek non-prioritas';

-- Proyek lama yang sudah disetujui dianggap prioritas, supaya urutan
-- dashboard Eksekutor tidak berubah drastis setelah fitur ini aktif.
UPDATE public.projects
SET is_priority = true
WHERE is_priority IS NULL
  AND status IN ('approved', 'active', 'pending_creation');


-- ============================================================
-- BAGIAN 3 - RPC KEPUTUSAN PENGAJU
--
-- Pengaju TIDAK diberi policy UPDATE luas pada projects: RLS Postgres
-- tidak bisa membatasi per kolom, jadi pengaju bisa saja menulis
-- status = 'approved' sendiri dan melewati HTO. Fungsi SECURITY DEFINER
-- ini hanya mengizinkan transisi 'deprioritized' -> approved/withdrawn
-- untuk pemilik proyek, dan bersifat atomik.
-- ============================================================

CREATE OR REPLACE FUNCTION public.respond_to_priority(
  _project_id uuid,
  _decision   text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _decision NOT IN ('accepted', 'withdrawn') THEN
    RAISE EXCEPTION 'Keputusan tidak valid: %', _decision;
  END IF;

  -- Membuka guard status hanya untuk transisi atomik yang tervalidasi di RPC ini.
  PERFORM set_config('app.project_status_write', 'on', true);
  PERFORM set_config('app.tier2_assessment_write', 'on', true);

  UPDATE public.projects SET
    requester_decision    = _decision,
    requester_decision_at = now(),
    status = CASE
               WHEN _decision = 'accepted' THEN 'approved'::project_status
               ELSE 'withdrawn'::project_status
             END,
    -- Tanggal usulan HTO menjadi jadwal resmi saat pengaju menerima.
    start_date = CASE
                   WHEN _decision = 'accepted'
                     THEN COALESCE(proposed_start_date, start_date)
                   ELSE start_date
                 END,
    end_date   = CASE
                   WHEN _decision = 'accepted'
                     THEN COALESCE(proposed_end_date, end_date)
                   ELSE end_date
                 END
  WHERE id = _project_id
    AND requester_id = auth.uid()            -- hanya pengaju proyek itu sendiri
    AND status = 'deprioritized';            -- hanya dari state menunggu keputusan

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tidak diizinkan, atau proyek tidak sedang menunggu keputusan Anda';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.respond_to_priority(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.respond_to_priority(uuid, text) TO authenticated;


-- ============================================================
-- CATATAN RLS - tidak ada policy baru yang diperlukan
-- ============================================================
--
-- SELECT pengaju  : "Users can view their own projects" (combined_migration.sql:104)
--                   memakai auth.uid() = requester_id tanpa syarat status,
--                   jadi proyek 'deprioritized' sudah otomatis terlihat.
-- UPDATE HTO      : "Super admins can update all projects"
--                   (combined_migration.sql:796) sudah mencakup deprioritisasi.
-- UPDATE Eksekutor: policy di _batch5.sql:282 dibatasi ke status
--                   approved/active, sehingga proyek yang masih menunggu
--                   keputusan pengaju tidak bisa disentuh Eksekutor. Ini
--                   memang perilaku yang diinginkan - jangan dilonggarkan.
