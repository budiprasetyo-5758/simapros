-- Add parent_task_id column for subtask functionality
ALTER TABLE public.gantt_tasks 
ADD COLUMN parent_task_id UUID REFERENCES public.gantt_tasks(id) ON DELETE CASCADE;

-- Create index for faster queries
CREATE INDEX idx_gantt_tasks_parent ON public.gantt_tasks(parent_task_id);