-- ============================================================
-- SOP/HTO/001/2026 rev 02 — Metode Prioritas HTO-SOP-2026.1
--
-- Menerapkan SOP Filtrasi, Panduan Probing, dan Penilaian Prioritas Proyek
-- Transformasi & IT sebagai VERSI METODE BARU di samping HTO-T2-1.0.
--
-- Perbedaan pokok dari metode lama:
--   Tahap 1  -> tiga pertanyaan mandatory; satu YES = Priority 0, skoring dilewati
--   Tahap 2  -> 5 kriteria K1-K5 skala 1-10, bobot 20/20/25/20/15
--   Gate     -> hanya gate finansial K3 <= 3 (GATED); 8 gate lama jadi checklist
--   Urutan   -> Total Skor Akhir, BUKAN Priority Index
--   Ulang    -> penilaian ulang diizinkan (metode lama menolaknya)
--
-- Dependensi:
--   1. combined_migration.sql / _batch3.sql .. _batch5.sql
--   2. _batch6_priority_gate.sql
--   3. _batch7_effort_quadrant.sql
--   4. _batch8_tier2_priority_assessment.sql
--
-- Seluruh script boleh dijalankan sebagai satu transaksi di Supabase SQL Editor.
-- Tidak ada ALTER TYPE enum di sini.
--
-- CATATAN PENTING - snapshot lama tidak pernah dihitung ulang. Baris
-- HTO-T2-1.0 tetap memakai skala 1-5 beserta ambang GO/Conditional/Defer/No-Go
-- yang berlaku saat keputusannya dibuat. Metode baru TIDAK menciptakan ambang
-- apa pun: SOP hanya mengenal mandatory / gated / queued, dan penolakan formal
-- selalu merupakan keputusan manusia (SOP 5.3 melarang HTO menolak langsung).
-- ============================================================


-- ============================================================
-- BAGIAN 1 - KOLOM BARU PADA project_priority_assessments
-- ============================================================

ALTER TABLE public.project_priority_assessments
  -- Hasil Tahap 1. Proyek mandatory melewati skoring, sehingga impact_score,
  -- priority_index, dan priority_quadrant-nya sengaja NULL.
  ADD COLUMN IF NOT EXISTS is_mandatory        boolean NOT NULL DEFAULT false,
  -- { regulasi | akreditasi_bpjs | risiko_kritis : { answer: bool, basis: text } }
  -- basis WAJIB terisi untuk setiap jawaban YES. Tanpa itu Tahap 1 menjadi pintu
  -- belakang: cukup centang satu YES dan proyek apa pun naik ke puncak antrean.
  ADD COLUMN IF NOT EXISTS mandatory_answers   jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- 'approved' (K3 > 3, lolos ke Master Queue) atau 'gated' (K3 <= 3).
  ADD COLUMN IF NOT EXISTS financial_gate_status text,
  -- Sesi probing SOP 5.3: { date, participants, notes }.
  ADD COLUMN IF NOT EXISTS probing_session     jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- impact_score dinormalisasi ke persen terhadap skala maksimum metodenya.
  -- Ada supaya antrean campuran (baris 1-5 lama + baris 1-10 baru) bisa
  -- diurutkan tanpa membandingkan dua skala berbeda seolah setara - kesalahan
  -- yang tidak akan memunculkan gejala apa pun di UI.
  ADD COLUMN IF NOT EXISTS score_percent       numeric(5,2);

COMMENT ON COLUMN public.project_priority_assessments.is_mandatory IS
  'Tahap 1 SOP: true bila salah satu dari tiga pertanyaan mandatory dijawab YES. Proyek Priority 0 / Fast Track.';
COMMENT ON COLUMN public.project_priority_assessments.mandatory_answers IS
  'Jawaban Tahap 1 beserta dasar tertulisnya. Setiap YES wajib menyertakan basis (nomor regulasi, temuan akreditasi, atau laporan insiden).';
COMMENT ON COLUMN public.project_priority_assessments.financial_gate_status IS
  'Gate finansial SOP 5.2 pada K3: approved (K3 > 3) atau gated (K3 <= 3). NULL untuk proyek mandatory.';
COMMENT ON COLUMN public.project_priority_assessments.probing_session IS
  'Rekaman Probing Session SOP 5.3: tanggal, peserta, dan catatan hasil probing analis HTO.';
COMMENT ON COLUMN public.project_priority_assessments.score_percent IS
  'impact_score / skala maksimum metode * 100. SATU-SATUNYA kolom yang boleh dipakai mengurutkan antrean lintas versi metode.';
COMMENT ON COLUMN public.project_priority_assessments.impact_score IS
  'Skor dampak tertimbang. Skalanya bergantung method_version: 1-5 pada HTO-T2-1.0, 1-10 (Total Skor Akhir SOP) pada HTO-SOP-2026.1, NULL pada proyek mandatory. Jangan bandingkan lintas versi - pakai score_percent.';


-- ============================================================
-- BAGIAN 2 - CONSTRAINT YANG DILONGGARKAN PER VERSI METODE
--
-- Constraint lama mengunci skor pada rentang 1-5 dan akan menolak SELURUH baris
-- metode baru. Diganti menjadi version-aware, bukan sekadar dilebarkan, supaya
-- jaminan untuk baris HTO-T2-1.0 tidak ikut hilang.
--
-- Cabang ELSE false disengaja: versi metode yang tidak dikenal ditolak di level
-- database, bukan hanya di RPC. Menambah versi berikutnya = menambah satu WHEN.
-- ============================================================

ALTER TABLE public.project_priority_assessments
  ALTER COLUMN impact_score      DROP NOT NULL,
  ALTER COLUMN priority_index    DROP NOT NULL,
  ALTER COLUMN priority_quadrant DROP NOT NULL,
  ALTER COLUMN effort            DROP NOT NULL;

