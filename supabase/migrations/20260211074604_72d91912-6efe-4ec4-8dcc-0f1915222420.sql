
-- Add deliverable_result and problem columns to gantt_tasks
ALTER TABLE public.gantt_tasks ADD COLUMN deliverable_result text DEFAULT '';
ALTER TABLE public.gantt_tasks ADD COLUMN problem text DEFAULT '';

-- Add corresponding columns to gantt_task_edit_requests for proposed changes
ALTER TABLE public.gantt_task_edit_requests ADD COLUMN proposed_deliverable_result text DEFAULT NULL;
ALTER TABLE public.gantt_task_edit_requests ADD COLUMN proposed_problem text DEFAULT NULL;
