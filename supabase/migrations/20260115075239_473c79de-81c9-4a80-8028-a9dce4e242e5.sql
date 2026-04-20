-- Migration 2: Add impact column and create new tables

-- Add impact column to projects table
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS impact text DEFAULT 'medium';

-- Create project_update_requests table for storing pending changes from admin
CREATE TABLE IF NOT EXISTS public.project_update_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
    requester_id uuid NOT NULL,
    request_type text NOT NULL DEFAULT 'gantt_update',
    pending_changes jsonb NOT NULL DEFAULT '{}',
    status text NOT NULL DEFAULT 'pending',
    admin_note text,
    reviewed_by uuid,
    reviewed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create project_update_logs table for history of approved changes
CREATE TABLE IF NOT EXISTS public.project_update_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
    update_request_id uuid REFERENCES public.project_update_requests(id) ON DELETE SET NULL,
    changed_by uuid NOT NULL,
    approved_by uuid NOT NULL,
    change_type text NOT NULL,
    old_data jsonb NOT NULL DEFAULT '{}',
    new_data jsonb NOT NULL DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE public.project_update_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_update_logs ENABLE ROW LEVEL SECURITY;

-- Create trigger for updated_at
CREATE TRIGGER update_project_update_requests_updated_at
BEFORE UPDATE ON public.project_update_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();