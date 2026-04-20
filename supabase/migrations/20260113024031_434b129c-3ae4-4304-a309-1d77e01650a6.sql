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