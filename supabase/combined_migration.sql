-- ===== 20260112040810_5de81a28-5e77-4101-9899-d6e0c42316d4.sql =====
-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create user_roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL DEFAULT 'user',
    UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (prevents recursive RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- RLS policies for user_roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Create profiles table
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- RLS policies for profiles
CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Create enum for project status
CREATE TYPE public.project_status AS ENUM ('pending', 'approved', 'rejected', 'revision');

-- Create enum for project priority
CREATE TYPE public.project_priority AS ENUM ('low', 'medium', 'high', 'urgent');

-- Create enum for project stage
CREATE TYPE public.project_stage AS ENUM ('planning', 'execution', 'evaluation', 'followup');

-- Create projects table
CREATE TABLE public.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    unit TEXT NOT NULL,
    requester_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    requester_name TEXT NOT NULL,
    status project_status NOT NULL DEFAULT 'pending',
    priority project_priority NOT NULL DEFAULT 'medium',
    admin_note TEXT,
    project_stage project_stage NOT NULL DEFAULT 'planning',
    stage_notes JSONB DEFAULT '{"planning": "", "execution": "", "evaluation": "", "followup": ""}',
    update_requested BOOLEAN DEFAULT false,
    start_date DATE,
    end_date DATE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on projects
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- RLS policies for projects
CREATE POLICY "Users can view their own projects"
ON public.projects
FOR SELECT
USING (auth.uid() = requester_id);

CREATE POLICY "Users can create their own projects"
ON public.projects
FOR INSERT
WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "Users can update their own projects"
ON public.projects
FOR UPDATE
USING (auth.uid() = requester_id);

CREATE POLICY "Admins can view all projects"
ON public.projects
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update all projects"
ON public.projects
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- Create gantt_tasks table
CREATE TABLE public.gantt_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    progress INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on gantt_tasks
ALTER TABLE public.gantt_tasks ENABLE ROW LEVEL SECURITY;

-- RLS policies for gantt_tasks
CREATE POLICY "Users can view tasks of their projects"
ON public.gantt_tasks
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.projects 
        WHERE projects.id = gantt_tasks.project_id 
        AND projects.requester_id = auth.uid()
    )
);

CREATE POLICY "Admins can manage all tasks"
ON public.gantt_tasks
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    -- Create profile
    INSERT INTO public.profiles (id, name, email)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'name', NEW.email), NEW.email);
    
    -- Assign default 'user' role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'user');
    
    RETURN NEW;
END;
$$;

-- Trigger for new user creation
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Triggers for timestamp updates
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_projects_updated_at
    BEFORE UPDATE ON public.projects
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== 20260112042034_09ac0438-0606-485b-99be-5476a0e0ba4a.sql =====
-- Add INSERT policy for users to add tasks to their own projects
CREATE POLICY "Users can add tasks to their projects"
ON public.gantt_tasks
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = gantt_tasks.project_id
    AND projects.requester_id = auth.uid()
  )
);

-- Add UPDATE policy for users to update tasks of their own projects
CREATE POLICY "Users can update tasks of their projects"
ON public.gantt_tasks
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = gantt_tasks.project_id
    AND projects.requester_id = auth.uid()
  )
);

-- Add DELETE policy for users to delete tasks of their own projects
CREATE POLICY "Users can delete tasks of their projects"
ON public.gantt_tasks
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = gantt_tasks.project_id
    AND projects.requester_id = auth.uid()
  )
);

-- ===== 20260112042959_09758df7-443d-4d03-b721-d879b34f1f9c.sql =====
-- Allow admins to insert new roles
CREATE POLICY "Admins can insert roles"
ON public.user_roles
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to update roles
CREATE POLICY "Admins can update roles"
ON public.user_roles
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete roles
CREATE POLICY "Admins can delete roles"
ON public.user_roles
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- ===== 20260112062627_45da34ea-db88-449b-9e16-d598e62ce312.sql =====
-- Add new columns to gantt_tasks table for spreadsheet view
ALTER TABLE public.gantt_tasks
ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS pic TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed')),
ADD COLUMN IF NOT EXISTS wbs_number TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS monev TEXT DEFAULT '';

