-- ============================================================
-- Tier 2 Priority Assessment: K1-K7 + Effort + Eligibility Gate
--
-- Menambahkan snapshot penilaian yang immutable, perhitungan server-side,
-- jejak audit, serta pemisahan rekomendasi terhitung dari keputusan final.
--
-- Dependensi:
--   1. combined_migration.sql / _batch3.sql .. _batch5.sql
--   2. _batch6_priority_gate.sql
--   3. _batch7_effort_quadrant.sql
--
-- Seluruh script ini dapat dijalankan sebagai satu transaksi di Supabase SQL
-- Editor. Tidak ada ALTER TYPE enum PostgreSQL; domain nilai memakai CHECK agar
-- deployment idempotent dan perubahan nilai di masa depan tidak terikat enum.
-- ============================================================


-- ============================================================
-- BAGIAN 1 - TABEL SNAPSHOT PENILAIAN
-- ============================================================

CREATE TABLE IF NOT EXISTS public.project_priority_assessments (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id               uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  revision_no              integer NOT NULL,

  -- Versi metode harus selalu disimpan bersama hasil. Perubahan bobot/BARS di
  -- masa depan membuat revision baru; keputusan lama tidak dihitung ulang.
  method_version           text NOT NULL DEFAULT 'HTO-T2-1.0',
  method_snapshot          jsonb NOT NULL,

  -- Nilai terstruktur yang dipakai kalkulasi. Bentuk wajib:
  -- scores: { k1..k7: integer 1..5 }
  -- justifications/evidence: { k1..k7, effort: string }
  -- gates: delapan boolean dengan key yang divalidasi oleh RPC.
  scores                   jsonb NOT NULL,
  justifications           jsonb NOT NULL,
  evidence                 jsonb NOT NULL,
  effort                   smallint NOT NULL,
  gates                    jsonb NOT NULL,
  eligibility_notes        text,

  -- Data intake/governance disnapshot agar keputusan tetap dapat diaudit walau
  -- data proyek operasional kemudian disunting.
  intake_snapshot          jsonb NOT NULL DEFAULT '{}'::jsonb,
  governance_snapshot      jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Hasil materialized dari formula versi di atas.
  impact_score             numeric(6,4) NOT NULL,
  priority_index           numeric(8,4) NOT NULL,
  priority_quadrant        text NOT NULL,
  eligibility_status       text NOT NULL,
  calculated_recommendation text NOT NULL,
  recommendation_reasons   jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Keputusan manusia dipisahkan dari rekomendasi kalkulator. Bila berbeda,
  -- override_reason wajib terisi dan skor asli tetap tidak berubah.
  final_decision           text NOT NULL,
  final_decision_note      text NOT NULL,
  override_reason          text,
  priority_note            text,
  technical_notes          text,
  proposed_start_date      date,
  proposed_end_date        date,

  assessed_by              uuid NOT NULL REFERENCES auth.users(id),
  assessed_at              timestamptz NOT NULL DEFAULT now(),
  decided_by               uuid NOT NULL REFERENCES auth.users(id),
  decided_at               timestamptz NOT NULL DEFAULT now(),
  created_at               timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT project_priority_assessments_revision_positive
    CHECK (revision_no > 0),
  CONSTRAINT project_priority_assessments_effort_check
    CHECK (effort BETWEEN 1 AND 5),
  CONSTRAINT project_priority_assessments_scores_object_check
    CHECK (jsonb_typeof(scores) = 'object'),
  CONSTRAINT project_priority_assessments_justifications_object_check
    CHECK (jsonb_typeof(justifications) = 'object'),
  CONSTRAINT project_priority_assessments_evidence_object_check
    CHECK (jsonb_typeof(evidence) = 'object'),
  CONSTRAINT project_priority_assessments_gates_object_check
    CHECK (jsonb_typeof(gates) = 'object'),
  CONSTRAINT project_priority_assessments_intake_object_check
    CHECK (jsonb_typeof(intake_snapshot) = 'object'),
  CONSTRAINT project_priority_assessments_governance_object_check
    CHECK (jsonb_typeof(governance_snapshot) = 'object'),
  CONSTRAINT project_priority_assessments_reasons_array_check
    CHECK (jsonb_typeof(recommendation_reasons) = 'array'),
  CONSTRAINT project_priority_assessments_impact_score_check
    CHECK (impact_score BETWEEN 1 AND 5),
  CONSTRAINT project_priority_assessments_priority_index_check
    CHECK (priority_index BETWEEN 0.2 AND 5),
  CONSTRAINT project_priority_assessments_quadrant_check
    CHECK (priority_quadrant IN ('quick_win', 'big_bet', 'fill_in', 'thankless')),
  CONSTRAINT project_priority_assessments_eligibility_check
    CHECK (eligibility_status IN ('eligible', 'ineligible')),
  CONSTRAINT project_priority_assessments_recommendation_check
    CHECK (calculated_recommendation IN ('go', 'conditional_go', 'defer', 'no_go')),
  CONSTRAINT project_priority_assessments_final_decision_check
    CHECK (final_decision IN ('approved', 'conditional', 'deferred', 'rejected')),
  CONSTRAINT project_priority_assessments_schedule_check
    CHECK (proposed_end_date IS NULL OR proposed_start_date IS NULL
           OR proposed_end_date >= proposed_start_date),
  CONSTRAINT project_priority_assessments_deferred_context_check
    CHECK (
      final_decision <> 'deferred'
      OR (
        NULLIF(btrim(priority_note), '') IS NOT NULL
        AND proposed_start_date IS NOT NULL
        AND proposed_end_date IS NOT NULL
      )
    ),
  CONSTRAINT project_priority_assessments_override_check
    CHECK (
      (final_decision = CASE calculated_recommendation
          WHEN 'go'             THEN 'approved'
          WHEN 'conditional_go' THEN 'conditional'
          WHEN 'defer'          THEN 'deferred'
          WHEN 'no_go'          THEN 'rejected'
        END)
      OR NULLIF(btrim(override_reason), '') IS NOT NULL
    ),
  CONSTRAINT project_priority_assessments_project_revision_key
    UNIQUE (project_id, revision_no),
  -- Dibutuhkan oleh composite FK projects -> assessment agar proyek A tidak
  -- dapat menunjuk assessment milik proyek B.
  CONSTRAINT project_priority_assessments_project_id_id_key
    UNIQUE (project_id, id)
);

