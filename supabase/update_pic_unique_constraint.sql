-- ============================================================
-- Migration: Update Unique Constraint on Master PIC
--
-- Jalankan script ini di Supabase SQL Editor (Beta / Prod).
-- ============================================================

-- 1. Hapus aturan unik (unique constraint) lama yang hanya membatasi nama
ALTER TABLE public.pic_options
DROP CONSTRAINT IF EXISTS pic_options_name_key;

-- 2. Tambahkan aturan unik baru yang menggabungkan nama dan tipe PIC
-- Sehingga nama yang sama ("vin") bisa digunakan di tipe yang berbeda (misal: 'project' dan 'coresec_pic')
ALTER TABLE public.pic_options
ADD CONSTRAINT pic_options_name_pic_type_key UNIQUE (name, pic_type);
