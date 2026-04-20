-- ============================================
-- MIGRATION: Multi-feature update for project management system
-- ============================================

-- 1. Create urgency enum for priority matrix
DO $$ BEGIN
  CREATE TYPE public.project_urgency AS ENUM ('very_low', 'low', 'medium', 'high');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Create impact enum for priority matrix
DO $$ BEGIN
  CREATE TYPE public.project_impact AS ENUM ('minimal', 'minor', 'significant', 'severe');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 3. Create calculated_priority enum 
DO $$ BEGIN
  CREATE TYPE public.calculated_priority AS ENUM ('low', 'medium', 'high', 'critical');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 4. Create unit_kerja table for work units master data
CREATE TABLE IF NOT EXISTS public.unit_kerja (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on unit_kerja
ALTER TABLE public.unit_kerja ENABLE ROW LEVEL SECURITY;

-- RLS policies for unit_kerja
CREATE POLICY "Everyone can view unit_kerja" ON public.unit_kerja
  FOR SELECT USING (true);

CREATE POLICY "Super admin can manage unit_kerja" ON public.unit_kerja
  FOR ALL USING (has_role(auth.uid(), 'super_admin'));

-- 5. Add unit_kerja_id to profiles table
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS unit_kerja_id UUID REFERENCES public.unit_kerja(id),
  ADD COLUMN IF NOT EXISTS profile_completed BOOLEAN NOT NULL DEFAULT false;

-- 6. Create project_assignments table for assigning users to projects
CREATE TABLE IF NOT EXISTS public.project_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  assigned_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(project_id, user_id)
);

-- Enable RLS on project_assignments
ALTER TABLE public.project_assignments ENABLE ROW LEVEL SECURITY;

-- RLS policies for project_assignments
CREATE POLICY "Super admin can manage all assignments" ON public.project_assignments
  FOR ALL USING (has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Users can view their own assignments" ON public.project_assignments
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Project executors can view assignments for approved projects" ON public.project_assignments
  FOR SELECT USING (
    has_role(auth.uid(), 'project_executor') AND 
    EXISTS (
      SELECT 1 FROM projects 
      WHERE projects.id = project_assignments.project_id 
      AND projects.status IN ('approved', 'active')
    )
  );

-- 7. Add new columns to projects table for urgency/impact priority matrix and attachment
ALTER TABLE public.projects 
  ADD COLUMN IF NOT EXISTS urgency TEXT DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS attachment_url TEXT;

-- 8. Update trigger for updated_at on unit_kerja
CREATE TRIGGER update_unit_kerja_updated_at
  BEFORE UPDATE ON public.unit_kerja
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 9. Add policy for assigned users to view projects they are assigned to
CREATE POLICY "Assigned users can view their assigned projects" ON public.projects
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM project_assignments 
      WHERE project_assignments.project_id = projects.id 
      AND project_assignments.user_id = auth.uid()
    )
  );

-- 10. Add policy for assigned users to view tasks of assigned projects
CREATE POLICY "Assigned users can view tasks of assigned projects" ON public.gantt_tasks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM project_assignments 
      WHERE project_assignments.project_id = gantt_tasks.project_id 
      AND project_assignments.user_id = auth.uid()
    )
  );

-- 11. Create storage bucket for project attachments if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('project-attachments', 'project-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- 12. Storage policies for project attachments
CREATE POLICY "Authenticated users can upload project attachments" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'project-attachments' AND 
    auth.role() = 'authenticated'
  );

CREATE POLICY "Anyone can view project attachments" ON storage.objects
  FOR SELECT USING (bucket_id = 'project-attachments');

CREATE POLICY "Users can delete their own project attachments" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'project-attachments' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- 13. Add policy for project executors to submit projects
CREATE POLICY "Project executors can create projects" ON public.projects
  FOR INSERT WITH CHECK (
    auth.uid() = requester_id AND 
    has_role(auth.uid(), 'project_executor')
  );