ALTER TABLE public.project_priority_assessments
  DROP CONSTRAINT IF EXISTS project_priority_assessments_impact_score_check,
  DROP CONSTRAINT IF EXISTS project_priority_assessments_priority_index_check,
  DROP CONSTRAINT IF EXISTS project_priority_assessments_quadrant_check,
  DROP CONSTRAINT IF EXISTS project_priority_assessments_effort_check,
  DROP CONSTRAINT IF EXISTS project_priority_assessments_eligibility_check,
  DROP CONSTRAINT IF EXISTS project_priority_assessments_recommendation_check,
  DROP CONSTRAINT IF EXISTS project_priority_assessments_final_decision_check,
  DROP CONSTRAINT IF EXISTS project_priority_assessments_override_check;

ALTER TABLE public.project_priority_assessments
  ADD CONSTRAINT project_priority_assessments_impact_score_check CHECK (
    CASE method_version
      WHEN 'HTO-T2-1.0' THEN
        impact_score IS NOT NULL AND impact_score BETWEEN 1 AND 5
      WHEN 'HTO-SOP-2026.1' THEN
        (is_mandatory AND impact_score IS NULL)
        OR (NOT is_mandatory AND impact_score IS NOT NULL AND impact_score BETWEEN 1 AND 10)
      ELSE false
    END
  ),
  ADD CONSTRAINT project_priority_assessments_priority_index_check CHECK (
    CASE method_version
      WHEN 'HTO-T2-1.0' THEN
        priority_index IS NOT NULL AND priority_index BETWEEN 0.2 AND 5
      WHEN 'HTO-SOP-2026.1' THEN
        (is_mandatory AND priority_index IS NULL)
        OR (NOT is_mandatory AND priority_index IS NOT NULL AND priority_index BETWEEN 0.2 AND 10)
      ELSE false
    END
  ),
  ADD CONSTRAINT project_priority_assessments_quadrant_check CHECK (
    priority_quadrant IS NULL
    OR priority_quadrant IN ('quick_win', 'big_bet', 'fill_in', 'thankless')
  ),
  ADD CONSTRAINT project_priority_assessments_effort_check CHECK (
    effort IS NULL OR effort BETWEEN 1 AND 5
  ),
  -- 'needs_probing' menggantikan peran 'ineligible' pada metode baru: checklist
  -- yang belum lengkap menandai kebutuhan klarifikasi, TIDAK menggugurkan usulan.
  ADD CONSTRAINT project_priority_assessments_eligibility_check CHECK (
    eligibility_status IN ('eligible', 'ineligible', 'needs_probing')
  ),
  ADD CONSTRAINT project_priority_assessments_recommendation_check CHECK (
    calculated_recommendation IN (
      'go', 'conditional_go', 'defer', 'no_go',   -- HTO-T2-1.0
      'mandatory', 'queued', 'gated'              -- HTO-SOP-2026.1
    )
  ),
  ADD CONSTRAINT project_priority_assessments_final_decision_check CHECK (
    final_decision IN ('approved', 'conditional', 'deferred', 'rejected', 'gated')
  ),
  ADD CONSTRAINT project_priority_assessments_override_check CHECK (
    (final_decision = CASE calculated_recommendation
        WHEN 'go'             THEN 'approved'
        WHEN 'conditional_go' THEN 'conditional'
        WHEN 'defer'          THEN 'deferred'
        WHEN 'no_go'          THEN 'rejected'
        WHEN 'mandatory'      THEN 'approved'
        WHEN 'queued'         THEN 'approved'
        WHEN 'gated'          THEN 'gated'
      END)
    OR NULLIF(btrim(override_reason), '') IS NOT NULL
  );

-- Bentuk baris per jalur SOP. Dipisah dari constraint rentang di atas supaya
-- pesan error menyebut persis aturan mana yang dilanggar.
ALTER TABLE public.project_priority_assessments
  DROP CONSTRAINT IF EXISTS project_priority_assessments_mandatory_shape_check,
  DROP CONSTRAINT IF EXISTS project_priority_assessments_scored_shape_check,
  DROP CONSTRAINT IF EXISTS project_priority_assessments_financial_gate_check,
  DROP CONSTRAINT IF EXISTS project_priority_assessments_score_percent_check,
  DROP CONSTRAINT IF EXISTS project_priority_assessments_mandatory_answers_object_check,
  DROP CONSTRAINT IF EXISTS project_priority_assessments_probing_session_object_check;

ALTER TABLE public.project_priority_assessments
  -- Proyek mandatory: tidak diskor, hanya ada pada metode SOP.
  ADD CONSTRAINT project_priority_assessments_mandatory_shape_check CHECK (
    NOT is_mandatory
    OR (
      method_version = 'HTO-SOP-2026.1'
      AND impact_score IS NULL
      AND priority_index IS NULL
      AND priority_quadrant IS NULL
      AND score_percent IS NULL
      AND financial_gate_status IS NULL
      AND calculated_recommendation = 'mandatory'
    )
  ),
  -- Proyek yang diskor wajib punya effort (dipakai kuadran & usulan jadwal)
  -- dan score_percent (dipakai mengurutkan antrean).
  ADD CONSTRAINT project_priority_assessments_scored_shape_check CHECK (
    is_mandatory
    OR (effort IS NOT NULL AND score_percent IS NOT NULL AND priority_quadrant IS NOT NULL)
  ),
  ADD CONSTRAINT project_priority_assessments_financial_gate_check CHECK (
    financial_gate_status IS NULL
    OR financial_gate_status IN ('approved', 'gated')
  ),
  ADD CONSTRAINT project_priority_assessments_score_percent_check CHECK (
    score_percent IS NULL OR score_percent BETWEEN 0 AND 100
  ),
  ADD CONSTRAINT project_priority_assessments_mandatory_answers_object_check CHECK (
    jsonb_typeof(mandatory_answers) = 'object'
  ),
  ADD CONSTRAINT project_priority_assessments_probing_session_object_check CHECK (
    jsonb_typeof(probing_session) = 'object'
  );


-- ============================================================
-- BAGIAN 3 - BACKFILL score_percent UNTUK SNAPSHOT LAMA
--
-- Hanya menghitung ulang KOLOM TURUNAN yang baru; impact_score, rekomendasi,
-- dan keputusan baris lama tidak disentuh sama sekali.
-- ============================================================

UPDATE public.project_priority_assessments
SET score_percent = round(impact_score / 5 * 100, 2)
WHERE method_version = 'HTO-T2-1.0'
  AND score_percent IS NULL
  AND impact_score IS NOT NULL;