CREATE INDEX IF NOT EXISTS idx_priority_assessments_project_created
  ON public.project_priority_assessments (project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_priority_assessments_ranking
  ON public.project_priority_assessments
  (eligibility_status, priority_index DESC, impact_score DESC);

-- Jika versi awal batch ini sempat dijalankan di lingkungan pengembangan,
-- lengkapi kolom/constraint tanpa mengubah snapshot yang sudah tersimpan.
ALTER TABLE public.project_priority_assessments
  ADD COLUMN IF NOT EXISTS technical_notes text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.project_priority_assessments'::regclass
      AND conname = 'project_priority_assessments_deferred_context_check'
  ) THEN
    ALTER TABLE public.project_priority_assessments
      ADD CONSTRAINT project_priority_assessments_deferred_context_check
      CHECK (
        final_decision <> 'deferred'
        OR (
          NULLIF(btrim(priority_note), '') IS NOT NULL
          AND proposed_start_date IS NOT NULL
          AND proposed_end_date IS NOT NULL
        )
      );
  END IF;
END $$;

COMMENT ON TABLE public.project_priority_assessments IS
  'Snapshot immutable penilaian prioritas Tier 2. Skor, metode, hasil kalkulasi, dan keputusan final disimpan per revisi.';
COMMENT ON COLUMN public.project_priority_assessments.method_snapshot IS
  'Snapshot bobot, formula, ambang, gate keys, dan label kriteria saat keputusan dibuat.';
COMMENT ON COLUMN public.project_priority_assessments.intake_snapshot IS
  'Snapshot data intake: RSB reference, sponsor/business owner, target outcome, dependencies, dan konteks lain.';
COMMENT ON COLUMN public.project_priority_assessments.governance_snapshot IS
  'Snapshot metadata governance/komite, misalnya meeting/quorum/approver/evidence tambahan.';
COMMENT ON COLUMN public.project_priority_assessments.calculated_recommendation IS
  'Rekomendasi kalkulator; tidak boleh ditimpa oleh keputusan final/override.';
COMMENT ON COLUMN public.project_priority_assessments.final_decision IS
  'Keputusan final manusia: approved/conditional/deferred/rejected.';


-- ============================================================
-- BAGIAN 2 - POINTER AKTIF PADA projects
--
-- Composite FK mencegah cross-project pointer. Kolom ringkasan materialized
-- tetap berada di tabel assessment, bukan projects, agar policy UPDATE projects
-- yang luas tidak dapat memalsukan skor resmi.
-- ============================================================

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS current_priority_assessment_id uuid;

