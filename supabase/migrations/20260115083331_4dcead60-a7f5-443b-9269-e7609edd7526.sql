-- Drop remaining policies that depend on unit_kerja_id
DROP POLICY IF EXISTS "Collaborating units can view their collaborations" ON public.project_collaborators;
DROP POLICY IF EXISTS "Collaborating units can view tasks" ON public.gantt_tasks;
DROP POLICY IF EXISTS "Collaborating units can add tasks" ON public.gantt_tasks;
DROP POLICY IF EXISTS "Collaborating units can update tasks" ON public.gantt_tasks;
DROP POLICY IF EXISTS "Collaborating units can delete tasks" ON public.gantt_tasks;

-- Now drop unit_kerja_id column from profiles with CASCADE
ALTER TABLE public.profiles DROP COLUMN IF EXISTS unit_kerja_id CASCADE;