-- Urutan Master Queue: mandatory di puncak, lalu skor ternormalisasi tertinggi.
CREATE INDEX IF NOT EXISTS idx_priority_assessments_sop_ranking
  ON public.project_priority_assessments
  (is_mandatory DESC, score_percent DESC, decided_at DESC);


-- ============================================================
-- BAGIAN 4 - RPC PENILAIAN SOP 2026
--
-- Menyalin struktur record_tier2_priority_assessment (_batch8 BAGIAN 4):
-- SECURITY DEFINER, penguncian proyek FOR UPDATE untuk menserialkan revision_no,
-- penolakan key tak dikenal, pembukaan guard trigger hanya sepanjang transaksi,
-- dan sinkronisasi kolom legacy secara atomik.
-- ============================================================

CREATE OR REPLACE FUNCTION public.record_sop2026_priority_assessment(
  _project_id              uuid,
  _mandatory_answers       jsonb,
  _scores                  jsonb,
  _justifications          jsonb,
  _evidence                jsonb,
  _gates                   jsonb,
  _effort                  smallint DEFAULT NULL,
  _probing_session         jsonb DEFAULT '{}'::jsonb,
  _eligibility_notes       text DEFAULT NULL,
  _priority_note           text DEFAULT NULL,
  _proposed_start_date     date DEFAULT NULL,
  _proposed_end_date       date DEFAULT NULL,
  _final_decision          text DEFAULT NULL,
  _final_decision_note     text DEFAULT NULL,
  _override_reason         text DEFAULT NULL,
  _intake_snapshot         jsonb DEFAULT '{}'::jsonb,
  _governance_snapshot     jsonb DEFAULT '{}'::jsonb,
  _method_version          text DEFAULT 'HTO-SOP-2026.1',
  _edited_project          jsonb DEFAULT '{}'::jsonb,
  _technical_notes         text DEFAULT NULL
)
RETURNS public.project_priority_assessments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _actor                    uuid := auth.uid();
  _project                  public.projects%ROWTYPE;
  _criterion                text;
  _question                 text;
  _gate_key                 text;
  _score                    integer;
  _is_mandatory             boolean := false;
  _impact_score             numeric(6,4);
  _score_percent            numeric(5,2);
  _priority_index           numeric(8,4);
  _financial_gate           text;
  _eligibility_status       text;
  _recommendation           text;
  _default_final_decision   text;
  _decision                 text;
  _quadrant                 text;
  _revision_no              integer;
  _legacy_priority          public.project_priority;
  _legacy_status            public.project_status;
  _assessment               public.project_priority_assessments;
  _method_snapshot          jsonb;
  _effective_intake_snapshot jsonb;
  _edited_title             text;
  _edited_description       text;
  _edited_unit              text;
  _edited_start_date        date;
  _edited_end_date          date;
  _edited_pic               text;
  _recommendation_reasons   jsonb := '[]'::jsonb;
  _required_criteria        constant text[] := ARRAY['k1','k2','k3','k4','k5'];
  _required_justifications  constant text[] := ARRAY['k1','k2','k3','k4','k5','effort'];
  _allowed_evidence_keys    constant text[] := ARRAY['k1','k2','k3','k4','k5','effort','proposal_attachment_url'];
  _mandatory_keys           constant text[] := ARRAY['regulasi','akreditasi_bpjs','risiko_kritis'];
  _allowed_probing_keys     constant text[] := ARRAY['date','participants','notes'];
  -- Delapan gate metode lama dipertahankan sebagai CHECKLIST kelengkapan.
  -- SOP 5.3 melarang HTO menolak langsung usulan yang belum jelas, jadi gate
  -- yang belum lengkap hanya menandai kebutuhan probing - tidak mem-veto.
  _required_gate_keys       constant text[] := ARRAY[
    'proposal_complete',
    'regulatory_review',
    'patient_safety_review',
    'cybersecurity_review',
    'privacy_data_review',
    'architecture_review',
    'duplication_review',
    'sponsor_funding_confirmed'
  ];
  -- Status yang boleh dinilai ulang. Metode lama menolak penilaian kedua sama
  -- sekali; SOP 9 menjadikan penilaian ulang sebagai kegiatan rutin.
  -- 'withdrawn' dan 'rejected' tetap ditolak: keduanya harus dibuka kembali
  -- lewat alur tersendiri sebelum layak masuk antrean.
  _reassessable_statuses    constant public.project_status[] := ARRAY[
    'pending'::public.project_status,
    'approved'::public.project_status,
    'active'::public.project_status,
    'revision'::public.project_status,
    'deprioritized'::public.project_status
  ];