-- Kolom `id` sudah unik sebagai primary key; pasangan ini dibutuhkan sebagai
-- target composite FK (id, current_priority_assessment_id).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.projects'::regclass
      AND conname = 'projects_id_current_priority_assessment_key'
  ) THEN
    ALTER TABLE public.projects
      ADD CONSTRAINT projects_id_current_priority_assessment_key
      UNIQUE (id, current_priority_assessment_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.projects'::regclass
      AND conname = 'projects_current_priority_assessment_fkey'
  ) THEN
    ALTER TABLE public.projects
      ADD CONSTRAINT projects_current_priority_assessment_fkey
      FOREIGN KEY (id, current_priority_assessment_id)
      REFERENCES public.project_priority_assessments(project_id, id)
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_projects_current_priority_assessment
  ON public.projects (current_priority_assessment_id)
  WHERE current_priority_assessment_id IS NOT NULL;

COMMENT ON COLUMN public.projects.current_priority_assessment_id IS
  'Assessment Tier 2 aktif. Composite FK menjamin assessment tersebut milik proyek yang sama.';


-- ============================================================
-- BAGIAN 3 - IMMUTABILITY DAN RLS
-- ============================================================

CREATE OR REPLACE FUNCTION public.prevent_priority_assessment_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE'
     AND pg_trigger_depth() > 1
     AND NOT EXISTS (
       SELECT 1 FROM public.projects WHERE id = OLD.project_id
     ) THEN
    -- Izinkan hanya cascade yang berasal dari penghapusan parent project.
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'Snapshot penilaian prioritas tidak boleh diubah atau dihapus; buat revisi baru';
END;
$$;

DROP TRIGGER IF EXISTS prevent_priority_assessment_update
  ON public.project_priority_assessments;
CREATE TRIGGER prevent_priority_assessment_update
BEFORE UPDATE ON public.project_priority_assessments
FOR EACH ROW EXECUTE FUNCTION public.prevent_priority_assessment_mutation();

DROP TRIGGER IF EXISTS prevent_priority_assessment_delete
  ON public.project_priority_assessments;
CREATE TRIGGER prevent_priority_assessment_delete
BEFORE DELETE ON public.project_priority_assessments
FOR EACH ROW EXECUTE FUNCTION public.prevent_priority_assessment_mutation();

-- Kolom ringkasan legacy di projects tetap diperlukan untuk backward
-- compatibility, tetapi tidak boleh lagi ditulis langsung setelah pointer
-- assessment aktif tersedia. RPC membuka guard hanya sepanjang transaksinya.
CREATE OR REPLACE FUNCTION public.protect_snapshot_linked_project_priority()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.current_priority_assessment_id IS NOT NULL
     AND current_setting('app.tier2_assessment_write', true) IS DISTINCT FROM 'on'
     AND (
       NEW.current_priority_assessment_id IS DISTINCT FROM OLD.current_priority_assessment_id
       OR NEW.priority IS DISTINCT FROM OLD.priority
       OR NEW.urgency IS DISTINCT FROM OLD.urgency
       OR NEW.impact IS DISTINCT FROM OLD.impact
       OR NEW.effort IS DISTINCT FROM OLD.effort
       OR NEW.priority_quadrant IS DISTINCT FROM OLD.priority_quadrant
       OR NEW.is_priority IS DISTINCT FROM OLD.is_priority
       OR NEW.priority_rationale IS DISTINCT FROM OLD.priority_rationale
       OR NEW.priority_note IS DISTINCT FROM OLD.priority_note
       OR NEW.priority_set_by IS DISTINCT FROM OLD.priority_set_by
       OR NEW.priority_set_at IS DISTINCT FROM OLD.priority_set_at
       OR NEW.proposed_start_date IS DISTINCT FROM OLD.proposed_start_date
       OR NEW.proposed_end_date IS DISTINCT FROM OLD.proposed_end_date
       OR NEW.status IS DISTINCT FROM OLD.status
      ) THEN
    RAISE EXCEPTION 'Keputusan proyek terhubung snapshot; ubah melalui RPC tata kelola Tier 2';
  END IF;
  RETURN NEW;
END;
$$;

