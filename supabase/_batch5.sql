
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


-- Add urgency and impact columns to projects table if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'urgency') THEN
    ALTER TABLE public.projects ADD COLUMN urgency text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'impact') THEN
    ALTER TABLE public.projects ADD COLUMN impact text;
  END IF;
END$$;

-- Re-add RLS policy for project executors to UPDATE approved/active projects directly
-- This was previously removed in migration 20260119062338 to enforce approval workflow,
-- but the business rule has changed: executors can now directly manage tasks and set urgency
-- without super admin approval.
DROP POLICY IF EXISTS "Project executors can update approved projects" ON public.projects;
CREATE POLICY "Project executors can update approved projects"
ON public.projects
FOR UPDATE
USING (
  has_role(auth.uid(), 'project_executor'::app_role) 
  AND status IN ('approved'::project_status, 'active'::project_status)
);

-- Re-add RLS policy for project executors to UPDATE gantt tasks of approved/active projects
DROP POLICY IF EXISTS "Project executors can update approved project tasks" ON public.gantt_tasks;
CREATE POLICY "Project executors can update approved project tasks"
ON public.gantt_tasks
FOR UPDATE
USING (
  has_role(auth.uid(), 'project_executor'::app_role)
  AND EXISTS (
    SELECT 1 FROM projects 
    WHERE projects.id = gantt_tasks.project_id 
    AND projects.status IN ('approved'::project_status, 'active'::project_status)
  )
);

-- Add INSERT policy for project executors to add new tasks to approved/active projects
DROP POLICY IF EXISTS "Project executors can insert tasks to approved projects" ON public.gantt_tasks;
CREATE POLICY "Project executors can insert tasks to approved projects"
ON public.gantt_tasks
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'project_executor'::app_role)
  AND EXISTS (
    SELECT 1 FROM projects 
    WHERE projects.id = gantt_tasks.project_id 
    AND projects.status IN ('approved'::project_status, 'active'::project_status)
  )
);

-- Add DELETE policy for project executors to delete tasks from approved/active projects
DROP POLICY IF EXISTS "Project executors can delete tasks from approved projects" ON public.gantt_tasks;
CREATE POLICY "Project executors can delete tasks from approved projects"
ON public.gantt_tasks
FOR DELETE
USING (
  has_role(auth.uid(), 'project_executor'::app_role)
  AND EXISTS (
    SELECT 1 FROM projects 
    WHERE projects.id = gantt_tasks.project_id 
    AND projects.status IN ('approved'::project_status, 'active'::project_status)
  )
);




-- ============================================================
-- Migration: Public Monitoring Dashboard
-- Enables read-only project monitoring via shareable links.
-- ============================================================

-- 1. Table: monitoring_links
CREATE TABLE IF NOT EXISTS public.monitoring_links (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  token UUID DEFAULT gen_random_uuid() UNIQUE NOT NULL,
  label TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. RLS for monitoring_links
ALTER TABLE public.monitoring_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_validate_monitoring_link"
  ON public.monitoring_links
  FOR SELECT TO anon
  USING (is_active = true AND (expires_at IS NULL OR expires_at > now()));

CREATE POLICY "super_admin_manage_monitoring_links"
  ON public.monitoring_links
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
  );

-- 3. Allow anon to read approved/active projects (read-only monitoring)
CREATE POLICY "anon_read_approved_projects"
  ON public.projects
  FOR SELECT TO anon
  USING (status IN ('approved', 'active'));

-- 4. Allow anon to read gantt_tasks for approved/active projects
CREATE POLICY "anon_read_gantt_tasks"
  ON public.gantt_tasks
  FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE id = project_id AND status IN ('approved', 'active')
    )
  );

-- 5. Allow anon to read master_proyek (for category filter)
CREATE POLICY "anon_read_master_proyek"
  ON public.master_proyek
  FOR SELECT TO anon
  USING (true);


CREATE TABLE public.pic_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pic_options ENABLE ROW LEVEL SECURITY;

-- Read: semua user bisa baca (untuk dropdown)
CREATE POLICY "pic_options_select" ON public.pic_options
  FOR SELECT USING (true);

-- Insert/Update/Delete: hanya super_admin
CREATE POLICY "pic_options_admin_insert" ON public.pic_options
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "pic_options_admin_update" ON public.pic_options
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "pic_options_admin_delete" ON public.pic_options
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
  );

-- Seed data dari hardcode yang ada
INSERT INTO public.pic_options (name, sort_order) VALUES
  ('Dr Ihza', 1),
  ('Dr Qonita', 2),
  ('Bg Salman', 3),
  ('Aqila', 4);


-- Tambahkan kolom google_calendar_event_id ke tabel meetings
ALTER TABLE public.meetings
ADD COLUMN IF NOT EXISTS google_calendar_event_id TEXT;


-- Add kendala (obstacle) fields to projects table
ALTER TABLE projects ADD COLUMN IF NOT EXISTS obstacle_notes text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS has_obstacle boolean DEFAULT false;


-- Migration: add_pic_to_projects
-- Run this in Supabase Dashboard > SQL Editor

ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS pic text DEFAULT NULL;


CREATE TABLE IF NOT EXISTS project_obstacles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  note text NOT NULL,
  is_resolved boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  created_by uuid REFERENCES profiles(id),
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Policies for project_obstacles
ALTER TABLE project_obstacles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for authenticated users" 
ON project_obstacles FOR SELECT 
USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert for authenticated users" 
ON project_obstacles FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" 
ON project_obstacles FOR UPDATE 
USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users" 
ON project_obstacles FOR DELETE 
USING (auth.role() = 'authenticated');