BEGIN
  IF _actor IS NULL THEN
    RAISE EXCEPTION 'Autentikasi diperlukan';
  END IF;

  IF NOT public.has_role(_actor, 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'Hanya HTO/Super Admin yang dapat merekam keputusan prioritas';
  END IF;

  IF NULLIF(btrim(_method_version), '') IS NULL THEN
    RAISE EXCEPTION 'method_version wajib diisi';
  END IF;
  IF _method_version <> 'HTO-SOP-2026.1' THEN
    RAISE EXCEPTION 'Versi metode tidak didukung oleh RPC ini: %', _method_version;
  END IF;

  SELECT * INTO _project
  FROM public.projects
  WHERE id = _project_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Proyek tidak ditemukan';
  END IF;
  IF NOT (_project.status = ANY (_reassessable_statuses)) THEN
    RAISE EXCEPTION 'Proyek berstatus % tidak dapat dinilai; buka kembali usulan terlebih dahulu', _project.status;
  END IF;

  IF jsonb_typeof(COALESCE(_mandatory_answers, '{}'::jsonb)) <> 'object'
     OR jsonb_typeof(_scores) <> 'object'
     OR jsonb_typeof(_justifications) <> 'object'
     OR jsonb_typeof(_evidence) <> 'object'
     OR jsonb_typeof(_gates) <> 'object'
     OR jsonb_typeof(COALESCE(_probing_session, '{}'::jsonb)) <> 'object'
     OR jsonb_typeof(COALESCE(_intake_snapshot, '{}'::jsonb)) <> 'object'
     OR jsonb_typeof(COALESCE(_governance_snapshot, '{}'::jsonb)) <> 'object'
     OR jsonb_typeof(COALESCE(_edited_project, '{}'::jsonb)) <> 'object' THEN
    RAISE EXCEPTION 'mandatory_answers, scores, justifications, evidence, gates, probing_session, snapshot, dan edited_project harus berupa JSON object';
  END IF;

  -- Tolak key tak dikenal agar salah eja tidak menghasilkan keputusan yang
  -- tampak valid tetapi sebenarnya mengabaikan suatu kriteria/pertanyaan.
  IF EXISTS (
    SELECT 1 FROM jsonb_object_keys(_mandatory_answers) key
    WHERE NOT (key = ANY (_mandatory_keys))
  ) THEN
    RAISE EXCEPTION 'mandatory_answers memiliki key yang tidak dikenal';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_object_keys(_justifications) key
    WHERE NOT (key = ANY (_required_justifications))
  ) THEN
    RAISE EXCEPTION 'justifications memiliki key yang tidak dikenal';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_object_keys(_evidence) key
    WHERE NOT (key = ANY (_allowed_evidence_keys))
  ) THEN
    RAISE EXCEPTION 'evidence memiliki key yang tidak dikenal';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_object_keys(_gates) key
    WHERE NOT (key = ANY (_required_gate_keys))
  ) THEN
    RAISE EXCEPTION 'gates memiliki key yang tidak dikenal';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_object_keys(COALESCE(_probing_session, '{}'::jsonb)) key
    WHERE NOT (key = ANY (_allowed_probing_keys))
  ) THEN
    RAISE EXCEPTION 'probing_session memiliki key yang tidak dikenal';
  END IF;

  -- ---- TAHAP 1: FILTRASI MANDATORY -------------------------------------
  FOREACH _question IN ARRAY _mandatory_keys LOOP
    IF NOT (_mandatory_answers ? _question)
       OR jsonb_typeof(_mandatory_answers -> _question) <> 'object'
       OR jsonb_typeof(_mandatory_answers -> _question -> 'answer') <> 'boolean' THEN
      RAISE EXCEPTION 'Jawaban Tahap 1 "%" wajib berupa { answer: boolean, basis: text }', _question;
    END IF;

    IF (_mandatory_answers -> _question ->> 'answer')::boolean THEN
      _is_mandatory := true;
      IF NULLIF(btrim(_mandatory_answers -> _question ->> 'basis'), '') IS NULL THEN
        RAISE EXCEPTION 'Jawaban YES pada "%" wajib menyertakan dasar tertulis (regulasi, temuan akreditasi, atau laporan insiden)', _question;
      END IF;
    END IF;
  END LOOP;

  IF _is_mandatory THEN
    -- Bypass Tahap 2. Skor apa pun yang terkirim ditolak agar snapshot tidak
    -- menyimpan angka yang tidak pernah dipakai menghitung apa-apa.
    IF _scores <> '{}'::jsonb THEN
      RAISE EXCEPTION 'Proyek mandatory tidak diskor; kirim scores kosong';
    END IF;
    _impact_score       := NULL;
    _score_percent      := NULL;
    _priority_index     := NULL;
    _quadrant           := NULL;
    _financial_gate     := NULL;
    _recommendation     := 'mandatory';
    _recommendation_reasons := jsonb_build_array(
      'Tahap 1: memenuhi kriteria mandatory (regulasi / akreditasi-BPJS / risiko kritis). Priority 0 - Fast Track.'
    );
  ELSE
    -- ---- TAHAP 2: PENILAIAN PEMBOBOTAN KRITERIA ------------------------
    IF EXISTS (
      SELECT 1 FROM jsonb_object_keys(_scores) key
      WHERE NOT (key = ANY (_required_criteria))
    ) THEN
      RAISE EXCEPTION 'scores memiliki key yang tidak dikenal';
    END IF;

    FOREACH _criterion IN ARRAY _required_criteria LOOP
      IF NOT (_scores ? _criterion)
         OR jsonb_typeof(_scores -> _criterion) <> 'number'
         OR (_scores ->> _criterion) !~ '^([1-9]|10)$' THEN
        RAISE EXCEPTION 'Skor % wajib berupa integer 1-10', upper(_criterion);
      END IF;

      _score := (_scores ->> _criterion)::integer;
      IF NULLIF(btrim(_justifications ->> _criterion), '') IS NULL THEN
        RAISE EXCEPTION 'Konteks penilaian % wajib diisi', upper(_criterion);
      END IF;
      -- Skor 7 ke atas = Green/Gold Zone pada rubrik SOP. Setara aturan lama
      -- "bukti wajib untuk 4-5 dari 5".
      IF _score >= 7 AND NULLIF(btrim(_evidence ->> _criterion), '') IS NULL THEN
        RAISE EXCEPTION 'Bukti % wajib diisi untuk skor 7-10', upper(_criterion);
      END IF;
    END LOOP;

    IF _effort IS NULL OR _effort NOT BETWEEN 1 AND 5 THEN
      RAISE EXCEPTION 'Effort wajib berupa integer 1-5';
    END IF;
    IF NULLIF(btrim(_justifications ->> 'effort'), '') IS NULL THEN
      RAISE EXCEPTION 'Dasar penilaian Effort wajib diisi';
    END IF;
    IF _effort >= 4 AND NULLIF(btrim(_evidence ->> 'effort'), '') IS NULL THEN
      RAISE EXCEPTION 'Bukti/dependensi Effort wajib diisi untuk skor 4-5';
    END IF;

    -- Bobot SOP Bab 6: 20, 20, 25, 20, 15 persen.
    _impact_score := round((
        (_scores ->> 'k1')::numeric * 0.20
      + (_scores ->> 'k2')::numeric * 0.20
      + (_scores ->> 'k3')::numeric * 0.25
      + (_scores ->> 'k4')::numeric * 0.20
      + (_scores ->> 'k5')::numeric * 0.15
    ), 4);
    _score_percent  := round(_impact_score / 10 * 100, 2);
    -- Priority Index tetap dihitung sebagai informasi kapasitas, TIDAK dipakai
    -- mengurutkan antrean. SOP mengurutkan murni dari Total Skor Akhir.
    _priority_index := round(_impact_score / _effort::numeric, 4);

    -- Ambang kuadran 7,0 dari 10 adalah padanan 3,5 dari 5 pada metode lama.
    -- Kuadran adalah alat bantu kapasitas internal, bukan dasar penolakan.
    _quadrant := CASE
      WHEN _impact_score >= 7.0 AND _effort <= 3 THEN 'quick_win'
      WHEN _impact_score >= 7.0 AND _effort >= 4 THEN 'big_bet'
      WHEN _impact_score <  7.0 AND _effort <= 3 THEN 'fill_in'
      ELSE 'thankless'
    END;

    -- ---- GATE FINANSIAL (SOP 5.2) --------------------------------------
    IF (_scores ->> 'k3')::integer <= 3 THEN
      _financial_gate := 'gated';
      _recommendation := 'gated';
      _recommendation_reasons := jsonb_build_array(
        'Gate finansial: skor K3 <= 3 (Red Zone). Proyek berstatus Under Review/Pending sampai ada justifikasi ulang atau diskresi Direksi.'
      );
    ELSE
      _financial_gate := 'approved';
      _recommendation := 'queued';
      _recommendation_reasons := jsonb_build_array(
        format('Gate finansial lolos (K3 = %s). Masuk Master Queue dengan Total Skor %s dari 10.',
               _scores ->> 'k3', trim(to_char(_impact_score, 'FM9D00')))
      );
    END IF;
  END IF;

  -- ---- CHECKLIST KELENGKAPAN (NON-VETO) --------------------------------
  FOREACH _gate_key IN ARRAY _required_gate_keys LOOP
    IF (_gates ? _gate_key) AND jsonb_typeof(_gates -> _gate_key) <> 'boolean' THEN
      RAISE EXCEPTION 'Gate % wajib berupa boolean bila diisi', _gate_key;
    END IF;
  END LOOP;

  IF EXISTS (
    SELECT 1 FROM unnest(_required_gate_keys) key
    WHERE NOT (_gates ? key) OR (_gates ->> key)::boolean = false
  ) THEN
    _eligibility_status := 'needs_probing';
    _recommendation_reasons := _recommendation_reasons || jsonb_build_array(
      'Checklist kelengkapan belum tuntas; butuh klarifikasi lanjutan. Sesuai SOP 5.3 hal ini TIDAK menggugurkan usulan.'
    );
    IF NULLIF(btrim(_eligibility_notes), '') IS NULL THEN
      RAISE EXCEPTION 'Catatan kelayakan wajib diisi bila ada butir checklist yang belum lengkap';
    END IF;
  ELSE
    _eligibility_status := 'eligible';
  END IF;

  -- ---- DATA PROYEK YANG DISUNTING --------------------------------------
  IF EXISTS (
    SELECT 1 FROM jsonb_object_keys(COALESCE(_edited_project, '{}'::jsonb)) key
    WHERE NOT (key = ANY (ARRAY['title','description','unit','start_date','end_date','pic']))
  ) THEN
    RAISE EXCEPTION 'edited_project memiliki key yang tidak dikenal';
  END IF;

  _edited_title       := NULLIF(btrim(_edited_project ->> 'title'), '');
  _edited_description := NULLIF(btrim(_edited_project ->> 'description'), '');
  _edited_unit        := NULLIF(btrim(_edited_project ->> 'unit'), '');
  _edited_pic         := NULLIF(btrim(_edited_project ->> 'pic'), '');
  BEGIN
    _edited_start_date := NULLIF(_edited_project ->> 'start_date', '')::date;
    _edited_end_date   := NULLIF(_edited_project ->> 'end_date', '')::date;
  EXCEPTION WHEN invalid_text_representation OR datetime_field_overflow THEN
    RAISE EXCEPTION 'start_date/end_date pada edited_project tidak valid';
  END;

  -- Penilaian ulang tidak wajib mengirim ulang tanggal yang sudah ada.
  _edited_start_date := COALESCE(_edited_start_date, _project.start_date);
  _edited_end_date   := COALESCE(_edited_end_date, _project.end_date);

  IF _edited_start_date IS NULL OR _edited_end_date IS NULL THEN
    RAISE EXCEPTION 'Tanggal mulai dan selesai proyek wajib tersedia';
  END IF;
  IF _edited_end_date < _edited_start_date THEN
    RAISE EXCEPTION 'Tanggal selesai proyek tidak boleh sebelum tanggal mulai';
  END IF;
  IF _proposed_end_date IS NOT NULL AND _proposed_start_date IS NOT NULL
     AND _proposed_end_date < _proposed_start_date THEN
    RAISE EXCEPTION 'Tanggal selesai usulan tidak boleh sebelum tanggal mulai';
  END IF;

  -- ---- KEPUTUSAN FINAL (MANUSIA) ---------------------------------------
  _default_final_decision := CASE _recommendation
    WHEN 'mandatory' THEN 'approved'
    WHEN 'queued'    THEN 'approved'
    WHEN 'gated'     THEN 'gated'
  END;
  _decision := COALESCE(NULLIF(btrim(_final_decision), ''), _default_final_decision);

  IF _decision NOT IN ('approved', 'conditional', 'deferred', 'rejected', 'gated') THEN
    RAISE EXCEPTION 'final_decision tidak valid: %', _decision;
  END IF;
  IF _decision <> _default_final_decision
     AND NULLIF(btrim(_override_reason), '') IS NULL THEN
    RAISE EXCEPTION 'override_reason wajib bila keputusan final berbeda dari rekomendasi kalkulator';
  END IF;
  IF NULLIF(btrim(_final_decision_note), '') IS NULL THEN
    RAISE EXCEPTION 'final_decision_note wajib diisi';
  END IF;
  IF _decision = 'deferred'
     AND (
       NULLIF(btrim(_priority_note), '') IS NULL
       OR _proposed_start_date IS NULL
       OR _proposed_end_date IS NULL
     ) THEN
    RAISE EXCEPTION 'Keputusan deferred memerlukan priority_note dan jadwal usulan lengkap';
  END IF;
  IF _decision IN ('approved', 'conditional')
     AND NULLIF(btrim(COALESCE(_edited_pic, _project.pic)), '') IS NULL THEN
    RAISE EXCEPTION 'PIC wajib tersedia untuk keputusan approved/conditional';
  END IF;

  IF _project.attachment_url IS NOT NULL THEN
    _evidence := _evidence || jsonb_build_object(
      'proposal_attachment_url', _project.attachment_url
    );
  END IF;

  -- ---- SNAPSHOT METODE -------------------------------------------------
  -- Memuat seluruh kalimat rubrik dan pertanyaan probing agar UI dapat merender
  -- keputusan lama tanpa bergantung pada konstanta frontend yang bisa berubah.
  _method_snapshot := jsonb_build_object(
    'version', _method_version,
    'sop_reference', 'SOP/HTO/001/2026 rev 02',
    'scale_min', 1,
    'scale_max', 10,
    'formula', 'K1*0.20 + K2*0.20 + K3*0.25 + K4*0.20 + K5*0.15',
    'ranking_basis', 'score_percent',
    'evidence_required_min_score', 7,
    'weights', jsonb_build_object(
      'k1', 0.20, 'k2', 0.20, 'k3', 0.25, 'k4', 0.20, 'k5', 0.15
    ),
    'criteria', jsonb_build_object(
      'k1', 'Kesesuaian Strategis & Inovasi',
      'k2', 'Keselamatan Pasien, Mutu & PX/UX',
      'k3', 'Kelayakan Finansial & VOI (Financial Gate)',
      'k4', 'Arsitektur Teknis & Keamanan Data PDP',
      'k5', 'Urgensi Waktu & Quick Win (Time-to-Value)'
    ),
    'mandatory_questions', jsonb_build_object(
      'regulasi', 'Apakah diwajibkan Regulasi (Kemenkes/Kemenkeu/UU PDP)?',
      'akreditasi_bpjs', 'Apakah berdampak pada Akreditasi JCI / Lisensi RS / BPJS?',
      'risiko_kritis', 'Apakah mencegah Risiko Kritis (Patient Safety / Downtime)?'
    ),
    'probing_questions', jsonb_build_object(
      'k1', jsonb_build_array(
        'Pilar Renstra atau KPI Direktur mana yang didukung oleh proyek ini?',
        'Apakah fitur ini sudah dimiliki oleh RS pesaing, atau membuat RS kita menjadi pelopor?'
      ),
      'k2', jsonb_build_array(
        'Apakah ketiadaan sistem ini berpotensi menimbulkan kesalahan medis (medical error) atau komplain pasien?',
        'Berapa banyak langkah manual / formulir kertas yang bisa dipangkas untuk dokter, perawat, atau staf?'
      ),
      'k3', jsonb_build_array(
        'Berapa jam kerja staf per hari yang terbuang untuk proses manual ini jika dikonversi ke rupiah?',
        'Apakah proyek ini menambah pendapatan langsung, atau mencegah potensi klaim BPJS/piutang tertahan?'
      ),
      'k4', jsonb_build_array(
        'Apakah proyek ini menjadi syarat utama agar aplikasi/sistem lain di RS bisa berjalan?',
        'Apakah sistem ini mengolah data medis sensitif yang wajib dienkripsi sesuai UU PDP?'
      ),
      'k5', jsonb_build_array(
        'Berapa lama waktu yang dibutuhkan sampai manfaat pertama (first deliverable) dapat dirasakan pengguna?',
        'Apakah ada tenggat waktu khusus (deadline) yang jika terlewati akan membatalkan manfaat proyek?'
      )
    ),
    'bands', jsonb_build_object(
      'k1', jsonb_build_array(
        jsonb_build_object('label', '1-3',  'min', 1, 'max', 3,
          'description', 'Usulan hanya untuk kenyamanan internal 1 sub-unit; tidak ada kaitan dengan KPI Dirut atau Renstra.'),
        jsonb_build_object('label', '4-6',  'min', 4, 'max', 6,
          'description', 'Membantu pencapaian KPI tingkat departemen; menyamai standar operasional RS kompetitor.'),
        jsonb_build_object('label', '7-8',  'min', 7, 'max', 8,
          'description', 'Berdampak langsung pada 1-2 KPI Dirut; memberikan fitur layanan unggulan dibanding kompetitor lokal.'),
        jsonb_build_object('label', '9-10', 'min', 9, 'max', 10,
          'description', 'Menjadi penopang utama Pilar Strategis RS & KPI Utama Dirut; terobosan inovasi baru (Pioneering/USP RS).')
      ),
      'k2', jsonb_build_array(
        jsonb_build_object('label', '1-3',  'min', 1, 'max', 3,
          'description', 'Tidak berdampak pada alur klinis maupun pengalaman pasien; perbaikan tampilan/kosmetik administrasi.'),
        jsonb_build_object('label', '4-6',  'min', 4, 'max', 6,
          'description', 'Memperbaiki efisiensi alur kerja 1 unit internal tanpa dampak langsung ke pasien/nakes utama.'),
        jsonb_build_object('label', '7-8',  'min', 7, 'max', 8,
          'description', 'Secara langsung memotong durasi antrean pasien lebih dari 30 persen ATAU memangkas beban input manual nakes.'),
        jsonb_build_object('label', '9-10', 'min', 9, 'max', 10,
          'description', 'Berdampak kritikal mencegah Sentinel Event / IPSG JCI DAN menghapuskan burnout administrasi nakes secara masif.')
      ),
      'k3', jsonb_build_array(
        jsonb_build_object('label', '1-3',  'min', 1, 'max', 3, 'zone', 'Red Zone',
          'description', 'Payback Period lebih dari 3 tahun; efisiensi jam kerja kurang dari 50 jam/bulan; tidak ada dampak revenue/saving.'),
        jsonb_build_object('label', '4-6',  'min', 4, 'max', 6, 'zone', 'Yellow Zone',
          'description', 'Payback Period 1,5-3 tahun; efisiensi jam kerja 50-200 jam/bulan; cost saving skala kecil.'),
        jsonb_build_object('label', '7-8',  'min', 7, 'max', 8, 'zone', 'Green Zone',
          'description', 'Payback Period 6-18 bulan; efisiensi jam kerja 200-500 jam/bulan (setara 1-2 FTE); mencegah potensi kerugian finansial.'),
        jsonb_build_object('label', '9-10', 'min', 9, 'max', 10, 'zone', 'Gold Zone',
          'description', 'Payback Period kurang dari 6 bulan; ROI lebih dari 50 persen; efisiensi jam kerja lebih dari 500 jam/bulan (lebih dari Rp 100 Juta/tahun).')
      ),
      'k4', jsonb_build_array(
        jsonb_build_object('label', '1-3',  'min', 1, 'max', 3,
          'description', 'Sistem berdiri sendiri (standalone), menambah beban maintenance IT, belum ada standar keamanan data.'),
        jsonb_build_object('label', '4-6',  'min', 4, 'max', 6,
          'description', 'Membutuhkan integrasi ringan dengan 1-2 sistem internal; dampak keamanan siber rendah.'),
        jsonb_build_object('label', '7-8',  'min', 7, 'max', 8,
          'description', 'Menjadi prasyarat (prerequisite) bagi 1-2 proyek strategis lain; memenuhi standar kontrol akses RME.'),
        jsonb_build_object('label', '9-10', 'min', 9, 'max', 10,
          'description', 'Proyek Core Enabler (fondasi utama portofolio IT RS); menutup celah kerentanan kritis siber & patuh penuh UU PDP.')
      ),
      'k5', jsonb_build_array(
        jsonb_build_object('label', '1-3',  'min', 1, 'max', 3,
          'description', 'Waktu implementasi lebih dari 12 bulan; dampak baru terasa dalam jangka panjang.'),
        jsonb_build_object('label', '4-6',  'min', 4, 'max', 6,
          'description', 'Waktu implementasi 6-12 bulan; dampak terasa bertahap.'),
        jsonb_build_object('label', '7-8',  'min', 7, 'max', 8,
          'description', 'Waktu implementasi 3-6 bulan; memberikan perbaikan langsung yang terukur.'),
        jsonb_build_object('label', '9-10', 'min', 9, 'max', 10,
          'description', 'Quick Win (kurang dari 3 bulan); memberikan perbaikan instan dan menyelesaikan keluhan kritis pengguna.')
      )
    ),
    'effort_bars', jsonb_build_array(
      'Sangat mudah: tim internal HTO, kurang dari 1 bulan, tanpa vendor eksternal.',
      'Mudah: sedikit koordinasi lintas unit, 1-3 bulan.',
      'Sedang: koordinasi lintas unit, 3-6 bulan, mungkin butuh vendor pendukung.',
      'Sulit: banyak ketergantungan sistem, vendor eksternal, 6-12 bulan.',
      'Sangat sulit: infrastruktur baru, vendor pihak ketiga, lebih dari 12 bulan, risiko tinggi.'
    ),
    'financial_gate', jsonb_build_object(
      'criterion', 'k3',
      'gated_max_score', 3,
      'gated_effect', 'Under Review/Pending - butuh justifikasi ulang atau diskresi Direksi'
    ),
    'quadrant_high_impact_min', 7.0,
    'quadrant_high_effort_min', 4,
    'gate_keys', to_jsonb(_required_gate_keys),
    'gates_are_veto', false,
    -- Metode ini sengaja TIDAK memiliki ambang GO/Defer/No-Go. SOP hanya
    -- mengenal mandatory/queued/gated; penolakan adalah keputusan manusia.
    'calculator_outcomes', jsonb_build_array('mandatory', 'queued', 'gated')
  );

  _effective_intake_snapshot := COALESCE(_intake_snapshot, '{}'::jsonb)
    || jsonb_build_object(
    'project', jsonb_build_object(
        'title', COALESCE(_edited_title, _project.title),
        'description', COALESCE(_edited_description, _project.description),
        'unit', COALESCE(_edited_unit, _project.unit),
        'requester_id', _project.requester_id,
        'requester_name', _project.requester_name,
        'start_date', _edited_start_date,
        'end_date', _edited_end_date,
        'pic', COALESCE(_edited_pic, _project.pic),
        'master_proyek_id', _project.master_proyek_id,
        'attachment_url', _project.attachment_url,
        'status_saat_dinilai', _project.status
      )
    );

  SELECT COALESCE(max(revision_no), 0) + 1
  INTO _revision_no
  FROM public.project_priority_assessments
  WHERE project_id = _project_id;

  INSERT INTO public.project_priority_assessments (
    project_id, revision_no, method_version, method_snapshot,
    is_mandatory, mandatory_answers, probing_session,
    scores, justifications, evidence, effort, gates, eligibility_notes,
    intake_snapshot, governance_snapshot,
    impact_score, score_percent, priority_index, priority_quadrant,
    financial_gate_status, eligibility_status,
    calculated_recommendation, recommendation_reasons,
    final_decision, final_decision_note, override_reason, priority_note, technical_notes,
    proposed_start_date, proposed_end_date,
    assessed_by, assessed_at, decided_by, decided_at
  ) VALUES (
    _project_id, _revision_no, _method_version, _method_snapshot,
    _is_mandatory, COALESCE(_mandatory_answers, '{}'::jsonb), COALESCE(_probing_session, '{}'::jsonb),
    _scores, _justifications, _evidence, _effort,
    _gates, NULLIF(btrim(_eligibility_notes), ''),
    _effective_intake_snapshot, COALESCE(_governance_snapshot, '{}'::jsonb),
    _impact_score, _score_percent, _priority_index, _quadrant,
    _financial_gate, _eligibility_status,
    _recommendation, _recommendation_reasons,
    _decision, NULLIF(btrim(_final_decision_note), ''), NULLIF(btrim(_override_reason), ''),
    NULLIF(btrim(_priority_note), ''), NULLIF(btrim(_technical_notes), ''),
    _proposed_start_date, _proposed_end_date,
    _actor, now(), _actor, now()
  )
  RETURNING * INTO _assessment;

  -- ---- SINKRONISASI KOLOM LEGACY ---------------------------------------
  -- projects.priority adalah label tampilan warisan, BUKAN ambang SOP. Urutan
  -- resmi antrean selalu score_percent. Ember di bawah hanya supaya layar lama
  -- yang membaca enum ini tetap menampilkan sesuatu yang masuk akal.
  _legacy_priority := CASE
    WHEN _is_mandatory              THEN 'urgent'::public.project_priority
    WHEN _score_percent >= 85       THEN 'urgent'::public.project_priority
    WHEN _score_percent >= 70       THEN 'high'::public.project_priority
    WHEN _score_percent >= 50       THEN 'medium'::public.project_priority
    ELSE 'low'::public.project_priority
  END;

  _legacy_status := CASE
    -- Proyek yang sudah berjalan tidak ditarik keluar dari eksekusi hanya karena
    -- penilaian ulangnya ter-gate; gate tetap tercatat di snapshot. Menghentikan
    -- proyek berjalan harus berupa keputusan eksplisit deferred/rejected.
    WHEN _project.status = 'active'::public.project_status
         AND _decision IN ('approved', 'conditional', 'gated')
      THEN 'active'::public.project_status
    WHEN _decision = 'approved'    THEN 'approved'::public.project_status
    WHEN _decision = 'conditional' THEN 'approved'::public.project_status
    WHEN _decision = 'gated'       THEN 'pending'::public.project_status
    WHEN _decision = 'deferred'    THEN 'deprioritized'::public.project_status
    WHEN _decision = 'rejected'    THEN 'rejected'::public.project_status
  END;

  PERFORM set_config('app.tier2_assessment_write', 'on', true);
  PERFORM set_config('app.project_status_write', 'on', true);

  UPDATE public.projects SET
    current_priority_assessment_id = _assessment.id,
    title                          = COALESCE(_edited_title, title),
    description                    = COALESCE(_edited_description, description),
    unit                           = COALESCE(_edited_unit, unit),
    start_date                     = _edited_start_date,
    end_date                       = _edited_end_date,
    pic                            = COALESCE(_edited_pic, pic),
    effort                         = _effort,
    urgency                        = NULL,
    impact                         = NULL,
    priority_quadrant              = _quadrant,
    priority_rationale             = CASE
      WHEN _is_mandatory THEN format(
        'SOP %s - Tahap 1 MANDATORY (Priority 0 / Fast Track). Skoring Tahap 2 dilewati sesuai SOP 5.1.',
        _method_version
      )
      ELSE format(
        'SOP %s - Total Skor Akhir %s dari 10 (%s persen); Effort %s dari 5; Priority Index %s; Gate finansial %s; Checklist %s; Rekomendasi %s.',
        _method_version,
        trim(to_char(_impact_score, 'FM9D00')),
        trim(to_char(_score_percent, 'FM990D00')),
        _effort,
        trim(to_char(_priority_index, 'FM9D0000')),
        _financial_gate,
        _eligibility_status,
        _recommendation
      )
    END,
    priority_note                  = COALESCE(NULLIF(btrim(_priority_note), ''), NULLIF(btrim(_final_decision_note), '')),
    priority_set_by                = _actor,
    priority_set_at                = now(),
    proposed_start_date            = _proposed_start_date,
    proposed_end_date              = _proposed_end_date,
    -- Hanya keputusan Ditunda yang memulai siklus tanggapan pengaju. Penilaian
    -- ulang berkeputusan lain tidak boleh menghapus tanggapan yang sudah ada.
    requester_decision             = CASE WHEN _decision = 'deferred' THEN NULL ELSE requester_decision END,
    requester_decision_at          = CASE WHEN _decision = 'deferred' THEN NULL ELSE requester_decision_at END,
    priority                       = _legacy_priority,
    is_priority                    = (_decision IN ('approved', 'conditional')),
    status                         = _legacy_status,
    admin_note                     = COALESCE(
      NULLIF(btrim(_technical_notes), ''),
      NULLIF(btrim(_final_decision_note), ''),
      admin_note
    ),
    update_requested               = CASE WHEN _decision IN ('approved', 'conditional') THEN false ELSE update_requested END
  WHERE id = _project_id;

  RETURN _assessment;
