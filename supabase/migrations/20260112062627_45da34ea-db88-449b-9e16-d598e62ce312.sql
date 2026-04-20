-- Add new columns to gantt_tasks table for spreadsheet view
ALTER TABLE public.gantt_tasks
ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS pic TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed')),
ADD COLUMN IF NOT EXISTS wbs_number TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS monev TEXT DEFAULT '';