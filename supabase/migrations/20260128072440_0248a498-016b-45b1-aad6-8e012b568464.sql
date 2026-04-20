-- Create table for Unit Kerja change requests
CREATE TABLE public.unit_kerja_change_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  current_unit_kerja_id UUID REFERENCES public.unit_kerja(id),
  requested_unit_kerja_id UUID NOT NULL REFERENCES public.unit_kerja(id),
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_note TEXT,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.unit_kerja_change_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies for unit_kerja_change_requests
-- Users can view their own requests
CREATE POLICY "Users can view their own unit kerja requests"
  ON public.unit_kerja_change_requests FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create their own requests
CREATE POLICY "Users can create unit kerja change requests"
  ON public.unit_kerja_change_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Super admins can view all requests
CREATE POLICY "Super admins can view all unit kerja requests"
  ON public.unit_kerja_change_requests FOR SELECT
  USING (has_role(auth.uid(), 'super_admin'));

-- Super admins can update all requests
CREATE POLICY "Super admins can update unit kerja requests"
  ON public.unit_kerja_change_requests FOR UPDATE
  USING (has_role(auth.uid(), 'super_admin'));

-- Create trigger for updated_at
CREATE TRIGGER update_unit_kerja_change_requests_updated_at
  BEFORE UPDATE ON public.unit_kerja_change_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();