-- ===== 20260112075120_6b8babee-136d-4bea-a0f4-13f09c5daefc.sql =====
-- Create unit_kerja table
CREATE TABLE public.unit_kerja (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.unit_kerja ENABLE ROW LEVEL SECURITY;

-- Everyone can view unit_kerja
CREATE POLICY "Everyone can view unit_kerja"
ON public.unit_kerja
FOR SELECT
USING (true);

-- Only admins can insert unit_kerja
CREATE POLICY "Admins can insert unit_kerja"
ON public.unit_kerja
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Only admins can update unit_kerja
CREATE POLICY "Admins can update unit_kerja"
ON public.unit_kerja
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Only admins can delete unit_kerja
CREATE POLICY "Admins can delete unit_kerja"
ON public.unit_kerja
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add unit_kerja_id column to profiles table
ALTER TABLE public.profiles ADD COLUMN unit_kerja_id UUID REFERENCES public.unit_kerja(id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_unit_kerja_updated_at
BEFORE UPDATE ON public.unit_kerja
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add policy for users to view projects from their unit_kerja
CREATE POLICY "Users can view projects from their unit_kerja"
ON public.projects
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles p1
    JOIN profiles p2 ON p1.unit_kerja_id = p2.unit_kerja_id
    WHERE p1.id = auth.uid()
    AND p2.id = projects.requester_id
    AND p1.unit_kerja_id IS NOT NULL
  )
);

-- ===== 20260112080648_450917b3-375a-40e7-846e-ba197ecbe0b8.sql =====
-- Add whatsapp and gmail columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN whatsapp TEXT,
ADD COLUMN gmail TEXT;

