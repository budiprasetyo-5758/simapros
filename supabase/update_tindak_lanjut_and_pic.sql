-- ============================================================
-- Migration: Update Tindak Lanjut & Master PIC
--
-- Jalankan script ini di Supabase SQL Editor (Beta / Prod).
-- ============================================================

-- 1. Tambah kolom direksi & coresec ke followup_tindak_lanjut
ALTER TABLE public.followup_tindak_lanjut
ADD COLUMN direksi TEXT,
ADD COLUMN coresec TEXT;

-- 2. Tambah kolom pic_type ke pic_options
-- Tipe yang diizinkan: 'project', 'coresec_direksi', 'coresec_coresec', 'coresec_pic'
ALTER TABLE public.pic_options
ADD COLUMN pic_type TEXT NOT NULL DEFAULT 'project'
CHECK (pic_type IN ('project', 'coresec_direksi', 'coresec_coresec', 'coresec_pic'));

-- Index opsional untuk mempercepat pencarian berdasarkan tipe PIC
CREATE INDEX IF NOT EXISTS idx_pic_options_type ON public.pic_options(pic_type);
