
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

-- Fix infinite recursion in RLS policies by using security definer functions

-- Create a security definer function to check if user is assigned to a project
CREATE OR REPLACE FUNCTION public.is_assigned_to_project(_user_id uuid, _project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.project_assignments
    WHERE user_id = _user_id
      AND project_id = _project_id
  )
$$;

-- Create a security definer function to check project status
CREATE OR REPLACE FUNCTION public.is_project_approved_or_active(_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.projects
    WHERE id = _project_id
      AND status IN ('approved', 'active')
  )
$$;

-- Create a security definer function to check if user is project owner
CREATE OR REPLACE FUNCTION public.is_project_owner(_user_id uuid, _project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.projects
    WHERE id = _project_id
      AND requester_id = _user_id
  )
$$;

-- Drop existing problematic policies on projects table
DROP POLICY IF EXISTS "Assigned users can view their assigned projects" ON public.projects;

-- Recreate the policy using the security definer function
CREATE POLICY "Assigned users can view their assigned projects"
ON public.projects
FOR SELECT
USING (public.is_assigned_to_project(auth.uid(), id));

-- Drop and recreate project_assignments policies to avoid recursion
DROP POLICY IF EXISTS "Project executors can view assignments for approved projects" ON public.project_assignments;

CREATE POLICY "Project executors can view assignments for approved projects"
ON public.project_assignments
FOR SELECT
USING (
  public.has_role(auth.uid(), 'project_executor') 
  AND public.is_project_approved_or_active(project_id)
);

-- Fix gantt_tasks policies that reference projects
DROP POLICY IF EXISTS "Project executors can view approved project tasks" ON public.gantt_tasks;
DROP POLICY IF EXISTS "Users can view tasks of their projects" ON public.gantt_tasks;
DROP POLICY IF EXISTS "Users can add tasks to their projects" ON public.gantt_tasks;
DROP POLICY IF EXISTS "Users can update tasks of their projects" ON public.gantt_tasks;
DROP POLICY IF EXISTS "Users can delete tasks of their projects" ON public.gantt_tasks;
DROP POLICY IF EXISTS "Assigned users can view tasks of assigned projects" ON public.gantt_tasks;

CREATE POLICY "Project executors can view approved project tasks"
ON public.gantt_tasks
FOR SELECT
USING (
  public.has_role(auth.uid(), 'project_executor') 
  AND public.is_project_approved_or_active(project_id)
);

CREATE POLICY "Users can view tasks of their projects"
ON public.gantt_tasks
FOR SELECT
USING (public.is_project_owner(auth.uid(), project_id));

CREATE POLICY "Users can add tasks to their projects"
ON public.gantt_tasks
FOR INSERT
WITH CHECK (public.is_project_owner(auth.uid(), project_id));

CREATE POLICY "Users can update tasks of their projects"
ON public.gantt_tasks
FOR UPDATE
USING (public.is_project_owner(auth.uid(), project_id));

CREATE POLICY "Users can delete tasks of their projects"
ON public.gantt_tasks
FOR DELETE
USING (public.is_project_owner(auth.uid(), project_id));

CREATE POLICY "Assigned users can view tasks of assigned projects"
ON public.gantt_tasks
FOR SELECT
USING (public.is_assigned_to_project(auth.uid(), project_id));

-- Fix project_edit_requests policies
DROP POLICY IF EXISTS "Users can create edit requests for their projects" ON public.project_edit_requests;

CREATE POLICY "Users can create edit requests for their projects"
ON public.project_edit_requests
FOR INSERT
WITH CHECK (
  auth.uid() = requester_id 
  AND public.is_project_owner(auth.uid(), project_id)
);

-- Fix gantt_task_edit_requests policies
DROP POLICY IF EXISTS "Users can create task edit requests" ON public.gantt_task_edit_requests;
DROP POLICY IF EXISTS "Project executors can create task edit requests" ON public.gantt_task_edit_requests;

CREATE POLICY "Users can create task edit requests"
ON public.gantt_task_edit_requests
FOR INSERT
WITH CHECK (
  auth.uid() = requester_id 
  AND public.is_project_owner(auth.uid(), project_id)
);

CREATE POLICY "Project executors can create task edit requests"
ON public.gantt_task_edit_requests
FOR INSERT
WITH CHECK (
  auth.uid() = requester_id 
  AND public.has_role(auth.uid(), 'project_executor') 
  AND public.is_project_approved_or_active(project_id)
);

-- Fix project_update_requests policies
DROP POLICY IF EXISTS "Project executors can create update requests" ON public.project_update_requests;
DROP POLICY IF EXISTS "Project owners can view update requests for their projects" ON public.project_update_requests;

CREATE POLICY "Project executors can create update requests"
ON public.project_update_requests
FOR INSERT
WITH CHECK (
  auth.uid() = requester_id 
  AND public.has_role(auth.uid(), 'project_executor') 
  AND public.is_project_approved_or_active(project_id)
);

