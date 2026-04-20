-- Add progress_status column to track project progress after approval
-- Values: 'in_progress' (active), 'on_hold' (pending), 'completed' (done)
ALTER TABLE public.projects 
ADD COLUMN progress_status text DEFAULT 'in_progress';

-- Add check constraint for valid values
ALTER TABLE public.projects 
ADD CONSTRAINT projects_progress_status_check 
CHECK (progress_status IN ('in_progress', 'on_hold', 'completed'));

-- Update existing approved/active projects to have 'in_progress' status
UPDATE public.projects 
SET progress_status = 'in_progress' 
WHERE status IN ('approved', 'active') AND progress_status IS NULL;