-- Policy UPDATE lama memberi pemilik dan unit kolaborator hak menulis seluruh
-- row. PostgreSQL RLS tidak membatasi per kolom, sehingga status dapat dipalsukan
-- menjadi approved melalui REST. Trigger ini menahan kolom status untuk seluruh
-- caller non-Super Admin; transisi sah milik pengaju dilakukan oleh RPC
-- SECURITY DEFINER respond_to_priority dan transisi penilaian oleh RPC Tier 2.
CREATE OR REPLACE FUNCTION public.protect_project_status_governance()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  _actor uuid := auth.uid();
  _is_super_admin boolean := COALESCE(public.has_role(auth.uid(), 'super_admin'::app_role), false);
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF _actor IS NOT NULL
       AND NEW.status <> 'pending'::public.project_status
       AND current_setting('app.project_status_write', true) IS DISTINCT FROM 'on'
       AND current_setting('app.tier2_assessment_write', true) IS DISTINCT FROM 'on' THEN
      RAISE EXCEPTION 'Usulan proyek baru wajib berstatus pending dan melewati evaluasi Tier 2';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status
     AND current_setting('app.project_status_write', true) IS DISTINCT FROM 'on'
     AND current_setting('app.tier2_assessment_write', true) IS DISTINCT FROM 'on'
     AND _actor IS NOT NULL THEN
    -- Super Admin tetap boleh mengelola transisi operasional lama (misalnya
    -- revision atau active) selama belum/ tidak mengubah hasil keputusan yang
    -- sudah terikat snapshot. Persetujuan awal tanpa assessment tetap dilarang.
    IF _is_super_admin
       AND NOT (
         OLD.current_priority_assessment_id IS NULL
         AND NEW.status IN (
           'approved'::public.project_status,
           'deprioritized'::public.project_status,
           'rejected'::public.project_status
         )
       )
       AND NOT (
         OLD.current_priority_assessment_id IS NOT NULL
         AND OLD.status IN (
           'deprioritized'::public.project_status,
           'rejected'::public.project_status,
           'withdrawn'::public.project_status
         )
         AND NEW.status IN (
           'approved'::public.project_status,
           'active'::public.project_status
         )
       ) THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Status proyek hanya dapat diubah melalui alur tata kelola resmi';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_project_status_governance ON public.projects;
CREATE TRIGGER protect_project_status_governance
BEFORE INSERT OR UPDATE ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.protect_project_status_governance();

DROP TRIGGER IF EXISTS protect_snapshot_linked_project_priority
  ON public.projects;
CREATE TRIGGER protect_snapshot_linked_project_priority
BEFORE UPDATE ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.protect_snapshot_linked_project_priority();

ALTER TABLE public.project_priority_assessments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Project stakeholders can view priority assessments"
  ON public.project_priority_assessments;
CREATE POLICY "Project stakeholders can view priority assessments"
ON public.project_priority_assessments
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin'::app_role)
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.is_project_owner(auth.uid(), project_id)
  OR public.is_assigned_to_project(auth.uid(), project_id)
  OR (
    public.has_role(auth.uid(), 'project_executor'::app_role)
    AND public.is_project_approved_or_active(project_id)
  )
);

-- Tidak ada policy INSERT/UPDATE/DELETE. Semua penulisan harus lewat RPC
-- SECURITY DEFINER di bawah agar formula, audit metadata, dan sinkronisasi
-- legacy berlangsung atomik.


-- ============================================================
-- BAGIAN 4 - RPC ATOMIK PENILAIAN DAN KEPUTUSAN
-- ============================================================

