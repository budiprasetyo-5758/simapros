-- Create master_proyek table
CREATE TABLE public.master_proyek (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.master_proyek ENABLE ROW LEVEL SECURITY;

-- Everyone can read master_proyek (it's reference data)
CREATE POLICY "Everyone can view master_proyek"
ON public.master_proyek
FOR SELECT
USING (true);

-- Only super_admin can manage master_proyek
CREATE POLICY "Super admin can manage master_proyek"
ON public.master_proyek
FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Add master_proyek_id column to projects table
ALTER TABLE public.projects 
ADD COLUMN master_proyek_id UUID REFERENCES public.master_proyek(id);

-- Insert default master proyek values
INSERT INTO public.master_proyek (name, description) VALUES
('TDABC', 'Time-Driven Activity-Based Costing'),
('HISS', 'Hospital Information System Security'),
('Remunerasi', 'Sistem Remunerasi');

-- Create trigger for updated_at
CREATE TRIGGER update_master_proyek_updated_at
BEFORE UPDATE ON public.master_proyek
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();