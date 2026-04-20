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