CREATE OR REPLACE FUNCTION public.record_tier2_priority_assessment(
  _project_id              uuid,
  _scores                  jsonb,
  _justifications          jsonb,
  _evidence                jsonb,
  _effort                  smallint,
  _gates                   jsonb,
  _eligibility_notes       text DEFAULT NULL,
  _priority_note           text DEFAULT NULL,
  _proposed_start_date     date DEFAULT NULL,
  _proposed_end_date       date DEFAULT NULL,
  _final_decision          text DEFAULT NULL,
  _final_decision_note     text DEFAULT NULL,
  _override_reason         text DEFAULT NULL,
  _intake_snapshot         jsonb DEFAULT '{}'::jsonb,
  _governance_snapshot     jsonb DEFAULT '{}'::jsonb,
  _method_version          text DEFAULT 'HTO-T2-1.0',
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
  _gate_key                 text;
  _score                    integer;
  _impact_score             numeric(6,4);
  _priority_index           numeric(8,4);
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
  _required_criteria        constant text[] := ARRAY['k1','k2','k3','k4','k5','k6','k7'];
  _required_justifications  constant text[] := ARRAY['k1','k2','k3','k4','k5','k6','k7','effort'];
  _allowed_evidence_keys    constant text[] := ARRAY['k1','k2','k3','k4','k5','k6','k7','effort','proposal_attachment_url'];
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
BEGIN
  IF _actor IS NULL THEN
    RAISE EXCEPTION 'Autentikasi diperlukan';
  END IF;

  IF NOT public.has_role(_actor, 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'Hanya HTO/Super Admin yang dapat merekam keputusan prioritas';
  END IF;

  -- Mengunci proyek menserialkan revisi dan mencegah dua pemanggilan paralel
  -- memperoleh revision_no yang sama.
  SELECT * INTO _project
  FROM public.projects
  WHERE id = _project_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Proyek tidak ditemukan';
  END IF;
  IF _project.current_priority_assessment_id IS NOT NULL THEN
    RAISE EXCEPTION 'Proyek sudah memiliki assessment aktif; gunakan alur reassessment khusus untuk membuat revisi baru';
  END IF;
  IF _project.status <> 'pending'::public.project_status THEN
    RAISE EXCEPTION 'Penilaian awal hanya dapat direkam untuk proyek berstatus pending';
  END IF;

  IF jsonb_typeof(_scores) <> 'object'
     OR jsonb_typeof(_justifications) <> 'object'
     OR jsonb_typeof(_evidence) <> 'object'
     OR jsonb_typeof(_gates) <> 'object'
     OR jsonb_typeof(COALESCE(_intake_snapshot, '{}'::jsonb)) <> 'object'
     OR jsonb_typeof(COALESCE(_governance_snapshot, '{}'::jsonb)) <> 'object'
     OR jsonb_typeof(COALESCE(_edited_project, '{}'::jsonb)) <> 'object' THEN
    RAISE EXCEPTION 'scores, justifications, evidence, gates, snapshot, dan edited_project harus berupa JSON object';
  END IF;

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

  -- Tolak key tak dikenal agar salah eja tidak menghasilkan keputusan yang
  -- tampak valid tetapi sebenarnya mengabaikan suatu kriteria/gate.
  IF EXISTS (
    SELECT 1 FROM jsonb_object_keys(_scores) key
    WHERE NOT (key = ANY (_required_criteria))
  ) THEN
    RAISE EXCEPTION 'scores memiliki key yang tidak dikenal';
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

  FOREACH _criterion IN ARRAY _required_criteria LOOP
    IF NOT (_scores ? _criterion)
       OR jsonb_typeof(_scores -> _criterion) <> 'number'
       OR (_scores ->> _criterion) !~ '^[1-5]$' THEN
      RAISE EXCEPTION 'Skor % wajib berupa integer 1-5', upper(_criterion);
    END IF;

    _score := (_scores ->> _criterion)::integer;
    IF NULLIF(btrim(_justifications ->> _criterion), '') IS NULL THEN
      RAISE EXCEPTION 'Justifikasi % wajib diisi', upper(_criterion);
    END IF;
    IF _score >= 4 AND NULLIF(btrim(_evidence ->> _criterion), '') IS NULL THEN
      RAISE EXCEPTION 'Evidence % wajib diisi untuk skor 4-5', upper(_criterion);
    END IF;
  END LOOP;

  IF _effort IS NULL OR _effort NOT BETWEEN 1 AND 5 THEN
    RAISE EXCEPTION 'Effort wajib berupa integer 1-5';
  END IF;
  IF NULLIF(btrim(_justifications ->> 'effort'), '') IS NULL THEN
    RAISE EXCEPTION 'Justifikasi Effort wajib diisi';
  END IF;
  IF _effort >= 4 AND NULLIF(btrim(_evidence ->> 'effort'), '') IS NULL THEN
    RAISE EXCEPTION 'Evidence Effort wajib diisi untuk skor 4-5';
  END IF;

  FOREACH _gate_key IN ARRAY _required_gate_keys LOOP
    IF NOT (_gates ? _gate_key)
       OR jsonb_typeof(_gates -> _gate_key) <> 'boolean' THEN
      RAISE EXCEPTION 'Gate % wajib berupa boolean', _gate_key;
    END IF;
  END LOOP;

  IF NULLIF(btrim(_method_version), '') IS NULL THEN
    RAISE EXCEPTION 'method_version wajib diisi';
  END IF;
  IF _method_version <> 'HTO-T2-1.0' THEN
    RAISE EXCEPTION 'Versi metode tidak didukung oleh RPC ini: %', _method_version;
  END IF;
  IF _proposed_end_date IS NOT NULL AND _proposed_start_date IS NOT NULL
     AND _proposed_end_date < _proposed_start_date THEN
    RAISE EXCEPTION 'Tanggal selesai usulan tidak boleh sebelum tanggal mulai';
  END IF;
  IF _edited_end_date IS NOT NULL AND _edited_start_date IS NOT NULL
     AND _edited_end_date < _edited_start_date THEN
    RAISE EXCEPTION 'Tanggal selesai proyek tidak boleh sebelum tanggal mulai';
  END IF;
  IF _edited_start_date IS NULL OR _edited_end_date IS NULL THEN
    RAISE EXCEPTION 'Tanggal mulai dan selesai proyek wajib tersedia';
  END IF;
  -- Bobot pedoman Tier 2: 20,20,15,15,10,10,10 persen.
  _impact_score := round((
      (_scores ->> 'k1')::numeric * 0.20
    + (_scores ->> 'k2')::numeric * 0.20
    + (_scores ->> 'k3')::numeric * 0.15
    + (_scores ->> 'k4')::numeric * 0.15
    + (_scores ->> 'k5')::numeric * 0.10
    + (_scores ->> 'k6')::numeric * 0.10
    + (_scores ->> 'k7')::numeric * 0.10
  ), 4);
  _priority_index := round(_impact_score / _effort::numeric, 4);

  IF EXISTS (
    SELECT 1 FROM unnest(_required_gate_keys) key
    WHERE (_gates ->> key)::boolean = false
  ) THEN
    _eligibility_status := 'ineligible';
  ELSE
    _eligibility_status := 'eligible';
  END IF;

  IF _eligibility_status = 'ineligible'
     AND NULLIF(btrim(_eligibility_notes), '') IS NULL THEN
    RAISE EXCEPTION 'eligibility_notes wajib diisi bila ada gate yang tidak lulus';
  END IF;

  IF _eligibility_status = 'ineligible' THEN
    _recommendation := 'no_go';
    _recommendation_reasons := _recommendation_reasons
      || jsonb_build_array('Satu atau lebih gate kelayakan tidak lulus.');
  ELSIF _impact_score >= 3.50 THEN
    _recommendation := 'go';
  ELSIF _impact_score >= 3.00 THEN
    _recommendation := 'conditional_go';
    _recommendation_reasons := _recommendation_reasons
      || jsonb_build_array('Skor dampak berada pada rentang Conditional Go (3,00-3,49).');
  ELSIF _impact_score >= 2.50 THEN
    _recommendation := 'defer';
    _recommendation_reasons := _recommendation_reasons
      || jsonb_build_array('Skor dampak berada pada rentang tunda/perbaiki (2,50-2,99).');
  ELSE
    _recommendation := 'no_go';
    _recommendation_reasons := _recommendation_reasons
      || jsonb_build_array('Skor dampak di bawah 2,50.');
  END IF;

  _quadrant := CASE
    WHEN _impact_score >= 3.50 AND _effort <= 3 THEN 'quick_win'
    WHEN _impact_score >= 3.50 AND _effort >= 4 THEN 'big_bet'
    WHEN _impact_score <  3.50 AND _effort <= 3 THEN 'fill_in'
    ELSE 'thankless'
  END;

  _default_final_decision := CASE _recommendation
    WHEN 'go'             THEN 'approved'
    WHEN 'conditional_go' THEN 'conditional'
    WHEN 'defer'          THEN 'deferred'
    WHEN 'no_go'          THEN 'rejected'
  END;
  _decision := COALESCE(NULLIF(btrim(_final_decision), ''), _default_final_decision);

  IF _decision NOT IN ('approved', 'conditional', 'deferred', 'rejected') THEN
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

  _method_snapshot := jsonb_build_object(
    'version', _method_version,
    'tier', 2,
    'formula', 'weighted_impact / effort',
    'weights', jsonb_build_object(
      'k1', 0.20, 'k2', 0.20, 'k3', 0.15, 'k4', 0.15,
      'k5', 0.10, 'k6', 0.10, 'k7', 0.10
    ),
    'criteria', jsonb_build_object(
      'k1', 'Keselamatan Pasien & Risiko Klinis',
      'k2', 'Kepatuhan Regulasi & Mandat',
      'k3', 'Keselarasan Strategis',
      'k4', 'Dampak Operasional & Efisiensi',
      'k5', 'Urgensi / Cost of Delay',
      'k6', 'Dampak Finansial (ROI/Cost Avoidance)',
      'k7', 'Interoperabilitas & Arsitektur'
    ),
    'bars', jsonb_build_object(
      'k1', jsonb_build_array(
        'Tidak terkait keselamatan pasien; murni administratif.',
        'Berpotensi mengurangi risiko minor, tidak berdampak langsung ke pasien.',
        'Mendukung proses klinis rutin; mengurangi risiko insiden ringan.',
        'Mencegah insiden keselamatan pasien (KTD/KNC) berdampak sedang-mayor.',
        'Mencegah kejadian sentinel/katastropik, atau menindaklanjuti temuan kritikal KARS/JCI.'
      ),
      'k2', jsonb_build_array(
        'Tidak terkait regulasi atau mandat apa pun.',
        'Mendukung kepatuhan internal (SOP RS), bukan mandat eksternal.',
        'Mendukung salah satu standar akreditasi KARS non-kritikal.',
        'Bagian dari mandat regulasi nasional bertenggat longgar (>12 bulan).',
        'Mandat nasional bertenggat dekat (<6 bulan) dengan konsekuensi sanksi/administratif.'
      ),
      'k3', jsonb_build_array(
        'Tidak selaras dengan RSB/Renstra atau roadmap digital Kemenkes.',
        'Mendukung operasional rutin 1 unit, tidak tercantum di RSB.',
        'Terkait salah satu Program RSB, namun bukan prioritas utama.',
        'Turunan langsung dari Inisiatif RSB berjalan dan memiliki kode Program terkait.',
        'Inisiatif utama/flagship RSB, atau bagian transformasi digital nasional Kemenkes.'
      ),
      'k4', jsonb_build_array(
        'Berdampak pada kurang dari 1 unit kecil, tanpa perubahan proses kerja signifikan.',
        'Mempercepat proses di 1 unit dengan penghematan waktu minor.',
        'Berdampak pada beberapa unit terkait; penghematan waktu/proses cukup terasa.',
        'Berdampak lintas-instalasi/mayoritas layanan dan mengubah cara kerja signifikan.',
        'Berdampak ke seluruh rumah sakit; transformasi proses end-to-end.'
      ),
      'k5', jsonb_build_array(
        'Tidak ada konsekuensi berarti bila ditunda lebih dari 12 bulan.',
        'Penundaan menimbulkan ketidaknyamanan kecil dan mudah dimitigasi manual.',
        'Penundaan 6-12 bulan mulai berdampak pada kualitas layanan/pelaporan.',
        'Penundaan berisiko denda, keluhan pasien meningkat, atau tenggat regulasi mendekat.',
        'Penundaan segera berisiko pada keselamatan pasien, sanksi, atau kehilangan pendapatan.'
      ),
      'k6', jsonb_build_array(
        'Tidak ada dampak finansial terukur; murni cost center.',
        'Penghematan/pendapatan kecil dengan ROI lebih dari 3 tahun.',
        'Penghematan setara 1-2 FTE atau ROI 1-3 tahun.',
        'Mencegah revenue leakage moderat, atau ROI kurang dari 1 tahun.',
        'Penghematan signifikan atau mencegah kerugian besar, denda, atau klaim BPJS ditolak.'
      ),
      'k7', jsonb_build_array(
        'Sistem berdiri sendiri (silo) dan tidak terhubung ke SIMRS.',
        'Integrasi terbatas dan membutuhkan workaround manual/entri ganda.',
        'Terintegrasi dengan 1-2 sistem existing melalui API/standar umum.',
        'Terintegrasi penuh dengan SIMRS dan mendukung HL7/FHIR atau SATUSEHAT.',
        'Menjadi tulang punggung/platform integrasi bagi sistem-sistem lain.'
      ),
      'effort', jsonb_build_array(
        'Sangat mudah: tim internal HTO, kurang dari 1 bulan, tanpa vendor eksternal.',
        'Mudah: sedikit koordinasi lintas unit, 1-3 bulan.',
        'Sedang: koordinasi lintas unit, 3-6 bulan, mungkin butuh vendor pendukung.',
        'Sulit: banyak ketergantungan sistem, vendor eksternal, 6-12 bulan.',
        'Sangat sulit: infrastruktur baru, vendor pihak ketiga, lebih dari 12 bulan, risiko tinggi.'
      )
    ),
    'impact_thresholds', jsonb_build_object(
      'go_min', 3.50,
      'conditional_go_min', 3.00,
      'defer_min', 2.50
    ),
    'quadrant_high_impact_min', 3.50,
    'quadrant_high_effort_min', 4,
    'gate_keys', to_jsonb(_required_gate_keys)
  );

  _effective_intake_snapshot := COALESCE(_intake_snapshot, '{}'::jsonb)
    || jsonb_build_object(
    'project', jsonb_build_object(
        'title', COALESCE(_edited_title, _project.title),
        'description', COALESCE(_edited_description, _project.description),
        'unit', COALESCE(_edited_unit, _project.unit),
        'requester_id', _project.requester_id,
        'requester_name', _project.requester_name,
        'start_date', COALESCE(_edited_start_date, _project.start_date),
        'end_date', COALESCE(_edited_end_date, _project.end_date),
        'pic', COALESCE(_edited_pic, _project.pic),
        'master_proyek_id', _project.master_proyek_id,
        'attachment_url', _project.attachment_url
      )
    );

  SELECT COALESCE(max(revision_no), 0) + 1
  INTO _revision_no
  FROM public.project_priority_assessments
  WHERE project_id = _project_id;

  INSERT INTO public.project_priority_assessments (
    project_id, revision_no, method_version, method_snapshot,
    scores, justifications, evidence, effort, gates, eligibility_notes,
    intake_snapshot, governance_snapshot,
    impact_score, priority_index, priority_quadrant, eligibility_status,
    calculated_recommendation, recommendation_reasons,
    final_decision, final_decision_note, override_reason, priority_note, technical_notes,
    proposed_start_date, proposed_end_date,
    assessed_by, assessed_at, decided_by, decided_at
  ) VALUES (
    _project_id, _revision_no, _method_version, _method_snapshot,
    _scores, _justifications, _evidence, _effort, _gates, NULLIF(btrim(_eligibility_notes), ''),
    _effective_intake_snapshot, COALESCE(_governance_snapshot, '{}'::jsonb),
    _impact_score, _priority_index, _quadrant, _eligibility_status,
    _recommendation, _recommendation_reasons,
    _decision, NULLIF(btrim(_final_decision_note), ''), NULLIF(btrim(_override_reason), ''),
    NULLIF(btrim(_priority_note), ''), NULLIF(btrim(_technical_notes), ''),
    _proposed_start_date, _proposed_end_date,
    _actor, now(), _actor, now()
  )
  RETURNING * INTO _assessment;

  -- Sinkronisasi kolom legacy agar layar yang belum dimigrasikan tetap bekerja.
  _legacy_priority := CASE
    WHEN _impact_score >= 4.25 THEN 'urgent'::public.project_priority
    WHEN _impact_score >= 3.50 THEN 'high'::public.project_priority
    WHEN _impact_score >= 2.50 THEN 'medium'::public.project_priority
    ELSE 'low'::public.project_priority
  END;

  _legacy_status := CASE _decision
    WHEN 'approved'    THEN 'approved'::public.project_status
    WHEN 'conditional' THEN 'approved'::public.project_status
    WHEN 'deferred'    THEN 'deprioritized'::public.project_status
    WHEN 'rejected'    THEN 'rejected'::public.project_status
  END;

  -- Guard trigger hanya dibuka untuk sinkronisasi atomik di bawah ini.
  PERFORM set_config('app.tier2_assessment_write', 'on', true);
  PERFORM set_config('app.project_status_write', 'on', true);

  UPDATE public.projects SET
    current_priority_assessment_id = _assessment.id,
    title                          = COALESCE(_edited_title, title),
    description                    = COALESCE(_edited_description, description),
    unit                           = COALESCE(_edited_unit, unit),
    start_date                     = COALESCE(_edited_start_date, start_date),
    end_date                       = COALESCE(_edited_end_date, end_date),
    pic                            = COALESCE(_edited_pic, pic),
    effort                         = _effort,
    urgency                        = NULL,
    impact                         = NULL,
    priority_quadrant              = _quadrant,
    priority_rationale             = format(
      'Tier 2 %s — Skor Dampak %s/5; Effort %s/5; Priority Index %s; Eligibility %s; Rekomendasi %s.',
      _method_version, trim(to_char(_impact_score, 'FM9D0000')), _effort,
      trim(to_char(_priority_index, 'FM9D0000')), _eligibility_status, _recommendation
    ),
    priority_note                  = COALESCE(NULLIF(btrim(_priority_note), ''), NULLIF(btrim(_final_decision_note), '')),
    priority_set_by                = _actor,
    priority_set_at                = now(),
    proposed_start_date            = _proposed_start_date,
    proposed_end_date              = _proposed_end_date,
    requester_decision             = NULL,
    requester_decision_at          = NULL,
    priority                       = _legacy_priority,
    is_priority                    = CASE WHEN _decision IN ('approved', 'conditional') THEN true ELSE false END,
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

REVOKE ALL ON FUNCTION public.record_tier2_priority_assessment(
  uuid, jsonb, jsonb, jsonb, smallint, jsonb, text, text, date, date,
  text, text, text, jsonb, jsonb, text, jsonb, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_tier2_priority_assessment(
  uuid, jsonb, jsonb, jsonb, smallint, jsonb, text, text, date, date,
  text, text, text, jsonb, jsonb, text, jsonb, text
) TO authenticated;

COMMENT ON FUNCTION public.record_tier2_priority_assessment(
  uuid, jsonb, jsonb, jsonb, smallint, jsonb, text, text, date, date,
  text, text, text, jsonb, jsonb, text, jsonb, text
) IS
  'Merekam snapshot Tier 2 immutable, menghitung dampak/index/eligibility/rekomendasi server-side, menyimpan keputusan/override, lalu menyinkronkan kolom legacy secara atomik.';