END;
$$;

REVOKE ALL ON FUNCTION public.record_sop2026_priority_assessment(
  uuid, jsonb, jsonb, jsonb, jsonb, jsonb, smallint, jsonb, text, text,
  date, date, text, text, text, jsonb, jsonb, text, jsonb, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_sop2026_priority_assessment(
  uuid, jsonb, jsonb, jsonb, jsonb, jsonb, smallint, jsonb, text, text,
  date, date, text, text, text, jsonb, jsonb, text, jsonb, text
) TO authenticated;

COMMENT ON FUNCTION public.record_sop2026_priority_assessment(
  uuid, jsonb, jsonb, jsonb, jsonb, jsonb, smallint, jsonb, text, text,
  date, date, text, text, text, jsonb, jsonb, text, jsonb, text
) IS
  'Merekam snapshot immutable metode HTO-SOP-2026.1: Tahap 1 mandatory, skoring K1-K5 skala 1-10, gate finansial K3, checklist non-veto, keputusan final manusia, lalu sinkronisasi kolom legacy secara atomik. Mengizinkan penilaian ulang (revisi baru).';


-- ============================================================
-- BAGIAN 5 - PENSIUNKAN RPC METODE LAMA
--
-- Fungsinya dibiarkan ada agar riwayat dan tipe generated tidak rusak, tetapi
-- tidak boleh lagi dipanggil dari klien. Tanpa REVOKE ini, metode lama tetap
-- terbuka lewat REST bagi setiap super_admin dan dua metode bisa dipakai
-- bersamaan tanpa disadari.
-- ============================================================

REVOKE EXECUTE ON FUNCTION public.record_tier2_priority_assessment(
  uuid, jsonb, jsonb, jsonb, smallint, jsonb, text, text, date, date,
  text, text, text, jsonb, jsonb, text, jsonb, text
) FROM authenticated;

COMMENT ON FUNCTION public.record_tier2_priority_assessment(
  uuid, jsonb, jsonb, jsonb, smallint, jsonb, text, text, date, date,
  text, text, text, jsonb, jsonb, text, jsonb, text
) IS
  'DIPENSIUNKAN sejak SOP/HTO/001/2026. Hak EXECUTE sudah dicabut; gunakan record_sop2026_priority_assessment. Dipertahankan hanya sebagai rujukan snapshot HTO-T2-1.0.';
