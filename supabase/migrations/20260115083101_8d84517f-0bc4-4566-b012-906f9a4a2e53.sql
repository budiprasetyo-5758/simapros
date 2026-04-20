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