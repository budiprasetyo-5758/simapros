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