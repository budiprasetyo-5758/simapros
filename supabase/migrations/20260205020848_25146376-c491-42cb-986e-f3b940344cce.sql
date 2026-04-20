-- Add monev_summary column to projects table for storing project monitoring and evaluation summary
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS monev_summary TEXT;