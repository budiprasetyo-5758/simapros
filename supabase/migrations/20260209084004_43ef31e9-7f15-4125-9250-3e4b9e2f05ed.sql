
-- Add per-project pending reminder days setting (customizable by super admin)
ALTER TABLE public.projects 
ADD COLUMN pending_reminder_days integer NOT NULL DEFAULT 30;

-- Add new notification preference columns for new reminder types
ALTER TABLE public.notification_preferences 
ADD COLUMN email_no_progress_reminder boolean NOT NULL DEFAULT true,
ADD COLUMN email_pending_reminder boolean NOT NULL DEFAULT true,
ADD COLUMN email_monev_summary boolean NOT NULL DEFAULT true;
