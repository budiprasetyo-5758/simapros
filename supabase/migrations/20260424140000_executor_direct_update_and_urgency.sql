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
