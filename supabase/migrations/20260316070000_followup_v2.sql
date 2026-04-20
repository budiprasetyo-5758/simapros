-- ============================================================
-- Follow Up Feature v2: DROP old tables, CREATE new schema
-- AKSES EKSKLUSIF: hanya super_admin
--
-- Jalankan script ini di Supabase SQL Editor.
-- Setelah berhasil dijalankan, balas dengan "Database Ready"
-- agar kami bisa melanjutkan ke pembuatan UI React.
-- ============================================================

-- 1. DROP OLD TABLES & POLICIES (CASCADE drops dependent objects)
-- ============================================================

DROP TABLE IF EXISTS public.followup_files CASCADE;
DROP TABLE IF EXISTS public.followup_tasks CASCADE;
DROP TABLE IF EXISTS public.followup_meetings CASCADE;

-- Drop old storage policies (IF EXISTS not supported; use DO block)
DO $$
BEGIN
  DROP POLICY IF EXISTS "Super admins can view followup attachments" ON storage.objects;
  DROP POLICY IF EXISTS "Super admins can upload followup attachments" ON storage.objects;
  DROP POLICY IF EXISTS "Super admins can update followup attachments" ON storage.objects;
  DROP POLICY IF EXISTS "Super admins can delete followup attachments" ON storage.objects;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- 2. CREATE NEW TABLES
-- ============================================================

CREATE TABLE public.followup_meetings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL CHECK (category IN ('rapimtas', 'rapim', 'others')),
  meeting_date DATE NOT NULL,
  title TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.followup_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID NOT NULL REFERENCES public.followup_meetings(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  pic TEXT NOT NULL,
  due_date DATE NOT NULL,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.followup_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID NOT NULL REFERENCES public.followup_meetings(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size BIGINT,
  file_category TEXT NOT NULL CHECK (file_category IN ('notulensi', 'pendukung')),
  uploaded_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 3. ENABLE RLS
-- ============================================================

ALTER TABLE public.followup_meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.followup_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.followup_files ENABLE ROW LEVEL SECURITY;

-- 4. RLS POLICIES — super_admin only (FOR ALL)
-- ============================================================

CREATE POLICY "Only super admins can access followup meetings"
  ON public.followup_meetings FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Only super admins can access followup tasks"
  ON public.followup_tasks FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Only super admins can access followup files"
  ON public.followup_files FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- 5. TRIGGERS — updated_at
-- ============================================================

CREATE TRIGGER update_followup_meetings_updated_at
  BEFORE UPDATE ON public.followup_meetings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_followup_tasks_updated_at
  BEFORE UPDATE ON public.followup_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 6. INDEXES
-- ============================================================

CREATE INDEX idx_followup_meetings_category ON public.followup_meetings(category);
CREATE INDEX idx_followup_meetings_created_by ON public.followup_meetings(created_by);
CREATE INDEX idx_followup_tasks_meeting_id ON public.followup_tasks(meeting_id);
CREATE INDEX idx_followup_tasks_due_date ON public.followup_tasks(due_date);
CREATE INDEX idx_followup_files_meeting_id ON public.followup_files(meeting_id);
CREATE INDEX idx_followup_files_file_category ON public.followup_files(file_category);

-- 7. STORAGE BUCKET & POLICIES
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
