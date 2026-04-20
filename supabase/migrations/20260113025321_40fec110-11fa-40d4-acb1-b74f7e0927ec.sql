-- Create table for gantt task edit requests
CREATE TABLE public.gantt_task_edit_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID REFERENCES public.gantt_tasks(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  requester_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  
  -- Proposed changes (null means no change)
  proposed_name TEXT,
  proposed_description TEXT,
  proposed_pic TEXT,
  proposed_phase TEXT,
  proposed_start_date DATE,
  proposed_end_date DATE,
  proposed_progress INTEGER,
  proposed_status TEXT,
  proposed_monev TEXT,
  proposed_wbs_number TEXT,
  
  -- New task flag (for add requests)
  is_new_task BOOLEAN DEFAULT false,
  -- Delete flag (for delete requests)
  is_delete_request BOOLEAN DEFAULT false,
  
  admin_note TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.gantt_task_edit_requests ENABLE ROW LEVEL SECURITY;

-- Admin can manage all task edit requests
CREATE POLICY "Admins can manage all task edit requests"
  ON public.gantt_task_edit_requests
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Users can view their own task edit requests
CREATE POLICY "Users can view their own task edit requests"
  ON public.gantt_task_edit_requests
  FOR SELECT
  USING (auth.uid() = requester_id);

-- Users can create task edit requests for projects they own or collaborate on
CREATE POLICY "Users can create task edit requests"
  ON public.gantt_task_edit_requests
  FOR INSERT
  WITH CHECK (
    auth.uid() = requester_id
    AND (
      EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND requester_id = auth.uid())
      OR public.is_project_collaborator(auth.uid(), project_id)
    )
  );

-- Trigger for updated_at
CREATE TRIGGER update_gantt_task_edit_requests_updated_at
  BEFORE UPDATE ON public.gantt_task_edit_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();