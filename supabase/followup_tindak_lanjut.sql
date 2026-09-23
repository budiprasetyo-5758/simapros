-- ============================================================
-- Migration: Tindak Lanjut (Corporate Secretary)
-- Tabel baru untuk tracking tindak lanjut rapat
-- AKSES EKSKLUSIF: hanya super_admin
--
-- Jalankan script ini di Supabase SQL Editor (Beta dulu).
-- ============================================================

-- 1. BUAT TABEL
-- ============================================================

CREATE TABLE public.followup_tindak_lanjut (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL CHECK (category IN ('rapimtas', 'rapim', 'others')),
  topik TEXT NOT NULL,
  masalah TEXT NOT NULL,
  upaya_tindak_lanjut TEXT NOT NULL,
  action_plan TEXT NOT NULL,
  deadline DATE NOT NULL,
  pic TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  closed_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. AKTIFKAN RLS
-- ============================================================

ALTER TABLE public.followup_tindak_lanjut ENABLE ROW LEVEL SECURITY;

-- 3. RLS POLICY — hanya super_admin
-- ============================================================

CREATE POLICY "Only super admins can access followup tindak lanjut"
  ON public.followup_tindak_lanjut FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- 4. TRIGGER updated_at
-- ============================================================

CREATE TRIGGER update_followup_tindak_lanjut_updated_at
  BEFORE UPDATE ON public.followup_tindak_lanjut
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 5. INDEXES
-- ============================================================

CREATE INDEX idx_followup_tl_category ON public.followup_tindak_lanjut(category);
CREATE INDEX idx_followup_tl_status ON public.followup_tindak_lanjut(status);
CREATE INDEX idx_followup_tl_deadline ON public.followup_tindak_lanjut(deadline);
CREATE INDEX idx_followup_tl_created_by ON public.followup_tindak_lanjut(created_by);
