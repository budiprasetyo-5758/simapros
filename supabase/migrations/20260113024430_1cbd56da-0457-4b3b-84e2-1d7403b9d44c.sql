-- Create table for project edit requests
CREATE TABLE public.project_edit_requests (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    requester_id UUID NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    
    -- Store the proposed changes
    proposed_title TEXT,
    proposed_description TEXT,
    proposed_start_date DATE,
    proposed_end_date DATE,
    
    -- Admin response
    admin_note TEXT,
    reviewed_by UUID,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.project_edit_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can manage all edit requests"
ON public.project_edit_requests
FOR ALL
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view their own edit requests"
ON public.project_edit_requests
FOR SELECT
USING (auth.uid() = requester_id);

CREATE POLICY "Users can create edit requests for their projects"
ON public.project_edit_requests
FOR INSERT
WITH CHECK (
    auth.uid() = requester_id AND
    EXISTS (
        SELECT 1 FROM projects 
        WHERE projects.id = project_edit_requests.project_id 
        AND projects.requester_id = auth.uid()
    )
);

-- Create trigger for updated_at
CREATE TRIGGER update_project_edit_requests_updated_at
BEFORE UPDATE ON public.project_edit_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();