-- Create daily_reports table for executor task reports
CREATE TABLE public.daily_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.gantt_tasks(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL,
  report_date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT NOT NULL,
  challenges TEXT,
  achievements TEXT,
  ai_calculated_progress INTEGER,
  ai_reasoning TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add progress_override column to gantt_tasks for super admin override
ALTER TABLE public.gantt_tasks ADD COLUMN IF NOT EXISTS progress_override INTEGER;
ALTER TABLE public.gantt_tasks ADD COLUMN IF NOT EXISTS progress_override_by UUID;
ALTER TABLE public.gantt_tasks ADD COLUMN IF NOT EXISTS progress_override_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.gantt_tasks ADD COLUMN IF NOT EXISTS ai_progress INTEGER;
ALTER TABLE public.gantt_tasks ADD COLUMN IF NOT EXISTS ai_progress_reasoning TEXT;

-- Enable RLS
ALTER TABLE public.daily_reports ENABLE ROW LEVEL SECURITY;

-- RLS Policies for daily_reports
CREATE POLICY "Project executors can create daily reports"
ON public.daily_reports
FOR INSERT
WITH CHECK (
  auth.uid() = reporter_id 
  AND has_role(auth.uid(), 'project_executor'::app_role)
);

CREATE POLICY "Project executors can view their own reports"
ON public.daily_reports
FOR SELECT
USING (auth.uid() = reporter_id);

CREATE POLICY "Super admins can view all reports"
ON public.daily_reports
FOR SELECT
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Admins can view all reports"
ON public.daily_reports
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Super admins can manage all reports"
ON public.daily_reports
FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Create unique constraint to prevent duplicate reports per day per task
CREATE UNIQUE INDEX idx_daily_reports_unique ON public.daily_reports(task_id, reporter_id, report_date);

-- Create trigger for updated_at
CREATE TRIGGER update_daily_reports_updated_at
BEFORE UPDATE ON public.daily_reports
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();