-- ============================================================
-- Follow Up Feature: Tables, RLS Policies, Storage Bucket
-- AKSES EKSKLUSIF: hanya super_admin
--
-- Jalankan script ini di Supabase SQL Editor.
-- Setelah berhasil dijalankan, balas dengan "Database Ready"
-- agar kami bisa melanjutkan ke pembuatan UI React (Task #2).
--
-- Untuk storage bucket, Anda juga bisa membuatnya secara manual:
-- Supabase Dashboard > Storage > New Bucket
-- Nama: followup-attachments, Public: ON
-- ============================================================

-- 1. BUAT TABEL
-- ============================================================

CREATE TABLE public.followup_meetings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL CHECK (category IN ('rapimtas', 'rapim', 'others')),
  title TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.followup_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID NOT NULL REFERENCES public.followup_meetings(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.followup_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID REFERENCES public.followup_meetings(id) ON DELETE CASCADE,
  task_id UUID REFERENCES public.followup_tasks(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size BIGINT,
  file_type TEXT NOT NULL CHECK (file_type IN ('task', 'meeting')),
  uploaded_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT followup_files_valid_link CHECK (meeting_id IS NOT NULL OR task_id IS NOT NULL)
);

-- 2. AKTIFKAN RLS
-- ============================================================

ALTER TABLE public.followup_meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.followup_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.followup_files ENABLE ROW LEVEL SECURITY;

-- 3. RLS POLICIES — followup_meetings
-- Hanya super_admin yang bisa mengakses
-- ============================================================

CREATE POLICY "Only super admins can access followup meetings"
  ON public.followup_meetings FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- 4. RLS POLICIES — followup_tasks
-- Hanya super_admin yang bisa mengakses
-- ============================================================

CREATE POLICY "Only super admins can access followup tasks"
  ON public.followup_tasks FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- 5. RLS POLICIES — followup_files
-- Hanya super_admin yang bisa mengakses
-- ============================================================

CREATE POLICY "Only super admins can access followup files"
  ON public.followup_files FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- 6. TRIGGER updated_at
-- ============================================================

CREATE TRIGGER update_followup_meetings_updated_at
  BEFORE UPDATE ON public.followup_meetings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_followup_tasks_updated_at
  BEFORE UPDATE ON public.followup_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 7. INDEX
-- ============================================================

CREATE INDEX idx_followup_meetings_category ON public.followup_meetings(category);
CREATE INDEX idx_followup_meetings_created_by ON public.followup_meetings(created_by);
CREATE INDEX idx_followup_tasks_meeting_id ON public.followup_tasks(meeting_id);
CREATE INDEX idx_followup_files_meeting_id ON public.followup_files(meeting_id);
CREATE INDEX idx_followup_files_task_id ON public.followup_files(task_id);

-- 8. STORAGE BUCKET
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('followup-attachments', 'followup-attachments', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Super admins can view followup attachments"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'followup-attachments' AND has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admins can upload followup attachments"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'followup-attachments' AND has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admins can update followup attachments"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'followup-attachments' AND has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admins can delete followup attachments"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'followup-attachments' AND has_role(auth.uid(), 'super_admin'::app_role));
