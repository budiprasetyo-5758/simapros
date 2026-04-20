-- Create unit_kerja table
CREATE TABLE public.unit_kerja (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.unit_kerja ENABLE ROW LEVEL SECURITY;

-- Everyone can view unit_kerja
CREATE POLICY "Everyone can view unit_kerja"
ON public.unit_kerja
FOR SELECT
USING (true);

-- Only admins can insert unit_kerja
CREATE POLICY "Admins can insert unit_kerja"
ON public.unit_kerja
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Only admins can update unit_kerja
CREATE POLICY "Admins can update unit_kerja"
ON public.unit_kerja
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Only admins can delete unit_kerja
CREATE POLICY "Admins can delete unit_kerja"
ON public.unit_kerja
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add unit_kerja_id column to profiles table
ALTER TABLE public.profiles ADD COLUMN unit_kerja_id UUID REFERENCES public.unit_kerja(id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_unit_kerja_updated_at
BEFORE UPDATE ON public.unit_kerja
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add policy for users to view projects from their unit_kerja
CREATE POLICY "Users can view projects from their unit_kerja"
ON public.projects
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles p1
    JOIN profiles p2 ON p1.unit_kerja_id = p2.unit_kerja_id
    WHERE p1.id = auth.uid()
    AND p2.id = projects.requester_id
    AND p1.unit_kerja_id IS NOT NULL
  )
);