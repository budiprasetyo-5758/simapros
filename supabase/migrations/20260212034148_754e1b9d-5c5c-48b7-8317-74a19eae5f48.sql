
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
