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