CREATE POLICY "Project owners can view update requests for their projects"
ON public.project_update_requests
FOR SELECT
USING (public.is_project_owner(auth.uid(), project_id));

-- Fix project_update_logs policies
DROP POLICY IF EXISTS "Project executors can view update logs" ON public.project_update_logs;
DROP POLICY IF EXISTS "Project owners can view update logs" ON public.project_update_logs;

CREATE POLICY "Project executors can view update logs"
ON public.project_update_logs
FOR SELECT
USING (
  public.has_role(auth.uid(), 'project_executor') 
  AND public.is_project_approved_or_active(project_id)
);

CREATE POLICY "Project owners can view update logs"
ON public.project_update_logs
FOR SELECT
USING (public.is_project_owner(auth.uid(), project_id));

-- Create table for Unit Kerja change requests
CREATE TABLE public.unit_kerja_change_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  current_unit_kerja_id UUID REFERENCES public.unit_kerja(id),
  requested_unit_kerja_id UUID NOT NULL REFERENCES public.unit_kerja(id),
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_note TEXT,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.unit_kerja_change_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies for unit_kerja_change_requests
-- Users can view their own requests
CREATE POLICY "Users can view their own unit kerja requests"
  ON public.unit_kerja_change_requests FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create their own requests
CREATE POLICY "Users can create unit kerja change requests"
  ON public.unit_kerja_change_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Super admins can view all requests
CREATE POLICY "Super admins can view all unit kerja requests"
  ON public.unit_kerja_change_requests FOR SELECT
  USING (has_role(auth.uid(), 'super_admin'));

-- Super admins can update all requests
CREATE POLICY "Super admins can update unit kerja requests"
  ON public.unit_kerja_change_requests FOR UPDATE
  USING (has_role(auth.uid(), 'super_admin'));

-- Create trigger for updated_at
CREATE TRIGGER update_unit_kerja_change_requests_updated_at
  BEFORE UPDATE ON public.unit_kerja_change_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add progress_status column to track project progress after approval
-- Values: 'in_progress' (active), 'on_hold' (pending), 'completed' (done)
ALTER TABLE public.projects 
ADD COLUMN progress_status text DEFAULT 'in_progress';

-- Add check constraint for valid values
ALTER TABLE public.projects 
ADD CONSTRAINT projects_progress_status_check 
CHECK (progress_status IN ('in_progress', 'on_hold', 'completed'));

-- Update existing approved/active projects to have 'in_progress' status
UPDATE public.projects 
SET progress_status = 'in_progress' 
WHERE status IN ('approved', 'active') AND progress_status IS NULL;

-- Add monev_summary column to projects table for storing project monitoring and evaluation summary
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS monev_summary TEXT;


-- Add per-project pending reminder days setting (customizable by super admin)
ALTER TABLE public.projects 
ADD COLUMN pending_reminder_days integer NOT NULL DEFAULT 30;

-- Add new notification preference columns for new reminder types
ALTER TABLE public.notification_preferences 
ADD COLUMN email_no_progress_reminder boolean NOT NULL DEFAULT true,
ADD COLUMN email_pending_reminder boolean NOT NULL DEFAULT true,
ADD COLUMN email_monev_summary boolean NOT NULL DEFAULT true;



-- Add customizable reminder days for deadline warning
ALTER TABLE public.notification_preferences
ADD COLUMN reminder_days_before_deadline integer NOT NULL DEFAULT 7;


ALTER TABLE public.projects ADD COLUMN google_calendar_event_id TEXT;


-- Add Gmail verification columns
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS gmail_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS gmail_verification_code text,
  ADD COLUMN IF NOT EXISTS gmail_verification_expires_at timestamptz;


ALTER TABLE public.notification_preferences 
ADD COLUMN reminder_days_no_progress integer NOT NULL DEFAULT 7;


-- Add deliverable_result and problem columns to gantt_tasks
ALTER TABLE public.gantt_tasks ADD COLUMN deliverable_result text DEFAULT '';
ALTER TABLE public.gantt_tasks ADD COLUMN problem text DEFAULT '';

-- Add corresponding columns to gantt_task_edit_requests for proposed changes
ALTER TABLE public.gantt_task_edit_requests ADD COLUMN proposed_deliverable_result text DEFAULT NULL;
ALTER TABLE public.gantt_task_edit_requests ADD COLUMN proposed_problem text DEFAULT NULL;



-- Create storage bucket for deliverable attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('deliverable-attachments', 'deliverable-attachments', true);

-- Create policies for deliverable attachment uploads
CREATE POLICY "Anyone can view deliverable attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'deliverable-attachments');

