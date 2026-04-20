
-- Create meeting_todos table
CREATE TABLE public.meeting_todos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_by UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  is_completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  converted_meeting_id UUID REFERENCES public.meetings(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.meeting_todos ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own todos" ON public.meeting_todos
  FOR SELECT USING (auth.uid() = created_by);

CREATE POLICY "Users can create todos" ON public.meeting_todos
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update own todos" ON public.meeting_todos
  FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "Users can delete own todos" ON public.meeting_todos
  FOR DELETE USING (auth.uid() = created_by);

CREATE POLICY "Super admins can manage all todos" ON public.meeting_todos
  FOR ALL USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Admins can view all todos" ON public.meeting_todos
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_meeting_todos_updated_at
  BEFORE UPDATE ON public.meeting_todos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
