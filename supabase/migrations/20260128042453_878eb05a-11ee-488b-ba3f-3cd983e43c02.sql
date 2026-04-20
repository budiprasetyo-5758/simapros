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