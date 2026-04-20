-- Add policy to allow admins to update any profile (for approving unit_kerja requests)
CREATE POLICY "Admins can update all profiles"
ON public.profiles
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));