-- Create table for unit_kerja change requests (pending approval)
CREATE TABLE public.unit_kerja_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requested_unit_kerja_id UUID REFERENCES public.unit_kerja(id) ON DELETE SET NULL,
  current_unit_kerja_id UUID REFERENCES public.unit_kerja(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on unit_kerja_requests
ALTER TABLE public.unit_kerja_requests ENABLE ROW LEVEL SECURITY;

-- Users can view their own requests
CREATE POLICY "Users can view their own unit_kerja requests"
ON public.unit_kerja_requests
FOR SELECT
USING (auth.uid() = user_id);

-- Users can create their own requests
CREATE POLICY "Users can create their own unit_kerja requests"
ON public.unit_kerja_requests
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Admins can view all requests
CREATE POLICY "Admins can view all unit_kerja requests"
ON public.unit_kerja_requests
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can update all requests (approve/reject)
CREATE POLICY "Admins can update unit_kerja requests"
ON public.unit_kerja_requests
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_unit_kerja_requests_updated_at
BEFORE UPDATE ON public.unit_kerja_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- ===== 20260112090824_d6109271-487c-40e8-9dcd-a71d967ae97f.sql =====
-- Add policy to allow admins to update any profile (for approving unit_kerja requests)
CREATE POLICY "Admins can update all profiles"
ON public.profiles
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- ===== 20260112091345_7433a6d5-957b-4160-b528-7a816eb76c97.sql =====
-- Add policy to allow admins to delete profiles
CREATE POLICY "Admins can delete profiles"
ON public.profiles
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- ===== 20260112092411_59e90d48-0030-4698-a01f-7c3afbfe791b.sql =====
-- Add phase column to gantt_tasks table
ALTER TABLE public.gantt_tasks
ADD COLUMN phase text DEFAULT '' NOT NULL;

-- Update status column to support new 'pending' status value
-- (Status already uses text type so no migration needed for values)

-- ===== 20260113023354_e022d630-48ca-41a9-a868-e20c4f7fc5dd.sql =====
-- Create table for project collaborating units
CREATE TABLE public.project_collaborators (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    unit_kerja_id UUID NOT NULL REFERENCES public.unit_kerja(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(project_id, unit_kerja_id)
);

-- Enable RLS
ALTER TABLE public.project_collaborators ENABLE ROW LEVEL SECURITY;

-- RLS Policies for project_collaborators
CREATE POLICY "Admins can manage all collaborators"
ON public.project_collaborators
FOR ALL
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Project owners can view collaborators"
ON public.project_collaborators
FOR SELECT
USING (EXISTS (
    SELECT 1 FROM projects 
    WHERE projects.id = project_collaborators.project_id 
    AND projects.requester_id = auth.uid()
));

CREATE POLICY "Project owners can add collaborators"
ON public.project_collaborators
FOR INSERT
WITH CHECK (EXISTS (
    SELECT 1 FROM projects 
    WHERE projects.id = project_collaborators.project_id 
    AND projects.requester_id = auth.uid()
));

CREATE POLICY "Project owners can remove collaborators"
ON public.project_collaborators
FOR DELETE
USING (EXISTS (
    SELECT 1 FROM projects 
    WHERE projects.id = project_collaborators.project_id 
    AND projects.requester_id = auth.uid()
));

CREATE POLICY "Collaborating units can view their collaborations"
ON public.project_collaborators
FOR SELECT
USING (EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.unit_kerja_id = project_collaborators.unit_kerja_id
));

-- Update projects RLS to allow collaborating units to view and update
CREATE POLICY "Collaborating units can view projects"
ON public.projects
FOR SELECT
USING (EXISTS (
    SELECT 1 FROM project_collaborators pc
    JOIN profiles p ON p.unit_kerja_id = pc.unit_kerja_id
    WHERE pc.project_id = projects.id
    AND p.id = auth.uid()
));

CREATE POLICY "Collaborating units can update projects"
ON public.projects
FOR UPDATE
USING (EXISTS (
    SELECT 1 FROM project_collaborators pc
    JOIN profiles p ON p.unit_kerja_id = pc.unit_kerja_id
    WHERE pc.project_id = projects.id
    AND p.id = auth.uid()
));

-- Allow collaborating units to manage gantt tasks
CREATE POLICY "Collaborating units can view tasks"
ON public.gantt_tasks
FOR SELECT
USING (EXISTS (
    SELECT 1 FROM project_collaborators pc
    JOIN profiles p ON p.unit_kerja_id = pc.unit_kerja_id
    WHERE pc.project_id = gantt_tasks.project_id
    AND p.id = auth.uid()
));

CREATE POLICY "Collaborating units can add tasks"
ON public.gantt_tasks
FOR INSERT
WITH CHECK (EXISTS (
    SELECT 1 FROM project_collaborators pc
    JOIN profiles p ON p.unit_kerja_id = pc.unit_kerja_id
    WHERE pc.project_id = gantt_tasks.project_id
    AND p.id = auth.uid()
));

CREATE POLICY "Collaborating units can update tasks"
ON public.gantt_tasks
FOR UPDATE
USING (EXISTS (
    SELECT 1 FROM project_collaborators pc
    JOIN profiles p ON p.unit_kerja_id = pc.unit_kerja_id
    WHERE pc.project_id = gantt_tasks.project_id
    AND p.id = auth.uid()
));

CREATE POLICY "Collaborating units can delete tasks"
ON public.gantt_tasks
FOR DELETE
USING (EXISTS (
    SELECT 1 FROM project_collaborators pc
    JOIN profiles p ON p.unit_kerja_id = pc.unit_kerja_id
    WHERE pc.project_id = gantt_tasks.project_id
    AND p.id = auth.uid()
));

-- ===== 20260113024031_434b129c-3ae4-4304-a309-1d77e01650a6.sql =====
-- Drop the problematic policies that cause recursion
DROP POLICY IF EXISTS "Collaborating units can view projects" ON public.projects;
DROP POLICY IF EXISTS "Collaborating units can update projects" ON public.projects;

-- Create security definer function to check if user is a collaborator
CREATE OR REPLACE FUNCTION public.is_project_collaborator(_user_id uuid, _project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM project_collaborators pc
    JOIN profiles p ON p.unit_kerja_id = pc.unit_kerja_id
    WHERE pc.project_id = _project_id
      AND p.id = _user_id
  )
$$;

-- Create security definer function to check if user belongs to a collaborating unit for any project
CREATE OR REPLACE FUNCTION public.user_can_view_project_as_collaborator(_user_id uuid, _project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM project_collaborators pc
    JOIN profiles p ON p.unit_kerja_id = pc.unit_kerja_id
    WHERE pc.project_id = _project_id
      AND p.id = _user_id
  )
$$;

-- Recreate policies using the security definer function
CREATE POLICY "Collaborating units can view projects"
ON public.projects
FOR SELECT
USING (public.user_can_view_project_as_collaborator(auth.uid(), id));

CREATE POLICY "Collaborating units can update projects"
ON public.projects
FOR UPDATE
USING (public.user_can_view_project_as_collaborator(auth.uid(), id));

-- ===== 20260113024430_1cbd56da-0457-4b3b-84e2-1d7403b9d44c.sql =====
-- Create table for project edit requests
CREATE TABLE public.project_edit_requests (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    requester_id UUID NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    
    -- Store the proposed changes
    proposed_title TEXT,
    proposed_description TEXT,
    proposed_start_date DATE,
    proposed_end_date DATE,
    
    -- Admin response
    admin_note TEXT,
    reviewed_by UUID,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.project_edit_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can manage all edit requests"
ON public.project_edit_requests
FOR ALL
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view their own edit requests"
ON public.project_edit_requests
FOR SELECT
USING (auth.uid() = requester_id);

CREATE POLICY "Users can create edit requests for their projects"
ON public.project_edit_requests
FOR INSERT
WITH CHECK (
    auth.uid() = requester_id AND
    EXISTS (
        SELECT 1 FROM projects 
        WHERE projects.id = project_edit_requests.project_id 
        AND projects.requester_id = auth.uid()
    )
);

-- Create trigger for updated_at
CREATE TRIGGER update_project_edit_requests_updated_at
BEFORE UPDATE ON public.project_edit_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- ===== 20260113025321_40fec110-11fa-40d4-acb1-b74f7e0927ec.sql =====
-- Create table for gantt task edit requests
CREATE TABLE public.gantt_task_edit_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID REFERENCES public.gantt_tasks(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  requester_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  
  -- Proposed changes (null means no change)
  proposed_name TEXT,
  proposed_description TEXT,
  proposed_pic TEXT,
  proposed_phase TEXT,
  proposed_start_date DATE,
  proposed_end_date DATE,
  proposed_progress INTEGER,
  proposed_status TEXT,
  proposed_monev TEXT,
  proposed_wbs_number TEXT,
  
  -- New task flag (for add requests)
  is_new_task BOOLEAN DEFAULT false,
  -- Delete flag (for delete requests)
  is_delete_request BOOLEAN DEFAULT false,
  
  admin_note TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.gantt_task_edit_requests ENABLE ROW LEVEL SECURITY;

-- Admin can manage all task edit requests
CREATE POLICY "Admins can manage all task edit requests"
  ON public.gantt_task_edit_requests
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Users can view their own task edit requests
CREATE POLICY "Users can view their own task edit requests"
  ON public.gantt_task_edit_requests
  FOR SELECT
  USING (auth.uid() = requester_id);

-- Users can create task edit requests for projects they own or collaborate on
CREATE POLICY "Users can create task edit requests"
  ON public.gantt_task_edit_requests
  FOR INSERT
  WITH CHECK (
    auth.uid() = requester_id
    AND (
      EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND requester_id = auth.uid())
      OR public.is_project_collaborator(auth.uid(), project_id)
    )
  );

-- Trigger for updated_at
CREATE TRIGGER update_gantt_task_edit_requests_updated_at
  BEFORE UPDATE ON public.gantt_task_edit_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ===== 20260113030610_0ca3d59a-7fde-4ff1-a1bd-845a0a217f1e.sql =====
-- Allow admins to delete projects
CREATE POLICY "Admins can delete projects"
ON public.projects
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- ===== 20260113073032_29dbe98d-e8b5-4f0b-afb0-c4e5d5ce0a05.sql =====
-- Add parent_task_id column for subtask functionality
ALTER TABLE public.gantt_tasks 
ADD COLUMN parent_task_id UUID REFERENCES public.gantt_tasks(id) ON DELETE CASCADE;

-- Create index for faster queries
CREATE INDEX idx_gantt_tasks_parent ON public.gantt_tasks(parent_task_id);

-- ===== 20260115075150_053d9d98-c269-4ea8-b43b-667aeb32b53e.sql =====
-- Migration 1: Add enum values only
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';
ALTER TYPE public.project_status ADD VALUE IF NOT EXISTS 'active';
ALTER TYPE public.project_status ADD VALUE IF NOT EXISTS 'pending_creation';

-- ===== 20260115075239_473c79de-81c9-4a80-8028-a9dce4e242e5.sql =====
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

-- ===== 20260115075326_730e8496-31ce-47b8-8363-a055a58c913f.sql =====
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

-- ===== 20260115080847_5230c7a9-0a05-4683-8db4-24c256f7386d.sql =====
-- Add project_executor to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'project_executor';

-- ===== 20260115083101_8d84517f-0bc4-4566-b012-906f9a4a2e53.sql =====
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

-- ===== 20260115083331_4dcead60-a7f5-443b-9269-e7609edd7526.sql =====
-- Drop remaining policies that depend on unit_kerja_id
DROP POLICY IF EXISTS "Collaborating units can view their collaborations" ON public.project_collaborators;
DROP POLICY IF EXISTS "Collaborating units can view tasks" ON public.gantt_tasks;
DROP POLICY IF EXISTS "Collaborating units can add tasks" ON public.gantt_tasks;
DROP POLICY IF EXISTS "Collaborating units can update tasks" ON public.gantt_tasks;
DROP POLICY IF EXISTS "Collaborating units can delete tasks" ON public.gantt_tasks;

-- Now drop unit_kerja_id column from profiles with CASCADE
ALTER TABLE public.profiles DROP COLUMN IF EXISTS unit_kerja_id CASCADE;

-- ===== 20260115083406_40e08a34-b9ef-4937-b4da-02dab54ae07d.sql =====
-- Drop unit_kerja related tables
DROP TABLE IF EXISTS public.project_collaborators CASCADE;
DROP TABLE IF EXISTS public.unit_kerja_requests CASCADE;
DROP TABLE IF EXISTS public.unit_kerja CASCADE;

-- ===== 20260119061037_91d07ab2-7845-400d-8b6b-bc0f78501e64.sql =====
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

-- ===== 20260119062338_28eea9bd-ac50-45da-b2e0-f06262dd859f.sql =====
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

-- ===== 20260119074338_32b51500-57f0-47c6-9294-ac0ae04d57af.sql =====
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

-- ===== 20260122074203_124910da-ff2c-4f92-b4d9-96791441a6ae.sql =====
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

-- ===== 20260123084342_5ea8bdfe-6ce2-41f4-b2f4-cbe589c82c7e.sql =====
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

-- ===== 20260123085110_0b19e486-9a1b-44dc-b3ec-8fa5243b68e7.sql =====
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

-- ===== 20260123085358_3af94e39-e36e-41e6-804a-ec86ab8d44ba.sql =====
-- Enable realtime for notifications table
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- ===== 20260123090412_8108c736-b23e-45f9-aa5d-f5b646acd935.sql =====
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

-- ===== 20260128041307_5ae41ff2-bd9f-47f9-9a0f-84f9a52660e1.sql =====
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

-- ===== 20260128042453_878eb05a-11ee-488b-ba3f-3cd983e43c02.sql =====
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

-- ===== 20260128072440_0248a498-016b-45b1-aad6-8e012b568464.sql =====
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

-- ===== 20260204035932_22fc3256-5ace-44a1-8509-2c79304bb37e.sql =====
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

-- ===== 20260205020848_25146376-c491-42cb-986e-f3b940344cce.sql =====
-- Add monev_summary column to projects table for storing project monitoring and evaluation summary
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS monev_summary TEXT;

-- ===== 20260209084004_43ef31e9-7f15-4125-9250-3e4b9e2f05ed.sql =====

-- Add per-project pending reminder days setting (customizable by super admin)
ALTER TABLE public.projects 
ADD COLUMN pending_reminder_days integer NOT NULL DEFAULT 30;

-- Add new notification preference columns for new reminder types
ALTER TABLE public.notification_preferences 
ADD COLUMN email_no_progress_reminder boolean NOT NULL DEFAULT true,
ADD COLUMN email_pending_reminder boolean NOT NULL DEFAULT true,
ADD COLUMN email_monev_summary boolean NOT NULL DEFAULT true;


-- ===== 20260209084814_be79df00-5661-4e36-af8c-158b5433d04e.sql =====

-- Add customizable reminder days for deadline warning
ALTER TABLE public.notification_preferences
ADD COLUMN reminder_days_before_deadline integer NOT NULL DEFAULT 7;


-- ===== 20260210015048_5fe53ac0-1bac-4e89-80f9-812924372013.sql =====
ALTER TABLE public.projects ADD COLUMN google_calendar_event_id TEXT;

-- ===== 20260210025638_74407df8-aa27-40f8-91a7-ad68ed209771.sql =====

-- Add Gmail verification columns
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS gmail_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS gmail_verification_code text,
  ADD COLUMN IF NOT EXISTS gmail_verification_expires_at timestamptz;


-- ===== 20260210034411_f8be9e69-b8b8-4f57-b074-29f5d8baa03d.sql =====
ALTER TABLE public.notification_preferences 
ADD COLUMN reminder_days_no_progress integer NOT NULL DEFAULT 7;

-- ===== 20260211074604_72d91912-6efe-4ec4-8dcc-0f1915222420.sql =====

-- Add deliverable_result and problem columns to gantt_tasks
ALTER TABLE public.gantt_tasks ADD COLUMN deliverable_result text DEFAULT '';
ALTER TABLE public.gantt_tasks ADD COLUMN problem text DEFAULT '';

-- Add corresponding columns to gantt_task_edit_requests for proposed changes
ALTER TABLE public.gantt_task_edit_requests ADD COLUMN proposed_deliverable_result text DEFAULT NULL;
ALTER TABLE public.gantt_task_edit_requests ADD COLUMN proposed_problem text DEFAULT NULL;


-- ===== 20260211081333_a59434cd-aa20-4507-ad5e-abe69cc6bf8e.sql =====

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


-- ===== 20260212034148_754e1b9d-5c5c-48b7-8317-74a19eae5f48.sql =====

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


-- ===== 20260212042600_1f06457a-19cd-447d-8516-7f47d7e33fe3.sql =====

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


-- ===== 20260212071823_71141827-480a-4630-bfb1-c99055bc2c4b.sql =====

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;


-- ===== 20260225042212_642a5eb7-7efb-4d64-8c69-c6751f4554ed.sql =====

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


-- ===== 20260316043600_followup_feature.sql =====
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

-- 3. RLS POLICIES â€” followup_meetings
-- Hanya super_admin yang bisa mengakses
-- ============================================================

CREATE POLICY "Only super admins can access followup meetings"
  ON public.followup_meetings FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- 4. RLS POLICIES â€” followup_tasks
-- Hanya super_admin yang bisa mengakses
-- ============================================================

CREATE POLICY "Only super admins can access followup tasks"
  ON public.followup_tasks FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- 5. RLS POLICIES â€” followup_files
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


-- ===== 20260316070000_followup_v2.sql =====
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

-- 4. RLS POLICIES â€” super_admin only (FOR ALL)
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

-- 5. TRIGGERS â€” updated_at
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


-- ===== 20260424140000_executor_direct_update_and_urgency.sql =====
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


-- ===== 20260427020000_public_project_submissions.sql =====


-- ===== 20260427040000_public_monitoring.sql =====
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


-- ===== 20260525140000_dynamic_pic_options.sql =====
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


-- ===== 20260525160000_add_calendar_id_to_meetings.sql =====
-- Tambahkan kolom google_calendar_event_id ke tabel meetings
ALTER TABLE public.meetings
ADD COLUMN IF NOT EXISTS google_calendar_event_id TEXT;


-- ===== add_kendala_to_projects.sql =====
-- Add kendala (obstacle) fields to projects table
ALTER TABLE projects ADD COLUMN IF NOT EXISTS obstacle_notes text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS has_obstacle boolean DEFAULT false;


-- ===== add_pic_to_projects.sql =====
-- Migration: add_pic_to_projects
-- Run this in Supabase Dashboard > SQL Editor

ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS pic text DEFAULT NULL;


-- ===== create_project_obstacles.sql =====
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



