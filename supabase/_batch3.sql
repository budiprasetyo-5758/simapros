
-- Migration 1: Add enum values only
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';
ALTER TYPE public.project_status ADD VALUE IF NOT EXISTS 'active';
ALTER TYPE public.project_status ADD VALUE IF NOT EXISTS 'pending_creation';

-- Migration 2: Add impact column and create new tables

-- Add impact column to projects table
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS impact text DEFAULT 'medium';

-- Create project_update_requests table for storing pending changes from admin
CREATE TABLE IF NOT EXISTS public.project_update_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
    requester_id uuid NOT NULL,
    request_type text NOT NULL DEFAULT 'gantt_update',
    pending_changes jsonb NOT NULL DEFAULT '{}',
    status text NOT NULL DEFAULT 'pending',
    admin_note text,
    reviewed_by uuid,
    reviewed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create project_update_logs table for history of approved changes
CREATE TABLE IF NOT EXISTS public.project_update_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
    update_request_id uuid REFERENCES public.project_update_requests(id) ON DELETE SET NULL,
    changed_by uuid NOT NULL,
    approved_by uuid NOT NULL,
    change_type text NOT NULL,
    old_data jsonb NOT NULL DEFAULT '{}',
    new_data jsonb NOT NULL DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE public.project_update_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_update_logs ENABLE ROW LEVEL SECURITY;

-- Create trigger for updated_at
CREATE TRIGGER update_project_update_requests_updated_at
BEFORE UPDATE ON public.project_update_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Migration 3: Add RLS policies for new tables and super_admin access

