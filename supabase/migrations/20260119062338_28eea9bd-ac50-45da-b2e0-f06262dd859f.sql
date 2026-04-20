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