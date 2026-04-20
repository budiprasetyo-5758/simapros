-- Add phase column to gantt_tasks table
ALTER TABLE public.gantt_tasks
ADD COLUMN phase text DEFAULT '' NOT NULL;

-- Update status column to support new 'pending' status value
-- (Status already uses text type so no migration needed for values)