CREATE POLICY "Authenticated users can upload deliverable attachments"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'deliverable-attachments' AND auth.role() = 'authenticated');

CREATE POLICY "Users can update their own deliverable attachments"
ON storage.objects FOR UPDATE
USING (bucket_id = 'deliverable-attachments' AND auth.role() = 'authenticated');

CREATE POLICY "Users can delete their own deliverable attachments"
ON storage.objects FOR DELETE
USING (bucket_id = 'deliverable-attachments' AND auth.role() = 'authenticated');



-- Create project_unit_kerja_assignments table
CREATE TABLE public.project_unit_kerja_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  unit_kerja_id UUID NOT NULL REFERENCES public.unit_kerja(id) ON DELETE CASCADE,
  assigned_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(project_id, unit_kerja_id)
);

-- Enable RLS
ALTER TABLE public.project_unit_kerja_assignments ENABLE ROW LEVEL SECURITY;

-- Super admin can manage all
CREATE POLICY "Super admin can manage all unit kerja assignments"
ON public.project_unit_kerja_assignments
FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Everyone can view
CREATE POLICY "Everyone can view unit kerja assignments"
ON public.project_unit_kerja_assignments
FOR SELECT
USING (true);



-- Create meetings table
CREATE TABLE public.meetings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  created_by uuid NOT NULL,
  title text NOT NULL,
  meeting_date date NOT NULL,
  meeting_time time NOT NULL DEFAULT '09:00',
  description text NOT NULL DEFAULT '',
  attachment_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can manage all meetings" ON public.meetings FOR ALL USING (has_role(auth.uid(), 'super_admin'::app_role));
CREATE POLICY "Admins can view all meetings" ON public.meetings FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can view own meetings" ON public.meetings FOR SELECT USING (auth.uid() = created_by);
CREATE POLICY "Users can create meetings" ON public.meetings FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Users can update own meetings" ON public.meetings FOR UPDATE USING (auth.uid() = created_by);
CREATE POLICY "Users can delete own meetings" ON public.meetings FOR DELETE USING (auth.uid() = created_by);

CREATE TRIGGER update_meetings_updated_at BEFORE UPDATE ON public.meetings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create project_documents table
CREATE TABLE public.project_documents (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  uploaded_by uuid NOT NULL,
  document_name text NOT NULL,
  document_url text NOT NULL,
  category text NOT NULL DEFAULT 'other',
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.project_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can manage all documents" ON public.project_documents FOR ALL USING (has_role(auth.uid(), 'super_admin'::app_role));
CREATE POLICY "Admins can manage all documents" ON public.project_documents FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Project owners can view documents" ON public.project_documents FOR SELECT USING (is_project_owner(auth.uid(), project_id));
CREATE POLICY "Assigned users can view documents" ON public.project_documents FOR SELECT USING (is_assigned_to_project(auth.uid(), project_id));
CREATE POLICY "Project owners can manage documents" ON public.project_documents FOR INSERT WITH CHECK (is_project_owner(auth.uid(), project_id));
CREATE POLICY "Project owners can update documents" ON public.project_documents FOR UPDATE USING (is_project_owner(auth.uid(), project_id));
CREATE POLICY "Project owners can delete documents" ON public.project_documents FOR DELETE USING (is_project_owner(auth.uid(), project_id));

CREATE TRIGGER update_project_documents_updated_at BEFORE UPDATE ON public.project_documents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create meeting-attachments storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('meeting-attachments', 'meeting-attachments', true);

CREATE POLICY "Anyone can view meeting attachments" ON storage.objects FOR SELECT USING (bucket_id = 'meeting-attachments');
CREATE POLICY "Authenticated users can upload meeting attachments" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'meeting-attachments' AND auth.role() = 'authenticated');
CREATE POLICY "Users can update own meeting attachments" ON storage.objects FOR UPDATE USING (bucket_id = 'meeting-attachments' AND auth.role() = 'authenticated');
CREATE POLICY "Users can delete own meeting attachments" ON storage.objects FOR DELETE USING (bucket_id = 'meeting-attachments' AND auth.role() = 'authenticated');



CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;



-- Create meeting_todos table
CREATE TABLE public.meeting_todos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_by UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  is_completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  converted_meeting_id UUID REFERENCES public.meetings(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.meeting_todos ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own todos" ON public.meeting_todos
  FOR SELECT USING (auth.uid() = created_by);

CREATE POLICY "Users can create todos" ON public.meeting_todos
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update own todos" ON public.meeting_todos
  FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "Users can delete own todos" ON public.meeting_todos
  FOR DELETE USING (auth.uid() = created_by);

CREATE POLICY "Super admins can manage all todos" ON public.meeting_todos
  FOR ALL USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Admins can view all todos" ON public.meeting_todos
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_meeting_todos_updated_at
  BEFORE UPDATE ON public.meeting_todos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();


