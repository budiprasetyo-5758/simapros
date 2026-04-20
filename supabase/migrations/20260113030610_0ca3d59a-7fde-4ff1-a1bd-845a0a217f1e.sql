-- Allow admins to delete projects
CREATE POLICY "Admins can delete projects"
ON public.projects
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'::app_role));