-- RLS policies for project_update_requests
CREATE POLICY "Admins can manage their update requests"
ON public.project_update_requests FOR ALL
USING (auth.uid() = requester_id AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Super admins can manage all update requests"
ON public.project_update_requests FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Project owners can view update requests for their projects"
ON public.project_update_requests FOR SELECT
USING (EXISTS (
    SELECT 1 FROM projects 
    WHERE projects.id = project_update_requests.project_id 
    AND projects.requester_id = auth.uid()
));

-- RLS policies for project_update_logs
CREATE POLICY "Super admins can manage all update logs"
ON public.project_update_logs FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Admins can view update logs for their requests"
ON public.project_update_logs FOR SELECT
USING (auth.uid() = changed_by OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Project owners can view update logs"
ON public.project_update_logs FOR SELECT
USING (EXISTS (
    SELECT 1 FROM projects 
    WHERE projects.id = project_update_logs.project_id 
    AND projects.requester_id = auth.uid()
));

-- Super admin policies for projects
CREATE POLICY "Super admins can view all projects"
ON public.projects FOR SELECT
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admins can update all projects"
ON public.projects FOR UPDATE
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admins can delete projects"
ON public.projects FOR DELETE
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Super admin policies for other tables
CREATE POLICY "Super admins can manage all tasks"
ON public.gantt_tasks FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admins can manage all task edit requests"
ON public.gantt_task_edit_requests FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admins can view all profiles"
ON public.profiles FOR SELECT
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admins can update all profiles"
ON public.profiles FOR UPDATE
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admins can manage all roles"
ON public.user_roles FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admins can manage all edit requests"
ON public.project_edit_requests FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admins can manage unit_kerja"
ON public.unit_kerja FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admins can manage unit_kerja_requests"
ON public.unit_kerja_requests FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admins can manage all collaborators"
ON public.project_collaborators FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Add project_executor to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'project_executor';

-- Drop functions with CASCADE to remove dependent policies
DROP FUNCTION IF EXISTS public.is_project_collaborator(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.user_can_view_project_as_collaborator(uuid, uuid) CASCADE;

-- Recreate the task edit request policy (was dropped by CASCADE)
CREATE POLICY "Users can create task edit requests" 
ON public.gantt_task_edit_requests 
FOR INSERT 
WITH CHECK (
  auth.uid() = requester_id 
  AND EXISTS (
    SELECT 1 FROM projects 
    WHERE projects.id = gantt_task_edit_requests.project_id 
    AND projects.requester_id = auth.uid()
  )
);

-- Project executors can also create task edit requests
CREATE POLICY "Project executors can create task edit requests" 
ON public.gantt_task_edit_requests 
FOR INSERT 
WITH CHECK (
  auth.uid() = requester_id 
  AND has_role(auth.uid(), 'project_executor')
  AND EXISTS (
    SELECT 1 FROM projects 
    WHERE projects.id = gantt_task_edit_requests.project_id 
    AND projects.status IN ('approved', 'active')
  )
);

-- Drop remaining policies that depend on unit_kerja_id
DROP POLICY IF EXISTS "Collaborating units can view their collaborations" ON public.project_collaborators;
DROP POLICY IF EXISTS "Collaborating units can view tasks" ON public.gantt_tasks;
DROP POLICY IF EXISTS "Collaborating units can add tasks" ON public.gantt_tasks;
DROP POLICY IF EXISTS "Collaborating units can update tasks" ON public.gantt_tasks;
DROP POLICY IF EXISTS "Collaborating units can delete tasks" ON public.gantt_tasks;

-- Now drop unit_kerja_id column from profiles with CASCADE
ALTER TABLE public.profiles DROP COLUMN IF EXISTS unit_kerja_id CASCADE;

-- Drop unit_kerja related tables
DROP TABLE IF EXISTS public.project_collaborators CASCADE;
DROP TABLE IF EXISTS public.unit_kerja_requests CASCADE;
DROP TABLE IF EXISTS public.unit_kerja CASCADE;

-- Add policy for project executors to view approved/active projects
CREATE POLICY "Project executors can view approved projects"
ON public.projects
FOR SELECT
USING (
  has_role(auth.uid(), 'project_executor'::app_role) 
  AND status IN ('approved'::project_status, 'active'::project_status)
);

-- Add policy for project executors to update approved/active projects
CREATE POLICY "Project executors can update approved projects"
ON public.projects
FOR UPDATE
USING (
  has_role(auth.uid(), 'project_executor'::app_role) 
  AND status IN ('approved'::project_status, 'active'::project_status)
);

-- Add policy for project executors to view gantt tasks of approved/active projects
CREATE POLICY "Project executors can view approved project tasks"
ON public.gantt_tasks
FOR SELECT
USING (
  has_role(auth.uid(), 'project_executor'::app_role)
  AND EXISTS (
    SELECT 1 FROM projects 
    WHERE projects.id = gantt_tasks.project_id 
    AND projects.status IN ('approved'::project_status, 'active'::project_status)
  )
);

-- Add policy for project executors to update gantt tasks of approved/active projects
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

-- Drop existing executor policies that allow direct updates
DROP POLICY IF EXISTS "Project executors can update approved projects" ON public.projects;
DROP POLICY IF EXISTS "Project executors can update approved project tasks" ON public.gantt_tasks;

-- Executor should only be able to VIEW approved/active projects (not update directly)
-- They must submit change requests that go through super admin approval

-- Add policy for project executors to INSERT into project_update_requests
DROP POLICY IF EXISTS "Project executors can create update requests" ON public.project_update_requests;
CREATE POLICY "Project executors can create update requests"
ON public.project_update_requests
FOR INSERT
WITH CHECK (
  auth.uid() = requester_id 
  AND has_role(auth.uid(), 'project_executor'::app_role)
  AND EXISTS (
    SELECT 1 FROM projects 
    WHERE projects.id = project_update_requests.project_id 
    AND projects.status IN ('approved'::project_status, 'active'::project_status)
  )
);

-- Add policy for project executors to view their own update requests
DROP POLICY IF EXISTS "Project executors can view their update requests" ON public.project_update_requests;
CREATE POLICY "Project executors can view their update requests"
ON public.project_update_requests
FOR SELECT
USING (
  auth.uid() = requester_id 
  AND has_role(auth.uid(), 'project_executor'::app_role)
);

-- Project executors can view update logs for projects they have access to
DROP POLICY IF EXISTS "Project executors can view update logs" ON public.project_update_logs;
CREATE POLICY "Project executors can view update logs"
ON public.project_update_logs
FOR SELECT
USING (
  has_role(auth.uid(), 'project_executor'::app_role)
  AND EXISTS (
    SELECT 1 FROM projects 
    WHERE projects.id = project_update_logs.project_id 
    AND projects.status IN ('approved'::project_status, 'active'::project_status)
  )
);

-- Users can view update logs for their own projects (to see progress updates)
DROP POLICY IF EXISTS "Project owners can view update logs" ON public.project_update_logs;
CREATE POLICY "Project owners can view update logs"
ON public.project_update_logs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM projects 
    WHERE projects.id = project_update_logs.project_id 
    AND projects.requester_id = auth.uid()
  )
);

-- Create master_proyek table
CREATE TABLE public.master_proyek (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.master_proyek ENABLE ROW LEVEL SECURITY;

-- Everyone can read master_proyek (it's reference data)
CREATE POLICY "Everyone can view master_proyek"
ON public.master_proyek
FOR SELECT
USING (true);

-- Only super_admin can manage master_proyek
CREATE POLICY "Super admin can manage master_proyek"
ON public.master_proyek
FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Add master_proyek_id column to projects table
ALTER TABLE public.projects 
ADD COLUMN master_proyek_id UUID REFERENCES public.master_proyek(id);

-- Insert default master proyek values
INSERT INTO public.master_proyek (name, description) VALUES
('TDABC', 'Time-Driven Activity-Based Costing'),
('HISS', 'Hospital Information System Security'),
('Remunerasi', 'Sistem Remunerasi');

-- Create trigger for updated_at
CREATE TRIGGER update_master_proyek_updated_at
BEFORE UPDATE ON public.master_proyek
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create daily_reports table for executor task reports
CREATE TABLE public.daily_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.gantt_tasks(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL,
  report_date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT NOT NULL,
  challenges TEXT,
  achievements TEXT,
  ai_calculated_progress INTEGER,
  ai_reasoning TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add progress_override column to gantt_tasks for super admin override
ALTER TABLE public.gantt_tasks ADD COLUMN IF NOT EXISTS progress_override INTEGER;
ALTER TABLE public.gantt_tasks ADD COLUMN IF NOT EXISTS progress_override_by UUID;
ALTER TABLE public.gantt_tasks ADD COLUMN IF NOT EXISTS progress_override_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.gantt_tasks ADD COLUMN IF NOT EXISTS ai_progress INTEGER;
ALTER TABLE public.gantt_tasks ADD COLUMN IF NOT EXISTS ai_progress_reasoning TEXT;

-- Enable RLS
ALTER TABLE public.daily_reports ENABLE ROW LEVEL SECURITY;

-- RLS Policies for daily_reports
CREATE POLICY "Project executors can create daily reports"
ON public.daily_reports
FOR INSERT
WITH CHECK (
  auth.uid() = reporter_id 
  AND has_role(auth.uid(), 'project_executor'::app_role)
);

CREATE POLICY "Project executors can view their own reports"
ON public.daily_reports
FOR SELECT
USING (auth.uid() = reporter_id);

CREATE POLICY "Super admins can view all reports"
ON public.daily_reports
FOR SELECT
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Admins can view all reports"
ON public.daily_reports
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Super admins can manage all reports"
ON public.daily_reports
FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Create unique constraint to prevent duplicate reports per day per task
CREATE UNIQUE INDEX idx_daily_reports_unique ON public.daily_reports(task_id, reporter_id, report_date);

-- Create trigger for updated_at
CREATE TRIGGER update_daily_reports_updated_at
BEFORE UPDATE ON public.daily_reports
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for daily report attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('daily-report-attachments', 'daily-report-attachments', true);

-- Add attachment column to daily_reports table
ALTER TABLE public.daily_reports ADD COLUMN attachment_url TEXT;

-- Storage policies for daily report attachments
CREATE POLICY "Users can upload attachments"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'daily-report-attachments' AND auth.role() = 'authenticated');

CREATE POLICY "Users can view attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'daily-report-attachments');

CREATE POLICY "Users can update their own attachments"
ON storage.objects FOR UPDATE
USING (bucket_id = 'daily-report-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own attachments"
ON storage.objects FOR DELETE
USING (bucket_id = 'daily-report-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Create notifications table for in-app notifications
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  type TEXT NOT NULL, -- 'proposal_approved', 'proposal_rejected', 'proposal_revision', 'deadline_warning', 'task_overdue', 'edit_request_approved', 'edit_request_rejected'
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT, -- Optional link to navigate to
  is_read BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Policies: Users can only see their own notifications
CREATE POLICY "Users can view their own notifications"
ON public.notifications
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
ON public.notifications
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notifications"
ON public.notifications
FOR DELETE
USING (auth.uid() = user_id);

-- System can insert notifications (via service role)
CREATE POLICY "Service role can insert notifications"
ON public.notifications
FOR INSERT
WITH CHECK (true);

-- Create index for faster queries
CREATE INDEX idx_notifications_user_unread ON public.notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX idx_notifications_created_at ON public.notifications(created_at DESC);

-- Enable realtime for notifications table
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Create notification preferences table
CREATE TABLE public.notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  email_proposal_approved BOOLEAN NOT NULL DEFAULT true,
  email_proposal_rejected BOOLEAN NOT NULL DEFAULT true,
  email_proposal_revision BOOLEAN NOT NULL DEFAULT true,
  email_deadline_warning BOOLEAN NOT NULL DEFAULT true,
  email_task_overdue BOOLEAN NOT NULL DEFAULT true,
  email_edit_request_approved BOOLEAN NOT NULL DEFAULT true,
  email_edit_request_rejected BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- Users can view their own preferences
CREATE POLICY "Users can view their own notification preferences"
ON public.notification_preferences
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own preferences
CREATE POLICY "Users can insert their own notification preferences"
ON public.notification_preferences
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own preferences
CREATE POLICY "Users can update their own notification preferences"
ON public.notification_preferences
FOR UPDATE
USING (auth.uid() = user_id);

-- Super admins can view all preferences
CREATE POLICY "Super admins can view all notification preferences"
ON public.notification_preferences
FOR SELECT
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_notification_preferences_updated_at
BEFORE UPDATE ON public.notification_preferences
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

