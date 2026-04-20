-- Add whatsapp and gmail columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN whatsapp TEXT,
ADD COLUMN gmail TEXT;

-- Create table for unit_kerja change requests (pending approval)
CREATE TABLE public.unit_kerja_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requested_unit_kerja_id UUID REFERENCES public.unit_kerja(id) ON DELETE SET NULL,
  current_unit_kerja_id UUID REFERENCES public.unit_kerja(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on unit_kerja_requests
ALTER TABLE public.unit_kerja_requests ENABLE ROW LEVEL SECURITY;

-- Users can view their own requests
CREATE POLICY "Users can view their own unit_kerja requests"
ON public.unit_kerja_requests
FOR SELECT
USING (auth.uid() = user_id);

-- Users can create their own requests
CREATE POLICY "Users can create their own unit_kerja requests"
ON public.unit_kerja_requests
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Admins can view all requests
CREATE POLICY "Admins can view all unit_kerja requests"
ON public.unit_kerja_requests
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can update all requests (approve/reject)
CREATE POLICY "Admins can update unit_kerja requests"
ON public.unit_kerja_requests
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_unit_kerja_requests_updated_at
BEFORE UPDATE ON public.unit_kerja_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();